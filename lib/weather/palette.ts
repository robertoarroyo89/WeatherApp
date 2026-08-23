import { adjust, contrastRatio, lightnessOf, mix, withAlpha } from '@/lib/color/oklab';
import { clamp } from './solar';
import type { WeatherKind } from './types';
import { weatherFamily } from './codes';

/** Visibility, in metres, at which the veil is at its thickest. */
const HAZE_FLOOR_M = 300;
/** Visibility, in metres, at which the air reads as perfectly clear. */
const HAZE_CEILING_M = 20_000;
const HAZE_DECADES = Math.log10(HAZE_CEILING_M / HAZE_FLOOR_M);

/**
 * The sky palette engine.
 *
 * Colours are keyframed against sun elevation, not clock time, and every
 * intermediate state is interpolated in Oklab. Two full palettes exist — a
 * clear sky and a fully overcast sky — and real weather is a blend of the two
 * driven by cloud cover, then darkened by precipitation and veiled by haze.
 *
 * Art direction: cinematic and slightly underexposed. Highlights are
 * desaturated, shadows keep a colour cast, and no state ever reaches the
 * saturated cobalt blue that makes weather apps look generic. Every palette
 * stays mid-to-deep in luminance so that a single near-white text colour reads
 * on all of them.
 */

interface SkyKey {
  /** Sun elevation in degrees this keyframe describes. */
  el: number;
  zenith: string;
  mid: string;
  horizon: string;
  /** Tint of the light source itself. */
  sun: string;
  /** Strength of the sun/moon bloom, 0-1. */
  glow: number;
  /** Star field opacity before cloud cover is applied, 0-1. */
  stars: number;
}

/** Clear-sky keyframes, from deep night to tropical noon. */
const CLEAR_KEYS: SkyKey[] = [
  {
    el: -60,
    zenith: '#04060D',
    mid: '#070B15',
    horizon: '#0E1522',
    sun: '#C6D4E8',
    glow: 0.1,
    stars: 1,
  },
  {
    el: -14,
    zenith: '#070B16',
    mid: '#0B1222',
    horizon: '#16203A',
    sun: '#CBD8EA',
    glow: 0.14,
    stars: 0.94,
  },
  {
    el: -7,
    zenith: '#0B1630',
    mid: '#152848',
    horizon: '#2C3F63',
    sun: '#8FA1C4',
    glow: 0.24,
    stars: 0.46,
  },
  {
    el: -3,
    zenith: '#142446',
    mid: '#2B3F6A',
    horizon: '#6B5E7B',
    sun: '#C48D79',
    glow: 0.36,
    stars: 0.14,
  },
  {
    el: 0.5,
    zenith: '#1E3357',
    mid: '#5A5378',
    horizon: '#D3855F',
    sun: '#FFC49A',
    glow: 0.64,
    stars: 0.02,
  },
  {
    el: 4,
    zenith: '#2C4C74',
    mid: '#78798D',
    horizon: '#E0A071',
    sun: '#FFD3A3',
    glow: 0.82,
    stars: 0,
  },
  {
    el: 10,
    zenith: '#2A5480',
    mid: '#6B87A3',
    horizon: '#D2B394',
    sun: '#FFE6C4',
    glow: 0.72,
    stars: 0,
  },
  {
    el: 26,
    zenith: '#1D5280',
    mid: '#5288AD',
    horizon: '#B0C6D2',
    sun: '#FFF3DC',
    glow: 0.56,
    stars: 0,
  },
  {
    el: 50,
    zenith: '#0E4171',
    mid: '#3A7BA5',
    horizon: '#A5C2CB',
    sun: '#FFFBF2',
    glow: 0.46,
    stars: 0,
  },
  {
    el: 75,
    zenith: '#05345D',
    mid: '#2A6E9D',
    horizon: '#98BCC6',
    sun: '#FFFFFF',
    glow: 0.42,
    stars: 0,
  },
];

