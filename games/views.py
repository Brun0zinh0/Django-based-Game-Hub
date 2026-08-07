from pathlib import Path

from django.http import Http404
from django.shortcuts import render
from django.templatetags.static import static

SOUNDS_DIRECTORY = Path(__file__).resolve().parent.parent / "sounds"
BATTLE_MUSIC_DIRECTORY = SOUNDS_DIRECTORY / "RogueLike Batle royal" / "music"
POKEMON_MUSIC_DIRECTORY = SOUNDS_DIRECTORY / "Pokerogue" / "music"
AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".m4a"}


def collect_music_tracks(directory, root_playlist_name):
    """Walk a game's music folder into track and playlist lists.

    The folder is the player's own playlist: files at the top level join the
    root playlist, and each sub-folder becomes a named playlist of its own.
    Both games share this shape; only the folder and labels differ.
    """
    tracks = []
    playlist_names = {}
    if directory.is_dir():
        for audio_path in sorted(
            directory.rglob("*"),
            key=lambda path: str(path.relative_to(directory)).casefold(),
        ):
            if (
                not audio_path.is_file()
                or audio_path.suffix.casefold() not in AUDIO_EXTENSIONS
            ):
                continue
            relative_path = audio_path.relative_to(directory)
            relative_parent = relative_path.parent
            if relative_parent == Path("."):
                playlist_id = "main"
                playlist_name = root_playlist_name
            else:
                playlist_id = relative_parent.as_posix()
                playlist_name = relative_parent.name.replace("_", " ")
            playlist_names[playlist_id] = playlist_name
            static_path = Path("sounds") / audio_path.relative_to(SOUNDS_DIRECTORY)
            tracks.append(
                {
                    "title": audio_path.stem,
                    "url": static(static_path.as_posix()),
                    "playlist": playlist_id,
                }
            )
    return tracks, playlist_names

ARCADE_GAMES = {
    "pokemon-rogue": {
        "slug": "pokemon-rogue",
        "number": 2,
        "title": "Pokémon Rogue",
        "icon": "◓",
        "theme": "violet",
        "description": (
            "Une future aventure roguelike de capture, d’équipe et de "
            "combats avec des parcours différents à chaque tentative."
        ),
        "available": True,
    },
}


def home(request):
    """Affiche la liste des mini-jeux."""
    return render(
        request,
        "games/home.html",
        {"arcade_games": list(ARCADE_GAMES.values())},
    )


def build_playlists(tracks, playlist_names, all_name):
    playlists = [
        {"id": "all", "name": all_name, "track_count": len(tracks)},
    ]
    for playlist_id, playlist_name in sorted(
        playlist_names.items(),
        key=lambda item: item[1].casefold(),
    ):
        playlists.append(
            {
                "id": playlist_id,
                "name": playlist_name,
                "track_count": sum(
                    track["playlist"] == playlist_id
                    for track in tracks
                ),
            }
        )
    return playlists


def pokemon_rogue(request):
    """Display the browser-based two-versus-two battle prototype."""
    tracks, playlist_names = collect_music_tracks(
        POKEMON_MUSIC_DIRECTORY, "Main playlist"
    )
    return render(
        request,
        "games/pokemon_rogue.html",
        {
            "pokemon_music_tracks": tracks,
            "pokemon_music_playlists": build_playlists(
                tracks, playlist_names, "All music"
            ),
        },
    )


def battle_royale(request):
    """Affiche le jeu d'action 2D exécuté dans le navigateur."""
    tracks, playlist_names = collect_music_tracks(
        BATTLE_MUSIC_DIRECTORY, "Playlist principale"
    )
    return render(
        request,
        "games/battle_royale.html",
        {
            "battle_music_tracks": tracks,
            "battle_music_playlists": build_playlists(
                tracks, playlist_names, "Toutes les musiques"
            ),
        },
    )


def arcade_game(request, game_slug):
    """Affiche l'un des jeux basés sur le moteur d'arcade commun."""
    game = ARCADE_GAMES.get(game_slug)
    if game is None or not game.get("available", False):
        raise Http404("Ce jeu n'existe pas.")

    return render(request, "games/arcade_game.html", {"game": game})
