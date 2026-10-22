// ─── save.js ── compact localStorage persistence ───────────────────────────
import { G } from './state.js';
import { World } from './world.js';
import { E } from './elements.js';

const KEY = 'genesis.txt/save/v1';
const SKEY = 'genesis.txt/settings/v1';

// run-length encode a byte plane → base64
function rle(arr) {
  const out = [];
  let i = 0;
  const n = arr.length;
  while (i < n) {
    const v = arr[i];
    let run = 1;
    while (i + run < n && arr[i + run] === v && run < 0x3fff) run++;
    out.push(v);
    if (run < 128) out.push(run);
    else out.push(0x80 | (run >> 8), run & 0xff);
    i += run;
  }
  return b64(Uint8Array.from(out));
}
function unrle(str, n) {
  const src = unb64(str);
  const out = new Uint8Array(n);
  let i = 0, o = 0;
  while (i < src.length && o < n) {
    const v = src[i++];
    let run = src[i++];
    if (run & 0x80) run = ((run & 0x7f) << 8) | src[i++];
    out.fill(v, o, Math.min(n, o + run));
    o += run;
  }
  return out;
}
function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function saveGame() {
  const W = G.world, T = G.tribe;
  if (!W || !T || !G.started) return false;
  const lo = new Uint8Array(W.a.length), hi = new Uint8Array(W.a.length);
  for (let i = 0; i < W.a.length; i++) { lo[i] = W.a[i] & 255; hi[i] = W.a[i] >> 8; }
  // keep variants only where they carry meaning
  const vKeep = new Uint8Array(W.v.length);
  for (let i = 0; i < W.v.length; i++) {
    const tt = W.t[i];
    if (tt === E.STRUCT || tt === E.FLOWER || tt === E.FISH || tt === E.BUTTERFLY || tt === E.LEAF) vKeep[i] = W.v[i];
  }
  const data = {
    ver: 1, time: Date.now(), mode: G.mode,
    world: { w: W.w, h: W.h, seed: W.seed, sea: W.sea, volcano: W.volcano, tick: W.tick, biome: b64(W.biome), t: rle(W.t), d: rle(W.d), v: rle(vKeep), lo: rle(lo), hi: rle(hi) },
    env: G.env,
    tribe: { ...T, claimed: [], villagers: T.villagers.map((v) => ({ ...v, ti: -1, state: v.inside ? 'inside' : 'idle', site: null, then: null })) },
    progress: G.progress,
    cam: { x: G.cam.x, y: G.cam.y, zoom: G.cam.zoom },
    logs: G.ui ? G.ui.logs.slice(-40) : [],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function loadGame() {
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  if (!data || data.ver !== 1) return null;
  const s = data.world;
  const W = new World(s.w, s.h, s.seed);
  const n = s.w * s.h;
  W.t.set(unrle(s.t, n));
  W.d.set(unrle(s.d, n));
  const vk = unrle(s.v, n);
  const lo = unrle(s.lo, n), hi = unrle(s.hi, n);
  for (let i = 0; i < n; i++) {
    W.a[i] = lo[i] | (hi[i] << 8);
    W.v[i] = vk[i] || (Math.random() * 256) | 0;
    if (W.t[i] === E.STRUCT) W.v[i] = vk[i];
  }
  W.biome.set(unb64(s.biome));
  W.sea = s.sea;
  W.volcano = s.volcano;
  W.tick = s.tick || 0;
  W.computeSurface();
  const T = data.tribe;
  T.claimed = new Set();
  return { W, env: data.env, tribe: T, progress: data.progress, cam: data.cam, logs: data.logs || [], mode: data.mode, time: data.time };
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}

export function saveSettings() {
  try { localStorage.setItem(SKEY, JSON.stringify(G.settings)); } catch (e) { /* ignore */ }
}
export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SKEY));
    if (s) Object.assign(G.settings, s);
  } catch (e) { /* ignore */ }
}
