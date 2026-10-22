// ─── sim.js ── the falling-sand cellular automaton ─────────────────────────
import { E, K, N, KIND, DENS, FLAM, HOT, CAN, HARD, CONDUCT, SP, MAT } from './elements.js';
import { G, emit } from './state.js';
import { spawnFx } from './fx.js';

let W, t, d, v, a, s, c, w, h, F, env;
const R = Math.random;
let N8, N4, UPN;

export function bindWorld(world) {
  W = world;
  ({ t, d, v, a, s, c, w, h } = world);
  N8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  N4 = [-w, -1, 1, w];
  UPN = [-w - 1, -w, -w + 1, -1, 1, -1, 1, w - 1, w + 1]; // leaf spreading: up, sideways, a bit down
}

// a discovery only counts when it happens where the player is looking
const disc = (k, i) => {
  if (!G.progress || G.progress.found[k]) return;
  if (i !== undefined) {
    const V = G.view;
    if (!V) return;
    const x = i % w, y = (i / w) | 0;
    if (x < V.ox || y < V.oy || x >= V.ox + V.visC || y >= V.oy + V.visR) return;
  }
  emit('discover', k);
};

function swap(i, j) {
  let x = t[i]; t[i] = t[j]; t[j] = x;
  x = d[i]; d[i] = d[j]; d[j] = x;
  x = v[i]; v[i] = v[j]; v[j] = x;
  x = a[i]; a[i] = a[j]; a[j] = x;
  s[i] = F; s[j] = F;
}
function put(i, type, dd = 0, aa = 0) {
  t[i] = type; d[i] = dd; a[i] = aa; v[i] = (R() * 256) | 0; s[i] = F;
}
function clear(i) {
  t[i] = 0; d[i] = 0; a[i] = 0; s[i] = F;
}
export { put as putCell };

// ── movement primitives ─────────────────────────────────────────────────────
function powder(i, type) {
  const b = i + w;
  const row = type * N;
  if (CAN[row + t[b]]) { swap(i, b); return true; }
  const dir = R() < 0.5 ? -1 : 1;
  if (CAN[row + t[b + dir]] && CAN[row + t[i + dir]]) { swap(i, b + dir); return true; }
  if (CAN[row + t[b - dir]] && CAN[row + t[i - dir]]) { swap(i, b - dir); return true; }
  return false;
}

function soil(i, type) {
  const b = i + w;
  const row = type * N;
  if (CAN[row + t[b]]) { swap(i, b); return true; }
  if (R() < 0.03) {
    const dir = R() < 0.5 ? -1 : 1;
    if (CAN[row + t[b + dir]] && CAN[row + t[i + dir]] && CAN[row + t[i + dir - w]]) { swap(i, b + dir); return true; }
  }
  return false;
}

function liquid(i, type, disp) {
  const b = i + w;
  const row = type * N;
  if (CAN[row + t[b]]) { swap(i, b); return true; }
  const dir = R() < 0.5 ? -1 : 1;
  if (CAN[row + t[b + dir]] && CAN[row + t[i + dir]]) { swap(i, b + dir); return true; }
  if (CAN[row + t[b - dir]] && CAN[row + t[i - dir]]) { swap(i, b - dir); return true; }
  let j = i;
  for (let k = 0; k < disp; k++) {
    const nj = j + dir;
    if (!CAN[row + t[nj]]) break;
    j = nj;
    if (CAN[row + t[j + w]]) break;
  }
  if (j !== i) { swap(i, j); return true; }
  for (let k = 0; k < disp; k++) {
    const nj = j - dir;
    if (!CAN[row + t[nj]]) break;
    j = nj;
    if (CAN[row + t[j + w]]) break;
  }
  if (j !== i) { swap(i, j); return true; }
  return false;
}

function gas(i) {
  const up = i - w;
  const r = R();
  let dx = r < 0.22 ? -1 : r < 0.44 ? 1 : 0;
  const wd = env.wind;
  if (R() < Math.abs(wd) * 0.7) dx = wd > 0 ? 1 : -1;
  if (r < 0.8) {
    if (t[up + dx] === 0) { swap(i, up + dx); return true; }
    if (t[up] === 0) { swap(i, up); return true; }
  }
  const sd = R() < 0.5 ? -1 : 1;
  if (t[i + sd] === 0) { swap(i, i + sd); return true; }
  return false;
}

