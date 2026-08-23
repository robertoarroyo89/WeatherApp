'use client';

import { NAV_ITEMS, type ViewName } from './navItems';

export type { ViewName };

/**
 * Navigation.
 *
 * A floating strip rather than a bar welded to the bottom edge. That is not a
 * style choice: iOS reserves about 34 px at the bottom for the home indicator,
 * and an edge-anchored bar has to leave it empty, which reads as a hollow gap
 * under the labels no matter where the padding sits. Floating puts that space
 * *outside* the bar, where it is simply background.
 *
 * Centred labels in tracked mono caps, hairline dividers between the cells, the
 * active one marked by a small square above it. A soft rectangle rather than a
 * capsule — the vocabulary of print, not of a system control.
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
    <nav
      className="gutter fixed inset-x-0 z-30 flex justify-center lg:hidden"
      style={{ bottom: 'calc(var(--safe-bottom) + var(--nav-gap))' }}
      aria-label="Secciones"
    >
      <ul className="floating-bar flex h-[var(--nav-height)] w-full max-w-sm overflow-hidden">
        {NAV_ITEMS.map((item, index) => {
          const active = item.id === 'more' ? moreOpen : view === item.id;
          return (
            <li
              key={item.id}
              className="flex-1"
              style={{ borderLeft: index > 0 ? '1px solid var(--hairline)' : undefined }}
            >
              <button
                type="button"
                onClick={() => (item.id === 'more' ? onMore() : onSelect(item.id))}
                aria-current={active ? 'page' : undefined}
                className="pressable relative flex h-full w-full items-center justify-center"
              >
                {/* Absolutely positioned so the label stays truly centred rather
                    than being nudged sideways by a marker. */}
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
    </nav>
  );
}
