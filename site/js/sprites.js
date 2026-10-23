// ─── sprites.js ── the little people: procedurally drawn, palette-masked ────
// Every frame is drawn twice with the same geometry. Each colour channel of
// the two atlases is the coverage of one palette slot, premultiplied:
//   A.r skin · A.g cloth · A.b hair · B.r pants · B.g wood · B.b metal
// whatever alpha is left over is the dark outline ink. Mixing a slot with
// black (k < 1) gives free shading. The GPU recolours each villager.

export const FW = 32, FH = 40, PX = 4, COLS = 16;
export const PIV_BODY = [16, 39], PIV_HEAD = [16, 20], PIV_PROP = [16, 36];
const GROUND = 39, CX = 16, OL = 0.95;
const SLOT = { skin: [0, 0], cloth: [0, 1], hair: [0, 2], pants: [1, 0], wood: [1, 1], metal: [1, 2] };

// ── painter: one pass of one frame ─────────────────────────────────────────
class Painter {
  constructor(ctx, pass) {
    this.c = ctx;
    this.pass = pass;
    this.ol = false;
  }
  col(slot, k = 1) {
    if (this.ol || slot === 'ink') return '#000';
    const s = SLOT[slot];
    if (s[0] !== this.pass) return '#000';
    const v = Math.round(255 * Math.min(1, k));
    return s[1] === 0 ? `rgb(${v},0,0)` : s[1] === 1 ? `rgb(0,${v},0)` : `rgb(0,0,${v})`;
  }
  path(pts) {
    const c = this.c;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  }
  // a capsule polyline
  line(pts, w, slot, k = 1, edge = 0) {
    const c = this.c;
    if (this.ol && slot === 'ink') return;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (this.ol || edge) {
      this.path(pts);
      c.strokeStyle = '#000';
      c.lineWidth = w + (this.ol ? OL : edge) * 2;
      c.stroke();
      if (this.ol) return;
    }
    this.path(pts);
    c.strokeStyle = this.col(slot, k);
    c.lineWidth = w;
    c.stroke();
  }
  ellipse(x, y, rx, ry, rot, slot, k = 1, edge = 0) {
    const c = this.c;
    if (this.ol && slot === 'ink') return;
    const e = this.ol ? OL : edge;
    if (e) {
      c.beginPath();
      c.ellipse(x, y, rx + e, ry + e, rot, 0, Math.PI * 2);
      c.fillStyle = '#000';
      c.fill();
      if (this.ol) return;
    }
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    c.fillStyle = this.col(slot, k);
    c.fill();
  }
  circle(x, y, r, slot, k = 1, edge = 0) {
    this.ellipse(x, y, r, r, 0, slot, k, edge);
  }
  // filled polygon with rounded corners (round = corner stroke width)
  poly(pts, slot, k = 1, round = 0, edge = 0) {
    const c = this.c;
    if (this.ol && slot === 'ink') return;
    c.lineJoin = 'round';
    const e = this.ol ? OL : edge;
    if (e) {
      this.path(pts);
      c.closePath();
      c.fillStyle = c.strokeStyle = '#000';
      c.lineWidth = round + e * 2;
      c.fill();
      c.stroke();
      if (this.ol) return;
    }
    this.path(pts);
    c.closePath();
    c.fillStyle = c.strokeStyle = this.col(slot, k);
    c.fill();
    if (round) {
      c.lineWidth = round;
      c.stroke();
    }
  }
  // draw fn clipped to a circle (grown by the outline in the outline pass)
  clip(x, y, r, fn) {
    const c = this.c;
    c.save();
    c.beginPath();
    c.arc(x, y, r + (this.ol ? OL : 0), 0, Math.PI * 2);
    c.clip();
    fn();
    c.restore();
  }
  clipRect(x, y, w, h, fn) {
    const c = this.c;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    fn();
    c.restore();
  }
  shadow(x, y, rx, ry, a) {
    if (this.ol) return;
    const c = this.c;
    c.save();
    c.globalAlpha = a;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = '#000';
    c.fill();
    c.restore();
  }
}

// ── skeleton ───────────────────────────────────────────────────────────────
// angles are measured from straight down, positive = towards the facing side
const TH = 5, SH = 4.8, UA = 4.3, FA = 4.1, TOR = 8.4;
const dv = (a, L) => [Math.sin(a) * L, Math.cos(a) * L];
const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];

function solve(o) {
  let hip = [CX + (o.hx || 0), GROUND - 10.4 + (o.drop || 0)];
  let legs = o.legs.map(([t, s]) => {
    const k = add(hip, dv(t, TH));
    return { k, a: add(k, dv(s, SH)), s };
  });
  if (!o.free) {
    let low = -1e9;
    for (const l of legs) low = Math.max(low, l.a[1] + 1.1, l.k[1] + 1.55);
    if (o.seat) low = Math.max(low, hip[1] + 2.1);
    const dy = GROUND - low;
    hip = [hip[0], hip[1] + dy];
    legs = legs.map((l) => ({ k: [l.k[0], l.k[1] + dy], a: [l.a[0], l.a[1] + dy], s: l.s }));
  }
  const lean = o.lean || 0;
  const up = [Math.sin(lean), -Math.cos(lean)];
  const sh = add(hip, up, TOR);
  const neck = add(hip, up, TOR + 1.1);
  const arms = o.arms.map(([u, f]) => {
    const e = add(sh, dv(u, UA));
    return { e, w: add(e, dv(f, FA)), f };
  });
  return { hip, legs, sh, neck, arms, up, lean };
}

