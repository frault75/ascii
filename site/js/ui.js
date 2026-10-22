// ─── ui.js ── HUD, tool dock, panels, toasts, chronicle, minimap ───────────
import { G, emit, on } from './state.js';
import { t, tr } from './i18n.js';
import { E, LUT_FG, LUT_BG } from './elements.js';
import { TOOLS, TOOL, CATS, DISCOVERIES, ACHIEVEMENTS, QUESTS, LAUNCH_COST, isUnlocked, unlock, isSandbox, canAdvance, advance, canSpend } from './progress.js';
import { ERAS, BUILDINGS, capacity, countB } from './life.js';
import { miracle } from './powers.js';
import { fmt, clamp } from './util.js';
import { SEASONS, DAY } from './weather.js';

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export const ELN = {
  [E.EMPTY]: ['Air', 'Air'], [E.BEDROCK]: ['Socle', 'Bedrock'], [E.STONE]: ['Pierre', 'Stone'], [E.DIRT]: ['Terre', 'Soil'], [E.GRASS]: ['Herbe', 'Grass'],
  [E.SAND]: ['Sable', 'Sand'], [E.WATER]: ['Eau', 'Water'], [E.LAVA]: ['Lave', 'Lava'], [E.FIRE]: ['Feu', 'Fire'], [E.SMOKE]: ['Fumée', 'Smoke'],
  [E.STEAM]: ['Vapeur', 'Steam'], [E.WOOD]: ['Bois', 'Wood'], [E.LEAF]: ['Feuillage', 'Leaves'], [E.SEED]: ['Graine', 'Seed'], [E.PLANT]: ['Tige', 'Stem'],
  [E.FLOWER]: ['Fleur', 'Flower'], [E.ICE]: ['Glace', 'Ice'], [E.SNOW]: ['Neige', 'Snow'], [E.ACID]: ['Acide', 'Acid'], [E.OIL]: ['Huile', 'Oil'],
  [E.GUNPOWDER]: ['Poudre', 'Gunpowder'], [E.TNT]: ['TNT', 'TNT'], [E.METAL]: ['Métal', 'Metal'], [E.GOLD]: ['Or', 'Gold'], [E.GLASS]: ['Verre', 'Glass'],
  [E.ASH]: ['Cendres', 'Ash'], [E.CLOUD]: ['Nuage', 'Cloud'], [E.BOLT]: ['Éclair', 'Lightning'], [E.OBSIDIAN]: ['Obsidienne', 'Obsidian'], [E.CRYSTAL]: ['Cristal', 'Crystal'],
  [E.GLITCH]: ['G̷L̷I̷T̷C̷H̷', 'G̷L̷I̷T̷C̷H̷'], [E.FISH]: ['Poisson', 'Fish'], [E.BIRD]: ['Oiseau', 'Bird'], [E.WORM]: ['Ver', 'Worm'], [E.BUTTERFLY]: ['Papillon', 'Butterfly'],
  [E.FIREFLY]: ['Luciole', 'Firefly'], [E.STRUCT]: ['Construction', 'Building'], [E.SAPLING]: ['Pousse', 'Sapling'], [E.CROP]: ['Blé', 'Wheat'],
  [E.STARSTONE]: ['Pierre-étoile', 'Starstone'], [E.EMBER]: ['Braise', 'Ember'], [E.SHROOM]: ['Champignon lumineux', 'Glowing mushroom'], [E.TORCH]: ['Torche', 'Torch'],
};
const eln = (e) => (ELN[e] ? ELN[e][G.settings.lang === 'fr' ? 0 : 1] : '?');

const UI = {
  tool: 'water', cat: 'terra', brush: 3, panel: null, codexTab: 'disc', logs: [], toasts: 0, hover: null, mobilePan: false,
};
G.ui = UI;

