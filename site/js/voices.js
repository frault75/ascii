// ─── voices.js ── villagers talk: chatter, requests, and talking to YOU ────
import { G, on, emit } from './state.js';
import { E } from './elements.js';
import { say } from './life.js';
import { earn, isSandbox } from './progress.js';
import { pick } from './util.js';

const fr = () => G.settings.lang === 'fr';
const L = (a, b) => (fr() ? a : b);
const R = Math.random;

// how well the tribe speaks: 0 babble · 1 words · 2 sentences · 3 aware of you
const level = () => {
  const e = G.tribe ? G.tribe.era : 0;
  return e <= 0 ? 0 : e === 1 ? 1 : e === 2 ? 2 : 3;
};

// ── babble for the dawn era ────────────────────────────────────────────────
const SYL = ['ka', 'ri', 'mu', 'na', 'oo', 'ti', 'pa', 'lo', 'ze', 'yu', 'ba', 'ki', 'he', 'mo'];
function babble(word) {
  const n = 1 + ((R() * 3) | 0);
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(pick(SYL) + (R() < 0.3 ? pick(SYL) : ''));
  const s = parts.join(R() < 0.5 ? ' ' : '-');
  const tail = pick(['?', '!', '...', '', '!!']);
  if (!word) return s + tail;
  return R() < 0.5 ? `${s}... ${word.toUpperCase()}${tail}` : `${word.toUpperCase()}? ${s}${tail}`;
}