function leg(P, l, hip, k, edge) {
  P.line([hip[0], hip[1], l.k[0], l.k[1], l.a[0], l.a[1]], 3.1, 'pants', 0.9 * k, edge);
  const f = [Math.cos(l.s), -Math.sin(l.s)]; // shin direction turned towards the toes
  P.line([l.a[0] - f[0] * 0.3, l.a[1] - f[1] * 0.3, l.a[0] + f[0] * 1.7, l.a[1] + f[1] * 1.7], 2.7, 'pants', 0.42 * k, edge);
}

function arm(P, sh, a, k, edge, tool) {
  const pts = [sh[0], sh[1], a.e[0], a.e[1], a.w[0], a.w[1]];
  if (P.ol) {
    P.line(pts, 2.7, 'cloth');
    if (tool) tool();
    P.circle(a.w[0], a.w[1], 1.35, 'skin');
    return;
  }
  if (edge) P.line(pts, 2.7 + edge * 2, 'ink');
  P.line([sh[0], sh[1], a.e[0], a.e[1]], 2.7, 'cloth', 0.92 * k);
  P.line([a.e[0], a.e[1], a.w[0], a.w[1]], 2.3, 'skin', k);
  if (tool) tool();
  P.circle(a.w[0], a.w[1], 1.35, 'skin', k);
}

function torso(P, J) {
  const u = J.up, n = [-u[1], u[0]];
  const { sh, hip } = J;
  const pts = [
    ...add(add(sh, n, -3.0), u, 0.2), ...add(sh, n, 2.8),
    ...add(add(hip, n, 3.8), u, -1.7), ...add(add(hip, n, -3.7), u, -1.7),
  ];
  P.poly(pts, 'cloth', 1, 1.7);
  if (P.ol) return;
  // back-side shading and a leather belt
  P.poly([...add(add(sh, n, -3.0), u, 0.2), ...add(sh, n, -1.2), ...add(add(hip, n, -1.6), u, -1.7), ...add(add(hip, n, -3.7), u, -1.7)], 'cloth', 0.8, 1.7);
  const b0 = add(add(hip, n, -3.9), u, 0.4), b1 = add(add(hip, n, 4.0), u, 0.4);
  P.line([...b0, ...b1], 1.1, 'wood', 0.5);
}

// a tool held in the near hand, pointing along angle a
function tool(P, w, a, kind) {
  const d = dv(a, 1), p = [-d[1], d[0]];
  if (kind === 'spear') {
    const s0 = add(w, d, -7), E = add(w, d, 9);
    P.line([...s0, ...E], 1.1, 'wood', 0.9);
    P.poly([...add(E, d, 2.6), ...add(add(E, d, -0.4), p, 1.1), ...add(add(E, d, -0.4), p, -1.1)], 'metal', 1, 0.4);
    return;
  }
  if (kind === 'cane') {
    P.line([w[0] + 0.6, w[1] - 1.2, w[0] + 0.4, w[1], w[0] + 1.1, GROUND - 0.3], 1.1, 'wood', 0.8);
    return;
  }
  const L = kind === 'rod' ? 13 : kind === 'hammer' ? 6.8 : 7.6;
  const s = add(w, d, -1.6), E = add(w, d, L);
  if (kind === 'rod') {
    P.line([...s, ...E], 0.8, 'wood', 0.9);
    if (!P.ol) P.line([E[0], E[1], E[0] + 1.4, GROUND - 3.2], 0.35, 'ink');
    P.circle(E[0] + 1.4, GROUND - 3.4, 0.8, 'cloth', 1);
    return;
  }
  P.line([...s, ...E], 1.35, 'wood', 0.9);
  if (kind === 'axe') {
    P.poly([...add(E, d, 0.7), ...add(E, d, -2.5), ...add(add(E, d, -3.3), p, 3.1), ...add(add(E, d, 1.3), p, 3.1)], 'metal', 1, 0.6);
    P.poly([...add(E, d, 0.4), ...add(E, d, -1.8), ...add(add(E, d, -1.8), p, -1.3), ...add(add(E, d, 0.4), p, -1.3)], 'metal', 0.7, 0.4);
  } else if (kind === 'pick') {
    P.line([...add(add(E, p, 3.8), d, -1.6), ...add(add(E, p, 1.6), d, 0.5), ...add(add(E, p, -1.6), d, 0.5), ...add(add(E, p, -3.8), d, -1.6)], 1.5, 'metal', 0.95);
  } else if (kind === 'hammer') {
    P.poly([...add(add(E, p, 2.1), d, -1.3), ...add(add(E, p, 2.1), d, 1.3), ...add(add(E, p, -2.1), d, 1.3), ...add(add(E, p, -2.1), d, -1.3)], 'metal', 0.85, 0.6);
  }
}

// ── body frames ────────────────────────────────────────────────────────────
const frames = [];
export const F = {};
// per body frame: neck anchor (frame units), head tilt, head view
export const ANCHOR = [];

function addFrame(draw, anchor = null) {
  frames.push(draw);
  ANCHOR.push(anchor);
  return frames.length - 1;
}

// side view: o = pose, tl = { kind, a } tool in the near hand
function side(o, tl = null, extra = {}) {
  const J = solve(o);
  const draw = (P) => {
    if (!o.free && !extra.noShadow) P.shadow(CX + (o.hx || 0) * 0.5, GROUND + 0.2, 5.2, 1.1, 0.32);
    for (const ol of [true, false]) {
      P.ol = ol;
      const [far, near] = J.arms;
      const farTool = tl && tl.two;
      arm(P, J.sh, far, 0.62, 0, null);
      leg(P, J.legs[0], J.hip, 0.62, 0);
      leg(P, J.legs[1], J.hip, 1, ol ? 0 : 0.45);
      torso(P, J);
      arm(P, J.sh, near, 1, ol ? 0 : 0.45, tl ? () => tool(P, near.w, tl.a, tl.kind) : null);
      if (farTool && !ol) P.circle(far.w[0], far.w[1], 1.2, 'skin', 0.7);
    }
  };
  const fn = extra.clipY ? (P) => P.clipRect(0, 0, FW, extra.clipY, () => draw(P)) : draw;
  return addFrame(fn, { x: J.neck[0], y: J.neck[1], tilt: o.tilt || 0, view: 'side', lean: J.lean });
}

