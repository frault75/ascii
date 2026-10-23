// ─── life.js ── villagers, their tribe, buildings & the wild ecosystem ─────
import { G, emit, on } from './state.js';
import { E, STAND, PASS, DEADLY, MAT, KIND, K, SP } from './elements.js';
import { makeName, pick, hash2 } from './util.js';
import { putCell, plantTree, wakeRect, speciesFor, sinkCell } from './sim.js';
import { spawnFx, floatText } from './fx.js';
import { gi } from './glyphs.js';
import { DAY } from './weather.js';
import { nearestPrey, animalById, killAnimal, KINDS } from './fauna.js';
import { mournAt, deed } from './lives.js';

// ── eras ───────────────────────────────────────────────────────────────────
export const ERAS = [
  { key: 'era0', pop: 0, faith: 0, house: 'tent' },
  { key: 'era1', pop: 4, faith: 40, house: 'hut' },
  { key: 'era2', pop: 10, faith: 250, house: 'house', houses: 4 },
  { key: 'era3', pop: 22, faith: 1200, house: 'stonehouse' },
  { key: 'era4', pop: 40, faith: 5000, house: 'tower' },
  { key: 'era5', pop: 60, faith: 15000, house: 'tower' },
];

// ── building stamps ────────────────────────────────────────────────────────
// mats: c cloth · r roof · w wood · g window · d door · s stone · b brick · m metal
//       e pane · p crop · t torch · o gold · n neon · h hull · f flame · k dark
export const BUILDINGS = {
  camp: { cap: 0, cost: {}, rows: ['^'], mats: ['f'] },
  tent: { cap: 2, cost: { wood: 3 }, rows: ['  ▲  ', ' ╱▒╲ ', '╱▒∩▒╲'], mats: ['  c  ', ' ccc ', 'ccdcc'] },
  hut: { cap: 3, cost: { wood: 6 }, rows: [' ▄▄▄ ', '◢▓▓▓◣', '│□∩□│'], mats: [' rrr ', 'rrrrr', 'wgdgw'], thatch: true },
  house: { cap: 4, cost: { wood: 6, stone: 5 }, rows: ['  ◢◣█ ', ' ◢██◣ ', '◢████◣', '█□██□█', '█▓∩∩▓█'], mats: ['  rrb ', ' rrrr ', 'rrrrrr', 'wgwwgw', 'wwddww'], chimney: 4 },
  stonehouse: { cap: 6, cost: { wood: 4, stone: 12 }, rows: ['  ◢█◣█ ', ' ◢███◣ ', '◢█████◣', '█□█□█□█', '█□█□█□█', '█▓█∩█▓█'], mats: ['  rrrb ', ' rrrrr ', 'rrrrrrr', 'sgsgsgs', 'sgsgsgs', 'sssdsss'], chimney: 5 },
  tower: {
    cap: 12, cost: { stone: 12, metal: 8 },
    rows: ['  │  ', ' ▄█▄ ', '█▪▪▪█', '█▪▪▪█', '█▪▪▪█', '█▪▪▪█', '█▪▪▪█', '█▪▪▪█', '█▪▪▪█', '█▓∩▓█'],
    mats: ['  m  ', ' nmn ', 'meeem', 'meeem', 'meeem', 'meeem', 'meeem', 'meeem', 'meeem', 'mmdmm'],
  },
  temple: { cap: 0, cost: { wood: 10, stone: 6 }, rows: ['   ✦   ', '  ◢█◣  ', ' ◢███◣ ', ' █○█○█ ', '▄█▓∩▓█▄'], mats: ['   o   ', '  rrr  ', ' rrrrr ', ' sgsgs ', 'sssdsss'] },
  farm: { cap: 0, cost: { wood: 2 }, rows: ['¦ψψψψ¦'], mats: ['wppppw'], flat: true },
  lamp: { cap: 0, cost: { wood: 2 }, rows: ['¡', '│', '│'], mats: ['t', 'w', 'w'] },
  rocket: {
    cap: 0, cost: { metal: 30, stone: 20 },
    rows: ['  ▲  ', ' ◢█◣ ', ' █○█ ', ' ███ ', ' █≡█ ', ' ███ ', ' █≡█ ', ' ███ ', '◢███◣', '█▀█▀█', '▀ ▀ ▀'],
    mats: ['  h  ', ' hhh ', ' hgh ', ' hhh ', ' hnh ', ' hhh ', ' hnh ', ' hhh ', 'hhhhh', 'kkkkk', 'k k k'],
  },
};
const MATC = { c: MAT.CLOTH, r: MAT.ROOF, w: MAT.WOOD, g: MAT.WINDOW, d: MAT.DOOR, s: MAT.STONE, b: MAT.BRICK, m: MAT.METAL, e: MAT.PANE, o: MAT.GOLD, n: MAT.NEON, h: MAT.HULL, f: MAT.FLAME, k: MAT.DARK };

// vivid, well-separated clothing colours so every villager is recognisable
const COLORS = [[255, 72, 72], [255, 160, 40], [255, 228, 60], [120, 240, 80], [40, 220, 200], [70, 150, 255], [170, 110, 255], [255, 90, 200], [255, 255, 255], [150, 255, 210], [255, 190, 150], [120, 200, 255]];
const SKINS = [[255, 224, 189], [241, 194, 125], [224, 172, 105], [198, 134, 66], [141, 85, 36], [255, 205, 148]];
function freshColor() {
  const used = new Map();
  for (const v of G.tribe.villagers) used.set(v.color, (used.get(v.color) || 0) + 1);
  let best = COLORS[0], n = 1e9;
  for (const c of COLORS) { const k = used.get(c) || 0; if (k < n || (k === n && Math.random() < 0.3)) { n = k; best = c; } }
  return best;
}

export function createTribe() {
  G.tribe = {
    villagers: [], buildings: [], nextId: 1, nextB: 1,
    food: 15, wood: 0, stone: 0, metal: 0,
    era: 0, center: 0, happiness: 0.75, trauma: 0, hunger: 0,
    births: 0, deaths: 0, maxPop: 0, faithRate: 0, mealT: 0, lastBirth: 0,
    claimed: new Set(), launched: false, names: [],
  };
  return G.tribe;
}

// ── helpers ────────────────────────────────────────────────────────────────
const W = () => G.world;
function cellAt(x, y) {
  const w = W();
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return E.BEDROCK;
  return w.t[y * w.w + x];
}
const AVOID = new Set([E.WATER, E.LAVA, E.ACID, E.OIL]);
function canOccupy(tt) {
  return PASS[tt] && !DEADLY[tt] && !AVOID.has(tt);
}

export function capacity() {
  const T = G.tribe;
  let cap = 0;
  for (const b of T.buildings) cap += BUILDINGS[b.kind].cap;
  return cap + 2;
}
export function countB(kind) {
  return G.tribe.buildings.filter((b) => b.kind === kind).length;
}

export function say(v, text, t = 150) {
  v.say = text;
  v.sayT = t;
}

const L = (fr, en) => (G.settings.lang === 'fr' ? fr : en);

// ── spawning ───────────────────────────────────────────────────────────────
export function spawnVillager(x, y, opts = {}) {
  const T = G.tribe;
  const v = {
    id: T.nextId++, name: makeName(), x, y, dir: Math.random() < 0.5 ? -1 : 1,
    state: 'idle', job: 'idle', timer: 0, cool: 0, carry: null, carryAmt: 0,
    age: opts.age ?? 0, kid: opts.kid ?? false, breath: 240, fall: 0, home: 0, inside: false,
    say: null, sayT: 0, color: freshColor(), skin: pick(SKINS), stuck: 0, lastX: x, tx: x, ty: y, ti: -1,
    faithT: (Math.random() * 600) | 0, born: G.env.day, dangerT: 0, glyph: 0,
  };
  T.villagers.push(v);
  T.maxPop = Math.max(T.maxPop, T.villagers.length);
  return v;
}

