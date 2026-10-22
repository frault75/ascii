// ─── weather.js ── time, seasons, sky, wind, clouds & weather ──────────────
import { G, emit } from './state.js';
import { E } from './elements.js';
import { makeCloud } from './worldgen.js';
import { lerp, smooth, clamp } from './util.js';

export const DAY = 18000; // ticks per in-game day (5 minutes at 1×)
export const SEASON_DAYS = 3;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const BASE_TEMP = [12, 24, 9, -7];
const GROW = [1.5, 1.0, 0.45, 0.06];

export function createEnv(time = DAY * 0.29) {
  G.env = {
    time,
    tod: 0, day: 0, year: 1, season: 0, seasonT: 0,
    daylight: 1, night: false, sunElev: 1,
    temp: 12, grow: 1, evap: 0,
    weather: 'clear', weatherTimer: DAY * 0.2, rainBudget: 0,
    raining: false, storm: false, clear: true, cover: 0.1, rainRate: 0.025,
    wind: 0.1, windTarget: 0.2, cloudAcc: 0,
    cloudLine: 30,
    aurora: 0, auroraTarget: 0, rainbow: 0, eclipse: 0, eclipseT: -1,
    lastDay: -1,
  };
  updateEnv(0);
  return G.env;
}

export function updateEnv(dt = 1) {
  const env = G.env;
  env.time += dt;
  const tod = (env.time % DAY) / DAY;
  env.tod = tod;
  env.day = Math.floor(env.time / DAY);
  const sd = env.day / SEASON_DAYS;
  env.season = Math.floor(sd) % 4;
  env.seasonT = sd - Math.floor(sd);
  env.year = Math.floor(env.day / (SEASON_DAYS * 4)) + 1;
  const elev = Math.sin((tod - 0.25) * Math.PI * 2);
  env.sunElev = elev;
  env.daylight = smooth(-0.1, 0.18, elev) * (1 - env.eclipse * 0.85);
  env.night = env.daylight < 0.3;

  // temperature blends between seasons so transitions are gentle
  const next = (env.season + 1) % 4;
  const blend = smooth(0.7, 1, env.seasonT);
  let temp = lerp(BASE_TEMP[env.season], BASE_TEMP[next], blend);
  temp += elev * 4 - (env.raining ? 3 : 0);
  env.temp = temp;
  env.grow = lerp(GROW[env.season], GROW[next], blend) * (env.raining ? 1.4 : 1) * (env.night ? 0.6 : 1);
  env.evap = env.season === 1 && !env.night && env.clear ? 1 : env.season === 0 && env.clear ? 0.3 : 0;

  // wind wanders
  if (Math.random() < 0.002 * dt) env.windTarget = (Math.random() * 2 - 1) * (env.storm ? 1 : 0.5);
  env.wind = lerp(env.wind, env.windTarget, 0.002 * dt);

  // weather state machine
  env.weatherTimer -= dt;
  if (env.raining && env.rainBudget <= 0 && env.weatherTimer > 900) env.weatherTimer = 900;
  if (env.weatherTimer <= 0) {
    env.weatherTimer = DAY * (0.12 + Math.random() * 0.25);
    nextWeather(env);
  }
  env.raining = env.weather === 'rain' || env.weather === 'storm';
  env.storm = env.weather === 'storm';
  env.clear = env.weather === 'clear';
  const coverT = { clear: 0.04, cloudy: 0.32, rain: 0.55, storm: 0.85 }[env.weather];
  env.cover = lerp(env.cover, coverT, 0.0015 * dt);
  env.rainRate = env.storm ? 0.05 : 0.022;

  // special skies
  env.aurora = lerp(env.aurora, env.night ? env.auroraTarget : 0, 0.002 * dt);
  env.rainbow = Math.max(0, env.rainbow - 0.00012 * dt);
  if (env.eclipseT >= 0) {
    env.eclipseT += dt;
    const p = env.eclipseT / 3600;
    env.eclipse = p < 1 ? Math.sin(p * Math.PI) ** 0.6 : 0;
    if (p >= 1) env.eclipseT = -1;
  }

  if (env.day !== env.lastDay) {
    if (env.lastDay >= 0) emit('newDay', env.day);
    env.lastDay = env.day;
    env.auroraTarget = env.season === 3 && Math.random() < 0.5 ? 1 : env.season === 2 && Math.random() < 0.15 ? 0.7 : 0;
  }
}

function nextWeather(env) {
  const prev = env.weather;
  const r = Math.random();
  const summer = env.season === 1, winter = env.season === 3;
  switch (prev) {
    case 'clear': env.weather = r < (winter ? 0.45 : 0.35) ? 'cloudy' : 'clear'; break;
    case 'cloudy': env.weather = r < 0.35 ? 'rain' : r < 0.42 + (summer ? 0.08 : 0) ? 'storm' : r < 0.75 ? 'clear' : 'cloudy'; break;
    case 'rain': env.weather = r < 0.45 ? 'cloudy' : r < 0.6 ? 'storm' : r < 0.75 ? 'clear' : 'rain'; break;
    case 'storm': env.weather = r < 0.6 ? 'rain' : 'cloudy'; break;
  }
  if ((prev === 'rain' || prev === 'storm') && (env.weather === 'cloudy' || env.weather === 'clear') && !env.night && env.temp > 0) {
    env.rainbow = 1;
    emit('rainbow');
  }
  if (env.weather !== prev) {
    if (env.weather === 'rain' || env.weather === 'storm') env.rainBudget = env.weather === 'storm' ? 1500 : 800;
    emit('weather', env.weather, prev);
  }
}

