import { formatDuration, isoTime, uvLabel, windOrigin } from '@/lib/format';
import { rainOutlook, upcomingHours } from './series';
import type { AirQuality, HourlyPoint, WeatherBundle, WeatherKind } from './types';

/**
 * Deterministic Spanish copy generation.
 *
 * No model, no API — just rules over the numbers. Two goals drive every
 * template here:
 *
 *  1. Say the useful thing, not every thing. A summary that lists humidity,
 *     pressure and dew point tells you nothing; "refrescará después de las
 *     20:00" tells you to take a jacket.
 *  2. Sound like a person from Spain. "No parece que vaya a llover" over
 *     "Probabilidad de precipitación: 4 %".
 *
 * Output is a pure function of the forecast, so the same weather always reads
 * the same way.
 */

export interface CopyBlock {
  headline: string;
  detail: string | null;
}

type Gender = 'm' | 'f';

interface DayPartWord {
  word: string;
  gender: Gender;
  /** "esta tarde", "al mediodía" — used mid-sentence. */
  phrase: string;
  /** "de la tarde", "del mediodía" — used after "buena parte". */
  possessive: string;
}

function dayPartWord(hour: number): DayPartWord {
  if (hour < 6) {
    return {
      word: 'Madrugada',
      gender: 'f',
      phrase: 'de madrugada',
      possessive: 'de la madrugada',
    };
  }
  if (hour < 12) {
    return { word: 'Mañana', gender: 'f', phrase: 'esta mañana', possessive: 'de la mañana' };
  }
  if (hour < 15) {
    return { word: 'Mediodía', gender: 'm', phrase: 'al mediodía', possessive: 'del mediodía' };
  }
  if (hour < 21) {
    return { word: 'Tarde', gender: 'f', phrase: 'esta tarde', possessive: 'de la tarde' };
  }
  return { word: 'Noche', gender: 'f', phrase: 'esta noche', possessive: 'de la noche' };
}

interface Adjective {
  m: string;
  f: string;
}

const TEMPERATURE_WORDS: Array<{ below: number; adjective: Adjective }> = [
  { below: -2, adjective: { m: 'glacial', f: 'glacial' } },
  { below: 3, adjective: { m: 'helado', f: 'helada' } },
  { below: 8, adjective: { m: 'muy frío', f: 'muy fría' } },
  { below: 13, adjective: { m: 'frío', f: 'fría' } },
  { below: 17, adjective: { m: 'fresco', f: 'fresca' } },
  { below: 21, adjective: { m: 'suave', f: 'suave' } },
  { below: 25, adjective: { m: 'agradable', f: 'agradable' } },
  { below: 29, adjective: { m: 'cálido', f: 'cálida' } },
  { below: 33, adjective: { m: 'caluroso', f: 'calurosa' } },
  { below: 38, adjective: { m: 'muy caluroso', f: 'muy calurosa' } },
  { below: Infinity, adjective: { m: 'asfixiante', f: 'asfixiante' } },
];

function temperatureAdjective(apparent: number, gender: Gender): string {
  const entry =
    TEMPERATURE_WORDS.find((item) => apparent < item.below) ??
    TEMPERATURE_WORDS[TEMPERATURE_WORDS.length - 1];
  return entry.adjective[gender];
}

interface ConditionClause {
  /** Gendered adjective, joined with "y". */
  adjective?: Adjective;
  /** Prepositional phrase, joined without a conjunction. */
  phrase?: string;
}

const CONDITION_CLAUSES: Record<WeatherKind, ConditionClause> = {
  clear: { adjective: { m: 'despejado', f: 'despejada' } },
  mostlyClear: { phrase: 'con algunas nubes' },
  partlyCloudy: { phrase: 'con nubes y claros' },
  cloudy: { adjective: { m: 'nublado', f: 'nublada' } },
  overcast: { adjective: { m: 'gris', f: 'gris' } },
  fog: { phrase: 'con niebla' },
  drizzle: { phrase: 'de llovizna' },
  rain: { phrase: 'de lluvia' },
  heavyRain: { phrase: 'de lluvia fuerte' },
  sleet: { phrase: 'de aguanieve' },
  snow: { phrase: 'de nieve' },
  heavySnow: { phrase: 'de nieve intensa' },
  storm: { phrase: 'de tormenta' },
};

