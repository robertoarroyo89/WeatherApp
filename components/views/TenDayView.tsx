'use client';

import { useMemo } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { formatWeekdayShort, formatDayNumber, temperatureValue } from '@/lib/format';
import { upcomingDays } from '@/lib/weather/series';
import { getForecastHighlight } from '@/lib/weather/summary';
import type { DailyPoint } from '@/lib/weather/types';

/**
 * Ten days.
 *
 * Each row is a bar showing that day's range inside the range of the whole ten
 * days, which turns a column of numbers into a shape you can read at a glance —
 * where the cold snap is, where the heat builds. Today's bar also carries a
 * marker for the current temperature.
 */
export function TenDayView() {
  const { bundle, nowTs, preferences } = useWeather();
  const unit = preferences.temperatureUnit;

  const days = useMemo(() => (bundle ? upcomingDays(bundle, nowTs, 10) : []), [bundle, nowTs]);
  if (!bundle || days.length === 0) return null;

  const highlight = getForecastHighlight(bundle, nowTs);
  const globalMin = Math.min(...days.map((day) => day.temperatureMin));
  const globalMax = Math.max(...days.map((day) => day.temperatureMax));
  const span = Math.max(1, globalMax - globalMin);

  const hottest = days.reduce((best, day) =>
    day.temperatureMax > best.temperatureMax ? day : best,
  );
  const coldest = days.reduce((best, day) =>
    day.temperatureMin < best.temperatureMin ? day : best,
  );

  return (
    <div className="mx-auto w-full max-w-[46rem] pt-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)] lg:px-8">
      <header className="gutter">
        <p className="eyebrow">Próximos 10 días</p>
        {highlight && <p className="legible display-lg mt-5 max-w-[24rem]">{highlight}</p>}
      </header>

      <ul className="mt-8">
        {days.map((day, index) => (
          <DayRow
            key={day.date}
            day={day}
            index={index}
            timezone={bundle.timezone}
            globalMin={globalMin}
            span={span}
            unit={unit}
            currentTemperature={index === 0 ? bundle.current.temperature : null}
            note={noteFor(day, hottest, coldest)}
          />
        ))}
      </ul>
    </div>
  );
}

function noteFor(day: DailyPoint, hottest: DailyPoint, coldest: DailyPoint): string | null {
  if (day.precipitationSum >= 8) return 'Mucha lluvia';
  if (day.date === hottest.date) return 'El más caluroso';
  if (day.date === coldest.date) return 'El más fresco';
  if (day.windGustsMax >= 60) return 'Rachas fuertes';
  if (day.precipitationSum >= 2) return 'Lluvia';
  return null;
}

function DayRow({
  day,
  index,
  timezone,
  globalMin,
  span,
  unit,
  currentTemperature,
  note,
}: {
  day: DailyPoint;
  index: number;
  timezone: string;
  globalMin: number;
  span: number;
  unit: 'celsius' | 'fahrenheit';
  currentTemperature: number | null;
  note: string | null;
}) {
  const left = ((day.temperatureMin - globalMin) / span) * 100;
  const width = Math.max(4, ((day.temperatureMax - day.temperatureMin) / span) * 100);
  const marker =
    currentTemperature === null
      ? null
      : Math.min(100, Math.max(0, ((currentTemperature - globalMin) / span) * 100));

  return (
    <li className="gutter border-hairline border-b py-4">
      <div className="flex items-center gap-3.5">
        <div className="w-12 shrink-0">
          <div className="[font-family:var(--font-mono)] text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            {index === 0 ? 'Hoy' : formatWeekdayShort(day.timestamp, timezone)}
          </div>
          <div className="readout text-ink-faint text-[0.6875rem]">
            {formatDayNumber(day.timestamp, timezone)}
          </div>
        </div>

        <div className="w-9 shrink-0">
          <WeatherIcon name={day.condition.icon} size={21} className="text-ink-muted" />
          {day.precipitationProbabilityMax >= 25 && (
            <div className="readout text-ink-faint mt-0.5 text-[0.625rem]">
              {Math.round(day.precipitationProbabilityMax)}%
            </div>
          )}
        </div>

        <span className="tnum text-ink-faint w-9 shrink-0 text-right text-[0.9375rem]">
          {temperatureValue(day.temperatureMin, unit)}°
        </span>

        <div
          className="relative h-[3px] flex-1 rounded-full"
          style={{ background: 'var(--hairline)' }}
        >
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              background:
                'linear-gradient(to right, color-mix(in oklab, var(--ink) 42%, transparent), var(--accent))',
            }}
          />
          {marker !== null && (
            <span
              className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${marker}%`, background: 'var(--ink)' }}
              aria-label="Temperatura actual"
            />
          )}
        </div>

        <span className="readout w-9 shrink-0 text-[0.875rem] font-medium">
          {temperatureValue(day.temperatureMax, unit)}°
        </span>
      </div>

      {note && <p className="text-ink-faint mt-2 pl-[3.5rem] text-[0.75rem]">{note}</p>}
    </li>
  );
}
