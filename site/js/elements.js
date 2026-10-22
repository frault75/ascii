// ─── elements.js ── every kind of matter in the world ──────────────────────
import { hex } from './util.js';
import { gs } from './glyphs.js';

export const E = {
  EMPTY: 0, BEDROCK: 1, STONE: 2, DIRT: 3, GRASS: 4, SAND: 5, WATER: 6, LAVA: 7,
  FIRE: 8, SMOKE: 9, STEAM: 10, WOOD: 11, LEAF: 12, SEED: 13, PLANT: 14, FLOWER: 15,
  ICE: 16, SNOW: 17, ACID: 18, OIL: 19, GUNPOWDER: 20, TNT: 21, METAL: 22, GOLD: 23,
  GLASS: 24, ASH: 25, CLOUD: 26, BOLT: 27, OBSIDIAN: 28, CRYSTAL: 29, GLITCH: 30,
  FISH: 31, BIRD: 32, WORM: 33, BUTTERFLY: 34, FIREFLY: 35, STRUCT: 36, SAPLING: 37,
  CROP: 38, STARSTONE: 39, EMBER: 40, SHROOM: 41, TORCH: 42,
};
export const N = 43;

export const K = { EMPTY: 0, SOLID: 1, POWDER: 2, SOIL: 3, LIQUID: 4, GAS: 5, LIFE: 6, SPECIAL: 7 };

// tree species stored in the aux field of WOOD / LEAF / SAPLING
export const SP = { OAK: 0, PINE: 1, BIRCH: 2, CHERRY: 3, PALM: 4 };

// building materials stored in v[] of STRUCT cells
export const MAT = { WOOD: 0, STONE: 1, ROOF: 2, WINDOW: 3, DOOR: 4, METAL: 5, PANE: 6, CLOTH: 7, GOLD: 8, NEON: 9, HULL: 10, FLAME: 11, BRICK: 12, DARK: 13 };

const D = [];
function def(id, o) {
  D[id] = Object.assign(
    { kind: K.SOLID, dens: 255, flam: 0, hot: 0, stand: 0, pass: 0, hard: 0.3, deadly: 0, conduct: 0, look: null },
    o,
  );
}

