// ─── util.js ── seeded randomness, noise, colour helpers ───────────────────

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// integer hash → [0,1)
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hash1(x, s = 0) {
  return hash2(x, 0x5bd1e995, s);
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
export { lerp };

export function noise1(x, s = 0) {
  const xi = Math.floor(x);
  const xf = x - xi;
  return lerp(hash1(xi, s), hash1(xi + 1, s), fade(xf)) * 2 - 1;
}

export function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  const u = fade(xf), v = fade(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

export function fbm1(x, oct = 4, s = 0) {
  let amp = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise1(x * f, s + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

export function fbm2(x, y, oct = 4, s = 0) {
  let amp = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x * f, y * f, s + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.01;
  }
  return sum / norm;
}

export function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mixc(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function pick(arr, r = Math.random()) {
  return arr[(r * arr.length) | 0];
}

export function fmt(n) {
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
  const u = ['', 'k', 'M', 'G', 'T', 'P'];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i];
}

const SYL = ['ka', 'ri', 'to', 'mu', 'na', 'el', 'or', 'zi', 'la', 'vo', 'ne', 'sa', 'ti', 'ra', 'ul', 'be', 'yo', 'fi', 'an', 'ko', 'mi', 'su', 'da', 'ek', 'ny', 'lo', 'ha', 'qi', 'ar', 'is'];
export function makeName(r = Math.random) {
  const n = 2 + (r() < 0.35 ? 1 : 0);
  let s = '';
  for (let i = 0; i < n; i++) {
    s += SYL[(r() * SYL.length) | 0];
    if (i === 0 && n === 3 && r() < 0.3) s += "'";
  }
  return s[0].toUpperCase() + s.slice(1);
}
