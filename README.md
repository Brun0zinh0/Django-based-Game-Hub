# Mini-jeux Django

Projet de jeux Web construit avec Django. Le hub contient actuellement deux
jeux actifs :

- **Rogue Like Battle Royale**, un jeu d’action 2D avec progression roguelike ;
- **Pokémon Rogue**, une aventure 2v2 organisée par ligues régionales.

Boss Rush Protocol et Space Racer ont été retirés du projet. Leurs anciennes
URLs renvoient désormais une page 404 et leurs fichiers dédiés ne font plus
partie de l’application.

## Installation sous Windows

Dans PowerShell, place-toi dans ce dossier puis exécute :

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
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
pendant le developpement ne sont pas redistribuees ici. Les deux jeux
fonctionnent sans, et `sounds/README.md` explique ou deposer vos propres
fichiers pour retrouver les playlists.
