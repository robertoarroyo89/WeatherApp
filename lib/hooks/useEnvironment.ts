'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Device and user-preference signals.
 *
 * All of these are external systems — a media query, the network stack, the
 * visibility API — so they are read with `useSyncExternalStore` rather than
 * mirrored into state inside an effect. That keeps them server-renderable and
 * avoids a render-then-correct flash on every mount.
 */

/** Static device facts need a subscription that never fires. */
const NEVER: () => () => void = () => () => {};

function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** False whenever the document is hidden, so animation loops can stand down. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true,
  );
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true,
  );
}

export type PerformanceTier = 'high' | 'low';

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

/**
 * Coarse capability guess, used only to size particle counts and canvas density.
 *
 * Deliberately crude: a wrong guess costs a slightly thinner rain shower, and
 * anything more elaborate (frame-rate probing) would itself cost frames.
 */
function detectTier(): PerformanceTier {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as NavigatorWithMemory).deviceMemory ?? 4;
  const dense = window.devicePixelRatio > 2.5;
  return cores <= 4 || memory <= 2 || (cores <= 6 && dense) ? 'low' : 'high';
}

export function usePerformanceTier(): PerformanceTier {
  return useSyncExternalStore(NEVER, detectTier, (): PerformanceTier => 'high');
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function detectStandalone(): boolean {
  const iosStandalone = (navigator as NavigatorWithStandalone).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

/** True when running as an installed PWA rather than in a browser tab. */
export function useStandalone(): boolean {
  return useSyncExternalStore(NEVER, detectStandalone, () => false);
}

function detectIos(): boolean {
  const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iPadOS reports itself as a Mac; the touch point count gives it away.
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIosDevice || isIpadOs;
}

/** True on an iOS device, where installing means "Añadir a pantalla de inicio". */
export function useIsIos(): boolean {
  return useSyncExternalStore(NEVER, detectIos, () => false);
}
