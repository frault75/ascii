// ─── progress.js ── faith, tools, discoveries, exploits, objectives, eras ───
import { G, emit, on } from './state.js';
import { E } from './elements.js';
import { ERAS, countB } from './life.js';

export const CATS = ['terra', 'life', 'chaos', 'sky', 'miracle'];

// glyph & colour shown on the tool button
export const TOOLS = [
  { id: 'eye', cat: '*', special: 'eye', g: '◊', c: '#e9e4da', n: { fr: 'Observer', en: 'Observe' }, d: { fr: 'Clique un villageois pour le suivre. Survole pour inspecter.', en: 'Click a villager to follow them. Hover to inspect.' } },
  { id: 'erase', cat: '*', special: 'erase', g: '×', c: '#ff6a5a', n: { fr: 'Gomme', en: 'Eraser' }, d: { fr: 'Efface la matière. Même le divin a des regrets.', en: 'Erases matter. Even gods have regrets.' } },

  { id: 'sand', cat: 'terra', el: E.SAND, rate: 0.5, g: '░', c: '#ecd394', n: { fr: 'Sable', en: 'Sand' }, d: { fr: 'Coule, s\'empile, devient verre au contact de la lave.', en: 'Flows, piles up, turns to glass in lava.' } },
  { id: 'dirt', cat: 'terra', el: E.DIRT, rate: 0.6, g: '▒', c: '#a87650', n: { fr: 'Terre', en: 'Soil' }, d: { fr: 'L\'herbe y pousse, les graines y germent.', en: 'Grass grows on it, seeds sprout in it.' } },
  { id: 'stone', cat: 'terra', el: E.STONE, rate: 1, g: '▓', c: '#9a96a6', n: { fr: 'Pierre', en: 'Stone' }, d: { fr: 'Solide, immobile. Les mineurs l\'adorent.', en: 'Solid, still. Miners love it.' } },
  { id: 'water', cat: 'terra', el: E.WATER, rate: 0.45, g: '≈', c: '#7ab8ff', n: { fr: 'Eau', en: 'Water' }, d: { fr: 'La vie commence ici. Gèle l\'hiver, s\'évapore l\'été.', en: 'Life begins here. Freezes in winter, evaporates in summer.' } },
  { id: 'lava', cat: 'terra', el: E.LAVA, rate: 0.45, cost: 60, g: '≈', c: '#ff8a3a', n: { fr: 'Lave', en: 'Lava' }, d: { fr: 'Brûle tout. Avec l\'eau : obsidienne.', en: 'Burns everything. With water: obsidian.' } },
  { id: 'snow', cat: 'terra', el: E.SNOW, rate: 0.3, cost: 15, g: '*', c: '#f4f8ff', n: { fr: 'Neige', en: 'Snow' }, d: { fr: 'Tombe doucement, fond au printemps.', en: 'Falls softly, melts in spring.' } },
  { id: 'ice', cat: 'terra', el: E.ICE, rate: 1, cost: 25, g: '▒', c: '#c4ecff', n: { fr: 'Glace', en: 'Ice' }, d: { fr: 'Gèle l\'eau voisine en hiver.', en: 'Freezes nearby water in winter.' } },
  { id: 'metal', cat: 'terra', el: E.METAL, rate: 1, cost: 180, g: '■', c: '#c8d0dc', n: { fr: 'Métal', en: 'Metal' }, d: { fr: 'Conduit la foudre. Indispensable à la métropole.', en: 'Conducts lightning. Vital for the metropolis.' } },
  { id: 'gold', cat: 'terra', el: E.GOLD, rate: 1, cost: 400, g: '$', c: '#ffd84a', n: { fr: 'Or', en: 'Gold' }, d: { fr: 'Brille. Les mineurs le transforment en métal.', en: 'Shines. Miners turn it into metal.' } },
  { id: 'crystal', cat: 'terra', el: E.CRYSTAL, rate: 1, cost: 500, g: '◊', c: '#ff8aff', n: { fr: 'Cristal', en: 'Crystal' }, d: { fr: 'Pousse lentement dans les profondeurs et luit.', en: 'Slowly grows in the depths, glowing.' } },
  { id: 'glass', cat: 'terra', el: E.GLASS, rate: 1, disc: 'glass', g: '░', c: '#d8f6ff', n: { fr: 'Verre', en: 'Glass' }, d: { fr: 'Transparent. Résiste à l\'acide.', en: 'Transparent. Resists acid.' } },
  { id: 'obsidian', cat: 'terra', el: E.OBSIDIAN, rate: 1, disc: 'obsidian', g: '▓', c: '#7a5a9a', n: { fr: 'Obsidienne', en: 'Obsidian' }, d: { fr: 'Roche volcanique quasi indestructible.', en: 'Nearly indestructible volcanic rock.' } },

  { id: 'seed', cat: 'life', el: E.SEED, rate: 0.08, g: '•', c: '#d6b56a', n: { fr: 'Graine', en: 'Seed' }, d: { fr: 'Sur la terre, devient arbre ou fleur.', en: 'On soil, becomes a tree or a flower.' } },
  { id: 'tree', cat: 'life', special: 'tree', cost: 20, g: '♣', c: '#6cc24a', n: { fr: 'Arbre', en: 'Tree' }, d: { fr: 'Fait pousser un arbre. Les bûcherons te remercient.', en: 'Grows a tree. Woodcutters thank you.' } },
  { id: 'flower', cat: 'life', special: 'flower', cost: 10, g: '✿', c: '#ff7eb6', n: { fr: 'Fleurs', en: 'Flowers' }, d: { fr: 'Nourrissent la tribu, rendent heureux, attirent les papillons.', en: 'Feed the tribe, bring joy, attract butterflies.' } },
  { id: 'spark', cat: 'life', special: 'spark', use: 12, g: '☺', c: '#ffcf5a', n: { fr: 'Étincelle de vie', en: 'Spark of life' }, d: { fr: 'Fait naître un villageois.', en: 'Brings a villager to life.' } },
  { id: 'fish', cat: 'life', el: E.FISH, rate: 0.05, cost: 25, g: '>', c: '#ff9a3a', n: { fr: 'Poissons', en: 'Fish' }, d: { fr: 'Vivent dans l\'eau. La tribu sait pêcher.', en: 'Live in water. The tribe knows how to fish.' } },
  { id: 'bird', cat: 'life', el: E.BIRD, rate: 0.03, cost: 30, g: 'v', c: '#b0b4c8', n: { fr: 'Oiseaux', en: 'Birds' }, d: { fr: 'Volent au-dessus du monde.', en: 'Fly over the world.' } },
  { id: 'butterfly', cat: 'life', el: E.BUTTERFLY, rate: 0.03, cost: 35, g: 'ж', c: '#ffb84a', n: { fr: 'Papillons', en: 'Butterflies' }, d: { fr: 'Dansent autour des fleurs l\'été.', en: 'Dance around flowers in summer.' } },
  { id: 'firefly', cat: 'life', el: E.FIREFLY, rate: 0.04, cost: 45, g: '•', c: '#e4ff7a', n: { fr: 'Lucioles', en: 'Fireflies' }, d: { fr: 'Illuminent les nuits chaudes.', en: 'Light up warm nights.' } },
  { id: 'worm', cat: 'life', el: E.WORM, rate: 0.05, cost: 15, g: '~', c: '#ff9ab0', n: { fr: 'Vers', en: 'Worms' }, d: { fr: 'Creusent la terre.', en: 'Burrow through soil.' } },
  { id: 'shroom', cat: 'life', el: E.SHROOM, rate: 0.1, cost: 90, g: '♠', c: '#6affd8', n: { fr: 'Champignons', en: 'Mushrooms' }, d: { fr: 'Bioluminescents. Se propagent dans l\'obscurité.', en: 'Bioluminescent. Spread in the dark.' } },

  { id: 'rabbit', cat: 'life', special: 'animal', animal: 'rabbit', cost: 20, use: 3, g: 'r', c: '#e8d8c0', n: { fr: 'Lapins', en: 'Rabbits' }, d: { fr: 'Se multiplient vite. Une proie pour les loups… et pour la tribu.', en: 'Breed fast. Prey for wolves… and for the tribe.' } },
  { id: 'deer', cat: 'life', special: 'animal', animal: 'deer', cost: 40, use: 6, g: 'd', c: '#d8a070', n: { fr: 'Cerfs', en: 'Deer' }, d: { fr: 'Le gibier des forêts. Les chasseurs les traquent.', en: 'Forest game. Hunters track them.' } },
  { id: 'boar', cat: 'life', special: 'animal', animal: 'boar', cost: 60, use: 8, g: 'b', c: '#a08070', n: { fr: 'Sangliers', en: 'Boars' }, d: { fr: 'Robustes. Ils chargent quand on les coince.', en: 'Sturdy. They charge when cornered.' } },

  { id: 'fire', cat: 'chaos', el: E.FIRE, rate: 0.5, g: '^', c: '#ffcf5a', n: { fr: 'Feu', en: 'Fire' }, d: { fr: 'Dévore le bois, les feuilles, l\'huile.', en: 'Devours wood, leaves, oil.' } },
  { id: 'oil', cat: 'chaos', el: E.OIL, rate: 0.45, cost: 35, g: '≈', c: '#9a7ab8', n: { fr: 'Huile', en: 'Oil' }, d: { fr: 'Flotte sur l\'eau. S\'embrase d\'un rien.', en: 'Floats on water. Ignites at nothing.' } },
  { id: 'acid', cat: 'chaos', el: E.ACID, rate: 0.45, cost: 90, g: '≈', c: '#c6ff5a', n: { fr: 'Acide', en: 'Acid' }, d: { fr: 'Dissout tout sauf le verre.', en: 'Dissolves everything but glass.' } },
  { id: 'gunpowder', cat: 'chaos', el: E.GUNPOWDER, rate: 0.5, cost: 70, g: ':', c: '#a8a8ae', n: { fr: 'Poudre', en: 'Gunpowder' }, d: { fr: 'Une étincelle et… boum.', en: 'One spark and… boom.' } },
  { id: 'tnt', cat: 'chaos', el: E.TNT, rate: 1, cost: 160, g: '≡', c: '#ff4a4a', n: { fr: 'TNT', en: 'TNT' }, d: { fr: 'Grosse explosion. Réactions en chaîne.', en: 'Big explosion. Chain reactions.' } },
  { id: 'wolf', cat: 'chaos', special: 'animal', animal: 'wolf', cost: 120, use: 15, g: 'w', c: '#c8c8d4', n: { fr: 'Loups', en: 'Wolves' }, d: { fr: 'Chassent la nuit. Le feu et les lampes les tiennent à distance.', en: 'Hunt at night. Fire and lamps keep them away.' } },
  { id: 'bolt', cat: 'chaos', special: 'bolt', cost: 110, g: 'ϟ', c: '#bfe0ff', n: { fr: 'Foudre', en: 'Lightning' }, d: { fr: 'Frappe là où tu cliques. Électrise l\'eau et le métal.', en: 'Strikes where you click. Electrifies water and metal.' } },
  { id: 'meteor', cat: 'chaos', special: 'meteor', cost: 280, use: 20, g: '@', c: '#ff9a3a', n: { fr: 'Météorite', en: 'Meteor' }, d: { fr: 'Une pierre venue d\'ailleurs. Laisse de la pierre-étoile.', en: 'A stone from elsewhere. Leaves starstone.' } },
  { id: 'volcano', cat: 'chaos', special: 'volcano', cost: 450, use: 60, g: '▲', c: '#ff5a2a', n: { fr: 'Volcan', en: 'Volcano' }, d: { fr: 'Fait jaillir la lave du sol.', en: 'Makes lava burst from the ground.' } },
  { id: 'glitch', cat: 'chaos', el: E.GLITCH, rate: 0.1, cost: 666, g: '▚', c: '#ff2a8a', n: { fr: 'Glitch', en: 'Glitch' }, d: { fr: 'Corruption de données. La réalité se déchire.', en: 'Data corruption. Reality tears.' } },

  { id: 'cloud', cat: 'sky', special: 'cloud', cost: 20, g: '▒', c: '#f0f4fa', n: { fr: 'Nuage de pluie', en: 'Rain cloud' }, d: { fr: 'Peins des nuages qui arrosent le monde.', en: 'Paint clouds that water the world.' } },
  { id: 'snowcloud', cat: 'sky', special: 'snowcloud', cost: 60, g: '*', c: '#dde8ff', n: { fr: 'Nuage de neige', en: 'Snow cloud' }, d: { fr: 'Recouvre le monde de blanc.', en: 'Covers the world in white.' } },
  { id: 'storm', cat: 'sky', special: 'storm', cost: 140, g: '▓', c: '#8a90a8', n: { fr: 'Orage', en: 'Storm cloud' }, d: { fr: 'Nuages noirs chargés de foudre.', en: 'Dark clouds full of lightning.' } },
  { id: 'steam', cat: 'sky', el: E.STEAM, rate: 0.4, cost: 15, g: '°', c: '#e8f0f8', n: { fr: 'Vapeur', en: 'Steam' }, d: { fr: 'Monte, puis retombe en pluie.', en: 'Rises, then falls as rain.' } },
  { id: 'wind', cat: 'sky', special: 'wind', cost: 40, g: '~', c: '#a8e0ff', n: { fr: 'Souffle', en: 'Breath' }, d: { fr: 'Glisse pour pousser la matière.', en: 'Drag to push matter around.' } },

  { id: 'rain', cat: 'miracle', miracle: 'rain', use: 20, g: '╱', c: '#7ab8ff', n: { fr: 'Pluie', en: 'Rain' }, d: { fr: 'Appelle la pluie sur le monde.', en: 'Calls rain upon the world.' } },
  { id: 'sun', cat: 'miracle', miracle: 'sun', use: 20, g: '☼', c: '#ffd84a', n: { fr: 'Beau temps', en: 'Clear skies' }, d: { fr: 'Chasse les nuages.', en: 'Chases the clouds away.' } },
  { id: 'harvest', cat: 'miracle', miracle: 'harvest', use: 35, g: '♣', c: '#8dff9a', n: { fr: 'Abondance', en: 'Abundance' }, d: { fr: 'Offre de la nourriture à la tribu.', en: 'Gifts food to the tribe.' } },
  { id: 'gift', cat: 'miracle', miracle: 'gift', use: 120, cost: 80, g: '◆', c: '#c8d0dc', n: { fr: 'Don de la terre', en: 'Gift of the earth' }, d: { fr: 'Offre bois, pierre et métal à la tribu.', en: 'Gifts wood, stone and metal to the tribe.' } },
  { id: 'bless', cat: 'miracle', miracle: 'bless', use: 50, cost: 40, g: '♥', c: '#ff7eb6', n: { fr: 'Bénédiction', en: 'Blessing' }, d: { fr: 'La tribu rayonne de joie (et prie plus).', en: 'The tribe glows with joy (and prays more).' } },
  { id: 'rainbow', cat: 'miracle', miracle: 'rainbow', use: 60, cost: 50, g: '◠', c: '#ff9a3a', n: { fr: 'Arc-en-ciel', en: 'Rainbow' }, d: { fr: 'Un signe dans le ciel.', en: 'A sign in the sky.' } },
  { id: 'aurora', cat: 'miracle', miracle: 'aurora', use: 80, cost: 120, g: '¦', c: '#8dff9a', n: { fr: 'Aurore', en: 'Aurora' }, d: { fr: 'Rideaux de lumière la nuit.', en: 'Curtains of light at night.' } },
  { id: 'night', cat: 'miracle', miracle: 'night', use: 30, cost: 30, g: '☾', c: '#b0b8ff', n: { fr: 'Avance le temps', en: 'Skip time' }, d: { fr: 'Fait avancer le soleil de 6 heures.', en: 'Moves the sun forward 6 hours.' } },
  { id: 'eclipse', cat: 'miracle', miracle: 'eclipse', use: 150, cost: 300, g: '●', c: '#ff6ad5', n: { fr: 'Éclipse', en: 'Eclipse' }, d: { fr: 'Éteint le soleil un instant.', en: 'Puts out the sun for a while.' } },
  { id: 'quake', cat: 'miracle', miracle: 'quake', use: 120, cost: 250, g: '≋', c: '#d8a070', n: { fr: 'Séisme', en: 'Earthquake' }, d: { fr: 'La terre tremble et s\'effondre.', en: 'The earth shakes and crumbles.' } },
  { id: 'meteors', cat: 'miracle', miracle: 'meteors', use: 400, cost: 600, g: '✦', c: '#ffcf5a', n: { fr: 'Pluie d\'étoiles', en: 'Starfall' }, d: { fr: 'Une pluie de météorites.', en: 'A shower of meteorites.' } },
];
for (const tl of TOOLS) { tl.cost = tl.cost || 0; tl.use = tl.use || 0; }
export const TOOL = Object.fromEntries(TOOLS.map((x) => [x.id, x]));

