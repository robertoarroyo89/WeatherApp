'use client';

import { useScene } from '@/components/SceneProvider';
import { clamp } from '@/lib/weather/solar';
import { CLOUD_FAR, CLOUD_MID, CLOUD_NEAR } from './textures';

/**
 * Three drifting cloud bands.
 *
 * Each band is a palette gradient masked by a seamless turbulence field, twice
 * the width of the viewport, translated by exactly one mask tile — so the loop
 * is invisible and the animation is a single compositor transform, never a
 * repaint. Wind speed scales the drift; the slowest band takes over eight
 * minutes to cross, slow enough that you read depth rather than movement.
 *
 * Each band sits inside a wrapper carrying a vertical gradient mask. Without it
 * the band's own bottom edge cuts the cloud off in a dead straight line across
 * the sky, which is instantly readable as a bug.
 */

interface BandConfig {
  texture: string;
  /** Vertical placement as a percentage of the viewport. */
  top: number;
  height: number;
  /** Mask tile width as a percentage of the 200 %-wide band. Must divide 25. */
  tile: number;
  /** Seconds for one tile of travel in calm air. */
  baseDuration: number;
  /** Multiplier on the palette's cloud opacity. */
  weight: number;
  blur: number;
  /** Parallax factor against scroll. */
  parallax: number;
  /** Vertical fade: opaque between these two stops. */
  fade: [number, number];
  reverse?: boolean;
}

const BANDS: BandConfig[] = [
  {
    texture: CLOUD_FAR,
    top: -6,
    height: 44,
    tile: 12.5,
    baseDuration: 480,
    weight: 0.46,
    blur: 0,
    parallax: 2,
    fade: [18, 74],
  },
  {
    texture: CLOUD_MID,
    top: 4,
    height: 44,
    tile: 25,
    baseDuration: 300,
    weight: 0.74,
    blur: 1.5,
    parallax: 4,
    fade: [14, 70],
  },
  {
    texture: CLOUD_NEAR,
    top: 16,
    height: 42,
    tile: 25,
    baseDuration: 180,
    weight: 1,
    blur: 4,
    parallax: 7,
    fade: [10, 66],
    reverse: true,
  },
];

export function CloudLayer() {
  const { scene, motionEnabled } = useScene();
  // Calm air still drifts a little; a gale roughly triples the speed.
  const windFactor = clamp(0.55 + scene.windSpeed / 34, 0.55, 3.2);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden
      style={{ opacity: 'calc(1 - var(--scroll) * 0.28)' }}
    >
      {BANDS.map((band, index) => {
        const fade = `linear-gradient(to bottom, transparent 0%, #000 ${band.fade[0]}%, #000 ${band.fade[1]}%, transparent 100%)`;
        return (
          <div
            key={index}
            className="absolute inset-x-0"
            style={{
              top: `${band.top}%`,
              height: `${band.height}%`,
              transform: `translate3d(0, calc(var(--scroll) * -${band.parallax}%), 0)`,
              maskImage: fade,
              WebkitMaskImage: fade,
            }}
          >
            <div
              data-scene-motion={motionEnabled ? '' : undefined}
              style={{
                position: 'absolute',
                left: '-50%',
                width: '200%',
                top: 0,
                bottom: 0,
                background:
                  'linear-gradient(to bottom, var(--sky-cloud-light) 0%, color-mix(in oklab, var(--sky-cloud-light) 58%, var(--sky-cloud-dark)) 54%, var(--sky-cloud-dark) 100%)',
                maskImage: band.texture,
                WebkitMaskImage: band.texture,
                maskSize: `${band.tile}% 100%`,
                WebkitMaskSize: `${band.tile}% 100%`,
                maskRepeat: 'repeat',
                WebkitMaskRepeat: 'repeat',
                opacity: `calc(var(--cloud-opacity) * ${band.weight})`,
                filter: band.blur ? `blur(${band.blur}px)` : undefined,
                willChange: motionEnabled ? 'transform' : undefined,
                animation: motionEnabled
                  ? `cloud-drift ${band.baseDuration / windFactor}s linear infinite${band.reverse ? ' reverse' : ''}`
                  : undefined,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
