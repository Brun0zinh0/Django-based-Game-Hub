# Calamity Mod sprite sources

Downloaded by `fetch_terra_calamity_sprites.py` at the project root, from two
places:

- **Creature animation sheets** come from the mod's own public source mirror,
  [CalamityTeam/CalamityModPublic](https://github.com/CalamityTeam/CalamityModPublic)
  (branch `1.4.4`). These are the real multi-frame strips. Its LICENSE.md
  states the mod and its assets are **proprietary to Azafure, LLC, all rights
  reserved**.
- **Item icons** come from the
  [Calamity Mod Wiki](https://calamitymod.wiki.gg/), which names files after
  the item rather than its internal class. A single frame either way.

Art is by the **Calamity Mod team**. Calamity is a Terraria mod; Terraria
itself is Re-Logic's. Neither is affiliated with this project.

- `raw/` holds every file exactly as it was served, unedited.
- `manifest.json` records, per sprite, where it came from, the direct URL, and
  the size and mode it arrived as.
- The horizontal strips the game loads are built from `raw/` by
  `build_terra_calamity.py` and written to `frames/`, `items/` and `armor/`.
- `armor/` holds the helmets drawn on the character. Calamity draws one head
  per class; this game is ranged-only, and the Ranged sheets are the ones the
  pack's item icons actually are — confirmed by pixel-comparing all five
  variants against the shipped icons rather than by reading their names. They
  arrive in Terraria's own 20-frame player-rig layout and are remapped to this
  game's 16.

Used only by this personal, non-commercial fan project, and credited in the
project README. If you made one of these and want it credited differently or
removed, open an issue.
