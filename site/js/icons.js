// ─── icons.js ── little pixel-art icons for the interface ──────────────────
// Each icon is drawn on a 16×16 grid, gets an automatic dark outline and is
// cached as a data URL. The faith symbol in any interface text is swapped
// for a drawn gem so that "120◊" can no longer be read as "1200".
import { portrait } from './sprites.js';

const S = 16;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mul = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

class Pix {
  constructor() { this.p = new Array(S * S).fill(null); }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < S && y < S && c) this.p[y * S + x] = c; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
  disc(cx, cy, r, c, ry = r) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
  }
  line(x0, y0, x1, y1, c, w = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      if (w === 1) this.px(x, y, c); else this.rect(Math.round(x - w / 2), Math.round(y - w / 2), w, w, c);
    }
  }
  poly(pts, c) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.px(x, y, c);
    }
  }
  url(outline) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    const o = outline || [14, 12, 22];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let c = this.p[y * S + x];
      if (!c) {
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < S && yy < S && this.p[yy * S + xx]; });
        if (!near) continue;
        c = o;
      }
      const k = (y * S + x) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }
}

// shared shapes
const drop = (g, c) => { const l = mix(c, [255, 255, 255], 0.45), d = mul(c, 0.7); g.poly([[8, 1], [12.5, 8], [13, 11], [11, 14], [5, 14], [3, 11], [3.5, 8]], c); g.disc(8, 10.5, 5, c, 4); g.rect(5, 12, 6, 2, d); g.rect(5, 6, 2, 3, l); };
const heap = (g, c, dots) => { const d = mul(c, 0.72), l = mix(c, [255, 255, 255], 0.3); g.poly([[1, 15], [5, 8], [8, 6], [11, 8], [15, 15]], c); g.rect(1, 14, 15, 2, d); for (const [x, y] of dots) g.px(x, y, d); g.px(7, 8, l); g.px(6, 9, l); };
const block = (g, c, tex) => {
  const l = mix(c, [255, 255, 255], 0.35), d = mul(c, 0.65);
  g.rect(2, 3, 12, 11, c); g.rect(2, 3, 12, 2, l); g.rect(12, 5, 2, 9, d); g.rect(2, 12, 12, 2, d);
  if (tex) for (const [x, y] of tex) g.px(x, y, d);
};
const cloud = (g, c) => { g.disc(5.5, 8, 3.6, c); g.disc(10, 6.5, 4.2, c); g.disc(12.5, 9, 3, c); g.rect(3, 8, 11, 4, c); g.rect(3, 11, 11, 1, mul(c, 0.8)); };
const star4 = (g, x, y, c) => { g.px(x, y, c); g.px(x - 1, y, c); g.px(x + 1, y, c); g.px(x, y - 1, c); g.px(x, y + 1, c); };

