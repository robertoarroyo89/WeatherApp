import { describe, expect, it } from 'vitest';
import { hour, hourRun, localTs } from '@/lib/testing/fixtures';
import { findBestTimeWindow, peakScore, scoreHours } from './bestTime';
import type { HourlyPoint } from './types';

/** Score that simply reads the temperature, so windows are easy to reason about. */
const byTemperature = (point: HourlyPoint) => point.temperature;

describe('findBestTimeWindow', () => {
  it('finds the peak run of hours', () => {
    const hours = hourRun('2026-08-23T08:00', 12, (i) => ({
      temperature: [3, 4, 5, 6, 9, 9, 9, 5, 4, 3, 2, 1][i],
    }));
    const window = findBestTimeWindow({
      hours,
      score: byTemperature,
      minimumHours: 2,
      maximumHours: 4,
    })!;
    expect(window.start.time).toBe('2026-08-23T12:00');
    expect(window.end.time).toBe('2026-08-23T14:00');
    expect(window.score).toBeCloseTo(9, 5);
  });

  it('closes the window one hour after the last included hour', () => {
    const hours = hourRun('2026-08-23T08:00', 4, () => ({ temperature: 8 }));
    const window = findBestTimeWindow({
      hours,
      score: byTemperature,
      minimumHours: 2,
      maximumHours: 2,
    })!;
    expect(window.endTimestamp).toBe(window.end.timestamp + 3_600_000);
  });

  it('returns null when nothing clears the threshold', () => {
    const hours = hourRun('2026-08-23T08:00', 6, () => ({ temperature: 2 }));
    expect(findBestTimeWindow({ hours, score: byTemperature, threshold: 6 })).toBeNull();
  });

  it('returns null for an empty series', () => {
    expect(findBestTimeWindow({ hours: [], score: byTemperature })).toBeNull();
  });

  it('prefers a longer window when scores are practically tied', () => {
    const hours = hourRun('2026-08-23T08:00', 6, () => ({ temperature: 8 }));
    const window = findBestTimeWindow({
      hours,
      score: byTemperature,
      minimumHours: 2,
      maximumHours: 4,
    })!;
    expect(window.hours).toHaveLength(4);
  });

  it('refuses to bridge a gap in the data', () => {
    // 10:00 is missing, so 09:00 and 11:00 must not be treated as contiguous.
    const hours: HourlyPoint[] = [
      hour('2026-08-23T09:00', { temperature: 9 }),
      hour('2026-08-23T11:00', { temperature: 9 }),
      hour('2026-08-23T12:00', { temperature: 7 }),
      hour('2026-08-23T13:00', { temperature: 7 }),
    ];
    const window = findBestTimeWindow({
      hours,
      score: byTemperature,
      minimumHours: 2,
      maximumHours: 2,
    })!;
    expect(window.start.time).toBe('2026-08-23T11:00');
    expect(window.end.time).toBe('2026-08-23T12:00');
  });

  it('copes with a series shorter than the minimum window', () => {
    const hours = [hour('2026-08-23T09:00', { temperature: 9 })];
    const window = findBestTimeWindow({ hours, score: byTemperature, minimumHours: 3 })!;
    expect(window.hours).toHaveLength(1);
  });
});

describe('scoreHours and peakScore', () => {
  it('maps each hour to its score', () => {
    const hours = hourRun('2026-08-23T08:00', 3, (i) => ({ temperature: i }));
    expect(scoreHours(hours, byTemperature).map((item) => item.score)).toEqual([0, 1, 2]);
  });

  it('reports the single best hour', () => {
    const hours = hourRun('2026-08-23T08:00', 4, (i) => ({ temperature: [1, 7, 3, 2][i] }));
    expect(peakScore(hours, byTemperature)).toBe(7);
    expect(peakScore([], byTemperature)).toBe(0);
  });
});

describe('window timestamps', () => {
  it('keeps windows anchored to real instants', () => {
    const hours = hourRun('2026-08-23T18:00', 4, () => ({ temperature: 9 }));
    const window = findBestTimeWindow({
      hours,
      score: byTemperature,
      minimumHours: 2,
      maximumHours: 2,
    })!;
    expect(window.start.timestamp).toBe(localTs('2026-08-23T18:00'));
  });
});
