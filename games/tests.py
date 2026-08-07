from django.test import TestCase
from django.urls import reverse

import base64
import io
import re
from pathlib import Path

from PIL import Image

class HomeTests(TestCase):
    def test_home_page_is_available(self):
        response = self.client.get(reverse("games:home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "The cool Rogue Game Hub")
        self.assertContains(response, "Rogue Like Battle Royale")
        self.assertContains(response, "Pokémon Rogue")
        self.assertNotContains(response, "Boss Rush Protocol")
        self.assertNotContains(response, "Space Racer")
        self.assertNotContains(response, "Devine le nombre")
        self.assertNotContains(response, "Prochaine étape")
        self.assertNotContains(
            response,
            "Bienvenue dans ton premier projet",
        )

    def test_retired_game_urls_are_gone(self):
        self.assertEqual(self.client.get("/fps-roguelike/").status_code, 404)
        self.assertEqual(
            self.client.get("/arcade/space-racer/").status_code,
            404,
        )

    def test_old_guess_number_url_is_gone(self):
        response = self.client.get("/devine-le-nombre/")

        self.assertEqual(response.status_code, 404)


class BattleRoyaleTests(TestCase):
    def test_battle_royale_page_is_available(self):
        response = self.client.get(reverse("games:battle_royale"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Rogue Like Battle Royale")
        self.assertContains(response, 'id="battle-canvas"')
        self.assertContains(response, 'id="round-value"')
        self.assertContains(response, 'id="points-value"')
        self.assertContains(response, 'id="points-gain"')
        self.assertContains(response, 'id="upgrade-shop"')
        self.assertContains(response, 'data-upgrade="vitality"')
        self.assertContains(response, 'data-upgrade="power"')
        self.assertContains(response, 'data-upgrade="cadence"')
        self.assertContains(response, 'data-upgrade="mobility"')
        self.assertContains(response, 'data-upgrade="armor"')
        self.assertContains(response, 'data-upgrade="scavenger"')
        self.assertContains(response, 'data-element="fire"')
        self.assertContains(response, 'data-element="ice"')
        self.assertContains(response, 'data-element="storm"')
        self.assertContains(response, 'data-skin="aqua"')
        self.assertContains(response, 'id="dash-status"')
        self.assertContains(response, 'id="ability-status"')
        self.assertContains(response, 'id="legacy-credits"')
        self.assertContains(response, 'id="reward-legacy"')
        self.assertContains(response, 'id="terrain-status"')
        self.assertContains(response, 'id="fullscreen-toggle"')
        self.assertContains(response, 'id="talent-points"')
        self.assertContains(response, 'id="skill-tree"')
        self.assertContains(response, 'id="build-summary-list"')
        self.assertContains(response, 'class="build-summary-table"')
        self.assertContains(response, 'data-upgrade="vision"')
        self.assertContains(response, 'id="enemy-status"')
        self.assertContains(response, 'id="selected-skin-name"')
        self.assertContains(response, 'data-element="fire"')
        self.assertContains(response, "wizard_creature_atlas_v2.png")
        self.assertContains(response, "biome_texture_atlas.png")
        self.assertContains(
            response,
            "environment_material_atlas_data.js?v=",
        )
        self.assertContains(response, "battle_royale.js?v=")
        self.assertContains(response, 'id="top-health-fill"')
        self.assertContains(response, 'data-element="wind"')
        self.assertContains(response, 'data-element="psychic"')
        self.assertContains(response, 'data-element="vampire"')
        self.assertContains(response, 'id="menu-character-preview"')
        self.assertContains(response, 'id="wardrobe-toggle"')
        self.assertContains(response, 'id="wardrobe-panel"')
        self.assertContains(response, 'id="settings-toggle"')
        self.assertContains(response, 'id="game-settings-dialog"')
        self.assertContains(response, 'id="reset-save-button"')
        self.assertContains(response, 'id="fullscreen-toggle"')
        self.assertContains(response, 'data-skin="automaton"')
        self.assertContains(response, 'data-skin="skeleton"')
        self.assertContains(response, 'data-skin="clown"')
        self.assertContains(response, 'data-skin="mermaid"')
        self.assertContains(response, 'data-skin="bride"')
        self.assertContains(response, "wizard_bonus_atlas_v1.png")
        self.assertContains(response, 'id="defeat-stats"')
        self.assertContains(response, 'id="defeat-round"')
        self.assertContains(response, 'id="defeat-kills"')
        self.assertContains(response, 'id="defeat-time"')
        self.assertContains(response, 'id="defeat-damage-dealt"')
        self.assertContains(response, 'id="defeat-damage-taken"')
        self.assertContains(response, 'id="defeat-legacy"')
        self.assertContains(response, 'data-upgrade="dash"')
        self.assertContains(response, 'data-upgrade="fullAuto"')
        self.assertContains(response, "100 pts")
        self.assertContains(response, "300 pts")
        self.assertContains(response, 'id="battle-background-music"')
        self.assertContains(response, 'id="now-playing-title"')
        self.assertContains(response, 'id="battle-info-menu"')
        self.assertContains(response, 'id="compact-dps"')
        self.assertContains(response, 'id="compact-health"')
        self.assertContains(response, 'id="compact-shield"')
        self.assertContains(response, 'id="music-volume"')
        self.assertContains(response, 'id="music-playlist"')
        self.assertContains(response, 'id="battle-music-tracks"')
        self.assertNotContains(response, 'class="battle-controls"')
        self.assertNotContains(response, 'class="loot-guide"')
        # sounds/ ships empty: the tracks are the player's own files, not the
        # project's. The page has to work either way, so the shape of a track
        # is only checked when there is one to check.
        tracks = response.context["battle_music_tracks"]
        if tracks:
            self.assertIn("title", tracks[0])
            self.assertIn("playlist", tracks[0])
            self.assertEqual(
                response.context["battle_music_playlists"][0],
                {
                    "id": "all",
                    "name": "Toutes les musiques",
                    "track_count": len(tracks),
                },
            )

    def test_home_page_links_to_battle_royale(self):
        response = self.client.get(reverse("games:home"))

        self.assertContains(response, reverse("games:battle_royale"))


class ArcadeGameTests(TestCase):
    def test_home_only_lists_the_current_arcade_game(self):
        response = self.client.get(reverse("games:home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Pokémon Rogue")
        self.assertNotContains(response, "Space Racer")
        self.assertNotContains(response, "Asteroid Dash")
        self.assertNotContains(response, "Memory Grid")

    def test_removed_arcade_games_are_no_longer_available(self):
        removed_games = [
            "snake-neon",
            "pong-arena",
            "brick-breaker",
            "dodge-rush",
            "asteroid-dash",
            "memory-grid",
            "space-racer",
        ]

        home_response = self.client.get(reverse("games:home"))

        for slug in removed_games:
            with self.subTest(game=slug):
                game_url = reverse("games:arcade_game", args=[slug])
                self.assertNotContains(home_response, game_url)
                self.assertEqual(self.client.get(game_url).status_code, 404)

    def test_unknown_arcade_game_returns_not_found(self):
        response = self.client.get(
            reverse("games:arcade_game", args=["jeu-inconnu"]),
        )

        self.assertEqual(response.status_code, 404)


class AssetPipelineTests(TestCase):
    static_dir = Path(__file__).resolve().parent / "static" / "games"

    def _load_material_atlas(self):
        payload = (
            self.static_dir / "environment_material_atlas_data.js"
        ).read_text(encoding="utf-8")
        match = re.search(r'"([A-Za-z0-9+/=]{100,})"', payload)
        self.assertIsNotNone(match, "base64 payload not found")
        return Image.open(io.BytesIO(base64.b64decode(match.group(1))))

    def test_material_atlas_is_three_by_three(self):
        atlas = self._load_material_atlas()
        self.assertEqual(atlas.width, atlas.height)
        self.assertEqual(atlas.width % 3, 0)

    def test_material_ids_cover_all_nine_tiles(self):
        source = (
            self.static_dir / "battle_royale.js"
        ).read_text(encoding="utf-8")
        match = re.search(
            r"const materialIds = \[(.*?)\];", source, re.DOTALL
        )
        self.assertIsNotNone(match, "materialIds array not found")
        material_ids = re.findall(r'"([a-z]+)"', match.group(1))
        self.assertEqual(
            material_ids,
            [
                "bark",
                "foliage",
                "rock",
                "wall",
                "mud",
                "blizzard",
                "clearing",
                "portal",
                "generator",
            ],
        )
