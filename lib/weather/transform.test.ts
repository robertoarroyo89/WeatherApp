import { describe, expect, it } from 'vitest';
import { rawForecastResponse, VALENCIA } from '@/lib/testing/fixtures';
import { WeatherError, type RawAirQuality, type RawForecast } from './api';
import { aqiLevel, parseLocal, transformAirQuality, transformForecast } from './transform';

describe('parseLocal', () => {
  it('reads a wall clock in the location timezone, not the device one', () => {
    // 14:00 in a UTC+2 zone is 12:00 UTC.
    expect(parseLocal('2026-08-23T14:00', 7200)).toBe(Date.parse('2026-08-23T12:00:00Z'));
    // The same wall clock in Tokyo (UTC+9) is a different instant.
    expect(parseLocal('2026-08-23T14:00', 32_400)).toBe(Date.parse('2026-08-23T05:00:00Z'));
  });
});

describe('transformForecast', () => {
  it('produces a fully typed domain bundle', () => {
    const result = transformForecast(rawForecastResponse(), VALENCIA, null);
    expect(result.timezone).toBe('Europe/Madrid');
    expect(result.utcOffsetSeconds).toBe(7200);
    expect(result.hourly).toHaveLength(3);
    expect(result.daily).toHaveLength(2);
    expect(result.current.temperature).toBe(29.6);
    expect(result.current.condition.kind).toBe('partlyCloudy');
    expect(result.hourly[2].condition.kind).toBe('rain');
    expect(result.daily[0].sunset).toBe('2026-08-23T20:51');
  });

  it('derives the true instant for each hour', () => {
    const result = transformForecast(rawForecastResponse(), VALENCIA, null);
    expect(result.hourly[1].timestamp).toBe(Date.parse('2026-08-23T12:00:00Z'));
    expect(result.hourly[1].hour).toBe(14);
  });

  it('interpolates UV, visibility and dew point into the current observation', () => {
    const result = transformForecast(rawForecastResponse(), VALENCIA, null);
    // 14:30 sits halfway between the 14:00 and 15:00 buckets.
    expect(result.current.uvIndex).toBeCloseTo(4.5, 5);
    expect(result.current.visibility).toBeCloseTo(18_500, 0);
  });

  it('prefers the provider grid coordinates for solar geometry', () => {
    const result = transformForecast(rawForecastResponse(), VALENCIA, null);
    expect(result.location.latitude).toBe(39.5);
    expect(result.location.longitude).toBe(-0.375);
  });

  it('survives missing optional metrics without crashing', () => {
    const raw = rawForecastResponse();
    delete raw.hourly!.uv_index;
    delete raw.hourly!.visibility;
    raw.hourly!.temperature_2m = [29, null, 31];
    const result = transformForecast(raw, VALENCIA, null);
    expect(result.hourly).toHaveLength(3);
    expect(result.hourly[1].temperature).toBe(0);
    expect(result.hourly[0].uvIndex).toBe(0);
    expect(result.hourly[0].visibility).toBe(20_000);
  });

  it('skips hourly rows with no timestamp', () => {
    const raw = rawForecastResponse();
    raw.hourly!.time = ['2026-08-23T13:00', null, '2026-08-23T15:00'];
    expect(transformForecast(raw, VALENCIA, null).hourly).toHaveLength(2);
  });

  it('throws a typed error when the payload has no current block', () => {
    const raw = rawForecastResponse();
    delete raw.current;
    expect(() => transformForecast(raw, VALENCIA, null)).toThrow(WeatherError);
  });

  it('throws a typed error when the hourly series is empty', () => {
    const raw = rawForecastResponse({ hourly: { time: [] } });
    expect(() => transformForecast(raw, VALENCIA, null)).toThrow(/horaria/);
  });

  it('keeps polar days that have no sunrise or sunset', () => {
    const raw = rawForecastResponse();
    raw.daily!.sunrise = [null, null];
    raw.daily!.sunset = [null, null];
    raw.daily!.daylight_duration = [86_400, 86_400];
    const result = transformForecast(raw, VALENCIA, null);
    expect(result.daily[0].sunrise).toBeNull();
    expect(result.daily[0].daylightSeconds).toBe(86_400);
  });
});

describe('transformAirQuality', () => {
  const raw: RawAirQuality = {
    utc_offset_seconds: 7200,
    current: {
      time: '2026-08-23T14:00',
      european_aqi: 37,
      pm10: 11.1,
      pm2_5: 6.9,
      ozone: 92,
      nitrogen_dioxide: 4,
      sulphur_dioxide: 0.9,
      grass_pollen: 0.2,
      olive_pollen: 45,
      birch_pollen: null,
    },
  };

  it('maps the European AQI onto a level', () => {
    expect(aqiLevel(15)).toBe('veryLow');
    expect(aqiLevel(35)).toBe('low');
    expect(aqiLevel(55)).toBe('moderate');
    expect(aqiLevel(75)).toBe('high');
    expect(aqiLevel(95)).toBe('veryHigh');
    expect(aqiLevel(140)).toBe('extreme');
  });

  it('only reports pollen species the provider actually covers', () => {
    const air = transformAirQuality(raw)!;
    const species = air.pollen.map((reading) => reading.species);
    expect(species).toContain('grass');
    expect(species).toContain('olive');
    expect(species).not.toContain('birch');
  });

  it('bands pollen readings', () => {
    const air = transformAirQuality(raw)!;
    expect(air.pollen.find((p) => p.species === 'grass')!.level).toBe('veryLow');
    expect(air.pollen.find((p) => p.species === 'olive')!.level).toBe('high');
    expect(air.pollen.find((p) => p.species === 'olive')!.label).toBe('Olivo');
  });

  it('returns null rather than an empty shell when there is no data', () => {
    expect(transformAirQuality(null)).toBeNull();
    expect(transformAirQuality({ utc_offset_seconds: 0 })).toBeNull();
    expect(
      transformAirQuality({ utc_offset_seconds: 0, current: { time: '2026-08-23T14:00' } }),
    ).toBeNull();
  });
});

