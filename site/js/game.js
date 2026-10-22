// ─── game.js ── session lifecycle, event wiring, overlays, finale ──────────
import { G, on, emit } from './state.js';
import { E, MAT } from './elements.js';
import { gi, CHARSET } from './glyphs.js';
import { t, tr } from './i18n.js';
import { generate } from './worldgen.js';
import { bindWorld, putCell } from './sim.js';
import { createEnv, SEASONS, DAY } from './weather.js';
import { createTribe, findSpawnSite, foundTribe, kill, say, ERAS, BUILDINGS } from './life.js';
import { createProgress, DISCOVERIES, spend, LAUNCH_COST, isSandbox, TOOL } from './progress.js';
import { setFxPut, spawnFx, floatText } from './fx.js';
import { overlayGlyph, overlayText, tintCell } from './compose.js';
import { loadGame, saveGame, clearSave, saveSettings } from './save.js';
import { toast, logLine, banner, hint, UI, refreshTools, togglePanel } from './ui.js';
import { IN } from './input.js';
import { fmt } from './util.js';

// ── new / load ─────────────────────────────────────────────────────────────
export function newGame(mode, onProgress) {
  G.mode = mode;
  createEnv();
  G.generating = true;
  const seed = (Math.random() * 1e9) | 0;
  const W = generate(seed, onProgress);
  G.generating = false;
  G.world = W;
  bindWorld(W);
  setFxPut(putCell);
  createTribe();
  createProgress();
  if (mode === 'sandbox') G.progress.faith = 0;
  const x = findSpawnSite();
  foundTribe(x);
  G.cam.zoom = window.innerWidth < 760 ? 0.9 : 1.3;
  G.cam.x = x - window.innerWidth / (10 * G.cam.zoom) / 2;
  G.cam.y = W.surf[x] - window.innerHeight / (16 * G.cam.zoom) * 0.62;
  G.view.camY0 = W.sea - 38;
  G.fx = [];
  G.newWorld = true;
  return W;
}

export function resumeGame() {
  const s = loadGame();
  if (!s) return false;
  G.mode = s.mode || 'genesis';
  G.world = s.W;
  bindWorld(s.W);
  setFxPut(putCell);
  createEnv();
  Object.assign(G.env, s.env);
  G.tribe = s.tribe;
  G.progress = s.progress;
  G.progress.stats = Object.assign({ placed: {}, cells: 0, explosions: 0, strikes: 0, miracles: 0 }, G.progress.stats);
  G.cam.x = s.cam.x; G.cam.y = s.cam.y; G.cam.zoom = s.cam.zoom;
  G.view.camY0 = s.W.sea - 38;
  G.fx = [];
  UI.logs = s.logs;
  // offline prayers
  const away = Math.min(8 * 3600, (Date.now() - s.time) / 1000);
  if (away > 60 && !isSandbox() && G.tribe.villagers.length) {
    const gain = Math.floor(G.tribe.faithRate * away * 0.5);
    if (gain > 0) {
      G.progress.faith += gain;
      G.progress.totalFaith += gain;
      const hh = Math.floor(away / 3600), mm = Math.floor((away % 3600) / 60);
      G.awayMsg = [t('welcomeBack') + ` (${hh}h${String(mm).padStart(2, '0')})`, `${t('prayed')} : +${fmt(gain)} ◊`];
    }
  }
  return true;
}

// ── event wiring ───────────────────────────────────────────────────────────
const sfx = (n, x, y) => G.audio && G.audio.sfx(n, x, y);
const hintsSeen = new Set();
function hintOnce(key, text, ms = 9000) {
  if (hintsSeen.has(key) || !G.settings.hints) return;
  hintsSeen.add(key);
  hint(text);
  setTimeout(() => hint(''), ms);
}
const fr = () => G.settings.lang === 'fr';

