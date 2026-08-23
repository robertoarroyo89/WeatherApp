import { describe, expect, it } from 'vitest';
import { contrastRatio, lightnessOf, parseColor } from '@/lib/color/oklab';
import { buildPalette, placeholderPalette, textBackdrop, TEXT_CONTRAST_TARGET } from './palette';
import type { PaletteInput } from './palette';

const BASE: PaletteInput = {
  sunElevation: 45,
  cloudCover: 0,
  precipitation: 0,
  snowfall: 0,
  kind: 'clear',
  visibility: 24_000,
  night: 0,
};

const NIGHT: PaletteInput = { ...BASE, sunElevation: -30, night: 1 };

function isRealColour(value: string): boolean {
  const { r, g, b } = parseColor(value);
  return r + g + b > 0;
}

describe('buildPalette', () => {
  it('never emits a black sky by accident', () => {
    for (const elevation of [-40, -12, -6, -2, 0, 5, 20, 45, 75]) {
      const palette = buildPalette({ ...BASE, sunElevation: elevation });
      expect(isRealColour(palette.zenith)).toBe(true);
      expect(isRealColour(palette.mid)).toBe(true);
      expect(isRealColour(palette.horizon)).toBe(true);
      expect(isRealColour(palette.cloudLight)).toBe(true);
    }
  });

  it('keeps every state in a luminance band a single ink colour can sit on', () => {
    const cases: PaletteInput[] = [
      BASE,
      NIGHT,
      { ...BASE, cloudCover: 100, kind: 'overcast' },
      { ...BASE, cloudCover: 100, kind: 'heavyRain', precipitation: 6 },
      { ...BASE, cloudCover: 95, kind: 'snow', snowfall: 1.4 },
      { ...BASE, kind: 'fog', visibility: 400, cloudCover: 100 },
      { ...BASE, sunElevation: 0.5 },
    ];
    for (const input of cases) {
      const luminance = lightnessOf(buildPalette(input).mid);
      // Bright enough not to be a black rectangle, dark enough for white text.
      expect(luminance).toBeGreaterThan(0.02);
      expect(luminance).toBeLessThan(0.78);
    }
  });

  it('darkens as the sun sets', () => {
    const noon = lightnessOf(buildPalette({ ...BASE, sunElevation: 60 }).mid);
    const dusk = lightnessOf(buildPalette({ ...BASE, sunElevation: 0 }).mid);
    const night = lightnessOf(buildPalette(NIGHT).mid);
    expect(dusk).toBeLessThan(noon);
    expect(night).toBeLessThan(dusk);
  });

  it('interpolates smoothly, with no jump between neighbouring elevations', () => {
    let previous = lightnessOf(buildPalette({ ...BASE, sunElevation: -20 }).mid);
    for (let elevation = -19.5; elevation <= 80; elevation += 0.5) {
      const current = lightnessOf(buildPalette({ ...BASE, sunElevation: elevation }).mid);
      expect(Math.abs(current - previous)).toBeLessThan(0.03);
      previous = current;
    }
  });

  it('dims the sun glow under cloud and rain', () => {
    const clear = buildPalette(BASE).glow;
    const cloudy = buildPalette({ ...BASE, cloudCover: 100, kind: 'overcast' }).glow;
    const wet = buildPalette({
      ...BASE,
      cloudCover: 100,
      kind: 'heavyRain',
      precipitation: 5,
    }).glow;
    expect(cloudy).toBeLessThan(clear);
    expect(wet).toBeLessThan(cloudy);
  });

  it('hides the stars behind cloud rather than showing them through it', () => {
    const clearNight = buildPalette(NIGHT).stars;
    const cloudyNight = buildPalette({ ...NIGHT, cloudCover: 100, kind: 'overcast' }).stars;
    expect(clearNight).toBeGreaterThan(0.8);
    expect(cloudyNight).toBeLessThan(0.05);
  });

  it('raises the haze veil when visibility collapses', () => {
    expect(buildPalette(BASE).hazeStrength).toBeLessThan(0.05);
    expect(buildPalette({ ...BASE, visibility: 300, kind: 'fog' }).hazeStrength).toBeGreaterThan(
      0.7,
    );
  });

  it('asks for a stronger scrim only where text needs the help', () => {
    // A deep clear azure is already dark enough to carry white type, so it keeps
    // the minimum veil. A pale overcast sky is not, and pays for it.
    const clearNoon = buildPalette({ ...BASE, sunElevation: 60 }).scrim;
    const paleOvercast = buildPalette({
      ...BASE,
      sunElevation: 60,
      cloudCover: 100,
      kind: 'overcast',
    }).scrim;
    expect(paleOvercast).toBeGreaterThan(clearNoon);
  });

  it('produces a usable placeholder before data arrives', () => {
    const palette = placeholderPalette();
    expect(isRealColour(palette.mid)).toBe(true);
    expect(palette.scrim).toBeGreaterThan(0);
  });
});

describe('text contrast', () => {
  /** Every atmosphere the app can actually paint. */
  const ALL_STATES: PaletteInput[] = [];
  for (const elevation of [-40, -14, -7, -3, 0.5, 4, 10, 26, 50, 75]) {
    for (const [kind, cloudCover, precipitation, snowfall, visibility] of [
      ['clear', 0, 0, 0, 24_000],
      ['mostlyClear', 20, 0, 0, 22_000],
      ['partlyCloudy', 50, 0, 0, 18_000],
      ['overcast', 100, 0, 0, 12_000],
      ['fog', 100, 0, 0, 300],
      ['drizzle', 90, 0.3, 0, 8_000],
      ['rain', 95, 2, 0, 6_000],
      ['heavyRain', 100, 8, 0, 3_000],
      ['snow', 95, 1, 1, 4_000],
      ['heavySnow', 100, 2, 3, 1_500],
      ['storm', 100, 10, 0, 2_000],
    ] as const) {
      ALL_STATES.push({
        sunElevation: elevation,
        cloudCover,
        precipitation,
        snowfall,
        kind,
        visibility,
        night: elevation < -6 ? 1 : elevation < 2 ? 0.4 : 0,
      });
    }
  }

  it('reaches the contrast target for primary text on every possible sky', () => {
    for (const input of ALL_STATES) {
      const palette = buildPalette(input);
      const backdrop = textBackdrop(palette.mid, palette.scrim);
      const ratio = contrastRatio(palette.ink, backdrop);
      expect(
        ratio,
        `${input.kind} at ${input.sunElevation}° gave ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(TEXT_CONTRAST_TARGET - 0.05);
    }
  });

  it('keeps secondary text legible too', () => {
    for (const input of ALL_STATES) {
      const palette = buildPalette(input);
      const backdrop = textBackdrop(palette.mid, palette.scrim);
      // Secondary sentences and section labels. Below 3:1 they stop being
      // readable over a bright sky, whatever the text shadow does.
      expect(
        contrastRatio(palette.inkMuted, backdrop),
        `${input.kind} at ${input.sunElevation}°`,
      ).toBeGreaterThanOrEqual(3.4);
    }
  });

  it('spends the scrim only where it is needed', () => {
    // A deep clear night should barely need one; a bright overcast noon should.
    const night = buildPalette({ ...ALL_STATES[0], sunElevation: -40, night: 1 });
    const brightNoon = buildPalette({
      sunElevation: 60,
      cloudCover: 100,
      precipitation: 0,
      snowfall: 0,
      kind: 'overcast',
      visibility: 14_000,
      night: 0,
    });
    expect(night.scrim).toBeLessThan(0.3);
    expect(brightNoon.scrim).toBeGreaterThan(night.scrim);
  });
});
