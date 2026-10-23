// ─── fauna.js ── rabbits, deer, boars and wolves walking the land ──────────
import { G, emit } from './state.js';
import { E, STAND, PASS, DEADLY } from './elements.js';
import { spawnFx, floatText } from './fx.js';

// biomes: 0 plains · 1 forest · 2 mountains · 3 desert · 4 coast · 5 jungle · 6 tundra
export const KINDS = {
  rabbit: { biomes: [0, 1, 6, 4], cool: 7, run: 3, food: 2, flee: 7, max: 14, n: { fr: 'Lapin', en: 'Rabbit' } },
  deer: { biomes: [0, 1, 6, 2], cool: 9, run: 4, food: 6, flee: 10, max: 9, n: { fr: 'Cerf', en: 'Deer' } },
  boar: { biomes: [1, 5, 0], cool: 10, run: 5, food: 7, flee: 3, max: 6, n: { fr: 'Sanglier', en: 'Boar' } },
  wolf: { biomes: [6, 1, 2], cool: 8, run: 4, food: 4, flee: 0, max: 5, n: { fr: 'Loup', en: 'Wolf' } },
};
const R = Math.random;
const W = () => G.world;

export function createFauna() {
  G.fauna = { list: [], nextId: 1 };
  return G.fauna;
}

export function spawnAnimal(kind, x, y, opts = {}) {
  const F = G.fauna || createFauna();
  const a = { id: F.nextId++, kind, x, y, dir: R() < 0.5 ? -1 : 1, state: 'graze', timer: 60 + R() * 200, cool: 0, fall: 0, wet: 0, tx: x, young: opts.young ? 2 : 0, fed: 0, home: x };
  F.list.push(a);
  return a;
}

const standable = (w, x, y) => {
  if (x < 3 || x > w.w - 4 || y < 2 || y > w.h - 3) return false;
  const c = w.t[y * w.w + x], b = w.t[(y + 1) * w.w + x];
  return PASS[c] && !DEADLY[c] && c !== E.WATER && c !== E.LAVA && c !== E.ACID && c !== E.OIL && STAND[b] && b !== E.STRUCT;
};

// scatter the first animals over the regions they like, away from the tribe
export function initFauna() {
  createFauna();
  const w = W();
  const center = G.tribe ? G.tribe.center : w.w / 2;
  const sc = w.w / 400;
  for (const [kind, K] of Object.entries(KINDS)) {
    const want = Math.round((kind === 'wolf' ? 3 : K.max * 0.6) * sc);
    let n = 0;
    for (let tries = 0; tries < 4000 && n < want; tries++) {
      const x = 6 + ((R() * (w.w - 12)) | 0);
      if (!K.biomes.includes(w.biome[x])) continue;
      if (Math.abs(x - center) < (kind === 'wolf' ? 90 : 35)) continue;
      const y = w.surf[x] - 1;
      if (!standable(w, x, y)) continue;
      // wolves come as a pack
      const pack = kind === 'wolf' ? 2 + ((R() * 2) | 0) : 1;
      for (let k = 0; k < pack && n < want; k++) { spawnAnimal(kind, x + k, y); n++; }
    }
  }
}

// one step left or right over uneven ground; false when blocked
function step(a, dir) {
  const w = W();
  const nx = a.x + dir;
  if (nx < 4 || nx > w.w - 5) return false;
  for (const dy of [0, -1, 1, 2, -2, 3]) {
    if (dy < 0 && !PASS[w.t[(a.y + dy) * w.w + a.x]]) continue;
    if (standable(w, nx, a.y + dy)) { a.x = nx; a.y += dy; return true; }
  }
  return false;
}

const lit = (x, y) => {
  // fires, lamps and lit windows keep the wolves away
  const T = G.tribe;
  if (!T) return false;
  for (const b of T.buildings) {
    if ((b.kind === 'camp' || b.kind === 'lamp' || b.kind === 'temple' || b.kind === 'tower') && Math.abs(b.x + (b.w >> 1) - x) < (b.kind === 'lamp' ? 9 : 12) && Math.abs(b.y - y) < 12) return true;
  }
  return false;
};