export function wireEvents() {
  on('sfx', (n, x, y) => sfx(n, x, y));
  on('discovered', (key, d) => {
    toast('discovery', '✦ ' + t('discovery') + ' ✦', tr(d.n).toUpperCase(), tr(d.d), isSandbox() || !d.r ? '' : `+${d.r} ◊`);
    sfx('discover');
    logLine('✦ ' + tr(d.n), true, '#ff6ad5');
    refreshTools();
  });
  on('achieved', (a) => {
    toast('achieve', '★ ' + t('achievement') + ' ★', tr(a.n).toUpperCase(), tr(a.d), isSandbox() || !a.r ? '' : `+${a.r} ◊`);
    sfx('achieve');
    logLine('★ ' + tr(a.n), true, '#ffcf5a');
  });
  on('quest', (q) => {
    toast('quest', t('questDone'), '✓ ' + tr(q.n), '', isSandbox() || !q.r ? '' : `+${q.r} ◊`);
    sfx('quest');
  });
  on('unlock', () => refreshTools());
  on('broke', () => { toast('warn', '', t('notEnough')); sfx('broke'); });
  on('birth', (v) => { logLine('♥ ' + t('logBirth', v.name), false, '#ff9ac0'); sfx('birth', v.x, v.y); emit('discover', 'birth'); });
  on('death', (v, cause) => {
    logLine('† ' + t('logDeath', v.name, t('cause_' + cause)), true, '#b8bccc');
    sfx('death', v.x, v.y);
    if (!G.tribe.villagers.length) { logLine(t('logExtinct'), true, '#ff6a5a'); toast('warn', '', t('logExtinct')); }
  });
  on('built', (b) => {
    if (b.kind === 'camp') return;
    logLine('⌂ ' + t('logBuilt', t('b_' + b.kind)), b.kind === 'temple' || b.kind === 'rocket', '#ffd27a');
    sfx('built', b.x, b.y);
    if (b.kind === 'tent' || b.kind === 'hut') emit('discover', 'shelter');
    if (b.kind === 'temple') emit('discover', 'temple');
    if (b.kind === 'farm') emit('discover', 'harvest');
    if (b.kind === 'rocket') { toast('achieve', t('b_rocket'), t('launch'), t('launchSub')); sfx('achieve'); }
    for (let k = 0; k < 10; k++) spawnFx({ x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h, vy: -0.05 - Math.random() * 0.05, life: 50, glyph: '✦', color: [255, 220, 150], glow: 0.8 });
  });
  on('upgrade', (from, to) => logLine('⌂ ' + (fr() ? `La tribu remplace ${t('b_' + from)} par ${t('b_' + to)}.` : `The tribe replaces ${t('b_' + from)} with ${t('b_' + to)}.`), false, '#ffd27a'));
  on('collapse', (b) => { if (b.kind !== 'farm' && b.kind !== 'lamp') logLine('⌂ ' + t('logCollapse', t('b_' + b.kind)), true, '#ff8a6a'); });
  on('hunger', (n) => { if (n === 1 || n === 3) { logLine(t('logHunger'), true, '#ff8a6a'); hintOnce('hunger', fr() ? 'La tribu a faim : sème des fleurs, crée de l\'eau pour les poissons, ou utilise le miracle ABONDANCE.' : 'The tribe is hungry: sow flowers, add water for fish, or use the ABUNDANCE miracle.'); } });
  on('gold', (v) => { logLine('$ ' + t('logGold', v.name), false, '#ffd84a'); emit('discover', 'gold'); });
  on('era', (e) => {
    const name = t('era' + e);
    banner(`${t('eraWord')} ${['0', 'I', 'II', 'III', 'IV', 'V'][e]}`, name, fr() ? 'une nouvelle ère commence' : 'a new era begins');
    logLine('✦ ' + t('logEra', name), true, '#6ff2ff');
    sfx('era');
    G.flash = 0.8; G.flashColor = [1, 0.85, 0.5]; G.glitch = 0.6;
    for (const v of G.tribe.villagers) say(v, '✦', 160);
    refreshTools();
  });
  on('weather', (w) => {
    const word = G.env.temp < 0 && (w === 'rain' || w === 'storm') ? t('snow') : t(w);
    logLine('~ ' + t('logWeather', word), false, '#8ab8ff');
  });
  on('newDay', (day) => {
    const env = G.env;
    if (day % 3 === 0) {
      logLine('❀ ' + t('logSeason', t(SEASONS[env.season])), true, '#a8ff9a');
      toast('info', `${t('year')} ${env.year}`, t(SEASONS[env.season]), '');
      if (env.season === 3) hintOnce('winter', fr() ? 'L\'hiver : l\'eau gèle et rien ne pousse. Prévois de la nourriture !' : 'Winter: water freezes and nothing grows. Stock up on food!');
    }
    for (const v of [...G.tribe.villagers]) {
      v.age++;
      if (v.kid && v.age >= 1) { v.kid = false; say(v, '!', 100); }
      if (v.age > 14 && Math.random() < (v.age - 14) * 0.12) kill(v, 'old');
    }
  });
  on('explosion', (x, y, r) => {
    G.shake = Math.max(G.shake, Math.min(2.5, r * 0.22));
    G.flash = Math.max(G.flash, Math.min(0.5, r * 0.04));
    G.flashColor = [1, 0.75, 0.45];
    if (G.world.tick - (G.lastBoom || -99) > 40) G.progress.stats.explosions++;
    G.lastBoom = G.world.tick;
    sfx('explosion', x, y);
    killNear(x, y, r * 1.1, 'boom');
  });
  on('impact', (x, y, r) => { G.shake = 3; G.flash = 0.6; G.flashColor = [1, 0.7, 0.4]; killNear(x, y, r * 1.3, 'meteor'); });
  on('lightning', (x, y) => { G.flash = Math.max(G.flash, 0.55); G.flashColor = [0.75, 0.85, 1]; G.shake = Math.max(G.shake, 0.6); sfx('thunder', x, y); });
  on('zap', (x, y) => sfx('zap', x, y));
  on('meteorIncoming', (x) => sfx('meteor', x, 10));
  on('meteorShower', () => logLine('✦ ' + t('logMeteor'), true, '#ffcf5a'));
  on('eruption', (x, y) => { logLine('▲ ' + t('logEruption'), true, '#ff7a3a'); sfx('eruption', x, y); });
  on('migration', () => logLine('v ' + t('logMigration'), false, '#b0b8d0'));
  on('rainbow', () => logLine('◠ ' + t('logRainbow'), false, '#ffcf5a'));
  on('quake', () => { G.shake = 2; sfx('eruption'); });
  on('miracle', () => {});
  on('placed', (el, n, x, y) => { sfx('place', x, y); if (el === E.LAVA) hintOnce('lava', fr() ? 'Astuce : verse de l\'eau sur la lave pour créer de l\'OBSIDIENNE.' : 'Tip: pour water on lava to create OBSIDIAN.'); });
  on('sparked', (x, y) => { sfx('birth', x, y); });
  on('follow', (v) => { toast('info', t('follow'), v.name, `${v.kid ? t('kid') : t('job_' + v.job)} · ${t('age')} ${v.age}`); sfx('select'); });
  on('settings', () => { saveSettings(); if (G.audio) G.audio.applyVolume(); });
  on('action', (a) => {
    if (a === 'export') exportTxt();
    else if (a === 'photo') photo();
    else if (a === 'new') { if (confirm(t('confirmNew'))) { clearSave(); G.noSave = true; location.reload(); } }
    else if (a === 'reset') { if (confirm(t('confirmReset'))) { clearSave(); G.noSave = true; location.reload(); } }
    else if (a === 'launch') launch();
  });
  on('userInput', () => { G.idleT = 0; });
}

