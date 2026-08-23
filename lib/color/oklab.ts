/**
 * Minimal sRGB <-> Oklab colour maths.
 *
 * Sky gradients are interpolated in Oklab rather than sRGB. Blending
 * `#E7A574` (sunset horizon) with `#0C1730` (night zenith) in sRGB runs the
 * midpoint through a dead grey-brown; in Oklab it keeps its chroma and reads as
 * dusk. Every gradient in the app depends on this.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Oklab {
  L: number;
  a: number;
  b: number;
  alpha: number;
}

const HEX_RE = /^#?([0-9a-f]{3,8})$/i;
const RGB_RE = /^rgba?\(([^)]+)\)$/i;

const BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 };

/**
 * Accepts hex (`#abc`, `#aabbcc`, `#aabbccdd`) and the `rgb()` / `rgba()` forms
 * this module itself emits.
 *
 * Reading back its own output is not a nicety: the palette engine composes
 * blends (`mix(mix(a, b, t), c, u)`), so a parser that only understood hex
 * would silently turn every chained blend into black.
 */
export function parseColor(input: string): Rgb {
  const value = input.trim();

  const rgbMatch = RGB_RE.exec(value);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return BLACK;
    const [r, g, b, a] = parts;
    return {
      r: Math.round(Math.min(255, Math.max(0, r))),
      g: Math.round(Math.min(255, Math.max(0, g))),
      b: Math.round(Math.min(255, Math.max(0, b))),
      a: a === undefined ? 1 : Math.min(1, Math.max(0, a)),
    };
  }

  const match = HEX_RE.exec(value);
  if (!match) return BLACK;
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (hex.length !== 6 && hex.length !== 8) return BLACK;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function fromLinear(channel: number): number {
  const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

export function rgbToOklab({ r, g, b, a }: Rgb): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    alpha: a,
  };
}

export function oklabToRgb({ L, a, b, alpha }: Oklab): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return { r: fromLinear(lr), g: fromLinear(lg), b: fromLinear(lb), a: alpha };
}

export function formatRgb({ r, g, b, a }: Rgb): string {
  if (a >= 0.999) return `rgb(${r} ${g} ${b})`;
  return `rgb(${r} ${g} ${b} / ${Math.round(a * 1000) / 1000})`;
}

/** Perceptual blend of two colours. `t` of 0 returns `from`, 1 returns `to`. */
export function mix(from: string, to: string, t: number): string {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const A = rgbToOklab(parseColor(from));
  const B = rgbToOklab(parseColor(to));
  return formatRgb(
    oklabToRgb({
      L: A.L + (B.L - A.L) * t,
      a: A.a + (B.a - A.a) * t,
      b: A.b + (B.b - A.b) * t,
      alpha: A.alpha + (B.alpha - A.alpha) * t,
    }),
  );
}

/** Multiplies chroma and shifts lightness. Used to build cloud and haze tints. */
export function adjust(
  color: string,
  { chroma = 1, lightness = 0, alpha }: { chroma?: number; lightness?: number; alpha?: number },
): string {
  const lab = rgbToOklab(parseColor(color));
  return formatRgb(
    oklabToRgb({
      L: Math.min(1, Math.max(0, lab.L + lightness)),
      a: lab.a * chroma,
      b: lab.b * chroma,
      alpha: alpha ?? lab.alpha,
    }),
  );
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  return formatRgb({ ...rgb, a: Math.min(1, Math.max(0, alpha)) });
}

/** Oklab lightness, 0-1. Cheap stand-in for perceived brightness. */
export function lightnessOf(color: string): number {
  return rgbToOklab(parseColor(color)).L;
}

/* --------------------------------------------------------------- contrast -- */

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * WCAG contrast ratio, 1 to 21.
 *
 * The foreground is composited over the background first, so a translucent ink
 * colour is measured as it will actually appear rather than as if it were
 * opaque — which is the difference between a number that means something and a
 * number that flatters.
 */
export function contrastRatio(foreground: string, background: string): number {
  const bg = parseColor(background);
  const fg = parseColor(foreground);
  const composited: Rgb = {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
  const a = relativeLuminance(composited);
  const b = relativeLuminance({ ...bg, a: 1 });
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
