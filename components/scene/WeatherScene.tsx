'use client';

import { AtmosphericHaze } from './AtmosphericHaze';
import { CloudLayer } from './CloudLayer';
import { GrainOverlay } from './GrainOverlay';
import { LightningLayer } from './LightningLayer';
import { MoonDisc } from './MoonDisc';
import { PrecipitationLayer } from './PrecipitationLayer';
import { SkyGradient } from './SkyGradient';
import { StarField } from './StarField';
import { SunGlow } from './SunGlow';

/**
 * The atmosphere.
 *
 * A fixed, non-interactive stack behind everything else. Layer order is the
 * physical one — sky, stars, light sources, cloud, haze, precipitation, then the
 * lens (grain, scrim) — because that is what makes cloud read as being *in
 * front of* the sun and rain as being in front of the cloud.
 *
 * It is mounted once, for the lifetime of the app, and every view scrolls over
 * the top of it. That continuity is the whole point: switching from "Ahora" to
 * "10 días" does not change the weather you are standing in.
 */
export function WeatherScene() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <SkyGradient />
      <StarField />
      <MoonDisc />
      <SunGlow />
      <CloudLayer />
      <AtmosphericHaze />
      <PrecipitationLayer />
      <LightningLayer />
      <GrainOverlay />
      <ReadabilityScrim />
    </div>
  );
}

/**
 * The one concession the atmosphere makes to the interface.
 *
 * Strength comes from the palette (a bright noon sky needs more help than a
 * clear night) and increases as the user scrolls into the data, so the sky is at
 * its most vivid exactly when there is least text over it.
 */
function ReadabilityScrim() {
  return (
    <>
      <div
        className="absolute inset-x-0 top-0 h-[42%]"
        style={{
          background: 'linear-gradient(to bottom, rgb(4 8 14 / 0.55), transparent)',
          opacity: 'calc(var(--scrim) * (0.55 + var(--scroll) * 0.45) + var(--view-dim) * 0.45)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[58%]"
        style={{
          background: 'linear-gradient(to top, rgb(4 8 14 / 0.72), transparent)',
          opacity: 'calc(var(--scrim) * (0.6 + var(--scroll) * 0.6) + var(--view-dim) * 0.4)',
        }}
      />
    </>
  );
}
