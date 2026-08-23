'use client';

import { useScene } from '@/components/SceneProvider';
import { useWeather } from '@/lib/hooks/useWeather';
import { LeaderRow } from '@/components/ui/SectionHeading';
import {
  formatVisibility,
  humidityLabel,
  uvLabel,
  visibilityLabel,
  windCardinal,
  formatWind,
} from '@/lib/format';
import { windStrengthLabel } from '@/lib/weather/summary';

/**
 * The supporting numbers, as a specification sheet.
 *
 * Dotted leaders instead of a grid of boxes: the label on the left, the figure
 * on the right, the eye carried between them. It holds four readings in the
 * vertical space one card would take, and it reads as measurement rather than as
 * dashboard furniture.
 */
export function DetailStrip() {
  const { bundle, preferences } = useWeather();
  const { point, scrubbed } = useScene();
  if (!bundle) return null;

  const source = scrubbed && point ? point : null;
  const windSpeed = source?.windSpeed ?? bundle.current.windSpeed;
  const windDirection = source?.windDirection ?? bundle.current.windDirection;
  const gusts = source?.windGusts ?? bundle.current.windGusts;
  const humidity = source?.humidity ?? bundle.current.humidity;
  const uv = source?.uvIndex ?? bundle.current.uvIndex ?? 0;
  const visibility = source?.visibility ?? bundle.current.visibility ?? 20_000;
  const pressure = bundle.current.pressure;

  return (
    <dl>
      <LeaderRow
        label="Viento"
        value={formatWind(windSpeed, preferences.windUnit)}
        /* Gusts when they are the story, otherwise direction and strength. The
           strength on its own row would only restate the figure above it. */
        note={
          gusts >= windSpeed + 12
            ? `Rachas ${Math.round(gusts)}`
            : `${windCardinal(windDirection)} · ${windStrengthLabel(windSpeed)}`
        }
      />
      <LeaderRow
        label="Humedad"
        value={`${Math.round(humidity)} %`}
        note={humidityLabel(humidity)}
      />
      <LeaderRow label="Índice UV" value={Math.round(uv)} note={uvLabel(uv)} />
      <LeaderRow
        label="Visibilidad"
        value={formatVisibility(visibility)}
        note={visibilityLabel(visibility)}
      />
      <LeaderRow label="Presión" value={`${Math.round(pressure)} hPa`} />
    </dl>
  );
}
