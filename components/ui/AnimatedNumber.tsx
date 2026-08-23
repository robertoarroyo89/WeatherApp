'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/useEnvironment';

/**
 * A number that eases to its new value instead of snapping.
 *
 * Written straight to the DOM node rather than through React state: the whole
 * point is a smooth 29° -> 28°, and re-rendering a component sixty times a
 * second to achieve it would be absurd. Under `prefers-reduced-motion`, or while
 * the scrubber is being dragged, it updates instantly.
 */
export function AnimatedNumber({
  value,
  digits = 0,
  suffix = '',
  immediate = false,
  className,
  duration = 620,
}: {
  value: number;
  digits?: number;
  suffix?: string;
  /** Skip the animation — used while scrubbing, where the drag *is* the motion. */
  immediate?: boolean;
  className?: string;
  duration?: number;
}) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const displayedRef = useRef(value);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const format = (input: number) =>
      digits > 0
        ? input.toLocaleString('es-ES', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          }) + suffix
        : String(Math.round(input)) + suffix;

    const from = displayedRef.current;
    if (immediate || reducedMotion || from === value) {
      displayedRef.current = value;
      node.textContent = format(value);
      return;
    }

    const startedAt = performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      // Matches --ease-out: fast start, long settle.
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (value - from) * eased;
      displayedRef.current = current;
      node.textContent = format(current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [value, digits, suffix, immediate, reducedMotion, duration]);

  const initial =
    digits > 0
      ? value.toLocaleString('es-ES', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }) + suffix
      : String(Math.round(value)) + suffix;

  return (
    <span ref={nodeRef} className={className}>
      {initial}
    </span>
  );
}
