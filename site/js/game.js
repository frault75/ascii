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
import { toast, logLine, banner, hint, UI, refreshTools, togglePanel, showTransmission } from './ui.js';
import { welcomeBack } from './voices.js';
import { IN } from './input.js';
import { fmt } from './util.js';
import { F, ANCHOR, HEAD, EXPR, PROP, PROP_PAL, PIV_BODY, PIV_HEAD, PIV_PROP, lookOf } from './sprites.js';

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
  G.cam.zoom = window.innerWidth < 760 ? 1.25 : 1.6;
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
      if (away > 1800) welcomeBack(away / 3600);
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
    else if (a === 'new' || a === 'reset') {
      // two-step confirmation inside the page (no native dialogs)
      if (G.armed === a && performance.now() - G.armedAt < 4000) { clearSave(); G.noSave = true; location.reload(); }
      else { G.armed = a; G.armedAt = performance.now(); toast('warn', '', t(a === 'new' ? 'confirmNew' : 'confirmReset'), fr() ? 'clique encore pour confirmer' : 'click again to confirm'); }
    }
    else if (a === 'launch') launch();
  });
  on('userInput', () => { G.idleT = 0; });
  on('voice', (v) => { if (G.audio && G.audio.ready) G.audio.voice(v, v.x, v.y); });
  on('transmission', (m) => { showTransmission(m); logLine('◉ ' + m.v.name + ' : « ' + (m.gloss || m.text) + ' »', true, `rgb(${m.v.color})`); });
  on('requestDone', (a, reward) => { toast('quest', fr() ? 'DEMANDE EXAUCÉE' : 'REQUEST FULFILLED', a.name.toUpperCase(), fr() ? 'la tribu te remercie' : 'the tribe thanks you', isSandbox() ? '' : `+${reward} ◊`); sfx('achieve'); logLine('✓ ' + (fr() ? `Tu as exaucé la demande de ${a.name}.` : `You granted ${a.name}'s request.`), true, '#8dff9a'); });
  on('requestFailed', (a) => logLine('✗ ' + (fr() ? `${a.name} a attendu en vain.` : `${a.name} waited in vain.`), true, '#ff8a6a'));
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
const GL = { mark: gi('▼') };

// ── villagers as little drawn people ───────────────────────────────────────
const RS = new Map(); // id → smoothed position, walk phase, cached look
let lastDraw = 0;
const pick = (list, t) => list[((Math.floor(t) % list.length) + list.length) % list.length];

function drawVillager(v, view, time, dt, W, hovered, followed) {
  const R = G.renderer;
  const T = G.tribe;
  let s = RS.get(v.id);
  const tx = v.x + 0.5, ty = v.y + 1;
  if (!s) { s = { x: tx, y: ty, ph: (v.id * 1.7) % 6, lx: v.x, ly: v.y, mt: 0, look: null, key: '' }; RS.set(v.id, s); }
  if (Math.abs(tx - s.x) > 3 || Math.abs(ty - s.y) > 3) { s.x = tx; s.y = ty; }
  const k = 1 - Math.exp(-dt * 16);
  const px0 = s.x;
  s.x += (tx - s.x) * k;
  s.y += (ty - s.y) * k;
  if (v.x !== s.lx || v.y !== s.ly) { s.mt = 0.3; s.lx = v.x; s.ly = v.y; }
  s.mt -= dt;
  s.ph += Math.abs(s.x - px0) * 3;
  const key = T.era + (v.age >= 10 ? 'o' : '') + (v.kid ? 'k' : '') + v.color;
  if (s.key !== key) { s.look = lookOf(v, T.era); s.key = key; }
  const look = s.look;

  const u = (view.cellW / 10) * (v.kid ? 0.7 : 1.15);
  let px = (s.x - view.ox) * view.cellW - view.offX;
  let py = (s.y - view.oy) * view.cellH - view.offY;
  if (px < -40 * u || px > R.W + 40 * u || py < -10 * u || py > R.H + 50 * u) return;

  const here = W.t[v.y * W.w + v.x];
  const swimming = here === E.WATER || here === E.OIL || here === E.FISH;
  const work = v.state === 'work' ? v.action : null;
  const elder = v.age >= 10 && !v.kid;
  const talking = v.sayT > 0 && v.say;
  const calling = G.voices && G.voices.shown && G.voices.shown.v === v;
  const sw = time * 6 + v.id * 0.37;
  const dir = v.dir < 0 ? -1 : 1;
  let body, rot = 0;
  if (swimming) {
    body = pick(F.swim, time * 3 + v.id);
    py = (s.y - 1 - view.oy) * view.cellH - view.offY + (13.8 + Math.sin(time * 3 + v.id) * 0.5) * u + view.cellH * 0.15;
  } else if (v.fall > 1) body = F.fall[0];
  else if (v.climb > 0) body = pick(F.climb, s.y * 2.5);
  else if (work === 'sleep') {
    body = F.lie[0];
    rot = (-Math.PI / 2) * dir;
    px += 13 * u * dir;
    py -= 4.3 * u;
  } else if (work === 'chop') body = pick(F.axe, sw);
  else if (work === 'mine') body = pick(F.pick, sw);
  else if (work === 'build') body = pick(F.hammer, sw);
  else if (work === 'pray') body = pick(F.pray, time * 1.2 + v.id);
  else if (work === 'fish') body = pick(F.fish, time * 0.8 + v.id);
  else if (work === 'gather' || work === 'forage') body = pick(F.gather, time * 2.4 + v.id);
  else if (work === 'rest') body = F.sit[0];
  else if (s.mt > 0 || v.state === 'flee') body = pick(v.state === 'flee' ? F.run : v.carry ? F.carry : elder ? F.elder : F.walk, s.ph);
  else if (v.carry) body = F.carryIdle[0];
  else if (calling || v === hovered) body = pick(F.wave, time * 4 + v.id);
  else if (talking) body = pick(F.talk, time * 2.5 + v.id);
  else if (elder) body = F.elderIdle[0];
  else body = pick(F.idle, time * 0.8 + v.id * 0.5);

  const an = ANCHOR[body];
  const front = an.view === 'front';
  const blink = (time * 0.9 + v.id * 1.7) % 4.2 < 0.13;
  const mouth = (talking || calling) && Math.floor(time * 8 + v.id) % 2 === 0;
  const shut = work === 'sleep' || work === 'pray' || blink;
  const ex = (front ? 3 : 0) + (shut ? 2 : mouth ? 1 : 0);
  const floor = followed || v === hovered ? 0.8 : T.era >= 3 && G.env.night ? 0.62 : 0.5;
  const pal = look.pal;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const place = (dx, dy) => [px + dx * cs - dy * sn, py + dx * sn + dy * cs];

  R.sprite(px, py, PIV_BODY[0], PIV_BODY[1], u * dir, u, rot, body, floor, 1, pal);
  const hu = u * (v.kid ? 1.3 : 1);
  const [hx, hy] = place((an.x - PIV_BODY[0]) * u * dir, (an.y - PIV_BODY[1]) * u);
  const hr = rot + (an.tilt || 0) * dir;
  R.sprite(hx, hy, PIV_HEAD[0], PIV_HEAD[1], hu * dir, hu, hr, HEAD[look.style][ex], floor, 1, pal);
  if (v.carry && PROP[v.carry] !== undefined && !swimming && work !== 'sleep') {
    const lift = 10.6 * hu;
    R.sprite(hx + Math.sin(hr) * lift, hy - Math.cos(hr) * lift, PIV_PROP[0], PIV_PROP[1], u * (v.kid ? 1.1 : 1), u * (v.kid ? 1.1 : 1), hr * 0.5, PROP[v.carry], floor, 1, PROP_PAL[v.carry]);
  }
  return Math.round(s.x - 0.5);
}