export const DISCOVERIES = {
  hunt: { r: 15, n: { fr: 'Chasseurs', en: 'Hunters' }, d: { fr: 'La tribu a abattu son premier gibier.', en: 'The tribe brought down its first game.' } },
  wolves: { r: 20, n: { fr: 'Des crocs dans la nuit', en: 'Teeth in the night' }, d: { fr: 'Les loups ont attaqué un villageois.', en: 'Wolves attacked a villager.' } },
  sprout: { r: 5, n: { fr: 'Première pousse', en: 'First sprout' }, d: { fr: 'Une graine a germé.', en: 'A seed has sprouted.' } },
  flower: { r: 5, n: { fr: 'Floraison', en: 'Bloom' }, d: { fr: 'Une fleur s\'est ouverte.', en: 'A flower opened.' } },
  steam: { r: 10, n: { fr: 'Vapeur', en: 'Steam' }, d: { fr: 'L\'eau rencontre la chaleur.', en: 'Water meets heat.' } },
  obsidian: { r: 25, n: { fr: 'Obsidienne', en: 'Obsidian' }, d: { fr: 'La lave rencontre l\'eau.', en: 'Lava meets water.' } },
  melt: { r: 10, n: { fr: 'Dégel', en: 'Thaw' }, d: { fr: 'La glace cède à la chaleur.', en: 'Ice yields to heat.' } },
  ice: { r: 15, n: { fr: 'Gel', en: 'Frost' }, d: { fr: 'L\'eau se fige dans le froid.', en: 'Water freezes in the cold.' } },
  glass: { r: 25, n: { fr: 'Verre', en: 'Glass' }, d: { fr: 'Le sable fond dans la lave.', en: 'Sand melts in lava.' } },
  fulgurite: { r: 40, n: { fr: 'Fulgurite', en: 'Fulgurite' }, d: { fr: 'La foudre vitrifie le sable.', en: 'Lightning vitrifies sand.' } },
  watercycle: { r: 20, n: { fr: 'Cycle de l\'eau', en: 'Water cycle' }, d: { fr: 'La vapeur retombe en pluie.', en: 'Steam falls back as rain.' } },
  cloudbirth: { r: 20, n: { fr: 'Naissance d\'un nuage', en: 'Birth of a cloud' }, d: { fr: 'La vapeur s\'est condensée en nuage.', en: 'Steam condensed into a cloud.' } },
  ash: { r: 10, n: { fr: 'Cendres', en: 'Ashes' }, d: { fr: 'Ce qui reste quand le bois a fini de brûler.', en: 'What remains when wood is done burning.' } },
  corrosion: { r: 20, n: { fr: 'Corrosion', en: 'Corrosion' }, d: { fr: 'L\'acide dévore la matière.', en: 'Acid devours matter.' } },
  oilfire: { r: 20, n: { fr: 'Marée de feu', en: 'Sea of fire' }, d: { fr: 'L\'huile s\'embrase.', en: 'Oil catches fire.' } },
  explosion: { r: 20, n: { fr: 'Détonation', en: 'Detonation' }, d: { fr: 'La poudre a parlé.', en: 'The powder has spoken.' } },
  electric: { r: 30, n: { fr: 'Électrocution', en: 'Electrocution' }, d: { fr: 'Le courant traverse l\'eau et le métal.', en: 'Current runs through water and metal.' } },
  birdzap: { r: 15, n: { fr: 'Mauvais endroit', en: 'Wrong place' }, d: { fr: 'Un oiseau a croisé la foudre.', en: 'A bird crossed paths with lightning.' } },
  crystal: { r: 40, n: { fr: 'Croissance cristalline', en: 'Crystal growth' }, d: { fr: 'Le cristal s\'étend dans l\'ombre.', en: 'Crystal spreads in the dark.' } },
  glitch: { r: 66, n: { fr: 'ERREUR 0x0000', en: 'ERROR 0x0000' }, d: { fr: 'La réalité n\'est que du texte.', en: 'Reality is only text.' } },
  fishbirth: { r: 15, n: { fr: 'Frai', en: 'Spawning' }, d: { fr: 'Les poissons se reproduisent.', en: 'Fish reproduce.' } },
  starstone: { r: 50, n: { fr: 'Pierre-étoile', en: 'Starstone' }, d: { fr: 'Le cœur d\'une météorite.', en: 'The heart of a meteorite.' } },
  eruption: { r: 40, n: { fr: 'Éruption', en: 'Eruption' }, d: { fr: 'La montagne crache son feu.', en: 'The mountain spits fire.' } },
  rainbow: { r: 20, n: { fr: 'Arc-en-ciel', en: 'Rainbow' }, d: { fr: 'Après la pluie, la couleur.', en: 'After rain, colour.' } },
  aurora: { r: 30, n: { fr: 'Aurore boréale', en: 'Northern lights' }, d: { fr: 'Le ciel nocturne ondule.', en: 'The night sky ripples.' } },
  eclipse: { r: 40, n: { fr: 'Éclipse', en: 'Eclipse' }, d: { fr: 'Le jour devient nuit.', en: 'Day becomes night.' } },
  shelter: { r: 15, n: { fr: 'Premier abri', en: 'First shelter' }, d: { fr: 'La tribu a bâti un toit.', en: 'The tribe built a roof.' } },
  birth: { r: 15, n: { fr: 'Première naissance', en: 'First birth' }, d: { fr: 'Une nouvelle vie.', en: 'A new life.' } },
  temple: { r: 40, n: { fr: 'Le Temple', en: 'The Temple' }, d: { fr: 'Ils ont bâti une maison pour toi.', en: 'They built a house for you.' } },
  harvest: { r: 25, n: { fr: 'Agriculture', en: 'Agriculture' }, d: { fr: 'La tribu cultive la terre.', en: 'The tribe farms the land.' } },
  gold: { r: 30, n: { fr: 'Fièvre de l\'or', en: 'Gold rush' }, d: { fr: 'Un mineur a trouvé de l\'or.', en: 'A miner struck gold.' } },
  snowfall: { r: 10, n: { fr: 'Premier flocon', en: 'First snowflake' }, d: { fr: 'L\'hiver est là.', en: 'Winter is here.' } },
  launch: { r: 0, n: { fr: 'Ascension', en: 'Ascension' }, d: { fr: 'Ils ont quitté le monde.', en: 'They left the world.' } },
};

