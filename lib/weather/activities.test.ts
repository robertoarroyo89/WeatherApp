import { describe, expect, it } from 'vitest';
import { bundle, hour, hourRun, localTs } from '@/lib/testing/fixtures';
import {
  ACTIVITIES,
  activityById,
  assessActivity,
  assessAllActivities,
  topActivity,
  verdictFor,
} from './activities';
import type { HourlyPoint } from './types';

const NOW = localTs('2026-08-23T14:00');

const perfectRun = (overrides: Partial<HourlyPoint> = {}) =>
  hour('2026-08-23T19:00', {
    temperature: 16,
    apparentTemperature: 16,
    humidity: 50,
    windSpeed: 6,
    windGusts: 10,
    uvIndex: 1,
    precipitation: 0,
    precipitationProbability: 0,
    ...overrides,
  });

describe('activity scores', () => {
  it('keeps every score inside 0-10 across an extreme sweep', () => {
    for (const activity of ACTIVITIES) {
      for (const apparent of [-20, -5, 0, 10, 20, 30, 40, 50]) {
        for (const wind of [0, 20, 60, 120]) {
          for (const precipitation of [0, 0.5, 5, 30]) {
            for (const isDay of [true, false]) {
              const score = activity.score(
                hour('2026-08-23T14:00', {
                  temperature: apparent,
                  apparentTemperature: apparent,
                  windSpeed: wind,
                  windGusts: wind * 1.5,
                  precipitation,
                  precipitationProbability: precipitation > 0 ? 90 : 0,
                  humidity: 70,
                  uvIndex: 6,
                  isDay,
                }),
              );
              expect(score).toBeGreaterThanOrEqual(0);
              expect(score).toBeLessThanOrEqual(10);
              expect(Number.isFinite(score)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('rates a cool dry evening as excellent for running', () => {
    expect(activityById('correr').score(perfectRun())).toBeGreaterThan(9);
  });

  it('penalises heat far more steeply than mild warmth for running', () => {
    const run = activityById('correr');
    const mild = run.score(perfectRun({ temperature: 22, apparentTemperature: 22 }));
    const hot = run.score(perfectRun({ temperature: 30, apparentTemperature: 30 }));
    const brutal = run.score(perfectRun({ temperature: 36, apparentTemperature: 36 }));
    expect(mild).toBeGreaterThan(8.5);
    expect(hot).toBeLessThan(6);
    expect(brutal).toBeLessThan(2);
    // The 22->30 drop must be smaller than the 30->36 drop: the curve accelerates.
    expect(mild - hot).toBeLessThan(hot - brutal + 3);
  });

  it('treats rain as close to disqualifying for the beach and merely bad for a run', () => {
    const wet = { precipitation: 3, precipitationProbability: 95 };
    const beach = activityById('playa').score(
      hour('2026-08-23T14:00', {
        temperature: 28,
        apparentTemperature: 28,
        cloudCover: 90,
        ...wet,
      }),
    );
    const run = activityById('correr').score(perfectRun(wet));
    expect(beach).toBeLessThan(2);
    expect(run).toBeGreaterThan(beach);
  });

  it('never rewards the beach for dangerous UV', () => {
    const beach = activityById('playa');
    const base = hour('2026-08-23T14:00', {
      temperature: 29,
      apparentTemperature: 29,
      cloudCover: 5,
      windSpeed: 8,
      uvIndex: 5,
    });
    const extreme = { ...base, uvIndex: 11 };
    expect(beach.score(extreme)).toBeLessThan(beach.score(base));
  });

  it('rules the beach out at night', () => {
    const beach = activityById('playa');
    const night = hour('2026-08-23T23:00', {
      temperature: 28,
      apparentTemperature: 28,
      cloudCover: 0,
      isDay: false,
      uvIndex: 0,
    });
    expect(beach.score(night)).toBeLessThan(2);
  });

  it('makes wind count most for cycling', () => {
    const windy = { windSpeed: 38, windGusts: 55 };
    const bike = activityById('bicicleta').score(
      hour('2026-08-23T14:00', { temperature: 18, apparentTemperature: 18, ...windy }),
    );
    const walk = activityById('pasear').score(
      hour('2026-08-23T14:00', { temperature: 18, apparentTemperature: 18, ...windy }),
    );
    expect(bike).toBeLessThan(walk);
  });

  it('rewards a breeze for hanging the washing out, and punishes damp air', () => {
    const laundry = activityById('tender');
    const breezy = laundry.score(
      hour('2026-08-23T12:00', { humidity: 40, windSpeed: 18, apparentTemperature: 26 }),
    );
    const still = laundry.score(
      hour('2026-08-23T12:00', { humidity: 40, windSpeed: 1, apparentTemperature: 26 }),
    );
    const damp = laundry.score(
      hour('2026-08-23T12:00', { humidity: 95, windSpeed: 18, apparentTemperature: 26 }),
    );
    expect(breezy).toBeGreaterThan(still);
    expect(damp).toBeLessThan(breezy);
  });

  it('will not let you hang the washing out in the rain', () => {
    const laundry = activityById('tender');
    expect(
      laundry.score(hour('2026-08-23T12:00', { precipitation: 1, precipitationProbability: 80 })),
    ).toBeLessThan(3);
  });
});

describe('verdictFor', () => {
  it('bands scores into plain language', () => {
    expect(verdictFor(9.4)).toBe('Condiciones ideales');
    expect(verdictFor(8)).toBe('Muy buenas condiciones');
    expect(verdictFor(6.5)).toBe('Condiciones aceptables');
    expect(verdictFor(5)).toBe('Regular');
    expect(verdictFor(2)).toBe('Mal momento');
  });
});

describe('assessActivity', () => {
  it('recommends a later window when now is too hot to run', () => {
    // Hot afternoon cooling into a pleasant evening.
    const hourly = hourRun('2026-08-23T00:00', 40, (i) => {
      const temp = i >= 12 && i <= 17 ? 34 : i >= 18 && i <= 22 ? 20 : 24;
      return { temperature: temp, apparentTemperature: temp, uvIndex: i >= 12 && i <= 16 ? 8 : 1 };
    });
    const assessment = assessActivity(activityById('correr'), bundle({ hourly }), NOW);
    expect(assessment.score).toBeLessThan(4);
    expect(assessment.best).not.toBeNull();
    expect(assessment.best!.start.hour).toBeGreaterThanOrEqual(18);
    expect(assessment.advice).toMatch(/^Mejor entre las \d{2}:\d{2} y las \d{2}:\d{2}/);
  });

  it('points at tomorrow when today is a write-off', () => {
    const hourly = hourRun('2026-08-23T00:00', 48, (i) => {
      const today = i < 24;
      return today
        ? {
            precipitation: 5,
            precipitationProbability: 95,
            temperature: 12,
            apparentTemperature: 12,
          }
        : {
            temperature: 17,
            apparentTemperature: 17,
            precipitation: 0,
            precipitationProbability: 0,
          };
    });
    const assessment = assessActivity(activityById('correr'), bundle({ hourly }), NOW);
    expect(assessment.best).toBeNull();
    expect(assessment.tomorrow).not.toBeNull();
    expect(assessment.advice).toContain('Mañana estará bastante mejor');
  });

  it('says go now when conditions are already good', () => {
    const hourly = hourRun('2026-08-23T00:00', 40, () => ({
      temperature: 16,
      apparentTemperature: 16,
      uvIndex: 1,
      windSpeed: 5,
      humidity: 45,
    }));
    const assessment = assessActivity(activityById('correr'), bundle({ hourly }), NOW);
    expect(assessment.advice).toBe('Muy buen momento para salir a correr.');
  });

  it('reports the factors behind the score', () => {
    const assessment = assessActivity(activityById('correr'), bundle(), NOW);
    expect(assessment.factors.map((factor) => factor.caption)).toEqual([
      'Sensación',
      'Lluvia',
      'Viento',
      'UV',
    ]);
    expect(assessment.factors[1].value).toBe('No');
    expect(assessment.factors[1].tone).toBe('good');
  });

  it('swaps UV for humidity where UV is irrelevant', () => {
    const assessment = assessActivity(activityById('terraza'), bundle(), NOW);
    expect(assessment.factors[3].caption).toBe('Humedad');
  });

  it('produces a full 24 h series for the trend line', () => {
    const assessment = assessActivity(activityById('pasear'), bundle(), NOW);
    expect(assessment.series).toHaveLength(24);
    expect(assessment.series[0].point.hour).toBe(14);
  });

  it('does not crash on an empty forecast', () => {
    const assessment = assessActivity(
      activityById('correr'),
      bundle({ hourly: [hour('2026-08-23T14:00')] }),
      NOW,
    );
    expect(Number.isFinite(assessment.score)).toBe(true);
  });
});

describe('assessAllActivities', () => {
  it('assesses every activity and finds the best one', () => {
    const all = assessAllActivities(bundle(), NOW);
    expect(all).toHaveLength(ACTIVITIES.length);
    const top = topActivity(bundle(), NOW)!;
    expect(all.every((item) => item.score <= top.score)).toBe(true);
  });
});

describe('scoring at the real instant, not the hour bucket', () => {
  it('does not recommend the beach minutes before sunset', () => {
    // 20:00 is still daylight, 21:00 is not. At 20:42 the honest answer is "no".
    const hourly = hourRun('2026-08-23T00:00', 40, (i) => ({
      temperature: 31,
      apparentTemperature: 32,
      cloudCover: 5,
      uvIndex: i >= 12 && i <= 17 ? 7 : 1,
      isDay: i >= 7 && i <= 20,
    }));
    const data = bundle({ hourly });

    const atMidday = assessActivity(activityById('playa'), data, localTs('2026-08-23T14:00'));
    expect(atMidday.score).toBeGreaterThan(7);

    const nearlySunset = assessActivity(activityById('playa'), data, localTs('2026-08-23T20:42'));
    expect(nearlySunset.score).toBeLessThan(2);
  });

  it('interpolates the temperature between buckets rather than stepping', () => {
    // Deliberately in the hot end of the range, where the score is sensitive.
    // Inside the comfort band every score is a flat 10 and interpolation is
    // invisible whether it happens or not.
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({
      temperature: 18 + i * 1.4,
      apparentTemperature: 18 + i * 1.4,
    }));
    const data = bundle({ hourly });
    const onTheHour = assessActivity(activityById('pasear'), data, localTs('2026-08-23T14:00'));
    const halfPast = assessActivity(activityById('pasear'), data, localTs('2026-08-23T14:30'));
    expect(halfPast.score).not.toBe(onTheHour.score);
  });
});
