import type { WeatherCondition, WeatherFamily, WeatherKind } from './types';

interface CodeEntry {
  kind: WeatherKind;
  /** Daytime label. */
  label: string;
  /** Optional night-specific label, e.g. "Despejado" -> "Noche despejada". */
  nightLabel?: string;
  icon: string;
  nightIcon?: string;
}

/**
 * WMO 4677 weather interpretation codes as served by Open-Meteo.
 * Labels are Spanish (Spain), sentence case, deliberately short.
 */
const CODES: Record<number, CodeEntry> = {
  0: {
    kind: 'clear',
    label: 'Despejado',
    nightLabel: 'Noche despejada',
    icon: 'sun',
    nightIcon: 'moon',
  },
  1: {
    kind: 'mostlyClear',
    label: 'Casi despejado',
    nightLabel: 'Casi despejado',
    icon: 'sun-haze',
    nightIcon: 'moon-haze',
  },
  2: { kind: 'partlyCloudy', label: 'Nubes y claros', icon: 'sun-cloud', nightIcon: 'moon-cloud' },
  3: { kind: 'overcast', label: 'Cielo cubierto', icon: 'cloud' },

  45: { kind: 'fog', label: 'Niebla', icon: 'fog' },
  48: { kind: 'fog', label: 'Niebla helada', icon: 'fog' },

  51: { kind: 'drizzle', label: 'Llovizna débil', icon: 'drizzle' },
  53: { kind: 'drizzle', label: 'Llovizna', icon: 'drizzle' },
  55: { kind: 'drizzle', label: 'Llovizna intensa', icon: 'drizzle' },
  56: { kind: 'sleet', label: 'Llovizna helada', icon: 'sleet' },
  57: { kind: 'sleet', label: 'Llovizna helada intensa', icon: 'sleet' },

  61: { kind: 'rain', label: 'Lluvia débil', icon: 'rain-light' },
  63: { kind: 'rain', label: 'Lluvia', icon: 'rain' },
  65: { kind: 'heavyRain', label: 'Lluvia fuerte', icon: 'rain-heavy' },
  66: { kind: 'sleet', label: 'Lluvia helada', icon: 'sleet' },
  67: { kind: 'sleet', label: 'Lluvia helada fuerte', icon: 'sleet' },

  71: { kind: 'snow', label: 'Nieve débil', icon: 'snow' },
  73: { kind: 'snow', label: 'Nieve', icon: 'snow' },
  75: { kind: 'heavySnow', label: 'Nieve intensa', icon: 'snow-heavy' },
  77: { kind: 'snow', label: 'Nieve granulada', icon: 'snow' },

  80: { kind: 'rain', label: 'Chubascos débiles', icon: 'rain-light' },
  81: { kind: 'rain', label: 'Chubascos', icon: 'rain' },
  82: { kind: 'heavyRain', label: 'Chubascos fuertes', icon: 'rain-heavy' },
  85: { kind: 'snow', label: 'Chubascos de nieve', icon: 'snow' },
  86: { kind: 'heavySnow', label: 'Nevadas fuertes', icon: 'snow-heavy' },

  95: { kind: 'storm', label: 'Tormenta', icon: 'storm' },
  96: { kind: 'storm', label: 'Tormenta con granizo', icon: 'storm' },
  99: { kind: 'storm', label: 'Tormenta fuerte', icon: 'storm' },
};

const FALLBACK: CodeEntry = { kind: 'partlyCloudy', label: 'Sin datos', icon: 'cloud' };

const FAMILY: Record<WeatherKind, WeatherFamily> = {
  clear: 'sky',
  mostlyClear: 'sky',
  partlyCloudy: 'sky',
  cloudy: 'sky',
  overcast: 'sky',
  fog: 'fog',
  drizzle: 'rain',
  rain: 'rain',
  heavyRain: 'rain',
  sleet: 'snow',
  snow: 'snow',
  heavySnow: 'snow',
  storm: 'storm',
};

/** Normalizes a provider weather code into the internal semantic condition. */
export function describeWeatherCode(code: number, isDay = true): WeatherCondition {
  const entry = CODES[code] ?? FALLBACK;
  const label = (!isDay && entry.nightLabel) || entry.label;
  const icon = (!isDay && entry.nightIcon) || entry.icon;
  return { code, kind: entry.kind, family: FAMILY[entry.kind], label, icon };
}

export function weatherFamily(kind: WeatherKind): WeatherFamily {
  return FAMILY[kind];
}

/** True for any kind that puts water or ice in the air. */
export function isPrecipitating(kind: WeatherKind): boolean {
  const family = FAMILY[kind];
  return family === 'rain' || family === 'snow' || family === 'storm';
}

/**
 * Rough 0-1 "how much sky is hidden" hint used when cloud-cover data is
 * missing. Real cloud-cover percentages are always preferred.
 */
export function impliedCloudCover(kind: WeatherKind): number {
  switch (kind) {
    case 'clear':
      return 0.02;
    case 'mostlyClear':
      return 0.18;
    case 'partlyCloudy':
      return 0.45;
    case 'cloudy':
      return 0.72;
    case 'overcast':
    case 'fog':
      return 0.95;
    case 'drizzle':
      return 0.85;
    case 'rain':
      return 0.92;
    case 'heavyRain':
    case 'storm':
      return 0.98;
    case 'sleet':
    case 'snow':
      return 0.9;
    case 'heavySnow':
      return 0.97;
  }
}