export const ACHIEVEMENTS = [
  { id: 'pop5', r: 20, n: { fr: 'Clan', en: 'Clan' }, d: { fr: '5 habitants', en: '5 inhabitants' }, test: (T) => T.villagers.length >= 5 },
  { id: 'pop15', r: 60, n: { fr: 'Hameau', en: 'Hamlet' }, d: { fr: '15 habitants', en: '15 inhabitants' }, test: (T) => T.villagers.length >= 15 },
  { id: 'pop30', r: 200, n: { fr: 'Bourg', en: 'Town' }, d: { fr: '30 habitants', en: '30 inhabitants' }, test: (T) => T.villagers.length >= 30 },
  { id: 'pop60', r: 800, n: { fr: 'Nation', en: 'Nation' }, d: { fr: '60 habitants', en: '60 inhabitants' }, test: (T) => T.villagers.length >= 60 },
  { id: 'pop100', r: 3000, n: { fr: 'Multitude', en: 'Multitude' }, d: { fr: '100 habitants', en: '100 inhabitants' }, test: (T) => T.villagers.length >= 100 },
  { id: 'build10', r: 120, n: { fr: 'Architecte', en: 'Architect' }, d: { fr: '10 bâtiments debout', en: '10 buildings standing' }, test: (T) => T.buildings.length >= 10 },
  { id: 'build25', r: 600, n: { fr: 'Urbaniste', en: 'Urbanist' }, d: { fr: '25 bâtiments debout', en: '25 buildings standing' }, test: (T) => T.buildings.length >= 25 },
  { id: 'day10', r: 100, n: { fr: 'Dix aubes', en: 'Ten dawns' }, d: { fr: 'Le monde existe depuis 10 jours', en: 'The world has existed for 10 days' }, test: () => G.env.day >= 10 },
  { id: 'year', r: 300, n: { fr: 'Révolution', en: 'Revolution' }, d: { fr: 'Une année entière s\'est écoulée', en: 'A whole year has passed' }, test: () => G.env.year >= 2 },
  { id: 'boom20', r: 150, n: { fr: 'Pyromane', en: 'Pyromaniac' }, d: { fr: '20 explosions', en: '20 explosions' }, test: () => G.progress.stats.explosions >= 20 },
  { id: 'storm30', r: 150, n: { fr: 'Zeus', en: 'Zeus' }, d: { fr: '30 éclairs', en: '30 lightning strikes' }, test: () => G.progress.stats.strikes >= 30 },
  { id: 'disc10', r: 100, n: { fr: 'Curieux', en: 'Curious' }, d: { fr: '10 découvertes', en: '10 discoveries' }, test: () => Object.keys(G.progress.found).length >= 10 },
  { id: 'disc25', r: 600, n: { fr: 'Savant', en: 'Scholar' }, d: { fr: '25 découvertes', en: '25 discoveries' }, test: () => Object.keys(G.progress.found).length >= 25 },
  { id: 'cells', r: 80, n: { fr: 'Démiurge', en: 'Demiurge' }, d: { fr: '20 000 cellules créées', en: '20,000 cells created' }, test: () => G.progress.stats.cells >= 20000 },
  { id: 'faith', r: 0, n: { fr: 'Dévotion', en: 'Devotion' }, d: { fr: '10 000 ◊ reçus au total', en: '10,000 ◊ received in total' }, test: () => G.progress.totalFaith >= 10000 },
  { id: 'old', r: 200, n: { fr: 'Ancêtre', en: 'Ancestor' }, d: { fr: 'Un villageois a vécu 12 jours', en: 'A villager lived 12 days' }, test: (T) => T.villagers.some((v) => v.age >= 12) },
  { id: 'forest', r: 120, n: { fr: 'Jardinier', en: 'Gardener' }, d: { fr: '3000 cellules de feuillage', en: '3,000 cells of foliage' }, test: () => G.world.counts[E.LEAF] >= 3000 },
  { id: 'ocean', r: 120, n: { fr: 'Déluge', en: 'Deluge' }, d: { fr: '25 000 cellules d\'eau', en: '25,000 cells of water' }, test: () => G.world.counts[E.WATER] >= 25000 },
  { id: 'inferno', r: 150, n: { fr: 'Inferno', en: 'Inferno' }, d: { fr: '400 flammes à la fois', en: '400 flames at once' }, test: () => G.world.counts[E.FIRE] + G.world.counts[E.EMBER] >= 400 },
  { id: 'era5', r: 0, n: { fr: 'Vers les étoiles', en: 'To the stars' }, d: { fr: 'Atteindre l\'ère stellaire', en: 'Reach the stellar age' }, test: (T) => T.era >= 5 },
];