// front view: arms given as [left, right] (angles: + towards image right)
function front(o) {
  const hipY = GROUND - 10.4 + (o.drop || 0);
  const shY = hipY - TOR + (o.sag || 0);
  const draw = (P) => {
    P.shadow(CX, GROUND + 0.2, 5.4, 1.1, 0.32);
    for (const ol of [true, false]) {
      P.ol = ol;
      for (const s of [-1, 1]) {
        const x = CX + s * 1.65;
        P.line([x, hipY, x + s * 0.15, GROUND - 1.3], 3.1, 'pants', s < 0 ? 0.8 : 0.9, ol ? 0 : 0.35);
        if (!o.kneel) P.ellipse(x + s * 0.35, GROUND - 0.9, 1.75, 1.05, 0, 'pants', 0.42);
      }
      P.poly([CX - 3.3, shY + 0.2, CX + 3.3, shY + 0.2, CX + 4.0, hipY + 1.7, CX - 4.0, hipY + 1.7], 'cloth', 1, 1.7);
      if (!ol) {
        P.poly([CX + 1.4, shY + 0.4, CX + 3.3, shY + 0.2, CX + 4.0, hipY + 1.7, CX + 1.9, hipY + 1.7], 'cloth', 0.84, 1.2);
        P.line([CX - 4.0, hipY + 0.4, CX + 4.0, hipY + 0.4], 1.1, 'wood', 0.5);
      }
      o.arms.forEach(([u, f], k) => {
        const s = k ? 1 : -1;
        const sh = [CX + s * 3.35, shY + 0.9];
        const e = add(sh, dv(u, UA)), w = add(e, dv(f, FA));
        arm(P, sh, { e, w }, k ? 0.95 : 1, ol ? 0 : 0.45, null);
      });
    }
  };
  return addFrame(draw, { x: CX, y: shY - 1.1, tilt: o.tilt || 0, view: 'front', lean: 0 });
}

function lie() {
  // flat on the back, drawn upright and rotated at render time
  return side({ legs: [[0.05, 0], [-0.05, 0]], arms: [[0.1, 0.15], [-0.1, 0.05]] }, null, { noShadow: true });
}

