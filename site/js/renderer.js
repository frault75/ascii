// ─── renderer.js ── WebGL2: glyph atlas → lit cells → bloom → CRT ──────────
import { CHARSET, PROCEDURAL } from './glyphs.js';

const GW = 40, GH = 64, PAD = 4, CW = GW + PAD * 2, CH = GH + PAD * 2;
export const FONT_STACK = '"JetBrains Mono", "DejaVu Sans Mono", "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace';

// ── glyph atlas ────────────────────────────────────────────────────────────
function drawProcedural(ctx, ch, x, y) {
  const w = GW, h = GH;
  const cx = x + w / 2, cy = y + h / 2;
  const L = 6; // line thickness
  const D = 5; // double-line gap
  const R = (a, b, c, d) => ctx.fillRect(a, b, c, d);
  const vline = (dx, from, to) => R(cx - L / 2 + dx, from, L, to - from);
  const hline = (dy, from, to) => R(from, cy - L / 2 + dy, to - from, L);
  const dots = (cov) => {
    const p = 4;
    for (let j = 0; j < h / p; j++) {
      for (let i = 0; i < w / p; i++) {
        let on;
        if (cov === 1) on = i % 2 === 0 && j % 2 === 0;
        else if (cov === 2) on = (i + j) % 2 === 0;
        else on = !(i % 2 === 0 && j % 2 === 0);
        if (on) R(x + i * p, y + j * p, p, p);
      }
    }
  };
  const quad = (q) => {
    // q bits: 1 TL, 2 TR, 4 BL, 8 BR
    if (q & 1) R(x, y, w / 2, h / 2);
    if (q & 2) R(cx, y, w / 2, h / 2);
    if (q & 4) R(x, cy, w / 2, h / 2);
    if (q & 8) R(cx, cy, w / 2, h / 2);
  };
  const tri = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
    ctx.closePath();
    ctx.fill();
  };
  switch (ch) {
    case '█': R(x, y, w, h); break;
    case '▀': R(x, y, w, h / 2); break;
    case '▄': R(x, cy, w, h / 2); break;
    case '▌': R(x, y, w / 2, h); break;
    case '▐': R(cx, y, w / 2, h); break;
    case '░': dots(1); break;
    case '▒': dots(2); break;
    case '▓': dots(3); break;
    case '│': vline(0, y, y + h); break;
    case '─': hline(0, x, x + w); break;
    case '║': vline(-D, y, y + h); vline(D, y, y + h); break;
    case '═': hline(-D, x, x + w); hline(D, x, x + w); break;
    case '┌': hline(0, cx - L / 2, x + w); vline(0, cy - L / 2, y + h); break;
    case '┐': hline(0, x, cx + L / 2); vline(0, cy - L / 2, y + h); break;
    case '└': hline(0, cx - L / 2, x + w); vline(0, y, cy + L / 2); break;
    case '┘': hline(0, x, cx + L / 2); vline(0, y, cy + L / 2); break;
    case '┼': hline(0, x, x + w); vline(0, y, y + h); break;
    case '├': vline(0, y, y + h); hline(0, cx, x + w); break;
    case '┤': vline(0, y, y + h); hline(0, x, cx); break;
    case '┬': hline(0, x, x + w); vline(0, cy, y + h); break;
    case '┴': hline(0, x, x + w); vline(0, y, cy); break;
    case '╔': hline(-D, cx - D - L / 2, x + w); hline(D, cx + D - L / 2, x + w); vline(-D, cy - D - L / 2, y + h); vline(D, cy + D - L / 2, y + h); break;
    case '╗': hline(-D, x, cx + D + L / 2); hline(D, x, cx - D + L / 2); vline(D, cy - D - L / 2, y + h); vline(-D, cy + D - L / 2, y + h); break;
    case '╚': hline(D, cx - D - L / 2, x + w); hline(-D, cx + D - L / 2, x + w); vline(-D, y, cy + D + L / 2); vline(D, y, cy - D + L / 2); break;
    case '╝': hline(D, x, cx + D + L / 2); hline(-D, x, cx - D + L / 2); vline(D, y, cy + D + L / 2); vline(-D, y, cy - D + L / 2); break;
    case '╱': case '╲': case '╳': {
      ctx.save();
      ctx.lineWidth = L;
      ctx.lineCap = 'square';
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      if (ch !== '╲') { ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); }
      if (ch !== '╱') { ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case '▖': quad(4); break;
    case '▗': quad(8); break;
    case '▘': quad(1); break;
    case '▝': quad(2); break;
    case '▙': quad(1 | 4 | 8); break;
    case '▛': quad(1 | 2 | 4); break;
    case '▜': quad(1 | 2 | 8); break;
    case '▟': quad(2 | 4 | 8); break;
    case '▞': quad(2 | 4); break;
    case '▚': quad(1 | 8); break;
    case '◢': tri([x + w, y, x + w, y + h, x, y + h]); break;
    case '◣': tri([x, y, x + w, y + h, x, y + h]); break;
    case '◤': tri([x, y, x + w, y, x, y + h]); break;
    case '◥': tri([x, y, x + w, y, x + w, y + h]); break;
  }
}

