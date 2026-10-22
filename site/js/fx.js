// ─── fx.js ── free-floating particles: debris, embers, falling leaves, text ─
import { G } from './state.js';
import { E, KIND, K } from './elements.js';

const MAX = 1600;

export function spawnFx(p) {
  if (G.fx.length >= MAX) G.fx.shift();
  p.vx = p.vx || 0;
  p.vy = p.vy || 0;
  p.life = p.life || 60;
  p.max = p.life;
  G.fx.push(p);
  return p;
}

export function floatText(x, y, text, color = [255, 220, 120], life = 90) {
  return spawnFx({ x, y, vy: -0.035, life, text, color, glow: 0.4, up: true });
}

let putCell = null;
export function setFxPut(fn) {
  putCell = fn;
}

export function updateFx() {
  const W = G.world;
  if (!W) return;
  const env = G.env;
  const { w, h, t } = W;
  const out = [];
  for (const p of G.fx) {
    if (--p.life <= 0) {
      if (p.onEnd) p.onEnd(p);
      continue;
    }
    if (p.drift) {
      p.vx += env.wind * 0.003 + (Math.random() - 0.5) * 0.03;
      p.vx *= 0.96;
      p.vy = Math.min(p.vy + 0.002, 0.07);
    }
    if (p.g) p.vy += p.g;
    if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
    const nx = p.x + p.vx, ny = p.y + p.vy;
    const cx = Math.round(nx), cy = Math.round(ny);
    if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1) {
      if (p.onHit) p.onHit(p, Math.round(p.x), Math.round(p.y));
      continue;
    }
    if (p.deposit !== undefined || p.collide || p.onHit) {
      const ty = t[cy * w + cx];
      if (ty !== E.EMPTY && KIND[ty] !== K.GAS && ty !== E.CLOUD && ty !== E.BOLT) {
        const lx = Math.round(p.x), ly = Math.round(p.y);
        if (p.onHit) p.onHit(p, lx, ly, cx, cy);
        else if (p.deposit && putCell) {
          const li = ly * w + lx;
          if (t[li] === E.EMPTY || KIND[t[li]] === K.GAS) putCell(li, p.deposit, p.depositD || 0, 0);
        }
        continue;
      }
    }
    if (p.trail && putCell && Math.random() < (p.trailRate || 1)) {
      const li = Math.round(p.y) * w + Math.round(p.x);
      if (t[li] === E.EMPTY) putCell(li, p.trail, p.trailD || 15, 0);
    }
    p.x = nx;
    p.y = ny;
    out.push(p);
  }
  G.fx = out;
}