function nearest(list, x, y, r, pred) {
  let best = null, bd = r;
  for (const q of list) {
    if (!pred(q)) continue;
    const d = Math.abs(q.x - x) + Math.abs(q.y - y) * 0.7;
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

export function killAnimal(a, cause) {
  const F = G.fauna;
  if (!F) return;
  F.list = F.list.filter((q) => q !== a);
  spawnFx({ x: a.x, y: a.y, vy: -0.05, life: 50, glyph: '×', color: [220, 210, 200], up: true });
  emit('animalDeath', a, cause);
}

export function nearestPrey(x, y, r) {
  const F = G.fauna;
  if (!F) return null;
  return nearest(F.list, x, y, r, (q) => q.kind !== 'wolf' && !q.young);
}
export function animalById(id) {
  return G.fauna ? G.fauna.list.find((q) => q.id === id) : null;
}

export function updateFauna() {
  const F = G.fauna, w = W(), T = G.tribe, env = G.env;
  if (!F || !w) return;
  const villagers = T ? T.villagers : [];
  for (const a of [...F.list]) {
    const K = KINDS[a.kind];
    const i = a.y * w.w + a.x;
    const here = w.t[i];
    // the world can kill them
    if (DEADLY[here] || w.c[i] > 0) { killAnimal(a, 'fire'); continue; }
    if (here === E.WATER) {
      if (++a.wet > 240) { killAnimal(a, 'drown'); continue; }
      if (w.t[i - w.w] === E.WATER) a.y--;
    } else a.wet = 0;
    if (!PASS[here] && here !== E.WATER) { if (PASS[w.t[i - w.w]]) a.y--; else { killAnimal(a, 'buried'); continue; } }
    // gravity
    const below = w.t[i + w.w];
    if (!STAND[below] && below !== E.WATER) {
      a.y++; a.fall++;
      if (a.y >= w.h - 3) { killAnimal(a, 'fall'); continue; }
      continue;
    }
    if (a.fall > 12) { killAnimal(a, 'fall'); continue; }
    a.fall = 0;

    if (--a.cool > 0) continue;
    a.cool = a.state === 'flee' || a.state === 'hunt' ? K.run : K.cool;
    if (a.young && R() < 0.0006) a.young = 0;

    // ── wolves hunt at night ──
    if (a.kind === 'wolf') {
      if (env.night && a.fed <= 0) {
        if (a.state !== 'hunt' || R() < 0.05) {
          const prey = nearest(F.list, a.x, a.y, 45, (q) => q.kind !== 'wolf');
          const man = nearest(villagers, a.x, a.y, 30, (v) => !v.inside && !lit(v.x, v.y));
          a.target = man && (!prey || R() < 0.4) ? { v: man.id } : prey ? { a: prey.id } : null;
          if (a.target && a.state !== 'hunt' && R() < 0.5) emit('sfx', 'howl', a.x, a.y);
          a.state = a.target ? 'hunt' : 'wander';
        }
        if (a.state === 'hunt' && a.target) {
          const tg = a.target.v ? villagers.find((v) => v.id === a.target.v) : animalById(a.target.a);
          if (!tg || (a.target.v && (tg.inside || lit(tg.x, tg.y)))) { a.target = null; a.state = 'wander'; continue; }
          const dx = tg.x - a.x;
          if (Math.abs(dx) <= 1 && Math.abs(tg.y - a.y) <= 2) {
            if (a.target.v) emit('wolfAttack', a, tg);
            else { killAnimal(tg, 'wolf'); a.fed = 1; emit('sfx', 'growl', a.x, a.y); }
            a.state = 'flee'; a.timer = 200; a.dir = -Math.sign(dx || 1); a.target = null;
            continue;
          }
          a.dir = Math.sign(dx) || a.dir;
          if (!step(a, a.dir)) step(a, -a.dir);
          continue;
        }
      } else if (!env.night) a.fed = 0;
      // by day (or fed) they keep away from people
      const man = nearest(villagers, a.x, a.y, 16, (v) => !v.inside);
      if (man && a.state !== 'flee') { a.state = 'flee'; a.timer = 120; a.dir = -Math.sign(man.x - a.x || 1); }
    } else {
      // ── prey: run from people, wolves and fire ──
      // hunters creep up: they are only noticed when already close
      const threat = nearest(villagers, a.x, a.y, K.flee, (v) => !v.inside && !(v.then === 'hunt' && Math.abs(v.x - a.x) > 3)) || nearest(F.list, a.x, a.y, K.flee + 4, (q) => q.kind === 'wolf');
      if (threat && a.kind === 'boar' && threat.job !== undefined && Math.abs(threat.x - a.x) <= 1 && (a.cd || 0) < w.tick && R() < 0.25) {
        a.cd = w.tick + 900;
        emit('boarCharge', a, threat);
        a.state = 'flee'; a.timer = 160; a.dir = -Math.sign(threat.x - a.x || 1);
      } else if (threat) {
        if (a.state !== 'flee') emit('sfx', a.kind === 'boar' ? 'grunt' : 'rustle', a.x, a.y);
        a.state = 'flee'; a.timer = 90 + R() * 60; a.dir = -Math.sign(threat.x - a.x || (R() - 0.5));
      }
    }

    // ── moving about ──
    if (a.state === 'flee') {
      a.timer -= a.cool;
      if (!step(a, a.dir)) { a.dir = -a.dir; step(a, a.dir); }
      if (a.timer <= 0) { a.state = 'graze'; a.timer = 80 + R() * 200; }
    } else if (a.state === 'walk' || a.state === 'wander') {
      if (Math.abs(a.tx - a.x) <= 1 || !step(a, Math.sign(a.tx - a.x))) { a.state = 'graze'; a.timer = 100 + R() * 300; }
    } else {
      a.timer -= a.cool;
      if (a.timer <= 0) {
        // wander, keeping roughly to home ground
        const span = a.kind === 'wolf' ? 40 : 24;
        a.tx = Math.max(5, Math.min(w.w - 6, Math.round(a.home + (R() * 2 - 1) * span)));
        if (!KINDS[a.kind].biomes.includes(w.biome[a.tx]) && R() < 0.7) a.tx = a.x + (R() < 0.5 ? -6 : 6);
        a.dir = Math.sign(a.tx - a.x) || a.dir;
        a.state = 'walk';
      }
    }
  }

  // births in spring and summer, slowly, while there is room
  if ((w.tick & 255) === 0 && env.season < 2 && R() < 0.5) {
    const sc = w.w / 400;
    for (const kind of ['rabbit', 'deer', 'boar']) {
      const pop = F.list.filter((q) => q.kind === kind);
      if (pop.length >= 2 && pop.length < KINDS[kind].max * sc && R() < (kind === 'rabbit' ? 0.5 : 0.2)) {
        const p = pop[(R() * pop.length) | 0];
        if (standable(w, p.x, p.y)) spawnAnimal(kind, p.x, p.y, { young: true }).home = p.home;
      }
    }
  }
  // the odd wolf wanders in from the wild when the pack is gone
  if ((w.tick & 4095) === 0 && F.list.filter((q) => q.kind === 'wolf').length < 2 && R() < 0.3) {
    for (let tries = 0; tries < 200; tries++) {
      const x = 6 + ((R() * (w.w - 12)) | 0);
      if (!KINDS.wolf.biomes.includes(w.biome[x]) || (T && Math.abs(x - T.center) < 90)) continue;
      const y = w.surf[x] - 1;
      if (standable(w, x, y)) { spawnAnimal('wolf', x, y); spawnAnimal('wolf', x + 1, y); break; }
    }
  }
}

export function animalName(a) {
  return KINDS[a.kind].n[G.settings.lang === 'fr' ? 'fr' : 'en'];
}

// a little cry floating over an animal
export function animalSay(a, text) {
  floatText(a.x, a.y - 2, text, [230, 220, 210], 50);
}
