// ─── powers.js ── what the player's hand can do to the world ───────────────
import { G, emit } from './state.js';
import { E, K, KIND, STAND, SP } from './elements.js';
import { putCell, ignite, strike, explode, plantTree } from './sim.js';
import { spawnFx, floatText } from './fx.js';
import { TOOL, isUnlocked, spend, canSpend, isSandbox } from './progress.js';
import { spawnVillager, foundTribe, say } from './life.js';
import { forceWeather, DAY } from './weather.js';
import { makeCloud } from './worldgen.js';

const R = Math.random;
const REPLACEABLE_GAS = new Set([E.SMOKE, E.STEAM]);

function stat(el, n = 1) {
  const s = G.progress.stats;
  s.placed[el] = (s.placed[el] || 0) + n;
  s.cells += n;
}

function inBrush(cx, cy, r, fn) {
  const W = G.world;
  const ry = Math.max(0.5, r / 1.6);
  const x0 = Math.max(1, Math.floor(cx - r)), x1 = Math.min(W.w - 2, Math.ceil(cx + r));
  const y0 = Math.max(1, Math.floor(cy - ry)), y1 = Math.min(W.h - 2, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / (r + 0.5), dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1) fn(x, y, y * W.w + x);
    }
  }
}

// cooldowns for click-type tools while the button is held
let cool = 0;

export function useTool(id, cx, cy, r, held, drag) {
  const W = G.world;
  const tl = TOOL[id];
  if (!tl || !isUnlocked(id)) return;
  if (cool > 0) cool--;
  const { t } = W;
  cx = Math.round(cx); cy = Math.round(cy);

  if (tl.el !== undefined) {
    const el = tl.el;
    let n = 0;
    inBrush(cx, cy, r, (x, y, i) => {
      if (R() > tl.rate) return;
      const tt = t[i];
      if (el === E.FISH) { if (tt === E.WATER) { putCell(i, E.FISH, 0, R() < 0.5 ? 1 : 0); n++; } return; }
      if (el === E.WORM) { if (tt === E.DIRT) { putCell(i, E.WORM); n++; } return; }
      if (el === E.SHROOM) { if (tt === E.EMPTY && KIND[t[i + W.w]] === K.SOLID) { putCell(i, E.SHROOM); n++; } return; }
      if (el === E.FIRE) {
        if (tt === E.EMPTY) { putCell(i, E.FIRE); n++; } else if (R() < 0.2) ignite(i);
        return;
      }
      if (el === E.GLITCH) {
        if (tt !== E.BEDROCK && R() < 0.4) { putCell(i, E.GLITCH); n++; }
        return;
      }
      if (tt === E.EMPTY || (REPLACEABLE_GAS.has(tt) && KIND[el] !== K.GAS)) { putCell(i, el); n++; }
    });
    if (n) {
      stat(el, n);
      if (el === E.WATER) W.water0 += n; // the player's water is part of the balance
      emit('placed', el, n, cx, cy);
    }
    return;
  }

  switch (tl.special) {
    case 'erase': {
      let n = 0;
      inBrush(cx, cy, r, (x, y, i) => {
        const tt = t[i];
        if (tt === E.EMPTY || tt === E.BEDROCK) return;
        if (tt === E.STRUCT || tt === E.CROP || tt === E.TORCH) emit('structHit', W.a[i]);
        putCell(i, E.EMPTY);
        n++;
      });
      if (n) emit('erased', n, cx, cy);
      break;
    }
    case 'tree': {
      if (cool > 0) break;
      cool = 12;
      const g = groundBelow(cx, cy);
      if (!g) break;
      const below = t[g.i + W.w];
      if (below !== E.DIRT && below !== E.GRASS && below !== E.SAND) { floatText(cx, cy - 1, '?', [255, 160, 120]); break; }
      const b = W.biome[cx];
      const sp = below === E.SAND ? SP.PALM : b === 2 ? SP.PINE : [SP.OAK, SP.OAK, SP.BIRCH, SP.CHERRY, SP.PINE][(R() * 5) | 0];
      plantTree(g.i, sp);
      stat(E.SAPLING);
      emit('placed', E.SAPLING, 1, cx, cy);
      break;
    }
    case 'flower': {
      let n = 0;
      inBrush(cx, cy, Math.max(1, r), (x, y, i) => {
        if (R() > 0.08) return;
        if (t[i] === E.EMPTY && (t[i + W.w] === E.GRASS || t[i + W.w] === E.DIRT)) { putCell(i, E.PLANT, 1 + ((R() * 3) | 0), 1); n++; }
      });
      if (n) { stat(E.FLOWER, n); emit('placed', E.FLOWER, n, cx, cy); }
      break;
    }
    case 'spark': {
      if (held) break;
      if (!spend(tl.use)) { emit('broke'); break; }
      const g = groundBelow(cx, cy) || { x: cx, y: cy };
      const T = G.tribe;
      if (!T.villagers.length && !T.buildings.length) { foundTribe(g.x); emit('sparked', g.x, g.y); break; }
      if (!T.villagers.length) T.center = g.x;
      const v = spawnVillager(g.x, g.y, { age: 2 });
      say(v, '!', 120);
      for (let k = 0; k < 14; k++) spawnFx({ x: g.x, y: g.y, vx: (R() - 0.5) * 0.8, vy: (R() - 0.5) * 0.6, life: 40, glyph: '✦', color: [255, 230, 140], glow: 1, drag: 0.92 });
      emit('sparked', g.x, g.y, v);
      break;
    }
    case 'bolt': {
      if (cool > 0) break;
      cool = 14;
      let y = 2;
      while (y < cy && t[y * W.w + cx] === E.CLOUD) y++;
      strike(cx, y);
      G.progress.stats.strikes++;
      break;
    }
    case 'meteor': {
      if (held) break;
      if (!spend(tl.use)) { emit('broke'); break; }
      meteor(cx, cy);
      break;
    }
    case 'volcano': {
      if (held) break;
      if (!spend(tl.use)) { emit('broke'); break; }
      const g = groundBelow(cx, cy) || { x: cx, y: cy, i: cy * W.w + cx };
      eruption(g.x, g.y + 1, 260);
      break;
    }
    case 'cloud': case 'snowcloud': case 'storm': {
      const flags = (tl.special === 'storm' ? 3 : tl.special === 'snowcloud' ? 5 : 1) | 8;
      let n = 0;
      inBrush(cx, cy, r + 1, (x, y, i) => {
        if (t[i] === E.EMPTY && R() < 0.5) { putCell(i, E.CLOUD, 60 + R() * 60, flags); n++; }
      });
      if (n) emit('placed', E.CLOUD, n, cx, cy);
      break;
    }
    case 'wind': {
      if (!drag) break;
      push(cx, cy, r + 1, drag.dx, drag.dy);
      break;
    }
  }
}

