import { describe, expect, it } from 'vitest';
import { bundle, current, hour, hourRun, localTs } from '@/lib/testing/fixtures';
import { describeWeatherCode } from './codes';
import { findNextEvent } from './events';
import {
  getAirSummary,
  getCurrentHeadline,
  getCurrentSummary,
  getForecastHighlight,
  getPollenSummary,
  getRainSummary,
  getScrubSummary,
  getTemperatureTrendSummary,
  getUvSummary,
  getWindSummary,
  windStrengthLabel,
} from './summary';
import { day } from '@/lib/testing/fixtures';
import type { AirQuality } from './types';

const NOW = localTs('2026-08-23T14:00');

describe('getCurrentHeadline', () => {
  it('agrees in gender with the daypart noun', () => {
    const afternoon = getCurrentHeadline(
      bundle({ current: current('2026-08-23T17:00', { apparentTemperature: 30 }) }),
    );
    expect(afternoon).toBe('Tarde calurosa y despejada.');

    const midday = getCurrentHeadline(
      bundle({ current: current('2026-08-23T13:00', { apparentTemperature: 30 }) }),
    );
    expect(midday).toBe('Mediodía caluroso y despejado.');
  });

  it('names each part of the day', () => {
    const at = (hour: string) =>
      getCurrentHeadline(
        bundle({ current: current(`2026-08-23T${hour}`, { apparentTemperature: 19 }) }),
      );
    expect(at('03:00')).toMatch(/^Madrugada suave/);
    expect(at('09:00')).toMatch(/^Mañana suave/);
    expect(at('13:00')).toMatch(/^Mediodía suave/);
    expect(at('18:00')).toMatch(/^Tarde suave/);
    expect(at('22:00')).toMatch(/^Noche suave/);
  });

  it('scales the temperature word across the whole range', () => {
    const at = (apparent: number) =>
      getCurrentHeadline(
        bundle({ current: current('2026-08-23T17:00', { apparentTemperature: apparent }) }),
      );
    expect(at(-6)).toContain('glacial');
    expect(at(1)).toContain('helada');
    expect(at(10)).toContain('fría');
    expect(at(15)).toContain('fresca');
    expect(at(19)).toContain('suave');
    expect(at(23)).toContain('agradable');
    expect(at(27)).toContain('cálida');
    expect(at(31)).toContain('calurosa');
    expect(at(41)).toContain('asfixiante');
  });

  it('joins prepositional condition phrases without a stray conjunction', () => {
    const rainy = getCurrentHeadline(
      bundle({
        current: current('2026-08-23T17:00', {
          apparentTemperature: 15,
          condition: describeWeatherCode(63),
        }),
      }),
    );
    expect(rainy).toBe('Tarde fresca de lluvia.');
    expect(rainy).not.toContain(' y de');
  });

  it('covers every weather kind without producing a dangling sentence', () => {
    for (const code of [0, 1, 2, 3, 45, 53, 63, 65, 71, 75, 80, 95]) {
      const text = getCurrentHeadline(
        bundle({ current: current('2026-08-23T17:00', { condition: describeWeatherCode(code) }) }),
      );
      expect(text.endsWith('.')).toBe(true);
      expect(text).not.toMatch(/\s\.$/);
      expect(text).not.toMatch(/\sy\s\./);
    }
  });
});

describe('getCurrentSummary', () => {
  it('pairs a headline with the single most relevant change', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({
      temperature: i <= 14 ? 30 : 30 - (i - 14) * 2.5,
      apparentTemperature: i <= 14 ? 30 : 30 - (i - 14) * 2.5,
    }));
    const summary = getCurrentSummary(
      bundle({ hourly, current: current('2026-08-23T14:00', { apparentTemperature: 30 }) }),
      NOW,
    );
    expect(summary.headline).toBe('Mediodía caluroso y despejado.');
    expect(summary.detail).toMatch(/Refrescará/);
  });
});

