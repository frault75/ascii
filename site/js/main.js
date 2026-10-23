// ─── main.js ── bootstrap, intro → game, the frame loop ────────────────────
import { G, emit } from './state.js';
import { buildLUTs, E } from './elements.js';
import { Renderer, buildAtlas, buildTileAtlas } from './renderer.js';
import { buildSprites } from './sprites.js';
import { step } from './sim.js';
import { createEnv, updateEnv, updateClouds } from './weather.js';
import { initCompose, compose } from './compose.js';
import { updateFx } from './fx.js';
import { updateLife, updateEcology } from './life.js';
import { checkProgress, tickFaith } from './progress.js';
import { useTool, updateEmitters, updateQuake, updateEvents } from './powers.js';
import { buildUI, updateHUD, drawMinimap, UI, toast, logLine, hint } from './ui.js';
import { setupInput, updateCamera, hoverInfo, IN } from './input.js';
import { Intro } from './intro.js';
import { Sound } from './audio.js';
import { hasSave, loadSettings } from './save.js';
import { newGame, resumeGame, wireEvents, drawOverlays, updateRocket, updateHints, autosave } from './game.js';
import { t } from './i18n.js';
import { updateVoices } from './voices.js';
import { updateFauna } from './fauna.js';
import { updateLives } from './lives.js';
import { clamp } from './util.js';

const BASE_W = 10, BASE_H = 16;
const canvas = document.getElementById('gl');
let R;
const view = { ox: 0, oy: 0, cols: 0, rows: 0, camX: 0, camY: 0, camY0: 34, cellW: 10, cellH: 16, dpr: 1, offX: 0, offY: 0, visC: 100, visR: 50, counts: new Uint32Array(128) };
G.view = view;
let mode = 'intro';
let intro = null;

// render quality: phones get a lower pixel ratio, and any device that can't
// hold the frame rate drops its resolution step by step (and recovers)
const COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const Q = { scale: 1, ema: 1 / 60, slow: 0, fast: 0 };
G.quality = Q;
function adaptQuality(dt) {
  if (Q.lock || dt <= 0 || dt > 0.25) return;
  Q.ema += (dt - Q.ema) * 0.05;
  if (Q.ema > 1 / 42) { Q.slow += dt; Q.fast = 0; } else if (Q.ema < 1 / 57) { Q.fast += dt; Q.slow = 0; } else { Q.slow = 0; Q.fast = 0; }
  if (Q.slow > 2 && Q.scale > 0.5) { Q.scale = Math.max(0.5, Q.scale - 0.15); Q.slow = 0; Q.ema = 1 / 50; }
  if (Q.fast > 6 && Q.scale < 1) { Q.scale = Math.min(1, Q.scale + 0.1); Q.fast = 0; }
}

function computeView(cellCssW, cellCssH, clampCam = true) {
  const dpr = Math.min(COARSE ? 1.75 : 2, window.devicePixelRatio || 1) * Q.scale;
  const Wpx = Math.round(window.innerWidth * dpr), Hpx = Math.round(window.innerHeight * dpr);
  const cellW = cellCssW * dpr, cellH = cellCssH * dpr;
  const visC = Wpx / cellW, visR = Hpx / cellH;
  const cam = G.cam;
  if (clampCam && G.world) {
    const W = G.world;
    if (visC < W.w - 2) cam.x = clamp(cam.x, 1, W.w - 1 - visC);
    else cam.x = (W.w - visC) / 2;
    if (visR < W.h - 1) cam.y = clamp(cam.y, 1, W.h - visR);
    else cam.y = (W.h - visR) / 2;
  }
  const cols = Math.ceil(visC) + 1, rows = Math.ceil(visR) + 1;
  R.resize(Wpx, Hpx);
  R.setGrid(cols, rows);
  const sx = G.shake > 0.01 ? (Math.random() - 0.5) * G.shake * 0.7 : 0;
  const sy = G.shake > 0.01 ? (Math.random() - 0.5) * G.shake * 0.45 : 0;
  const camX = cam.x + sx, camY = cam.y + sy;
  view.ox = Math.floor(camX);
  view.oy = Math.floor(camY);
  view.offX = (camX - view.ox) * cellW;
  view.offY = (camY - view.oy) * cellH;
  view.cols = cols; view.rows = rows;
  view.camX = cam.x; view.camY = cam.y;
  view.cellW = cellW; view.cellH = cellH; view.dpr = dpr;
  view.visC = visC; view.visR = visR;
}

function fail(msg) {
  document.body.innerHTML = `<pre style="color:#ffcf5a;font:14px monospace;padding:40px;line-height:1.6">GENESIS.TXT\n\n${msg}\n\n(WebGL2 est requis · WebGL2 is required)</pre>`;
}

