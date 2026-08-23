/**
 * The base sky.
 *
 * Four interpolated bands plus a lateral wash that brightens the side the sun
 * is on, so the sky is never a flat vertical ramp.
 */
export function SkyGradient() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, var(--sky-zenith) 0%, var(--sky-upper) 34%, var(--sky-mid) 68%, var(--sky-horizon) 100%)',
        }}
      />
      {/* Light spilling sideways from the sun's position. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(135% 85% at calc(var(--sun-x) * 100%) 108%, color-mix(in oklab, var(--sky-sun) 30%, transparent) 0%, transparent 62%)',
          opacity: 'calc(var(--glow) * 0.7)',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
