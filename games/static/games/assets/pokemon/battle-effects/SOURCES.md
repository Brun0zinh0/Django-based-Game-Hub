# Battle effect sprite sources

Imported from the public
[`rh-hideout/pokeemerald-expansion`](https://github.com/rh-hideout/pokeemerald-expansion)
repository, directory `graphics/battle_anims/sprites/`.

- 2026-08-02 — initial import of 18 sprites for generic per-type effects.
- 2026-08-03 — widened to 84 sprites so individual moves can have their own
  animation instead of sharing one effect per type.

The set is fetched and verified by `fetch_battle_effect_sprites.py` at the
project root, which also writes `rhh/manifest.json` recording each sheet's
frame layout. Re-running the script is safe: existing files are kept and only
missing ones are downloaded.

Credit, per the upstream project's request:

> Based off RHH's pokeemerald-expansion
> https://github.com/rh-hideout/pokeemerald-expansion/

Credit also to the pokeemerald-expansion contributors and the original artists
credited by that project. Pokemon and related marks belong to their respective
owners. These files are used only by this fan game.
