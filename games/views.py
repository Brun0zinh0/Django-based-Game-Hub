import base64
import json
import re
from pathlib import Path

from django.conf import settings
from django.http import Http404, JsonResponse
from django.shortcuts import render
from django.templatetags.static import static
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

SOUNDS_DIRECTORY = Path(__file__).resolve().parent.parent / "sounds"
CAPTURE_DIRECTORY = Path(__file__).resolve().parent.parent / "tmp" / "anim-captures"
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
        "cover": "games/assets/hub/pokemon-rogue-cover.jpg",
        "url_name": "games:pokemon_rogue",
        "description": (
            "Une future aventure roguelike de capture, d’équipe et de "
            "combats avec des parcours différents à chaque tentative."
        ),
        "available": True,
    },
    "terra-boss": {
        "slug": "terra-boss",
        "number": 3,
        "title": "Terra Boss",
        "icon": "⚒",
        "theme": "terra",
        "cover": "games/assets/hub/terra-boss-cover.jpg",
        "url_name": "games:terra_boss",
        "description": (
            "Roguelike de boss inspiré de Terraria : survis à des manches "
            "sans fin, achète des armes à distance entre les vagues et "
            "débloque de nouveaux personnages."
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


def terra_boss(request):
    """Display the Terraria-inspired endless boss-rush roguelike."""
    return render(request, "games/terra_boss.html")


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

@csrf_exempt
@require_POST
def save_anim_capture(request):
    """Write an animation-viewer capture to tmp/anim-captures/<name>.png.

    The viewer used to hand its contact sheets back as base64 through the
    console, which meant five round trips per sheet and a size ceiling that
    quietly truncated the last one. Writing the file here makes reviewing a
    capture a single file read.

    DEBUG only: it accepts a filename and image bytes, so it has no business
    existing on a served site.
    """
    if not settings.DEBUG:
        raise Http404

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "expected a JSON body"}, status=400)

    # The name is ours to choose, so keep it to a safe, flat basename.
    name = re.sub(r"[^A-Za-z0-9_-]", "", str(payload.get("name", "")))[:64]
    data_url = str(payload.get("dataUrl", ""))
    prefix = "data:image/png;base64,"
    if not name or not data_url.startswith(prefix):
        return JsonResponse({"error": "need a name and a PNG data URL"}, status=400)

    try:
        image = base64.b64decode(data_url[len(prefix):], validate=True)
    except (ValueError, TypeError):
        return JsonResponse({"error": "the image data did not decode"}, status=400)

    CAPTURE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    path = CAPTURE_DIRECTORY / f"{name}.png"
    path.write_bytes(image)
    return JsonResponse({"path": str(path), "bytes": len(image)})