// ── text scramble effect ──
const SCR = '!<>-_\\/[]{}—=+*^?#░▒▓$%&@';
export function scramble(el, text, ms = 700) {
  const start = performance.now();
  const len = text.length;
  const step = () => {
    const p = Math.min(1, (performance.now() - start) / ms);
    let out = '';
    for (let i = 0; i < len; i++) {
      const th = i / len;
      if (p >= th * 0.7 + 0.3 || text[i] === ' ') out += text[i];
      else out += SCR[(Math.random() * SCR.length) | 0];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(step);
  };
  step();
}

// ── build ──
export function buildUI() {
  const ui = $('#ui');
  ui.innerHTML = '';
  ui.append(
    h('div', '', `
    <div id="top">
      <div id="brand" class="frame"><div class="logo">GENESIS<i>.TXT</i><span class="cur">_</span></div><div class="era"></div></div>
      <div id="clock" class="frame"><div class="date"></div><div class="time"></div><div class="bar"></div></div>
      <div id="res" class="frame"></div>
    </div>`).firstElementChild,
  );
  const left = h('div', '', '');
  left.id = 'left';
  left.innerHTML = `<div id="quest" class="frame"></div><div id="log" class="frame"><div class="ttl"><b>${t('log')}</b></div><div class="lines"></div></div>`;
  ui.append(left);
  const side = h('div');
  side.id = 'side';
  side.innerHTML = `
    <div id="minimap" class="frame"><canvas width="400" height="150"></canvas></div>
    <div id="nav">
      <button class="nb frame" data-p="civ"><span class="g">☺</span>CIV</button>
      <button class="nb frame" data-p="codex"><span class="g">◊</span>CODEX</button>
      <button class="nb frame" data-p="settings"><span class="g">⚙</span>${G.settings.lang === 'fr' ? 'RÉGL' : 'SET'}</button>
      <button class="nb frame" data-p="help"><span class="g">?</span>${t('help')}</button>
    </div>
    <div id="reveal" class="frame"></div>`;
  ui.append(side);
  const dock = h('div', 'frame');
  dock.id = 'dock';
  dock.innerHTML = `<div id="cats"></div><div id="tools"></div>`;
  ui.append(dock);
  for (const id of ['civ', 'codex', 'settings', 'help']) {
    const p = h('div', 'panel frame');
    p.id = 'p-' + id;
    ui.append(p);
  }
  const tip = h('div', 'frame');
  tip.id = 'tip';
  document.body.append(tip);
  const hover = h('div', 'frame');
  hover.id = 'hover';
  ui.append(hover);
  const toasts = h('div');
  toasts.id = 'toasts';
  ui.append(toasts);
  const hint = h('div', '');
  hint.id = 'hint';
  ui.append(hint);
  let banner = $('#banner');
  if (!banner) { banner = h('div'); banner.id = 'banner'; document.body.append(banner); }

  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('.nb');
    if (b) togglePanel(b.dataset.p);
  });
  buildCats();
  buildTools();
  setupMinimap();
  UI.logs.slice(-7).forEach((l) => renderLog(l));
  updateHUD(true);
}

function buildCats() {
  const el = $('#cats');
  el.innerHTML = '';
  for (const c of CATS) {
    const b = h('button', 'cat' + (UI.cat === c ? ' on' : ''), t('cat_' + c));
    b.dataset.cat = c;
    b.onclick = () => { setCat(c); sfx('select'); };
    el.append(b);
  }
  el.append(h('div', 'sp'));
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
    const pan = h('button', 'cat' + (UI.mobilePan ? ' on' : ''), '✥');
    pan.title = 'pan';
    pan.onclick = () => { UI.mobilePan = !UI.mobilePan; pan.classList.toggle('on', UI.mobilePan); sfx('click'); };
    el.append(pan);
    const sp = h('button', 'cat', G.paused ? '▶' : '‖');
    sp.onclick = () => { setSpeed(0); sp.textContent = G.paused ? '▶' : '‖'; sfx('click'); };
    el.append(sp);
  }
  const ctl = h('div', '');
  ctl.id = 'ctl';
  ctl.innerHTML = `
    <div class="grp"><span>${t('brush')}</span><button data-b="-">−</button><span class="bs"></span><button data-b="+">+</button></div>
    <div class="grp"><button data-s="0">‖</button><button data-s="1">▶</button><button data-s="2">▶▶</button><button data-s="4">▶▶▶</button></div>`;
  ctl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.b) setBrush(UI.brush + (b.dataset.b === '+' ? 1 : -1));
    if (b.dataset.s !== undefined) setSpeed(+b.dataset.s);
    sfx('click');
  });
  el.append(ctl);
  updateCtl();
}

export function setBrush(n) {
  UI.brush = clamp(n, 0, 14);
  updateCtl();
}
export function setSpeed(s) {
  if (s === 0) G.paused = !G.paused;
  else { G.paused = false; G.speed = s; }
  updateCtl();
}
function updateCtl() {
  const bs = $('#ctl .bs');
  if (!bs) return;
  bs.textContent = '●'.repeat(Math.min(5, Math.ceil((UI.brush + 1) / 3))) + ' ' + (UI.brush + 1);
  for (const b of document.querySelectorAll('#ctl [data-s]')) {
    const s = +b.dataset.s;
    b.classList.toggle('on', s === 0 ? G.paused : !G.paused && G.speed === s);
  }
}

