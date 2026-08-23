'use client';

import { useWeather } from '@/lib/hooks/useWeather';
import { Icon } from '@/components/ui/Icon';
import { formatTime } from '@/lib/format';
import { NAV_ITEMS, type ViewName } from './navItems';

/**
 * The only persistent chrome above the fold: where you are, what time it is
 * there, and how to change it.
 *
 * A floating strip on the phone, matching the tab bar, so neither end of the
 * screen has a bar with dead space under it. On a wide screen it flattens into a
 * conventional header — a narrow capsule adrift in 1400 px of sky looks lost —
 * and picks up the section navigation, which is why the bottom bar disappears
 * there.
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
  // Valencia, this is the only thing that says it is the middle of the night
  // there.
  const localTime = bundle && nowTs ? formatTime(nowTs, bundle.timezone) : null;

  return (
    <header className="fixed inset-x-0 top-0 z-30">
      {/* Wide-screen backdrop only: a whisper of gradient over the hero, and a
          pre-blurred material that fades in as the page scrolls. Cross-fading
          opacity on a composited layer is free; animating a filter is not. */}
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        aria-hidden
        style={{ background: 'linear-gradient(to bottom, rgb(4 8 14 / 0.34), transparent)' }}
      />
      <div
        className="border-hairline pointer-events-none absolute inset-0 hidden border-b lg:block"
        aria-hidden
        style={{
          background: 'color-mix(in oklab, var(--sky-zenith) 88%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          opacity: 'calc(var(--scroll) * 2.4)',
        }}
      />

      <div
        className="gutter relative mx-auto flex w-full max-w-[88rem] justify-center lg:px-8"
        style={{ paddingTop: 'calc(var(--safe-top) + var(--nav-gap))' }}
      >
        <div className="floating-bar floating-bar--flat flex h-[var(--nav-height)] w-full max-w-sm items-center justify-between px-2.5 lg:h-auto lg:max-w-none lg:px-0 lg:pb-2">
          <button
            type="button"
            onClick={onOpenLocations}
            className="pressable flex h-full items-center gap-2 px-1"
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
              className="pressable text-ink-muted grid h-10 w-10 place-items-center lg:h-11 lg:w-11"
              aria-label="Buscar una ciudad"
            >
              <Icon name="search" size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
