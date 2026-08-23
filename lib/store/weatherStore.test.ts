// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rawForecastResponse, VALENCIA } from '@/lib/testing/fixtures';
import type { GeoLocation } from '@/lib/weather/types';

/**
 * Tests for the loading strategy, which is the part of the app most likely to
 * fail in a way nobody notices until they are on a train with no signal.
 *
 * The store is a singleton module, so each case imports a fresh copy.
 */

type Store = typeof import('./weatherStore');

const MADRID: GeoLocation = {
  id: '3117735',
  name: 'Madrid',
  admin1: 'Comunidad de Madrid',
  country: 'España',
  countryCode: 'ES',
  latitude: 40.4165,
  longitude: -3.70256,
  timezone: 'Europe/Madrid',
};

function selectedIn(location: GeoLocation) {
  window.localStorage.setItem(
    'atmos.v1.locations',
    JSON.stringify({ selected: location, favourites: [], recents: [] }),
  );
}

/** Writes a cache entry as the app would, with a chosen age. */
function cacheEntry(location: GeoLocation, ageMs: number) {
  window.localStorage.setItem(
    `atmos.v1.forecast.${location.id}`,
    JSON.stringify({
      location,
      forecast: rawForecastResponse(),
      air: null,
      savedAt: Date.now() - ageMs,
    }),
  );
}

async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import('./weatherStore');
}

/** Resolves once the store stops loading, or the attempt times out. */
async function settle(store: Store, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    const { status } = store.getWeatherState();
    if (status !== 'loading' && status !== 'refreshing' && status !== 'idle') return;
    if (Date.now() - startedAt > timeoutMs) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cold start', () => {
  it('fetches, transforms and caches when there is nothing stored', async () => {
    const fetchMock = vi.fn(async () => okResponse(rawForecastResponse()));
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);

    const state = store.getWeatherState();
    expect(state.status).toBe('ready');
    expect(state.bundle?.current.temperature).toBe(29.6);
    expect(state.error).toBeNull();
    // Forecast and air quality, in parallel.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(`atmos.v1.forecast.${VALENCIA.id}`)).not.toBeNull();
  });

  it('reports a fatal error when the very first load fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    selectedIn(VALENCIA);

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);

    const state = store.getWeatherState();
    // This exact combination is what puts the app on its error screen.
    expect(state.status).toBe('error');
    expect(state.bundle).toBeNull();
    expect(state.error?.message).toMatch(/no hemos podido|sin conexión/i);
    expect(state.error?.soft).toBe(false);
  });

  it('keeps the forecast when only air quality fails', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes('air-quality')) throw new TypeError('Failed to fetch');
      return okResponse(rawForecastResponse());
    });
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);

    const state = store.getWeatherState();
    expect(state.status).toBe('ready');
    expect(state.bundle).not.toBeNull();
    expect(state.bundle?.air).toBeNull();
    expect(state.error).toBeNull();
  });

  it('does nothing at all until something subscribes', async () => {
    const fetchMock = vi.fn(async () => okResponse(rawForecastResponse()));
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);

    const store = await freshStore();
    expect(store.getWeatherState().hydrated).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cache behaviour', () => {
  it('serves a fresh cache without touching the network', async () => {
    const fetchMock = vi.fn(async () => okResponse(rawForecastResponse()));
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);
    cacheEntry(VALENCIA, 60_000); // one minute old

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);

    const state = store.getWeatherState();
    expect(state.status).toBe('ready');
    expect(state.bundle).not.toBeNull();
    expect(state.stale).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('paints a stale cache first, then refreshes behind it', async () => {
    const fetchMock = vi.fn(async () => okResponse(rawForecastResponse()));
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);
    cacheEntry(VALENCIA, 45 * 60_000); // stale, but usable

    const store = await freshStore();
    store.subscribeWeather(() => {});

    // Synchronously after subscribing there is already something on screen.
    const immediate = store.getWeatherState();
    expect(immediate.bundle).not.toBeNull();
    expect(immediate.stale).toBe(true);
    expect(immediate.status).toBe('refreshing');

    await settle(store);
    expect(store.getWeatherState().stale).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('keeps stale data on screen when the refresh fails, as a soft error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    selectedIn(VALENCIA);
    cacheEntry(VALENCIA, 45 * 60_000);

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);

    const state = store.getWeatherState();
    // Old weather beats an apology.
    expect(state.bundle).not.toBeNull();
    expect(state.status).toBe('ready');
    expect(state.error?.soft).toBe(true);
  });

  it('ignores a cache entry that is far too old to be useful', async () => {
    const fetchMock = vi.fn(async () => okResponse(rawForecastResponse()));
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);
    cacheEntry(VALENCIA, 48 * 60 * 60_000); // two days

    const store = await freshStore();
    store.subscribeWeather(() => {});
    expect(store.getWeatherState().bundle).toBeNull();
    await settle(store);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('survives a corrupt cache entry', async () => {
    const fetchMock = vi.fn(async () => okResponse(rawForecastResponse()));
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);
    window.localStorage.setItem(`atmos.v1.forecast.${VALENCIA.id}`, '{"nonsense":true}');

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);
    expect(store.getWeatherState().status).toBe('ready');
  });
});

describe('changing location', () => {
  it('clears the previous city rather than showing its weather under a new name', async () => {
    const fetchMock = vi.fn(async () => okResponse(rawForecastResponse()));
    vi.stubGlobal('fetch', fetchMock);
    selectedIn(VALENCIA);
    cacheEntry(VALENCIA, 60_000);

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);
    expect(store.getWeatherState().bundle).not.toBeNull();

    store.selectLocation(MADRID);
    // No cache for Madrid, so there must be nothing on screen for it yet.
    expect(store.getWeatherState().bundle).toBeNull();
    expect(store.getWeatherState().locations.selected?.name).toBe('Madrid');

    await settle(store);
    expect(store.getWeatherState().status).toBe('ready');
  });

  it('records a searched city as recent, but not a device position', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse(rawForecastResponse())),
    );
    selectedIn(VALENCIA);

    const store = await freshStore();
    store.subscribeWeather(() => {});
    await settle(store);

    store.selectLocation(MADRID);
    expect(store.getWeatherState().locations.recents.map((r) => r.name)).toContain('Madrid');

    store.selectLocation({ ...MADRID, id: 'device:40.42,-3.70', fromDevice: true });
    const recents = store.getWeatherState().locations.recents;
    expect(recents.some((r) => r.fromDevice)).toBe(false);
  });
});

describe('preferences', () => {
  it('persists a change immediately', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse(rawForecastResponse())),
    );
    const store = await freshStore();
    store.subscribeWeather(() => {});

    store.updatePreferences({ temperatureUnit: 'fahrenheit' });
    expect(store.getWeatherState().preferences.temperatureUnit).toBe('fahrenheit');
    expect(window.localStorage.getItem('atmos.v1.preferences')).toContain('fahrenheit');
  });

  it('notifies subscribers so the interface can react', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse(rawForecastResponse())),
    );
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribeWeather(listener);
    listener.mockClear();

    store.updatePreferences({ windUnit: 'mph' });
    expect(listener).toHaveBeenCalled();
  });
});
