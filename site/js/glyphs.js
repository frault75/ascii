// ─── glyphs.js ── the 256-slot charset shared by the atlas and the world ────

const BASE =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
const ACCENTS = 'éèêëàâäçôöûùüîïÉÈÊÀÂÇÔÛÎœŒ«»’…—';
const BLOCKS = '█▀▄▌▐░▒▓│─║═┌┐└┘╔╗╚╝╱╲╳┼├┤┬┴▖▗▘▝▙▛▜▟▞▚◢◣◤◥';
const SYMBOLS = '▲▼◄►■□▪▫●○◊◆♦♣♠♥☺☻☼≈∙·°∘≡¤†‡¡ψΨжЖ✿❀✦✧★☆♪♫∩ΠΛπΩ∞∴⌂∼‾¦ϟ↑↓←→ʷ˄˅‿⁀¸˙';

export const CHARSET = [];
const INDEX = new Map();

function add(str) {
  for (const ch of str) {
    if (INDEX.has(ch)) continue;
    if (CHARSET.length >= 256) throw new Error('charset overflow at ' + ch);
    INDEX.set(ch, CHARSET.length);
    CHARSET.push(ch);
  }
}
add(BASE);
add(ACCENTS);
add(BLOCKS);
add(SYMBOLS);

const Q = INDEX.get('?');
export function gi(ch) {
  const i = INDEX.get(ch);
  return i === undefined ? Q : i;
}
export function gs(str) {
  return Array.from(str, gi);
}

// glyphs drawn procedurally for pixel-perfect tiling
export const PROCEDURAL = new Set(Array.from(BLOCKS));