export function setCat(c) {
  UI.cat = c;
  for (const b of document.querySelectorAll('.cat[data-cat]')) b.classList.toggle('on', b.dataset.cat === c);
  buildTools();
}

function toolList() {
  return TOOLS.filter((x) => x.cat === '*' || x.cat === UI.cat);
}

function buildTools() {
  const el = $('#tools');
  if (!el) return;
  el.innerHTML = '';
  let k = 1;
  for (const tl of toolList()) {
    const b = h('button', 'tool' + (tl.miracle ? ' miracle' : ''));
    b.dataset.id = tl.id;
    b.innerHTML = `<span class="k">${k <= 9 ? k : ''}</span><span class="c"></span><span class="g" style="color:${tl.c}">${tl.g}</span><span class="n">${tr(tl.n)}</span>`;
    k++;
    b.onclick = () => clickTool(tl.id);
    b.onmouseenter = (e) => showTip(e, tl);
    b.onmouseleave = hideTip;
    el.append(b);
  }
  refreshTools();
}

export function clickTool(id) {
  const tl = TOOL[id];
  if (!isUnlocked(id)) {
    if (tl.disc) { toast('warn', '', t('discoverToUnlock'), tr(DISCOVERIES[tl.disc].n)); sfx('broke'); return; }
    if (unlock(id)) { sfx('unlock'); toast('info', t('unlock'), tr(tl.n), tr(tl.d)); refreshTools(); if (!tl.miracle) selectTool(id); return; }
    sfx('broke');
    const b = document.querySelector(`.tool[data-id="${id}"]`);
    if (b) { b.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 200 }); }
    return;
  }
  if (tl.miracle) {
    if (miracle(id)) { sfx('miracle'); toast('info', 'MIRACLE', tr(tl.n), tr(tl.d)); }
    return;
  }
  selectTool(id);
}

export function selectTool(id) {
  UI.tool = id;
  sfx('select');
  refreshTools();
}

export function refreshTools() {
  for (const b of document.querySelectorAll('.tool')) {
    const tl = TOOL[b.dataset.id];
    const un = isUnlocked(tl.id);
    b.classList.toggle('on', UI.tool === tl.id);
    b.classList.toggle('lock', !un);
    b.classList.toggle('disc', !un && !!tl.disc);
    b.classList.toggle('afford', !un && !tl.disc && canSpend(tl.cost));
    const c = b.querySelector('.c');
    if (!un) c.textContent = tl.disc ? '?' : fmt(tl.cost) + '◊';
    else if (tl.use && !isSandbox()) c.textContent = tl.use + '◊';
    else c.textContent = '';
  }
}

// ── tooltip ──
function showTip(e, tl) {
  const tip = $('#tip');
  const un = isUnlocked(tl.id);
  let meta = '';
  if (!un) meta = tl.disc ? `${t('discoverToUnlock')} : ${tr(DISCOVERIES[tl.disc].n)}` : `${t('unlock')} · ${fmt(tl.cost)} ◊`;
  else if (tl.use && !isSandbox()) meta = `${tl.use} ◊ ${t('perUse')}`;
  tip.innerHTML = `<div class="h" style="color:${tl.c}">${tl.g}  ${tr(tl.n)}</div><div class="d">${tr(tl.d)}</div>${meta ? `<div class="m">${meta}</div>` : ''}`;
  const r = e.currentTarget.getBoundingClientRect();
  tip.classList.add('show');
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 6, innerWidth - tw - 6) + 'px';
  tip.style.top = r.top - th - 10 + 'px';
}
function hideTip() {
  $('#tip').classList.remove('show');
}

// ── panels ──
export function togglePanel(name) {
  UI.panel = UI.panel === name ? null : name;
  for (const p of document.querySelectorAll('.panel')) p.classList.toggle('show', p.id === 'p-' + UI.panel);
  for (const b of document.querySelectorAll('.nb')) b.classList.toggle('on', b.dataset.p === UI.panel);
  const tb = $('#toasts');
  if (tb) tb.classList.toggle('shift', !!UI.panel);
  sfx('click');
  if (UI.panel) renderPanel(UI.panel);
}
export function closePanels() {
  if (!UI.panel) return false;
  togglePanel(UI.panel);
  return true;
}

