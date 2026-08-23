import type { RawAirQuality, RawForecast } from '@/lib/weather/api';
import { transformForecast } from '@/lib/weather/transform';
import type { GeoLocation, WeatherBundle } from '@/lib/weather/types';
import { locationKey } from './locations';
import { listKeys, readJson, removeKey, writeJson } from './storage';

/**
 * Local weather cache.
 *
 * The *raw* provider responses are cached rather than the transformed bundle:
 * Open-Meteo returns column-oriented arrays of numbers, which serialise to
 * roughly a tenth of the size of the equivalent array of hourly objects. Twelve
 * days of hourly data fits comfortably, so several cities can be kept offline.
 *
 * Freshness is per data class — a ten-day outlook does not go stale as fast as
 * the current temperature — and stale entries are still served immediately
 * while a refresh runs behind them.
 */

export interface CachedForecast {
  location: GeoLocation;
  forecast: RawForecast;
  air: RawAirQuality | null;
  savedAt: number;
}

/** Current conditions are worth re-fetching after this long. */
export const FRESH_MS = 12 * 60_000;
/** Beyond this a cached response is only good enough for an offline fallback. */
export const STALE_MS = 6 * 60 * 60_000;
const MAX_ENTRIES = 8;

function cacheKey(location: GeoLocation): string {
  return `forecast.${locationKey(location)}`;
}

export function readCache(location: GeoLocation): CachedForecast | null {
  const entry = readJson<CachedForecast | null>(cacheKey(location), null);
  if (!entry?.forecast?.hourly) return null;
  return entry;
}

export function writeCache(entry: CachedForecast): void {
  const stored = writeJson(cacheKey(entry.location), entry);
  if (!stored) {
    // Quota reached: drop the oldest entries and try once more.
    pruneCache(MAX_ENTRIES / 2);
    writeJson(cacheKey(entry.location), entry);
  }
}

export function isFresh(entry: CachedForecast, now: number): boolean {
  return now - entry.savedAt < FRESH_MS;
}

export function isUsable(entry: CachedForecast, now: number): boolean {
  return now - entry.savedAt < STALE_MS;
}

/** Rehydrates a cached response into a domain bundle. */
export function bundleFromCache(entry: CachedForecast): WeatherBundle | null {
  try {
    return transformForecast(entry.forecast, entry.location, entry.air, entry.savedAt);
  } catch {
    // A cache entry written by an older, incompatible version.
    removeKey(cacheKey(entry.location));
    return null;
  }
}

/** Keeps the newest `keep` entries and discards the rest. */
export function pruneCache(keep = MAX_ENTRIES): void {
  const entries = listKeys()
    .filter((key) => key.startsWith('forecast.'))
    .map((key) => ({ key, savedAt: readJson<CachedForecast | null>(key, null)?.savedAt ?? 0 }))
    .sort((a, b) => b.savedAt - a.savedAt);
  for (const entry of entries.slice(keep)) removeKey(entry.key);
}
