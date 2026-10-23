// ─── lives.js ── couples, families, graves and memory ──────────────────────
import { G, emit, on } from './state.js';
import { E, MAT, STAND } from './elements.js';
import { gi } from './glyphs.js';
import { pick } from './util.js';
import { say, walkTo, BUILDINGS } from './life.js';
import { putCell, wakeAt } from './sim.js';
import { floatText } from './fx.js';
import { hairOf } from './sprites.js';

const fr = () => G.settings.lang === 'fr';
const L = (a, b) => (fr() ? a : b);
const R = Math.random;
const T = () => G.tribe;
const byId = (id) => T().villagers.find((v) => v.id === id);
export const deed = (v, k, n = 1) => { if (!v) return; (v.deeds || (v.deeds = {}))[k] = (v.deeds[k] || 0) + n; };

// ── couples ────────────────────────────────────────────────────────────────
function pairUp() {
  const singles = T().villagers.filter((v) => !v.kid && !v.partner && v.age >= 1 && !v.inside);
  if (singles.length < 2 || R() > 0.35) return;
  const a = pick(singles);
  // they meet someone close by
  const near = singles.filter((q) => q !== a && Math.abs(q.x - a.x) < 40).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x));
  const b = near[0];
  if (!b) return;
  a.partner = b.id; b.partner = a.id;
  for (const v of [a, b]) floatText(v.x, v.y - 2, '♥', [255, 120, 170], 120);
  emit('couple', a, b);
}

// ── graves ─────────────────────────────────────────────────────────────────
// the dead rest in a little cemetery beside the village
function graveSpot() {
  const W = G.world, Tr = T();
  if (Tr.cemetery === undefined) {
    let best = null;
    for (const side of [1, -1]) {
      for (let d = 22; d < 60; d++) {
        const x = Math.round(Tr.center + side * d);
        if (x < 6 || x > W.w - 7) break;
        if (Tr.buildings.some((b) => x >= b.x - 3 && x <= b.x + b.w + 3)) continue;
        const g = W.t[W.surf[x] * W.w + x];
        if (g === E.GRASS || g === E.DIRT || g === E.SAND || g === E.SNOW) { best = x; break; }
      }
      if (best !== null) break;
    }
    Tr.cemetery = best ?? Math.round(Tr.center + 24);
  }
  for (let k = 0; k < 40; k++) {
    const x = Tr.cemetery + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2;
    if (x < 4 || x > W.w - 5) continue;
    if ((Tr.graves || []).some((g) => g.x === x)) continue;
    if (Tr.buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w)) continue;
    const y = W.surf[x] - 1;
    const i = y * W.w + x;
    if (W.t[i] !== E.EMPTY && W.t[i] !== E.PLANT && W.t[i] !== E.FLOWER) continue;
    if (!STAND[W.t[i + W.w]] || W.t[i + W.w] === E.STRUCT) continue;
    return { x, y, i };
  }
  return null;
}

on('death', (v, cause) => {
  const Tr = T();
  if (!Tr || !G.world) return;
  const spot = graveSpot();
  const grave = { name: v.name, day: G.env.day, cause, color: v.color, age: v.age, x: spot ? spot.x : -1, y: spot ? spot.y : -1, partner: null, tree: false };
  if (spot) {
    putCell(spot.i, E.STRUCT, gi('†'), 0);
    G.world.v[spot.i] = MAT.STONE;
    wakeAt(spot.i);
  }
  // the ones who loved them
  const p = v.partner && byId(v.partner);
  if (p) { p.partner = 0; p.lost = v.name; p.mournT = 3; grave.partner = p.name; deed(p, 'widowed'); emit('widowed', p, v); }
  for (const q of Tr.villagers) {
    if (q.parents && q.parents.includes(v.id)) { (q.lostParents || (q.lostParents = [])).push(v.name); q.mournT = Math.max(q.mournT || 0, 2); }
    if (v.parents && v.parents.includes(q.id)) { q.lost = v.name; q.mournT = 3; }
  }
  (Tr.graves || (Tr.graves = [])).push(grave);
});

// ── births: parents and family likeness ───────────────────────────────────
on('birth', (kid) => {
  const Tr = T();
  const adults = Tr.villagers.filter((v) => !v.kid && v !== kid);
  const couples = adults.filter((v) => v.partner && byId(v.partner));
  let a = pick(couples), b = a && byId(a.partner);
  if (!a) { a = pick(adults); b = pick(adults.filter((q) => q !== a)); }
  if (!a) return;
  kid.parents = [a.id, b ? b.id : 0];
  kid.hair = hairOf(R() < 0.5 || !b ? a : b);
  kid.skin = (R() < 0.5 || !b ? a : b).skin;
  deed(a, 'children'); if (b) deed(b, 'children');
  emit('family', kid, a, b);
});

