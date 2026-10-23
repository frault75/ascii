// ─── tiles.js ── pixel-art tiles: the readable, non-ASCII look of the world ──
// Every tile is an alpha mask on a 10×16 art grid (one cell). Like a glyph it
// is drawn in the cell's fg colour over its bg colour, so the lighting and
// colour logic of compose.js works unchanged — only the shapes differ.

import { gi } from './glyphs.js';

export const AW = 10, AH = 16;
export const TILE = {};   // name → index (0 = no tile: use the glyph)
export const GRIDS = [null];
export const SOLID_TILE = new Uint8Array(256); // tiles drawn edge to edge (extruded in the atlas)

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Grid {
  constructor() { this.a = new Float32Array(AW * AH); }
  set(x, y, v = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= AW || y >= AH) return;
    this.a[y * AW + x] = v;
  }
  wset(x, y, v = 1) { this.a[(((y % AH) + AH) % AH) * AW + (((x % AW) + AW) % AW)] = v; }
  get(x, y) { return this.a[(((y % AH) + AH) % AH) * AW + (((x % AW) + AW) % AW)]; }
  rect(x, y, w, h, v = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); }
  fill(v = 1) { this.a.fill(v); }
  blob(cx, cy, rx, ry, v = 1, wrap = false) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) wrap ? this.wset(x, y, v) : this.set(x, y, v);
      }
    }
  }
  line(x0, y0, x1, y1, w = 1, v = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      if (w <= 1) this.set(Math.floor(x), Math.floor(y), v);
      else this.rect(Math.floor(x - (w - 1) / 2), Math.floor(y - (w - 1) / 2), w, w, v);
    }
  }
  // cellular smoothing with wrap-around, keeps tiles seamless
  smooth(iter = 1) {
    for (let k = 0; k < iter; k++) {
      const b = new Float32Array(this.a);
      for (let y = 0; y < AH; y++) {
        for (let x = 0; x < AW; x++) {
          let n = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) n += this.get(x + i, y + j) > 0.5 ? 1 : 0;
          b[y * AW + x] = n > 4 ? 1 : n < 4 ? 0 : this.a[y * AW + x];
        }
      }
      this.a = b;
    }
  }
}

function def(name, draw, solid = false) {
  const g = new Grid();
  draw(g, rng(GRIDS.length * 7919 + 17));
  TILE[name] = GRIDS.length;
  if (solid) SOLID_TILE[GRIDS.length] = 1;
  GRIDS.push(g.a);
  return TILE[name];
}
const many = (n, name, draw, solid) => { for (let k = 0; k < n; k++) def(name + k, (g, r) => draw(g, r, k), solid); };

// ── textures (fill the whole cell) ─────────────────────────────────────────
function noise(g, r, p, it) {
  for (let i = 0; i < g.a.length; i++) g.a[i] = r() < p ? 1 : 0;
  g.smooth(it);
}
function voronoi(g, r, seeds, crack, holes = 0) {
  const pts = [];
  for (let k = 0; k < seeds; k++) pts.push([r() * AW, r() * AH]);
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) {
        for (const ox of [-AW, 0, AW]) for (const oy of [-AH, 0, AH]) {
          const dx = x + 0.5 - px - ox, dy = (y + 0.5 - py - oy) * 0.8;
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      }
      g.set(x, y, Math.sqrt(d2) - Math.sqrt(d1) < crack ? 0 : 1);
    }
  }
  for (let k = 0; k < holes; k++) g.set(r() * AW, r() * AH, 0);
}

