'use client';

import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';
import { formatTime } from '@/lib/format';
import { NAV_ITEMS, type ViewName } from './navItems';

/**
 * The only persistent chrome above the fold: where you are, and how to change it.
 *
 * No background of its own — it floats on the sky, kept legible by the scrim.
 */
export function TopBar({
  onOpenLocations,
  onOpenSearch,
  view,
  onSelectView,
  onMore,
  moreOpen,
}: {
  onOpenLocations: () => void;
  onOpenSearch: () => void;
  view: ViewName;
  onSelectView: (view: ViewName) => void;
  onMore: () => void;
  moreOpen: boolean;
}) {
  const { location, stale, online, lastUpdated, bundle, nowTs } = useWeather();
  // The clock of the place being looked at, not the phone's. Reading Tokyo from
  // Valencia, this is the only thing that tells you it is the middle of the night
  // there.
  const localTime = bundle && nowTs ? formatTime(nowTs, bundle.timezone) : null;

  return (
    <header className="safe-top fixed inset-x-0 top-0 z-30">
      {/* Two stacked backgrounds rather than an animated filter: over the hero
          only a whisper of gradient, and as the page scrolls a pre-blurred
          material fades in underneath. Cross-fading opacity on a composited
          layer is free; animating backdrop-filter is not. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{ background: 'linear-gradient(to bottom, rgb(4 8 14 / 0.34), transparent)' }}
      />
      <div
        className="border-hairline pointer-events-none absolute inset-0 border-b"
        aria-hidden
        style={{
          background: 'color-mix(in oklab, var(--sky-zenith) 88%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          opacity: 'calc(var(--scroll) * 2.4)',
        }}
      />
      <div className="gutter relative mx-auto flex w-full max-w-[88rem] items-center justify-between pb-2 lg:px-8">
        <button
          type="button"
          onClick={onOpenLocations}
          className="pressable -ml-1 flex min-h-11 items-center gap-2 px-1"
          aria-label="Cambiar de ubicación"
        >
          <span className="eyebrow legible text-ink">{location?.name ?? 'Sin ubicación'}</span>
          <Icon name="chevron-down" size={13} className="text-ink-faint" />
          {localTime && (
            <>
              <span className="text-ink-faint" aria-hidden>
                ·
              </span>
              <span className="readout legible text-ink-muted text-[0.6875rem] tracking-[0.08em]">
                {localTime}
              </span>
            </>
          )}
          {(!online || stale) && lastUpdated !== null && (
            <span
              className="ml-0.5 h-[3px] w-[3px]"
              style={{ background: 'var(--accent)' }}
              aria-hidden
            />
          )}
        </button>

        <div className="flex items-center gap-1">
          {/* On a wide screen a bottom tab bar is out of place, so navigation
              moves up here and the bottom bar is hidden. */}
          <nav className="mr-2 hidden items-center gap-1 lg:flex" aria-label="Secciones">
            {NAV_ITEMS.map((item) => {
              const active = item.id === 'more' ? moreOpen : view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.id === 'more' ? onMore() : onSelectView(item.id))}
                  aria-current={active ? 'page' : undefined}
                  className="pressable px-3 py-2 [font-family:var(--font-mono)] text-[0.625rem] tracking-[0.16em] uppercase transition-colors"
                  style={{
                    color: active ? 'var(--ink)' : 'var(--ink-faint)',
                    fontWeight: active ? 500 : 400,
                    borderBottom: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onOpenSearch}
            className="pressable text-ink-muted -mr-2 grid h-11 w-11 place-items-center"
            aria-label="Buscar una ciudad"
          >
            <Icon name="search" size={19} />
          </button>
        </div>
      </div>
    </header>
  );
}