export function findSpawnSite() {
  const w = W();
  const mid = w.w / 2;
  let best = null, bestScore = -1e9;
  for (let x = 16; x < w.w - 16; x++) {
    const b = w.biome[x];
    const sy = w.surf[x];
    const top = w.t[sy * w.w + x];
    if (!STAND[top] || w.t[(sy - 1) * w.w + x] === E.WATER) continue;
    let score = top === E.GRASS ? 12 : top === E.DIRT ? 6 : top === E.SAND ? 2 : -6;
    let flat = 0, wet = 0;
    for (let k = -7; k <= 7; k++) {
      flat -= Math.abs(w.surf[x + k] - sy);
      const tk = w.t[w.surf[x + k] * w.w + x + k];
      if (tk === E.WATER || tk === E.LAVA) wet++;
    }
    let trees = 0;
    for (let k = -30; k <= 30; k += 3) {
      const cx = x + k;
      if (cx < 1 || cx >= w.w - 1) continue;
      for (let y = w.surf[cx] - 12; y < w.surf[cx]; y++) if (y > 0 && w.t[y * w.w + cx] === E.WOOD) { trees++; break; }
    }
    // basins collect rain: penalise sites lower than ground on both sides
    let hiL = 1e9, hiR = 1e9;
    for (let k = 4; k <= 40; k++) { if (x - k > 0) hiL = Math.min(hiL, w.surf[x - k]); if (x + k < w.w - 1) hiR = Math.min(hiR, w.surf[x + k]); }
    const basin = Math.max(0, sy - Math.max(hiL, hiR));
    score += flat * 1.5 - wet * 4 + Math.min(trees, 8) * 3 - Math.abs(x - mid) * 0.04 + (b === 0 || b === 1 ? 5 : 0) - (sy < w.sea - 26 ? 15 : 0) - basin * 3 - (x < 40 || x > w.w - 40 ? 10 : 0);
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best ?? Math.floor(mid);
}

export function foundTribe(x) {
  const T = G.tribe;
  const w = W();
  T.center = x;
  const site = findSite('camp', x, 6) || { x, y: w.surf[x] - 1 };
  placeBuilding('camp', site.x, site.y);
  for (let k = 0; k < 2; k++) {
    const vx = x + (k ? 2 : -2);
    const v = spawnVillager(vx, w.surf[vx] - 1, { age: 3 });
    say(v, k ? '!' : '?', 200);
  }
}

// ── buildings ──────────────────────────────────────────────────────────────
const SOFT = new Set([E.DIRT, E.GRASS, E.SAND, E.SNOW, E.ASH, E.SEED]);
const CLEAR = new Set([E.EMPTY, E.PLANT, E.FLOWER, E.SNOW, E.SEED, E.ASH, E.SMOKE, E.STEAM, E.BIRD, E.BUTTERFLY, E.FIREFLY, E.LEAF, E.WOOD, E.SAPLING]);

// find a spot; builders level the ground (dig soft soil, fill small gaps)
export function findSite(kind, cx, radius = 90, ignoreId = 0, rise = 14) {
  const B = BUILDINGS[kind];
  const bw = B.rows[0].length, bh = B.rows.length;
  const w = W();
  const { t } = w;
  const gy = new Int16Array(bw);
  for (let r = 0; r <= radius; r++) {
    for (const s of r === 0 ? [0] : [-r, r]) {
      const x0 = Math.round(cx + s - bw / 2);
      if (x0 < 4 || x0 + bw > w.w - 4) continue;
      let ok = true, sum = 0;
      for (let c = 0; c < bw && ok; c++) {
        const x = x0 + c;
        let y = Math.max(2, w.surf[x] - 24);
        const ign = (yy) => (ignoreId && t[yy * w.w + x] === E.STRUCT && w.a[yy * w.w + x] === ignoreId) || t[yy * w.w + x] === E.WOOD || t[yy * w.w + x] === E.SNOW || t[yy * w.w + x] === E.ASH;
        while (y < w.h - 2 && (!STAND[t[y * w.w + x]] || ign(y))) y++;
        // a pond or a pool on the ground rules the column out (falling rain does not)
        for (let k = 1; k <= 2; k++) {
          const q = t[(y - k) * w.w + x];
          if (q === E.WATER || q === E.LAVA || q === E.ACID || q === E.OIL) ok = false;
        }
        const g = t[y * w.w + x];
        if (g === E.STRUCT || g === E.ICE || g === E.TNT) ok = false;
        gy[c] = y;
        sum += y;
      }
      if (!ok) continue;
      if (G.tribe.bad && G.tribe.bad[x0] > G.env.day) continue;
      const Y = Math.round(sum / bw);
      if (Math.abs(Y - w.surf[Math.round(cx)]) > rise) continue;
      for (let c = 0; c < bw && ok; c++) if (Math.abs(gy[c] - Y) > 2) ok = false;
      if (!ok) continue;
      const top = Y - bh;
      if (top < 3) continue;
      // footprint: clear air (or soft soil that will be dug away)
      for (let yy = top - 1; yy < Y && ok; yy++) {
        for (let xx = x0 - 1; xx <= x0 + bw && ok; xx++) {
          const tt = t[yy * w.w + xx];
          const inside = xx >= x0 && xx < x0 + bw;
          if (CLEAR.has(tt) || (ignoreId && tt === E.STRUCT && w.a[yy * w.w + xx] === ignoreId)) continue;
          if (inside && SOFT.has(tt) && yy >= Y - 2) continue;
          if (!inside && yy >= Y - 2 && STAND[tt]) continue;
          ok = false;
        }
      }
      if (!ok) continue;
      for (const b of G.tribe.buildings) {
        if (b.id === ignoreId) continue;
        if (x0 < b.x + b.w + 1 && x0 + bw + 1 > b.x && top < b.y + b.h + 2 && Y > b.y - 2) { ok = false; break; }
      }
      // nor on a plot another builder is already heading to
      for (const q of G.tribe.villagers) {
        const p = q.site;
        if (ok && p && x0 < p.x + p.bw + 1 && x0 + bw + 1 > p.x && top < p.y + 2 && Y > p.y - p.bh - 1) ok = false;
      }
      if (ok) return { x: x0, y: Y - 1, groundY: Y, bw, bh };
    }
  }
  return null;
}

export function placeBuilding(kind, x0, bottomY) {
  const T = G.tribe;
  const B = BUILDINGS[kind];
  const w = W();
  const bh = B.rows.length, bw = B.rows[0].length;
  const id = T.nextB++;
  let cells = 0;
  wakeRect(x0 - 1, bottomY - bh - 1, x0 + bw, bottomY + 5);
  // level the ground: clear the footprint, then lay foundations
  let timber = 0;
  for (let c = 0; c < bw; c++) {
    for (let y = bottomY - bh - 1; y <= bottomY; y++) {
      const i = y * w.w + x0 + c;
      if (w.t[i] === E.WOOD || w.t[i] === E.SAPLING) { timber++; w.t[i] = E.EMPTY; w.a[i] = 0; continue; }
      if (y >= bottomY - bh + 1 && w.t[i] !== E.EMPTY) { w.t[i] = E.EMPTY; w.d[i] = 0; w.a[i] = 0; }
    }
    for (let y = bottomY + 1; y < bottomY + 5; y++) {
      const i = y * w.w + x0 + c;
      if (STAND[w.t[i]]) break;
      w.t[i] = kind === 'farm' ? E.DIRT : E.STONE; w.d[i] = 0; w.a[i] = 0;
    }
  }
  for (let r = 0; r < bh; r++) {
    const row = Array.from(B.rows[r]);
    const mats = B.mats[r];
    for (let c = 0; c < bw; c++) {
      const m = mats[c];
      if (m === ' ') continue;
      const x = x0 + c, y = bottomY - (bh - 1) + r;
      const i = y * w.w + x;
      if (m === 'p') { w.t[i] = E.CROP; w.d[i] = (Math.random() * 60) | 0; w.a[i] = id; w.v[i] = 0; cells++; continue; }
      if (m === 't') { w.t[i] = E.TORCH; w.d[i] = 0; w.a[i] = id; w.v[i] = 0; cells++; continue; }
      w.t[i] = E.STRUCT;
      w.d[i] = gi(row[c]);
      w.v[i] = MATC[m];
      w.a[i] = id;
      cells++;
    }
  }
  if (timber) T.wood += Math.ceil(timber / 3);
  const b = { id, kind, x: x0, y: bottomY - (bh - 1), w: bw, h: bh, cells, built: G.env.day };
  T.buildings.push(b);
  emit('built', b);
  return b;
}

function checkBuilding(b) {
  const w = W();
  let n = 0;
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * w.w + x;
      const tt = w.t[i];
      if ((tt === E.STRUCT || tt === E.CROP || tt === E.TORCH) && w.a[i] === b.id) n++;
    }
  }
  if (n >= b.cells * 0.55 || (b.kind === 'farm' && n >= 2)) return true;
  // collapse
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * w.w + x;
      if ((w.t[i] === E.STRUCT || w.t[i] === E.CROP || w.t[i] === E.TORCH) && w.a[i] === b.id) {
        const m = w.v[i];
        if (w.t[i] === E.STRUCT && (m === MAT.STONE || m === MAT.BRICK)) putCell(i, E.SAND);
        else if (w.t[i] === E.STRUCT && m === MAT.METAL) putCell(i, Math.random() < 0.5 ? E.METAL : E.EMPTY);
        else putCell(i, Math.random() < 0.5 ? E.ASH : E.EMPTY);
      }
    }
  }
  const T = G.tribe;
  T.buildings = T.buildings.filter((q) => q !== b);
  for (const v of T.villagers) {
    if (v.home === b.id) { v.home = 0; if (v.inside) { v.inside = false; v.y = b.y + b.h - 1; v.x = b.x + (b.w >> 1); } }
  }
  if (b.kind !== 'farm' && b.kind !== 'lamp') T.trauma = Math.min(0.5, T.trauma + 0.08);
  emit('collapse', b);
  return false;
}

