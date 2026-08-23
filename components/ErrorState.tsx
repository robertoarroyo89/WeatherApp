'use client';

import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';

/**
 * The only screen with nothing to show.
 *
 * Reached when there is no cached forecast *and* the request failed — a first
 * run with no connection, essentially. Anything less than that keeps the last
 * forecast on screen with a quiet notice instead (see `StatusBanner`), because
 * a two-hour-old temperature is far more use than an apology.
 *
 * It offers a way out as well as a retry: if the network is fine and one
 * location is simply not resolving, picking another one should not require
 * restarting the app.
 */
export function ErrorState({ onChooseLocation }: { onChooseLocation: () => void }) {
  const { error, refresh, status, online } = useWeather();
  const retrying = status === 'loading' || status === 'refreshing';

  return (
    <div className="safe-top relative z-10 flex min-h-dvh flex-col justify-end pb-12">
      <div className="gutter rise-in max-w-[26rem]">
        <Icon name={online ? 'alert' : 'offline'} size={22} className="text-ink-faint" />

        <h1 className="legible display-lg mt-6">
          {online ? 'No hemos podido cargar el tiempo.' : 'Parece que no hay conexión.'}
        </h1>

        <p className="legible prose-summary text-ink-muted mt-4">
          {error?.message ??
            (online
              ? 'El servicio no responde ahora mismo. Vuelve a intentarlo en un momento.'
              : 'Conéctate a una red y lo cargamos al instante.')}
        </p>

        <div className="mt-9 space-y-3">
          <button
            type="button"
            onClick={() => refresh({ force: true })}
            disabled={retrying}
            className="pressable flex min-h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] text-[1rem] font-medium disabled:opacity-60"
            style={{ background: 'var(--ink)', color: 'rgb(8 12 18)' }}
          >
            <Icon name="refresh" size={17} strokeWidth={1.6} />
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </button>
          <button
            type="button"
            onClick={onChooseLocation}
            className="pressable material flex min-h-[3.25rem] w-full items-center justify-center rounded-[var(--radius-pill)] text-[1rem]"
          >
            Elegir otra ciudad
          </button>
        </div>
      </div>
    </div>
  );
}
