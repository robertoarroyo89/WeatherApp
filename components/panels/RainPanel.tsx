'use client';

import { useMemo } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { RainTimeline } from '@/components/rain/RainTimeline';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { formatDayLabel, formatPrecipitation, isoTime } from '@/lib/format';
import { rainOutlook, upcomingDays, upcomingHours } from '@/lib/weather/series';
import { getRainSummary } from '@/lib/weather/summary';

/**
 * Lluvia.
 *
 * Answers the two questions anyone actually has — is it going to rain, and when
 * — before showing a single number.
 */
export function RainPanel() {
  const { bundle, nowTs } = useWeather();
  const hours = useMemo(() => (bundle ? upcomingHours(bundle, nowTs, 24) : []), [bundle, nowTs]);
  const days = useMemo(() => (bundle ? upcomingDays(bundle, nowTs, 8) : []), [bundle, nowTs]);
  if (!bundle) return null;

  const summary = getRainSummary(bundle, nowTs);
  const wetHours = hours.filter((point) => rainOutlook(point).confidence !== 'none');
  const total = hours.reduce((sum, point) => sum + point.precipitation, 0);
  const next = wetHours[0];

  return (
    <div className="pb-4">
      <div className="gutter">
        <p className="legible display-lg">{summary.headline}</p>
        {summary.detail && <p className="prose-summary text-ink-muted mt-3">{summary.detail}</p>}
      </div>

      <section className="gutter pt-8">
        <SectionHeading
          label="Próximas 24 horas"
          meta={next ? `Desde ${isoTime(next.time)}` : 'Sin lluvia'}
        />
        <div className="pt-5">
          <RainTimeline hours={hours} height={104} showScale />
        </div>
        {/* A definition list rather than three columns: the labels are full
            sentences of their own and would wrap to ragged two- and three-line
            stacks in a grid this narrow. */}
        <dl className="mt-7">
          <Fact label="Total previsto" value={formatPrecipitation(total)} />
          <Fact
            label="Horas con lluvia"
            value={wetHours.length > 0 ? `${wetHours.length} h` : 'Ninguna'}
          />
          <Fact
            label="Probabilidad máxima"
            value={`${Math.round(Math.max(0, ...hours.map((point) => point.precipitationProbability)))} %`}
          />
        </dl>
      </section>

      <section className="gutter pt-9">
        <SectionHeading label="Próximos días" />
        <ul className="pt-1">
          {days.map((day) => (
            <li key={day.date} className="border-hairline flex items-center gap-4 border-b py-3.5">
              <span className="w-20 shrink-0 text-[0.9375rem]">
                {formatDayLabel(day.timestamp, bundle.timezone, nowTs)}
              </span>
              <div
                className="h-[3px] flex-1 overflow-hidden rounded-full"
                style={{ background: 'var(--hairline)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, day.precipitationProbabilityMax)}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
              <span className="tnum text-ink-muted w-12 shrink-0 text-right text-[0.875rem]">
                {Math.round(day.precipitationProbabilityMax)} %
              </span>
              <span className="tnum text-ink-faint w-16 shrink-0 text-right text-[0.8125rem]">
                {day.precipitationSum > 0 ? formatPrecipitation(day.precipitationSum) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5">
      <dt className="text-ink-muted text-[0.9375rem]">{label}</dt>
      <dd className="tnum text-[0.9375rem]">{value}</dd>
    </div>
  );
}