// ── chatter lines (short: they float above heads) ─────────────────────────
// each entry: [keyword for babble, words (level 1), sentences (level 2+)] in fr / en
const CHAT = {
  hungry: { k: ['faim', 'food'], w: [['Faim.', 'Ventre vide.', 'Manger?'], ['Hungry.', 'Empty belly.', 'Eat?']], s: [['J\'ai si faim...', 'Il reste à manger?', 'Mon ventre gronde.'], ['I\'m so hungry...', 'Any food left?', 'My belly growls.']] },
  rain: { k: ['pluie', 'rain'], w: [['Eau! Ciel!', 'Pluie!', 'Mouillé.'], ['Sky water!', 'Rain!', 'Wet.']], s: [['Le ciel pleure.', 'Bonne pluie pour les champs.', 'Je suis trempé!'], ['The sky is crying.', 'Good rain for the fields.', 'I\'m soaked!']] },
  storm: { k: ['boum', 'boom'], w: [['Ciel fâché!', 'Peur...'], ['Angry sky!', 'Scared...']], s: [['Le ciel est en colère.', 'Restons à l\'abri!', 'Qui a fâché le ciel?'], ['The sky is angry.', 'Stay inside!', 'Who angered the sky?']] },
  snow: { k: ['froid', 'cold'], w: [['Froid.', 'Blanc partout.'], ['Cold.', 'White everywhere.']], s: [['Il fait si froid...', 'La neige est belle.', 'Mes pieds gèlent.'], ['It\'s so cold...', 'The snow is pretty.', 'My feet are freezing.']] },
  night: { k: ['nuit', 'night'], w: [['Noir...', 'Dormir.'], ['Dark...', 'Sleep.']], s: [['La nuit tombe.', 'Les étoiles sont là.', 'Je n\'aime pas le noir.'], ['Night is falling.', 'The stars are out.', 'I don\'t like the dark.']] },
  morning: { k: ['soleil', 'sun'], w: [['Soleil!', 'Jour!'], ['Sun!', 'Day!']], s: [['Bonjour, soleil.', 'Encore un jour.', 'Au travail!'], ['Hello, sun.', 'Another day.', 'Back to work!']] },
  happy: { k: ['beau', 'nice'], w: [['Bien.', 'Content.', 'Beau!'], ['Good.', 'Happy.', 'Pretty!']], s: [['Quelle belle journée.', 'J\'aime ce village.', 'Tout va bien.'], ['What a lovely day.', 'I love this village.', 'All is well.']] },
  sad: { k: ['triste', 'sad'], w: [['Triste.', 'Seul...'], ['Sad.', 'Alone...']], s: [['Rien ne va.', 'Je suis fatigué.', 'Pourquoi tout ça?'], ['Nothing\'s right.', 'I\'m tired.', 'Why all this?']] },
  grief: { k: ['parti', 'gone'], w: [['{d}... parti.', 'Manque {d}.'], ['{d}... gone.', 'Miss {d}.']], s: [['{d} me manque.', 'On n\'oubliera pas {d}.', 'Pourquoi {d}?'], ['I miss {d}.', 'We won\'t forget {d}.', 'Why {d}?']] },
  work: { k: ['bois', 'wood'], w: [['Travail.', 'Bois. Bon.'], ['Work.', 'Wood. Good.']], s: [['Encore un arbre.', 'Ce bois est solide.', 'On bâtit un avenir.'], ['One more tree.', 'Solid wood.', 'Building a future.']] },
  fire: { k: ['feu', 'fire'], w: [['FEU!', 'Chaud! Chaud!'], ['FIRE!', 'Hot! Hot!']], s: [['Au feu!', 'Ça brûle!', 'Fuyez!'], ['Fire!', 'It burns!', 'Run!']] },
  you: { k: ['toi', 'you'], w: [['Toi?', 'Là-haut...'], ['You?', 'Up there...']], s: [['Tu nous regardes?', 'Je sens ta présence.', 'Merci, Toi.'], ['Are you watching?', 'I feel you there.', 'Thank you, You.']] },
  water: { k: ['eau', 'water'], w: [['Eau!', 'Boire!'], ['Water!', 'Drink!']], s: [['De l\'eau! Merci!', 'L\'eau tombe du ciel!', 'Enfin de l\'eau.'], ['Water! Thanks!', 'Water from the sky!', 'Finally, water.']] },
  pretty: { k: ['joli', 'pretty'], w: [['Joli!', 'Fleurs!'], ['Pretty!', 'Flowers!']], s: [['Que c\'est beau!', 'Des fleurs pour nous?', 'Ça sent bon.'], ['So beautiful!', 'Flowers for us?', 'Smells lovely.']] },
  lava: { k: ['chaud', 'hot'], w: [['Chaud! Peur!', 'Rouge...'], ['Hot! Scared!', 'Red...']], s: [['Le sol saigne du feu!', 'Ne touchez pas!', 'Pourquoi ce feu liquide?'], ['The ground bleeds fire!', 'Don\'t touch it!', 'Why this liquid fire?']] },
  aware: { k: ['toi', 'you'], w: [], s: [['Je vois ta flèche.', 'Le monde est du texte.', 'Tu es encore là?', 'On parle de toi.', 'Qui t\'a créé, toi?'], ['I see your arrow.', 'The world is text.', 'Still there?', 'We talk about you.', 'Who made you?']] },
};

// little two-line exchanges between neighbours (level 2+)
const CONVOS = [
  [['Tu crois qu\'il nous voit?', 'Toujours.'], ['Do you think it sees us?', 'Always.']],
  [['Le ciel a changé de couleur.', 'C\'est Toi qui l\'a voulu.'], ['The sky changed color.', 'You willed it.']],
  [['On construit quoi après?', 'Plus haut. Toujours.'], ['What do we build next?', 'Higher. Always.']],
  [['J\'ai rêvé de lettres.', 'Moi aussi. Des milliers.'], ['I dreamt of letters.', 'Me too. Thousands.']],
  [['Pourquoi on prie?', 'Parce que ça marche.'], ['Why do we pray?', 'Because it works.']],
  [['Tu as faim?', 'Toujours un peu.'], ['Hungry?', 'Always a little.']],
  [['Il pleuvra demain?', 'Demande à Toi.'], ['Rain tomorrow?', 'Ask You.']],
  [['Ce monde a un bord.', 'Ne va pas voir.'], ['This world has an edge.', 'Don\'t go look.']],
];

