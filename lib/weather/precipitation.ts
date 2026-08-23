/**
 * Rain and snow particle simulation.
 *
 * Kept out of the React component and free of any DOM dependency beyond a
 * minimal 2D drawing interface, so the part most likely to harbour a subtle bug
 * — the part that runs sixty times a second — can be unit tested rather than
 * squinted at.
 *
 * Depth comes from three discrete layers rather than per-particle variation,
 * which is both why it reads as weather and why it is cheap: every particle in a
 * layer shares a colour and a width, so a layer is one path and one draw call.
 * A full downpour is six draw calls a frame.
 */

/** The slice of `CanvasRenderingContext2D` this module actually uses. */
export interface Canvas2D {
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  clearRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  stroke(): void;
  fill(): void;
}

export interface RainLayer {
  /** Share of the total particle budget. */
  share: number;
  /** Fall speed in px/s. */
  speed: number;
  length: number;
  alpha: number;
  width: number;
  /** How hard the wind pushes this layer sideways. */
  tilt: number;
}

export const RAIN_LAYERS: readonly RainLayer[] = [
  { share: 0.42, speed: 620, length: 7, alpha: 0.12, width: 0.7, tilt: 0.5 },
  { share: 0.34, speed: 900, length: 15, alpha: 0.2, width: 1.05, tilt: 0.72 },
  { share: 0.24, speed: 1260, length: 27, alpha: 0.3, width: 1.6, tilt: 1 },
];

export interface SnowLayer {
  share: number;
  speed: number;
  radius: number;
  alpha: number;
  /** Horizontal sway amplitude, px. */
  sway: number;
  /** Sway frequency, cycles per second. */
  swayRate: number;
}

export const SNOW_LAYERS: readonly SnowLayer[] = [
  { share: 0.44, speed: 18, radius: 0.8, alpha: 0.34, sway: 10, swayRate: 0.5 },
  { share: 0.34, speed: 32, radius: 1.4, alpha: 0.52, sway: 18, swayRate: 0.36 },
  { share: 0.22, speed: 52, radius: 2.3, alpha: 0.7, sway: 28, swayRate: 0.24 },
];

export interface Particle {
  x: number;
  y: number;
  /** Sway offset, so flakes in a layer do not swing in unison. */
  phase: number;
}

export interface FieldSize {
  width: number;
  height: number;
}

export interface PrecipitationField {
  rain: Particle[][];
  snow: Particle[][];
  random: () => number;
}

/** Particles spawn and wrap within this margin either side of the viewport. */
const MARGIN = 120;

/**
 * Allocates the particle pools once.
 *
 * Pools are sized for the heaviest downpour and then only partly *used*: an
 * intensity of 0.3 draws the first 30 % of each pool. Nothing is allocated
 * while the weather changes.
 */
export function createField(
  size: FieldSize,
  budget: { rain: number; snow: number },
  random: () => number = Math.random,
): PrecipitationField {
  const spawn = (spread: boolean): Particle => ({
    x: random() * (size.width + MARGIN * 2) - MARGIN,
    y: spread ? random() * size.height : -40 - random() * 80,
    phase: random() * Math.PI * 2,
  });

  return {
    rain: RAIN_LAYERS.map((layer) =>
      Array.from({ length: Math.ceil(budget.rain * layer.share) }, () => spawn(true)),
    ),
    snow: SNOW_LAYERS.map((layer) =>
      Array.from({ length: Math.ceil(budget.snow * layer.share) }, () => spawn(true)),
    ),
    random,
  };
}

export interface FrameParams {
  /** 0-1 rain intensity. */
  rain: number;
  /** 0-1 snow intensity. */
  snow: number;
  /** Wind speed in km/h. */
  wind: number;
  /** Seconds since the previous frame. */
  delta: number;
  /** Seconds since the animation began, for the sway phase. */
  elapsed: number;
}

/** Wraps a particle back into the field once it leaves. */
function recycle(particle: Particle, size: FieldSize, random: () => number, exitY: number): void {
  if (particle.y > size.height + exitY) {
    particle.y = -exitY - random() * 60;
    particle.x = random() * (size.width + MARGIN * 2) - MARGIN;
  }
  const span = size.width + MARGIN * 2;
  if (particle.x < -MARGIN - 20) particle.x += span;
  else if (particle.x > size.width + MARGIN + 20) particle.x -= span;
}

/**
 * Advances and draws one frame.
 *
 * Mutates the field in place and issues at most one stroke or fill per layer.
 */
export function drawPrecipitation(
  context: Canvas2D,
  field: PrecipitationField,
  size: FieldSize,
  params: FrameParams,
): void {
  const { rain, snow, wind, delta, elapsed } = params;
  context.clearRect(0, 0, size.width, size.height);

  if (rain > 0.01) {
    for (let index = 0; index < RAIN_LAYERS.length; index += 1) {
      const layer = RAIN_LAYERS[index];
      const pool = field.rain[index];
      const count = Math.round(pool.length * Math.min(1, rain));
      if (count === 0) continue;

      const drift = wind * layer.tilt * 1.6;
      const slant = (drift / layer.speed) * layer.length;

      context.beginPath();
      for (let i = 0; i < count; i += 1) {
        const particle = pool[i];
        particle.y += layer.speed * delta;
        particle.x += drift * delta;
        recycle(particle, size, field.random, 40);
        context.moveTo(particle.x, particle.y);
        context.lineTo(particle.x - slant, particle.y - layer.length);
      }
      context.strokeStyle = `rgba(218, 232, 245, ${layer.alpha * Math.min(1, rain * 1.15)})`;
      context.lineWidth = layer.width;
      context.lineCap = 'round';
      context.stroke();
    }
  }

  if (snow > 0.01) {
    for (let index = 0; index < SNOW_LAYERS.length; index += 1) {
      const layer = SNOW_LAYERS[index];
      const pool = field.snow[index];
      const count = Math.round(pool.length * Math.min(1, snow));
      if (count === 0) continue;

      const drift = wind * 0.5;

      context.beginPath();
      for (let i = 0; i < count; i += 1) {
        const particle = pool[i];
        particle.y += layer.speed * delta;
        particle.x += drift * delta;
        recycle(particle, size, field.random, 20);
        const sway = Math.sin(elapsed * layer.swayRate * Math.PI + particle.phase) * layer.sway;
        const x = particle.x + sway;
        context.moveTo(x + layer.radius, particle.y);
        context.arc(x, particle.y, layer.radius, 0, Math.PI * 2);
      }
      context.fillStyle = `rgba(244, 248, 253, ${layer.alpha * Math.min(1, snow * 1.2)})`;
      context.fill();
    }
  }
}
