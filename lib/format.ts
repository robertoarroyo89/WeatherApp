import type { AirLevel, TemperatureUnit, WindUnit } from '@/lib/weather/types';

/**
 * Display formatting. Spanish from Spain, 24-hour clock, and always rendered in
 * the *forecast location's* timezone rather than the device's — looking up
 * Tokyo from Valencia must show Tokyo's clock.
 */

const LOCALE = 'es-ES';

// Intl formatters are expensive to construct and get used inside lists, so they
// are memoised per timezone.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timezone}|${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  let created: Intl.DateTimeFormat;
  try {
    created = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: timezone });
  } catch {
    // An unknown timezone must never crash a render.
    created = new Intl.DateTimeFormat(LOCALE, options);
  }
  formatterCache.set(key, created);
  return created;
}

/* ------------------------------------------------------------------ units -- */

export function toDisplayTemperature(celsius: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? celsius * 1.8 + 32 : celsius;
}

/** Rounded temperature without the degree sign, for animated numerals. */
export function temperatureValue(celsius: number, unit: TemperatureUnit): number {
  return Math.round(toDisplayTemperature(celsius, unit));
}

export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return `${temperatureValue(celsius, unit)}°`;
}

export function unitSymbol(unit: TemperatureUnit): string {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

export function toDisplayWind(kmh: number, unit: WindUnit): number {
  if (unit === 'ms') return kmh / 3.6;
  if (unit === 'mph') return kmh / 1.609344;
  return kmh;
}

export function windUnitLabel(unit: WindUnit): string {
  if (unit === 'ms') return 'm/s';
  if (unit === 'mph') return 'mph';
  return 'km/h';
}

export function formatWind(kmh: number, unit: WindUnit): string {
  const value = toDisplayWind(kmh, unit);
  const rounded = unit === 'ms' ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded.toLocaleString(LOCALE)} ${windUnitLabel(unit)}`;
}

const CARDINALS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSO',
  'SO',
  'OSO',
  'O',
  'ONO',
  'NO',
  'NNO',
];

export function windCardinal(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return CARDINALS[index];
}

const WIND_ORIGINS: Record<string, string> = {
  N: 'del norte',
  NNE: 'del nornordeste',
  NE: 'del nordeste',
  ENE: 'del estenordeste',
  E: 'de levante',
  ESE: 'del estesudeste',
  SE: 'del sudeste',
  SSE: 'del sursudeste',
  S: 'del sur',
  SSO: 'del sursudoeste',
  SO: 'del sudoeste',
  OSO: 'del oestesudoeste',
  O: 'de poniente',
  ONO: 'del oestenoroeste',
  NO: 'del noroeste',
  NNO: 'del nornoroeste',
};

/** "del nordeste", used in prose. */
export function windOrigin(degrees: number): string {
  return WIND_ORIGINS[windCardinal(degrees)] ?? '';
}

/* ------------------------------------------------------------------- time -- */

/** "18:30" from a location-local ISO string — exact, and free of Intl. */
export function isoTime(iso: string): string {
  return iso.slice(11, 16);
}

/** "18" from a location-local ISO string. */
export function isoHour(iso: string): string {
  return iso.slice(11, 13);
}

/** "18:30" for an instant, rendered in the location's timezone. */
export function formatTime(timestamp: number, timezone: string): string {
  return formatter(timezone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    timestamp,
  );
}

/** "LUN" — short weekday, uppercase, no trailing period. */
export function formatWeekdayShort(timestamp: number, timezone: string): string {
  return formatter(timezone, { weekday: 'short' })
    .format(timestamp)
    .replace(/\.$/, '')
    .toUpperCase();
}

/** "lunes" */
export function formatWeekday(timestamp: number, timezone: string): string {
  return formatter(timezone, { weekday: 'long' }).format(timestamp);
}

/** "23" — day of month. */
export function formatDayNumber(timestamp: number, timezone: string): string {
  return formatter(timezone, { day: 'numeric' }).format(timestamp);
}

/** "Domingo, 23 de agosto" */
export function formatLongDate(timestamp: number, timezone: string): string {
  const text = formatter(timezone, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    timestamp,
  );
  return capitalize(text);
}

/** "23 de agosto" */
export function formatDayMonth(timestamp: number, timezone: string): string {
  return formatter(timezone, { day: 'numeric', month: 'long' }).format(timestamp);
}

/** Hour of day, 0-23, in the location's timezone. */
export function hourInZone(timestamp: number, timezone: string): number {
  return Number.parseInt(
    formatter(timezone, { hour: '2-digit', hourCycle: 'h23' }).format(timestamp),
    10,
  );
}

/** "YYYY-MM-DD" in the location's timezone. */
export function dateKeyInZone(timestamp: number, timezone: string): string {
  const parts = formatter(timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "13 h 25 min", "45 min" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/** "en 42 min", "en 2 h", "ahora mismo" */
export function formatCountdown(minutes: number): string {
  const value = Math.round(minutes);
  if (value <= 1) return 'ahora mismo';
  if (value < 60) return `en ${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (rest < 10) return `en ${hours} h`;
  return `en ${hours} h ${rest} min`;
}

/** "Hoy", "Mañana", or "Lunes 25". */
export function formatDayLabel(timestamp: number, timezone: string, nowTs: number): string {
  const today = dateKeyInZone(nowTs, timezone);
  const tomorrow = dateKeyInZone(nowTs + 86_400_000, timezone);
  const target = dateKeyInZone(timestamp, timezone);
  if (target === today) return 'Hoy';
  if (target === tomorrow) return 'Mañana';
  return capitalize(formatWeekday(timestamp, timezone));
}

/* ------------------------------------------------------------------ scales -- */

export function uvLabel(uv: number): string {
  if (uv < 3) return 'Bajo';
  if (uv < 6) return 'Moderado';
  if (uv < 8) return 'Alto';
  if (uv < 11) return 'Muy alto';
  return 'Extremo';
}

/** Feminine form, for "calidad del aire". */
const AIR_LABELS_F: Record<AirLevel, string> = {
  veryLow: 'Muy buena',
  low: 'Buena',
  moderate: 'Regular',
  high: 'Mala',
  veryHigh: 'Muy mala',
  extreme: 'Pésima',
};

/** Masculine form, for "nivel de polen". */
const LEVEL_LABELS_M: Record<AirLevel, string> = {
  veryLow: 'Muy bajo',
  low: 'Bajo',
  moderate: 'Moderado',
  high: 'Alto',
  veryHigh: 'Muy alto',
  extreme: 'Extremo',
};

export function airQualityLabel(level: AirLevel): string {
  return AIR_LABELS_F[level];
}

export function levelLabel(level: AirLevel): string {
  return LEVEL_LABELS_M[level];
}

export function humidityLabel(humidity: number): string {
  if (humidity < 30) return 'Aire seco';
  if (humidity < 55) return 'Agradable';
  if (humidity < 75) return 'Algo húmedo';
  return 'Muy húmedo';
}

export function visibilityLabel(metres: number): string {
  if (metres >= 20_000) return 'Excelente';
  if (metres >= 10_000) return 'Buena';
  if (metres >= 4_000) return 'Regular';
  if (metres >= 1_000) return 'Reducida';
  return 'Muy baja';
}

/** "10 km", "800 m" */
export function formatVisibility(metres: number): string {
  if (metres >= 1_000) return `${Math.round(metres / 1_000)} km`;
  return `${Math.round(metres / 50) * 50} m`;
}

export function formatPrecipitation(mm: number): string {
  if (mm <= 0) return '0 mm';
  if (mm < 1) return `${(Math.round(mm * 10) / 10).toLocaleString(LOCALE)} mm`;
  return `${Math.round(mm)} mm`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)} %`;
}

export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Score rendered as "8,8" — Spain uses a decimal comma. */
export function formatScore(score: number): string {
  return (Math.round(score * 10) / 10).toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