const TIER = { tent: 1, hut: 2, house: 3, stonehouse: 4, tower: 5 };
// dwellings that could make way for a better one, humblest and oldest first
function humblerThan(tier) {
  return G.tribe.buildings.filter((b) => TIER[b.kind] && TIER[b.kind] < tier).sort((a, b) => TIER[a.kind] - TIER[b.kind] || a.id - b.id);
}

export function demolish(b) {
  const w = W();
  const T = G.tribe;
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * w.w + x;
      if ((w.t[i] === E.STRUCT || w.t[i] === E.CROP || w.t[i] === E.TORCH) && w.a[i] === b.id) {
        w.t[i] = E.EMPTY; w.a[i] = 0; w.d[i] = 0;
        if (w.wake) w.wake(i);
        if (Math.random() < 0.3) spawnFx({ x, y, vx: (Math.random() - 0.5) * 0.4, vy: -0.15, g: 0.03, life: 40, glyph: '▪', color: [200, 180, 150] });
      }
    }
  }
  T.buildings = T.buildings.filter((q) => q !== b);
  for (const v of T.villagers) {
    if (v.home === b.id) { v.home = 0; if (v.inside) { v.inside = false; v.x = b.x + (b.w >> 1); v.y = b.y + b.h - 1; } }
  }
}

const dirtyB = new Set();
on('structHit', (id) => dirtyB.add(id));

// ── targets ────────────────────────────────────────────────────────────────
function scanNear(cx, radius, pred, up = 16, down = 3) {
  const w = W();
  for (let r = 0; r <= radius; r++) {
    for (const sx of r === 0 ? [cx] : [cx - r, cx + r]) {
      if (sx < 2 || sx > w.w - 3) continue;
      const sy = w.surf[sx];
      for (let y = Math.max(2, sy - up); y <= Math.min(w.h - 3, sy + down); y++) {
        const i = y * w.w + sx;
        if (!G.tribe.claimed.has(i) && pred(w.t[i], i, sx, y)) return { x: sx, y, i };
      }
    }
  }
  return null;
}

const P = {
  tree: (tt, i) => tt === E.WOOD && STAND[W().t[i + W().w]] && W().t[i + W().w] !== E.WOOD && W().t[i + W().w] !== E.STRUCT,
  food: (tt, i) => {
    const w = W();
    if (tt === E.FLOWER) return true;
    if (tt === E.CROP) return w.d[i] >= 210;
    if (tt === E.LEAF && (G.env.season === 1 || G.env.season === 2)) {
      const sp = w.a[i] & 7;
      return (sp === SP.OAK || sp === SP.CHERRY || sp === SP.PALM || sp === SP.JUNGLE) && hash2(i, G.env.day, 2) < 0.25;
    }
    return false;
  },
  shore: (tt, i) => {
    const w = W();
    return STAND[tt] && tt !== E.STRUCT && w.t[i - w.w] === E.EMPTY && (w.t[i + 1 - w.w] === E.WATER || w.t[i - 1 - w.w] === E.WATER || w.t[i + 1] === E.WATER || w.t[i - 1] === E.WATER);
  },
  stone: (tt, i, x, y) => {
    const ok = tt === E.STONE || (G.tribe.era >= 3 && (tt === E.METAL || tt === E.GOLD)) || (G.tribe.era >= 2 && tt === E.GOLD);
    return ok && y <= ground0(x) + 12 && !underBuilding(x);
  },
  metal: (tt, i, x, y) => (tt === E.METAL || tt === E.GOLD) && y <= ground0(x) + 22 && !underBuilding(x),
};

// the lie of the land before anyone dug into it: quarries never sink too deep
function ground0(x) {
  const w = W();
  if (!w.surf0) w.surf0 = Int16Array.from(w.surf);
  return w.surf0[x];
}

function underBuilding(x) {
  for (const b of G.tribe.buildings) if (x >= b.x - 2 && x <= b.x + b.w + 1) return true;
  return false;
}

// ── movement ───────────────────────────────────────────────────────────────
function hollowWater(w, x, y) {
  for (let k = 0; k < 24; k++) {
    const q = w.t[(y + k) * w.w + x];
    if (q !== E.WATER && q !== E.FISH) return !STAND[q];
  }
  return false;
}

function tryStep(v, dir) {
  const w = W();
  const { t } = w;
  const nx = v.x + dir;
  if (nx < 3 || nx > w.w - 4) return false;
  const c1 = t[v.y * w.w + nx];
  const walking = v.state === 'walk';
  const swimIn = (c1 === E.WATER || c1 === E.FISH) && walking && Math.abs(v.tx - v.x) > 2;
  const shallow = (c1 === E.WATER) && STAND[t[(v.y + 1) * w.w + nx]];
  if (canOccupy(c1) || shallow || swimIn) {
    let drop = 0, bottom = 0;
    for (let k = 1; k <= 12; k++) {
      bottom = t[(v.y + k) * w.w + nx];
      if (STAND[bottom] || !PASS[bottom] || AVOID.has(bottom)) break;
      drop++;
    }
    if (DEADLY[bottom] || bottom === E.LAVA || bottom === E.ACID || bottom === E.OIL) return false;
    // water with nothing under it is a falling stream, not a pond
    if ((bottom === E.WATER || c1 === E.WATER) && hollowWater(w, nx, c1 === E.WATER ? v.y : v.y + drop + 1)) return false;
    if (drop >= (v.state === 'flee' ? 9 : 5)) {
      // careful descent towards a lower destination
      if (walking && v.ty > v.y + 2) { v.x = nx; v.descend = true; return true; }
      if (bottom === E.WATER && walking && drop < 10) { v.x = nx; v.descend = true; return true; }
      return false;
    }
    if (bottom === E.WATER && !swimIn && !shallow && !walking) return false;
    v.x = nx;
    return true;
  }
  if (v.y > 3) {
    const up = t[(v.y - 1) * w.w + nx], upHere = t[(v.y - 1) * w.w + v.x];
    if (canOccupy(up) && canOccupy(upHere)) { v.x = nx; v.y -= 1; v.climb = 0; return true; }
    const up2 = t[(v.y - 2) * w.w + nx], up2Here = t[(v.y - 2) * w.w + v.x];
    if (!canOccupy(up) && canOccupy(up2) && canOccupy(upHere) && canOccupy(up2Here)) { v.x = nx; v.y -= 2; v.climb = 0; return true; }
    // scale the wall when the destination lies beyond it
    if (walking && canOccupy(upHere) && (v.climb || 0) < 24 && Math.abs(v.tx - v.x) > 1) {
      v.y -= 1;
      v.climb = (v.climb || 0) + 1;
      return true;
    }
  }
  return false;
}