describe('getRainSummary', () => {
  it('answers plainly when there is no rain coming', () => {
    const summary = getRainSummary(bundle(), NOW);
    expect(summary.headline).toBe('No parece que vaya a llover.');
    expect(summary.detail).toBe('Puedes dejar el paraguas en casa.');
  });

  it('reports rain in progress', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i >= 14 && i <= 16 ? { precipitation: 2, precipitationProbability: 90 } : {},
    );
    const summary = getRainSummary(
      bundle({ hourly, current: current('2026-08-23T14:00', { precipitation: 2 }) }),
      NOW,
    );
    expect(summary.headline).toMatch(/Está lloviendo/);
    expect(summary.detail).toBe('Debería parar sobre las 17:00.');
  });

  it('says when a long wet spell is coming, using the right daypart', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i >= 16 && i <= 21 ? { precipitation: 1.5, precipitationProbability: 85 } : {},
    );
    const summary = getRainSummary(bundle({ hourly }), NOW);
    expect(summary.headline).toBe('Lloverá durante buena parte de la tarde.');
  });

  it('hedges when only probability is high', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i === 18 ? { precipitationProbability: 60 } : {},
    );
    expect(getRainSummary(bundle({ hourly }), NOW).headline).toBe('Puede caer algo esta tarde.');
  });

  it('gives a start time for a short shower', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) =>
      i === 18 ? { precipitation: 1, precipitationProbability: 70 } : {},
    );
    expect(getRainSummary(bundle({ hourly }), NOW).headline).toBe(
      'Lluvia probable a partir de las 18:00.',
    );
  });
});

describe('getTemperatureTrendSummary', () => {
  it('describes a drop with the figure that matters', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({
      temperature: i <= 14 ? 30 : 30 - (i - 14) * 3,
    }));
    expect(getTemperatureTrendSummary(bundle({ hourly }), NOW)).toContain('Refrescará bastante');
  });

  it('describes a rise', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({
      temperature: i <= 14 ? 18 : 18 + (i - 14) * 2,
    }));
    expect(getTemperatureTrendSummary(bundle({ hourly }), NOW)).toMatch(/Subirá hasta \d+°/);
  });

  it('says so when nothing changes', () => {
    expect(getTemperatureTrendSummary(bundle(), NOW)).toBe(
      'La temperatura se mantendrá parecida durante horas.',
    );
  });
});

describe('getWindSummary', () => {
  it('labels wind strength on a Spanish scale', () => {
    expect(windStrengthLabel(2)).toBe('Aire en calma');
    expect(windStrengthLabel(9)).toBe('Viento flojo');
    expect(windStrengthLabel(15)).toBe('Brisa suave');
    expect(windStrengthLabel(24)).toBe('Viento moderado');
    expect(windStrengthLabel(33)).toBe('Viento fuerte');
    expect(windStrengthLabel(60)).toBe('Viento fortísimo');
  });

  it('mentions gusts when they are the story', () => {
    const summary = getWindSummary(
      bundle({ current: current('2026-08-23T14:00', { windSpeed: 30, windGusts: 58 }) }),
      NOW,
    );
    expect(summary.detail).toBe('Con rachas de hasta 58 km/h.');
  });

  it('names the wind direction in prose', () => {
    const summary = getWindSummary(
      bundle({ current: current('2026-08-23T14:00', { windSpeed: 14, windDirection: 45 }) }),
      NOW,
    );
    expect(summary.detail).toBe('Sopla del nordeste.');
  });
});

describe('getUvSummary', () => {
  it('gives advice that scales with the index', () => {
    expect(getUvSummary(1, true).detail).toContain('sin preocuparte');
    expect(getUvSummary(4, true).headline).toBe('Moderado');
    expect(getUvSummary(9, true).detail).toContain('crema');
    expect(getUvSummary(12, true).headline).toBe('Extremo');
  });

  it('does not lecture you about UV at night', () => {
    expect(getUvSummary(0, false).headline).toBe('Sin radiación');
  });

  it('handles missing data', () => {
    expect(getUvSummary(null, true).headline).toBe('Sin datos de UV.');
  });
});