function groundBelow(x, y) {
  const W = G.world;
  const { t } = W;
  if (x < 1 || x >= W.w - 1) return null;
  let yy = Math.max(1, y);
  if (STAND[t[yy * W.w + x]]) {
    while (yy > 1 && STAND[t[(yy - 1) * W.w + x]]) yy--;
    yy--;
  } else {
    while (yy < W.h - 2 && !STAND[t[(yy + 1) * W.w + x]] && t[(yy + 1) * W.w + x] !== E.WATER) yy++;
  }
  if (t[yy * W.w + x] !== E.EMPTY && KIND[t[yy * W.w + x]] !== K.GAS && t[yy * W.w + x] !== E.PLANT && t[yy * W.w + x] !== E.FLOWER) return null;
  return { x, y: yy, i: yy * W.w + x };
}

function push(cx, cy, r, dx, dy) {
  const W = G.world;
  const { t } = W;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  if (!sx && !sy) return;
  const cells = [];
  inBrush(cx, cy, r, (x, y, i) => {
    const k = KIND[t[i]];
    if (k === K.POWDER || k === K.LIQUID || k === K.GAS || k === K.SOIL || k === K.LIFE || t[i] === E.CLOUD || t[i] === E.LEAF) cells.push([x, y, i]);
  });
  cells.sort((a, b) => (b[0] - a[0]) * sx + (b[1] - a[1]) * sy);
  for (const [x, y, i] of cells) {
    const j = (y + sy) * W.w + x + sx;
    if (j < 0 || j >= t.length || t[j] !== E.EMPTY) continue;
    const ry = y + sy, rx = x + sx;
    if (rx < 1 || rx >= W.w - 1 || ry < 1 || ry >= W.h - 1) continue;
    W.t[j] = W.t[i]; W.d[j] = W.d[i]; W.v[j] = W.v[i]; W.a[j] = W.a[i];
    W.t[i] = 0; W.d[i] = 0; W.a[i] = 0;
  }
  if (R() < 0.3) spawnFx({ x: cx, y: cy, vx: sx * 0.6, vy: sy * 0.3, life: 30, glyph: '~', color: [190, 230, 255], drag: 0.95 });
}