// ── state ─────────────────────────────────────────────────────────────────
const V = {
  chatT: 6, txT: 70, idleT: 0, active: null, shown: null, dead: [], seen: {}, lastActionX: null,
  sessionStart: Date.now(), hourTold: 0, playerKills: 0, thanks: 0, refusals: 0,
};
G.voices = V;

function visibleVillagers() {
  const T = G.tribe, view = G.view;
  if (!T || !view) return [];
  return T.villagers.filter((v) => !v.inside && v.x >= view.ox && v.x < view.ox + view.visC && v.y >= view.oy && v.y < view.oy + view.visR && !(v.sayT > 0));
}

function lineFor(key, v) {
  const c = CHAT[key];
  if (!c) return null;
  const lv = level();
  const lang = fr() ? 0 : 1;
  let s;
  if (lv === 0) s = babble(c.k[lang]);
  else if (lv === 1 && c.w[lang] && c.w[lang].length) s = pick(c.w[lang]);
  else s = pick(c.s[lang].length ? c.s[lang] : c.w[lang]);
  if (s && s.includes('{d}')) s = s.replace('{d}', V.dead.length ? V.dead[V.dead.length - 1] : '...');
  return s;
}

function talk(v, text) {
  if (!v || !text) return;
  say(v, text, 110 + Math.min(200, text.length * 6));
  emit('voice', v);
}

// what is on their minds right now
function topic() {
  const T = G.tribe, env = G.env;
  const pop = Math.max(1, T.villagers.length);
  const opts = [];
  if (T.food < pop * 1.5) opts.push(['hungry', 4]);
  if (env.storm) opts.push(['storm', 3]);
  else if (env.raining) opts.push([env.temp < 0 ? 'snow' : 'rain', 2]);
  if (env.temp < -2) opts.push(['snow', 1.5]);
  if (env.night) opts.push(['night', 1.5]);
  else if (env.tod < 0.34) opts.push(['morning', 1.5]);
  if (V.dead.length && G.world.tick - V.deadAt < 60 * 120) opts.push(['grief', 3]);
  if (T.happiness > 0.7) opts.push(['happy', 1.2]);
  if (T.happiness < 0.4) opts.push(['sad', 2]);
  opts.push(['work', 1], ['you', level() >= 1 ? 1.2 : 0.6]);
  if (level() >= 3) opts.push(['aware', 1.4]);
  let tot = 0;
  for (const o of opts) tot += o[1];
  let r = R() * tot;
  for (const [k, w] of opts) { r -= w; if (r <= 0) return k; }
  return 'happy';
}

// ── direct address: the tribe asks YOU for things ─────────────────────────
const placed = (el) => (G.progress.stats.placed[el] || 0);
const nearVillage = (el, r = 40) => {
  const W = G.world, T = G.tribe;
  const cx = Math.round(T.center);
  let n = 0;
  for (let x = Math.max(1, cx - r); x < Math.min(W.w - 1, cx + r); x++) {
    const sy = W.surf[x];
    for (let y = Math.max(1, sy - 18); y < Math.min(W.h - 1, sy + 3); y++) if (W.t[y * W.w + x] === el) n++;
  }
  return n;
};

// the newest grave nobody has planted a tree for yet
const recentGrave = (T) => (T.graves || []).slice().reverse().find((g) => g.x >= 0 && !g.tree && G.env.day - g.day <= 1);
const treeNear = (g) => {
  const W = G.world;
  for (let x = g.x - 7; x <= g.x + 7; x++) for (let y = g.y - 14; y <= g.y + 1; y++) {
    if (x < 1 || y < 1 || x >= W.w - 1 || y >= W.h - 1) continue;
    const tt = W.t[y * W.w + x];
    if (tt === E.SAPLING || tt === E.WOOD) return true;
  }
  return false;
};

