/**
 * localStorage access that cannot throw.
 *
 * Safari in private mode, storage-disabled webviews and full quotas all throw
 * on access rather than returning null, and a weather app must never fail to
 * render because a preference could not be read.
 */

const PREFIX = 'atmos.v1.';

function available(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readJson<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  if (!available()) return false;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    // Most likely a quota error. The app keeps working from memory.
    return false;
  }
}

export function removeKey(key: string): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Keys currently stored under the app prefix, without the prefix. */
export function listKeys(): string[] {
  if (!available()) return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key.slice(PREFIX.length));
    }
    return keys;
  } catch {
    return [];
  }
}
