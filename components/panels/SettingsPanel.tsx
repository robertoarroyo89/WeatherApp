'use client';

import { useWeather } from '@/lib/hooks/useWeather';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { TemperatureUnit, WindUnit } from '@/lib/weather/types';
import type { MotionPreference } from '@/lib/store/preferences';

/**
 * Ajustes.
 *
 * Only the settings that change what someone sees. No account, no themes, no
 * notification preferences for notifications that do not exist.
 */
export function SettingsPanel() {
  const { preferences, updatePreferences } = useWeather();

  return (
    <div className="pb-6">
      <section className="gutter">
        <SectionHeading label="Unidades" />
        <Choice<TemperatureUnit>
          label="Temperatura"
          value={preferences.temperatureUnit}
          options={[
            { value: 'celsius', label: '°C' },
            { value: 'fahrenheit', label: '°F' },
          ]}
          onChange={(temperatureUnit) => updatePreferences({ temperatureUnit })}
        />
        <Choice<WindUnit>
          label="Viento"
          value={preferences.windUnit}
          options={[
            { value: 'kmh', label: 'km/h' },
            { value: 'ms', label: 'm/s' },
            { value: 'mph', label: 'mph' },
          ]}
          onChange={(windUnit) => updatePreferences({ windUnit })}
        />
      </section>

      <section className="gutter pt-9">
        <SectionHeading label="Animaciones" />
        <Toggle
          label="Efectos meteorológicos"
          caption="Lluvia, nieve y movimiento de nubes"
          value={preferences.sceneAnimations}
          onChange={(sceneAnimations) => updatePreferences({ sceneAnimations })}
        />
        <Choice<MotionPreference>
          label="Movimiento"
          value={preferences.motion}
          options={[
            // Short enough not to wrap: a two-line segment doubles the height of
            // the whole row.
            { value: 'system', label: 'Sistema' },
            { value: 'reduced', label: 'Reducido' },
          ]}
          onChange={(motion) => updatePreferences({ motion })}
        />
      </section>

      <section className="gutter pt-9">
        <SectionHeading label="Privacidad" />
        <p className="prose-summary text-ink-muted pt-4">
          Tus ubicaciones y preferencias se guardan solo en este dispositivo. No hay cuentas, no hay
          servidor propio y no se recoge ningún dato de uso. Para consultar la previsión se envían
          unas coordenadas redondeadas a Open-Meteo.
        </p>
      </section>

      <section className="gutter pt-9">
        <SectionHeading label="Sobre Atmos" />
        <p className="prose-summary text-ink-muted pt-4">
          Datos meteorológicos y de calidad del aire de <span className="text-ink">Open-Meteo</span>
          . Las puntuaciones de actividades son una orientación práctica, no una recomendación
          médica ni deportiva.
        </p>
      </section>
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="border-hairline flex items-center justify-between gap-4 border-b py-4 last:border-b-0">
      <span className="text-[0.9375rem]">{label}</span>
      {/* A hairline track with a softly lit active segment. A solid white pill
          would be the brightest thing on the screen, in an interface where the
          brightest thing is supposed to be the sky. */}
      <div
        className="border-hairline flex gap-1 rounded-[var(--radius-pill)] border p-1"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className="pressable rounded-[var(--radius-pill)] px-3.5 py-1.5 text-[0.8125rem] whitespace-nowrap transition-colors"
              style={{
                background: active
                  ? 'color-mix(in oklab, var(--ink) 16%, transparent)'
                  : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-faint)',
                fontWeight: active ? 500 : 400,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  label,
  caption,
  value,
  onChange,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="border-hairline flex items-center justify-between gap-4 border-b py-4 last:border-b-0">
      <span>
        <span className="block text-[0.9375rem]">{label}</span>
        {caption && <span className="text-ink-faint block text-[0.8125rem]">{caption}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className="pressable border-hairline relative h-7 w-12 shrink-0 rounded-[var(--radius-pill)] border transition-colors"
        style={{
          background: value ? 'color-mix(in oklab, var(--accent) 38%, transparent)' : 'transparent',
        }}
      >
        <span
          className="absolute top-[3px] h-[1.125rem] w-[1.125rem] rounded-full transition-[left] duration-200"
          style={{
            left: value ? '1.5625rem' : '0.1875rem',
            background: value ? 'var(--ink)' : 'var(--ink-faint)',
          }}
        />
      </button>
    </div>
  );
}
