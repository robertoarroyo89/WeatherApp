'use client';

import {
  fetchAirQuality,
  fetchForecast,
  reverseGeocode,
  WeatherError,
  type RawAirQuality,
} from '@/lib/weather/api';
import { transformForecast } from '@/lib/weather/transform';
import type { GeoLocation, WeatherBundle } from '@/lib/weather/types';
import { bundleFromCache, FRESH_MS, isFresh, isUsable, readCache, writeCache } from './cache';
import {
  EMPTY_LOCATION_STATE,
  loadLocationState,
  locationKey,
  saveLocationState,
  toggleFavourite as toggleFavouriteIn,
  withRecent,
  type LocationState,
} from './locations';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './preferences';
import { GeolocationRequestError, requestDevicePosition } from '@/lib/hooks/useGeolocation';

/**
 * The application's data layer, as an external store.
 *
 * Weather data is genuinely an external system — a network, a disk cache, a
 * geolocation sensor — so React subscribes to it rather than owning it. That is
 * what keeps the fetching logic out of effects: there is no "load on mount"
 * effect to write, because loading begins the first time anything subscribes.
 *
 * Loading strategy, in order:
 *   1. paint the cached forecast immediately, however old it is
 *   2. if it is fresh, stop — no request at all
 *   3. otherwise refresh behind the visible data (stale-while-revalidate)
 *   4. if the refresh fails, keep showing the cache and surface a quiet notice
 *
 * A returning user therefore sees real weather on the first frame, and a user
 * with no connection sees the last forecast instead of an error page.
 */

export type LoadStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

export interface AppError {
  message: string;
  /** True when there is still usable data on screen behind the error. */
  soft: boolean;
}

export interface WeatherState {
  /** True once the persisted preferences and places have been read. */
  hydrated: boolean;
  preferences: Preferences;
  locations: LocationState;
  bundle: WeatherBundle | null;
  status: LoadStatus;
  error: AppError | null;
  lastUpdated: number | null;
  /** Showing data older than the freshness window. */
  stale: boolean;
  locating: boolean;
}

const INITIAL: WeatherState = {
  hydrated: false,
  preferences: DEFAULT_PREFERENCES,
  locations: EMPTY_LOCATION_STATE,
  bundle: null,
  status: 'idle',
  error: null,
  lastUpdated: null,
  stale: false,
  locating: false,
};

let state: WeatherState = INITIAL;
const listeners = new Set<() => void>();