many(4, 'dirt', (g, r) => {
  noise(g, r, 0.5, 2);
  for (let k = 0; k < 4; k++) g.set(r() * AW, r() * AH, r() < 0.5 ? 0 : 1);
}, true);
many(4, 'stone', (g, r) => voronoi(g, r, 4, 0.55, 3), true);
many(2, 'bedrock', (g, r) => { voronoi(g, r, 6, 0.8, 6); }, true);
many(4, 'sand', (g, r) => {
  g.fill(1);
  for (let k = 0; k < 12; k++) g.set(r() * AW, r() * AH, 0);
  for (let k = 0; k < 2; k++) { const y = Math.floor(r() * AH), x = Math.floor(r() * 6); g.rect(x, y, 3, 1, 0); }
}, true);
many(4, 'grass', (g, r) => {
  g.rect(0, 3, AW, 4);
  for (let x = 0; x < AW; x++) {
    const h = 1 + Math.floor(r() * 3.2);
    g.rect(x, 3 - h, 1, h);
  }
  for (let k = 0; k < 4; k++) g.set(r() * AW, 7 + r() * 2);
  for (let k = 0; k < 3; k++) g.set(r() * AW, 9 + r() * 7);
}, true);
many(2, 'snow', (g, r) => { g.fill(1); for (let k = 0; k < 7; k++) g.set(r() * AW, r() * AH, 0); }, true);
many(2, 'ice', (g, r, k) => {
  for (let s = 0; s < 3; s++) {
    const x = r() * AW, y = r() * AH, L = 2 + r() * 3;
    for (let t = 0; t < L; t++) g.wset(Math.floor(x + t), Math.floor(y - t * 1.6));
  }
  g.rect(0, 0, AW, 1);
  g.set(k ? 7 : 2, 5);
}, true);
many(2, 'metal', (g, r, k) => {
  g.fill(1);
  g.rect(0, 0, AW, 1, 0);
  g.rect(k ? 5 : 0, 0, 1, AH, 0);
  for (const [x, y] of [[2, 2], [8, 2], [2, 13], [8, 13]]) g.set(x, y, 0);
}, true);
many(2, 'gold', (g, r) => {
  for (let k = 0; k < 4; k++) g.blob(r() * AW, r() * AH, 1.1 + r(), 1.2 + r(), 1, true);
  for (let k = 0; k < 3; k++) g.set(r() * AW, r() * AH);
}, true);
many(2, 'obsidian', (g, r) => {
  for (let s = 0; s < 3; s++) {
    const x = r() * AW, y = r() * AH;
    for (let t = 0; t < 4; t++) g.wset(Math.floor(x + t), Math.floor(y + t * 1.5));
  }
  for (let k = 0; k < 5; k++) g.set(r() * AW, r() * AH);
}, true);
many(2, 'crystal', (g, r) => {
  for (let s = 0; s < 3; s++) {
    const x = 1 + r() * 8, y = 3 + r() * 10, h = 3 + r() * 4;
    for (let t = 0; t < h; t++) g.rect(Math.floor(x - (t < 1 ? 0 : 1)), Math.floor(y - t), t < 1 ? 1 : 2, 1);
  }
}, true);
def('starstone', (g, r) => {
  for (let k = 0; k < 3; k++) { const x = 1 + Math.floor(r() * 8), y = 1 + Math.floor(r() * 14); g.set(x, y); g.set(x - 1, y); g.set(x + 1, y); g.set(x, y - 1); g.set(x, y + 1); }
}, true);
def('glass', (g) => { g.line(2, 9, 5, 4); g.line(4, 12, 7, 7); });
many(2, 'ash', (g, r) => noise(g, r, 0.42, 1), true);
def('powder', (g, r) => { for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) if (((x + y * 3) % 4 === 0) !== r() < 0.2) g.set(x, y); }, true);
def('tnt', (g) => { g.rect(0, 6, AW, 4); g.rect(3, 0, 1, AH); g.rect(6, 0, 1, AH); g.rect(3, 6, 1, 4, 0); g.rect(6, 6, 1, 4, 0); }, true);
many(2, 'ember', (g, r) => { voronoi(g, r, 4, 0.7, 0); for (let i = 0; i < g.a.length; i++) g.a[i] = 1 - g.a[i]; }, true);
many(2, 'bark', (g, r, k) => {
  for (let x = 0; x < AW; x++) {
    if (x === 0 || x === AW - 1) continue;
    if ((x + k) % 3 === 0) continue;
    for (let y = 0; y < AH; y++) if (r() > 0.08) g.set(x, y);
  }
  if (k) g.blob(5, 9, 1.4, 1.8, 0);
}, true);
def('birch', (g, r) => {
  g.rect(1, 0, 8, AH);
  for (let k = 0; k < 4; k++) { const y = Math.floor(r() * AH); g.rect(Math.floor(1 + r() * 4), y, 3, 1, 0); }
}, true);
def('cactus', (g) => {
  g.fill(1);
  for (let y = 0; y < AH; y++) { g.set(3, y, y % 4 === 1 ? 1 : 0); g.set(6, y, y % 4 === 3 ? 1 : 0); }
  for (const [x, y] of [[0, 3], [9, 6], [0, 11], [9, 13]]) g.set(x, y, 0);
}, true);
def('cactusTop', (g) => {
  g.blob(5, 8, 4.5, 6.5); g.rect(0.5, 8, 9, 8);
  g.set(3, 6, 0); g.set(6, 9, 0);
});
def('palm', (g) => { g.rect(2, 0, 6, AH); g.rect(1, 0, 8, 2); g.rect(2, 2, 6, 1, 0); g.rect(2, 9, 6, 1, 0); }, true);
def('branchR', (g) => g.line(0.5, 15, 9.5, 1, 2));
def('branchL', (g) => g.line(0.5, 1, 9.5, 15, 2));
many(4, 'leaf', (g, r) => {
  g.fill(1);
  for (let k = 0; k < 5; k++) {
    const x = Math.floor(r() * AW), y = Math.floor(r() * AH);
    g.wset(x, y, 0); g.wset(x + 1, y, 0); g.wset(x, y + 1, 0);
  }
  for (let k = 0; k < 4; k++) g.set(r() * AW, r() * AH, 0);
}, true);
// conifer: a tier of needles per cell with a jagged, shaded underside
many(2, 'pine', (g, r, k) => {
  g.fill(1);
  for (let x = 0; x < AW; x++) {
    const d = 2 + ((x + k * 2) % 3 === 0 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
    g.rect(x, AH - d, 1, d, 0);
  }
  for (let n = 0; n < 4; n++) g.set(r() * AW, 2 + r() * 9, 0);
}, true);
// palm fronds: a midrib with leaflets hanging from it
const leaflets = (g, pts) => {
  for (let k = 0; k < pts.length - 1; k++) g.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 2);
  for (let k = 0; k < pts.length; k++) { const [x, y] = pts[k]; g.line(x, y + 1, x - 0.5, y + 4.5, 1); g.line(x + 0.6, y + 1, x + 1.2, y + 4, 1); }
};
def('frondMid', (g) => leaflets(g, [[0, 6], [3, 5.5], [6, 5.5], [10, 6]]));
def('frondTipL', (g) => leaflets(g, [[10, 5], [7, 5.5], [4, 7.5], [1.5, 11]]));
def('frondTipR', (g) => leaflets(g, [[0, 5], [3, 5.5], [6, 7.5], [8.5, 11]]));
def('frondUp', (g) => {
  g.line(5, 16, 5, 6, 2); g.line(5, 6, 3.5, 2, 2);
  for (let y = 4; y < 15; y += 2) { g.line(5, y, 1.5, y + 2.5, 1); g.line(6, y, 9, y + 2.5, 1); }
});
many(2, 'frond', (g, r, k) => {
  for (let s = -1; s <= 1; s += 2) {
    for (let t = 0; t < 10; t++) {
      const x = 5 + s * t * 0.5, y = 5 + (t * t) * 0.09 + (k ? 1 : 0);
      g.set(x, y); g.set(x, y + 1);
      if (t % 2 === 0) g.set(x, y + 2);
    }
  }
  g.rect(3, 3, 4, 3);
});

