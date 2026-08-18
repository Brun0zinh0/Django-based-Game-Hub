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


class TerraBossTests(TestCase):
    def test_terra_boss_page_is_available(self):
        response = self.client.get(reverse("games:terra_boss"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Terra Boss")
        self.assertContains(response, 'id="tb-menu"')
        self.assertContains(response, 'id="tb-start-run"')
        self.assertContains(response, 'id="tb-character-list"')
        self.assertContains(response, 'id="tb-unlock-list"')
        self.assertContains(response, 'id="tb-canvas"')
        self.assertContains(response, 'id="tb-shop"')
        self.assertContains(response, 'id="tb-shop-reroll"')
        self.assertContains(response, 'id="tb-open-bestiary"')
        self.assertContains(response, 'id="tb-open-weaponry"')
        self.assertContains(response, 'id="tb-bestiary-bosses"')
        self.assertContains(response, 'id="tb-bestiary-mobs"')
        self.assertContains(response, 'id="tb-weaponry-groups"')
        self.assertContains(response, 'id="tb-gear"')
        self.assertContains(response, 'id="tb-gear-weapons"')
        self.assertContains(response, 'id="tb-gear-armor"')
        self.assertContains(response, 'id="tb-gear-accessories"')
        self.assertContains(response, 'id="tb-gear-stash"')
        self.assertContains(response, 'id="tb-open-gear"')
        # The between-round screen docks the gear and inventory panels.
        self.assertContains(response, 'id="tb-gear-panel"')
        self.assertContains(response, 'id="tb-inventory-panel"')
        for dock in ("tb-gear-dock-shop", "tb-inventory-dock-shop",
                     "tb-gear-dock-solo", "tb-inventory-dock-solo"):
            self.assertContains(response, f'id="{dock}"')

        self.assertContains(response, "terra_boss.js?v=")
        self.assertContains(response, "terra_boss_audio.js?v=")
        self.assertContains(response, 'id="tb-mute"')
        self.assertContains(response, 'id="tb-menu-animation"')
        self.assertContains(response, 'class="tb-menu-art"')
        self.assertContains(response, "menu-animation.mp4")
        # The poster carries the menu if the clip cannot play.
        self.assertContains(response, "poster=")
        self.assertContains(response, "data/terra/weapons.json")
        self.assertContains(response, "data/terra/characters.json")
        self.assertContains(response, "data/terra/bosses.json")
        self.assertContains(response, "data/terra/rounds.json")

    def test_overlays_are_capped_to_the_viewport(self):
        css = (
            Path(__file__).resolve().parent
            / "static" / "games" / "terra_boss.css"
        ).read_text(encoding="utf-8")

        # The app uses min-height, so a percentage cap resolves against the
        # grown content and constrains nothing: menus then run off-screen
        # with no way to scroll to them.
        self.assertIn("--tb-panel-space", css)
        self.assertIn("100vh", css.split("--tb-panel-space")[1][:80])
        for rule in (".tb-overlay-card", ".tb-menu-card"):
            block = css.split(rule + " {", 1)[1].split("}", 1)[0]
            self.assertIn(
                "var(--tb-panel-space)",
                block,
                f"{rule} is not capped to the visible area",
            )

    def test_template_comments_never_reach_the_page(self):
        response = self.client.get(reverse("games:terra_boss"))
        body = response.content.decode("utf-8")
        # Django only strips {# #} on a single line; a multi-line one renders
        # as visible text on the page.
        self.assertNotIn("{#", body, "an unclosed template comment leaked into the page")
        self.assertNotIn("#}", body, "a template comment leaked into the page")

    def test_shop_buys_items_back_below_their_price(self):
        import json

        data_dir = (
            Path(__file__).resolve().parent / "static" / "games" / "data" / "terra"
        )
        shop = json.loads((data_dir / "rounds.json").read_text("utf-8"))["shop"]
        ratio = shop["sellRatio"]
        # Selling for what you paid would turn the shop into a money printer.
        self.assertGreater(ratio, 0)
        self.assertLess(ratio, 1)

    def test_menu_animation_file_is_present(self):
        clip = (
            Path(__file__).resolve().parent
            / "static" / "games" / "assets" / "terra" / "menu-animation.mp4"
        )
        self.assertTrue(clip.exists(), "menu animation clip is missing")
        with clip.open("rb") as handle:
            header = handle.read(12)
        self.assertEqual(header[4:8], b"ftyp", "menu animation is not a valid MP4")

    def test_home_page_lists_terra_boss(self):
        response = self.client.get(reverse("games:home"))

        self.assertContains(response, "Terra Boss")
        self.assertContains(response, reverse("games:terra_boss"))
        self.assertContains(response, "terra-boss-cover.jpg")

    def test_sprite_frames_manifest_matches_data(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        frames = json.loads((sprites_dir / "frames.json").read_text("utf-8"))
        for entity, spec in frames.items():
            self.assertTrue(
                (sprites_dir / spec["file"]).exists(),
                f"{entity} strip file missing",
            )

        data_dir = static_dir / "data" / "terra"
        rounds = json.loads((data_dir / "rounds.json").read_text("utf-8"))
        bosses = json.loads((data_dir / "bosses.json").read_text("utf-8"))
        referenced = [
            mob["skin"]["id"] for mob in rounds["mobs"] if "skin" in mob
        ] + [
            boss["skin"]["id"] for boss in bosses["bosses"] if "skin" in boss
        ]
        characters = json.loads((data_dir / "characters.json").read_text("utf-8"))
        for character in characters["characters"]:
            # Every character needs a walk-cycle strip and a portrait.
            self.assertIn(character["id"], frames)
            self.assertIn("walk", frames[character["id"]].get("anims", {}))
            sprite = character.get("sprite", "")
            self.assertTrue(sprite.startswith("portraits/"), f"{character['id']} portrait")
            self.assertTrue(
                (sprites_dir / sprite).exists(),
                f"portrait for {character['id']} missing",
            )
        for skin in referenced:
            self.assertIn(skin, frames, f"skin '{skin}' missing from frames.json")

        tiles = json.loads((sprites_dir / "tiles.json").read_text("utf-8"))
        for tile_id in ("ground-grass", "ground-dirt", "platform-wood"):
            self.assertIn(tile_id, tiles, f"tile '{tile_id}' missing from tiles.json")
            self.assertTrue(
                (sprites_dir / tiles[tile_id]["file"]).exists(),
                f"tile sprite for '{tile_id}' missing",
            )

        items = json.loads((sprites_dir / "items.json").read_text("utf-8"))
        for item_id, spec in items.items():
            self.assertTrue(
                (sprites_dir / spec["file"]).exists(),
                f"item sprite for '{item_id}' missing",
            )
        weapons = json.loads((data_dir / "weapons.json").read_text("utf-8"))
        armor = json.loads((data_dir / "armor.json").read_text("utf-8"))
        accessories = json.loads((data_dir / "accessories.json").read_text("utf-8"))
        sprite_paths = [w["sprite"] for w in weapons["weapons"]]
        sprite_paths += [
            piece["sprite"] for set_ in armor["sets"] for piece in set_["pieces"]
        ]
        sprite_paths += [a["sprite"] for a in accessories["accessories"]]
        for sprite in sprite_paths:
            if sprite.startswith("items/"):
                self.assertTrue(
                    (sprites_dir / sprite).exists(),
                    f"referenced item sprite '{sprite}' missing",
                )

    def test_sprites_keep_terraria_relative_scale(self):
        import json

        sprites_dir = (
            Path(__file__).resolve().parent
            / "static" / "games" / "assets" / "terra" / "sprites"
        )
        frames = json.loads((sprites_dir / "frames.json").read_text("utf-8"))
        # Everything is drawn at one uniform scale, so the frame heights alone
        # decide relative size. In Terraria a player (42px) stands about 2.3x
        # a green slime (18px); the sprite frames must preserve that.
        player = frames["guide"]["frameHeight"]
        slime = frames["base-slime"]["frameHeight"]
        self.assertGreater(
            player / slime,
            1.8,
            "the player has become small relative to basic slimes",
        )
        # An arrow must not be taller than the character firing it.
        items = json.loads((sprites_dir / "items.json").read_text("utf-8"))
        self.assertLess(
            items["arrow"]["size"][1],
            player,
            "arrow sprites are larger than the player",
        )

    def test_every_arena_layout_can_be_climbed(self):
        import json
        import math

        data_dir = (
            Path(__file__).resolve().parent / "static" / "games" / "data" / "terra"
        )
        player = json.loads((data_dir / "rounds.json").read_text("utf-8"))["player"]
        biomes = json.loads((data_dir / "biomes.json").read_text("utf-8"))
        view_width, view_height = 960, 540

        velocity, gravity, run = (
            player["jumpVelocity"], player["gravity"], player["runSpeed"]
        )
        apex = velocity**2 / (2 * gravity)

        def horizontal_reach(rise):
            """How far you travel sideways while jumping `rise` high.

            Take the later root: you can land on a ledge on the way down, which
            is nearly twice the reach of clipping it at the apex.
            """
            disc = velocity**2 - 2 * gravity * rise
            if disc < 0:
                return -1.0
            return run * (velocity + math.sqrt(disc)) / gravity

        def span(plat):
            return plat["x"] - plat["width"] / 2, plat["x"] + plat["width"] / 2

        for layout in biomes["layouts"]:
            ground_y = view_height - layout["groundHeight"]
            platforms = layout["platforms"]
            for plat in platforms:
                low, high = span(plat)
                self.assertGreaterEqual(low, 0, f"{layout['id']} platform off the left")
                self.assertLessEqual(
                    high, view_width, f"{layout['id']} platform off the right"
                )

                rise_from_ground = ground_y - plat["y"]
                reachable = 0 < rise_from_ground <= apex
                for other in platforms:
                    if reachable:
                        break
                    if other is plat or other["y"] <= plat["y"]:
                        continue
                    rise = other["y"] - plat["y"]
                    if rise > apex:
                        continue
                    other_low, other_high = span(other)
                    gap = max(0, low - other_high, other_low - high)
                    reachable = gap <= horizontal_reach(rise)
                self.assertTrue(
                    reachable,
                    f"{layout['id']}: the platform at "
                    f"({plat['x']}, {plat['y']}) cannot be jumped to from "
                    f"the ground or any lower platform",
                )

    def test_armor_keeps_pace_with_the_weapon_tiers(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        data_dir = static_dir / "data" / "terra"

        armor = json.loads((data_dir / "armor.json").read_text("utf-8"))
        weapons = json.loads((data_dir / "weapons.json").read_text("utf-8"))["weapons"]
        worn = json.loads((sprites_dir / "armor.json").read_text("utf-8"))

        # Armour used to stop at tier 3 while weapons ran to 6, which left the
        # late rounds with nothing to spend coins on.
        weapon_tiers = {w["tier"] for w in weapons}
        armor_tiers = {s["tier"] for s in armor["sets"]}
        self.assertGreaterEqual(
            max(armor_tiers),
            max(weapon_tiers),
            "weapons out-tier the best armour, so late rounds have no defence to buy",
        )

        by_tier = {}
        for armor_set in armor["sets"]:
            slots = [piece["slot"] for piece in armor_set["pieces"]]
            self.assertEqual(
                sorted(slots),
                sorted(armor["slots"]),
                f"{armor_set['id']} does not cover every slot",
            )
            for piece in armor_set["pieces"]:
                self.assertTrue(
                    (sprites_dir / piece["sprite"]).exists(),
                    f"{piece['id']} has no icon",
                )
                self.assertGreater(piece["price"], 0)
            effects = (armor_set["setBonus"] or {}).get("effects") or {}
            total = sum(piece["defense"] for piece in armor_set["pieces"])
            total += effects.get("defense", 0)
            by_tier.setdefault(armor_set["tier"], []).append(total)

        # The best set at each tier has to beat the tier below it.
        best = [max(by_tier[tier]) for tier in sorted(by_tier)]
        for lower, higher in zip(best, best[1:]):
            self.assertGreater(
                higher, lower, "an armour tier is no better than the one below it"
            )

        # A helmet drawn on the character must share the player's frame count,
        # or the overlay slides off the head mid-walk.
        characters = json.loads((data_dir / "characters.json").read_text("utf-8"))
        frames = json.loads((sprites_dir / "frames.json").read_text("utf-8"))
        player_frames = frames[characters["characters"][0]["id"]]["frames"]
        for helmet_id, spec in worn.items():
            self.assertEqual(
                spec["frames"],
                player_frames,
                f"{helmet_id} has {spec['frames']} frames but the player has "
                f"{player_frames}",
            )
            self.assertTrue((sprites_dir / spec["file"]).exists())

    def test_accessories_are_tiered_and_do_not_stack_upgrades(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        data = json.loads(
            (static_dir / "data" / "terra" / "accessories.json").read_text("utf-8")
        )
        entries = data["accessories"]
        slots = data["maxEquipped"]

        # Five slots need more than five candidates or the choice is made for
        # you, and every entry needs a tier or the shop cannot gate it.
        self.assertGreater(len(entries), slots * 3)
        tiers = set()
        for accessory in entries:
            self.assertIn("tier", accessory, f"{accessory['id']} has no tier")
            self.assertTrue((sprites_dir / accessory["sprite"]).exists())
            self.assertGreater(accessory["price"], 0)
            tiers.add(accessory["tier"])
        self.assertGreaterEqual(
            len(tiers), 5, "accessories bunch into too few tiers to pace a run"
        )
        for tier in tiers:
            self.assertTrue(
                [a for a in entries if a["tier"] == tier],
                f"tier {tier} has no accessories",
            )

        # Upgrade chains must be ranked, since only the highest tier applies:
        # two boots at the same tier would make the winner arbitrary.
        groups = {}
        for accessory in entries:
            if accessory.get("exclusive"):
                groups.setdefault(accessory["exclusive"], []).append(accessory)
        self.assertTrue(groups, "no upgrade chains are marked exclusive")
        for name, members in groups.items():
            ranks = [member["tier"] for member in members]
            self.assertEqual(
                len(ranks), len(set(ranks)), f"the {name} chain has a tier tie"
            )

        # Anything that multiplies move speed has to be in a chain, or several
        # of them multiply together into something unplayable.
        for accessory in entries:
            if accessory["effects"].get("moveSpeedMultiplier", 1) > 1:
                self.assertTrue(
                    accessory.get("exclusive"),
                    f"{accessory['id']} stacks move speed without an upgrade chain",
                )

    def test_every_biome_has_a_horde_that_scales(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        data_dir = static_dir / "data" / "terra"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"

        rounds = json.loads((data_dir / "rounds.json").read_text("utf-8"))
        biomes = json.loads((data_dir / "biomes.json").read_text("utf-8"))["biomes"]
        frames = json.loads((sprites_dir / "frames.json").read_text("utf-8"))
        mobs = rounds["mobs"]

        behaviours = {"slime-hops", "walker", "flyer", "caster"}
        for mob in mobs:
            self.assertIn(
                mob["behavior"], behaviours, f"{mob['id']} has no known behaviour"
            )
            self.assertIn(
                mob["skin"]["id"], frames, f"{mob['id']} has no sprite strip"
            )
            if mob["behavior"] == "caster":
                # A caster that cannot shoot just hovers at standoff range
                # doing nothing at all.
                self.assertIn("shoot", mob, f"caster {mob['id']} has no attack")

        # Six creatures is the point where a biome stops showing you the same
        # two every visit.
        for biome in biomes:
            here = [m for m in mobs if biome["id"] in m.get("biomes", [])]
            self.assertGreaterEqual(
                len(here), 5, f"{biome['id']} has too few residents"
            )
            self.assertLessEqual(
                min(m["minRound"] for m in here),
                6,
                f"{biome['id']} has nothing to fight in the early rounds",
            )

        # Later arrivals have to be worth more than the ones they join, or the
        # horde stops escalating however deep the run goes.
        early = [m for m in mobs if m["minRound"] <= 4]
        late = [m for m in mobs if m["minRound"] >= 11]
        self.assertTrue(early and late)
        self.assertGreater(
            min(m["hp"] for m in late),
            min(m["hp"] for m in early),
            "the toughest late creature is no tougher than the weakest early one",
        )
        self.assertGreater(
            max(m["contactDamage"] for m in late),
            max(m["contactDamage"] for m in early),
        )

    def test_bosses_are_fought_where_they_live(self):
        import json

        data_dir = (
            Path(__file__).resolve().parent / "static" / "games" / "data" / "terra"
        )
        bosses = json.loads((data_dir / "bosses.json").read_text("utf-8"))["bosses"]
        known = {
            biome["id"]
            for biome in json.loads((data_dir / "biomes.json").read_text("utf-8"))[
                "biomes"
            ]
        }
        for boss in bosses:
            # The arena moves to one of these when the boss appears, so an
            # empty or bogus list would strand it in a random biome.
            self.assertTrue(
                boss.get("biomes"), f"{boss['id']} has no home biome"
            )
            unknown = set(boss["biomes"]) - known
            self.assertFalse(unknown, f"{boss['id']} names unknown biomes: {unknown}")

    def test_elites_are_rare_dangerous_and_worth_it(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        rounds = json.loads(
            (static_dir / "data" / "terra" / "rounds.json").read_text("utf-8")
        )
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        elites = rounds["elites"]

        # Rare enough to be an event. If most of a wave is elite they are just
        # the wave, and the round is a difficulty spike with no shape to it.
        chance_at_30 = min(
            elites["chanceMax"],
            elites["chanceBase"] + elites["chancePerRound"] * 30,
        )
        self.assertLess(chance_at_30, 0.35, "elites stop being rare deep in a run")
        self.assertGreater(elites["chanceBase"], 0, "elites can never appear")

        for affix in elites["affixes"]:
            self.assertTrue(affix.get("id") and affix.get("name"))
            self.assertGreater(affix.get("weight", 0), 0, f"{affix['id']} never rolls")
            self.assertTrue(affix.get("aura"), f"{affix['id']} has no colour to read it by")
            # Tougher in some way, and always worth more for it.
            harder = (
                affix.get("hp", 1) > 1
                or affix.get("contactDamage", 1) > 1
                or affix.get("speed", 1) > 1
            )
            self.assertTrue(harder, f"{affix['id']} is not actually an upgrade")
            self.assertGreater(
                affix.get("coins", 1), 1, f"{affix['id']} is harder for no extra reward"
            )

        # Bosses are the spike already; an elite boss is not a thing.
        self.assertIn(
            "mob.isBoss",
            engine.split("makeElite(mob, pick) {", 1)[1][:600],
            "nothing stops a boss rolling an elite affix",
        )

    def test_menus_are_reachable_by_keyboard_and_readable(self):
        import re

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        css = (static_dir / "terra_boss.css").read_text(encoding="utf-8")

        # Escape backs out of anything opened off the menu. Only the in-run
        # gear panel had a handler before, and that one lives on the Phaser
        # keyboard, which needs the canvas focused.
        self.assertIn("DISMISSABLE", engine, "no set of screens Escape can close")
        for screen in ["tb-characters", "tb-unlocks", "tb-bestiary", "tb-weaponry", "tb-feats"]:
            self.assertIn(screen, engine.split("DISMISSABLE", 1)[1][:300],
                          f"{screen} cannot be closed with Escape")
        self.assertIn('event.key !== "Escape"', engine)

        # Opening a screen puts the keyboard inside it, rather than leaving
        # focus on the body so that tabbing restarts from the page top.
        show = engine.split("function showScreen(id) {", 1)[1][:1200]
        self.assertIn("first.focus(", show, "focus never moves into an opened screen")

        # An empty equipment slot is still a button in the tree.
        slot = engine.split("box.disabled = !item;", 1)[1][:500]
        self.assertIn("aria-label", slot, "empty slots announce as an unnamed button")

        def luminance(hex_colour):
            channels = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            adjusted = [
                c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
                for c in channels
            ]
            return 0.2126 * adjusted[0] + 0.7152 * adjusted[1] + 0.0722 * adjusted[2]

        def contrast(a, b):
            high, low = sorted((luminance(a), luminance(b)), reverse=True)
            return (high + 0.05) / (low + 0.05)

        tokens = dict(re.findall(r"(--tb-[\w-]+):\s*(#[0-9a-fA-F]{6})", css))

        # The muted greys carry footnotes at 8px, and they land on several
        # surfaces -- including the lighter top stop of the panel gradient and
        # the raised top of a button, which is where the previous value failed
        # at 4.22 while clearing the flat panel behind it.
        surfaces = ["--tb-panel-raised", "--tb-panel", "--tb-panel-face",
                    "--tb-panel-sunk", "--tb-panel-lit"]
        for name in ["--tb-faint", "--tb-muted", "--tb-text"]:
            for surface in surfaces:
                ratio = contrast(tokens[name], tokens[surface])
                self.assertGreaterEqual(
                    ratio, 4.5,
                    f"{name} on {surface} is {ratio:.2f}, under AA for small text",
                )

        # 24px is the smallest a pointer target should be; the hub link was 23.
        back = css.split(".tb-back {", 1)[1].split("}", 1)[0]
        self.assertIn("min-height: 24px", back)

    def test_hardmode_turns_the_world_over_once(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        rounds = json.loads((terra / "rounds.json").read_text("utf-8"))
        bosses = json.loads((terra / "bosses.json").read_text("utf-8"))["bosses"]
        biomes = json.loads((terra / "biomes.json").read_text("utf-8"))["biomes"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        config = rounds.get("hardmode")
        self.assertTrue(config, "there is no hardmode")

        # It has to be triggered by a boss that exists, or it never fires.
        trigger = config["triggerBoss"]
        self.assertIn(trigger, {b["id"] for b in bosses},
                      f"hardmode waits on '{trigger}', which is not a boss")

        # A step, not a second compounding term. Enemy health already
        # compounds with the round; multiplying that again would make hardmode
        # a wall rather than a threshold.
        self.assertGreater(config["enemyHp"], 1)
        self.assertLess(config["enemyHp"], 2,
                        "hardmode more than doubles enemy health in one round")
        self.assertGreater(config["enemyDamage"], 1)
        self.assertLess(config["enemyDamage"], 2)
        # And it has to pay for itself, or the run just gets poorer.
        self.assertGreaterEqual(config["coins"], config["enemyHp"] * 0.9)

        # The Hallow does not exist before the world turns, which is the whole
        # reason it is gated.
        hallow = next((b for b in biomes if b["id"] == "hallow"), None)
        self.assertTrue(hallow, "no hallow biome")
        self.assertTrue(hallow.get("hardmode"),
                        "the Hallow is in the rotation before hardmode")

        # Fires once, off the right boss, and only forwards.
        check = engine.split("checkHardmode(boss) {", 1)[1][:500]
        self.assertIn("this.hardmode ||", check, "hardmode can trigger twice")
        self.assertIn("config.triggerBoss", check)
        self.assertIn("this.hardmode = true", check)

        # Gates the things it is supposed to gate.
        self.assertIn("biome.hardmode && !this.hardmode", engine,
                      "biomes are not gated behind hardmode")
        self.assertIn("!mob.hardmode || this.hardmode", engine,
                      "enemies cannot be gated behind hardmode")
        self.assertIn("tierBonus", engine, "hardmode does not open the shop")

        # A new run starts before the world turned, and the chip is a DOM
        # element that outlives the scene.
        self.assertIn("updateHudHardmode(false)", engine,
                      "the hardmode chip is never cleared between runs")

    def test_buying_something_shows_up_without_reopening_the_panel(self):
        static_dir = Path(__file__).resolve().parent / "static" / "games"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        # A purchase used to change the data and the HUD but never repaint the
        # gear and inventory panels, so gear you had just bought sat in a slot
        # that still read "empty" until you closed and reopened the screen.
        # Every mutation has to repaint, not just the ones a call site
        # remembered to follow up.
        self.assertIn("refreshGear() {", engine, "there is no gear repaint helper")

        def body_of(signature):
            """Just this method, to its closing brace.

            A fixed character window is no good here: 900 characters after the
            signature runs into the methods below, which have their own
            refreshGear calls, so the assertion passed even with the one under
            test deleted. Cut at the brace that closes the method instead.
            """
            start = engine.index(signature) + len(signature)
            depth = 1
            for offset, char in enumerate(engine[start:]):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return engine[start:start + offset]
            raise AssertionError(f"{signature} is never closed")

        # Split on the definition, not the name: the first occurrence of
        # "acquireWeapon(" in the file is a call site in the shop.
        for signature, marker in [
            ("acquireWeapon(weapon) {", "this.weaponSlots[free] = weapon;"),
            ("stashItem(kind, item) {", "this.stash.push("),
            ("equipArmorPiece(piece) {", "this.armor[piece.slot] = piece;"),
            ("equipAccessory(accessory) {", "this.accessories.push(accessory);"),
            ("loadAmmo(entry) {", "this.ammo[family] = entry;"),
        ]:
            method = signature.split("(")[0]
            self.assertIn(signature, engine, f"{method} no longer has that signature")
            body = body_of(signature)
            self.assertIn(marker, body, f"{method} does not look like itself any more")
            self.assertIn(
                "this.refreshGear()", body,
                f"{method} changes what the gear panel shows but never repaints it",
            )

        # And the repaint has to be cheap to call from anywhere, so it checks
        # whether a panel is actually up rather than every caller doing so.
        helper = engine.split("refreshGear() {", 1)[1][:200]
        self.assertIn("gearScene", helper)

    def test_tree_trunks_are_continuous_and_sit_under_their_canopy(self):
        import json

        try:
            from PIL import Image
        except ImportError:  # pragma: no cover - Pillow is a build-time dep
            self.skipTest("Pillow not installed")

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        decor_dir = static_dir / "assets" / "terra" / "sprites" / "decor"
        manifest = json.loads(
            (static_dir / "assets" / "terra" / "sprites" / "decor.json").read_text("utf-8")
        )

        trees = sorted(p for p in decor_dir.glob("*-tree.png") if ".orig" not in p.name)
        self.assertTrue(trees, "no tree sprites found")

        for path in trees:
            with Image.open(path) as img:
                img = img.convert("RGBA")
                px = img.load()
                width, height = img.size

                rows = []
                for y in range(height):
                    cols = [x for x in range(width) if px[x, y][3] > 0]
                    rows.append(cols)

                filled = [y for y, cols in enumerate(rows) if cols]
                self.assertTrue(filled, f"{path.name} is empty")

                # The trunk was built by stacking a 16px tile whose bark was
                # only 14px tall, which left a transparent seam every segment
                # and made the tree read as a pile of logs. Nothing between the
                # top and bottom of the sprite may be empty.
                for y in range(filled[0], filled[-1] + 1):
                    self.assertTrue(
                        rows[y],
                        f"{path.name} has a transparent gap at row {y}: the trunk "
                        f"is in pieces",
                    )

                # And the trunk has to hang under the canopy's weight rather
                # than under the middle of the image.
                bottom = rows[filled[-1]]
                trunk_mid = (min(bottom) + max(bottom)) / 2
                total = acc = 0
                for y in range(int(height * 0.5)):
                    for x in rows[y]:
                        a = px[x, y][3]
                        total += a
                        acc += a * x
                self.assertTrue(total, f"{path.name} has no canopy")
                canopy_mid = acc / total
                # The rebuilt trunks sit within 0.9px; the old ones were out by
                # up to 2.5px, so this threshold separates the two.
                self.assertLess(
                    abs(trunk_mid - canopy_mid), 1.5,
                    f"{path.name} trunk sits {trunk_mid - canopy_mid:+.1f}px off its canopy",
                )

                key = path.stem
                if key in manifest:
                    self.assertEqual(
                        (manifest[key]["frameWidth"], manifest[key]["frameHeight"]),
                        (width, height),
                        f"{key} manifest size does not match the sprite",
                    )

    def test_debuffs_do_something_and_cannot_run_away_with_the_fight(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        config = json.loads((terra / "debuffs.json").read_text("utf-8"))
        rounds = json.loads((terra / "rounds.json").read_text("utf-8"))
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        debuffs = config["debuffs"]

        self.assertGreater(config["tickMs"], 0)

        # Everything the engine can actually read off a debuff.
        known = {
            "id", "name", "description", "seconds", "tint", "particle",
            "damagePerSecond", "damageTakenMultiplier", "speedMultiplier",
            "reverseMovement",
        }
        seen = set()
        for entry in debuffs:
            name = entry["id"]
            self.assertNotIn(name, seen, f"{name} is listed twice")
            seen.add(name)
            unknown = set(entry) - known
            self.assertFalse(unknown, f"{name} has fields nothing reads: {unknown}")
            self.assertTrue(entry.get("name") and entry.get("description"))
            self.assertRegex(entry.get("tint", ""), r"^#[0-9a-f]{6}$")

            # Short: a round is under a minute, and a debuff that outlives the
            # fight is just damage on a tooltip.
            self.assertGreaterEqual(entry["seconds"], 2)
            self.assertLessEqual(entry["seconds"], 10, f"{name} outlasts the round")

            does_something = (
                entry.get("damagePerSecond")
                or entry.get("damageTakenMultiplier")
                or entry.get("speedMultiplier")
                or entry.get("reverseMovement")
            )
            self.assertTrue(does_something, f"{name} is a tint and nothing else")

        # Damage over time must stay a garnish. The strongest one, over its
        # whole duration, should not outdo a weapon of the round it appears in.
        worst = max(
            (d.get("damagePerSecond", 0) * d["seconds"] for d in debuffs), default=0
        )
        mob_hp = sum(m["hp"] for m in rounds["mobs"]) / len(rounds["mobs"])
        self.assertLess(
            worst, mob_hp * 4,
            "a single application kills most things by itself, so aiming stops mattering",
        )

        for entry in debuffs:
            amp = entry.get("damageTakenMultiplier", 1)
            self.assertLess(amp, 1.5, f"{entry['id']} amplifies too hard to stack with anything")
            slow = entry.get("speedMultiplier", 1)
            self.assertGreater(slow, 0.3, f"{entry['id']} is a stun, not a slow")

        # Refresh, not stack: a weapon reapplying every shot would otherwise
        # pile up copies of its own damage over time inside a second.
        apply = engine.split("applyDebuff(mob, id) {", 1)[1][:900]
        self.assertIn("existing.endsAt", apply, "debuffs stack instead of refreshing")

        # And the tick must not amplify itself, or Ichor plus a burn compounds
        # every half second into something no weapon can match.
        self.assertIn("fromDebuff: true", engine)
        self.assertIn("if (!options.fromDebuff)", engine)

    def test_enemies_keep_up_with_a_player_whose_power_compounds(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        rounds = json.loads((terra / "rounds.json").read_text("utf-8"))
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        scaling = rounds["scaling"]

        # Bosses took no round scaling at all for a long time while a comment
        # above them claimed they did, so a round-55 Moon Lord had the same
        # health as a round-5 one. Both stats have to move with the round.
        spawn = engine.split("spawnBoss(bossData) {", 1)[1][:1400]
        self.assertIn("this.roundScale(bossData.hp", spawn,
                      "boss health does not scale with the round")
        self.assertIn("this.roundScale(bossData.contactDamage", spawn,
                      "boss damage does not scale with the round")

        # Horde health compounds, because everything the player gains
        # multiplies: tier, reforges, ammo and potions.
        growth = scaling.get("hpGrowthPerRound")
        self.assertTrue(growth, "horde health has no compounding term")
        self.assertGreater(growth, 1.0)
        self.assertLess(growth, 1.12, "compounding this fast outruns any build")
        self.assertIn("roundScaleHp", engine)

        # It must not make the early game harder than it already is: the
        # compounding curve has to start below the linear one and cross later.
        linear = lambda r: 1 + scaling["hpMultiplierPerRound"] * (r - 1)
        compound = lambda r: growth ** (r - 1)
        self.assertLess(compound(5), linear(5), "round 5 got harder")
        self.assertLess(compound(15), linear(15), "round 15 got harder")
        crossover = next(r for r in range(1, 200) if compound(r) > linear(r))
        self.assertGreater(crossover, 20, "the ramp steepens before the midgame")
        self.assertLess(crossover, 45, "the ramp never steepens inside a run")

        # Damage and coins stay linear on purpose.
        self.assertNotIn("damageGrowthPerRound", scaling)
        self.assertNotIn("coinGrowthPerRound", scaling)

    def test_the_shop_unlocks_across_the_run_not_all_at_once(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        rounds = json.loads((terra / "rounds.json").read_text("utf-8"))
        weapons = json.loads((terra / "weapons.json").read_text("utf-8"))["weapons"]
        bosses = json.loads((terra / "bosses.json").read_text("utf-8"))["bosses"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        shop = rounds["shop"]
        per_rounds = shop["tierPerRounds"]
        offset = shop.get("tierRoundOffset", 0)
        top_tier = max(w["tier"] for w in weapons)

        def tier_at(rnd):
            return 1 + (rnd + offset) // per_rounds

        # One boss cycle is the shape of a run, so pace the roster against it.
        cycle = len(bosses) * rounds["bossEveryNRounds"]
        opens_fully = next(r for r in range(1, cycle * 2) if tier_at(r) >= top_tier)
        self.assertGreater(
            opens_fully, cycle * 0.35,
            "the whole roster is purchasable in the first third of a boss cycle, "
            "so every shop after that is a reroll of things you can already buy",
        )
        self.assertLess(
            opens_fully, cycle,
            "the last weapons unlock after a full boss cycle, so most of a run "
            "never sees them",
        )

        # But the opening rounds still need something to choose between.
        early = len([w for w in weapons if w["tier"] <= tier_at(3)])
        self.assertGreaterEqual(
            early, 10,
            f"only {early} weapons are buyable by round 3, so the shop repeats itself",
        )

        # The engine has to read the offset, or the data says one thing and the
        # game does another.
        self.assertIn("tierRoundOffset", engine)

    def test_boss_treasure_bags_are_a_real_choice(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        bosses = json.loads((terra / "bosses.json").read_text("utf-8"))["bosses"]
        rounds = json.loads((terra / "rounds.json").read_text("utf-8"))
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        tiers, names = {}, {}
        for filename, key in [
            ("weapons.json", "weapons"),
            ("accessories.json", "accessories"),
            ("ammo.json", "ammo"),
        ]:
            for item in json.loads((terra / filename).read_text("utf-8"))[key]:
                tiers[(key, item["id"])] = item.get("tier", 1)
                names[(key, item["id"])] = item["name"]
        kind_to_key = {"weapon": "weapons", "accessory": "accessories", "ammo": "ammo"}

        every = rounds["bossEveryNRounds"]
        per_rounds = rounds["shop"].get("tierPerRounds", 3)
        tier_offset = rounds["shop"].get("tierRoundOffset", 0)

        for index, boss in enumerate(bosses):
            drops = boss.get("drops")
            self.assertTrue(drops, f"{boss['id']} drops nothing but coins")
            # Three are dealt face up, so a smaller pool means the same three
            # every time and the choice stops being one.
            self.assertGreaterEqual(len(drops), 4, f"{boss['id']} has too shallow a pool")

            pool_tiers = []
            for drop in drops:
                self.assertIn(drop["kind"], kind_to_key, f"{boss['id']} drops an unknown kind")
                ref = (kind_to_key[drop["kind"]], drop["id"])
                self.assertIn(ref, tiers, f"{boss['id']} drops {drop['id']}, which does not exist")
                pool_tiers.append(tiers[ref])

            # A bag must beat the shelf, but not by so much that the shop stops
            # mattering. The shop's own gate is the yardstick.
            appears_on = (index + 1) * every
            shop_tier = 1 + (appears_on + tier_offset) // per_rounds
            self.assertLessEqual(
                max(pool_tiers), shop_tier + 1,
                f"{boss['id']} hands out gear the shop will not sell for a long while",
            )

            # And no card may be so far below the others that nobody would ever
            # take it -- that turns a choice of three into a choice of two.
            self.assertLessEqual(
                max(pool_tiers) - min(pool_tiers), 2,
                f"{boss['id']} has a card no one would pick over the rest",
            )

        # A boss round ends about a second after the kill, which is not enough
        # time to walk to the bag. The reward must survive that.
        self.assertIn("this.pendingBag = source", engine)
        # Cut at the brace that closes the method, not at a character count.
        # A fixed 1600-character window broke the moment the method grew: the
        # between-round mend was added above this and pushed the bag check out
        # of range, failing a test about treasure bags for reasons that had
        # nothing to do with them.
        start = engine.index("onRoundCleared() {") + len("onRoundCleared() {")
        depth = 1
        for offset, char in enumerate(engine[start:]):
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    break
        cleared = engine[start:start + offset]
        self.assertIn("this.pendingBag", cleared,
                      "the shop opens without checking for an uncollected bag")
        self.assertIn("openShop(this)", cleared)

    def test_ammunition_changes_the_shot_and_stays_affordable(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        config = json.loads((terra / "ammo.json").read_text("utf-8"))
        weapons = json.loads((terra / "weapons.json").read_text("utf-8"))
        sprites = json.loads(
            (static_dir / "assets" / "terra" / "sprites" / "items.json").read_text("utf-8")
        )
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        ammo = config["ammo"]

        families = set(config["families"])
        self.assertTrue(families <= set(weapons["categories"]),
                        "ammo is sold for a weapon category that does not exist")

        # Effects the engine actually puts on a projectile. Anything else is an
        # item that costs coins and does nothing.
        known = {
            "pierce", "splashRadius", "homing", "bounce", "noGravity",
            "projectileSpeed", "damage", "crit", "debuff",
        }
        for key in known:
            self.assertIn(key, engine, f"the engine never reads the '{key}' effect")

        cheapest = {}
        seen = set()
        for entry in ammo:
            name = entry["id"]
            self.assertNotIn(name, seen, f"{name} is listed twice")
            seen.add(name)
            self.assertIn(entry["family"], families, f"{name} has no weapon to load into")
            self.assertIn(name, sprites, f"{name} has no sprite")
            self.assertGreater(entry["price"], 0)
            self.assertRegex(entry.get("tint", ""), r"^#[0-9a-f]{6}$")

            unknown = set(entry["effects"]) - known
            self.assertFalse(unknown, f"{name} has unreadable effects: {unknown}")

            tier = entry.get("tier", 1)
            best = cheapest.get(entry["family"])
            if best is None or (tier, entry["price"]) < best:
                cheapest[entry["family"]] = (tier, entry["price"])

        # A debuff has to name a real one, or the ammo promises an effect that
        # never happens.
        debuffs = json.loads((terra / "debuffs.json").read_text("utf-8"))["debuffs"]
        debuff_ids = {d["id"] for d in debuffs}
        for entry in ammo:
            wanted = entry["effects"].get("debuff")
            if wanted:
                self.assertIn(wanted, debuff_ids,
                              f"{entry['id']} inflicts '{wanted}', which does not exist")

        # splashRadius is read two ways: a launcher already has a blast so its
        # ammo scales it, while a bow has none so its ammo grants one outright.
        # The engine tells them apart by magnitude, so the data has to keep the
        # two ranges apart or a 1.5x rocket becomes a 1.5px one -- or worse, a
        # 60px bow value becomes a 60x multiplier.
        for entry in ammo:
            splash = entry["effects"].get("splashRadius")
            if splash is None:
                continue
            if entry["family"] == "launcher":
                self.assertLess(splash, 4, f"{entry['id']} reads as a radius, not a multiplier")
            else:
                self.assertGreater(splash, 4, f"{entry['id']} reads as a multiplier, not a radius")

        # Every family needs a cheap starter, or a run that finds the wrong
        # weapon early has no ammo it can afford.
        for family in families:
            self.assertIn(family, cheapest, f"nothing to load into a {family}")
            tier, price = cheapest[family]
            self.assertLessEqual(tier, 2, f"{family} has no early-game ammo")
            self.assertLessEqual(price, 20, f"the cheapest {family} ammo costs {price}")

        # One loaded type per family, and swapping must not destroy the old one.
        load = engine.split("loadAmmo(entry) {", 1)[1][:600]
        self.assertIn('this.stashItem("ammo", previous)', load,
                      "swapping ammo throws the old box away")

        # A ricochet has to bounce off the arena walls as well as the floor, or
        # it is a floor-only trick that leaves the screen and dies.
        self.assertIn("onWorldBounds = true", engine)
        self.assertIn('this.physics.world.on("worldbounds"', engine)

    def test_every_boss_changes_how_it_fights_as_it_loses(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        bosses = json.loads(
            (static_dir / "data" / "terra" / "bosses.json").read_text("utf-8")
        )["bosses"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        # The patterns the engine actually has a branch for. A phase that names
        # anything else would silently fall through to the charger fallback.
        patterns = {
            "worm", "shooter", "teleporter", "spinner", "stomper", "wall",
            "kingslime", "charger",
        }

        for boss in bosses:
            phases = boss.get("phases")
            self.assertTrue(phases, f"{boss['id']} fights the same way at 1 hp as at full")

            previous = 1.0
            for phase in phases:
                where = f"{boss['id']} phase {phase.get('name')!r}"
                self.assertTrue(phase.get("name") and phase.get("say"), f"{where} is unnamed")

                at = phase["atHp"]
                self.assertGreater(at, 0, f"{where} triggers below death")
                self.assertLess(at, 1, f"{where} triggers before the fight starts")
                self.assertLess(at, previous, f"{where} is out of order")
                previous = at

                # A phase has to change something, or it is a banner and
                # nothing else.
                changes = phase.get("config") or phase.get("shoot") or phase.get("pattern")
                self.assertTrue(changes, f"{where} announces a change it does not make")

                if phase.get("pattern"):
                    self.assertIn(phase["pattern"], patterns, f"{where} names an unknown pattern")

                # Every key it overrides must be one the engine reads, or the
                # override is a typo that quietly does nothing.
                for key in (phase.get("config") or {}):
                    self.assertIn(key, engine, f"{where} sets '{key}', which nothing reads")

        # Phases only ever advance, so a healed or looping boss cannot replay
        # its opening.
        tick = engine.split("tickBossPhase(boss) {", 1)[1][:700]
        self.assertIn("boss.stageIndex >= stages.length - 1", tick)
        self.assertIn("boss.stageIndex += 1", tick)

        # The override merges over the pattern config; replacing it outright
        # would drop every key the phase did not mention.
        enter = engine.split("enterBossPhase(boss, stage) {", 1)[1][:2600]
        self.assertIn("Object.assign(boss.patternConfig", enter)

        # Switching pattern mid-fight has to re-run that pattern's setup, or
        # the new branch starts on state it does not understand.
        self.assertIn("this.initBossPattern(boss)", enter)

    def test_potions_are_a_timed_layer_over_permanent_gear(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        config = json.loads((terra / "potions.json").read_text("utf-8"))
        sprites = json.loads(
            (static_dir / "assets" / "terra" / "sprites" / "items.json").read_text("utf-8")
        )
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        potions = config["potions"]

        self.assertGreaterEqual(len(potions), 10, "too thin a shelf to choose from")
        self.assertGreaterEqual(config["beltSlots"], 3)

        seen = set()
        for potion in potions:
            name = potion["id"]
            self.assertNotIn(name, seen, f"{name} is listed twice")
            seen.add(name)
            self.assertTrue(potion.get("name") and potion.get("description"))
            self.assertTrue(potion.get("effects"), f"{name} does nothing")
            self.assertRegex(potion.get("tint", ""), r"^#[0-9a-f]{6}$")

            # Long enough to matter, short enough that you cannot live on it.
            self.assertGreaterEqual(potion["seconds"], 20, f"{name} lapses too fast")
            self.assertLessEqual(potion["seconds"], 120, f"{name} is effectively permanent")
            self.assertGreater(potion["price"], 0)

            self.assertIn(potion["id"] + "-potion", sprites, f"{name} has no sprite")

        # Every effect has to be one the engine actually reads, or it is a
        # potion that costs coins and does nothing.
        known = {
            "defense", "regenPerSecond", "moveSpeed", "damageTaken", "damage",
            "bowDamage", "magicDamage", "crit", "projectileSpeed", "manaRegen",
            "thorns", "maxHpBonus", "fallSpeed", "pickupRange", "coins",
        }
        for potion in potions:
            unknown = set(potion["effects"]) - known
            self.assertFalse(unknown, f"{potion['id']} has unreadable effects: {unknown}")
        for key in known:
            self.assertIn(key, engine, f"the engine never reads the '{key}' effect")

        # Drinking the same potion twice must refresh, not stack, or hoarding
        # five Ironskins would buy a permanent +30 defense.
        drink = engine.split("drinkPotion(potion) {", 1)[1][:1400]
        self.assertIn("existing.endsAt", drink, "potions stack instead of refreshing")

        # A lapsing Lifeforce must not take a Life Crystal's heart with it.
        self.assertIn("this.maxHp = this.baseMaxHp + bonus", engine)
        consume = engine.split("consume(item) {", 1)[1][:700]
        self.assertIn("this.baseMaxHp += gained", consume,
                      "crystals raise the buffed ceiling instead of the permanent one")

    def test_round_events_are_playable_and_pay_for_themselves(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        terra = static_dir / "data" / "terra"
        config = json.loads((terra / "events.json").read_text("utf-8"))
        mobs = json.loads((terra / "rounds.json").read_text("utf-8"))["mobs"]
        biomes = json.loads((terra / "biomes.json").read_text("utf-8"))["biomes"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        # Occasional, not the norm: an event every other round is just the game.
        self.assertGreater(config["chance"], 0, "events can never fire")
        self.assertLess(config["chance"], 0.35, "events stop being events")

        mob_ids = {mob["id"] for mob in mobs}
        biome_ids = {biome["id"] for biome in biomes}
        for event in config["events"]:
            name = event["id"]
            self.assertTrue(event.get("name") and event.get("description"))
            self.assertGreater(event.get("weight", 0), 0, f"{name} never rolls")

            unknown = set(event.get("only", [])) - mob_ids
            self.assertFalse(unknown, f"{name} summons mobs that do not exist: {unknown}")
            unknown = set(event.get("biomes", [])) - biome_ids
            self.assertFalse(unknown, f"{name} names unknown biomes: {unknown}")

            # An invasion that can only field one creature is a boring round.
            if event.get("only"):
                self.assertGreaterEqual(
                    len(event["only"]), 2, f"{name} has too small a cast"
                )
                # Its cast has to be reachable by the round it can first appear.
                earliest = min(
                    mob["minRound"] for mob in mobs if mob["id"] in set(event["only"])
                )
                self.assertLessEqual(
                    earliest,
                    max(event.get("minRound", 0), config["minRound"]),
                    f"{name} can fire before anything in it has unlocked",
                )

            # Every event is harder than a plain round in some direction, and
            # every event pays more for it. Otherwise it is a punishment.
            harder = (
                event.get("spawnMultiplier", 1) > 1
                or event.get("enemyHp", 1) > 1
                or event.get("enemyDamage", 1) > 1
                or event.get("enemySpeed", 1) > 1
                or event.get("eliteChance", 0) > 0
            )
            self.assertTrue(harder, f"{name} asks nothing of the player")
            self.assertGreater(event.get("coins", 1), 1, f"{name} pays no premium")

            shade = event.get("shade", "")
            self.assertRegex(shade, r"^#[0-9a-f]{6}$", f"{name} has no usable shade")

        # A boss round is the event. Two at once is a wall, not a fight.
        start = engine.split("startNextRound() {", 1)[1][:1200]
        self.assertIn("boss ? null : this.pickEvent()", start)

    def test_weapon_prefixes_cut_both_ways(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        modifiers = json.loads(
            (static_dir / "data" / "terra" / "modifiers.json").read_text("utf-8")
        )["modifiers"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        plain = [m for m in modifiers if not m["name"]]
        self.assertEqual(len(plain), 1, "there must be exactly one unprefixed roll")

        better, worse = [], []
        for modifier in modifiers:
            self.assertTrue(modifier.get("id"))
            self.assertGreater(modifier.get("weight", 0), 0, f"{modifier['id']} never rolls")
            self.assertGreater(modifier.get("price", 0), 0)
            if not modifier["name"]:
                continue
            # Judge a prefix by what it does, not by its price tag.
            gain = (
                (modifier.get("damage", 1) - 1)
                + (1 - modifier.get("fireRate", 1))
                + modifier.get("crit", 0) * 2
                + (modifier.get("projectileSpeed", 1) - 1) * 0.5
            )
            (better if gain > 0 else worse).append((modifier, gain))

        # Bad prefixes are the point of the system: they make a weapon cheap
        # enough to be a real choice. Without them every roll is an upgrade.
        self.assertTrue(worse, "no prefix ever makes a weapon worse")
        self.assertTrue(better, "no prefix ever makes a weapon better")
        for modifier, _ in better:
            self.assertGreater(
                modifier["price"], 1, f"{modifier['id']} is better and costs no more"
            )
        for modifier, _ in worse:
            self.assertLess(
                modifier["price"], 1, f"{modifier['id']} is worse and costs no less"
            )

        # And the engine has to actually apply each field a prefix can carry.
        for field in ("damage", "fireRate", "crit", "projectileSpeed", "price"):
            self.assertIn(
                f"modifier.{field}",
                engine,
                f"nothing applies a prefix's '{field}'",
            )

    def test_the_difficulty_ladder_climbs(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        levels = json.loads(
            (static_dir / "data" / "terra" / "difficulties.json").read_text("utf-8")
        )["difficulties"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        self.assertGreaterEqual(len(levels), 3, "a ladder needs rungs")
        self.assertNotIn(
            "unlockRound",
            levels[0],
            "the first difficulty must be playable from the start",
        )

        previous = None
        for level in levels:
            self.assertTrue(level.get("id") and level.get("name"))
            self.assertTrue(level.get("description"))
            if previous is not None:
                self.assertIn(
                    "unlockRound",
                    level,
                    f"{level['id']} can never be unlocked",
                )
                # Each rung has to be harder AND pay better, or there is no
                # reason to climb once everything is already bought.
                self.assertGreater(
                    level["enemyHp"], previous["enemyHp"], f"{level['id']} is no harder"
                )
                self.assertGreater(
                    level["soulReward"],
                    previous["soulReward"],
                    f"{level['id']} is harder for no extra reward",
                )
            previous = level

        # Modifiers only matter if the engine reads them.
        for field in ("enemyHp", "enemyDamage", "soulReward", "shopItems",
                      "startingCoinsMultiplier", "bossEvery"):
            self.assertIn(
                field, engine, f"nothing in the engine applies '{field}'"
            )

    def test_content_packs_can_reach_every_kind_of_content(self):
        import json
        import re

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        data_dir = static_dir / "data" / "terra"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        index = json.loads((data_dir / "packs" / "index.json").read_text("utf-8"))
        self.assertIn("packs", index)

        targets = set(re.findall(
            r"^\s{8}(\w+): \[", engine.split("const PACK_TARGETS = {", 1)[1]
            .split("\n    };", 1)[0], re.M))
        maps = set(re.findall(
            r"^\s{8}(\w+): \[", engine.split("const PACK_MAPS = {", 1)[1]
            .split("\n    };", 1)[0], re.M))
        keys = targets | maps

        # A pack is only as useful as the lists it can reach. Every list the
        # game is built from should be extendable without touching the engine.
        for expected in ("weapons", "mobs", "bosses", "characters", "accessories",
                         "armorSets", "biomes", "achievements", "consumables"):
            self.assertIn(expected, keys, f"packs cannot add {expected}")

        for entry in index["packs"]:
            self.assertTrue(entry.get("id"), "a listed pack has no id")
            if not entry.get("file"):
                continue
            path = data_dir / entry["file"]
            self.assertTrue(path.exists(), f"pack {entry['id']} points at a missing file")
            pack = json.loads(path.read_text("utf-8"))
            for key, entries in pack.items():
                if key not in keys or not isinstance(entries, list):
                    continue
                for item in entries:
                    # Entries are merged by id; one without an id is dropped.
                    self.assertIn(
                        "id", item, f"{entry['id']}/{key} has an entry with no id"
                    )
                    if key == "weapons":
                        self.assertTrue(
                            (static_dir / "assets" / "terra" / "sprites"
                             / item["sprite"]).exists(),
                            f"{item['id']} points at art that is not there",
                        )

    def test_a_pack_is_switched_by_the_player_over_the_index(self):
        engine = (
            Path(__file__).resolve().parent / "static" / "games" / "terra_boss.js"
        ).read_text(encoding="utf-8")

        def body_of(signature):
            """Just this function, to its closing brace."""
            start = engine.index(signature) + len(signature)
            depth = 1
            for offset, char in enumerate(engine[start:]):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return engine[start:start + offset]
            raise AssertionError(f"{signature} is never closed")

        # Applying a pack reads the player's choice out of the save, so the
        # save has to exist first. It did not: packs loaded above it, every
        # pack threw on a null save, and the whole thing was swallowed by the
        # catch around it -- no packs, no error, no clue.
        boot = body_of("async function boot() {")
        self.assertIn("save = loadSave()", boot, "boot never loads the save")
        self.assertLess(
            boot.index("save = loadSave()"),
            boot.index("loadContentPacks("),
            "packs are applied before the save they read exists",
        )

        # index.json carries a default per pack and the player can disagree
        # either way, so one list cannot express it: with only "disabled"
        # there is no way to turn on a pack the index ships switched off, and
        # its Turn on button silently does nothing.
        decide = body_of("function packEnabled(pack) {")
        for field in ("disabledPacks", "enabledPacks"):
            self.assertIn(
                field, decide, f"the player's '{field}' does not affect any pack"
            )
        self.assertIn(
            "pack.enabled !== false",
            decide,
            "a pack the player has never touched ignores the index default",
        )

        # And the decision has to be made in one place, or the screen and the
        # merge can disagree about which packs are on.
        apply_body = body_of("function applyContentPacks(packs) {")
        self.assertIn(
            "packEnabled(pack)", apply_body, "applying packs decides on its own"
        )
        self.assertNotIn(
            "pack.enabled === false",
            apply_body,
            "applying packs still reads the index default directly",
        )

    def test_boss_attacks_that_arc_split_and_armour(self):
        engine = (
            Path(__file__).resolve().parent / "static" / "games" / "terra_boss.js"
        ).read_text(encoding="utf-8")

        def body_of(signature):
            start = engine.index(signature) + len(signature)
            depth = 1
            for offset, char in enumerate(engine[start:]):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return engine[start:start + offset]
            raise AssertionError(f"{signature} is never closed")

        shots = body_of("fireEnemyShots(enemy) {")

        # Arcade adds a body's gravity to the world's, and this world pulls at
        # 1440. Setting the configured figure straight onto the body made a
        # lobbed shot fall at 1960 against a solver that assumed 520, so every
        # arc landed most of a screen short of the player.
        self.assertIn(
            "gravity - this.physics.world.gravity.y",
            shots,
            "a lobbed shot's gravity ignores the world's again, so it falls short",
        )

        # A ring has no endpoints. Spreading 16 shots across a 360-degree fan
        # puts the first and last on the same heading: 15 shots and a gap.
        self.assertIn("shot.ring", shots, "there is no ring option")
        self.assertIn(
            "(Math.PI * 2 * i) / count",
            shots,
            "a ring is spaced like a fan again, so it loses a shot to a duplicate",
        )

        # Damage reduction has to come from what this boss summoned, not from
        # whatever happens to be on screen, or a horde round armours a boss
        # that summoned nothing.
        armour = body_of("servantArmour(boss) {")
        self.assertIn(
            "mob.summonedBy === boss",
            armour,
            "servant armour counts every mob alive, not the boss's own",
        )
        self.assertIn("damageReductionCap", armour, "the reduction has no ceiling")
        self.assertIn(
            "this.servantArmour(mob)",
            body_of("damageMob(mob, amount, crit = false, options = {}) {"),
            "nothing applies servant armour to an incoming hit",
        )

        # Halves must be marked, or one slime dissolves into a cloud of specks.
        split = body_of("splitMob(mob) {")
        self.assertIn("mob.hasSplit", split, "a split creature can split forever")
        self.assertIn("half.hasSplit = true", split, "the halves are not marked")
        self.assertIn(
            "half.summonedBy = mob.summonedBy",
            split,
            "splitting launders a summon, so halves stop armouring their boss",
        )

    def test_the_arena_is_shaped_by_the_fight_in_it(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        def body_of(signature):
            start = engine.index(signature) + len(signature)
            depth = 1
            for offset, char in enumerate(engine[start:]):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return engine[start:start + offset]
            raise AssertionError(f"{signature} is never closed")

        # Ground-bound enemies climb by jumping when something blocks them, and
        # they only clear so much. Terrain that steps higher than that is a
        # wall a slime hops into forever.
        profile = body_of("groundProfile(baseTop, roughness) {")
        self.assertIn("STEP_LIMIT", profile, "nothing caps how tall a step can be")
        self.assertIn(
            "Math.abs(rise) > STEP_LIMIT",
            profile,
            "steps are never flattened, so the ground can strand what walks on it",
        )

        # Anything asking where the floor is needs the floor under that spot,
        # not one number for the whole arena.
        self.assertIn("groundAt(x) {", engine, "there is no way to sample the ground")
        for caller, what in (
            ("this.groundAt(x) - 60", "horde mobs"),
            ("this.groundAt(x) - 80", "a walking boss"),
            ("this.groundAt(x) + 1", "decor"),
        ):
            self.assertIn(caller, engine, f"{what} still assume a flat floor")

        # Scaffolding answers to what is being fought, not to the round number.
        platforms = body_of("buildOneWayPlatforms(biome, layout) {")
        self.assertIn(
            "plan.airborneShare < AIRBORNE_FOR_PLATFORMS",
            platforms,
            "platforms no longer depend on whether the fight leaves the floor",
        )

        # A boss as wide as the screen needs flat ground and a clear floor.
        ground = body_of("buildGround(biome, layout) {")
        self.assertIn("plan.bulk", ground, "ground shape ignores how big the fight is")
        self.assertIn("plan.crowd", ground, "headroom ignores how many are coming")

        # Every layout has to say how rough it is, or it silently gets the
        # default and a slam arena grows hills under the boss.
        biomes = json.loads(
            (static_dir / "data" / "terra" / "biomes.json").read_text("utf-8")
        )
        for layout in biomes.get("layouts", []):
            self.assertIn(
                "roughness",
                layout,
                f"layout '{layout['id']}' never says how uneven its ground is",
            )
            self.assertGreaterEqual(layout["roughness"], 0)

    def test_the_wall_of_flesh_is_a_chase_down_a_corridor(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        def body_of(signature):
            start = engine.index(signature) + len(signature)
            depth = 1
            for offset, char in enumerate(engine[start:]):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return engine[start:start + offset]
            raise AssertionError(f"{signature} is never closed")

        wall = next(
            boss for boss in json.loads(
                (static_dir / "data" / "terra" / "bosses.json").read_text("utf-8")
            )["bosses"] if boss["id"] == "wall-of-flesh"
        )
        config = wall["patternConfig"]
        self.assertTrue(config.get("corridor"), "the Wall of Flesh has no corridor")
        self.assertGreater(
            config.get("marchRamp", 0), 0,
            "the wall never speeds up, so a wounded wall is only a longer run",
        )
        self.assertEqual(
            wall.get("arena"), "corridor",
            "the wall is fought in an arena with scaffolding in it",
        )

        # The march is one-way. Bouncing it off the edges of a single screen
        # was a chase with nowhere to run: it turned round and came back.
        # The pattern name appears twice -- once where the boss is set up and
        # once where it moves. This wants the second.
        march = engine.split("// It only ever goes one way.", 1)[1].split("return;", 1)[0]
        self.assertNotIn(
            "marchDirection *= -1", march, "the wall turns round again",
        )
        self.assertIn("boss.hp / boss.maxHp", march, "the march ignores its health")

        # The world has to actually be longer than the window, and the camera
        # has to be allowed to move across it.
        ground = body_of("buildGround(biome, layout) {")
        for needed, why in (
            ("this.arenaWidth", "the arena has no width of its own"),
            ("physics.world.setBounds", "physics still ends at the window edge"),
            ("cameras.main.setBounds", "the camera cannot leave the first screen"),
        ):
            self.assertIn(needed, ground, why)
        self.assertIn(
            "startFollow(this.player", engine, "the camera never follows anyone",
        )

        # Screen furniture must not slide off with the scenery.
        for pinned in ("this.banner", "this.bossBar"):
            index = engine.index(pinned)
            # Wide enough to clear the text style block between the two.
            self.assertIn(
                "setScrollFactor(0)",
                engine[index:index + 900],
                f"{pinned} scrolls away with the corridor",
            )

        # You cannot get behind it, and being caught costs you.
        squeeze = body_of("tickCorridorSqueeze(boss) {")
        self.assertIn("this.hurtPlayer", squeeze, "being caught by the wall is free")
        self.assertIn("this.player.x = edge", squeeze, "the wall does not shove")

    def test_the_vendor_screen_describes_and_sells_by_hand(self):
        import json
        import re as regex

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        markup = (
            static_dir.parent.parent / "templates" / "games" / "terra_boss.html"
        ).read_text(encoding="utf-8")

        # Leaving the round lived inside the shop card, below a list that grows
        # with the offers, so on a full shelf it scrolled out of reach.
        bar = markup.split('class="tb-between-bar"', 1)
        self.assertEqual(len(bar), 2, "the between-rounds bar is gone")
        bar_html = bar[1].split("</div>", 1)[0]
        for control in ("tb-shop-continue", "tb-shop-reroll"):
            self.assertIn(
                control, bar_html, f"{control} is back inside the scrolling card",
            )
        self.assertIn('id="tb-tip"', markup, "there is no hover panel to fill")

        # Weapons keep their prose under `notes`; reading only `description`
        # left every weapon's tooltip with no text at all.
        self.assertIn(
            "item.description || item.notes",
            engine,
            "weapon tooltips read a field weapons do not have",
        )

        # Effect keys are shown to the player, so they need real labels rather
        # than raw camelCase. Every key the data actually uses must have one.
        labels = engine.split("const EFFECT_LABELS = {", 1)[1].split("};", 1)[0]
        named = set(regex.findall(r"(\w+):", labels))
        used = set()
        for name in ("accessories", "ammo", "potions", "armor"):
            path = static_dir / "data" / "terra" / f"{name}.json"
            if not path.is_file():
                continue

            def walk(node):
                if isinstance(node, dict):
                    for key, value in node.items():
                        if key == "effects" and isinstance(value, dict):
                            used.update(value.keys())
                        else:
                            walk(value)
                elif isinstance(node, list):
                    for entry in node:
                        walk(entry)

            walk(json.loads(path.read_text(encoding="utf-8")))
        self.assertTrue(used, "no effects found to check labels against")
        self.assertFalse(
            used - named,
            f"these effects would show as raw keys: {sorted(used - named)}",
        )

        # Dragging must not be the only way to buy: it is undiscoverable on its
        # own and useless to anyone on a keyboard.
        self.assertIn("beginDrag(event, offer", engine, "cards cannot be dragged")
        # Scoped to the shop's own renderer: the same call appears in the bag
        # and the sell list, so a bare search passes with this one deleted.
        shop_render = engine.split("function renderShop() {", 1)[1]
        self.assertIn(
            'buy.addEventListener("click"',
            shop_render.split("\n    }", 1)[0],
            "the shop's buy button is gone, leaving dragging as the only way",
        )
        # And a drag that ends anywhere else must not charge for anything.
        drop = engine.split("const drop = (upEvent)", 1)[1].split("};", 1)[0]
        self.assertIn("landed &&", drop, "a drag dropped on nothing still buys")

    def test_ground_decor_is_whole_objects_on_its_own_art(self):
        import hashlib
        import json

        import numpy as np
        from PIL import Image

        sprites = (
            Path(__file__).resolve().parent / "static" / "games"
            / "assets" / "terra" / "sprites"
        )
        decor = json.loads((sprites / "decor.json").read_text(encoding="utf-8"))

        def pieces(path):
            """The runs of opaque columns -- one per object in the strip."""
            alpha = np.array(Image.open(path).convert("RGBA"))[:, :, 3]
            filled = (alpha > 8).any(axis=0)
            spans, start = [], None
            for x, on in enumerate(filled):
                if on and start is None:
                    start = x
                elif not on and start is not None:
                    spans.append((start, x))
                    start = None
            if start is not None:
                spans.append((start, len(filled)))
            return spans

        # A clutter frame has to hold a whole pile. These were cut on
        # Terraria's 16px tile pitch, but a pile of rubble is a multi-tile
        # object, so each frame held a third of one and the floor was strewn
        # with fragments of bone.
        #
        # Clutter only. The plant sheets look like they have the same fault
        # and do not: their tufts abut, so what reads as one 78px object is
        # four plants in a row, and the tile pitch falls cleanly between them.
        for key, meta in decor.items():
            if "clutter" not in key:
                continue
            path = sprites / meta["file"]
            if not path.is_file():
                continue
            width = meta["frameWidth"]
            for start, end in pieces(path):
                self.assertLessEqual(
                    end - start,
                    width + 1,
                    f"{key}: a pile spans {end - start}px across "
                    f"{width}px frames, so a frame shows part of one",
                )

        # And two biomes must not decorate themselves out of the same file:
        # snow and the underworld shared one, so hell had snowdrift in it.
        digests = {}
        for key, meta in decor.items():
            path = sprites / meta["file"]
            if not path.is_file():
                continue
            digests.setdefault(
                hashlib.sha256(path.read_bytes()).hexdigest(), []
            ).append(key)
        shared = [names for names in digests.values() if len(names) > 1]
        self.assertFalse(
            shared, f"these decor sets are the same picture: {shared}",
        )

    def test_items_and_shots_are_sized_against_the_character(self):
        import json

        from PIL import Image

        root = Path(__file__).resolve().parent
        static_dir = root / "static" / "games"
        sprites = static_dir / "assets" / "terra" / "sprites"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        def ink(path):
            box = Image.open(path).convert("RGBA").getbbox()
            return max(box[2] - box[0], box[3] - box[1]) if box else 0

        items = json.loads((sprites / "items.json").read_text(encoding="utf-8"))
        base = json.loads(
            (static_dir / "data" / "terra" / "weapons.json").read_text("utf-8")
        )["weapons"]

        # The biggest vanilla weapon of each class is the ceiling: a pack's
        # weapon has to fit on the same shelf, not tower over it.
        caps = {}
        for weapon in base:
            key = weapon["sprite"].split("/")[-1][:-4]
            meta = items.get(key)
            if meta and (sprites / meta["file"]).is_file():
                caps[weapon["category"]] = max(
                    caps.get(weapon["category"], 0), ink(sprites / meta["file"])
                )

        pack_path = static_dir / "data" / "terra" / "packs" / "calamity.json"
        if pack_path.is_file():
            for weapon in json.loads(pack_path.read_text("utf-8"))["weapons"]:
                art = sprites / weapon["sprite"]
                if not art.is_file():
                    continue
                cap = caps.get(weapon["category"])
                if not cap:
                    continue
                self.assertLessEqual(
                    ink(art), cap + 1,
                    f"{weapon['id']} draws at {ink(art)}px against a {cap}px "
                    f"ceiling for a {weapon['category']}",
                )

        # An inventory icon is drawn to be read in a slot. Flying at full size
        # the wooden arrow was 32px tall against a 46px character, so shots
        # looked like thrown furniture. The old code multiplied by WORLD_SCALE
        # under a comment saying the world ran at 2x -- it runs at 1, so the
        # call did nothing whatsoever.
        self.assertIn(
            "PROJECTILE_ART_SCALE", engine, "shots draw at their icon size again",
        )
        scale = float(
            engine.split("const PROJECTILE_ART_SCALE = ", 1)[1].split(";", 1)[0]
        )
        self.assertLess(scale, 1.0, "the projectile scale no longer shrinks anything")
        spawn = engine.split("spawnShot(weapon, muzzle, angle, now, isYoyo) {", 1)[1]
        self.assertIn(
            "projectile.setScale(PROJECTILE_ART_SCALE)",
            spawn.split("\n        }", 1)[0],
            "spawnShot does not apply the projectile scale",
        )

    def test_only_journey_patches_you_up_between_rounds(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        levels = json.loads(
            (static_dir / "data" / "terra" / "difficulties.json").read_text("utf-8")
        )["difficulties"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        healing = {
            level["id"]: level.get("healBetweenRounds", 0) for level in levels
        }
        self.assertEqual(
            healing.get("journey"), 1,
            "Journey no longer mends you between rounds",
        )
        # Every rung above it has to stay unforgiving, or the ladder collapses
        # into one difficulty with different numbers on the enemies.
        for level in levels:
            if level["id"] == "journey":
                continue
            self.assertFalse(
                level.get("healBetweenRounds"),
                f"{level['id']} heals between rounds, so it is no harder "
                "than Journey where it counts",
            )

        # Driven by the difficulty's own field, not by its name, so another
        # rung can offer a partial mend without touching the engine.
        cleared = engine.split("onRoundCleared() {", 1)[1].split("\n        }", 1)[0]
        self.assertIn(
            "this.difficulty.healBetweenRounds",
            cleared,
            "the between-round mend is not read off the difficulty",
        )
        self.assertNotIn(
            '"journey"', cleared, "the mend is hardcoded to a difficulty name",
        )
        # Capped, so a value above 1 cannot heal past maximum.
        self.assertIn("Math.min(this.maxHp", cleared, "the mend is not capped")

    def test_a_boss_round_pays_for_itself(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        rounds = json.loads(
            (static_dir / "data" / "terra" / "rounds.json").read_text("utf-8")
        )
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        scaling = rounds["scaling"]

        # A boss round spawns no horde, so the boss is the whole income for
        # that round. Paying a flat 25 meant reaching one cost you the round:
        # at round 20 the wave it cancelled would have paid 240, and the Moon
        # Lord paid 25 for the hardest fight on the board.
        self.assertGreater(
            scaling.get("bossCoinMultiplier", 0), 1,
            "a boss pays less than the wave it replaces",
        )
        self.assertNotRegex(
            engine,
            r"boss\.coinDrop\s*=\s*Math\.round\(\s*\d+\s*\*",
            "the boss drop is a flat number again, so it stops scaling",
        )
        self.assertIn(
            "this.waveValue()",
            engine.split("spawnBoss(bossData) {", 1)[1].split("\n        }", 1)[0],
            "the boss drop is not measured against the wave it replaces",
        )

        # And that measure has to grow with the round, or the flat number is
        # back under a different name.
        wave = engine.split("waveValue() {", 1)[1].split("\n        }", 1)[0]
        self.assertIn("this.roundScale", wave, "the wave value ignores the round")
        self.assertIn(
            "this.expectedMobCount()", wave, "the wave value ignores the crowd",
        )

        # The first shop has to be able to sell you something. It opens after
        # round one, when a wave of three has paid single digits.
        # Priced above zero: the starting bow is free and never on the shelf,
        # so including it made this pass with an empty purse.
        cheapest = min(
            weapon["price"]
            for weapon in json.loads(
                (static_dir / "data" / "terra" / "weapons.json").read_text("utf-8")
            )["weapons"]
            if weapon.get("tier", 1) == 1 and weapon["price"] > 0
        )
        purse = (rounds.get("player", {}).get("startingCoins", 0)
                 + scaling["mobCountBase"]
                 * min(mob["coins"] for mob in rounds["mobs"]))
        self.assertGreaterEqual(
            purse, cheapest,
            f"after round one you hold {purse} and the cheapest thing on the "
            f"shelf is {cheapest}, so the first shop sells nothing",
        )

    def test_the_menu_clip_and_buttons_line_up(self):
        import re as regex
        import struct

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        css = (static_dir / "terra_boss.css").read_text(encoding="utf-8")

        # The clip's own resolution, read out of the file rather than assumed,
        # so replacing it with a different one keeps this honest.
        clip = static_dir / "assets" / "terra" / "menu-animation.mp4"
        data = clip.read_bytes()
        at = data.find(b"tkhd")
        self.assertGreater(at, 0, "the menu clip has no track header to measure")
        native_w, native_h = (
            value >> 16 for value in struct.unpack(">II", data[at:at + 88][-8:])
        )

        block = css.split(".tb-menu-art video {", 1)[1].split("}", 1)[0]
        drawn = regex.search(r"width:\s*(\d+)px", block)
        self.assertIsNotNone(drawn, "the menu clip has no fixed width to check")
        width = int(drawn.group(1))
        # Stretched to fill the panel it came out at about 2.26x and cropped:
        # at a fractional multiple a source pixel smears across a boundary,
        # so some blocks land two wide and some three and the edges wobble.
        self.assertEqual(
            width % native_w, 0,
            f"the clip draws at {width}px against a {native_w}px source, "
            f"which is {width / native_w:.2f}x -- not a whole multiple",
        )
        self.assertIn(
            "image-rendering: pixelated", block, "the clip is drawn smoothed",
        )
        self.assertNotIn(
            "object-fit: cover", block,
            "the clip is cropped to fill again instead of shown whole",
        )

        # Three buttons in a two-column grid orphaned Feats on the row below.
        # minmax(0, 1fr) rather than 1fr, or the longest label sets the width
        # and the columns come out uneven.
        row = css.split(".tb-menu-actions-row {", 1)[1].split("}", 1)[0]
        self.assertIn(
            "repeat(3, minmax(0, 1fr))",
            row,
            "the codex buttons are not three equal columns",
        )

        # And the stack sits down the middle rather than stretching edge to edge.
        actions = css.split(".tb-menu-actions {", 1)[1].split("}", 1)[0]
        self.assertIn("margin: 0 auto", actions, "the button stack is not centred")
        self.assertIn("max-width", actions, "the button stack has no width to centre")

    def test_coins_you_earned_reach_your_purse(self):
        engine = (
            Path(__file__).resolve().parent / "static" / "games" / "terra_boss.js"
        ).read_text(encoding="utf-8")

        def body_of(signature):
            start = engine.index(signature) + len(signature)
            depth = 1
            for offset, char in enumerate(engine[start:]):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return engine[start:start + offset]
            raise AssertionError(f"{signature} is never closed")

        # A coin is worth what it says, not one. Dropping a sprite per unit
        # put 323 bodies on the floor for one boss -- more than the round had
        # time to walk over, and a physics group that size for a number.
        self.assertIn("COIN_DROP_MAX", engine, "there is no cap on coin sprites")
        cap = int(engine.split("const COIN_DROP_MAX = ", 1)[1].split(";", 1)[0])
        self.assertLessEqual(cap, 24, "the cap is high enough to be no cap at all")
        self.assertIn(
            "coin.value = each", engine, "coins no longer carry a denomination",
        )
        # And collecting one has to bank what it is worth, or the cap quietly
        # becomes a pay cut.
        pickup = engine.split("this.physics.add.overlap(this.player, this.coins", 1)[1]
        self.assertIn(
            "coin.value || 1",
            pickup.split("});", 1)[0],
            "picking up a coin still banks 1 whatever it is worth",
        )

        # The shop opens about a second after the last kill, so whatever is
        # still rolling around has to be collected for you rather than lost.
        self.assertIn("sweepDroppedCoins", engine, "nothing sweeps the floor")
        sweep = body_of("sweepDroppedCoins() {")
        self.assertIn("coin.value || 1", sweep, "the sweep undercounts big coins")
        self.assertIn(
            "this.coinsCollected += swept", sweep, "the sweep banks nothing",
        )
        cleared = body_of("onRoundCleared() {")
        self.assertIn(
            "this.sweepDroppedCoins()",
            cleared,
            "the round ends without collecting what is still on the floor",
        )

    def test_a_new_arena_never_buries_the_player(self):
        engine = (
            Path(__file__).resolve().parent / "static" / "games" / "terra_boss.js"
        ).read_text(encoding="utf-8")

        def body_of(signature):
            start = engine.index(signature) + len(signature)
            depth = 1
            for offset, char in enumerate(engine[start:]):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return engine[start:start + offset]
            raise AssertionError(f"{signature} is never closed")

        # Every round rolls a new height profile and rebuilds the arena around
        # whoever is standing in it. Where the new ground came in higher, the
        # player was left inside it -- and a body inside a static slab is not
        # pushed out, it falls through and lands on the bottom of the world.
        self.assertIn("standOnGround", engine, "nothing lifts anyone out of new ground")
        rotate = body_of("rotateArena(prefer, wantLayout, boss = null) {")
        self.assertIn(
            "this.standOnGround(this.player)",
            rotate,
            "the arena is rebuilt without checking the player is above it",
        )

        lift = body_of("standOnGround(sprite) {")
        self.assertIn("body.bottom", lift, "the check does not use the body's feet")
        # Only ever upward: yanking a jumping player down to the floor every
        # time the arena changed would be its own bug.
        self.assertIn(
            "if (overlap <= 0)", lift, "the lift is not one-directional",
        )
        self.assertIn("sprite.y -= overlap", lift, "the lift does not move upward")
        self.assertNotIn(
            "sprite.y +=", lift, "something in the lift pushes downward",
        )

    def test_health_reads_the_way_terraria_shows_it(self):
        static_dir = Path(__file__).resolve().parent / "static" / "games"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        css = (static_dir / "terra_boss.css").read_text(encoding="utf-8")
        markup = (
            static_dir.parent.parent / "templates" / "games" / "terra_boss.html"
        ).read_text(encoding="utf-8")

        # Terraria's scale, which this game already shares: 20 to a heart, ten
        # to a row, 400 at the ceiling -- so a full loadout is two rows of ten.
        self.assertIn("const HP_PER_HEART = 20;", engine)
        self.assertIn("const HEARTS_PER_ROW = 10;", engine, "hearts have no row length")
        row = css.split(".tb-heart-row {", 1)[1].split("}", 1)[0]
        self.assertIn(
            "repeat(10,", row,
            "the rows are not ten wide, so they wrap at whatever fits",
        )

        body = engine.split("function updateHudHearts(", 1)[1].split("\n    }", 1)[0]

        # Rows are appended top-first so the bottom row is last in the
        # document. Reading the cells in document order therefore fills the
        # top row first and drains the bottom -- backwards. Each cell has to
        # carry which heart it is.
        # The assignment specifically: searching for the bare property name
        # also matched the line that reads it back, so deleting the tag left
        # the guard passing.
        self.assertIn(
            "cell.dataset.index = String(",
            body,
            "hearts are not tagged with their number",
        )
        self.assertIn(
            "Number(cell.dataset.index)",
            body,
            "hearts are filled in document order, which inverts the rows",
        )

        # A heart drains rather than blinking out, or the last twenty health
        # look exactly like the last one.
        self.assertIn("clipPath", body, "hearts have no partial state")
        self.assertIn("tb-heart-live", css, "there is no layer to clip")
        self.assertIn("tb-heart-spent", css, "there is nothing behind a spent heart")

        # And the number Terraria's fancy bar shows.
        self.assertIn('id="tb-hud-hp"', markup, "there is no health readout")
        self.assertIn("is-low", body, "the readout never warns")

    def test_every_biome_can_look_more_than_one_way(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        biomes = json.loads(
            (static_dir / "data" / "terra" / "biomes.json").read_text("utf-8")
        )
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        art = static_dir / "assets" / "terra" / "backgrounds"

        count = int(engine.split("const BACKGROUND_COUNT = ", 1)[1].split(";", 1)[0])

        # A biome named one backdrop, so the jungle looked identical on every
        # visit however long a run lasted. It names a set now.
        for biome in biomes["biomes"]:
            listed = biome.get("backgrounds")
            self.assertTrue(
                listed, f"{biome['id']} has no backdrop set",
            )
            for index in listed:
                self.assertLessEqual(
                    index, count,
                    f"{biome['id']} lists backdrop {index}, past the "
                    f"{count} the engine preloads -- it would never appear",
                )
                self.assertTrue(
                    (art / f"back{index}.jpg").is_file(),
                    f"{biome['id']} lists backdrop {index} and there is no file",
                )

        # Every backdrop that exists has to be preloaded, or a biome that
        # lists it falls back to a flat colour.
        on_disk = sorted(int(p.stem[4:]) for p in art.glob("back*.jpg")
                         if p.stem[4:].isdigit())
        self.assertGreaterEqual(
            count, max(on_disk), "there is art the engine never loads",
        )

        # Where the borrowed ones came from stays recorded beside them.
        self.assertTrue((art / "SOURCES.md").is_file(), "the backdrops have no register")
        manifest = json.loads((art / "manifest.json").read_text(encoding="utf-8"))
        readme = (
            Path(__file__).resolve().parent.parent / "README.md"
        ).read_text(encoding="utf-8")
        self.assertIn(
            manifest["art"], readme, "the backdrop artist is not credited",
        )

    def test_the_between_rounds_screen_stacks_rather_than_spreads(self):
        static_dir = Path(__file__).resolve().parent / "static" / "games"
        css = (static_dir / "terra_boss.css").read_text(encoding="utf-8")
        markup = (
            static_dir.parent.parent / "templates" / "games" / "terra_boss.html"
        ).read_text(encoding="utf-8")

        # .tb-panel is a flex row that centres a single child with margin:auto.
        # The shop has two children now -- the bar and the three cards -- so
        # without a direction they laid out side by side and shoved the whole
        # screen off the edge.
        shop_children = markup.split('id="tb-shop"', 1)[1].split("</section>", 1)[0]
        self.assertIn("tb-between-bar", shop_children)
        self.assertIn('class="tb-between"', shop_children)

        rule = css.split("#tb-shop {", 1)[1].split("}", 1)[0]
        self.assertIn(
            "flex-direction: column",
            rule,
            "the shop lays its bar out beside the cards instead of above them",
        )

        # And those auto margins have to go, or in a column they absorb the
        # free space and push the bar away from the cards.
        override = css.split("#tb-shop > * {", 1)[1].split("}", 1)[0]
        self.assertIn("margin: 0", override, "the panel's auto margins still apply")

        # The cards take what height is left rather than asking for the full
        # panel height on their own, which would push them past the bottom.
        sized = css.split("#tb-shop .tb-between {", 1)[1].split("}", 1)[0]
        self.assertIn("height: auto", sized, "the cards still demand a fixed height")
        self.assertIn("flex: 1", sized, "the cards do not take the remaining space")

    def test_a_fresh_clone_needs_no_writable_database(self):
        from django.conf import settings

        # This project never touches a database: no models, no migrations, and
        # sessions live in a signed cookie. A file-backed SQLite therefore
        # existed only to be created at startup -- and on a machine where the
        # clone's folder is not writable, SQLite fails with "unable to open
        # database file" and runserver refuses to start over a database
        # nobody reads. Someone hit exactly that on a second PC.
        #
        # Read out of the settings file rather than off the live settings
        # object: the test runner swaps NAME for a test database of its own
        # ("file:memorydb_default?..."), so asking Django at runtime tells you
        # what the runner chose, never what a fresh clone would start with.
        settings_source = (
            Path(settings.BASE_DIR) / "config" / "settings.py"
        ).read_text(encoding="utf-8")
        configured = settings_source.split("DATABASES = {", 1)[1].split("}", 1)[0]
        self.assertIn(
            '"NAME": ":memory:"',
            configured,
            "the database is a file again, so a clone in a folder the user "
            "cannot write to will not start",
        )

        # The premise the above rests on. If a model or a migration ever
        # appears, an in-memory database silently loses its data every
        # restart, and this should fail loudly rather than let that happen.
        app_path = Path(__file__).resolve().parent
        models = (app_path / "models.py")
        if models.is_file():
            body = [
                line for line in models.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.strip().startswith("#")
            ]
            self.assertFalse(
                body,
                "games/models.py defines something now -- an in-memory "
                "database will lose it on every restart",
            )
        self.assertFalse(
            (app_path / "migrations").is_dir(),
            "there are migrations now, so the database has to be a real file",
        )
        self.assertEqual(
            settings.SESSION_ENGINE,
            "django.contrib.sessions.backends.signed_cookies",
            "sessions moved to the database, which now has to persist",
        )

    def test_the_save_is_rebuilt_field_by_field(self):
        import re

        engine = (
            Path(__file__).resolve().parent / "static" / "games" / "terra_boss.js"
        ).read_text(encoding="utf-8")

        # Merging a stored blob over the defaults copies fields of the wrong
        # type straight through, and the failure surfaces far away and
        # silently: a string where achievements should be an array does not
        # throw until a menu calls .includes on it and refuses to open.
        self.assertNotRegex(
            engine,
            r"Object\.assign\(\s*defaultSave\(\)\s*,",
            "the save is merged over its defaults again instead of rebuilt",
        )
        self.assertIn(
            "function sanitiseSave(",
            engine,
            "there is no save sanitiser",
        )

        body = engine.split("function sanitiseSave(", 1)[1].split("\n    }", 1)[0]
        defaults = engine.split("function defaultSave(", 1)[1].split("\n    }", 1)[0]
        # Every field the game stores has to be rebuilt, or it is one of the
        # ones that silently passes through unchecked.
        for field in re.findall(r"^\s{12}(\w+):", defaults, re.M):
            self.assertIn(
                field,
                body,
                f"sanitiseSave never rebuilds '{field}', so a bad one gets through",
            )

    def test_late_coins_have_something_to_buy(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        rounds = json.loads(
            (static_dir / "data" / "terra" / "rounds.json").read_text("utf-8")
        )
        consumables = rounds["consumables"]

        # Weapons, armour and accessories all stop at tier 6 and both crystals
        # hit a ceiling, so without an uncapped sink coins pile up unspent from
        # about round 25 while enemies keep scaling.
        uncapped = [
            c for c in consumables
            if not any(key.endswith("Cap") for key in (c.get("effects") or {}))
        ]
        self.assertTrue(
            uncapped,
            "every consumable caps out, so late coins have nothing to buy",
        )
        for item in uncapped:
            # An uncapped buy has to get dearer, or it is farmed forever.
            self.assertGreater(
                item.get("priceStep", 0),
                0,
                f"{item['id']} never caps and never costs more",
            )
        for item in consumables:
            self.assertTrue((sprites_dir / item["sprite"]).exists())
            self.assertGreater(item["price"], 0)

        # Defense must not be able to zero out a hit, or a late armour set
        # turns whole mid-game rounds into a walk.
        fraction = rounds["combat"].get("minDamageFraction")
        self.assertIsNotNone(fraction, "no floor on damage after defense")
        self.assertGreater(fraction, 0)
        self.assertLess(fraction, 1)

    def test_every_overlay_panel_can_be_shown(self):
        import re

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")
        template = (
            Path(__file__).resolve().parent
            / "templates" / "games" / "terra_boss.html"
        ).read_text(encoding="utf-8")

        # showScreen only unhides ids it knows about, so a panel left out of
        # that list blanks the page instead of opening. This is invisible to a
        # DOM check, because a hidden element still answers queries.
        listed = set(
            re.findall(r'"(tb-[a-z-]+)"', engine.split("const screens = [", 1)[1]
                       .split("]", 1)[0])
        )
        shown = set(re.findall(r'showScreen\("(tb-[a-z-]+)"\)', engine))
        self.assertTrue(shown, "found no showScreen calls")
        missing = shown - listed
        self.assertFalse(
            missing,
            f"showScreen is called with panels it cannot unhide: {missing}",
        )
        for panel in listed:
            self.assertIn(
                f'id="{panel}"',
                template,
                f"screens lists {panel}, which is not in the template",
            )

    def test_every_feat_can_actually_be_earned(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        data_dir = static_dir / "data" / "terra"
        feats = json.loads((data_dir / "achievements.json").read_text("utf-8"))[
            "achievements"
        ]
        bosses = json.loads((data_dir / "bosses.json").read_text("utf-8"))["bosses"]
        characters = json.loads((data_dir / "characters.json").read_text("utf-8"))[
            "characters"
        ]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        ids = set()
        awarded_in_run = {
            boss["achievementOnKill"] for boss in bosses if boss.get("achievementOnKill")
        }
        for feat in feats:
            self.assertNotIn(feat["id"], ids, f"duplicate feat {feat['id']}")
            ids.add(feat["id"])
            self.assertTrue(feat["name"] and feat["description"])
            condition = feat.get("condition") or {}
            self.assertTrue(condition, f"{feat['id']} has no condition")
            if condition.get("awarded"):
                # Handed out during the run, so a boss has to hand it out.
                self.assertIn(
                    feat["id"],
                    awarded_in_run,
                    f"{feat['id']} is marked awarded but nothing awards it",
                )
                continue
            # Everything else is measured at the end of a run, and the engine
            # has to know how to measure it.
            for key in condition:
                self.assertIn(
                    key,
                    engine,
                    f"{feat['id']} is measured by '{key}', which the engine "
                    f"never reads, so it can never be earned",
                )

        # Every boss kill should be a feat, or beating one goes unrecorded.
        self.assertTrue(
            awarded_in_run <= ids,
            f"bosses award feats that are not listed: {awarded_in_run - ids}",
        )

        # A character gated behind a feat needs that feat to exist.
        for character in characters:
            unlock = character["unlock"]
            if unlock["type"] == "achievement":
                self.assertIn(
                    unlock["achievement"],
                    ids,
                    f"{character['id']} is locked behind a feat that does not exist",
                )

    def test_character_abilities_are_data_not_code(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        data_dir = static_dir / "data" / "terra"

        characters = json.loads((data_dir / "characters.json").read_text("utf-8"))[
            "characters"
        ]
        frames = json.loads((sprites_dir / "frames.json").read_text("utf-8"))
        weapons = {w["id"] for w in json.loads(
            (data_dir / "weapons.json").read_text("utf-8"))["weapons"]}
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        self.assertGreaterEqual(
            len(characters), 10, "too few characters to make the unlock meta worth it"
        )

        # Abilities used to be `character.id === "guide"` checks scattered
        # through the engine, which meant no character could be added without
        # editing game code. Keep them out.
        self.assertNotIn(
            'character.id === "',
            engine,
            "an ability is hardcoded against a character id again",
        )

        ids = set()
        free = 0
        for character in characters:
            self.assertNotIn(character["id"], ids, "duplicate character id")
            ids.add(character["id"])
            self.assertIn(character["id"], frames, f"{character['id']} has no sprite")
            self.assertTrue((sprites_dir / character["sprite"]).exists())
            self.assertIn(
                character["startingWeapon"],
                weapons,
                f"{character['id']} starts with a weapon that does not exist",
            )
            ability = character["ability"]
            self.assertTrue(ability.get("description"))
            # An ability with no effects is a description and nothing else.
            self.assertTrue(
                ability.get("effects"), f"{character['id']} has an ability that does nothing"
            )
            if character["unlock"]["type"] == "free":
                free += 1
        self.assertEqual(free, 1, "there must be exactly one character to start with")

        # The player has to be able to see themselves: character strips share
        # the frame layout the worn helmets are cut against.
        for character in characters:
            self.assertEqual(
                frames[character["id"]]["frames"],
                16,
                f"{character['id']} does not have the 16 frames helmets expect",
            )

    def test_each_boss_is_fought_in_an_arena_that_suits_it(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        data_dir = static_dir / "data" / "terra"
        bosses = json.loads((data_dir / "bosses.json").read_text("utf-8"))["bosses"]
        layouts = json.loads((data_dir / "biomes.json").read_text("utf-8"))["layouts"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        by_id = {layout["id"]: layout for layout in layouts}
        boss_only = {i for i, l in by_id.items() if l.get("bossOnly")}
        self.assertTrue(boss_only, "no arenas are reserved for bosses")

        claimed = set()
        for boss in bosses:
            self.assertIn("arena", boss, f"{boss['id']} has no arena")
            self.assertIn(
                boss["arena"], by_id, f"{boss['id']} names an arena that does not exist"
            )
            claimed.add(boss["arena"])

        # A reserved arena nobody fights in is dead weight, since it is kept
        # out of the ordinary rotation.
        orphaned = boss_only - claimed
        self.assertFalse(orphaned, f"boss-only arenas nothing uses: {orphaned}")

        # Boss arenas must differ from each other in shape, or naming one per
        # boss achieves nothing.
        shapes = {
            (by_id[a]["groundHeight"], len(by_id[a]["platforms"]))
            for a in claimed
        }
        self.assertGreaterEqual(
            len(shapes), 4, "the boss arenas are all much the same shape"
        )

        # And the engine has to keep them out of ordinary rounds.
        self.assertIn(
            "bossOnly",
            engine,
            "nothing stops a boss arena rolling for a normal round",
        )

    def test_boss_fights_do_not_all_play_the_same(self):
        import json
        from collections import Counter

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        bosses = json.loads(
            (static_dir / "data" / "terra" / "bosses.json").read_text("utf-8")
        )["bosses"]
        engine = (static_dir / "terra_boss.js").read_text(encoding="utf-8")

        implemented = set(re.findall(r'pattern [=!]== "([a-z]+)"', engine))
        counts = Counter(boss["pattern"] for boss in bosses)
        for pattern, used in counts.items():
            # A pattern the engine never checks for leaves the boss inert.
            self.assertIn(
                pattern,
                implemented,
                f"nothing in the engine handles the {pattern} pattern",
            )
            # This is a boss rush; three bosses moving identically is most of
            # the fight repeating itself.
            self.assertLessEqual(
                used,
                2,
                f"{used} bosses all use the {pattern} pattern",
            )
        self.assertGreaterEqual(
            len(counts), 7, "too few distinct boss patterns for eleven bosses"
        )

    def test_biomes_match_their_backdrop_and_art(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        data_dir = static_dir / "data" / "terra"

        biomes = json.loads((data_dir / "biomes.json").read_text("utf-8"))["biomes"]
        tiles = json.loads((sprites_dir / "tiles.json").read_text("utf-8"))
        decor = json.loads((sprites_dir / "decor.json").read_text("utf-8"))
        rounds = json.loads((data_dir / "rounds.json").read_text("utf-8"))

        backdrops = set()
        for biome in biomes:
            # Each backdrop is claimed by exactly one biome, or the blocks
            # underfoot stop being a reliable clue to where you are.
            self.assertNotIn(
                biome["background"],
                backdrops,
                f"two biomes claim backdrop {biome['background']}",
            )
            backdrops.add(biome["background"])
            self.assertTrue(
                (
                    static_dir / "assets" / "terra" / "backgrounds"
                    / f"back{biome['background']}.jpg"
                ).exists(),
                f"{biome['id']} points at a backdrop that is not there",
            )

            for slot in ("surface", "fill", "platform"):
                self.assertIn(
                    biome[slot], tiles, f"{biome['id']} {slot} tile is missing"
                )
                self.assertTrue((sprites_dir / tiles[biome[slot]]["file"]).exists())

            for spec in (biome.get("decor") or {}).values():
                self.assertIn(
                    spec["sprite"], decor, f"{biome['id']} decor sprite is missing"
                )
                self.assertTrue((sprites_dir / decor[spec["sprite"]]["file"]).exists())

        known = {biome["id"] for biome in biomes}
        for mob in rounds["mobs"]:
            unknown = set(mob.get("biomes", [])) - known
            self.assertFalse(unknown, f"{mob['id']} lives in unknown biomes: {unknown}")

        # A biome with no residents would spawn a generic horde and lose the
        # point of matching the enemies to the scenery.
        for biome in biomes:
            residents = [
                mob for mob in rounds["mobs"] if biome["id"] in mob.get("biomes", [])
            ]
            self.assertGreaterEqual(
                len(residents), 3, f"{biome['id']} has almost nothing living in it"
            )

    def test_every_weapon_category_has_a_shoot_sound(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        audio_source = (static_dir / "terra_boss_audio.js").read_text(encoding="utf-8")
        weapons = json.loads(
            (static_dir / "data" / "terra" / "weapons.json").read_text("utf-8")
        )
        for category in weapons["categories"]:
            self.assertIn(
                f'"shoot-{category}"',
                audio_source,
                f"no shoot sound defined for the {category} category",
            )

    def test_each_item_has_its_own_traceable_sprite(self):
        import json

        sprites_dir = (
            Path(__file__).resolve().parent
            / "static" / "games" / "assets" / "terra" / "sprites"
        )
        items = json.loads((sprites_dir / "items.json").read_text("utf-8"))

        # Recording the Terraria sprite each icon came from is what makes a
        # wrong pick checkable later.
        for item_id, spec in items.items():
            self.assertIn("source", spec, f"{item_id} does not record its source sprite")

        # Two different items sharing one sprite means a copy/paste slip:
        # that is exactly how several bows ended up wearing the wrong metal.
        seen = {}
        for item_id, spec in items.items():
            source = spec["source"]
            self.assertNotIn(
                source,
                seen,
                f"'{item_id}' and '{seen.get(source)}' both use {source}",
            )
            seen[source] = item_id

    def test_sprite_strips_match_their_declared_geometry(self):
        import json
        import struct

        sprites_dir = (
            Path(__file__).resolve().parent
            / "static" / "games" / "assets" / "terra" / "sprites"
        )

        def png_size(path):
            with path.open("rb") as handle:
                header = handle.read(24)
            return struct.unpack(">II", header[16:24])

        # A strip whose real size disagrees with the manifest makes Phaser
        # read the wrong number of frames, which shows up as a mangled sprite.
        for manifest_name in ("frames.json", "wings.json", "armor.json"):
            manifest = json.loads((sprites_dir / manifest_name).read_text("utf-8"))
            for sprite_id, spec in manifest.items():
                width, height = png_size(sprites_dir / spec["file"])
                self.assertEqual(
                    (width, height),
                    (spec["frameWidth"] * spec["frames"], spec["frameHeight"]),
                    f"{sprite_id} in {manifest_name}: file is {width}x{height} but the "
                    f"manifest declares {spec['frames']} frames of "
                    f"{spec['frameWidth']}x{spec['frameHeight']}",
                )

    def test_worn_helmets_match_character_frames(self):
        import json

        sprites_dir = (
            Path(__file__).resolve().parent
            / "static" / "games" / "assets" / "terra" / "sprites"
        )
        worn = json.loads((sprites_dir / "armor.json").read_text("utf-8"))
        frames = json.loads((sprites_dir / "frames.json").read_text("utf-8"))
        # Helmets are drawn by copying the character's frame index, so the
        # strips must have at least as many frames as the characters do.
        character_frames = frames["guide"]["frames"]
        for piece_id, spec in worn.items():
            self.assertTrue(
                (sprites_dir / spec["file"]).exists(),
                f"worn sprite for '{piece_id}' missing",
            )
            self.assertGreaterEqual(
                spec["frames"],
                character_frames,
                f"'{piece_id}' has fewer frames than the character walk cycle",
            )

        # Every head piece in the shop should have worn art to wear.
        armor = json.loads(
            (
                Path(__file__).resolve().parent
                / "static" / "games" / "data" / "terra" / "armor.json"
            ).read_text("utf-8")
        )
        for set_ in armor["sets"]:
            for piece in set_["pieces"]:
                if piece["slot"] == "head":
                    self.assertIn(
                        piece["id"],
                        worn,
                        f"no worn sprite for head piece '{piece['id']}'",
                    )

    def test_crystals_grant_whole_hearts(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        rounds = json.loads(
            (static_dir / "data" / "terra" / "rounds.json").read_text("utf-8")
        )
        consumables = rounds["consumables"]
        self.assertTrue(consumables, "the shop has no crystals to sell")

        # The HUD draws one heart per 20 life, so a bonus that is not a
        # multiple of 20 would leave a half-heart the row cannot show.
        base_hp = rounds["player"]["baseMaxHp"]
        self.assertEqual(base_hp % 20, 0, "starting life is not a whole number of hearts")
        for entry in consumables:
            self.assertTrue(
                (sprites_dir / entry["sprite"]).exists(),
                f"missing icon for {entry['id']}",
            )
            self.assertGreater(entry["price"], 0)
            effects = entry["effects"]
            if "maxHpBonus" in effects:
                self.assertEqual(
                    effects["maxHpBonus"] % 20,
                    0,
                    f"{entry['id']} would grant a partial heart",
                )
                self.assertGreater(effects["maxHpCap"], base_hp)

        # The shop must be able to roll them.
        self.assertIn("consumable", rounds["shop"]["weights"])

    def test_weapon_progression_is_coherent(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        weapons = json.loads(
            (static_dir / "data" / "terra" / "weapons.json").read_text("utf-8")
        )["weapons"]

        # Every category the shop can roll needs more than a single option,
        # or unlocking it barely changes what you see.
        by_category = {}
        for weapon in weapons:
            by_category.setdefault(weapon["category"], []).append(weapon)
        for category, entries in by_category.items():
            self.assertGreaterEqual(
                len(entries),
                6,
                f"the {category} line-up is too thin to feel like a progression",
            )
            # A category the player spent souls unlocking has to keep offering
            # something as the rounds climb, not dry up two tiers in.
            tiers = {w["tier"] for w in entries}
            self.assertGreaterEqual(
                max(tiers) - min(tiers),
                3,
                f"{category} covers too few tiers to stay relevant",
            )

        for weapon in weapons:
            self.assertTrue(
                (sprites_dir / weapon["sprite"]).exists(),
                f"{weapon['id']} has no item art",
            )
            self.assertGreater(weapon["damage"], 0)
            if weapon["category"] == "yoyo":
                # Yoyos are limited to one in flight, not by a cooldown.
                self.assertGreaterEqual(weapon["fireRateMs"], 0)
            else:
                self.assertGreater(weapon["fireRateMs"], 0)

        # Within a category, paying more must buy more killing power. That is
        # damage per second, not damage per shot: a Minishark hits for 6 and a
        # Sniper Rifle for 86, and the Minishark is the earlier weapon.
        for category, entries in by_category.items():
            if category == "yoyo":
                continue  # no fire rate; one in flight gates them instead
            # Compare tiers, not prices: the tier is what gates the shop, and
            # Terraria ships genuinely equivalent weapons (the Iron and
            # Ebonwood bows are the same numbers), so equal power at different
            # prices is correct rather than a fault.
            best = {}
            dearest = {}
            for w in entries:
                if w["price"] <= 0:
                    continue
                rate = w["damage"] * w.get("shots", 1) / w["fireRateMs"]
                best[w["tier"]] = max(best.get(w["tier"], 0), rate)
                dearest[w["tier"]] = max(dearest.get(w["tier"], 0), w["price"])
            tiers = sorted(best)
            for lower, higher in zip(tiers, tiers[1:]):
                self.assertGreater(
                    best[higher],
                    best[lower],
                    f"{category} tier {higher} is no stronger than tier {lower}",
                )
                # And the better tier must not be cheaper across the board.
                self.assertGreaterEqual(
                    dearest[higher],
                    dearest[lower],
                    f"{category} tier {higher} costs less than tier {lower}",
                )

    def test_wing_accessories_have_art_and_flight(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        wings = json.loads((sprites_dir / "wings.json").read_text("utf-8"))
        accessories = json.loads(
            (static_dir / "data" / "terra" / "accessories.json").read_text("utf-8")
        )

        flying = [
            accessory for accessory in accessories["accessories"]
            if "flight" in accessory.get("effects", {})
        ]
        self.assertTrue(flying, "no accessory grants flight")
        for accessory in flying:
            effects = accessory["effects"]
            # Boots fly on rocket flame and carry no wing sprite; anything that
            # does name one has to name a real one.
            if "wings" in effects:
                self.assertIn(
                    effects["wings"],
                    wings,
                    f"{accessory['id']} points at a missing wing sprite",
                )
            self.assertGreater(effects["flight"]["durationMs"], 0)
            # Shop icons are what the player actually sees before buying.
            self.assertTrue(
                (sprites_dir / accessory["sprite"]).exists(),
                f"missing shop icon for {accessory['id']}",
            )

        for wing_id, spec in wings.items():
            self.assertTrue((sprites_dir / spec["file"]).exists())
            self.assertGreaterEqual(spec["frames"], 2, f"{wing_id} cannot flap")

    def test_gore_pieces_belong_to_real_enemies(self):
        import json

        static_dir = Path(__file__).resolve().parent / "static" / "games"
        sprites_dir = static_dir / "assets" / "terra" / "sprites"
        data_dir = static_dir / "data" / "terra"
        gore = json.loads((sprites_dir / "gore.json").read_text("utf-8"))

        rounds = json.loads((data_dir / "rounds.json").read_text("utf-8"))
        bosses = json.loads((data_dir / "bosses.json").read_text("utf-8"))
        known = {mob["id"] for mob in rounds["mobs"]}
        known |= {boss["id"] for boss in bosses["bosses"]}

        for enemy_id, pieces in gore.items():
            self.assertIn(
                enemy_id,
                known,
                f"gore defined for unknown enemy '{enemy_id}'",
            )
            self.assertTrue(pieces, f"'{enemy_id}' has an empty gore set")
            for piece in pieces:
                self.assertTrue(
                    (sprites_dir / piece["file"]).exists(),
                    f"missing gore sprite {piece['file']}",
                )

    def test_battle_backgrounds_are_present(self):
        backgrounds = (
            Path(__file__).resolve().parent
            / "static" / "games" / "assets" / "terra" / "backgrounds"
        )
        found = sorted(int(path.stem[4:]) for path in backgrounds.glob("back*.jpg")
                       if path.stem[4:].isdigit())
        self.assertGreaterEqual(len(found), 10, f"too few backdrops: {found}")
        # Numbered without gaps from 1. A fixed count was wrong the moment
        # more were added; what actually matters is that the run is unbroken,
        # because the engine preloads 1..BACKGROUND_COUNT and a hole in the
        # middle is a biome pointing at art that was never loaded.
        self.assertEqual(
            found, list(range(1, len(found) + 1)),
            f"backdrop numbering has a gap in it: {found}",
        )

    def test_terra_data_files_are_valid_json(self):
        import json

        data_dir = (
            Path(__file__).resolve().parent / "static" / "games" / "data" / "terra"
        )
        expected = {
            "weapons.json",
            "armor.json",
            "accessories.json",
            "characters.json",
            "bosses.json",
            "rounds.json",
        }
        found = {path.name for path in data_dir.glob("*.json")}
        self.assertTrue(expected <= found, f"missing: {expected - found}")

        weapons = json.loads((data_dir / "weapons.json").read_text("utf-8"))
        weapon_ids = {weapon["id"] for weapon in weapons["weapons"]}
        for weapon in weapons["weapons"]:
            self.assertIn(weapon["category"], weapons["categories"])

        characters = json.loads((data_dir / "characters.json").read_text("utf-8"))
        for character in characters["characters"]:
            self.assertIn(
                character["startingWeapon"],
                weapon_ids,
                f"{character['id']} starts with an unknown weapon",
            )

        rounds = json.loads((data_dir / "rounds.json").read_text("utf-8"))
        mob_ids = {mob["id"] for mob in rounds["mobs"]}
        self.assertIn("drops", rounds)
        self.assertIn("player", rounds)
        self.assertIn("shop", rounds)

        # The first shop must be affordable: round one's coins plus the
        # starting purse have to cover the cheapest item on offer.
        armor = json.loads((data_dir / "armor.json").read_text("utf-8"))
        accessories = json.loads((data_dir / "accessories.json").read_text("utf-8"))
        weapons_priced = [w["price"] for w in weapons["weapons"] if w["price"] > 0]
        armor_priced = [p["price"] for s in armor["sets"] for p in s["pieces"]]
        accessory_priced = [a["price"] for a in accessories["accessories"]]
        cheapest = min(weapons_priced + armor_priced + accessory_priced)
        round_one_mobs = rounds["scaling"]["mobCountBase"]
        weakest_drop = min(
            mob["coins"] for mob in rounds["mobs"] if mob["minRound"] <= 1
        )
        purse = rounds["player"].get("startingCoins", 0)
        self.assertGreaterEqual(
            purse + round_one_mobs * weakest_drop,
            cheapest,
            "a player cannot afford anything at the first shop",
        )

        known_behaviors = {"slime-hops", "walker", "flyer", "caster"}
        for mob in rounds["mobs"]:
            self.assertIn(
                mob["behavior"],
                known_behaviors,
                f"{mob['id']} has an unknown behaviour",
            )
            if mob["behavior"] == "caster":
                self.assertIn("shoot", mob, f"caster {mob['id']} needs a shoot block")
        # Every round from the first must have something available to spawn.
        for round_number in (1, 5, 9, 20):
            available = [
                mob for mob in rounds["mobs"]
                if mob["minRound"] <= round_number <= mob["maxRound"]
            ]
            self.assertTrue(available, f"no mobs available on round {round_number}")

        armor = json.loads((data_dir / "armor.json").read_text("utf-8"))
        piece_ids = [
            piece["id"] for set_ in armor["sets"] for piece in set_["pieces"]
        ]
        self.assertEqual(len(piece_ids), len(set(piece_ids)), "duplicate armor ids")
        for set_ in armor["sets"]:
            self.assertEqual(
                {piece["slot"] for piece in set_["pieces"]},
                set(armor["slots"]),
                f"{set_['id']} does not cover every slot",
            )

        bosses = json.loads((data_dir / "bosses.json").read_text("utf-8"))
        # Read the patterns the engine actually implements rather than keeping
        # a copy here: a hardcoded list goes stale the moment one is added.
        engine = (
            Path(__file__).resolve().parent / "static" / "games" / "terra_boss.js"
        ).read_text(encoding="utf-8")
        # Both forms count: most patterns are an `=== "x"` branch, and the
        # charger is a `!== "charger"` guard in front of the fallthrough.
        known_patterns = set(re.findall(r'pattern [=!]== "([a-z]+)"', engine))
        self.assertTrue(known_patterns, "found no boss patterns in the engine")
        previous_hp = 0
        for boss in bosses["bosses"]:
            self.assertIn(
                boss["pattern"],
                known_patterns,
                f"{boss['id']} has an unknown pattern",
            )
            config = boss["patternConfig"]
            servant = config.get("summonMob") or config.get("servantMob")
            if servant is not None:
                self.assertIn(
                    servant,
                    mob_ids,
                    f"{boss['id']} summons an unknown mob",
                )
            # The roster is a difficulty curve; it must never step backwards.
            self.assertGreater(
                boss["hp"],
                previous_hp,
                f"{boss['id']} is not tougher than the boss before it",
            )
            previous_hp = boss["hp"]


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

    def test_the_readme_credits_everyone_the_assets_came_from(self):
        """Almost none of the art here is ours, and crediting it is the
        condition it is used under. A source that loses its line in the README
        is the kind of thing nobody notices, so the uploader names are read
        back out of the register beside the assets rather than hardcoded:
        add a sheet and forget the README, and this fails.
        """
        import json

        root = Path(__file__).resolve().parent.parent
        readme = (root / "README.md").read_text(encoding="utf-8")
        # The README is hard-wrapped prose, so a credit can be split across a
        # line break. Match against flattened text, or the test fails on where
        # the words happen to wrap rather than on whether anyone is credited.
        flat = re.sub(r"\s+", " ", readme).lower()

        self.assertIn("## Crédits", readme, "the README has no credits section")

        # Whoever ripped and uploaded each Pokemon sheet, per the register.
        register = (
            self.static_dir / "assets" / "pokemon" / "spriters-resource" / "SOURCES.md"
        ).read_text(encoding="utf-8")
        uploaders = set(re.findall(r"(?:Uploaded by|contributed by) (\w+)", register))
        self.assertGreaterEqual(len(uploaders), 5, "the register stopped naming uploaders")
        for who in sorted(uploaders):
            self.assertIn(who.lower(), flat,
                          f"{who} ripped a sheet we ship and is not credited")

        # Where the Terraria art came from, per its own manifest.
        manifest = json.loads(
            (self.static_dir / "assets" / "terra" / "sprites" / "manifest.json")
            .read_text(encoding="utf-8")
        )
        self.assertIn("The Spriters Resource", manifest["source"])
        self.assertIn("spriters-resource.com", flat,
                      "the Terraria sprites' source is not in the README")

        # The Calamity pack ships that team's own art now rather than
        # borrowing vanilla sprites, so they are owed an art credit and not
        # only a credit for the names and numbers.
        calamity = self.static_dir / "assets" / "terra" / "sprites" / "calamity"
        if calamity.is_dir():
            cal_manifest = json.loads(
                (calamity / "manifest.json").read_text(encoding="utf-8"))
            self.assertTrue(
                (calamity / "SOURCES.md").is_file(),
                "the Calamity art has no register beside it",
            )
            self.assertIn(cal_manifest["art"].lower(), flat,
                          "the Calamity artists are not credited")
            self.assertIn("calamitymod.wiki.gg", flat,
                          "where the Calamity art came from is not in the README")
            # Every raw file the manifest claims should actually be there.
            for key, entry in cal_manifest["sprites"].items():
                self.assertTrue(
                    (calamity / entry["file"]).is_file(),
                    f"{key} is in the register but its file is missing",
                )

        # And the rights holders and projects the games lean on.
        for owed in ("Re-Logic", "Calamity", "Pokémon Showdown",
                     "pokeemerald-expansion", "carchagui", "Princess-Phoenix",
                     "Phaser"):
            self.assertIn(owed.lower(), flat, f"{owed} is not credited")

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
