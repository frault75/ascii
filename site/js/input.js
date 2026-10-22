// ─── input.js ── mouse, touch, keyboard & camera ───────────────────────────
import { G, emit } from './state.js';
import { clamp } from './util.js';
import { UI, setBrush, setSpeed, setCat, clickTool, togglePanel, closePanels, setHover, cellInfo } from './ui.js';
import { TOOLS, CATS } from './progress.js';

export const IN = {
  sx: -1, sy: -1, wx: 0, wy: 0, inside: false,
  painting: false, held: false, panning: false, lastX: 0, lastY: 0,
  dragDX: 0, dragDY: 0, keys: new Set(), pointers: new Map(), pinch: null, lastPaint: null,
};

export function toWorld(sx, sy) {
  const v = G.view;
  return { x: G.cam.x + (sx * v.dpr) / v.cellW, y: G.cam.y + (sy * v.dpr) / v.cellH };
}

function updateCursor(e) {
  IN.sx = e.clientX;
  IN.sy = e.clientY;
  if (!G.view) return;
  const p = toWorld(IN.sx, IN.sy);
  IN.wx = p.x; IN.wy = p.y;
}

function zoomAt(sx, sy, factor) {
  const cam = G.cam;
  const before = toWorld(sx, sy);
  cam.zoom = clamp(cam.zoom * factor, 0.45, 3.2);
  const v = G.view;
  const cellW = 10 * cam.zoom * v.dpr, cellH = 16 * cam.zoom * v.dpr;
  cam.x = before.x - (sx * v.dpr) / cellW;
  cam.y = before.y - (sy * v.dpr) / cellH;
}

function villagerAt(wx, wy) {
  const T = G.tribe;
  let best = null, bd = 2.5;
  for (const v of T.villagers) {
    if (v.inside) continue;
    const d = Math.hypot(v.x + 0.5 - wx, (v.y + 0.5 - wy) * 1.6);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function setupInput(canvas) {
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    IN.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    updateCursor(e);
    emit('userInput');
    if (IN.pointers.size === 2) {
      // start pinch: cancel painting
      IN.painting = false;
      const [a, b] = [...IN.pointers.values()];
      IN.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    const pan = e.button === 1 || e.button === 2 || UI.tool === 'eye' || UI.mobilePan;
    if (UI.tool === 'eye' && e.button === 0) {
      const v = villagerAt(IN.wx, IN.wy);
      if (v) { G.cam.follow = v.id; emit('follow', v); return; }
    }
    if (pan) {
      IN.panning = true;
      IN.lastX = e.clientX; IN.lastY = e.clientY;
      G.cam.follow = null;
      return;
    }
    if (e.button === 0) {
      IN.painting = true;
      IN.held = false;
      IN.lastPaint = { x: IN.wx, y: IN.wy };
      IN.dragDX = 0; IN.dragDY = 0;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const prev = IN.pointers.get(e.pointerId);
    if (prev) { prev.x = e.clientX; prev.y = e.clientY; }
    if (IN.pinch && IN.pointers.size === 2) {
      const [a, b] = [...IN.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const v = G.view;
      G.cam.x -= ((cx - IN.pinch.cx) * v.dpr) / v.cellW;
      G.cam.y -= ((cy - IN.pinch.cy) * v.dpr) / v.cellH;
      if (IN.pinch.d > 10) zoomAt(cx, cy, d / IN.pinch.d);
      IN.pinch = { d, cx, cy };
      G.cam.follow = null;
      return;
    }
    const ox = IN.wx, oy = IN.wy;
    updateCursor(e);
    if (IN.panning) {
      const v = G.view;
      G.cam.x -= ((e.clientX - IN.lastX) * v.dpr) / v.cellW;
      G.cam.y -= ((e.clientY - IN.lastY) * v.dpr) / v.cellH;
      IN.lastX = e.clientX; IN.lastY = e.clientY;
      updateCursor(e);
    } else if (IN.painting) {
      IN.dragDX += IN.wx - ox;
      IN.dragDY += IN.wy - oy;
    }
  });

  const end = (e) => {
    IN.pointers.delete(e.pointerId);
    if (IN.pointers.size < 2) IN.pinch = null;
    if (IN.pointers.size === 0) { IN.painting = false; IN.panning = false; IN.held = false; }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { IN.inside = false; });
  canvas.addEventListener('pointerenter', () => { IN.inside = true; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    updateCursor(e);
    if (e.shiftKey) { setBrush(UI.brush + (e.deltaY < 0 ? 1 : -1)); return; }
    const f = e.ctrlKey ? Math.exp(-e.deltaY * 0.01) : e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(e.clientX, e.clientY, f);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (!G.started) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    IN.keys.add(k);
    emit('userInput');
    if (k === ' ') { setSpeed(0); e.preventDefault(); }
    else if (k === 'f') setSpeed(G.paused ? 1 : G.speed >= 4 ? 1 : G.speed * 2);
    else if (k === 'tab') { e.preventDefault(); const i = CATS.indexOf(UI.cat); setCat(CATS[(i + (e.shiftKey ? CATS.length - 1 : 1)) % CATS.length]); }
    else if (k === '[') setBrush(UI.brush - 1);
    else if (k === ']') setBrush(UI.brush + 1);
    else if (k === 'h') document.getElementById('ui').classList.toggle('hidden');
    else if (k === 'c') togglePanel('codex');
    else if (k === 'v') togglePanel('civ');
    else if (k === 'm') { G.settings.muted = !G.settings.muted; emit('settings'); }
    else if (k === 'p') emit('action', 'photo');
    else if (k === 'e') clickTool('erase');
    else if (k === 'escape') { if (!closePanels()) G.cam.follow = null; }
    else if (/^[1-9]$/.test(k)) {
      const list = TOOLS.filter((x) => x.cat === '*' || x.cat === UI.cat);
      const tl = list[+k - 1];
      if (tl) clickTool(tl.id);
    }
  });
  window.addEventListener('keyup', (e) => IN.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => IN.keys.clear());
}

// called every frame
export function updateCamera(dt) {
  const cam = G.cam;
  const K = IN.keys;
  const sp = (40 / cam.zoom) * dt * (K.has('shift') ? 2.5 : 1);
  let mx = 0, my = 0;
  if (K.has('arrowleft') || K.has('q') || K.has('a')) mx -= 1;
  if (K.has('arrowright') || K.has('d')) mx += 1;
  if (K.has('arrowup') || K.has('z') || K.has('w')) my -= 1;
  if (K.has('arrowdown') || K.has('s')) my += 1;
  if (mx || my) { cam.x += mx * sp; cam.y += my * sp * 0.65; cam.follow = null; }
  if (cam.follow) {
    const v = G.tribe.villagers.find((q) => q.id === cam.follow);
    if (!v) cam.follow = null;
    else if (G.view) {
      const tx = v.x - G.view.visC / 2, ty = v.y - G.view.visR * 0.55;
      cam.x += (tx - cam.x) * Math.min(1, dt * 3);
      cam.y += (ty - cam.y) * Math.min(1, dt * 3);
    }
  }
  if (G.view && IN.sx >= 0) {
    const p = toWorld(IN.sx, IN.sy);
    IN.wx = p.x; IN.wy = p.y;
  }
}

export function hoverInfo() {
  if (!IN.inside || IN.sx < 0) { setHover(''); return; }
  setHover(cellInfo(Math.floor(IN.wx), Math.floor(IN.wy)));
}
