// ─── compose.js ── builds the per-frame glyph buffer from the world ────────
import { G } from './state.js';
import { E, LUT_G, LUT_FG, LUT_BG, MIX, EMIT, SP, MAT } from './elements.js';
import { gi, gs } from './glyphs.js';
import { skyPalette } from './weather.js';
import { fbm1, hash2, clamp, smooth } from './util.js';
import { TILE, FX_TILE, fam, RIDGE } from './tiles.js';

const SELF = 15 * 16 + 15; // fg & bg ignore lighting
const SELF_BG = 15;        // only bg ignores lighting

let R; // renderer buffers
let FG, BG, EM, TI, LF, cols, rows;
let PIX = true; // pixel-art tiles (true) or the original glyph look
const farH = new Float32Array(2048);
const nearH = new Float32Array(2048);
let skyRows = null;

const g = {
  space: gi(' '), dot: gi('.'), mid: gi('·'), plus: gi('+'), star: gi('*'), spark: gi('✦'),
  full: gi('█'), dk: gi('▓'), md: gi('▒'), lt: gi('░'), lower: gi('▄'), upper: gi('▀'),
  slash: gi('/'), bslash: gi('\\'), caret: gi('^'), under: gi('_'), tri: gi('▲'),
  wave: gs('~≈∼~-≈'), vbar: gi('│'), dvbar: gi('║'), fs: gi('╱'), bs: gi('╲'),
  rain: gs("|'|,"), fire: gs('^*"\'`,^'), lava: gs('≈∼~≈'), lavaTop: gs('^~∼'),
  aur: gs('│¦|:│'), birdUp: gi('^'), birdDn: gi('v'), fishR: gi('>'), fishL: gi('<'),
  bfly: gs('жЖ'), fly: gs('·•'), crop: gs('.,iψΨ'), snowFall: gs('*·∙*'), glitch: gs('#$%&@?!<>/\\|{}01▚▞░▒'),
  pine: gs('▲^Λ▲'), palm: gs('~╱╲~'), cherry: gs('*✿❀*♣'), leaf: gs('♣♠*&%♣'),
  paren: gs('()'), ghost: gi('†'), smile: gi('☺'), smileB: gi('☻'),
};

// ── pixel-art tile tables ──────────────────────────────────────────────────
const TL = {
  dirt: fam('dirt', 4), stone: fam('stone', 4), bedrock: fam('bedrock', 2), sand: fam('sand', 4), grass: fam('grass', 4),
  snow: fam('snow', 2), ice: fam('ice', 2), metal: fam('metal', 2), gold: fam('gold', 2), obsidian: fam('obsidian', 2),
  crystal: fam('crystal', 2), ash: fam('ash', 2), ember: fam('ember', 2), bark: fam('bark', 2), leaf: fam('leaf', 4),
  pine: fam('pine', 2), frond: fam('frond', 2), wave: fam('wave', 3), rain: fam('rain', 4), lava: fam('lava', 3),
  lavaTop: fam('lavaTop', 3), flame: fam('flame', 4), puff: fam('puff', 3), cloudMid: fam('cloudMid', 2),
  cloudLight: fam('cloudLight', 2), glitch: fam('glitch', 4), tuft: fam('tuft', 3), flower: fam('flower', 4),
  sapling: fam('sapling', 2), crop: fam('crop', 5), shroom: fam('shroom', 2),
};
// textured matter: tiles picked by the cell's random byte, rim style
const TEX = [], RIM = new Uint8Array(64);
const tex = (e, list, rim = 1) => { TEX[e] = list; RIM[e] = rim; };
tex(E.DIRT, TL.dirt); tex(E.STONE, TL.stone); tex(E.BEDROCK, TL.bedrock); tex(E.SAND, TL.sand); tex(E.GRASS, TL.grass);
tex(E.SNOW, TL.snow); tex(E.ICE, TL.ice); tex(E.METAL, TL.metal); tex(E.GOLD, TL.gold); tex(E.OBSIDIAN, TL.obsidian);
tex(E.CRYSTAL, TL.crystal); tex(E.ASH, TL.ash); tex(E.EMBER, TL.ember); tex(E.GUNPOWDER, [TILE.powder]);
tex(E.TNT, [TILE.tnt]); tex(E.STARSTONE, [TILE.starstone]); tex(E.GLASS, [TILE.glass], 0);
// neighbours that leave a side of solid matter exposed
const OPEN = new Uint8Array(64);
for (const e of [E.EMPTY, E.SMOKE, E.STEAM, E.FIRE, E.CLOUD, E.BOLT, E.PLANT, E.FLOWER, E.SAPLING, E.CROP, E.SEED, E.BIRD, E.BUTTERFLY, E.FIREFLY, E.TORCH, E.SHROOM, E.LEAF, E.WATER, E.OIL, E.ACID, E.LAVA, E.FISH, E.GLITCH]) OPEN[e] = 1;
const SLOPED = new Uint8Array(64);
for (const e of [E.DIRT, E.GRASS, E.SAND, E.SNOW, E.ASH]) SLOPED[e] = 1;
const G_LR = gi('◢'), G_LL = gi('◣');
// buildings: wall texture per material, shapes per glyph, partial shapes see the sky
const STRUCT_TEX = new Uint8Array(16);
STRUCT_TEX[MAT.WOOD] = TILE.planks; STRUCT_TEX[MAT.DOOR] = TILE.planks; STRUCT_TEX[MAT.STONE] = TILE.blocks;
STRUCT_TEX[MAT.BRICK] = TILE.bricks; STRUCT_TEX[MAT.ROOF] = TILE.shingles; STRUCT_TEX[MAT.CLOTH] = TILE.weave;
STRUCT_TEX[MAT.METAL] = TILE.panel; STRUCT_TEX[MAT.HULL] = TILE.panel; STRUCT_TEX[MAT.GOLD] = TILE.panel;
const WALL = new Uint8Array(256);
for (const ch of '█▓▒') WALL[gi(ch)] = 1;
const STRUCT_SHAPE = new Uint8Array(256);
for (const [ch, name] of [['□', 'window'], ['∩', 'door'], ['▪', 'pane'], ['○', 'roundWin'], ['≡', 'vent'], ['¦', 'fence'], ['│', 'pole'], ['▲', 'spire'], ['✦', 'sparkle'], ['¡', 'torch'], ['ψ', 'crop4']]) STRUCT_SHAPE[gi(ch)] = TILE[name];
const PARTIAL = new Uint8Array(256);
for (const ch of '◢◣◤◥▄▀▲╱╲▖▗▘▝') PARTIAL[gi(ch)] = 1;
const SKY_TILE = new Uint8Array(256);
SKY_TILE[g.dot] = TILE.dot1; SKY_TILE[g.mid] = TILE.dot1; SKY_TILE[g.plus] = TILE.plus;
SKY_TILE[g.star] = TILE.sparkleS; SKY_TILE[g.spark] = TILE.sparkle;
for (const k of g.aur) SKY_TILE[k] = TILE.strand;

