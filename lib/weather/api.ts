import type { GeoLocation } from './types';

/**
 * Open-Meteo network layer.
 *
 * Open-Meteo is CORS-enabled and needs no API key, so requests go straight from
 * the client — no proxy route, no serverless cold start. Every response is
 * requested in a single canonical unit system (Celsius, km/h, metres) and
 * converted for display later, which keeps the local cache unit-independent.
 *
 * Nothing here knows about React. Nothing above here knows about Open-Meteo.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'weather_code',
  'cloud_cover',
  'visibility',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'sunrise',
  'sunset',
  'daylight_duration',
  'uv_index_max',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'precipitation_hours',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
].join(',');

const AIR_FIELDS = [
  'european_aqi',
  'pm10',
  'pm2_5',
  'ozone',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen',
].join(',');

export type WeatherErrorKind = 'offline' | 'network' | 'http' | 'parse' | 'notFound' | 'aborted';

export class WeatherError extends Error {
  readonly kind: WeatherErrorKind;

  constructor(kind: WeatherErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WeatherError';
    this.kind = kind;
  }
}

/** Raw Open-Meteo shapes. Deliberately loose — `transform.ts` validates. */
export interface RawForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
  elevation?: number;
  current?: Record<string, number | string>;
  hourly?: Record<string, Array<number | string | null>>;
  daily?: Record<string, Array<number | string | null>>;
}

export interface RawAirQuality {
  utc_offset_seconds: number;
  current?: Record<string, number | string | null>;
}

interface RawGeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  feature_code?: string;
  population?: number;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: 'no-store' });
  } catch (cause) {
    if (signal?.aborted) throw new WeatherError('aborted', 'Petición cancelada', { cause });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new WeatherError('offline', 'Sin conexión', { cause });
    }
    throw new WeatherError('network', 'No se ha podido conectar', { cause });
  }
  if (!response.ok) {
    throw new WeatherError('http', `El servicio ha respondido ${response.status}`);
  }
  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new WeatherError('parse', 'Respuesta inesperada del servicio', { cause });
  }
}

export function fetchForecast(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<RawForecast> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'auto',
    past_days: '1',
    forecast_days: '11',
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
  });
  return getJson<RawForecast>(`${FORECAST_URL}?${params.toString()}`, signal);
}

export function fetchAirQuality(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<RawAirQuality> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: AIR_FIELDS,
    timezone: 'auto',
    // The `domains` parameter is deliberately omitted. Pinning it to
    // `cams_global` returns null for every pollen species even in Europe, and a
    // less accurate AQI there too; the default picks the European model inside
    // Europe and the global one elsewhere, which is exactly what is wanted.
  });
  return getJson<RawAirQuality>(`${AIR_URL}?${params.toString()}`, signal);
}

export interface QuickCurrent {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

/**
 * Minimal current-conditions request.
 *
 * Used for the favourites list, where a dozen full forecasts would be wasteful:
 * this asks for three fields instead of forty and no hourly or daily series.
 */
export async function fetchQuickCurrent(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<QuickCurrent | null> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,weather_code,is_day',
    timezone: 'auto',
  });
  try {
    const data = await getJson<RawForecast>(`${FORECAST_URL}?${params.toString()}`, signal);
    const current = data.current;
    if (!current || typeof current.temperature_2m !== 'number') return null;
    return {
      temperature: current.temperature_2m,
      weatherCode: typeof current.weather_code === 'number' ? current.weather_code : 0,
      isDay: current.is_day !== 0,
    };
  } catch {
    return null;
  }
}

/** Tidies region names the geocoder returns inverted, e.g. "Valenciana, Comunidad". */
function normalizeRegion(value?: string): string | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length === 2 && parts[1]) return `${parts[1]} ${parts[0]}`;
  return value;
}

function toLocation(result: RawGeocodeResult): GeoLocation {
  return {
    id: String(result.id),
    name: result.name,
    admin1: normalizeRegion(result.admin1),
    admin2: result.admin2,
    country: result.country,
    countryCode: result.country_code,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone ?? 'auto',
  };
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
  limit = 8,
): Promise<GeoLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({
    name: trimmed,
    count: String(limit),
    language: 'es',
    format: 'json',
  });
  const data = await getJson<{ results?: RawGeocodeResult[] }>(
    `${GEOCODE_URL}?${params.toString()}`,
    signal,
  );
  if (!data.results?.length) return [];
  return data.results
    .filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude))
    .map(toLocation);
}

interface RawReverse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
}

/**
 * Turns device coordinates into a place name.
 *
 * Coordinates are rounded to two decimals (~1 km) before leaving the device:
 * that is plenty to name a town and deliberately not enough to point at a
 * street. If the lookup fails the caller falls back to a generic label, so this
 * never blocks the weather itself.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<{ name: string; admin1?: string; country?: string; countryCode?: string } | null> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    localityLanguage: 'es',
  });
  try {
    const data = await getJson<RawReverse>(`${REVERSE_URL}?${params.toString()}`, signal);
    const name = data.city || data.locality;
    if (!name) return null;
    return {
      name,
      admin1: normalizeRegion(data.principalSubdivision),
      country: data.countryName,
      countryCode: data.countryCode,
    };
  } catch {
    return null;
  }
}
