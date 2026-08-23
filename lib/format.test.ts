import { describe, expect, it } from 'vitest';
import {
  airQualityLabel,
  capitalize,
  dateKeyInZone,
  formatCountdown,
  formatDayLabel,
  formatDuration,
  formatLongDate,
  formatPrecipitation,
  formatScore,
  formatTemperature,
  formatTime,
  formatVisibility,
  formatWeekdayShort,
  formatWind,
  hourInZone,
  isoHour,
  isoTime,
  levelLabel,
  temperatureValue,
  toDisplayTemperature,
  toDisplayWind,
  uvLabel,
  windCardinal,
  windOrigin,
} from './format';

describe('temperature', () => {
  it('converts to Fahrenheit', () => {
    expect(toDisplayTemperature(0, 'celsius')).toBe(0);
    expect(toDisplayTemperature(100, 'fahrenheit')).toBe(212);
    expect(toDisplayTemperature(-40, 'fahrenheit')).toBe(-40);
  });

  it('rounds for display', () => {
    expect(temperatureValue(28.6, 'celsius')).toBe(29);
    expect(formatTemperature(28.4, 'celsius')).toBe('28°');
    expect(formatTemperature(20, 'fahrenheit')).toBe('68°');
  });
});

describe('wind', () => {
  it('converts between units', () => {
    expect(toDisplayWind(36, 'kmh')).toBe(36);
    expect(toDisplayWind(36, 'ms')).toBeCloseTo(10, 5);
    expect(toDisplayWind(100, 'mph')).toBeCloseTo(62.14, 1);
  });

  it('formats with the right unit label', () => {
    expect(formatWind(13.3, 'kmh')).toBe('13 km/h');
    expect(formatWind(36, 'ms')).toBe('10 m/s');
  });

  it('names cardinal directions in Spanish', () => {
    expect(windCardinal(0)).toBe('N');
    expect(windCardinal(45)).toBe('NE');
    expect(windCardinal(180)).toBe('S');
    expect(windCardinal(270)).toBe('O');
    expect(windCardinal(359)).toBe('N');
    expect(windCardinal(-90)).toBe('O');
  });

  it('phrases the wind origin', () => {
    expect(windOrigin(45)).toBe('del nordeste');
    expect(windOrigin(90)).toBe('de levante');
    expect(windOrigin(270)).toBe('de poniente');
  });
});

describe('time in the location timezone', () => {
  const madrid = 'Europe/Madrid';
  const tokyo = 'Asia/Tokyo';
  // 2026-08-23T12:00:00Z == 14:00 in Madrid, 21:00 in Tokyo.
  const instant = Date.parse('2026-08-23T12:00:00Z');

  it('renders the forecast location clock, not the device clock', () => {
    expect(formatTime(instant, madrid)).toBe('14:00');
    expect(formatTime(instant, tokyo)).toBe('21:00');
    expect(hourInZone(instant, madrid)).toBe(14);
    expect(hourInZone(instant, tokyo)).toBe(21);
  });

  it('handles a date that has already rolled over abroad', () => {
    const lateEvening = Date.parse('2026-08-23T22:00:00Z');
    expect(dateKeyInZone(lateEvening, madrid)).toBe('2026-08-24');
    expect(dateKeyInZone(lateEvening, tokyo)).toBe('2026-08-24');
    expect(dateKeyInZone(lateEvening, 'America/New_York')).toBe('2026-08-23');
  });

  it('formats Spanish dates naturally', () => {
    expect(formatLongDate(instant, madrid)).toBe('Domingo, 23 de agosto');
    expect(formatWeekdayShort(instant, madrid)).toBe('DOM');
  });

  it('uses relative day labels where they help', () => {
    expect(formatDayLabel(instant, madrid, instant)).toBe('Hoy');
    expect(formatDayLabel(instant + 86_400_000, madrid, instant)).toBe('Mañana');
    expect(formatDayLabel(instant + 2 * 86_400_000, madrid, instant)).toBe('Martes');
  });

  it('falls back rather than throwing on a bogus timezone', () => {
    expect(() => formatTime(instant, 'Not/AZone')).not.toThrow();
  });

  it('reads wall-clock strings without touching Date', () => {
    expect(isoTime('2026-08-23T18:30')).toBe('18:30');
    expect(isoHour('2026-08-23T08:00')).toBe('08');
  });
});

describe('durations', () => {
  it('formats daylight length', () => {
    expect(formatDuration(48_300)).toBe('13 h 25 min');
    expect(formatDuration(3_600)).toBe('1 h');
    expect(formatDuration(2_700)).toBe('45 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  it('formats a countdown conversationally', () => {
    expect(formatCountdown(0)).toBe('ahora mismo');
    expect(formatCountdown(42)).toBe('en 42 min');
    expect(formatCountdown(60)).toBe('en 1 h');
    expect(formatCountdown(130)).toBe('en 2 h 10 min');
    expect(formatCountdown(125)).toBe('en 2 h');
  });
});

describe('scales', () => {
  it('labels UV on the WHO bands', () => {
    expect(uvLabel(1)).toBe('Bajo');
    expect(uvLabel(4)).toBe('Moderado');
    expect(uvLabel(7)).toBe('Alto');
    expect(uvLabel(9)).toBe('Muy alto');
    expect(uvLabel(12)).toBe('Extremo');
  });

  it('keeps gender agreement between air quality and generic levels', () => {
    expect(airQualityLabel('veryLow')).toBe('Muy buena');
    expect(levelLabel('veryLow')).toBe('Muy bajo');
    expect(airQualityLabel('high')).toBe('Mala');
    expect(levelLabel('high')).toBe('Alto');
  });

  it('formats measurements', () => {
    expect(formatVisibility(24_000)).toBe('24 km');
    expect(formatVisibility(800)).toBe('800 m');
    expect(formatPrecipitation(0)).toBe('0 mm');
    expect(formatPrecipitation(0.44)).toBe('0,4 mm');
    expect(formatPrecipitation(6.2)).toBe('6 mm');
  });

  it('uses a decimal comma for scores', () => {
    expect(formatScore(8.84)).toBe('8,8');
    expect(formatScore(10)).toBe('10,0');
  });
});

describe('capitalize', () => {
  it('leaves accents and empties alone', () => {
    expect(capitalize('miércoles')).toBe('Miércoles');
    expect(capitalize('')).toBe('');
  });
});