/** Fully overcast keyframes. Cool, flat, and deliberately low-chroma. */
const OVERCAST_KEYS: SkyKey[] = [
  {
    el: -60,
    zenith: '#080A0E',
    mid: '#0D1014',
    horizon: '#13171C',
    sun: '#7E858E',
    glow: 0.02,
    stars: 0,
  },
  {
    el: -14,
    zenith: '#0A0D12',
    mid: '#10141A',
    horizon: '#181D24',
    sun: '#848B95',
    glow: 0.03,
    stars: 0,
  },
  {
    el: -7,
    zenith: '#12161E',
    mid: '#1A202A',
    horizon: '#262D38',
    sun: '#8A919B',
    glow: 0.05,
    stars: 0,
  },
  {
    el: -3,
    zenith: '#1B2029',
    mid: '#282E38',
    horizon: '#3B3E45',
    sun: '#9A9299',
    glow: 0.08,
    stars: 0,
  },
  {
    el: 0.5,
    zenith: '#242933',
    mid: '#383D47',
    horizon: '#5F5750',
    sun: '#B99A85',
    glow: 0.14,
    stars: 0,
  },
  {
    el: 4,
    zenith: '#333A44',
    mid: '#4C525C',
    horizon: '#736C66',
    sun: '#C4A992',
    glow: 0.16,
    stars: 0,
  },
  {
    el: 10,
    zenith: '#434E5A',
    mid: '#5D6874',
    horizon: '#828A93',
    sun: '#CFCABE',
    glow: 0.14,
    stars: 0,
  },
  {
    el: 26,
    zenith: '#4F5C69',
    mid: '#6C7883',
    horizon: '#939BA3',
    sun: '#E2E0D8',
    glow: 0.12,
    stars: 0,
  },
  {
    el: 50,
    zenith: '#556372',
    mid: '#75818D',
    horizon: '#9BA3AB',
    sun: '#EDEBE4',
    glow: 0.11,
    stars: 0,
  },
  {
    el: 75,
    zenith: '#586675',
    mid: '#7A8691',
    horizon: '#A1A9B0',
    sun: '#F2F0EA',
    glow: 0.1,
    stars: 0,
  },
];

function interpolateKeys(keys: SkyKey[], elevation: number): SkyKey {
  const el = clamp(elevation, keys[0].el, keys[keys.length - 1].el);
  let lower = keys[0];
  let upper = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (el >= keys[i].el && el <= keys[i + 1].el) {
      lower = keys[i];
      upper = keys[i + 1];
      break;
    }
  }
  const span = upper.el - lower.el;
  const raw = span === 0 ? 0 : (el - lower.el) / span;
  // Ease the blend so keyframe boundaries are never perceptible.
  const t = raw * raw * (3 - 2 * raw);
  return {
    el,
    zenith: mix(lower.zenith, upper.zenith, t),
    mid: mix(lower.mid, upper.mid, t),
    horizon: mix(lower.horizon, upper.horizon, t),
    sun: mix(lower.sun, upper.sun, t),
    glow: lower.glow + (upper.glow - lower.glow) * t,
    stars: lower.stars + (upper.stars - lower.stars) * t,
  };
}

export interface PaletteInput {
  sunElevation: number;
  /** 0-100 */
  cloudCover: number;
  /** mm/h of liquid precipitation. */
  precipitation: number;
  /** cm/h of snow. */
  snowfall: number;
  kind: WeatherKind;
  /** Metres. Values under ~4000 start to veil the scene. */
  visibility: number | null;
  /** 0-1, how far into the night we are. */
  night: number;
}

export interface ScenePalette {
  /** Sky gradient bands, top to bottom. */
  zenith: string;
  upper: string;
  mid: string;
  horizon: string;
  /** Light-source tint and bloom strength. */
  sun: string;
  glow: number;
  /** Star opacity after cloud occlusion. */
  stars: number;
  /** Atmospheric veil colour and strength. */
  haze: string;
  hazeStrength: number;
  /** Cloud body colours. */
  cloudLight: string;
  cloudDark: string;
  cloudOpacity: number;
  /** Overall ambient light of the scene, for glows and edges. */
  ambient: string;
  /** Text colours, tinted a touch by the ambient light for cohesion. */
  ink: string;
  inkMuted: string;
  inkFaint: string;
  hairline: string;
  /** Interactive accent, derived from the light source. */
  accent: string;
  /** How strong the readability scrim behind content needs to be, 0-1. */
  scrim: number;
  /** Perceived lightness of the sky, 0-1. */
  luminance: number;
  /** Light glow at the bottom of the frame (city lights at night). */
  horizonGlow: string;
  horizonGlowStrength: number;
}