export function drawOverlays(view, time) {
  const W = G.world, T = G.tribe;
  // particles
  for (const p of G.fx) {
    const fade = Math.min(1, p.life / Math.min(40, p.max));
    const c = p.color || [255, 255, 255];
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.text) overlayText(view, x, y, p.text, c[0] * fade, c[1] * fade, c[2] * fade, p.glow || 0.2);
    else overlayGlyph(view, x, y, gi(p.glyph), c[0] * fade, c[1] * fade, c[2] * fade, p.glow || 0);
  }
  // who is under the mouse?
  let hovered = null;
  if (IN.inside && IN.sx >= 0) {
    let bd = 3;
    for (const v of T.villagers) {
      if (v.inside) continue;
      const d = Math.hypot(v.x + 0.5 - IN.wx, (v.y - 0.2 - IN.wy) * 1.4);
      if (d < bd) { bd = d; hovered = v; }
    }
  }
  // villagers: drawn sprites; names, speech and the follow marker stay text
  const dt = Math.min(0.1, Math.max(0, time - (lastDraw || time)));
  lastDraw = time;
  if (RS.size > T.villagers.length + 24) {
    const alive = new Set(T.villagers.map((v) => v.id));
    for (const id of RS.keys()) if (!alive.has(id)) RS.delete(id);
  }
  for (const v of T.villagers) {
    if (v.inside) continue;
    if (v.x < view.ox - 3 || v.x > view.ox + view.cols + 3 || v.y < view.oy - 2 || v.y > view.oy + view.rows + 3) continue;
    const followed = G.cam.follow === v.id;
    const cx = drawVillager(v, view, time, dt, W, hovered, followed);
    if (cx === undefined) continue;
    const lying = v.state === 'work' && v.action === 'sleep';
    let lane = (v.kid || lying ? v.y : v.y - 1) - 1;
    if (v.carry && !lying) lane--;
    if (v.sayT > 0 && v.say) {
      const f = Math.min(1, v.sayT / 30);
      overlayText(view, cx, lane, v.say, 240 * f, 240 * f, 255 * f, 0.15);
      lane--;
    }
    if (followed || v === hovered) {
      const c = v.color;
      overlayText(view, cx, lane, v.name, c[0], c[1], c[2], 0.25);
      lane--;
    }
    if (followed) {
      const b = 0.6 + 0.4 * Math.sin(time * 6);
      overlayGlyph(view, cx, lane, GL.mark, 255 * b, 207 * b, 90 * b, 0.6, true, 0xff);
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
  const view = G.view;
  const grid = [];
  for (let y = 0; y < R.rows - 1; y++) {
    const line = [];
    for (let x = 0; x < R.cols - 1; x++) line.push(CHARSET[R.fg[(y * R.cols + x) * 4 + 3]] || ' ');
    grid.push(line);
  }
  // the villagers are sprites on screen: write them back as text
  const put = (x, y, ch) => { if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = ch; };
  for (const v of G.tribe.villagers) {
    if (v.inside) continue;
    const x = v.x - view.ox, y = v.y - view.oy;
    if (v.kid) put(x, y, 'ö');
    else { put(x, y, 'Λ'); put(x, y - 1, '☺'); }
  }
  let s = grid.map((l) => l.join('').replace(/\s+$/, '')).join('\n') + '\n';
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
