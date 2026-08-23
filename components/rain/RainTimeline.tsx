'use client';

import { isoTime } from '@/lib/format';
import { rainOutlook } from '@/lib/weather/series';
import type { HourlyPoint } from '@/lib/weather/types';

/**
 * Chance of rain over the next hours.
 *
 * Bar height is probability, bar brightness is predicted intensity. Both matter
 * and they are not the same question: a bright short bar is a downpour you will
 * definitely notice, a pale tall one is a grey afternoon that may never quite
 * rain. Percentages alone cannot say that.
 *
 * A dry stretch draws a flat line rather than a row of one-pixel stubs. An
 * almost-empty chart is not "honest", it just looks broken.
 */

/** Below this a bar is noise rather than information. */
const MIN_PROBABILITY = 10;

export function RainTimeline({
  hours,
  height = 96,
  showLabels = true,
  showScale = false,
}: {
  hours: HourlyPoint[];
  height?: number;
  showLabels?: boolean;
  /** Draws the 50 % reference line, so a low chart reads as "low" not "empty". */
  showScale?: boolean;
}) {
  if (hours.length === 0) return null;

  const peakProbability = Math.max(...hours.map((point) => point.precipitationProbability));
  const dry = peakProbability < MIN_PROBABILITY;
  const peakIntensity = Math.max(0.6, ...hours.map((point) => point.precipitation));

  return (
    <div>
      <div className="relative">
        {showScale && !dry && (
          // Without a reference an 18 % peak in a full-height box just looks
          // like an empty chart; with one it reads as "well under half".
          <div className="pointer-events-none absolute inset-x-0" style={{ top: 0, height }}>
            {[50, 25].map((level) => (
              <div
                key={level}
                className="absolute inset-x-0 flex items-center"
                style={{ bottom: `${level}%` }}
              >
                <div className="h-px flex-1" style={{ background: 'var(--hairline)' }} />
                <span className="tnum text-ink-faint pl-2 text-[0.625rem]">{level} %</span>
              </div>
            ))}
          </div>
        )}
        {dry ? (
          <div
            className="flex flex-col justify-end"
            style={{ height }}
            role="img"
            aria-label="Sin lluvia prevista en las próximas horas."
          >
            <div className="h-px w-full" style={{ background: 'var(--hairline)' }} />
            <p className="text-ink-faint pt-2.5 text-[0.75rem]">Sin lluvia prevista</p>
          </div>
        ) : (
          <>
            <div
              className="flex items-end gap-[2px]"
              style={{ height }}
              role="img"
              aria-label={buildLabel(hours)}
            >
              {hours.map((point) => {
                const probability = Math.min(100, point.precipitationProbability);
                if (probability < MIN_PROBABILITY) {
                  return <div key={point.time} className="flex-1" style={{ height: 1 }} />;
                }
                const outlook = rainOutlook(point);
                const barHeight = Math.max(4, (probability / 100) * height);
                const intensityRatio = Math.min(1, point.precipitation / peakIntensity);
                return (
                  <div
                    key={point.time}
                    className="relative flex-1 overflow-hidden rounded-t-[3px]"
                    style={{
                      height: barHeight,
                      background:
                        outlook.confidence === 'none'
                          ? 'color-mix(in oklab, var(--ink) 14%, transparent)'
                          : `color-mix(in oklab, var(--accent) ${20 + intensityRatio * 62}%, transparent)`,
                    }}
                  >
                    {point.precipitation > 0.15 && (
                      <div
                        className="absolute inset-x-0 bottom-0"
                        style={{
                          height: `${Math.max(14, intensityRatio * 100)}%`,
                          background: 'color-mix(in oklab, var(--accent) 80%, transparent)',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-px w-full" style={{ background: 'var(--hairline)' }} />
          </>
        )}
      </div>

      {showLabels && (
        <div className="text-ink-faint mt-2 flex justify-between text-[0.6875rem]">
          {pickLabels(hours).map((point) => (
            <span key={point.time} className="tnum">
              {isoTime(point.time)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function pickLabels(hours: HourlyPoint[]): HourlyPoint[] {
  if (hours.length <= 4) return hours;
  const step = Math.ceil(hours.length / 4);
  const labels: HourlyPoint[] = [];
  for (let index = 0; index < hours.length; index += step) labels.push(hours[index]);
  return labels;
}

function buildLabel(hours: HourlyPoint[]): string {
  const wet = hours.filter((point) => rainOutlook(point).confidence !== 'none');
  if (!wet.length) return 'Sin lluvia prevista en las próximas horas.';
  const peak = wet.reduce((best, point) =>
    point.precipitationProbability > best.precipitationProbability ? point : best,
  );
  return `Probabilidad de lluvia; máximo del ${Math.round(peak.precipitationProbability)} % a las ${isoTime(peak.time)}.`;
}
