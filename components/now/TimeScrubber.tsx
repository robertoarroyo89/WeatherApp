'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useScene } from '@/components/SceneProvider';
import { useWeather } from '@/lib/hooks/useWeather';
import { smoothPath, type Point } from '@/lib/geometry';
import { isoTime, temperatureValue } from '@/lib/format';
import { upcomingHours } from '@/lib/weather/series';
import type { HourlyPoint, TemperatureUnit } from '@/lib/weather/types';

/**
 * The time scrubber.
 *
 * Drag across the next twenty-four hours and the entire app follows: the sky
 * relights, the sun moves, cloud thickens, rain starts, the temperature counts
 * up or down and the summary rewrites itself. It is the difference between
 * reading a forecast and feeling one.
 *
 * Four decisions make it work on a phone:
 *
 *  - No network. Every hour is already in memory and `sceneFromInstant`
 *    interpolates between them, so a drag never waits on anything.
 *  - Pointer moves are collapsed onto animation frames, and the palette lands on
 *    `<html>` as custom properties, so a frame costs one style recalculation
 *    rather than a React render of the page.
 *  - `touch-action: pan-y` keeps vertical scrolling working: you can drag the
 *    timeline sideways and still flick the page up.
 *  - Releasing leaves the app where you left it, labelled with the hour and with
 *    an explicit way back. Snapping home would undo the exploring you just did.
 */

const HOUR_MS = 3_600_000;
const WINDOW_HOURS = 24;

/* Geometry, in viewBox units. The box is stretched to the viewport width, so
   every stroke is marked non-scaling to keep an even weight. */
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 98;
/** Temperature curve band. */
const PLOT_TOP = 8;
const PLOT_BOTTOM = 62;
/** Rain probability bars hang from this baseline. */
const RAIN_BASE = 84;
const RAIN_MAX = 20;
/** Day / night ribbon, kept clear of the bars so the two do not read as one row. */
const RIBBON_Y = 94;
const RIBBON_HEIGHT = 3;

