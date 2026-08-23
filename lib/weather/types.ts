/**
 * Internal weather domain model.
 *
 * Nothing outside `lib/weather/transform.ts` should ever see an Open-Meteo
 * response shape. UI components depend exclusively on the types below.
 */

/** Semantic weather state, normalized away from provider-specific WMO codes. */
export type WeatherKind =
  | 'clear'
  | 'mostlyClear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavyRain'
  | 'sleet'
  | 'snow'
  | 'heavySnow'
  | 'storm';

/** Coarse grouping used for scene selection and copy. */
export type WeatherFamily = 'sky' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherCondition {
  code: number;
  kind: WeatherKind;
  family: WeatherFamily;
  /** Spanish (Spain) label, sentence case. */
  label: string;
  /** Icon identifier resolved by the icon system. */
  icon: string;
}

export interface GeoLocation {
  /** Stable identifier: provider id, or `lat,lon` rounded for device positions. */
  id: string;
  name: string;
  /** Region / province, e.g. "Comunidad Valenciana". */
  admin1?: string;
  admin2?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  /** IANA timezone, e.g. "Europe/Madrid". */
  timezone: string;
  /** True when derived from the device GPS rather than a search result. */
  fromDevice?: boolean;
}

export interface CurrentWeather {
  /** Local wall-clock ISO of the observation, e.g. "2026-08-23T14:15". */
  time: string;
  /** True instant, ms since epoch. */
  timestamp: number;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  rain: number;
  showers: number;
  snowfall: number;
  cloudCover: number;
  pressure: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  isDay: boolean;
  condition: WeatherCondition;
  /** Interpolated from the hourly series (not exposed by `current`). */
  uvIndex: number | null;
  visibility: number | null;
  dewPoint: number | null;
}

export interface HourlyPoint {
  time: string;
  timestamp: number;
  /** Hour of day 0-23 in the location's timezone. */
  hour: number;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  dewPoint: number;
  precipitation: number;
  precipitationProbability: number;
  rain: number;
  showers: number;
  snowfall: number;
  cloudCover: number;
  visibility: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  uvIndex: number;
  isDay: boolean;
  condition: WeatherCondition;
}

export interface DailyPoint {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  /** Local midnight as a true instant. */
  timestamp: number;
  condition: WeatherCondition;
  temperatureMax: number;
  temperatureMin: number;
  apparentMax: number;
  apparentMin: number;
  precipitationSum: number;
  rainSum: number;
  snowfallSum: number;
  precipitationHours: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  windGustsMax: number;
  windDirectionDominant: number;
  uvIndexMax: number;
  /** Null in polar day / polar night. */
  sunrise: string | null;
  sunset: string | null;
  daylightSeconds: number;
}

export type PollenSpecies = 'grass' | 'olive' | 'birch' | 'alder' | 'mugwort' | 'ragweed';

export interface PollenReading {
  species: PollenSpecies;
  /** Spanish label, e.g. "Gramíneas". */
  label: string;
  /** grains/m³ */
  value: number;
  level: AirLevel;
}

export type AirLevel = 'veryLow' | 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';

export interface AirQuality {
  time: string;
  timestamp: number;
  /** European AQI, 0-100+. Lower is better. */
  europeanAqi: number | null;
  level: AirLevel;
  pm2_5: number | null;
  pm10: number | null;
  ozone: number | null;
  nitrogenDioxide: number | null;
  sulphurDioxide: number | null;
  pollen: PollenReading[];
}

export interface WeatherBundle {
  location: GeoLocation;
  timezone: string;
  utcOffsetSeconds: number;
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  /** Null when the air-quality request failed or returned nothing usable. */
  air: AirQuality | null;
  /** When this bundle was retrieved, ms since epoch. */
  fetchedAt: number;
}

export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type WindUnit = 'kmh' | 'ms' | 'mph';