function renderPanel(name) {
  const p = $('#p-' + name);
  if (!p) return;
  const close = '<button class="x" data-close>✕</button>';
  const scroll = p.scrollTop;
  if (name === 'civ') p.innerHTML = close + civHTML();
  else if (name === 'codex') p.innerHTML = close + codexHTML();
  else if (name === 'settings') p.innerHTML = close + settingsHTML();
  else if (name === 'help') p.innerHTML = close + `<div class="ttl"><b>${t('help')}</b></div><pre class="help">${t('helpText')}</pre>` + guideHTML();
  p.querySelector('[data-close]').onclick = () => togglePanel(name);
  p.scrollTop = scroll;
  bindPanel(p, name);
}

function civHTML() {
  const T = G.tribe;
  const pop = T.villagers.length, cap = capacity();
  const nx = ERAS[T.era + 1];
  let next = '';
  if (nx) {
    const houses = T.buildings.filter((b) => ['tent', 'hut', 'house', 'stonehouse', 'tower'].includes(b.kind)).length;
    const reqs = [[pop >= nx.pop, `${nx.pop} ${t('inhabitants')} (${pop})`], [canSpend(nx.faith), `${fmt(nx.faith)} ◊`]];
    if (nx.houses) reqs.push([houses >= nx.houses, `${nx.houses} ${t('houses')} (${houses})`]);
    next = `<h3>${t('nextEra')} — ${t(nx.key)}</h3>` + reqs.map(([ok, s]) => `<div class="req ${ok ? 'ok' : 'no'}">${ok ? '[✓]' : '[ ]'} ${s}</div>`).join('') +
      `<div style="margin-top:8px"><button class="bt gold ${canAdvance() ? '' : 'off'}" data-act="advance">✦ ${t('reveal')} · ${fmt(nx.faith)} ◊</button></div>`;
  }
  const kinds = {};
  for (const b of T.buildings) kinds[b.kind] = (kinds[b.kind] || 0) + 1;
  const blist = Object.entries(kinds).map(([k, n]) => `<div class="row"><span class="l">${t('b_' + k)}</span><span class="v">×${n}</span></div>`).join('');
  const vl = T.villagers.slice(0, 80).map((v) => `<div class="vl" data-v="${v.id}"><span class="g" style="color:rgb(${v.color})">${v.kid ? 'o' : '☺'}</span>${v.name}<span class="j">${v.kid ? t('kid') : t('job_' + v.job)} · ${v.age} ${t('days')}</span></div>`).join('');
  return `<div class="ttl"><b>${t('civ')}</b></div>
    <div class="row"><span class="l">${t('eraWord')} ${ROMAN[T.era]}</span><span class="v amber">${t('era' + T.era)}</span></div>
    <div class="row"><span class="l">${t('pop')}</span><span class="v">${pop} / ${cap}</span></div>
    <div class="row"><span class="l">♥ / †</span><span class="v">${T.births} / ${T.deaths}</span></div>
    <div class="row"><span class="l">${t('mood')}</span><span class="v">${moodWord()} (${Math.round(T.happiness * 100)}%)</span></div>
    <div class="row"><span class="l">${t('faith')}</span><span class="v cyan">+${T.faithRate.toFixed(2)} ◊/s</span></div>
    ${next}
    <h3>${t('buildings')}</h3>${blist || '<div class="dim">—</div>'}
    <h3>${t('villagers')}</h3>${vl || '<div class="dim">—</div>'}`;
}

