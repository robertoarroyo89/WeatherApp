/**
 * Generates the PWA icon set.
 *
 * Written as a script rather than checked in as binaries so the artwork is
 * reviewable and reproducible: the icon is the app's own sky palette — a deep
 * pre-dawn gradient with a low sun breaking the horizon — rendered per pixel and
 * encoded straight to PNG with zlib. No image tooling required.
 *
 * Run with: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'public', 'icons');

/* ------------------------------------------------------------------ colour -- */

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const ZENITH = [8, 20, 36];
const MID = [24, 52, 78];
const HORIZON = [86, 92, 104];
const SUN = [255, 214, 166];
const GLOW = [244, 168, 104];

/**
 * The icon artwork, as a pure function of normalised coordinates.
 * `inset` shrinks the composition for the maskable variant's safe zone.
 */
function paint(u, v, inset) {
  // Recentre and scale so the maskable icon keeps its subject inside 80 %.
  const x = 0.5 + (u - 0.5) / inset;
  const y = 0.5 + (v - 0.5) / inset;

  // Vertical sky ramp.
  let colour =
    y < 0.62
      ? mix(ZENITH, MID, smoothstep(0, 0.62, y))
      : mix(MID, HORIZON, smoothstep(0.62, 1.08, y));

  // Sun, sitting just above the horizon line.
  const sunX = 0.5;
  const sunY = 0.66;
  const aspect = 1;
  const distance = Math.hypot((x - sunX) * aspect, y - sunY);

  // Wide atmospheric bloom.
  const bloom = Math.pow(1 - smoothstep(0, 0.62, distance), 2.1);
  colour = [
    Math.min(255, colour[0] + GLOW[0] * bloom * 0.5),
    Math.min(255, colour[1] + GLOW[1] * bloom * 0.42),
    Math.min(255, colour[2] + GLOW[2] * bloom * 0.3),
  ];

  // The disc itself, soft-edged.
  const disc = 1 - smoothstep(0.1, 0.142, distance);
  colour = mix(colour, SUN, disc * 0.96);

  // Horizon: a single darker band that gives the sun something to rise out of.
  const horizon = smoothstep(0.795, 0.815, y);
  colour = mix(colour, [10, 18, 28], horizon * 0.82);

  // A whisper of grain so the gradient does not band on large displays.
  const grain = (((x * 6151 + y * 3571) * 977) % 1) - 0.5;
  return [
    Math.max(0, Math.min(255, colour[0] + grain * 2.4)),
    Math.max(0, Math.min(255, colour[1] + grain * 2.4)),
    Math.max(0, Math.min(255, colour[2] + grain * 2.4)),
  ];
}

/* --------------------------------------------------------------------- png -- */

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * @param size    edge length in pixels
 * @param inset   shrinks the composition, for the maskable safe zone
 * @param alpha   emit RGBA rather than RGB. The icon is fully opaque either
 *                way, but an ICO's embedded PNG has to be RGBA to be widely
 *                decodable — Next's own image pipeline rejects RGB outright.
 */
function encodePng(size, inset, alpha = false) {
  const channels = alpha ? 4 : 3;
  // Supersample 2x for smooth edges on the disc and horizon.
  const samples = 2;
  const raw = Buffer.alloc(size * (size * channels + 1));
  let offset = 0;
  for (let py = 0; py < size; py += 1) {
    raw[offset] = 0; // filter type: none
    offset += 1;
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const [cr, cg, cb] = paint(
            (px + (sx + 0.5) / samples) / size,
            (py + (sy + 0.5) / samples) / size,
            inset,
          );
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const total = samples * samples;
      raw[offset] = Math.round(r / total);
      raw[offset + 1] = Math.round(g / total);
      raw[offset + 2] = Math.round(b / total);
      if (alpha) raw[offset + 3] = 255;
      offset += channels;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = alpha ? 6 : 2; // colour type: truecolour, with or without alpha
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------------- svg -- */

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#081424"/>
      <stop offset="62%" stop-color="#18344e"/>
      <stop offset="100%" stop-color="#565c68"/>
    </linearGradient>
    <radialGradient id="bloom" cx="50%" cy="66%" r="52%">
      <stop offset="0%" stop-color="#f4a868" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#f4a868" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" fill="url(#sky)"/>
  <rect width="64" height="64" fill="url(#bloom)"/>
  <circle cx="32" cy="42.2" r="7.7" fill="#ffd6a6"/>
  <rect y="51.4" width="64" height="12.6" fill="#0a121c" opacity="0.82"/>
</svg>
`;

/* -------------------------------------------------------------------- main -- */

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192, inset: 1 },
  { name: 'icon-512.png', size: 512, inset: 1 },
  { name: 'apple-touch-icon.png', size: 180, inset: 1 },
  // Maskable: subject pulled into the inner 80 % so no launcher shape clips it.
  { name: 'icon-maskable-512.png', size: 512, inset: 0.8 },
];

for (const target of targets) {
  writeFileSync(join(OUT_DIR, target.name), encodePng(target.size, target.inset));
  console.log(`wrote ${target.name} (${target.size}px)`);
}

writeFileSync(join(OUT_DIR, 'icon.svg'), SVG);
console.log('wrote icon.svg');

/* --------------------------------------------------------------------- ico -- */

/**
 * A 32 px favicon, as an ICO wrapping a PNG.
 *
 * Browsers request `/favicon.ico` by path whether or not it is declared, so
 * shipping a real one avoids both a 404 and — more to the point — avoids
 * inheriting the framework's default logo in the browser tab.
 */
function encodeIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size; // 0 means 256
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0; // palette size
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

const faviconPng = encodePng(32, 1, true);
writeFileSync(join(process.cwd(), 'app', 'favicon.ico'), encodeIco(faviconPng, 32));
console.log('wrote app/favicon.ico (32px)');