// ── everyday life ──────────────────────────────────────────────────────────
export function updateLives() {
  const Tr = T(), W = G.world, env = G.env;
  if (!Tr || !Tr.villagers.length) return;
  if ((W.tick % 600) === 17) pairUp();
  if ((W.tick % 40) !== 5) return;
  for (const v of Tr.villagers) {
    if (v.inside || v.state === 'work' || v.state === 'flee' || v.sayT > 0) continue;
    if (v.state !== 'idle' && !(v.state === 'walk' && v.then === 'rest')) continue;
    // children stay close to a parent
    if (v.kid && v.parents) {
      // (but not down into the mines)
      const p = v.parents.map(byId).find((q) => q && !q.inside && q.y <= W.surf[q.x] + 1);
      if (p && Math.abs(p.x - v.x) > 3) { walkTo(v, p.x + (R() < 0.5 ? -1 : 1), p.y, 'rest', 1); continue; }
    }
    // the bereaved visit the graves
    const graves = (Tr.graves || []).filter((g) => g.x >= 0);
    if (graves.length && !env.night && R() < (v.mournT > 0 ? 0.12 : 0.012)) {
      const g = graves.find((q) => q.name === v.lost) || (v.lostParents && graves.find((q) => v.lostParents.includes(q.name))) || pick(graves);
      walkTo(v, g.x + (R() < 0.5 ? -1 : 1), g.y, 'mourn', 1);
      v.mourning = g.name;
      continue;
    }
    // couples spend their free time together
    const p = v.partner && byId(v.partner);
    if (p && !p.inside && Math.abs(p.x - v.x) > 2 && Math.abs(p.x - v.x) < 40 && R() < 0.25) walkTo(v, p.x + (p.x > v.x ? -1 : 1), p.y, 'rest', 1);
  }
}

// called by life.js when a mourner reaches the grave
export function mournAt(v) {
  const name = v.mourning || v.lost || '';
  if (v.mournT > 0) v.mournT--;
  deed(v, 'visits');
  say(v, pick(L([`${name}…`, `je pense à toi, ${name}`, `${name}, tu nous manques`, '…'], [`${name}…`, `thinking of you, ${name}`, `we miss you, ${name}`, '…'])), 160);
  // in the good seasons they leave flowers
  const W = G.world, env = G.env;
  if (env.season < 2 && R() < 0.6) {
    for (const dx of [1, -1, 2, -2]) {
      const x = v.x + dx, y = v.y;
      const i = y * W.w + x;
      if (W.t[i] === E.EMPTY && STAND[W.t[i + W.w]] && W.t[i + W.w] !== E.STRUCT) { putCell(i, E.FLOWER); emit('placed', E.FLOWER, 1, x, y); break; }
    }
  }
}

// ── the record of a life, for the interface ───────────────────────────────
export function biography(v) {
  const Tr = T();
  const nm = (id) => { const q = byId(id); return q ? q.name : null; };
  const lines = [];
  if (v.partner && nm(v.partner)) lines.push(['♥', L(`en couple avec ${nm(v.partner)}`, `partner of ${nm(v.partner)}`)]);
  if (v.lost) lines.push(['†', L(`a perdu ${v.lost}`, `lost ${v.lost}`)]);
  if (v.parents) {
    const ps = v.parents.map((id) => nm(id)).filter(Boolean);
    if (ps.length) lines.push(['⌂', L(`enfant de ${ps.join(' et ')}`, `child of ${ps.join(' and ')}`)]);
    else lines.push(['⌂', L('orphelin·e', 'orphaned')]);
  }
  const kids = Tr.villagers.filter((q) => q.parents && q.parents.includes(v.id)).map((q) => q.name);
  if (kids.length) lines.push(['✿', L(`parent de ${kids.join(', ')}`, `parent of ${kids.join(', ')}`)]);
  const d = v.deeds || {};
  const bits = [];
  if (d.wood) bits.push(L(`${d.wood} arbres abattus`, `${d.wood} trees felled`));
  if (d.stone) bits.push(L(`${d.stone} blocs minés`, `${d.stone} blocks mined`));
  if (d.built) bits.push(L(`${d.built} bâtiments`, `${d.built} buildings`));
  if (d.hunt) bits.push(L(`${d.hunt} chasses`, `${d.hunt} hunts`));
  if (d.fish) bits.push(L(`${d.fish} poissons`, `${d.fish} fish`));
  if (d.pray) bits.push(L(`${d.pray} prières`, `${d.pray} prayers`));
  if (d.wolf) bits.push(L(`a survécu aux loups`, `survived the wolves`));
  if (bits.length) lines.push(['✦', bits.join(' · ')]);
  return lines;
}
