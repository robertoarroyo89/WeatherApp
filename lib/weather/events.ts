import { formatCountdown, isoTime } from '@/lib/format';
import { rainOutlook, upcomingHours } from './series';
import type { HourlyPoint, WeatherBundle } from './types';

/**
 * "What is the next thing the weather is going to do?"
 *
 * The screen has room for exactly one such statement, so this module ranks
 * candidate changes by how much they would actually alter someone's plans and
 * returns only the winner. A quiet forecast still produces an answer — silence
 * ("no rain for the next 8 hours") is useful information too.
 */

export type WeatherEventKind =
  | 'rainStart'
  | 'rainStop'
  | 'snowStart'
  | 'storm'
  | 'gusts'
  | 'cooling'
  | 'warming'
  | 'uv'
  | 'fog'
  | 'sunset'
  | 'sunrise'
  | 'calm';

export interface WeatherEvent {
  kind: WeatherEventKind;
  /** Short form for the inline chip, e.g. "Lluvia en 40 min". */
  headline: string;
  /** Full sentence for the summary block, ending in a period. */
  detail: string;
  /** When it happens, or null for states rather than moments. */
  timestamp: number | null;
  icon: string;
  /** Higher wins. Only used internally. */
  priority: number;
}

const HOURS_AHEAD = 14;

/** Expresses an upcoming hour as "en 40 min" or "sobre las 19:00". */
function whenPhrase(point: HourlyPoint, nowTs: number): string {
  const minutes = (point.timestamp - nowTs) / 60_000;
  if (minutes <= 95) {
    // Within the next hour and a half a countdown is far more useful than a clock time.
    return formatCountdown(Math.max(10, minutes));
  }
  return `sobre las ${isoTime(point.time)}`;
}

function shortWhen(point: HourlyPoint, nowTs: number): string {
  const minutes = (point.timestamp - nowTs) / 60_000;
  if (minutes <= 95) return formatCountdown(Math.max(10, minutes));
  return `a las ${isoTime(point.time)}`;
}

function isPrecipitatingNow(bundle: WeatherBundle): boolean {
  const { current } = bundle;
  if (current.precipitation > 0.08 || current.snowfall > 0.05) return true;
  const family = current.condition.family;
  return family === 'rain' || family === 'snow' || family === 'storm';
}