// coverage of a cell by a mountain range: -1 none, 64 full, else a RIDGE key
function ridgeCov(H, lx, ly, base) {
  const h0 = H[lx & 2047];
  const c = (h) => clamp(ly + 1 - (base - h), 0, 1);
  const l = c((H[(lx - 1) & 2047] + h0) / 2), m = c(h0), r = c((h0 + H[(lx + 1) & 2047]) / 2);
  if (l >= 1 && m >= 1 && r >= 1) return 64;
  if (l <= 0 && m <= 0 && r <= 0) return -1;
  return Math.round(l * 3) * 16 + Math.round(m * 3) * 4 + Math.round(r * 3);
}

export function initCompose(renderer, seed) {
  R = renderer;
  ranges(farH, seed + 101, 7, 19, 0.5, 0.95, 26);
  ranges(nearH, seed + 202, 3, 11, 0.6, 1.1, 18);
}

// classic ASCII mountain ranges: overlapping tents with continuous slopes
function ranges(out, s, hmin, hmax, smin, smax, gap) {
  out.fill(-99);
  let x = 0;
  let k = 0;
  while (x < 2048 + 60) {
    const hgt = hmin + hash2(k, 1, s) * (hmax - hmin);
    const sl = smin + hash2(k, 2, s) * (smax - smin);
    const span = Math.ceil(hgt / sl);
    for (let dx = -span; dx <= span; dx++) {
      const xx = (x + dx + 2048) & 2047;
      const v = hgt - Math.abs(dx) * sl + (hash2(xx, 3, s) - 0.5) * 0.6;
      if (v > out[xx]) out[xx] = v;
    }
    x += 6 + hash2(k, 4, s) * gap;
    k++;
  }
}

// colour helpers writing straight into the buffers
function put(o, gl, fr, fgc, fb, br, bgc, bb, self, er, eg, eb, sky, ti = 0, bits = 0, rim = 0) {
  TI[o] = ti; TI[o + 1] = bits; TI[o + 2] = rim; TI[o + 3] = 0;
  FG[o] = fr; FG[o + 1] = fgc; FG[o + 2] = fb; FG[o + 3] = gl;
  BG[o] = br; BG[o + 1] = bgc; BG[o + 2] = bb; BG[o + 3] = self;
  EM[o] = er; EM[o + 1] = eg; EM[o + 2] = eb; EM[o + 3] = sky;
}

const shoot = []; // shooting stars (screen space)
let lastFrameT = 0;