// ── fire ────────────────────────────────────────────────────────────────────
export function ignite(j) {
  const tj = t[j];
  switch (tj) {
    case E.WOOD: case E.SAPLING:
      put(j, E.EMBER, 90 + R() * 140);
      break;
    case E.STRUCT: {
      const m = v[j];
      if (m === MAT.WOOD || m === MAT.DOOR || m === MAT.CLOTH || m === MAT.ROOF) {
        put(j, E.EMBER, 80 + R() * 120);
        emit('structHit', a[j]);
      }
      break;
    }
    case E.GUNPOWDER:
      boom(j, 3 + R() * 2);
      break;
    case E.TNT:
      boom(j, 9 + R() * 3);
      break;
    case E.OIL:
      put(j, E.FIRE, 70 + R() * 80);
      if (R() < 0.05) disc('oilfire', j);
      break;
    case E.GRASS:
      t[j] = E.DIRT; s[j] = F;
      if (t[j - w] === 0) put(j - w, E.FIRE, 20 + R() * 25);
      break;
    case E.BIRD: case E.BUTTERFLY: case E.FIREFLY:
      put(j, E.FIRE, 20);
      spawnFx({ x: j % w, y: (j / w) | 0, vy: 0.05, life: 50, glyph: '†', color: [200, 200, 220], text: null, up: true });
      break;
    default:
      put(j, E.FIRE, 25 + R() * 45);
  }
}

// queue an explosion
export function boom(i, r) {
  if (t[i] === E.TNT || t[i] === E.GUNPOWDER) clear(i);
  W.booms.push({ i, r, delay: 2 + ((R() * 3) | 0) });
}

export function explode(cx, cy, r) {
  const ry = r / 1.6;
  const x0 = Math.max(1, Math.floor(cx - r)), x1 = Math.min(w - 2, Math.ceil(cx + r));
  const y0 = Math.max(1, Math.floor(cy - ry)), y1 = Math.min(h - 2, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / r, dy = (y - cy) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) continue;
      const i = y * w + x;
      const ty = t[i];
      if (ty === E.BEDROCK || ty === 0) continue;
      if (ty === E.TNT || ty === E.GUNPOWDER) { boom(i, ty === E.TNT ? 9 : 3.5); continue; }
      if (ty === E.STRUCT) emit('structHit', a[i]);
      const hard = HARD[ty];
      if (dist > 1 - (1 - hard) * 0.9 + (R() - 0.5) * 0.25) continue;
      if (dist > 0.55 && KIND[ty] !== K.GAS && R() < 0.35) {
        // debris flies off and lands as matter
        const ang = Math.atan2(dy, dx);
        const sp = (1 - dist) * 1.6 + R() * 0.8;
        const dep = ty === E.STONE || ty === E.OBSIDIAN ? E.SAND : KIND[ty] === K.LIQUID || KIND[ty] === K.POWDER || KIND[ty] === K.SOIL ? ty : 0;
        spawnFx({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.6, g: 0.06, life: 120,
          glyph: dep ? '∙' : '*', color: [255, 180, 90], glow: 0.6, deposit: dep, cell: ty,
        });
        clear(i);
      } else if (R() < 0.45) {
        put(i, E.FIRE, 10 + R() * 30);
      } else if (R() < 0.3) {
        put(i, E.SMOKE, 60 + R() * 80);
      } else clear(i);
    }
  }
  emit('explosion', cx, cy, r);
  disc('explosion', (cy | 0) * w + (cx | 0));
}