async function boot() {
  loadSettings();
  document.documentElement.lang = G.settings.lang;
  try {
    await Promise.race([document.fonts.load('500 50px "JetBrains Mono"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch (e) { /* offline: fallback fonts */ }
  buildLUTs();
  try {
    R = new Renderer(canvas);
  } catch (e) {
    fail(String(e.message || e));
    return;
  }
  G.renderer = R;
  R.setAtlas(buildAtlas());
  R.setSprites(buildSprites());
  R.setTiles(buildTileAtlas());
  createEnv();
  G.audio = new Sound();
  wireEvents();
  intro = new Intro();
  intro.ready = true;
  intro.onMenu = showMenu;
  requestAnimationFrame(frame);
}

// ── title menu ─────────────────────────────────────────────────────────────
function showMenu() {
  let el = document.getElementById('intro');
  if (!el) {
    el = document.createElement('div');
    el.id = 'intro';
    document.body.append(el);
  }
  const save = hasSave();
  const items = [];
  if (save) items.push(['continue', t('continue'), t('continueSub')]);
  items.push(['genesis', t('newWorld'), t('genesisSub')]);
  items.push(['sandbox', t('sandbox'), t('sandboxSub')]);
  el.innerHTML = `
    <div class="lang"><button data-l="fr" class="${G.settings.lang === 'fr' ? 'on' : ''}">FR</button><button data-l="en" class="${G.settings.lang === 'en' ? 'on' : ''}">EN</button></div>
    <div id="menu" class="show">${items.map(([k, a, b], i) => `<button class="mi ${i === 0 ? 'sel' : ''}" data-k="${k}"><span class="a">▶</span><span><div class="t">${a}</div><div class="s">${b}</div></span></button>`).join('')}</div>
    <div class="credit">${t('tagline').toUpperCase()}</div>`;
  el.querySelectorAll('.mi').forEach((b) => {
    b.onclick = () => choose(b.dataset.k);
    b.onmouseenter = () => { el.querySelectorAll('.mi').forEach((q) => q.classList.remove('sel')); b.classList.add('sel'); if (G.audio.ready) G.audio.sfx('hover'); };
  });
  el.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { G.settings.lang = b.dataset.l; emit('settings'); document.documentElement.lang = G.settings.lang; showMenu(); }));
}

// ── the page must never move under the player's fingers ─────────────────────
// no page zoom (pinch, double tap, ctrl+wheel), no scrolling or pull-to-refresh,
// no edge swipe back; panels and the tool strip keep their own scrolling
const TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const stop = (e) => e.preventDefault();
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
document.addEventListener('dblclick', stop, { passive: false });
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !e.target.closest('.panel, #tools, #cats')) e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchstart', (e) => {
  const x = e.touches[0].clientX;
  if (x < 32 || x > window.innerWidth - 32 || e.touches.length > 1) e.preventDefault();
}, { passive: false });
// the back gesture or button asks before leaving the world
let trapped = false;
function trapBack() {
  if (trapped) return;
  trapped = true;
  history.pushState({ genesis: 1 }, '');
  window.addEventListener('popstate', () => {
    if (mode !== 'game') return;
    history.pushState({ genesis: 1 }, '');
    autosave();
    toast('info', '', t('backTrap'), '');
  });
}
function goFullscreen() {
  if (!TOUCH || document.fullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) try { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed */ }
}