const DRAW = {
  eye: (g, c) => { g.poly([[1, 8], [5, 4], [11, 4], [15, 8], [11, 12], [5, 12]], [240, 236, 228]); g.disc(8, 8, 3, [80, 200, 255]); g.disc(8, 8, 1.4, [16, 14, 24]); g.px(7, 6, [255, 255, 255]); },
  erase: (g, c) => { g.line(3, 3, 13, 13, c, 3); g.line(13, 3, 3, 13, c, 3); },
  sand: (g, c) => heap(g, c, [[6, 11], [10, 12], [8, 13], [12, 13], [4, 13]]),
  gunpowder: (g, c) => heap(g, c, [[6, 11], [9, 10], [10, 12], [7, 13], [12, 13], [4, 13], [8, 9]]),
  dirt: (g, c) => { block(g, c, [[4, 7], [8, 6], [10, 9], [5, 10], [9, 12]]); g.rect(2, 3, 12, 2, [110, 200, 80]); g.px(3, 5, [110, 200, 80]); g.px(7, 5, [110, 200, 80]); g.px(11, 5, [110, 200, 80]); },
  stone: (g, c) => block(g, c, [[5, 7], [6, 7], [9, 9], [10, 9], [4, 11], [8, 6]]),
  metal: (g, c) => { block(g, c); g.px(4, 6, mul(c, 0.5)); g.px(11, 6, mul(c, 0.5)); g.px(4, 11, mul(c, 0.5)); g.px(11, 11, mul(c, 0.5)); },
  ice: (g, c) => { block(g, c); g.line(5, 11, 9, 6, [255, 255, 255]); g.line(8, 12, 11, 8, [255, 255, 255]); },
  obsidian: (g, c) => { block(g, c); g.line(4, 10, 8, 6, mix(c, [255, 255, 255], 0.5)); },
  glass: (g, c) => { g.rect(2, 2, 12, 12, mul(c, 0.55)); g.rect(3, 3, 10, 10, mix(c, [90, 140, 170], 0.5)); g.line(5, 9, 8, 5, [255, 255, 255]); g.line(7, 11, 11, 6, [255, 255, 255]); },
  gold: (g, c) => { g.poly([[2, 13], [5, 6], [11, 5], [14, 12], [10, 14]], c); g.rect(4, 12, 9, 2, mul(c, 0.7)); g.line(6, 7, 10, 6, [255, 250, 210]); star4(g, 12, 3, [255, 255, 230]); },
  crystal: (g, c) => { const l = mix(c, [255, 255, 255], 0.5); g.poly([[8, 1], [12, 5], [11, 14], [5, 14], [4, 5]], c); g.line(8, 2, 8, 13, l); g.poly([[4, 5], [8, 1], [8, 13], [5, 14]], mul(c, 0.8)); g.line(8, 2, 8, 13, l); },
  water: (g, c) => drop(g, c),
  lava: (g, c) => { drop(g, c); g.px(9, 9, [255, 240, 140]); g.px(7, 11, [255, 240, 140]); },
  oil: (g, c) => drop(g, c),
  acid: (g, c) => { drop(g, c); g.px(10, 4, c); g.px(12, 2, c); },
  snow: (g, c) => { g.line(8, 1, 8, 15, c); g.line(1, 8, 15, 8, c); g.line(3, 3, 13, 13, c); g.line(13, 3, 3, 13, c); g.disc(8, 8, 2, [255, 255, 255]); },
  seed: (g, c) => { g.disc(8, 10, 4, c, 3); g.line(8, 7, 8, 3, [110, 200, 80]); g.disc(10, 3.5, 2, [110, 200, 80], 1.2); g.rect(6, 11, 5, 1, mul(c, 0.7)); },
  tree: (g, c) => { g.rect(7, 10, 3, 6, [140, 92, 50]); g.disc(8, 6, 6, c, 5.2); g.disc(6, 4.5, 2.4, mix(c, [255, 255, 255], 0.3)); g.rect(3, 9, 11, 1, mul(c, 0.7)); },
  flower: (g, c) => { g.line(8, 9, 8, 15, [90, 180, 70]); g.disc(5, 13, 1.6, [90, 180, 70], 1); for (const [x, y] of [[8, 3], [5, 6], [11, 6], [6, 9.5], [10, 9.5]]) g.disc(x, y, 2.4, c); g.disc(8, 6.5, 1.6, [255, 220, 80]); },
  fish: (g, c) => { g.disc(7, 8, 5, c, 3.6); g.poly([[11, 8], [15, 4], [15, 12]], c); g.rect(3, 9, 8, 2, mul(c, 0.75)); g.px(4, 7, [16, 14, 24]); g.line(8, 5, 8, 11, mul(c, 0.8)); },
  bird: (g, c) => { g.poly([[1, 6], [5, 5], [8, 9], [11, 5], [15, 6], [11, 9], [8, 12], [5, 9]], c); g.disc(8, 9, 1.8, mul(c, 0.8)); },
  butterfly: (g, c) => { g.disc(4.5, 6, 3.4, c, 4); g.disc(11.5, 6, 3.4, c, 4); g.disc(5, 12, 2.4, mul(c, 0.8)); g.disc(11, 12, 2.4, mul(c, 0.8)); g.rect(7, 4, 2, 11, [40, 30, 40]); g.px(5, 5, [255, 255, 255]); g.px(10, 5, [255, 255, 255]); },
  firefly: (g, c) => { g.disc(8, 9, 5.5, mul(c, 0.35)); g.disc(8, 9, 3, c); g.disc(8, 9, 1.4, [255, 255, 220]); g.disc(5, 5, 2, [200, 220, 240], 1.4); g.disc(11, 5, 2, [200, 220, 240], 1.4); },
  worm: (g, c) => { for (let x = 2; x <= 13; x++) g.rect(x, Math.round(9 + Math.sin(x * 0.8) * 2.5), 1, 3, c); g.px(13, Math.round(9 + Math.sin(13 * 0.8) * 2.5), [16, 14, 24]); },
  shroom: (g, c) => { g.rect(6, 9, 4, 6, [230, 230, 220]); g.disc(8, 8, 6, c, 4); g.rect(2, 8, 13, 2, null); g.rect(2, 9, 12, 1, mul(c, 0.6)); g.px(5, 6, [255, 255, 255]); g.px(10, 5, [255, 255, 255]); },
  fire: (g, c) => { g.poly([[8, 1], [12, 7], [13, 11], [11, 15], [5, 15], [3, 11], [4, 7], [6, 9]], [255, 120, 40]); g.poly([[8, 6], [10, 10], [10, 13], [6, 13], [6, 10]], [255, 220, 90]); },
  tnt: (g, c) => { g.rect(2, 5, 4, 10, c); g.rect(6, 5, 4, 10, mul(c, 0.85)); g.rect(10, 5, 4, 10, c); g.rect(2, 8, 12, 3, [250, 240, 220]); g.line(8, 5, 11, 1, [200, 180, 140]); g.px(12, 1, [255, 220, 90]); },
  bolt: (g, c) => g.poly([[9, 0], [3, 9], [7, 9], [5, 16], [13, 6], [9, 6], [11, 0]], c),
  meteor: (g, c) => { g.line(1, 1, 9, 9, mix(c, [255, 240, 160], 0.4), 2); g.line(4, 1, 10, 7, [255, 200, 90]); g.disc(10.5, 10.5, 4, [120, 100, 90]); g.px(9, 9, [170, 150, 130]); g.px(12, 12, [80, 64, 58]); },
  volcano: (g, c) => { g.poly([[0, 16], [6, 6], [10, 6], [16, 16]], [110, 90, 80]); g.poly([[6, 6], [10, 6], [9, 9], [7, 9]], c); g.line(8, 9, 6, 14, c); g.disc(6, 3, 2, [180, 180, 190]); g.disc(10, 2, 1.6, [150, 150, 160]); },
  glitch: (g, c) => { for (const [x, y, w, h, k] of [[1, 2, 6, 3, 0], [8, 1, 6, 2, 1], [3, 6, 9, 2, 1], [0, 9, 5, 3, 0], [7, 10, 8, 2, 0], [4, 13, 6, 2, 1]]) g.rect(x, y, w, h, k ? [70, 240, 255] : c); },
  cloud: (g, c) => { cloud(g, c); g.line(5, 13, 4, 15, [120, 180, 255]); g.line(9, 13, 8, 15, [120, 180, 255]); },
  snowcloud: (g, c) => { cloud(g, c); star4(g, 5, 14, [255, 255, 255]); star4(g, 11, 14, [255, 255, 255]); },
  storm: (g, c) => { cloud(g, mul(c, 0.8)); g.poly([[9, 10], [6, 13], [8, 13], [7, 16], [11, 12], [9, 12]], [255, 240, 120]); },
  steam: (g, c) => { g.disc(5, 11, 3, c); g.disc(10, 8, 3.4, c); g.disc(7, 4, 2.4, c); },
  wind: (g, c) => { g.line(1, 5, 11, 5, c); g.line(11, 5, 13, 3, c); g.line(13, 3, 11, 2, c); g.line(1, 9, 14, 9, c); g.line(3, 13, 10, 13, c); g.line(10, 13, 12, 15, c); },
  rain: (g, c) => { cloud(g, [210, 220, 235]); for (const x of [4, 8, 12]) g.line(x, 12, x - 1, 15, c); },
  sun: (g, c) => { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.line(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 8 + Math.cos(a) * 7.4, 8 + Math.sin(a) * 7.4, c); } g.disc(8, 8, 4, c); g.disc(7, 7, 1.6, [255, 250, 220]); },
  harvest: (g, c) => { for (const x of [5, 8, 11]) { g.line(x, 15, 8, 7, [200, 170, 80]); g.disc(x, 4, 1.6, [240, 200, 90], 2.6); } g.rect(4, 10, 8, 2, [160, 110, 60]); },
  gift: (g, c) => { g.rect(2, 7, 12, 8, c); g.rect(1, 5, 14, 3, mix(c, [255, 255, 255], 0.3)); g.rect(7, 5, 2, 10, [255, 90, 120]); g.disc(5.5, 3.5, 2, [255, 90, 120], 1.4); g.disc(10.5, 3.5, 2, [255, 90, 120], 1.4); },
  bless: (g, c) => { g.disc(5, 7, 3.4, c); g.disc(11, 7, 3.4, c); g.poly([[1.8, 8], [14.2, 8], [8, 15]], c); g.px(5, 5, [255, 255, 255]); star4(g, 13, 2, [255, 240, 160]); },
  rainbow: (g, c) => { const C = [[255, 70, 70], [255, 160, 40], [255, 230, 60], [80, 220, 90], [60, 160, 255], [150, 90, 230]]; C.forEach((col, k) => { for (let a = 0; a <= 32; a++) { const t = (a / 32) * Math.PI; const r = 7 - k; g.px(8 + Math.cos(t) * r, 14 - Math.sin(t) * r, col); } }); },
  aurora: (g, c) => { for (let x = 1; x < 15; x++) { const top = 3 + Math.round(Math.sin(x * 0.8) * 2); g.rect(x, top, 1, 6 + (x % 3), x % 2 ? c : mix(c, [120, 120, 255], 0.5)); } g.rect(0, 14, 16, 2, [40, 50, 80]); },
  night: (g, c) => { g.disc(8, 8, 6, c); g.disc(11, 6, 5, null); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = x + 0.5 - 11, dy = y + 0.5 - 6; if (dx * dx + dy * dy < 25) g.p[y * S + x] = null; } star4(g, 13, 12, [255, 255, 230]); },
  eclipse: (g, c) => { g.disc(8, 8, 7, c); g.disc(8, 8, 5.4, [20, 14, 30]); star4(g, 13, 3, [255, 220, 255]); },
  quake: (g, c) => { g.rect(0, 9, 16, 7, c); g.line(7, 9, 9, 12, [30, 20, 15]); g.line(9, 12, 6, 15, [30, 20, 15]); g.line(1, 5, 3, 7, mul(c, 1.2)); g.line(15, 5, 13, 7, mul(c, 1.2)); g.rect(0, 9, 16, 1, mix(c, [120, 200, 80], 0.6)); },
  meteors: (g, c) => { for (const [x, y] of [[3, 2], [9, 5], [5, 10]]) { g.line(x - 3, y - 3, x, y, mix(c, [255, 255, 255], 0.3)); g.disc(x + 0.5, y + 0.5, 1.6, c); } },
};