function dig(v, dir) {
  const w = W();
  for (const dy of [0, -1]) {
    const i = (v.y + dy) * w.w + v.x + dir;
    const tt = w.t[i];
    if (tt === E.DIRT || tt === E.GRASS || tt === E.SAND || tt === E.SNOW || tt === E.ASH || tt === E.LEAF || tt === E.STONE || tt === E.ICE) {
      putCell(i, E.EMPTY);
      return true;
    }
  }
  return false;
}

// stuck under the target (at the bottom of a pit or a mine shaft): scale the rock face
const ROCK = new Set([E.DIRT, E.GRASS, E.SAND, E.SNOW, E.ASH, E.STONE, E.ICE, E.OBSIDIAN, E.METAL, E.GOLD, E.BEDROCK]);
function climbOut(v) {
  const w = W(), t = w.t, i = v.y * w.w + v.x, up = i - w.w;
  if (v.y < 4 || (v.climb || 0) > 60) return false;
  // a tunnel roof overhead: dig a way up through it
  if (!canOccupy(t[up])) {
    const tt = t[up];
    if (tt !== E.DIRT && tt !== E.GRASS && tt !== E.SAND && tt !== E.SNOW && tt !== E.ASH && tt !== E.STONE && tt !== E.ICE) return false;
    putCell(up, E.EMPTY);
    return true;
  }
  // over the lip of the wall
  for (const d of [v.dir, -v.dir]) {
    if (ROCK.has(t[i + d]) && canOccupy(t[up + d])) { v.dir = d; v.x += d; v.y--; v.climb = 0; return true; }
  }
  // or up the rock alongside
  for (const d of [v.dir, -v.dir]) {
    if (ROCK.has(t[up + d])) { v.dir = d; v.y--; v.climb = (v.climb || 0) + 1; return true; }
  }
  // no wall to hand: walk over to one
  if (!v.climb && tryStep(v, v.dir)) return true;
  v.dir = -v.dir;
  return false;
}

// unreachable target: refund what was promised and deliver what is carried
function giveUp(v) {
  const T = G.tribe;
  dbg('giveup:' + v.then);
  release(v);
  if (v.site) {
    for (const k in BUILDINGS[v.site.kind].cost) T[k] += BUILDINGS[v.site.kind].cost[k];
    for (let x = v.site.x - 3; x <= v.site.x + 3; x++) (T.bad || (T.bad = {}))[x] = G.env.day + 2;
    v.site = null;
  }
  if (v.carry) { T[v.carry] = (T[v.carry] || 0) + v.carryAmt; v.carry = null; v.carryAmt = 0; }
  v.state = 'idle';
  v.job = 'idle';
  v.stuck = 0;
}

export function walkTo(v, tx, ty, then, reach = 1) {
  v.tx = tx; v.ty = ty; v.then = then; v.reach = reach; v.state = 'walk'; v.stuck = 0;
  v.walkT = 160 + 3 * (Math.abs(tx - v.x) + Math.abs(ty - v.y));
}

function release(v) {
  if (v.ti >= 0) G.tribe.claimed.delete(v.ti);
  v.ti = -1;
}

// ── jobs ───────────────────────────────────────────────────────────────────
function assign(v) {
  const T = G.tribe;
  dbg('assign:' + v.job);
  const env = G.env;
  if (v.kid && v.job !== 'food') { wander(v); return; }
  const job = v.job;
  if (job === 'wood') {
    const tg = scanNear(v.x, 70, P.tree, 16, 2);
    if (tg) { claim(v, tg); walkTo(v, tg.x, tg.y, 'chop'); return; }
  } else if (job === 'food') {
    const tg = scanNear(v.x, 60, P.food, 9, 2); // fruit within reach of the ground
    // hunters go after game when there is some about
    if (!v.kid && Math.random() < (tg ? 0.35 : 0.65)) {
      const prey = nearestPrey(v.x, v.y, 80);
      if (prey) { v.hunt = prey.id; walkTo(v, prey.x, prey.y, 'hunt', T.era >= 2 ? 6 : 4); return; }
    }
    if (tg) { claim(v, tg); walkTo(v, tg.x, tg.y, 'gather', 0); return; }
    if (Math.random() < 0.5) {
      const sh = scanNear(v.x, 70, P.shore, 6, 6);
      if (sh) { walkTo(v, sh.x, sh.y - 1, 'fish', 0); return; }
    }
    if (G.env.season !== 3) {
      for (let k = 0; k < 5; k++) {
        const fx = Math.max(3, Math.min(W().w - 4, Math.round(v.x + (Math.random() * 2 - 1) * 30)));
        const fy = W().surf[fx];
        const g = W().t[fy * W().w + fx];
        if (g === E.GRASS || g === E.DIRT) { walkTo(v, fx, fy - 1, 'forage', 0); return; }
      }
    }
  } else if (job === 'stone') {
    const wantMetal = T.era >= 3 && T.metal < 40 && Math.random() < 0.55;
    const pred = wantMetal ? P.metal : P.stone, down = wantMetal ? 30 : T.era >= 3 ? 14 : 9;
    // once the seams near the village run out, miners go further and dig deeper
    const tg = scanNear(v.x, 70, pred, 10, down) || (T.era >= 2 ? scanNear(v.x, 170, pred, 10, down + 16) : null);
    if (tg) { claim(v, tg); walkTo(v, tg.x, W().surf[tg.x] - 1, 'mine'); return; }
  } else if (job === 'build') {
    const kind = T.building;
    if (kind && afford(BUILDINGS[kind].cost)) {
      const renew = T.renew;
      T.renew = false;
      // no room in the village: look further out, up and down the hills
      const site = renew ? null : findSite(kind, T.center) || (kind !== 'lamp' ? findSite(kind, T.center, 160, 0, 26) : null);
      if (site) {
        pay(BUILDINGS[kind].cost);
        v.site = { kind, ...site };
        T.building = null;
        walkTo(v, site.x + (site.bw >> 1), site.y, 'build', 2);
        return;
      }
      if (!renew) { T.blocked = (T.blocked || 0) + 1; dbg('nosite:' + kind); }
      // no free land: replace the oldest, humblest dwelling with a better one
      let up = null, s2 = null;
      for (const b of TIER[kind] ? humblerThan(TIER[kind]) : []) {
        s2 = findSite(kind, b.x + (b.w >> 1), 10, b.id);
        if (s2) { up = b; break; }
      }
      if (s2) {
        // the old dwelling comes down only when the builder gets there
        pay(BUILDINGS[kind].cost);
        v.site = { kind, ...s2, replace: up.id };
        T.building = null;
        walkTo(v, s2.x + (s2.bw >> 1), s2.y, 'build', 2);
        return;
      }
      // nowhere to put it: try something else for a while
      (T.skip || (T.skip = {}))[renew ? 'renew' : kind] = G.env.time + 4000;
      T.building = null;
    }
    v.job = 'idle';
  } else if (job === 'pray') {
    const tmp = T.buildings.find((b) => b.kind === 'temple');
    if (tmp) { walkTo(v, tmp.x + (tmp.w >> 1) + ((Math.random() * 5) | 0) - 2, tmp.y + tmp.h - 1, 'pray', 1); return; }
  }
  if (env.night) { goHome(v); return; }
  wander(v);
}

