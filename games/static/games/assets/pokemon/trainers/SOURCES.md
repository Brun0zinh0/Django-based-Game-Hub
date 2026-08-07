# Trainer sprite sources

The trainer PNG files in `showdown/` and `showdown-all/` were downloaded without modification from the
[Pokemon Showdown trainer sprite index](https://play.pokemonshowdown.com/sprites/trainers/)
on 2026-08-02.

- `showdown/` contains the 31 categorized sprites currently used by Kanto battles.
- `showdown-all/` mirrors all 1,500 PNG entries exposed by the live directory.
- `showdown-all-manifest.json` records every filename, byte size, source, and download result.

The full archive is not fetched by the browser at startup; it is available for
future league categorization without increasing the current game's load time.

Pokemon Showdown notes that many trainer sprites are community-created, that the
appropriate artist must be credited, and that those sprites must not be edited
without permission. The live credited view at the source URL is the authoritative
per-file credit record. This project keeps the downloaded PNG files unedited and
records the active subset in `games/static/games/data/pokemon/trainers.json`.