/**
 * "Tarde calurosa y despejada." / "Mañana fresca de lluvia."
 *
 * Both the temperature word and the condition word agree with the gender of the
 * daypart noun, which is the difference between copy that reads as Spanish and
 * copy that reads as a translation.
 */
export function getCurrentHeadline(bundle: WeatherBundle): string {
  return buildHeadline(
    Number.parseInt(bundle.current.time.slice(11, 13), 10) || 0,
    bundle.current.apparentTemperature,
    bundle.current.condition.kind,
  );
}

/** Kinds severe enough that nobody cares what the temperature is doing. */
const DOMINANT_KINDS = new Set<WeatherKind>(['heavyRain', 'heavySnow', 'storm']);

function buildHeadline(hour: number, apparent: number, kind: WeatherKind): string {
  const part = dayPartWord(hour);
  const clause = CONDITION_CLAUSES[kind];

  // "Tarde suave de lluvia fuerte" is grammatical and slightly absurd: in a
  // downpour the weather is the headline, not how mild it happens to be.
  if (DOMINANT_KINDS.has(kind) && clause.phrase) {
    return `${part.word} ${clause.phrase}.`;
  }

  const temp = temperatureAdjective(apparent, part.gender);
  if (clause.phrase) return `${part.word} ${temp} ${clause.phrase}.`;
  const conditionWord = clause.adjective ? clause.adjective[part.gender] : '';
  return `${part.word} ${temp} y ${conditionWord}.`;
}

/**
 * Headline plus context.
 *
 * The detail line is deliberately the temperature trend rather than the next
 * event: the event already has its own slot in the interface, and having both
 * say "el sol se pone a las 20:46" in two different registers is the kind of
 * redundancy that makes generated copy feel generated.
 */
export function getCurrentSummary(bundle: WeatherBundle, nowTs: number): CopyBlock {
  return {
    headline: getCurrentHeadline(bundle),
    detail: getTemperatureTrendSummary(bundle, nowTs),
  };
}

/* ------------------------------------------------------------------- rain -- */

export function getRainSummary(bundle: WeatherBundle, nowTs: number): CopyBlock {
  const hours = upcomingHours(bundle, nowTs, 24);
  if (!hours.length) return { headline: 'Sin datos de lluvia.', detail: null };

  const now = hours[0];
  const ahead = hours.slice(1);
  const next12 = ahead.slice(0, 12);
  const rainingNow = rainOutlook(now).confidence !== 'none' && bundle.current.precipitation > 0.05;

  if (rainingNow) {
    const dry = ahead.find((point) => rainOutlook(point).confidence === 'none');
    const total = next12.reduce((sum, point) => sum + point.precipitation, 0);
    const detail = dry
      ? `Debería parar sobre las ${isoTime(dry.time)}.`
      : 'No parece que pare en las próximas horas.';
    return {
      headline: total >= 4 ? 'Está lloviendo con ganas.' : 'Está lloviendo.',
      detail,
    };
  }

  const wet = next12.filter((point) => rainOutlook(point).confidence !== 'none');
  if (!wet.length) {
    const later = ahead.find((point) => rainOutlook(point).confidence !== 'none');
    if (later) {
      return {
        headline: 'No parece que vaya a llover.',
        detail: `Habrá que mirarlo mañana a partir de las ${isoTime(later.time)}.`,
      };
    }
    return {
      headline: 'No parece que vaya a llover.',
      detail: 'Puedes dejar el paraguas en casa.',
    };
  }

  const first = wet[0];
  const likely = wet.some((point) => rainOutlook(point).confidence === 'likely');
  const total = wet.reduce((sum, point) => sum + point.precipitation, 0);
  const part = dayPartWord(first.hour);

  let headline: string;
  if (!likely) {
    headline = `Puede caer algo ${part.phrase}.`;
  } else if (wet.length >= 5) {
    headline = `Lloverá durante buena parte ${part.possessive}.`;
  } else {
    headline = `Lluvia probable a partir de las ${isoTime(first.time)}.`;
  }

  const amount =
    total >= 15
      ? 'Se espera bastante agua.'
      : total >= 4
        ? `Unos ${Math.round(total)} mm en total.`
        : 'Poca cantidad, nada serio.';

  return { headline, detail: amount };
}