function claim(v, tg) {
  release(v);
  v.ti = tg.i;
  G.tribe.claimed.add(tg.i);
}

function wander(v) {
  const T = G.tribe;
  const span = 8 + T.buildings.length * 2;
  const tx = Math.round(T.center + (Math.random() * 2 - 1) * span);
  walkTo(v, tx, v.y, 'rest', 1);
}

function goHome(v) {
  const T = G.tribe;
  let home = T.buildings.find((b) => b.id === v.home);
  if (!home) {
    v.home = 0;
    for (const b of T.buildings) {
      const cap = BUILDINGS[b.kind].cap;
      if (!cap || b.kind === 'camp') continue;
      const n = T.villagers.filter((q) => q.home === b.id).length;
      if (n < cap) { v.home = b.id; home = b; break; }
    }
  }
  if (home) walkTo(v, home.x + (home.w >> 1), home.y + home.h - 1, 'enter', 0);
  else walkTo(v, Math.round(T.center + (Math.random() * 6 - 3)), v.y, 'sleep', 1);
}

export function afford(cost) {
  const T = G.tribe;
  for (const k in cost) if ((T[k] || 0) < cost[k]) return false;
  return true;
}
function pay(cost) {
  const T = G.tribe;
  for (const k in cost) T[k] -= cost[k];
}

// actions performed when a villager arrives
const DBG = (G.dbg = {});
const dbg = (k) => { DBG[k] = (DBG[k] || 0) + 1; };

function arrive(v) {
  const T = G.tribe;
  const w = W();
  dbg('arrive:' + v.then);
  switch (v.then) {
    case 'chop':
      if (w.t[v.ti] !== E.WOOD) { release(v); v.state = 'idle'; return; }
      v.state = 'work'; v.timer = 110; v.action = 'chop';
      say(v, pick(L(['tchac!', 'hop', 'du bois!'], ['chop!', 'hup', 'wood!'])), 90);
      return;
    case 'gather':
      v.state = 'work'; v.timer = 50; v.action = 'gather';
      return;
    case 'forage':
      v.state = 'work'; v.timer = 240; v.action = 'forage';
      return;
    case 'fish':
      v.state = 'work'; v.timer = 260; v.action = 'fish';
      say(v, '~o', 120);
      return;
    case 'mine':
      v.state = 'work'; v.timer = 140; v.action = 'mine';
      return;
    case 'hunt': {
      const prey = animalById(v.hunt);
      if (!prey) { v.state = 'idle'; return; }
      v.dir = Math.sign(prey.x - v.x) || v.dir;
      v.state = 'work'; v.timer = 34; v.action = 'hunt';
      say(v, pick(L(['chut…', 'là!', 'pas un bruit'], ['shh…', 'there!', 'quiet now'])), 60);
      return;
    }
    case 'build':
      v.state = 'work'; v.timer = 300; v.action = 'build';
      say(v, pick(L(['on bâtit!', 'hisse!'], ['build!', 'heave!'])), 120);
      return;
    case 'deposit':
      if (v.carry) {
        T[v.carry] = (T[v.carry] || 0) + v.carryAmt;
        emit('deposit', v.carry, v.carryAmt);
        floatText(v.x, v.y - 1, '+' + v.carryAmt + (v.carry === 'food' ? '♣' : v.carry === 'wood' ? '≡' : v.carry === 'stone' ? '▪' : '◆'), [255, 230, 160], 70);
      }
      v.carry = null; v.carryAmt = 0;
      v.state = 'idle';
      return;
    case 'pray':
      v.state = 'work'; v.timer = 400; v.action = 'pray';
      return;
    case 'mourn':
      v.state = 'work'; v.timer = 220; v.action = 'mourn';
      mournAt(v);
      return;
    case 'enter': {
      const home = T.buildings.find((b) => b.id === v.home);
      if (home && G.env.night) { v.inside = true; v.state = 'inside'; return; }
      v.state = 'idle';
      return;
    }
    case 'sleep':
      v.state = 'work'; v.timer = 600; v.action = 'sleep';
      return;
    default:
      v.state = 'work'; v.timer = 60 + ((Math.random() * 200) | 0); v.action = 'rest';
  }
}

function finishWork(v) {
  const T = G.tribe;
  const w = W();
  switch (v.action) {
    case 'chop': {
      const n = fell(v.ti);
      release(v);
      if (n > 0) { v.carry = 'wood'; v.carryAmt = Math.max(1, Math.round(n / 3)); deed(v, 'wood'); say(v, L('timber!', 'timber!'), 80); }
      break;
    }
    case 'gather': {
      const tt = w.t[v.ti];
      if (tt === E.FLOWER || tt === E.LEAF) { putCell(v.ti, E.EMPTY); v.carry = 'food'; v.carryAmt = 1; }
      else if (tt === E.CROP && w.d[v.ti] >= 210) { w.d[v.ti] = 0; v.carry = 'food'; v.carryAmt = 3; }
      release(v);
      break;
    }
    case 'fish': {
      let got = false;
      for (let k = 0; k < 60 && !got; k++) {
        const x = v.x + ((Math.random() * 17) | 0) - 8, y = v.y + ((Math.random() * 10) | 0);
        if (x < 1 || x >= w.w - 1 || y >= w.h - 1) continue;
        const i = y * w.w + x;
        if (w.t[i] === E.FISH) { putCell(i, E.WATER); got = true; }
      }
      if (got) { v.carry = 'food'; v.carryAmt = 3; deed(v, 'fish'); say(v, '><>!', 90); }
      else say(v, '...', 60);
      break;
    }
    case 'forage':
      if (Math.random() < (G.env.season === 2 ? 0.8 : 0.6)) { v.carry = 'food'; v.carryAmt = 1; }
      break;
    case 'mine': {
      const tt = w.t[v.ti];
      // a good haul: the target block plus a couple of neighbours of the same ore
      const kind = tt === E.STONE ? 'stone' : tt === E.METAL || tt === E.GOLD ? 'metal' : null;
      if (kind) {
        let n = 0;
        for (const o of [w.w, 0, -1, 1]) {
          const j = v.ti + o;
          const tj = w.t[j];
          if ((kind === 'stone' && tj === E.STONE) || (kind === 'metal' && (tj === E.METAL || tj === E.GOLD))) {
            n += tj === E.GOLD ? 2 : 1;
            if (tj === E.GOLD) emit('gold', v);
            // near the surface the quarry opens up; deeper down the galleries are backfilled with spoil
            if (((j / w.w) | 0) <= ground0(j % w.w) + 6) sinkCell(j);
            else putCell(j, kind === 'metal' ? E.STONE : E.DIRT);
            if (n >= 3) break;
          }
        }
        v.carry = kind;
        v.carryAmt = n;
        deed(v, 'stone', n);
      }
      release(v);
      break;
    }
    case 'build': {
      const s = v.site;
      v.site = null;
      if (s) {
        const old = s.replace && T.buildings.find((b) => b.id === s.replace);
        if (old) { demolish(old); emit('upgrade', old.kind, s.kind); dbg('upgrade:' + s.kind); }
        // the ground may have changed a little (a puddle, a clod, a sapling): builders
        // clear and level the footprint themselves, so only another structure stops them
        const clash = (x0, y0) => T.buildings.some((b) => x0 < b.x + b.w + 1 && x0 + s.bw + 1 > b.x && y0 - s.bh + 1 < b.y + b.h + 2 && y0 + 1 > b.y - 2) || (() => {
          for (let y = y0 - s.bh + 1; y <= y0; y++) for (let x = x0; x < x0 + s.bw; x++) if (w.t[y * w.w + x] === E.STRUCT) return true;
          return false;
        })();
        let at = clash(s.x, s.y) ? null : { x: s.x, y: s.y };
        if (!at) { const again = findSite(s.kind, s.x + (s.bw >> 1), 6); if (again && !clash(again.x, again.y)) at = again; }
        if (at) { placeBuilding(s.kind, at.x, at.y); deed(v, 'built'); dbg('built:' + s.kind); }
        else { dbg('refund:' + s.kind); const T2 = G.tribe; for (const k in BUILDINGS[s.kind].cost) T2[k] += BUILDINGS[s.kind].cost[k]; }
      }
      v.job = 'idle';
      break;
    }
    case 'pray':
      emit('pray', v);
      deed(v, 'pray');
      break;
    case 'hunt': {
      const prey = animalById(v.hunt);
      v.hunt = 0;
      if (prey && Math.abs(prey.x - v.x) <= 9 && Math.abs(prey.y - v.y) <= 5) {
        emit('sfx', 'spear', v.x, v.y);
        spawnFx({ x: v.x + v.dir, y: v.y - 1, vx: (prey.x - v.x) / 14, vy: -0.22, g: 0.03, life: 15, glyph: '/', color: [210, 170, 120] });
        if (Math.random() < 0.45 + T.era * 0.08) {
          killAnimal(prey, 'hunt');
          deed(v, 'hunt');
          v.carry = 'food'; v.carryAmt = KINDS[prey.kind].food;
          say(v, pick(L(['dîner!', 'touché!', 'merci, bête'], ['dinner!', 'got it!', 'thank you, beast'])), 90);
          emit('discover', 'hunt');
        } else say(v, L('raté…', 'missed…'), 70);
      }
      break;
    }
  }
  if (v.carry) { walkTo(v, Math.round(T.center), v.y, 'deposit', 2); return; }
  v.state = 'idle';
}

