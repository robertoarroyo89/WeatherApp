'use client';

import { isoTime } from '@/lib/format';
import { smoothPath, type Point } from '@/lib/geometry';
import type { ScoredHour } from '@/lib/weather/bestTime';

/**
 * How an activity's score moves over the next day.
 *
 * A curve rather than a bar chart, for two reasons: it matches the language the
 * time scrubber already established, and a bar chart of scores that all sit
 * between 8 and 10 is a solid block with the information hidden in its colour.
 * The dashed rule marks the "worth doing" threshold, which is the only number on
 * this axis anyone needs.
 */

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 62;
const TOP = 6;
const BOTTOM = 56;
/** Scores at or above this are a good time to go. */
const GOOD = 7.5;

export function ScoreSparkline({ series }: { series: ScoredHour[] }) {
  if (series.length < 2) return null;

  const yFor = (score: number) => BOTTOM - (Math.min(10, Math.max(0, score)) / 10) * (BOTTOM - TOP);

  const points: Point[] = series.map((item, index) => ({
    x: (index / (series.length - 1)) * VIEW_WIDTH,
    y: yFor(item.score),
  }));

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${VIEW_WIDTH} ${BOTTOM} L 0 ${BOTTOM} Z`;
  const goodY = yFor(GOOD);

  const peak = series.reduce((best, item) => (item.score > best.score ? item : best), series[0]);

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-[3.875rem] w-full"
        role="img"
        aria-label={`La mejor puntuación de las próximas 24 horas es ${peak.score.toFixed(1).replace('.', ',')} a las ${isoTime(peak.point.time)}.`}
      >
        <defs>
          <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Baseline and the "worth doing" threshold. */}
        <line
          x1={0}
          x2={VIEW_WIDTH}
          y1={BOTTOM}
          y2={BOTTOM}
          stroke="var(--ink)"
          strokeOpacity={0.14}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={0}
          x2={VIEW_WIDTH}
          y1={goodY}
          y2={goodY}
          stroke="var(--ink)"
          strokeOpacity={0.2}
          strokeWidth={1}
          strokeDasharray="3 5"
          vectorEffect="non-scaling-stroke"
        />

        <path d={areaPath} fill="url(#score-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--ink)"
          strokeOpacity={0.9}
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="text-ink-faint mt-1.5 flex justify-between text-[0.6875rem]">
        <span className="tnum">{isoTime(series[0].point.time)}</span>
        <span>Próximas 24 h</span>
        <span className="tnum">{isoTime(series[series.length - 1].point.time)}</span>
      </div>
    </div>
  );
}
