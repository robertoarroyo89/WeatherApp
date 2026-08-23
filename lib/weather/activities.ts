import { dateKeyInZone, isoTime, uvLabel } from '@/lib/format';
import { clamp } from './solar';
import {
  findBestTimeWindow,
  peakScore,
  scoreHours,
  type ScoredHour,
  type TimeWindow,
} from './bestTime';
import { hoursForDate, rainOutlook, sampleHour, upcomingHours } from './series';
import type { HourlyPoint, WeatherBundle } from './types';

/**
 * Activity suitability scoring.
 *
 * This is a practical convenience indicator, not a validated model. Each
 * activity starts from a perfect 10 and loses points for the things that
 * actually spoil it, with heat and cold penalties growing super-linearly — the
 * difference between 26° and 30° matters far more for a run than the difference
 * between 18° and 22°.
 *
 * Every number below is a judgement call tuned for a Spanish audience (people
 * here happily go running at 22°), and all of them live in this one file so the
 * tuning stays reviewable.
 */

export type ActivityId = 'correr' | 'pasear' | 'bicicleta' | 'playa' | 'terraza' | 'tender';

/** Penalty that grows faster than linearly above a comfortable ceiling. */
function overPenalty(value: number, ceiling: number, weight: number, exponent = 1.35): number {
  return value <= ceiling ? 0 : Math.pow(value - ceiling, exponent) * weight;
}

/** Penalty that grows faster than linearly below a comfortable floor. */
function underPenalty(value: number, floor: number, weight: number, exponent = 1.25): number {
  return value >= floor ? 0 : Math.pow(floor - value, exponent) * weight;
}

/**
 * Combined penalty for rain, weighting predicted millimetres more heavily than
 * bare probability — models often report 60 % with zero accumulation.
 *
 * The volume term keeps climbing past the "1 mm/h is proper rain" mark instead
 * of saturating there, so a downpour is meaningfully worse than a shower. Without
 * that headroom a run in 5 mm/h of rain still came out as "acceptable".
 */
function wetPenalty(point: HourlyPoint, severity: number): number {
  const volume = Math.min(1.6, Math.pow(Math.max(0, point.precipitation) / 1.2, 0.75));
  const probability = Math.min(1, Math.max(0, point.precipitationProbability - 25) / 75);
  return severity * (volume * 0.7 + probability * 0.4);
}

export interface ActivityDefinition {
  id: ActivityId;
  /** UI label, e.g. "Correr". */
  label: string;
  /** Verb phrase for copy, e.g. "salir a correr". */
  phrase: string;
  icon: string;
  /** Comfortable apparent-temperature range, used for the factor read-out. */
  comfort: [number, number];
  /** Shortest window worth recommending, in hours. */
  minimumHours: number;
  maximumHours: number;
  /** High UV counts against this activity rather than for it. */
  uvMatters: boolean;
  score(point: HourlyPoint): number;
}

