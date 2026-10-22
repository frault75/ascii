// ─── intro.js ── boot sequence, logo & title menu (rendered in glyphs) ─────
import { G } from './state.js';
import { gi, gs } from './glyphs.js';
import { t } from './i18n.js';
import { hash2, clamp } from './util.js';

const L = {
  G: [' ██████╗ ', '██╔════╝ ', '██║  ███╗', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
  N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  X: ['██╗  ██╗', '╚██╗██╔╝', ' ╚███╔╝ ', ' ██╔██╗ ', '██╔╝ ██╗', '╚═╝  ╚═╝'],
  '.': ['   ', '   ', '   ', '   ', '██╗', '╚═╝'],
};
function word(s) {
  const rows = ['', '', '', '', '', ''];
  for (const ch of s) for (let r = 0; r < 6; r++) rows[r] += L[ch][r];
  return rows;
}
const LOGO = word('GENESIS.TXT');
const LW = LOGO[0].length;

const BOOT = [
  ['GENESIS BIOS v1.0.4   (c) 1979-2026 ASCII DYNAMICS', 0],
  ['', 0],
  ['CPU   : QUANTUM GLYPH CORE @ 4.77 THz ........... OK', 1],
  ['MEM   : 640K OUGHT TO BE ENOUGH ................. OK', 1],
  ['CHARSET 256 GLYPHS LOADED ....................... OK', 1],
  ['PHYSICS: 43 ELEMENTS · 1 600 000 RULES .......... OK', 1],
  ['LIFE.EXE ........................................ READY', 2],
  ['MOUNTING UNIVERSE.DAT ........................... ', 3],
];

export class Intro {
  constructor() {
    this.t = 0;
    this.phase = 'boot';
    this.logoT = 0;
    this.cells = null;
    this.drops = [];
    this.done = false;
  }

  layout(view) {
    // choose a cell size that lets the logo breathe
    const cssW = window.innerWidth;
    const cell = clamp((cssW * 0.9) / LW, 3.2, 13);
    return { cellW: cell, cellH: cell * 1.6 };
  }

  frame(R, view, dt) {
    this.t += dt;
    const T = this.t;
    const { fg, bg, em, cols, rows } = R;
    // clear
    for (let i = 0; i < cols * rows; i++) {
      const o = i * 4;
      fg[o] = 0; fg[o + 1] = 0; fg[o + 2] = 0; fg[o + 3] = 0;
      bg[o] = 3; bg[o + 1] = 5; bg[o + 2] = 9; bg[o + 3] = 255;
      em[o] = 0; em[o + 1] = 0; em[o + 2] = 0; em[o + 3] = 0;
    }
    const put = (x, y, ch, r, g, b, glow = 0) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const o = (y * cols + x) * 4;
      fg[o] = r; fg[o + 1] = g; fg[o + 2] = b; fg[o + 3] = typeof ch === 'number' ? ch : gi(ch);
      if (glow) { em[o] = r * glow; em[o + 1] = g * glow; em[o + 2] = b * glow; }
    };

    // starfield + glyph rain
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const hs = hash2(x, y, 3);
        if (hs < 0.006) {
          const tw = 0.4 + 0.6 * Math.sin(T * (1 + hs * 400) + hs * 900);
          put(x, y, hs < 0.001 ? '+' : '·', 90 * tw + 40, 100 * tw + 40, 140 * tw + 60, 0.2);
        }
      }
    }
    if (this.phase !== 'boot') {
      const rainCols = Math.floor(cols / 3);
      for (let k = 0; k < rainCols; k++) {
        const x = (k * 7 + 3) % cols;
        const speed = 6 + hash2(k, 1, 9) * 14;
        const len = 6 + hash2(k, 2, 9) * 18;
        const head = ((T * speed + hash2(k, 3, 9) * rows * 2) % (rows + len * 2)) - len;
        for (let j = 0; j < len; j++) {
          const y = Math.floor(head - j);
          if (y < 0 || y >= rows) continue;
          const f = 1 - j / len;
          const gch = gs('01░▒#$%&*+<>/\\|=')[Math.floor(hash2(x, y + Math.floor(T * 8), 4) * 16)];
          const hue = hash2(k, 5, 9);
          const c = hue < 0.33 ? [60, 255, 160] : hue < 0.66 ? [80, 200, 255] : [255, 120, 210];
          put(x, y, gch, c[0] * f * 0.35, c[1] * f * 0.35, c[2] * f * 0.35, j === 0 ? 0.25 : 0);
        }
      }
    }

    if (this.phase === 'boot') {
      const speed = 150; // chars per second
      let budget = T * speed;
      const x0 = 2, y0 = 2;
      let y = y0;
      for (const [line, kind] of BOOT) {
        if (budget <= 0) break;
        const n = Math.min(line.length, Math.floor(budget));
        budget -= line.length + 8;
        for (let i = 0; i < n; i++) {
          const ch = line[i];
          const ok = line.endsWith('OK') && i >= line.length - 2;
          const rd = line.endsWith('READY') && i >= line.length - 5;
          const c = ok ? [140, 255, 150] : rd ? [255, 207, 90] : kind === 0 ? [236, 230, 218] : [150, 170, 160];
          put(x0 + i, y, ch, c[0], c[1], c[2], ok || rd ? 0.5 : 0.08);
        }
        if (n < line.length || kind === 3) {
          if (kind === 3 && n === line.length) {
            // progress bar while the world is being made
            const p = Math.min(1, Math.max(0, budget + 8) / 140);
            const w = 20;
            const f = Math.round(p * w);
            const bar = '[' + '█'.repeat(f) + '░'.repeat(w - f) + ']';
            for (let i = 0; i < bar.length; i++) put(x0 + n + i, y, bar[i], 255, 207, 90, 0.4);
          }
          if (Math.floor(T * 3) % 2 === 0) put(x0 + n + (kind === 3 ? 23 : 0), y, '█', 140, 255, 150, 0.4);
        }
        y++;
      }
      if (budget > 170 && this.ready) {
        this.phase = 'logo';
        this.logoT = 0;
        G.flash = 0.6;
        G.flashColor = [0.6, 1, 0.8];
        G.glitch = 0.8;
      }
    } else {
      this.logoT += dt;
      const lt = this.logoT;
      const lx = Math.floor((cols - LW) / 2);
      const ly = Math.max(1, Math.floor(rows * 0.2));
      for (let r = 0; r < 6; r++) {
        const row = Array.from(LOGO[r]);
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (ch === ' ') continue;
          const delay = hash2(c, r, 17) * 1.3 + (c / LW) * 0.6;
          const p = clamp((lt - delay) / 0.55, 0, 1);
          if (p <= 0) continue;
          const ease = 1 - Math.pow(1 - p, 3);
          const startY = -6 - hash2(c, r, 19) * rows * 0.6;
          const y = Math.round(startY + (ly + r - startY) * ease);
          const solid = ch === '█';
          // gradient across the logo
          const u = c / LW;
          const wave = 0.5 + 0.5 * Math.sin(T * 1.5 - u * 6 + r * 0.3);
          let cr, cg, cb;
          if (u < 0.5) { const k = u / 0.5; cr = 255; cg = 207 - k * 100; cb = 90 + k * 123; }
          else { const k = (u - 0.5) / 0.5; cr = 255 - k * 144; cg = 107 + k * 135; cb = 213 + k * 42; }
          if (c >= 54) { cr = 236; cg = 230; cb = 218; }
          const sh = solid ? 1 : 0.42;
          const flick = p < 1 ? 1.6 : 1 + wave * 0.18;
          const glyph = p < 1 && hash2(c, Math.floor(lt * 20), 7) < 0.5 ? gs('01#$%&@')[Math.floor(hash2(c, r, Math.floor(lt * 30)) * 7)] : gi(ch);
          put(lx + c, y, glyph, Math.min(255, cr * sh * flick), Math.min(255, cg * sh * flick), Math.min(255, cb * sh * flick), solid ? 0.55 : 0.1);
        }
      }
      // tagline typed under the logo
      const tag = t('tagline');
      const tn = Math.floor(clamp((lt - 2.1) * 30, 0, tag.length));
      const ty = ly + 8;
      const tx = Math.floor((cols - tag.length) / 2);
      for (let i = 0; i < tn; i++) put(tx + i, ty, tag[i], 200, 205, 220, 0.12);
      if (lt > 2.1 && tn < tag.length) put(tx + tn, ty, '█', 255, 207, 90, 0.5);
      if (lt > 2.6 && !this.menuShown) { this.menuShown = true; this.onMenu && this.onMenu(); }
      // subtle horizon line
      const hy = ty + 3;
      if (lt > 2.4) for (let x = 0; x < cols; x++) {
        const k = 1 - Math.abs(x - cols / 2) / (cols / 2);
        put(x, hy, '─', 60 * k + 10, 70 * k + 10, 90 * k + 20, 0.05);
      }
    }
    G.glitch = Math.max(0, G.glitch - dt * 1.5);
    G.flash = Math.max(0, G.flash - dt * 1.4);
  }
}