// look: g = glyph pool, fg = colour pool, bg = background, mix = how much the
// background is replaced by the sky (0 = opaque cell, 1 = fully see-through),
// emit = light colour cast on the surroundings, glow = bloom strength
def(E.EMPTY, { kind: K.EMPTY, dens: 0, pass: 1, hard: 0 });
def(E.BEDROCK, { stand: 1, hard: 1, look: { g: '▓▓█▓', fg: ['#3d3846', '#45404f'], bg: '#17141c', jit: 4 } });
def(E.STONE, { stand: 1, hard: 0.7, look: { g: '▓▒▓#▒▓%▓', fg: ['#8d8a9c', '#7d7a8c', '#9a96a6', '#85818f'], bg: '#2e2b36', jit: 10 } });
def(E.DIRT, { kind: K.SOIL, dens: 17, stand: 1, hard: 0.2, look: { g: '▒:░;▒,∙▒', fg: ['#9b6a43', '#8a5c38', '#a87650'], bg: '#3b2618', jit: 10 } });
def(E.GRASS, { kind: K.SOIL, dens: 17, stand: 1, flam: 0.1, hard: 0.2, look: { g: '"\',ʷ;"', fg: ['#6cc24a'], bg: '#3b2618', jit: 14 } });
def(E.SAND, { kind: K.POWDER, dens: 16, stand: 1, hard: 0.15, look: { g: '∙:·.∙:·░', fg: ['#f4dc9c', '#e6ca84', '#fbe8b4'], bg: '#9c8048', jit: 10 } });
def(E.WATER, { kind: K.LIQUID, dens: 10, pass: 1, hard: 0.05, conduct: 1, look: { g: '≈', fg: ['#7ab8ff'], bg: '#1a4f9c' } });
def(E.LAVA, { kind: K.LIQUID, dens: 14, hot: 1, deadly: 1, hard: 0.1, look: { g: '≈∼~', fg: ['#ffe07a'], bg: '#d24a12', emit: [1.0, 0.42, 0.1], glow: 0.9 } });
def(E.FIRE, { kind: K.GAS, dens: 2, hot: 1, deadly: 1, pass: 1, hard: 0, look: { g: '^*"\'`,', fg: ['#ffcf5a'], bg: '#000000', mix: 0.75, emit: [1.0, 0.55, 0.15], glow: 1 } });
def(E.SMOKE, { kind: K.GAS, dens: 2, pass: 1, hard: 0, look: { g: '░∙°░~', fg: ['#9a98a6', '#86848f'], bg: '#3a3a44', mix: 0.7 } });
def(E.STEAM, { kind: K.GAS, dens: 1, pass: 1, hard: 0, look: { g: '°∘·∙', fg: ['#e8f0f8'], bg: '#b8c8d8', mix: 0.85 } });
def(E.WOOD, { flam: 0.03, stand: 1, pass: 1, hard: 0.35, look: { g: '║', fg: ['#a8743f', '#9a6a3a'], bg: '#4a2f19', jit: 8 } });
def(E.LEAF, { flam: 0.3, pass: 1, hard: 0.05, look: { g: '♣♠*&%♣', fg: ['#4caf50'], bg: '#173d1c', jit: 16 } });
def(E.SEED, { kind: K.POWDER, dens: 12, flam: 0.2, pass: 1, hard: 0, look: { g: '•°', fg: ['#d6b56a', '#c4a050'], bg: '#000000', mix: 1 } });
def(E.PLANT, { flam: 0.35, pass: 1, hard: 0, look: { g: '|)(|', fg: ['#5fb04a', '#4f9a3c'], bg: '#000000', mix: 1, jit: 10 } });
def(E.FLOWER, { flam: 0.35, pass: 1, hard: 0, look: { g: '*@✿❀¤*', fg: ['#ff7eb6', '#ffd84a', '#ff5a5a', '#ffffff', '#b98aff', '#7ad7ff', '#ff9a3a'], bg: '#000000', mix: 1, glow: 0.12 } });
def(E.ICE, { stand: 1, hard: 0.4, look: { g: '▒#=▓▒', fg: ['#d8f4ff', '#c4ecff'], bg: '#6fa8cc', jit: 8 } });
def(E.SNOW, { kind: K.POWDER, dens: 9, stand: 1, hard: 0.05, look: { g: '░▒░∙', fg: ['#f4f8ff', '#e8eefa'], bg: '#b8c6d8', jit: 6 } });
def(E.ACID, { kind: K.LIQUID, dens: 11, deadly: 1, pass: 0, hard: 0.05, conduct: 1, look: { g: '≈~', fg: ['#c6ff5a'], bg: '#3f8a12', emit: [0.35, 0.9, 0.1], glow: 0.45 } });
def(E.OIL, { kind: K.LIQUID, dens: 8, flam: 0.7, pass: 1, hard: 0.05, look: { g: '≈~', fg: ['#9a7ab8'], bg: '#2a1d36' } });
def(E.GUNPOWDER, { kind: K.POWDER, dens: 15, flam: 1, stand: 1, hard: 0.1, look: { g: ':∙·:', fg: ['#a8a8ae', '#8c8c94'], bg: '#33333a', jit: 8 } });
def(E.TNT, { flam: 1, stand: 1, hard: 0.2, look: { g: '≡', fg: ['#fff0e0'], bg: '#c42a2a' } });
def(E.METAL, { stand: 1, hard: 0.85, conduct: 1, look: { g: '■▪≡■', fg: ['#c8d0dc', '#b4bcc8'], bg: '#5a6070', jit: 6 } });
def(E.GOLD, { stand: 1, hard: 0.6, conduct: 1, look: { g: '$◆•$', fg: ['#ffd84a', '#ffe680'], bg: '#6a4c14', glow: 0.25, jit: 8 } });
def(E.GLASS, { stand: 1, hard: 0.3, look: { g: '░╱ ░', fg: ['#d8f6ff'], bg: '#5a8aa0', mix: 0.55 } });
def(E.ASH, { kind: K.POWDER, dens: 11, stand: 1, pass: 0, hard: 0, look: { g: '.,`∙', fg: ['#a8a39d', '#8a857f'], bg: '#48443f', jit: 6 } });
def(E.CLOUD, { kind: K.SPECIAL, dens: 3, pass: 1, hard: 0, look: { g: '░▒▓', fg: ['#f0f4fa'], bg: '#c0ccdc', mix: 0.6 } });
def(E.BOLT, { kind: K.SPECIAL, dens: 0, hot: 1, deadly: 1, pass: 1, hard: 0, look: { g: '╱╲│', fg: ['#f4faff'], bg: '#9ac8ff', mix: 0.3, emit: [0.75, 0.85, 1.0], glow: 1 } });
def(E.OBSIDIAN, { stand: 1, hard: 0.9, look: { g: '▓#▒▓', fg: ['#7a5a9a', '#6a4a8a'], bg: '#1c1226', jit: 6 } });
def(E.CRYSTAL, { stand: 1, hard: 0.5, look: { g: '◊♦◆*◊', fg: ['#ff8aff', '#e070ff', '#ffa8ff'], bg: '#4a1856', emit: [0.9, 0.3, 1.0], glow: 0.55 } });
def(E.GLITCH, { kind: K.SPECIAL, dens: 0, deadly: 1, pass: 1, hard: 0, look: { g: '#$%&@?!<>/\\|{}01▚▞', fg: ['#ff2a8a'], bg: '#000000', emit: [0.6, 0.2, 0.9], glow: 0.8 } });
def(E.FISH, { kind: K.LIFE, dens: 10, pass: 1, hard: 0, look: { g: '><', fg: ['#ff9a3a', '#ffd84a', '#c0d8ff', '#ff6a6a'], bg: '#1a4f9c' } });
def(E.BIRD, { kind: K.LIFE, dens: 1, flam: 0.3, pass: 1, hard: 0, look: { g: 'v^', fg: ['#2a2a35'], bg: '#000000', mix: 1 } });
def(E.WORM, { kind: K.LIFE, dens: 17, stand: 1, hard: 0.1, look: { g: '~s', fg: ['#ff9ab0'], bg: '#3b2618' } });
def(E.BUTTERFLY, { kind: K.LIFE, dens: 1, flam: 0.5, pass: 1, hard: 0, look: { g: 'жЖ', fg: ['#ffb84a', '#7ad7ff', '#ff7eb6', '#ffffff', '#c58aff'], bg: '#000000', mix: 1, glow: 0.15 } });
def(E.FIREFLY, { kind: K.LIFE, dens: 1, flam: 0.5, pass: 1, hard: 0, look: { g: '·•', fg: ['#e4ff7a'], bg: '#000000', mix: 1, emit: [0.6, 0.8, 0.2], glow: 1 } });
def(E.STRUCT, { flam: 0.02, stand: 1, pass: 1, hard: 0.45, look: { g: '#', fg: ['#ffffff'], bg: '#000000' } });
def(E.SAPLING, { flam: 0.3, pass: 1, hard: 0.05, look: { g: '|ı', fg: ['#8fd060'], bg: '#000000', mix: 1 } });
def(E.CROP, { flam: 0.3, pass: 1, hard: 0, look: { g: 'ψ', fg: ['#9ad050'], bg: '#000000', mix: 1 } });
def(E.STARSTONE, { stand: 1, hard: 0.8, look: { g: '✦◆*✧', fg: ['#7ef6ff', '#a8faff'], bg: '#123448', emit: [0.3, 0.85, 1.0], glow: 0.7 } });
def(E.EMBER, { hot: 1, deadly: 1, stand: 1, hard: 0.2, look: { g: '▓▒#▒', fg: ['#ffb040', '#ff9030'], bg: '#8a2a0c', emit: [1.0, 0.45, 0.1], glow: 0.8 } });
def(E.SHROOM, { flam: 0.15, pass: 1, hard: 0, look: { g: '♠↑♠', fg: ['#6affd8', '#5ae8ff'], bg: '#000000', mix: 1, emit: [0.2, 0.9, 0.75], glow: 0.6 } });
def(E.TORCH, { pass: 1, hard: 0.1, look: { g: '¡', fg: ['#ffe0a0'], bg: '#000000', mix: 1, emit: [1.0, 0.7, 0.35], glow: 0.9 } });

