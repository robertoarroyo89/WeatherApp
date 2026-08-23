import { describe, expect, it } from 'vitest';
import { adjust, lightnessOf, mix, oklabToRgb, parseColor, rgbToOklab, withAlpha } from './oklab';

describe('parseColor', () => {
  it('reads 3, 6 and 8 digit hex', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#102030')).toEqual({ r: 16, g: 32, b: 48, a: 1 });
    expect(parseColor('#00000080').a).toBeCloseTo(0.502, 2);
  });

  it('reads back the rgb() strings this module emits', () => {
    expect(parseColor('rgb(16 32 48)')).toEqual({ r: 16, g: 32, b: 48, a: 1 });
    expect(parseColor('rgb(16 32 48 / 0.5)')).toEqual({ r: 16, g: 32, b: 48, a: 0.5 });
    expect(parseColor('rgba(16, 32, 48, 0.25)')).toEqual({ r: 16, g: 32, b: 48, a: 0.25 });
  });

  it('falls back to black on nonsense input', () => {
    expect(parseColor('not a colour')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseColor('rgb(a b c)')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('oklab round trip', () => {
  it('survives a conversion in both directions', () => {
    for (const hex of ['#000000', '#ffffff', '#E7A574', '#0C1730', '#3A7BA5']) {
      const rgb = parseColor(hex);
      const back = oklabToRgb(rgbToOklab(rgb));
      expect(back.r).toBeCloseTo(rgb.r, 0);
      expect(back.g).toBeCloseTo(rgb.g, 0);
      expect(back.b).toBeCloseTo(rgb.b, 0);
    }
  });
});

describe('mix', () => {
  it('returns the endpoints untouched', () => {
    expect(mix('#112233', '#445566', 0)).toBe('#112233');
    expect(mix('#112233', '#445566', 1)).toBe('#445566');
  });

  it('keeps chroma through a sunset-to-night blend instead of going grey', () => {
    // The sRGB midpoint of these two is a dead brown; Oklab keeps it colourful.
    const midpoint = mix('#E7A574', '#0C1730', 0.5);
    const { r, g, b } = parseColor(midpoint);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    expect(spread).toBeGreaterThan(20);
  });

  it('stays composable: a blend of a blend is still a real colour', () => {
    // The palette engine chains blends, so mix() must accept its own output.
    const once = mix('#0C1730', '#E7A574', 0.5);
    const twice = mix(once, '#242B36', 0.4);
    expect(lightnessOf(twice)).toBeGreaterThan(0.1);
    expect(parseColor(twice)).not.toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('produces a monotonic lightness ramp', () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map((t) => lightnessOf(mix('#000000', '#ffffff', t)));
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });
});

describe('adjust and withAlpha', () => {
  it('desaturates toward grey when chroma is reduced', () => {
    const grey = adjust('#E7A574', { chroma: 0 });
    const { r, g, b } = parseColor(grey);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(4);
  });

  it('brightens and darkens without leaving the gamut', () => {
    expect(lightnessOf(adjust('#3A7BA5', { lightness: 0.2 }))).toBeGreaterThan(
      lightnessOf('#3A7BA5'),
    );
    expect(parseColor(adjust('#ffffff', { lightness: 0.5 })).r).toBe(255);
    expect(parseColor(adjust('#000000', { lightness: -0.5 })).r).toBe(0);
  });

  it('emits an alpha channel only when it is not fully opaque', () => {
    expect(withAlpha('#ffffff', 1)).toBe('rgb(255 255 255)');
    expect(withAlpha('#ffffff', 0.5)).toBe('rgb(255 255 255 / 0.5)');
    expect(withAlpha('#ffffff', 2)).toBe('rgb(255 255 255)');
  });
});
