import { buildPalette, type ScenePalette } from './palette';
import { sampleHour } from './series';
import { clamp, moonState, skyGeometry, type MoonState, type SkyGeometry } from './solar';
import type { WeatherBundle, WeatherKind } from './types';

export { sampleHour };

/**
 * Turns a forecast (at any instant, real or scrubbed) into everything the
 * atmospheric renderer needs.
 *
 * This is the seam that makes the time scrubber possible: the scene never reads
 * the forecast directly, it reads a `SceneState`, and a `SceneState` can be
 * built just as easily from "now" as from a dragged-to moment — using data that
 * is already in memory, with no network request.
 */

export interface SceneState {
  palette: ScenePalette;
  sky: SkyGeometry;
  moon: MoonState;
  kind: WeatherKind;
  /** 0-100 */
  cloudCover: number;
  /** mm/h */
  precipitation: number;
  /** cm/h */
  snowfall: number;
  /** km/h */
  windSpeed: number;
  visibility: number | null;
  temperature: number;
  apparentTemperature: number;
  isStorm: boolean;
  /** 0-1, drives the rain particle layer. */
  rainIntensity: number;
  /** 0-1, drives the snow particle layer. */
  snowIntensity: number;
  /** The instant this scene depicts. */
  timestamp: number;
}

interface SceneInput {
  kind: WeatherKind;
  cloudCover: number;
  precipitation: number;
  snowfall: number;
  windSpeed: number;
  visibility: number | null;
  temperature: number;
  apparentTemperature: number;
  isStorm: boolean;
}

function buildScene(
  input: SceneInput,
  latitude: number,
  longitude: number,
  timestamp: number,
): SceneState {
  const sky = skyGeometry(new Date(timestamp), latitude, longitude);
  const palette = buildPalette({
    sunElevation: sky.elevation,
    cloudCover: input.cloudCover,
    precipitation: input.precipitation,
    snowfall: input.snowfall,
    kind: input.kind,
    visibility: input.visibility,
    night: sky.night,
  });

  // Precipitation figures are per-hour averages, so a drizzle can read as
  // 0.1 mm; the floor per weather kind keeps the visual honest.
  const rainFloor =
    input.kind === 'heavyRain' || input.kind === 'storm'
      ? 0.55
      : input.kind === 'rain'
        ? 0.3
        : input.kind === 'drizzle'
          ? 0.14
          : 0;
  const rainIntensity = Math.max(rainFloor, clamp(input.precipitation / 3.2, 0, 1));

  const snowFloor =
    input.kind === 'heavySnow' ? 0.6 : input.kind === 'snow' || input.kind === 'sleet' ? 0.32 : 0;
  const snowIntensity = Math.max(snowFloor, clamp(input.snowfall / 1.4, 0, 1));

  const wet =
    input.kind === 'drizzle' ||
    input.kind === 'rain' ||
    input.kind === 'heavyRain' ||
    input.kind === 'storm';
  const frozen = input.kind === 'snow' || input.kind === 'heavySnow' || input.kind === 'sleet';

  return {
    palette,
    sky,
    moon: moonState(new Date(timestamp)),
    kind: input.kind,
    cloudCover: input.cloudCover,
    precipitation: input.precipitation,
    snowfall: input.snowfall,
    windSpeed: input.windSpeed,
    visibility: input.visibility,
    temperature: input.temperature,
    apparentTemperature: input.apparentTemperature,
    isStorm: input.isStorm,
    rainIntensity: wet ? rainIntensity : 0,
    snowIntensity: frozen ? snowIntensity : 0,
    timestamp,
  };
}

/** Scene for the live observation. */
export function sceneFromCurrent(bundle: WeatherBundle, nowTs: number): SceneState {
  const { current, location } = bundle;
  return buildScene(
    {
      kind: current.condition.kind,
      cloudCover: current.cloudCover,
      precipitation: current.precipitation,
      snowfall: current.snowfall,
      windSpeed: current.windSpeed,
      visibility: current.visibility,
      temperature: current.temperature,
      apparentTemperature: current.apparentTemperature,
      isStorm: current.condition.family === 'storm',
    },
    location.latitude,
    location.longitude,
    // The sky follows the wall clock, not the (up to 15 min stale) observation.
    nowTs,
  );
}

/** Scene for an arbitrary instant, used while scrubbing the timeline. */
export function sceneFromInstant(bundle: WeatherBundle, timestamp: number): SceneState {
  const point = sampleHour(bundle.hourly, timestamp);
  if (!point) return sceneFromCurrent(bundle, timestamp);
  const { location } = bundle;
  return buildScene(
    {
      kind: point.condition.kind,
      cloudCover: point.cloudCover,
      precipitation: point.precipitation,
      snowfall: point.snowfall,
      windSpeed: point.windSpeed,
      visibility: point.visibility,
      temperature: point.temperature,
      apparentTemperature: point.apparentTemperature,
      isStorm: point.condition.family === 'storm',
    },
    location.latitude,
    location.longitude,
    timestamp,
  );
}

/** Neutral scene shown while the first forecast is still loading. */
export function placeholderScene(nowTs: number, latitude = 40, longitude = -3.7): SceneState {
  return buildScene(
    {
      kind: 'partlyCloudy',
      cloudCover: 45,
      precipitation: 0,
      snowfall: 0,
      windSpeed: 8,
      visibility: 18_000,
      temperature: 18,
      apparentTemperature: 18,
      isStorm: false,
    },
    latitude,
    longitude,
    nowTs,
  );
}

/** Flattens a palette into the CSS custom properties the scene layers read. */
export function paletteToCssVars(palette: ScenePalette): Record<string, string> {
  return {
    '--sky-zenith': palette.zenith,
    '--sky-upper': palette.upper,
    '--sky-mid': palette.mid,
    '--sky-horizon': palette.horizon,
    '--sky-sun': palette.sun,
    '--sky-haze': palette.haze,
    '--sky-cloud-light': palette.cloudLight,
    '--sky-cloud-dark': palette.cloudDark,
    '--sky-ambient': palette.ambient,
    '--sky-horizon-glow': palette.horizonGlow,
    '--ink': palette.ink,
    '--ink-muted': palette.inkMuted,
    '--ink-faint': palette.inkFaint,
    '--hairline': palette.hairline,
    '--accent': palette.accent,
    '--glow': palette.glow.toFixed(3),
    '--stars': palette.stars.toFixed(3),
    '--haze-strength': palette.hazeStrength.toFixed(3),
    '--cloud-opacity': palette.cloudOpacity.toFixed(3),
    '--scrim': palette.scrim.toFixed(3),
    '--horizon-glow-strength': palette.horizonGlowStrength.toFixed(3),
  };
}
