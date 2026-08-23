'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Icon } from './Icon';

/**
 * Bottom sheet.
 *
 * Animated entirely in CSS (see `.sheet-surface`), and permanently mounted so
 * there is no presence state machine to get stuck in. Four details decide
 * whether it feels native, and each of them was a bug first:
 *
 *  - The transition is CSS, not a JavaScript loop. A stalled frameloop used to
 *    leave the panel off-screen behind an invisible, tap-eating backdrop.
 *  - The scrolling region needs `min-h-0`. A `flex-1` child will not shrink
 *    below its content, so without it everything past the fold is silently
 *    clipped and nothing scrolls.
 *  - Drag-to-dismiss starts only on the header. Armed on the whole sheet it
 *    swallows every attempt to scroll the content on a touch screen.
 *  - Closed, the sheet is `inert` and hidden, so its contents cannot be tabbed
 *    into or read out from underneath the page.
 */

/** Drag distance, in px, that counts as a dismiss. */
const DISMISS_DISTANCE = 110;
/** Flick speed, in px/ms, that counts as a dismiss regardless of distance. */
const DISMISS_VELOCITY = 0.9;

interface DragState {
  startY: number;
  offset: number;
  lastY: number;
  lastAt: number;
  velocity: number;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Occupy nearly the whole screen, for content-heavy panels. */
  full?: boolean;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Move focus into the sheet once it has arrived, so a keyboard or screen
  // reader user is not left behind on the page underneath.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => closeRef.current?.focus(), 420);
    return () => clearTimeout(timer);
  }, [open]);

  const onHandleDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    // Desktop shows a centred dialog; there is no bottom edge to drag it off.
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the drag still works without capture */
    }
    dragRef.current = {
      startY: event.clientY,
      offset: 0,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      velocity: 0,
    };
    surface.dataset.dragging = 'true';
  }, []);

  const onHandleMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || !surface) return;
    // Downwards only: dragging a sheet up past its own top edge is meaningless.
    drag.offset = Math.max(0, event.clientY - drag.startY);
    const elapsed = event.timeStamp - drag.lastAt;
    if (elapsed > 8) {
      drag.velocity = (event.clientY - drag.lastY) / elapsed;
      drag.lastY = event.clientY;
      drag.lastAt = event.timeStamp;
    }
    surface.style.setProperty('--drag-y', `${drag.offset}px`);
  }, []);

  const onHandleUp = useCallback(() => {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    dragRef.current = null;
    if (!surface) return;
    delete surface.dataset.dragging;
    // Handing the offset back to its default lets CSS either settle the sheet
    // home or, if we are closing, carry it straight out of the frame.
    surface.style.removeProperty('--drag-y');
    if (!drag) return;
    if (drag.offset > DISMISS_DISTANCE || drag.velocity > DISMISS_VELOCITY) onClose();
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar"
        className="sheet-backdrop"
        data-open={open ? 'true' : 'false'}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <div
        ref={surfaceRef}
        className="sheet-surface"
        data-open={open ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
      >
        <div
          className="panel flex flex-col overflow-hidden rounded-t-[1.75rem]"
          style={{ maxHeight: full ? '94dvh' : '84dvh' }}
        >
          {/* The handle: the only place the dismiss gesture starts. */}
          <div
            className="sheet-handle shrink-0 cursor-grab pt-3 active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          >
            <div
              className="mx-auto h-1 w-10 rounded-full"
              style={{ background: 'var(--hairline)' }}
              aria-hidden
            />
            <div className="gutter flex items-center justify-between pt-3 pb-2">
              <h2 className="eyebrow">{title}</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="pressable text-ink-muted -mr-2 grid h-11 w-11 place-items-center"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {/* `min-h-0` is what makes this actually scroll. */}
          <div className="scroll-y min-h-0 flex-1 pb-[calc(var(--safe-bottom)+0.5rem)]">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