// ── liquids, weather ───────────────────────────────────────────────────────
many(3, 'wave', (g, r, k) => {
  for (let x = 0; x < AW; x++) {
    const y = Math.round(1.5 + Math.sin((x + k * 3) * 0.75) * 1.2);
    g.set(x, y);
    if (x % 3 === k) g.set(x, y + 1);
  }
});
def('glint', (g) => { g.rect(3, 7, 4, 1); g.set(4, 8); });
many(4, 'rain', (g, r, k) => { g.rect(4 + (k & 1), 2 + k * 2, 1, 5); });
many(3, 'lava', (g, r) => {
  for (let k = 0; k < 4; k++) g.blob(r() * AW, r() * AH, 1 + r() * 1.3, 1.2 + r() * 1.4, 1, true);
}, true);
many(3, 'lavaTop', (g, r, k) => {
  for (let x = 0; x < AW; x++) g.rect(x, Math.round(2 + Math.sin((x + k * 3) * 0.8) * 1.4), 1, 2);
  g.blob(2 + k * 3, 10, 1.5, 1.6);
});
many(4, 'flame', (g, r, k) => {
  const cx = 4.5 + (r() - 0.5) * 2, top = 3 + r() * 4;
  for (let y = Math.floor(top); y < AH; y++) {
    const t = (y - top) / (AH - top);
    const half = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) * (3.2 + (k & 1));
    g.rect(Math.round(cx - half), y, Math.max(1, Math.round(half * 2)), 1);
  }
  g.blob(cx, AH - 3.5, 1.3, 2, 0);
});
many(3, 'puff', (g, r, k) => {
  const rad = 2.4 + k * 0.9;
  g.blob(5, 8, rad, rad * 1.5);
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const d = Math.hypot((x + 0.5 - 5) / rad, (y + 0.5 - 8) / (rad * 1.5));
    if (d > 0.75 && d <= 1 && (x + y) % 2) g.set(x, y, 0);
  }
});
def('cloudFull', (g) => g.fill(1), true);
many(2, 'cloudMid', (g, r) => { g.fill(1); for (let k = 0; k < 6; k++) g.set(r() * AW, r() * AH, 0); }, true);
many(2, 'cloudLight', (g, r) => {
  for (let k = 0; k < 3; k++) g.blob(2 + r() * 6, 4 + r() * 8, 2.5 + r(), 3 + r() * 2);
});
def('boltV', (g) => { g.line(5, 0, 3, 6, 2); g.line(3, 6, 6, 10, 2); g.line(6, 10, 4, 16, 2); });
def('boltR', (g) => { g.line(0, 16, 4, 9, 2); g.line(4, 9, 6, 10, 2); g.line(6, 10, 10, 0, 2); });
def('boltL', (g) => { g.line(0, 0, 4, 7, 2); g.line(4, 7, 6, 6, 2); g.line(6, 6, 10, 16, 2); });
many(4, 'glitch', (g, r) => { for (let k = 0; k < 5; k++) g.rect(Math.floor(r() * AW), Math.floor(r() * AH), 1 + Math.floor(r() * 5), 1 + Math.floor(r() * 3)); });

