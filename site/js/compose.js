// ─── compose.js ── builds the per-frame glyph buffer from the world ────────
import { G } from './state.js';
import { E, LUT_G, LUT_FG, LUT_BG, MIX, EMIT, SP, MAT } from './elements.js';
import { gi, gs } from './glyphs.js';
import { skyPalette } from './weather.js';
import { fbm1, hash2, clamp, smooth } from './util.js';

const SELF = 15 * 16 + 15; // fg & bg ignore lighting
const SELF_BG = 15;        // only bg ignores lighting

let R; // renderer buffers
let FG, BG, EM, cols, rows;
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
function put(o, gl, fr, fgc, fb, br, bgc, bb, self, er, eg, eb, sky) {
  FG[o] = fr; FG[o + 1] = fgc; FG[o + 2] = fb; FG[o + 3] = gl;
  BG[o] = br; BG[o + 1] = bgc; BG[o + 2] = bb; BG[o + 3] = self;
  EM[o] = er; EM[o + 1] = eg; EM[o + 2] = eb; EM[o + 3] = sky;
}

const shoot = []; // shooting stars (screen space)
let lastFrameT = 0;

export function compose(view, time) {
  const W = G.world, env = G.env;
  FG = R.fg; BG = R.bg; EM = R.em; cols = R.cols; rows = R.rows;
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

  // shooting stars
  if (starAmt > 0.3 && Math.random() < dtF * 0.25) {
    shoot.push({ x: Math.random() * cols, y: Math.random() * horRow * 0.5, vx: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 25), vy: 8 + Math.random() * 8, life: 0.6 + Math.random() * 0.5 });
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
      if (tt === E.BEDROCK && above) tt = 0;
      if (tt === E.WATER || tt === E.FISH) run[vx]++;
      else run[vx] = 0;

      // ── backdrop (sky / cave) ──
      let br, bgc, bb, bgl = g.space, bfr = 0, bfg = 0, bfb = 0, bself = SELF, sky = 0, bem = 0;
      const mix = tt === 0 ? 1 : MIX[tt];
      {
        if (above) {
          br = sr; bgc = sg; bb = sb; sky = 255;
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
              bgl = ecl ? g.full : core;
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
                bgl = ds < 0.6 ? g.full : ds < 0.85 ? g.dk : g.md;
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
        } else {
          // cave air
          const hv = hash2(wx, wy, 11);
          br = 10 + hv * 4; bgc = 9 + hv * 3; bb = 14 + hv * 5;
          bself = 0;
          if (hv < 0.02) { bgl = g.dot; bfr = 40; bfg = 36; bfb = 48; }
        }
      }

      if (tt === 0) {
        put(o, bgl, bfr, bfg, bfb, br, bgc, bb, bself, bfr * bem, bfg * bem, bfb * bem, sky);
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
          if (depth <= 1) {
            const below = t[i + w];
            if (below === 0 || below === E.CLOUD) {
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
          r2 = br * 0.6 + 80; g2 = bgc * 0.6 + 20; b2 = bb * 0.6;
          if (!above) { r2 = 60; g2 = 18; b2 = 6; }
          self = SELF;
          skyC = sky;
          break;
        }
        case E.SMOKE: case E.STEAM: {
          const k = Math.min(1, d[i] / 80) * (1 - MIX[tt] * 0.6);
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
          else if (sp === SP.CHERRY && season === 0) { cr = 255; cg = 150 + hv * 50; cb = 200; gl = g.cherry[vv % 5]; }
          else if (sp === SP.BIRCH) { cr = 140; cg = 200; cb = 70; }
          if (sp !== SP.PINE && sp !== SP.PALM) {
            if (season === 0 && sp !== SP.CHERRY) { cr += 30; cg += 40; }
            if (season === 2) {
              const k = vv % 3;
              cr = k === 0 ? 235 : k === 1 ? 220 : 180; cg = k === 0 ? 120 : k === 1 ? 180 : 60; cb = 40;
            } else if (season === 3) { cr = 150; cg = 120; cb = 80; }
          }
          fr = cr + (hv - 0.5) * 30; fgc = cg + (hv - 0.5) * 40; fb = cb;
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
            if (above) { r2 = br; g2 = bgc; b2 = bb; self = SELF_BG; skyC = sky; } else { r2 = 12; g2 = 11; b2 = 16; }
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

      // see-through elements take the backdrop
      if (mix > 0 && tt !== E.SMOKE && tt !== E.STEAM && tt !== E.CLOUD && tt !== E.FIRE && tt !== E.BOLT) {
        r2 = r2 * (1 - mix) + br * mix; g2 = g2 * (1 - mix) + bgc * mix; b2 = b2 * (1 - mix) + bb * mix;
        if (above && self === 0) self = SELF_BG;
        if (above) skyC = sky * mix;
      }
      put(o, gl, fr, fgc, fb, r2, g2, b2, self, er * 255, eg * 255, eb * 255, skyC);
      if (reveal < 1) revealFx(o, wx, wy, reveal, time);
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
    FG[o] = 0; FG[o + 1] = 0; FG[o + 2] = 0; FG[o + 3] = 0;
    BG[o] = 0; BG[o + 1] = 2; BG[o + 2] = 4; BG[o + 3] = SELF;
    EM[o] = 0; EM[o + 1] = 0; EM[o + 2] = 0; EM[o + 3] = 0;
    return;
  }
  const k = clamp(local / 0.12, 0, 1);
  const hq = hash2(wx, wy + Math.floor(time * 20), 21);
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
  if (self !== null) BG[o + 3] = self;
  else if (glow > 0) BG[o + 3] = BG[o + 3] | 0xf0;
  if (glow > 0) { EM[o] = Math.min(255, EM[o] + r * glow); EM[o + 1] = Math.min(255, EM[o + 1] + gg * glow); EM[o + 2] = Math.min(255, EM[o + 2] + b * glow); }
  if (!keepBg) { BG[o] = 0; BG[o + 1] = 0; BG[o + 2] = 0; }
}

export function overlayText(view, wx, wy, str, r, gg, b, glow = 0.3) {
  let x = Math.round(wx - str.length / 2);
  for (const ch of str) {
    if (ch !== ' ') overlayGlyph(view, x, wy, gi(ch), r, gg, b, glow, true, 255);
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
