'use client';

import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';
import { formatTime } from '@/lib/format';

/** Provenance and a manual refresh, kept out of the way at the very bottom. */
export function AppFooter({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { lastUpdated, bundle, refresh, status } = useWeather();
  const timezone = bundle?.timezone ?? 'Europe/Madrid';

  return (
    <footer className="gutter mt-14 pb-10">
      <div className="border-hairline flex items-center justify-between gap-4 border-t pt-4">
        <p className="text-ink-faint text-[0.75rem]">
          {lastUpdated !== null
            ? `Actualizado a las ${formatTime(lastUpdated, timezone)}`
            : 'Sin datos todavía'}
          <span aria-hidden> · </span>
          Datos de Open-Meteo
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => refresh({ force: true })}
            aria-label="Actualizar el tiempo"
            className="pressable text-ink-faint grid h-10 w-10 place-items-center"
          >
            <Icon
              name="refresh"
              size={16}
              className={status === 'refreshing' ? 'animate-spin' : undefined}
            />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Ajustes"
            className="pressable text-ink-faint grid h-10 w-10 place-items-center"
          >
            <Icon name="settings" size={16} />
          </button>
        </div>
      </div>
    </footer>
  );
}
