'use client';

import { useEffect, useState } from 'react';

/**
 * Publishes a scroll container's progress as the `--scroll` custom property.
 *
 * One rAF-throttled listener writing one CSS variable drives every scroll-linked
 * effect in the app — hero parallax, cloud drift offset, scrim strength, the top
 * bar's material — with no React re-render involved.
 *
 * Returns a *callback ref* rather than taking a `RefObject`. That matters: the
 * scroll container mounts after the first render (the app renders nothing until
 * the store has hydrated), and an effect keyed on a ref object would have run
 * once against `null` and never run again.
 */
export function useScrollProgress(distance = 340): {
  ref: (node: HTMLElement | null) => void;
  node: HTMLElement | null;
} {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node) return;
    let frame = 0;

    const write = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, node.scrollTop / distance));
      document.documentElement.style.setProperty('--scroll', progress.toFixed(4));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    write();
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      document.documentElement.style.setProperty('--scroll', '0');
    };
  }, [node, distance]);

  return { ref: setNode, node };
}
