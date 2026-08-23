'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * A ref that always holds the newest value.
 *
 * Lets a long-lived animation loop read fresh parameters without being torn down
 * and restarted: the rain can thicken as the scrubber moves through the
 * afternoon while the same `requestAnimationFrame` loop keeps running.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