/* ------------------------------------------------------- temperature trend -- */

export function getTemperatureTrendSummary(bundle: WeatherBundle, nowTs: number): string | null {
  const hours = upcomingHours(bundle, nowTs, 9);
  if (hours.length < 4) return null;
  const reference = hours[0].temperature;
  let coldest = hours[1];
  let warmest = hours[1];
  for (const point of hours.slice(1)) {
    if (point.temperature < coldest.temperature) coldest = point;
    if (point.temperature > warmest.temperature) warmest = point;
  }
  const drop = reference - coldest.temperature;
  const rise = warmest.temperature - reference;

  if (drop >= 4) {
    return drop >= 8
      ? `Refrescará bastante al caer el sol, hasta ${Math.round(coldest.temperature)}°.`
      : `Bajará a ${Math.round(coldest.temperature)}° después de las ${isoTime(coldest.time)}.`;
  }
  if (rise >= 5) {
    return `Subirá hasta ${Math.round(warmest.temperature)}° sobre las ${isoTime(warmest.time)}.`;
  }
  return 'La temperatura se mantendrá parecida durante horas.';
}

/* ------------------------------------------------------------------- wind -- */

export function windStrengthLabel(kmh: number): string {
  if (kmh < 5) return 'Aire en calma';
  if (kmh < 12) return 'Viento flojo';
  if (kmh < 20) return 'Brisa suave';
  if (kmh < 29) return 'Viento moderado';
  if (kmh < 39) return 'Viento fuerte';
  if (kmh < 50) return 'Viento muy fuerte';
  return 'Viento fortísimo';
}

export function getWindSummary(bundle: WeatherBundle, nowTs: number): CopyBlock {
  const { windSpeed, windGusts, windDirection } = bundle.current;
  const hours = upcomingHours(bundle, nowTs, 12).slice(1);
  const peak = hours.reduce((best, point) => (point.windGusts > best ? point.windGusts : best), 0);

  const headline = windStrengthLabel(windSpeed);
  let detail: string | null = `Sopla ${windOrigin(windDirection)}.`;

  if (windGusts >= 45) {
    detail = `Con rachas de hasta ${Math.round(windGusts)} km/h.`;
  } else if (peak >= 50) {
    const gustHour = hours.find((point) => point.windGusts >= 50);
    detail = gustHour ? `Rachas fuertes a partir de las ${isoTime(gustHour.time)}.` : detail;
  } else if (windSpeed < 5) {
    detail = 'No se mueve una hoja.';
  }

  return { headline, detail };
}

/* --------------------------------------------------------------------- uv -- */

export function getUvSummary(uv: number | null, isDay: boolean): CopyBlock {
  if (uv === null) return { headline: 'Sin datos de UV.', detail: null };
  if (!isDay || uv < 0.5) {
    return { headline: 'Sin radiación', detail: 'De noche no hay nada que proteger.' };
  }
  const label = uvLabel(uv);
  if (uv < 3) return { headline: label, detail: 'Puedes estar al sol sin preocuparte.' };
  if (uv < 6) return { headline: label, detail: 'Con crema si vas a estar un buen rato.' };
  if (uv < 8) return { headline: label, detail: 'Mejor buscar sombra en las horas centrales.' };
  if (uv < 11) return { headline: label, detail: 'El sol pega fuerte: crema, gorra y sombra.' };
  return { headline: label, detail: 'Evita el sol directo todo lo que puedas.' };
}

/* -------------------------------------------------------------------- air -- */