export function compose(view, time) {
  const W = G.world, env = G.env;
  FG = R.fg; BG = R.bg; EM = R.em; TI = R.ti; cols = R.cols; rows = R.rows;
  PIX = G.settings.pixel !== false;
  LF = R.leaf;
  LF.fill(0);
  const { w, h, t, d, v, a, c } = W;
  const ox = view.ox, oy = view.oy;
  const pal = skyPalette(env);
  view.amb = pal.amb;
  const night = 1 - env.daylight;
  const frame = Math.floor(time * 12);
  const dtF = Math.min(0.1, time - lastFrameT);
  lastFrameT = time;

  // visible surface
  W.computeSurface(ox - 1, ox + cols + 2);
  const surf = W.surf;

  // per-row sky gradient (world rows)
  if (!skyRows || skyRows.length < rows * 3) skyRows = new Float32Array(rows * 3 + 3);
  const horizonW = W.sea + 4;
  for (let vy = 0; vy < rows; vy++) {
    const wy = oy + vy;
    const f = clamp(wy / horizonW, 0, 1) ** 1.4;
    skyRows[vy * 3] = pal.top[0] + (pal.hor[0] - pal.top[0]) * f;
    skyRows[vy * 3 + 1] = pal.top[1] + (pal.hor[1] - pal.top[1]) * f;
    skyRows[vy * 3 + 2] = pal.top[2] + (pal.hor[2] - pal.top[2]) * f;
  }

  // sun & moon in screen space
  const horRow = W.sea - oy - 2;
  const sunU = (env.tod - 0.22) / 0.56;
  const moonU = ((env.tod + 0.5) % 1 - 0.22) / 0.56;
  const sunX = sunU * cols, sunY = horRow - Math.max(-0.2, env.sunElev) * (horRow - 3) * 0.95;
  const moonElev = -env.sunElev;
  const moonX = moonU * cols, moonY = horRow - Math.max(-0.2, moonElev) * (horRow - 3) * 0.95;
  const sunR = 3.2, moonR = 2.6;
  const camY0 = view.camY0;
  const pfF = 0.2, pfN = 0.45;
  const fShiftY = (view.camY - camY0) * (1 - pfF);
  const nShiftY = (view.camY - camY0) * (1 - pfN);
  const fx0 = Math.floor(view.camX * pfF), nx0 = Math.floor(view.camX * pfN);
  const farBase = W.sea - 13, nearBase = W.sea - 6;
  const starAmt = smooth(0.35, 0.9, night) * (1 - env.cover * 0.9);
  const auroraAmt = env.aurora;
  const rainbow = env.rainbow;
  const rbCX = cols * 0.5, rbCY = horRow + 6, rbR = Math.min(cols * 0.42, 70);

  // in pixel mode the sun and moon are smooth discs drawn by the shader
  view.sun = [sunX + 0.5, sunY + 0.5, sunR * 1.05, env.sunElev > -0.25 ? 1 : 0];
  view.moon = [moonX + 0.5, moonY + 0.5, moonR * 1.05, moonElev > -0.25 ? ((env.day % 8) / 8) * 2 - 1 : 9];
  view.ecl = env.eclipse || 0;

  // shooting stars
  if (starAmt > 0.3 && Math.random() < dtF * 0.25) {
    shoot.push({ x: Math.random() * cols, y: Math.random() * horRow * 0.5, vx: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 25), vy: 8 + Math.random() * 8, life: 0.6 + Math.random() * 0.5 });
  }

  // falling water (rain, waterfalls in mid-air): flag per visible cell, bottom-up
  const nCells = cols * rows;
  if (!view.fall || view.fall.length < nCells) view.fall = new Uint8Array(nCells + 4096);
  const fallF = view.fall;
  for (let vx = 0; vx < cols; vx++) {
    const wx = ox + vx;
    let below = 0;
    if (wx < 1 || wx >= w - 1) { for (let vy = 0; vy < rows; vy++) fallF[vy * cols + vx] = 0; continue; }
    {
      // seed from the cell just under the viewport
      let y = oy + rows;
      let f = 0;
      if (y < h - 1) {
        let yy = y;
        while (yy < h - 1 && t[yy * w + wx] === E.WATER) yy++;
        const tb = t[yy * w + wx];
        f = yy > y && (tb === 0 || tb === E.CLOUD) ? 1 : 0;
        below = t[y * w + wx] === E.WATER ? f : 0;
        if (t[y * w + wx] === 0 || t[y * w + wx] === E.CLOUD) below = 2;
      }
    }
    for (let vy = rows - 1; vy >= 0; vy--) {
      const wy = oy + vy;
      let f = 0;
      if (wy > 0 && wy < h - 1) {
        const tt = t[wy * w + wx];
        if (tt === E.WATER) f = below >= 1 ? 1 : 0;
        below = tt === E.WATER ? f : tt === 0 || tt === E.CLOUD ? 2 : 0;
      }
      fallF[vy * cols + vx] = f;
    }
  }

  // water depth per column (count water above viewport top)
  const run = view.run || (view.run = new Int16Array(4096));
  for (let vx = 0; vx < cols; vx++) {
    const wx = ox + vx;
    let n = 0;
    if (wx >= 0 && wx < w) for (let y = oy - 1; y >= 0 && n < 40; y--) {
      const tt = t[y * w + wx];
      if (tt === E.WATER || tt === E.FISH) n++;
      else break;
    }
    run[vx] = n;
  }

  const season = env.season;
  const cloudTint = [
    pal.hor[0] * 0.4 + 255 * 0.6 * env.daylight + 50 * night,
    pal.hor[1] * 0.4 + 255 * 0.6 * env.daylight + 56 * night,
    pal.hor[2] * 0.4 + 255 * 0.6 * env.daylight + 80 * night,
  ];
  const ambR = Math.min(255, pal.amb[0] * 255), ambG = Math.min(255, pal.amb[1] * 255), ambB = Math.min(255, pal.amb[2] * 255);
  const reveal = G.reveal;
  const vcount = view.counts;

  for (let vy = 0; vy < rows; vy++) {
    const wy = oy + vy;
    const sr = skyRows[vy * 3], sg = skyRows[vy * 3 + 1], sb = skyRows[vy * 3 + 2];
    for (let vx = 0; vx < cols; vx++) {
      const wx = ox + vx;
      const o = (vy * cols + vx) * 4;
      if (wx < 0 || wy < 0 || wx >= w || wy >= h) {
        put(o, g.space, 0, 0, 0, 2, 2, 4, SELF, 0, 0, 0, 0);
        continue;
      }
      const i = wy * w + wx;
      let tt = t[i];
      const above = wy < surf[wx];
      const skyBack = wy <= surf[wx];
      if (tt === E.BEDROCK && above) tt = 0;
      const falling = fallF[vy * cols + vx] === 1;
      if (tt === E.FISH || (tt === E.WATER && !falling)) run[vx]++;
      else run[vx] = 0;

      // ── backdrop (sky / cave) ──
      let br, bgc, bb, bgl = g.space, bfr = 0, bfg = 0, bfb = 0, bself = SELF, sky = 0, bem = 0, bti = 0, openSky = 0;
      const mix = tt === 0 ? 1 : MIX[tt];
      {
        if (skyBack) {
          br = sr; bgc = sg; bb = sb; sky = above ? 255 : 0; openSky = 1;
          // stars
          if (starAmt > 0.01) {
            const hs = hash2(vx + Math.floor(view.camX * 0.04), vy + Math.floor(view.camY * 0.04), 7);
            if (hs < 0.03) {
              const tw = 0.6 + 0.4 * Math.sin(time * (1.5 + hs * 200) + hs * 1000);
              const b = starAmt * tw * (0.75 + hs * 12);
              bgl = hs < 0.0015 ? g.spark : hs < 0.005 ? g.star : hs < 0.011 ? g.plus : hs < 0.02 ? g.mid : g.dot;
              bem = (hs < 0.011 ? 0.6 : 0.2) * b;
              const tint = hash2(Math.floor(hs * 1e6), 3, 1);
              bfr = (200 + tint * 55) * b + br; bfg = 215 * b + bgc; bfb = (255 - tint * 60) * b + bb;
            }
          }
          // aurora curtains
          if (auroraAmt > 0.02 && wy < horizonW - 16) {
            const lx = vx + view.camX * 0.1;
            const curtain = smooth(0.0, 0.7, fbm1(lx * 0.035 + time * 0.05, 3, 5) + 0.25 * Math.sin(lx * 0.11 + time * 0.7));
            const yTop = 3 + 6 * (fbm1(lx * 0.02 - time * 0.03, 2, 9) + 1);
            const ry = wy - yTop;
            if (ry > 0 && curtain > 0.01) {
              const fall = Math.exp(-ry / 9) * curtain * auroraAmt;
              const hue = clamp(ry / 14, 0, 1);
              const ar = 60 + 180 * (1 - hue), ag = 255 * hue + 60, ab = 140 + 80 * (1 - hue);
              br += ar * fall * 0.35; bgc += ag * fall * 0.35; bb += ab * fall * 0.35;
              if (fall > 0.15 && bgl === g.space) {
                bgl = g.aur[(Math.floor(lx * 3 + time * 2) & 7) % g.aur.length];
                bfr = br + ar * fall; bfg = bgc + ag * fall; bfb = bb + ab * fall;
                bem = 0.5 * fall;
              }
            }
          }
          // rainbow
          if (rainbow > 0.01) {
            const dx = vx - rbCX, dy = (vy - rbCY) * 1.7;
            const dist = Math.sqrt(dx * dx + dy * dy) - rbR;
            if (dist > 0 && dist < 7 && dy < 0) {
              const band = Math.floor(dist);
              const RB = [[255, 60, 60], [255, 150, 40], [255, 230, 60], [80, 220, 90], [60, 160, 255], [90, 80, 220], [170, 90, 230]][6 - band];
              const k = rainbow * 0.38 * smooth(0, 6, -dy);
              br += (RB[0] - br) * k; bgc += (RB[1] - bgc) * k; bb += (RB[2] - bb) * k;
            }
          }
          // sun
          let dxs = (vx - sunX) / sunR, dys = (vy - sunY) * 1.6 / sunR;
          let ds = Math.sqrt(dxs * dxs + dys * dys);
          if (ds < 4 && env.sunElev > -0.25) {
            const halo = Math.max(0, 1 - ds / 4) ** 2 * 0.5 * (1 - env.cover * 0.6);
            br += 255 * halo; bgc += 200 * halo; bb += 120 * halo;
            if (ds < 1.05) {
              const ec = env.eclipse;
              const core = ds < 0.55 ? g.full : ds < 0.78 ? g.dk : ds < 0.92 ? g.md : g.lt;
              const ecl = ec > 0 && ds < 0.95 * ec ? 1 : 0;
              bgl = PIX ? g.space : ecl ? g.full : core;
              bfr = ecl ? 10 : 255; bfg = ecl ? 8 : 238 - ds * 50; bfb = ecl ? 16 : 170 - ds * 90;
              bem = ecl ? 0 : 0.85 * (1 - env.cover * 0.5);
            }
          }
          // moon
          dxs = (vx - moonX) / moonR; dys = (vy - moonY) * 1.6 / moonR;
          ds = Math.sqrt(dxs * dxs + dys * dys);
          if (ds < 3 && moonElev > -0.25) {
            const halo = Math.max(0, 1 - ds / 3) ** 2 * 0.18 * night;
            br += 160 * halo; bgc += 180 * halo; bb += 230 * halo;
            if (ds < 1.05) {
              const ph = ((env.day % 8) / 8) * 2 - 1;
              const sdx = dxs - ph * 1.3, sd = Math.sqrt(sdx * sdx + dys * dys);
              if (sd > 0.9 || Math.abs(ph) < 0.15) {
                bgl = PIX ? g.space : ds < 0.6 ? g.full : ds < 0.85 ? g.dk : g.md;
                bfr = 225; bfg = 230; bfb = 250;
                bem = 0.25;
              }
            }
          }
          // shooting star trails
          for (const s of shoot) {
            const ddx = vx - s.x, ddy = vy - s.y;
            if (Math.abs(ddy) < 0.6 && Math.abs(ddx) < 6 && Math.sign(ddx) === -Math.sign(s.vx)) {
              const k = (1 - Math.abs(ddx) / 6) * Math.min(1, s.life * 2) * starAmt;
              bgl = Math.abs(ddx) < 1 ? g.star : s.vx > 0 ? g.bs : g.fs;
              bfr = br + 255 * k; bfg = bgc + 245 * k; bfb = bb + 220 * k;
              bem = 0.8 * k;
            }
          }
          // parallax mountains
          const lyF = wy - fShiftY, lxF = (vx + fx0) & 2047;
          const hF = farH[lxF], topF = farBase - hF;
          const lyN = wy - nShiftY, lxN = (vx + nx0) & 2047;
          const hN = nearH[lxN], topN = nearBase - hN;
          if (PIX) {
            // smooth silhouettes: the ridge line is sampled at both edges and the middle of the cell
            const nc = ridgeCov(nearH, lxN, lyN, nearBase);
            const fc = nc === 64 ? -1 : ridgeCov(farH, lxF, lyF, farBase);
            if (nc >= 0 || fc >= 0) {
              bem = 0; bgl = g.space; openSky = 0;
              const kn = 0.66, kf = 0.42;
              const nR = br * (1 - kn) + (sr * 0.3 + 14) * kn, nG = bgc * (1 - kn) + (sg * 0.3 + 14) * kn, nB = bb * (1 - kn) + (sb * 0.38 + 24) * kn;
              const fR = br * (1 - kf) + (sr * 0.55 + 20) * kf, fG = bgc * (1 - kf) + (sg * 0.55 + 22) * kf, fB = bb * (1 - kf) + (sb * 0.62 + 36) * kf;
              if (nc === 64) { br = nR; bgc = nG; bb = nB; }
              else {
                if (fc === 64) { br = fR; bgc = fG; bb = fB; }
                if (nc >= 0) { bti = RIDGE[nc]; bfr = nR; bfg = nG; bfb = nB; }
                else if (fc >= 0 && fc < 64) { bti = RIDGE[fc]; bfr = fR; bfg = fG; bfb = fB; }
              }
            }
          } else {
            if (lyN >= Math.floor(topN)) {
              const k = 0.66;
              br = br * (1 - k) + (sr * 0.3 + 14) * k; bgc = bgc * (1 - k) + (sg * 0.3 + 14) * k; bb = bb * (1 - k) + (sb * 0.38 + 24) * k;
              bem = 0;
              if (lyN - Math.floor(topN) < 1) {
                const dl = nearH[(lxN - 1) & 2047], dr = nearH[(lxN + 1) & 2047];
                bgl = dl < hN && dr < hN ? g.caret : dr > dl ? g.slash : g.bslash;
                const lit = 26 + 40 * env.daylight;
                bfr = br + lit; bfg = bgc + lit; bfb = bb + lit + 12;
              } else if (hash2(lxN, Math.floor(lyN), 3) < 0.05) {
                bgl = g.dot; bfr = br + 18; bfg = bgc + 18; bfb = bb + 24;
              } else bgl = g.space;
            } else if (lyF >= Math.floor(topF)) {
              const k = 0.42;
              br = br * (1 - k) + (sr * 0.55 + 20) * k; bgc = bgc * (1 - k) + (sg * 0.55 + 22) * k; bb = bb * (1 - k) + (sb * 0.62 + 36) * k;
              bem = 0;
              const depth = lyF - Math.floor(topF);
              if (depth < 1) {
                const dl = farH[(lxF - 1) & 2047], dr = farH[(lxF + 1) & 2047];
                bgl = dl < hF && dr < hF ? g.caret : dr > dl ? g.slash : g.bslash;
                const snow = hF > 13 ? 70 : 24;
                bfr = br + snow; bfg = bgc + snow; bfb = bb + snow + 14;
              } else if (hF > 13 && depth < 2.5) {
                bgl = hash2(lxF, Math.floor(lyF), 5) < 0.5 ? g.dot : g.mid;
                bfr = br + 50; bfg = bgc + 52; bfb = bb + 60;
              } else { bgl = g.space; }
            }
          }
        } else {
          // cave air
          const hv = hash2(wx, wy, 11);
          br = 10 + hv * 4; bgc = 9 + hv * 3; bb = 14 + hv * 5;
          bself = 0;
          if (hv < 0.02) { bgl = g.dot; bfr = 40; bfg = 36; bfb = 48; }
        }
      }

      if (tt === 0) {
        put(o, bgl, bfr, bfg, bfb, br, bgc, bb, bself, bfr * bem, bfg * bem, bfb * bem, sky, PIX ? bti || SKY_TILE[bgl] : 0, PIX ? openSky : 0);
        if (reveal < 1) revealFx(o, wx, wy, reveal, time);
        continue;
      }

      // ── matter ──
      vcount[tt]++;
      const vv = v[i];
      const L = tt * 256 + vv;
      let gl = LUT_G[L];
      const lo = L * 3;
      let fr = LUT_FG[lo], fgc = LUT_FG[lo + 1], fb = LUT_FG[lo + 2];
      let r2 = LUT_BG[lo], g2 = LUT_BG[lo + 1], b2 = LUT_BG[lo + 2];
      let self = 0;
      let er = EMIT[tt * 3], eg = EMIT[tt * 3 + 1], eb = EMIT[tt * 3 + 2];
      let skyC = 0;

      switch (tt) {
        case E.GRASS: {
          const up = t[i - w];
          if (season === 2) { fr = 170; fgc = 160; fb = 60; }
          else if (season === 3) { fr = 140; fgc = 150; fb = 110; }
          else if (season === 0) { fr = 110; fgc = 210; fb = 80; }
          fr += (vv & 15) - 8; fgc += ((vv >> 4) & 15) - 8;
          if (up === E.SNOW) { gl = g.lt; fr = 230; fgc = 236; fb = 245; }
          break;
        }
        case E.WATER: case E.FISH: {
          const depth = run[vx];
          const dk = Math.min(1, depth / 22);
          r2 = 26 - 20 * dk; g2 = 86 - 62 * dk; b2 = 176 - 104 * dk;
          const caust = depth < 6 ? Math.sin(wx * 0.9 + time * 2.2 + Math.sin(wy * 1.3 + time)) * 10 * (1 - depth / 6) : 0;
          r2 += caust; g2 += caust; b2 += caust * 1.2;
          if (tt === E.FISH) {
            gl = a[i] & 1 ? g.fishR : g.fishL;
            break;
          }
          if (falling || depth <= 1) {
            if (falling) {
              // falling drop
              gl = g.rain[(vv + frame) & 3];
              vcount[64 + E.WATER]++;
              fr = 150; fgc = 196; fb = 255;
              r2 = br; g2 = bgc; b2 = bb; skyC = sky;
              self = SELF_BG;
            } else {
              const ph = Math.floor(wx * 0.6 + time * 2.4 + Math.sin(wx * 0.37 + time * 0.8) * 2);
              gl = g.wave[((ph % 6) + 6) % 6];
              fr = 150 + pal.hor[0] * 0.35; fgc = 200 + pal.hor[1] * 0.2; fb = 255;
              r2 = 40; g2 = 104; b2 = 196;
            }
          } else if (((wx * 7 + wy * 13 + Math.floor(time * 1.5 + wx * 0.2)) % 23) === 0) {
            gl = g.wave[1];
            fr = r2 + 40; fgc = g2 + 50; fb = b2 + 60;
          } else {
            gl = g.space;
          }
          if (c[i]) { gl = g.plus; fr = 230; fgc = 245; fb = 255; er = 0.5; eg = 0.7; eb = 1; self = SELF; }
          break;
        }
        case E.LAVA: {
          const ph = Math.sin(wx * 0.45 + time * 1.6 + Math.sin(wy * 0.7 + time * 0.9) * 1.8);
          const top = t[i - w] !== E.LAVA;
          gl = top ? g.lavaTop[(vv + frame) % 3] : g.lava[(Math.floor(wx * 0.5 + time * 1.2) + vv) & 3];
          fr = 255; fgc = 200 + ph * 40; fb = 80 + ph * 40;
          r2 = 205 + ph * 30; g2 = 62 + ph * 26; b2 = 12;
          self = SELF;
          break;
        }
        case E.FIRE: {
          const life = d[i] / 60;
          gl = g.fire[(vv + frame + (i & 7)) % 7];
          fr = 255; fgc = 120 + Math.min(1, life) * 130; fb = 40 + Math.min(1, life) * 80;
          r2 = br * 0.82 + 34; g2 = bgc * 0.82 + 8; b2 = bb * 0.82;
          if (!above) { r2 = 60; g2 = 18; b2 = 6; }
          self = SELF;
          skyC = sky;
          break;
        }
        case E.SMOKE: case E.STEAM: {
          const k = Math.min(1, d[i] / 90) * (tt === E.SMOKE ? 0.32 : 0.22);
          r2 = br + (r2 - br) * k; g2 = bgc + (g2 - bgc) * k; b2 = bb + (b2 - bb) * k;
          const kk = Math.min(1, d[i] / 50);
          fr = r2 + (fr - r2) * kk; fgc = g2 + (fgc - g2) * kk; fb = b2 + (fb - b2) * kk;
          self = above ? SELF_BG : 0;
          skyC = sky;
          break;
        }
        case E.WOOD: {
          const sp = a[i] & 7;
          const up = t[i - w], dn = t[i + w];
          const vert = up === E.WOOD || dn === E.WOOD || up === E.SAPLING;
          if (!vert || a[i] & 8) {
            if (t[i + w - 1] === E.WOOD || t[i - w + 1] === E.WOOD) gl = g.fs;
            else if (t[i + w + 1] === E.WOOD || t[i - w - 1] === E.WOOD) gl = g.bs;
            else gl = vert ? g.vbar : g.dvbar;
          } else gl = sp === SP.PALM ? g.paren[(wy >> 1) & 1] : sp === SP.PINE ? g.vbar : g.dvbar;
          if (sp === SP.BIRCH) { fr = 228; fgc = 222; fb = 210; r2 = 112; g2 = 106; b2 = 96; if (((wy * 3 + wx) & 3) === 0) gl = gi('═'); }
          else if (sp === SP.PALM) { fr = 196; fgc = 150; fb = 84; r2 = 90; g2 = 62; b2 = 30; }
          if (gl === g.fs || gl === g.bs) { r2 = br; g2 = bgc; b2 = bb; self = above ? SELF_BG : 0; skyC = sky; }
          break;
        }
        case E.LEAF: {
          const sp = a[i] & 7;
          const hv = vv / 255;
          let cr = 70, cg = 160, cb = 62;
          if (sp === SP.PINE) { cr = 40; cg = 120; cb = 70; gl = g.pine[vv & 3]; }
          else if (sp === SP.PALM) { cr = 90; cg = 190; cb = 70; gl = g.palm[vv & 3]; }
          else if (sp === SP.CHERRY && season === 0) { cr = 255; cg = 150 + hv * (PIX ? 14 : 50); cb = 200; gl = g.cherry[vv % 5]; }
          else if (sp === SP.BIRCH) { cr = 140; cg = 200; cb = 70; }
          if (sp !== SP.PINE && sp !== SP.PALM) {
            if (season === 0 && sp !== SP.CHERRY) { cr += 30; cg += 40; }
            if (season === 2) {
              const k = vv % 3;
              cr = k === 0 ? 235 : k === 1 ? 220 : 180; cg = k === 0 ? 120 : k === 1 ? 180 : 60; cb = 40;
            } else if (season === 3) { cr = 150; cg = 120; cb = 80; }
          }
          const jv = PIX ? 0.3 : 1;
          fr = cr + (hv - 0.5) * 30 * jv; fgc = cg + (hv - 0.5) * 40 * jv; fb = cb;
          r2 = fr * 0.22; g2 = fgc * 0.24; b2 = fb * 0.22;
          if (season === 3 && t[i - w] === 0) { fr = 230; fgc = 236; fb = 245; }
          const sway = Math.sin(time * 1.3 + wx * 0.4) * env.wind;
          if (sway > 0.25 && (vv & 7) === 0) gl = g.leaf[(vv + 1) % 6];
          if (above) {
            const k = sp === SP.PINE ? 0.35 : 0.55;
            r2 = r2 * (1 - k) + br * k * 0.6; g2 = g2 * (1 - k) + bgc * k * 0.6; b2 = b2 * (1 - k) + bb * k * 0.6;
          }
          break;
        }
        case E.SNOW:
          if (t[i + w] === 0) {
            gl = g.snowFall[vv & 3]; fr = 240; fgc = 245; fb = 255;
            r2 = br; g2 = bgc; b2 = bb; self = above ? SELF_BG : 0; skyC = sky;
          } else if (t[i - w] === 0 || t[i - w] === E.CLOUD) {
            gl = g.lower; fr = 240; fgc = 244; fb = 252;
            if (skyBack) { r2 = br; g2 = bgc; b2 = bb; self = SELF_BG; } else { r2 = 12; g2 = 11; b2 = 16; }
          }
          break;
        case E.CLOUD: {
          let n = 0;
          if (t[i - 1] === E.CLOUD) n++;
          if (t[i + 1] === E.CLOUD) n++;
          if (t[i - w] === E.CLOUD) n++;
          if (t[i + w] === E.CLOUD) n++;
          gl = n >= 4 ? (vv & 1 ? g.dk : g.md) : n >= 2 ? g.md : g.lt;
          const storm = a[i] & 2 || env.storm;
          const wet = a[i] & 1 || env.raining;
          const dark = storm ? 0.42 : wet ? 0.72 : 1;
          fr = cloudTint[0] * dark; fgc = cloudTint[1] * dark; fb = cloudTint[2] * dark * 1.02;
          if (storm || wet) {
            // rain clouds turn slate grey rather than brown
            const lum = fr * 0.3 + fgc * 0.59 + fb * 0.11, kk = storm ? 0.6 : 0.35;
            fr += (lum * 0.95 - fr) * kk; fgc += (lum - fgc) * kk; fb += (lum * 1.12 - fb) * kk;
          }
          const k = 0.55;
          r2 = br * (1 - k) + fr * 0.8 * k; g2 = bgc * (1 - k) + fgc * 0.8 * k; b2 = bb * (1 - k) + fb * 0.8 * k;
          self = SELF; skyC = sky;
          break;
        }
        case E.BOLT: {
          const dir = a[i];
          gl = dir === 1 ? g.bs : dir === 2 ? g.fs : g.vbar;
          fr = 240; fgc = 248; fb = 255;
          r2 = br * 0.5 + 120; g2 = bgc * 0.5 + 140; b2 = bb * 0.5 + 200;
          self = SELF; skyC = sky;
          break;
        }
        case E.GLITCH: {
          const hq = hash2(i, frame, 13);
          gl = g.glitch[Math.floor(hq * g.glitch.length)];
          const pc = Math.floor(hq * 97) % 4;
          fr = [255, 40, 240, 255][pc]; fgc = [40, 255, 240, 255][pc]; fb = [140, 220, 80, 255][pc];
          r2 = hq < 0.5 ? 60 : 10; g2 = 0; b2 = hq < 0.5 ? 50 : 60;
          self = SELF;
          break;
        }
        case E.BIRD:
          gl = ((frame + vv) & 2) ? g.birdUp : g.birdDn;
          fr = 30 + night * 70; fgc = 30 + night * 70; fb = 40 + night * 80;
          break;
        case E.BUTTERFLY:
          gl = g.bfly[(frame + vv) & 1];
          break;
        case E.FIREFLY: {
          const b = 0.5 + 0.5 * Math.sin(time * 3 + vv);
          gl = g.fly[b > 0.6 ? 1 : 0];
          fr = 200 + 55 * b; fgc = 255; fb = 110 * b;
          er *= b; eg *= b; eb *= b;
          self = SELF;
          break;
        }
        case E.STRUCT:
          gl = d[i];
          structLook(i, vv, a[i], night, time);
          fr = SL[0]; fgc = SL[1]; fb = SL[2]; r2 = SL[3]; g2 = SL[4]; b2 = SL[5];
          er = SL[6]; eg = SL[7]; eb = SL[8]; self = SL[9];
          if (vv === MAT.FLAME) {
            // campfire: dancing flame over the backdrop
            gl = g.fire[(frame + (i & 3)) % 7];
            r2 = br * 0.7 + 50; g2 = bgc * 0.7 + 14; b2 = bb * 0.7;
            skyC = sky;
          }
          break;
        case E.CROP: {
          const st = d[i];
          gl = g.crop[st < 40 ? 0 : st < 90 ? 1 : st < 150 ? 2 : st < 210 ? 3 : 4];
          const ripe = st >= 210;
          fr = ripe ? 236 : 120; fgc = ripe ? 204 : 200; fb = ripe ? 80 : 70;
          break;
        }
        case E.EMBER: {
          const fl = 0.75 + 0.25 * Math.sin(time * 9 + vv);
          fr *= fl; fgc *= fl; r2 *= fl; g2 *= fl;
          er *= fl; eg *= fl; eb *= fl;
          self = SELF;
          break;
        }
        case E.CRYSTAL: case E.STARSTONE: case E.GOLD: case E.SHROOM: {
          const p = 0.7 + 0.3 * Math.sin(time * (tt === E.GOLD ? 2.5 : 1.2) + vv * 0.7);
          if (tt === E.GOLD && p > 0.97) { fr = 255; fgc = 255; fb = 220; er = 0.4; eg = 0.35; eb = 0.1; }
          er *= p; eg *= p; eb *= p;
          if (tt !== E.GOLD) self = SELF_BG * 16;
          break;
        }
        case E.TORCH: {
          const fl = 0.8 + 0.2 * Math.sin(time * 13 + vv) * Math.sin(time * 7.3);
          er *= fl; eg *= fl; eb *= fl;
          self = 240;
          break;
        }
        case E.ICE:
          if (((wx * 5 + wy * 3 + Math.floor(time * 0.7)) % 37) === 0) { fr = 255; fgc = 255; fb = 255; }
          break;
        case E.GLASS:
          if (above) { skyC = sky * 0.5; }
          break;
        default:
          break;
      }

      // ── pixel-art tiles ──
      let ti = 0, bits = 0, rim = 0;
      if (PIX) {
        const list = TEX[tt];
        if (list && !(tt === E.SNOW && gl !== LUT_G[L])) {
          ti = list[vv % list.length];
          rim = RIM[tt];
          if (tt === E.GRASS && t[i - w] === E.SNOW) ti = TL.snow[vv & 1];
          if (rim) {
            bits = (OPEN[t[i - w]] ? 1 : 0) | (OPEN[t[i + 1]] ? 2 : 0) | (OPEN[t[i + w]] ? 4 : 0) | (OPEN[t[i - 1]] ? 8 : 0);
            // a lone step on a hillside becomes a slope
            if (SLOPED[tt] && (bits & 1) && !(bits & 4) && ((bits & 10) === 2 || (bits & 10) === 8)) {
              const k = tt === E.DIRT || tt === E.ASH ? 0.55 : 1;
              fr = r2 + (fr - r2) * k; fgc = g2 + (fgc - g2) * k; fb = b2 + (fb - b2) * k;
              if (tt === E.GRASS && t[i - w] === E.SNOW) { fr = 236; fgc = 240; fb = 248; }
              gl = bits & 8 ? G_LR : G_LL;
              r2 = br; g2 = bgc; b2 = bb; self = bself === SELF ? SELF_BG : 0; skyC = sky;
              ti = 0; rim = 0; bits = 0;
            }
          }
        } else {
          switch (tt) {
            case E.WATER: case E.FISH: case E.ACID: case E.OIL: {
              if (tt === E.FISH) { ti = gl === g.fishR ? TILE.fishR : TILE.fishL; break; }
              if (c[i] && tt === E.WATER) { ti = TILE.plus; break; }
              if (tt === E.WATER && falling) { ti = TL.rain[(vv + frame) & 3]; break; }
              const up = t[i - w];
              if (up !== tt && up !== E.FISH && (up === 0 || OPEN[up])) {
                ti = TL.wave[((Math.floor(wx * 0.6 + time * 2.4) % 3) + 3) % 3]; rim = 3; bits = 1;
              } else if (tt === E.WATER && gl !== g.space) ti = TILE.glint;
              else gl = g.space;
              break;
            }
            case E.LAVA:
              ti = t[i - w] !== E.LAVA ? TL.lavaTop[(vv + frame) % 3] : TL.lava[(vv + (frame >> 2)) % 3];
              break;
            case E.FIRE: ti = TL.flame[(vv + frame + (i & 7)) & 3]; break;
            case E.SMOKE: case E.STEAM: ti = TL.puff[vv % 3]; break;
            case E.WOOD: {
              const sp = a[i] & 7;
              if (gl === g.fs || gl === g.bs) {
                ti = gl === g.fs ? TILE.branchR : TILE.branchL;
                fr *= 0.72; fgc *= 0.72; fb *= 0.72;
              }
              else if (sp === SP.PINE && t[i - 1] === E.LEAF && t[i + 1] === E.LEAF) {
                // a conifer's trunk hides inside its needles
                const sw = season === 3 ? 0.85 : 1;
                fr = 40 * sw; fgc = 120 * sw; fb = 70 * sw; r2 = 20; g2 = 66; b2 = 38;
                ti = TL.pine[(wx + wy) & 1];
              } else {
                ti = sp === SP.PALM ? TILE.palm : sp === SP.BIRCH ? TILE.birch : TL.bark[wx & 1];
                rim = 4; bits = (OPEN[t[i + 1]] && t[i + 1] !== E.LEAF ? 2 : 0) | (OPEN[t[i - 1]] && t[i - 1] !== E.LEAF ? 8 : 0);
              }
              break;
            }
            case E.LEAF: {
              const sp = a[i] & 7;
              const lo = (n) => (OPEN[n] && n !== E.LEAF ? 1 : 0);
              const m = lo(t[i - w]) | (lo(t[i + 1]) << 1) | (lo(t[i + w]) << 2) | (lo(t[i - 1]) << 3);
              if (sp === SP.PINE) {
                // conifers: tiers of needles under a smooth conical outline
                r2 = fr * 0.5; g2 = fgc * 0.55; b2 = fb * 0.55;
                ti = TL.pine[(wx + wy) & 1];
                const isP = (j) => t[j] === E.LEAF && (a[j] & 7) === SP.PINE;
                if (!isP(i - w)) {
                  const top = (xx) => {
                    let j = wy * w + xx;
                    if (isP(j)) { let y = wy; while (y > 1 && isP((y - 1) * w + xx)) y--; return y; }
                    for (let k = 1; k <= 3; k++) if (isP((wy + k) * w + xx)) return wy + k;
                    return wy + 2;
                  };
                  const cl = clamp(wy + 1 - (wy + top(wx - 1)) / 2, 0, 1), cr = clamp(wy + 1 - (wy + top(wx + 1)) / 2, 0, 1);
                  if (cl < 1 || cr < 1) {
                    ti = RIDGE[Math.round(cl * 3) * 16 + 12 + Math.round(cr * 3)];
                    r2 = br; g2 = bgc; b2 = bb; self = bself === SELF ? SELF_BG : 0; skyC = sky;
                  }
                }
              } else if (sp === SP.PALM) {
                ti = TL.frond[vv & 1];
                rim = 2; bits = m;
              } else {
                // broadleaf canopies are drawn by the shader from the leaf map
                LF[o] = fr; LF[o + 1] = fgc; LF[o + 2] = fb; LF[o + 3] = 255;
                gl = g.space;
                r2 = br; g2 = bgc; b2 = bb; self = bself === SELF ? SELF_BG : 0; skyC = sky;
              }
              break;
            }
            case E.SNOW: if (t[i + w] === 0) ti = TILE.dot2; break;
            case E.CLOUD:
              // puffy clouds come from the same smooth field as the canopies
              LF[o] = fr; LF[o + 1] = fgc; LF[o + 2] = fb; LF[o + 3] = 240;
              gl = g.space; r2 = br; g2 = bgc; b2 = bb;
              break;
            case E.BOLT: ti = gl === g.bs ? TILE.boltL : gl === g.fs ? TILE.boltR : TILE.boltV; break;
            case E.GLITCH: ti = TL.glitch[(vv + frame) & 3]; break;
            case E.BIRD: ti = gl === g.birdUp ? TILE.birdUp : TILE.birdDn; break;
            case E.BUTTERFLY: ti = gl === g.bfly[0] ? TILE.bflyA : TILE.bflyB; break;
            case E.FIREFLY: ti = gl === g.fly[1] ? TILE.flyL : TILE.flyS; break;
            case E.WORM: ti = TILE.worm; break;
            case E.SEED: ti = TILE.seed; break;
            case E.PLANT: ti = TL.tuft[vv % 3]; break;
            case E.FLOWER: ti = TL.flower[vv & 3]; break;
            case E.SAPLING: ti = TL.sapling[vv & 1]; break;
            case E.SHROOM: ti = TL.shroom[vv & 1]; break;
            case E.TORCH: ti = TILE.torch; break;
            case E.CROP: {
              const st = d[i];
              ti = TL.crop[st < 40 ? 0 : st < 90 ? 1 : st < 150 ? 2 : st < 210 ? 3 : 4];
              break;
            }
            case E.STRUCT: {
              if (vv === MAT.FLAME) { ti = TL.flame[(frame + (i & 3)) & 3]; break; }
              if (WALL[gl]) {
                ti = STRUCT_TEX[vv] || 0;
                if (ti) {
                  rim = 1;
                  bits = (t[i - w] !== E.STRUCT ? 1 : 0) | (t[i + 1] !== E.STRUCT ? 2 : 0) | (t[i + w] !== E.STRUCT && OPEN[t[i + w]] ? 4 : 0) | (t[i - 1] !== E.STRUCT ? 8 : 0);
                }
              } else if (STRUCT_SHAPE[gl]) ti = STRUCT_SHAPE[gl];
              else if (PARTIAL[gl]) {
                if (gl === g.fs) gl = G_LR; else if (gl === g.bs) gl = G_LL;
                r2 = br; g2 = bgc; b2 = bb; self = (self & 0xf0) | (bself === SELF ? SELF_BG : 0); skyC = sky;
              }
              break;
            }
            default: break;
          }
          if (!ti && gl !== g.space && !PARTIAL[gl]) ti = FX_TILE[gl];
        }
      }

      // see-through elements take the backdrop
      if (mix > 0 && tt !== E.SMOKE && tt !== E.STEAM && tt !== E.CLOUD && tt !== E.FIRE && tt !== E.BOLT) {
        r2 = r2 * (1 - mix) + br * mix; g2 = g2 * (1 - mix) + bgc * mix; b2 = b2 * (1 - mix) + bb * mix;
        if (above && self === 0) self = SELF_BG;
        if (above) skyC = sky * mix;
      }
      put(o, gl, fr, fgc, fb, r2, g2, b2, self, er * 255, eg * 255, eb * 255, skyC, ti, bits, rim);
      if (reveal < 1) revealFx(o, wx, wy, reveal, time);
    }
  }

  // cells next to a leaf take part in the canopy field
  if (PIX) {
    for (let vy = 0; vy < rows; vy++) {
      for (let vx = 0; vx < cols; vx++) {
        if (LF[(vy * cols + vx) * 4 + 3] < 240) continue;
        for (let j = -1; j <= 1; j++) {
          const yy = vy + j;
          if (yy < 0 || yy >= rows) continue;
          for (let k = -1; k <= 1; k++) {
            const xx = vx + k;
            if (xx < 0 || xx >= cols) continue;
            const q = (yy * cols + xx) * 4 + 3;
            if (LF[q] === 0) LF[q] = 128;
          }
        }
      }
    }
  }

  // shooting stars advance
  for (let k = shoot.length - 1; k >= 0; k--) {
    const s = shoot[k];
    s.x += s.vx * dtF; s.y += s.vy * dtF; s.life -= dtF;
    if (s.life <= 0) shoot.splice(k, 1);
  }
}