function codexHTML() {
  const P = G.progress;
  const nd = Object.keys(P.found).length, td = Object.keys(DISCOVERIES).length;
  const na = Object.keys(P.ach).length, ta = ACHIEVEMENTS.length;
  let body = '';
  if (UI.codexTab === 'disc') {
    body = Object.entries(DISCOVERIES).map(([k, d]) => {
      const f = P.found[k];
      return `<div class="disc ${f ? '' : 'no'}"><span class="n">${f ? tr(d.n) : '???'}</span>${f ? ` <span class="dim" style="float:right;font-size:10px">${t('day')} ${f}</span>` : ''}<div class="d">${f ? tr(d.d) : mask(tr(d.d), k)}</div></div>`;
    }).join('');
  } else if (UI.codexTab === 'ach') {
    body = ACHIEVEMENTS.map((a) => {
      const f = P.ach[a.id];
      return `<div class="disc ach ${f ? '' : 'no'}"><span class="n">${f ? '★ ' : '☆ '}${tr(a.n)}</span><div class="d">${tr(a.d)}${a.r ? ` · +${a.r}◊` : ''}</div></div>`;
    }).join('');
  } else {
    const S = P.stats, T = G.tribe;
    const rows = [
      [t('day'), G.env.day + 1], [t('year'), G.env.year], [t('pop') + ' max', T.maxPop], ['♥ / †', `${T.births} / ${T.deaths}`],
      [G.settings.lang === 'fr' ? 'cellules créées' : 'cells created', fmt(S.cells)], [G.settings.lang === 'fr' ? 'explosions' : 'explosions', S.explosions],
      [G.settings.lang === 'fr' ? 'éclairs' : 'lightning', S.strikes], ['miracles', S.miracles], [G.settings.lang === 'fr' ? 'foi totale' : 'total faith', fmt(P.totalFaith) + ' ◊'],
      [G.settings.lang === 'fr' ? 'graine du monde' : 'world seed', G.world.seed],
    ];
    body = rows.map(([l, v]) => `<div class="row"><span class="l">${l}</span><span class="v">${v}</span></div>`).join('');
  }
  return `<div class="ttl"><b>${t('codex')}</b></div>
    <div class="tabs"><button data-tab="disc" class="${UI.codexTab === 'disc' ? 'on' : ''}">${t('discoveries')} ${nd}/${td}</button><button data-tab="ach" class="${UI.codexTab === 'ach' ? 'on' : ''}">${t('achievements')} ${na}/${ta}</button><button data-tab="stats" class="${UI.codexTab === 'stats' ? 'on' : ''}">STATS</button></div>${body}`;
}

// half-hidden hint for undiscovered entries
function mask(str, key) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Array.from(str).map((c, i) => (/[\p{L}]/u.test(c) && ((h >> (i % 16)) ^ i * 7) % 2 === 0 ? '·' : c)).join('');
}

function settingsHTML() {
  const s = G.settings;
  const sl = (k, label) => `<div class="set"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-set="${k}"></div>`;
  const opt = (k, label, vals) => `<div class="set"><span>${label}</span><div class="opts">${vals.map(([v, l]) => `<button data-opt="${k}" data-val="${v}" class="${String(s[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
  return `<div class="ttl"><b>${t('settings')}</b></div>
    ${sl('crt', t('sCrt'))}${sl('bloom', t('sBloom'))}${sl('volume', t('sVolume'))}${sl('music', t('sMusic'))}${sl('sfx', t('sSfx'))}
    ${opt('lang', t('sLang'), [['fr', 'FR'], ['en', 'EN']])}${opt('hints', t('sHints'), [[true, t('on')], [false, t('off')]])}
    <div class="set"><span>${t('sMode')}</span><span class="amber">${G.mode === 'sandbox' ? t('sandbox') : 'GENESIS'}</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
      <button class="bt" data-act="export">${t('sExport')}</button>
      <button class="bt" data-act="photo">${t('sPhoto')}</button>
      <button class="bt" data-act="new">${t('sNew')}</button>
      <button class="bt danger" data-act="reset">${t('sReset')}</button>
    </div>`;
}

function guideHTML() {
  const fr = G.settings.lang === 'fr';
  return `<h3>${fr ? 'LE MONDE' : 'THE WORLD'}</h3><pre class="help">${fr
    ? 'Tout ici est fait de texte, et tout réagit : l\'eau coule, le feu se propage,\nla lave fige au contact de l\'eau, les graines deviennent forêts.\n\nTa tribu ☺ vit seule : elle coupe du bois, pêche, cueille, bâtit,\ndort la nuit et prie. Sa prière te donne la FOI ◊.\n\nDépense la foi pour débloquer de nouveaux pouvoirs et pour\nles RÉVÉLATIONS qui font passer ta civilisation à l\'ère suivante.\n\nCombine les éléments pour faire des DÉCOUVERTES.'
    : 'Everything here is made of text, and everything reacts: water flows, fire spreads,\nlava hardens in water, seeds grow into forests.\n\nYour tribe ☺ lives on its own: they chop wood, fish, gather, build,\nsleep at night and pray. Their prayers give you FAITH ◊.\n\nSpend faith to unlock new powers and for the REVELATIONS\nthat move your civilisation into the next era.\n\nCombine elements to make DISCOVERIES.'}</pre>`;
}

