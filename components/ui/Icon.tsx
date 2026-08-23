/** Interface glyphs. Same grid and weight as the weather icons. */

export type IconName =
  | 'search'
  | 'close'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'star'
  | 'star-filled'
  | 'locate'
  | 'settings'
  | 'refresh'
  | 'check'
  | 'wind'
  | 'humidity'
  | 'eye'
  | 'gauge'
  | 'uv'
  | 'thermo-down'
  | 'thermo-up'
  | 'sunrise'
  | 'sunset'
  | 'droplet'
  | 'share'
  | 'plus'
  | 'offline'
  | 'alert'
  | 'clock';

function glyph(name: IconName) {
  switch (name) {
    case 'search':
      return (
        <>
          <circle cx="10.6" cy="10.6" r="6.2" />
          <line x1="15.2" y1="15.2" x2="20" y2="20" />
        </>
      );
    case 'close':
      return (
        <>
          <line x1="6.4" y1="6.4" x2="17.6" y2="17.6" />
          <line x1="17.6" y1="6.4" x2="6.4" y2="17.6" />
        </>
      );
    case 'chevron-right':
      return <polyline points="9.6,5.6 16,12 9.6,18.4" />;
    case 'chevron-left':
      return <polyline points="14.4,5.6 8,12 14.4,18.4" />;
    case 'chevron-down':
      return <polyline points="5.6,9.6 12,16 18.4,9.6" />;
    case 'star':
      return (
        <path d="M12 4.2l2.34 4.9 5.26.72-3.86 3.66.98 5.32L12 16.3l-4.72 2.5.98-5.32L4.4 9.82l5.26-.72Z" />
      );
    case 'star-filled':
      return (
        <path
          d="M12 4.2l2.34 4.9 5.26.72-3.86 3.66.98 5.32L12 16.3l-4.72 2.5.98-5.32L4.4 9.82l5.26-.72Z"
          fill="currentColor"
        />
      );
    case 'locate':
      return (
        <>
          <path d="M20 4 4 10.6l6.5 2.9L13.4 20Z" />
        </>
      );
    case 'settings':
      return (
        <>
          <line x1="4.4" y1="8" x2="19.6" y2="8" />
          <line x1="4.4" y1="16" x2="19.6" y2="16" />
          <circle cx="9.4" cy="8" r="2.2" />
          <circle cx="15" cy="16" r="2.2" />
        </>
      );
    case 'refresh':
      return (
        <>
          <path d="M19.2 12a7.2 7.2 0 1 1-2.5-5.45" />
          <polyline points="17,3.2 17,6.9 13.3,6.9" />
        </>
      );
    case 'check':
      return <polyline points="5.6,12.8 10,17.2 18.4,7.2" />;
    case 'wind':
      return (
        <>
          <path d="M3.6 9.2h9.6a2.6 2.6 0 1 0-2.6-2.6" />
          <path d="M3.6 14h12.8a2.6 2.6 0 1 1-2.6 2.6" />
          <line x1="3.6" y1="18.8" x2="9.6" y2="18.8" />
        </>
      );
    case 'humidity':
      return (
        <>
          <path d="M12 3.6c3.2 3.9 5.2 6.6 5.2 9.1a5.2 5.2 0 0 1-10.4 0c0-2.5 2-5.2 5.2-9.1Z" />
          <line x1="9.8" y1="15.4" x2="14.2" y2="10.4" />
        </>
      );
    case 'eye':
      return (
        <>
          <path d="M2.8 12S6.4 6.4 12 6.4 21.2 12 21.2 12 17.6 17.6 12 17.6 2.8 12 2.8 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      );
    case 'gauge':
      return (
        <>
          <path d="M4.4 16.8a8.4 8.4 0 1 1 15.2 0" />
          <line x1="12" y1="16.4" x2="15.8" y2="10.6" />
        </>
      );
    case 'uv':
      return (
        <>
          <circle cx="12" cy="12" r="3.8" />
          <line x1="12" y1="3.2" x2="12" y2="5.6" />
          <line x1="12" y1="18.4" x2="12" y2="20.8" />
          <line x1="3.2" y1="12" x2="5.6" y2="12" />
          <line x1="18.4" y1="12" x2="20.8" y2="12" />
          <line x1="5.9" y1="5.9" x2="7.6" y2="7.6" />
          <line x1="16.4" y1="16.4" x2="18.1" y2="18.1" />
        </>
      );
    case 'thermo-down':
      return (
        <>
          <line x1="9" y1="4.4" x2="9" y2="16" />
          <polyline points="5.6,12.4 9,16 12.4,12.4" />
          <line x1="15.2" y1="7.2" x2="20" y2="7.2" />
          <line x1="15.2" y1="12" x2="18.4" y2="12" />
        </>
      );
    case 'thermo-up':
      return (
        <>
          <line x1="9" y1="19.6" x2="9" y2="8" />
          <polyline points="5.6,11.6 9,8 12.4,11.6" />
          <line x1="15.2" y1="16.8" x2="20" y2="16.8" />
          <line x1="15.2" y1="12" x2="18.4" y2="12" />
        </>
      );
    case 'sunrise':
      return (
        <>
          <circle cx="12" cy="14.4" r="3.4" />
          <line x1="3.6" y1="19.6" x2="20.4" y2="19.6" />
          <polyline points="8.8,8 12,4.4 15.2,8" />
        </>
      );
    case 'sunset':
      return (
        <>
          <circle cx="12" cy="14.4" r="3.4" />
          <line x1="3.6" y1="19.6" x2="20.4" y2="19.6" />
          <polyline points="8.8,4.8 12,8.4 15.2,4.8" />
        </>
      );
    case 'droplet':
      return <path d="M12 3.6c3.2 3.9 5.2 6.6 5.2 9.1a5.2 5.2 0 0 1-10.4 0c0-2.5 2-5.2 5.2-9.1Z" />;
    case 'share':
      return (
        <>
          <polyline points="8.4,7.6 12,4 15.6,7.6" />
          <line x1="12" y1="4" x2="12" y2="14.4" />
          <path d="M6.4 12v7.2a1.2 1.2 0 0 0 1.2 1.2h8.8a1.2 1.2 0 0 0 1.2-1.2V12" />
        </>
      );
    case 'plus':
      return (
        <>
          <line x1="12" y1="5.6" x2="12" y2="18.4" />
          <line x1="5.6" y1="12" x2="18.4" y2="12" />
        </>
      );
    case 'offline':
      return (
        <>
          <path d="M5.2 10.4a9.6 9.6 0 0 1 13.6 0" />
          <path d="M8.4 13.6a5.1 5.1 0 0 1 7.2 0" />
          <line x1="4" y1="20" x2="20" y2="4" />
        </>
      );
    case 'alert':
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <line x1="12" y1="7.6" x2="12" y2="13" />
          <circle cx="12" cy="16.2" r="0.75" fill="currentColor" stroke="none" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <polyline points="12,7.2 12,12 15.6,14" />
        </>
      );
  }
}

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.35,
}: {
  name: IconName;
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