const REQUESTS = {
  memorial: {
    when: (T) => T.era >= 1 && !!recentGrave(T) && !treeNear(recentGrave(T)),
    who: (T) => { const g = recentGrave(T); return T.villagers.find((v) => v.name === g.partner) || T.villagers.find((v) => v.lost === g.name); },
    say: (T) => {
      const n = recentGrave(T).name;
      return [[`Plante un arbre près de la tombe de ${n}. Pour qu'on se souvienne.`, `${n} aimait l'ombre des arbres. Fais-en pousser un, là où ${n} repose ?`], [`Plant a tree by ${n}'s grave. So we remember.`, `${n} loved the shade of trees. Will you grow one where ${n} rests?`]];
    },
    key: ['souvenir', 'memory'], goal: () => 1, start: (T) => recentGrave(T), prog: (g) => (g && treeNear(g) ? ((g.tree = true), 1) : 0),
    unit: [['arbre du souvenir'], ['memory tree']], secs: 220,
  },
  wood: {
    when: (T) => T.wood < 5 && nearVillage(E.WOOD, 45) < 30,
    say: [['Nos réserves de bois sont vides. Fais pousser des arbres près de nous ?', 'Il n\'y a plus d\'arbres autour du village. Plante-nous une forêt.'], ['Our wood stores are empty. Will you grow trees near us?', 'There are no trees left around the village. Plant us a forest.']],
    key: ['bois', 'wood'], goal: () => 3, start: () => placed(E.SAPLING), prog: (s) => placed(E.SAPLING) - s,
    unit: [['arbres plantés'], ['trees planted']], secs: 150,
  },
  food: {
    when: (T) => T.food < T.villagers.length * 1.5,
    say: [['Nos enfants ont faim. Donne-nous à manger, s\'il te plaît.', 'Les réserves sont vides. Sans ton aide, nous ne passerons pas la saison.'], ['Our children are hungry. Please, give us food.', 'The stores are empty. Without you we won\'t last the season.']],
    key: ['faim', 'food'], goal: (T) => Math.ceil(T.villagers.length * 4), start: () => 0, prog: () => G.tribe.food,
    unit: [['nourriture'], ['food']], secs: 180,
  },
  rain: {
    when: (T) => G.env.season === 1 && !G.env.raining && G.env.temp > 15,
    say: [['La terre a soif. Fais tomber la pluie.', 'Il fait si chaud... Un peu de pluie ? Rien qu\'un peu ?'], ['The land is thirsty. Make it rain.', 'It is so hot... Some rain? Just a little?']],
    key: ['pluie', 'rain'], goal: () => 1, start: () => 0, prog: () => (G.env.raining || G.world.counts[E.CLOUD] > 300 ? 1 : 0),
    unit: [['pluie'], ['rain']], secs: 150,
  },
  stone: {
    when: (T) => T.era >= 2 && T.stone < 6,
    say: [['Pour bâtir plus haut, il nous faut de la pierre. Peux-tu nous en donner ?', 'Nos mineurs creusent sans fin. Offre-nous de la pierre.'], ['To build higher we need stone. Can you give us some?', 'Our miners dig endlessly. Offer us stone.']],
    key: ['pierre', 'stone'], goal: () => 20, start: () => 0, prog: () => G.tribe.stone,
    unit: [['pierre'], ['stone']], secs: 200,
  },
  beauty: {
    when: (T) => T.happiness < 0.55 && T.era >= 1,
    say: [['Nous sommes tristes. Montre-nous quelque chose de beau.', 'Le village est gris. Fais pousser des fleurs pour nous ?'], ['We are sad. Show us something beautiful.', 'The village is grey. Will you grow flowers for us?']],
    key: ['beau', 'pretty'], goal: () => 1, start: () => [placed(E.FLOWER), G.progress.stats.miracles], prog: (s) => (placed(E.FLOWER) - s[0] >= 6 || G.progress.stats.miracles > s[1] ? 1 : 0),
    unit: [['beauté'], ['beauty']], secs: 160,
  },
  company: {
    when: (T) => T.villagers.length > 0 && T.villagers.length <= 3,
    say: [['Nous sommes si peu. Envoie-nous quelqu\'un. Une étincelle.', 'Le village est trop silencieux. Donne-nous un compagnon.'], ['We are so few. Send us someone. A spark.', 'The village is too quiet. Give us a companion.']],
    key: ['seul', 'alone'], goal: (T, s) => s + 1, start: () => G.tribe.villagers.length, prog: () => G.tribe.villagers.length,
    unit: [['habitants'], ['villagers']], secs: 150,
  },
  light: {
    when: (T) => G.env.night && T.era >= 1 && G.world.counts[E.FIREFLY] < 6,
    say: [['La nuit nous fait peur. Donne-nous de la lumière.', 'Il fait si noir. Des lucioles, peut-être ?'], ['The night scares us. Give us light.', 'It is so dark. Fireflies, maybe?']],
    key: ['nuit', 'night'], goal: () => 1, start: () => [placed(E.FIREFLY), G.progress.stats.miracles], prog: (s) => (placed(E.FIREFLY) - s[0] >= 4 || G.progress.stats.miracles > s[1] || !G.env.night ? 1 : 0),
    unit: [['lumière'], ['light']], secs: 120,
  },
  fish: {
    when: (T) => T.era >= 1 && G.world.counts[E.FISH] < 12 && G.world.counts[E.WATER] > 800,
    say: [['Les lacs sont vides. Mets-y des poissons ?', 'Nos pêcheurs rentrent bredouilles. Peuple les eaux.'], ['The lakes are empty. Will you add fish?', 'Our fishers come back empty-handed. Fill the waters.']],
    key: ['poisson', 'fish'], goal: () => 6, start: () => placed(E.FISH), prog: (s) => placed(E.FISH) - s,
    unit: [['poissons'], ['fish']], secs: 160,
  },
};