// ── lightning ──────────────────────────────────────────────────────────────
export function strike(x, yStart = 1) {
  let y = Math.max(1, yStart);
  let px = x;
  let dir = 0;
  const path = [];
  while (y < h - 2) {
    const i = y * w + px;
    const ty = t[i];
    if (ty !== 0 && ty !== E.CLOUD && KIND[ty] !== K.GAS && ty !== E.BIRD && ty !== E.BUTTERFLY && ty !== E.FIREFLY && ty !== E.LEAF) break;
    if (ty === E.BIRD || ty === E.BUTTERFLY || ty === E.FIREFLY) disc('birdzap', i);
    path.push(i);
    if (R() < 0.45) dir = R() < 0.5 ? -1 : 1;
    else if (R() < 0.3) dir = 0;
    const nx = px + dir;
    if (nx > 1 && nx < w - 2) px = nx;
    y++;
    // occasional side branch
    if (R() < 0.06 && path.length > 3) {
      let bx = px, by = y;
      const bd = R() < 0.5 ? -1 : 1;
      for (let k = 0; k < 4 + R() * 6; k++) {
        bx += bd; by += R() < 0.7 ? 1 : 0;
        if (bx < 2 || bx > w - 3 || by > h - 3) break;
        const bi = by * w + bx;
        if (t[bi] !== 0) break;
        put(bi, E.BOLT, 4 + R() * 4, bd > 0 ? 1 : 2);
      }
    }
  }
  let prev = x;
  for (const i of path) {
    const px2 = i % w;
    if (t[i] === E.CLOUD) { prev = px2; continue; }
    put(i, E.BOLT, 6 + R() * 6, px2 > prev ? 1 : px2 < prev ? 2 : 0);
    prev = px2;
  }
  const hit = y * w + px;
  const th = t[hit];
  if (th === E.SAND || th === E.GLASS) {
    for (let k = 0; k < 14; k++) {
      const j = hit + ((R() * 5) | 0) - 2 + (((R() * 4) | 0) - 1) * w;
      if (t[j] === E.SAND) put(j, E.GLASS);
    }
    disc('fulgurite', hit);
  } else if (CONDUCT[th]) {
    electrify(hit);
  } else if (th === E.TNT || th === E.GUNPOWDER) {
    boom(hit, th === E.TNT ? 9 : 4);
  } else if (FLAM[th] > 0) {
    ignite(hit);
  } else if (th === E.STRUCT) {
    ignite(hit);
  }
  if (th !== E.BEDROCK && R() < 0.5) explode(px, y - 1, 1.6);
  emit('lightning', px, y, path.length);
}

export function electrify(i0) {
  const q = [i0];
  const seen = new Set([i0]);
  let n = 0;
  while (q.length && n < 900) {
    const i = q.shift();
    c[i] = 14;
    W.charged.push(i);
    n++;
    for (let k = 0; k < 4; k++) {
      const j = i + N4[k];
      if (seen.has(j)) continue;
      const tj = t[j];
      if (CONDUCT[tj] || tj === E.FISH) { seen.add(j); q.push(j); }
    }
  }
  disc('electric', i0);
  emit('zap', i0 % w, (i0 / w) | 0);
}