export function findNextEvent(bundle: WeatherBundle, nowTs: number): WeatherEvent | null {
  const hours = upcomingHours(bundle, nowTs, HOURS_AHEAD);
  if (!hours.length) return null;

  // The current bucket is "now"; changes are looked for strictly ahead of it.
  const ahead = hours.slice(1);
  const candidates: WeatherEvent[] = [];
  const current = bundle.current;

  /* --- storms outrank everything else --- */
  const storm = ahead.find((point) => point.condition.family === 'storm');
  if (storm) {
    candidates.push({
      kind: 'storm',
      headline: `Tormenta ${shortWhen(storm, nowTs)}`,
      detail: `Posible tormenta ${whenPhrase(storm, nowTs)}.`,
      timestamp: storm.timestamp,
      icon: 'storm',
      priority: 100,
    });
  }

  /* --- rain starting or stopping --- */
  if (isPrecipitatingNow(bundle)) {
    const dry = ahead.find((point) => rainOutlook(point).confidence === 'none');
    const snowing = current.snowfall > 0.05 || current.condition.family === 'snow';
    const noun = snowing ? 'La nieve' : 'La lluvia';
    if (dry) {
      const minutes = (dry.timestamp - nowTs) / 60_000;
      candidates.push({
        kind: 'rainStop',
        headline:
          minutes <= 95 ? `Para ${formatCountdown(minutes)}` : `Para a las ${isoTime(dry.time)}`,
        detail:
          minutes <= 95
            ? `${noun} debería parar pronto.`
            : `${noun} debería parar sobre las ${isoTime(dry.time)}.`,
        timestamp: dry.timestamp,
        icon: 'rain-stop',
        priority: 92,
      });
    } else {
      candidates.push({
        kind: 'rainStop',
        headline: 'Seguirá un buen rato',
        detail: `${noun} va para largo, no parece que pare pronto.`,
        timestamp: null,
        icon: 'rain',
        priority: 90,
      });
    }
  } else {
    const snowStart = ahead.find((point) => point.snowfall >= 0.1);
    const wetStart = ahead.find((point) => rainOutlook(point).confidence !== 'none');
    if (snowStart && (!wetStart || snowStart.timestamp <= wetStart.timestamp)) {
      candidates.push({
        kind: 'snowStart',
        headline: `Nieve ${shortWhen(snowStart, nowTs)}`,
        detail: `Puede empezar a nevar ${whenPhrase(snowStart, nowTs)}.`,
        timestamp: snowStart.timestamp,
        icon: 'snow',
        priority: 95,
      });
    } else if (wetStart) {
      const outlook = rainOutlook(wetStart);
      const likely = outlook.confidence === 'likely';
      candidates.push({
        kind: 'rainStart',
        headline: `Lluvia ${shortWhen(wetStart, nowTs)}`,
        detail: likely
          ? `Empezará a llover ${whenPhrase(wetStart, nowTs)}.`
          : `Puede caer algo ${whenPhrase(wetStart, nowTs)}.`,
        timestamp: wetStart.timestamp,
        icon: 'rain',
        priority: likely ? 94 : 82,
      });
    }
  }

  /* --- wind --- */
  const gust = ahead.find((point) => point.windGusts >= 50);
  if (gust && gust.windGusts > current.windGusts + 8) {
    candidates.push({
      kind: 'gusts',
      headline: `Rachas fuertes ${shortWhen(gust, nowTs)}`,
      detail: `Se esperan rachas de hasta ${Math.round(gust.windGusts)} km/h ${whenPhrase(gust, nowTs)}.`,
      timestamp: gust.timestamp,
      icon: 'wind',
      priority: 74,
    });
  }

  /* --- temperature swings over the next 8 hours --- */
  const window = ahead.slice(0, 8);
  if (window.length) {
    const reference = hours[0].temperature;
    let coldest = window[0];
    let warmest = window[0];
    for (const point of window) {
      if (point.temperature < coldest.temperature) coldest = point;
      if (point.temperature > warmest.temperature) warmest = point;
    }
    const drop = reference - coldest.temperature;
    const rise = warmest.temperature - reference;

    if (drop >= 5) {
      // Report when the cooling becomes noticeable, not when it bottoms out.
      const onset = window.find((point) => reference - point.temperature >= drop * 0.55) ?? coldest;
      candidates.push({
        kind: 'cooling',
        headline: `Refresca a partir de las ${isoTime(onset.time)}`,
        detail:
          drop >= 8
            ? `Refrescará bastante a partir de las ${isoTime(onset.time)}.`
            : `Refrescará a partir de las ${isoTime(onset.time)}.`,
        timestamp: onset.timestamp,
        icon: 'thermo-down',
        priority: 62,
      });
    }
    if (rise >= 6) {
      const onset = window.find((point) => point.temperature - reference >= rise * 0.55) ?? warmest;
      candidates.push({
        kind: 'warming',
        headline: `Sube a partir de las ${isoTime(onset.time)}`,
        detail: `La temperatura subirá a partir de las ${isoTime(onset.time)}.`,
        timestamp: onset.timestamp,
        icon: 'thermo-up',
        priority: 58,
      });
    }
  }

  /* --- UV --- */
  const uvNow = current.uvIndex ?? 0;
  if (uvNow >= 7) {
    const relief = ahead.find((point) => point.uvIndex < 5);
    candidates.push({
      kind: 'uv',
      headline: relief ? `Sol fuerte hasta las ${isoTime(relief.time)}` : 'El sol pega fuerte',
      detail: relief
        ? `El sol pega fuerte hasta las ${isoTime(relief.time)}.`
        : 'El sol pega fuerte, mejor con protección.',
      timestamp: relief?.timestamp ?? null,
      icon: 'uv',
      priority: 68,
    });
  }

  /* --- fog --- */
  if (current.condition.family !== 'fog') {
    const fog = ahead.slice(0, 10).find((point) => point.condition.family === 'fog');
    if (fog) {
      candidates.push({
        kind: 'fog',
        headline: `Niebla ${shortWhen(fog, nowTs)}`,
        detail: `Puede aparecer niebla ${whenPhrase(fog, nowTs)}.`,
        timestamp: fog.timestamp,
        icon: 'fog',
        priority: 66,
      });
    }
  }

  /* --- sun times, as a gentle fallback --- */
  const today = bundle.daily.find((day) => day.date === bundle.current.time.slice(0, 10));
  if (today) {
    if (current.isDay && today.sunset) {
      const sunsetTs = Date.parse(`${today.sunset}:00Z`) - bundle.utcOffsetSeconds * 1000;
      const minutes = (sunsetTs - nowTs) / 60_000;
      if (minutes > 0 && minutes <= 150) {
        candidates.push({
          kind: 'sunset',
          headline: `Se pone el sol a las ${isoTime(today.sunset)}`,
          detail: `El sol se pone a las ${isoTime(today.sunset)}.`,
          timestamp: sunsetTs,
          icon: 'sunset',
          priority: 40,
        });
      }
    }
    if (!current.isDay) {
      const tomorrow = bundle.daily.find((day) => day.timestamp > today.timestamp);
      const nextSunrise =
        today.sunrise && Date.parse(`${today.sunrise}:00Z`) - bundle.utcOffsetSeconds * 1000 > nowTs
          ? today
          : tomorrow;
      if (nextSunrise?.sunrise) {
        candidates.push({
          kind: 'sunrise',
          headline: `Amanece a las ${isoTime(nextSunrise.sunrise)}`,
          detail: `Amanecerá a las ${isoTime(nextSunrise.sunrise)}.`,
          timestamp: Date.parse(`${nextSunrise.sunrise}:00Z`) - bundle.utcOffsetSeconds * 1000,
          icon: 'sunrise',
          priority: 38,
        });
      }
    }
  }

  /* --- nothing is happening, which is worth saying --- */
  const dryHours = ahead.filter((point) => rainOutlook(point).confidence === 'none').length;
  if (dryHours === ahead.length && ahead.length >= 6) {
    candidates.push({
      kind: 'calm',
      headline: `Sin lluvia en las próximas ${ahead.length} h`,
      detail: 'No parece que vaya a llover en lo que queda de día.',
      timestamp: null,
      icon: 'sun',
      priority: 30,
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0];
}
