// ─── state.js ── the one shared game-state object & a tiny event bus ───────

export const G = {
  world: null,
  env: null,
  tribe: null,
  progress: null,
  audio: null,
  ui: null,
  cam: { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, follow: null },
  fx: [],
  mode: 'genesis', // 'genesis' | 'sandbox'
  speed: 1,
  paused: false,
  fastGrow: false,
  shake: 0,
  flash: 0,
  flashColor: [1, 1, 1],
  glitch: 0,
  reveal: 1, // world materialisation progress (0 → 1)
  started: false,
  realTime: 0,
  settings: {
    lang: (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en',
    crt: 0.45,
    bloom: 1,
    volume: 0.7,
    music: 0.5,
    sfx: 0.8,
    muted: false,
    hints: true,
    pixel: true,
  },
};

const listeners = new Map();
export function on(ev, fn) {
  if (!listeners.has(ev)) listeners.set(ev, []);
  listeners.get(ev).push(fn);
}
export function emit(ev, ...args) {
  const l = listeners.get(ev);
  if (l) for (const fn of l) fn(...args);
}
