/**
 * Atmospheric depth: the haze veil for poor visibility and fog, the glow of a
 * town on the underside of the night sky, and a corner vignette that keeps the
 * frame cinematic rather than flat.
 */
export function AtmosphericHaze() {
  return (
    <>
      {/* Haze. Strongest at the horizon, thinning upward. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, color-mix(in oklab, var(--sky-haze) 40%, transparent) 46%, color-mix(in oklab, var(--sky-haze) 78%, transparent) 100%)',
          opacity: 'var(--haze-strength)',
        }}
      />
      {/* Ground light bouncing back up at night. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[36%]"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 130%, color-mix(in oklab, var(--sky-horizon-glow) 70%, transparent) 0%, transparent 70%)',
          opacity: 'var(--horizon-glow-strength)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Vignette. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 42%, transparent 42%, rgb(2 5 10 / 0.34) 100%)',
        }}
      />
    </>
  );
}
