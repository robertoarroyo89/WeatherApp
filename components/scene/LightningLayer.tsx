'use client';

import { useEffect, useRef } from 'react';
import { useScene } from '@/components/SceneProvider';
import { usePageVisible } from '@/lib/hooks/useEnvironment';

/**
 * Distant lightning.
 *
 * Rare (nine to twenty-six seconds apart), brief, and it lights the whole sky
 * rather than drawing a bolt — the point is ambient illumination, not a graphic.
 * It stops completely when the page is hidden or motion is reduced, which also
 * keeps it clear of photosensitivity concerns.
 */
export function LightningLayer() {
  const { scene, motionEnabled } = useScene();
  const visible = usePageVisible();
  const layerRef = useRef<HTMLDivElement>(null);

  const active = scene.isStorm && motionEnabled && visible;

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const flash = () => {
      if (cancelled) return;
      const element = layerRef.current;
      if (element?.animate) {
        element.animate(
          [
            { opacity: 0 },
            { opacity: 0.5, offset: 0.05 },
            { opacity: 0.04, offset: 0.13 },
            { opacity: 0.34, offset: 0.2 },
            { opacity: 0.02, offset: 0.32 },
            { opacity: 0.16, offset: 0.48 },
            { opacity: 0 },
          ],
          { duration: 1100, easing: 'linear' },
        );
      }
      schedule();
    };

    const schedule = () => {
      timer = setTimeout(flash, 9_000 + Math.random() * 17_000);
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={layerRef}
      className="absolute inset-0"
      aria-hidden
      style={{
        opacity: 0,
        background:
          'radial-gradient(130% 70% at 62% 8%, color-mix(in oklab, var(--sky-cloud-light) 92%, #fff) 0%, transparent 62%)',
        mixBlendMode: 'screen',
      }}
    />
  );
}