/** Minimum contrast ratio required of primary text against the sky. */
export const TEXT_CONTRAST_TARGET = 4.6;
/**
 * How much of the scrim's nominal strength actually lands behind the hero text.
 * The scrim is a gradient, so the value under any given line is a fraction of
 * its peak; this is a deliberately conservative estimate.
 */
const SCRIM_EFFECT = 0.55;
/** The colour the scrim darkens toward. */
const SCRIM_COLOUR = '#04080E';
const SCRIM_MIN = 0.14;
const SCRIM_MAX = 0.88;

/**
 * The colour text is really sitting on, once the scrim is composited over the
 * sky. Exported so tests can assert real contrast rather than nominal contrast.
 */
export function textBackdrop(skyMid: string, scrim: number): string {
  return mix(skyMid, SCRIM_COLOUR, clamp(scrim * SCRIM_EFFECT, 0, 0.94));
}

/** Lightest scrim that still clears `TEXT_CONTRAST_TARGET`, by bisection. */
function solveScrim(skyMid: string, ink: string): number {
  if (contrastRatio(ink, textBackdrop(skyMid, SCRIM_MIN)) >= TEXT_CONTRAST_TARGET) {
    return SCRIM_MIN;
  }
  let low = SCRIM_MIN;
  let high = SCRIM_MAX;
  for (let i = 0; i < 14; i += 1) {
    const middle = (low + high) / 2;
    if (contrastRatio(ink, textBackdrop(skyMid, middle)) >= TEXT_CONTRAST_TARGET) high = middle;
    else low = middle;
  }
  return high;
}

