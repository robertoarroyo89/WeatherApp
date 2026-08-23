'use client';

import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';
import { formatTime } from '@/lib/format';

/**
 * Quiet notices: offline, stale data, a failed refresh.
 *
 * Never an empty error screen. If there is cached weather it stays on screen and
 * this strip explains itself in one line, because "showing you the forecast from
 * 15:42" is far more useful than "something went wrong".
 */
export function StatusBanner({ onRetry }: { onRetry: () => void }) {
  const { error, online, stale, lastUpdated, bundle, status } = useWeather();

  const timezone = bundle?.timezone ?? 'Europe/Madrid';
  const offline = !online;
  const showStale = stale && !error && lastUpdated !== null;

  if (!error && !offline && !showStale) return null;

  const message = offline
    ? lastUpdated !== null
      ? `Sin conexión. Datos de las ${formatTime(lastUpdated, timezone)}.`
      : 'Sin conexión.'
    : error
      ? error.message
      : `Datos de las ${formatTime(lastUpdated as number, timezone)}.`;

  const canRetry = Boolean(error) && online && status !== 'refreshing';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-[var(--gutter)]"
      style={{ top: 'calc(max(env(safe-area-inset-top), 0.75rem) + 2.75rem)' }}
    >
      <div className="material pointer-events-auto flex max-w-full items-center gap-2.5 rounded-[var(--radius-pill)] py-2 pr-2 pl-3.5">
        <Icon
          name={offline ? 'offline' : error ? 'alert' : 'clock'}
          size={15}
          className="text-ink-faint shrink-0"
        />
        <span className="text-ink-muted truncate text-[0.8125rem]">{message}</span>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="pressable shrink-0 rounded-[var(--radius-pill)] px-3 py-1 text-[0.8125rem] font-medium"
            style={{ background: 'var(--hairline)' }}
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
