// ─── audio.js ── generative music, ambience & synthesized sound effects ────
import { G } from './state.js';
import { E } from './elements.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// chord progressions (midi roots + chord tones)
const DAY = [[62, [0, 4, 7, 11]], [59, [0, 3, 7, 10]], [55, [0, 4, 7, 14]], [57, [0, 4, 7, 9]]];
const NIGHT = [[62, [0, 3, 7, 10]], [58, [0, 4, 7, 11]], [53, [0, 4, 7, 14]], [60, [0, 4, 7, 9]]];
const DUSK = [[57, [0, 4, 7, 10]], [55, [0, 4, 7, 11]], [52, [0, 3, 7, 10]], [53, [0, 4, 7, 14]]];

export class Sound {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.last = {};
    this.chordIdx = 0;
    this.nextChord = 0;
    this.nextPluck = 0;
    this.chord = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.2, 2.4);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.55;
    this.verb.connect(this.verbGain).connect(this.master);
    // echo
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    this.delay.connect(dl).connect(fb).connect(this.delay);
    this.delay.connect(this.verb);
    this.delayOut = ctx.createGain(); this.delayOut.gain.value = 0.5;
    this.delay.connect(this.delayOut).connect(this.master);
    // buses
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.music.connect(this.verb);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);
    // noise sources
    this.white = this.noiseBuffer('white');
    this.brown = this.noiseBuffer('brown');
    this.wind = this.loop(this.brown, 'bandpass', 400, 0.6);
    this.rain = this.loop(this.white, 'highpass', 1800, 0.4);
    this.rain2 = this.loop(this.white, 'lowpass', 900, 0.6);
    this.lava = this.loop(this.brown, 'lowpass', 160, 1);
    this.cave = this.loop(this.brown, 'lowpass', 90, 1);
    this.fireAmt = 0;
    this.birdAmt = 0;
    this.cricketAmt = 0;
    this.ready = true;
    this.applyVolume();
  }

  applyVolume() {
    if (!this.ready) return;
    const s = G.settings;
    const t = this.ctx.currentTime;
    const m = s.muted ? 0 : s.volume;
    this.master.gain.setTargetAtTime(m, t, 0.1);
    this.music.gain.setTargetAtTime(0.32 * s.music, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(0.8 * s.sfx, t, 0.1);
    this.ambBus.gain.setTargetAtTime(0.7 * s.sfx, t, 0.3);
  }

  impulse(sec, decay) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  noiseBuffer(kind) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return b;
  }

  loop(buf, type, freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.ambBus);
    src.start();
    return { src, f, g };
  }

  // ── primitive voices ──
  tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.005, bus = this.sfxBus, slide = 0, delay = 0, verb = 0.3, echo = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s).connect(this.verb); }
    if (echo) { const s = ctx.createGain(); s.gain.value = echo; g.connect(s).connect(this.delay); }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  burst(dur, { vol = 0.3, type = 'lowpass', from = 3000, to = 200, q = 0.7, delay = 0, buf = this.white, verb = 0.2 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s).connect(this.verb); }
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  // distance attenuation relative to the camera centre
  near(x, y) {
    if (x === undefined) return 1;
    const c = G.view;
    if (!c) return 1;
    const cx = c.camX + c.visC / 2, cy = c.camY + c.visR / 2;
    const d = Math.hypot((x - cx) / (c.visC * 0.6), ((y ?? cy) - cy) / (c.visR * 0.6));
    return Number.isFinite(d) ? Math.max(0, 1 - d * 0.75) : 1;
  }

  sfx(name, x, y) {
    if (!this.ready || G.settings.muted) return;
    const now = this.ctx.currentTime;
    const gap = { place: 0.06, chop: 0.12, pick: 0.12, hammer: 0.14, hiss: 0.2, click: 0.03, hover: 0.04, zap: 0.1, birth: 0.2, death: 0.3, explosion: 0.08, thunder: 0.25 }[name] || 0.05;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const k = this.near(x, y);
    if (k <= 0.02) return;
    const R = Math.random;
    switch (name) {
      case 'click': this.tone(1320, 0.05, { type: 'square', vol: 0.05 * k, verb: 0 }); break;
      case 'hover': this.tone(2400, 0.02, { type: 'sine', vol: 0.02, verb: 0 }); break;
      case 'select': this.tone(880, 0.06, { type: 'square', vol: 0.05, verb: 0.1 }); this.tone(1320, 0.08, { type: 'square', vol: 0.04, delay: 0.05, verb: 0.1 }); break;
      case 'place': this.burst(0.05, { vol: 0.05 * k, type: 'bandpass', from: 1800 + R() * 1200, to: 900, q: 3, verb: 0.05 }); break;
      case 'chop': this.burst(0.06, { vol: 0.12 * k, type: 'bandpass', from: 900, to: 500, q: 4, verb: 0.15 }); break;
      case 'pick': this.tone(2200 + R() * 400, 0.05, { type: 'triangle', vol: 0.06 * k, verb: 0.2 }); break;
      case 'hammer': this.burst(0.05, { vol: 0.1 * k, type: 'bandpass', from: 600, to: 300, q: 5, verb: 0.2 }); break;
      case 'hiss': this.burst(0.5, { vol: 0.08 * k, type: 'highpass', from: 3000, to: 5000, verb: 0.1 }); break;
      case 'discover': [0, 4, 7, 12, 16].forEach((n, i) => this.tone(midi(74 + n), 0.9, { type: 'triangle', vol: 0.07, delay: i * 0.07, verb: 0.6, echo: 0.3 })); break;
      case 'achieve': [0, 4, 7, 11, 14].forEach((n) => this.tone(midi(62 + n), 2.2, { type: 'sawtooth', vol: 0.025, attack: 0.08, verb: 0.8 })); this.tone(midi(86), 1.4, { type: 'sine', vol: 0.08, delay: 0.1, echo: 0.4 }); break;
      case 'quest': [0, 7, 12, 19].forEach((n, i) => this.tone(midi(67 + n), 0.6, { type: 'square', vol: 0.03, delay: i * 0.09, verb: 0.4 })); break;
      case 'unlock': this.tone(midi(84), 0.2, { type: 'square', vol: 0.04 }); this.tone(midi(91), 0.5, { type: 'square', vol: 0.04, delay: 0.08, verb: 0.4 }); break;
      case 'broke': this.tone(110, 0.18, { type: 'sawtooth', vol: 0.06, verb: 0 }); this.tone(98, 0.22, { type: 'sawtooth', vol: 0.05, delay: 0.1, verb: 0 }); break;
      case 'birth': this.tone(midi(84), 0.25, { type: 'sine', vol: 0.08 * k, slide: 1.5, verb: 0.5, echo: 0.3 }); break;
      case 'death': this.tone(midi(69), 1.1, { type: 'triangle', vol: 0.08 * Math.max(0.3, k), slide: 0.5, verb: 0.6 }); break;
      case 'built': [0, 5, 9].forEach((n, i) => this.tone(midi(72 + n), 0.5, { type: 'triangle', vol: 0.05 * Math.max(0.4, k), delay: i * 0.1, verb: 0.5 })); break;
      case 'explosion':
        this.burst(1.6, { vol: 0.5 * k, from: 2500, to: 60, verb: 0.4 });
        this.tone(70, 0.9, { type: 'sine', vol: 0.5 * k, slide: 0.4, verb: 0.2 });
        break;
      case 'thunder': {
        const d = 0.15 + (1 - k) * 1.2;
        this.burst(0.25, { vol: 0.35 * Math.max(0.3, k), type: 'highpass', from: 1500, to: 4000, verb: 0.3 });
        this.burst(3.5, { vol: 0.5 * Math.max(0.25, k), from: 400, to: 40, delay: d, buf: this.brown, verb: 0.6 });
        break;
      }
      case 'zap': this.tone(60, 0.4, { type: 'sawtooth', vol: 0.12 * k, slide: 1.02, verb: 0.2 }); this.burst(0.3, { vol: 0.1 * k, type: 'highpass', from: 4000, to: 6000 }); break;
      case 'meteor': this.tone(1800, 1.6, { type: 'sine', vol: 0.05, slide: 0.15, verb: 0.4 }); break;
      case 'eruption': this.burst(4, { vol: 0.5 * Math.max(0.3, k), from: 300, to: 40, buf: this.brown, verb: 0.5 }); break;
      case 'era':
        [0, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(midi(50 + n), 5, { type: i % 2 ? 'triangle' : 'sawtooth', vol: 0.04, attack: 1.2, verb: 0.9 }));
        [0, 4, 7, 12].forEach((n, i) => this.tone(midi(86 + n), 2, { type: 'sine', vol: 0.06, delay: 1 + i * 0.25, echo: 0.5, verb: 0.6 }));
        break;
      case 'launch':
        this.burst(9, { vol: 0.6, from: 600, to: 50, buf: this.brown, verb: 0.6 });
        [0, 7, 12, 19, 24, 28].forEach((n, i) => this.tone(midi(45 + n), 9, { type: 'sawtooth', vol: 0.03, attack: 3, verb: 1, delay: i * 0.4 }));
        break;
      case 'miracle': [0, 7, 12].forEach((n, i) => this.tone(midi(79 + n), 1.2, { type: 'sine', vol: 0.06, delay: i * 0.12, echo: 0.5, verb: 0.7 })); break;
      case 'glitch': this.tone(80 + R() * 800, 0.12, { type: 'square', vol: 0.05 * k, verb: 0 }); break;
      case 'splash': this.burst(0.3, { vol: 0.08 * k, type: 'bandpass', from: 1500, to: 400, q: 1.5 }); break;
    }
  }

  // called ~10 times per second
  update(viewCounts) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const env = G.env;
    const vc = viewCounts;
    const cells = Math.max(1, G.view ? G.view.cols * G.view.rows : 1);
    const set = (node, v, tc = 0.8) => node.g.gain.setTargetAtTime(v, t, tc);
    const underground = G.view && G.view.camY + G.view.visR * 0.5 > G.world.sea + 10;
    set(this.wind, (0.03 + Math.abs(env.wind) * 0.16 + (env.storm ? 0.1 : 0)) * (underground ? 0.3 : 1));
    this.wind.f.frequency.setTargetAtTime(300 + Math.abs(env.wind) * 500 + Math.sin(t * 0.3) * 120, t, 1.5);
    const rainAmt = Math.min(1, (vc[E.WATER + 64] || 0) / 120);
    set(this.rain, rainAmt * 0.16);
    set(this.rain2, rainAmt * 0.12);
    const lavaAmt = Math.min(1, (vc[E.LAVA] || 0) / 300);
    set(this.lava, lavaAmt * 0.35);
    set(this.cave, underground ? 0.12 : 0, 2);
    // crackles
    const fire = Math.min(1, ((vc[E.FIRE] || 0) + (vc[E.EMBER] || 0)) / 120);
    if (fire > 0.02) {
      const n = Math.random() < fire * 3 ? 1 + ((Math.random() * fire * 4) | 0) : 0;
      for (let i = 0; i < n; i++) this.burst(0.02 + Math.random() * 0.03, { vol: 0.05 + fire * 0.12, type: 'bandpass', from: 1500 + Math.random() * 3000, to: 800, q: 2, delay: Math.random() * 0.1, verb: 0.05 });
    }
    // birds & crickets
    if (!env.night && (vc[E.BIRD] || 0) > 0 && !underground && Math.random() < 0.05 + vc[E.BIRD] * 0.01) this.chirp();
    if (env.night && env.season < 3 && !underground && Math.random() < 0.18) this.cricket();
    this.musicTick(t);
  }

  chirp() {
    const f = 2600 + Math.random() * 1800;
    const n = 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) this.tone(f * (1 + i * 0.08), 0.07, { type: 'sine', vol: 0.025, slide: 1.3, delay: i * 0.09, bus: this.ambBus, verb: 0.3 });
  }
  cricket() {
    const f = 4200 + Math.random() * 300;
    for (let i = 0; i < 3; i++) this.tone(f, 0.03, { type: 'sine', vol: 0.012, delay: i * 0.06, bus: this.ambBus, verb: 0.2 });
  }

  musicTick(t) {
    const env = G.env;
    if (G.settings.music <= 0) return;
    const tod = env.tod;
    const prog = env.night ? NIGHT : tod < 0.32 || tod > 0.68 ? DUSK : DAY;
    if (t >= this.nextChord) {
      const [root, iv] = prog[this.chordIdx % prog.length];
      this.chordIdx++;
      this.chord = { root, iv };
      const dur = 9;
      this.nextChord = t + dur - 0.5;
      // pad
      iv.slice(0, 3).forEach((n, k) => {
        const f = midi(root - 12 + n);
        for (const det of [-6, 6]) this.padVoice(f * Math.pow(2, det / 1200), dur + 2, k === 0 ? 0.03 : 0.022);
      });
      // bass
      this.tone(midi(root - 24), dur + 1, { type: 'sine', vol: 0.07, attack: 2.5, bus: this.music, verb: 0.2 });
    }
    if (this.chord && t >= this.nextPluck) {
      const era = G.tribe ? G.tribe.era : 0;
      this.nextPluck = t + (env.night ? 1.4 : 0.8) + Math.random() * (env.night ? 3.5 : 2.2) - Math.min(0.4, era * 0.08);
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];
      const n = this.chord.root + 12 + (Math.random() < 0.6 ? this.chord.iv[(Math.random() * this.chord.iv.length) | 0] : scale[(Math.random() * scale.length) | 0]);
      this.tone(midi(n), 2.4, { type: env.night ? 'sine' : 'triangle', vol: 0.045, attack: 0.01, bus: this.music, echo: 0.45, verb: 0.5 });
    }
  }

  padVoice(f, dur, vol) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(900 + Math.random() * 500, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(350, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}
