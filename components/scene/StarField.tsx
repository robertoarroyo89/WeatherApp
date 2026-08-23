'use client';

import { useMemo } from 'react';
import { useScene } from '@/components/SceneProvider';

/** Deterministic PRNG so the sky is identical on the server and the client. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  /** Position as a percentage of the viewport. */
  x: number;
  y: number;
  /** Diameter in pixels. */
  size: number;
  opacity: number;
  /** Only the brightest few twinkle; the rest are static. */
  duration: number | null;
  delay: number;
}

const STAR_COUNT = 62;
const TWINKLING = 16;

function buildStars(): Star[] {
  const random = mulberry32(20260823);
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    // Biased upward: stars thin out toward the horizon haze, as they do in life.
    const y = Math.pow(random(), 1.7) * 76;
    const bright = random();
    const twinkles = i < TWINKLING;
    stars.push({
      x: random() * 100,
      y,
      // Pixels, not viewBox units: a percentage-scaled circle in a stretched SVG
      // becomes a large ellipse, which is exactly what a star must never be.
      size: Number((0.9 + bright * bright * 1.7).toFixed(2)),
      opacity: Number((0.28 + bright * 0.62).toFixed(2)),
      duration: twinkles ? Number((3.5 + random() * 6).toFixed(2)) : null,
      delay: Number((random() * 8).toFixed(2)),
    });
  }
  return stars;
}

/**
 * A restrained star field.
 *
 * Plain absolutely-positioned dots: percentage positions, pixel diameters, so
 * they stay round at every aspect ratio. Only the brightest sixteen are
 * animated — sixty-odd independently animating layers is a real cost on a phone,
 * and nobody has ever noticed a faint star holding still.
 */
export function StarField() {
  const { motionEnabled } = useScene();
  const stars = useMemo(() => buildStars(), []);

  return (
    <div className="absolute inset-0" style={{ opacity: 'var(--stars)' }} aria-hidden>
      {stars.map((star, index) => (
        <span
          key={index}
          data-scene-motion={motionEnabled && star.duration ? '' : undefined}
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: '50%',
            background: '#fdfdff',
            opacity: star.opacity,
            boxShadow: star.size > 2 ? '0 0 3px rgb(253 253 255 / 0.55)' : undefined,
            animation:
              motionEnabled && star.duration
                ? `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`
                : undefined,
          }}
        />
      ))}
    </div>
  );
}