function bindPanel(p, name) {
  p.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { UI.codexTab = b.dataset.tab; renderPanel('codex'); sfx('click'); }));
  p.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { G.cam.follow = +b.dataset.v; sfx('select'); }));
  p.querySelectorAll('[data-set]').forEach((inp) => (inp.oninput = () => { G.settings[inp.dataset.set] = +inp.value; emit('settings'); }));
  p.querySelectorAll('[data-opt]').forEach((b) => (b.onclick = () => {
    let v = b.dataset.val;
    if (v === 'true') v = true; else if (v === 'false') v = false;
    G.settings[b.dataset.opt] = v;
    emit('settings');
    if (b.dataset.opt === 'lang') { buildUI(); togglePanel('settings'); return; }
    renderPanel(name);
  }));
  p.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'advance') { if (advance()) { renderPanel(name); } }
    else emit('action', a);
    sfx('click');
  }));
}

// ── HUD ──
let lastFaith = 0;
const WX = { clear: '☀', cloudy: '☁', rain: '☂', storm: 'ϟ', snow: '❄' };
export function moodWord() {
  const hp = G.tribe.happiness;
  return t(hp > 0.75 ? 'happy' : hp > 0.5 ? 'content' : hp > 0.3 ? 'uneasy' : 'miserable');
}