function buildBodies() {
  const walk = (stride, armK, o = {}) => {
    const out = [];
    for (let k = 0; k < 6; k++) {
      const ph = (k / 6) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
      const leg1 = [stride * s, stride * s - 0.55 * Math.max(0, -c) - 0.12];
      const leg2 = [-stride * s, -stride * s - 0.55 * Math.max(0, c) - 0.12];
      const arms = o.arms ? o.arms(ph) : [[armK * s + 0.04, armK * s + 0.22], [-armK * s + 0.04, -armK * s + 0.22]];
      out.push(side({ legs: [leg1, leg2], arms, lean: o.lean ?? 0.06, drop: -Math.abs(c) * 0.25, tilt: o.tilt || 0 }, o.tool ? o.tool(arms) : null));
    }
    return out;
  };
  F.idle = [
    front({ arms: [[-0.2, -0.1], [0.2, 0.1]] }),
    front({ arms: [[-0.17, -0.05], [0.17, 0.05]], sag: 0.35 }),
  ];
  F.talk = [
    front({ arms: [[-0.2, -0.1], [0.55, 2.1]] }),
    front({ arms: [[-0.25, -0.2], [0.65, 2.45]] }),
  ];
  F.wave = [
    front({ arms: [[-0.2, -0.1], [2.45, 2.75]] }),
    front({ arms: [[-0.2, -0.1], [2.35, 3.35]] }),
  ];
  F.carryIdle = [front({ arms: [[-2.55, -3.05], [2.55, 3.05]] })];
  F.walk = walk(0.5, 0.32);
  F.run = walk(0.72, 0, { lean: 0.16, arms: (ph) => [[3.9 - 0.25 * Math.sin(ph), 3.7], [2.2 + 0.25 * Math.sin(ph), 2.5]] });
  F.carry = walk(0.42, 0, { arms: () => [[2.55, 3.15], [2.65, 3.25]] });
  F.elder = walk(0.28, 0.1, { lean: 0.3, arms: (ph) => [[-0.25 + 0.1 * Math.sin(ph), 0.2], [0.65, 0.3]], tool: () => ({ kind: 'cane', a: 0 }) });
  F.elderIdle = [side({ legs: [[0.06, 0], [-0.06, 0]], arms: [[-0.25, 0.2], [0.65, 0.3]], lean: 0.3 }, { kind: 'cane', a: 0 })];
  const swing = (kind, frames) => frames.map(([u, f, ta, lean]) => side(
    { legs: [[-0.28, -0.32], [0.3, 0.15]], arms: [[u - 0.12, f - 0.1], [u, f]], lean },
    { kind, a: ta, two: true }));
  F.axe = swing('axe', [[2.95, 3.45, 4.25, -0.08], [2.25, 2.0, 2.5, 0.05], [1.45, 1.25, 1.3, 0.16], [1.65, 1.5, 1.75, 0.12]]);
  F.pick = swing('pick', [[3.0, 3.5, 4.4, -0.08], [2.2, 1.9, 2.3, 0.12], [1.2, 0.85, 0.95, 0.3], [1.4, 1.1, 1.3, 0.26]]);
  F.hammer = swing('hammer', [[2.4, 2.9, 3.7, 0], [1.9, 1.75, 2.3, 0.06], [1.5, 1.3, 1.5, 0.1], [1.7, 1.6, 1.9, 0.08]]);
  F.gather = [
    side({ legs: [[0.25, -1.45], [1.55, 0.05]], arms: [[0.7, 0.55], [0.9, 0.7]], lean: 0.5 }),
    side({ legs: [[0.25, -1.45], [1.55, 0.05]], arms: [[0.95, 0.85], [0.6, 0.35]], lean: 0.55 }),
  ];
  F.fish = [
    side({ legs: [[-0.12, -0.1], [0.12, 0.05]], arms: [[1.0, 1.7], [1.1, 1.85]] }, { kind: 'rod', a: 2.35 }),
    side({ legs: [[-0.12, -0.1], [0.12, 0.05]], arms: [[1.05, 1.75], [1.15, 1.9]] }, { kind: 'rod', a: 2.2 }),
  ];
  F.pray = [
    front({ arms: [[-2.45, -2.75], [2.45, 2.75]], drop: 3.4, kneel: true }),
    front({ arms: [[-2.2, -2.5], [2.2, 2.5]], drop: 3.6, kneel: true, sag: 0.3 }),
  ];
  F.sit = [side({ legs: [[2.05, 0.25], [1.95, 0.15]], arms: [[1.0, 1.5], [1.1, 1.55]], seat: true, lean: -0.05 })];
  F.climb = [
    side({ legs: [[1.35, -0.25], [0.12, 0.02]], arms: [[2.15, 2.6], [2.85, 3.05]], free: true, lean: 0.1, drop: -1 }),
    side({ legs: [[0.12, 0.02], [1.35, -0.25]], arms: [[2.85, 3.05], [2.15, 2.6]], free: true, lean: 0.1, drop: -1 }),
  ];
  F.fall = [side({ legs: [[0.45, 0.1], [-0.35, -0.6]], arms: [[2.6, 2.95], [3.5, 3.8]], free: true, lean: -0.1, drop: -2 }, null, { noShadow: true })];
  F.swim = [
    side({ legs: [[0.3, 0], [-0.3, 0]], arms: [[2.0, 1.9], [1.2, 1.4]], free: true }, null, { clipY: 25.2, noShadow: true }),
    side({ legs: [[-0.3, 0], [0.3, 0]], arms: [[1.2, 1.4], [2.0, 1.9]], free: true }, null, { clipY: 25.2, noShadow: true }),
  ];
  F.lie = [lie()];
  F.throw = [
    side({ legs: [[-0.3, -0.35], [0.32, 0.15]], arms: [[1.0, 1.3], [3.6, 2.4]], lean: -0.12 }, { kind: 'spear', a: 1.75 }),
    side({ legs: [[-0.35, -0.3], [0.4, 0.2]], arms: [[0.9, 1.2], [1.7, 1.55]], lean: 0.18 }, null),
  ];
}

