'use client';

export type GeolocationFailure = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeolocationRequestError extends Error {
  readonly reason: GeolocationFailure;

  constructor(reason: GeolocationFailure, message: string) {
    super(message);
    this.name = 'GeolocationRequestError';
    this.reason = reason;
  }
}

export interface DevicePosition {
  latitude: number;
  longitude: number;
  /** Metres of uncertainty reported by the platform. */
  accuracy: number;
}

const MESSAGES: Record<GeolocationFailure, string> = {
  unsupported: 'Este dispositivo no puede darnos tu ubicación.',
  denied: 'No nos has dado permiso para usar tu ubicación.',
  unavailable: 'No hemos podido determinar dónde estás.',
  timeout: 'La ubicación está tardando demasiado.',
};

/**
 * Asks the platform for a position.
 *
 * Called only after the user has pressed "Usar mi ubicación", never on load —
 * a permission sheet that appears before any explanation is the fastest way to
 * get a permanent "no".
 */
export function requestDevicePosition(timeoutMs = 12_000): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GeolocationRequestError('unsupported', MESSAGES.unsupported));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        const reason: GeolocationFailure =
          error.code === error.PERMISSION_DENIED
            ? 'denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        reject(new GeolocationRequestError(reason, MESSAGES[reason]));
      },
      {
        // A city-level fix is all a weather app needs, and the low-accuracy
        // path is far faster and cheaper on battery than a GPS lock.
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 5 * 60_000,
      },
    );
  });
}

/** Whether permission has already been granted, when the browser will say. */
export async function geolocationPermissionState(): Promise<PermissionState | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unsupported';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unsupported';
  }
}