export function buildAtlas() {
  const cv = document.createElement('canvas');
  cv.width = CW * 16;
  cv.height = CH * 16;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#fff';
  const fontPx = 50;
  ctx.font = `500 ${fontPx}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // baseline so that cap-height glyphs sit centred
  const m = ctx.measureText('H');
  const capH = (m.actualBoundingBoxAscent || fontPx * 0.73);
  const base = Math.round(GH / 2 + capH / 2);
  CHARSET.forEach((ch, g) => {
    const x = (g % 16) * CW + PAD;
    const y = Math.floor(g / 16) * CH + PAD;
    if (PROCEDURAL.has(ch)) {
      drawProcedural(ctx, ch, x, y);
      return;
    }
    if (ch === ' ') return;
    const mw = ctx.measureText(ch).width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - PAD + 1, y - PAD + 1, CW - 2, CH - 2);
    ctx.clip();
    if (mw > GW * 1.02) {
      ctx.translate(x + GW / 2, 0);
      ctx.scale(GW / mw, 1);
      ctx.fillText(ch, 0, y + base);
    } else {
      ctx.fillText(ch, x + GW / 2, y + base);
    }
    ctx.restore();
  });
  return cv;
}

// ── shaders ────────────────────────────────────────────────────────────────
const VS = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uGain;
in vec2 vUv;
out vec4 o;
void main(){
  vec4 c = texture(uTex, vUv) * 0.2270270270;
  c += texture(uTex, vUv + uDir * 1.3846153846) * 0.3162162162;
  c += texture(uTex, vUv - uDir * 1.3846153846) * 0.3162162162;
  c += texture(uTex, vUv + uDir * 3.2307692308) * 0.0702702703;
  c += texture(uTex, vUv - uDir * 3.2307692308) * 0.0702702703;
  o = c * uGain;
}`;

const FS_SCENE = `#version 300 es
precision highp float;
uniform sampler2D uFg, uBg, uEm, uLN, uLW, uAtlas;
uniform vec2 uGrid, uCell, uOff, uRes;
uniform vec3 uAmb;
uniform float uSkyGain, uNGain, uWGain, uMinLight, uSat;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oGlow;
const vec2 GSZ = vec2(${GW}.0, ${GH}.0);
const vec2 CSZ = vec2(${CW}.0, ${CH}.0);
const vec2 PADV = vec2(${PAD}.0, ${PAD}.0);
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) + uOff;
  vec2 cell = p / uCell;
  ivec2 ci = ivec2(floor(cell));
  if (ci.x >= int(uGrid.x) || ci.y >= int(uGrid.y) || ci.x < 0 || ci.y < 0) { oColor = vec4(0.0, 0.0, 0.0, 1.0); oGlow = vec4(0.0); return; }
  vec2 f = fract(cell);
  vec4 fg = texelFetch(uFg, ci, 0);
  vec4 bg = texelFetch(uBg, ci, 0);
  vec4 em = texelFetch(uEm, ci, 0);
  float g = floor(fg.a * 255.0 + 0.5);
  vec2 gpos = vec2(mod(g, 16.0), floor(g / 16.0));
  vec2 scale = GSZ / CSZ / 16.0;
  vec2 auv = gpos / 16.0 + (PADV + f * GSZ) / CSZ / 16.0;
  float a = textureGrad(uAtlas, auv, dFdx(cell) * scale, dFdy(cell) * scale).a;
  vec2 luv = cell / uGrid;
  vec4 LN = texture(uLN, luv);
  vec4 LW = texture(uLW, luv);
  vec3 lit = vec3(uMinLight) + uAmb * (LW.a * 0.8 + LN.a * 0.2) * uSkyGain + LN.rgb * uNGain + LW.rgb * uWGain;
  lit = lit / (1.0 + max(lit - 1.0, 0.0) * 0.55);
  float sv = floor(bg.a * 255.0 + 0.5);
  float sb = mod(sv, 16.0) / 15.0;
  float sf = floor(sv / 16.0) / 15.0;
  vec3 cb = bg.rgb * mix(lit, vec3(1.0), sb);
  vec3 cf = fg.rgb * mix(lit, vec3(1.0), sf);
  vec3 col = mix(cb, cf, a);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat);
  oColor = vec4(col, 1.0);
  float glow = clamp(max(em.r, max(em.g, em.b)) * 1.4, 0.0, 1.0);
  oGlow = vec4((cf * a + cb * 0.3 * (1.0 - a)) * glow, 1.0);
}`;

const FS_FINAL = `#version 300 es
precision highp float;
uniform sampler2D uScene, uB1, uB2;
uniform vec2 uRes;
uniform float uCRT, uBloom, uTime, uFlash, uGlitch, uScan, uFade;
uniform vec3 uFlashCol;
in vec2 vUv;
out vec4 o;
float hash(float n){ return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  uv = 0.5 + cc * (1.0 + r2 * 0.07 * uCRT) / (1.0 + 0.0175 * uCRT);
  if (uGlitch > 0.001) {
    float band = floor(uv.y * 48.0) + floor(uTime * 23.0) * 7.0;
    if (hash(band) < uGlitch * 0.35) uv.x += (hash(band + 3.1) - 0.5) * 0.08 * uGlitch;
  }
  float ca = 0.0007 * uCRT + uGlitch * 0.006;
  vec3 col;
  col.r = texture(uScene, uv + vec2(ca, 0.0)).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - vec2(ca, 0.0)).b;
  vec3 bl = texture(uB1, uv).rgb * 0.75 + texture(uB2, uv).rgb * 1.1;
  col += bl * uBloom;
  float sl = sin(gl_FragCoord.y * 3.14159265 / uScan) * 0.5 + 0.5;
  col *= 1.0 - uCRT * 0.2 * (1.0 - sl);
  float mask = mod(gl_FragCoord.x, 3.0);
  col *= 1.0 - uCRT * 0.04 * step(2.0, mask);
  col *= 1.0 - r2 * (0.7 * uCRT + 0.3);
  col += (hash2(gl_FragCoord.xy * 0.37 + fract(uTime) * 91.0) - 0.5) * 0.04 * uCRT;
  col *= 1.0 - uCRT * 0.012 * (0.5 + 0.5 * sin(uTime * 53.0));
  col += uFlash * uFlashCol;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  col *= uFade;
  o = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.half = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.pBlur = program(gl, FS_BLUR);
    this.pScene = program(gl, FS_SCENE);
    this.pFinal = program(gl, FS_FINAL);
    this.vao = gl.createVertexArray();
    this.cols = 0;
    this.rows = 0;
    this.W = 0;
    this.H = 0;
  }

  setAtlas(cv) {
    const gl = this.gl;
    if (this.atlas) gl.deleteTexture(this.atlas);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    this.atlas = tex;
  }

  tex(w, h, filter, fmt = 'rgba8') {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (fmt === 'half') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { t, w, h };
  }
  fbo(texs) {
    const gl = this.gl;
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    texs.forEach((tx, k) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, tx.t, 0));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  }
  free(list) {
    const gl = this.gl;
    for (const o of list) {
      if (!o) continue;
      if (o.t) gl.deleteTexture(o.t);
      else gl.deleteFramebuffer(o);
    }
  }

  setGrid(cols, rows) {
    if (cols === this.cols && rows === this.rows) return;
    const gl = this.gl;
    this.free([this.tFg, this.tBg, this.tEm, this.tL1, this.tL2, this.tL3, this.fL1, this.fL2, this.fL3]);
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows * 4;
    this.fg = new Uint8ClampedArray(n);
    this.bg = new Uint8ClampedArray(n);
    this.em = new Uint8ClampedArray(n);
    this.tFg = this.tex(cols, rows, gl.NEAREST);
    this.tBg = this.tex(cols, rows, gl.NEAREST);
    this.tEm = this.tex(cols, rows, gl.LINEAR);
    const lf = this.half ? 'half' : 'rgba8';
    this.tL1 = this.tex(cols, rows, gl.LINEAR, lf);
    this.tL2 = this.tex(cols, rows, gl.LINEAR, lf);
    this.tL3 = this.tex(cols, rows, gl.LINEAR, lf);
    this.fL1 = this.fbo([this.tL1]);
    this.fL2 = this.fbo([this.tL2]);
    this.fL3 = this.fbo([this.tL3]);
  }

  resize(W, H) {
    if (W === this.W && H === this.H) return;
    const gl = this.gl;
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.free([this.tScene, this.tGlow, this.fScene, this.tB1, this.tB2, this.tB3, this.tB4, this.fB1, this.fB2, this.fB3, this.fB4]);
    this.tScene = this.tex(W, H, gl.LINEAR);
    this.tGlow = this.tex(W, H, gl.LINEAR);
    this.fScene = this.fbo([this.tScene, this.tGlow]);
    const w2 = Math.max(1, W >> 1), h2 = Math.max(1, H >> 1);
    const w4 = Math.max(1, W >> 2), h4 = Math.max(1, H >> 2);
    this.tB1 = this.tex(w2, h2, gl.LINEAR);
    this.tB2 = this.tex(w2, h2, gl.LINEAR);
    this.tB3 = this.tex(w4, h4, gl.LINEAR);
    this.tB4 = this.tex(w4, h4, gl.LINEAR);
    this.fB1 = this.fbo([this.tB1]);
    this.fB2 = this.fbo([this.tB2]);
    this.fB3 = this.fbo([this.tB3]);
    this.fB4 = this.fbo([this.tB4]);
  }

  upload(tx, data) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tx.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, tx.w, tx.h, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  blur(src, dstFbo, w, h, dx, dy, gain = 1) {
    const gl = this.gl;
    const P = this.pBlur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.t);
    gl.uniform1i(P.u.uTex, 0);
    gl.uniform2f(P.u.uDir, dx / src.w, dy / src.h);
    gl.uniform1f(P.u.uGain, gain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  render(o) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this.upload(this.tFg, this.fg);
    this.upload(this.tBg, this.bg);
    this.upload(this.tEm, this.em);
    const { cols, rows } = this;

    // light: wide blur of the emission map (cells are ~1.6× taller than wide)
    this.blur(this.tEm, this.fL1, cols, rows, 1.6, 0);
    this.blur(this.tL1, this.fL2, cols, rows, 0, 1.0);
    this.blur(this.tL2, this.fL1, cols, rows, 4.2, 0);
    this.blur(this.tL1, this.fL3, cols, rows, 0, 2.7);

    // scene
    const S = this.pScene;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fScene);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(S.p);
    const bind = (unit, tx, name) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.uniform1i(S.u[name], unit);
    };
    bind(0, this.tFg.t, 'uFg');
    bind(1, this.tBg.t, 'uBg');
    bind(2, this.tEm.t, 'uEm');
    bind(3, this.tL2.t, 'uLN');
    bind(4, this.tL3.t, 'uLW');
    bind(5, this.atlas, 'uAtlas');
    gl.uniform2f(S.u.uGrid, cols, rows);
    gl.uniform2f(S.u.uCell, o.cellW, o.cellH);
    gl.uniform2f(S.u.uOff, o.offX, o.offY);
    gl.uniform2f(S.u.uRes, this.W, this.H);
    gl.uniform3fv(S.u.uAmb, o.amb);
    gl.uniform1f(S.u.uSkyGain, o.skyGain);
    gl.uniform1f(S.u.uNGain, o.nGain);
    gl.uniform1f(S.u.uWGain, o.wGain);
    gl.uniform1f(S.u.uMinLight, o.minLight);
    gl.uniform1f(S.u.uSat, o.sat ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // bloom
    const w2 = this.tB1.w, h2 = this.tB1.h, w4 = this.tB3.w, h4 = this.tB3.h;
    this.blur(this.tGlow, this.fB1, w2, h2, 2, 0);
    this.blur(this.tB1, this.fB2, w2, h2, 0, 2);
    this.blur(this.tB2, this.fB3, w4, h4, 2.5, 0);
    this.blur(this.tB3, this.fB4, w4, h4, 0, 2.5);
    this.blur(this.tB4, this.fB3, w4, h4, 5, 0);
    this.blur(this.tB3, this.fB4, w4, h4, 0, 5);

    // final
    const P = this.pFinal;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tScene.t);
    gl.uniform1i(P.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tB2.t);
    gl.uniform1i(P.u.uB1, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.tB4.t);
    gl.uniform1i(P.u.uB2, 2);
    gl.uniform2f(P.u.uRes, this.W, this.H);
    gl.uniform1f(P.u.uCRT, o.crt);
    gl.uniform1f(P.u.uBloom, o.bloom);
    gl.uniform1f(P.u.uTime, o.time);
    gl.uniform1f(P.u.uFlash, o.flash);
    gl.uniform3fv(P.u.uFlashCol, o.flashColor);
    gl.uniform1f(P.u.uGlitch, o.glitch);
    gl.uniform1f(P.u.uScan, o.scan);
    gl.uniform1f(P.u.uFade, o.fade ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