function killNear(x, y, r, cause) {
  for (const v of [...G.tribe.villagers]) {
    if (v.inside) continue;
    const d = Math.hypot(v.x - x, (v.y - y) * 1.6);
    if (d < r) kill(v, cause);
  }
}

// contextual hints over time
let hintClock = 0;
export function updateHints(dt) {
  hintClock += dt;
  const T = G.tribe, P = G.progress;
  if (!T || !P) return;
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (hintClock > 1.5) hintOnce('start', touch
    ? (fr() ? 'UN DOIGT : créer  ·  DEUX DOIGTS : déplacer & zoomer' : 'ONE FINGER: create  ·  TWO FINGERS: move & zoom')
    : (fr() ? 'CLIC GAUCHE : créer  ·  CLIC DROIT : déplacer la vue  ·  MOLETTE : zoom' : 'LEFT CLICK: create  ·  RIGHT CLICK: move the view  ·  WHEEL: zoom'), 10000);
  if (hintClock > 25 && T.wood < 3 && G.world.counts[E.WOOD] < 300) hintOnce('trees', fr() ? 'Ta tribu a besoin de bois : plante des ARBRES près du village (catégorie VIE).' : 'Your tribe needs wood: plant TREES near the village (LIFE category).');
  if (!isSandbox() && P.faith >= 15 && hintClock > 20) hintOnce('faith', fr() ? 'La FOI ◊ vient des prières de ta tribu. Les pouvoirs bordés de bleu sont déblocables.' : 'FAITH ◊ comes from your tribe\'s prayers. Powers outlined in blue can be unlocked.');
  if (G.env.night && hintClock > 10) hintOnce('night', fr() ? 'La nuit tombe : la tribu rentre dormir. Les lucioles sortent…' : 'Night falls: the tribe goes to sleep. Fireflies come out…');
  if (T.era === 0 && T.villagers.length >= 4) hintOnce('reveal', fr() ? 'Une RÉVÉLATION est possible : elle fera entrer ta tribu dans une nouvelle ère.' : 'A REVELATION is possible: it will bring your tribe into a new era.');
}

