// ─── world.js ── the cell grid ─────────────────────────────────────────────
import { E, TERRAIN, KIND, K } from './elements.js';

export class World {
  constructor(w, h, seed) {
    this.w = w;
    this.h = h;
    this.seed = seed;
    const n = w * h;
    this.t = new Uint8Array(n); // element
    this.d = new Uint8Array(n); // per-cell state (life, growth, moisture…)
    this.v = new Uint8Array(n); // random variant (look)
    this.a = new Uint16Array(n); // aux (species, building id, flags…)
    this.s = new Uint8Array(n); // update stamp
    this.c = new Uint8Array(n); // electric charge
    this.surf = new Int16Array(w); // first terrain row per column
    this.biome = new Uint8Array(w);
    this.sky = new Uint8Array(w); // per column: floating islands above this row are not ground
    this.tick = 0;
    this.F = 1;
    this.counts = new Uint32Array(64);
    this.charged = [];
    this.booms = [];
    this.volcano = null;
    this.sea = 0;
    this.water0 = 0;
    this.excess = 0;
  }
  idx(x, y) {
    return y * this.w + x;
  }
  inside(x, y) {
    return x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return E.BEDROCK;
    return this.t[y * this.w + x];
  }
  set(x, y, type, d = 0, a = 0, v = (Math.random() * 256) | 0) {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.t[i] = type;
    this.d[i] = d;
    this.a[i] = a;
    this.v[i] = v;
    if (this.wake) this.wake(i);
  }
  computeSurface(x0 = 0, x1 = this.w) {
    const { t, w, h, surf } = this;
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      let y = this.sky[x] ? this.sky[x] + 1 : 1;
      for (; y < h - 1; y++) {
        const tt = t[y * w + x];
        if (!TERRAIN[tt]) continue;
        // falling grains and raindrops are not ground
        const k = KIND[tt];
        if (k === K.POWDER || k === K.LIQUID || k === K.SOIL) {
          // follow the run of loose matter: if it ends in air it is still falling
          let yy = y + 1;
          while (yy < h - 1 && (KIND[t[yy * w + x]] === K.POWDER || KIND[t[yy * w + x]] === K.LIQUID || KIND[t[yy * w + x]] === K.SOIL)) yy++;
          const b = t[yy * w + x];
          // falling, or resting on a tree / building rather than the ground
          if (b === E.EMPTY || KIND[b] === K.GAS || b === E.CLOUD || !TERRAIN[b]) { y = yy - 1; continue; }
        }
        break;
      }
      surf[x] = y;
    }
  }
  borders() {
    const { w, h, t } = this;
    for (let x = 0; x < w; x++) {
      t[x] = E.BEDROCK;
      t[(h - 1) * w + x] = E.BEDROCK;
    }
    for (let y = 0; y < h; y++) {
      t[y * w] = E.BEDROCK;
      t[y * w + w - 1] = E.BEDROCK;
    }
  }
}