export function updateHUD(force = false) {
  const env = G.env, T = G.tribe, P = G.progress;
  if (!env || !T) return;
  $('#brand .era').textContent = `${t('eraWord')} ${ROMAN[T.era]} · ${t('era' + T.era)}`;
  const hh = Math.floor(env.tod * 24), mm = Math.floor((env.tod * 24 - hh) * 60);
  const wk = env.temp < 0 && env.raining ? 'snow' : env.weather;
  $('#clock .date').textContent = `${t('year')} ${env.year} · ${t(SEASONS[env.season])} · ${t('day')} ${env.day + 1}`;
  $('#clock .time').innerHTML = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}<span class="wx">${WX[wk]} ${Math.round(env.temp)}°</span>`;
  const n = 26;
  let bar = '';
  const sp = Math.floor(env.tod * n);
  for (let i = 0; i < n; i++) {
    const tt = i / n;
    bar += i === sp ? (env.night ? '☾' : '☼') : tt > 0.25 && tt < 0.75 ? '─' : '·';
  }
  const wind = env.wind;
  const wa = Math.abs(wind) < 0.08 ? '' : (wind > 0 ? '›' : '‹').repeat(Math.min(3, Math.ceil(Math.abs(wind) * 4)));
  $('#clock .bar').textContent = bar + '  ' + wa;

  const pop = T.villagers.length, cap = capacity();
  const faith = isSandbox() ? '∞' : fmt(P.faith);
  const m = Math.round(T.happiness * 5);
  const mood = '▮'.repeat(m) + '▯'.repeat(5 - m);
  const mc = T.happiness > 0.6 ? 'green' : T.happiness > 0.35 ? 'amber' : 'red';
  $('#res').innerHTML = `
    <div class="faith r" title="${t('faith')}"><span class="k">◊</span><span class="v">${faith}</span><span class="s">+${T.faithRate.toFixed(2)}${t('perSec')}</span><span class="mood ${mc}" style="margin-left:auto" title="${t('mood')} : ${moodWord()}">${mood}</span></div>
    <div class="r" title="${t('pop')}"><span class="k">☺</span><span class="v">${pop}<span class="dim">/${cap}</span></span></div>
    <div class="r" title="${t('food')}"><span class="k">♣</span><span class="v ${T.food < pop ? 'red' : ''}">${fmt(T.food)}</span></div>
    <div class="r" title="${t('wood')}"><span class="k">≡</span><span class="v">${fmt(T.wood)}</span></div>
    <div class="r" title="${t('stone')}"><span class="k">▪</span><span class="v">${fmt(T.stone)}</span></div>
    <div class="r" title="${t('metal')}"><span class="k">◆</span><span class="v">${fmt(T.metal)}</span></div>
    <div class="r" title="${t('discoveries')}"><span class="k">✦</span><span class="v">${Object.keys(P.found).length}<span class="dim">/${Object.keys(DISCOVERIES).length}</span></span></div>`;
  if (P.faith > lastFaith + 20 && !isSandbox()) $('#res .faith .v').classList.add('pulse');
  lastFaith = P.faith;

  // quest
  const q = QUESTS[P.quest];
  const qe = $('#quest');
  if (q && !isSandbox()) {
    const [cur, goal] = q.p();
    const w = 22, f = Math.round(clamp(cur / goal, 0, 1) * w);
    qe.style.display = '';
    qe.innerHTML = `<div class="ttl"><b>${t('quest')} ${P.quest + 1}/${QUESTS.length}</b></div>${q.r ? `<span class="rw">+${q.r}◊</span>` : ''}<div class="q">${tr(q.n)}</div><div class="pb">[${'█'.repeat(f)}${'░'.repeat(w - f)}] ${Math.min(cur, goal)}/${goal}</div>`;
  } else qe.style.display = 'none';

  // revelation / launch card
  const rv = $('#reveal');
  const nx = ERAS[T.era + 1];
  if (T.buildings.some((b) => b.kind === 'rocket') && !T.launched) {
    rv.classList.add('show');
    const ok = canSpend(LAUNCH_COST);
    rv.innerHTML = `<div class="ttl"><b>${t('launch')}</b></div><div class="dim" style="font-size:10px">${t('launchSub')}</div><button class="bt gold ${ok ? '' : 'off'}" data-act="launch">▲ ${t('launch')} · ${fmt(LAUNCH_COST)} ◊</button>`;
    rv.querySelector('button').onclick = () => emit('action', 'launch');
  } else if (nx && canAdvance()) {
    rv.classList.add('show');
    rv.innerHTML = `<div class="ttl"><b>${t('reveal')}</b></div><div style="font-size:11px">${t('eraWord')} ${ROMAN[T.era + 1]} · <span class="amber">${t(nx.key)}</span></div><button class="bt gold" data-act="advance">✦ ${t('reveal')} · ${fmt(nx.faith)} ◊</button>`;
    rv.querySelector('button').onclick = () => { advance(); sfx('click'); };
  } else rv.classList.remove('show');

  refreshTools();
  updateCtl();
  if (UI.panel && (force || Math.random() < 0.3) && UI.panel !== 'settings') renderPanel(UI.panel);
}

// ── hover info ──
export function setHover(info) {
  const el = $('#hover');
  if (!el) return;
  el.innerHTML = info || '';
  el.style.display = info ? '' : 'none';
}
export function cellInfo(x, y) {
  const W = G.world;
  if (!W || x < 0 || y < 0 || x >= W.w || y >= W.h) return '';
  const T = G.tribe;
  const v = T.villagers.find((q) => !q.inside && q.x === x && q.y === y);
  if (v) return `<b style="color:rgb(${v.color})">☺ ${v.name}</b> · ${v.kid ? t('kid') : t('job_' + v.job)} · ${t('age')} ${v.age}`;
  const tt = W.t[y * W.w + x];
  let extra = '';
  if (tt === E.STRUCT) {
    const b = T.buildings.find((q) => q.id === W.a[y * W.w + x]);
    if (b) extra = ' · ' + t('b_' + b.kind);
  }
  return `<span class="dim">[${x},${y}]</span> <b>${eln(tt)}</b>${extra}`;
}

// ── chronicle ──
export function logLine(text, hl = false, color) {
  const env = G.env;
  const hh = Math.floor(env.tod * 24), mm = Math.floor((env.tod * 24 - hh) * 60);
  const l = { d: `J${env.day + 1} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, text, hl, color };
  UI.logs.push(l);
  if (UI.logs.length > 200) UI.logs.shift();
  renderLog(l);
}
function renderLog(l) {
  const box = $('#log .lines');
  if (!box) return;
  const e = h('div', 'e' + (l.hl ? ' hl' : ''), `<span class="d">${l.d}</span>`);
  const s = h('span', '', '');
  s.textContent = l.text;
  if (l.color) s.style.color = l.color;
  e.append(s);
  box.append(e);
  while (box.children.length > 9) box.firstChild.remove();
}

// ── toasts ──
export function toast(kind, k, title, desc = '', reward = '') {
  const box = $('#toasts');
  if (!box) return;
  while (box.children.length >= 3) box.firstChild.remove();
  const e = h('div', 'toast frame ' + kind, `<div class="k">${k}</div><div class="h"></div><div class="d"></div>${reward ? `<div class="r">${reward}</div>` : ''}`);
  e.querySelector('.d').textContent = desc;
  box.append(e);
  scramble(e.querySelector('.h'), title, 650);
  setTimeout(() => e.classList.add('out'), 3800);
  setTimeout(() => e.remove(), 4300);
}

