// Renders the moon for a given phase as a PNG - no image library needed.
//
// Gladys widgets only display PNG/JPEG/WebP served through onWidgetGetImage
// (no SVG, no third-party URL), so the disc is rasterized here pixel by
// pixel and encoded with node:zlib. Transparent background: the image sits
// on the card colour in both light and dark themes.

import zlib from "node:zlib";

// Main lunar "seas" as seen from the northern hemisphere, in disc units
// (x to the right, y downward, radius 1): [x, y, radiusX, radiusY, darkness].
const MARIA = [
  [-0.6, -0.05, 0.28, 0.45, 0.8], // Oceanus Procellarum
  [-0.3, -0.38, 0.27, 0.22, 1], // Mare Imbrium
  [0.15, -0.4, 0.16, 0.15, 1], // Mare Serenitatis
  [0.3, -0.05, 0.2, 0.17, 1], // Mare Tranquillitatis
  [0.66, -0.3, 0.1, 0.12, 1], // Mare Crisium
  [0.55, 0.15, 0.11, 0.17, 0.9], // Mare Fecunditatis
  [0.35, 0.3, 0.09, 0.09, 0.9], // Mare Nectaris
  [-0.15, 0.42, 0.2, 0.13, 0.8], // Mare Nubium
  [-0.47, 0.42, 0.09, 0.09, 0.9], // Mare Humorum
  [0.0, -0.64, 0.4, 0.09, 0.6], // Mare Frigoris
  [-0.05, 0.05, 0.12, 0.1, 0.6], // Sinus Medii / Mare Vaporum
];
const TYCHO = [-0.12, 0.72]; // bright crater with rays

// Smooth value noise, deterministic (same image for the same phase).
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    sum += amp * valueNoise(x * freq, y * freq);
    amp /= 2;
    freq *= 2;
  }
  return sum;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// Surface brightness (0..1) of the full moon at disc point (x, y).
function albedo(x, y) {
  // seas blend into each other instead of reading as separate spots
  let clear = 1;
  for (const [mx, my, rx, ry, k] of MARIA) {
    const dx = (x - mx) / rx;
    const dy = (y - my) / ry;
    clear *= 1 - k * Math.exp(-(dx * dx + dy * dy) * 0.9);
  }
  // irregular sea edges and highland mottling
  const mare = smoothstep(0.2, 0.85, 1 - clear + 0.45 * (fbm(x * 5 + 10, y * 5 + 10) - 0.5));
  let a = 0.86 - 0.34 * mare;
  a -= 0.12 * (fbm(x * 22, y * 22) - 0.5);
  // Tycho and its rays
  const tx = x - TYCHO[0];
  const ty = y - TYCHO[1];
  const td = Math.sqrt(tx * tx + ty * ty);
  a += 0.25 * Math.exp(-td * td * 900);
  const ray = Math.pow(Math.abs(Math.cos(Math.atan2(ty, tx) * 7)), 40);
  a += 0.06 * ray * Math.exp(-td * 2.5);
  return clamp01(a);
}

/**
 * Fraction of daylight at disc point (x, y) for a phase (0 = new moon,
 * 0.5 = full moon), northern hemisphere view: waxing lit on the right.
 * Soft terminator so the edge looks like a real shadow line.
 */
function daylight(x, y, phase) {
  const half = Math.sqrt(Math.max(0, 1 - y * y));
  const t = Math.cos(2 * Math.PI * phase);
  const soft = 0.04;
  if (phase <= 0.5) return smoothstep(t * half - soft, t * half + soft, x);
  return 1 - smoothstep(-t * half - soft, -t * half + soft, x);
}

/**
 * @param {number} phase  0..1 position in the synodic cycle (see moon.js)
 * @param {object} [opts]
 * @param {number} [opts.size=320]       width and height in pixels
 * @param {boolean} [opts.southern=false] southern hemisphere view (turned 180 degrees)
 * @param {number} [opts.earthshine=0.13] brightness of the night side
 * @returns {Buffer} PNG bytes
 */
export function renderMoonPng(phase, { size = 320, southern = false, earthshine = 0.13 } = {}) {
  const radius = size / 2 - 2;
  const center = size / 2;
  const rowBytes = size * 4 + 1;
  const raw = Buffer.alloc(rowBytes * size);

  for (let py = 0; py < size; py += 1) {
    raw[py * rowBytes] = 0; // PNG filter: none
    for (let px = 0; px < size; px += 1) {
      const sx = (px + 0.5 - center) / radius;
      const sy = (py + 0.5 - center) / radius;
      const r = Math.sqrt(sx * sx + sy * sy);
      const coverage = clamp01((1 - r) * radius + 0.5); // antialiased limb
      const o = py * rowBytes + 1 + px * 4;
      if (coverage <= 0) continue; // transparent
      // seen from the south the moon is upside down (turned 180 degrees)
      const x = southern ? -sx : sx;
      const y = southern ? -sy : sy;
      const mu = Math.sqrt(Math.max(0, 1 - Math.min(1, r) ** 2));
      const limb = 0.72 + 0.28 * mu; // limb darkening
      const light = earthshine + (1 - earthshine) * daylight(x, y, phase);
      const v = albedo(x, y) * limb * light;
      raw[o] = Math.round(255 * clamp01(v * 1.0));
      raw[o + 1] = Math.round(255 * clamp01(v * 0.99));
      raw[o + 2] = Math.round(255 * clamp01(v * 0.96));
      raw[o + 3] = Math.round(255 * coverage);
    }
  }
  return encodePng(size, size, raw);
}

// --- minimal PNG encoder (RGBA, 8 bits) -----------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
