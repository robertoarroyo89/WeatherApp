/**
 * Procedural textures, generated as inline SVG data URIs.
 *
 * Clouds and film grain are `feTurbulence` fields rather than image assets:
 * nothing to download, nothing to cache, and they scale to any screen density.
 * `stitchTiles="stitch"` is what makes them tile seamlessly, which is what lets
 * a band drift forever with a single compositor-only transform instead of a
 * repainted background position.
 *
 * The tile is authored at roughly the aspect ratio it will be *displayed* at
 * (one quarter of a double-width band, against a band about 45 % of the
 * viewport tall). Getting that wrong is very visible: a 2:1 tile squeezed into a
 * 1:4 slot turns soft cloud into vertical streaks.
 */

const TILE_WIDTH = 240;
const TILE_HEIGHT = 420;

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;
}

interface CloudTextureOptions {
  /** Turbulence frequency per user unit. Lower is larger and puffier. */
  frequencyX: number;
  frequencyY: number;
  octaves: number;
  seed: number;
  /** Alpha contrast. Higher values give harder cloud edges. */
  contrast: number;
  /** Alpha offset. More negative means fewer, smaller clouds. */
  threshold: number;
}

/**
 * A soft cloud field as an alpha mask: opaque where there is cloud, transparent
 * where there is sky, so it can be used directly as a CSS mask over a gradient.
 */
export function cloudTexture({
  frequencyX,
  frequencyY,
  octaves,
  seed,
  contrast,
  threshold,
}: CloudTextureOptions): string {
  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${TILE_WIDTH}" height="${TILE_HEIGHT}">
      <filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise"
          baseFrequency="${frequencyX} ${frequencyY}"
          numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch" result="n"/>
        <feColorMatrix in="n" type="matrix" values="
          0 0 0 0 1
          0 0 0 0 1
          0 0 0 0 1
          ${contrast} 0 0 0 ${threshold}"/>
      </filter>
      <rect width="${TILE_WIDTH}" height="${TILE_HEIGHT}" filter="url(#c)"/>
    </svg>
  `);
}

/** High, thin, fast-moving cloud. */
export const CLOUD_FAR = cloudTexture({
  frequencyX: 0.0095,
  frequencyY: 0.014,
  octaves: 4,
  seed: 11,
  contrast: 1,
  threshold: -0.44,
});

/** Mid-level cloud with recognisable masses. */
export const CLOUD_MID = cloudTexture({
  frequencyX: 0.0056,
  frequencyY: 0.0092,
  octaves: 5,
  seed: 29,
  contrast: 1.3,
  threshold: -0.52,
});

/** Low, large, soft cloud that reads as close to the viewer. */
export const CLOUD_NEAR = cloudTexture({
  frequencyX: 0.0034,
  frequencyY: 0.0062,
  octaves: 4,
  seed: 47,
  contrast: 1.5,
  threshold: -0.58,
});

/**
 * Film grain. The single cheapest thing that stops a large CSS gradient from
 * looking like a large CSS gradient — at 5 % over `overlay` it reads as
 * photographic texture rather than as noise.
 */
export const GRAIN = svgUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3"
        stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
    <rect width="200" height="200" filter="url(#g)"/>
  </svg>
`);

/** Soft blurred droplets, used only in heavy rain and only near the edges. */
export const MOISTURE = svgUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <filter id="m" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="
        0 0 0 0 1
        0 0 0 0 1
        0 0 0 0 1
        2.4 0 0 0 -1.32"/>
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
    <rect width="400" height="400" filter="url(#m)"/>
  </svg>
`);