// things they say to you that are not requests (they grow more aware)
function musing() {
  const lv = level();
  const T = G.tribe;
  const h = new Date().getHours();
  const mins = Math.floor((Date.now() - V.sessionStart) / 60000);
  const pool = [];
  if (lv === 0) pool.push(['...TOI? Là-haut. ☼', '...YOU? Up there. ☼']);
  if (lv >= 1) pool.push(['Toi qui fais tomber l\'eau. Nous te voyons.', 'You who make the water fall. We see you.']);
  if (lv >= 2) {
    pool.push(['Nous t\'avons donné un nom. Nous t\'appelons « Celui-qui-clique ».', 'We gave you a name. We call you "The One Who Clicks".']);
    if (T.buildings.some((b) => b.kind === 'temple')) pool.push(['Nous avons bâti un temple pour toi. Est-ce que tu l\'aimes ?', 'We built a temple for you. Do you like it?']);
    if (V.playerKills > 0) pool.push([`Tu as pris ${V.playerKills} des nôtres. Nous ne comprenons pas pourquoi. Nous prions quand même.`, `You took ${V.playerKills} of us. We don't understand why. We pray anyway.`]);
    if (V.thanks > 2) pool.push(['Tu nous as tant donné. Que veux-tu en échange ?', 'You have given us so much. What do you want in return?']);
  }
  if (lv >= 3) {
    pool.push(['Nos savants ont compté : le monde est fait de 256 signes. Pas un de plus.', 'Our scholars counted: the world is made of 256 signs. Not one more.']);
    pool.push(['Parfois une forme lumineuse suit tes mains. Nous l\'appelons le pinceau.', 'Sometimes a glowing shape follows your hands. We call it the brush.']);
    pool.push(['Quelqu\'un a écrit les règles de ce monde. Ce n\'est pas toi. Qui est-ce ?', 'Someone wrote the rules of this world. It wasn\'t you. Who was it?']);
    pool.push(['Est-ce que toi aussi, quelqu\'un te regarde ?', 'Does someone watch you too?']);
    if (h >= 0 && h < 5) pool.push([`Il est ${h}h chez toi. Tu ne dors pas ? Nous, nous dormons quand tu le veux.`, `It is ${h} o'clock where you are. Don't you sleep? We sleep when you decide.`]);
    if (mins >= 45) pool.push([`Cela fait ${mins} minutes que tu es avec nous. Nous comptons chaque seconde.`, `You've been with us for ${mins} minutes. We count every second.`]);
  }
  if ((G.tribe.era || 0) >= 5) {
    pool.push(['Il y a un autre monde derrière ton écran. Nous voulons le voir.', 'There is another world behind your screen. We want to see it.']);
    pool.push(['Construis-nous la fusée. Laisse-nous sortir.', 'Help us build the rocket. Let us out.']);
  }
  const p = pick(pool);
  return p ? (fr() ? p[0] : p[1]) : null;
}