// guided objectives
export const QUESTS = [
  { n: { fr: 'Fais tomber de l\'EAU (catégorie TERRE)', en: 'Pour some WATER (EARTH category)' }, r: 10, p: () => [G.progress.stats.placed[E.WATER] || 0, 40] },
  { n: { fr: 'Sème 6 GRAINES sur la terre (VIE)', en: 'Sow 6 SEEDS on soil (LIFE)' }, r: 10, p: () => [G.progress.stats.placed[E.SEED] || 0, 6] },
  { n: { fr: 'La tribu bâtit son premier abri', en: 'The tribe builds its first shelter' }, r: 20, p: () => [countB('tent') + countB('hut'), 1] },
  { n: { fr: 'Atteins 4 habitants', en: 'Reach 4 inhabitants' }, r: 20, p: () => [G.tribe.villagers.length, 4] },
  { n: { fr: 'RÉVÉLATION : passe à l\'ÈRE I', en: 'REVELATION: reach ERA I' }, r: 30, p: () => [G.tribe.era, 1] },
  { n: { fr: 'Fais 5 découvertes (combine les éléments)', en: 'Make 5 discoveries (combine elements)' }, r: 30, p: () => [Object.keys(G.progress.found).length, 5] },
  { n: { fr: 'La tribu bâtit le TEMPLE', en: 'The tribe builds the TEMPLE' }, r: 60, p: () => [countB('temple'), 1] },
  { n: { fr: 'Atteins 10 habitants', en: 'Reach 10 inhabitants' }, r: 60, p: () => [G.tribe.villagers.length, 10] },
  { n: { fr: 'RÉVÉLATION : passe à l\'ÈRE II', en: 'REVELATION: reach ERA II' }, r: 100, p: () => [G.tribe.era, 2] },
  { n: { fr: 'La tribu cultive 2 CHAMPS', en: 'The tribe tends 2 FIELDS' }, r: 100, p: () => [countB('farm'), 2] },
  { n: { fr: 'Fais 15 découvertes', en: 'Make 15 discoveries' }, r: 150, p: () => [Object.keys(G.progress.found).length, 15] },
  { n: { fr: 'Atteins 22 habitants', en: 'Reach 22 inhabitants' }, r: 200, p: () => [G.tribe.villagers.length, 22] },
  { n: { fr: 'RÉVÉLATION : passe à l\'ÈRE III', en: 'REVELATION: reach ERA III' }, r: 300, p: () => [G.tribe.era, 3] },
  { n: { fr: 'Survis à un hiver entier', en: 'Survive a whole winter' }, r: 300, p: () => [G.env.day >= 12 ? 1 : 0, 1] },
  { n: { fr: 'Atteins 40 habitants', en: 'Reach 40 inhabitants' }, r: 800, p: () => [G.tribe.villagers.length, 40] },
  { n: { fr: 'RÉVÉLATION : passe à l\'ÈRE IV', en: 'REVELATION: reach ERA IV' }, r: 1500, p: () => [G.tribe.era, 4] },
  { n: { fr: 'Élève 3 TOURS', en: 'Raise 3 TOWERS' }, r: 2000, p: () => [countB('tower'), 3] },
  { n: { fr: 'Atteins 60 habitants', en: 'Reach 60 inhabitants' }, r: 3000, p: () => [G.tribe.villagers.length, 60] },
  { n: { fr: 'RÉVÉLATION : l\'ÈRE STELLAIRE', en: 'REVELATION: the STELLAR AGE' }, r: 5000, p: () => [G.tribe.era, 5] },
  { n: { fr: 'La tribu construit LA FUSÉE', en: 'The tribe builds THE ROCKET' }, r: 0, p: () => [countB('rocket'), 1] },
  { n: { fr: 'LANCEMENT (30 000 ◊)', en: 'LAUNCH (30,000 ◊)' }, r: 0, p: () => [G.tribe.launched ? 1 : 0, 1] },
];
export const LAUNCH_COST = 30000;

