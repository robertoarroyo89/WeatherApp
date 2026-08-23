'use client';

import { useScene } from '@/components/SceneProvider';
import { clamp } from '@/lib/weather/solar';

const RAD = Math.PI / 180;

/**
 * The moon, drawn with its real phase.
 *
 * Position is the sun's reflection: opposite hour angle, and as high above the
 * horizon as the sun is below it. That is only exactly true at full moon, but it
 * puts the moon where the eye expects it — rising in the east after sunset,
 * setting in the west before dawn — which is what the scene needs.
 */
export function MoonDisc() {
  const { scene } = useScene();
  const { sky, moon, palette } = scene;

  const opacity = clamp(sky.night * 0.95 - palette.cloudOpacity * 0.85, 0, 0.95);
  if (opacity <= 0.02) return null;

  const oppositeAngle = sky.hourAngle + 180;
  const x = 0.5 + 0.4 * Math.sin(oppositeAngle * RAD);
  const climb = clamp(-sky.elevation / 68, -0.2, 1);
  const y = 0.86 - 0.68 * climb;

  // Waxing moons are lit on the right, waning on the left.
  const waxing = moon.phase < 0.5;
  const illumination = moon.illumination;
  // Offset of the shadow circle, in radii: 0 at full moon, 2 at new moon.
  const shadowOffset = (1 - illumination) * 2 * (waxing ? -1 : 1);

  return (
    // Same containing box as the sun, so both light sources stay on the hero
    // side of a wide layout.
    <div className="absolute inset-y-0 left-0 w-full lg:w-[58%]" aria-hidden>
      <div
        className="absolute"
        style={{
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: '13vmax',
          height: '13vmax',
          transform: 'translate(-50%, -50%)',
          opacity,
        }}
      >
        {/* Moonlight in the surrounding air. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(closest-side, color-mix(in oklab, var(--sky-sun) 34%, transparent) 0%, transparent 68%)',
            transform: 'scale(2.6)',
            mixBlendMode: 'screen',
          }}
        />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <mask id="moon-phase">
              <circle cx="50" cy="50" r="17" fill="#fff" />
              <circle cx={50 + shadowOffset * 17} cy="50" r="17" fill="#000" />
            </mask>
            <radialGradient id="moon-body" cx="42%" cy="38%" r="70%">
              <stop offset="0%" stopColor="var(--sky-sun)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--sky-sun)" stopOpacity="0.72" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="17" fill="url(#moon-body)" mask="url(#moon-phase)" />
        </svg>
      </div>
    </div>
  );
}
