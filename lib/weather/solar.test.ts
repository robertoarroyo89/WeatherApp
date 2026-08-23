import { describe, expect, it } from 'vitest';
import { dayPart, moonState, skyGeometry, smoothstep, solarPosition, sunElevation } from './solar';

const VALENCIA = { lat: 39.47, lon: -0.376 };
const TROMSO = { lat: 69.65, lon: 18.96 };

describe('solarPosition', () => {
  it('puts the summer sun high over Valencia at local noon', () => {
    // 12:00 UTC on the summer solstice is close to solar noon at this longitude.
    const elevation = sunElevation(new Date('2026-06-21T12:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    expect(elevation).toBeGreaterThan(70);
    expect(elevation).toBeLessThan(76);
  });

  it('puts the sun below the horizon at local midnight', () => {
    const elevation = sunElevation(new Date('2026-08-23T00:30:00Z'), VALENCIA.lat, VALENCIA.lon);
    expect(elevation).toBeLessThan(-10);
  });

  it('is lower in winter than in summer at the same clock time', () => {
    const summer = sunElevation(new Date('2026-06-21T12:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    const winter = sunElevation(new Date('2026-12-21T12:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    expect(winter).toBeLessThan(summer - 40);
  });

  it('keeps the sun up all night during the polar summer', () => {
    const midnight = sunElevation(new Date('2026-06-21T22:00:00Z'), TROMSO.lat, TROMSO.lon);
    expect(midnight).toBeGreaterThan(0);
  });

  it('keeps the sun down all day during the polar winter', () => {
    const noon = sunElevation(new Date('2026-12-21T11:00:00Z'), TROMSO.lat, TROMSO.lon);
    expect(noon).toBeLessThan(0);
  });

  it('reports a negative hour angle before solar noon', () => {
    const morning = solarPosition(new Date('2026-08-23T07:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    const evening = solarPosition(new Date('2026-08-23T17:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    expect(morning.hourAngle).toBeLessThan(0);
    expect(evening.hourAngle).toBeGreaterThan(0);
  });
});

describe('skyGeometry', () => {
  it('moves the light source left to right across the day', () => {
    const morning = skyGeometry(new Date('2026-08-23T06:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    const noon = skyGeometry(new Date('2026-08-23T11:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    const evening = skyGeometry(new Date('2026-08-23T17:30:00Z'), VALENCIA.lat, VALENCIA.lon);
    expect(morning.x).toBeLessThan(noon.x);
    expect(noon.x).toBeLessThan(evening.x);
  });

  it('places the sun higher on the screen when it is higher in the sky', () => {
    const low = skyGeometry(new Date('2026-08-23T05:30:00Z'), VALENCIA.lat, VALENCIA.lon);
    const high = skyGeometry(new Date('2026-08-23T11:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    expect(high.y).toBeLessThan(low.y);
  });

  it('reports full night only once the sun is well below the horizon', () => {
    const dusk = skyGeometry(new Date('2026-08-23T18:45:00Z'), VALENCIA.lat, VALENCIA.lon);
    const night = skyGeometry(new Date('2026-08-23T23:00:00Z'), VALENCIA.lat, VALENCIA.lon);
    expect(dusk.night).toBeLessThan(night.night);
    expect(night.night).toBeCloseTo(1, 1);
    expect(night.isDay).toBe(false);
  });
});

describe('helpers', () => {
  it('smoothsteps between edges', () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 5);
  });

  it('names dayparts by elevation and direction', () => {
    expect(dayPart(-20, true)).toBe('night');
    expect(dayPart(-6, true)).toBe('preDawn');
    expect(dayPart(-6, false)).toBe('blueHour');
    expect(dayPart(0, false)).toBe('sunset');
    expect(dayPart(5, false)).toBe('goldenHour');
    expect(dayPart(45, true)).toBe('midday');
  });

  it('computes a plausible moon illumination', () => {
    const state = moonState(new Date('2026-08-23T00:00:00Z'));
    expect(state.phase).toBeGreaterThanOrEqual(0);
    expect(state.phase).toBeLessThanOrEqual(1);
    expect(state.illumination).toBeGreaterThanOrEqual(0);
    expect(state.illumination).toBeLessThanOrEqual(1);
  });
});
