'use client';

import { useMemo } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { Icon } from '@/components/ui/Icon';
import {
  formatDuration,
  formatLongDate,
  formatPrecipitation,
  formatWind,
  isoTime,
  temperatureValue,
  uvLabel,
  windCardinal,
} from '@/lib/format';
import { todayDaily, upcomingHours } from '@/lib/weather/series';
import { getCurrentSummary, getTemperatureTrendSummary } from '@/lib/weather/summary';

/**
 * Today, in detail.
 *
 * The hourly run is a list rather than a table: one line per hour, aligned
 * columns, hairlines instead of cells. It is a lot of numbers, so the hierarchy
 * does the work — temperature is the only thing set large.
 */
export function TodayView() {
  const { bundle, nowTs, preferences } = useWeather();
  const unit = preferences.temperatureUnit;

  const hours = useMemo(() => (bundle ? upcomingHours(bundle, nowTs, 24) : []), [bundle, nowTs]);
  if (!bundle) return null;
  const today = todayDaily(bundle, nowTs);
  if (!today) return null;

  const summary = getCurrentSummary(bundle, nowTs);
  const trend = getTemperatureTrendSummary(bundle, nowTs);

  return (
    <div className="mx-auto w-full max-w-[46rem] pt-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)] lg:max-w-[64rem] lg:px-8">
      <header className="gutter">
        <p className="eyebrow">{formatLongDate(nowTs, bundle.timezone)}</p>
        <div className="mt-5 flex items-end gap-4">
          <span className="hero-temp legible" style={{ fontSize: 'clamp(4rem, 20vw, 6rem)' }}>
            {temperatureValue(today.temperatureMax, unit)}°
          </span>
          <span className="mb-2.5 flex items-baseline gap-1.5">
            <span className="text-ink-faint text-[0.6875rem] tracking-[0.16em] uppercase">mín</span>
            <span className="readout text-ink-muted text-[1.5rem]">
              {temperatureValue(today.temperatureMin, unit)}°
            </span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <WeatherIcon name={today.condition.icon} size={18} className="text-ink-muted" />
          <p className="[font-family:var(--font-mono)] text-[0.6875rem] font-medium tracking-[0.16em] uppercase">
            {today.condition.label}
          </p>
        </div>
        <p className="legible display-md mt-6 max-w-[26rem]">{summary.headline}</p>
        {trend && <p className="prose-summary text-ink-muted max-w-[26rem]">{trend}</p>}
      </header>

      <section className="gutter pt-9 lg:pt-12">
        <SectionHeading label="Por horas" meta="24 h" />
        <ul className="mt-1">
          {hours.map((point, index) => (
            <li
              key={point.time}
              className="border-hairline flex items-center gap-4 border-b py-3.5"
            >
              <span className="tnum text-ink-muted w-12 shrink-0 text-[0.875rem]">
                {index === 0 ? 'Ahora' : isoTime(point.time)}
              </span>
              <WeatherIcon
                name={point.condition.icon}
                size={19}
                className="text-ink-faint shrink-0"
              />
              <span className="readout w-14 shrink-0 text-[1.125rem]">
                {temperatureValue(point.temperature, unit)}°
              </span>
              <span className="tnum text-ink-faint w-14 shrink-0 text-right text-[0.8125rem]">
                {point.precipitationProbability >= 5
                  ? `${Math.round(point.precipitationProbability)} %`
                  : ''}
              </span>
              <span className="tnum text-ink-faint flex-1 text-right text-[0.8125rem]">
                {Math.round(point.windSpeed)} km/h
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="gutter pt-9 lg:pt-12">
        <SectionHeading label="Luz" />
        <div className="grid grid-cols-3 pt-1">
          <SunFact
            icon="sunrise"
            label="Amanece"
            value={today.sunrise ? isoTime(today.sunrise) : '—'}
          />
          <SunFact
            icon="sunset"
            label="Anochece"
            value={today.sunset ? isoTime(today.sunset) : '—'}
          />
          <SunFact
            icon="clock"
            label="Horas de luz"
            value={formatDuration(today.daylightSeconds)}
          />
        </div>
      </section>

      <section className="gutter pt-9 lg:pt-12">
        <SectionHeading label="Detalle del día" />
        <dl className="pt-1">
          <Row label="Lluvia acumulada" value={formatPrecipitation(today.precipitationSum)} />
          <Row
            label="Horas con lluvia"
            value={
              today.precipitationHours > 0 ? `${Math.round(today.precipitationHours)} h` : 'Ninguna'
            }
          />
          <Row
            label="Probabilidad máxima"
            value={`${Math.round(today.precipitationProbabilityMax)} %`}
          />
          <Row
            label="Viento máximo"
            value={`${formatWind(today.windSpeedMax, preferences.windUnit)} · ${windCardinal(today.windDirectionDominant)}`}
          />
          <Row
            label="Rachas máximas"
            value={formatWind(today.windGustsMax, preferences.windUnit)}
          />
          <Row
            label="UV máximo"
            value={`${uvLabel(today.uvIndexMax)} · ${Math.round(today.uvIndexMax)}`}
          />
          <Row label="Sensación máxima" value={`${temperatureValue(today.apparentMax, unit)}°`} />
        </dl>
      </section>
    </div>
  );
}

function SunFact({
  icon,
  label,
  value,
}: {
  icon: 'sunrise' | 'sunset' | 'clock';
  label: string;
  value: string;
}) {
  return (
    <div className="border-hairline border-t py-4 pr-3">
      <Icon name={icon} size={17} className="text-ink-faint" />
      <div className="tnum legible mt-3 text-[1.25rem] font-light">{value}</div>
      <div className="text-ink-faint mt-1 text-[0.75rem]">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5">
      <dt className="text-ink-muted text-[0.9375rem]">{label}</dt>
      <dd className="tnum text-[0.9375rem]">{value}</dd>
    </div>
  );
}