export const DEFS = D;

// ── fast property tables ────────────────────────────────────────────────────
export const KIND = new Uint8Array(N);
export const DENS = new Uint8Array(N);
export const FLAM = new Float32Array(N);
export const HOT = new Uint8Array(N);
export const STAND = new Uint8Array(N);
export const PASS = new Uint8Array(N);
export const HARD = new Float32Array(N);
export const DEADLY = new Uint8Array(N);
export const CONDUCT = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const o = D[i];
  KIND[i] = o.kind; DENS[i] = o.dens; FLAM[i] = o.flam; HOT[i] = o.hot; STAND[i] = o.stand;
  PASS[i] = o.pass; HARD[i] = o.hard; DEADLY[i] = o.deadly; CONDUCT[i] = o.conduct;
}

const FLYERS = new Set([E.BIRD, E.BUTTERFLY, E.FIREFLY]);
const MOVERS = new Set([K.POWDER, K.SOIL, K.LIQUID]);

// CAN[src*N+dst] = 1 when a moving src cell may swap into dst
export const CAN = new Uint8Array(N * N);
for (let s = 0; s < N; s++) {
  for (let d = 0; d < N; d++) {
    let ok = 0;
    const ks = KIND[s], kd = KIND[d];
    if (d === E.EMPTY) ok = 1;
    else if (kd === K.GAS || FLYERS.has(d)) ok = MOVERS.has(ks) ? 1 : 0;
    else if (kd === K.LIQUID || d === E.FISH) ok = MOVERS.has(ks) && DENS[s] > DENS[d] ? 1 : 0;
    else if (d === E.CLOUD) ok = MOVERS.has(ks) ? 1 : 0;
    CAN[s * N + d] = ok;
  }
}