// remove a whole tree from its base, returns wood count
function fell(i0) {
  const w = W();
  const { t } = w;
  if (t[i0] !== E.WOOD) return 0;
  const y0 = (i0 / w.w) | 0;
  const q = [i0];
  const seen = new Set(q);
  let n = 0;
  while (q.length && n < 160) {
    const i = q.pop();
    const y = (i / w.w) | 0;
    putCell(i, E.EMPTY);
    n++;
    if (Math.random() < 0.3) spawnFx({ x: i % w.w, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.1, g: 0.02, life: 40, glyph: '≡', color: [190, 140, 80] });
    for (const o of [-w.w - 1, -w.w, -w.w + 1, -1, 1, w.w - 1, w.w + 1]) {
      const j = i + o;
      if (seen.has(j)) continue;
      const yj = (j / w.w) | 0;
      if (yj > y0) continue;
      if (t[j] === E.WOOD || t[j] === E.SAPLING) { seen.add(j); q.push(j); }
    }
  }
  emit('fell', i0 % w.w, y0);
  return n;
}

// ── per-tick update ───────────────────────────────────────────────────────
export function updateLife() {
  const T = G.tribe;
  if (!T) return;
  const w = W();
  const env = G.env;
  const tick = w.tick;
  const { t, c } = w;

  for (let k = T.villagers.length - 1; k >= 0; k--) {
    const v = T.villagers[k];
    if (v.sayT > 0) v.sayT--;
    if (v.inside) {
      if (!env.night || !T.buildings.some((b) => b.id === v.home)) {
        v.inside = false;
        v.state = 'idle';
        const home = T.buildings.find((b) => b.id === v.home);
        if (home) { v.x = home.x + (home.w >> 1); v.y = home.y + home.h - 1; }
      } else continue;
    }
    const i = v.y * w.w + v.x;
    const here = t[i];
    if (DEADLY[here] || c[i] > 0) { kill(v, here === E.LAVA ? 'lava' : here === E.ACID ? 'acid' : c[i] > 0 || here === E.BOLT ? 'zap' : here === E.GLITCH ? 'glitch' : 'fire'); continue; }
    if (here === E.STONE || here === E.DIRT || here === E.SAND || here === E.METAL || here === E.OBSIDIAN || here === E.GRASS || here === E.ICE || here === E.SNOW || here === E.GLASS || here === E.ASH) {
      // buried: try to pop up, else suffocate
      if (canOccupy(t[i - w.w])) v.y--;
      else if (++v.stuck > 180) { kill(v, 'buried'); continue; }
    }
    const wet = here === E.WATER || here === E.OIL || here === E.FISH;
    const below0 = t[i + w.w];
    if (wet) { v.fall = 0; v.descend = false; v.climb = 0; }
    if (wet && !STAND[below0]) {
      // swimming: rise to the surface, then paddle towards the shore
      const up = t[i - w.w];
      const submerged = up === E.WATER || up === E.OIL || up === E.FISH;
      if (submerged) {
        if (--v.breath <= 0) { kill(v, 'drown'); continue; }
        if (v.breath === 150) say(v, L('glou!', 'glub!'), 60);
      } else if (v.breath < 240) v.breath += 2;
      if ((tick & 3) === 0) {
        if (submerged) v.y--;
        else {
          const sx = v.x + v.dir;
          const side = t[v.y * w.w + sx];
          // (out of the water only onto ground, never over a drop)
          const landing = () => { for (let k = 1; k <= 4; k++) { const q = t[(v.y + k) * w.w + sx]; if (STAND[q] || q === E.WATER) return true; if (!PASS[q]) return false; } return false; };
          if (side === E.WATER || side === E.FISH || (canOccupy(side) && landing())) v.x = sx;
          else if (canOccupy(t[(v.y - 1) * w.w + sx]) && canOccupy(up)) { v.x = sx; v.y--; }
          else if (ROCK.has(side) && canOccupy(up) && v.state === 'walk') { v.y--; v.climb = 1; }
          else v.dir = -v.dir;
        }
      }
      continue;
    }
    if (v.breath < 240) v.breath++;
    // gravity (climbers cling to the wall, descenders lower themselves)
    const below = t[i + w.w];
    if (!STAND[below]) {
      const clinging = v.climb > 0 && !PASS[t[i + v.dir]] && v.state === 'walk';
      if (!clinging && v.climb > 0) { v.climb = 0; v.descend = true; }
      if (!clinging && (PASS[below] || KIND[below] === K.LIQUID || DEADLY[below])) {
        if (v.descend) { if ((tick & 1) === 0) v.y++; continue; }
        v.y++;
        v.fall++;
        continue;
      }
      if (!clinging) v.climb = 0;
    } else {
      v.climb = 0;
      v.descend = false;
      if (v.fall > 0) {
        if (v.fall > 14) { kill(v, 'fall'); continue; }
        if (v.fall > 6) say(v, L('aïe', 'ouch'), 60);
        v.fall = 0;
      }
    }
    // danger sense
    if (--v.dangerT <= 0) {
      v.dangerT = 18;
      const d = senseDanger(v.x, v.y);
      if (d !== 0 && v.state !== 'flee') {
        release(v);
        v.state = 'flee'; v.timer = 120; v.dir = -d;
        if (v.site) { const T2 = G.tribe; for (const kk in BUILDINGS[v.site.kind].cost) T2[kk] += BUILDINGS[v.site.kind].cost[kk]; v.site = null; }
        say(v, pick(['!!', '!', L('AAH', 'AAH'), L('au feu!', 'fire!')]), 90);
        emit('fear', v);
      }
    }
    if (v.state === 'work') {
      v.timer--;
      if (v.action === 'chop' && (tick & 15) === 0) { spawnFx({ x: v.x + v.dir, y: v.y, vx: (Math.random() - 0.5) * 0.4, vy: -0.2, g: 0.03, life: 25, glyph: '·', color: [200, 150, 90] }); emit('sfx', 'chop', v.x, v.y); }
      if (v.action === 'mine' && (tick & 15) === 0) { spawnFx({ x: v.x + v.dir, y: v.y, vx: (Math.random() - 0.5) * 0.4, vy: -0.2, g: 0.03, life: 25, glyph: '∙', color: [190, 190, 200] }); emit('sfx', 'pick', v.x, v.y); }
      if (v.action === 'build' && (tick & 15) === 0) { spawnFx({ x: v.x + ((Math.random() * 5) | 0) - 2, y: v.y - 1 - ((Math.random() * 3) | 0), vy: -0.05, life: 30, glyph: '+', color: [255, 220, 150] }); emit('sfx', 'hammer', v.x, v.y); }
      if (v.action === 'pray' && (tick & 63) === 0) floatText(v.x, v.y - 1, '◊', [120, 240, 255], 60);
      if (v.action === 'sleep' && (tick & 127) === 0) floatText(v.x, v.y - 1, 'z', [180, 190, 255], 70);
      if (v.timer <= 0) finishWork(v);
      continue;
    }
    if (--v.cool > 0) continue;
    v.cool = v.kid ? 7 : v.state === 'flee' ? 5 : 9;

    if (v.state === 'flee') {
      if (!tryStep(v, v.dir)) { v.dir = -v.dir; tryStep(v, v.dir); }
      v.timer -= 9;
      if (v.timer <= 0) v.state = 'idle';
      continue;
    }
    if (v.state === 'walk') {
      if (--v.walkT < 0) { giveUp(v); continue; }
      if (v.then === 'hunt') {
        const prey = animalById(v.hunt);
        if (!prey || Math.abs(prey.x - v.x) > 80) { v.hunt = 0; v.state = 'idle'; continue; }
        v.tx = prey.x; v.ty = prey.y;
      }
      const dx = v.tx - v.x;
      if (Math.abs(dx) <= v.reach) {
        if (Math.abs(v.ty - v.y) <= 4 || (Math.abs(v.ty - v.y) <= 10 && ++v.stuck > 6)) { v.stuck = 0; arrive(v); }
        else if (v.ty < v.y - 10 && climbOut(v)) v.stuck = 0;
        else if (++v.stuck > 30) giveUp(v);
        continue;
      }
      const dir = Math.sign(dx) || v.dir;
      v.dir = dir;
      if (tryStep(v, dir)) { v.stuck = 0; }
      else if (++v.stuck > 14) {
        if (v.stuck > 20 && dig(v, dir)) v.stuck = 10;
        else if (v.stuck > 30) giveUp(v);
      }
      continue;
    }
    if (v.state === 'idle') {
      if (env.night && v.job !== 'build') { goHome(v); continue; }
      assign(v);
    }
  }

  // smoke from the chimneys, thicker on cold days
  if ((tick & 31) === 0) {
    const cold = env.temp < 8 || env.night ? 2 : 1;
    for (const b of T.buildings) {
      const B = BUILDINGS[b.kind];
      if (!B || (B.chimney === undefined && b.kind !== 'hut') || Math.random() > 0.1 * cold) continue;
      const x = b.x + (B.chimney ?? (b.w >> 1)) + 0.3;
      spawnFx({ x, y: b.y - 1, vx: 0.008 + Math.random() * 0.02, vy: -0.025 - Math.random() * 0.02, life: 120 + Math.random() * 80, glyph: Math.random() < 0.6 ? '░' : '▒', color: [196, 196, 206], up: true });
    }
  }

  // faith sparks
  if ((tick & 7) === 0) {
    for (const v of T.villagers) {
      if (v.inside || v.kid) continue;
      if (--v.faithT <= 0) {
        v.faithT = 70 + Math.random() * 80;
        floatText(v.x, v.y - 1, '◊', [120, 230, 255], 50).small = true;
      }
    }
  }

  if (tick % 60 === 0) manage();
  if (tick % 240 === 0) for (const b of [...T.buildings]) checkBuilding(b);
  else if (dirtyB.size) {
    for (const id of dirtyB) { const b = T.buildings.find((q) => q.id === id); if (b) checkBuilding(b); }
    dirtyB.clear();
  }
}

