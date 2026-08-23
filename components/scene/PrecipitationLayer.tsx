'use client';

import { useEffect, useRef } from 'react';
import { useScene } from '@/components/SceneProvider';
import { usePageVisible } from '@/lib/hooks/useEnvironment';
import { useLatest } from '@/lib/hooks/useLatest';
import { createField, drawPrecipitation } from '@/lib/weather/precipitation';
import { MOISTURE } from './textures';

/**
 * Rain and snow, on one canvas.
 *
 * This component owns only the canvas lifecycle — sizing, the frame loop, and
 * knowing when to stop. The simulation itself lives in
 * `lib/weather/precipitation.ts` where it can be tested.
 *
 * The loop reads its intensity from a ref, so the rain can thicken as the
 * scrubber moves through the afternoon without ever restarting. It does not run
 * at all when the page is hidden, when motion is reduced, or when there is
 * nothing falling.
 */
export function PrecipitationLayer() {
  const { scene, motionEnabled, tier } = useScene();
  const visible = usePageVisible();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paramsRef = useLatest({
    rain: scene.rainIntensity,
    snow: scene.snowIntensity,
    wind: scene.windSpeed,
  });

  const falling = scene.rainIntensity > 0.01 || scene.snowIntensity > 0.01;
  const active = motionEnabled && visible && falling;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const budget = tier === 'low' ? { rain: 150, snow: 90 } : { rain: 320, snow: 190 };
    const size = { width: 1, height: 1 };
    let field = createField(size, budget);

    const resize = () => {
      // Capping the pixel ratio matters: a 3x iPhone canvas is nine times the
      // fill cost of a 1x one, for no perceptible gain on thin rain streaks.
      const ratio = Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1.5 : 2);
      size.width = canvas.clientWidth || window.innerWidth;
      size.height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(size.width * ratio));
      canvas.height = Math.max(1, Math.floor(size.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      field = createField(size, budget);
    };

    resize();

    let frame = 0;
    let previous = performance.now();

    const render = (timestamp: number) => {
      // Clamped so returning from a stall does not teleport every particle.
      const delta = Math.min(0.05, (timestamp - previous) / 1000);
      previous = timestamp;
      drawPrecipitation(context, field, size, {
        ...paramsRef.current,
        delta,
        elapsed: timestamp / 1000,
      });
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [active, tier, paramsRef]);

  return (
    <>
      {active && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />}
      {scene.rainIntensity > 0.55 && <GlassMoisture intensity={scene.rainIntensity} />}
    </>
  );
}

/**
 * Water on the glass during heavy rain.
 *
 * Confined to the edges of the frame and capped well below the point where it
 * would compete with text — the effect is meant to be felt at the periphery, not
 * read through.
 */
function GlassMoisture({ intensity }: { intensity: number }) {
  const opacity = Math.min(0.16, (intensity - 0.55) * 0.36);
  return (
    <div
      className="absolute inset-0"
      aria-hidden
      style={{
        backgroundImage: MOISTURE,
        backgroundRepeat: 'repeat',
        backgroundSize: '340px 340px',
        opacity,
        mixBlendMode: 'soft-light',
        maskImage: 'radial-gradient(120% 100% at 50% 50%, transparent 34%, #000 100%)',
        WebkitMaskImage: 'radial-gradient(120% 100% at 50% 50%, transparent 34%, #000 100%)',
      }}
    />
  );
}
