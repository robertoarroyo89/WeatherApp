'use client';

import { useMemo } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { SunArc } from '@/components/sun/SunArc';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { formatDuration, formatTime, isoTime, uvLabel } from '@/lib/format';
import { todayDaily, upcomingHours } from '@/lib/weather/series';
import { solarMoments } from '@/lib/weather/sunTimes';
import { getDaylightSummary, getUvSummary } from '@/lib/weather/summary';

/** Sol: the arc of the day, the good light, and how hard the sun is hitting. */
export function SunPanel() {
  const { bundle, nowTs } = useWeather();
  const hours = useMemo(() => (bundle ? upcomingHours(bundle, nowTs, 14) : []), [bundle, nowTs]);
  if (!bundle) return null;

  const today = todayDaily(bundle, nowTs);
  if (!today) return null;
  const index = bundle.daily.findIndex((day) => day.date === today.date);
  const yesterday = index > 0 ? bundle.daily[index - 1] : null;
  const tomorrow = bundle.daily[index + 1] ?? null;
  const moments = solarMoments(today, bundle);

  const uv = bundle.current.uvIndex;
  const uvSummary = getUvSummary(uv, bundle.current.isDay);
  const peakUv = hours.reduce(
    (best, point) => (point.uvIndex > best.uvIndex ? point : best),
    hours[0] ?? { uvIndex: 0, time: today.date },
  );

  return (
    <div className="pb-4">
      <div className="gutter">
        <SunArc
          day={today}
          utcOffsetSeconds={bundle.utcOffsetSeconds}
          nowTs={nowTs}
          nextSunrise={tomorrow?.sunrise}
        />
        <p className="text-ink-muted mt-4 text-center text-[0.9375rem]">
          {getDaylightSummary(
            today.daylightSeconds,
            yesterday ? today.daylightSeconds - yesterday.daylightSeconds : null,
          )}
        </p>
      </div>

      <section className="gutter pt-8">
        <SectionHeading label="La luz de hoy" />
        <dl className="pt-1">
          <Row label="Amanece" value={today.sunrise ? isoTime(today.sunrise) : 'No amanece'} />
          <Row label="Anochece" value={today.sunset ? isoTime(today.sunset) : 'No anochece'} />
          <Row label="Horas de luz" value={formatDuration(today.daylightSeconds)} />
          {moments.goldenMorning && (
            <Row
              label="Luz dorada, mañana"
              value={`${formatTime(moments.goldenMorning.start, bundle.timezone)} – ${formatTime(moments.goldenMorning.end, bundle.timezone)}`}
            />
          )}
          {moments.goldenEvening && (
            <Row
              label="Luz dorada, tarde"
              value={`${formatTime(moments.goldenEvening.start, bundle.timezone)} – ${formatTime(moments.goldenEvening.end, bundle.timezone)}`}
            />
          )}
          {moments.blueEvening && (
            <Row
              label="Hora azul"
              value={`${formatTime(moments.blueEvening.start, bundle.timezone)} – ${formatTime(moments.blueEvening.end, bundle.timezone)}`}
            />
          )}
        </dl>
      </section>

      <section className="gutter pt-9">
        <SectionHeading label="Índice UV" />
        <div className="pt-4">
          <p className="legible display-lg">{uvSummary.headline}</p>
          {uvSummary.detail && (
            <p className="prose-summary text-ink-muted mt-2.5">{uvSummary.detail}</p>
          )}
        </div>

        {hours.length > 0 && (
          <div className="mt-7">
            <div
              className="flex items-end gap-[3px]"
              style={{ height: 60 }}
              role="img"
              aria-label={`UV máximo de ${Math.round(peakUv.uvIndex)} a las ${isoTime(peakUv.time)}`}
            >
              {hours.map((point) => (
                <div
                  key={point.time}
                  className="flex-1 rounded-t-[3px]"
                  style={{
                    height: `${Math.max(2, (Math.min(12, point.uvIndex) / 12) * 100)}%`,
                    background:
                      point.uvIndex >= 8
                        ? 'color-mix(in oklab, var(--accent) 92%, transparent)'
                        : point.uvIndex >= 3
                          ? 'color-mix(in oklab, var(--accent) 52%, transparent)'
                          : 'color-mix(in oklab, var(--ink) 14%, transparent)',
                  }}
                />
              ))}
            </div>
            <div className="text-ink-faint mt-2 flex justify-between text-[0.6875rem]">
              <span className="tnum">{isoTime(hours[0].time)}</span>
              <span>
                Máx {uvLabel(peakUv.uvIndex)} · <span className="tnum">{isoTime(peakUv.time)}</span>
              </span>
              <span className="tnum">{isoTime(hours[hours.length - 1].time)}</span>
            </div>
          </div>
        )}
      </section>
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
