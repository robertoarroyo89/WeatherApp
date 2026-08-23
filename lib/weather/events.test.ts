import { describe, expect, it } from 'vitest';
import { bundle, current, hourRun, localTs } from '@/lib/testing/fixtures';
import { describeWeatherCode } from './codes';
import { findNextEvent } from './events';

const NOW = localTs('2026-08-23T14:00');

describe('findNextEvent', () => {
  it('announces rain that is on the way, in minutes when it is imminent', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i === 15
        ? { precipitation: 1.2, precipitationProbability: 80, condition: describeWeatherCode(63) }
        : {},
    );
    // 14:20 now, rain in the 15:00 bucket -> 40 minutes away.
    const event = findNextEvent(bundle({ hourly }), localTs('2026-08-23T14:20'))!;
    expect(event.kind).toBe('rainStart');
    expect(event.headline).toBe('Lluvia en 40 min');
    expect(event.detail).toBe('Empezará a llover en 40 min.');
  });

  it('uses a clock time when the rain is further out', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i === 19
        ? { precipitation: 1.2, precipitationProbability: 80, condition: describeWeatherCode(63) }
        : {},
    );
    const event = findNextEvent(bundle({ hourly }), NOW)!;
    expect(event.headline).toBe('Lluvia a las 19:00');
    expect(event.detail).toBe('Empezará a llover sobre las 19:00.');
  });

  it('hedges when the model gives probability but no accumulation', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i === 19 ? { precipitation: 0, precipitationProbability: 65 } : {},
    );
    const event = findNextEvent(bundle({ hourly }), NOW)!;
    expect(event.kind).toBe('rainStart');
    expect(event.detail).toBe('Puede caer algo sobre las 19:00.');
  });

  it('tells you when the rain will stop while it is raining', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i >= 14 && i <= 17
        ? { precipitation: 1.5, precipitationProbability: 90, condition: describeWeatherCode(63) }
        : {},
    );
    const event = findNextEvent(
      bundle({
        hourly,
        current: current('2026-08-23T14:00', {
          precipitation: 1.5,
          condition: describeWeatherCode(63),
        }),
      }),
      NOW,
    )!;
    expect(event.kind).toBe('rainStop');
    expect(event.detail).toBe('La lluvia debería parar sobre las 18:00.');
  });

  it('says so when the rain is going to last', () => {
    const hourly = hourRun('2026-08-23T00:00', 40, () => ({
      precipitation: 2,
      precipitationProbability: 95,
      condition: describeWeatherCode(63),
    }));
    const event = findNextEvent(
      bundle({
        hourly,
        current: current('2026-08-23T14:00', {
          precipitation: 2,
          condition: describeWeatherCode(63),
        }),
      }),
      NOW,
    )!;
    expect(event.kind).toBe('rainStop');
    expect(event.headline).toBe('Seguirá un buen rato');
  });

  it('lets a storm outrank everything else', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => {
      if (i === 16)
        return {
          condition: describeWeatherCode(95),
          precipitation: 4,
          precipitationProbability: 90,
        };
      if (i === 15)
        return {
          precipitation: 1,
          precipitationProbability: 70,
          condition: describeWeatherCode(63),
        };
      return {};
    });
    expect(findNextEvent(bundle({ hourly }), NOW)!.kind).toBe('storm');
  });

  it('flags a real cooling swing', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({
      temperature: i <= 14 ? 30 : 30 - (i - 14) * 2.5,
      apparentTemperature: i <= 14 ? 30 : 30 - (i - 14) * 2.5,
    }));
    const event = findNextEvent(bundle({ hourly }), NOW)!;
    expect(event.kind).toBe('cooling');
    expect(event.headline).toMatch(/^Refresca a partir de las \d{2}:\d{2}$/);
  });

  it('ignores a temperature wobble that nobody would notice', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({ temperature: 25 + (i % 2) }));
    const event = findNextEvent(bundle({ hourly }), NOW);
    expect(event?.kind).not.toBe('cooling');
  });

  it('warns about strong gusts', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i >= 17 ? { windGusts: 62, windSpeed: 40 } : {},
    );
    const event = findNextEvent(bundle({ hourly }), NOW)!;
    expect(event.kind).toBe('gusts');
    expect(event.detail).toContain('62 km/h');
  });

  it('reports high UV with the hour it eases off', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({ uvIndex: i <= 16 ? 9 : 3 }));
    const event = findNextEvent(
      bundle({ hourly, current: current('2026-08-23T14:00', { uvIndex: 9 }) }),
      NOW,
    )!;
    expect(event.kind).toBe('uv');
    expect(event.headline).toBe('Sol fuerte hasta las 17:00');
  });

  it('says nothing is happening when nothing is happening', () => {
    const event = findNextEvent(bundle(), NOW)!;
    expect(event.kind).toBe('calm');
    expect(event.headline).toMatch(/^Sin lluvia en las próximas \d+ h$/);
  });

  it('returns null when there is no forecast at all', () => {
    expect(findNextEvent(bundle({ hourly: [] }), NOW)).toBeNull();
  });
});
