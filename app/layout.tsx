import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from 'next/font/google';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import './globals.css';

/**
 * Three faces, three jobs.
 *
 * A high-contrast display serif carries the temperature and the headlines; it is
 * what makes the app look like an editorial spread rather than a system app. A
 * technical grotesque carries the interface and the prose. A mono carries the
 * readouts and the scale ticks, so numbers line up like instrument markings.
 */
const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans-face',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-face',
  display: 'swap',
});

const DESCRIPTION =
  'El tiempo donde estás, con una atmósfera que cambia con la hora, el sol y la lluvia. Previsión por horas, 10 días, lluvia, sol, aire y actividades.';

export const metadata: Metadata = {
  applicationName: 'Atmos',
  title: 'Atmos · El tiempo',
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Atmos',
    // Lets the sky run under the status bar instead of a black band.
    statusBarStyle: 'black-translucent',
  },
  other: {
    // Next emits only the modern `mobile-web-app-capable`, which iOS honours
    // from 16.4. The deprecated Apple-prefixed tag is what makes an installed
    // app launch standalone on anything older, and it costs one line.
    'apple-mobile-web-app-capable': 'yes',
  },
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'Atmos',
    title: 'Atmos · El tiempo',
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // `cover` is what makes env(safe-area-inset-*) meaningful on iPhone.
  viewportFit: 'cover',
  // Deliberately zoomable: pinch-zoom is an accessibility feature, and
  // `touch-action: manipulation` already removes the accidental double-tap.
  themeColor: '#0b1622',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