export function forceWeather(kind) {
  const env = G.env;
  const prev = env.weather;
  env.weather = kind;
  env.weatherTimer = DAY * 0.2;
  if (kind === 'rain' || kind === 'storm') env.rainBudget = kind === 'storm' ? 1500 : 800;
  if (kind !== prev) emit('weather', kind, prev);
}

// clouds drift with the wind and are topped up to match the weather
export function updateClouds() {
  const W = G.world, env = G.env;
  const { w, t, d, a, v } = W;
  env.cloudAcc += 0.015 + Math.abs(env.wind) * 0.07;
  if (env.cloudAcc >= 1) {
    env.cloudAcc -= 1;
    const dir = env.wind >= 0 ? 1 : -1;
    const yMax = env.cloudLine + 12;
    for (let y = 1; y < yMax; y++) {
      const row = y * w;
      for (let k = 1; k < w - 1; k++) {
        const x = dir > 0 ? w - 1 - k : k;
        const i = row + x;
        if (t[i] !== E.CLOUD) continue;
        const j = i + dir;
        const tj = t[j];
        if (x + dir <= 0 || x + dir >= w - 1) { t[i] = 0; continue; }
        if (tj === 0) {
          t[j] = E.CLOUD; d[j] = d[i]; a[j] = a[i]; v[j] = v[i];
          t[i] = 0; d[i] = 0; a[i] = 0;
        }
      }
    }
  }
  if ((W.tick & 63) === 0) {
    const have = W.counts[E.CLOUD];
    const want = env.cover * w * 7;
    if (have < want) {
      const fromEdge = Math.random() < 0.7;
      const x = fromEdge ? (env.wind >= 0 ? 8 + Math.random() * 30 : w - 8 - Math.random() * 30) : 10 + Math.random() * (w - 20);
      const flags = env.storm ? 2 : 0;
      makeCloud(W, x, 5 + Math.random() * 16, 5 + Math.random() * (env.storm ? 16 : 10), 20 + Math.random() * 40, flags);
    }
  }
}

// ── sky palette ────────────────────────────────────────────────────────────
const KEYS = [
  [0.0, [3, 5, 14], [9, 13, 32], [0.15, 0.19, 0.34]],
  [0.205, [5, 7, 20], [16, 18, 44], [0.16, 0.19, 0.34]],
  [0.245, [28, 28, 76], [180, 86, 96], [0.55, 0.4, 0.45]],
  [0.28, [56, 98, 176], [255, 168, 112], [1.0, 0.76, 0.56]],
  [0.36, [44, 114, 214], [164, 206, 244], [1.0, 0.97, 0.9]],
  [0.64, [44, 114, 214], [164, 206, 244], [1.0, 0.97, 0.9]],
  [0.715, [70, 78, 168], [255, 150, 92], [1.0, 0.72, 0.5]],
  [0.755, [38, 28, 86], [196, 76, 84], [0.6, 0.36, 0.42]],
  [0.8, [9, 9, 30], [28, 22, 58], [0.17, 0.18, 0.34]],
  [1.0, [3, 5, 14], [9, 13, 32], [0.15, 0.19, 0.34]],
];

export function skyPalette(env) {
  const tod = env.tod;
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1][0] <= tod) k++;
  const A = KEYS[k], B = KEYS[k + 1];
  const f = clamp((tod - A[0]) / (B[0] - A[0]), 0, 1);
  const top = A[1].map((c, i) => lerp(c, B[1][i], f));
  const hor = A[2].map((c, i) => lerp(c, B[2][i], f));
  const amb = A[3].map((c, i) => lerp(c, B[3][i], f));
  // overcast: desaturate & darken
  const cov = clamp((env.cover - 0.1) * 1.3, 0, 0.85) * (env.storm ? 1.1 : 1);
  for (const c of [top, hor]) {
    const l = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
    for (let i = 0; i < 3; i++) c[i] = lerp(c[i], l * 0.75, cov * 0.75);
  }
  for (let i = 0; i < 3; i++) amb[i] *= 1 - cov * 0.35;
  if (env.eclipse > 0) {
    const e = env.eclipse;
    for (let i = 0; i < 3; i++) {
      top[i] = lerp(top[i], [6, 4, 14][i], e * 0.9);
      hor[i] = lerp(hor[i], [80, 30, 40][i], e * 0.8);
      amb[i] = lerp(amb[i], [0.2, 0.12, 0.2][i], e * 0.85);
    }
  }
  return { top, hor, amb };
}
