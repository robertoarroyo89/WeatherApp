'use client';

import { useMemo } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { ScoreScale } from '@/components/activities/ScoreScale';
import { ScoreSparkline } from '@/components/activities/ScoreSparkline';
import { isoTime } from '@/lib/format';
import { assessAllActivities, type ActivityAssessment } from '@/lib/weather/activities';

/**
 * Actividades.
 *
 * Ranked best-first, because the useful question is "what is worth doing right
 * now" rather than "how does running score". Each entry leads with the score,
 * then the recommendation, then the window, then the four numbers behind it — in
 * that order of importance, and never as a card.
 */
export function ActivitiesPanel() {
  const { bundle, nowTs } = useWeather();
  const assessments = useMemo(
    () => (bundle ? assessAllActivities(bundle, nowTs) : []),
    [bundle, nowTs],
  );
  if (!bundle || assessments.length === 0) return null;

  const ranked = [...assessments].sort((a, b) => b.score - a.score);

  return (
    <div className="pb-6">
      <p className="gutter prose-summary text-ink-muted">
        Una orientación práctica según el tiempo de las próximas horas. No es una ciencia exacta.
      </p>
      <ul className="pt-4">
        {ranked.map((assessment) => (
          <li key={assessment.definition.id} className="gutter border-hairline border-t py-8">
            <ActivityEntry assessment={assessment} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityEntry({ assessment }: { assessment: ActivityAssessment }) {
  const { definition, best, factors, series } = assessment;

  return (
    <div>
      <h3 className="section-label">{definition.label}</h3>

      <div className="mt-4">
        <ScoreScale score={assessment.score} verdict={assessment.verdict} />
      </div>

      <p className="prose-summary text-ink-muted mt-4">{assessment.advice}</p>

      {best && (
        <div className="mt-6">
          <div className="section-label">Mejor momento</div>
          <p className="legible readout mt-2 text-[1.375rem]">
            {isoTime(best.start.time)} – {isoTime(addHour(best.end.time))}
          </p>
        </div>
      )}

      <div className="mt-6">
        <ScoreSparkline series={series} />
      </div>

      <dl className="mt-6 grid grid-cols-4 gap-3">
        {factors.map((factor) => (
          <div key={factor.caption}>
            <dt className="text-ink-faint text-[0.6875rem] tracking-[0.1em] uppercase">
              {factor.caption}
            </dt>
            <dd
              className="readout mt-1.5 text-[0.875rem]"
              style={{
                color:
                  factor.tone === 'bad'
                    ? 'var(--ink-muted)'
                    : factor.tone === 'good'
                      ? 'var(--ink)'
                      : 'var(--ink-muted)',
                opacity: factor.tone === 'bad' ? 0.72 : 1,
              }}
            >
              {factor.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** "19:00" -> "20:00", so a window reads as a span rather than a start list. */
function addHour(iso: string): string {
  const hour = Number.parseInt(iso.slice(11, 13), 10);
  const next = (hour + 1) % 24;
  return `${iso.slice(0, 11)}${String(next).padStart(2, '0')}:00`;
}
