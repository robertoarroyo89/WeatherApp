/**
 * Solar geometry.
 *
 * The whole atmospheric engine is driven by the sun's elevation rather than by
 * clock hours, which is what makes the sky behave correctly at any latitude and
 * on any date (including polar day and polar night, where sunrise/sunset simply
 * do not exist).
 *
 * Implementation follows the NOAA General Solar Position Calculations, accurate
 * to well under a degree — far beyond what a gradient needs.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SolarPosition {
  /** Degrees above the horizon. Negative at night. */
  elevation: number;
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Hour angle in degrees: negative before solar noon, positive after. */
  hourAngle: number;
}

/** Days since Jan 1 of the given date's UTC year, 0-based. */
function dayOfYearUtc(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

export function solarPosition(date: Date, latitude: number, longitude: number): SolarPosition {
  const dayOfYear = dayOfYearUtc(date);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;

  // Fractional year, radians.
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear + (utcMinutes / 60 - 12) / 24);

  // Equation of time, minutes.
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination, radians.
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  // True solar time, minutes.
  const trueSolarTime = utcMinutes + eqTime + 4 * longitude;
  let hourAngle = trueSolarTime / 4 - 180;
  // Normalize into [-180, 180).
  hourAngle = ((((hourAngle + 180) % 360) + 360) % 360) - 180;

  const latRad = latitude * RAD;
  const haRad = hourAngle * RAD;

  const cosZenith =
    Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(haRad);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  const elevation = 90 - zenith * DEG;

  // Azimuth measured clockwise from north.
  const sinZenith = Math.sin(zenith);
  let azimuth = 180;
  if (sinZenith > 1e-6) {
    const cosAz =
      (Math.sin(latRad) * Math.cos(zenith) - Math.sin(decl)) / (Math.cos(latRad) * sinZenith);
    azimuth = Math.acos(Math.min(1, Math.max(-1, cosAz))) * DEG;
    if (hourAngle > 0) azimuth = 360 - azimuth;
  }

  return { elevation, azimuth, hourAngle };
}

/** Sun elevation only — the single most useful number for the sky engine. */
export function sunElevation(date: Date, latitude: number, longitude: number): number {
  return solarPosition(date, latitude, longitude).elevation;
}

export interface MoonState {
  /** 0 = new moon, 0.5 = full moon, 1 = new moon again. */
  phase: number;
  /** 0 = invisible, 1 = fully lit disc. */
  illumination: number;
}

/**
 * Moon phase from a simple mean-synodic-month approximation. Good to about a
 * few hours, which is irrelevant for drawing a crescent.
 */
export function moonState(date: Date): MoonState {
  const synodicMonth = 29.530588853;
  // Reference new moon: 2000-01-06 18:14 UTC.
  const reference = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - reference) / 86_400_000;
  const phase = (((days / synodicMonth) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { phase, illumination };
}

export interface SkyGeometry {
  elevation: number;
  azimuth: number;
  hourAngle: number;
  /** Horizontal screen position of the light source, 0 (left) to 1 (right). */
  x: number;
  /** Vertical screen position, 0 (top) to 1 (bottom). */
  y: number;
  /** 1 while the sun is up, 0 once it is well below the horizon. */
  daylight: number;
  /** 1 deep in the night, 0 in full day — drives stars and haze. */
  night: number;
  isDay: boolean;
}

/**
 * Projects the sun onto the viewport.
 *
 * This is an artistic projection, not a planetarium: the light source travels
 * left to right across the day so it reads as "morning" or "afternoon" at a
 * glance, regardless of which way the phone happens to be facing.
 */
export function skyGeometry(date: Date, latitude: number, longitude: number): SkyGeometry {
  const { elevation, azimuth, hourAngle } = solarPosition(date, latitude, longitude);

  const x = 0.5 + 0.4 * Math.sin(hourAngle * RAD);
  const climb = Math.max(-0.25, Math.min(1, elevation / 68));
  const y = 0.86 - 0.72 * climb;

  const daylight = smoothstep(-0.8, 2, elevation);
  const night = 1 - smoothstep(-11, -1.5, elevation);

  return { elevation, azimuth, hourAngle, x, y, daylight, night, isDay: elevation > -0.833 };
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Named daypart, derived from sun elevation and whether the sun is climbing.
 * Used for copy, never for colour decisions.
 */
export type DayPart =
  | 'night'
  | 'preDawn'
  | 'sunrise'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'goldenHour'
  | 'sunset'
  | 'blueHour';

export function dayPart(elevation: number, rising: boolean): DayPart {
  if (elevation < -12) return 'night';
  if (elevation < -3) return rising ? 'preDawn' : 'blueHour';
  if (elevation < 1) return rising ? 'sunrise' : 'sunset';
  if (elevation < 8) return rising ? 'morning' : 'goldenHour';
  if (elevation < 30) return rising ? 'morning' : 'afternoon';
  return 'midday';
}

/** True when the sun is still climbing (before solar noon). */
export function isRising(hourAngle: number): boolean {
  return hourAngle < 0;
}