// ── buildings ──────────────────────────────────────────────────────────────
const SL = new Float32Array(10);
function structLook(i, mat, bid, night, time) {
  let fr = 200, fg = 200, fb = 200, br = 60, bg = 60, bb = 60, er = 0, eg = 0, eb = 0, self = 0;
  switch (mat) {
    case MAT.WOOD: fr = 196; fg = 140; fb = 84; br = 82; bg = 52; bb = 28; break;
    case MAT.STONE: fr = 196; fg = 190; fb = 180; br = 92; bg = 88; bb = 84; break;
    case MAT.BRICK: fr = 220; fg = 120; fb = 90; br = 120; bg = 54; bb = 40; break;
    case MAT.ROOF: fr = 236; fg = 96; fb = 64; br = 120; bg = 40; bb = 30; break;
    case MAT.DOOR: fr = 120; fg = 80; fb = 50; br = 40; bg = 24; bb = 14; break;
    case MAT.METAL: fr = 200; fg = 210; fb = 222; br = 64; bg = 70; bb = 86; break;
    case MAT.CLOTH: fr = 232; fg = 210; fb = 168; br = 128; bg = 100; bb = 64; break;
    case MAT.GOLD: fr = 255; fg = 216; fb = 96; br = 120; bg = 90; bb = 30; er = 0.25; eg = 0.2; eb = 0.05; break;
    case MAT.DARK: fr = 70; fg = 70; fb = 84; br = 22; bg = 22; bb = 30; break;
    case MAT.HULL: fr = 236; fg = 240; fb = 248; br = 150; bg = 156; bb = 170; break;
    case MAT.WINDOW: case MAT.PANE: {
      const lit = night > 0.35 && hash2(i, bid, 5) < (mat === MAT.PANE ? 0.62 : 0.85);
      if (lit) {
        const warm = mat === MAT.WINDOW || hash2(i, 3, 9) < 0.7;
        fr = 255; fg = warm ? 220 : 236; fb = warm ? 130 : 255;
        br = warm ? 150 : 90; bg = warm ? 110 : 130; bb = warm ? 40 : 170;
        er = warm ? 0.6 : 0.4; eg = warm ? 0.45 : 0.5; eb = warm ? 0.15 : 0.6;
        self = 255;
      } else {
        fr = 140; fg = 190; fb = 220; br = mat === MAT.PANE ? 40 : 30; bg = mat === MAT.PANE ? 70 : 40; bb = mat === MAT.PANE ? 100 : 60;
      }
      break;
    }
    case MAT.NEON: {
      const ph = (time * 0.6 + bid * 0.37) % 3;
      const col = ph < 1 ? [255, 60, 200] : ph < 2 ? [60, 240, 255] : [255, 220, 60];
      fr = col[0]; fg = col[1]; fb = col[2]; br = col[0] * 0.25; bg = col[1] * 0.25; bb = col[2] * 0.25;
      er = col[0] / 400; eg = col[1] / 400; eb = col[2] / 400; self = 255;
      break;
    }
    case MAT.FLAME: {
      const f = 0.7 + 0.3 * Math.sin(time * 20 + i);
      fr = 255; fg = 200 * f; fb = 80 * f; br = 200 * f; bg = 70 * f; bb = 10;
      er = 1; eg = 0.5; eb = 0.1; self = 255;
      break;
    }
  }
  SL[0] = fr; SL[1] = fg; SL[2] = fb; SL[3] = br; SL[4] = bg; SL[5] = bb; SL[6] = er; SL[7] = eg; SL[8] = eb; SL[9] = self;
}