export function TimeScrubber() {
  const { bundle, nowTs, preferences } = useWeather();
  const { scrubTs, setScrubTs, dragging, setDragging } = useScene();
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  // Pointer events are synchronous; a React state flag would not be set yet when
  // the first `pointermove` of a fast flick arrives, and those moves would be
  // dropped. The ref decides, the state only drives the CSS.
  const draggingRef = useRef(false);

  const hours = useMemo(
    () => (bundle ? upcomingHours(bundle, nowTs, WINDOW_HOURS) : []),
    [bundle, nowTs],
  );

  const startTs = hours[0]?.timestamp ?? nowTs;
  const spanMs = Math.max(1, (hours.length - 1) * HOUR_MS);
  const activeTs = scrubTs ?? nowTs;
  const progress = Math.min(1, Math.max(0, (activeTs - startTs) / spanMs));

  const geometry = useMemo(
    () => buildGeometry(hours, preferences.temperatureUnit),
    [hours, preferences.temperatureUnit],
  );

  /* ------------------------------------------------------------ interaction -- */

  const commit = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || hours.length < 2) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setScrubTs(startTs + ratio * spanMs);
    },
    [hours.length, setScrubTs, spanMs, startTs],
  );

  // Pointer moves arrive faster than the screen refreshes; collapse them.
  const schedule = useCallback(
    (clientX: number) => {
      pendingRef.current = clientX;
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        if (pendingRef.current !== null) commit(pendingRef.current);
      });
    },
    [commit],
  );

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Capture keeps the drag alive past the edges of the track. It can throw if
    // the pointer has already gone away, and losing capture is far better than
    // losing the gesture.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* drag still works without capture */
    }
    draggingRef.current = true;
    setDragging(true);
    commit(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    schedule(event.clientX);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* already released */
    }
    draggingRef.current = false;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (hours.length < 2) return;
    const step = event.shiftKey ? 3 * HOUR_MS : HOUR_MS;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = activeTs + step;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = activeTs - step;
    else if (event.key === 'Home') next = startTs;
    else if (event.key === 'End') next = startTs + spanMs;
    else if (event.key === 'Escape') {
      setScrubTs(null);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setScrubTs(Math.min(startTs + spanMs, Math.max(startTs, next)));
  };

  if (hours.length < 2) return null;

  const indicatorX = progress * VIEW_WIDTH;
  const nowX = ((nowTs - startTs) / spanMs) * VIEW_WIDTH;
  const indicatorY = geometry.yAt(progress);
  const displayed = scrubTs === null ? hours[0] : nearestHour(hours, activeTs);
  const label = scrubTs === null ? 'Ahora' : isoTime(displayed.time);
  const glide = dragging
    ? 'none'
    : 'left var(--dur-base) var(--ease-out), top var(--dur-base) var(--ease-out)';

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Recorre las próximas 24 horas"
      aria-valuemin={0}
      aria-valuemax={hours.length - 1}
      aria-valuenow={Math.round(progress * (hours.length - 1))}
      aria-valuetext={`${label}, ${temperatureValue(displayed.temperature, preferences.temperatureUnit)} grados`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className="focus-visible:outline-accent relative w-full cursor-ew-resize rounded-lg pt-5 select-none focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[6px]"
      style={{
        // Horizontal drags scrub; vertical flicks still scroll the page.
        touchAction: 'pan-y',
      }}
    >
      {/* Readout, tracking the handle. */}
      <div
        className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap"
        style={{
          left: `${Math.min(88, Math.max(12, progress * 100))}%`,
          transition: dragging ? 'none' : 'left var(--dur-base) var(--ease-out)',
        }}
      >
        <span className="tnum text-ink-muted text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
          {label}
        </span>
        <span className="tnum text-ink ml-1.5 text-[0.6875rem] font-medium">
          {temperatureValue(displayed.temperature, preferences.temperatureUnit)}°
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-[6.5rem] w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="scrub-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={geometry.areaPath} fill="url(#scrub-fill)" />
          <path
            d={geometry.linePath}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.85}
            strokeWidth={1.75}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Chance of rain. */}
          {geometry.rainBars.map((bar, index) => (
            <rect
              key={index}
              x={bar.x - bar.width / 2}
              y={RAIN_BASE - bar.height}
              width={bar.width}
              height={bar.height}
              rx={Math.min(bar.width, bar.height) / 2}
              fill="var(--accent)"
              opacity={0.38}
            />
          ))}

          {/* Day and night as a ribbon, not a slab across the chart. */}
          <rect
            x={0}
            y={RIBBON_Y}
            width={VIEW_WIDTH}
            height={RIBBON_HEIGHT}
            fill="var(--ink)"
            opacity={0.18}
          />
          {geometry.nightBands.map((band, index) => (
            <rect
              key={index}
              x={band.from * VIEW_WIDTH}
              y={RIBBON_Y}
              width={(band.to - band.from) * VIEW_WIDTH}
              height={RIBBON_HEIGHT}
              fill="rgb(4 8 14)"
              opacity={0.5}
            />
          ))}

          {/* Where "now" sits, once the user has scrubbed away from it. */}
          {scrubTs !== null && (
            <line
              x1={nowX}
              x2={nowX}
              y1={PLOT_TOP - 6}
              y2={RIBBON_Y + RIBBON_HEIGHT}
              stroke="var(--ink)"
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          <line
            x1={indicatorX}
            x2={indicatorX}
            y1={PLOT_TOP - 6}
            y2={RIBBON_Y + RIBBON_HEIGHT}
            stroke="var(--ink)"
            strokeOpacity={0.45}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* The handle sits outside the stretched SVG so it stays perfectly round. */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${progress * 100}%`,
            top: `${(indicatorY / VIEW_HEIGHT) * 100}%`,
            transform: 'translate(-50%, -50%)',
            transition: glide,
          }}
          aria-hidden
        >
          <span
            className="block h-[22px] w-[22px] rounded-full"
            style={{ background: 'var(--ink)', opacity: 0.16 }}
          />
          <span
            className="absolute top-1/2 left-1/2 block h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'var(--ink)', boxShadow: '0 1px 6px rgb(4 8 14 / 0.5)' }}
          />
        </div>
      </div>

      {/* Hour labels live outside the SVG so the type is never skewed. */}
      <div className="relative mt-2 h-4">
        {geometry.ticks.map((tick) => (
          <span
            key={tick.at}
            className="tnum text-ink-faint absolute -translate-x-1/2 text-[0.6875rem] tracking-wide"
            style={{ left: `${Math.min(97, Math.max(3, tick.at * 100))}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface Geometry {
  linePath: string;
  areaPath: string;
  ticks: Array<{ at: number; label: string }>;
  rainBars: Array<{ x: number; height: number; width: number }>;
  nightBands: Array<{ from: number; to: number }>;
  yAt: (progress: number) => number;
}

function buildGeometry(hours: HourlyPoint[], unit: TemperatureUnit): Geometry {
  if (hours.length < 2) {
    return {
      linePath: '',
      areaPath: '',
      ticks: [],
      rainBars: [],
      nightBands: [],
      yAt: () => PLOT_BOTTOM,
    };
  }

  const temperatures = hours.map((point) => temperatureValue(point.temperature, unit));
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  // A flat day must not render as a flat line pinned to the top of the band.
  const padding = Math.max(1.2, (max - min) * 0.18);
  const low = min - padding;
  const high = max + padding;

  const points: Point[] = temperatures.map((value, index) => ({
    x: (index / (hours.length - 1)) * VIEW_WIDTH,
    y: PLOT_BOTTOM - ((value - low) / (high - low)) * (PLOT_BOTTOM - PLOT_TOP),
  }));

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${VIEW_WIDTH} ${PLOT_BOTTOM} L 0 ${PLOT_BOTTOM} Z`;

  const ticks: Array<{ at: number; label: string }> = [];
  for (let index = 0; index < hours.length; index += 4) {
    ticks.push({ at: index / (hours.length - 1), label: isoTime(hours[index].time).slice(0, 2) });
  }

  const barWidth = (VIEW_WIDTH / hours.length) * 0.52;
  // Below roughly one chance in ten a bar is visual debris rather than
  // information, and a row of one-pixel stubs reads as a rendering fault.
  const rainBars = hours
    .map((point, index) => ({
      x: (index / (hours.length - 1)) * VIEW_WIDTH,
      height: Math.max(3, (Math.min(100, point.precipitationProbability) / 100) * RAIN_MAX),
      width: barWidth,
      probability: point.precipitationProbability,
    }))
    .filter((bar) => bar.probability >= 10);

  const nightBands: Array<{ from: number; to: number }> = [];
  let bandStart: number | null = null;
  hours.forEach((point, index) => {
    const at = index / (hours.length - 1);
    if (!point.isDay && bandStart === null) bandStart = at;
    if (point.isDay && bandStart !== null) {
      nightBands.push({ from: bandStart, to: at });
      bandStart = null;
    }
  });
  if (bandStart !== null) nightBands.push({ from: bandStart, to: 1 });

  const yAt = (fraction: number) => {
    const exact = fraction * (hours.length - 1);
    const index = Math.min(points.length - 2, Math.max(0, Math.floor(exact)));
    const t = exact - index;
    return points[index].y + (points[index + 1].y - points[index].y) * t;
  };

  return { linePath, areaPath, ticks, rainBars, nightBands, yAt };
}

/** Nearest whole hour, for the readout label. */
function nearestHour(hours: HourlyPoint[], timestamp: number): HourlyPoint {
  let closest = hours[0];
  let best = Infinity;
  for (const point of hours) {
    const distance = Math.abs(point.timestamp - timestamp);
    if (distance < best) {
      best = distance;
      closest = point;
    }
  }
  return closest;
}
