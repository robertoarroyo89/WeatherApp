import { GRAIN } from './textures';

/**
 * Film grain.
 *
 * Static, 200 px tile, 5 % over `overlay`. It costs one composited layer and it
 * is the difference between "a gradient" and "a photograph of a sky".
 */
export function GrainOverlay() {
  return (
    <div
      className="absolute inset-0"
      aria-hidden
      style={{
        backgroundImage: GRAIN,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 200px',
        opacity: 0.05,
        mixBlendMode: 'overlay',
      }}
    />
  );
}