describe('air summaries', () => {
  const air = (aqi: number | null, pollen: AirQuality['pollen'] = []): AirQuality => ({
    time: '2026-08-23T14:00',
    timestamp: NOW,
    europeanAqi: aqi,
    level: 'low',
    pm2_5: 6.9,
    pm10: 11.1,
    ozone: 92,
    nitrogenDioxide: 4,
    sulphurDioxide: 0.9,
    pollen,
  });

  it('translates AQI into something actionable', () => {
    expect(getAirSummary(air(15)).detail).toBe('Puedes ventilar sin problema.');
    expect(getAirSummary(air(70)).headline).toBe('Mala');
    expect(getAirSummary(air(130)).headline).toBe('Pésima');
  });

  it('degrades gracefully with no data', () => {
    expect(getAirSummary(null).headline).toBe('Sin datos');
    expect(getAirSummary(air(null)).headline).toBe('Sin datos');
  });

  it('summarises pollen by the worst active species', () => {
    expect(getPollenSummary(null)).toBeNull();
    expect(getPollenSummary(air(20, []))).toBeNull();
    expect(
      getPollenSummary(
        air(20, [{ species: 'grass', label: 'Gramíneas', value: 0.2, level: 'veryLow' }]),
      ),
    ).toBe('Apenas hay polen en el aire.');
    expect(
      getPollenSummary(
        air(20, [
          { species: 'grass', label: 'Gramíneas', value: 4, level: 'low' },
          { species: 'olive', label: 'Olivo', value: 120, level: 'veryHigh' },
        ]),
      ),
    ).toBe('Mucho polen de olivo. Mal día para alérgicos.');
  });
});

describe('getForecastHighlight', () => {
  it('picks out the rainy day', () => {
    const daily = [
      day('2026-08-23'),
      day('2026-08-24'),
      day('2026-08-25', { precipitationSum: 12 }),
      day('2026-08-26'),
    ];
    expect(getForecastHighlight(bundle({ daily }), NOW)).toBe('El martes es el día de lluvia.');
  });

  it('points at a coming heat rise', () => {
    const daily = [
      day('2026-08-23', { temperatureMax: 26 }),
      day('2026-08-24', { temperatureMax: 28 }),
      day('2026-08-25', { temperatureMax: 34 }),
    ];
    expect(getForecastHighlight(bundle({ daily }), NOW)).toBe('Más calor el martes.');
  });

  it('says the week is quiet when it is', () => {
    const daily = [day('2026-08-23'), day('2026-08-24'), day('2026-08-25')];
    expect(getForecastHighlight(bundle({ daily }), NOW)).toBe(
      'Semana estable, sin lluvia a la vista.',
    );
  });
});

describe('dominant weather in the headline', () => {
  const at = (code: number, apparent = 20) =>
    getCurrentHeadline(
      bundle({
        current: current('2026-08-23T17:00', {
          apparentTemperature: apparent,
          condition: describeWeatherCode(code),
        }),
      }),
    );

  it('drops the temperature word when the weather is the story', () => {
    expect(at(65)).toBe('Tarde de lluvia fuerte.');
    expect(at(95)).toBe('Tarde de tormenta.');
    expect(at(75)).toBe('Tarde de nieve intensa.');
  });

  it('keeps it for ordinary weather', () => {
    expect(at(63)).toBe('Tarde suave de lluvia.');
    expect(at(0)).toBe('Tarde suave y despejada.');
  });

  it('applies the same rule while scrubbing', () => {
    expect(getScrubSummary(hour('2026-08-23T17:00', { condition: describeWeatherCode(65) }))).toBe(
      'Tarde de lluvia fuerte.',
    );
  });
});

describe('summary and event do not restate each other', () => {
  it('gives the summary the trend and leaves the event its own slot', () => {
    // A quiet evening whose only news is the sunset: the classic case where the
    // summary used to echo the event marker word for word.
    const hourly = hourRun('2026-08-23T00:00', 30, () => ({
      temperature: 29,
      apparentTemperature: 31,
    }));
    const data = bundle({
      hourly,
      current: current('2026-08-23T19:00', { apparentTemperature: 31 }),
    });
    const summary = getCurrentSummary(data, localTs('2026-08-23T19:00'));
    const event = findNextEvent(data, localTs('2026-08-23T19:00'));

    expect(summary.detail).not.toBe(event?.detail ?? null);
    expect(summary.detail).toBe('La temperatura se mantendrá parecida durante horas.');
    expect(event?.kind).toBe('sunset');
  });

  it('still surfaces a cooling trend as the detail', () => {
    const hourly = hourRun('2026-08-23T00:00', 30, (i) => ({
      temperature: i <= 19 ? 30 : 30 - (i - 19) * 3,
    }));
    const summary = getCurrentSummary(
      bundle({ hourly, current: current('2026-08-23T19:00') }),
      localTs('2026-08-23T19:00'),
    );
    expect(summary.detail).toMatch(/Refrescará/);
  });
});
