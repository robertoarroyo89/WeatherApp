import { solarPosition } from './solar';
import type { DailyPoint, WeatherBundle } from './types';

/**
 * Derived solar moments that the provider does not supply.
 *
 * Golden hour and blue hour are found by scanning real sun elevation rather than
 * assumed as "an hour either side", because that assumption is wrong almost
 * everywhere: golden hour lasts about forty minutes in Valencia in August and
 * over two hours in Scotland in June.
 */

export interface SolarWindow {
  start: number;
  end: number;
}

export interface SolarMoments {
  sunriseTs: number | null;
  sunsetTs: number | null;
  /** Sun between the horizon and 6° — warm, low, directional light. */
  goldenMorning: SolarWindow | null;
  goldenEvening: SolarWindow | null;
  /** Sun between -6° and the horizon — the blue hour after sunset. */
  blueEvening: SolarWindow | null;
}

function toTimestamp(iso: string, utcOffsetSeconds: number): number {
  return Date.parse(`${iso}:00Z`) - utcOffsetSeconds * 1000;
}

const STEP_MS = 4 * 60_000;

/** First instant in [from, to] where the sun's elevation crosses `target`. */
function findCrossing(
  from: number,
  to: number,
  latitude: number,
  longitude: number,
  target: number,
  rising: boolean,
): number | null {
  let previous = solarPosition(new Date(from), latitude, longitude).elevation;
  for (let time = from + STEP_MS; time <= to; time += STEP_MS) {
    const elevation = solarPosition(new Date(time), latitude, longitude).elevation;
    const crossed = rising
      ? previous < target && elevation >= target
      : previous > target && elevation <= target;
    if (crossed) {
      // Linear interpolation inside the step is accurate to a few seconds.
      const span = elevation - previous;
      const ratio = span === 0 ? 0 : (target - previous) / span;
      return time - STEP_MS + ratio * STEP_MS;
    }
    previous = elevation;
  }
  return null;
}

export function solarMoments(day: DailyPoint, bundle: WeatherBundle): SolarMoments {
  const { latitude, longitude } = bundle.location;
  const offset = bundle.utcOffsetSeconds;
  const sunriseTs = day.sunrise ? toTimestamp(day.sunrise, offset) : null;
  const sunsetTs = day.sunset ? toTimestamp(day.sunset, offset) : null;

  const goldenMorning =
    sunriseTs === null
      ? null
      : (() => {
          const end = findCrossing(
            sunriseTs,
            sunriseTs + 4 * 3_600_000,
            latitude,
            longitude,
            6,
            true,
          );
          return end ? { start: sunriseTs, end } : null;
        })();

  const goldenEvening =
    sunsetTs === null
      ? null
      : (() => {
          const start = findCrossing(
            sunsetTs - 4 * 3_600_000,
            sunsetTs,
            latitude,
            longitude,
            6,
            false,
          );
          return start ? { start, end: sunsetTs } : null;
        })();

  const blueEvening =
    sunsetTs === null
      ? null
      : (() => {
          const end = findCrossing(
            sunsetTs,
            sunsetTs + 3 * 3_600_000,
            latitude,
            longitude,
            -6,
            false,
          );
          return end ? { start: sunsetTs, end } : null;
        })();

  return { sunriseTs, sunsetTs, goldenMorning, goldenEvening, blueEvening };
}