function emit(patch: Partial<WeatherState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function getWeatherState(): WeatherState {
  return state;
}

export function getServerWeatherState(): WeatherState {
  return INITIAL;
}

/* ---------------------------------------------------------------- requests -- */

let controller: AbortController | null = null;
/** Guards against a slow response for a place the user has already left. */
let activeKey: string | null = null;

function toAppError(cause: unknown, soft: boolean): AppError {
  if (cause instanceof WeatherError) {
    const message =
      cause.kind === 'offline'
        ? 'Sin conexión. Te mostramos los últimos datos guardados.'
        : cause.kind === 'network'
          ? 'No hemos podido actualizar el tiempo.'
          : cause.kind === 'http'
            ? 'El servicio del tiempo no responde ahora mismo.'
            : 'Los datos han llegado incompletos.';
    return { message, soft };
  }
  if (cause instanceof GeolocationRequestError) return { message: cause.message, soft };
  return { message: 'Algo ha ido mal al cargar el tiempo.', soft };
}

async function load(target: GeoLocation, options: { force?: boolean } = {}): Promise<void> {
  const key = locationKey(target);
  activeKey = key;
  controller?.abort();
  const request = new AbortController();
  controller = request;

  const startedAt = Date.now();
  let served = false;

  // Steps 1 and 2: the cache, and the network call we can avoid entirely.
  const cached = readCache(target);
  if (cached && isUsable(cached, startedAt)) {
    const cachedBundle = bundleFromCache(cached);
    if (cachedBundle) {
      served = true;
      emit({
        bundle: cachedBundle,
        lastUpdated: cached.savedAt,
        stale: !isFresh(cached, startedAt),
        status: 'ready',
      });
      if (isFresh(cached, startedAt) && !options.force) return;
    }
  }

  emit({ status: served ? 'refreshing' : 'loading', error: served ? state.error : null });

  try {
    const [forecast, air] = await Promise.all([
      fetchForecast(target.latitude, target.longitude, request.signal),
      // Air quality is a bonus: a failure here must not lose the forecast.
      fetchAirQuality(target.latitude, target.longitude, request.signal).catch(
        () => null as RawAirQuality | null,
      ),
    ]);
    if (activeKey !== key) return;

    const savedAt = Date.now();
    emit({
      bundle: transformForecast(forecast, target, air, savedAt),
      lastUpdated: savedAt,
      stale: false,
      status: 'ready',
      error: null,
    });
    writeCache({ location: target, forecast, air, savedAt });
  } catch (cause) {
    if (request.signal.aborted || activeKey !== key) return;
    if (cause instanceof WeatherError && cause.kind === 'aborted') return;
    emit({ error: toAppError(cause, served), status: served ? 'ready' : 'error' });
  }
}

/* ----------------------------------------------------------------- actions -- */

export function updatePreferences(patch: Partial<Preferences>): void {
  const preferences = { ...state.preferences, ...patch };
  savePreferences(preferences);
  emit({ preferences });
}

function persistLocations(locations: LocationState): void {
  saveLocationState(locations);
  emit({ locations });
}

export function selectLocation(target: GeoLocation): void {
  persistLocations(withRecent({ ...state.locations, selected: target }, target));
  emit({ bundle: null, lastUpdated: null, stale: false, error: null });
  void load(target);
}

export function refresh(options: { force?: boolean } = {}): void {
  const target = state.locations.selected;
  if (!target) return;
  void load(target, { force: options.force ?? true });
}

export function toggleFavourite(target: GeoLocation): void {
  persistLocations(toggleFavouriteIn(state.locations, target));
}

export function dismissError(): void {
  emit({ error: null });
}

export async function requestDeviceLocation(): Promise<void> {
  emit({ locating: true, error: null });
  try {
    const position = await requestDevicePosition();
    // The place name is a nicety; the forecast does not depend on it.
    const place = await reverseGeocode(position.latitude, position.longitude);
    const target: GeoLocation = {
      id: `device:${position.latitude.toFixed(2)},${position.longitude.toFixed(2)}`,
      name: place?.name ?? 'Mi ubicación',
      admin1: place?.admin1,
      country: place?.country,
      countryCode: place?.countryCode,
      latitude: position.latitude,
      longitude: position.longitude,
      timezone: 'auto',
      fromDevice: true,
    };
    persistLocations({ ...state.locations, selected: target });
    emit({ bundle: null, lastUpdated: null, stale: false });
    updatePreferences({ useDeviceLocation: true, onboarded: true });
    await load(target, { force: true });
  } catch (cause) {
    emit({ error: toAppError(cause, state.bundle !== null) });
  } finally {
    emit({ locating: false });
  }
}

/* ------------------------------------------------------------- lifecycle -- */

function maybeRefresh(): void {
  const target = state.locations.selected;
  if (!target || document.visibilityState !== 'visible') return;
  if (state.lastUpdated === null) return;
  if (Date.now() - state.lastUpdated > FRESH_MS) void load(target);
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') maybeRefresh();
}

function onOnline(): void {
  // Coming back online is the best moment to retry a failed load.
  if (state.status === 'error' && state.locations.selected) void load(state.locations.selected);
  else maybeRefresh();
}

let initialised = false;

/**
 * Reads persisted state and wires up the ambient listeners. Runs exactly once
 * for the lifetime of the page.
 */
function initialise(): void {
  if (initialised) return;
  initialised = true;
  state = {
    ...state,
    preferences: loadPreferences(),
    locations: loadLocationState(),
    hydrated: true,
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', onOnline);
  setInterval(maybeRefresh, 5 * 60_000);
}

/** Starts a load if — and only if — one is actually needed. */
function ensureLoaded(): void {
  const target = state.locations.selected;
  if (!target) return;
  if (state.status === 'loading' || state.status === 'refreshing') return;
  if (state.bundle && state.lastUpdated !== null && Date.now() - state.lastUpdated < FRESH_MS) {
    return;
  }
  void load(target);
}

/**
 * Subscribing is what starts the app.
 *
 * Note what this deliberately does *not* do: tear anything down when the last
 * subscriber leaves. Under React's development double-mount the subscription is
 * created, disposed and created again, and a teardown here would abort the very
 * first forecast request and then decline to retry it — the app would sit on a
 * skeleton forever in development and work in production, which is the worst
 * possible way for a bug to behave. This store's lifetime is the page's.
 */
export function subscribeWeather(listener: () => void): () => void {
  listeners.add(listener);
  initialise();
  ensureLoaded();
  return () => {
    listeners.delete(listener);
  };
}