// ── world materialisation (decode effect) ─────────────────────────────────
const RV = gs('01#$%&*+=<>/\\|▒░▓');
function revealFx(o, wx, wy, p, time) {
  const W = G.world;
  const cx = G.cam.x + cols / 2, cy = W.sea - 4;
  const dist = Math.sqrt(((wx - cx) / 1.0) ** 2 + ((wy - cy) * 1.7) ** 2) / 260;
  const local = (p * 1.35 - dist);
  if (local >= 0.12) return;
  if (local < -0.02) {
    FG[o] = 0; FG[o + 1] = 0; FG[o + 2] = 0; FG[o + 3] = 0; TI[o] = 0; TI[o + 2] = 0;
    BG[o] = 0; BG[o + 1] = 2; BG[o + 2] = 4; BG[o + 3] = SELF;
    EM[o] = 0; EM[o + 1] = 0; EM[o + 2] = 0; EM[o + 3] = 0;
    return;
  }
  const k = clamp(local / 0.12, 0, 1);
  const hq = hash2(wx, wy + Math.floor(time * 20), 21);
  TI[o] = PIX ? TL.glitch[Math.floor(hq * 4)] : 0; TI[o + 2] = 0;
  FG[o + 3] = RV[Math.floor(hq * RV.length)];
  FG[o] = 120 * (1 - k) + FG[o] * k; FG[o + 1] = 255 * (1 - k) + FG[o + 1] * k; FG[o + 2] = 170 * (1 - k) + FG[o + 2] * k;
  BG[o] *= k; BG[o + 1] *= k; BG[o + 2] *= k; BG[o + 3] = SELF;
  EM[o] = 60 * (1 - k); EM[o + 1] = 220 * (1 - k); EM[o + 2] = 120 * (1 - k);
}

