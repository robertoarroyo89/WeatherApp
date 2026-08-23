'use client';

import { useWeather } from '@/lib/hooks/useWeather';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { levelLabel } from '@/lib/format';
import { getAirSummary, getPollenSummary } from '@/lib/weather/summary';
import type { AirLevel } from '@/lib/weather/types';

const LEVEL_FILL: Record<AirLevel, number> = {
  veryLow: 0.16,
  low: 0.34,
  moderate: 0.55,
  high: 0.74,
  veryHigh: 0.88,
  extreme: 1,
};

/**
 * Aire.
 *
 * Interpretation first: "Muy buena — puedes ventilar sin problema" is the whole
 * answer for almost everyone, and the μg/m³ are there for the people who want
 * them. Pollutants and pollen species with no data for this location are simply
 * not shown rather than rendered as dashes.
 */
export function AirPanel() {
  const { bundle } = useWeather();
  if (!bundle) return null;

  const air = bundle.air;
  const summary = getAirSummary(air);
  const pollenSummary = getPollenSummary(air);

  const pollutants = air
    ? (
        [
          { label: 'PM2,5', value: air.pm2_5, unit: 'μg/m³' },
          { label: 'PM10', value: air.pm10, unit: 'μg/m³' },
          { label: 'Ozono', value: air.ozone, unit: 'μg/m³' },
          { label: 'Dióxido de nitrógeno', value: air.nitrogenDioxide, unit: 'μg/m³' },
          { label: 'Dióxido de azufre', value: air.sulphurDioxide, unit: 'μg/m³' },
        ] as const
      ).filter((item) => item.value !== null)
    : [];

  return (
    <div className="pb-4">
      <div className="gutter">
        <p className="legible display-lg">{summary.headline}</p>
        {summary.detail && <p className="prose-summary text-ink-muted mt-4">{summary.detail}</p>}
        {air?.europeanAqi !== null && air?.europeanAqi !== undefined && (
          <div className="mt-6">
            <div className="h-[3px] w-full rounded-full" style={{ background: 'var(--hairline)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, air.europeanAqi)}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            <p className="tnum text-ink-faint mt-2 text-[0.75rem]">
              Índice europeo de calidad del aire: {Math.round(air.europeanAqi)}
            </p>
          </div>
        )}
      </div>

      {pollutants.length > 0 && (
        <section className="gutter pt-9">
          <SectionHeading label="Contaminantes" />
          <dl className="pt-1">
            {pollutants.map((item) => (
              <div
                key={item.label}
                className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5"
              >
                <dt className="text-ink-muted text-[0.9375rem]">{item.label}</dt>
                <dd className="tnum text-[0.9375rem]">
                  {(Math.round((item.value as number) * 10) / 10).toLocaleString('es-ES')}{' '}
                  <span className="text-ink-faint">{item.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {air && air.pollen.length > 0 && (
        <section className="gutter pt-9">
          <SectionHeading label="Polen" />
          {pollenSummary && <p className="prose-summary text-ink-muted pt-3">{pollenSummary}</p>}
          <ul className="pt-2">
            {air.pollen
              .slice()
              .sort((a, b) => b.value - a.value)
              .map((reading) => (
                <li key={reading.species} className="border-hairline border-b py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[0.9375rem]">{reading.label}</span>
                    <span className="text-ink-muted text-[0.9375rem]">
                      {levelLabel(reading.level)}
                    </span>
                  </div>
                  <div
                    className="mt-2.5 h-[2px] w-full rounded-full"
                    style={{ background: 'var(--hairline)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${LEVEL_FILL[reading.level] * 100}%`,
                        background: 'var(--accent)',
                        opacity: reading.level === 'veryLow' ? 0.45 : 1,
                      }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {!air && (
        <p className="gutter text-ink-faint pt-8 text-[0.9375rem]">
          El servicio de calidad del aire no cubre esta zona. El resto de la previsión funciona con
          normalidad.
        </p>
      )}
    </div>
  );
}