export function getAirSummary(air: AirQuality | null): CopyBlock {
  if (!air || air.europeanAqi === null) {
    return { headline: 'Sin datos', detail: 'No hay medidas de calidad del aire para esta zona.' };
  }
  const aqi = air.europeanAqi;
  if (aqi <= 20) return { headline: 'Muy buena', detail: 'Puedes ventilar sin problema.' };
  if (aqi <= 40) return { headline: 'Buena', detail: 'Aire limpio, buen momento para salir.' };
  if (aqi <= 60) {
    return {
      headline: 'Regular',
      detail: 'Aceptable, aunque no es el mejor día para esfuerzos largos al aire libre.',
    };
  }
  if (aqi <= 80) {
    return { headline: 'Mala', detail: 'Mejor evitar el ejercicio intenso en la calle.' };
  }
  if (aqi <= 100) {
    return {
      headline: 'Muy mala',
      detail: 'Limita la actividad al aire libre y ventila poco rato.',
    };
  }
  return { headline: 'Pésima', detail: 'Evita salir si puedes y mantén las ventanas cerradas.' };
}

export function getPollenSummary(air: AirQuality | null): string | null {
  if (!air || !air.pollen.length) return null;
  const active = air.pollen.filter((reading) => reading.value >= 1);
  if (!active.length) return 'Apenas hay polen en el aire.';
  const worst = active.reduce((best, item) => (item.value > best.value ? item : best), active[0]);
  if (worst.level === 'veryHigh' || worst.level === 'extreme') {
    return `Mucho polen de ${worst.label.toLowerCase()}. Mal día para alérgicos.`;
  }
  if (worst.level === 'high') {
    return `Nivel alto de ${worst.label.toLowerCase()}.`;
  }
  return `Algo de polen de ${worst.label.toLowerCase()}, nada preocupante.`;
}

/* ------------------------------------------------------------------ solar -- */

export function getDaylightSummary(daylightSeconds: number, deltaSeconds: number | null): string {
  const base = `${formatDuration(daylightSeconds)} de luz`;
  if (deltaSeconds === null || Math.abs(deltaSeconds) < 60) return `${base}.`;
  const minutes = Math.round(Math.abs(deltaSeconds) / 60);
  return deltaSeconds > 0
    ? `${base}, ${minutes} min más que ayer.`
    : `${base}, ${minutes} min menos que ayer.`;
}

/* ------------------------------------------------------------- ten day view -- */

/** A single contextual line for the 10-day list, e.g. "Más calor el miércoles." */
export function getForecastHighlight(bundle: WeatherBundle, nowTs: number): string | null {
  const days = bundle.daily.filter((day) => day.timestamp >= nowTs - 86_400_000).slice(0, 10);
  if (days.length < 3) return null;

  const today = days[0];
  const rest = days.slice(1);
  const hottest = rest.reduce(
    (best, day) => (day.temperatureMax > best.temperatureMax ? day : best),
    rest[0],
  );
  const wettest = rest.reduce(
    (best, day) => (day.precipitationSum > best.precipitationSum ? day : best),
    rest[0],
  );

  const weekday = (timestamp: number) =>
    new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: bundle.timezone }).format(
      timestamp,
    );

  if (wettest.precipitationSum >= 5) {
    return `El ${weekday(wettest.timestamp)} es el día de lluvia.`;
  }
  if (hottest.temperatureMax - today.temperatureMax >= 4) {
    return `Más calor el ${weekday(hottest.timestamp)}.`;
  }
  const coldest = rest.reduce(
    (best, day) => (day.temperatureMax < best.temperatureMax ? day : best),
    rest[0],
  );
  if (today.temperatureMax - coldest.temperatureMax >= 5) {
    return `Bajón de temperatura el ${weekday(coldest.timestamp)}.`;
  }
  const anyRain = rest.some((day) => day.precipitationSum >= 1);
  if (!anyRain) return 'Semana estable, sin lluvia a la vista.';
  return null;
}

/** Short label for an hourly point, used by the scrubber. */
export function getScrubSummary(point: HourlyPoint): string {
  return buildHeadline(point.hour, point.apparentTemperature, point.condition.kind);
}
