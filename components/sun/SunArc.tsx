'use client';

import { isoTime } from '@/lib/format';
import { clamp } from '@/lib/weather/solar';
import type { DailyPoint } from '@/lib/weather/types';

/**
 * The day's arc of sunlight.
 *
 * A real ellipse with the sun placed on it by elapsed daylight, not a decorative
 * curve with a dot parked in the middle. After sunset the arc goes quiet and the
 * marker drops below the horizon line, because the next thing you want to know
 * at 23:00 is when it comes back.
 *
 * Polar latitudes are handled explicitly: a day with no sunrise or sunset is a
 * real thing that this component has to say out loud rather than crash on.
 */

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 132;
const BASE_Y = 104;
const RADIUS_X = 132;
const RADIUS_Y = 74;
const CENTER_X = VIEW_WIDTH / 2;

export interface SunArcProps {
  day: DailyPoint;
  utcOffsetSeconds: number;
  nowTs: number;
  /** Sunrise for tomorrow, used at night. */
  nextSunrise?: string | null;
  compact?: boolean;
}

function toTimestamp(iso: string, utcOffsetSeconds: number): number {
  return Date.parse(`${iso}:00Z`) - utcOffsetSeconds * 1000;
}

function pointOnArc(progress: number) {
  const angle = Math.PI * (1 - clamp(progress, 0, 1));
  return {
    x: CENTER_X + RADIUS_X * Math.cos(angle),
    y: BASE_Y - RADIUS_Y * Math.sin(angle),
  };
}

export function SunArc({
  day,
  utcOffsetSeconds,
  nowTs,
  nextSunrise,
  compact = false,
}: SunArcProps) {
  const hasSunTimes = Boolean(day.sunrise && day.sunset);

  // Polar day and polar night: no arc to draw, but plenty to say.
  if (!hasSunTimes) {
    const polarDay = day.daylightSeconds > 86_000;
    return (
      <div className="py-6 text-center">
        <p className="data-lg legible">{polarDay ? 'Sol todo el día' : 'Sin sol hoy'}</p>
        <p className="text-ink-faint mt-2 text-[0.8125rem]">
          {polarDay
            ? 'A esta latitud el sol no llega a ponerse.'
            : 'A esta latitud el sol no llega a salir.'}
        </p>
      </div>
    );
  }

  const sunriseTs = toTimestamp(day.sunrise as string, utcOffsetSeconds);
  const sunsetTs = toTimestamp(day.sunset as string, utcOffsetSeconds);
  const span = Math.max(1, sunsetTs - sunriseTs);
  const rawProgress = (nowTs - sunriseTs) / span;
  const daytime = rawProgress >= 0 && rawProgress <= 1;
  const progress = clamp(rawProgress, 0, 1);
  const marker = pointOnArc(progress);

  const arcPath = `M ${CENTER_X - RADIUS_X} ${BASE_Y} A ${RADIUS_X} ${RADIUS_Y} 0 0 1 ${CENTER_X + RADIUS_X} ${BASE_Y}`;
  // Length of the semi-ellipse, so the travelled portion can be drawn as a dash
  // offset. Ramanujan's approximation, halved — accurate to a small fraction of
  // a percent, which is far beyond what a progress stroke needs.
  const arcLength =
    (Math.PI / 2) *
    (3 * (RADIUS_X + RADIUS_Y) - Math.sqrt((3 * RADIUS_X + RADIUS_Y) * (RADIUS_X + 3 * RADIUS_Y)));

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full"
        style={{ height: compact ? '6.5rem' : '9rem' }}
        aria-hidden
      >
        <defs>
          <linearGradient id="sun-arc-travelled" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="sun-arc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--sky-sun)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--sky-sun)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The full path of the day. Golden hour is reported as times in the Sun
            panel rather than drawn here: as a thick dashed overlay it read as
            two stray marks at the ends of the arc, not as information. */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--ink)"
          strokeOpacity={0.2}
          strokeWidth={1.5}
          strokeDasharray="2 5"
        />
        {/* Daylight already spent. */}
        {daytime && (
          <path
            d={arcPath}
            fill="none"
            stroke="url(#sun-arc-travelled)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength * (1 - progress)}
          />
        )}

        {/* Horizon. */}
        <line
          x1={8}
          x2={VIEW_WIDTH - 8}
          y1={BASE_Y}
          y2={BASE_Y}
          stroke="var(--ink)"
          strokeOpacity={0.2}
          strokeWidth={1}
        />

        {daytime ? (
          <>
            <circle cx={marker.x} cy={marker.y} r={17} fill="url(#sun-arc-glow)" />
            <circle cx={marker.x} cy={marker.y} r={5.2} fill="var(--sky-sun)" />
          </>
        ) : (
          // Below the horizon, waiting.
          <circle cx={CENTER_X} cy={BASE_Y + 16} r={4} fill="var(--ink)" fillOpacity={0.32} />
        )}

        <text
          x={CENTER_X - RADIUS_X}
          y={BASE_Y + 22}
          textAnchor="middle"
          className="tnum"
          fill="var(--ink-faint)"
          fontSize="11"
        >
          {isoTime(day.sunrise as string)}
        </text>
        <text
          x={CENTER_X + RADIUS_X}
          y={BASE_Y + 22}
          textAnchor="middle"
          className="tnum"
          fill="var(--ink-faint)"
          fontSize="11"
        >
          {isoTime(day.sunset as string)}
        </text>
      </svg>

      {!daytime && nextSunrise && (
        <p className="text-ink-muted mt-1 text-center text-[0.8125rem]">
          Amanece a las <span className="tnum">{isoTime(nextSunrise)}</span>
        </p>
      )}
    </div>
  );
}
