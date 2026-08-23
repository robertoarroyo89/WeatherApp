import { describe, expect, it } from 'vitest';
import { describeWeatherCode, impliedCloudCover, isPrecipitating, weatherFamily } from './codes';

describe('describeWeatherCode', () => {
  it('normalizes provider codes into semantic kinds', () => {
    expect(describeWeatherCode(0).kind).toBe('clear');
    expect(describeWeatherCode(2).kind).toBe('partlyCloudy');
    expect(describeWeatherCode(3).kind).toBe('overcast');
    expect(describeWeatherCode(45).kind).toBe('fog');
    expect(describeWeatherCode(53).kind).toBe('drizzle');
    expect(describeWeatherCode(63).kind).toBe('rain');
    expect(describeWeatherCode(65).kind).toBe('heavyRain');
    expect(describeWeatherCode(75).kind).toBe('heavySnow');
    expect(describeWeatherCode(96).kind).toBe('storm');
  });

  it('maps rain and snow showers onto the same kinds as steady precipitation', () => {
    expect(describeWeatherCode(80).kind).toBe('rain');
    expect(describeWeatherCode(82).kind).toBe('heavyRain');
    expect(describeWeatherCode(85).kind).toBe('snow');
  });

  it('uses a night-specific label for a clear sky', () => {
    expect(describeWeatherCode(0, true).label).toBe('Despejado');
    expect(describeWeatherCode(0, false).label).toBe('Noche despejada');
    expect(describeWeatherCode(0, false).icon).toBe('moon');
  });

  it('never throws on an unknown code', () => {
    const condition = describeWeatherCode(1234);
    expect(condition.kind).toBe('partlyCloudy');
    expect(condition.label).toBe('Sin datos');
  });

  it('groups kinds into families', () => {
    expect(weatherFamily('drizzle')).toBe('rain');
    expect(weatherFamily('sleet')).toBe('snow');
    expect(weatherFamily('overcast')).toBe('sky');
    expect(isPrecipitating('overcast')).toBe(false);
    expect(isPrecipitating('storm')).toBe(true);
  });

  it('implies more cloud cover for wetter kinds', () => {
    expect(impliedCloudCover('clear')).toBeLessThan(impliedCloudCover('partlyCloudy'));
    expect(impliedCloudCover('partlyCloudy')).toBeLessThan(impliedCloudCover('rain'));
    expect(impliedCloudCover('storm')).toBeGreaterThan(0.9);
  });
});
