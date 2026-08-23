'use client';

import { useState } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';
import { LocationSearch } from '@/components/location/LocationSearch';

/**
 * First run.
 *
 * The browser's permission prompt is never triggered on load. This screen
 * explains what the position is for and offers an equally prominent way to skip
 * it — a denied permission is permanent, and an app that has to be reinstalled
 * to recover from one is a badly built app.
 */
export function LocationOnboarding() {
  const { requestLocation, locating, error, selectLocation, updatePreferences } = useWeather();
  const [searching, setSearching] = useState(false);

  if (searching) {
    return (
      <div className="safe-top relative z-10 flex min-h-dvh flex-col">
        <div className="gutter flex items-center justify-between pb-4">
          <h1 className="eyebrow">Elegir ciudad</h1>
          <button
            type="button"
            onClick={() => setSearching(false)}
            className="pressable text-ink-muted -mr-2 grid h-11 w-11 place-items-center"
            aria-label="Volver"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex-1">
          <LocationSearch
            autoFocus
            onSelect={(location) => {
              updatePreferences({ onboarded: true });
              selectLocation(location);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="safe-top relative z-10 flex min-h-dvh flex-col justify-end pb-10">
      <div className="gutter rise-in">
        <h1 className="legible display-lg max-w-[18rem]">
          El tiempo justo
          <br />
          donde estás.
        </h1>
        <p className="legible prose-summary text-ink-muted mt-5 max-w-[22rem]">
          Permite tu ubicación y te mostramos el tiempo de tu zona automáticamente. Si prefieres,
          elige una ciudad a mano.
        </p>

        {error && (
          <p className="text-ink mt-5 flex items-start gap-2 text-[0.875rem]">
            <Icon name="alert" size={16} className="text-ink-faint mt-0.5 shrink-0" />
            <span>{error.message}</span>
          </p>
        )}

        <div className="mt-9 space-y-3">
          <button
            type="button"
            onClick={() => void requestLocation()}
            disabled={locating}
            className="pressable flex min-h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] text-[1rem] font-medium disabled:opacity-60"
            style={{ background: 'var(--ink)', color: 'rgb(8 12 18)' }}
          >
            <Icon name="locate" size={17} strokeWidth={1.6} />
            {locating ? 'Buscando…' : 'Usar mi ubicación'}
          </button>
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="pressable material flex min-h-[3.25rem] w-full items-center justify-center rounded-[var(--radius-pill)] text-[1rem]"
          >
            Elegir ciudad
          </button>
        </div>

        <p className="text-ink-faint mt-6 text-[0.75rem] leading-relaxed">
          Tu ubicación se guarda solo en este dispositivo. Se envían unas coordenadas redondeadas al
          servicio meteorológico para obtener la previsión, nada más.
        </p>
      </div>
    </div>
  );
}
