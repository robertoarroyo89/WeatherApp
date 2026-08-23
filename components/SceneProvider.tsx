'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toHex } from '@/lib/color/oklab';
import {
  paletteToCssVars,
  placeholderScene,
  sampleHour,
  sceneFromCurrent,
  sceneFromInstant,
  type SceneState,
} from '@/lib/weather/scene';
import { currentHourIndex } from '@/lib/weather/series';
import type { HourlyPoint } from '@/lib/weather/types';
import {
  usePerformanceTier,
  usePrefersReducedMotion,
  type PerformanceTier,
} from '@/lib/hooks/useEnvironment';
import { useWeather } from '@/lib/hooks/useWeather';

/**
 * Derives the atmosphere from the forecast, and owns the scrubbed instant.
 *
 * Kept separate from the weather store on purpose: dragging the time scrubber
 * updates this context up to sixty times a second, and only the handful of
 * components that actually depend on the moment being displayed should re-render
 * that often.
 */

interface SceneContextValue {
  scene: SceneState;
  /** The hour being displayed — scrubbed if scrubbing, otherwise now. */
  point: HourlyPoint | null;
  /** Instant the user has dragged to, or null when following the clock. */
  scrubTs: number | null;
  setScrubTs: (timestamp: number | null) => void;
  /** True during an active drag: disables the palette cross-fade. */
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  /** True whenever the display is not showing "now". */
  scrubbed: boolean;
  /** Atmospheric animation allowed at all? */
  motionEnabled: boolean;
  reducedMotion: boolean;
  tier: PerformanceTier;
}

const SceneContext = createContext<SceneContextValue | null>(null);

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const { bundle, nowTs, preferences } = useWeather();
  const reducedMotion = usePrefersReducedMotion();
  const tier = usePerformanceTier();
  const [dragging, setDragging] = useState(false);

  const motionEnabled =
    preferences.sceneAnimations && !reducedMotion && preferences.motion !== 'reduced';

  // The scrub position is stored together with the place it belongs to, so
  // changing city drops it automatically — no reset effect, and no window where
  // one city's clock is applied to another city's forecast.
  const locationKey = bundle?.location.id ?? null;
  const [scrub, setScrub] = useState<{ key: string | null; timestamp: number | null }>({
    key: null,
    timestamp: null,
  });
  const scrubTs = scrub.key === locationKey ? scrub.timestamp : null;
  const setScrubTs = useCallback(
    (timestamp: number | null) => setScrub({ key: locationKey, timestamp }),
    [locationKey],
  );

  const scene = useMemo<SceneState>(() => {
    if (!bundle) return placeholderScene(nowTs);
    if (scrubTs !== null) return sceneFromInstant(bundle, scrubTs);
    return sceneFromCurrent(bundle, nowTs);
  }, [bundle, nowTs, scrubTs]);

  const point = useMemo<HourlyPoint | null>(() => {
    if (!bundle) return null;
    if (scrubTs !== null) return sampleHour(bundle.hourly, scrubTs);
    const index = currentHourIndex(bundle.hourly, nowTs);
    return index < 0 ? null : bundle.hourly[index];
  }, [bundle, nowTs, scrubTs]);

  const value = useMemo<SceneContextValue>(
    () => ({
      scene,
      point,
      scrubTs,
      setScrubTs,
      dragging,
      setDragging,
      scrubbed: scrubTs !== null,
      motionEnabled,
      reducedMotion,
      tier,
    }),
    [scene, point, scrubTs, setScrubTs, dragging, motionEnabled, reducedMotion, tier],
  );

  return (
    <SceneContext.Provider value={value}>
      <SceneVariables scene={scene} dragging={dragging} reducedMotion={reducedMotion} />
      {children}
    </SceneContext.Provider>
  );
}

/**
 * Writes the palette onto the document element.
 *
 * Imperative on purpose. Setting these as an inline style on a wrapping element
 * would re-render the entire tree beneath it on every tick of the clock and
 * every frame of a drag; writing them straight to `<html>` re-renders nothing at
 * all, and CSS transitions do the interpolation on the compositor.
 */
function SceneVariables({
  scene,
  dragging,
  reducedMotion,
}: {
  scene: SceneState;
  dragging: boolean;
  reducedMotion: boolean;
}) {
  const previous = useRef<Record<string, string>>({});

  useEffect(() => {
    const root = document.documentElement;
    const next: Record<string, string> = {
      ...paletteToCssVars(scene.palette),
      '--sun-x': scene.sky.x.toFixed(4),
      '--sun-y': scene.sky.y.toFixed(4),
    };
    for (const [name, value] of Object.entries(next)) {
      if (previous.current[name] !== value) root.style.setProperty(name, value);
    }
    previous.current = next;
  }, [scene]);

  useEffect(() => {
    // While dragging, the JS is already interpolating every frame — a CSS
    // transition on top of that would only add lag.
    document.documentElement.style.setProperty(
      '--scene-dur',
      dragging ? '0ms' : reducedMotion ? '1ms' : '1500ms',
    );
  }, [dragging, reducedMotion]);

  // Keep `theme-color` on the current sky.
  //
  // This is what makes an installed app reach the top of the screen. iOS paints
  // the strip behind the status bar with `theme-color`, so a fixed value sits
  // there as a flat band with a hard edge where the real sky begins — most
  // obvious at night, when a static navy meets an almost-black zenith. Following
  // the zenith makes the band and the sky the same colour, and the seam
  // disappears. On Android it tints the system bars for the same reason.
  const themeColor = toHex(scene.palette.zenith);
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
    // And the document's own background, so any surface the scene does not
    // cover — an overscroll rubber-band, a system strip — is the same colour as
    // the sky rather than a fixed navy.
    document.documentElement.style.backgroundColor = themeColor;
  }, [themeColor]);

  return null;
}

export function useScene(): SceneContextValue {
  const context = useContext(SceneContext);
  if (!context) throw new Error('useScene must be used inside a SceneProvider');
  return context;
}