// ── one simulation tick ─────────────────────────────────────────────────────
export function step() {
  env = G.env;
  F = (W.F % 255) + 1;
  W.F = F;
  W.tick++;
  const counts = W.counts;
  counts.fill(0);
  const grow = G.fastGrow ? 1 : 0.025 * env.grow;
  const tick = W.tick;

  // pending explosions
  if (W.booms.length) {
    const keep = [];
    for (const b of W.booms) {
      if (--b.delay <= 0) explode(b.i % w, (b.i / w) | 0, b.r);
      else keep.push(b);
    }
    W.booms = keep;
  }
  // electric charge decay
  if (W.charged.length) {
    const keep = [];
    for (const i of W.charged) {
      if (c[i] > 0) {
        c[i]--;
        if (t[i] === E.FISH) { clear(i); spawnFx({ x: i % w, y: (i / w) | 0, vy: -0.08, life: 50, glyph: '×', color: [220, 230, 255], up: true }); }
        if (c[i] > 0) keep.push(i);
      }
    }
    W.charged = keep;
  }

  for (let y = h - 2; y >= 1; y--) {
    const ltr = ((y ^ tick) & 1) === 0;
    const row = y * w;
    for (let k = 1; k < w - 1; k++) {
      const x = ltr ? k : w - 1 - k;
      const i = row + x;
      const type = t[i];
      if (type === 0) continue;
      counts[type]++;
      if (s[i] === F) continue;

      switch (type) {
        case E.SAND:
          powder(i, type);
          break;

        case E.DIRT:
          if (!soil(i, type) && t[i - w] === 0 && y <= W.surf[x] + 1 && R() < 0.0006 * env.grow && W.biome[x] !== 3) {
            t[i] = E.GRASS;
          }
          break;

        case E.GRASS: {
          if (soil(i, type)) break;
          const up = t[i - w];
          if (up !== 0 && (KIND[up] === K.POWDER || KIND[up] === K.SOIL || KIND[up] === K.LIQUID || up === E.STONE || up === E.ICE)) {
            if (up !== E.SNOW && R() < 0.01) t[i] = E.DIRT;
            break;
          }
          if (R() < 0.02 * env.grow) {
            const j = i + N8[(R() * 8) | 0];
            if (t[j] === E.DIRT && t[j - w] === 0) { t[j] = E.GRASS; s[j] = F; }
          }
          if (up === 0 && env.season === 0 && R() < 0.00002) {
            put(i - w, E.PLANT, 1 + R() * 3, 1);
          }
          break;
        }

        case E.WATER: {
          if (liquid(i, type, 5)) break;
          // thin puddles soak into the soil, keeping the water cycle in balance
          const bw = t[i + w];
          if ((bw === E.DIRT || bw === E.GRASS || bw === E.SAND || bw === E.SNOW) && t[i - w] !== E.WATER && R() < 0.006) { clear(i); break; }
          if (t[i - w] === 0) {
            if (env.temp < -1 && R() < 0.0004) { t[i] = E.ICE; disc('ice', i); }
            else if (env.evap > 0 && R() < 0.00004 * env.evap) put(i, E.STEAM, 120 + R() * 100);
          }
          break;
        }

        case E.LAVA: {
          if (R() < 0.33 && liquid(i, type, 2)) break;
          const j = i + N8[(R() * 8) | 0];
          const tj = t[j];
          if (tj === E.WATER) {
            put(i, R() < 0.6 ? E.OBSIDIAN : E.STONE);
            put(j, E.STEAM, 90 + R() * 90);
            disc('obsidian', i);
            if (R() < 0.1) emit('sfx', 'hiss', x, y);
          } else if (tj === E.ICE || tj === E.SNOW) {
            put(j, R() < 0.5 ? E.WATER : E.STEAM, 100);
            disc('melt', i);
          } else if (tj === E.SAND) {
            if (R() < 0.006) { put(j, E.GLASS); disc('glass', i); }
          } else if (tj === E.FISH || tj === E.WORM || tj === E.BIRD) {
            put(j, E.FIRE, 20);
          } else if (FLAM[tj] > 0 && R() < FLAM[tj] * 1.5 + 0.02) {
            ignite(j);
          } else if (tj === 0 && j < i - 1 && R() < 0.002) {
            put(j, E.FIRE, 8 + R() * 10);
          }
          if (R() < 0.004) {
            let n = 0;
            for (let q = 0; q < 4; q++) if (t[i + N4[q]] === E.LAVA) n++;
            if (n === 0) put(i, E.STONE);
          }
          break;
        }

        case E.FIRE: {
          if (d[i] === 0) d[i] = 25 + R() * 40;
          d[i]--;
          if (d[i] <= 1) {
            if (R() < 0.35) put(i, E.SMOKE, 50 + R() * 80);
            else clear(i);
            break;
          }
          for (let q = 0; q < 2; q++) {
            const j = i + N8[(R() * 8) | 0];
            const tj = t[j];
            if (tj === E.WATER || tj === E.ICE || tj === E.SNOW) {
              put(i, E.STEAM, 60 + R() * 60);
              if (tj === E.WATER && R() < 0.25) put(j, E.STEAM, 80 + R() * 60);
              disc('steam', i);
              break;
            }
            if (FLAM[tj] > 0 && R() < FLAM[tj]) ignite(j);
          }
          if (t[i] === E.FIRE && R() < 0.45) {
            const up = i - w + ((R() * 3) | 0) - 1;
            if (t[up] === 0) swap(i, up);
          }
          break;
        }

        case E.EMBER: {
          if (d[i] === 0) d[i] = 100 + R() * 150;
          d[i]--;
          if (d[i] <= 1) {
            if (R() < 0.6) put(i, E.ASH);
            else clear(i);
            disc('ash', i);
            break;
          }
          if (t[i - w] === 0 && R() < 0.12) put(i - w, E.FIRE, 12 + R() * 22);
          const j = i + N8[(R() * 8) | 0];
          const tj = t[j];
          if (tj === E.WATER) { put(i, E.ASH); put(j, E.STEAM, 80); disc('steam', i); }
          else if (FLAM[tj] > 0 && R() < FLAM[tj] * 0.6) ignite(j);
          break;
        }

        case E.SMOKE:
          if (d[i] === 0) d[i] = 60 + R() * 80;
          if (--d[i] <= 1) { clear(i); break; }
          gas(i);
          break;

        case E.STEAM:
          if (d[i] === 0) d[i] = 100 + R() * 120;
          if (--d[i] <= 1) {
            if (R() < 0.35) { put(i, E.WATER); disc('watercycle', i); }
            else clear(i);
            break;
          }
          if (y < env.cloudLine && R() < 0.015) { put(i, E.CLOUD, 30 + R() * 40, 1); disc('cloudbirth', i); break; }
          gas(i);
          break;

        case E.SNOW: {
          if (t[i + w] === 0) {
            if (R() < 0.45) {
              const wd = env.wind;
              const dx = R() < Math.abs(wd) ? (wd > 0 ? 1 : -1) : R() < 0.15 ? (R() < 0.5 ? -1 : 1) : 0;
              const j = i + w + dx;
              if (t[j] === 0) swap(i, j);
            }
          } else if (!powder(i, type)) {
            // mountain tops stay frozen
            const lt = env.temp - Math.max(0, W.sea - 24 - y) * 1.5;
            if (lt > 2 && R() < 0.0012 * (lt / 10)) put(i, E.WATER);
          }
          const tj = t[i + N4[(R() * 4) | 0]];
          if (HOT[tj] || (tj === E.WATER && y > W.sea - 24 && R() < 0.05)) { put(i, E.WATER); disc('melt', i); }
          break;
        }

        case E.ICE: {
          const j = i + N4[(R() * 4) | 0];
          const tj = t[j];
          if (HOT[tj] && R() < 0.2) { put(i, E.WATER); disc('melt', i); break; }
          if (env.temp > 3 && (tj === 0 || tj === E.WATER) && R() < 0.0008) { put(i, E.WATER); break; }
          if (env.temp < -2 && tj === E.WATER && (t[j - w] === 0 || t[j - w] === E.ICE) && R() < 0.003) put(j, E.ICE);
          break;
        }

        case E.ACID: {
          if (liquid(i, type, 3)) break;
          const j = i + N4[(R() * 4) | 0];
          const tj = t[j];
          if (tj === 0 || tj === E.ACID || tj === E.BEDROCK || tj === E.GLASS || KIND[tj] === K.GAS || tj === E.CLOUD) break;
          if (tj === E.WATER) { if (R() < 0.01) put(i, E.WATER); break; }
          if (R() < 0.12) {
            if (tj === E.STRUCT) emit('structHit', a[j]);
            if (R() < 0.25) put(j, E.SMOKE, 30 + R() * 30);
            else clear(j);
            if (R() < 0.3) put(i, E.SMOKE, 40);
            disc('corrosion', i);
          }
          break;
        }

        case E.OIL:
          liquid(i, type, 3);
          break;

        case E.GUNPOWDER:
        case E.SEED:
        case E.ASH:
          if (type === E.ASH && R() < 0.3) break;
          if (powder(i, type)) break;
          if (type === E.SEED) {
            const b = t[i + w];
            if ((b === E.DIRT || b === E.GRASS) && R() < grow * 0.25) sprout(i, x, y);
            else if (++d[i] > 250 && R() < 0.02) clear(i);
          } else if (type === E.ASH && env.raining && t[i - w] === 0 && R() < 0.001) clear(i);
          break;

        case E.SAPLING:
          if (R() < grow * 0.8) growTree(i);
          break;

        case E.LEAF: {
          if (d[i] > 0) {
            if (R() < grow * 1.6) {
              const j = i + UPN[(R() * UPN.length) | 0];
              if (t[j] === 0) { put(j, E.LEAF, d[i] - 1, a[i]); if (R() < 0.45) d[i]--; }
              else if (R() < 0.2) d[i]--;
            }
            break;
          }
          if (R() < 0.004 && !woodNear(x, y)) {
            if (R() < 0.1) put(i, E.SEED);
            else {
              clear(i);
              if (R() < 0.3) spawnFx({ x, y, vx: env.wind * 0.1, vy: 0.04, life: 160, glyph: ',', color: leafColor(a[i]), drift: true });
            }
            break;
          }
          const sp = a[i] & 7;
          if (env.season === 2 && sp !== SP.PINE && R() < 0.00003) {
            clear(i);
            spawnFx({ x, y, vx: env.wind * 0.15, vy: 0.03, life: 260, glyph: R() < 0.5 ? ',' : '`', color: leafColor(sp), drift: true });
          }
          break;
        }

        case E.WOOD:
          if ((env.season === 0 || env.season === 1) && R() < 0.00025) regrowLeaf(i, x, y);
          break;

        case E.PLANT:
          if (a[i] & 1) {
            if (R() < grow * 1.5) {
              if (d[i] === 0 || t[i - w] !== 0) { put(i, E.FLOWER); disc('flower', i); }
              else {
                const ti = i - w;
                t[ti] = E.PLANT; d[ti] = d[i] - 1; a[ti] = 1; v[ti] = v[i]; s[ti] = F;
                a[i] = 0; d[i] = 0;
              }
            }
          } else if (env.season === 3 && R() < 0.00006) clear(i);
          break;

        case E.FLOWER:
          if (env.season === 3 && R() < 0.0001) clear(i);
          break;

        case E.CROP:
          if (d[i] < 255 && R() < grow * 0.9) d[i]++;
          break;

        case E.CLOUD: {
          const fl = a[i];
          const raining = (fl & 1) || env.raining;
          if (raining && d[i] > 0 && t[i + w] === 0 && R() < env.rainRate) {
            put(i + w, env.temp < 0 || fl & 4 ? E.SNOW : E.WATER, 0, 0);
            d[i]--;
          }
          if (((fl & 2) || env.storm) && R() < 0.000015 * (env.storm ? 2 : 1)) strike(x, y + 1);
          if (d[i] === 0 && R() < 0.003) clear(i);
          else if (!raining && !(fl & 1) && env.clear && R() < 0.0006) clear(i);
          break;
        }

        case E.BOLT:
          if (d[i] === 0 || --d[i] <= 0) clear(i);
          break;

        case E.CRYSTAL:
          if (R() < 0.00012) {
            const j = i + N8[(R() * 8) | 0];
            if (t[j] === 0 && y > W.surf[x] + 4) {
              let n = 0;
              for (let q = 0; q < 8; q++) if (t[j + N8[q]] === E.CRYSTAL) n++;
              if (n <= 2) { put(j, E.CRYSTAL); disc('crystal', i); }
            }
          }
          break;

        case E.SHROOM:
          if (R() < 0.00008) {
            const nx = x + ((R() * 7) | 0) - 3, ny = y + ((R() * 5) | 0) - 2;
            if (nx > 1 && nx < w - 2 && ny > 1 && ny < h - 2 && ny > W.surf[nx] + 3) {
              const j = ny * w + nx;
              const b = t[j + w];
              if (t[j] === 0 && (b === E.STONE || b === E.DIRT || b === E.OBSIDIAN)) put(j, E.SHROOM);
            }
          }
          break;

        case E.TORCH:
          if (R() < 0.01 && t[i + N4[(R() * 4) | 0]] === E.WATER) clear(i);
          break;

        case E.GLITCH: {
          if (d[i] === 0) d[i] = 60 + R() * 160;
          d[i]--;
          if (d[i] <= 1) {
            if (R() < 0.12) put(i, [E.SAND, E.WATER, E.STONE, E.CRYSTAL, E.GOLD, E.DIRT][(R() * 6) | 0]);
            else clear(i);
            break;
          }
          const j = i + N8[(R() * 8) | 0];
          const tj = t[j];
          if (tj !== 0 && tj !== E.BEDROCK && tj !== E.GLITCH && R() < 0.07) {
            if (tj === E.STRUCT) emit('structHit', a[j]);
            put(j, E.GLITCH, Math.max(8, d[i] - 8 - R() * 30));
            disc('glitch', i);
          }
          if (R() < 0.08) {
            const q = i + N8[(R() * 8) | 0];
            if (t[q] !== E.BEDROCK) swap(i, q);
          }
          break;
        }

        case E.FISH: life_fish(i, x, y); break;
        case E.BIRD: life_bird(i, x, y); break;
        case E.BUTTERFLY: life_butterfly(i, x, y); break;
        case E.FIREFLY: life_firefly(i, x, y); break;
        case E.WORM: life_worm(i); break;
        default:
          break;
      }
    }
  }
  if ((tick & 31) === 0) W.computeSurface();
}