// ── overlay helpers (villagers, text, particles, cursor) ───────────────────
export function overlayGlyph(view, wx, wy, glyph, r, gg, b, glow = 0, keepBg = true, self = null) {
  const vx = wx - view.ox, vy = wy - view.oy;
  if (vx < 0 || vy < 0 || vx >= cols || vy >= rows) return;
  const o = (vy * cols + vx) * 4;
  FG[o] = r; FG[o + 1] = gg; FG[o + 2] = b; FG[o + 3] = glyph;
  TI[o] = PIX ? FX_TILE[glyph] : 0; TI[o + 2] = 0; TI[o + 3] = 255;
  if (self !== null) BG[o + 3] = self;
  else if (glow > 0) BG[o + 3] = BG[o + 3] | 0xf0;
  if (glow > 0) { EM[o] = Math.min(255, EM[o] + r * glow); EM[o + 1] = Math.min(255, EM[o + 1] + gg * glow); EM[o + 2] = Math.min(255, EM[o + 2] + b * glow); }
  if (!keepBg) { BG[o] = 0; BG[o + 1] = 0; BG[o + 2] = 0; }
}

export function overlayText(view, wx, wy, str, r, gg, b, glow = 0.3) {
  let x = Math.round(wx - str.length / 2);
  for (const ch of str) {
    if (ch !== ' ') {
      overlayGlyph(view, x, wy, gi(ch), r, gg, b, glow, true, 255);
      const vx = x - view.ox, vy = wy - view.oy;
      if (vx >= 0 && vy >= 0 && vx < cols && vy < rows) TI[(vy * cols + vx) * 4] = 0;
    }
    x++;
  }
}

export function tintCell(view, wx, wy, r, gg, b, k) {
  const vx = wx - view.ox, vy = wy - view.oy;
  if (vx < 0 || vy < 0 || vx >= cols || vy >= rows) return;
  const o = (vy * cols + vx) * 4;
  BG[o] = BG[o] + (r - BG[o]) * k; BG[o + 1] = BG[o + 1] + (gg - BG[o + 1]) * k; BG[o + 2] = BG[o + 2] + (b - BG[o + 2]) * k;
  BG[o + 3] = BG[o + 3] | 15;
}

export { g as GLY };
