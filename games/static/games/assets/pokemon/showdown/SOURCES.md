# Pokemon Showdown sprite sources

Fetched by `fetch_showdown_sprites.py` at the project root, which also writes
`manifest.json` mapping species ids to sprite paths.

- Server: https://play.pokemonshowdown.com/sprites/ (`ani/`, `ani-back/`,
  and `pokemonicons-sheet.png`)
- Backup mirror of the same art: https://github.com/PokeAPI/sprites
- Art: Game Freak / Nintendo / Creatures Inc., Gen 5 (Black/White) style.
  Pokemon and related marks belong to their respective owners; used only by
  this fan game.

Only species reachable in the current league are mirrored. Re-running the
script after raising MAX_DEX fetches what is missing and never re-downloads
existing files.
