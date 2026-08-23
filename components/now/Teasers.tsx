'use client';

import { useMemo } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { RainTimeline } from '@/components/rain/RainTimeline';
import { SunArc } from '@/components/sun/SunArc';
import { formatDuration, formatScore } from '@/lib/format';
import { assessAllActivities } from '@/lib/weather/activities';
import { getAirSummary, getPollenSummary, getRainSummary } from '@/lib/weather/summary';
import { todayDaily, upcomingHours } from '@/lib/weather/series';

/**
 * Sections on the home screen that stand in for a whole screen.
 *
 * Each one answers its question outright — "no parece que vaya a llover" —
 * and then offers the detail behind it. A teaser that only said "Lluvia >" would
 * be a navigation item pretending to be content.
 */

function Teaser({
  index,
  label,
  onOpen,
  children,
  ariaLabel,
}: {
  index: string;
  label: string;
  onOpen: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <section className="pt-10">
      <button
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        className="pressable block w-full text-left"
      >
        <div className="gutter">
          <SectionHeading index={index} label={label} meta="Ver" />
        </div>
        <div className="pt-4">{children}</div>
      </button>
    </section>
  );
}

export function RainTeaser({ onOpen }: { onOpen: () => void }) {
  const { bundle, nowTs } = useWeather();
  const summary = useMemo(() => (bundle ? getRainSummary(bundle, nowTs) : null), [bundle, nowTs]);
  const hours = useMemo(() => (bundle ? upcomingHours(bundle, nowTs, 14) : []), [bundle, nowTs]);
  if (!bundle || !summary) return null;

  return (
    <Teaser index="03" label="Lluvia" onOpen={onOpen} ariaLabel="Ver el detalle de la lluvia">
      <div className="gutter">
        <p className="legible display-md">{summary.headline}</p>
        {summary.detail && (
          <p className="text-ink-muted mt-1.5 text-[0.9375rem]">{summary.detail}</p>
        )}
        <div className="mt-5">
          <RainTimeline hours={hours} height={58} />
        </div>
      </div>
    </Teaser>
  );
}

export function SunTeaser({ onOpen }: { onOpen: () => void }) {
  const { bundle, nowTs } = useWeather();
  if (!bundle) return null;
  const today = todayDaily(bundle, nowTs);
  if (!today) return null;
  const tomorrow = bundle.daily.find((day) => day.timestamp > today.timestamp);

  return (
    <Teaser index="04" label="Sol" onOpen={onOpen} ariaLabel="Ver el detalle del sol">
      <div className="gutter">
        <SunArc
          day={today}
          utcOffsetSeconds={bundle.utcOffsetSeconds}
          nowTs={nowTs}
          nextSunrise={tomorrow?.sunrise}
          compact
        />
        <p className="text-ink-faint mt-2 text-center text-[0.8125rem]">
          {formatDuration(today.daylightSeconds)} de luz
        </p>
      </div>
    </Teaser>
  );
}

export function ActivityTeaser({ onOpen }: { onOpen: () => void }) {
  const { bundle, nowTs } = useWeather();
  const assessments = useMemo(
    () => (bundle ? assessAllActivities(bundle, nowTs) : []),
    [bundle, nowTs],
  );
  if (!bundle || !assessments.length) return null;

  const ranked = [...assessments].sort((a, b) => b.score - a.score);
  const best = ranked[0];

  return (
    <Teaser index="05" label="Actividades" onOpen={onOpen} ariaLabel="Ver todas las actividades">
      <div className="gutter">
        <p className="legible display-md">{best.advice}</p>
        <div className="scroll-x -mx-[var(--gutter)] mt-5">
          <div className="flex gap-7 px-[var(--gutter)]">
            {ranked.map((assessment) => (
              <div key={assessment.definition.id} className="shrink-0">
                <div className="section-label whitespace-nowrap">{assessment.definition.label}</div>
                <div className="legible mt-2 [font-family:var(--font-display)] text-[1.875rem] leading-none">
                  {formatScore(assessment.score)}
                </div>
                <div
                  className="mt-2 h-px w-14"
                  style={{ background: 'var(--hairline)' }}
                  aria-hidden
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, assessment.score * 10)}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Teaser>
  );
}

export function AirTeaser({ onOpen }: { onOpen: () => void }) {
  const { bundle } = useWeather();
  if (!bundle) return null;
  const summary = getAirSummary(bundle.air);
  const pollen = getPollenSummary(bundle.air);

  return (
    <Teaser
      index="06"
      label="Aire"
      onOpen={onOpen}
      ariaLabel="Ver el detalle de la calidad del aire"
    >
      <div className="gutter">
        <p className="legible data-xl">{summary.headline}</p>
        {summary.detail && (
          <p className="text-ink-muted mt-2.5 text-[0.9375rem]">{summary.detail}</p>
        )}
        {pollen && <p className="text-ink-faint mt-1 text-[0.9375rem]">{pollen}</p>}
      </div>
    </Teaser>
  );
}