// ── overlays drawn on top of the world each frame ─────────────────────────
const CARRY = { wood: ['≡', [190, 140, 80]], food: ['♣', [140, 230, 120]], stone: ['▪', [190, 190, 200]], metal: ['◆', [140, 230, 255]] };
const G_SMILE = gi('☺'), G_KID = gi('o'), G_Z = gi('z'), G_MARK = gi('▼'), G_PRAY = gi('☻');

export function drawOverlays(view, time) {
  const W = G.world, T = G.tribe;
  const R = G.renderer;
  const { fg, bg, em } = R;
  const cols = R.cols;
  // particles
  for (const p of G.fx) {
    const fade = Math.min(1, p.life / Math.min(40, p.max));
    const c = p.color || [255, 255, 255];
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.text) overlayText(view, x, y, p.text, c[0] * fade, c[1] * fade, c[2] * fade, p.glow || 0.2);
    else overlayGlyph(view, x, y, gi(p.glyph), c[0] * fade, c[1] * fade, c[2] * fade, p.glow || 0);
  }
  // villagers
  for (const v of T.villagers) {
    if (v.inside) continue;
    const vx = v.x - view.ox, vy = v.y - view.oy;
    if (vx < 0 || vy < 0 || vx >= cols || vy >= R.rows) continue;
    const o = (vy * cols + vx) * 4;
    const praying = v.state === 'work' && v.action === 'pray';
    const sleeping = v.state === 'work' && v.action === 'sleep';
    fg[o] = v.color[0]; fg[o + 1] = v.color[1]; fg[o + 2] = v.color[2];
    fg[o + 3] = sleeping ? G_Z : v.kid ? G_KID : praying && Math.floor(time * 2) % 2 ? G_PRAY : G_SMILE;
    bg[o + 3] = (bg[o + 3] & 15) | (9 << 4);
    if (T.era >= 3 && G.env.night) { em[o] = Math.min(255, em[o] + 120); em[o + 1] = Math.min(255, em[o + 1] + 90); em[o + 2] = Math.min(255, em[o + 2] + 40); }
    if (v.carry) {
      const [g, c] = CARRY[v.carry];
      const tt = W.t[(v.y - 1) * W.w + v.x];
      if (tt === E.EMPTY || tt === E.STRUCT || tt === E.LEAF) overlayGlyph(view, v.x, v.y - 1, gi(g), c[0], c[1], c[2], 0, true, 0x9f);
    }
    if (v.sayT > 0 && v.say) {
      const f = Math.min(1, v.sayT / 30);
      overlayText(view, v.x, v.y - 2, v.say, 240 * f, 240 * f, 255 * f, 0.15);
    }
    if (G.cam.follow === v.id) {
      const b = 0.6 + 0.4 * Math.sin(time * 6);
      overlayGlyph(view, v.x, v.y - (v.sayT > 0 ? 3 : 2), G_MARK, 255 * b, 207 * b, 90 * b, 0.6, true, 0xff);
    }
  }
  // rocket in flight
  if (G.rocket) drawRocket(view, time);
  // brush cursor
  if (IN.inside && IN.sx >= 0 && !IN.panning && G.started) {
    const tl = TOOL[UI.tool];
    const cx = Math.floor(IN.wx), cy = Math.floor(IN.wy);
    if (tl.special === 'eye' || tl.miracle) {
      overlayGlyph(view, cx, cy, gi('┼'), 255, 230, 180, 0.3, true, null);
    } else {
      const r = ['spark', 'tree', 'bolt', 'meteor', 'volcano'].includes(tl.special) ? 0 : UI.brush;
      const ry = Math.max(0.5, r / 1.6);
      const col = hexRGB(tl.c);
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const dx = (x - cx) / (r + 0.5), dy = (y - cy) / (ry + 0.5);
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          tintCell(view, x, y, col[0], col[1], col[2], d > 0.55 || r === 0 ? 0.32 : 0.12);
        }
      }
    }
  }
}

