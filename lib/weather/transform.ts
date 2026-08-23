import { describeWeatherCode } from './codes';
import type { RawAirQuality, RawForecast } from './api';
import { WeatherError } from './api';
import type {
  AirLevel,
  AirQuality,
  CurrentWeather,
  DailyPoint,
  GeoLocation,
  HourlyPoint,
  PollenReading,
  PollenSpecies,
  WeatherBundle,
  WeatherCondition,
} from './types';

/**
 * Open-Meteo -> internal domain model.
 *
 * The single place in the codebase that knows the provider's field names.
 *
 * Time handling: with `timezone=auto` Open-Meteo returns local wall-clock ISO
 * strings with no offset ("2026-08-23T14:00") plus `utc_offset_seconds`. Those
 * strings are kept verbatim for display, and a true epoch timestamp is derived
 * alongside so that "is this hour in the past?" comparisons are correct even
 * when the device sits in a different timezone from the forecast location.
 */

/**
 * Converts a location-local wall-clock ISO string into a true instant.
 *
 * Parsing with a trailing `Z` reads the wall clock as if it were UTC; removing
 * the location's offset then lands on the real epoch time.
 */
export function parseLocal(iso: string, utcOffsetSeconds: number): number {
  const normalized = iso.length === 16 ? `${iso}:00Z` : `${iso}Z`;
  return Date.parse(normalized) - utcOffsetSeconds * 1000;
}

