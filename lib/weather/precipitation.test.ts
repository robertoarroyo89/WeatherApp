import { describe, expect, it } from 'vitest';
import {
  createField,
  drawPrecipitation,
  RAIN_LAYERS,
  SNOW_LAYERS,
  type Canvas2D,
  type FrameParams,
} from './precipitation';

/** Records every drawing call so a frame can be asserted on. */
function recorder() {
  const calls: Array<{ op: string; args: number[] }> = [];
  const styles: string[] = [];
  const context: Canvas2D = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    clearRect: (...args) => calls.push({ op: 'clearRect', args }),
    beginPath: () => calls.push({ op: 'beginPath', args: [] }),
    moveTo: (...args) => calls.push({ op: 'moveTo', args }),
    lineTo: (...args) => calls.push({ op: 'lineTo', args }),
    arc: (...args) => calls.push({ op: 'arc', args }),
    stroke: () => {
      styles.push(String(context.strokeStyle));
      calls.push({ op: 'stroke', args: [] });
    },
    fill: () => {
      styles.push(String(context.fillStyle));
      calls.push({ op: 'fill', args: [] });
    },
  };
  return {
    context,
    calls,
    styles,
    count: (op: string) => calls.filter((call) => call.op === op).length,
    of: (op: string) => calls.filter((call) => call.op === op),
  };
}

const SIZE = { width: 400, height: 800 };
const BUDGET = { rain: 300, snow: 180 };

// Each layer rounds its share up, so the pools total a shade over the budget.
const RAIN_POOL = RAIN_LAYERS.reduce(
  (total, layer) => total + Math.ceil(BUDGET.rain * layer.share),
  0,
);
const SNOW_POOL = SNOW_LAYERS.reduce(
  (total, layer) => total + Math.ceil(BUDGET.snow * layer.share),
  0,
);