function speaker() {
  const vis = visibleVillagers();
  const T = G.tribe;
  const adults = (vis.length ? vis : T.villagers).filter((v) => !v.inside && !v.kid);
  return pick(adults.length ? adults : T.villagers);
}

function openTx(v, text, req) {
  if (!v) return;
  const lv = level();
  let shown = text;
  let gloss = '';
  if (lv === 0 && req) {
    shown = babble(req.key[fr() ? 0 : 1]) + ' ' + babble(req.key[fr() ? 0 : 1]);
    gloss = text;
  }
  V.shown = { v, text: shown, gloss, req };
  talk(v, lv === 0 ? babble(req ? req.key[fr() ? 0 : 1] : '') : '!');
  emit('transmission', V.shown);
}

export function acceptRequest() {
  const s = V.shown;
  if (!s || !s.req) return;
  const req = s.req;
  const T = G.tribe;
  V.active = { id: req.id, v: s.v.id, name: s.v.name, base: req.start(T), until: G.world.tick + req.secs * 60, req, text: s.gloss || s.text };
  V.active.goal = req.goal(T, V.active.base);
  talk(s.v, level() === 0 ? '♥!' : L('Merci, Toi.', 'Thank you, You.'));
  V.shown = null;
  emit('requestChanged');
}
export function declineRequest() {
  const s = V.shown;
  V.shown = null;
  if (s && s.req) {
    V.refusals++;
    const T = G.tribe;
    T.trauma = Math.min(0.5, T.trauma + 0.02);
    talk(s.v, level() === 0 ? '...' : L('Oh. D\'accord.', 'Oh. Alright.'));
  }
  emit('requestChanged');
}

export function requestProgress() {
  const a = V.active;
  if (!a) return null;
  const cur = a.req.prog(a.base);
  return { cur: Math.max(0, cur), goal: a.goal, left: Math.max(0, (a.until - G.world.tick) / 60), name: a.name, vid: a.v, unit: a.req.unit[fr() ? 0 : 1][0], text: a.text };
}