// ── plants ─────────────────────────────────────────────────────────────────
function sprout(i, x, y) {
  const r = v[i] / 256;
  if (r < 0.45) {
    const b = W.biome[x];
    let sp;
    if (b === 2 || y < W.sea - 14) sp = SP.PINE;
    else if (b === 4 || b === 3) sp = R() < 0.6 ? SP.PALM : SP.OAK;
    else {
      const q = R();
      sp = q < 0.12 ? SP.CHERRY : q < 0.35 ? SP.BIRCH : q < 0.45 ? SP.PINE : SP.OAK;
    }
    plantTree(i, sp);
    disc('sprout', i);
  } else {
    put(i, E.PLANT, 1 + R() * 4, 1);
  }
}

export function plantTree(i, sp, scale = 1) {
  let hgt;
  let canopy;
  switch (sp) {
    case SP.PINE: hgt = 9 + R() * 8; canopy = 1; break;
    case SP.BIRCH: hgt = 7 + R() * 6; canopy = 3; break;
    case SP.CHERRY: hgt = 5 + R() * 4; canopy = 4; break;
    case SP.PALM: hgt = 6 + R() * 5; canopy = 0; break;
    default: hgt = 6 + R() * 6; canopy = 4;
  }
  hgt = Math.max(3, Math.min(15, Math.round(hgt * scale)));
  // aux layout: sp(3) | branch(1) | dir(2) | init(4) | canopy(3)
  const aux = sp | (1 << 4) | (hgt << 6) | (canopy << 10);
  put(i, E.SAPLING, hgt, aux);
}

