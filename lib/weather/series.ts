import { dateKeyInZone } from '@/lib/format';
import type { DailyPoint, HourlyPoint, WeatherBundle } from './types';

/** Shared helpers for slicing the hourly and daily series. */

/** Index of the hourly bucket containing `nowTs`, or the closest one. */
export function currentHourIndex(hourly: HourlyPoint[], nowTs: number): number {
  if (!hourly.length) return -1;
  for (let i = hourly.length - 1; i >= 0; i -= 1) {
    if (hourly[i].timestamp <= nowTs) return i;
  }
  return 0;
}

/** The hourly points from the current hour onward, at most `count` of them. */
export function upcomingHours(bundle: WeatherBundle, nowTs: number, count = 24): HourlyPoint[] {
  const index = currentHourIndex(bundle.hourly, nowTs);
  if (index < 0) return [];
  return bundle.hourly.slice(index, index + count);
}

/** Hourly points for a given local date key ("YYYY-MM-DD"). */
export function hoursForDate(bundle: WeatherBundle, dateKey: string): HourlyPoint[] {
  return bundle.hourly.filter((point) => point.time.slice(0, 10) === dateKey);
}

/** Today's daily entry in the location's timezone. */
export function todayDaily(bundle: WeatherBundle, nowTs: number): DailyPoint | null {
  const key = dateKeyInZone(nowTs, bundle.timezone);
  return bundle.daily.find((day) => day.date === key) ?? bundle.daily[0] ?? null;
}

/** Daily entries from today onward, at most `count`. */
export function upcomingDays(bundle: WeatherBundle, nowTs: number, count = 10): DailyPoint[] {
  const key = dateKeyInZone(nowTs, bundle.timezone);
  const start = bundle.daily.findIndex((day) => day.date >= key);
  const from = start < 0 ? 0 : start;
  return bundle.daily.slice(from, from + count);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Hourly data sampled at an arbitrary instant.
 *
 * Continuous metrics are interpolated so that dragging the scrubber produces a
 * smooth ramp rather than 24 discrete steps; the weather code comes from the
 * nearer of the two hours, because there is no meaningful halfway point between
 * "cubierto" and "lluvia".
 */
export function sampleHour(hourly: HourlyPoint[], timestamp: number): HourlyPoint | null {
  if (!hourly.length) return null;
  if (timestamp <= hourly[0].timestamp) return hourly[0];
  const last = hourly[hourly.length - 1];
  if (timestamp >= last.timestamp) return last;

  let a = hourly[0];
  let b = hourly[0];
  for (let i = 0; i < hourly.length - 1; i += 1) {
    if (timestamp >= hourly[i].timestamp && timestamp <= hourly[i + 1].timestamp) {
      a = hourly[i];
      b = hourly[i + 1];
      break;
    }
  }
  const span = b.timestamp - a.timestamp;
  const t = span === 0 ? 0 : (timestamp - a.timestamp) / span;
  const nearer = t < 0.5 ? a : b;

  return {
    ...nearer,
    time: nearer.time,
    timestamp,
    temperature: lerp(a.temperature, b.temperature, t),
    apparentTemperature: lerp(a.apparentTemperature, b.apparentTemperature, t),
    humidity: lerp(a.humidity, b.humidity, t),
    dewPoint: lerp(a.dewPoint, b.dewPoint, t),
    precipitation: lerp(a.precipitation, b.precipitation, t),
    precipitationProbability: lerp(a.precipitationProbability, b.precipitationProbability, t),
    rain: lerp(a.rain, b.rain, t),
    showers: lerp(a.showers, b.showers, t),
    snowfall: lerp(a.snowfall, b.snowfall, t),
    cloudCover: lerp(a.cloudCover, b.cloudCover, t),
    visibility: lerp(a.visibility, b.visibility, t),
    windSpeed: lerp(a.windSpeed, b.windSpeed, t),
    windGusts: lerp(a.windGusts, b.windGusts, t),
    uvIndex: lerp(a.uvIndex, b.uvIndex, t),
  };
}

export type RainConfidence = 'none' | 'possible' | 'likely';

export interface RainOutlook {
  confidence: RainConfidence;
  /** mm/h */
  intensity: number;
  probability: number;
}

/**
 * Reads an hour as a rain answer rather than as two loosely related numbers.
 *
 * Forecast models regularly report a healthy probability with zero
 * accumulation, so probability alone means "possible" while actual predicted
 * millimetres are what make it "likely". Keeping this in one place is what lets
 * the copy be decisive without over-promising.
 */
export function rainOutlook(point: HourlyPoint): RainOutlook {
  const intensity = point.precipitation;
  const probability = point.precipitationProbability;
  let confidence: RainConfidence = 'none';
  if (intensity >= 0.5) confidence = 'likely';
  else if (intensity >= 0.1) confidence = probability >= 40 ? 'likely' : 'possible';
  else if (probability >= 55) confidence = 'possible';
  return { confidence, intensity, probability };
}

export function isWetHour(point: HourlyPoint): boolean {
  return rainOutlook(point).confidence !== 'none';
}

/** Total predicted precipitation across a set of hours, in mm. */
export function totalPrecipitation(hours: HourlyPoint[]): number {
  return hours.reduce((sum, point) => sum + point.precipitation, 0);
}

export function maxBy<T>(items: T[], pick: (item: T) => number): T | null {
  let best: T | null = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const value = pick(item);
    if (value > bestValue) {
      bestValue = value;
      best = item;
    }
  }
  return best;
}

export function minBy<T>(items: T[], pick: (item: T) => number): T | null {
  return maxBy(items, (item) => -pick(item));
}