function senseDanger(x, y) {
  const w = W();
  const { t } = w;
  for (let dy = -3; dy <= 2; dy++) {
    const yy = y + dy;
    if (yy < 1 || yy >= w.h - 1) continue;
    for (let dx = -5; dx <= 5; dx++) {
      const xx = x + dx;
      if (xx < 1 || xx >= w.w - 1) continue;
      const tt = t[yy * w.w + xx];
      if (tt === E.FIRE || tt === E.LAVA || tt === E.EMBER || tt === E.GLITCH || tt === E.ACID) return dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
    }
  }
  return 0;
}

export function kill(v, cause) {
  const T = G.tribe;
  release(v);
  T.villagers = T.villagers.filter((q) => q !== v);
  T.deaths++;
  T.trauma = Math.min(0.5, T.trauma + 0.05);
  spawnFx({ x: v.x, y: v.y, vy: -0.06, life: 110, glyph: '†', color: [230, 230, 255], glow: 0.4, up: true });
  emit('death', v, cause);
}

// ── the tribe's brain ─────────────────────────────────────────────────────
function manage() {
  const T = G.tribe;
  const env = G.env;
  const pop = T.villagers.length;
  if (pop === 0) return;
  const cap = capacity();

  // village centre drifts towards the buildings
  const homes = T.buildings.filter((b) => b.kind !== 'farm' && b.kind !== 'lamp');
  if (homes.length) {
    let sx = 0;
    for (const b of homes) sx += b.x + b.w / 2;
    T.center += (sx / homes.length - T.center) * 0.05;
  }

  // what to build next
  // a big tribe runs several building sites at once
  const crews = T.villagers.filter((v) => v.job === 'build').length;
  if (!T.building && crews < Math.min(6, 1 + Math.floor(pop / 12))) T.building = nextBuilding(T, pop, cap);
  const cost = T.building ? BUILDINGS[T.building].cost : {};

  // meals
  T.mealT++;
  if (T.mealT >= DAY / 60 / 3) {
    T.mealT = 0;
    let need = 0;
    for (const v of T.villagers) need += v.kid ? 0.2 : 0.4;
    if (T.food >= need) { T.food -= need; T.hunger = Math.max(0, T.hunger - 1); }
    else {
      T.food = 0;
      T.hunger++;
      emit('hunger', T.hunger);
      if (T.hunger >= 4) {
        const victim = pick(T.villagers);
        if (victim) kill(victim, 'starve');
      }
    }
  }

  // jobs: guarantee the urgent quotas, then everyone else works where it's needed
  const adults = T.villagers.filter((v) => !v.kid);
  const want = { food: 0, wood: 0, stone: 0, build: 0, pray: 0 };
  const foodNeed = pop * (env.season === 2 ? 9 : env.season === 3 ? 6 : 4) + 6;
  want.food = T.food < foodNeed ? Math.ceil(adults.length * (T.food < pop * 2 ? 0.55 : 0.4)) : 1;
  const woodNeed = (cost.wood || 0) + (T.era >= 1 ? 4 : 2);
  if (T.wood < woodNeed) want.wood = Math.max(1, Math.ceil(adults.length * 0.25));
  const stoneNeed = (cost.stone || 0) + (T.era >= 2 ? 4 : 0);
  if (T.stone < stoneNeed || (cost.metal && T.metal < cost.metal)) want.stone = Math.max(1, Math.ceil(adults.length * (cost.metal || (cost.stone || 0) > 8 ? 0.4 : 0.25)));
  want.build = T.villagers.filter((v) => v.job === 'build' && v.site).length + (T.building && afford(cost) ? 1 : 0);
  const temple = T.buildings.some((b) => b.kind === 'temple');
  if (temple) want.pray = Math.ceil(adults.length * 0.08);
  const have = { food: 0, wood: 0, stone: 0, build: 0, pray: 0, idle: 0 };
  for (const v of T.villagers) {
    if (v.jobT > 0) v.jobT--;
    else if ((v.job !== 'build' || !v.site) && v.state !== 'work') v.job = 'idle';
    have[v.job] = (have[v.job] || 0) + 1;
  }
  const free = (v) => v.job === 'idle';
  // the builder is someone free right now, up on the surface
  // (shuffled within each group, so one villager stuck somewhere never holds the job for good)
  const ready = (v) => (v.state === 'idle' ? 0 : 1) + (v.y > W().surf[v.x] + 2 ? 2 : 0) + Math.random() * 0.9;
  const byReady = adults.map((v) => [ready(v), v]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  for (const j of ['build', 'food', 'stone', 'wood', 'pray']) {
    for (const v of j === 'build' ? byReady : adults) {
      if (have[j] >= want[j]) break;
      if (!free(v)) continue;
      have.idle--; have[j]++;
      v.job = j; v.jobT = j === 'build' ? 20 : 40 + ((Math.random() * 80) | 0);
    }
  }
  const weights = [
    ['food', T.food < foodNeed ? 3 : T.food < pop * 14 ? 1 : 0.15],
    ['wood', T.wood < 25 + T.era * 15 ? 1.6 : 0.2],
    ['stone', T.era >= 1 && (T.stone < 20 + T.era * 15 || (T.era >= 3 && T.metal < 40)) ? 1.8 : 0],
    ['pray', temple ? 0.7 : 0],
    ['idle', 0.6],
  ];
  const total = weights.reduce((a, w) => a + w[1], 0);
  for (const v of T.villagers) {
    if (!free(v) || v.state === 'work') continue;
    if (v.kid) { if (Math.random() < 0.5) { v.job = 'food'; v.jobT = 60; } continue; }
    let r = Math.random() * total;
    for (const [j, wgt] of weights) { r -= wgt; if (r <= 0) { v.job = j; v.jobT = 40 + ((Math.random() * 80) | 0); break; } }
  }

  // births
  T.lastBirth++;
  if (pop >= 2 && pop < cap && T.food >= pop * 1.5 && T.happiness > 0.4 && T.lastBirth > 22 && Math.random() < 0.07 + T.happiness * 0.05) {
    const homesB = T.buildings.filter((b) => BUILDINGS[b.kind].cap > 0);
    const b = pick(homesB);
    const x = b ? b.x + (b.w >> 1) : Math.round(T.center);
    const y = b ? b.y + b.h - 1 : W().surf[x] - 1;
    const kid = spawnVillager(x, y, { kid: true });
    T.births++;
    T.lastBirth = 0;
    say(kid, '♥', 160);
    floatText(x, y - 2, '♥', [255, 120, 160], 100);
    emit('birth', kid);
  }

  // happiness
  const housed = Math.min(1, cap / Math.max(1, pop));
  let flowers = 0;
  const w = W();
  for (let k = 0; k < 40; k++) {
    const x = Math.round(T.center + (Math.random() * 2 - 1) * 30);
    if (x < 1 || x >= w.w - 1) continue;
    const y = w.surf[x] - 1;
    if (y > 0 && w.t[y * w.w + x] === E.FLOWER) flowers++;
  }
  const target = 0.45 + (T.food > pop * 2 ? 0.2 : T.food > 0 ? 0.05 : -0.2) + housed * 0.15 + Math.min(0.15, flowers * 0.03) + (T.blessT > 0 ? 0.25 : 0) - T.trauma - T.hunger * 0.08;
  T.happiness += (Math.max(0.05, Math.min(1, target)) - T.happiness) * 0.05;
  T.trauma = Math.max(0, T.trauma - 0.002);
  if (T.blessT > 0) T.blessT--;

  // faith production per second
  const temples = countB('temple');
  T.faithRate = (adults.length + (pop - adults.length) * 0.3) * 0.075 * (1 + T.era * 0.35) * (0.4 + T.happiness) * (1 + temples * 0.4) + T.villagers.filter((v) => v.action === 'pray' && v.state === 'work').length * 0.08;
}

function nextBuilding(T, pop, cap) {
  const e = T.era;
  const has = (k) => T.buildings.some((b) => b.kind === k);
  const list = [];
  const rocketTime = e >= 5 && !has('rocket') && !T.launched;
  if (pop >= cap - 1) list.push(ERAS[e].house);
  if (e >= 2 && countB('farm') < Math.ceil(pop / 6)) list.push('farm');
  if (rocketTime) list.unshift('rocket');
  if (e >= 1 && !has('temple') && pop >= 5) list.unshift('temple'); // the first temple comes before anything else
  // a new era rebuilds the dwellings of the old days in its own style
  const home = ERAS[e].house;
  const renew = pop < cap - 1 && T.buildings.some((b) => TIER[b.kind] && TIER[b.kind] < TIER[home]) && !(T.skip && T.skip.renew > G.env.time);
  if (renew) list.push('renew');
  if (e >= 3 && countB('lamp') < Math.floor(T.buildings.length / 3)) list.push('lamp');
  const ok = list.filter((k) => !(T.skip && T.skip[k] > G.env.time));
  if (!ok.length) return null;
  // build what we can afford now; otherwise aim for the most important
  const kindOf = (k) => (k === 'renew' ? home : k);
  const pick = ok.find((k) => afford(BUILDINGS[kindOf(k)].cost)) || ok[0];
  T.renew = pick === 'renew';
  return kindOf(pick);
}

// ── wild ecosystem ─────────────────────────────────────────────────────────
export function updateEcology() {
  const sc = G.world ? G.world.w / 400 : 1; // populations scale with the width of the world
  const w = W();
  const env = G.env;
  if (w.tick % 90 !== 0) return;
  const n = w.counts;
  const { t } = w;
  const R = Math.random;
  const rx = () => 4 + ((R() * (w.w - 8)) | 0);
  // birds
  if (!env.night && n[E.BIRD] < 14 * sc && R() < 0.4) {
    const x = rx(), y = Math.max(4, w.surf[x] - 8 - ((R() * 12) | 0));
    const i = y * w.w + x;
    if (t[i] === E.EMPTY) putCell(i, E.BIRD, 0, R() < 0.5 ? 1 : 0);
  }
  // butterflies near flowers
  if (!env.night && (env.season === 0 || env.season === 1) && n[E.BUTTERFLY] < 14 * sc) {
    for (let k = 0; k < 6; k++) {
      const x = rx(), y = w.surf[x] - 1;
      if (t[y * w.w + x] === E.FLOWER && t[(y - 2) * w.w + x] === E.EMPTY) { putCell((y - 2) * w.w + x, E.BUTTERFLY); break; }
    }
  }
  // fireflies on warm nights
  if (env.night && env.season !== 3 && n[E.FIREFLY] < 45 * sc) {
    for (let k = 0; k < 4; k++) {
      const x = rx(), y = w.surf[x] - 2 - ((R() * 4) | 0);
      const g = t[w.surf[x] * w.w + x];
      if ((g === E.GRASS || g === E.DIRT) && t[y * w.w + x] === E.EMPTY) putCell(y * w.w + x, E.FIREFLY);
    }
  }
  // fish repopulate slowly
  if (n[E.FISH] < Math.min(60 * sc, n[E.WATER] / 160) && R() < 0.3) {
    for (let k = 0; k < 30; k++) {
      const x = rx(), y = w.surf[x] + 3 + ((R() * 12) | 0);
      if (y >= w.h - 2) continue;
      const i = y * w.w + x;
      if (t[i] === E.WATER && t[i - w.w] === E.WATER && t[i + w.w] === E.WATER) { putCell(i, E.FISH, 0, R() < 0.5 ? 1 : 0); break; }
    }
  }
  // worms
  if (n[E.WORM] < 25 * sc && R() < 0.2) {
    const x = rx(), y = w.surf[x] + 2 + ((R() * 4) | 0);
    const i = y * w.w + x;
    if (t[i] === E.DIRT) putCell(i, E.WORM);
  }
  // occasional wild seed so barren land slowly greens
  if (env.season < 2 && R() < 0.15) {
    const x = rx(), y = w.surf[x];
    const i = y * w.w + x;
    if (t[i] === E.GRASS && t[i - w.w] === E.EMPTY && n[E.WOOD] < 1400 * sc) {
      let near = false;
      for (let dx = -4; dx <= 4 && !near; dx++) for (let dy = -10; dy < 0; dy++) if (t[(y + dy) * w.w + x + dx] === E.WOOD || t[(y + dy) * w.w + x + dx] === E.STRUCT) { near = true; break; }
      if (!near && R() < 0.3) plantTree(i - w.w, speciesFor(x, y, w.t[i]));
    }
  }
}