// ── life ───────────────────────────────────────────────────────────────────
def('seed', (g) => { g.blob(5, 13.5, 1.5, 1.2); });
many(3, 'tuft', (g, r, k) => {
  const n = 3 + k;
  for (let b = 0; b < n; b++) {
    const x0 = 1.5 + (b * 7) / Math.max(1, n - 1), h = 5 + r() * 7, lean = (r() - 0.5) * 3;
    g.line(x0, 15.5, x0 + lean, 15.5 - h, 1);
  }
});
many(4, 'flower', (g, r, k) => {
  const cx = 5, cy = 9 + (k & 1);
  g.rect(cx - 1, cy - 3, 2, 2); g.rect(cx - 1, cy + 1, 2, 2); g.rect(cx - 3, cy - 1, 2, 2); g.rect(cx + 1, cy - 1, 2, 2);
  if (k > 1) { g.set(cx - 2, cy - 2); g.set(cx + 1, cy - 2); g.set(cx - 2, cy + 1); g.set(cx + 1, cy + 1); }
  g.rect(cx - 0.5, cy + 3, 1, 4);
});
many(2, 'sapling', (g, r, k) => {
  g.rect(5, 8 + k, 1, 8 - k);
  g.blob(3.5, 9 + k, 1.6, 1);
  g.blob(6.7, 7.5 + k, 1.6, 1);
});
// crop growth stages
def('crop0', (g) => { g.rect(4, 13, 1, 3); g.set(5, 12); g.set(3, 13); });
def('crop1', (g) => { g.rect(3, 10, 1, 6); g.rect(6, 11, 1, 5); g.set(2, 11); g.set(7, 12); });
def('crop2', (g) => { for (const x of [2, 5, 8]) g.rect(x, 7 + (x & 1), 1, 9); g.set(1, 9); g.set(6, 8); });
def('crop3', (g) => { for (const x of [1, 4, 7]) g.rect(x, 4, 1, 12); for (const x of [2, 5, 8]) g.rect(x, 6, 1, 10); });
def('crop4', (g) => { for (const x of [1, 4, 7]) { g.rect(x, 5, 1, 11); g.rect(x - 0, 1, 2, 4); } for (const x of [2.5, 5.5]) g.rect(x, 7, 1, 9); });
many(2, 'shroom', (g, r, k) => { g.rect(4, 10, 2, 6); g.blob(5, 9.5 - k, 3.6, 2.2); g.rect(1, 10 - k, 8, 1, 0); g.rect(4, 10 - k, 2, 1); });
def('torch', (g) => { g.rect(4, 7, 2, 9); g.blob(5, 4.5, 1.7, 2.6); g.set(5, 1); });
def('fishR', (g) => { g.blob(5, 8, 3.2, 2.2); g.rect(1, 6, 1, 5); g.rect(2, 7, 1, 3); g.set(7, 7, 0); });
def('fishL', (g) => { g.blob(5, 8, 3.2, 2.2); g.rect(8, 6, 1, 5); g.rect(7, 7, 1, 3); g.set(2, 7, 0); });
def('birdUp', (g) => { g.line(0.5, 5, 3, 8, 1); g.line(3, 8, 5, 9, 1); g.line(5, 9, 7, 8, 1); g.line(7, 8, 9.5, 5, 1); g.rect(4, 9, 2, 1); });
def('birdDn', (g) => { g.line(0.5, 11, 3, 9, 1); g.line(3, 9, 7, 9, 1); g.line(7, 9, 9.5, 11, 1); g.rect(4, 8, 2, 2); });
def('worm', (g) => { for (let x = 1; x < 9; x++) g.rect(x, Math.round(9 + Math.sin(x * 1.2) * 1.2), 1, 2); });
def('bflyA', (g) => { g.blob(3, 7, 2.2, 2.6); g.blob(7, 7, 2.2, 2.6); g.blob(3.4, 11, 1.4, 1.6); g.blob(6.6, 11, 1.4, 1.6); g.rect(4.5, 6, 1, 7, 0); });
def('bflyB', (g) => { g.blob(4, 8, 1.2, 3); g.blob(6, 8, 1.2, 3); g.rect(5, 6, 1, 7); });
def('flyS', (g) => { g.rect(4, 7, 2, 2); });
def('flyL', (g) => { g.blob(5, 8, 2, 2.2); });