// ── animals (pivot = feet, facing right) ──────────────────────────────────
// slots: cloth = coat, skin = belly / light marks, pants = hooves & dark marks,
// wood = antlers / tusks, hair = accents
export const ANIMAL = {};
const legLine = (P, x, y0, a, L, wdt, k) => {
  const e = [x + Math.sin(a) * L, Math.min(GROUND - 0.6, y0 + Math.cos(a) * L)];
  P.line([x, y0, ...e], wdt, 'cloth', 0.75 * k);
  P.line([e[0] - 0.2, e[1] - 0.5, e[0] + 0.5, e[1] + 0.2], wdt + 0.2, 'pants', 0.6 * k);
};
function animalFrame(kind, pose, ph) {
  const run = pose === 'run', graze = pose === 'graze';
  const sw = run ? Math.sin(ph) : 0, cw = run ? Math.cos(ph) : 0;
  return addFrame((P) => {
    if (!run || kind !== 'rabbit') P.shadow(CX, GROUND + 0.2, kind === 'rabbit' ? 3.5 : 6.5, 1, 0.3);
    for (const ol of [true, false]) {
      P.ol = ol;
      if (kind === 'rabbit') {
        const hop = run ? Math.max(0, -cw) * 3.2 : 0;
        const by = 35.4 - hop;
        P.circle(10.4, by - 0.8, 1.4, 'skin', 1);
        P.line([12.5, by + 1.4, run ? 10.5 + sw * 1.5 : 13.6, GROUND - 0.7], 1.9, 'cloth', 0.75);
        P.ellipse(15, by, 4.6, 3.1, run ? -0.12 : 0, 'cloth', 1);
        P.line([18, by + 1.6, run ? 19.6 - sw : 18.4, GROUND - 0.7 - (run ? hop * 0.5 : 0)], 1.5, 'cloth', 0.85);
        const hx = graze ? 20.6 : 19.6, hy = graze ? by + 1.6 : by - 2.6;
        P.line([hx - 0.6, hy - 1.4, hx - 1.4 - (run ? 1.2 : 0), hy - 6.4], 1.4, 'cloth', 0.9);
        P.line([hx + 0.2, hy - 1.5, hx + 0.6 - (run ? 1.2 : 0), hy - 6.2], 1.4, 'cloth', 1);
        P.circle(hx, hy, 2.3, 'cloth', 1);
        if (!ol) { P.ellipse(15.4, by + 1.4, 3, 1.3, 0, 'skin', 0.9); P.circle(hx + 0.9, hy - 0.3, 0.55, 'ink'); P.circle(hx + 2.1, hy + 0.5, 0.45, 'pants', 0.8); }
      } else if (kind === 'deer' || kind === 'wolf' || kind === 'boar') {
        const wolf = kind === 'wolf', boar = kind === 'boar';
        const len = boar ? 7 : 6.6, bh = boar ? 4.2 : wolf ? 3.1 : 3.5;
        const legL = boar ? 4.2 : wolf ? 6.4 : 7.6;
        const by = GROUND - legL - bh + 0.8 + (run ? Math.abs(sw) * -0.8 : 0);
        const ang = run ? 0.65 : 0.12;
        // far legs, tail
        legLine(P, CX - len + 2.4, by + 1, -ang * sw + 0.08, legL + 0.6, wolf ? 1.4 : 1.3, 0.75);
        legLine(P, CX + len - 2.2, by + 1, ang * sw - 0.05, legL + 0.6, wolf ? 1.4 : 1.3, 0.75);
        if (wolf) P.line([CX - len + 0.6, by - 0.6, CX - len - 2.6, by + 1.6 + (run ? -1.5 : 0), CX - len - 3.4, by + 4.2 + (run ? -2.6 : 0)], 2.3, 'cloth', 0.95);
        else if (boar) P.line([CX - len + 0.4, by - 0.4, CX - len - 1.2, by + 1.2], 0.8, 'pants', 0.8);
        else P.ellipse(CX - len + 0.2, by - 1, 1.2, 1.5, 0.4, 'skin', 1);
        // body
        P.ellipse(CX, by, len, bh, run ? -0.05 * cw : 0, 'cloth', 1);
        // near legs
        legLine(P, CX - len + 2.6, by + 1.2, ang * sw + 0.04, legL, wolf ? 1.5 : 1.4, 1);
        legLine(P, CX + len - 2.4, by + 1.2, -ang * sw - 0.02, legL, wolf ? 1.5 : 1.4, 1);
        // neck & head
        const nx = CX + len - 1.4;
        let hx, hy;
        if (boar) { hx = nx + 3.2; hy = by + (graze ? 2.2 : 0.6); P.poly([nx - 1, by - bh + 0.6, hx + 1.6, hy - 1.6, hx + 3.6, hy + 0.6, hx + 3.4, hy + 2.2, nx - 0.4, by + bh - 0.6], 'cloth', 0.92, 1); }
        else if (wolf) { hx = nx + 3.4; hy = by - (graze ? -1.6 : 2.4); P.line([nx - 0.6, by - 0.6, hx - 1, hy + 0.6], 3.2, 'cloth', 1); P.ellipse(hx, hy, 2.6, 2.1, 0, 'cloth', 1); P.poly([hx + 1.2, hy - 0.6, hx + 4.6, hy + 0.7, hx + 1.4, hy + 1.8], 'cloth', 0.95, 0.7); P.poly([hx - 1.6, hy - 1.2, hx - 0.8, hy - 4.6, hx + 0.4, hy - 1.6], 'cloth', 0.85, 0.4); }
        else { hx = nx + (graze ? 4.2 : 3.4); hy = graze ? by + 4.8 : by - 6.2; P.line([nx - 0.4, by - 1, hx - 0.6, hy + 0.4], 2.8, 'cloth', 1); P.ellipse(hx + 0.6, hy, 2.6, 1.7, graze ? 0.9 : 0.25, 'cloth', 1); P.ellipse(hx - 1, hy - 1.6, 1.3, 0.7, -0.7, 'cloth', 0.85); }
        if (!ol) {
          if (wolf) { P.ellipse(CX + 1, by + bh - 1.2, len - 2, 1.1, 0, 'skin', 0.9); P.ellipse(CX - 1.5, by - bh + 1.1, 3.6, 1, 0, 'pants', 0.7); P.circle(hx + 4.4, hy + 0.8, 0.55, 'pants', 0.3); }
          else if (boar) { P.line([CX - len + 1.6, by - bh + 0.4, CX + len - 2, by - bh + 0.2], 1.3, 'pants', 0.55); P.line([hx + 2.6, hy + 1.6, hx + 3.6, hy - 0.2], 0.7, 'wood', 1); P.circle(hx + 3.5, hy + 1.4, 0.6, 'pants', 0.4); }
          else { P.ellipse(CX + 0.6, by + bh - 1, len - 2.2, 1, 0, 'skin', 0.95); for (const [x, y] of [[-2, -1], [0.5, -1.8], [3, -0.8]]) P.circle(CX + x, by + y, 0.45, 'skin', 1); P.circle(hx + 2.8, hy + (graze ? 1.4 : 0.3), 0.5, 'pants', 0.3); }
          P.circle(hx + (boar ? 1.6 : 0.9), hy - (boar ? 0.6 : 0.4), 0.5, 'ink');
        }
        if (kind === 'deer' && !graze) {
          // antlers
          const ax = hx - 0.6, ay = hy - 1.6;
          P.line([ax, ay, ax - 0.8, ay - 3.6, ax - 2.6, ay - 6.2], 0.75, 'wood', 1);
          P.line([ax - 0.8, ay - 3.6, ax + 0.9, ay - 5.8], 0.7, 'wood', 1);
          P.line([ax - 1.6, ay - 4.8, ax - 3.6, ay - 4.6], 0.65, 'wood', 1);
        }
      }
    }
  });
}
function buildAnimals() {
  for (const kind of ['rabbit', 'deer', 'boar', 'wolf']) {
    ANIMAL[kind] = {
      stand: animalFrame(kind, 'stand', 0),
      graze: animalFrame(kind, 'graze', 0),
      run: [0, 1, 2, 3].map((k) => animalFrame(kind, 'run', (k / 4) * Math.PI * 2)),
    };
  }
}
export const ANIMAL_PAL = {
  rabbit: [[245, 240, 230], [168, 130, 98], [0, 0, 0], [60, 44, 36], [0, 0, 0], [0, 0, 0]],
  snowhare: [[240, 244, 252], [232, 236, 246], [0, 0, 0], [120, 130, 150], [0, 0, 0], [0, 0, 0]],
  deer: [[236, 218, 190], [176, 112, 62], [0, 0, 0], [52, 36, 28], [232, 220, 196], [0, 0, 0]],
  boar: [[120, 96, 84], [104, 76, 62], [0, 0, 0], [44, 32, 28], [244, 240, 226], [0, 0, 0]],
  wolf: [[214, 214, 222], [128, 130, 142], [0, 0, 0], [62, 62, 74], [0, 0, 0], [0, 0, 0]],
};

