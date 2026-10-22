// ─── i18n.js ── français / english ─────────────────────────────────────────
import { G } from './state.js';

const S = {
  title: ['GENESIS.TXT', 'GENESIS.TXT'],
  tagline: ['un monde vivant, écrit en texte', 'a living world, written in text'],
  press: ['[ APPUIE SUR UNE TOUCHE ]', '[ PRESS ANY KEY ]'],
  newWorld: ['NOUVEAU MONDE', 'NEW WORLD'],
  continue: ['CONTINUER', 'CONTINUE'],
  sandbox: ['BAC À SABLE', 'SANDBOX'],
  sandboxSub: ['tout débloqué · foi infinie', 'everything unlocked · infinite faith'],
  genesisSub: ['guide ta tribu des cavernes aux étoiles', 'guide your tribe from caves to stars'],
  continueSub: ['ton monde t\'attend', 'your world awaits'],
  loading: ['GÉNÉRATION DU MONDE', 'GENERATING WORLD'],
  // categories
  cat_terra: ['TERRE', 'EARTH'],
  cat_life: ['VIE', 'LIFE'],
  cat_chaos: ['CHAOS', 'CHAOS'],
  cat_sky: ['CIEL', 'SKY'],
  cat_miracle: ['MIRACLES', 'MIRACLES'],
  // seasons & weather
  spring: ['PRINTEMPS', 'SPRING'], summer: ['ÉTÉ', 'SUMMER'], autumn: ['AUTOMNE', 'AUTUMN'], winter: ['HIVER', 'WINTER'],
  clear: ['dégagé', 'clear'], cloudy: ['nuageux', 'cloudy'], rain: ['pluie', 'rain'], storm: ['orage', 'storm'], snow: ['neige', 'snow'],
  year: ['AN', 'YEAR'], day: ['JOUR', 'DAY'],
  // eras
  era0: ['L\'AUBE', 'DAWN'], era1: ['LA TRIBU', 'THE TRIBE'], era2: ['LE VILLAGE', 'THE VILLAGE'],
  era3: ['LA CITÉ', 'THE CITY'], era4: ['LA MÉTROPOLE', 'THE METROPOLIS'], era5: ['L\'ÈRE STELLAIRE', 'THE STELLAR AGE'],
  eraWord: ['ÈRE', 'ERA'],
  // hud
  faith: ['FOI', 'FAITH'], pop: ['POPULATION', 'POPULATION'], food: ['NOURRITURE', 'FOOD'], wood: ['BOIS', 'WOOD'], stone: ['PIERRE', 'STONE'], metal: ['MÉTAL', 'METAL'],
  mood: ['HUMEUR', 'MOOD'], perSec: ['/s', '/s'],
  happy: ['radieux', 'radiant'], content: ['serein', 'content'], uneasy: ['inquiet', 'uneasy'], miserable: ['désespéré', 'miserable'],
  civ: ['CIVILISATION', 'CIVILISATION'], codex: ['CODEX', 'CODEX'], settings: ['RÉGLAGES', 'SETTINGS'], help: ['AIDE', 'HELP'], log: ['CHRONIQUE', 'CHRONICLE'],
  discoveries: ['DÉCOUVERTES', 'DISCOVERIES'], achievements: ['EXPLOITS', 'ACHIEVEMENTS'], stats: ['STATISTIQUES', 'STATISTICS'],
  nextEra: ['PROCHAINE ÈRE', 'NEXT ERA'], reveal: ['RÉVÉLATION', 'REVELATION'], need: ['requis', 'needed'],
  inhabitants: ['habitants', 'inhabitants'], houses: ['maisons', 'houses'],
  buildings: ['BÂTIMENTS', 'BUILDINGS'], villagers: ['VILLAGEOIS', 'VILLAGERS'],
  launch: ['LANCEMENT', 'LAUNCH'], launchSub: ['la fusée est prête. emporte-les vers les étoiles.', 'the rocket is ready. carry them to the stars.'],
  locked: ['VERROUILLÉ', 'LOCKED'], unlock: ['DÉBLOQUER', 'UNLOCK'], cost: ['coût', 'cost'], perUse: ['par usage', 'per use'],
  notEnough: ['pas assez de foi', 'not enough faith'], discoverToUnlock: ['à découvrir', 'discover to unlock'],
  brush: ['PINCEAU', 'BRUSH'], speed: ['VITESSE', 'SPEED'], paused: ['EN PAUSE', 'PAUSED'],
  quest: ['OBJECTIF', 'OBJECTIVE'], questDone: ['OBJECTIF ACCOMPLI', 'OBJECTIVE COMPLETE'],
  discovery: ['DÉCOUVERTE', 'DISCOVERY'], achievement: ['EXPLOIT', 'ACHIEVEMENT'],
  welcomeBack: ['PENDANT TON ABSENCE', 'WHILE YOU WERE AWAY'],
  prayed: ['tes fidèles ont prié', 'your followers prayed'],
  saved: ['monde sauvegardé', 'world saved'],
  copied: ['copié dans le presse-papiers', 'copied to clipboard'],
  // settings
  sCrt: ['effet CRT', 'CRT effect'], sBloom: ['halo lumineux', 'bloom'], sVolume: ['volume', 'volume'], sMusic: ['musique', 'music'], sSfx: ['effets', 'effects'],
  sLang: ['langue', 'language'], sHints: ['astuces', 'hints'], sNew: ['nouveau monde', 'new world'], sExport: ['exporter en .txt', 'export as .txt'],
  sPhoto: ['photo (.png)', 'photo (.png)'], sReset: ['effacer la sauvegarde', 'erase save'], sMode: ['mode', 'mode'],
  confirmNew: ['Créer un nouveau monde ? Le monde actuel sera perdu.', 'Create a new world? The current one will be lost.'],
  confirmReset: ['Effacer définitivement la sauvegarde ?', 'Erase the save forever?'],
  on: ['oui', 'on'], off: ['non', 'off'],
  // help
  helpText: [
    'CLIC GAUCHE  peindre avec l\'outil choisi\nCLIC DROIT / glisser  déplacer la caméra\nMOLETTE  zoom   ·   MAJ+MOLETTE / [ ]  taille du pinceau\nZQSD / FLÈCHES  se déplacer\nESPACE  pause   ·   1-4  vitesse\nTAB  catégorie suivante   ·   H  cacher l\'interface\nC  codex   ·   V  civilisation   ·   M  muet   ·   P  photo\nCLIC sur un villageois  le suivre',
    'LEFT CLICK  paint with the selected tool\nRIGHT CLICK / drag  move the camera\nWHEEL  zoom   ·   SHIFT+WHEEL / [ ]  brush size\nWASD / ARROWS  move\nSPACE  pause   ·   1-4  speed\nTAB  next category   ·   H  hide interface\nC  codex   ·   V  civilisation   ·   M  mute   ·   P  photo\nCLICK a villager  follow them',
  ],
  // misc log lines
  logBirth: ['{0} est né·e.', '{0} was born.'],
  logDeath: ['{0} est mort·e {1}.', '{0} died {1}.'],
  logBuilt: ['La tribu a bâti : {0}.', 'The tribe built: {0}.'],
  logCollapse: ['{0} s\'est effondré·e.', '{0} collapsed.'],
  logHunger: ['La tribu a faim…', 'The tribe is hungry…'],
  logEra: ['Une nouvelle ère commence : {0}.', 'A new era begins: {0}.'],
  logWeather: ['Le temps tourne : {0}.', 'The weather turns: {0}.'],
  logSeason: ['{0} arrive.', '{0} arrives.'],
  logGold: ['{0} a trouvé de l\'or !', '{0} found gold!'],
  logFirst: ['Deux êtres s\'éveillent au bord du monde.', 'Two beings awaken at the edge of the world.'],
  logEruption: ['Le volcan se réveille !', 'The volcano awakens!'],
  logMeteor: ['Pluie d\'étoiles filantes !', 'Meteor shower!'],
  logAurora: ['Une aurore danse dans le ciel.', 'An aurora dances in the sky.'],
  logEclipse: ['Le soleil s\'éteint… éclipse !', 'The sun goes dark… eclipse!'],
  logRainbow: ['Un arc-en-ciel apparaît.', 'A rainbow appears.'],
  logMigration: ['Une nuée d\'oiseaux migre.', 'A flock of birds migrates.'],
  logExtinct: ['Il n\'y a plus personne. Le monde attend une étincelle (VIE → Étincelle, gratuite).', 'No one is left. The world awaits a spark (LIFE → Spark, free).'],
  cause_fire: ['dans les flammes', 'in the flames'], cause_lava: ['dans la lave', 'in lava'], cause_acid: ['dissous·e dans l\'acide', 'dissolved in acid'],
  cause_zap: ['foudroyé·e', 'struck by lightning'], cause_glitch: ['effacé·e par le glitch', 'erased by the glitch'], cause_drown: ['noyé·e', 'by drowning'],
  cause_fall: ['d\'une chute', 'from a fall'], cause_starve: ['de faim', 'of hunger'], cause_buried: ['enseveli·e', 'buried alive'], cause_old: ['de vieillesse', 'of old age'],
  cause_boom: ['dans une explosion', 'in an explosion'], cause_meteor: ['sous une météorite', 'under a meteorite'],
  b_camp: ['le feu de camp', 'the campfire'], b_tent: ['une tente', 'a tent'], b_hut: ['une hutte', 'a hut'], b_house: ['une maison', 'a house'],
  b_stonehouse: ['une maison de pierre', 'a stone house'], b_tower: ['une tour', 'a tower'], b_temple: ['le temple', 'the temple'],
  b_farm: ['un champ', 'a field'], b_lamp: ['un réverbère', 'a street lamp'], b_rocket: ['LA FUSÉE', 'THE ROCKET'],
  job_idle: ['flâne', 'idles'], job_food: ['cueilleur·se', 'gatherer'], job_wood: ['bûcheron·ne', 'woodcutter'], job_stone: ['mineur·se', 'miner'],
  job_build: ['bâtisseur·se', 'builder'], job_pray: ['prêtre·sse', 'priest'],
  follow: ['SUIVRE', 'FOLLOW'], age: ['âge', 'age'], days: ['jours', 'days'], kid: ['enfant', 'child'],
  ending1: ['ILS ONT ATTEINT LES ÉTOILES', 'THEY REACHED THE STARS'],
  ending2: ['de deux âmes au bord du monde à une civilisation stellaire.', 'from two souls at the edge of the world to a stellar civilisation.'],
  ending3: ['[ CONTINUER À VEILLER SUR CE MONDE ]', '[ KEEP WATCHING OVER THIS WORLD ]'],
};

export function t(key, ...args) {
  const e = S[key];
  if (!e) return key;
  let s = e[G.settings.lang === 'fr' ? 0 : 1];
  args.forEach((a, i) => { s = s.replace('{' + i + '}', a); });
  return s;
}
export function tr(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[G.settings.lang] ?? obj.fr ?? obj.en;
}