// ── buildings ──────────────────────────────────────────────────────────────
def('planks', (g) => {
  g.fill(1);
  for (const y of [0, 5, 10]) g.rect(0, y, AW, 1, 0);
  g.set(3, 2, 0); g.set(3, 3, 0); g.set(7, 7, 0); g.set(7, 8, 0); g.set(2, 12, 0); g.set(2, 13, 0);
}, true);
def('blocks', (g) => {
  g.fill(1);
  g.rect(0, 0, AW, 1, 0); g.rect(0, 8, AW, 1, 0);
  g.rect(0, 1, 1, 7, 0); g.rect(5, 9, 1, 7, 0);
}, true);
def('bricks', (g) => {
  g.fill(1);
  for (const y of [0, 4, 8, 12]) g.rect(0, y, AW, 1, 0);
  for (const [x, y] of [[0, 1], [5, 5], [0, 9], [5, 13]]) g.rect(x, y, 1, 3, 0);
}, true);
def('shingles', (g) => {
  g.fill(1);
  for (let row = 0; row < 4; row++) {
    const y = row * 4 + 3;
    for (let x = 0; x < AW; x++) if ((x + row * 2) % 5 !== 0) g.set(x, y, 0);
    g.set((row * 2) % 5, y - 1, 0);
  }
}, true);
def('weave', (g) => { g.fill(1); for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) if ((x + y) % 4 === 0) g.set(x, y, 0); }, true);
def('panel', (g) => { g.fill(1); g.rect(0, 0, AW, 1, 0); g.rect(0, 0, 1, AH, 0); g.set(2, 2, 0); g.set(7, 2, 0); g.set(2, 13, 0); g.set(7, 13, 0); }, true);
def('window', (g) => { g.rect(1, 2, 8, 12); g.rect(1, 7, 8, 1, 0); g.rect(4, 2, 2, 12, 0); g.rect(4, 2, 2, 12, 0); });
def('pane', (g) => { g.rect(2, 3, 6, 10); g.rect(2, 7, 6, 1, 0); });
def('roundWin', (g) => { g.blob(5, 8, 3.6, 3.8); g.rect(4.5, 4, 1, 8, 0); });
def('door', (g) => { g.rect(1, 6, 8, 10); g.blob(5, 6.5, 4, 4); g.rect(5, 3, 1, 13, 0); g.set(7, 11, 0); });
def('vent', (g) => { for (const y of [3, 6, 9, 12]) g.rect(1, y, 8, 2); });
def('fence', (g) => { g.rect(4, 2, 2, 14); g.rect(0, 6, AW, 1); g.rect(0, 11, AW, 1); });
def('pole', (g) => { g.rect(4, 0, 2, AH); });
def('spire', (g) => { for (let y = 2; y < AH; y++) { const half = Math.max(0.5, ((y - 2) / 13) * 4.5); g.rect(Math.round(5 - half), y, Math.max(1, Math.round(half * 2)), 1); } });

