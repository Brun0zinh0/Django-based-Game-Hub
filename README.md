# Mini-jeux Django

Projet de jeux Web construit avec Django. Le hub contient actuellement trois
jeux actifs :

- **Rogue Like Battle Royale**, un jeu d’action 2D avec progression roguelike ;
- **Pokémon Rogue**, une aventure 2v2 organisée par ligues régionales ;
- **Terra Boss**, un roguelike de boss sans fin inspiré de Terraria : des
  manches qui ne s’arrêtent jamais, une boutique entre les vagues, et des
  packs de contenu qu’on peut activer depuis le menu.

Boss Rush Protocol et Space Racer ont été retirés du projet. Leurs anciennes
URLs renvoient désormais une page 404 et leurs fichiers dédiés ne font plus
partie de l’application.

## Installation sous Windows

Dans PowerShell, place-toi dans ce dossier puis exécute :

```powershell
python -m pip install -r requirements.txt
python manage.py runserver
```

Ouvre ensuite <http://127.0.0.1:8000/> dans ton navigateur.

Pour arrêter le serveur, reviens dans le terminal et appuie sur `Ctrl+C`.

## Commandes utiles

```powershell
# Vérifier la configuration
python manage.py check

# Lancer les tests
python manage.py test
```

## Structure

```text
config/             configuration générale du site
games/              application consacrée aux jeux
  static/           styles CSS, moteurs JavaScript et assets
  templates/        pages HTML
  urls.py           routes de l’application
  views.py          pages Django et détection des musiques
  tests.py          tests automatiques
sounds/             musiques utilisées par les jeux actifs
manage.py           commandes Django
requirements.txt    dépendances Python
```

## Crédits

Projet personnel et non commercial. Presque toutes les images viennent
d’ailleurs, et voici d’où. La provenance fichier par fichier est conservée
à côté des assets eux-mêmes, dans les `SOURCES.md` et les `manifest.json` :
ce qui suit en est le résumé.

### Terra Boss

- **Terraria** — © [Re-Logic](https://re-logic.com/). Les noms, les
  statistiques, les boss et le comportement des armes viennent du jeu ; les
  sprites aussi.
- **[The Spriters Resource](https://www.spriters-resource.com/pc_computer/terraria/)**
  — d’où les 19 planches de sprites ont été téléchargées. L’identifiant et
  l’URL de chaque planche sont dans
  `games/static/games/assets/terra/sprites/manifest.json`. Merci aux
  personnes qui les ont extraites et mises en ligne.
- **[Calamity Mod](https://calamitymod.wiki.gg/)** — par la **Calamity Mod
  Team**. Le pack de contenu optionnel en reprend les noms, les
  statistiques, le comportement **et les sprites**, récupérés depuis leur
  wiki par `fetch_terra_calamity_sprites.py`. Les fichiers d’origine sont
  conservés tels quels dans
  `games/static/games/assets/terra/sprites/calamity/raw/`, avec l’URL de
  chacun dans le `manifest.json` à côté. Les bandes que le jeu charge en
  sont recomposées ; aucun dessin n’est de nous.
- **[Backgrounds o' Plenty](https://steamcommunity.com/sharedfiles/filedetails/?id=2971754944)**
  — pack de textures Terraria par **Shashwambam**. Les vingt-trois nouveaux
  arrière-plans d’arène sont les images de présentation publiques de cette
  page, recadrées pour retirer l’étiquette de nom ; le pack lui-même n’est
  pas redistribué ici. `manifest.json` note de quelle image vient chaque
  fichier.
- Les dix premiers arrière-plans d’arène et le clip du menu ont été fournis
  par l’auteur du projet.

### Pokémon Rogue

- **Pokémon** — © Nintendo / Creatures Inc. / GAME FREAK. Jeu de fan.
- **[Pokémon Showdown](https://play.pokemonshowdown.com/)** — sprites
  animés, sprites de dresseurs et animations d’attaques. Showdown précise
  que beaucoup de sprites de dresseurs sont l’œuvre de la communauté et
  doivent être crédités individuellement : la page source fait foi, et les
  fichiers ne sont pas modifiés ici.
- **[RHH pokeemerald-expansion](https://github.com/rh-hideout/pokeemerald-expansion)**
  — sprites d’effets de combat. *Based off RHH’s pokeemerald-expansion.*
- **The Spriters Resource** — planches créditées à FrenchOrange,
  yoursavior, fabnt, tsuka, mufasakong, Barubary et redblueyellow ; le
  détail par planche est dans
  `games/static/games/assets/pokemon/spriters-resource/SOURCES.md`.
- **DeviantArt** — arrière-plans de combat par
  [carchagui](https://deviantart.com/carchagui) et
  [Princess-Phoenix](https://deviantart.com/princess-phoenix).
- **[Radical Red Pokédex](https://github.com/JwowSquared/Radical-Red-Pokedex)**
  — table de données utilisée en développement.

### Technique

- **[Phaser 3.90](https://phaser.io/)** — moteur des jeux, inclus dans
  `games/static/games/vendor/`.
- **[Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)** —
  police, via Google Fonts.

Aucun des projets ci-dessus n’est affilié à celui-ci. Si vous êtes l’auteur
d’un asset et que vous souhaitez un crédit différent ou son retrait,
ouvrez une issue.

## Lancer le projet

```bash
pip install -r requirements.txt
python manage.py runserver
```

Puis ouvrir http://127.0.0.1:8000/ . Aucune base de donnees n'est
necessaire : le hub ne stocke rien cote serveur, les sauvegardes des jeux
vivent dans le navigateur.

### Musique

Le dossier `sounds/` est volontairement vide : les musiques utilisees
pendant le developpement ne sont pas redistribuees ici. Les deux premiers
jeux fonctionnent sans, et `sounds/README.md` explique ou deposer vos
propres fichiers pour retrouver les playlists. Terra Boss genere ses sons
dans le navigateur et n'a besoin d'aucun fichier.

## Mettre a jour sans perdre sa sauvegarde

Les sauvegardes ne sont pas dans les fichiers du projet : chaque jeu ecrit
sa progression dans le navigateur, attachee a l'adresse
`http://127.0.0.1:8000`. **Remplacer les fichiers du jeu n'efface donc
jamais une sauvegarde.**

Pour mettre a jour :

```bash
git pull
```

Puis relancer le serveur et faire **Ctrl+F5** une fois sur la page du jeu.
Ce rafraichissement force compte : le navigateur garde les scripts et les
images en cache, et une page a moitie mise a jour donne des bugs
d'affichage difficiles a comprendre. Ctrl+F5 ne touche pas aux
sauvegardes.

Ce qui fait disparaitre une progression :

* effacer les donnees de navigation du site ;
* le bouton « Reinitialiser ma progression » dans les parametres ;
* la navigation privee, qui ne conserve rien.

Ce qui la rend seulement **invisible**, sans l'effacer : ouvrir le jeu sur
une autre adresse. `http://localhost:8000` et `http://127.0.0.1:8000` sont
deux adresses differentes pour le navigateur, et un autre port en est une
troisieme. Revenir a l'adresse habituelle fait reapparaitre le profil. Un
autre navigateur a, lui aussi, ses propres sauvegardes.

Pour transferer ou sauvegarder un profil, ouvrir la console du navigateur
(`F12`) sur la page du jeu :

```js
// exporter (le profil part dans le presse-papier)
copy(localStorage.getItem("rogueBattleProfileV1"))

// reimporter
localStorage.setItem("rogueBattleProfileV1", 'COLLE_ICI'); location.reload()
```
