/**
 * Weather glyphs.
 *
 * One weight, one geometry, no fills: thin strokes on a 24-unit grid, sharing a
 * single cloud path so that "nubes y claros" and "lluvia" are visibly the same
 * family. They carry information — the atmosphere behind them carries the mood,
 * which is why none of these needs to be colourful or cute.
 */

const CLOUD =
  'M7.2 17.6h9.9a3.35 3.35 0 0 0 .35-6.68 5.35 5.35 0 0 0-10.1-1.36A3.72 3.72 0 0 0 7.2 17.6Z';
const CLOUD_HIGH =
  'M8.4 13.9h8.3a2.85 2.85 0 0 0 .3-5.68 4.55 4.55 0 0 0-8.58-1.16A3.16 3.16 0 0 0 8.4 13.9Z';
const MOON = 'M18.4 14.9A7 7 0 0 1 9.1 5.6a7.2 7.2 0 1 0 9.3 9.3Z';

function SunRays({ cx = 12, cy = 12, inner = 6.4, outer = 9.1 }) {
  const rays = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4;
    rays.push(
      <line
        key={i}
        x1={(cx + Math.cos(angle) * inner).toFixed(2)}
        y1={(cy + Math.sin(angle) * inner).toFixed(2)}
        x2={(cx + Math.cos(angle) * outer).toFixed(2)}
        y2={(cy + Math.sin(angle) * outer).toFixed(2)}
      />,
    );
  }
  return <>{rays}</>;
}

function Drops({ y = 19.4, xs = [9.4, 12, 14.6], length = 2.6, slant = 1 }) {
  return (
    <>
      {xs.map((x, index) => (
        <line key={index} x1={x} y1={y} x2={x - slant} y2={y + length} />
      ))}
    </>
  );
}

function Flake({ x, y, r = 1.9 }: { x: number; y: number; r?: number }) {
  const lines = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI) / 3;
    lines.push(
      <line
        key={i}
        x1={(x - Math.cos(angle) * r).toFixed(2)}
        y1={(y - Math.sin(angle) * r).toFixed(2)}
        x2={(x + Math.cos(angle) * r).toFixed(2)}
        y2={(y + Math.sin(angle) * r).toFixed(2)}
      />,
    );
  }
  return <>{lines}</>;
}

function glyph(name: string) {
  switch (name) {
    case 'sun':
      return (
        <>
          <circle cx="12" cy="12" r="4.6" />
          <SunRays />
        </>
      );
    case 'moon':
      return <path d={MOON} />;
    case 'sun-haze':
      return (
        <>
          <circle cx="12" cy="10.4" r="4" />
          <SunRays cy={10.4} inner={5.7} outer={8} />
          <line x1="5.2" y1="18.6" x2="18.8" y2="18.6" />
          <line x1="7.8" y1="21.4" x2="16.2" y2="21.4" />
        </>
      );
    case 'moon-haze':
      return (
        <>
          <path d="M17.6 12.4A6 6 0 0 1 9.6 4.4a6.2 6.2 0 1 0 8 8Z" />
          <line x1="5.2" y1="18.4" x2="18.8" y2="18.4" />
          <line x1="7.8" y1="21.2" x2="16.2" y2="21.2" />
        </>
      );
    case 'sun-cloud':
      return (
        <>
          <circle cx="16.4" cy="7.2" r="2.9" />
          <SunRays cx={16.4} cy={7.2} inner={4.1} outer={5.7} />
          <path d={CLOUD} />
        </>
      );
    case 'moon-cloud':
      return (
        <>
          <path d="M19.6 8.6a4.1 4.1 0 0 1-5.5-5.5 4.25 4.25 0 1 0 5.5 5.5Z" />
          <path d={CLOUD} />
        </>
      );
    case 'cloud':
      return <path d={CLOUD} />;
    case 'fog':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <line x1="5" y1="17.6" x2="19" y2="17.6" />
          <line x1="7.4" y1="20.6" x2="16.6" y2="20.6" />
        </>
      );
    case 'drizzle':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Drops y={16.6} xs={[10, 12.6, 15.2]} length={1.7} slant={0.6} />
        </>
      );
    case 'rain-light':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Drops y={16.4} xs={[10.4, 14.2]} length={3} slant={1} />
        </>
      );
    case 'rain':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Drops y={16.2} xs={[9.6, 12.4, 15.2]} length={3.6} slant={1.2} />
        </>
      );
    case 'rain-heavy':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Drops y={15.8} xs={[8.8, 11.4, 14, 16.6]} length={4.6} slant={1.6} />
        </>
      );
    case 'sleet':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <line x1="10.2" y1="16.4" x2="9" y2="20" />
          <Flake x={14.8} y={18.6} r={1.7} />
        </>
      );
    case 'snow':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Flake x={10} y={18.4} />
          <Flake x={15} y={19.6} r={1.6} />
        </>
      );
    case 'snow-heavy':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Flake x={8.8} y={18} />
          <Flake x={13.2} y={20} r={1.7} />
          <Flake x={17} y={17.6} r={1.5} />
        </>
      );
    case 'storm':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <path d="M13.4 15.2 10.6 19.4h2.5l-1.1 3.4 3.6-4.6h-2.4Z" />
        </>
      );
    case 'rain-stop':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <line x1="10.6" y1="16.4" x2="9.4" y2="19.4" />
          <line x1="13.4" y1="17.4" x2="18.6" y2="17.4" />
        </>
      );
    default:
      return <path d={CLOUD} />;
  }
}

export function WeatherIcon({
  name,
  size = 24,
  className,
  strokeWidth = 1.25,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {glyph(name)}
    </svg>
  );
}
