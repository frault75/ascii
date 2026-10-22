// ─── worldgen.js ── procedural landscape: oceans, mountains, caves, ores ────
import { E, SP } from './elements.js';
import { World } from './world.js';
import { mulberry32, fbm1, fbm2, smooth, clamp } from './util.js';
import { plantTree, bindWorld, step } from './sim.js';
import { G } from './state.js';

export const WORLD_W = 400;
export const WORLD_H = 150;

export function generate(seed, onProgress = () => {}) {
  const rng = mulberry32(seed);
  const w = WORLD_W, h = WORLD_H;
  const W = new World(w, h, seed);
  const { t, d, a, v } = W;
  const s = (seed % 9973) + 1;
  const sea = 72;
  W.sea = sea;

  const oceanLeft = rng() < 0.5;
  const oceanW = 50 + ((rng() * 30) | 0);
  const distOcean = (x) => (oceanLeft ? x - oceanW : w - oceanW - x); // <0 inside ocean

  // ── heights & biomes ──
  const surf = new Float32Array(w);
  const dirtDepth = new Uint8Array(w);
  const hasVolcano = rng() < 0.65;
  const vx = oceanLeft ? Math.floor(w * (0.62 + rng() * 0.25)) : Math.floor(w * (0.13 + rng() * 0.25));
  for (let x = 0; x < w; x++) {
    const mtn = smooth(0.26, 0.62, fbm1(x * 0.006 + 40, 3, s));
    const hills = fbm1(x * 0.022, 3, s + 1) * 7 + fbm1(x * 0.08, 2, s + 2) * 2.2;
    const peaks = 1 - Math.abs(fbm1(x * 0.028, 3, s + 9));
    let y = 63 - mtn * (10 + 24 * peaks * peaks) + hills;
    const dOc = distOcean(x);
    if (dOc < 30) {
      const k = smooth(30, -14, dOc);
      y = y + (sea + 18 - y) * k;
    }
    if (hasVolcano) {
      const dx = Math.abs(x - vx);
      if (dx < 22) {
        const cone = (1 - dx / 22) ** 1.4 * 30;
        y = Math.min(y, 63 + hills * 0.3 - cone);
        if (dx < 3) y += 3 - dx;
      }
    }
    surf[x] = clamp(y, 18, h - 30);
    dirtDepth[x] = 3 + ((fbm1(x * 0.05, 2, s + 3) + 1) * 3) | 0;
    let b = 0;
    if (dOc < 0) b = 4;
    else if (dOc < 10) b = 4;
    else if (mtn > 0.55) b = 2;
    else if (fbm1(x * 0.01 + 900, 2, s + 4) > 0.32) b = 3;
    else if (fbm1(x * 0.015 + 300, 2, s + 5) > -0.05) b = 1;
    W.biome[x] = b;
  }
  onProgress(0.15);

  // ── fill terrain ──
  for (let x = 1; x < w - 1; x++) {
    const sy = Math.round(surf[x]);
    const b = W.biome[x];
    const dd = dirtDepth[x];
    const bedrock = h - 2 - ((fbm1(x * 0.1, 2, s + 6) + 1) * 1.5 | 0);
    for (let y = 1; y < h - 1; y++) {
      const i = y * w + x;
      if (y < sy) {
        t[i] = y >= sea && sy > sea ? E.WATER : E.EMPTY;
        continue;
      }
      const depth = y - sy;
      let e;
      if (y >= bedrock) e = E.BEDROCK;
      else if (b === 4 || b === 3 || (sy >= sea - 2 && distOcean(x) < 16)) e = depth < (b === 3 ? 6 : 4) ? E.SAND : E.STONE;
      else if (sy < sea - 30) e = E.STONE;
      else if (depth === 0) e = sy >= sea ? E.SAND : E.GRASS;
      else if (depth < dd) e = E.DIRT;
      else e = E.STONE;
      t[i] = e;
      v[i] = (rng() * 256) | 0;
    }
    // snow caps
    if (sy < sea - 31) {
      for (let k = 1; k <= 2; k++) if (sy - k > 1) t[(sy - k) * w + x] = E.SNOW;
    }
  }
  onProgress(0.3);

  // ── caves, pockets, ores ──
  for (let x = 1; x < w - 1; x++) {
    const sy = Math.round(surf[x]);
    const minCave = sy + dirtDepth[x] + 4;
    for (let y = minCave; y < h - 3; y++) {
      const i = y * w + x;
      if (t[i] !== E.STONE) continue;
      const tunnel = Math.abs(fbm2(x * 0.03, y * 0.055, 3, s + 7)) < 0.065;
      const blob = fbm2(x * 0.018 + 50, y * 0.032, 3, s + 8) > 0.36;
      if (tunnel || blob) {
        const deep = y > h - 26;
        if (deep && y > h - 15) t[i] = E.LAVA;
        else if (!deep && y > sy + 28 && fbm2(x * 0.04 + 300, y * 0.04, 2, s + 9) > 0.36) t[i] = E.WATER;
        else t[i] = E.EMPTY;
        continue;
      }
      const depth = y - sy;
      const ore = fbm2(x * 0.09 + 500, y * 0.14, 2, s + 10);
      if (depth > 14 && ore > 0.5) t[i] = E.METAL;
      else if (depth > 40 && fbm2(x * 0.12 + 700, y * 0.16, 2, s + 11) > 0.58) t[i] = E.GOLD;
      else if (depth > 20 && fbm2(x * 0.05 + 900, y * 0.08, 2, s + 12) > 0.52) t[i] = E.DIRT;
      else if (y > h - 34 && fbm2(x * 0.07 + 1100, y * 0.07, 2, s + 13) > 0.45) t[i] = E.OBSIDIAN;
    }
  }
  // crystals on deep cave walls, glowing mushrooms on cave floors
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (t[i] !== E.EMPTY || y < surf[x] + 8) continue;
      const below = t[i + w];
      const depth = y - surf[x];
      if ((below === E.STONE || below === E.DIRT) && depth > 12 && depth < 70 && rng() < 0.05) t[i] = E.SHROOM;
      else if (depth > 45) {
        const nb = [t[i - 1], t[i + 1], t[i - w], t[i + w]];
        if (nb.includes(E.STONE) && fbm2(x * 0.06 + 1300, y * 0.06, 2, s + 14) > 0.35 && rng() < 0.4) t[i] = E.CRYSTAL;
      }
    }
  }
  onProgress(0.45);

  // ── volcano conduit ──
  if (hasVolcano) {
    let top = 1;
    while (top < h - 1 && t[top * w + vx] === E.EMPTY) top++;
    const chamberY = Math.min(h - 12, top + 52);
    for (let y = top + 2; y < chamberY; y++) {
      for (let dx = -1; dx <= 1; dx++) t[y * w + vx + dx] = E.LAVA;
      t[y * w + vx - 2] = E.OBSIDIAN;
      t[y * w + vx + 2] = E.OBSIDIAN;
    }
    for (let y = chamberY - 4; y < chamberY + 5; y++) {
      for (let dx = -7; dx <= 7; dx++) {
        if ((dx * dx) / 49 + ((y - chamberY) ** 2) / 20 < 1) t[y * w + vx + dx] = E.LAVA;
      }
    }
    for (let dx = -2; dx <= 2; dx++) {
      t[top * w + vx + dx] = E.OBSIDIAN;
      t[(top + 1) * w + vx + dx] = E.OBSIDIAN;
    }
    W.volcano = { x: vx, y: top };
  }

  W.borders();
  W.computeSurface();
  onProgress(0.55);

  // ── life ──
  bindWorld(W);
  let lastTree = -10;
  for (let x = 3; x < w - 3; x++) {
    const sy = W.surf[x];
    const i = sy * w + x;
    const top = t[i];
    const b = W.biome[x];
    if (top === E.GRASS && t[i - w] === E.EMPTY) {
      const dens = b === 1 ? 0.22 : b === 2 ? 0.08 : 0.06;
      if (x - lastTree > 3 && rng() < dens) {
        let sp = SP.OAK;
        const q = rng();
        if (b === 2 || sy < sea - 16) sp = SP.PINE;
        else if (b === 1) sp = q < 0.3 ? SP.PINE : q < 0.5 ? SP.BIRCH : q < 0.6 ? SP.CHERRY : SP.OAK;
        else sp = q < 0.15 ? SP.CHERRY : q < 0.4 ? SP.BIRCH : SP.OAK;
        plantTree(i - w, sp, 0.8 + rng() * 0.5);
        lastTree = x;
      } else if (rng() < 0.08) {
        t[i - w] = E.PLANT; d[i - w] = 1 + ((rng() * 3) | 0); a[i - w] = 1; v[i - w] = (rng() * 256) | 0;
      }
    } else if (top === E.SAND && t[i - w] === E.EMPTY && b === 4 && sy < sea && x - lastTree > 5 && rng() < 0.08) {
      plantTree(i - w, SP.PALM, 0.9 + rng() * 0.3);
      lastTree = x;
    }
  }
  // fish
  let fish = 0;
  for (let k = 0; k < 6000 && fish < 45; k++) {
    const x = 2 + ((rng() * (w - 4)) | 0), y = sea + 2 + ((rng() * 20) | 0);
    const i = y * w + x;
    if (y < h - 2 && t[i] === E.WATER && t[i - w] === E.WATER) { t[i] = E.FISH; a[i] = rng() < 0.5 ? 1 : 0; v[i] = (rng() * 256) | 0; fish++; }
  }
  // worms
  for (let k = 0; k < 3000; k++) {
    const x = 2 + ((rng() * (w - 4)) | 0);
    const y = W.surf[x] + 1 + ((rng() * 5) | 0);
    const i = y * w + x;
    if (t[i] === E.DIRT && rng() < 0.01) t[i] = E.WORM;
  }
  // birds
  for (let k = 0; k < 9; k++) {
    const x = 10 + ((rng() * (w - 20)) | 0);
    const y = Math.max(4, W.surf[x] - 10 - ((rng() * 10) | 0));
    const i = y * w + x;
    if (t[i] === E.EMPTY) { t[i] = E.BIRD; a[i] = rng() < 0.5 ? 1 : 0; }
  }
  // clouds
  const nClouds = 4 + ((rng() * 4) | 0);
  for (let k = 0; k < nClouds; k++) {
    makeCloud(W, 10 + rng() * (w - 20), 6 + rng() * 14, 6 + rng() * 10, 20 + rng() * 40, 0, rng);
  }
  onProgress(0.65);

  // ── let the world settle & trees grow ──
  G.world = W;
  G.fastGrow = true;
  for (let k = 0; k < 160; k++) step();
  G.fastGrow = false;
  for (let k = 0; k < 40; k++) step();
  W.computeSurface();
  W.tick = 0;
  onProgress(1);
  return W;
}

export function makeCloud(W, cx, cy, rx, moist, flags, rng = Math.random) {
  const { w, h, t, d, a, v } = W;
  const ry = Math.max(1.5, rx * 0.28);
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
    for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      if (x < 2 || x >= w - 2 || y < 2 || y >= h - 2) continue;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const n = fbm2(x * 0.25, y * 0.4, 2, 77) * 0.35;
      if (dx * dx + dy * dy < 1 + n && (dy < 0.6 || rng() < 0.5)) {
        const i = y * w + x;
        if (t[i] === E.EMPTY) { t[i] = E.CLOUD; d[i] = moist; a[i] = flags; v[i] = (rng() * 256) | 0; }
      }
    }
  }
}