// ── heads (pivot = neck) ───────────────────────────────────────────────────
export const STYLES = 6; // short · long · ponytail · bun · bald+beard · spiky
export const EXPR = { side: 0, sideTalk: 1, sideShut: 2, front: 3, frontTalk: 4, frontShut: 5 };
const HR = 5.3;

function headSide(P, style, ex) {
  const hx = CX + 0.8, hy = PIV_HEAD[1] - 5.5, r = HR;
  for (const ol of [true, false]) {
    P.ol = ol;
    if (style === 1) P.poly([hx - r + 0.6, hy - 1.5, hx - r - 0.7, hy + 6.6, hx - 1.4, hy + 6.8, hx - 0.6, hy + 1], 'hair', 0.85, 1.4);
    if (style === 2) { P.ellipse(hx - r - 1.0, hy + 2.0, 1.6, 3.3, 0.4, 'hair', 0.85); P.circle(hx - r + 0.3, hy - 0.2, 1.2, 'hair', 0.7); }
    if (style === 3) P.circle(hx - 1.4, hy - r + 0.1, 2.5, 'hair', 0.85);
    P.line([CX, PIV_HEAD[1] + 0.6, CX + 0.4, hy + 2], 2.6, 'skin', 0.78);
    P.circle(hx, hy, r, 'skin', 1);
    P.circle(hx + r - 0.25, hy + 0.9, 1.15, 'skin', 1);
    if (style !== 4) {
      P.clip(hx, hy, r + 0.55, () => P.poly([
        hx - r - 2, hy + 2.9, hx - 2.0, hy + 2.2, hx - 1.2, hy - 0.6, hx + 1.3, hy - 2.0,
        hx + r + 2, hy - 1.8, hx + r + 2, hy - r - 3, hx - r - 2, hy - r - 3,
      ], 'hair', 1));
    } else {
      P.clip(hx, hy, r + 0.4, () => P.poly([hx - r - 2, hy + 2.4, hx - 3.3, hy + 2.4, hx - 3.6, hy - 0.8, hx - r - 2, hy - 0.8], 'hair', 0.9));
      P.clip(hx, hy, r + 0.5, () => P.poly([hx - 1.2, hy + 2.6, hx + 1.6, hy + 2.9, hx + r + 2, hy + 3.1, hx + r + 2, hy + r + 2, hx - 1.2, hy + r + 2], 'hair', 1));
    }
    if (style === 5) {
      for (const [a, b] of [[-3.6, -0.6], [-1.2, 1.6], [1.0, 3.6]]) P.poly([hx + a, hy - r + 1.4, hx + (a + b) / 2 - 0.4, hy - r - 2.2, hx + b, hy - r + 1.0], 'hair', 1, 0.5);
    }
    if (style === 4) P.circle(hx - 1.5, hy + 0.7, 1.05, 'skin', 0.84);
  }
  // face
  if (ex === 2) P.line([hx + 1.9, hy - 0.1, hx + 3.3, hy + 0.1], 0.55, 'ink');
  else P.ellipse(hx + 2.6, hy - 0.3, 0.72, 1.05, 0, 'ink');
  if (ex === 1) P.ellipse(hx + 3.5, hy + 2.55, 0.8, 0.75, 0, 'ink');
  else if (style !== 4) P.line([hx + 2.7, hy + 2.65, hx + 3.7, hy + 2.45], 0.42, 'ink');
}