// ── meteors & eruptions ────────────────────────────────────────────────────
export function meteor(tx, ty, big = 1) {
  const W = G.world;
  const dir = R() < 0.5 ? -1 : 1;
  const sy = 2;
  const dist = Math.max(10, ty - sy);
  const vy = 0.9 + R() * 0.3;
  const steps = dist / vy;
  const vx = dir * (0.35 + R() * 0.3);
  const sx = tx - vx * steps;
  spawnFx({
    x: sx, y: sy, vx, vy, life: 600, glyph: '@', color: [255, 220, 150], glow: 1, trail: E.FIRE, trailRate: 0.85, trailD: 20,
    onHit: (p, lx, ly) => impact(lx, ly, big),
  });
  emit('meteorIncoming', tx);
  return W;
}

function impact(x, y, big) {
  const W = G.world;
  const r = 4 + big * 2.5;
  explode(x, y, r);
  for (let k = 0; k < 5 + big * 4; k++) {
    const ix = x + ((R() * 5) | 0) - 2, iy = y + ((R() * 3) | 0);
    if (ix > 1 && ix < W.w - 1 && iy > 1 && iy < W.h - 1) putCell(iy * W.w + ix, k < 3 + big * 2 ? E.STARSTONE : E.LAVA);
  }
  for (let k = 0; k < 24; k++) {
    const a = R() * Math.PI;
    spawnFx({ x, y: y - 1, vx: Math.cos(a) * (0.6 + R()), vy: -Math.sin(a) * (0.6 + R() * 0.8), g: 0.05, life: 90, glyph: '●', color: [255, 150, 60], glow: 1, deposit: R() < 0.4 ? E.LAVA : 0, collide: true });
  }
  emit('discover', 'starstone');
  emit('impact', x, y, r);
}

export const emitters = [];

export function eruption(x, y, dur = 300) {
  const W = G.world;
  const v = W.volcano;
  if (v && Math.abs(v.x - x) < 6) {
    x = v.x; y = v.y;
    explode(x, y + 1, 3.5);
  }
  emitters.push({ x, y, t: dur });
  emit('discover', 'eruption');
  emit('eruption', x, y);
}

export function updateEmitters() {
  for (let k = emitters.length - 1; k >= 0; k--) {
    const e = emitters[k];
    e.t--;
    if (e.t <= 0) { emitters.splice(k, 1); continue; }
    const n = e.t % 3 === 0 ? 2 : 1;
    for (let q = 0; q < n; q++) {
      spawnFx({
        x: e.x + (R() - 0.5) * 2, y: e.y - 1, vx: (R() - 0.5) * 1.1, vy: -1.1 - R() * 1.3, g: 0.045, life: 200,
        glyph: '●', color: [255, 140 + R() * 80, 40], glow: 1, deposit: E.LAVA, trail: R() < 0.2 ? E.SMOKE : 0, trailRate: 0.3, trailD: 80,
      });
    }
    if (e.t % 8 === 0) spawnFx({ x: e.x, y: e.y - 2, vx: (R() - 0.5) * 0.2, vy: -0.25, life: 120, glyph: '░', color: [120, 110, 110], drag: 0.99 });
    G.shake = Math.max(G.shake, 0.35);
  }
}