const cache = new Map();
export function toolIcon(tl) {
  if (cache.has(tl.id)) return cache.get(tl.id);
  let url;
  if (tl.id === 'spark') url = portrait({ id: 7, color: [255, 207, 90], skin: [241, 194, 125], age: 2 });
  else {
    const g = new Pix();
    (DRAW[tl.id] || ((gg, c) => gg.disc(8, 8, 5, c)))(g, hex(tl.c));
    url = g.url();
  }
  cache.set(tl.id, url);
  return url;
}

// resources and counters in the HUD
const HUD = {
  faith: (g) => { g.poly([[8, 0], [14, 6], [8, 16], [2, 6]], [120, 230, 255]); g.poly([[8, 0], [8, 16], [2, 6]], [70, 180, 240]); g.poly([[4, 5], [8, 1], [12, 5]], [210, 250, 255]); },
  people: (g) => { g.disc(5, 5, 2.6, [241, 194, 125]); g.rect(2, 9, 6, 6, [255, 120, 90]); g.disc(11, 5, 2.6, [198, 134, 66]); g.rect(8, 9, 6, 6, [90, 160, 255]); },
  food: (g) => { g.disc(8, 9.5, 5.5, [232, 70, 60]); g.line(8, 4, 9, 1, [120, 80, 40]); g.disc(11, 3, 2, [110, 200, 80], 1.2); g.px(6, 7, [255, 200, 200]); },
  wood: (g) => { g.rect(1, 6, 14, 5, [168, 116, 63]); g.disc(14, 8.5, 2.6, [210, 170, 110]); g.px(14, 8, [140, 90, 50]); g.rect(1, 8, 12, 1, [120, 80, 40]); },
  stone: (g) => { g.poly([[2, 13], [3, 6], [8, 3], [13, 5], [14, 13]], [168, 168, 178]); g.poly([[3, 6], [8, 3], [13, 5], [8, 8]], [210, 210, 220]); },
  metal: (g) => { g.poly([[1, 12], [4, 6], [15, 6], [12, 12]], [150, 210, 238]); g.poly([[4, 6], [15, 6], [13, 8], [5, 8]], [220, 250, 255]); },
  houses: (g) => { g.poly([[1, 8], [8, 2], [15, 8]], [236, 96, 64]); g.rect(3, 8, 10, 7, [196, 140, 84]); g.rect(7, 10, 3, 5, [90, 60, 40]); },
  discovery: (g) => { g.poly([[8, 0], [10, 6], [16, 8], [10, 10], [8, 16], [6, 10], [0, 8], [6, 6]], [255, 120, 220]); g.disc(8, 8, 2, [255, 230, 250]); },
};
export function hudIcon(name) {
  const key = 'hud:' + name;
  if (cache.has(key)) return cache.get(key);
  const g = new Pix();
  HUD[name](g);
  const url = g.url();
  cache.set(key, url);
  return url;
}

// ── the faith gem inside interface text ──────────────────────────────────
const GEM = '◊';
function iconize(node) {
  if (node.nodeType === 3) {
    const s = node.nodeValue;
    if (!s.includes(GEM) || !node.parentNode) return;
    const frag = document.createDocumentFragment();
    s.split(GEM).forEach((part, k) => {
      if (k) { const i = document.createElement('i'); i.className = 'fi'; i.style.backgroundImage = `url(${hudIcon('faith')})`; frag.append(i); }
      if (part) frag.append(part);
    });
    node.parentNode.replaceChild(frag, node);
  } else if (node.nodeType === 1 && node.textContent.includes(GEM)) {
    for (const ch of [...node.childNodes]) iconize(ch);
  }
}
export function watchFaithSymbols(root) {
  iconize(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') iconize(m.target);
      for (const n of m.addedNodes) iconize(n);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