export function buildPalette(input: PaletteInput): ScenePalette {
  const { sunElevation, kind, night } = input;
  const family = weatherFamily(kind);
  const cloud = clamp(input.cloudCover / 100, 0, 1);

  const clear = interpolateKeys(CLEAR_KEYS, sunElevation);
  const overcast = interpolateKeys(OVERCAST_KEYS, sunElevation);

  // Cloud cover blends the two palettes, but even a fully overcast sky keeps a
  // trace of the underlying light so dawn still reads as dawn.
  const blend = Math.pow(cloud, 1.15) * 0.94;

  let zenith = mix(clear.zenith, overcast.zenith, blend);
  let mid = mix(clear.mid, overcast.mid, blend);
  let horizon = mix(clear.horizon, overcast.horizon, blend);
  const sun = mix(clear.sun, overcast.sun, blend);
  let glow = clear.glow * (1 - cloud * 0.86) + overcast.glow * cloud;

  // Rain and storms pull everything toward a dark slate.
  const rainDepth = clamp(input.precipitation / 4, 0, 1);
  if (family === 'rain' || family === 'storm') {
    const target = family === 'storm' ? '#181C24' : '#242B36';
    const amount = family === 'storm' ? 0.34 + rainDepth * 0.26 : 0.14 + rainDepth * 0.3;
    zenith = mix(zenith, target, amount);
    mid = mix(mid, target, amount * 0.85);
    horizon = mix(horizon, target, amount * 0.6);
    glow *= 1 - amount * 0.8;
  }

  // Snow lifts and cools the scene: bright cloud base, blue shadows.
  const snowDepth = clamp(input.snowfall / 2, 0, 1);
  if (family === 'snow') {
    zenith = mix(zenith, '#495A6B', 0.24 + snowDepth * 0.18);
    mid = mix(mid, '#6C7E90', 0.26 + snowDepth * 0.2);
    horizon = mix(horizon, '#93A5B4', 0.3 + snowDepth * 0.24);
  }

  // Visibility drives the haze veil; fog forces it high regardless.
  //
  // The curve is logarithmic, because perceived murk is: the difference between
  // 20 km and 10 km is barely noticeable, while 2 km to 1 km is dramatic. A
  // linear ramp read 4 km — an ordinary rainy afternoon — as almost total fog and
  // bleached every wet sky to a flat milky grey.
  const visibility = input.visibility ?? 20_000;
  let hazeStrength =
    1 - Math.log10(clamp(visibility, HAZE_FLOOR_M, HAZE_CEILING_M) / HAZE_FLOOR_M) / HAZE_DECADES;
  if (family === 'fog') hazeStrength = Math.max(hazeStrength, 0.8);
  hazeStrength = clamp(hazeStrength, 0, 0.92);

  const dayFactor = 1 - night;
  // Rain murk is dark and charged; fog murk is bright and milky. Using one
  // colour for both makes a downpour look like a foggy morning.
  const milky = mix('#2A3038', '#B4BDC4', dayFactor);
  const wetMurk = mix('#1E242C', '#5C6672', dayFactor);
  const hazeBase = family === 'rain' || family === 'storm' ? wetMurk : milky;
  const haze = mix(hazeBase, sun, 0.14);

  if (hazeStrength > 0) {
    // Fog flattens the gradient: all three bands converge on the veil colour.
    const flatten = hazeStrength * 0.62;
    zenith = mix(zenith, haze, flatten * 0.85);
    mid = mix(mid, haze, flatten);
    horizon = mix(horizon, haze, flatten * 1.05);
    glow *= 1 - hazeStrength * 0.5;
  }

  const upper = mix(zenith, mid, 0.52);
  const ambient = mix(mid, sun, 0.3 * (1 - cloud * 0.5));
  const luminance = lightnessOf(mid);

  // Cloud bodies are lit from the sun side and shadowed with the sky colour, so
  // they always belong to the palette they sit in.
  const cloudLight = mix(mix(mid, '#FFFFFF', 0.2 + dayFactor * 0.22), sun, 0.2);
  const cloudDark = adjust(mix(zenith, mid, 0.35), { chroma: 0.85, lightness: -0.03 });

  // A clear sky still needs a little cloud texture to avoid looking like a flat
  // CSS gradient; an overcast sky needs a lot.
  const cloudOpacity =
    clamp(0.05 + Math.pow(cloud, 1.25) * 0.8, 0, 0.85) * (1 - hazeStrength * 0.55);

  const ink = mix('#FFFFFF', ambient, 0.05);

  // The scrim is solved for, not guessed at.
  //
  // How dark the readability veil needs to be depends entirely on the sky behind
  // it, and eyeballing a curve produced skies — bright overcast, snow — where the
  // body copy fell to a contrast ratio of about 2.4:1. So instead: model the
  // colour text will actually sit on, and search for the lightest scrim that
  // still clears the contrast target. Vivid skies keep a light veil, pale ones
  // get the veil they need, and neither is left to chance.
  const scrim = solveScrim(mid, ink);
  const accent = adjust(mix(sun, '#FFFFFF', 0.15), { chroma: 1.35, lightness: 0.04 });

  const horizonGlowStrength = clamp(night * 0.55 * (1 - hazeStrength * 0.4), 0, 0.55);
  const horizonGlow = mix('#E8B27A', mid, 0.45);

  return {
    zenith,
    upper,
    mid,
    horizon,
    sun,
    glow: clamp(glow, 0, 1),
    stars: clamp(clear.stars * (1 - cloud * 0.95) * (1 - hazeStrength * 0.8), 0, 1),
    haze,
    hazeStrength,
    cloudLight,
    cloudDark,
    cloudOpacity,
    ambient,
    ink,
    inkMuted: withAlpha(ink, 0.86),
    inkFaint: withAlpha(ink, 0.66),
    hairline: withAlpha(ink, 0.13),
    accent,
    scrim,
    luminance,
    horizonGlow,
    horizonGlowStrength,
  };
}

/** A neutral palette used before any weather data has arrived. */
export function placeholderPalette(): ScenePalette {
  return buildPalette({
    sunElevation: 12,
    cloudCover: 42,
    precipitation: 0,
    snowfall: 0,
    kind: 'partlyCloudy',
    visibility: 18_000,
    night: 0,
  });
}
