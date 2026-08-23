import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * `standalone` plus `portrait-primary` is what makes an installed Atmos open
 * without browser chrome and stay the right way up; the background colour
 * matches the darkest sky in the palette so the launch screen never flashes
 * white before the gradient paints.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Atmos · El tiempo',
    short_name: 'Atmos',
    description:
      'El tiempo donde estás, con una atmósfera que cambia con la hora, el sol y la lluvia.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0b1622',
    theme_color: '#0b1622',
    lang: 'es-ES',
    dir: 'ltr',
    categories: ['weather', 'utilities', 'lifestyle'],
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