function headFront(P, style, ex) {
  const hx = CX, hy = PIV_HEAD[1] - 5.4, r = HR;
  for (const ol of [true, false]) {
    P.ol = ol;
    if (style === 1) P.poly([hx - r - 0.5, hy - 1, hx - r - 0.2, hy + 6.6, hx + r + 0.2, hy + 6.6, hx + r + 0.5, hy - 1], 'hair', 0.8, 1.4);
    if (style === 2) P.ellipse(hx + r + 0.7, hy + 1.6, 1.4, 3.0, -0.35, 'hair', 0.85);
    if (style === 3) P.circle(hx, hy - r - 0.3, 2.5, 'hair', 0.85);
    P.line([hx, PIV_HEAD[1] + 0.6, hx, hy + 2], 2.8, 'skin', 0.78);
    if (style !== 1) for (const s of [-1, 1]) P.circle(hx + s * (r - 0.1), hy + 0.8, 1.1, 'skin', 0.86);
    P.circle(hx, hy, r, 'skin', 1);
    if (style !== 4) {
      P.clip(hx, hy, r + 0.55, () => P.poly([
        hx - r - 2, hy + 1.2, hx - r + 0.5, hy + 1.2, hx - r + 1.1, hy - 1.6, hx - 1.6, hy - 2.4, hx, hy - 1.8,
        hx + 1.6, hy - 2.4, hx + r - 1.1, hy - 1.6, hx + r - 0.5, hy + 1.2, hx + r + 2, hy + 1.2,
        hx + r + 2, hy - r - 3, hx - r - 2, hy - r - 3,
      ], 'hair', 1));
    } else {
      for (const s of [-1, 1]) P.clip(hx, hy, r + 0.4, () => P.poly([hx + s * (r + 2), hy - 1.8, hx + s * (r - 1.5), hy - 1.6, hx + s * (r - 1.3), hy + 1.6, hx + s * (r + 2), hy + 1.6], 'hair', 0.9));
      P.clip(hx, hy, r + 0.5, () => P.poly([hx - r - 2, hy + 1.2, hx - 3.0, hy + 1.6, hx - 1.6, hy + 3.4, hx + 1.6, hy + 3.4, hx + 3.0, hy + 1.6, hx + r + 2, hy + 1.2, hx + r + 2, hy + r + 2, hx - r - 2, hy + r + 2], 'hair', 1));
    }
    if (style === 5) {
      for (const [a, b] of [[-3.9, -1.1], [-1.5, 1.5], [1.1, 3.9]]) P.poly([hx + a, hy - r + 1.3, hx + (a + b) / 2, hy - r - 2.3, hx + b, hy - r + 1.3], 'hair', 1, 0.5);
    }
  }
  for (const s of [-1, 1]) {
    if (ex === 5) P.line([hx + s * 1.2, hy, hx + s * 2.6, hy], 0.55, 'ink');
    else P.ellipse(hx + s * 1.9, hy - 0.2, 0.72, 1.05, 0, 'ink');
  }
  if (ex === 4) P.ellipse(hx, hy + 2.7, 1.0, 0.85, 0, 'ink');
  else if (style !== 4) P.line([hx - 1.1, hy + 2.3, hx, hy + 2.85, hx + 1.1, hy + 2.3], 0.45, 'ink');
}

export const HEAD = []; // HEAD[style][expr] → frame
function buildHeads() {
  for (let s = 0; s < STYLES; s++) {
    HEAD.push([]);
    for (let e = 0; e < 6; e++) HEAD[s].push(addFrame((P) => (e < 3 ? headSide(P, s, e) : headFront(P, s, e))));
  }
}

// ── carried loads (pivot = bottom centre, sits on the head) ───────────────
export const PROP = {};
function buildProps() {
  const at = (f) => addFrame((P) => { for (const ol of [true, false]) { P.ol = ol; f(P); } });
  PROP.wood = at((P) => {
    P.line([10, 33.9, 22, 33.9], 2.8, 'wood', 0.8);
    P.line([10.8, 31.2, 21.4, 31.2], 2.6, 'wood', 1);
    if (!P.ol) { P.circle(22, 33.9, 1.0, 'wood', 0.55); P.circle(21.4, 31.2, 0.9, 'wood', 0.6); }
  });
  PROP.food = at((P) => {
    for (const [x, y, r, s] of [[13.4, 30.2, 1.7, 'cloth'], [16, 29.4, 1.8, 'skin'], [18.6, 30.2, 1.7, 'cloth'], [15, 28.0, 1.3, 'cloth']]) P.circle(x, y, r, s, 1);
    P.poly([11.2, 30.8, 20.8, 30.8, 19.6, 35.6, 12.4, 35.6], 'wood', 0.75, 0.8);
    if (!P.ol) P.line([11.8, 32.9, 20.2, 32.9], 0.5, 'wood', 0.5);
  });
  PROP.stone = at((P) => {
    P.poly([11.3, 35.6, 12.4, 31, 16, 29.4, 20.2, 30.6, 21.2, 35.6], 'metal', 0.72, 0.8);
    if (!P.ol) P.poly([12.4, 31, 16, 29.4, 20.2, 30.6, 16.2, 32.3], 'metal', 1, 0.4);
  });
  PROP.metal = at((P) => {
    P.circle(14, 33.4, 2.3, 'metal', 0.8);
    P.circle(18, 33.2, 2.4, 'metal', 0.9);
    P.circle(16, 30.7, 1.9, 'metal', 1);
    if (!P.ol) { P.circle(15.4, 30.1, 0.6, 'hair', 1); P.circle(18.6, 32.4, 0.5, 'hair', 1); }
  });
}

// ── atlas ──────────────────────────────────────────────────────────────────
let built = null;
export function buildSprites() {
  if (built) return built;
  buildBodies();
  buildHeads();
  buildProps();
  buildAnimals();
  const rows = Math.ceil(frames.length / COLS);
  const mk = (pass) => {
    const cv = document.createElement('canvas');
    cv.width = COLS * FW * PX;
    cv.height = rows * FH * PX;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    frames.forEach((draw, i) => {
      ctx.save();
      ctx.translate((i % COLS) * FW * PX, Math.floor(i / COLS) * FH * PX);
      ctx.scale(PX, PX);
      ctx.beginPath();
      ctx.rect(0.5, 0.5, FW - 1, FH - 1);
      ctx.clip();
      draw(new Painter(ctx, pass));
      ctx.restore();
    });
    return cv;
  };
  built = { A: mk(0), B: mk(1), cols: COLS, rows, count: frames.length };
  return built;
}

