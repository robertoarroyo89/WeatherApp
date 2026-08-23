'use client';

import { useSyncExternalStore } from 'react';
import {
  dismissError,
  getServerWeatherState,
  getWeatherState,
  refresh,
  requestDeviceLocation,
  selectLocation,
  subscribeWeather,
  toggleFavourite,
  updatePreferences,
  type WeatherState,
} from '@/lib/store/weatherStore';
import type { GeoLocation } from '@/lib/weather/types';
import { useNow } from './useNow';
import { useOnline } from './useEnvironment';

export interface WeatherView extends WeatherState {
  /** The currently selected place, or null before onboarding. */
  location: GeoLocation | null;
  /** Current time to the nearest half minute; 0 before hydration. */
  nowTs: number;
  online: boolean;
  updatePreferences: typeof updatePreferences;
  selectLocation: typeof selectLocation;
  toggleFavourite: typeof toggleFavourite;
  refresh: typeof refresh;
  requestLocation: typeof requestDeviceLocation;
  dismissError: typeof dismissError;
}

/**
 * Reads the weather store.
 *
 * There is no provider: the store is a module, so components subscribe to it
 * directly and only re-render when it actually changes. That also means the data
 * layer is usable outside React (and testable without it).
 */
export function useWeather(): WeatherView {
  const state = useSyncExternalStore(subscribeWeather, getWeatherState, getServerWeatherState);
  const nowTs = useNow();
  const online = useOnline();

  return {
    ...state,
    location: state.locations.selected,
    nowTs,
    online,
    updatePreferences,
    selectLocation,
    toggleFavourite,
    refresh,
    requestLocation: requestDeviceLocation,
    dismissError,
  };
}