export function createProgress() {
  const unlocked = {};
  for (const tl of TOOLS) if (!tl.cost && !tl.disc) unlocked[tl.id] = 1;
  G.progress = {
    faith: 30, totalFaith: 0, unlocked, found: {}, ach: {}, quest: 0,
    stats: { placed: {}, cells: 0, explosions: 0, strikes: 0, miracles: 0 },
  };
  return G.progress;
}

export const isSandbox = () => G.mode === 'sandbox';

export function isUnlocked(id) {
  if (isSandbox()) return true;
  const tl = TOOL[id];
  if (tl.disc) return !!G.progress.found[tl.disc];
  return !!G.progress.unlocked[id];
}

export function canSpend(n) {
  return isSandbox() || G.progress.faith >= n;
}
export function spend(n) {
  if (isSandbox()) return true;
  if (G.progress.faith < n) return false;
  G.progress.faith -= n;
  return true;
}
export function earn(n) {
  if (n <= 0) return;
  G.progress.faith += n;
  G.progress.totalFaith += n;
}

export function unlock(id) {
  const tl = TOOL[id];
  if (isUnlocked(id) || tl.disc) return false;
  if (!spend(tl.cost)) return false;
  G.progress.unlocked[id] = 1;
  emit('unlock', tl);
  return true;
}

