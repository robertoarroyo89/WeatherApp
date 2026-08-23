import type { GeoLocation } from '@/lib/weather/types';
import { readJson, writeJson } from './storage';

/** Saved places: the selected one, favourites, and recent searches. */

export interface LocationState {
  selected: GeoLocation | null;
  favourites: GeoLocation[];
  recents: GeoLocation[];
}

const KEY = 'locations';
const MAX_RECENTS = 6;
const MAX_FAVOURITES = 12;

export const EMPTY_LOCATION_STATE: LocationState = {
  selected: null,
  favourites: [],
  recents: [],
};

/** Stable key for a place. Device positions round to ~1 km so they dedupe. */
export function locationKey(location: GeoLocation): string {
  if (location.fromDevice) {
    return `device:${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  }
  return location.id || `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
}

export function sameLocation(a: GeoLocation | null, b: GeoLocation | null): boolean {
  if (!a || !b) return a === b;
  return locationKey(a) === locationKey(b);
}

export function loadLocationState(): LocationState {
  const stored = readJson<Partial<LocationState>>(KEY, {});
  return {
    selected: stored.selected ?? null,
    favourites: Array.isArray(stored.favourites) ? stored.favourites.slice(0, MAX_FAVOURITES) : [],
    recents: Array.isArray(stored.recents) ? stored.recents.slice(0, MAX_RECENTS) : [],
  };
}

export function saveLocationState(state: LocationState): void {
  writeJson(KEY, state);
}

export function withRecent(state: LocationState, location: GeoLocation): LocationState {
  // A device position is not a "recent search" — it is always available anyway.
  if (location.fromDevice) return state;
  const key = locationKey(location);
  const recents = [location, ...state.recents.filter((item) => locationKey(item) !== key)];
  return { ...state, recents: recents.slice(0, MAX_RECENTS) };
}

export function toggleFavourite(state: LocationState, location: GeoLocation): LocationState {
  const key = locationKey(location);
  const existing = state.favourites.some((item) => locationKey(item) === key);
  if (existing) {
    return { ...state, favourites: state.favourites.filter((item) => locationKey(item) !== key) };
  }
  return { ...state, favourites: [...state.favourites, location].slice(0, MAX_FAVOURITES) };
}

export function isFavourite(state: LocationState, location: GeoLocation | null): boolean {
  if (!location) return false;
  const key = locationKey(location);
  return state.favourites.some((item) => locationKey(item) === key);
}

/** Short "Comunidad Valenciana, España" style subtitle. */
export function locationSubtitle(location: GeoLocation): string {
  return [location.admin1, location.country].filter(Boolean).join(', ');
}