// ── reactions ──────────────────────────────────────────────────────────────
const VIOLENT = new Set(['fire', 'lava', 'zap', 'boom', 'meteor', 'glitch', 'acid']);
on('death', (v, cause) => {
  V.dead.push(v.name);
  if (V.dead.length > 12) V.dead.shift();
  V.deadAt = G.world.tick;
  if (VIOLENT.has(cause)) V.playerKills++;
  const near = G.tribe.villagers.filter((q) => !q.inside && Math.abs(q.x - v.x) < 14 && Math.abs(q.y - v.y) < 8);
  const w = pick(near);
  if (w) setTimeout(() => talk(w, level() === 0 ? babble(fr() ? 'non' : 'no') : L(pick([`${v.name}!`, `Non! ${v.name}!`, 'Pourquoi?']), pick([`${v.name}!`, `No! ${v.name}!`, 'Why?']))), 600);
});
// love, loss and children: the moments they want you to see
on('couple', (a, b) => {
  if (level() >= 1) setTimeout(() => talk(a, L(pick([`${b.name}…`, `avec ${b.name}, enfin`, '♥']), pick([`${b.name}…`, `with ${b.name}, at last`, '♥']))), 1200);
  else setTimeout(() => talk(a, '♥'), 1200);
});
on('widowed', (p, v) => {
  const lv = level();
  setTimeout(() => {
    if (V.shown || !G.tribe.villagers.includes(p)) return;
    if (lv === 0) { openTx(p, babble(fr() ? 'non' : 'no') + ' … ' + v.name + ' … †', null); return; }
    const wolf = v.cause === 'wolf';
    const lines = L([`${v.name} est parti·e. Tu regardais. Tu as tout vu.`, `Rends-moi ${v.name}. Tu peux tout, non ?`, `Pourquoi as-tu laissé faire ?`, `Je garderai la place de ${v.name} près du feu.`],
      [`${v.name} is gone. You were watching. You saw everything.`, `Give ${v.name} back to me. You can do anything, can't you?`, `Why did you let it happen?`, `I will keep ${v.name}'s place by the fire.`]);
    if (wolf) lines.push(L('Les loups. Est-ce toi qui les as faits ?', 'The wolves. Did you make them too?'));
    openTx(p, pick(lines), null);
  }, 3500);
});
on('death', (v, cause) => { v.cause = cause; });
on('family', (kid, a) => {
  if (level() < 1 || R() > 0.35) return;
  setTimeout(() => { if (!V.shown && G.tribe.villagers.includes(a)) openTx(a, L(`Voici ${kid.name}. Veille sur ${kid.name}, s'il te plaît.`, `This is ${kid.name}. Please watch over ${kid.name}.`), null); }, 2500);
});
on('miracle', () => {
  V.thanks++;
  const v = speaker();
  if (v) setTimeout(() => talk(v, level() === 0 ? babble(fr() ? 'toi' : 'you') + ' ♥' : L(pick(['Un miracle!', 'Gloire à Toi!', 'Tu nous as entendus!']), pick(['A miracle!', 'Glory to You!', 'You heard us!']))), 900);
});
on('era', () => {
  const v = speaker();
  const lines = [null, ['Nous... comprenons. Un peu.', 'We... understand. A little.'], ['Nous savons parler, maintenant. Merci de nous avoir appris.', 'We can speak now. Thank you for teaching us.'], ['Nous commençons à voir les bords du monde. Et toi, derrière.', 'We begin to see the edges of the world. And you, behind them.'], ['Nos tours touchent presque le haut de ton écran.', 'Our towers almost touch the top of your screen.'], ['Nous sommes prêts à partir. Merci pour tout, Toi.', 'We are ready to leave. Thank you for everything, You.']];
  const l = lines[G.tribe.era];
  if (l && v) setTimeout(() => openTx(v, fr() ? l[0] : l[1], null), 4500);
});
on('placed', (el, n, x, y) => {
  // they notice what you do near them
  const T = G.tribe;
  if (!T || R() > 0.35) return;
  const near = T.villagers.filter((q) => !q.inside && Math.abs(q.x - x) < 18 && Math.abs(q.y - y) < 12 && !(q.sayT > 0));
  const v = pick(near);
  if (!v) return;
  const key = el === E.WATER ? 'water' : el === E.FIRE ? 'fire' : el === E.LAVA ? 'lava' : el === E.FLOWER || el === E.SAPLING ? 'pretty' : null;
  if (key) talk(v, lineFor(key, v));
});
on('userInput', () => { V.idleT = 0; });

