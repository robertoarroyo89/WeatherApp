import { describe, expect, it } from 'vitest';
import { bundle, current, hourRun, localTs } from '@/lib/testing/fixtures';
import { describeWeatherCode } from './codes';
import {
  paletteToCssVars,
  placeholderScene,
  sampleHour,
  sceneFromCurrent,
  sceneFromInstant,
} from './scene';

const NOW = localTs('2026-08-23T14:00');

describe('sampleHour', () => {
  const hourly = hourRun('2026-08-23T12:00', 4, (i) => ({
    temperature: 20 + i * 4,
    cloudCover: i * 25,
  }));

  it('interpolates continuous metrics between buckets', () => {
    const midpoint = sampleHour(hourly, localTs('2026-08-23T12:30'))!;
    expect(midpoint.temperature).toBeCloseTo(22, 5);
    expect(midpoint.cloudCover).toBeCloseTo(12.5, 5);
  });

  it('snaps the weather code to the nearer hour instead of inventing one', () => {
    const withRain = hourRun('2026-08-23T12:00', 2, (i) =>
      i === 1 ? { condition: describeWeatherCode(63) } : {},
    );
    expect(sampleHour(withRain, localTs('2026-08-23T12:15'))!.condition.kind).toBe('clear');
    expect(sampleHour(withRain, localTs('2026-08-23T12:45'))!.condition.kind).toBe('rain');
  });

  it('clamps outside the series rather than extrapolating', () => {
    expect(sampleHour(hourly, localTs('2026-08-22T00:00'))!.temperature).toBe(20);
    expect(sampleHour(hourly, localTs('2026-08-25T00:00'))!.temperature).toBe(32);
  });

  it('returns null for an empty series', () => {
    expect(sampleHour([], NOW)).toBeNull();
  });
});

describe('sceneFromCurrent', () => {
  it('builds a complete scene', () => {
    const scene = sceneFromCurrent(bundle(), NOW);
    expect(scene.palette.zenith).toMatch(/^rgb/);
    expect(scene.sky.elevation).toBeGreaterThan(40);
    expect(scene.rainIntensity).toBe(0);
    expect(scene.snowIntensity).toBe(0);
  });

  it('gives rain a visible floor even when the hourly average is tiny', () => {
    const scene = sceneFromCurrent(
      bundle({
        current: current('2026-08-23T14:00', {
          condition: describeWeatherCode(63),
          precipitation: 0.05,
        }),
      }),
      NOW,
    );
    expect(scene.rainIntensity).toBeGreaterThanOrEqual(0.3);
  });

  it('scales rain intensity with the actual rate', () => {
    const light = sceneFromCurrent(
      bundle({
        current: current('2026-08-23T14:00', {
          condition: describeWeatherCode(61),
          precipitation: 0.3,
        }),
      }),
      NOW,
    ).rainIntensity;
    const heavy = sceneFromCurrent(
      bundle({
        current: current('2026-08-23T14:00', {
          condition: describeWeatherCode(65),
          precipitation: 8,
        }),
      }),
      NOW,
    ).rainIntensity;
    expect(heavy).toBeGreaterThan(light);
    expect(heavy).toBeLessThanOrEqual(1);
  });

  it('keeps snow and rain layers mutually exclusive', () => {
    const snowy = sceneFromCurrent(
      bundle({
        current: current('2026-08-23T14:00', { condition: describeWeatherCode(73), snowfall: 0.8 }),
      }),
      NOW,
    );
    expect(snowy.snowIntensity).toBeGreaterThan(0);
    expect(snowy.rainIntensity).toBe(0);
  });

  it('follows the wall clock for the sky, not the stale observation', () => {
    const nightTs = localTs('2026-08-23T23:00');
    const scene = sceneFromCurrent(bundle({ current: current('2026-08-23T14:00') }), nightTs);
    expect(scene.sky.isDay).toBe(false);
    expect(scene.palette.stars).toBeGreaterThan(0.5);
  });
});

describe('sceneFromInstant', () => {
  it('produces a different sky for a different hour of the same day', () => {
    const data = bundle({ hourly: hourRun('2026-08-23T00:00', 30) });
    const afternoon = sceneFromInstant(data, localTs('2026-08-23T14:00'));
    const evening = sceneFromInstant(data, localTs('2026-08-23T21:00'));
    expect(afternoon.sky.elevation).toBeGreaterThan(evening.sky.elevation);
    expect(afternoon.palette.mid).not.toBe(evening.palette.mid);
  });

  it('needs no network data to scrub — everything comes from the loaded series', () => {
    const data = bundle({ hourly: hourRun('2026-08-23T00:00', 30, (i) => ({ temperature: i })) });
    for (let offset = 0; offset < 20; offset += 0.25) {
      const scene = sceneFromInstant(data, localTs('2026-08-23T00:00') + offset * 3_600_000);
      expect(Number.isFinite(scene.temperature)).toBe(true);
      expect(scene.palette.mid).toMatch(/^rgb/);
    }
  });
});

describe('paletteToCssVars', () => {
  it('flattens a palette into custom properties', () => {
    const vars = paletteToCssVars(placeholderScene(NOW).palette);
    expect(vars['--sky-zenith']).toMatch(/^rgb/);
    expect(vars['--ink']).toMatch(/^rgb/);
    expect(Number(vars['--scrim'])).toBeGreaterThan(0);
    expect(Object.values(vars).every((value) => value.length > 0)).toBe(true);
  });
});
