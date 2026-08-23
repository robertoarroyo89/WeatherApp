import type { HourlyPoint } from './types';

/**
 * Generic "when is the good moment?" engine.
 *
 * Deliberately activity-agnostic: callers pass a scoring function over a single
 * hour and get back the best contiguous run of hours. Running, cycling, the
 * beach, hanging the washing out — all of them are the same search with a
 * different score.
 */

export interface ScoredHour {
  point: HourlyPoint;
  score: number;
}

export interface TimeWindow {
  /** First hour in the window. */
  start: HourlyPoint;
  /** Last hour included in the window. */
  end: HourlyPoint;
  /** Instant the window closes (one hour after `end` starts). */
  endTimestamp: number;
  /** Mean score across the window, 0-10. */
  score: number;
  hours: ScoredHour[];
}

export interface BestTimeOptions {
  hours: HourlyPoint[];
  score: (point: HourlyPoint) => number;
  /** Shortest useful window, in hours. */
  minimumHours?: number;
  /** Longest window worth recommending. */
  maximumHours?: number;
  /** Windows scoring below this are not worth suggesting. */
  threshold?: number;
}

export function scoreHours(
  hours: HourlyPoint[],
  score: (point: HourlyPoint) => number,
): ScoredHour[] {
  return hours.map((point) => ({ point, score: score(point) }));
}

const HOUR_MS = 3_600_000;

export function findBestTimeWindow({
  hours,
  score,
  minimumHours = 2,
  maximumHours = 4,
  threshold = 6,
}: BestTimeOptions): TimeWindow | null {
  if (hours.length === 0) return null;
  const scored = scoreHours(hours, score);
  const minLength = Math.min(minimumHours, scored.length);

  let best: TimeWindow | null = null;
  let bestRank = -Infinity;

  for (let length = minLength; length <= Math.min(maximumHours, scored.length); length += 1) {
    for (let start = 0; start + length <= scored.length; start += 1) {
      const slice = scored.slice(start, start + length);
      // Only contiguous clock hours form a real window; a gap in the data
      // (missing hours) must not be papered over.
      let contiguous = true;
      for (let i = 1; i < slice.length; i += 1) {
        if (slice[i].point.timestamp - slice[i - 1].point.timestamp !== HOUR_MS) {
          contiguous = false;
          break;
        }
      }
      if (!contiguous) continue;

      const mean = slice.reduce((sum, item) => sum + item.score, 0) / slice.length;
      // A slightly longer window at a near-identical score is more useful than
      // a razor-thin peak, so length breaks ties.
      const rank = mean + (length - minLength) * 0.04;
      if (rank > bestRank) {
        bestRank = rank;
        best = {
          start: slice[0].point,
          end: slice[slice.length - 1].point,
          endTimestamp: slice[slice.length - 1].point.timestamp + HOUR_MS,
          score: mean,
          hours: slice,
        };
      }
    }
  }

  if (!best || best.score < threshold) return null;
  return best;
}

/** Highest single-hour score in a set, useful for "tomorrow will be better". */
export function peakScore(hours: HourlyPoint[], score: (point: HourlyPoint) => number): number {
  return hours.reduce((best, point) => Math.max(best, score(point)), 0);
}
