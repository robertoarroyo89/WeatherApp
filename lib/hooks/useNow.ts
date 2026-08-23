'use client';

import { useSyncExternalStore } from 'react';

/**
 * A single shared clock.
 *
 * One interval for the whole application, ticking only while the page is
 * visible and re-syncing the instant it comes back — which matters on iPhone,
 * where an installed PWA can sit suspended for hours and would otherwise wake up
 * showing yesterday's sky.
 *
 * Exposed through `useSyncExternalStore`, so the snapshot is stable within a
 * render pass and the server sees a deterministic zero.
 */

const TICK_MS = 30_000;

let value = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function tick() {
  value = Date.now();
  notify();
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') tick();
}

function start() {
  // Seeding here rather than notifying: React re-reads the snapshot immediately
  // after subscribing, so the first real time arrives without an extra render.
  value = Date.now();
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') tick();
  }, TICK_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/**
 * Current time, to the nearest half minute.
 *
 * Returns 0 before hydration. Callers render the neutral sky until it is real,
 * which is also the loading state, so nothing is wasted.
 */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => 0,
  );
}
