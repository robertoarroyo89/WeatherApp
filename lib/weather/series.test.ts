import { describe, expect, it } from 'vitest';
import { bundle, day, hour, hourRun, localTs } from '@/lib/testing/fixtures';
import {
  currentHourIndex,
  hoursForDate,
  isWetHour,
  maxBy,
  minBy,
  rainOutlook,
  todayDaily,
  totalPrecipitation,
  upcomingDays,
  upcomingHours,
} from './series';

const NOW = localTs('2026-08-23T14:00');

describe('currentHourIndex', () => {
  it('finds the bucket containing now', () => {
    const hourly = hourRun('2026-08-23T00:00', 30);
    expect(currentHourIndex(hourly, localTs('2026-08-23T14:35'))).toBe(14);
    expect(currentHourIndex(hourly, localTs('2026-08-23T14:00'))).toBe(14);
  });

  it('handles the edges', () => {
    const hourly = hourRun('2026-08-23T00:00', 3);
    expect(currentHourIndex(hourly, localTs('2026-08-22T00:00'))).toBe(0);
    expect(currentHourIndex(hourly, localTs('2026-08-24T00:00'))).toBe(2);
    expect(currentHourIndex([], NOW)).toBe(-1);
  });
});

describe('upcomingHours', () => {
  it('starts at the current hour', () => {
    const hours = upcomingHours(bundle({ hourly: hourRun('2026-08-23T00:00', 40) }), NOW, 6);
    expect(hours).toHaveLength(6);
    expect(hours[0].time).toBe('2026-08-23T14:00');
  });

  it('returns an empty list with no data', () => {
    expect(upcomingHours(bundle({ hourly: [] }), NOW)).toEqual([]);
  });
});

describe('hoursForDate and daily helpers', () => {
  it('groups hours by local date', () => {
    const data = bundle({ hourly: hourRun('2026-08-23T00:00', 48) });
    expect(hoursForDate(data, '2026-08-23')).toHaveLength(24);
    expect(hoursForDate(data, '2026-08-24')).toHaveLength(24);
    expect(hoursForDate(data, '2026-09-01')).toHaveLength(0);
  });

  it('finds today in the location timezone', () => {
    expect(todayDaily(bundle(), NOW)!.date).toBe('2026-08-23');
  });

  it('lists days from today onward, dropping yesterday', () => {
    const daily = [day('2026-08-22'), day('2026-08-23'), day('2026-08-24')];
    const days = upcomingDays(bundle({ daily }), NOW, 10);
    expect(days.map((item) => item.date)).toEqual(['2026-08-23', '2026-08-24']);
  });
});

describe('rainOutlook', () => {
  it('calls real accumulation likely', () => {
    expect(
      rainOutlook(hour('2026-08-23T14:00', { precipitation: 1.2, precipitationProbability: 80 }))
        .confidence,
    ).toBe('likely');
  });

  it('calls probability without accumulation merely possible', () => {
    expect(
      rainOutlook(hour('2026-08-23T14:00', { precipitation: 0, precipitationProbability: 70 }))
        .confidence,
    ).toBe('possible');
  });

  it('calls a trace with low confidence possible', () => {
    expect(
      rainOutlook(hour('2026-08-23T14:00', { precipitation: 0.2, precipitationProbability: 20 }))
        .confidence,
    ).toBe('possible');
  });

  it('calls a dry hour dry', () => {
    expect(rainOutlook(hour('2026-08-23T14:00')).confidence).toBe('none');
    expect(isWetHour(hour('2026-08-23T14:00'))).toBe(false);
  });

  it('does not treat a 50 % chance of nothing as rain', () => {
    expect(rainOutlook(hour('2026-08-23T14:00', { precipitationProbability: 50 })).confidence).toBe(
      'none',
    );
  });
});

describe('aggregates', () => {
  it('totals precipitation', () => {
    const hours = hourRun('2026-08-23T00:00', 3, () => ({ precipitation: 1.5 }));
    expect(totalPrecipitation(hours)).toBeCloseTo(4.5, 5);
    expect(totalPrecipitation([])).toBe(0);
  });

  it('finds extremes', () => {
    const items = [1, 7, 3];
    expect(maxBy(items, (n) => n)).toBe(7);
    expect(minBy(items, (n) => n)).toBe(1);
    expect(maxBy([], (n: number) => n)).toBeNull();
  });
});