// ── sky & effects ──────────────────────────────────────────────────────────
def('dot1', (g) => g.set(5, 8));
def('dot2', (g) => g.rect(4, 7, 2, 2));
def('plus', (g) => { g.rect(4, 6, 1, 3); g.rect(3, 7, 3, 1); });
def('sparkle', (g) => { g.rect(4, 4, 2, 8); g.rect(2, 7, 6, 2); g.set(3, 6); g.set(6, 6); g.set(3, 9); g.set(6, 9); });
def('sparkleS', (g) => { g.rect(4, 6, 2, 4); g.rect(3, 7, 4, 2); });
def('diamond', (g) => { g.rect(4, 5, 2, 6); g.rect(3, 6, 4, 4); });
def('block2', (g) => g.rect(3, 6, 4, 4));
def('cross', (g) => { g.line(2, 5, 7, 11, 2); g.line(7, 5, 2, 11, 2); });
def('strand', (g) => { for (let y = 0; y < AH; y++) if (y % 3 !== 2) g.rect(4, y, 2, 1); });
def('ring', (g) => { g.blob(5, 8, 1.8, 2); g.set(5, 8, 0); g.set(4, 8, 0); });
def('swirl', (g) => { for (let x = 1; x < 9; x++) g.set(x, Math.round(8 + Math.sin(x * 0.9) * 1.3)); });
def('slash', (g) => g.line(2, 13, 8, 3, 1));
def('arrow', (g) => { for (let y = 0; y < 5; y++) g.rect(1 + y, 6 + y, 8 - y * 2, 1); });

// ── generic glyph → tile map (sky decorations, particles) ─────────────────
export const FX_TILE = new Uint8Array(256);
const fx = (chars, name) => { for (const ch of chars) if (gi(ch) !== gi('?') || ch === '?') FX_TILE[gi(ch)] = TILE[name]; };
fx('·∙.,`\'', 'dot1');
fx('•°∘●o', 'dot2');
fx('+', 'plus');
fx('✦✧★☆', 'sparkle');
fx('*', 'sparkleS');
fx('◆♦◊', 'diamond');
fx('▪■≡', 'block2');
fx('×', 'cross');
fx('~≈∼', 'swirl');
fx('│¦|:', 'strand');
fx('@', 'ring');
fx('▼', 'arrow');
fx('░', 'puff0');
fx('▒', 'puff1');
fx('▓', 'puff2');
fx('^"', 'flame1');
// tiles of a family: fam('dirt', 4) → [dirt0, dirt1, dirt2, dirt3]
export const fam = (name, n) => Array.from({ length: n }, (_, k) => TILE[name + k]);

// mountain ridges: coverage from the bottom at left / middle / right (thirds)
export const RIDGE = new Uint8Array(65);
for (let l = 0; l < 4; l++) for (let m = 0; m < 4; m++) for (let r = 0; r < 4; r++) {
  const key = l * 16 + m * 4 + r;
  if (!l && !m && !r) continue;
  RIDGE[key] = def(`ridge${key}`, (g) => {
    for (let x = 0; x < AW; x++) {
      const u = (x + 0.5) / AW;
      const cov = u < 0.5 ? (l + (m - l) * u * 2) / 3 : (m + (r - m) * (u - 0.5) * 2) / 3;
      for (let y = 0; y < AH; y++) if ((AH - y - 0.5) / AH < cov) g.set(x, y);
    }
  }, l === 3 || m === 3 || r === 3);
}
RIDGE[64] = TILE.cloudFull;