export const ACTIVITIES: ActivityDefinition[] = [
  {
    id: 'correr',
    label: 'Correr',
    phrase: 'salir a correr',
    icon: 'run',
    comfort: [8, 20],
    minimumHours: 1,
    maximumHours: 3,
    uvMatters: true,
    score(point) {
      let score = 10;
      score -= overPenalty(point.apparentTemperature, 20, 0.22, 1.4);
      score -= underPenalty(point.apparentTemperature, 6, 0.2);
      score -= wetPenalty(point, 4.2);
      if (point.apparentTemperature > 20 && point.humidity > 70) {
        score -= (point.humidity - 70) * 0.035;
      }
      score -= overPenalty(point.windSpeed, 22, 0.07, 1.2);
      if (point.windGusts > 45) score -= 1.1;
      if (point.uvIndex > 6) score -= (point.uvIndex - 6) * 0.3;
      if (!point.isDay) score -= 0.6;
      return clamp(score, 0, 10);
    },
  },
  {
    id: 'pasear',
    label: 'Pasear',
    phrase: 'dar un paseo',
    icon: 'walk',
    comfort: [14, 26],
    minimumHours: 1,
    maximumHours: 4,
    uvMatters: true,
    score(point) {
      let score = 10;
      score -= overPenalty(point.apparentTemperature, 26, 0.2, 1.35);
      score -= underPenalty(point.apparentTemperature, 12, 0.16);
      score -= wetPenalty(point, 5);
      score -= overPenalty(point.windSpeed, 30, 0.06, 1.2);
      if (point.windGusts > 55) score -= 1;
      if (point.uvIndex > 8) score -= (point.uvIndex - 8) * 0.25;
      return clamp(score, 0, 10);
    },
  },
  {
    id: 'bicicleta',
    label: 'Bicicleta',
    phrase: 'coger la bici',
    icon: 'bike',
    comfort: [12, 24],
    minimumHours: 2,
    maximumHours: 4,
    uvMatters: true,
    score(point) {
      let score = 10;
      score -= overPenalty(point.apparentTemperature, 24, 0.2, 1.35);
      score -= underPenalty(point.apparentTemperature, 11, 0.18);
      score -= wetPenalty(point, 6);
      // Wind is the factor cyclists actually feel.
      score -= overPenalty(point.windSpeed, 18, 0.14, 1.25);
      if (point.windGusts > 40) score -= (point.windGusts - 40) * 0.07;
      if (point.uvIndex > 7) score -= (point.uvIndex - 7) * 0.2;
      if (!point.isDay) score -= 1.2;
      return clamp(score, 0, 10);
    },
  },
  {
    id: 'playa',
    label: 'Playa',
    phrase: 'ir a la playa',
    icon: 'beach',
    comfort: [24, 34],
    minimumHours: 2,
    maximumHours: 4,
    uvMatters: true,
    score(point) {
      // The beach needs daylight, full stop.
      if (!point.isDay) return clamp(1.2 - wetPenalty(point, 1), 0, 10);
      let score = 10;
      score -= underPenalty(point.apparentTemperature, 24, 0.5);
      score -= overPenalty(point.apparentTemperature, 34, 0.25, 1.3);
      score -= (point.cloudCover / 100) * 2.6;
      score -= wetPenalty(point, 8.5);
      score -= overPenalty(point.windSpeed, 20, 0.12, 1.3);
      // Strong sun is a hazard on the beach, never a bonus.
      if (point.uvIndex > 8) score -= (point.uvIndex - 8) * 0.55;
      return clamp(score, 0, 10);
    },
  },
  {
    id: 'terraza',
    label: 'Terraza',
    phrase: 'sentarse en una terraza',
    icon: 'terrace',
    comfort: [18, 29],
    minimumHours: 2,
    maximumHours: 4,
    uvMatters: false,
    score(point) {
      let score = 10;
      score -= underPenalty(point.apparentTemperature, 16, 0.28);
      score -= overPenalty(point.apparentTemperature, 29, 0.22, 1.3);
      score -= wetPenalty(point, 7.5);
      score -= overPenalty(point.windSpeed, 22, 0.11, 1.3);
      if (point.windGusts > 45) score -= 1.5;
      if (point.humidity > 85) score -= 0.8;
      return clamp(score, 0, 10);
    },
  },
  {
    id: 'tender',
    label: 'Tender ropa',
    phrase: 'tender la ropa',
    icon: 'laundry',
    comfort: [14, 34],
    minimumHours: 3,
    maximumHours: 6,
    uvMatters: false,
    score(point) {
      // Starts at 9, not 10: a breeze is what earns the last point, so the
      // bonus below has somewhere to go instead of being clamped away.
      let score = 9;
      // Any real chance of rain ruins the whole point.
      score -= wetPenalty(point, 9);
      if (point.precipitationProbability > 30) {
        score -= (point.precipitationProbability - 30) * 0.06;
      }
      if (point.humidity > 65) score -= (point.humidity - 65) * 0.07;
      score -= underPenalty(point.apparentTemperature, 12, 0.12, 1.1);
      // A bit of wind is exactly what you want.
      score += clamp((point.windSpeed - 4) / 14, 0, 1) * 1.2;
      if (point.windSpeed > 45) score -= (point.windSpeed - 45) * 0.08;
      if (!point.isDay) score -= 1.6;
      if (point.cloudCover > 80) score -= 0.5;
      return clamp(score, 0, 10);
    },
  },
];

export function activityById(id: ActivityId): ActivityDefinition {
  return ACTIVITIES.find((activity) => activity.id === id) ?? ACTIVITIES[0];
}

export type FactorTone = 'good' | 'neutral' | 'bad';

export interface ActivityFactor {
  caption: string;
  value: string;
  tone: FactorTone;
}

export interface ActivityAssessment {
  definition: ActivityDefinition;
  /** Score for the current hour, 0-10. */
  score: number;
  verdict: string;
  advice: string;
  /** Best window remaining today, or null when today is a write-off. */
  best: TimeWindow | null;
  /** Best window tomorrow, only computed when today is poor. */
  tomorrow: TimeWindow | null;
  /** Next 24 h of scores, for the trend line. */
  series: ScoredHour[];
  factors: ActivityFactor[];
}

/** Verdict bands. Practical wording, no false precision. */
export function verdictFor(score: number): string {
  if (score >= 9) return 'Condiciones ideales';
  if (score >= 7.5) return 'Muy buenas condiciones';
  if (score >= 6) return 'Condiciones aceptables';
  if (score >= 4) return 'Regular';
  return 'Mal momento';
}