function hexRGB(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── launch & ending ───────────────────────────────────────────────────────
function launch() {
  const T = G.tribe, W = G.world;
  const b = T.buildings.find((q) => q.kind === 'rocket');
  if (!b || T.launched) return;
  if (!spend(LAUNCH_COST)) { emit('broke'); return; }
  const cells = [];
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * W.w + x;
      if (W.t[i] === E.STRUCT && W.a[i] === b.id) {
        cells.push({ dx: x - b.x, dy: y - b.y, g: W.d[i], m: W.v[i] });
        W.t[i] = E.EMPTY; W.a[i] = 0;
      }
    }
  }
  T.buildings = T.buildings.filter((q) => q !== b);
  T.launched = true;
  G.rocket = { x: b.x, y: b.y, w: b.w, h: b.h, cells, t: 0, oy: 0, vy: 0 };
  G.cam.follow = null;
  togglePanel(null);
  sfx('launch');
  logLine('▲ ' + (fr() ? 'COMPTE À REBOURS…' : 'COUNTDOWN…'), true, '#ffcf5a');
}

export function updateRocket() {
  const r = G.rocket;
  if (!r) return;
  r.t++;
  const W = G.world;
  const baseX = r.x + r.w / 2, baseY = r.y + r.h + r.oy;
  if (r.t < 240) {
    G.shake = Math.max(G.shake, r.t / 240);
    const n = 3 - Math.floor(r.t / 60);
    if (r.t % 60 === 0 && n > 0) floatText(baseX, r.y - 3, String(n), [255, 230, 150], 55);
    if (Math.random() < 0.6) spawnFx({ x: baseX + (Math.random() - 0.5) * 6, y: baseY, vx: (Math.random() - 0.5) * 0.8, vy: -0.05, life: 100, glyph: '░', color: [180, 180, 190], drag: 0.97 });
  } else {
    r.vy += 0.0035;
    r.oy -= r.vy;
    G.shake = Math.max(G.shake, 1.2);
    for (let k = 0; k < 3; k++) spawnFx({ x: baseX + (Math.random() - 0.5) * 3, y: baseY, vx: (Math.random() - 0.5) * 0.5, vy: 0.4 + Math.random() * 0.5, life: 40, glyph: ['▓', '▒', '░', '*'][(Math.random() * 4) | 0], color: [255, 160 + Math.random() * 80, 60], glow: 1, drag: 0.96 });
    if (r.t % 30 === 0) emit('discover', 'launch');
    // camera rides along
    if (G.view) G.cam.y = Math.min(G.cam.y, r.y + r.oy - G.view.visR * 0.35);
    if (r.y + r.oy + r.h < -4) {
      G.rocket = null;
      G.flash = 1; G.flashColor = [1, 1, 1];
      const T = G.tribe;
      setTimeout(() => banner('✦ ' + t('discovery') + ' ✦', t('ending1'), `${t('ending2')}<br><br><span class="dim">${t('day')} ${G.env.day + 1} · ${t('pop')} max ${T.maxPop} · ♥ ${T.births} · ${Object.keys(G.progress.found).length} ${t('discoveries').toLowerCase()}</span>`, t('ending3'), () => {}), 600);
      sfx('achieve');
    }
  }
  if (W) return;
}

function drawRocket(view, time) {
  const r = G.rocket;
  const oy = Math.round(r.oy);
  for (const c of r.cells) {
    let col = [236, 240, 248];
    if (c.m === MAT.WINDOW) col = [140, 220, 255];
    else if (c.m === MAT.NEON) col = [255, 80, 200];
    else if (c.m === MAT.DARK) col = [90, 90, 110];
    overlayGlyph(view, r.x + c.dx, r.y + c.dy + oy, c.g, col[0], col[1], col[2], c.m === MAT.NEON ? 0.6 : 0.1, false, 0xff);
  }
}

// ── export ────────────────────────────────────────────────────────────────
function exportTxt() {
  const R = G.renderer;
  let s = '';
  for (let y = 0; y < R.rows - 1; y++) {
    let line = '';
    for (let x = 0; x < R.cols - 1; x++) line += CHARSET[R.fg[(y * R.cols + x) * 4 + 3]] || ' ';
    s += line.replace(/\s+$/, '') + '\n';
  }
  s = `GENESIS.TXT — ${t('day')} ${G.env.day + 1}\n\n` + s;
  try { navigator.clipboard.writeText(s); toast('info', '', t('copied')); } catch (e) { /* ignore */ }
  download(new Blob([s], { type: 'text/plain;charset=utf-8' }), `genesis-day${G.env.day + 1}.txt`);
}
function photo() {
  const cv = document.getElementById('gl');
  cv.toBlob((b) => b && download(b, `genesis-day${G.env.day + 1}.png`));
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function autosave() {
  if (G.noSave) return;
  saveGame();
}
