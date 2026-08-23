'use client';

import { NAV_ITEMS, type ViewName } from './navItems';

export type { ViewName };

/**
 * Navigation.
 *
 * Sits on the bottom edge, with its background running all the way to it — the
 * one arrangement that leaves nothing hollow underneath. The labels are inset by
 * less than the full home-indicator reserve: the indicator is a small pill very
 * close to the edge, and holding back all 34 px for it leaves the labels
 * stranded high up the bar with a dead band beneath them.
 *
 * Centred labels in tracked mono caps, hairline dividers running the bar's full
 * height, the active one marked by a small square above it.
 */
export function BottomNav({
  view,
  onSelect,
  onMore,
  moreOpen,
}: {
  view: ViewName;
  onSelect: (view: ViewName) => void;
  onMore: () => void;
  moreOpen: boolean;
}) {
  return (
    <nav className="bar-material fixed inset-x-0 bottom-0 z-30 lg:hidden" aria-label="Secciones">
      <div className="border-hairline border-t">
        <ul className="mx-auto flex max-w-lg">
          {NAV_ITEMS.map((item, index) => {
            const active = item.id === 'more' ? moreOpen : view === item.id;
            return (
              <li
                key={item.id}
                className="flex-1"
                style={{
                  borderLeft: index > 0 ? '1px solid var(--hairline)' : undefined,
                  // On the cell, not the bar, so the dividers reach the screen
                  // edge instead of stopping short and exposing a hollow strip.
                  paddingBottom: 'var(--nav-inset)',
                }}
              >
                <button
                  type="button"
                  onClick={() => (item.id === 'more' ? onMore() : onSelect(item.id))}
                  aria-current={active ? 'page' : undefined}
                  className="pressable relative flex h-[var(--nav-height)] w-full items-center justify-center"
                >
                  {/* Absolutely positioned so the label stays truly centred
                      rather than being nudged sideways by a marker. */}
                  <span
                    className="absolute top-[0.5rem] left-1/2 h-[3px] w-[3px] -translate-x-1/2 transition-opacity duration-200"
                    style={{ background: 'var(--accent)', opacity: active ? 1 : 0 }}
                    aria-hidden
                  />
                  <span
                    className="[font-family:var(--font-mono)] text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-200"
                    style={{
                      color: active ? 'var(--ink)' : 'var(--ink-faint)',
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