// is this cell part of the ground for surface detection
export const TERRAIN = new Uint8Array(N);
for (const e of [E.BEDROCK, E.STONE, E.DIRT, E.GRASS, E.SAND, E.ICE, E.SNOW, E.OBSIDIAN, E.METAL, E.GOLD, E.GLASS, E.CRYSTAL, E.STARSTONE, E.ASH, E.GUNPOWDER, E.TNT, E.WORM, E.WATER, E.LAVA, E.ACID, E.OIL, E.EMBER])
  TERRAIN[e] = 1;

// ── look-up tables for the renderer ─────────────────────────────────────────
// per element and per 8-bit variant: glyph, fg rgb, bg rgb
export const LUT_G = new Uint8Array(N * 256);
export const LUT_FG = new Uint8Array(N * 256 * 3);
export const LUT_BG = new Uint8Array(N * 256 * 3);
export const MIX = new Float32Array(N);
export const GLOW = new Float32Array(N);
export const EMIT = new Float32Array(N * 3);

function jitter(c, j, r) {
  return Math.max(0, Math.min(255, Math.round(c + (r - 0.5) * 2 * j)));
}

export function buildLUTs() {
  for (let id = 0; id < N; id++) {
    const lk = D[id].look;
    if (!lk) continue;
    const gl = gs(lk.g);
    const fgs = lk.fg.map(hex);
    const bg = hex(lk.bg);
    const j = lk.jit || 0;
    MIX[id] = lk.mix || 0;
    GLOW[id] = lk.glow || 0;
    if (lk.emit) { EMIT[id * 3] = lk.emit[0]; EMIT[id * 3 + 1] = lk.emit[1]; EMIT[id * 3 + 2] = lk.emit[2]; }
    for (let v = 0; v < 256; v++) {
      // decorrelate glyph / colour choice from the same byte
      const h1 = ((v * 2654435761) >>> 0) / 4294967296;
      const h2 = ((v * 40503 + 12345) & 0xffff) / 65536;
      const h3 = ((v * 69069 + 1) & 0xffff) / 65536;
      LUT_G[id * 256 + v] = gl[Math.floor(h1 * gl.length)];
      const f = fgs[Math.floor(h2 * fgs.length)];
      const o = (id * 256 + v) * 3;
      LUT_FG[o] = jitter(f[0], j, h3);
      LUT_FG[o + 1] = jitter(f[1], j, h3);
      LUT_FG[o + 2] = jitter(f[2], j, h3);
      const bj = j * 0.5;
      LUT_BG[o] = jitter(bg[0], bj, h2);
      LUT_BG[o + 1] = jitter(bg[1], bj, h2);
      LUT_BG[o + 2] = jitter(bg[2], bj, h2);
    }
  }
}
