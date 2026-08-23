'use client';

import { useScene } from '@/components/SceneProvider';
import { useWeather } from '@/lib/hooks/useWeather';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Icon } from '@/components/ui/Icon';
import { isoTime, temperatureValue } from '@/lib/format';
import { findNextEvent } from '@/lib/weather/events';
import { getCurrentSummary, getScrubSummary } from '@/lib/weather/summary';
import { todayDaily } from '@/lib/weather/series';
import type { TemperatureUnit } from '@/lib/weather/types';

/**
 * The first thing anyone sees.
 *
 * Composed as an editorial lockup rather than a centred stack: the temperature
 * sits large on the left, the condition is set in tracked mono caps hanging off
 * its baseline on the right, and a single measured line underneath carries the
 * supporting figures. Everything is anchored to the bottom of the opening
 * viewport, so the upper two thirds are nothing but sky.
 */
export function CurrentHero() {
  const { bundle, nowTs, preferences } = useWeather();
  const { scene, point, scrubbed, scrubTs, setScrubTs, dragging } = useScene();

  if (!bundle) return <HeroSkeleton />;

  const unit = preferences.temperatureUnit;
  // When scrubbing, everything reflects the dragged-to hour instead of now.
  const temperature = scrubbed ? scene.temperature : bundle.current.temperature;
  const apparent = scrubbed ? scene.apparentTemperature : bundle.current.apparentTemperature;
  const condition = scrubbed && point ? point.condition : bundle.current.condition;
  const today = todayDaily(bundle, nowTs);

  const summary =
    scrubbed && point
      ? {
          headline: getScrubSummary(point),
          detail: compareWithNow(point.temperature, bundle.current.temperature, unit),
        }
      : getCurrentSummary(bundle, nowTs);
  const event = scrubbed ? null : findNextEvent(bundle, nowTs);

  return (
    <div className="gutter flex min-h-[76dvh] flex-col justify-end pb-9 lg:min-h-0 lg:pb-0">
      <div className="rise-in">
        {scrubbed && scrubTs !== null && (
          <button
            type="button"
            onClick={() => setScrubTs(null)}
            className="pressable border-hairline mb-6 inline-flex items-center gap-2.5 border-b pb-1.5 text-[0.6875rem] tracking-[0.14em] uppercase"
          >
            <Icon name="clock" size={13} className="text-ink-faint" />
            <span className="readout font-medium">
              {isoTime(point?.time ?? bundle.current.time)}
            </span>
            <span className="text-ink-faint">Volver a ahora</span>
          </button>
        )}

        {/* Temperature and condition share an optical baseline. */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-start">
            <AnimatedNumber
              value={temperatureValue(temperature, unit)}
              immediate={dragging}
              className="hero-temp legible"
            />
            <span
              className="legible mt-[0.3em] -ml-[0.02em] font-[family-name:var(--font-display)] text-[clamp(1.75rem,8.5vw,2.75rem)] leading-none opacity-50"
              aria-hidden
            >
              °
            </span>
            <span className="sr-only">grados</span>
          </div>

          <p className="legible mb-[0.45em] max-w-[8.5rem] text-right [font-family:var(--font-mono)] text-[0.6875rem] leading-[1.5] font-medium tracking-[0.16em] uppercase">
            {condition.label}
          </p>
        </div>

        {/* One measured line of supporting figures, on a rule. */}
        <dl className="border-hairline mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t pt-3.5 text-[0.75rem]">
          <Figure label="Sensación">
            <AnimatedNumber
              value={temperatureValue(apparent, unit)}
              immediate={dragging}
              suffix="°"
              className="readout"
            />
          </Figure>
          {today && (
            <>
              <Figure label="Máx">
                <span className="readout">{temperatureValue(today.temperatureMax, unit)}°</span>
              </Figure>
              <Figure label="Mín">
                <span className="readout">{temperatureValue(today.temperatureMin, unit)}°</span>
              </Figure>
            </>
          )}
        </dl>

        <div className="mt-7 max-w-[26rem]">
          <p className="legible display-md">{summary.headline}</p>
          {summary.detail && (
            <p className="legible prose-summary text-ink-muted mt-2">{summary.detail}</p>
          )}
        </div>

        {event && (
          <p className="legible mt-6 flex items-center gap-2.5 [font-family:var(--font-mono)] text-[0.6875rem] tracking-[0.16em] uppercase">
            <span
              className="h-[3px] w-[3px] shrink-0"
              style={{ background: 'var(--accent)' }}
              aria-hidden
            />
            {event.headline}
          </p>
        )}
      </div>
    </div>
  );
}

/** Label above, value below — a caption, not a card. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-ink-faint [font-family:var(--font-mono)] text-[0.625rem] tracking-[0.16em] uppercase">
        {label}
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/**
 * While scrubbing, the useful second line is not the forecast prose but the
 * comparison with right now — "4° menos que ahora" is what you actually wanted
 * to know when you dragged to 21:00.
 */
function compareWithNow(target: number, current: number, unit: TemperatureUnit): string | null {
  const difference = temperatureValue(target, unit) - temperatureValue(current, unit);
  if (difference === 0) return 'La misma temperatura que ahora.';
  const size = Math.abs(difference);
  return difference > 0 ? `${size}° más que ahora.` : `${size}° menos que ahora.`;
}

function HeroSkeleton() {
  return (
    <div
      className="gutter flex min-h-[76dvh] flex-col justify-end pb-9 lg:min-h-0 lg:pb-0"
      aria-hidden
    >
      <div className="space-y-4">
        <ShimmerBar className="h-[8rem] w-[9rem]" />
        <ShimmerBar className="h-3 w-32" />
        <div className="space-y-2 pt-5">
          <ShimmerBar className="h-5 w-64" />
          <ShimmerBar className="h-5 w-44" />
        </div>
      </div>
    </div>
  );
}

/** Loading placeholder that lives inside the sky rather than on top of it. */
export function ShimmerBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: 'var(--hairline)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklab, var(--ink) 12%, transparent), transparent)',
          animation: 'shimmer 1.9s ease-in-out infinite',
        }}
      />
    </div>
  );
}
