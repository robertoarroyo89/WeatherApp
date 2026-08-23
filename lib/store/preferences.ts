import type { TemperatureUnit, WindUnit } from '@/lib/weather/types';
import { readJson, writeJson } from './storage';

/**
 * User preferences, persisted locally.
 *
 * No account, no backend, no sync in V1 — but the shape is a plain serialisable
 * object so that moving it behind an API later is a change of transport, not a
 * change of model.
 */

export type MotionPreference = 'system' | 'reduced';

export interface Preferences {
  temperatureUnit: TemperatureUnit;
  windUnit: WindUnit;
  /** Master switch for the atmospheric particle and drift animations. */
  sceneAnimations: boolean;
  motion: MotionPreference;
  /** Whether the location screen has been dealt with. */
  onboarded: boolean;
  /** True once the user has agreed to use the device position. */
  useDeviceLocation: boolean;
  /** Suppresses the "add to home screen" hint once dismissed. */
  installHintDismissed: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  temperatureUnit: 'celsius',
  windUnit: 'kmh',
  sceneAnimations: true,
  motion: 'system',
  onboarded: false,
  useDeviceLocation: false,
  installHintDismissed: false,
};

const KEY = 'preferences';

export function loadPreferences(): Preferences {
  const stored = readJson<Partial<Preferences>>(KEY, {});
  // Merge over the defaults so a preference added in a later release does not
  // arrive as undefined for existing users.
  return { ...DEFAULT_PREFERENCES, ...stored };
}

export function savePreferences(preferences: Preferences): void {
  writeJson(KEY, preferences);
}