window.addEventListener('keydown', (e) => {
  if (mode !== 'intro') return;
  const el = document.getElementById('intro');
  if (!el) return;
  const items = [...el.querySelectorAll('.mi')];
  if (!items.length) return;
  let i = items.findIndex((q) => q.classList.contains('sel'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    i = (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
    items.forEach((q, k) => q.classList.toggle('sel', k === i));
    e.preventDefault();
  } else if (e.key === 'Enter' || e.key === ' ') {
    choose(items[Math.max(0, i)].dataset.k);
    e.preventDefault();
  }
});

let choosing = false;
function choose(kind) {
  if (choosing) return;
  choosing = true;
  goFullscreen();
  G.audio.init();
  G.audio.sfx('select');
  const el = document.getElementById('intro');
  el.querySelector('#menu').innerHTML = `<div class="mi sel" style="justify-content:center"><span class="t">${t('loading')}…</span></div>`;
  setTimeout(() => {
    let ok = false;
    if (kind === 'continue') ok = resumeGame();
    if (!ok) newGame(kind === 'sandbox' ? 'sandbox' : 'genesis');
    initCompose(R, G.world.seed);
    startGame();
    el.classList.add('gone');
    setTimeout(() => el.remove(), 1400);
  }, 60);
}

let inputReady = false;
function startGame() {
  mode = 'game';
  trapBack();
  const standalone = window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if (TOUCH && !standalone && !document.fullscreenElement && !document.documentElement.requestFullscreen) setTimeout(() => hint(t('installHint')), 9000);
  G.started = true;
  G.reveal = 0;
  G.flash = 0.5;
  G.flashColor = [0.6, 1, 0.8];
  G.glitch = 0.5;
  buildUI();
  if (!inputReady) { setupInput(canvas); inputReady = true; }
  if (G.newWorld) setTimeout(() => logLine(t('logFirst'), true, '#ffcf5a'), 1800);
  if (G.awayMsg) setTimeout(() => toast('quest', G.awayMsg[0], G.awayMsg[1], ''), 2600);
  if (G.mode === 'sandbox') setTimeout(() => toast('info', t('sandbox'), '∞ ◊', t('sandboxSub')), 2000);
}

// ── frame loop ─────────────────────────────────────────────────────────────
let last = performance.now(), acc = 0;
const timers = { hud: 0, mini: 0, prog: 0, audio: 0, save: 0, hover: 0, hints: 0 };

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  G.realTime += dt;
  try {
    if (mode === 'intro') introFrame(dt);
    else { adaptQuality(dt); gameFrame(dt); }
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(frame);
}

function introFrame(dt) {
  const lay = intro.layout();
  computeView(lay.cellW, lay.cellH, false);
  R.ti.fill(0);
  R.leaf.fill(0);
  intro.frame(R, view, dt);
  R.render({
    cellW: view.cellW, cellH: view.cellH, offX: 0, offY: 0,
    amb: [1, 1, 1], skyGain: 0, nGain: 6, wGain: 8, minLight: 1,
    crt: G.settings.crt, bloom: G.settings.bloom * 1.2, time: G.realTime,
    flash: G.flash, flashColor: G.flashColor, glitch: G.glitch, scan: 3 * view.dpr,
  });
}

function paint() {
  const cur = { x: IN.wx, y: IN.wy };
  const last = IN.lastPaint || cur;
  const dist = Math.hypot(cur.x - last.x, (cur.y - last.y) * 1.6);
  const n = Math.min(40, Math.ceil(dist / Math.max(1, UI.brush * 0.6)));
  const drag = { dx: IN.dragDX, dy: IN.dragDY };
  IN.dragDX = 0; IN.dragDY = 0;
  if (n <= 1) useTool(UI.tool, cur.x, cur.y, UI.brush, IN.held, drag);
  else for (let k = 1; k <= n; k++) {
    useTool(UI.tool, last.x + ((cur.x - last.x) * k) / n, last.y + ((cur.y - last.y) * k) / n, UI.brush, IN.held || k > 1, drag);
  }
  IN.held = true;
  IN.lastPaint = cur;
}

function simStep() {
  if (IN.painting) paint();
  updateEnv(1);
  step();
  updateClouds();
  updateLife();
  updateLives();
  updateEcology();
  updateFauna();
  updateEmitters();
  updateQuake();
  updateEvents();
  updateFx();
  updateRocket();
  if (G.mode !== 'sandbox') tickFaith();
}

function gameFrame(dt) {
  updateCamera(dt);
  if (!G.paused) {
    acc += dt * 60 * G.speed;
    let n = 0;
    const maxSteps = 4 * G.speed + 2;
    const t0 = performance.now();
    while (acc >= 1 && n < maxSteps) {
      simStep();
      acc -= 1;
      n++;
      if (performance.now() - t0 > 28) { acc = 0; break; }
    }
    if (n >= maxSteps) acc = 0;
  } else if (IN.painting) {
    // painting still works while paused
    paint();
  }
  G.reveal = Math.min(1, G.reveal + dt / 2.8);
  computeView(BASE_W * G.cam.zoom, BASE_H * G.cam.zoom);
  view.counts.fill(0);
  compose(view, G.realTime);
  drawOverlays(view, G.realTime);
  const vg = view.counts[E.GLITCH];
  if (vg) G.glitch = Math.max(G.glitch, Math.min(0.55, vg / 500));
  R.render({
    cellW: view.cellW, cellH: view.cellH, offX: view.offX, offY: view.offY, ox: view.ox, oy: view.oy, sun: G.settings.pixel !== false ? view.sun : null, moon: G.settings.pixel !== false ? view.moon : null, ecl: view.ecl,
    amb: view.amb, skyGain: 3.0, nGain: 14, wGain: 22, minLight: 0.1,
    crt: G.settings.crt, bloom: G.settings.bloom, time: G.realTime,
    flash: G.flash, flashColor: G.flashColor, glitch: G.glitch, scan: 3 * view.dpr,
    sat: 1,
  });
  if (G.photoReq) { G.photoReq(canvas); G.photoReq = null; }
  G.shake *= Math.pow(0.02, dt);
  G.flash = Math.max(0, G.flash - dt * 1.6);
  G.glitch = Math.max(0, G.glitch - dt * 0.8);

  updateVoices(dt);
  for (const k in timers) timers[k] += dt;
  if (timers.hud > 0.25) { timers.hud = 0; updateHUD(); }
  if (timers.hover > 0.1) { timers.hover = 0; hoverInfo(); }
  if (timers.mini > 1) { timers.mini = 0; drawMinimap(); }
  if (timers.prog > 1) { timers.prog = 0; checkProgress(); }
  if (timers.audio > 0.1) { timers.audio = 0; if (G.audio) G.audio.update(view.counts); }
  if (timers.hints > 1) { updateHints(timers.hints); timers.hints = 0; }
  if (timers.save > 30) { timers.save = 0; autosave(); }
}

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'game') autosave(); });
window.addEventListener('beforeunload', () => { if (mode === 'game') autosave(); });

window.G = G;
boot();