function growTree(i) {
  const aux = a[i];
  const sp = aux & 7, branch = (aux >> 3) & 1, dir = ((aux >> 4) & 3) - 1, init = (aux >> 6) & 15, canopy = (aux >> 10) & 7;
  if (d[i] === 0) {
    if (sp === SP.PALM) { palmCrown(i); return; }
    put(i, E.LEAF, sp === SP.PINE ? 0 : canopy + (branch ? 0 : 1), sp);
    if (sp === SP.PINE) v[i] = 1; // pine tip
    return;
  }
  let ti = i - w;
  if (branch) ti += dir;
  else if (sp === SP.PALM && d[i] < init - 2 && R() < 0.35) ti += (v[i] & 1 ? 1 : -1);
  const tt = t[ti];
  if (tt === 0 || tt === E.LEAF || tt === E.PLANT || tt === E.FLOWER || tt === E.SMOKE || tt === E.STEAM) {
    t[ti] = E.SAPLING; d[ti] = d[i] - 1; a[ti] = aux; v[ti] = v[i]; s[ti] = F;
    t[i] = E.WOOD; d[i] = 0; a[i] = sp | (branch ? 8 : 0); s[i] = F;
    const left = init - d[ti];
    if (sp === SP.PINE && left >= 2) {
      const wid = Math.max(1, Math.round(d[ti] * 0.42 + 0.3 + ((left & 1) ? 0.6 : 0)));
      for (let dx = 1; dx <= wid; dx++) {
        if (t[i - dx] === 0) put(i - dx, E.LEAF, 0, sp);
        if (t[i + dx] === 0) put(i + dx, E.LEAF, 0, sp);
      }
    }
    if (!branch && sp !== SP.PINE && sp !== SP.PALM && d[ti] > 1 && d[ti] < init * 0.6 && R() < 0.3) {
      const bd = R() < 0.5 ? -1 : 1;
      const bi = i - w + bd;
      if (t[bi] === 0) {
        const len = 2 + ((R() * 3) | 0);
        put(bi, E.SAPLING, len, sp | 8 | ((bd + 1) << 4) | (len << 6) | (Math.max(2, canopy - 1) << 10));
      }
    }
  } else {
    d[i] = 0;
  }
}