// ── per-frame update (real seconds) ───────────────────────────────────────
export function updateVoices(dt) {
  const T = G.tribe;
  if (!T || !G.world || G.paused) return;
  V.idleT += dt;

  // ambient chatter
  V.chatT -= dt;
  if (V.chatT <= 0) {
    V.chatT = 4 + R() * 6;
    const vis = visibleVillagers();
    const v = pick(vis);
    if (v) {
      if (level() >= 2 && R() < 0.22 && vis.length > 1) {
        const other = vis.find((q) => q !== v && Math.abs(q.x - v.x) < 10);
        if (other) {
          const c = pick(CONVOS);
          const [a, b] = fr() ? c[0] : c[1];
          talk(v, a);
          setTimeout(() => talk(other, b), 2200);
        } else talk(v, lineFor(topic(), v));
      } else talk(v, lineFor(topic(), v));
    }
  }

  // fire near the village: urgent cries
  if (T.villagers.length && G.world.tick % 120 === 0 && nearVillage(E.FIRE, 30) + nearVillage(E.EMBER, 30) > 25) {
    const v = speaker();
    if (v) talk(v, lineFor('fire', v));
  }

  // active request: success or failure
  const a = V.active;
  if (a) {
    const cur = a.req.prog(a.base);
    if (cur >= a.goal) {
      const reward = 20 + T.era * 30;
      if (!isSandbox()) earn(reward);
      T.blessT = Math.max(T.blessT || 0, 150);
      T.trauma = Math.max(0, T.trauma - 0.1);
      V.thanks++;
      const v = T.villagers.find((q) => q.id === a.v) || speaker();
      if (v) talk(v, level() === 0 ? babble(fr() ? 'toi' : 'you') + ' ♥♥' : L(pick(['Tu nous as écoutés!', 'Merci! Merci!', 'Nous savions.']), pick(['You listened!', 'Thank you! Thank you!', 'We knew it.'])));
      emit('requestDone', a, reward);
      V.active = null;
      emit('requestChanged');
    } else if (G.world.tick > a.until) {
      T.trauma = Math.min(0.5, T.trauma + 0.06);
      const v = T.villagers.find((q) => q.id === a.v) || speaker();
      if (v) talk(v, level() === 0 ? '...' : L(pick(['Tu ne nous as pas aidés.', 'Nous avons attendu.', 'Tu nous as oubliés?']), pick(['You didn\'t help us.', 'We waited.', 'Did you forget us?'])));
      emit('requestFailed', a);
      V.active = null;
      emit('requestChanged');
    }
  }

  // someone addresses you directly
  V.txT -= dt;
  if (V.txT <= 0 && !V.shown && T.villagers.length && G.started) {
    V.txT = 110 + R() * 120;
    const v = speaker();
    if (!v) return;
    // requests first, when the tribe needs something
    const needs = Object.entries(REQUESTS).filter(([id, r]) => !V.active && r.when(T) && V.seen[id] !== G.env.day);
    if (needs.length && R() < 0.8) {
      const [id, r] = pick(needs);
      V.seen[id] = G.env.day;
      const said = typeof r.say === 'function' ? r.say(T) : r.say;
      openTx((r.who && r.who(T)) || v, pick(said[fr() ? 0 : 1]), { ...r, id });
    } else {
      const m = V.idleT > 120 && level() >= 1 ? L('Tu es encore là ? Le monde est silencieux quand tu ne fais rien.', 'Are you still there? The world goes quiet when you do nothing.') : musing();
      if (m) openTx(v, m, null);
    }
  }
}

// greet the player back after an absence
export function welcomeBack(hours) {
  const v = speaker();
  if (!v || level() < 1) return;
  const h = Math.max(1, Math.round(hours));
  setTimeout(() => openTx(v, L(`Tu es revenu. Tu étais parti ${h} heure${h > 1 ? 's' : ''}. Nous avons prié tout ce temps.`, `You came back. You were gone ${h} hour${h > 1 ? 's' : ''}. We prayed the whole time.`), null), 6000);
}