// ── earthquakes ───────────────────────────────────────────────────────────
let quake = 0;
export function startQuake(d = 360) {
  quake = d;
  emit('quake');
}
export function updateQuake() {
  if (quake <= 0) return;
  quake--;
  G.shake = Math.max(G.shake, 0.8);
  const W = G.world;
  const { t } = W;
  for (let k = 0; k < 220; k++) {
    const x = 2 + ((R() * (W.w - 4)) | 0);
    const y = W.surf[x] + ((R() * 24) | 0) - 2;
    if (y < 2 || y >= W.h - 2) continue;
    const i = y * W.w + x;
    const tt = t[i];
    if (tt === E.STRUCT && R() < 0.04) { emit('structHit', W.a[i]); putCell(i, R() < 0.5 ? E.SAND : E.EMPTY); continue; }
    if (!(tt === E.DIRT || tt === E.GRASS || tt === E.SAND || tt === E.STONE || tt === E.SNOW || tt === E.ASH)) continue;
    const dx = R() < 0.5 ? -1 : 1;
    const j = i + dx;
    if (t[j] === E.EMPTY || t[i + W.w] === E.EMPTY) {
      const k2 = t[i + W.w] === E.EMPTY ? i + W.w : j;
      W.t[k2] = tt === E.STONE ? (R() < 0.5 ? E.SAND : E.STONE) : tt; W.v[k2] = W.v[i];
      W.t[i] = 0;
    }
  }
}

// ── miracles ──────────────────────────────────────────────────────────────
export function miracle(id) {
  const tl = TOOL[id];
  if (!tl || !isUnlocked(id)) return false;
  if (!canSpend(tl.use)) { emit('broke'); return false; }
  const env = G.env;
  const T = G.tribe;
  switch (tl.miracle) {
    case 'rain': forceWeather(R() < 0.25 ? 'storm' : 'rain'); break;
    case 'sun': forceWeather('clear'); break;
    case 'harvest': {
      const n = 10 + T.villagers.length * 3;
      T.food += n;
      floatText(T.center, G.world.surf[Math.round(T.center)] - 4, '+' + n + '♣', [140, 255, 150], 140);
      break;
    }
    case 'bless': T.blessT = 300; T.trauma = 0; for (const v of T.villagers) say(v, '♥', 140); break;
    case 'rainbow': env.rainbow = 1; emit('discover', 'rainbow'); break;
    case 'aurora': env.auroraTarget = 1; env.aurora = Math.max(env.aurora, 0.3); if (!env.night) env.time += ((0.8 - env.tod + 1) % 1) * DAY; emit('discover', 'aurora'); break;
    case 'night': env.time += DAY / 4; break;
    case 'eclipse': env.eclipseT = 0; emit('discover', 'eclipse'); if (env.night) env.time += ((0.45 - env.tod + 1) % 1) * DAY; break;
    case 'quake': startQuake(); break;
    case 'meteors': meteorShower(14); break;
  }
  spend(tl.use);
  G.progress.stats.miracles++;
  emit('miracle', id);
  return true;
}

export function meteorShower(n) {
  const W = G.world;
  for (let k = 0; k < n; k++) {
    setTimeout(() => {
      const x = 10 + R() * (W.w - 20);
      meteor(Math.round(x), W.surf[Math.round(x)], R() < 0.2 ? 2 : 1);
    }, k * (400 + R() * 900));
  }
  emit('meteorShower');
}

// ── random world events ───────────────────────────────────────────────────
export function updateEvents() {
  const W = G.world, env = G.env;
  if (W.tick % 600 !== 0) return;
  // ~ every 10 s of game time roll the dice
  if (env.night && R() < 0.012) meteorShower(4 + ((R() * 6) | 0));
  if (W.volcano && R() < 0.006) eruption(W.volcano.x, W.volcano.y, 200 + R() * 300);
  if (!env.night && env.sunElev > 0.6 && R() < 0.003) { env.eclipseT = 0; emit('discover', 'eclipse'); }
  if ((env.season === 0 || env.season === 2) && !env.night && R() < 0.02) migration();
  if (env.aurora > 0.5 && R() < 0.2) emit('discover', 'aurora');
  if (env.rainbow > 0.5 && !G.progress.found.rainbow) emit('discover', 'rainbow');
  if (env.temp < 0 && W.counts[E.SNOW] > 50) emit('discover', 'snowfall');
}

function migration() {
  const W = G.world;
  const dir = R() < 0.5 ? 1 : -1;
  const x0 = dir > 0 ? 4 : W.w - 5;
  const y0 = 8 + ((R() * 10) | 0);
  for (let k = 0; k < 14; k++) {
    const x = x0 - dir * (k % 5) * 2, y = y0 + Math.abs((k % 5) - 2) + ((k / 5) | 0) * 2;
    const i = y * W.w + x;
    if (W.t[i] === E.EMPTY) putCell(i, E.BIRD, 0, dir > 0 ? 1 : 0);
  }
  emit('migration');
}

export { isSandbox };
