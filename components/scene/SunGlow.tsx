'use client';

import { useScene } from '@/components/SceneProvider';

/**
 * The light source.
 *
 * Never an icon of a sun: a wide atmospheric bloom, a tighter inner glow, and a
 * small bright core that only appears when the sun is genuinely visible. Cloud
 * cover and rain have already dimmed `--glow` by the time it gets here, so an
 * overcast sky diffuses the light instead of hiding a sticker behind a cloud.
 */
export function SunGlow() {
  const { scene, motionEnabled } = useScene();
  const { elevation } = scene.sky;

  // Below the horizon there is no disc, only the glow it leaves in the sky — and
  // under a closed sky there is no disc either. Gating the core on actual cloud
  // cover as well as on the palette's glow is what stops a soft bright blob
  // hanging in the middle of a rainstorm.
  const openSky = Math.pow(Math.max(0, 1 - scene.cloudCover / 100), 1.2);
  const coreVisible = elevation > 1.5 && openSky > 0.06;
  const coreOpacity =
    Math.min(1, Math.max(0, (elevation - 1.5) / 8)) * scene.palette.glow * openSky;

  return (
    <div
      // On a wide screen the light source is confined to the left of the frame,
      // where the hero lives. Spread across 1400 px it would otherwise park
      // itself in the middle of the data column.
      className="absolute inset-y-0 left-0 w-full lg:w-[58%]"
      style={{
        transform: 'translate3d(0, calc(var(--scroll) * -3%), 0)',
        // The light is the point of the hero; over the data below it is only in
        // the way, so it recedes as you scroll into the numbers.
        opacity: 'calc((1 - var(--scroll) * 0.5) * (1 - var(--view-dim)))',
      }}
    >
      {/* Wide bloom: the sun lighting up the whole atmosphere. */}
      <div
        className="absolute"
        style={{
          left: 'calc(var(--sun-x) * 100%)',
          top: 'calc(var(--sun-y) * 100%)',
          width: '170vmax',
          height: '170vmax',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(closest-side, color-mix(in oklab, var(--sky-sun) 62%, transparent) 0%, color-mix(in oklab, var(--sky-sun) 20%, transparent) 30%, transparent 66%)',
          opacity: 'calc(var(--glow) * 0.8)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Inner glow. */}
      <div
        className="absolute"
        style={{
          left: 'calc(var(--sun-x) * 100%)',
          top: 'calc(var(--sun-y) * 100%)',
          width: '62vmax',
          height: '62vmax',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(closest-side, color-mix(in oklab, var(--sky-sun) 88%, transparent) 0%, color-mix(in oklab, var(--sky-sun) 32%, transparent) 30%, transparent 68%)',
          opacity: 'calc(var(--glow) * 0.85)',
          mixBlendMode: 'screen',
        }}
      />
      {/* The disc itself, softened so it reads as light rather than as a shape. */}
      {coreVisible && (
        <div
          className="absolute"
          data-scene-motion={motionEnabled ? '' : undefined}
          style={{
            left: 'calc(var(--sun-x) * 100%)',
            top: 'calc(var(--sun-y) * 100%)',
            width: '15vmax',
            height: '15vmax',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(closest-side, var(--sky-sun) 0%, var(--sky-sun) 26%, color-mix(in oklab, var(--sky-sun) 46%, transparent) 46%, transparent 74%)',
            opacity: coreOpacity,
            filter: 'blur(9px)',
            mixBlendMode: 'screen',
            animation: motionEnabled ? 'breathe 14s ease-in-out infinite' : undefined,
          }}
        />
      )}
    </div>
  );
}