export function discover(key) {
  if (G.generating) return;
  const P = G.progress;
  if (!P || P.found[key] || !DISCOVERIES[key]) return;
  P.found[key] = G.env.day + 1;
  const dsc = DISCOVERIES[key];
  if (!isSandbox()) earn(dsc.r);
  emit('discovered', key, dsc);
}
on('discover', discover);

export function eraReq(e) {
  return ERAS[e];
}

export function canAdvance() {
  const T = G.tribe;
  const nx = ERAS[T.era + 1];
  if (!nx) return false;
  if (T.villagers.length < nx.pop) return false;
  if (nx.houses && T.buildings.filter((b) => ['tent', 'hut', 'house', 'stonehouse', 'tower'].includes(b.kind)).length < nx.houses) return false;
  return canSpend(nx.faith);
}

// each era hands the god a new set of powers
export const ERA_GIFTS = [
  [],
  ['tree', 'flower', 'fish', 'rabbit', 'deer', 'cloud', 'snow'],
  ['boar', 'bird', 'butterfly', 'worm', 'ice', 'lava', 'oil', 'steam', 'wind', 'snowcloud', 'gift', 'bless', 'rainbow', 'night'],
  ['firefly', 'shroom', 'metal', 'gunpowder', 'acid', 'storm', 'bolt', 'aurora', 'wolf'],
  ['tnt', 'meteor', 'gold', 'crystal', 'quake', 'eclipse'],
  ['volcano', 'meteors', 'glitch'],
];
function grantGifts(era) {
  const got = [];
  for (const id of ERA_GIFTS[era] || []) if (TOOL[id] && !G.progress.unlocked[id]) { G.progress.unlocked[id] = 1; got.push(id); }
  return got;
}

export function advance() {
  const T = G.tribe;
  if (!canAdvance()) return false;
  spend(ERAS[T.era + 1].faith);
  T.era++;
  T.building = null;
  emit('era', T.era, grantGifts(T.era));
  return true;
}

// periodic checks (every ~second)
export function checkProgress() {
  const P = G.progress, T = G.tribe;
  // (worlds saved before eras gave powers catch up quietly)
  for (let e = 1; e <= T.era; e++) grantGifts(e);
  for (const a of ACHIEVEMENTS) {
    if (P.ach[a.id]) continue;
    if (a.test(T)) {
      P.ach[a.id] = G.env.day + 1;
      if (!isSandbox()) earn(a.r);
      emit('achieved', a);
    }
  }
  const q = QUESTS[P.quest];
  if (q) {
    const [cur, goal] = q.p();
    if (cur >= goal) {
      P.quest++;
      if (!isSandbox()) earn(q.r);
      emit('quest', q);
    }
  }
}

// income per tick
export function tickFaith() {
  const T = G.tribe;
  if (!T) return;
  earn(T.faithRate / 60);
}