// ── looks ──────────────────────────────────────────────────────────────────
const HAIRS = [[48, 32, 24], [96, 60, 34], [212, 164, 72], [158, 66, 34], [26, 24, 32], [120, 84, 60], [236, 206, 140]];
const PANTS = [[70, 64, 96], [64, 78, 58], [96, 74, 54], [52, 64, 92], [88, 60, 70]];
export const INK = [16, 13, 24];
const hash = (n) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
// a villager's palette: [skin, cloth, hair, pants, wood, metal] + head style
export function hairOf(v) {
  return v.hair ?? (hash(v.id + 1) >>> 4) % HAIRS.length;
}
export function lookOf(v, era = 0) {
  const h = hash(v.id + 1);
  let style = h % STYLES;
  if (v.kid && style === 4) style = 0;
  let hair = HAIRS[hairOf(v) % HAIRS.length];
  if (v.age >= 10 && !v.kid) hair = [208, 206, 214];
  return {
    style,
    pal: [v.skin || [241, 194, 125], v.color, hair, PANTS[(h >>> 9) % PANTS.length], [150, 100, 56], era >= 3 ? [205, 218, 232] : [150, 148, 160]],
  };
}
export const PROP_PAL = {
  wood: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [158, 106, 58], [0, 0, 0]],
  food: [[232, 74, 58], [118, 214, 84], [0, 0, 0], [0, 0, 0], [176, 128, 66], [0, 0, 0]],
  stone: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [168, 168, 178]],
  metal: [[0, 0, 0], [0, 0, 0], [220, 255, 255], [0, 0, 0], [0, 0, 0], [130, 210, 238]],
};

// ── portraits for the interface (CPU composite, cached) ───────────────────
const portraits = new Map();
let pixA = null, pixB = null;
function framePixels(i) {
  const s = buildSprites();
  const x = (i % COLS) * FW * PX, y = Math.floor(i / COLS) * FH * PX;
  if (!pixA) pixA = new Map(), pixB = new Map();
  if (!pixA.has(i)) {
    pixA.set(i, s.A.getContext('2d').getImageData(x, y, FW * PX, FH * PX).data);
    pixB.set(i, s.B.getContext('2d').getImageData(x, y, FW * PX, FH * PX).data);
  }
  return [pixA.get(i), pixB.get(i)];
}
// composite one frame into out (a rw×rh window starting at rx,ry, frame px)
function blit(out, rx, ry, rw, rh, i, pal, ox, oy) {
  const [a, b] = framePixels(i);
  const w = FW * PX, h = FH * PX;
  for (let y = 0; y < rh; y++) {
    const sy = y + ry - oy;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < rw; x++) {
      const sx = x + rx - ox;
      if (sx < 0 || sx >= w) continue;
      const s = (sy * w + sx) * 4;
      const A = a[s + 3];
      if (!A) continue;
      // getImageData is un-premultiplied: slot weights are channel × alpha
      const al = A / 255, n = al / 255;
      const w0 = a[s] * n, w1 = a[s + 1] * n, w2 = a[s + 2] * n, w3 = b[s] * n, w4 = b[s + 1] * n, w5 = b[s + 2] * n;
      const ink = Math.max(0, al - w0 - w1 - w2 - w3 - w4 - w5);
      const d = (y * rw + x) * 4, keep = 1 - al;
      for (let c = 0; c < 3; c++) {
        out[d + c] = INK[c] * ink + pal[0][c] * w0 + pal[1][c] * w1 + pal[2][c] * w2 + pal[3][c] * w3 + pal[4][c] * w4 + pal[5][c] * w5 + out[d + c] * keep;
      }
      out[d + 3] = A + out[d + 3] * keep;
    }
  }
}

// layers: [[frame, palette, dx, dy]] (offsets in frame units) → a canvas
export function composite(layers, rx = 0, ry = 0, rw = FW * PX, rh = FH * PX) {
  buildSprites();
  const out = new Float32Array(rw * rh * 4);
  for (const [i, pal, dx, dy] of layers) blit(out, rx, ry, rw, rh, i, pal, Math.round(dx * PX), Math.round(dy * PX));
  const cv = document.createElement('canvas');
  cv.width = rw;
  cv.height = rh;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(rw, rh);
  for (let k = 0; k < out.length; k += 4) {
    const al = out[k + 3] / 255;
    if (al <= 0) continue;
    img.data[k] = out[k] / al;
    img.data[k + 1] = out[k + 1] / al;
    img.data[k + 2] = out[k + 2] / al;
    img.data[k + 3] = out[k + 3];
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function portrait(v, era = 0) {
  if (typeof document === 'undefined') return '';
  const L = lookOf(v, era);
  const key = L.pal.map((c) => c.join(',')).join('|') + ':' + L.style + (v.kid ? 'k' : '');
  const hit = portraits.get(v.id);
  if (hit && hit.key === key) return hit.url;
  buildSprites();
  const body = F.idle[0];
  const an = ANCHOR[body];
  // just the bust: head and shoulders
  const cv = composite([[body, L.pal, 0, 0], [HEAD[L.style][EXPR.front], L.pal, an.x - PIV_HEAD[0], an.y - PIV_HEAD[1]]], 5 * PX, 4 * PX, 22 * PX, 22 * PX);
  const crop = document.createElement('canvas');
  crop.width = crop.height = 64;
  const c2 = crop.getContext('2d');
  c2.imageSmoothingQuality = 'high';
  c2.drawImage(cv, 0, 0, 64, 64);
  const url = crop.toDataURL();
  portraits.set(v.id, { key, url });
  return url;
}

// a little picture of an animal for the interface
const animalIcons = new Map();
export function animalIcon(kind) {
  if (animalIcons.has(kind)) return animalIcons.get(kind);
  buildSprites();
  const cv = composite([[ANIMAL[kind].stand, ANIMAL_PAL[kind], 0, 0]], 2 * PX, 10 * PX, 28 * PX, 30 * PX);
  const out = document.createElement('canvas');
  out.width = out.height = 64;
  const c = out.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(cv, 0, 0, 64, 64 * (30 / 28));
  const url = out.toDataURL();
  animalIcons.set(kind, url);
  return url;
}