function parseLocalDate(iso: string, utcOffsetSeconds: number): number {
  return Date.parse(`${iso}T00:00:00Z`) - utcOffsetSeconds * 1000;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function maybeNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function column(
  series: Record<string, Array<number | string | null>> | undefined,
  key: string,
): Array<number | string | null> {
  return series?.[key] ?? [];
}

/** Hour of day from a local ISO string, without touching Date. */
function hourOf(iso: string): number {
  return Number.parseInt(iso.slice(11, 13), 10) || 0;
}

function buildHourly(raw: RawForecast, utcOffsetSeconds: number): HourlyPoint[] {
  const times = column(raw.hourly, 'time');
  if (!times.length) return [];

  const temperature = column(raw.hourly, 'temperature_2m');
  const humidity = column(raw.hourly, 'relative_humidity_2m');
  const dewPoint = column(raw.hourly, 'dew_point_2m');
  const apparent = column(raw.hourly, 'apparent_temperature');
  const probability = column(raw.hourly, 'precipitation_probability');
  const precipitation = column(raw.hourly, 'precipitation');
  const rain = column(raw.hourly, 'rain');
  const showers = column(raw.hourly, 'showers');
  const snowfall = column(raw.hourly, 'snowfall');
  const code = column(raw.hourly, 'weather_code');
  const cloudCover = column(raw.hourly, 'cloud_cover');
  const visibility = column(raw.hourly, 'visibility');
  const windSpeed = column(raw.hourly, 'wind_speed_10m');
  const windDirection = column(raw.hourly, 'wind_direction_10m');
  const windGusts = column(raw.hourly, 'wind_gusts_10m');
  const uvIndex = column(raw.hourly, 'uv_index');
  const isDay = column(raw.hourly, 'is_day');

  const points: HourlyPoint[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const time = str(times[i]);
    // A missing timestamp makes the whole row meaningless; a missing metric does not.
    if (!time) continue;
    const day = num(isDay[i], 1) === 1;
    points.push({
      time,
      timestamp: parseLocal(time, utcOffsetSeconds),
      hour: hourOf(time),
      temperature: num(temperature[i]),
      apparentTemperature: num(apparent[i], num(temperature[i])),
      humidity: num(humidity[i]),
      dewPoint: num(dewPoint[i]),
      precipitation: num(precipitation[i]),
      precipitationProbability: num(probability[i]),
      rain: num(rain[i]),
      showers: num(showers[i]),
      snowfall: num(snowfall[i]),
      cloudCover: num(cloudCover[i]),
      visibility: num(visibility[i], 20_000),
      windSpeed: num(windSpeed[i]),
      windDirection: num(windDirection[i]),
      windGusts: num(windGusts[i], num(windSpeed[i])),
      uvIndex: num(uvIndex[i]),
      isDay: day,
      condition: describeWeatherCode(num(code[i]), day),
    });
  }
  return points;
}

/**
 * The condition that best describes a day.
 *
 * Open-Meteo's daily `weather_code` is the worst code of the whole 24 hours,
 * including the middle of the night. Taken literally it labels a bright
 * afternoon "cielo cubierto" because it was overcast at 04:00 — which then
 * contradicts the summary sitting directly beneath it.
 *
 * So the day is judged on its daylight hours, in the order a person would:
 * storms first, then snow, then rain, and only if none of those happened is it a
 * question of how much cloud there was.
 */
function dailyCondition(hours: HourlyPoint[] | undefined, fallbackCode: number): WeatherCondition {
  const daylight = hours?.filter((point) => point.isDay) ?? [];
  if (daylight.length < 3) return describeWeatherCode(fallbackCode, true);

  const worstOf = (subset: HourlyPoint[]) =>
    subset.reduce(
      (worst, point) => (point.condition.code > worst.condition.code ? point : worst),
      subset[0],
    ).condition;

  const storms = daylight.filter((point) => point.condition.family === 'storm');
  if (storms.length) return worstOf(storms);

  const snow = daylight.filter(
    (point) => point.condition.family === 'snow' && point.snowfall >= 0.1,
  );
  if (snow.length >= 2) return worstOf(snow);

  const wet = daylight.filter(
    (point) => point.condition.family === 'rain' && point.precipitation >= 0.1,
  );
  if (wet.length >= 2) return worstOf(wet);

  const fog = daylight.filter((point) => point.condition.family === 'fog');
  if (fog.length >= 3) return worstOf(fog);

  // A dry day is described by how much sky the cloud covered, on average.
  const averageCloud = daylight.reduce((sum, point) => sum + point.cloudCover, 0) / daylight.length;
  if (averageCloud < 12) return describeWeatherCode(0, true);
  if (averageCloud < 32) return describeWeatherCode(1, true);
  if (averageCloud < 64) return describeWeatherCode(2, true);
  // "Muy nuboso" has no WMO code of its own, but it is the honest description of
  // a day that was three-quarters covered without ever fully closing over.
  if (averageCloud < 88) {
    return { code: 2, kind: 'cloudy', family: 'sky', label: 'Muy nuboso', icon: 'cloud' };
  }
  return describeWeatherCode(3, true);
}

function buildDaily(
  raw: RawForecast,
  utcOffsetSeconds: number,
  hourly: HourlyPoint[],
): DailyPoint[] {
  const times = column(raw.daily, 'time');
  if (!times.length) return [];

  const code = column(raw.daily, 'weather_code');
  const tempMax = column(raw.daily, 'temperature_2m_max');
  const tempMin = column(raw.daily, 'temperature_2m_min');
  const apparentMax = column(raw.daily, 'apparent_temperature_max');
  const apparentMin = column(raw.daily, 'apparent_temperature_min');
  const sunrise = column(raw.daily, 'sunrise');
  const sunset = column(raw.daily, 'sunset');
  const daylight = column(raw.daily, 'daylight_duration');
  const uvMax = column(raw.daily, 'uv_index_max');
  const precipitationSum = column(raw.daily, 'precipitation_sum');
  const rainSum = column(raw.daily, 'rain_sum');
  const snowfallSum = column(raw.daily, 'snowfall_sum');
  const precipitationHours = column(raw.daily, 'precipitation_hours');
  const probabilityMax = column(raw.daily, 'precipitation_probability_max');
  const windMax = column(raw.daily, 'wind_speed_10m_max');
  const gustsMax = column(raw.daily, 'wind_gusts_10m_max');
  const windDominant = column(raw.daily, 'wind_direction_10m_dominant');

  const hoursByDate = new Map<string, HourlyPoint[]>();
  for (const point of hourly) {
    const date = point.time.slice(0, 10);
    const bucket = hoursByDate.get(date);
    if (bucket) bucket.push(point);
    else hoursByDate.set(date, [point]);
  }

  const days: DailyPoint[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const date = str(times[i]);
    if (!date) continue;
    days.push({
      date,
      timestamp: parseLocalDate(date, utcOffsetSeconds),
      condition: dailyCondition(hoursByDate.get(date), num(code[i])),
      temperatureMax: num(tempMax[i]),
      temperatureMin: num(tempMin[i]),
      apparentMax: num(apparentMax[i], num(tempMax[i])),
      apparentMin: num(apparentMin[i], num(tempMin[i])),
      precipitationSum: num(precipitationSum[i]),
      rainSum: num(rainSum[i]),
      snowfallSum: num(snowfallSum[i]),
      precipitationHours: num(precipitationHours[i]),
      precipitationProbabilityMax: num(probabilityMax[i]),
      windSpeedMax: num(windMax[i]),
      windGustsMax: num(gustsMax[i], num(windMax[i])),
      windDirectionDominant: num(windDominant[i]),
      uvIndexMax: num(uvMax[i]),
      sunrise: str(sunrise[i]),
      sunset: str(sunset[i]),
      daylightSeconds: num(daylight[i]),
    });
  }
  return days;
}

/** Linear interpolation of an hourly metric at an arbitrary instant. */
function interpolateHourly(
  hourly: HourlyPoint[],
  timestamp: number,
  pick: (point: HourlyPoint) => number,
): number | null {
  if (!hourly.length) return null;
  if (timestamp <= hourly[0].timestamp) return pick(hourly[0]);
  const last = hourly[hourly.length - 1];
  if (timestamp >= last.timestamp) return pick(last);
  for (let i = 0; i < hourly.length - 1; i += 1) {
    const a = hourly[i];
    const b = hourly[i + 1];
    if (timestamp >= a.timestamp && timestamp <= b.timestamp) {
      const span = b.timestamp - a.timestamp;
      const t = span === 0 ? 0 : (timestamp - a.timestamp) / span;
      return pick(a) + (pick(b) - pick(a)) * t;
    }
  }
  return pick(last);
}

function buildCurrent(
  raw: RawForecast,
  utcOffsetSeconds: number,
  hourly: HourlyPoint[],
): CurrentWeather {
  const current = raw.current;
  if (!current || typeof current.time !== 'string') {
    throw new WeatherError('parse', 'La respuesta no incluye el tiempo actual');
  }
  const time = current.time;
  const timestamp = parseLocal(time, utcOffsetSeconds);
  const isDay = num(current.is_day, 1) === 1;

  return {
    time,
    timestamp,
    temperature: num(current.temperature_2m),
    apparentTemperature: num(current.apparent_temperature, num(current.temperature_2m)),
    humidity: num(current.relative_humidity_2m),
    precipitation: num(current.precipitation),
    rain: num(current.rain),
    showers: num(current.showers),
    snowfall: num(current.snowfall),
    cloudCover: num(current.cloud_cover),
    pressure: num(current.pressure_msl, 1013),
    windSpeed: num(current.wind_speed_10m),
    windGusts: num(current.wind_gusts_10m, num(current.wind_speed_10m)),
    windDirection: num(current.wind_direction_10m),
    isDay,
    condition: describeWeatherCode(num(current.weather_code), isDay),
    // Not offered by `current`; interpolated from the hourly series instead.
    uvIndex: interpolateHourly(hourly, timestamp, (p) => p.uvIndex),
    visibility: interpolateHourly(hourly, timestamp, (p) => p.visibility),
    dewPoint: interpolateHourly(hourly, timestamp, (p) => p.dewPoint),
  };
}

const POLLEN_LABELS: Record<PollenSpecies, string> = {
  grass: 'Gramíneas',
  olive: 'Olivo',
  birch: 'Abedul',
  alder: 'Aliso',
  mugwort: 'Artemisa',
  ragweed: 'Ambrosía',
};

const POLLEN_FIELDS: Array<[PollenSpecies, string]> = [
  ['grass', 'grass_pollen'],
  ['olive', 'olive_pollen'],
  ['birch', 'birch_pollen'],
  ['alder', 'alder_pollen'],
  ['mugwort', 'mugwort_pollen'],
  ['ragweed', 'ragweed_pollen'],
];

/** Thresholds in grains/m³, aligned with the usual European reporting bands. */
function pollenLevel(value: number): AirLevel {
  if (value < 1) return 'veryLow';
  if (value < 10) return 'low';
  if (value < 30) return 'moderate';
  if (value < 80) return 'high';
  return 'veryHigh';
}

/** European AQI bands. */
export function aqiLevel(aqi: number): AirLevel {
  if (aqi <= 20) return 'veryLow';
  if (aqi <= 40) return 'low';
  if (aqi <= 60) return 'moderate';
  if (aqi <= 80) return 'high';
  if (aqi <= 100) return 'veryHigh';
  return 'extreme';
}

export function transformAirQuality(raw: RawAirQuality | null): AirQuality | null {
  const current = raw?.current;
  if (!current || typeof current.time !== 'string') return null;

  const aqi = maybeNum(current.european_aqi);
  const pollen: PollenReading[] = [];
  for (const [species, field] of POLLEN_FIELDS) {
    const value = maybeNum(current[field]);
    // Only surface species the provider actually covers for this location.
    if (value === null) continue;
    pollen.push({
      species,
      label: POLLEN_LABELS[species],
      value,
      level: pollenLevel(value),
    });
  }

  const hasAnyMetric =
    aqi !== null ||
    maybeNum(current.pm2_5) !== null ||
    maybeNum(current.pm10) !== null ||
    pollen.length > 0;
  if (!hasAnyMetric) return null;

  return {
    time: current.time,
    timestamp: parseLocal(current.time, num(raw?.utc_offset_seconds)),
    europeanAqi: aqi,
    level: aqiLevel(aqi ?? 0),
    pm2_5: maybeNum(current.pm2_5),
    pm10: maybeNum(current.pm10),
    ozone: maybeNum(current.ozone),
    nitrogenDioxide: maybeNum(current.nitrogen_dioxide),
    sulphurDioxide: maybeNum(current.sulphur_dioxide),
    pollen,
  };
}

export function transformForecast(
  raw: RawForecast,
  location: GeoLocation,
  air: RawAirQuality | null,
  fetchedAt = Date.now(),
): WeatherBundle {
  const utcOffsetSeconds = num(raw.utc_offset_seconds);
  const hourly = buildHourly(raw, utcOffsetSeconds);
  if (!hourly.length) {
    throw new WeatherError('parse', 'La respuesta no incluye previsión horaria');
  }
  const daily = buildDaily(raw, utcOffsetSeconds, hourly);
  const current = buildCurrent(raw, utcOffsetSeconds, hourly);
  const timezone = raw.timezone && raw.timezone !== 'auto' ? raw.timezone : location.timezone;

  return {
    location: {
      ...location,
      timezone,
      // Trust the provider's grid coordinates for solar geometry.
      latitude: Number.isFinite(raw.latitude) ? raw.latitude : location.latitude,
      longitude: Number.isFinite(raw.longitude) ? raw.longitude : location.longitude,
    },
    timezone,
    utcOffsetSeconds,
    current,
    hourly,
    daily,
    air: transformAirQuality(air),
    fetchedAt,
  };
}
