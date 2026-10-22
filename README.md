# GENESIS.TXT

> *un monde vivant, écrit en texte* — *a living world, written in text*

**GENESIS.TXT** est un god-game bac à sable entièrement en ASCII, qui tourne dans le navigateur.
Chaque grain de sable, chaque goutte d'eau, chaque feuille est un caractère, et tout réagit.

```
 ██████╗ ███████╗███╗   ██╗███████╗███████╗██╗███████╗
██╔════╝ ██╔════╝████╗  ██║██╔════╝██╔════╝██║██╔════╝
██║  ███╗█████╗  ██╔██╗ ██║█████╗  ███████╗██║███████╗
██║   ██║██╔══╝  ██║╚██╗██║██╔══╝  ╚════██║██║╚════██║
╚██████╔╝███████╗██║ ╚████║███████╗███████║██║███████║
 ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝╚══════╝
```

## Le jeu

- **Un monde procédural** : océans, montagnes enneigées, volcan, grottes, minerais, cristaux et champignons bioluminescents.
- **Une physique de particules** : 43 éléments qui coulent, brûlent, gèlent, fondent, explosent, se dissolvent, s'électrisent…
- **Un écosystème vivant** : les arbres poussent et se ressèment, les oiseaux migrent, les poissons frayent, les lucioles sortent les nuits d'été.
- **Le temps qui passe** : cycle jour/nuit, quatre saisons (feuillages d'automne, cerisiers en fleurs, lacs gelés), pluie, orages, neige, aurores, arcs-en-ciel, éclipses, pluies d'étoiles.
- **Une civilisation** : deux ☺ s'éveillent. Ils coupent du bois, pêchent, cueillent, bâtissent, dorment, prient — et leur foi ◊ est ta ressource. Guide-les de l'aube jusqu'à l'ère stellaire… et au lancement de la fusée.
- **31 découvertes** à faire en combinant les éléments (sous tes yeux), 20 exploits, 21 objectifs.
- **Musique générative** et effets sonores synthétisés en temps réel (aucun fichier audio).
- **Rendu WebGL2** : atlas de glyphes, éclairage dynamique, bloom, effet CRT.
- Sauvegarde automatique, prières hors-ligne, export du monde en `.txt` ou en `.png`, FR / EN.

## Contrôles

| | |
|---|---|
| Clic gauche | peindre avec l'outil choisi |
| Clic droit / glisser | déplacer la caméra |
| Molette | zoom · `Maj`+molette ou `[` `]` : taille du pinceau |
| `ZQSD` / `WASD` / flèches | se déplacer |
| `Espace` | pause · `F` : accélérer |
| `1`–`9` | outils · `Tab` : catégorie suivante · `E` : gomme |
| `C` codex · `V` civilisation · `H` cacher l'interface · `M` muet · `P` photo | |
| Clic sur un villageois (outil Observer) | le suivre |

Sur mobile : un doigt pour peindre, deux doigts pour déplacer / zoomer.

## Lancer en local

Aucune dépendance, aucun build : ce sont des modules ES statiques.

```sh
cd site && python3 -m http.server 8080
# puis http://localhost:8080
```

## Déploiement

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publie le dossier `site/` sur **GitHub Pages** à chaque push.
Une seule fois : *Settings → Pages → Build and deployment → Source : **GitHub Actions***.

## Structure

```
site/
  index.html, css/style.css
  js/main.js        boucle de jeu, intro → partie
  js/sim.js         automate cellulaire (physique & chimie)
  js/elements.js    les 43 éléments
  js/worldgen.js    génération procédurale
  js/weather.js     temps, saisons, météo, ciel
  js/life.js        villageois, tribu, bâtiments, écosystème
  js/progress.js    foi, outils, découvertes, exploits, objectifs, ères
  js/powers.js      pouvoirs du joueur, miracles, événements
  js/renderer.js    WebGL2 : atlas, lumière, bloom, CRT
  js/compose.js     composition des glyphes (ciel, montagnes, eau…)
  js/audio.js       musique générative & effets
  js/ui.js, input.js, intro.js, game.js, save.js, i18n.js
```