export function banner(k, title, desc, button, onBtn, ms = 4200) {
  const b = $('#banner');
  b.innerHTML = `<div class="k">${k}</div><div class="h"></div><div class="d">${desc}</div>${button ? `<button class="bt gold">${button}</button>` : ''}`;
  b.classList.add('show');
  scramble(b.querySelector('.h'), title, 1400);
  if (button) b.querySelector('button').onclick = () => { b.classList.remove('show'); onBtn && onBtn(); };
  else setTimeout(() => b.classList.remove('show'), ms);
}

export function hint(text) {
  const el = $('#hint');
  if (!el) return;
  el.textContent = text || '';
  el.style.opacity = text && G.settings.hints ? 1 : 0;
}

function sfx(n) {
  if (G.audio) G.audio.sfx(n);
}

// ── minimap ──
let mmCtx, mmImg;
const MM = new Uint8Array(64 * 3);
function setupMinimap() {
  const cv = $('#minimap canvas');
  if (!cv) return;
  mmCtx = cv.getContext('2d');
  mmImg = mmCtx.createImageData(cv.width, cv.height);
  for (let e = 1; e < 64; e++) {
    const o = (e * 256 + 3) * 3;
    MM[e * 3] = (LUT_FG[o] * 0.4 + LUT_BG[o] * 0.6) | 0;
    MM[e * 3 + 1] = (LUT_FG[o + 1] * 0.4 + LUT_BG[o + 1] * 0.6) | 0;
    MM[e * 3 + 2] = (LUT_FG[o + 2] * 0.4 + LUT_BG[o + 2] * 0.6) | 0;
  }
  const set = (c) => [c >> 16, (c >> 8) & 255, c & 255];
  const over = { [E.WATER]: 0x2a64c8, [E.LAVA]: 0xff6a1a, [E.LEAF]: 0x3f9a44, [E.GRASS]: 0x5aa83a, [E.STRUCT]: 0xffd27a, [E.CLOUD]: 0x9aa4b8, [E.FIRE]: 0xffb030, [E.CROP]: 0xc8c050, [E.SNOW]: 0xf0f4ff, [E.ICE]: 0xa8d8f0, [E.WOOD]: 0x8a5a30, [E.CRYSTAL]: 0xff70ff, [E.SHROOM]: 0x50f0c8, [E.GLITCH]: 0xff2a8a };
  for (const k in over) { const c = set(over[k]); MM[k * 3] = c[0]; MM[k * 3 + 1] = c[1]; MM[k * 3 + 2] = c[2]; }
  let drag = false;
  const go = (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * G.world.w, y = ((e.clientY - r.top) / r.height) * G.world.h;
    G.cam.follow = null;
    G.cam.x = x - (G.view ? G.view.visC / 2 : 60);
    G.cam.y = y - (G.view ? G.view.visR / 2 : 30);
  };
  cv.onpointerdown = (e) => { drag = true; go(e); cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = (e) => { if (drag) go(e); };
  cv.onpointerup = () => (drag = false);
}

export function drawMinimap() {
  if (!mmCtx || !G.world) return;
  const W = G.world;
  const { w, h: hh, t } = W;
  const d = mmImg.data;
  const sea = W.sea;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const tt = t[y * w + x];
      const o = (y * w + x) * 4;
      if (tt === 0) {
        if (y < W.surf[x]) { const f = y / sea; d[o] = 8 + f * 20; d[o + 1] = 12 + f * 26; d[o + 2] = 30 + f * 40; }
        else { d[o] = 6; d[o + 1] = 5; d[o + 2] = 9; }
      } else { d[o] = MM[tt * 3]; d[o + 1] = MM[tt * 3 + 1]; d[o + 2] = MM[tt * 3 + 2]; }
      d[o + 3] = 255;
    }
  }
  for (const v of G.tribe.villagers) {
    if (v.inside) continue;
    const o = (v.y * w + v.x) * 4;
    d[o] = 255; d[o + 1] = 255; d[o + 2] = 255;
  }
  mmCtx.putImageData(mmImg, 0, 0);
  const vw = G.view;
  if (vw) {
    mmCtx.strokeStyle = 'rgba(255,207,90,.9)';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect(vw.camX + 0.5, vw.camY + 0.5, vw.visC, vw.visR);
  }
}

export { UI };