function palmCrown(i) {
  t[i] = E.WOOD; a[i] = SP.PALM; s[i] = F;
  const fronds = [[-1, -1], [1, -1], [-2, 0], [2, 0], [-3, 1], [3, 1], [0, -1], [-2, -1], [2, -1]];
  for (const [dx, dy] of fronds) {
    const j = i + dx + dy * w;
    if (t[j] === 0) put(j, E.LEAF, 0, SP.PALM);
  }
}

function woodNear(x, y) {
  for (let dy = -3; dy <= 3; dy++) {
    const yy = y + dy;
    if (yy < 1 || yy >= h - 1) continue;
    const row = yy * w;
    for (let dx = -4; dx <= 4; dx++) {
      const xx = x + dx;
      if (xx < 1 || xx >= w - 1) continue;
      const tt = t[row + xx];
      if (tt === E.WOOD || tt === E.SAPLING) return true;
    }
  }
  return false;
}

function regrowLeaf(i, x, y) {
  const sp = a[i] & 7;
  if (sp === SP.PALM) return;
  for (let k = 1; k <= 3; k++) {
    const b = t[i + k * w];
    if (b === E.DIRT || b === E.GRASS || b === E.STONE || b === E.SAND) return;
  }
  const j = i + UPN[(R() * UPN.length) | 0];
  if (t[j] !== 0) return;
  let n = 0;
  for (let q = 0; q < 8; q++) if (t[j + N8[q]] === E.LEAF) n++;
  if (n >= 1 && n <= 5) put(j, E.LEAF, 1, sp);
}