/** Deterministic stand-in for Math.random. */
function sequence(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

const frame = (overrides: Partial<FrameParams> = {}): FrameParams => ({
  rain: 0,
  snow: 0,
  wind: 0,
  delta: 1 / 60,
  elapsed: 0,
  ...overrides,
});

describe('createField', () => {
  it('allocates each layer its share of the budget', () => {
    const field = createField(SIZE, BUDGET, sequence([0.5]));
    expect(field.rain).toHaveLength(RAIN_LAYERS.length);
    expect(field.snow).toHaveLength(SNOW_LAYERS.length);
    RAIN_LAYERS.forEach((layer, index) => {
      expect(field.rain[index].length).toBe(Math.ceil(BUDGET.rain * layer.share));
    });
  });

  it('spreads the initial particles through the field rather than above it', () => {
    const field = createField(SIZE, BUDGET, sequence([0.1, 0.5, 0.9, 0.3]));
    const all = field.rain.flat();
    expect(all.every((particle) => particle.y >= 0 && particle.y <= SIZE.height)).toBe(true);
  });
});

describe('drawPrecipitation', () => {
  it('draws nothing but the clear when there is no precipitation', () => {
    const draw = recorder();
    drawPrecipitation(draw.context, createField(SIZE, BUDGET), SIZE, frame());
    expect(draw.count('clearRect')).toBe(1);
    expect(draw.count('stroke')).toBe(0);
    expect(draw.count('fill')).toBe(0);
    expect(draw.count('moveTo')).toBe(0);
  });

  it('batches each rain layer into a single stroke', () => {
    const draw = recorder();
    drawPrecipitation(draw.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 1 }));
    // Three layers, three strokes — not one per drop.
    expect(draw.count('stroke')).toBe(RAIN_LAYERS.length);
    expect(draw.count('beginPath')).toBe(RAIN_LAYERS.length);
    expect(draw.count('lineTo')).toBe(RAIN_POOL);
  });

  it('batches each snow layer into a single fill', () => {
    const draw = recorder();
    drawPrecipitation(draw.context, createField(SIZE, BUDGET), SIZE, frame({ snow: 1 }));
    expect(draw.count('fill')).toBe(SNOW_LAYERS.length);
    expect(draw.count('arc')).toBe(SNOW_POOL);
  });

  it('scales the particle count with intensity', () => {
    const light = recorder();
    drawPrecipitation(light.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 0.25 }));
    const heavy = recorder();
    drawPrecipitation(heavy.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 1 }));
    expect(light.count('lineTo')).toBeGreaterThan(0);
    expect(light.count('lineTo')).toBeLessThan(heavy.count('lineTo') / 2);
  });

  it('never exceeds the pool even if intensity overshoots', () => {
    const draw = recorder();
    drawPrecipitation(draw.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 4 }));
    expect(draw.count('lineTo')).toBe(RAIN_POOL);
  });

  it('slants the streaks downwind, and leaves them vertical in still air', () => {
    const still = recorder();
    drawPrecipitation(still.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 1 }));
    const stillPair = [still.of('moveTo')[0], still.of('lineTo')[0]];
    expect(stillPair[1].args[0]).toBeCloseTo(stillPair[0].args[0], 6);

    const windy = recorder();
    drawPrecipitation(windy.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 1, wind: 60 }));
    const windyPair = [windy.of('moveTo')[0], windy.of('lineTo')[0]];
    // The tail sits upwind of the head, so the streak leans.
    expect(windyPair[1].args[0]).toBeLessThan(windyPair[0].args[0] - 0.4);
  });

  it('moves particles downward over time, proportionally to delta', () => {
    const field = createField(SIZE, BUDGET, sequence([0.5]));
    const before = field.rain[0][0].y;
    drawPrecipitation(recorder().context, field, SIZE, frame({ rain: 1, delta: 0.5 }));
    const after = field.rain[0][0].y;
    expect(after - before).toBeCloseTo(RAIN_LAYERS[0].speed * 0.5, 4);
  });

  it('recycles particles back to the top instead of letting them run away', () => {
    const field = createField(SIZE, BUDGET, sequence([0.5]));
    for (let i = 0; i < 400; i += 1) {
      drawPrecipitation(recorder().context, field, SIZE, frame({ rain: 1, delta: 1 / 30 }));
    }
    const all = field.rain.flat();
    expect(all.every((particle) => particle.y <= SIZE.height + 40)).toBe(true);
    expect(all.every((particle) => particle.y >= -110)).toBe(true);
  });

  it('wraps particles horizontally under strong wind', () => {
    const field = createField(SIZE, BUDGET, sequence([0.5]));
    for (let i = 0; i < 600; i += 1) {
      drawPrecipitation(
        recorder().context,
        field,
        SIZE,
        frame({ rain: 1, wind: 120, delta: 1 / 30 }),
      );
    }
    const all = field.rain.flat();
    expect(all.every((particle) => particle.x > -200 && particle.x < SIZE.width + 200)).toBe(true);
  });

  it('makes heavier precipitation more opaque', () => {
    const light = recorder();
    drawPrecipitation(light.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 0.2 }));
    const heavy = recorder();
    drawPrecipitation(heavy.context, createField(SIZE, BUDGET), SIZE, frame({ rain: 1 }));
    const alphaOf = (style: string) => Number(/([\d.]+)\)$/.exec(style)?.[1] ?? 0);
    expect(alphaOf(light.styles[0])).toBeLessThan(alphaOf(heavy.styles[0]));
  });

  it('sways snow sideways as time passes', () => {
    const field = createField(SIZE, BUDGET, sequence([0.5]));
    const first = recorder();
    drawPrecipitation(first.context, field, SIZE, frame({ snow: 1, elapsed: 0 }));
    const later = recorder();
    drawPrecipitation(later.context, field, SIZE, frame({ snow: 1, elapsed: 1.1 }));
    const x1 = first.of('arc')[0].args[0];
    const x2 = later.of('arc')[0].args[0];
    expect(Math.abs(x2 - x1)).toBeGreaterThan(1);
  });

  it('can render rain and snow together, as sleet', () => {
    const draw = recorder();
    drawPrecipitation(
      draw.context,
      createField(SIZE, BUDGET),
      SIZE,
      frame({ rain: 0.5, snow: 0.5 }),
    );
    expect(draw.count('stroke')).toBe(RAIN_LAYERS.length);
    expect(draw.count('fill')).toBe(SNOW_LAYERS.length);
  });

  it('produces only finite coordinates', () => {
    const field = createField(SIZE, BUDGET, sequence([0.5]));
    const draw = recorder();
    for (let i = 0; i < 30; i += 1) {
      drawPrecipitation(
        draw.context,
        field,
        SIZE,
        frame({ rain: 1, snow: 1, wind: 45, delta: 1 / 60, elapsed: i / 60 }),
      );
    }
    const coords = draw.calls.flatMap((call) => call.args);
    expect(coords.every((value) => Number.isFinite(value))).toBe(true);
  });
});