describe('daily condition', () => {
  /** Builds a forecast whose only interesting feature is its hourly weather. */
  function withHours(
    shape: (hour: number) => {
      code: number;
      cloud: number;
      precipitation?: number;
      isDay?: boolean;
    },
  ): RawForecast {
    const times: string[] = [];
    const codes: number[] = [];
    const clouds: number[] = [];
    const precipitation: number[] = [];
    const isDay: number[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      const spec = shape(hour);
      times.push(`2026-08-23T${String(hour).padStart(2, '0')}:00`);
      codes.push(spec.code);
      clouds.push(spec.cloud);
      precipitation.push(spec.precipitation ?? 0);
      isDay.push((spec.isDay ?? (hour >= 8 && hour < 20)) ? 1 : 0);
    }
    const raw = rawForecastResponse();
    raw.hourly = {
      time: times,
      temperature_2m: times.map(() => 24),
      apparent_temperature: times.map(() => 24),
      relative_humidity_2m: times.map(() => 55),
      dew_point_2m: times.map(() => 12),
      precipitation_probability: times.map(() => 0),
      precipitation,
      rain: precipitation,
      showers: times.map(() => 0),
      snowfall: times.map(() => 0),
      weather_code: codes,
      cloud_cover: clouds,
      visibility: times.map(() => 24_000),
      wind_speed_10m: times.map(() => 8),
      wind_direction_10m: times.map(() => 90),
      wind_gusts_10m: times.map(() => 14),
      uv_index: times.map(() => 3),
      is_day: isDay,
    };
    raw.daily = {
      ...raw.daily,
      time: ['2026-08-23'],
      weather_code: [3],
      temperature_2m_max: [30],
      temperature_2m_min: [21],
      apparent_temperature_max: [32],
      apparent_temperature_min: [21],
      sunrise: ['2026-08-23T07:21'],
      sunset: ['2026-08-23T20:51'],
      daylight_duration: [48_310],
      uv_index_max: [8],
      precipitation_sum: [0],
      rain_sum: [0],
      snowfall_sum: [0],
      precipitation_hours: [0],
      precipitation_probability_max: [0],
      wind_speed_10m_max: [18],
      wind_gusts_10m_max: [38],
      wind_direction_10m_dominant: [110],
    };
    return raw;
  }

  const conditionOf = (raw: RawForecast) =>
    transformForecast(raw, VALENCIA, null).daily[0].condition;

  it('ignores overcast night hours when the daylight hours were clear', () => {
    // This is the real failure the provider's daily code produces: overcast at
    // 04:00 labelling a bright afternoon "cielo cubierto".
    const condition = conditionOf(
      withHours((hour) => (hour < 6 ? { code: 3, cloud: 100 } : { code: 0, cloud: 4 })),
    );
    expect(condition.kind).toBe('clear');
    expect(condition.label).toBe('Despejado');
  });

  it('bands a dry day by its average daytime cloud cover', () => {
    expect(conditionOf(withHours(() => ({ code: 0, cloud: 5 }))).kind).toBe('clear');
    expect(conditionOf(withHours(() => ({ code: 1, cloud: 22 }))).kind).toBe('mostlyClear');
    expect(conditionOf(withHours(() => ({ code: 2, cloud: 50 }))).kind).toBe('partlyCloudy');
    expect(conditionOf(withHours(() => ({ code: 3, cloud: 75 }))).kind).toBe('cloudy');
    expect(conditionOf(withHours(() => ({ code: 3, cloud: 96 }))).kind).toBe('overcast');
  });

  it('lets a storm outrank everything else', () => {
    const condition = conditionOf(
      withHours((hour) =>
        hour === 15 ? { code: 95, cloud: 100, precipitation: 4 } : { code: 0, cloud: 5 },
      ),
    );
    expect(condition.kind).toBe('storm');
  });

  it('reports rain when it actually rained during the day', () => {
    const condition = conditionOf(
      withHours((hour) =>
        hour >= 14 && hour <= 17
          ? { code: 63, cloud: 95, precipitation: 1.4 }
          : { code: 3, cloud: 80 },
      ),
    );
    expect(condition.kind).toBe('rain');
  });

  it('does not call it rain on the strength of one damp hour', () => {
    const condition = conditionOf(
      withHours((hour) =>
        hour === 15 ? { code: 61, cloud: 90, precipitation: 0.2 } : { code: 2, cloud: 40 },
      ),
    );
    expect(condition.kind).toBe('partlyCloudy');
  });

  it('falls back to the provider code when there are too few daylight hours', () => {
    const condition = conditionOf(withHours(() => ({ code: 0, cloud: 5, isDay: false })));
    expect(condition.kind).toBe('overcast');
  });
});