function buildFactors(definition: ActivityDefinition, point: HourlyPoint): ActivityFactor[] {
  const [low, high] = definition.comfort;
  const apparent = point.apparentTemperature;
  const tempTone: FactorTone =
    apparent >= low && apparent <= high
      ? 'good'
      : apparent >= low - 4 && apparent <= high + 4
        ? 'neutral'
        : 'bad';

  const outlook = rainOutlook(point);
  const rainTone: FactorTone =
    outlook.confidence === 'none' ? 'good' : outlook.confidence === 'possible' ? 'neutral' : 'bad';

  const windTone: FactorTone =
    point.windSpeed < 16 ? 'good' : point.windSpeed < 29 ? 'neutral' : 'bad';

  const uvTone: FactorTone = point.uvIndex < 3 ? 'good' : point.uvIndex < 8 ? 'neutral' : 'bad';

  const factors: ActivityFactor[] = [
    { caption: 'Sensación', value: `${Math.round(apparent)}°`, tone: tempTone },
    {
      caption: 'Lluvia',
      value:
        outlook.confidence === 'none'
          ? 'No'
          : outlook.confidence === 'possible'
            ? 'Posible'
            : `${Math.round(outlook.probability)} %`,
      tone: rainTone,
    },
    { caption: 'Viento', value: `${Math.round(point.windSpeed)} km/h`, tone: windTone },
  ];

  if (definition.uvMatters) {
    factors.push({ caption: 'UV', value: uvLabel(point.uvIndex), tone: uvTone });
  } else {
    factors.push({
      caption: 'Humedad',
      value: `${Math.round(point.humidity)} %`,
      tone: point.humidity < 70 ? 'good' : point.humidity < 85 ? 'neutral' : 'bad',
    });
  }
  return factors;
}

function buildAdvice(
  definition: ActivityDefinition,
  score: number,
  best: TimeWindow | null,
  tomorrow: TimeWindow | null,
  nowTs: number,
): string {
  const bestStartsLater = best !== null && best.start.timestamp > nowTs + 30 * 60_000;

  if (score >= 7.5 && !bestStartsLater) {
    return `Muy buen momento para ${definition.phrase}.`;
  }
  if (best && bestStartsLater) {
    return `Mejor entre las ${isoTime(best.start.time)} y las ${isoTime(
      best.end.time,
    )}, cuando mejora.`;
  }
  if (best) {
    return `Se puede, y aguanta hasta las ${isoTime(best.end.time)}.`;
  }
  if (tomorrow) {
    return `Hoy no acompaña. Mañana estará bastante mejor a partir de las ${isoTime(
      tomorrow.start.time,
    )}.`;
  }
  if (score >= 6) return `Se puede ${definition.phrase}, sin más.`;
  return `Hoy no es el mejor día para ${definition.phrase}.`;
}

export function assessActivity(
  definition: ActivityDefinition,
  bundle: WeatherBundle,
  nowTs: number,
): ActivityAssessment {
  const upcoming = upcomingHours(bundle, nowTs, 24);
  // Sampled at this instant rather than taken from the current hour bucket.
  // The bucket can be up to an hour stale, which at 20:42 in August had the
  // beach scoring 9.4 four minutes before sunset — it was reading 20:00's
  // daylight. Sampling snaps `isDay` to the nearer hour and interpolates the
  // rest.
  const reference = sampleHour(bundle.hourly, nowTs) ?? upcoming[0] ?? bundle.hourly[0];
  const score = definition.score(reference);

  const todayKey = dateKeyInZone(nowTs, bundle.timezone);
  const tomorrowKey = dateKeyInZone(nowTs + 86_400_000, bundle.timezone);
  const remainingToday = hoursForDate(bundle, todayKey).filter(
    (point) => point.timestamp >= nowTs - 30 * 60_000,
  );
  const tomorrowHours = hoursForDate(bundle, tomorrowKey);

  const best = findBestTimeWindow({
    hours: remainingToday,
    score: definition.score,
    minimumHours: definition.minimumHours,
    maximumHours: definition.maximumHours,
    threshold: 6,
  });

  // Only look at tomorrow when today has nothing to offer — otherwise the advice
  // would tell people to wait a day for a marginal improvement.
  const tomorrow =
    best === null
      ? findBestTimeWindow({
          hours: tomorrowHours,
          score: definition.score,
          minimumHours: definition.minimumHours,
          maximumHours: definition.maximumHours,
          threshold: 6.5,
        })
      : null;

  return {
    definition,
    score,
    verdict: verdictFor(score),
    advice: buildAdvice(definition, score, best, tomorrow, nowTs),
    best,
    tomorrow,
    series: scoreHours(upcoming, definition.score),
    factors: buildFactors(definition, reference),
  };
}

export function assessAllActivities(bundle: WeatherBundle, nowTs: number): ActivityAssessment[] {
  return ACTIVITIES.map((definition) => assessActivity(definition, bundle, nowTs));
}

/** Best activity right now, for the teaser on the home screen. */
export function topActivity(bundle: WeatherBundle, nowTs: number): ActivityAssessment | null {
  const all = assessAllActivities(bundle, nowTs);
  if (!all.length) return null;
  return all.reduce((best, item) => (item.score > best.score ? item : best), all[0]);
}

/** Peak score reachable today, used for teaser copy. */
export function peakToday(
  definition: ActivityDefinition,
  bundle: WeatherBundle,
  nowTs: number,
): number {
  const todayKey = dateKeyInZone(nowTs, bundle.timezone);
  return peakScore(hoursForDate(bundle, todayKey), definition.score);
}
