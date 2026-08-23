import { describeWeatherCode } from '@/lib/weather/codes';
import type { RawForecast } from '@/lib/weather/api';
import type {
  CurrentWeather,
  DailyPoint,
  GeoLocation,
  HourlyPoint,
  WeatherBundle,
} from '@/lib/weather/types';

/**
 * Test-only builders. Not imported by any application code.
 *
 * Times are expressed as location-local wall clock plus an offset, exactly like
 * the provider does, so the tests exercise the real timestamp arithmetic.
 */

export const VALENCIA: GeoLocation = {
  id: '2509954',
  name: 'Valencia',
  admin1: 'Comunidad Valenciana',
  country: 'España',
  countryCode: 'ES',
  latitude: 39.47,
  longitude: -0.376,
  timezone: 'Europe/Madrid',
};

export const OFFSET_SECONDS = 7200; // CEST

export function localTs(iso: string, offsetSeconds = OFFSET_SECONDS): number {
  const normalized = iso.length === 16 ? `${iso}:00Z` : `${iso}Z`;
  return Date.parse(normalized) - offsetSeconds * 1000;
}

export function hour(
  iso: string,
  overrides: Partial<HourlyPoint> = {},
  offsetSeconds = OFFSET_SECONDS,
): HourlyPoint {
  const code = overrides.condition?.code ?? 0;
  const isDay = overrides.isDay ?? true;
  return {
    time: iso,
    timestamp: localTs(iso, offsetSeconds),
    hour: Number.parseInt(iso.slice(11, 13), 10),
    temperature: 22,
    apparentTemperature: 22,
    humidity: 55,
    dewPoint: 12,
    precipitation: 0,
    precipitationProbability: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    cloudCover: 10,
    visibility: 24_000,
    windSpeed: 8,
    windDirection: 90,
    windGusts: 14,
    uvIndex: 2,
    isDay,
    condition: describeWeatherCode(code, isDay),
    ...overrides,
  };
}

/** Builds a run of consecutive hours starting from `startIso`. */
export function hourRun(
  startIso: string,
  count: number,
  shape: (index: number) => Partial<HourlyPoint> = () => ({}),
): HourlyPoint[] {
  const startTs = localTs(startIso);
  const points: HourlyPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const ts = startTs + i * 3_600_000;
    // Recover the local wall clock for this offset.
    const local = new Date(ts + OFFSET_SECONDS * 1000).toISOString().slice(0, 16);
    points.push(hour(local, shape(i)));
  }
  return points;
}

export function day(iso: string, overrides: Partial<DailyPoint> = {}): DailyPoint {
  return {
    date: iso,
    timestamp: Date.parse(`${iso}T00:00:00Z`) - OFFSET_SECONDS * 1000,
    condition: describeWeatherCode(0, true),
    temperatureMax: 29,
    temperatureMin: 20,
    apparentMax: 31,
    apparentMin: 20,
    precipitationSum: 0,
    rainSum: 0,
    snowfallSum: 0,
    precipitationHours: 0,
    precipitationProbabilityMax: 0,
    windSpeedMax: 16,
    windGustsMax: 28,
    windDirectionDominant: 90,
    uvIndexMax: 8,
    sunrise: `${iso}T07:21`,
    sunset: `${iso}T20:51`,
    daylightSeconds: 48_300,
    ...overrides,
  };
}

export function current(iso: string, overrides: Partial<CurrentWeather> = {}): CurrentWeather {
  const code = overrides.condition?.code ?? 0;
  const isDay = overrides.isDay ?? true;
  return {
    time: iso,
    timestamp: localTs(iso),
    temperature: 22,
    apparentTemperature: 22,
    humidity: 55,
    precipitation: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    cloudCover: 10,
    pressure: 1015,
    windSpeed: 8,
    windGusts: 14,
    windDirection: 90,
    isDay,
    condition: describeWeatherCode(code, isDay),
    uvIndex: 2,
    visibility: 24_000,
    dewPoint: 12,
    ...overrides,
  };
}

export function bundle(overrides: Partial<WeatherBundle> = {}): WeatherBundle {
  const hourly = overrides.hourly ?? hourRun('2026-08-23T00:00', 48);
  return {
    location: VALENCIA,
    timezone: 'Europe/Madrid',
    utcOffsetSeconds: OFFSET_SECONDS,
    current: overrides.current ?? current('2026-08-23T14:00'),
    hourly,
    daily: overrides.daily ?? [day('2026-08-23'), day('2026-08-24'), day('2026-08-25')],
    air: null,
    fetchedAt: localTs('2026-08-23T14:00'),
    ...overrides,
  };
}

/**
 * A minimal but structurally faithful Open-Meteo forecast response: column
 * arrays, local wall-clock times, no offset suffix.
 */
export function rawForecastResponse(overrides: Partial<RawForecast> = {}): RawForecast {
  return {
    latitude: 39.5,
    longitude: -0.375,
    timezone: 'Europe/Madrid',
    utc_offset_seconds: OFFSET_SECONDS,
    current: {
      time: '2026-08-23T14:30',
      temperature_2m: 29.6,
      relative_humidity_2m: 68,
      apparent_temperature: 34.2,
      is_day: 1,
      precipitation: 0,
      rain: 0,
      showers: 0,
      snowfall: 0,
      weather_code: 2,
      cloud_cover: 68,
      pressure_msl: 1015.3,
      wind_speed_10m: 13.3,
      wind_direction_10m: 109,
      wind_gusts_10m: 32,
    },
    hourly: {
      time: ['2026-08-23T13:00', '2026-08-23T14:00', '2026-08-23T15:00'],
      temperature_2m: [29, 30, 31],
      relative_humidity_2m: [70, 68, 64],
      dew_point_2m: [22, 22, 21],
      apparent_temperature: [33, 34, 35],
      precipitation_probability: [0, 10, 20],
      precipitation: [0, 0, 0.4],
      rain: [0, 0, 0.4],
      showers: [0, 0, 0],
      snowfall: [0, 0, 0],
      weather_code: [2, 2, 61],
      cloud_cover: [60, 68, 80],
      visibility: [24_000, 22_000, 15_000],
      wind_speed_10m: [12, 13, 15],
      wind_direction_10m: [100, 109, 120],
      wind_gusts_10m: [28, 32, 38],
      uv_index: [6, 5, 4],
      is_day: [1, 1, 1],
    },
    daily: {
      time: ['2026-08-23', '2026-08-24'],
      weather_code: [2, 61],
      temperature_2m_max: [31, 28],
      temperature_2m_min: [21, 20],
      apparent_temperature_max: [35, 31],
      apparent_temperature_min: [21, 20],
      sunrise: ['2026-08-23T07:21', '2026-08-24T07:22'],
      sunset: ['2026-08-23T20:51', '2026-08-24T20:49'],
      daylight_duration: [48_310, 48_180],
      uv_index_max: [8, 6],
      precipitation_sum: [0.4, 6],
      rain_sum: [0.4, 6],
      snowfall_sum: [0, 0],
      precipitation_hours: [1, 5],
      precipitation_probability_max: [20, 75],
      wind_speed_10m_max: [18, 22],
      wind_gusts_10m_max: [38, 46],
      wind_direction_10m_dominant: [110, 200],
    },
    ...overrides,
  };
}