export function leafColor(sp) {
  const se = G.env ? G.env.season : 1;
  if (sp === SP.CHERRY && se === 0) return [255, 160, 200];
  if (se === 2 && sp !== SP.PINE && sp !== SP.PALM) return [230, 130, 50];
  return [90, 170, 70];
}

// ── creatures ──────────────────────────────────────────────────────────────
function hasWater(i) {
  return t[i - w] === E.WATER || t[i + w] === E.WATER || t[i - 1] === E.WATER || t[i + 1] === E.WATER;
}

function life_fish(i, x, y) {
  if (!hasWater(i)) {
    if (t[i + w] === 0) { swap(i, i + w); return; }
    if (++d[i] > 160) { clear(i); spawnFx({ x, y, vy: -0.05, life: 60, glyph: '×', color: [200, 210, 230], up: true }); }
    return;
  }
  d[i] = 0;
  if (R() < 0.12) {
    let dir = a[i] & 1 ? 1 : -1;
    if (R() < 0.03) dir = -dir;
    const dy = R() < 0.25 ? (R() < 0.5 ? -w : w) : 0;
    const j = i + dir + dy;
    if (t[j] === E.WATER && (dy >= 0 || t[j - w] === E.WATER)) {
      swap(i, j);
      a[j] = dir > 0 ? 1 : 0;
    } else a[i] = dir > 0 ? 0 : 1;
  }
  if (R() < 0.00004 && W.counts[E.FISH] < W.counts[E.WATER] / 140) {
    const j = i + N4[(R() * 4) | 0];
    if (t[j] === E.WATER) { put(j, E.FISH, 0, R() < 0.5 ? 1 : 0); v[j] = v[i]; disc('fishbirth', i); }
  }
}

function groundDist(i, max) {
  let n = 0;
  for (let k = 1; k <= max; k++) {
    const tt = t[i + k * w];
    if (tt !== 0 && KIND[tt] !== K.GAS && tt !== E.CLOUD) break;
    n++;
  }
  return n;
}

function life_bird(i, x, y) {
  if (G.env.night && R() < 0.9) return;
  if (R() > 0.3) return;
  let dir = a[i] & 1 ? 1 : -1;
  if (R() < 0.008) dir = -dir;
  const gd = groundDist(i, 14);
  let dy = 0;
  if (gd < 5) dy = -1;
  else if (gd >= 14 && R() < 0.35) dy = 1;
  else if (R() < 0.15) dy = R() < 0.5 ? -1 : 1;
  if (y < 5) dy = 1;
  if (x < 4) dir = 1;
  if (x > w - 5) dir = -1;
  const j = i + dir + dy * w;
  if (t[j] === 0) { swap(i, j); a[j] = (a[j] & ~1) | (dir > 0 ? 1 : 0); }
  else {
    a[i] = (a[i] & ~1) | (dir > 0 ? 0 : 1);
    if (t[i - w] === 0) swap(i, i - w);
  }
}

function life_butterfly(i, x, y) {
  if (G.env.season === 3 && R() < 0.002) { clear(i); return; }
  if (G.env.night && R() < 0.0015) { clear(i); return; }
  if (R() > 0.2) return;
  const gd = groundDist(i, 8);
  let dy = R() < 0.5 ? -1 : 1;
  if (gd < 1) dy = -1;
  else if (gd > 5) dy = 1;
  const dx = R() < 0.5 ? -1 : 1;
  const j = i + dx + dy * w;
  if (t[j] === 0) swap(i, j);
}

function life_firefly(i, x, y) {
  if (!G.env.night && R() < 0.004) { clear(i); return; }
  if (R() > 0.12) return;
  const gd = groundDist(i, 8);
  let dy = R() < 0.5 ? -1 : 1;
  if (gd < 1) dy = -1;
  else if (gd > 6) dy = 1;
  const j = i + (R() < 0.5 ? -1 : 1) + (R() < 0.5 ? dy * w : 0);
  if (t[j] === 0) swap(i, j);
}

function life_worm(i) {
  if (t[i + w] === 0) { swap(i, i + w); return; }
  if (R() > 0.04) return;
  const j = i + N4[(R() * 4) | 0];
  if (t[j] === E.DIRT) swap(i, j);
  else if (t[j] === 0 && R() < 0.02) {
    let soilN = 0;
    for (let q = 0; q < 4; q++) if (t[i + N4[q]] === E.DIRT || t[i + N4[q]] === E.GRASS) soilN++;
    if (soilN === 0 && ++d[i] > 200) clear(i);
  }
}
