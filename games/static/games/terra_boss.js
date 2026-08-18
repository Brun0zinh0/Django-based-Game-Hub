/* Terra Boss — endless Terraria-style boss-rush roguelike.
 *
 * Phase 1 skeleton: menus + meta save + a playable placeholder arena.
 * All content (weapons, mobs, bosses, characters) comes from the JSON files
 * under games/data/terra/; this file only interprets it. Placeholder art is
 * generated at runtime; real sprites replace it in the content phase.
 */
(() => {
    "use strict";

    const app = document.getElementById("terra-boss-app");
    if (!app) {
        return;
    }

    // Sprite files are re-cut in place, so their URLs need a version too:
    // without it the browser keeps serving the old art while the manifest
    // describes the new geometry, and Phaser reads the wrong frame count.
    const ASSET_VERSION = app.dataset.assetVersion
        ? `?v=${app.dataset.assetVersion}`
        : "";

    const DATA_URLS = {
        weapons: app.dataset.weaponsUrl,
        armor: app.dataset.armorUrl,
        accessories: app.dataset.accessoriesUrl,
        characters: app.dataset.charactersUrl,
        bosses: app.dataset.bossesUrl,
        rounds: app.dataset.roundsUrl,
    };

    const SAVE_KEY = "terraBossSave.v1";
    const VIEW_WIDTH = 960;
    const VIEW_HEIGHT = 540;
    // The ground is built in columns so it can rise and fall. 48 is wide
    // enough that the arena is a few dozen bodies rather than hundreds, and
    // narrow enough that a slope reads as a slope.
    const GROUND_COLUMN = 48;
    // The tallest step the ground may take between two columns. Walkers jump
    // when blocked and slimes hop, but only clear so much; anything taller
    // than this is a wall that strands them.
    const STEP_LIMIT = 24;
    // How much of a fight has to be airborne before the arena grows ledges.
    const AIRBORNE_FOR_PLATFORMS = 0.25;
    // A corridor fight runs this many screens end to end. The Wall of Flesh
    // is a chase, and a chase needs somewhere to run to.
    const CORRIDOR_SCREENS = 4;
    // Terraria's life maths: you start on five 20-point hearts and Life
    // Crystals add one heart each, so max life is always a multiple of 20.
    const PLAYER_MAX_HP = 100;
    const HP_PER_HEART = 20;
    // Terraria's row length, and this game shares its 20-per-heart
    // scale and 400 ceiling -- so a full loadout is two rows of ten.
    const HEARTS_PER_ROW = 10;
    // Raised as backdrops were added; every one listed by a biome has to
    // be preloaded or the arena falls back to a flat colour.
    const BACKGROUND_COUNT = 33;
    // How much likelier a mob is to show up in a biome it belongs to.
    const BIOME_WEIGHT_BONUS = 5;
    // Terraria art is drawn 1:1 (16px tiles, 40x56 player frames). Every
    // sprite uses this one scale, so their relative sizes are exactly the
    // game's — inventing per-entity sizes is what made slimes tower over the
    // player. Change this to zoom the whole arena, never a single entity.
    const WORLD_SCALE = 1;
    // No projectile gets a hitbox thinner than this. Purely a fairness floor:
    // a shot the player aimed correctly should connect.
    const PROJECTILE_MIN_HITBOX = 8;
    // A yoyo hangs on the string and works, the way Terraria's do, rather than
    // snapping home on first contact.
    const YOYO_TICK_MS = 240;
    const YOYO_LIFETIME_MS = 2600;
    // How close counts as "on" a target. Wide enough that a moving mob does not
    // shake the yoyo off every other frame.
    const YOYO_GRIP_PX = 34;

    // Sound is optional: the game must run identically if the module is absent.
    const audio = window.TerraBossAudio || {
        play() {}, setMuted() {}, isMuted: () => false, unlock() {},
        playMusic() {}, stopMusic() {}, currentMusic: () => null,
    };

    const data = {};
    let save = null;
    let game = null;

    /* ---------- save management ---------- */

    function defaultSave() {
        return {
            version: 1,
            souls: 0,
            muted: false,
            lastCharacter: "guide",
            unlockedCharacters: ["guide"],
            unlockedCategories: ["bow"],
            achievements: [],
            lastDifficulty: "journey",
            // The player's overrides of what index.json says about each pack.
            // Two lists rather than one, because the index has its own default
            // per pack: with only a "disabled" list there is no way to say
            // "turn on the one the index ships switched off". A pack in
            // neither list follows the index.
            disabledPacks: [],
            enabledPacks: [],
            // Best round reached on each difficulty; what unlocks the next.
            difficultyBest: {},
            // id -> times defeated / times carried into a round.
            bestiary: {},
            weaponry: {},
            stats: { bestRound: 0, totalRuns: 0, totalKills: 0, totalCoins: 0 },
        };
    }

    /**
     * Rebuild a save field by field, keeping only values of the right shape.
     *
     * Merging over the defaults is not enough: a field of the wrong type is
     * copied straight over its default, and the failure is silent and far
     * away. A string where `achievements` should be an array does not throw
     * until a menu calls .includes on it and simply refuses to open.
     */
    function sanitiseSave(parsed) {
        const base = defaultSave();
        const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);
        const ids = (value, fallback) => (
            Array.isArray(value)
                ? value.filter((entry) => typeof entry === "string")
                : fallback.slice()
        );
        const tally = (value) => {
            const out = {};
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return out;
            }
            for (const [key, count] of Object.entries(value)) {
                if (Number.isFinite(count) && count > 0) {
                    out[key] = count;
                }
            }
            return out;
        };
        const stats = (parsed.stats && typeof parsed.stats === "object") ? parsed.stats : {};
        const characters = ids(parsed.unlockedCharacters, base.unlockedCharacters);
        return {
            version: number(parsed.version, base.version),
            souls: Math.max(0, number(parsed.souls, 0)),
            muted: Boolean(parsed.muted),
            lastCharacter: typeof parsed.lastCharacter === "string"
                ? parsed.lastCharacter
                : base.lastCharacter,
            // The free character is always available, whatever the save says,
            // so a mangled list can never leave you with nobody to play.
            unlockedCharacters: characters.includes(base.unlockedCharacters[0])
                ? characters
                : base.unlockedCharacters.concat(characters),
            unlockedCategories: ids(parsed.unlockedCategories, base.unlockedCategories),
            achievements: ids(parsed.achievements, []),
            disabledPacks: ids(parsed.disabledPacks, base.disabledPacks),
            enabledPacks: ids(parsed.enabledPacks, base.enabledPacks),
            lastDifficulty: typeof parsed.lastDifficulty === "string"
                ? parsed.lastDifficulty
                : base.lastDifficulty,
            difficultyBest: tally(parsed.difficultyBest),
            bestiary: tally(parsed.bestiary),
            weaponry: tally(parsed.weaponry),
            stats: {
                bestRound: Math.max(0, number(stats.bestRound, 0)),
                totalRuns: Math.max(0, number(stats.totalRuns, 0)),
                totalKills: Math.max(0, number(stats.totalKills, 0)),
                totalCoins: Math.max(0, number(stats.totalCoins, 0)),
            },
        };
    }

    function loadSave() {
        let raw = null;
        try {
            raw = window.localStorage.getItem(SAVE_KEY);
        } catch (error) {
            return defaultSave();
        }
        if (!raw) {
            return defaultSave();
        }
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") {
                throw new Error("bad shape");
            }
            return sanitiseSave(parsed);
        } catch (error) {
            // Keep the corrupt blob around for manual recovery, then start fresh.
            try {
                window.localStorage.setItem(`${SAVE_KEY}.backup`, raw);
            } catch (backupError) { /* storage full: nothing else to do */ }
            return defaultSave();
        }
    }

    function persistSave() {
        try {
            window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        } catch (error) { /* private mode / full storage: play on without saving */ }
    }

    /* ---------- data loading ---------- */

    async function fetchJson(url) {
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response.ok) {
            throw new Error(`${url} -> HTTP ${response.status}`);
        }
        return response.json();
    }

    async function loadAllData() {
        const entries = await Promise.all(
            Object.entries(DATA_URLS).map(async ([key, url]) => [key, await fetchJson(url)]),
        );
        for (const [key, value] of entries) {
            data[key] = value;
        }
    }

    /* ---------- content packs ----------
     *
     * Everything the game is made of is data, so extra content is data too: a
     * pack is one JSON file that adds entries to any of the lists below, or
     * replaces an existing entry by reusing its id. Nothing here knows what a
     * pack contains, which is the point -- new weapons, creatures, bosses,
     * biomes or characters need no engine changes.
     *
     * Each key maps to the data file it feeds, the list inside it, and how an
     * entry is identified.
     */
    const PACK_TARGETS = {
        weapons: ["weapons", "weapons"],
        consumables: ["rounds", "consumables"],
        mobs: ["rounds", "mobs"],
        bosses: ["bosses", "bosses"],
        characters: ["characters", "characters"],
        accessories: ["accessories", "accessories"],
        armorSets: ["armor", "sets"],
        biomes: ["biomes", "biomes"],
        layouts: ["biomes", "layouts"],
        achievements: ["achievements", "achievements"],
    };
    // Keyed objects rather than lists: merged key by key.
    const PACK_MAPS = {
        categories: ["weapons", "categories"],
        itemSprites: ["items", null],
        frameSprites: ["frames", null],
    };

    function mergePackList(pack, key, entries) {
        const [file, list] = PACK_TARGETS[key];
        const target = data[file] && data[file][list];
        if (!Array.isArray(target) || !Array.isArray(entries)) {
            return 0;
        }
        let count = 0;
        for (const entry of entries) {
            if (!entry || typeof entry.id !== "string") {
                console.warn(`Terra Boss: pack "${pack.id}" has a ${key} entry with no id`);
                continue;
            }
            const at = target.findIndex((existing) => existing.id === entry.id);
            if (at === -1) {
                target.push(entry);
            } else {
                // Same id replaces: this is how a pack rebalances base content.
                target[at] = Object.assign({}, target[at], entry);
            }
            count += 1;
        }
        return count;
    }

    function mergePackMap(key, entries) {
        const [file, list] = PACK_MAPS[key];
        const target = list ? (data[file] || {})[list] : data[file];
        if (!target || typeof entries !== "object") {
            return 0;
        }
        let count = 0;
        for (const [id, value] of Object.entries(entries)) {
            target[id] = value;
            count += 1;
        }
        return count;
    }

    /**
     * Fetch and merge every enabled pack. Never throws: a pack that is missing
     * or malformed is reported and skipped, and the base game plays on.
     */
    async function loadContentPacks(indexUrl) {
        const index = await fetchJson(indexUrl);
        // Every pack the index lists is fetched, including ones that are off,
        // so the packs screen can say what each would add. Only the ones that
        // are on get merged.
        const listed = ((index || {}).packs || []).filter((entry) => entry && entry.id);
        const base = indexUrl.slice(0, indexUrl.lastIndexOf("/packs/"));
        const loaded = [];
        for (const entry of listed) {
            if (!entry.file) {
                // Content may also sit inline in the index, for one-off tweaks.
                loaded.push(entry);
                continue;
            }
            try {
                const body = await fetchJson(`${base}/${entry.file}${ASSET_VERSION}`);
                loaded.push(Object.assign({}, entry, body));
            } catch (error) {
                console.warn(`Terra Boss: content pack "${entry.id}" failed to load`, error);
            }
        }
        return applyContentPacks(loaded);
    }

    /**
     * Is this pack on? The player's choice wins over the index's default, and
     * a pack the player has never touched follows the index. Disabled is
     * checked first so a save that somehow lists a pack in both stays off.
     */
    function packEnabled(pack) {
        if ((save.disabledPacks || []).includes(pack.id)) {
            return false;
        }
        if ((save.enabledPacks || []).includes(pack.id)) {
            return true;
        }
        return pack.enabled !== false;
    }

    /** Merge already-fetched packs into the loaded data. Never throws. */
    function applyContentPacks(packs) {
        const applied = [];
        for (const pack of packs || []) {
            if (!pack || !pack.id) {
                console.warn("Terra Boss: skipping a content pack with no id");
                continue;
            }
            // What it holds is counted whether or not it is switched on, so
            // the packs screen can describe one the player has turned off.
            const holds = {};
            for (const [key, entries] of Object.entries(pack)) {
                if ((PACK_TARGETS[key] || PACK_MAPS[key]) && entries) {
                    const size = Array.isArray(entries)
                        ? entries.length
                        : Object.keys(entries).length;
                    if (size) {
                        holds[key] = size;
                    }
                }
            }
            if (!packEnabled(pack)) {
                applied.push({
                    id: pack.id, name: pack.name || pack.id,
                    description: pack.description || "", merged: 0, holds, enabled: false,
                });
                continue;
            }

            let merged = 0;
            for (const [key, entries] of Object.entries(pack)) {
                try {
                    if (PACK_TARGETS[key]) {
                        merged += mergePackList(pack, key, entries);
                    } else if (PACK_MAPS[key]) {
                        merged += mergePackMap(key, entries);
                    }
                } catch (error) {
                    // A broken pack must never take the game down with it.
                    console.warn(`Terra Boss: pack "${pack.id}" failed on ${key}`, error);
                }
            }
            applied.push({
                id: pack.id, name: pack.name || pack.id,
                description: pack.description || "", merged, holds, enabled: true,
            });
        }
        if (applied.some((pack) => pack.enabled)) {
            // Bosses are picked by their position in this list, so anything a
            // pack adds lands after every base boss no matter how weak it is.
            // That put a 780 health boss on the round after Moon Lord, at a
            // seventh of the difficulty the player had just cleared. Order the
            // ladder by health instead, so a pack slots into the run where its
            // numbers say it belongs rather than on the end.
            const bosses = data.bosses && data.bosses.bosses;
            if (Array.isArray(bosses)) {
                bosses.sort((a, b) => a.hp - b.hp);
            }
        }
        data.packsApplied = applied;
        const live = applied.filter((pack) => pack.enabled);
        if (live.length) {
            console.info("Terra Boss content packs:",
                live.map((pack) => `${pack.name} (+${pack.merged})`).join(", "));
        }
        return applied;
    }

    const weaponById = (id) => (data.weapons.weapons || []).find((weapon) => weapon.id === id) || null;
    const characterById = (id) => (data.characters.characters || []).find((c) => c.id === id) || null;

    // What each weapon category fires: a real item/projectile sprite when it
    // loaded, otherwise the generated placeholder. "align" keeps the art
    // pointing along its velocity (Terraria projectile art points up).
    // How much of its inventory icon a shot draws at. The icons are sized to
    // be legible in a slot; in flight they only have to read as a shot.
    const PROJECTILE_ART_SCALE = 0.6;
    // The most coin sprites one kill may put on the floor, however rich it is.
    const COIN_DROP_MAX = 12;

    const PROJECTILE_ART = {
        bow: { item: "arrow", align: true },
        gun: { item: "bullet", align: true },
        // "self": the projectile IS the item, so it uses the weapon's own icon
        // rather than one stand-in for the whole category. True of the things
        // you throw; a launcher still fires a rocket, not itself.
        throwable: { item: "grenade", spin: true, self: true },
        launcher: { item: "grenade", spin: true },
        yoyo: { item: "wooden-yoyo", spin: true, self: true },
        staff: { generated: "tb-bolt" },
    };

    // Animation ranges other than "walk" (e.g. Plantera's calm/enraged).
    function namedRanges(spec) {
        return Object.entries((spec && spec.anims) || {})
            .filter(([name, range]) => name !== "walk" && Array.isArray(range))
            .map(([name]) => name);
    }

    function mergeMultipliers(target, source) {
        for (const [key, value] of Object.entries(source || {})) {
            target[key] = (target[key] || 1) * value;
        }
    }

    function mergeAdditive(target, source) {
        for (const [key, value] of Object.entries(source || {})) {
            target[key] = (target[key] || 0) + value;
        }
    }

    /* ---------- screens ---------- */

    // Every panel showScreen can switch between. A panel missing from this
    // list is never unhidden, so showing it just blanks the page.
    const screens = [
        "tb-loading", "tb-menu", "tb-characters", "tb-unlocks",
        "tb-bestiary", "tb-weaponry", "tb-feats", "tb-packs",
        "tb-summary", "tb-shop", "tb-game",
    ];

    // Screens a player opens off the menu and expects to back out of. The menu
    // itself is where Escape would take you, so it is not in the list.
    const DISMISSABLE = new Set([
        "tb-characters", "tb-unlocks", "tb-bestiary", "tb-weaponry", "tb-feats",
        "tb-packs",
    ]);
    let openScreen = null;

    function showScreen(id) {
        for (const screenId of screens) {
            document.getElementById(screenId).hidden = screenId !== id;
        }
        openScreen = id;
        // Menus and the codex are calm. The arena picks its own mood as the
        // round starts, so leave it alone.
        if (id !== "tb-loading" && id !== "tb-game") {
            audio.playMusic("menu");
        }
        if (DISMISSABLE.has(id)) {
            // Put the keyboard somewhere inside what just opened. Without this
            // focus stays on the body and tabbing starts from the top of the
            // page rather than from the panel the player is looking at.
            const panel = document.getElementById(id);
            const first = panel.querySelector(
                ".tb-close, button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
            );
            if (first) {
                first.focus({ preventScroll: true });
            }
        }
    }

    // Escape backs out of any screen opened off the menu. The in-run gear
    // panel has its own handler on the Phaser keyboard, which only fires while
    // the canvas holds focus.
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !DISMISSABLE.has(openScreen)) {
            return;
        }
        event.preventDefault();
        showScreen("tb-menu");
    });

    function updateMuteButton() {
        const button = document.getElementById("tb-mute");
        if (!button) {
            return;
        }
        const muted = Boolean(save && save.muted);
        button.textContent = muted ? "🔇" : "🔊";
        button.setAttribute("aria-pressed", String(muted));
        button.title = muted ? "Sound off" : "Sound on";
    }

    function updateSoulsChip() {
        document.getElementById("tb-souls-value").textContent = String(save.souls);
    }

    function updateMenuBest() {
        const best = document.getElementById("tb-menu-best");
        if (save.stats.bestRound > 0) {
            best.hidden = false;
            best.textContent = `Best: round ${save.stats.bestRound} · ${save.stats.totalRuns} runs`;
        } else {
            best.hidden = true;
        }
    }

    /* ---------- character + unlock menus ---------- */

    function characterUnlockState(character) {
        if (save.unlockedCharacters.includes(character.id)) {
            return { unlocked: true };
        }
        const unlock = character.unlock || { type: "free" };
        if (unlock.type === "free") {
            return { unlocked: true };
        }
        if (unlock.type === "achievement") {
            return {
                unlocked: save.achievements.includes(unlock.achievement),
                label: "Secret feat",
            };
        }
        return { unlocked: false, cost: unlock.cost, label: `${unlock.cost} ☄` };
    }

    function renderCharacterList() {
        const list = document.getElementById("tb-character-list");
        list.textContent = "";
        for (const character of data.characters.characters || []) {
            const state = characterUnlockState(character);
            const item = document.createElement("li");
            item.classList.toggle("is-locked", !state.unlocked);

            const swatch = document.createElement("span");
            swatch.className = "tb-card-swatch";
            if (character.sprite && character.sprite !== "placeholder") {
                // Locked NPCs still show their portrait, darkened — you should
                // see who you are saving up for.
                const portrait = document.createElement("img");
                portrait.src = spritePath(character.sprite);
                portrait.alt = "";
                swatch.append(portrait);
                // Was a hardcoded dark green the repalette missed. Read from
                // the palette so it cannot fall out of step again.
                swatch.style.background = token("--tb-bg-deep", "#080a16");
                swatch.classList.toggle("is-locked-art", !state.unlocked);
            } else {
                swatch.style.background = character.color || token("--tb-accent", "#7d9cff");
                swatch.textContent = state.unlocked ? "☺" : "🔒";
            }

            const body = document.createElement("div");
            body.className = "tb-card-body";
            const name = document.createElement("strong");
            name.textContent = character.name;
            const details = document.createElement("small");
            const weapon = weaponById(character.startingWeapon);
            details.textContent =
                `${character.ability.name} — ${character.ability.description}` +
                (weapon ? ` Starts with: ${weapon.name}.` : "");
            body.append(name, details);

            const stateBox = document.createElement("span");
            stateBox.className = "tb-card-state";
            if (state.unlocked) {
                const play = document.createElement("button");
                play.className = "tb-button tb-play";
                play.textContent = "Play";
                play.addEventListener("click", () => startRun(character.id));
                stateBox.append(play);
            } else if (state.cost !== undefined) {
                const buy = document.createElement("button");
                buy.className = "tb-button";
                buy.textContent = `Unlock ${state.label}`;
                buy.disabled = save.souls < state.cost;
                buy.addEventListener("click", () => {
                    if (save.souls < state.cost) {
                        return;
                    }
                    save.souls -= state.cost;
                    save.unlockedCharacters.push(character.id);
                    persistSave();
                    updateSoulsChip();
                    renderCharacterList();
                });
                stateBox.append(buy);
            } else {
                stateBox.textContent = state.label || "Locked";
            }

            item.append(swatch, body, stateBox);
            list.append(item);
        }
    }

    function renderFeats() {
        const list = document.getElementById("tb-feat-list");
        list.textContent = "";
        const all = (data.achievements || {}).achievements || [];
        const earned = all.filter((feat) => save.achievements.includes(feat.id));

        document.getElementById("tb-feats-progress").textContent =
            `${earned.length}/${all.length}`;

        // Earned first: the list is mostly locked early on, and burying what
        // you have managed under twenty things you have not is discouraging.
        const ordered = [
            ...earned,
            ...all.filter((feat) => !save.achievements.includes(feat.id)),
        ];
        for (const feat of ordered) {
            const done = save.achievements.includes(feat.id);
            const item = document.createElement("li");
            item.classList.toggle("is-locked", !done);

            const swatch = document.createElement("span");
            swatch.className = "tb-card-swatch";
            swatch.style.background = done
                ? token("--tb-accent", "#7d9cff")
                : token("--tb-panel-edge", "#343a5e");
            swatch.textContent = done ? "✔" : "🔒";

            const body = document.createElement("div");
            body.className = "tb-card-body";
            const name = document.createElement("strong");
            name.textContent = feat.name;
            const details = document.createElement("small");
            details.textContent = feat.description;
            body.append(name, details);

            const state = document.createElement("span");
            state.className = "tb-card-state";
            state.textContent = done ? "Earned" : "";

            item.append(swatch, body, state);
            list.append(item);
        }
    }

    // What each pack key is called on the card, in the order a player cares.
    const PACK_LABELS = [
        ["bosses", "boss", "bosses"],
        ["weapons", "weapon", "weapons"],
        ["mobs", "enemy", "enemies"],
        ["armorSets", "armour set", "armour sets"],
        ["accessories", "accessory", "accessories"],
        ["consumables", "consumable", "consumables"],
        ["characters", "character", "characters"],
        ["biomes", "biome", "biomes"],
        ["layouts", "arena", "arenas"],
        ["achievements", "feat", "feats"],
    ];

    function packSummary(holds) {
        const parts = [];
        for (const [key, one, many] of PACK_LABELS) {
            const n = holds[key];
            if (n) {
                parts.push(`${n} ${n === 1 ? one : many}`);
            }
        }
        return parts.length ? parts.join(" · ") : "nothing the game reads";
    }

    function renderPackList() {
        const list = document.getElementById("tb-pack-list");
        list.textContent = "";
        const packs = data.packsApplied || [];
        if (!packs.length) {
            const empty = document.createElement("li");
            empty.className = "tb-slot-empty-note";
            empty.textContent = "No packs installed. Drop one under data/terra/packs "
                + "and list it in index.json.";
            list.append(empty);
            return;
        }
        for (const pack of packs) {
            const row = document.createElement("li");
            row.classList.toggle("is-locked", !pack.enabled);

            const swatch = document.createElement("span");
            swatch.className = "tb-card-swatch "
                + (pack.enabled ? "tb-pack-swatch-on" : "tb-pack-swatch-off");
            swatch.textContent = pack.enabled ? "✔" : "✕";
            // Decorative: the toggle beside it already says which way it is.
            swatch.setAttribute("aria-hidden", "true");

            const body = document.createElement("div");
            body.className = "tb-card-body";
            const name = document.createElement("strong");
            name.textContent = pack.name;
            const note = document.createElement("small");
            note.textContent = pack.description
                ? `${pack.description} — ${packSummary(pack.holds || {})}`
                : packSummary(pack.holds || {});
            body.append(name, note);

            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "tb-button";
            toggle.textContent = pack.enabled ? "Turn off" : "Turn on";
            // Both rows read "Turn off" out of context, so name the pack.
            toggle.setAttribute(
                "aria-label", `${pack.enabled ? "Turn off" : "Turn on"} ${pack.name}`,
            );
            toggle.addEventListener("click", () => {
                const want = !pack.enabled;
                // Written to the list for the direction asked for and cleared
                // from the other, so the two can never disagree.
                const off = new Set(save.disabledPacks || []);
                const on = new Set(save.enabledPacks || []);
                off.delete(pack.id);
                on.delete(pack.id);
                (want ? on : off).add(pack.id);
                save.disabledPacks = [...off];
                save.enabledPacks = [...on];
                persistSave();
                // Content is merged once, before anything starts, so the only
                // honest way to apply a change is to load again.
                window.location.reload();
            });

            row.append(swatch, body, toggle);
            list.append(row);
        }
    }

    function renderUnlockList() {
        const list = document.getElementById("tb-unlock-list");
        list.textContent = "";
        for (const [id, category] of Object.entries(data.weapons.categories || {})) {
            const unlocked = save.unlockedCategories.includes(id) || category.startsUnlocked;
            const item = document.createElement("li");
            item.classList.toggle("is-locked", !unlocked);

            const swatch = document.createElement("span");
            swatch.className = "tb-card-swatch";
            swatch.style.background = unlocked
                ? token("--tb-accent", "#7d9cff")
                : token("--tb-panel-edge", "#343a5e");
            swatch.textContent = unlocked ? "✔" : "🔒";

            const body = document.createElement("div");
            body.className = "tb-card-body";
            const name = document.createElement("strong");
            name.textContent = category.name;
            const details = document.createElement("small");
            details.textContent = category.description;
            body.append(name, details);

            const stateBox = document.createElement("span");
            stateBox.className = "tb-card-state";
            if (unlocked) {
                stateBox.textContent = "Unlocked";
            } else {
                const buy = document.createElement("button");
                buy.className = "tb-button";
                buy.textContent = `Unlock ${category.soulCost} ☄`;
                buy.disabled = save.souls < category.soulCost;
                buy.addEventListener("click", () => {
                    if (save.souls < category.soulCost) {
                        return;
                    }
                    save.souls -= category.soulCost;
                    save.unlockedCategories.push(id);
                    persistSave();
                    updateSoulsChip();
                    renderUnlockList();
                });
                stateBox.append(buy);
            }

            item.append(swatch, body, stateBox);
            list.append(item);
        }
    }

    /* ---------- run lifecycle ---------- */

    const difficultyList = () => (data.difficulties || {}).difficulties || [];

    /**
     * How far up the ladder the player has earned. A level opens once the one
     * below it has been taken to its unlockRound, so the ladder is climbed
     * rather than chosen.
     */
    function unlockedDifficulties() {
        const all = difficultyList();
        const open = [];
        for (let i = 0; i < all.length; i += 1) {
            if (i === 0) {
                open.push(all[i]);
                continue;
            }
            const below = all[i - 1];
            const reached = (save.difficultyBest || {})[below.id] || 0;
            if (reached < (all[i].unlockRound || Infinity)) {
                break;
            }
            open.push(all[i]);
        }
        return open;
    }

    /** Cycle through what is unlocked, and show what the next rung needs. */
    function renderDifficultyButton() {
        const button = document.getElementById("tb-difficulty");
        if (!button) {
            return;
        }
        const all = difficultyList();
        if (all.length < 2) {
            button.hidden = true;
            return;
        }
        const open = unlockedDifficulties();
        const active = currentDifficulty();
        button.hidden = false;
        button.textContent = `Difficulty: ${active.name}`;
        const next = all[open.length];
        button.title = next
            ? `${active.description || ""} — reach round ${next.unlockRound} `
              + `on ${open[open.length - 1].name} to unlock ${next.name}`
            : (active.description || "");
        button.classList.toggle("is-hard", open.indexOf(active) > 1);
    }

    function cycleDifficulty() {
        const open = unlockedDifficulties();
        if (open.length < 2) {
            return;
        }
        const at = open.findIndex((entry) => entry.id === save.lastDifficulty);
        save.lastDifficulty = open[(at + 1) % open.length].id;
        persistSave();
        renderDifficultyButton();
    }

    function currentDifficulty() {
        const open = unlockedDifficulties();
        return open.find((entry) => entry.id === save.lastDifficulty) || open[0] || {
            id: "journey", name: "Journey", enemyHp: 1, enemyDamage: 1, soulReward: 1,
        };
    }

    function startRun(characterId) {
        const character = characterById(characterId) || characterById("guide");
        save.lastCharacter = character.id;
        persistSave();
        showScreen("tb-game");
        const scene = new ArenaScene(character, currentDifficulty());
        game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: "tb-canvas",
            width: VIEW_WIDTH,
            height: VIEW_HEIGHT,
            backgroundColor: "#0b1d2e",
            pixelArt: true,
            physics: {
                default: "arcade",
                arcade: { gravity: { y: (data.rounds.player || {}).gravity || 1440 } },
            },
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
            scene,
        });
    }

    function endRun(result) {
        closeGear();
        closeShop();
        if (game) {
            game.destroy(true);
            game = null;
        }
        const rewards = data.rounds.rewards || {};
        const soulsGained = Math.round((
            (result.roundsCleared * (rewards.soulsPerRoundCleared ?? 3)) +
            (result.bossKills * (rewards.soulsPerBossKill ?? 10)) +
            Math.floor(result.kills / (rewards.killsPerSoul ?? 5))
        ) * (result.soulReward || 1));

        save.souls += soulsGained;
        save.stats.totalRuns += 1;
        save.stats.totalKills += result.kills;
        save.stats.totalCoins += result.coins;
        save.stats.bestRound = Math.max(save.stats.bestRound, result.roundsCleared);
        if (result.difficulty) {
            save.difficultyBest[result.difficulty] = Math.max(
                save.difficultyBest[result.difficulty] || 0,
                result.roundsCleared,
            );
        }
        for (const [id, count] of Object.entries(result.defeated || {})) {
            save.bestiary[id] = (save.bestiary[id] || 0) + count;
        }
        for (const [id, count] of Object.entries(result.weaponsUsed || {})) {
            save.weaponry[id] = (save.weaponry[id] || 0) + count;
        }
        for (const achievement of result.achievements) {
            if (!save.achievements.includes(achievement)) {
                save.achievements.push(achievement);
            }
        }
        // Bestiary and weaponry are merged above, so feats measured against
        // the save see this run's contribution too.
        const earned = earnedAchievements(result);
        for (const achievement of earned) {
            if (!save.achievements.includes(achievement)) {
                save.achievements.push(achievement);
            }
        }
        persistSave();
        updateSoulsChip();
        updateMenuBest();
        renderDifficultyButton();

        document.getElementById("tb-summary-rounds").textContent = String(result.roundsCleared);
        document.getElementById("tb-summary-kills").textContent = String(result.kills);
        document.getElementById("tb-summary-coins").textContent = String(result.coins);
        document.getElementById("tb-summary-souls").textContent = `+${soulsGained} ☄`;
        showScreen("tb-summary");
    }

    /* ---------- codex screens (bestiary / weaponry) ---------- */

    const CODEX_ICON_BOX = 58;

    function spritePath(file) {
        return `${app.dataset.staticPrefix}games/assets/terra/sprites/${file}${ASSET_VERSION}`;
    }

    /**
     * Does this entry point at a picture we can draw?
     *
     * This used to be a check for the "items/" prefix, which quietly meant a
     * pack could only use the base game's art: a pack shipping its own under
     * its own folder passed the sprite through, failed the prefix test, and
     * drew a "?" with no error anywhere.
     */
    function hasArt(sprite) {
        return typeof sprite === "string" && sprite.toLowerCase().endsWith(".png");
    }

    /**
     * An icon showing frame 0 of an animation strip. The strips are laid out
     * horizontally, so the element is sized to one frame and the background is
     * scaled to match — anything past the first frame stays outside the box.
     */
    function buildSpriteIcon(skinId, defeated) {
        const icon = document.createElement("span");
        icon.className = "tb-codex-icon";
        const spec = (data.frames || {})[skinId];
        if (!spec) {
            icon.textContent = "?";
            return icon;
        }
        const scale = Math.min(
            CODEX_ICON_BOX / spec.frameWidth,
            CODEX_ICON_BOX / spec.frameHeight,
            2,
        );
        icon.style.width = `${Math.round(spec.frameWidth * scale)}px`;
        icon.style.height = `${Math.round(spec.frameHeight * scale)}px`;
        icon.style.backgroundImage = `url("${spritePath(spec.file)}")`;
        icon.style.backgroundSize =
            `${spec.frameWidth * spec.frames * scale}px ${spec.frameHeight * scale}px`;
        icon.style.backgroundPosition = "left top";
        icon.classList.toggle("is-undiscovered", !defeated);
        return icon;
    }

    function buildCodexCard({ icon, name, detail, discovered }) {
        const card = document.createElement("li");
        card.className = "tb-codex-card";
        card.classList.toggle("is-undiscovered", !discovered);

        const frame = document.createElement("span");
        frame.className = "tb-codex-frame";
        frame.append(icon);

        const label = document.createElement("strong");
        label.textContent = discovered ? name : "???";
        const note = document.createElement("small");
        note.textContent = detail;

        card.append(frame, label, note);
        return card;
    }

    function renderBestiary() {
        const tally = save.bestiary || {};
        const sections = [
            ["tb-bestiary-bosses", data.bosses.bosses || []],
            ["tb-bestiary-mobs", data.rounds.mobs || []],
        ];
        let discoveredCount = 0;
        let total = 0;
        for (const [listId, entries] of sections) {
            const list = document.getElementById(listId);
            list.textContent = "";
            for (const entry of entries) {
                const kills = tally[entry.id] || 0;
                const discovered = kills > 0;
                total += 1;
                if (discovered) {
                    discoveredCount += 1;
                }
                const skinId = (entry.skin || {}).id;
                list.append(buildCodexCard({
                    icon: buildSpriteIcon(skinId, discovered),
                    name: entry.name,
                    detail: discovered ? `${kills} defeated` : "Not yet defeated",
                    discovered,
                }));
            }
        }
        document.getElementById("tb-bestiary-progress").textContent =
            `${discoveredCount} / ${total} discovered`;
    }

    function renderWeaponry() {
        const tally = save.weaponry || {};
        const container = document.getElementById("tb-weaponry-groups");
        container.textContent = "";
        const categories = data.weapons.categories || {};
        let used = 0;
        const weapons = data.weapons.weapons || [];

        for (const [categoryId, category] of Object.entries(categories)) {
            const inCategory = weapons.filter((weapon) => weapon.category === categoryId);
            if (!inCategory.length) {
                continue;
            }
            const unlocked = save.unlockedCategories.includes(categoryId) || category.startsUnlocked;

            const heading = document.createElement("h3");
            heading.className = "tb-codex-heading";
            heading.textContent = category.name;
            if (!unlocked) {
                const lock = document.createElement("span");
                lock.className = "tb-codex-locked-tag";
                lock.textContent = "locked";
                heading.append(" ", lock);
            }

            const list = document.createElement("ul");
            list.className = "tb-codex-grid";
            for (const weapon of inCategory) {
                const times = tally[weapon.id] || 0;
                const discovered = times > 0;
                if (discovered) {
                    used += 1;
                }
                const icon = document.createElement("span");
                icon.className = "tb-codex-icon tb-codex-icon-item";
                if (hasArt(weapon.sprite)) {
                    const image = document.createElement("img");
                    image.src = spritePath(weapon.sprite);
                    image.alt = "";
                    icon.append(image);
                } else {
                    icon.textContent = "?";
                }
                icon.classList.toggle("is-undiscovered", !discovered);
                list.append(buildCodexCard({
                    icon,
                    name: weapon.name,
                    detail: discovered
                        ? `${weapon.damage} dmg · carried ${times}×`
                        : (unlocked ? "Never carried" : "Category locked"),
                    discovered,
                }));
            }
            container.append(heading, list);
        }
        document.getElementById("tb-weaponry-progress").textContent =
            `${used} / ${weapons.length} carried`;
    }

    /* ---------- equipment screen ---------- */

    const gearUi = {
        panel: document.getElementById("tb-gear"),
        gearPanel: document.getElementById("tb-gear-panel"),
        inventoryPanel: document.getElementById("tb-inventory-panel"),
        weapons: document.getElementById("tb-gear-weapons"),
        armor: document.getElementById("tb-gear-armor"),
        accessories: document.getElementById("tb-gear-accessories"),
        ammo: document.getElementById("tb-gear-ammo"),
        stash: document.getElementById("tb-gear-stash"),
        stats: document.getElementById("tb-gear-stats"),
        inventoryHint: document.getElementById("tb-inventory-hint"),
        inventoryCoins: document.querySelector("#tb-inventory-coins b"),
        close: document.getElementById("tb-gear-close"),
    };
    let gearScene = null;

    /** Move the gear and inventory panels into whichever screen is showing. */
    function dockPanels(where) {
        const gearDock = document.getElementById(`tb-gear-dock-${where}`);
        const inventoryDock = document.getElementById(`tb-inventory-dock-${where}`);
        gearDock.append(gearUi.gearPanel);
        inventoryDock.append(gearUi.inventoryPanel);
        // The close button belongs to the standalone screen only; between
        // rounds the shop's own buttons move you on.
        gearUi.close.hidden = where === "shop";
    }

    // The template declares both panels at the app root so either screen can
    // claim them. Park them in the (hidden) equipment screen straight away, or
    // they hang loose under the main menu until something docks them.
    dockPanels("solo");

    function sellPrice(kind, item) {
        const ratio = (data.rounds.shop || {}).sellRatio || 0.2;
        const base = item.price || 0;
        return Math.max(1, Math.floor(base * ratio));
    }

    function itemIcon(item) {
        const icon = document.createElement("span");
        icon.className = "tb-slot-icon";
        if (item && hasArt(item.sprite)) {
            const image = document.createElement("img");
            image.src = spritePath(item.sprite);
            image.alt = "";
            icon.append(image);
        }
        return icon;
    }

    /** One equipment slot: filled slots are clickable to take the item off. */
    function buildSlot({ item, emptyLabel, onClick, subtitle }) {
        const slot = document.createElement("li");
        slot.className = "tb-slot";
        slot.classList.toggle("is-empty", !item);

        const box = document.createElement("button");
        box.className = "tb-slot-box";
        box.type = "button";
        box.disabled = !item;
        if (item) {
            box.append(itemIcon(item));
            box.title = `${item.name} — click to unequip`;
            box.addEventListener("click", onClick);
            attachTip(box, item, emptyLabel);
        } else {
            // An empty slot is still a button in the tree, and without this it
            // announces as nothing at all.
            box.setAttribute("aria-label", `${emptyLabel}: empty`);
        }

        const label = document.createElement("span");
        label.className = "tb-slot-label";
        const name = document.createElement("strong");
        name.textContent = item ? item.name : emptyLabel;
        const note = document.createElement("small");
        note.textContent = item ? subtitle(item) : "empty";
        label.append(name, note);

        slot.append(box, label);
        return slot;
    }

    function weaponSubtitle(weapon) {
        const category = (data.weapons.categories[weapon.category] || {}).name || weapon.category;
        // Damage alone no longer tells you what a weapon is worth: a shotgun's
        // 14 lands four times over, and a staff's is capped by the mana bar.
        const parts = [category, `${weapon.damage} dmg`];
        if (weapon.shots > 1) {
            parts.push(`×${weapon.shots}`);
        }
        if (weapon.manaCost) {
            parts.push(`${weapon.manaCost} mana`);
        }
        if (weapon.splashRadius) {
            parts.push("splash");
        }
        return parts.join(" · ");
    }

    function armorSubtitle(piece) {
        return `${piece.slot} · +${piece.defense} def`;
    }

    function renderGearStats(scene) {
        const loadout = scene.loadout;
        const rows = [["Defense", String(loadout.defense)]];

        const worn = Object.values(scene.armor).filter(Boolean);
        const sets = new Set(worn.map((piece) => piece.setId));
        if (worn.length === 3 && sets.size === 1) {
            rows.push(["Set bonus", (worn[0].setBonus || {}).description || "active"]);
        } else if (worn.length) {
            rows.push(["Set bonus", `${worn.length}/3 pieces`]);
        }
        if (loadout.moveSpeedMultiplier !== 1) {
            rows.push(["Move speed", `${Math.round(loadout.moveSpeedMultiplier * 100)}%`]);
        }
        if (loadout.extraJumps) {
            rows.push(["Extra jumps", String(loadout.extraJumps)]);
        }
        if (loadout.regenPerSecond) {
            rows.push(["Regen", `${loadout.regenPerSecond}/s`]);
        }
        if (loadout.dash) {
            rows.push(["Dash", "Shift"]);
        }
        if (loadout.jumpMultiplier !== 1) {
            rows.push(["Jump height", `${Math.round(loadout.jumpMultiplier * 100)}%`]);
        }
        if (loadout.damageTakenMultiplier !== 1) {
            rows.push([
                "Damage taken",
                `${Math.round(loadout.damageTakenMultiplier * 100)}%`,
            ]);
        }
        for (const [category, multiplier] of Object.entries(loadout.damageMultiplier)) {
            const name = (data.weapons.categories[category] || {}).name || category;
            rows.push([`${name} damage`, `${Math.round(multiplier * 100)}%`]);
        }
        for (const [category, bonus] of Object.entries(loadout.critBonus)) {
            if (!bonus) {
                continue;
            }
            const name = (data.weapons.categories[category] || {}).name || category;
            rows.push([`${name} crit`, `+${Math.round(bonus * 100)}%`]);
        }
        if (loadout.superseded) {
            // Boots and shields are upgrade chains; wearing two does nothing
            // for the weaker one, so say so rather than let it look active.
            rows.push([
                "Doing nothing",
                `${loadout.superseded} outclassed by a better one`,
            ]);
        }

        gearUi.stats.textContent = "";
        for (const [term, value] of rows) {
            const row = document.createElement("div");
            const dt = document.createElement("dt");
            dt.textContent = term;
            const dd = document.createElement("dd");
            dd.textContent = value;
            row.append(dt, dd);
            gearUi.stats.append(row);
        }
    }

    function renderGear() {
        const scene = gearScene;
        if (!scene) {
            return;
        }

        gearUi.weapons.textContent = "";
        scene.weaponSlots.forEach((weapon, index) => {
            const slot = buildSlot({
                item: weapon,
                emptyLabel: `Weapon ${index + 1}`,
                subtitle: weaponSubtitle,
                onClick: () => { scene.unequip("weapon", index); renderGear(); },
            });
            slot.classList.toggle("is-active", scene.activeSlot === index && Boolean(weapon));
            gearUi.weapons.append(slot);
        });

        gearUi.armor.textContent = "";
        for (const slotName of data.armor.slots) {
            gearUi.armor.append(buildSlot({
                item: scene.armor[slotName],
                emptyLabel: slotName,
                subtitle: armorSubtitle,
                onClick: () => { scene.unequip("armor", slotName); renderGear(); },
            }));
        }

        gearUi.accessories.textContent = "";
        const maxAccessories = data.accessories.maxEquipped || 5;
        for (let index = 0; index < maxAccessories; index += 1) {
            gearUi.accessories.append(buildSlot({
                item: scene.accessories[index] || null,
                emptyLabel: `Accessory ${index + 1}`,
                subtitle: (accessory) => accessory.description,
                onClick: () => { scene.unequip("accessory", index); renderGear(); },
            }));
        }

        gearUi.ammo.textContent = "";
        const families = (data.ammo || {}).families || {};
        for (const [family, label] of Object.entries(families)) {
            gearUi.ammo.append(buildSlot({
                item: scene.ammo[family],
                emptyLabel: label,
                subtitle: (entry) => entry.description,
                onClick: () => { scene.unequip("ammo", family); renderGear(); },
            }));
        }

        // Selling needs a vendor, so it is offered only while the shop is up.
        const vendorOpen = shopState !== null && !shopUi.panel.hidden;
        gearUi.inventoryHint.textContent = vendorOpen
            ? "Click an item to equip it, or sell it back to the shop."
            : "Click an item to equip it.";
        gearUi.inventoryCoins.textContent = String(scene.coinsCollected);

        gearUi.stash.textContent = "";
        if (!scene.stash.length) {
            const empty = document.createElement("li");
            empty.className = "tb-slot-empty-note";
            empty.textContent = "Empty. Gear you cannot wear yet waits here.";
            gearUi.stash.append(empty);
        }
        scene.stash.forEach((entry) => {
            const card = document.createElement("li");
            card.className = "tb-slot";
            const box = document.createElement("button");
            box.className = "tb-slot-box";
            box.type = "button";
            box.append(itemIcon(entry.item));
            const canEquip =
                (entry.kind === "weapon" && scene.weaponSlots.includes(null)) ||
                (entry.kind === "armor" && !scene.armor[entry.item.slot]) ||
                (entry.kind === "accessory" && scene.accessories.length < maxAccessories) ||
                entry.kind === "ammo";
            box.disabled = !canEquip;
            box.title = canEquip
                ? `${entry.item.name} — click to equip`
                : `${entry.item.name} — no free slot`;
            box.addEventListener("click", () => {
                if (scene.equipFromStash(entry.kind, entry.item.id)) {
                    audio.play("buy");
                    renderGear();
                }
            });

            const label = document.createElement("span");
            label.className = "tb-slot-label";
            const name = document.createElement("strong");
            name.textContent = entry.item.name;
            const note = document.createElement("small");
            note.textContent = entry.kind === "weapon"
                ? weaponSubtitle(entry.item)
                : (entry.kind === "armor" ? armorSubtitle(entry.item) : entry.item.description);
            label.append(name, note);
            card.append(box, label);

            if (vendorOpen) {
                const price = sellPrice(entry.kind, entry.item);
                const sell = document.createElement("button");
                sell.className = "tb-button tb-sell";
                sell.type = "button";
                sell.textContent = `Sell 🪙 ${price}`;
                sell.title = `Sell ${entry.item.name} for ${price}`;
                sell.addEventListener("click", () => {
                    if (scene.sellFromStash(entry.kind, entry.item.id, price)) {
                        audio.play("coin");
                        renderShop();
                        renderGear();
                    }
                });
                card.append(sell);
            }

            gearUi.stash.append(card);
        });

        renderGearStats(scene);
    }

    function openGear(scene) {
        if (!scene || scene.over) {
            return;
        }
        gearScene = scene;
        scene.paused = true;
        scene.physics.pause();
        dockPanels("solo");
        renderGear();
        gearUi.panel.hidden = false;
    }

    const bagUi = {
        panel: document.getElementById("tb-bag"),
        list: document.getElementById("tb-bag-list"),
        hint: document.getElementById("tb-bag-hint"),
    };
    let bagState = null;

    /** The item a drop entry points at, or null if it no longer exists. */
    function dropItem(entry) {
        if (entry.kind === "weapon") {
            return (data.weapons.weapons || []).find((w) => w.id === entry.id) || null;
        }
        if (entry.kind === "accessory") {
            return (data.accessories.accessories || []).find((a) => a.id === entry.id) || null;
        }
        if (entry.kind === "ammo") {
            return (data.ammo.ammo || []).find((a) => a.id === entry.id) || null;
        }
        return null;
    }

    function openBag(scene, boss, afterwards) {
        const pool = (boss.drops || [])
            .map((entry) => ({ kind: entry.kind, item: dropItem(entry) }))
            .filter((entry) => entry.item);
        if (!pool.length) {
            return false;
        }
        // Three face up, drawn without replacement. Fewer if the pool is small.
        const shuffled = pool.slice();
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        bagState = { scene, offers: shuffled.slice(0, 3), then: afterwards || null };
        scene.paused = true;
        scene.physics.pause();
        bagUi.hint.textContent = `${boss.name} left something behind. Take one.`;
        renderBag();
        bagUi.panel.hidden = false;
        return true;
    }

    function renderBag() {
        bagUi.list.textContent = "";
        for (const offer of bagState.offers) {
            const row = document.createElement("li");

            if (hasArt(offer.item.sprite)) {
                const icon = document.createElement("img");
                icon.className = "tb-shop-icon";
                icon.src = spritePath(offer.item.sprite);
                icon.alt = "";
                row.append(icon);
            }

            const body = document.createElement("div");
            body.className = "tb-card-body";
            const kind = document.createElement("small");
            kind.textContent = offer.kind;
            const name = document.createElement("strong");
            name.textContent = offer.item.name;
            const note = document.createElement("span");
            note.textContent = offer.kind === "weapon"
                ? weaponSubtitle(offer.item)
                : offer.item.description;
            body.append(kind, name, note);

            const take = document.createElement("button");
            take.type = "button";
            take.className = "tb-button tb-button-primary";
            take.textContent = "Take";
            take.addEventListener("click", () => takeFromBag(offer));

            row.append(body, take);
            bagUi.list.append(row);
        }
    }

    function takeFromBag(offer) {
        const scene = bagState && bagState.scene;
        if (!scene) {
            return;
        }
        if (offer.kind === "weapon") {
            scene.acquireWeapon(offer.item);
        } else if (offer.kind === "ammo") {
            scene.loadAmmo(offer.item);
        } else {
            scene.acquireAccessory(offer.item);
        }
        audio.play("buy");
        const then = bagState.then;
        bagUi.panel.hidden = true;
        bagState = null;
        scene.paused = false;
        scene.physics.resume();
        if (then) {
            then();
        }
    }

    function toggleGear(scene) {
        if (gearUi.panel.hidden) {
            openGear(scene);
        } else {
            closeGear();
        }
    }

    function closeGear() {
        gearUi.panel.hidden = true;
        if (gearScene && !gearScene.over) {
            gearScene.paused = false;
            // The shop pauses the arena too; leave it paused if it is open.
            if (shopUi.panel.hidden) {
                gearScene.physics.resume();
            }
        }
        gearScene = null;
    }

    /* ---------- between-round shop ---------- */

    /**
     * A palette token's current value.
     *
     * Swatches and chips are coloured from script, so they used to carry the
     * palette's old green as a literal and survived a restyle of the sheet
     * untouched. Reading the token keeps them honest.
     */
    function token(name, fallback) {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(name).trim();
        return value || fallback;
    }

    const shopUi = {
        panel: document.getElementById("tb-shop"),
        list: document.getElementById("tb-shop-list"),
        coins: document.getElementById("tb-shop-coins-value"),
        reroll: document.getElementById("tb-shop-reroll"),
        next: document.getElementById("tb-shop-continue"),
    };
    let shopState = null;

    function shopConfig() {
        return data.rounds.shop || {};
    }

    /**
     * Give a weapon a prefix, the way reforging does in Terraria.
     *
     * The prefix is baked into a copy of the weapon rather than carried
     * alongside it, so everything downstream -- firing, the gear screen, the
     * sell price, the codex -- keeps working without knowing prefixes exist.
     * The id keeps the base weapon's, so the shop still refuses to offer one
     * you are already carrying.
     */
    function forgeWeapon(weapon) {
        const all = (data.modifiers || {}).modifiers || [];
        if (!all.length) {
            return weapon;
        }
        const total = all.reduce((sum, entry) => sum + (entry.weight || 1), 0);
        let roll = Math.random() * total;
        let modifier = all[0];
        for (const entry of all) {
            roll -= entry.weight || 1;
            if (roll <= 0) {
                modifier = entry;
                break;
            }
        }
        if (!modifier.name) {
            return weapon;
        }
        const forged = Object.assign({}, weapon);
        forged.modifier = modifier.id;
        forged.name = `${modifier.name} ${weapon.name}`;
        if (modifier.damage) {
            forged.damage = Math.max(1, Math.round(weapon.damage * modifier.damage));
        }
        if (modifier.fireRate && weapon.fireRateMs) {
            forged.fireRateMs = Math.max(40, Math.round(weapon.fireRateMs * modifier.fireRate));
        }
        if (modifier.projectileSpeed && weapon.projectileSpeed) {
            forged.projectileSpeed = Math.round(weapon.projectileSpeed * modifier.projectileSpeed);
        }
        if (modifier.crit) {
            forged.critBonus = (weapon.critBonus || 0) + modifier.crit;
        }
        // A worse weapon is cheaper, which is the whole point of keeping the
        // bad prefixes: an Awful one you can afford beats a Deadly one you
        // cannot.
        forged.price = Math.max(1, Math.round(weapon.price * (modifier.price || 1)));
        return forged;
    }

    /** A character's ability, as data. Empty for anyone without one. */
    function abilityOf(character) {
        return ((character || {}).ability || {}).effects || {};
    }

    /**
     * Which measured feats this run satisfies.
     *
     * "awarded" ones are not checked here: the run hands those out as they
     * happen (a boss dying) and they arrive in result.achievements.
     */
    function earnedAchievements(result) {
        const categories = Object.keys(data.weapons.categories || {});
        const carried = Object.keys(save.weaponry || {});
        const carriedCategories = new Set(
            carried
                .map((id) => (data.weapons.weapons || []).find((w) => w.id === id))
                .filter(Boolean)
                .map((weapon) => weapon.category),
        );
        const measures = {
            roundsCleared: result.roundsCleared,
            killsInRun: result.kills,
            bossKillsInRun: result.bossKills,
            coinsInRun: result.coins,
            weaponsCarried: carried.length,
            bestiaryEntries: Object.keys(save.bestiary || {}).length,
        };
        return ((data.achievements || {}).achievements || [])
            .filter((achievement) => {
                const condition = achievement.condition || {};
                if (condition.awarded) {
                    return false;
                }
                if (condition.everyCategoryCarried) {
                    return categories.every((id) => carriedCategories.has(id));
                }
                return Object.entries(condition).every(
                    ([key, needed]) => (measures[key] || 0) >= needed,
                );
            })
            .map((achievement) => achievement.id);
    }

    function discountedPrice(scene, price) {
        const discount = abilityOf(scene.character).shopDiscount || 0;
        return Math.max(1, Math.round(price * (1 - discount)));
    }

    /**
     * What an offer costs right now. Repeatable consumables charge more each
     * time they are bought, so a coin sink that never caps cannot be farmed
     * cheaply forever.
     */
    function offerPrice(scene, offer) {
        const item = offer.item;
        let price = item.price;
        if (offer.kind === "consumable" && item.priceStep) {
            price += item.priceStep * (scene.consumablesBought[item.id] || 0);
        }
        return discountedPrice(scene, price);
    }

    function buildShopPools(scene) {
        const config = shopConfig();
        // Hardmode opens the shelf early, the way Terraria's hardmode ores do:
        // the gear that answers the harder world arrives with it rather than
        // several rounds later.
        const hardBonus = scene.hardmode
            ? ((data.rounds.hardmode || {}).tierBonus || 0)
            : 0;
        const maxTier = 1 + hardBonus + Math.floor(
            (scene.round + (config.tierRoundOffset || 0)) / (config.tierPerRounds || 3),
        );

        const unlockedCategories = new Set(save.unlockedCategories);
        for (const [id, category] of Object.entries(data.weapons.categories || {})) {
            if (category.startsUnlocked) {
                unlockedCategories.add(id);
            }
        }
        const slotWeaponIds = scene.weaponSlots.filter(Boolean).map((weapon) => weapon.id);
        // Hardmode gear does not exist before the world turns, whatever tier
        // it sits at. Tier already keeps most of it away, but a mod's hardmode
        // weapon can be cheap and would otherwise turn up on round one.
        const reachable = (entry) => !entry.hardmode || scene.hardmode;

        const weapons = (data.weapons.weapons || []).filter(
            (weapon) =>
                unlockedCategories.has(weapon.category) &&
                weapon.tier <= maxTier &&
                (weapon.price || 0) > 0 &&
                reachable(weapon) &&
                !slotWeaponIds.includes(weapon.id),
        );

        const ownedPieceIds = new Set(
            Object.values(scene.armor).filter(Boolean).map((piece) => piece.id),
        );
        const armor = [];
        for (const set of data.armor.sets || []) {
            if (set.tier > maxTier + 1) {
                continue;
            }
            if (!reachable(set)) {
                continue;
            }
            for (const piece of set.pieces) {
                if (!ownedPieceIds.has(piece.id)) {
                    armor.push({
                        ...piece,
                        setId: set.id,
                        setName: set.name,
                        setBonus: set.setBonus,
                    });
                }
            }
        }

        const ownedAccessoryIds = new Set(scene.accessories.map((accessory) => accessory.id));
        for (const entry of scene.stash) {
            if (entry.kind === "accessory") {
                ownedAccessoryIds.add(entry.item.id);
            }
        }
        // Gated by tier like weapons and armour: without this a round-one shop
        // could roll Frostspark Boots. Still offered once all five slots are
        // full -- the purchase waits in the stash so you can trade up, which
        // is the only way a better accessory ever reaches you late on.
        const accessories = (data.accessories.accessories || []).filter(
            (accessory) =>
                !ownedAccessoryIds.has(accessory.id) &&
                reachable(accessory) &&
                (accessory.tier || 1) <= maxTier,
        );

        // Crystals restock every visit, but drop out once you have hit the cap.
        const consumable = (data.rounds.consumables || []).filter((entry) => {
            const effects = entry.effects || {};
            if (effects.maxHpBonus) {
                return scene.baseMaxHp < (effects.maxHpCap || Infinity);
            }
            if (effects.maxManaBonus) {
                return scene.maxMana < (effects.maxManaCap || Infinity);
            }
            return true;
        });

        // Only ammo you are not already firing, and only what the round has
        // reached. Stashed ammo still shows: you may want a second box.
        const ammo = (data.ammo.ammo || []).filter(
            (entry) => reachable(entry) && (entry.tier || 1) <= maxTier
                && (!scene.ammo[entry.family] || scene.ammo[entry.family].id !== entry.id),
        );

        // Potions restock every visit and are never "owned", so unlike gear
        // they never drop out of the pool. The belt is what limits you.
        const potion = (data.potions.potions || []).filter(
            (entry) => (scene.potionStock[entry.id] || 0) < potionMaxStack(),
        );

        return { weapon: weapons, armor, accessory: accessories, consumable, potion, ammo };
    }

    function generateOffers(scene) {
        const config = shopConfig();
        const pools = buildShopPools(scene);
        const weights = config.weights
            || { weapon: 45, armor: 30, accessory: 25, potion: 22, ammo: 20 };
        if (weights.potion === undefined) {
            weights.potion = 22;
        }
        if (weights.ammo === undefined) {
            weights.ammo = 20;
        }
        const offers = [];
        const taken = new Set();
        // Harder levels narrow the choice as well as raising the numbers.
        const slots = Math.max(2, (config.itemCount || 4)
            + ((scene.difficulty || {}).shopItems || 0));
        for (let i = 0; i < slots; i += 1) {
            const kinds = Object.keys(pools).filter(
                (kind) => pools[kind].some((item) => !taken.has(item.id)),
            );
            if (!kinds.length) {
                break;
            }
            const total = kinds.reduce((sum, kind) => sum + (weights[kind] || 1), 0);
            let roll = Math.random() * total;
            let picked = kinds[0];
            for (const kind of kinds) {
                roll -= weights[kind] || 1;
                if (roll <= 0) {
                    picked = kind;
                    break;
                }
            }
            const pool = pools[picked].filter((item) => !taken.has(item.id));
            const base = pool[Math.floor(Math.random() * pool.length)];
            taken.add(base.id);
            const item = picked === "weapon" ? forgeWeapon(base) : base;
            offers.push({ kind: picked, item, sold: false });
        }
        return offers;
    }

    function potionMaxStack() {
        return (data.potions || {}).maxStack || 5;
    }

    function offerDescription(offer) {
        const item = offer.item;
        if (offer.kind === "weapon") {
            return weaponSubtitle(item);
        }
        if (offer.kind === "armor") {
            return `${item.slot} · +${item.defense} def · ${item.setName}: ${item.setBonus.description}`;
        }
        if (offer.kind === "ammo") {
            const scene = shopState && shopState.scene;
            const families = (data.ammo || {}).families || {};
            const loaded = scene && scene.ammo[item.family];
            const swap = loaded ? ` · replaces ${loaded.name}` : "";
            return `${families[item.family] || item.family} · ${item.description}${swap}`;
        }
        if (offer.kind === "potion") {
            const scene = shopState && shopState.scene;
            const held = scene ? (scene.potionStock[item.id] || 0) : 0;
            const carried = held ? ` · ${held} on the belt` : "";
            return `${item.seconds}s · ${item.description}${carried}`;
        }
        if (offer.kind === "consumable") {
            const scene = shopState && shopState.scene;
            const effects = item.effects || {};
            if (scene && effects.maxHpBonus) {
                const cap = effects.maxHpCap || Infinity;
                const next = Math.min(cap, scene.baseMaxHp + effects.maxHpBonus);
                return `${item.description} (${scene.baseMaxHp} → ${next})`;
            }
            if (scene && effects.maxManaBonus) {
                return `${item.description} (${scene.maxMana} → ${scene.maxMana + effects.maxManaBonus})`;
            }
        }
        return item.description;
    }

    function rerollCost() {
        const base = shopConfig().rerollBaseCost || 6;
        const freeRerolls = abilityOf(shopState.scene.character).freeRerolls || 0;
        if (shopState.rerollsUsed < freeRerolls) {
            return 0;
        }
        return base * (shopState.rerollsUsed - freeRerolls + 1);
    }

    /* ---------- vendor: hover detail and drag-to-buy ---------- */

    const tipUi = { box: null, forElement: null };

    // Effect keys read like code otherwise: "damageMultiplier" on a card.
    const EFFECT_LABELS = {
        // Read off the data rather than invented: these are every key that
        // actually appears in accessories, ammo, potions and armour.
        damage: "Damage", damageMultiplier: "Damage", bowDamage: "Bow damage",
        magicDamage: "Magic damage", defense: "Defense", crit: "Crit",
        critBonus: "Crit", moveSpeed: "Speed", moveSpeedMultiplier: "Speed",
        jumpMultiplier: "Jump", extraJumps: "Extra jumps", dash: "Dash",
        flight: "Flight", wings: "Wings", noGravity: "Ignores gravity",
        fallSpeed: "Fall speed", pierce: "Pierce", pierceBonus: "Pierce",
        bounce: "Bounce", homing: "Homing", splashRadius: "Blast",
        projectileSpeed: "Velocity", projectileSpeedMultiplier: "Velocity",
        regenPerSecond: "Regeneration", maxHpBonus: "Max health",
        manaRegen: "Mana regen", thorns: "Thorns", debuff: "Inflicts",
        damageTaken: "Damage taken", damageTakenMultiplier: "Damage taken",
        pickupRange: "Pickup range", coins: "Coins",
    };

    /** A multiplier reads as a percentage; a flat number reads as itself. */
    function formatEffect(key, value) {
        if (typeof value === "number") {
            if (/Multiplier$/.test(key) || key === "crit" || key === "critBonus") {
                const percent = Math.round((value > 1 ? value - 1 : value) * 100);
                return `${percent > 0 ? "+" : ""}${percent}%`;
            }
            if (key === "flightBonusMs" || key === "flight") {
                return `+${(value / 1000).toFixed(1)} s`;
            }
            return value > 0 ? `+${value}` : String(value);
        }
        if (typeof value === "boolean") {
            return value ? "yes" : "no";
        }
        if (value && typeof value === "object") {
            return Object.keys(value).join(", ");
        }
        return String(value);
    }

    /**
     * Everything worth knowing about an item, the way a vendor screen says it.
     *
     * Terraria tells you what a thing does while the cursor is over it, and
     * this shop only ever showed a name and a one-line blurb -- you had to buy
     * something to find out what it was. Lines are built per kind because a
     * bow and a potion have nothing in common to report.
     */
    function itemDetailLines(item, kind) {
        const lines = [];
        const add = (label, value) => {
            if (value !== undefined && value !== null && value !== "") {
                lines.push([label, String(value)]);
            }
        };
        if (kind === "weapon" || item.damage !== undefined) {
            add("Damage", item.damage);
            if (item.fireRateMs) {
                add("Use time", `${item.fireRateMs} ms`);
                const shots = item.shots || 1;
                add("DPS", Math.round((item.damage || 0) * shots * 1000 / item.fireRateMs));
            }
            if ((item.shots || 1) > 1) add("Shots", item.shots);
            if (item.pierce) add("Pierce", item.pierce);
            if (item.splashRadius) add("Blast", `${item.splashRadius} px`);
            if (item.mana) add("Mana", item.mana);
            if (item.category) add("Class", item.category);
        }
        if (item.defense !== undefined) add("Defense", item.defense);
        if (item.pieces) add("Set", `${item.pieces.length} pieces`);
        if (item.heal) add("Heals", item.heal);
        // Potions carry seconds, not milliseconds.
        if (item.seconds) add("Lasts", `${item.seconds} s`);
        if (item.family) add("Fits", item.family);
        // Ammunition and potions say what they do through an effects object
        // rather than through named stats, and it is the only thing worth
        // knowing about most of them.
        for (const [key, value] of Object.entries(item.effects || {})) {
            add(EFFECT_LABELS[key] || key, formatEffect(key, value));
        }
        if (item.hardmode) add("Requires", "Hardmode");
        if (item.tier !== undefined) add("Tier", item.tier);
        return lines;
    }

    /** Build the floating panel's contents for one item. */
    function fillTip(item, kind, price) {
        const box = tipUi.box;
        box.textContent = "";
        const head = document.createElement("div");
        head.className = "tb-tip-head";
        if (hasArt(item.sprite)) {
            const icon = document.createElement("img");
            icon.src = spritePath(item.sprite);
            icon.alt = "";
            head.append(icon);
        }
        const naming = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const type = document.createElement("small");
        type.textContent = kind || "";
        naming.append(name, type);
        head.append(naming);
        box.append(head);

        const stats = itemDetailLines(item, kind);
        if (stats.length) {
            const table = document.createElement("dl");
            table.className = "tb-tip-stats";
            for (const [label, value] of stats) {
                const dt = document.createElement("dt");
                dt.textContent = label;
                const dd = document.createElement("dd");
                dd.textContent = value;
                table.append(dt, dd);
            }
            box.append(table);
        }
        // Weapons keep their prose in `notes`; everything else uses
        // `description`. Reading only the latter left every weapon blank.
        const blurbText = item.description || item.notes;
        if (blurbText) {
            const blurb = document.createElement("p");
            blurb.className = "tb-tip-blurb";
            blurb.textContent = blurbText;
            box.append(blurb);
        }
        if (price !== undefined && price !== null) {
            const cost = document.createElement("p");
            cost.className = "tb-tip-price";
            cost.textContent = `🪙 ${price}`;
            box.append(cost);
        }
    }

    function moveTip(x, y) {
        const box = tipUi.box;
        const pad = 14;
        // Flip to the other side of the cursor near an edge, so the panel is
        // never half off the screen where it cannot be read.
        const width = box.offsetWidth || 240;
        const height = box.offsetHeight || 120;
        const left = x + pad + width > window.innerWidth ? x - pad - width : x + pad;
        const top = y + pad + height > window.innerHeight ? y - pad - height : y + pad;
        box.style.left = `${Math.max(4, left)}px`;
        box.style.top = `${Math.max(4, top)}px`;
    }

    function showTip(element, item, kind, price) {
        // Resolved on demand: assigning it next to the other UI handles put
        // the write above the declaration, and the whole script died on the
        // temporal dead zone before anything rendered.
        if (!tipUi.box) {
            tipUi.box = document.getElementById("tb-tip");
        }
        if (!tipUi.box || !item) {
            return;
        }
        tipUi.forElement = element;
        fillTip(item, kind, price);
        tipUi.box.hidden = false;
    }

    function hideTip(element) {
        if (!tipUi.box || (element && tipUi.forElement !== element)) {
            return;
        }
        tipUi.box.hidden = true;
        tipUi.forElement = null;
    }

    /** Give an element a hover panel describing the item behind it. */
    function attachTip(element, item, kind, price) {
        if (!element || !item) {
            return;
        }
        element.addEventListener("pointerenter", (event) => {
            showTip(element, item, kind, price);
            moveTip(event.clientX, event.clientY);
        });
        element.addEventListener("pointermove", (event) => {
            if (tipUi.forElement === element) {
                moveTip(event.clientX, event.clientY);
            }
        });
        element.addEventListener("pointerleave", () => hideTip(element));
        // Keyboard users get the same information without a pointer.
        element.addEventListener("focus", () => {
            const box = element.getBoundingClientRect();
            showTip(element, item, kind, price);
            moveTip(box.right, box.top);
        });
        element.addEventListener("blur", () => hideTip(element));
    }

    const dragState = { offer: null, ghost: null, price: 0, zones: [] };

    /** The docks an item can be dropped onto to buy it. */
    function dropZones() {
        return [
            document.getElementById("tb-inventory-dock-shop"),
            document.getElementById("tb-gear-dock-shop"),
        ].filter(Boolean);
    }

    function endDrag(dropped) {
        if (dragState.ghost) {
            dragState.ghost.remove();
        }
        for (const zone of dragState.zones) {
            zone.classList.remove("is-drop-target", "is-drop-hot");
        }
        dragState.ghost = null;
        dragState.offer = null;
        dragState.zones = [];
        document.body.classList.remove("tb-dragging");
        if (dropped) {
            audio.play("buy");
        }
    }

    /**
     * Buying by dragging the thing where you want it.
     *
     * Pointer events rather than HTML5 drag-and-drop: the native API cannot
     * drag a canvas-derived sprite without a ghost image workaround, gives no
     * control over the cursor on touch, and its dragover/drop pair fires in an
     * order that makes a hover highlight flicker. The buy button stays as
     * well -- dragging is not discoverable on its own, and it is no use to
     * anyone on a keyboard.
     */
    function beginDrag(event, offer, price, card) {
        const scene = shopState && shopState.scene;
        if (!scene || offer.sold || scene.coinsCollected < price || event.button) {
            return;
        }
        event.preventDefault();
        hideTip(card);
        dragState.offer = offer;
        dragState.price = price;
        dragState.zones = dropZones();

        const ghost = document.createElement("div");
        ghost.className = "tb-drag-ghost";
        if (hasArt(offer.item.sprite)) {
            const icon = document.createElement("img");
            icon.src = spritePath(offer.item.sprite);
            icon.alt = "";
            ghost.append(icon);
        }
        const label = document.createElement("span");
        label.textContent = offer.item.name;
        ghost.append(label);
        document.body.append(ghost);
        dragState.ghost = ghost;
        document.body.classList.add("tb-dragging");
        for (const zone of dragState.zones) {
            zone.classList.add("is-drop-target");
        }

        const move = (moveEvent) => {
            ghost.style.left = `${moveEvent.clientX}px`;
            ghost.style.top = `${moveEvent.clientY}px`;
            for (const zone of dragState.zones) {
                const box = zone.getBoundingClientRect();
                const over = moveEvent.clientX >= box.left && moveEvent.clientX <= box.right
                    && moveEvent.clientY >= box.top && moveEvent.clientY <= box.bottom;
                zone.classList.toggle("is-drop-hot", over);
            }
        };
        const drop = (upEvent) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", drop);
            window.removeEventListener("pointercancel", cancel);
            const landed = dragState.zones.some((zone) => {
                const box = zone.getBoundingClientRect();
                return upEvent.clientX >= box.left && upEvent.clientX <= box.right
                    && upEvent.clientY >= box.top && upEvent.clientY <= box.bottom;
            });
            const pending = dragState.offer;
            const cost = dragState.price;
            endDrag(false);
            if (landed && pending) {
                buyOffer(pending, cost);
            }
        };
        const cancel = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", drop);
            window.removeEventListener("pointercancel", cancel);
            endDrag(false);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", drop);
        window.addEventListener("pointercancel", cancel);
        move(event);
    }

    function renderShop() {
        const scene = shopState.scene;
        shopUi.coins.textContent = String(scene.coinsCollected);
        shopUi.list.textContent = "";
        for (const offer of shopState.offers) {
            const item = document.createElement("li");
            item.classList.toggle("is-sold", offer.sold);
            const askingPrice = offer.sold ? null : offerPrice(scene, offer);
            if (!offer.sold) {
                item.classList.add("is-draggable");
                item.addEventListener(
                    "pointerdown", (event) => beginDrag(event, offer, askingPrice, item),
                );
            }
            attachTip(item, offer.item, offer.kind, askingPrice);

            if (hasArt(offer.item.sprite)) {
                const icon = document.createElement("img");
                icon.className = "tb-shop-icon";
                icon.src = spritePath(offer.item.sprite);
                icon.alt = "";
                item.append(icon);
            }

            const body = document.createElement("div");
            body.className = "tb-card-body";
            const kind = document.createElement("span");
            kind.className = "tb-card-kind";
            kind.textContent = offer.kind;
            const name = document.createElement("strong");
            name.textContent = offer.item.name;
            const details = document.createElement("small");
            details.textContent = offerDescription(offer);
            body.append(kind, name, details);

            const stateBox = document.createElement("span");
            stateBox.className = "tb-card-state";
            if (offer.sold) {
                stateBox.textContent = "Sold";
            } else {
                const price = askingPrice;
                const buy = document.createElement("button");
                buy.className = "tb-button";
                buy.textContent = `🪙 ${price}`;
                buy.disabled = scene.coinsCollected < price;
                buy.addEventListener("click", () => buyOffer(offer, price));
                stateBox.append(buy);
            }

            item.append(body, stateBox);
            shopUi.list.append(item);
        }
        const cost = rerollCost();
        shopUi.reroll.textContent = cost === 0 ? "Reroll (free)" : `Reroll 🪙 ${cost}`;
        shopUi.reroll.disabled = cost > scene.coinsCollected;
    }

    function buyOffer(offer, price) {
        const scene = shopState && shopState.scene;
        if (!scene || offer.sold || scene.coinsCollected < price) {
            return;
        }
        scene.coinsCollected -= price;
        hud.coins.textContent = String(scene.coinsCollected);
        audio.play("buy");
        offer.sold = true;
        if (offer.kind === "weapon") {
            scene.acquireWeapon(offer.item);
        } else if (offer.kind === "armor") {
            scene.acquireArmor(offer.item);
        } else if (offer.kind === "consumable") {
            scene.consume(offer.item);
            scene.consumablesBought[offer.item.id] =
                (scene.consumablesBought[offer.item.id] || 0) + 1;
        } else if (offer.kind === "ammo") {
            scene.loadAmmo(offer.item);
        } else if (offer.kind === "potion") {
            // A potion is stock, not a stat: buying puts it on the belt and
            // the decision about when to drink it is still ahead of you.
            scene.stockPotion(offer.item);
        } else {
            scene.acquireAccessory(offer.item);
        }
        renderShop();
    }

    function openShop(scene) {
        shopState = { scene, offers: generateOffers(scene), rerollsUsed: 0 };
        gearScene = scene;
        dockPanels("shop");
        shopUi.panel.hidden = false;
        // Rendered after the panel is visible so selling knows the vendor is up.
        renderShop();
        renderGear();
    }

    function closeShop() {
        shopUi.panel.hidden = true;
        shopState = null;
        // Hand the panels back so the standalone screen still has them.
        dockPanels("solo");
    }

    /* ---------- HUD ---------- */

    const hud = {
        hearts: document.getElementById("tb-hud-hearts"),
        hp: document.getElementById("tb-hud-hp"),
        round: document.getElementById("tb-hud-round"),
        coins: document.getElementById("tb-hud-coins"),
        weapon: document.getElementById("tb-hud-weapon"),
        weapon2: document.getElementById("tb-hud-weapon2"),
        mana: document.getElementById("tb-hud-mana"),
        manaValue: document.getElementById("tb-hud-mana-value"),
        defense: document.getElementById("tb-hud-defense"),
        defenseValue: document.getElementById("tb-hud-defense-value"),
        flight: document.getElementById("tb-hud-flight"),
        flightFill: document.getElementById("tb-hud-flight-fill"),
        hardmode: document.getElementById("tb-hud-hardmode"),
        barrier: document.getElementById("tb-hud-barrier"),
        barrierFill: document.getElementById("tb-hud-barrier-fill"),
        belt: document.getElementById("tb-hud-belt"),
        buffs: document.getElementById("tb-hud-buffs"),
    };

    /** The hardmode chip, once the world has turned. */
    function updateHudHardmode(on) {
        if (hud.hardmode) {
            hud.hardmode.hidden = !on;
        }
    }

    /** The barrier chip: hidden entirely when nothing grants one. */
    function updateHudBarrier(current, capacity) {
        if (!hud.barrier) {
            return;
        }
        hud.barrier.hidden = capacity <= 0;
        if (capacity > 0) {
            const fraction = Math.max(0, Math.min(1, current / capacity));
            hud.barrierFill.style.width = `${Math.round(fraction * 100)}%`;
            // Dim once it is spent, so a glance tells you whether it is there.
            hud.barrier.classList.toggle("is-spent", current < 1);
        }
    }

    /** The belt: what you are carrying and which key drinks it. */
    function renderBelt(scene) {
        if (!hud.belt) {
            return;
        }
        const belt = scene.belt();
        hud.belt.hidden = !belt.length;
        hud.belt.textContent = "";
        belt.forEach((potion, index) => {
            const slot = document.createElement("button");
            slot.type = "button";
            slot.className = "tb-belt-slot";
            slot.title = `${potion.name} — ${potion.description}`;
            slot.style.setProperty("--tb-potion", potion.tint || token("--tb-accent", "#7d9cff"));
            const icon = document.createElement("img");
            icon.className = "tb-belt-icon";
            icon.src = spritePath(potion.sprite);
            icon.alt = "";
            const key = document.createElement("b");
            key.className = "tb-belt-key";
            key.textContent = String(index + 3);
            const count = document.createElement("i");
            count.className = "tb-belt-count";
            count.textContent = String(scene.potionStock[potion.id] || 0);
            slot.append(icon, key, count);
            // Clickable as well as hotkeyed: reaching for 3-7 mid-fight is a
            // lot to ask of the hand that is already holding the movement keys.
            slot.addEventListener("click", () => {
                scene.drinkPotion(potion);
                scene.game.canvas.focus();
            });
            hud.belt.append(slot);
        });
    }

    /** Active buffs, each draining toward nothing. */
    function renderBuffs(scene) {
        if (!hud.buffs) {
            return;
        }
        const buffs = scene.buffs || [];
        hud.buffs.hidden = !buffs.length;
        if (!buffs.length) {
            hud.buffs.textContent = "";
            // The signature has to go with the DOM it described. Leaving it
            // behind means drinking the same potion again matches the stale
            // value, the rebuild is skipped, and the buff runs invisibly.
            delete hud.buffs.dataset.signature;
            return;
        }
        const now = scene.time.now;
        // Rebuilt only when the set changes; otherwise just the bars move, or
        // the icons would flicker every frame.
        const signature = buffs.map((buff) => buff.id).join(",");
        if (hud.buffs.dataset.signature !== signature) {
            hud.buffs.dataset.signature = signature;
            hud.buffs.textContent = "";
            for (const buff of buffs) {
                const chip = document.createElement("span");
                chip.className = "tb-buff";
                chip.dataset.buff = buff.id;
                chip.title = buff.potion.name;
                chip.style.setProperty("--tb-potion", buff.potion.tint || token("--tb-accent", "#7d9cff"));
                const icon = document.createElement("img");
                icon.className = "tb-buff-icon";
                icon.src = spritePath(buff.potion.sprite);
                icon.alt = "";
                const bar = document.createElement("span");
                bar.className = "tb-buff-bar";
                bar.append(document.createElement("b"));
                chip.append(icon, bar);
                hud.buffs.append(chip);
            }
        }
        for (const buff of buffs) {
            const chip = hud.buffs.querySelector(`[data-buff="${buff.id}"]`);
            if (!chip) {
                continue;
            }
            const left = Math.max(0, buff.endsAt - now) / buff.ms;
            chip.querySelector(".tb-buff-bar b").style.width = `${Math.round(left * 100)}%`;
            // The last five seconds flash, so a lapse is never a surprise.
            chip.classList.toggle("tb-buff-fading", buff.endsAt - now < 5000);
        }
    }

    function updateHudHearts(hp, maxHp = PLAYER_MAX_HP) {
        const hearts = Math.max(1, Math.round(maxHp / HP_PER_HEART));
        const rows = Math.ceil(hearts / HEARTS_PER_ROW);
        // Rebuilt only when the heart count changes; a hit just re-fills them.
        if (hud.hearts.dataset.hearts !== String(hearts)) {
            hud.hearts.dataset.hearts = String(hearts);
            hud.hearts.textContent = "";
            // Rows appended last-first, so the first ten sit along the bottom
            // and Life Crystals stack upward the way Terraria does it.
            for (let row = rows - 1; row >= 0; row -= 1) {
                const line = document.createElement("div");
                line.className = "tb-heart-row";
                const from = row * HEARTS_PER_ROW;
                const to = Math.min(hearts, from + HEARTS_PER_ROW);
                for (let i = from; i < to; i += 1) {
                    const cell = document.createElement("span");
                    cell.className = "tb-heart";
                    // Which heart this is, counting from the first. The rows
                    // are appended top-first so the bottom row is last in the
                    // document, and reading the cells in document order would
                    // fill the top row first and drain the bottom one.
                    cell.dataset.index = String(i);
                    // Two layers: a spent heart underneath, a full one over it
                    // clipped to however much of this heart is left. Without
                    // the overlay a heart is full until it is gone, and the
                    // last twenty health look the same as the last one.
                    const spent = document.createElement("img");
                    spent.className = "tb-heart-spent";
                    spent.src = spritePath("items/heart.png");
                    spent.alt = "";
                    const live = document.createElement("img");
                    live.className = "tb-heart-live";
                    live.src = spritePath("items/heart.png");
                    live.alt = "";
                    cell.append(spent, live);
                    line.append(cell);
                }
                hud.hearts.append(line);
            }
        }
        const cells = hud.hearts.querySelectorAll(".tb-heart");
        cells.forEach((cell) => {
            const index = Number(cell.dataset.index);
            const into = hp - index * HP_PER_HEART;
            const part = Phaser.Math.Clamp(into / HP_PER_HEART, 0, 1);
            cell.classList.toggle("is-empty", part <= 0);
            // Clipped from the right, so a heart drains rather than blinking out.
            cell.querySelector(".tb-heart-live").style.clipPath =
                `inset(0 ${Math.round((1 - part) * 100)}% 0 0)`;
        });
        const shown = Math.max(0, Math.round(hp));
        if (hud.hp) {
            hud.hp.textContent = `${shown} / ${Math.round(maxHp)}`;
            hud.hp.classList.toggle("is-low", shown <= maxHp * 0.3);
        }
        hud.hearts.setAttribute("aria-label", `${shown} of ${Math.round(maxHp)} health`);
    
    }

    /* ---------- arena scene ---------- */

    class ArenaScene extends Phaser.Scene {
        constructor(character, difficulty) {
            super("arena");
            this.character = character;
            // Multipliers over the base numbers, so content changes carry
            // through the whole ladder without touching it.
            this.difficulty = difficulty || { id: "journey", name: "Journey" };
        }

        get weapon() {
            return this.weaponSlots[this.activeSlot];
        }

        preload() {
            // Battle backdrops (user-supplied Terraria landscapes) and the
            // sliced sprite strips. Anything that fails to load is skipped;
            // painted placeholders cover for it.
            const prefix = app.dataset.staticPrefix || "/static/";
            this.failedBackgrounds = new Set();
            this.failedSkins = new Set();
            for (let i = 1; i <= BACKGROUND_COUNT; i += 1) {
                this.load.image(
                    `tb-bg-${i}`,
                    `${prefix}games/assets/terra/backgrounds/back${i}.jpg${ASSET_VERSION}`,
                );
            }
            for (const [id, spec] of Object.entries(data.frames || {})) {
                this.load.spritesheet(
                    `tb-skin-${id}`,
                    spritePath(spec.file),
                    { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight },
                );
            }
            this.failedItems = new Set();
            for (const [id, spec] of Object.entries(data.items || {})) {
                this.load.image(`tb-item-${id}`, spritePath(spec.file));
            }
            this.failedTiles = new Set();
            for (const [id, spec] of Object.entries(data.tiles || {})) {
                this.load.image(`tb-tile-${id}`, spritePath(spec.file));
            }
            this.failedDecor = new Set();
            for (const [id, spec] of Object.entries(data.decor || {})) {
                // Plant strips hold several variants; a tree is a single image.
                if (spec.frames > 1) {
                    this.load.spritesheet(
                        `tb-decor-${id}`,
                        spritePath(spec.file),
                        { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight },
                    );
                } else {
                    this.load.image(`tb-decor-${id}`, spritePath(spec.file));
                }
            }
            for (const [id, spec] of Object.entries(data.wornArmor || {})) {
                this.load.spritesheet(
                    `tb-worn-${id}`,
                    spritePath(spec.file),
                    { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight },
                );
            }
            for (const [id, spec] of Object.entries(data.wings || {})) {
                this.load.spritesheet(
                    `tb-wings-${id}`,
                    spritePath(spec.file),
                    { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight },
                );
            }
            for (const [id, pieces] of Object.entries(data.gore || {})) {
                pieces.forEach((piece, index) => {
                    this.load.image(`tb-gore-${id}-${index}`, spritePath(piece.file));
                });
            }
            this.load.on("loaderror", (file) => {
                if (!file.key) {
                    return;
                }
                if (file.key.startsWith("tb-bg-")) {
                    this.failedBackgrounds.add(file.key);
                } else if (file.key.startsWith("tb-skin-")) {
                    this.failedSkins.add(file.key);
                } else if (file.key.startsWith("tb-item-")) {
                    this.failedItems.add(file.key);
                } else if (file.key.startsWith("tb-tile-")) {
                    this.failedTiles.add(file.key);
                } else if (file.key.startsWith("tb-decor-")) {
                    this.failedDecor.add(file.key);
                }
            });
        }

        itemKey(id) {
            const key = `tb-item-${id}`;
            return this.textures.exists(key) && !this.failedItems.has(key) ? key : null;
        }

        tileKey(id) {
            const key = `tb-tile-${id}`;
            return this.textures.exists(key) && !this.failedTiles.has(key) ? key : null;
        }

        decorKey(id) {
            const key = `tb-decor-${id}`;
            return this.textures.exists(key) && !this.failedDecor.has(key) ? key : null;
        }

        create() {
            // First, because much of what follows reads it: every ability is
            // data now, so nothing below needs to know which character it is.
            this.ability = abilityOf(this.character);
            this.round = 0;
            this.pendingSpawns = 0;
            this.kills = 0;
            // A small purse so the first shop is a real choice; round one
            // alone cannot pay for the cheapest item.
            this.coinsCollected = Math.round(
                (((data.rounds.player || {}).startingCoins || 0)
                    + (this.ability.startingCoins || 0))
                * (this.difficulty.startingCoinsMultiplier || 1),
            );
            this.bossKills = 0;
            this.achievementsEarned = [];
            this.defeated = {};
            this.weaponsUsed = {};
            this.roundActive = false;
            this.event = null;
            // baseMaxHp is the permanent ceiling -- what Life Crystals raise.
            // maxHp is that plus any buff on top, so a lapsing Lifeforce can
            // never take a crystal away with it.
            this.baseMaxHp = (data.rounds.player || {}).baseMaxHp || PLAYER_MAX_HP;
            this.maxHp = this.baseMaxHp;
            this.playerHp = this.maxHp;
            this.invincibleUntil = 0;
            this.nextFireAt = 0;
            this.activeYoyo = null;
            this.over = false;

            const startingWeapon = weaponById(this.character.startingWeapon) || weaponById("wooden-bow");
            this.weaponSlots = [startingWeapon, null];
            this.activeSlot = 0;
            if (startingWeapon) {
                this.weaponsUsed[startingWeapon.id] = 1;
            }
            const playerConfig = data.rounds.player || {};
            this.maxMana = (playerConfig.maxMana || 100) + (this.ability.maxManaBonus || 0);
            this.manaRegen = playerConfig.manaRegenPerSecond || 8;
            this.runSpeed = playerConfig.runSpeed || 180;
            this.jumpVelocity = playerConfig.jumpVelocity || 505;
            this.mana = this.maxMana;
            this.lastManaShown = -1;
            this.armor = { head: null, chest: null, legs: null };
            this.accessories = [];
            this.stash = [];
            this.paused = false;
            this.jumpsUsed = 0;
            this.dashReadyAt = 0;
            this.regenCarry = 0;
            this.potionStock = {};
            this.buffs = [];
            this.barrier = 0;
            this.barrierCapacity = 0;
            this.barrierBrokenAt = 0;
            this.hardmode = false;
            // The chip is a DOM element and outlives the scene, so a new run
            // has to clear it or it carries over from the last one.
            updateHudHardmode(false);
            // One loaded type per weapon family. Committing to Hellfire Arrows
            // is a choice, not something you accumulate.
            this.ammo = { bow: null, gun: null, launcher: null };
            this.coinsEarnedTotal = 0;
            this.consumablesBought = {};
            this.damageBonus = 0;
            this.recomputeLoadout();
            this.updateHudWeapons();
            this.updateHudMana();
            hud.coins.textContent = "0";
            updateHudHearts(this.playerHp, this.maxHp);

            if (this.ability.skull) {
                this.time.addEvent({ delay: 5000, loop: true, callback: () => this.fireSkull() });
            }

            this.buildTextures();
            this.buildSkins();
            this.plan = this.fightPlan(null, this.expectedMobCount());
            this.buildArena();
            this.buildParticles();
            this.buildPlayer();
            this.buildGroups();
            this.buildInput();

            // Pinned to the window: everything below is HUD, and a scrolling
            // corridor would otherwise carry the banner and the boss bar off
            // the side of the screen with the scenery.
            this.banner = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 90, "", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "22px",
                color: "#f2c14b",
                // The outline exists to keep the text legible over the arena,
                // so it only has to be dark -- it was dark green.
                stroke: token("--tb-bg-deep", "#080a16"),
                strokeThickness: 6,
                align: "center",
            }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

            this.bannerSub = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 58, "", {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: token("--tb-text", "#e6e8f5"),
                stroke: token("--tb-bg-deep", "#080a16"),
                strokeThickness: 4,
                align: "center",
            }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

            this.time.delayedCall(400, () => this.startNextRound());
        }

        /* -- placeholder art, generated once -- */

        buildTextures() {
            const paint = (key, width, height, color) => {
                if (this.textures.exists(key)) {
                    return;
                }
                const graphics = this.make.graphics({ x: 0, y: 0 }, false);
                graphics.fillStyle(color, 1);
                graphics.fillRect(0, 0, width, height);
                graphics.generateTexture(key, width, height);
                graphics.destroy();
            };
            const toInt = (hex) => Phaser.Display.Color.HexStringToColor(
                hex || token("--tb-accent", "#7d9cff"),
            ).color;

            paint("tb-player", 22, 32, toInt(this.character.color));
            paint("tb-ground", 48, 48, 0x5b4023);
            paint("tb-grass", 48, 10, 0x4f8f35);
            paint("tb-platform", 96, 12, 0x8a6a3d);
            paint("tb-arrow", 16, 4, 0xd9c08a);
            paint("tb-bolt", 10, 10, 0xc39bff);
            paint("tb-bossshot", 12, 12, 0xff7a5c);
            paint("tb-coin", 9, 9, 0xf2c14b);
            paint("tb-heart", 12, 12, 0xe0524b);
            paint("tb-skull", 14, 14, 0xb08bd4);

            // Particle shapes are painted white so each burst can be tinted.
            if (!this.textures.exists("tb-puff")) {
                const puff = this.make.graphics({ x: 0, y: 0 }, false);
                puff.fillStyle(0xffffff, 1);
                puff.fillCircle(6, 6, 6);
                puff.generateTexture("tb-puff", 12, 12);
                puff.destroy();
            }
            paint("tb-bit", 3, 3, 0xffffff);
            paint("tb-shard", 5, 2, 0xffffff);
            for (const mob of data.rounds.mobs || []) {
                paint(`tb-mob-${mob.id}`, mob.sizePx, mob.sizePx, toInt(mob.color));
            }
            for (const boss of data.bosses.bosses || []) {
                paint(`tb-boss-${boss.id}`, boss.sizePx, boss.sizePx, toInt(boss.color));
            }
        }

        buildSkins() {
            this.skins = {};
            for (const [id, spec] of Object.entries(data.frames || {})) {
                const key = `tb-skin-${id}`;
                if (!this.textures.exists(key) || this.failedSkins.has(key)) {
                    continue;
                }
                this.skins[id] = spec;
                // Named ranges (e.g. Plantera's calm/enraged) become their own
                // looping animations.
                for (const [animName, range] of Object.entries(spec.anims || {})) {
                    if (!Array.isArray(range) || animName === "walk") {
                        continue;
                    }
                    const animKey = `tb-anim-${id}-${animName}`;
                    if (!this.anims.exists(animKey)) {
                        this.anims.create({
                            key: animKey,
                            frames: this.anims.generateFrameNumbers(key, { start: range[0], end: range[1] }),
                            frameRate: 6,
                            repeat: -1,
                        });
                    }
                }
                if (spec.anims && spec.anims.walk) {
                    // Character skins: explicit walk cycle, no autoplay.
                    if (!this.anims.exists(`tb-walk-${id}`)) {
                        this.anims.create({
                            key: `tb-walk-${id}`,
                            frames: this.anims.generateFrameNumbers(key, {
                                start: spec.anims.walk[0],
                                end: spec.anims.walk[1],
                            }),
                            frameRate: 12,
                            repeat: -1,
                        });
                    }
                } else if (namedRanges(spec).length) {
                    // Named ranges drive playback; no whole-strip animation.
                } else if (spec.frames > 1 && !this.anims.exists(`tb-anim-${id}`)) {
                    this.anims.create({
                        key: `tb-anim-${id}`,
                        frames: this.anims.generateFrameNumbers(key, { start: 0, end: spec.frames - 1 }),
                        frameRate: 6,
                        repeat: -1,
                    });
                }
            }
        }

        applySkin(sprite, id, tint = null) {
            const spec = this.skins[id];
            if (!spec) {
                return false;
            }
            sprite.setTexture(`tb-skin-${id}`, 0);
            sprite.setScale(WORLD_SCALE);
            // Frames carry transparent padding, so inset the body: for the
            // player's 40x56 frame this lands on Terraria's 20x42 hitbox.
            sprite.body.setSize(spec.frameWidth * 0.55, spec.frameHeight * 0.78, true);
            if (spec.frames > 1 && !(spec.anims && spec.anims.walk)) {
                const named = namedRanges(spec);
                sprite.play(named.length ? `tb-anim-${id}-${named[0]}` : `tb-anim-${id}`);
            }
            if (tint !== null) {
                sprite.setTint(tint);
                sprite.baseTint = tint;
            }
            return true;
        }

        restoreTint(sprite) {
            if (!sprite.active) {
                return;
            }
            if (sprite.baseTint !== undefined) {
                sprite.setTint(sprite.baseTint);
            } else {
                sprite.clearTint();
            }
        }

        /** The biome and floor plan for a round.
         *
         * `prefer` is a list of biome ids to draw from when possible, which is
         * how a boss drags the arena to where it is actually fought.
         */
        pickArena(prefer, wantLayout) {
            const all = (data.biomes && data.biomes.biomes) || [];
            const usable = all.filter((biome) => {
                // The Hallow does not exist before the world turns, so it is
                // not in the rotation until then.
                if (biome.hardmode && !this.hardmode) {
                    return false;
                }
                // And the rest arrive in the order Terraria finds them, so a
                // run descends instead of shuffling. Round one opened in hell
                // before this, which is the ending, not the beginning.
                //
                // Counted from one, not from this.round directly: the first
                // arena is built in create() before any round has started,
                // when the counter is still zero, and comparing that against
                // a gate of 1 excluded every biome in the game -- the run
                // opened on a floor with no biome, no decor and no weighting.
                const reached = Math.max(1, this.round);
                if (reached < (biome.minRound || 0)) {
                    return false;
                }
                // Any of its backdrops will do. Testing one random pick
                // would drop a whole biome from the rotation because the one
                // it happened to roll had failed to load.
                const options = (Array.isArray(biome.backgrounds) && biome.backgrounds.length
                    ? biome.backgrounds
                    : [biome.background]);
                const usableArt = options.some((index) => {
                    const key = `tb-bg-${index}`;
                    return this.textures.exists(key) && !this.failedBackgrounds.has(key);
                });
                return this.tileKey(biome.surface) && this.tileKey(biome.fill) && usableArt;
            });
            const wanted = prefer && prefer.length
                ? usable.filter((biome) => prefer.includes(biome.id))
                : [];
            const pool = wanted.length ? wanted : usable;
            const all_layouts = (data.biomes && data.biomes.layouts) || [];
            // A boss names the arena it is fought in. Everything else picks
            // from the ordinary rotation -- the boss arenas are shaped around
            // one pattern and would only be strange without it.
            const named = wantLayout
                ? all_layouts.filter((entry) => entry.id === wantLayout)
                : [];
            const layouts = named.length
                ? named
                : all_layouts.filter((entry) => !entry.bossOnly);
            return {
                biome: pool.length ? Phaser.Utils.Array.GetRandom(pool) : null,
                layout: layouts.length ? Phaser.Utils.Array.GetRandom(layouts) : null,
            };
        }

        /**
         * The cast this round can draw on, before any of it has spawned.
         *
         * The arena is built before the wave arrives, so this is how it can
         * know whether anything is going to fly. Same filter spawnHordeMob
         * uses, minus the weighting, which only decides which one turns up.
         */
        roundPool() {
            const only = (this.event || {}).only;
            if (only && only.length) {
                const cast = (data.rounds.mobs || []).filter((mob) => only.includes(mob.id));
                if (cast.length) {
                    return cast;
                }
            }
            return (data.rounds.mobs || []).filter(
                (mob) => this.round >= mob.minRound && this.round <= mob.maxRound
                    && (!mob.hardmode || this.hardmode),
            );
        }

        /**
         * What this round's arena has to accommodate.
         *
         * The arena used to be rolled with no idea what was about to be fought
         * in it, so a wave of slimes got the same scaffolding as a flying boss
         * and the Moon Lord got the same headroom as a zombie. This reads the
         * fight first: how many bodies, how wide the biggest one is, and
         * whether any of it leaves the floor.
         */
        fightPlan(boss, mobCount) {
            const pool = boss ? [] : this.roundPool();
            const flies = (entry) => entry.behavior === "flyer" || entry.behavior === "caster";
            // How wide the biggest thing is, in the units the sprites are in.
            const skin = boss && boss.skin && (data.frames || {})[boss.skin.id];
            const bulk = boss
                ? Math.max(boss.sizePx || 0, skin ? skin.frameWidth : 0)
                : Math.max(30, ...pool.map((entry) => entry.sizePx || 30));
            return {
                round: this.round,
                isBoss: Boolean(boss),
                crowd: boss ? 1 : mobCount,
                bulk,
                // A boss that marches one way needs a corridor to march down.
                corridor: Boolean(boss && boss.patternConfig
                                  && boss.patternConfig.corridor),
                // How much of this fight leaves the floor. Presence was too
                // sensitive: one drone in a pool of five put scaffolding over
                // a round that is still slimes and zombies in character.
                airborneShare: boss
                    ? (boss.pattern === "kingslime" || boss.pattern === "stomper" ? 0 : 1)
                    : (pool.length
                        ? pool.filter(flies).length / pool.length
                        : 0),
            };
        }

        buildArena() {
            this.backgroundKeys = [];
            for (let i = 1; i <= BACKGROUND_COUNT; i += 1) {
                const key = `tb-bg-${i}`;
                if (this.textures.exists(key) && !this.failedBackgrounds.has(key)) {
                    this.backgroundKeys.push(key);
                }
            }
            // Created once and refilled on every arena change: the colliders
            // registered in create() hold these exact group objects, so they
            // must never be replaced.
            this.platforms = this.physics.add.staticGroup();
            this.oneWayPlatforms = this.physics.add.staticGroup();
            this.scenery = [];

            const { biome, layout } = this.pickArena();
            if (!biome && !this.backgroundKeys.length) {
                this.paintFallbackBackdrop();
            } else {
                this.background = this.add.image(
                    VIEW_WIDTH / 2,
                    VIEW_HEIGHT / 2,
                    biome ? `tb-bg-${this.chooseBackdrop(biome)}` : this.backgroundKeys[0],
                ).setScrollFactor(0);
                // A light shade so actors stay readable on the art.
                this.shade = this.add.rectangle(
                    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x03140a, 0.22,
                ).setScrollFactor(0);
            }
            this.applyArena(biome, layout);
        }

        /**
         * Which backdrop this biome shows this time.
         *
         * A biome used to name one picture, so the jungle looked identical on
         * every visit however long a run lasted. It names a set now. Ones
         * that failed to load are skipped rather than drawn and shown as a
         * blank; a biome still listing a single backdrop behaves as before.
         */
        chooseBackdrop(biome) {
            if (!biome) {
                return 1;
            }
            const options = (Array.isArray(biome.backgrounds) && biome.backgrounds.length
                ? biome.backgrounds
                : [biome.background]).filter((index) => {
                const key = `tb-bg-${index}`;
                return this.textures.exists(key) && !this.failedBackgrounds.has(key);
            });
            return options.length
                ? Phaser.Utils.Array.GetRandom(options)
                : biome.background;
        }

        /** Swap the whole arena over to a biome: sky, blocks, floor plan, plants. */
        applyArena(biome, layout) {
            this.biome = biome;
            this.layout = layout;
            // Drawn fresh for each arena, and only from backdrops that loaded.
            this.pickedBackdrop = this.chooseBackdrop(biome);

            if (this.background && biome) {
                this.background.setTexture(`tb-bg-${this.pickedBackdrop}`);
                this.fitBackground();
            }
            if (this.shade) {
                this.shade.setFillStyle(
                    biome && biome.shade
                        ? Phaser.Display.Color.HexStringToColor(biome.shade).color
                        : 0x03140a,
                    biome && typeof biome.shadeAlpha === "number" ? biome.shadeAlpha : 0.22,
                );
            }

            this.platforms.clear(true, true);
            this.oneWayPlatforms.clear(true, true);
            (this.scenery || []).forEach((item) => item.destroy());
            this.scenery = [];

            this.buildGround(biome, layout);
            this.buildOneWayPlatforms(biome, layout);
            this.scatterDecor(biome);
        }

        /**
         * A run of ground heights across the arena, one per column.
         *
         * Two overlapping waves at unrelated wavelengths, so it reads as
         * terrain rather than as a repeating pattern, quantised to whole tiles
         * so the surface art lines up. Steps are held to STEP_LIMIT: walkers
         * jump when something blocks them and slimes hop anyway, but only if
         * the wall in front of them is short enough to clear.
         */
        groundProfile(baseTop, roughness) {
            const columns = Math.ceil(this.arenaWidth / GROUND_COLUMN);
            const tile = 8;
            if (roughness <= 0) {
                return new Array(columns).fill(baseTop);
            }
            const phase = Math.random() * Math.PI * 2;
            const phase2 = Math.random() * Math.PI * 2;
            const heights = [];
            for (let i = 0; i < columns; i += 1) {
                const t = i / columns;
                const wave = Math.sin(phase + t * Math.PI * 2.2) * 0.62
                    + Math.sin(phase2 + t * Math.PI * 5.7) * 0.38;
                heights.push(baseTop - Math.round((wave * roughness) / tile) * tile);
            }
            // Flatten any step the ground-bound cannot climb out of.
            for (let i = 1; i < heights.length; i += 1) {
                const rise = heights[i - 1] - heights[i];
                if (Math.abs(rise) > STEP_LIMIT) {
                    heights[i] = heights[i - 1] - Math.sign(rise) * STEP_LIMIT;
                }
            }
            return heights;
        }

        buildGround(biome, layout) {
            const plan = this.plan || {};
            // Everything below measures the world, not the window.
            this.arenaWidth = plan.corridor ? VIEW_WIDTH * CORRIDOR_SCREENS : VIEW_WIDTH;
            this.physics.world.setBounds(0, 0, this.arenaWidth, VIEW_HEIGHT);
            this.cameras.main.setBounds(0, 0, this.arenaWidth, VIEW_HEIGHT);
            // Ground thickness varies per layout, and a big fight gets more
            // room over its head: the arena is the same 960 wide either way,
            // so headroom is the only dimension there is to give.
            const base = (layout && layout.groundHeight) || 46;
            const roomy = Math.round(
                Math.min(22, Math.max(0, (plan.crowd || 0) - 5) * 2.5)
                + Math.min(20, Math.max(0, (plan.bulk || 0) - 110) * 0.16),
            );
            const groundHeight = Math.max(20, base - roomy);
            const baseTop = VIEW_HEIGHT - groundHeight;

            // Wide things need somewhere flat to stand: a worm or a boss the
            // width of the screen wedged in a trench reads as a bug.
            const roughness = Math.max(
                0, Math.round(((layout && layout.roughness) ?? 18)
                              * (plan.bulk > 150 ? 0.35 : 1)),
            );
            const heights = this.groundProfile(baseTop, roughness);
            this.groundHeights = heights;
            // Everything that asks "where is the floor" without a position
            // gets the highest point, so nothing spawns inside a hill.
            this.groundTop = Math.min(...heights);
            this.groundBaseTop = baseTop;

            const surfaceKey = this.tileKey(biome ? biome.surface : "ground-grass")
                || this.tileKey("ground-grass");
            const fillKey = this.tileKey(biome ? biome.fill : "ground-dirt")
                || this.tileKey("ground-dirt");
            if (surfaceKey && fillKey) {
                const row = 16 * WORLD_SCALE;
                // One column at a time: art on top, an invisible slab beneath
                // it carrying the collision, exactly as the flat floor did.
                for (let i = 0; i < heights.length; i += 1) {
                    const top = heights[i];
                    const x = i * GROUND_COLUMN + GROUND_COLUMN / 2;
                    const surface = this.add.tileSprite(
                        x, top + row / 2, GROUND_COLUMN, row, surfaceKey,
                    );
                    surface.setTileScale(WORLD_SCALE).setDepth(5);
                    this.scenery.push(surface);
                    const fillTop = top + row;
                    const fillHeight = VIEW_HEIGHT - fillTop;
                    if (fillHeight > 0) {
                        const fill = this.add.tileSprite(
                            x, fillTop + fillHeight / 2, GROUND_COLUMN, fillHeight, fillKey,
                        );
                        fill.setTileScale(WORLD_SCALE).setDepth(4);
                        this.scenery.push(fill);
                    }
                    const slab = this.platforms.create(
                        x, top + (VIEW_HEIGHT - top) / 2, "tb-ground",
                    );
                    slab.setVisible(false);
                    slab.setDisplaySize(GROUND_COLUMN, VIEW_HEIGHT - top);
                    slab.refreshBody();
                }
                return;
            }

            for (let x = 24; x < VIEW_WIDTH; x += 48) {
                this.platforms.create(x, VIEW_HEIGHT - 22, "tb-ground");
                this.scenery.push(
                    this.add.image(x, this.groundAt(x) + 4, "tb-grass").setDepth(5),
                );
            }
        }

        /**
         * The wall is a moving back edge to the world.
         *
         * In Terraria you cannot get behind the Wall of Flesh -- there is no
         * fight there, only the part of the map it has already taken. Here it
         * shoves you along in front of it and hurts you for being caught,
         * which is what turns a boss that walks slowly into a chase. As it
         * closes on the far end the room you have left runs out, so the last
         * of the fight happens with your back to the wall.
         */
        tickCorridorSqueeze(boss) {
            if (!this.plan || !this.plan.corridor || !this.player || !this.player.body) {
                return;
            }
            const face = boss.marchDirection;
            const edge = boss.x + face * (boss.displayWidth / 2);
            const caught = face > 0 ? this.player.x < edge : this.player.x > edge;
            if (!caught) {
                return;
            }
            // Shoved, not teleported: it keeps the player on the live side
            // without snapping them across the screen.
            this.player.x = edge;
            if (this.player.body.velocity.x * face < 0) {
                this.player.setVelocityX(face * 60);
            }
            this.hurtPlayer(boss.contactDamage, boss.x);
        }

        /** Where the player starts: at the mouth of a corridor, else centre. */
        playerStartX() {
            return (this.plan && this.plan.corridor) ? 220 : VIEW_WIDTH / 2;
        }

        /**
         * Lift anything the new ground was built on top of.
         *
         * Each round rolls a fresh height profile, and the arena is rebuilt
         * around whoever is standing in it. Where the new ground came in
         * higher than the old, the player was left inside it -- and a body
         * inside a static slab is not pushed out, it falls through and lands
         * on the bottom of the world. Seventeen rotations in twenty buried
         * the player before this, which is why it looked like spawning
         * underground.
         *
         * Only ever lifts. Something legitimately in the air stays there.
         */
        standOnGround(sprite) {
            if (!sprite || !sprite.body) {
                return false;
            }
            const ground = this.groundAt(sprite.x);
            const overlap = sprite.body.bottom - ground;
            if (overlap <= 0) {
                return false;
            }
            sprite.y -= overlap + 1;
            sprite.body.reset(sprite.x, sprite.y);
            return true;
        }

        /** The surface height under a given x, for spawning and decor. */
        groundAt(x) {
            const heights = this.groundHeights;
            if (!heights || !heights.length) {
                return this.groundTop;
            }
            const index = Phaser.Math.Clamp(
                Math.floor(x / GROUND_COLUMN), 0, heights.length - 1,
            );
            return heights[index];
        }

        buildOneWayPlatforms(biome, layout) {
            // Layouts come from biomes.json so a test can walk every one of
            // them and prove the tiers are still inside a single jump.
            let spots = (layout && layout.platforms) || [
                { x: 190, y: 424, width: 96 }, { x: 770, y: 424, width: 96 },
                { x: 262, y: 350, width: 96 }, { x: 698, y: 350, width: 96 },
                { x: 334, y: 276, width: 96 }, { x: 626, y: 276, width: 96 },
            ];
            const plan = this.plan || {};
            // Scaffolding you climb to get away from something. A wave of
            // slimes gives you nothing to climb away from, and a floor of
            // ledges made the early rounds read as a platformer rather than
            // as standing your ground. Ground-bound bosses get the same bare
            // floor however late they turn up: King Slime is a slime.
            if (plan.airborneShare < AIRBORNE_FOR_PLATFORMS) {
                spots = [];
            } else if (plan.bulk > 150) {
                // Something the width of the screen needs the floor clear.
                spots = spots.filter((spot) => spot.y < (this.groundBaseTop || 0) - 90);
            }
            const plankKey = this.tileKey(biome ? biome.platform : "platform-wood")
                || this.tileKey("platform-wood");
            for (const spot of spots) {
                const width = spot.width || 96;
                if (plankKey) {
                    // Same split the floor uses: a tileSprite draws the plank
                    // run at whatever width the layout asked for, and an
                    // invisible image carries the collision.
                    const art = this.add.tileSprite(spot.x, spot.y, width, 8, plankKey);
                    art.setTileScale(WORLD_SCALE).setDepth(6);
                    this.scenery.push(art);
                }
                const platform = this.oneWayPlatforms.create(spot.x, spot.y, "tb-platform");
                platform.setVisible(!plankKey);
                platform.setDisplaySize(width, 8);
                platform.refreshBody();
                platform.body.checkCollision.down = false;
                platform.body.checkCollision.left = false;
                platform.body.checkCollision.right = false;
            }
        }

        /** Plants, flowers and trees along the floor, all from the biome set. */
        scatterDecor(biome) {
            if (!biome || !biome.decor) {
                return;
            }
            // Where something has already been put, so the next one does
            // not land on top of it.
            const taken = [];
            const place = (spec, depth, originY) => {
                if (!spec) {
                    return;
                }
                const key = this.decorKey(spec.sprite);
                if (!key) {
                    return;
                }
                const meta = (data.decor || {})[spec.sprite] || {};
                const [low, high] = spec.count || [1, 1];
                const total = Phaser.Math.Between(low, high);
                const width = meta.frameWidth || 16;
                for (let i = 0; i < total; i += 1) {
                    // Keep the middle clear: that is where the player drops in.
                    let x = Phaser.Math.Between(24, this.arenaWidth - 24);
                    if (Math.abs(x - this.playerStartX()) < 60 && depth < 5) {
                        continue;
                    }
                    // Purely random x put two tufts three pixels apart, which
                    // draws as one smeared clump rather than two plants. Given
                    // a few tries it finds clear ground; if the arena really is
                    // that crowded it gives up rather than looping.
                    let clear = true;
                    for (let tries = 0; tries < 6; tries += 1) {
                        clear = !taken.some((other) => Math.abs(other - x) < width * 0.8);
                        if (clear) {
                            break;
                        }
                        x = Phaser.Math.Between(24, this.arenaWidth - 24);
                    }
                    if (!clear) {
                        continue;
                    }
                    // Nudged off the seam between two ground columns. A sprite
                    // sits at the height of whichever column its centre is in,
                    // so one straddling a step has half of itself hanging over
                    // the drop.
                    const intoColumn = x % GROUND_COLUMN;
                    const margin = Math.min(width / 2, GROUND_COLUMN / 2 - 1);
                    if (intoColumn < margin) {
                        x += margin - intoColumn;
                    } else if (intoColumn > GROUND_COLUMN - margin) {
                        x -= intoColumn - (GROUND_COLUMN - margin);
                    }
                    taken.push(x);
                    const sprite = this.add.image(x, this.groundAt(x) + 1, key);
                    if (meta.frames > 1) {
                        sprite.setFrame(Phaser.Math.Between(0, meta.frames - 1));
                    }
                    sprite.setOrigin(0.5, originY).setDepth(depth);
                    if (Math.random() < 0.5) {
                        sprite.setFlipX(true);
                    }
                    this.scenery.push(sprite);
                }
            };
            // Trees sit behind the fighting, plants in front of the ground fill.
            place(biome.decor.tree, 3, 1);
            place(biome.decor.plants, 6, 1);
            place(biome.decor.flower, 6, 1);
        }

        /* -- particles -- */

        buildParticles() {
            // One emitter per effect, parked and idle; bursts are fired with
            // explode() so nothing runs when the arena is quiet.
            const make = (texture, config) =>
                this.add.particles(0, 0, texture, Object.assign({ emitting: false }, config))
                    .setDepth(20);

            this.fx = {
                // Cloud in a Bottle: a soft puff kicked out under the player.
                cloud: make("tb-puff", {
                    speed: { min: 25, max: 85 },
                    angle: { min: 200, max: 340 },
                    scale: { start: 1.15, end: 0 },
                    alpha: { start: 0.9, end: 0 },
                    lifespan: 480,
                }),
                dust: make("tb-bit", {
                    speed: { min: 15, max: 55 },
                    angle: { min: 230, max: 310 },
                    scale: { start: 1.4, end: 0 },
                    alpha: { start: 0.75, end: 0 },
                    gravityY: 220,
                    lifespan: 420,
                }),
                spark: make("tb-bit", {
                    speed: { min: 60, max: 190 },
                    scale: { start: 1.5, end: 0 },
                    alpha: { start: 1, end: 0 },
                    lifespan: 300,
                }),
                debris: make("tb-shard", {
                    speed: { min: 90, max: 300 },
                    scale: { start: 1.6, end: 0 },
                    alpha: { start: 1, end: 0 },
                    rotate: { start: 0, end: 360 },
                    gravityY: 420,
                    lifespan: 620,
                }),
                sparkle: make("tb-bit", {
                    speed: { min: 20, max: 90 },
                    scale: { start: 1.3, end: 0 },
                    alpha: { start: 1, end: 0 },
                    gravityY: -60,
                    lifespan: 420,
                }),
            };
            this.nextDustAt = 0;
            this.wasOnGround = true;
        }

        /**
         * Terraria-style gore: real chunks of the enemy tumble out, land and
         * fade. Enemies without matched artwork (slimes, most bosses) return
         * false so the caller keeps the tinted debris burst instead.
         */
        spawnGore(enemyId, x, y, isBoss) {
            const pieces = (data.gore || {})[enemyId];
            if (!pieces || !pieces.length) {
                return false;
            }
            // Some creatures only had one chunk in the pack worth using, and a
            // single piece reads as a dropped item rather than a death. Repeat
            // what there is until the burst is worth the name.
            const count = isBoss
                ? Math.max(6, pieces.length * 3)
                : Math.max(3, pieces.length);
            for (let i = 0; i < count; i += 1) {
                const key = `tb-gore-${enemyId}-${i % pieces.length}`;
                if (!this.textures.exists(key)) {
                    continue;
                }
                const chunk = this.gore.create(
                    x + Phaser.Math.Between(-6, 6),
                    y + Phaser.Math.Between(-6, 6),
                    key,
                );
                chunk.setDepth(7);
                chunk.setScale(WORLD_SCALE);
                chunk.setVelocity(
                    Phaser.Math.Between(-190, 190),
                    Phaser.Math.Between(-320, -120),
                );
                chunk.setAngularVelocity(Phaser.Math.Between(-420, 420));
                chunk.setBounce(0.35);
                chunk.setCollideWorldBounds(true);
                // Settle, then fade so the arena never fills up with corpses.
                this.tweens.add({
                    targets: chunk,
                    alpha: 0,
                    delay: 1400,
                    duration: 700,
                    onComplete: () => chunk.active && chunk.destroy(),
                });
            }
            return true;
        }

        burst(name, count, x, y, tint) {
            const emitter = this.fx && this.fx[name];
            if (!emitter) {
                return;
            }
            if (tint !== undefined && emitter.setParticleTint) {
                emitter.setParticleTint(tint);
            }
            emitter.explode(count, x, y);
        }

        paintFallbackBackdrop() {
            // Night-sky backdrop with a faint moon, all placeholder shapes.
            this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x0b1d2e);
            this.add.circle(VIEW_WIDTH - 130, 90, 34, 0xf4eecb, 0.85);
            this.add.circle(VIEW_WIDTH - 118, 80, 30, 0x0b1d2e, 0.9);
            for (let i = 0; i < 40; i += 1) {
                const x = Phaser.Math.Between(0, VIEW_WIDTH);
                const y = Phaser.Math.Between(0, VIEW_HEIGHT / 2);
                this.add.rectangle(x, y, 2, 2, 0xffffff, Phaser.Math.FloatBetween(0.2, 0.8));
            }
        }

        fitBackground() {
            const source = this.textures.get(this.background.texture.key).getSourceImage();
            const scale = Math.max(VIEW_WIDTH / source.width, VIEW_HEIGHT / source.height);
            this.background.setScale(scale);
        }

        /** Move to a fresh arena between rounds: new biome, new floor plan.
         *
         * This rebuilds the ground as well as the sky. Swapping the backdrop
         * alone would leave you standing on hellstone under a snowfield.
         */
        rotateArena(prefer, wantLayout, boss = null) {
            const all = (data.biomes && data.biomes.biomes) || [];
            // Worked out before anything is built, because the ground and the
            // scaffolding both read it.
            this.plan = this.fightPlan(boss, this.expectedMobCount());
            if (!this.background || all.length < 2) {
                return;
            }
            let next = this.pickArena(prefer, wantLayout);
            // Re-roll to avoid repeating a biome, unless a boss asked for a
            // specific one -- Plantera belongs in the jungle even twice over.
            for (let tries = 0; tries < 6 && !(prefer && prefer.length) && next.biome
                && this.biome && next.biome.id === this.biome.id; tries += 1) {
                next = this.pickArena(prefer, wantLayout);
            }
            this.applyArena(next.biome || this.biome, next.layout || this.layout);
            // The player may have been standing on a platform that just went
            // away; let them fall rather than leaving them stuck in mid-air.
            if (this.player && this.player.body) {
                this.player.body.setAllowGravity(true);
                // A corridor round ends three screens from the origin, and the
                // arena that follows it is one screen wide. Without this the
                // player is left standing outside the world, off camera, with
                // the round going on somewhere they cannot see.
                if (this.player.x > this.arenaWidth - 40) {
                    this.player.setPosition(
                        this.playerStartX(),
                        this.groundAt(this.playerStartX()) - 40,
                    );
                    this.cameras.main.centerOn(this.player.x, VIEW_HEIGHT / 2);
                }
                this.standOnGround(this.player);
            }
            this.tweens.add({
                targets: this.background,
                alpha: { from: 0.35, to: 1 },
                duration: 450,
            });
        }

        buildPlayer() {
            const startX = this.playerStartX();
            this.player = this.physics.add.sprite(
                startX, this.groundAt(startX) - 40, "tb-player",
            );
            this.player.setCollideWorldBounds(true);
            this.player.body.setSize(20, 30);
            this.player.setDepth(10);
            this.player.dropThroughUntil = 0;
            // Follows loosely and only sideways: the arena is one screen tall
            // whatever its length, and a camera that chased jumps would make
            // the horizon bob every time the player hopped.
            this.cameras.main.startFollow(this.player, true, 0.09, 0);
            this.cameras.main.setFollowOffset(0, 0);
            this.applySkin(this.player, this.character.id);
            this.buildWings();
            this.buildWornArmor();
            this.buildHeldWeapon();

            this.physics.add.collider(this.player, this.platforms);
            this.playerPlatformCollider = this.physics.add.collider(
                this.player,
                this.oneWayPlatforms,
                null,
                () => this.time.now >= this.player.dropThroughUntil,
                this,
            );
        }

        buildGroups() {
            this.projectiles = this.physics.add.group();
            this.bags = this.physics.add.group();
            this.enemyShots = this.physics.add.group();
            this.mobs = this.physics.add.group();
            this.coins = this.physics.add.group();
            this.pickups = this.physics.add.group();
            this.gore = this.physics.add.group();

            this.physics.add.collider(this.mobs, this.platforms);
            this.physics.add.collider(this.mobs, this.oneWayPlatforms);
            this.physics.add.collider(this.coins, this.platforms);
            this.physics.add.collider(this.coins, this.oneWayPlatforms);
            this.physics.add.collider(this.pickups, this.platforms);
            this.physics.add.collider(this.pickups, this.oneWayPlatforms);
            this.physics.add.collider(this.gore, this.platforms);
            // Arcade reflects the body itself; this only counts the bounce and
            // ends the shot once it has none left.
            this.physics.world.on("worldbounds", (body) => {
                const projectile = body.gameObject;
                if (!projectile || !projectile.active || projectile.bouncesLeft === undefined) {
                    return;
                }
                if (projectile.bouncesLeft > 0) {
                    projectile.bouncesLeft -= 1;
                    audio.play("hit", 40);
                    this.burst("spark", 3, projectile.x, projectile.y, projectile.tintTopLeft);
                } else {
                    projectile.destroy();
                }
            });

            this.physics.add.collider(this.projectiles, this.platforms, (projectile) => {
                // Meteor Shot: the floor turns the round rather than ending it.
                // Arcade has already reflected the velocity by the time the
                // callback runs, so there is nothing to compute here.
                if (projectile.bouncesLeft > 0) {
                    projectile.bouncesLeft -= 1;
                    audio.play("hit", 40);
                    this.burst("spark", 3, projectile.x, projectile.y, projectile.tintTopLeft);
                    return;
                }
                this.onProjectileImpact(projectile, null);

            });

            this.physics.add.overlap(this.projectiles, this.mobs, (projectile, mob) => {
                this.onProjectileImpact(projectile, mob);
            });
            this.physics.add.overlap(this.player, this.mobs, (player, mob) => {
                this.onPlayerTouched(mob);
            });
            this.physics.add.overlap(this.player, this.enemyShots, (player, shot) => {
                shot.destroy();
                this.hurtPlayer(shot.damage, shot.x);
            });
            this.physics.add.overlap(this.player, this.coins, (player, coin) => {
                this.burst("sparkle", 4, coin.x, coin.y, 0xffd75e);
                const worth = coin.value || 1;
                coin.destroy();
                audio.play("coin", 70);
                this.coinsCollected += worth;
                this.coinsEarnedTotal += worth;
                hud.coins.textContent = String(this.coinsCollected);
            });
            this.physics.add.collider(this.bags, this.platforms);
            this.physics.add.overlap(this.player, this.bags, (player, bag) => {
                if (bag.opened) {
                    return;
                }
                bag.opened = true;
                this.burst("sparkle", 18, bag.x, bag.y, 0xd8a0e0);
                audio.play("coin", 40);
                this.pendingBag = null;
                if (!openBag(this, bag.bossData)) {
                    // Nothing left to offer; do not leave an inert bag lying
                    // in the arena for the player to keep walking into.
                    bag.destroy();
                    return;
                }
                bag.destroy();
            });
            this.physics.add.overlap(this.player, this.pickups, (player, pickup) => {
                this.burst("sparkle", 8, pickup.x, pickup.y, 0xff6b7a);
                pickup.destroy();
                audio.play("heart");
                const heal = (data.rounds.drops || {}).heartHeal || 20;
                this.playerHp = Math.min(this.maxHp, this.playerHp + heal);
                updateHudHearts(this.playerHp, this.maxHp);
            });
        }

        buildInput() {
            const codes = Phaser.Input.Keyboard.KeyCodes;
            this.keys = this.input.keyboard.addKeys({
                leftA: codes.A, leftQ: codes.Q, leftArrow: codes.LEFT,
                right: codes.D, rightArrow: codes.RIGHT,
                jumpW: codes.W, jumpZ: codes.Z, jumpSpace: codes.SPACE, jumpArrow: codes.UP,
                down: codes.S, downArrow: codes.DOWN,
                dash: codes.SHIFT,
            });
            this.input.keyboard.on("keydown-ONE", () => this.switchSlot(0));
            this.input.keyboard.on("keydown-TWO", () => this.switchSlot(1));
            // 1 and 2 are the weapon slots, so the belt carries on from there.
            ["THREE", "FOUR", "FIVE", "SIX", "SEVEN"].forEach((name, index) => {
                this.input.keyboard.on(`keydown-${name}`, () => {
                    this.drinkPotion(this.belt()[index]);
                });
            });
            this.input.on("wheel", () => this.switchSlot(this.activeSlot === 0 ? 1 : 0));
            this.input.keyboard.on("keydown-I", () => toggleGear(this));
            this.input.keyboard.on("keydown-ESC", () => {
                if (!gearUi.panel.hidden) {
                    closeGear();
                }
            });
        }

        /* -- wings -- */

        buildWings() {
            this.wingsSprite = this.add.sprite(this.player.x, this.player.y, "tb-arrow");
            // Behind the body, as Terraria draws them.
            this.wingsSprite.setDepth(this.player.depth - 1).setVisible(false);
            this.wingsKey = null;
            this.flightLeftMs = 0;
            this.flying = false;
            for (const [id, spec] of Object.entries(data.wings || {})) {
                const key = `tb-wings-${id}`;
                if (this.textures.exists(key) && !this.anims.exists(`tb-flap-${id}`)) {
                    this.anims.create({
                        key: `tb-flap-${id}`,
                        frames: this.anims.generateFrameNumbers(key, { start: 0, end: spec.frames - 1 }),
                        frameRate: 14,
                        repeat: -1,
                    });
                }
            }
        }

        updateWings() {
            // The meter follows the flight, not the art: rocket boots let you
            // fly with flame at the heels and no wings on the back.
            const flight = this.loadout.flight;
            hud.flight.hidden = !flight;
            if (flight) {
                const total = flight.durationMs || 1;
                hud.flightFill.style.width =
                    `${Math.round((this.flightLeftMs / total) * 100)}%`;
            }

            const wings = this.wingsSprite;
            if (!wings) {
                return;
            }
            const id = this.loadout.wings;
            const key = id && this.textures.exists(`tb-wings-${id}`) ? `tb-wings-${id}` : null;
            if (!key) {
                wings.setVisible(false);
                return;
            }
            if (this.wingsKey !== key) {
                wings.setTexture(key, 0);
                this.wingsKey = key;
            }
            wings.setVisible(true)
                .setScale(WORLD_SCALE)
                .setFlipX(this.player.flipX)
                .setAlpha(this.player.alpha)
                // Sit on the character's back, a little above centre.
                .setPosition(
                    this.player.x + (this.player.flipX ? -4 : 4),
                    this.player.y - 4,
                );

            if (this.flying) {
                if (!wings.anims.isPlaying) {
                    wings.play(`tb-flap-${id}`);
                }
            } else {
                wings.anims.stop();
                wings.setFrame(0);
            }
        }

        /* -- worn armor -- */

        buildWornArmor() {
            // Sits over the character and copies its frame every tick. The
            // strips were cut to our frame order, so the index maps straight
            // across without any translation here.
            this.wornHelmet = this.add.sprite(this.player.x, this.player.y, "tb-arrow");
            this.wornHelmet.setDepth(this.player.depth + 1).setVisible(false);
            this.wornHelmetKey = null;
        }

        updateWornArmor() {
            const helmet = this.wornHelmet;
            if (!helmet) {
                return;
            }
            const piece = this.armor.head;
            const key = piece && this.textures.exists(`tb-worn-${piece.id}`)
                ? `tb-worn-${piece.id}`
                : null;
            if (!key) {
                helmet.setVisible(false);
                return;
            }
            if (this.wornHelmetKey !== key) {
                helmet.setTexture(key, 0);
                this.wornHelmetKey = key;
            }
            const frameIndex = Number(this.player.frame.name) || 0;
            helmet.setVisible(true)
                .setScale(this.player.scaleX, this.player.scaleY)
                .setFlipX(this.player.flipX)
                .setPosition(this.player.x, this.player.y)
                .setAlpha(this.player.alpha)
                .setFrame(Math.min(frameIndex, helmet.texture.frameTotal - 2));
        }

        /* -- held weapon -- */

        buildHeldWeapon() {
            this.heldWeapon = this.add.sprite(this.player.x, this.player.y, "tb-arrow");
            this.heldWeapon.setDepth(11).setVisible(false);
            this.heldWeaponKey = null;
            this.heldRecoil = 0;
            this.aimAngle = 0;
        }

        /** The item id behind a weapon's sprite path, if it has real art. */
        weaponItemKey(weapon) {
            if (!weapon || !hasArt(weapon.sprite)) {
                return null;
            }
            // The file's own name, not a fixed slice off an "items/" prefix:
            // a pack keeps its art in its own folder, and the old slice cut
            // six characters off whatever path it was handed.
            const base = weapon.sprite.slice(
                weapon.sprite.lastIndexOf("/") + 1, -4,
            );
            return this.itemKey(base);
        }

        updateHeldWeapon() {
            const held = this.heldWeapon;
            const weapon = this.weapon;
            const aim = this.input.activePointer.positionToCamera(this.cameras.main);
            this.aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y);

            const thrown = weapon && weapon.category === "yoyo"
                && this.activeYoyo && this.activeYoyo.active;
            const key = thrown ? null : this.weaponItemKey(weapon);
            if (!key) {
                held.setVisible(false);
                return;
            }
            if (this.heldWeaponKey !== key) {
                held.setTexture(key);
                this.heldWeaponKey = key;
            }
            held.setVisible(true).setScale(WORLD_SCALE);

            // Terraria holds the item out along the aim line and mirrors it
            // across that line when you aim left, so it never hangs upside down.
            held.setRotation(this.aimAngle);
            held.setFlipY(Math.cos(this.aimAngle) < 0);

            this.heldRecoil = Math.max(0, this.heldRecoil - 0.6);
            const reach = 11 - this.heldRecoil;
            held.setPosition(
                this.player.x + Math.cos(this.aimAngle) * reach,
                this.player.y + 2 + Math.sin(this.aimAngle) * reach,
            );
        }

        /** Where a shot leaves the weapon, rather than the player's chest. */
        muzzlePoint(angle) {
            const held = this.heldWeapon;
            const reach = (held.visible ? held.displayWidth * 0.5 : 8) + 6;
            return {
                x: this.player.x + Math.cos(angle) * reach,
                y: this.player.y + 2 + Math.sin(angle) * reach,
            };
        }

        /** Terraria rolls every hit and can crit; returns the final figure. */
        rollDamage(base, category, extraCrit = 0) {
            const combat = data.rounds.combat || {};
            const variance = combat.damageVariance !== undefined ? combat.damageVariance : 0.15;
            const rolled = base * Phaser.Math.FloatBetween(1 - variance, 1 + variance);
            // Armour sets add flat crit chance on top of the base 4%, the way
            // Terraria's ranged sets do; a Keen or Unreal prefix adds its own.
            const chance = (combat.critChance !== undefined ? combat.critChance : 0.04)
                + (category ? (this.loadout.critBonus[category] || 0) : 0)
                + extraCrit;
            const crit = Math.random() < chance;
            const multiplier = crit ? (combat.critMultiplier || 2) : 1;
            return { amount: Math.max(1, Math.round(rolled * multiplier)), crit };
        }

        /* -- weapon slots + mana -- */

        switchSlot(index) {
            if (index === this.activeSlot || !this.weaponSlots[index]) {
                return;
            }
            this.activeSlot = index;
            this.updateHudWeapons();
        }

        equipWeapon(weapon, slotIndex = null) {
            // Fills the first empty slot unless told otherwise; the shop and
            // debug console both come through here.
            let slot = slotIndex;
            if (slot === null) {
                slot = this.weaponSlots[0] === null ? 0 : (this.weaponSlots[1] === null ? 1 : this.activeSlot);
            }
            this.weaponSlots[slot] = weapon;
            this.weaponsUsed[weapon.id] = (this.weaponsUsed[weapon.id] || 0) + 1;
            this.updateHudWeapons();
        }

        updateHudWeapons() {
            const [first, second] = this.weaponSlots;
            hud.weapon.textContent = first ? first.name : "—";
            hud.weapon.classList.toggle("is-active", this.activeSlot === 0);
            hud.weapon2.hidden = !second;
            hud.weapon2.textContent = second ? second.name : "—";
            hud.weapon2.classList.toggle("is-active", this.activeSlot === 1);
            hud.mana.hidden = !this.weaponSlots.some((w) => w && w.category === "staff");
        }

        updateHudMana() {
            const shown = Math.floor(this.mana);
            if (shown !== this.lastManaShown) {
                this.lastManaShown = shown;
                hud.manaValue.textContent = String(shown);
            }
        }

        /* -- armor + accessories -- */

        recomputeLoadout() {
            const loadout = {
                defense: 0,
                extraJumps: 0,
                moveSpeedMultiplier: 1,
                regenPerSecond: 0,
                dash: null,
                flight: null,
                wings: null,
                damageMultiplier: {},
                projectileSpeedMultiplier: {},
                pierceBonus: {},
                critBonus: {},
                jumpMultiplier: 1,
                damageTakenMultiplier: 1,
                // A pool that soaks hits before health does, and refills once
                // you have been left alone. Flat defense reduces every hit a
                // little; this absorbs a few outright and then has to recover.
                barrier: null,
                flightBonusMs: 0,
                // Fires back when you are hit hard enough. Set bonuses use it;
                // nothing stops an accessory doing the same.
                retaliate: null,
            };
            // The character's own ability lands in the loadout first, so it
            // stacks with gear rather than replacing any of it.
            const ability = this.ability || {};
            loadout.defense += ability.defense || 0;
            loadout.regenPerSecond += ability.regenPerSecond || 0;
            mergeMultipliers(loadout.damageMultiplier, ability.damageMultiplier);

            const pieces = Object.values(this.armor).filter(Boolean);
            for (const piece of pieces) {
                loadout.defense += piece.defense || 0;
            }
            const setIds = new Set(pieces.map((piece) => piece.setId));
            if (pieces.length === 3 && setIds.size === 1) {
                const effects = (pieces[0].setBonus || {}).effects || {};
                loadout.defense += effects.defense || 0;
                loadout.moveSpeedMultiplier *= effects.moveSpeedMultiplier || 1;
                if (effects.retaliate) {
                    loadout.retaliate = effects.retaliate;
                }
                mergeMultipliers(loadout.damageMultiplier, effects.damageMultiplier);
                mergeAdditive(loadout.pierceBonus, effects.pierceBonus);
                mergeAdditive(loadout.critBonus, effects.critBonus);
            }
            // Terraria's boots and shields are upgrade chains -- you craft the
            // next one out of the last -- so only the best of a chain counts.
            // Wearing all four boots would otherwise multiply out to 4x speed.
            const best = new Map();
            for (const accessory of this.accessories) {
                const group = accessory.exclusive;
                if (!group) {
                    continue;
                }
                const held = best.get(group);
                if (!held || (accessory.tier || 0) > (held.tier || 0)) {
                    best.set(group, accessory);
                }
            }
            const active = this.accessories.filter(
                (accessory) => !accessory.exclusive
                    || best.get(accessory.exclusive) === accessory,
            );
            loadout.superseded = this.accessories.length - active.length;

            for (const accessory of active) {
                const effects = accessory.effects || {};
                loadout.extraJumps += effects.extraJumps || 0;
                loadout.moveSpeedMultiplier *= effects.moveSpeedMultiplier || 1;
                loadout.regenPerSecond += effects.regenPerSecond || 0;
                loadout.defense += effects.defense || 0;
                loadout.jumpMultiplier *= effects.jumpMultiplier || 1;
                loadout.damageTakenMultiplier *= effects.damageTakenMultiplier || 1;
                loadout.flightBonusMs += effects.flightBonusMs || 0;
                if (effects.barrier) {
                    // Two of them stack their pools rather than the larger
                    // winning, since each is its own piece of equipment.
                    const held = loadout.barrier;
                    loadout.barrier = held
                        ? {
                            capacity: held.capacity + effects.barrier.capacity,
                            regenPerSecond: Math.max(
                                held.regenPerSecond, effects.barrier.regenPerSecond,
                            ),
                            delayMs: Math.min(held.delayMs, effects.barrier.delayMs),
                        }
                        : { ...effects.barrier };
                }
                mergeAdditive(loadout.critBonus, effects.critBonus);
                if (effects.dash) {
                    loadout.dash = effects.dash;
                }
                // Wings do not stack: the best pair wins, as in Terraria.
                if (effects.flight
                    && (!loadout.flight || effects.flight.durationMs > loadout.flight.durationMs)) {
                    loadout.flight = effects.flight;
                    loadout.wings = effects.wings;
                }
                mergeMultipliers(loadout.damageMultiplier, effects.damageMultiplier);
                mergeMultipliers(loadout.projectileSpeedMultiplier, effects.projectileSpeedMultiplier);
            }
            // Reforges apply to everything, including categories no gear has
            // touched, so they must be folded in after the merges above.
            if (this.damageBonus) {
                const scale = 1 + this.damageBonus;
                for (const category of Object.keys(data.weapons.categories || {})) {
                    loadout.damageMultiplier[category] =
                        (loadout.damageMultiplier[category] || 1) * scale;
                }
            }
            // Buffs land last, on top of gear, set bonuses and reforges. They
            // are the temporary layer, so nothing below them has to know they
            // exist -- when one lapses this runs again and the layer is gone.
            const buffs = this.buffEffects ? this.buffEffects() : {};
            const categories = Object.keys(data.weapons.categories || {});
            loadout.defense += buffs.defense || 0;
            loadout.regenPerSecond += buffs.regenPerSecond || 0;
            loadout.moveSpeedMultiplier *= buffs.moveSpeed || 1;
            loadout.damageTakenMultiplier *= buffs.damageTaken || 1;
            loadout.manaRegenMultiplier = buffs.manaRegen || 1;
            loadout.thorns = buffs.thorns || 0;
            loadout.pickupRange = buffs.pickupRange || 0;
            loadout.coinMultiplier = buffs.coins || 1;
            for (const category of categories) {
                const scale = (buffs.damage || 1)
                    * (category === "bow" ? (buffs.bowDamage || 1) : 1)
                    * (category === "staff" ? (buffs.magicDamage || 1) : 1);
                if (scale !== 1) {
                    loadout.damageMultiplier[category] =
                        (loadout.damageMultiplier[category] || 1) * scale;
                }
                if (buffs.crit) {
                    loadout.critBonus[category] = (loadout.critBonus[category] || 0) + buffs.crit;
                }
                if (buffs.projectileSpeed && category === "bow") {
                    loadout.projectileSpeedMultiplier[category] =
                        (loadout.projectileSpeedMultiplier[category] || 1) * buffs.projectileSpeed;
                }
            }

            if (loadout.flight && loadout.flightBonusMs) {
                // Applied after the best pair wins, so the bonus rides on
                // whatever you are actually wearing.
                loadout.flight = {
                    ...loadout.flight,
                    durationMs: loadout.flight.durationMs + loadout.flightBonusMs,
                };
            }

            this.loadout = loadout;
            hud.defense.hidden = loadout.defense <= 0;
            hud.defenseValue.textContent = String(loadout.defense);
        }

        /* -- potions -- */

        stockPotion(potion) {
            const max = potionMaxStack();
            const held = this.potionStock[potion.id] || 0;
            this.potionStock[potion.id] = Math.min(max, held + 1);
            renderBelt(this);
        }

        /** The belt in hotkey order: the order potions.json lists them. */
        belt() {
            const slots = (data.potions || {}).beltSlots || 5;
            return (data.potions.potions || [])
                .filter((potion) => (this.potionStock[potion.id] || 0) > 0)
                .slice(0, slots);
        }

        drinkPotion(potion) {
            if (!potion || !(this.potionStock[potion.id] > 0) || this.over) {
                return false;
            }
            this.potionStock[potion.id] -= 1;
            if (!this.potionStock[potion.id]) {
                delete this.potionStock[potion.id];
            }
            const ms = (potion.seconds || 30) * 1000;
            const existing = this.buffs.find((buff) => buff.id === potion.id);
            if (existing) {
                // Terraria refreshes rather than stacks, and stacking here
                // would let you hold a permanent +30 defense by hoarding.
                existing.endsAt = this.time.now + ms;
            } else {
                this.buffs.push({ id: potion.id, potion, endsAt: this.time.now + ms, ms });
            }
            audio.play("heart", 90);
            this.burst("sparkle", 10, this.player.x, this.player.y,
                Phaser.Display.Color.HexStringToColor(potion.tint || "#ffffff").color);
            this.applyBuffs();
            renderBelt(this);
            renderBuffs(this);
            return true;
        }

        /** Drop buffs whose time is up, and re-derive anything they touched. */
        tickBuffs() {
            if (!this.buffs.length) {
                return;
            }
            const now = this.time.now;
            const before = this.buffs.length;
            this.buffs = this.buffs.filter((buff) => buff.endsAt > now);
            if (this.buffs.length !== before) {
                this.applyBuffs();
                renderBelt(this);
            }
            renderBuffs(this);
        }

        /** Every effect a buff has, gathered into one object. */
        buffEffects() {
            const total = {};
            for (const buff of this.buffs) {
                for (const [key, value] of Object.entries(buff.potion.effects || {})) {
                    if (key === "defense" || key === "regenPerSecond"
                        || key === "crit" || key === "maxHpBonus") {
                        total[key] = (total[key] || 0) + value;   // additive
                    } else if (key === "pickupRange") {
                        total[key] = Math.max(total[key] || 0, value);
                    } else {
                        total[key] = (total[key] || 1) * value;   // multiplicative
                    }
                }
            }
            return total;
        }

        /** Fold the current buffs into everything derived from them. */
        applyBuffs() {
            const effects = this.buffEffects();

            // Lifeforce moves the ceiling, so the bar has to move with it and
            // the hearts you gained must go away again when it lapses.
            const bonus = effects.maxHpBonus || 0;
            const wasMax = this.maxHp;
            this.maxHp = this.baseMaxHp + bonus;
            if (this.maxHp > wasMax) {
                this.playerHp += this.maxHp - wasMax;
            }
            this.playerHp = Math.min(this.playerHp, this.maxHp);
            updateHudHearts(this.playerHp, this.maxHp);

            // Featherfall works on the body directly: gravity is per-body here.
            if (this.player && this.player.body) {
                const world = (data.rounds.player || {}).gravity || 1440;
                const fall = effects.fallSpeed || 1;
                this.player.body.setGravityY(world * fall - world);
            }

            this.recomputeLoadout();
            // The bar is derived from the same list the stats are, so it is
            // repainted here rather than only on the expiry path. Otherwise
            // any other way of changing the buffs leaves a stale chip behind.
            renderBuffs(this);
        }

        /**
         * Repaint the gear and inventory panels after something changed.
         *
         * Buying updated the data and the HUD but never these, so a purchase
         * landed in your armour and the slot still read "empty" until the
         * panel was reopened. Called from the mutations themselves, so the
         * shop, a treasure bag and anything added later all get it.
         */
        refreshGear() {
            if (gearScene === this) {
                renderGear();
            }
        }

        /* -- ammunition -- */

        /** Load a type into its family slot; whatever was there goes to the stash. */
        loadAmmo(entry) {
            const family = entry.family;
            const previous = this.ammo[family];
            if (previous && previous.id !== entry.id) {
                // Stashed rather than dropped, so a swap is reversible and the
                // coins you spent on the old box are not simply gone.
                this.stashItem("ammo", previous);
            }
            this.ammo[family] = entry;
            this.refreshGear();
            audio.play("shoot-gun", 60);
        }

        /** What the given weapon category is firing, if anything. */
        ammoFor(category) {
            return (this.ammo || {})[category] || null;
        }

        equipArmorPiece(piece) {
            this.armor[piece.slot] = piece;
            this.recomputeLoadout();
            this.refreshGear();
        }

        equipAccessory(accessory) {
            this.accessories.push(accessory);
            this.recomputeLoadout();
            this.refreshGear();
        }

        /* -- acquiring gear --------------------------------------------------
         * Bought gear equips itself only when a slot is free; otherwise it
         * waits in the stash. Nothing you already wear is ever swapped out
         * behind your back — the gear screen is where trades happen.
         */

        stashItem(kind, item) {
            this.stash.push({ kind, item });
            this.refreshGear();
        }

        sellFromStash(kind, itemId, price) {
            const item = this.takeFromStash(kind, itemId);
            if (!item) {
                return false;
            }
            this.coinsCollected += price;
            hud.coins.textContent = String(this.coinsCollected);
            return true;
        }

        takeFromStash(kind, itemId) {
            const index = this.stash.findIndex(
                (entry) => entry.kind === kind && entry.item.id === itemId,
            );
            return index === -1 ? null : this.stash.splice(index, 1)[0].item;
        }

        acquireWeapon(weapon) {
            this.weaponsUsed[weapon.id] = (this.weaponsUsed[weapon.id] || 0) + 1;
            const free = this.weaponSlots.indexOf(null);
            if (free === -1) {
                this.stashItem("weapon", weapon);
                return;
            }
            this.weaponSlots[free] = weapon;
            this.updateHudWeapons();
            this.refreshGear();
        }

        acquireArmor(piece) {
            if (this.armor[piece.slot]) {
                this.stashItem("armor", piece);
                return;
            }
            this.equipArmorPiece(piece);
        }

        acquireAccessory(accessory) {
            const max = data.accessories.maxEquipped || 5;
            if (this.accessories.length >= max) {
                this.stashItem("accessory", accessory);
                return;
            }
            this.equipAccessory(accessory);
        }

        /**
         * Crystals are used on the spot rather than carried: a Life Crystal
         * adds a heart and fills it, as using one does in Terraria.
         */
        consume(item) {
            const effects = item.effects || {};
            if (effects.maxHpBonus) {
                const cap = effects.maxHpCap || Infinity;
                const gained = Math.min(effects.maxHpBonus, Math.max(0, cap - this.baseMaxHp));
                this.baseMaxHp += gained;
                this.playerHp += gained;
                // Re-derives maxHp from the new base plus any live buff, and
                // repaints the hearts.
                this.applyBuffs();
                this.burst("sparkle", 12, this.player.x, this.player.y, 0xff5f7a);
            }
            if (effects.damageBonus) {
                // No cap: this is the only thing left to spend late coins on.
                this.damageBonus += effects.damageBonus;
                this.recomputeLoadout();
                this.burst("sparkle", 14, this.player.x, this.player.y, 0xffc95f);
            }
            if (effects.maxManaBonus) {
                const cap = effects.maxManaCap || Infinity;
                const gained = Math.min(effects.maxManaBonus, Math.max(0, cap - this.maxMana));
                this.maxMana += gained;
                this.mana = Math.min(this.maxMana, this.mana + gained);
                this.updateHudMana();
                this.burst("sparkle", 12, this.player.x, this.player.y, 0x7aa8ff);
            }
        }

        /* -- gear screen actions -- */

        unequip(kind, key) {
            if (kind === "weapon") {
                const weapon = this.weaponSlots[key];
                if (!weapon) {
                    return;
                }
                this.weaponSlots[key] = null;
                // Never leave the active slot pointing at nothing.
                if (this.activeSlot === key) {
                    this.activeSlot = this.weaponSlots[0] ? 0 : (this.weaponSlots[1] ? 1 : 0);
                }
                this.stashItem("weapon", weapon);
                this.updateHudWeapons();
            } else if (kind === "armor") {
                const piece = this.armor[key];
                if (!piece) {
                    return;
                }
                this.armor[key] = null;
                this.stashItem("armor", piece);
                this.recomputeLoadout();
            } else if (kind === "accessory") {
                const accessory = this.accessories[key];
                if (!accessory) {
                    return;
                }
                this.accessories.splice(key, 1);
                this.stashItem("accessory", accessory);
                this.recomputeLoadout();
            } else if (kind === "ammo") {
                const entry = this.ammo[key];
                if (!entry) {
                    return;
                }
                this.ammo[key] = null;
                this.stashItem("ammo", entry);
            }
        }

        equipFromStash(kind, itemId) {
            if (kind === "weapon" && this.weaponSlots.indexOf(null) === -1) {
                return false;
            }
            if (kind === "armor") {
                const piece = this.stash.find(
                    (entry) => entry.kind === "armor" && entry.item.id === itemId,
                );
                if (!piece || this.armor[piece.item.slot]) {
                    return false;
                }
            }
            if (kind === "accessory"
                && this.accessories.length >= (data.accessories.maxEquipped || 5)) {
                return false;
            }
            const item = this.takeFromStash(kind, itemId);
            if (!item) {
                return false;
            }
            if (kind === "weapon") {
                this.weaponSlots[this.weaponSlots.indexOf(null)] = item;
                this.updateHudWeapons();
            } else if (kind === "armor") {
                this.equipArmorPiece(item);
            } else if (kind === "ammo") {
                this.loadAmmo(item);
            } else {
                this.equipAccessory(item);
            }
            return true;
        }

        /* -- hardmode -- */

        get hardmodeConfig() {
            return data.rounds.hardmode || {};
        }

        /**
         * Turn the world over, once the boss that does it has fallen.
         *
         * Terraria's hardmode starts when the Wall of Flesh dies, and this
         * follows it: everything after is tougher, the shop opens earlier, and
         * the Hallow exists at all. A pack can name a different boss.
         */
        checkHardmode(boss) {
            const config = this.hardmodeConfig;
            if (this.hardmode || !config.triggerBoss || boss.bossId !== config.triggerBoss) {
                return;
            }
            this.hardmode = true;
            this.hardmodeSince = this.round;
            audio.play("boss-spawn");
            this.cameras.main.shake(600, 0.016);
            this.showBanner(config.banner || "HARDMODE", config.say);
            updateHudHardmode(true);
        }

        /* -- rounds -- */

        get bossEvery() {
            return this.difficulty.bossEvery || data.rounds.bossEveryNRounds || 5;
        }

        /**
         * What an ordinary wave at this round is worth in coins.
         *
         * The average of what this round can spawn, scaled the way a mob's
         * drop is scaled, times how many turn up. Used to price a boss, whose
         * round spawns no wave at all -- so without this the reward for the
         * hardest round in the cycle had nothing to be measured against and
         * sat at a flat number that never moved.
         */
        waveValue() {
            const scaling = (data.rounds && data.rounds.scaling) || {};
            const pool = this.roundPool();
            if (!pool.length) {
                return 0;
            }
            const average = pool.reduce((sum, mob) => sum + (mob.coins || 0), 0) / pool.length;
            return this.roundScale(average, scaling.coinMultiplierPerRound)
                * this.expectedMobCount();
        }

        /** How many bodies this round will put on the field. */
        expectedMobCount() {
            const scaling = (data.rounds && data.rounds.scaling) || {};
            let count = Math.min(
                scaling.mobCountMax || 12,
                (scaling.mobCountBase || 4)
                + Math.floor(Math.max(0, this.round - 1) * (scaling.mobCountPerRound || 0)),
            );
            if (this.event) {
                count = Math.max(2, Math.round(count * (this.event.spawnMultiplier || 1)));
            }
            return count;
        }

        startNextRound() {
            if (this.over) {
                return;
            }
            this.round += 1;
            hud.round.textContent = String(this.round);
            this.roundActive = true;

            // Pick the boss before moving the arena: it decides where the
            // fight happens, so Plantera pulls you into the jungle and the
            // Wall of Flesh into the underworld.
            const isBossRound = this.round % this.bossEvery === 0;
            const boss = isBossRound ? this.pickBoss() : null;
            // A boss round is already the event, so only ordinary rounds roll one.
            this.event = boss ? null : this.pickEvent();
            if (this.round > 1) {
                const prefer = boss ? boss.biomes : this.event && this.event.biomes;
                this.rotateArena(prefer, boss && boss.arena, boss);
            }
            this.applyEventShade();

            if (boss) {
                this.showBanner(boss.name.toUpperCase());
                audio.play("boss-spawn");
                audio.playMusic("boss");
                this.spawnBoss(boss);
            } else {
                if (this.event) {
                    this.showBanner(this.event.name.toUpperCase(), this.event.description);
                    audio.play("boss-spawn");
                } else {
                    this.showBanner(`ROUND ${this.round}`);
                }
                audio.playMusic("battle");
                const scaling = data.rounds.scaling;
                let count = Math.min(
                    scaling.mobCountMax,
                    scaling.mobCountBase + Math.floor((this.round - 1) * scaling.mobCountPerRound),
                );
                if (this.event) {
                    // Past the usual ceiling on purpose: a Blood Moon should feel
                    // like more than a normal round, not like a normal round.
                    count = Math.max(2, Math.round(count * (this.event.spawnMultiplier || 1)));
                }
                // A bigger wave should arrive faster, not take longer: hold the
                // wave roughly as long as a plain round and let it come thicker.
                const gap = this.event
                    ? Math.max(140, Math.round(420 / (this.event.spawnMultiplier || 1)))
                    : 420;
                this.pendingSpawns = count;
                for (let i = 0; i < count; i += 1) {
                    this.time.delayedCall(i * gap, () => {
                        this.pendingSpawns -= 1;
                        this.spawnHordeMob();
                    });
                }
            }
        }

        pickEvent() {
            const config = data.events || {};
            const round = this.round;
            if (round < (config.minRound || 0) || Math.random() >= (config.chance || 0)) {
                return null;
            }
            const pool = (config.events || []).filter((event) => round >= (event.minRound || 0));
            if (!pool.length) {
                return null;
            }
            const total = pool.reduce((sum, event) => sum + (event.weight || 1), 0);
            let roll = Math.random() * total;
            let pick = pool[0];
            for (const event of pool) {
                roll -= event.weight || 1;
                if (roll <= 0) {
                    pick = event;
                    break;
                }
            }
            return pick;
        }

        applyEventShade() {
            // A wash over the backdrop, under everything that matters. The
            // biome art still reads through it; the round just changes colour.
            const shade = this.event && this.event.shade;
            if (!this.eventShade) {
                // Depth 1 sits over the backdrop and its readability shade but
                // under the terrain, so a Blood Moon reddens the sky and leaves
                // the ground you are standing on alone.
                this.eventShade = this.add
                    .rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0)
                .setScrollFactor(0)
                    .setDepth(1);
            }
            this.tweens.killTweensOf(this.eventShade);
            if (!shade) {
                this.tweens.add({ targets: this.eventShade, alpha: 0, duration: 600 });
                return;
            }
            this.eventShade.setFillStyle(Phaser.Display.Color.HexStringToColor(shade).color, 1);
            this.tweens.add({ targets: this.eventShade, alpha: 0.45, duration: 900 });
        }

        pickBoss() {
            const bosses = data.bosses.bosses;
            const index = Math.floor(this.round / this.bossEvery) - 1;
            const loops = Math.floor(index / bosses.length);
            const boss = bosses[index % bosses.length];
            const multiplier = data.bosses.loopMultiplier;
            return {
                ...boss,
                hp: Math.round(boss.hp * Math.pow(multiplier.hp, loops)),
                contactDamage: Math.round(boss.contactDamage * Math.pow(multiplier.damage, loops)),
            };
        }

        roundScale(base, perRound) {
            return base * (1 + (this.round - 1) * perRound);
        }

        /**
         * Health scaling, which unlike damage has to keep up with a player whose
         * power compounds. Takes whichever ramp is steeper at this round, so the
         * early game is exactly as it was and only the endgame changes.
         */
        roundScaleHp(base) {
            const scaling = data.rounds.scaling;
            const linear = 1 + (this.round - 1) * scaling.hpMultiplierPerRound;
            const growth = scaling.hpGrowthPerRound
                ? Math.pow(scaling.hpGrowthPerRound, this.round - 1)
                : 0;
            return base * Math.max(linear, growth);
        }

        spawnHordeMob() {
            if (this.over) {
                return;
            }
            const only = (this.event || {}).only;
            let pool = (data.rounds.mobs || []).filter(
                (mob) => this.round >= mob.minRound && this.round <= mob.maxRound
                    && (!mob.hardmode || this.hardmode),
            );
            if (only && only.length) {
                // An invasion is its own cast. Ignore minRound here: a Frost
                // Legion with nothing in it would be an empty round.
                const cast = (data.rounds.mobs || []).filter((mob) => only.includes(mob.id));
                if (cast.length) {
                    pool = cast;
                }
            }
            if (!pool.length) {
                return;
            }
            // Biome affinity is a weight, not a filter: ice slimes dominate the
            // snow and demons the underworld, but the pool never empties out
            // and leaves a round with nothing to fight.
            const here = this.biome && this.biome.id;
            const weightFor = (mob) => (
                here && (mob.biomes || []).includes(here)
                    ? mob.weight * BIOME_WEIGHT_BONUS
                    : mob.weight
            );
            const totalWeight = pool.reduce((sum, mob) => sum + weightFor(mob), 0);
            let roll = Math.random() * totalWeight;
            let pick = pool[0];
            for (const mob of pool) {
                roll -= weightFor(mob);
                if (roll <= 0) {
                    pick = mob;
                    break;
                }
            }

            // Just off whichever side of the window the player can see, so a
            // corridor spawns its horde ahead of and behind them rather than
            // at the far end of a world they have run away from.
            const view = this.cameras.main;
            const x = Phaser.Math.Clamp(
                Math.random() < 0.5 ? view.scrollX + 40 : view.scrollX + VIEW_WIDTH - 40,
                30, this.arenaWidth - 30,
            );
            const airborne = pick.behavior === "flyer" || pick.behavior === "caster";
            const y = airborne
                ? Phaser.Math.Between(60, 200)
                : this.groundAt(x) - 60;
            this.materializeMob(pick, x, y);
        }

        materializeMob(pick, x, y) {
            const scaling = data.rounds.scaling;
            const mob = this.mobs.create(x, y, `tb-mob-${pick.id}`);
            mob.setDepth(9);
            mob.setCollideWorldBounds(true);
            const event = this.event || {};
            // A one-off step, not another compounding term: the round ramp
            // already compounds, and stacking a second one would put a wall in
            // the run where hardmode should be a threshold.
            const hard = this.hardmode ? this.hardmodeConfig : {};
            mob.hp = Math.round(this.roundScaleHp(pick.hp)
                * (this.difficulty.enemyHp || 1) * (event.enemyHp || 1)
                * (hard.enemyHp || 1));
            mob.contactDamage = Math.round(
                this.roundScale(pick.contactDamage, scaling.damageMultiplierPerRound)
                * (this.difficulty.enemyDamage || 1) * (event.enemyDamage || 1)
                * (hard.enemyDamage || 1),
            );
            mob.coinDrop = Math.max(1, Math.round(
                this.roundScale(pick.coins, scaling.coinMultiplierPerRound)
                * (this.ability.coinMultiplier || 1) * (event.coins || 1)
                * (hard.coins || 1),
            ));
            mob.enemyId = pick.id;
            mob.particleTint = Phaser.Display.Color.HexStringToColor(pick.color || "#ffffff").color;
            mob.behavior = pick.behavior;
            mob.isBoss = false;
            mob.nextHopAt = 0;
            mob.speed = pick.speed && Math.round(pick.speed * (event.enemySpeed || 1));
            mob.standoff = pick.standoff;
            mob.shootConfig = pick.shoot;
            mob.maxHp = mob.hp;
            // Creatures that come apart rather than dying outright.
            mob.splitAtHp = pick.splitAtHp;
            mob.splitInto = pick.splitInto;
            mob.splitScale = pick.splitScale;
            if (pick.behavior === "flyer" || pick.behavior === "caster") {
                mob.body.setAllowGravity(false);
            }
            if (pick.skin) {
                const tint = pick.skin.useColor
                    ? Phaser.Display.Color.HexStringToColor(pick.color || "#ffffff").color
                    : null;
                this.applySkin(mob, pick.skin.id, tint);
            }
            // After the skin: applySkin sets the scale, so an elite has to
            // resize on top of it rather than before.
            this.makeElite(mob, pick);
            return mob;
        }

        /**
         * Occasionally promote a creature. The enemy answer to weapon
         * prefixes: rarer, tougher, and worth more when it goes down.
         *
         * Elites are marked by size and a coloured aura rather than a tint,
         * because slimes already use their tint to be the colour they are.
         */
        makeElite(mob, pick) {
            const config = data.rounds.elites;
            if (!config || !(config.affixes || []).length || mob.isBoss) {
                return;
            }
            const chance = Math.max(
                (this.event || {}).eliteChance || 0,
                Math.min(
                    config.chanceMax !== undefined ? config.chanceMax : 0.2,
                    (config.chanceBase || 0) + (config.chancePerRound || 0) * this.round,
                ),
            );
            if (Math.random() >= chance) {
                return;
            }
            const affixes = config.affixes;
            const total = affixes.reduce((sum, entry) => sum + (entry.weight || 1), 0);
            let roll = Math.random() * total;
            let affix = affixes[0];
            for (const entry of affixes) {
                roll -= entry.weight || 1;
                if (roll <= 0) {
                    affix = entry;
                    break;
                }
            }
            mob.elite = affix.id;
            mob.eliteName = affix.name;
            mob.hp = Math.round(mob.hp * (affix.hp || 1));
            mob.maxHp = mob.hp;
            mob.contactDamage = Math.round(mob.contactDamage * (affix.contactDamage || 1));
            mob.coinDrop = Math.max(1, Math.round(mob.coinDrop * (affix.coins || 1)));
            if (affix.speed && mob.speed) {
                mob.speed = Math.round(mob.speed * affix.speed);
            }
            if (affix.scale) {
                mob.setScale(mob.scaleX * affix.scale, mob.scaleY * affix.scale);
                mob.body.setSize(mob.body.width, mob.body.height, true);
            }
            mob.auraTint = Phaser.Display.Color.HexStringToColor(affix.aura || "#ffffff").color;
            mob.nextAuraAt = 0;
        }

        spawnServant(mobId, x, y, count, owner = null) {
            const definition = (data.rounds.mobs || []).find((mob) => mob.id === mobId);
            if (!definition) {
                return;
            }
            for (let i = 0; i < count; i += 1) {
                const servant = this.materializeMob(
                    definition,
                    Phaser.Math.Clamp(x + Phaser.Math.Between(-70, 70), 30, VIEW_WIDTH - 30),
                    Math.max(50, y - Phaser.Math.Between(10, 50)),
                );
                // Remembered so a boss can be armoured by what it summoned.
                if (servant && owner) {
                    servant.summonedBy = owner;
                }
            }
        }

        /**
         * How much of a hit a boss shrugs off for every summon still alive.
         *
         * The Perforator Hive takes 30% less per worm on the field, up to 90%,
         * so killing what it spawned is the way in rather than an optional
         * chore. Without this the worms are scenery and the fight is a
         * stationary target.
         */
        servantArmour(boss) {
            const perServant = boss.patternConfig.damageReductionPerServant || 0;
            if (!perServant) {
                return 1;
            }
            let alive = 0;
            for (const mob of this.mobs.getChildren()) {
                if (mob.active && mob.summonedBy === boss) {
                    alive += 1;
                }
            }
            const cap = boss.patternConfig.damageReductionCap ?? 0.9;
            return 1 - Math.min(cap, perServant * alive);
        }

        spawnBoss(bossData) {
            const x = Math.random() < 0.5 ? 90 : VIEW_WIDTH - 90;
            const boss = this.mobs.create(x, 120, `tb-boss-${bossData.id}`);
            boss.setDepth(9);
            boss.setCollideWorldBounds(true);
            // Bosses took no round scaling at all, so the whole first cycle
            // went stale: a round-55 Moon Lord died in under two seconds to a
            // kitted player and hit for seventeen. They scale with the round
            // now, on the linear ramp rather than the horde's compounding one
            // -- the boss ladder is its own progression, climbing seventeen
            // times over from King Slime to Moon Lord, and compounding on top
            // of that would count the same rise twice.
            const scaling = data.rounds.scaling;
            boss.hp = Math.round(
                this.roundScale(bossData.hp, scaling.hpMultiplierPerRound)
                * (this.difficulty.enemyHp || 1),
            );
            boss.maxHp = boss.hp;
            boss.contactDamage = Math.round(
                this.roundScale(bossData.contactDamage, scaling.damageMultiplierPerRound)
                * (this.difficulty.enemyDamage || 1),
            );
            // Priced against the wave it cancels. A boss round spawns no
            // horde, so a flat 25 meant reaching one cost you the round's
            // income: at round 20 the wave would have paid 240 and the Moon
            // Lord paid 25, a tenth, for the hardest fight on the board. It
            // pays a multiple of that wave now, so a boss is the payday it
            // looks like and the number keeps up on its own.
            boss.coinDrop = Math.round(
                this.waveValue() * ((data.rounds.scaling || {}).bossCoinMultiplier || 1.6)
                * (this.ability.coinMultiplier || 1),
            );
            boss.isBoss = true;
            boss.enemyId = bossData.id;
            boss.particleTint = Phaser.Display.Color.HexStringToColor(bossData.color || "#ffffff").color;
            boss.bossId = bossData.id;
            boss.bossName = bossData.name;
            boss.achievementOnKill = bossData.achievementOnKill;
            boss.bossSource = bossData;
            boss.pattern = bossData.pattern || "kingslime";
            boss.patternConfig = bossData.patternConfig || {};
            if (bossData.skin) {
                const tint = bossData.skin.tint
                    ? Phaser.Display.Color.HexStringToColor(bossData.skin.tint).color
                    : null;
                this.applySkin(boss, bossData.skin.id, tint);
                if (bossData.skin.alpha !== undefined) {
                    boss.setAlpha(bossData.skin.alpha);
                }
                boss.facePlayer = Boolean(bossData.skin.facePlayer);
                boss.spinOnDash = Boolean(bossData.skin.spinOnDash);
                // Second-phase artwork is independent of the movement pattern.
                if (bossData.skin.enrageAnim) {
                    boss.enrageAnim = `tb-anim-${bossData.skin.id}-enraged`;
                }
            }
            boss.skinScale = boss.scaleX;

            const config = boss.patternConfig;
            boss.shootConfig = config.shoot;
            boss.summonAtFractions = [...(config.servantsAtHpFractions || [])];
            boss.servantMob = config.servantMob || "demon-eye";
            boss.servantCount = config.servantCount || 2;

            // Stages are read now but never re-sorted later: a fight walks down
            // this list and never climbs back up it.
            boss.stages = [...(bossData.phases || [])].sort((a, b) => b.atHp - a.atHp);
            boss.stageIndex = -1;

            this.initBossPattern(boss, x);

            this.burst("spark", 26, boss.x, boss.y, boss.particleTint);
            this.burst("cloud", 12, boss.x, boss.y, 0x2b1f2f);
            this.bossBar = this.add.rectangle(VIEW_WIDTH / 2, 24, 420, 10, 0xd4524b)
                .setDepth(60).setScrollFactor(0);
            this.bossBarBack = this.add.rectangle(VIEW_WIDTH / 2, 24, 424, 14, 0x0a1a0d)
                .setDepth(59).setScrollFactor(0);
        }

        /**
         * Everything a pattern needs before its branch in updateBoss will work.
         * Split out of spawnBoss because a phase can change the pattern mid
         * fight, and the new one has to start from a state it understands.
         */
        initBossPattern(boss, x) {
            const config = boss.patternConfig;
            if (boss.pattern === "kingslime") {
                boss.nextHopAt = 0;
                boss.hopCount = 0;
                const step = config.summonEveryHpFraction || 0.25;
                boss.summonAtFractions = [];
                for (let fraction = 1 - step; fraction > 0.01; fraction -= step) {
                    boss.summonAtFractions.push(Number(fraction.toFixed(3)));
                }
                boss.servantMob = config.summonMob || "green-slime";
                boss.servantCount = 1;
            } else if (boss.pattern === "stomper") {
                boss.nextSlamAt = this.time.now + (config.slamEveryMs || 2400);
                boss.slamPending = false;
                boss.body.setAllowGravity(true);
                if (x !== undefined) {
                    boss.setPosition(x, this.groundAt(x) - 80);
                }
            } else if (boss.pattern === "wall") {
                boss.body.setAllowGravity(false);
                if (x !== undefined) {
                    // At one end of the corridor, not one end of the window:
                    // measured against the screen it started a quarter of the
                    // way down a four-screen arena, sometimes ahead of the
                    // player, and the chase began with the wall in front.
                    const nearEnd = boss.x < this.arenaWidth / 2;
                    boss.setPosition(
                        nearEnd ? 60 : this.arenaWidth - 60,
                        this.groundAt(nearEnd ? 60 : this.arenaWidth - 60)
                            - boss.displayHeight / 2,
                    );
                }
            } else if (boss.pattern === "worm") {
                boss.body.setAllowGravity(false);
                if (!boss.segments) {
                    this.spawnWormSegments(boss, config.segments || 6);
                }
            } else if (boss.pattern === "shooter") {
                boss.body.setAllowGravity(false);
            } else if (boss.pattern === "teleporter") {
                boss.body.setAllowGravity(false);
                boss.nextBlinkAt = this.time.now + (config.blinkEveryMs || 2600);
                boss.blinkPending = false;
            } else if (boss.pattern === "spinner") {
                boss.body.setAllowGravity(false);
                boss.orbitAngle = Math.random() * Math.PI * 2;
            } else {
                // charger
                boss.phase = "hover";
                boss.phaseUntil = this.time.now + (config.hoverMs || 2300);
                boss.dashesLeft = 0;
                boss.body.setAllowGravity(false);
            }
        }

        /** A bag where the boss fell, tinted to match it. */
        dropTreasureBag(boss) {
            const source = boss.bossSource;
            if (!source || !(source.drops || []).length) {
                return;
            }
            const key = this.itemKey("treasure-bag");
            if (!key) {
                return;
            }
            const bag = this.bags.create(
                Phaser.Math.Clamp(boss.x, 60, VIEW_WIDTH - 60),
                Math.min(boss.y, this.groundTop - 60),
                key,
            );
            bag.setDepth(9).setScale(1.4);
            bag.bossData = source;
            bag.opened = false;
            // Remembered separately: if the round ends before you reach it, the
            // reward is still owed and the shop waits until it is taken.
            this.pendingBag = source;
            bag.setCollideWorldBounds(true);
            bag.setBounce(0.35);
            bag.setVelocity(Phaser.Math.Between(-60, 60), -220);
            // A slow bob, so it reads as loot rather than scenery.
            this.tweens.add({
                targets: bag,
                scaleX: 1.55,
                scaleY: 1.25,
                yoyo: true,
                repeat: -1,
                duration: 620,
                ease: "Sine.easeInOut",
            });
            this.burst("sparkle", 20, bag.x, bag.y, 0xd8a0e0);
        }

        spawnWormSegments(boss, count) {
            // Visual only: the head carries the hitbox, the body trails it.
            boss.segments = [];
            for (let i = 0; i < count; i += 1) {
                const segment = this.add.image(boss.x, boss.y, boss.texture.key, 0);
                segment.setScale(boss.scaleX * (1 - i * 0.045));
                segment.setDepth(8);
                segment.setAlpha(0.95);
                segment.history = [];
                boss.segments.push(segment);
            }
            boss.trail = [];
        }

        updateWormSegments(boss) {
            if (!boss.segments) {
                return;
            }
            boss.trail.unshift({ x: boss.x, y: boss.y, rotation: boss.rotation, flipY: boss.flipY });
            const spacing = 6;
            const needed = boss.segments.length * spacing + 1;
            if (boss.trail.length > needed) {
                boss.trail.length = needed;
            }
            boss.segments.forEach((segment, index) => {
                const point = boss.trail[Math.min((index + 1) * spacing, boss.trail.length - 1)];
                if (point) {
                    segment.setPosition(point.x, point.y);
                    segment.setRotation(point.rotation);
                    segment.setFlipY(point.flipY);
                }
            });
        }

        clearWormSegments(boss) {
            if (boss.segments) {
                for (const segment of boss.segments) {
                    segment.destroy();
                }
                boss.segments = null;
            }
        }

        shockwave(boss, config) {
            const radius = config.shockRadius || 150;
            this.burst("dust", 16, boss.x, this.groundTop, 0xd8c9a8);
            this.burst("debris", 10, boss.x, this.groundTop, 0xc87a34);
            const ring = this.add.circle(boss.x, this.groundTop, radius, 0xffc86b, 0.35).setDepth(30);
            this.tweens.add({
                targets: ring,
                alpha: 0,
                scale: 1.4,
                duration: 320,
                onComplete: () => ring.destroy(),
            });
            const onGround = this.player.body.blocked.down || this.player.body.touching.down;
            if (onGround && Math.abs(this.player.x - boss.x) <= radius) {
                this.hurtPlayer(config.shockDamage || boss.contactDamage, boss.x);
            }
        }

        showBanner(text, subtitle) {
            this.banner.setText(text).setAlpha(1);
            this.bannerSub.setText(subtitle || "").setAlpha(subtitle ? 1 : 0);
            this.tweens.killTweensOf([this.banner, this.bannerSub]);
            this.tweens.add({
                targets: [this.banner, this.bannerSub],
                alpha: 0,
                delay: subtitle ? 1600 : 1100,
                duration: 500,
            });
        }

        /**
         * Everything still on the floor when the fighting stops.
         *
         * The shop opens about a second after the last kill, which is not
         * enough time to walk the arena picking up change -- a round-15 boss
         * paid 323 and a player standing across the map banked 7 of it. The
         * money was earned; collecting it was a formality the round did not
         * leave room for. They fly to the player and land in the purse.
         */
        sweepDroppedCoins() {
            let swept = 0;
            for (const coin of this.coins.getChildren()) {
                if (!coin.active) {
                    continue;
                }
                swept += coin.value || 1;
                const target = coin;
                this.tweens.add({
                    targets: target,
                    x: this.player.x,
                    y: this.player.y,
                    duration: 260,
                    ease: "Quad.easeIn",
                    onComplete: () => target.destroy(),
                });
                if (target.body) {
                    target.body.setAllowGravity(false);
                    target.body.setVelocity(0, 0);
                }
            }
            if (swept > 0) {
                this.coinsCollected += swept;
                this.coinsEarnedTotal += swept;
                hud.coins.textContent = String(this.coinsCollected);
                audio.play("coin", 40);
                this.burst("sparkle", 10, this.player.x, this.player.y, 0xffd75e);
            }
            return swept;
        }

        onRoundCleared() {
            this.roundActive = false;
            // Before anything else: the round is over and the shop is next.
            this.sweepDroppedCoins();
            const wasBossRound = this.round % this.bossEvery === 0;
            const mend = this.ability.healAfterBoss || 0;
            if (wasBossRound && mend && this.playerHp < this.maxHp) {
                const missing = this.maxHp - this.playerHp;
                this.playerHp = Math.min(this.maxHp, this.playerHp + Math.ceil(missing * mend));
                updateHudHearts(this.playerHp, this.maxHp);
            }
            // Journey patches you up after every round. It is the rung you
            // play to see the game rather than to be tested by it, and what
            // actually ended those runs was chip damage from round four that
            // never came back. Read off the difficulty rather than its name,
            // so another rung can offer a partial mend without a code change.
            const rest = this.difficulty.healBetweenRounds || 0;
            if (rest > 0 && this.playerHp < this.maxHp) {
                const missing = this.maxHp - this.playerHp;
                const healed = Math.ceil(missing * Math.min(1, rest));
                this.playerHp = Math.min(this.maxHp, this.playerHp + healed);
                updateHudHearts(this.playerHp, this.maxHp);
                this.burst("spark", 12, this.player.x, this.player.y, 0x7ce07c);
                // "heart", not "heal": play() ignores a name it does not know,
                // so the obvious spelling would have been a silent no-op.
                audio.play("heart");
            }
            if (this.bossBar) {
                this.bossBar.destroy();
                this.bossBarBack.destroy();
                this.bossBar = null;
                this.bossBarBack = null;
            }
            // Nothing the wave fired should follow you into the shop.
            this.enemyShots.clear(true, true);
            this.showBanner("ROUND CLEARED!");
            if (this.event) {
                // The moon sets with the last of the horde.
                this.event = null;
                this.applyEventShade();
            }
            audio.play("round-clear");
            audio.playMusic("menu");
            this.time.delayedCall(1100, () => {
                if (this.over) {
                    return;
                }
                const waiting = this.pendingBag;
                if (waiting) {
                    this.pendingBag = null;
                    this.bags.clear(true, true);
                    if (openBag(this, waiting, () => openShop(this))) {
                        return;
                    }
                }
                openShop(this);
            });
        }

        /* -- combat -- */

        fireWeapon(pointer) {
            const weapon = this.weapon;
            if (!weapon || this.over) {
                return;
            }
            const now = this.time.now;
            const isYoyo = weapon.category === "yoyo";
            if (isYoyo && this.activeYoyo && this.activeYoyo.active) {
                return;
            }
            if (!isYoyo && now < this.nextFireAt) {
                return;
            }
            if (weapon.category === "staff") {
                const cost = Math.ceil(
                    (weapon.manaCost || 0) * (this.ability.manaCostMultiplier || 1),
                );
                if (this.mana < cost) {
                    return;
                }
                this.mana -= cost;
                this.updateHudMana();
            }
            this.nextFireAt = now + (weapon.fireRateMs || 400)
                * ((this.ability.fireRateMultiplier || {})[weapon.category] || 1);

            const world = pointer.positionToCamera(this.cameras.main);
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, world.x, world.y);
            audio.play(`shoot-${weapon.category}`, 45);
            // Kick the weapon back in the hand, and leave from its tip.
            this.heldRecoil = 5;
            const muzzle = this.muzzlePoint(angle);

            // A shotgun's pellets are one use of the weapon: one mana charge,
            // one recoil, one report, several projectiles fanned across the aim.
            const shots = isYoyo ? 1 : Math.max(1, weapon.shots || 1);
            const spread = Phaser.Math.DegToRad(weapon.spreadDeg || 0);
            for (let i = 0; i < shots; i += 1) {
                const offset = shots === 1 ? 0 : spread * (i / (shots - 1) - 0.5);
                this.spawnShot(weapon, muzzle, angle + offset, now, isYoyo);
            }
        }

        /** One projectile from one weapon. Fired several times over for a spread. */
        spawnShot(weapon, muzzle, angle, now, isYoyo) {
            const art = PROJECTILE_ART[weapon.category] || {};
            // Thrown weapons are the item: a Molotov should not fly as a grenade.
            const selfKey = art.self ? this.weaponItemKey(weapon) : null;
            const textureKey = selfKey || (art.item && this.itemKey(art.item)) ||
                art.generated || "tb-arrow";
            const projectile = this.projectiles.create(muzzle.x, muzzle.y, textureKey);
            projectile.setDepth(11);
            if (textureKey.startsWith("tb-item-")) {
                // An inventory icon is drawn to be read in a slot, not to fly:
                // the wooden arrow's icon is 14x32 against a 26x46 player, so
                // shots looked like thrown furniture. This used to multiply by
                // WORLD_SCALE against a comment claiming the world ran at 2x --
                // it runs at 1, so the call did nothing at all.
                projectile.setScale(PROJECTILE_ART_SCALE);
                // A bullet sprite is two pixels wide, which gave it a one pixel
                // hitbox -- a thread that had to thread a moving 18px mob. The
                // art stays a thin tracer; the hitbox is the size the shot
                // deserves. Arrows already exceed this and are untouched.
                projectile.body.setSize(
                    Math.max(PROJECTILE_MIN_HITBOX, projectile.width * 0.6),
                    Math.max(PROJECTILE_MIN_HITBOX, projectile.height * 0.6),
                    true,
                );
            }
            projectile.alignToVelocity = Boolean(art.align);
            if (art.spin) {
                projectile.body.setAngularVelocity(540);
            }
            // The ability's own damage bonus is already folded into the
            // loadout, so it must not be applied a second time here.
            const damage = weapon.damage * (this.loadout.damageMultiplier[weapon.category] || 1);
            const loaded = (this.ammoFor(weapon.category) || {}).effects || {};
            const roll = this.rollDamage(
                damage * (loaded.damage || 1),
                weapon.category,
                (weapon.critBonus || 0) + (loaded.crit || 0),
            );
            projectile.damage = roll.amount;
            projectile.isCrit = roll.crit;
            // Kept on the projectile so re-rolls later (a yoyo ticking, a
            // rocket splashing) still know which set bonus applies.
            projectile.category = weapon.category;
            projectile.critBonus = weapon.critBonus || 0;
            // What is loaded for this family. A weapon fires the same either
            // way; the ammo is what changes how the shot behaves.
            const ammo = (this.ammoFor(weapon.category) || {}).effects || {};
            projectile.pierceLeft = (weapon.pierce || 0)
                + (this.loadout.pierceBonus[weapon.category] || 0)
                + (ammo.pierce || 0);
            // A rocket already has a blast, so its ammo scales what is there.
            // A bow has none, so its ammo grants one outright.
            projectile.splashRadius = weapon.splashRadius
                ? Math.round(weapon.splashRadius * (ammo.splashRadius || 1))
                : (ammo.splashRadius > 4 ? ammo.splashRadius : 0);
            projectile.isHoming = Boolean(weapon.homing || ammo.homing);
            projectile.debuff = ammo.debuff || weapon.debuff || null;
            // Ammo is the usual source, but a weapon can declare it too: some
            // of them shoot something that ricochets whatever is loaded.
            projectile.bouncesLeft = ammo.bounce || weapon.bounce || 0;
            if (projectile.bouncesLeft) {
                // Walls and ceiling too, or a ricochet off the floor just
                // leaves the arena and the ammo is a floor-only trick.
                projectile.body.setBounce(1, 1);
                projectile.setCollideWorldBounds(true);
                projectile.body.onWorldBounds = true;
            }
            if (projectile.splashRadius && this.ability.splashMultiplier) {
                projectile.splashRadius =
                    Math.round(projectile.splashRadius * this.ability.splashMultiplier);
            }
            // Jester's Arrows fly flat, whatever the bow would have done.
            const gravityOn = Boolean(weapon.projectileGravity) && !ammo.noGravity;
            projectile.body.setAllowGravity(gravityOn);
            if (gravityOn) {
                // Arcade adds body gravity to the world's, so offset down to
                // the projectile's own pull: arrows glide, they do not plummet.
                const defaults = data.weapons.projectileDefaults || {};
                const own = weapon.projectileGravityY || defaults.gravityY || 360;
                projectile.body.setGravityY(own - this.physics.world.gravity.y);
                projectile.body.setMaxVelocity(
                    100000,
                    weapon.projectileMaxFall || defaults.maxFallSpeed || 960,
                );
            }
            const speed = (weapon.projectileSpeed || 700)
                * (this.loadout.projectileSpeedMultiplier[weapon.category] || 1)
                * (ammo.projectileSpeed || 1);
            const tint = (this.ammoFor(weapon.category) || {}).tint;
            if (tint) {
                projectile.setTint(Phaser.Display.Color.HexStringToColor(tint).color);
            }
            projectile.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            if (projectile.alignToVelocity) {
                projectile.setRotation(angle + Math.PI / 2);
            }

            if (isYoyo) {
                projectile.isYoyo = true;
                projectile.launchedAt = now;
                projectile.reach = weapon.reachPx || 220;
                projectile.returnSpeed = weapon.returnSpeed || 900;
                projectile.throwSpeed = weapon.projectileSpeed || 700;
                projectile.returning = false;
                // Where it was aimed, so it has somewhere to sit when nothing
                // is in range rather than drifting off.
                projectile.aimX = muzzle.x + Math.cos(angle) * projectile.reach;
                projectile.aimY = muzzle.y + Math.sin(angle) * projectile.reach;
                projectile.body.setAllowGravity(false);
                this.activeYoyo = projectile;
            } else {
                this.time.delayedCall(2600, () => projectile.active && projectile.destroy());
            }
        }

        fireSkull() {
            // Clothier's ability: a slow homing skull, free and automatic.
            if (this.over) {
                return;
            }
            const target = this.nearestMob(this.player.x, this.player.y);
            if (!target) {
                return;
            }
            const skull = this.projectiles.create(this.player.x, this.player.y - 10, "tb-skull");
            skull.setDepth(11);
            skull.damage = 8;
            skull.pierceLeft = 0;
            skull.splashRadius = 0;
            skull.isHoming = true;
            skull.body.setAllowGravity(false);
            const angle = Phaser.Math.Angle.Between(skull.x, skull.y, target.x, target.y);
            skull.setVelocity(Math.cos(angle) * 420, Math.sin(angle) * 420);
            this.time.delayedCall(4000, () => skull.active && skull.destroy());
        }

        nearestMob(x, y) {
            let best = null;
            let bestDistance = Infinity;
            for (const mob of this.mobs.getChildren()) {
                if (!mob.active) {
                    continue;
                }
                const distance = Phaser.Math.Distance.Between(x, y, mob.x, mob.y);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = mob;
                }
            }
            return best;
        }

        onProjectileImpact(projectile, mob) {
            if (!projectile.active) {
                return;
            }
            if (projectile.isYoyo) {
                // An overlap fires every frame; gate the yoyo so it ticks, not melts.
                if (mob) {
                    if (this.time.now >= (projectile.hitCooldownUntil || 0)) {
                        projectile.hitCooldownUntil = this.time.now + YOYO_TICK_MS;
                        const roll = this.rollDamage(
                            projectile.damage, projectile.category, projectile.critBonus || 0,
                        );
                        this.damageMob(mob, roll.amount, roll.crit);
                    }
                    // Stays out and keeps working. Returning on contact is what
                    // made a yoyo one hit per throw, which is not what a yoyo is.
                    return;
                }
                projectile.returning = true;
                return;
            }
            // Pierce is for passing through one enemy into the next, not for
            // hitting the same one twice. The overlap fires every frame the two
            // are touching, so without this a single pierce point doubled a
            // weapon's damage against one target -- the Marrow measured 2.2x
            // its own arithmetic on a stationary mob.
            if (mob) {
                if (!projectile.hitMobs) {
                    projectile.hitMobs = new Set();
                }
                if (projectile.hitMobs.has(mob)) {
                    return;
                }
                projectile.hitMobs.add(mob);
            }
            // Remembered so the swept check later this frame does not spend a
            // second point of pierce on the mob the overlap just hit.
            projectile.sweepSkip = mob || null;
            if (projectile.splashRadius) {
                this.explode(
                    projectile.x, projectile.y, projectile.splashRadius,
                    projectile.damage, projectile.category, projectile.debuff,
                );
                projectile.destroy();
                return;
            }
            if (mob) {
                this.damageMob(mob, projectile.damage, projectile.isCrit);
                if (projectile.debuff && mob.active) {
                    this.applyDebuff(mob, projectile.debuff);
                }
                if (projectile.pierceLeft > 0) {
                    projectile.pierceLeft -= 1;
                    return;
                }
            }
            projectile.destroy();
        }

        explode(x, y, radius, damage, category, debuff = null) {
            audio.play("explode", 80);
            this.burst("debris", 18, x, y, 0xffb14b);
            this.burst("spark", 14, x, y, 0xfff0a0);
            const flash = this.add.circle(x, y, radius, 0xf2a14b, 0.45).setDepth(30);
            this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
            // Copy first: a kill destroys the mob and mutates the live child
            // array, which would make the loop skip the next enemy in the blast.
            for (const mob of [...this.mobs.getChildren()]) {
                if (mob.active && Phaser.Math.Distance.Between(x, y, mob.x, mob.y) <= radius + mob.width / 2) {
                    // Splash rolls per target, exactly as a direct hit does.
                    const roll = this.rollDamage(damage, category);
                    this.damageMob(mob, roll.amount, roll.crit);
                    if (debuff && mob.active) {
                        this.applyDebuff(mob, debuff);
                    }
                }
            }
        }

        /** Terraria pops the figure off the target so damage is legible. */
        showDamageNumber(x, y, amount, crit) {
            const label = this.add.text(x, y - 10, crit ? `${amount}!` : String(amount), {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: crit ? "13px" : "10px",
                color: crit ? "#ffd75e" : "#f4f4f4",
                stroke: token("--tb-bg-deep", "#080a16"),
                strokeThickness: 3,
            }).setOrigin(0.5).setDepth(45);
            this.tweens.add({
                targets: label,
                y: label.y - (crit ? 26 : 18),
                alpha: 0,
                duration: crit ? 700 : 520,
                onComplete: () => label.destroy(),
            });
        }

        /**
         * Refill the barrier, once it has been left alone long enough.
         *
         * The delay is what makes it a different thing from armour: taking a
         * hit every couple of seconds keeps it at zero, and it only pays out
         * if you can break away.
         */
        tickBarrier(delta) {
            const spec = this.loadout.barrier;
            if (!spec) {
                if (this.barrier || this.barrierCapacity) {
                    this.barrier = 0;
                    this.barrierCapacity = 0;
                    updateHudBarrier(0, 0);
                }
                return;
            }
            // Fill on the frame the capacity changes, which is when it was
            // equipped or a second one stacked onto it. Checking for undefined
            // did not work: the run starts it at zero, so this never fired and
            // a freshly bought shield trickled up from empty instead of
            // arriving ready.
            if (spec.capacity !== this.barrierCapacity) {
                this.barrierCapacity = spec.capacity;
                this.barrier = spec.capacity;
                updateHudBarrier(this.barrier, spec.capacity);
                return;
            }
            if (this.barrier >= spec.capacity) {
                return;
            }
            if (this.time.now - (this.barrierBrokenAt || 0) < spec.delayMs) {
                return;
            }
            const before = Math.floor(this.barrier);
            this.barrier = Math.min(
                spec.capacity, this.barrier + (spec.regenPerSecond * delta) / 1000,
            );
            if (Math.floor(this.barrier) !== before) {
                updateHudBarrier(this.barrier, spec.capacity);
            }
        }

        /* -- debuffs -- */

        debuffSpec(id) {
            return (data.debuffs.debuffs || []).find((entry) => entry.id === id) || null;
        }

        /**
         * Put a debuff on a mob, or refresh one it already has.
         *
         * Refresh rather than stack, for the same reason potions do: a weapon
         * that reapplies every shot would otherwise pile up twenty copies of
         * its own damage-over-time inside a second.
         */
        applyDebuff(mob, id) {
            const spec = this.debuffSpec(id);
            if (!spec || !mob.active) {
                return;
            }
            if (!mob.debuffs) {
                mob.debuffs = new Map();
            }
            const now = this.time.now;
            const existing = mob.debuffs.get(id);
            if (existing) {
                existing.endsAt = now + spec.seconds * 1000;
                return;
            }
            mob.debuffs.set(id, {
                spec,
                endsAt: now + spec.seconds * 1000,
                nextTickAt: now + (data.debuffs.tickMs || 500),
            });
            this.burst(spec.particle || "sparkle", 6, mob.x, mob.y,
                Phaser.Display.Color.HexStringToColor(spec.tint).color);
        }

        /** Damage over time, the visual, and expiry. */
        tickDebuffs(mob, now) {
            if (!mob.debuffs || !mob.debuffs.size) {
                return;
            }
            const tickMs = data.debuffs.tickMs || 500;
            for (const [id, state] of mob.debuffs) {
                if (now >= state.endsAt) {
                    mob.debuffs.delete(id);
                    continue;
                }
                if (now < state.nextTickAt) {
                    continue;
                }
                state.nextTickAt = now + tickMs;
                const tint = Phaser.Display.Color.HexStringToColor(state.spec.tint).color;
                this.burst(state.spec.particle || "sparkle", 2, mob.x, mob.y, tint);
                const perSecond = state.spec.damagePerSecond;
                if (perSecond) {
                    // Damage over time does not crit and does not itself get
                    // amplified, or an Ichor plus a burn would compound on
                    // every tick into something no weapon can match.
                    const amount = Math.max(1, Math.round(perSecond * tickMs / 1000));
                    this.damageMob(mob, amount, false, { fromDebuff: true });
                    if (!mob.active) {
                        return;
                    }
                }
            }
        }

        /**
         * Wash the mob in the colour of whatever is on it, so a burning zombie
         * reads as burning. Skipped while a hit flash is up, which owns the
         * tint for its own 70ms.
         */
        paintDebuffTint(mob) {
            const wanted = mob.debuffs && mob.debuffs.size
                ? [...mob.debuffs.values()][mob.debuffs.size - 1].spec.tint
                : null;
            if (mob.debuffTintKey === wanted || mob.isTintFlashing) {
                return;
            }
            mob.debuffTintKey = wanted;
            if (wanted) {
                mob.setTint(Phaser.Display.Color.HexStringToColor(wanted).color);
            } else {
                this.restoreTint(mob);
            }
        }

        /** How much extra a mob takes right now, from whatever is on it. */
        debuffDamageTaken(mob) {
            if (!mob.debuffs || !mob.debuffs.size) {
                return 1;
            }
            let multiplier = 1;
            for (const state of mob.debuffs.values()) {
                multiplier *= state.spec.damageTakenMultiplier || 1;
            }
            return multiplier;
        }

        /** Speed scale from anything chilling it. */
        debuffSpeed(mob) {
            if (!mob.debuffs || !mob.debuffs.size) {
                return 1;
            }
            let multiplier = 1;
            for (const state of mob.debuffs.values()) {
                multiplier *= state.spec.speedMultiplier || 1;
            }
            return multiplier;
        }

        debuffReverses(mob) {
            if (!mob.debuffs || !mob.debuffs.size) {
                return false;
            }
            for (const state of mob.debuffs.values()) {
                if (state.spec.reverseMovement) {
                    return true;
                }
            }
            return false;
        }

        damageMob(mob, amount, crit = false, options = {}) {
            if (!options.fromDebuff) {
                amount = Math.max(1, Math.round(amount * this.debuffDamageTaken(mob)));
            }
            if (mob.isBoss) {
                amount = Math.max(1, Math.round(amount * this.servantArmour(mob)));
            }
            mob.hp -= amount;
            this.showDamageNumber(
                mob.x + Phaser.Math.Between(-6, 6),
                mob.y - mob.displayHeight * 0.35,
                amount,
                crit,
            );
            audio.play("hit", 60);
            this.burst("spark", crit ? 12 : 5, mob.x, mob.y, crit ? 0xffe066 : mob.particleTint);
            mob.setTintFill(0xffffff);
            mob.isTintFlashing = true;
            this.time.delayedCall(70, () => {
                mob.isTintFlashing = false;
                // Forget what was painted so the wash reapplies next frame if
                // the mob is still burning.
                mob.debuffTintKey = undefined;
                this.restoreTint(mob);
            });
            if (mob.isBoss) {
                const fraction = Math.max(0, mob.hp / mob.maxHp);
                if (this.bossBar) {
                    this.bossBar.width = 420 * fraction;
                }
                if (mob.pattern === "kingslime") {
                    // King Slime shrinks as it loses slime, just like the real one.
                    const minScale = mob.patternConfig.minScale || 0.6;
                    mob.setScale((mob.skinScale || 1) * (minScale + (1 - minScale) * fraction));
                }
                while (mob.summonAtFractions.length && fraction <= mob.summonAtFractions[0]) {
                    mob.summonAtFractions.shift();
                    this.spawnServant(
                        mob.servantMob, mob.x, mob.y, mob.servantCount, mob,
                    );
                }
            }
            if (mob.hp > 0 && !mob.isBoss && this.splitMob(mob)) {
                return;
            }
            if (mob.hp <= 0) {
                this.killMob(mob);
            }
        }

        /**
         * A wounded creature coming apart into smaller copies of itself.
         *
         * Calamity's paladins halve at half health and its middle worm splits
         * when hurt, and both read as the same thing: one thing becomes two
         * smaller ones that share what is left of its health. The halves are
         * marked so they cannot split again, or a slime dissolves into a
         * cloud of specks. Returns true when the original is gone.
         */
        splitMob(mob) {
            const at = mob.splitAtHp;
            if (!at || mob.hasSplit || mob.hp / mob.maxHp > at) {
                return false;
            }
            const pieces = Math.max(2, mob.splitInto || 2);
            const scale = mob.splitScale || 0.7;
            const definition = (data.rounds.mobs || [])
                .find((entry) => entry.id === mob.enemyId);
            if (!definition) {
                return false;
            }
            for (let i = 0; i < pieces; i += 1) {
                const half = this.materializeMob(
                    definition,
                    Phaser.Math.Clamp(
                        mob.x + (i - (pieces - 1) / 2) * 34, 24, VIEW_WIDTH - 24,
                    ),
                    mob.y,
                );
                if (!half) {
                    continue;
                }
                half.hasSplit = true;                 // once only
                half.summonedBy = mob.summonedBy;     // still the boss's armour
                half.hp = Math.max(1, Math.round(mob.hp / pieces));
                half.maxHp = half.hp;
                half.setScale(half.scaleX * scale, half.scaleY * scale);
                half.setVelocity(
                    (i - (pieces - 1) / 2) * 120, -Phaser.Math.Between(90, 170),
                );
            }
            this.burst("debris", 8, mob.x, mob.y, mob.particleTint);
            // Gone quietly: the halves carry the kill and whatever it drops.
            mob.destroy();
            return true;
        }

        killMob(mob) {
            this.kills += 1;
            audio.play("kill", 50);
            const goreShown = this.spawnGore(mob.enemyId, mob.x, mob.y, mob.isBoss);
            // Debris still fires for anything without matched gore art.
            this.burst("debris", goreShown ? 4 : (mob.isBoss ? 34 : 12), mob.x, mob.y, mob.particleTint);
            if (mob.isBoss) {
                this.burst("spark", 24, mob.x, mob.y, 0xfff0c0);
                this.cameras.main.shake(320, 0.014);
            } else if (mob.auraTint !== undefined) {
                // An elite took real effort; let its death land like it.
                this.burst("sparkle", 16, mob.x, mob.y, mob.auraTint);
                this.cameras.main.shake(140, 0.006);
            }
            if (mob.enemyId) {
                this.defeated[mob.enemyId] = (this.defeated[mob.enemyId] || 0) + 1;
            }
            if (mob.isBoss) {
                this.bossKills += 1;
                this.clearWormSegments(mob);
                if (mob.achievementOnKill && !this.achievementsEarned.includes(mob.achievementOnKill)) {
                    this.achievementsEarned.push(mob.achievementOnKill);
                }
                this.dropTreasureBag(mob);
                this.checkHardmode(mob);
            }
            const coinKey = this.itemKey("gold-coin") || "tb-coin";
            const purse = Math.max(1, Math.round(
                mob.coinDrop * ((this.loadout || {}).coinMultiplier || 1),
            ));
            // Denominations, not one sprite per coin. A boss worth 323 used to
            // hit the floor as 323 separate bodies -- more than the round had
            // time to walk over, and a physics group that size for a reward
            // that is a single number. A handful of coins each worth several
            // reads the same and can actually be picked up.
            const coinCount = Math.min(COIN_DROP_MAX, purse);
            const each = Math.floor(purse / coinCount);
            let remainder = purse - each * coinCount;
            for (let i = 0; i < coinCount; i += 1) {
                const coin = this.coins.create(
                    mob.x + Phaser.Math.Between(-14, 14),
                    mob.y + Phaser.Math.Between(-10, 0),
                    coinKey,
                );
                coin.setDepth(8);
                // Whatever does not divide evenly rides on the first few, so
                // the pile is always worth exactly what the kill was worth.
                coin.value = each + (remainder > 0 ? 1 : 0);
                if (remainder > 0) {
                    remainder -= 1;
                }
                if (coinKey !== "tb-coin") {
                    // Bigger denominations look bigger, up to a point.
                    coin.setScale(1.4 * (coin.value > 20 ? 1.35 : 1));
                }
                coin.setCollideWorldBounds(true);
                coin.setVelocity(Phaser.Math.Between(-140, 140), Phaser.Math.Between(-320, -140));
                coin.setBounce(0.45);
            }
            const drops = data.rounds.drops || {};
            if (Math.random() < (drops.heartChance || 0)) {
                const heartKey = this.itemKey("heart") || "tb-heart";
                const heart = this.pickups.create(mob.x, mob.y - 8, heartKey);
                heart.setDepth(8);
                if (heartKey !== "tb-heart") {
                    heart.setScale(1.6);
                }
                heart.setCollideWorldBounds(true);
                heart.setBounce(0.3);
                heart.setVelocity(Phaser.Math.Between(-60, 60), -220);
                this.time.delayedCall(drops.heartLifetimeMs || 10000, () => heart.active && heart.destroy());
            }
            mob.destroy();

            if (this.roundActive && this.mobs.countActive() === 0 && !this.pendingSpawns) {
                this.onRoundCleared();
            }
        }

        onPlayerTouched(mob) {
            const before = this.playerHp;
            this.hurtPlayer(mob.contactDamage, mob.x);
            // Thorns pays back a share of what actually landed, not of what was
            // swung: armour should not make the reflection bigger.
            const taken = before - this.playerHp;
            const thorns = (this.loadout || {}).thorns || 0;
            if (thorns > 0 && taken > 0 && mob.active) {
                this.damageMob(mob, Math.max(1, Math.round(taken * thorns)), false);
            }
        }

        hurtPlayer(rawDamage, sourceX) {
            const now = this.time.now;
            if (now < this.invincibleUntil || this.over) {
                return;
            }
            this.invincibleUntil = now + 900;
            audio.play("hurt");
            this.burst("spark", 10, this.player.x, this.player.y, 0xff4d4d);
            // Terraria's Classic mitigation: defense removes half its value.
            // A quarter of the hit always lands though, or a late armour set
            // reduces every mid-game horde to 1 damage and whole rounds stop
            // being a threat. Reductions like the Worm Scarf then cut what is
            // left, and one damage is always the floor.
            const combat = data.rounds.combat || {};
            const raw = Math.round(rawDamage);
            const floor = raw * (combat.minDamageFraction !== undefined
                ? combat.minDamageFraction
                : 0.25);
            const mitigated = Math.max(floor, raw - Math.floor(this.loadout.defense / 2));
            let damage = Math.max(1, Math.round(mitigated * this.loadout.damageTakenMultiplier));

            // The barrier takes it first, and only what is left over reaches
            // health. Absorbing a hit outright is the point: it turns a run of
            // small hits into no damage at all if you get room to recover.
            if (this.barrier > 0) {
                const soaked = Math.min(this.barrier, damage);
                this.barrier -= soaked;
                damage = Math.round(damage - soaked);
                this.barrierBrokenAt = now;
                this.burst("sparkle", soaked > 0 ? 8 : 2, this.player.x, this.player.y, 0x7d9cff);
                this.showDamageNumber(this.player.x - 14, this.player.y - 30, soaked, false);
                updateHudBarrier(this.barrier, (this.loadout.barrier || {}).capacity || 0);
                if (damage <= 0) {
                    this.player.setVelocity(this.player.x < sourceX ? -180 : 180, -200);
                    return;
                }
            }

            this.playerHp = Math.max(0, this.playerHp - damage);
            this.showDamageNumber(this.player.x, this.player.y - 22, damage, false);
            updateHudHearts(this.playerHp, this.maxHp);
            this.player.setVelocity(this.player.x < sourceX ? -260 : 260, -300);
            this.tweens.add({ targets: this.player, alpha: 0.25, yoyo: true, repeat: 4, duration: 90 });
            if (this.playerHp <= 0) {
                this.onDeath();
                return;
            }
            this.fireRetaliation(damage);
        }

        /**
         * Answer a hit that got through, if something equipped says to.
         *
         * Only what reaches health counts, not what a barrier soaked -- a
         * shield that keeps absorbing should not also be firing back for free.
         */
        fireRetaliation(damage) {
            const spec = this.loadout.retaliate;
            if (!spec || damage < (spec.overDamage || 0) || this.over) {
                return;
            }
            const count = spec.count || 1;
            for (let i = 0; i < count; i += 1) {
                // Spread the volley over a moment so it reads as a burst
                // rather than one thick projectile.
                this.time.delayedCall(i * 70, () => {
                    if (this.over || !this.player.active) {
                        return;
                    }
                    const target = this.nearestMob(this.player.x, this.player.y);
                    const shard = this.projectiles.create(
                        this.player.x, this.player.y - 12, "tb-shard",
                    );
                    shard.setDepth(11).setScale(2.4);
                    shard.setTint(Phaser.Display.Color.HexStringToColor(
                        spec.tint || "#9fd8ff",
                    ).color);
                    shard.damage = spec.damage || 10;
                    shard.pierceLeft = spec.pierce || 0;
                    shard.splashRadius = 0;
                    shard.isHoming = Boolean(spec.homing);
                    shard.body.setAllowGravity(false);
                    const angle = target
                        ? Phaser.Math.Angle.Between(shard.x, shard.y, target.x, target.y)
                        : Phaser.Math.FloatBetween(-Math.PI, 0);
                    const speed = spec.speed || 460;
                    shard.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    this.time.delayedCall(3000, () => shard.active && shard.destroy());
                });
            }
        }

        /* -- enemy ranged attacks (bosses and casters share this) -- */

        /**
         * The launch angle that drops a falling shot onto the player.
         *
         * Aiming a gravity-bound shot straight at someone just puts it in the
         * dirt short of them, which reads as the boss missing rather than as
         * an arc to dodge. This solves the throw instead: for a launch speed
         * and a gravity there are usually two angles that land on the target,
         * a flat one that arrives quickly and a high one that comes down from
         * above.
         *
         * A throw only reaches v^2/g on the flat, so a slow shot across a wide
         * arena has no solution at all. Rather than aim straight at someone it
         * cannot reach -- which drops the shot at the boss's own feet -- it
         * throws at 45 degrees, which is the angle that goes furthest.
         */
        lobAngle(enemy, speed, gravity, high = false) {
            const dx = this.player.x - enemy.x;
            // Screen y grows downward; the maths below wants it growing up.
            const dy = -(this.player.y - enemy.y);
            if (Math.abs(dx) < 1) {
                return Phaser.Math.Angle.Between(
                    enemy.x, enemy.y, this.player.x, this.player.y,
                );
            }
            const v2 = speed * speed;
            const root = v2 * v2 - gravity * (gravity * dx * dx + 2 * dy * v2);
            if (root < 0) {
                return dx < 0 ? -Math.PI * 0.75 : -Math.PI * 0.25;
            }
            // atan2 already resolves which side the target is on -- when dx is
            // negative the denominator is too, and the angle lands past 90.
            const solved = Math.atan2(
                v2 + (high ? 1 : -1) * Math.sqrt(root), gravity * dx,
            );
            return -solved;                          // back to screen space
        }

        fireEnemyShots(enemy) {
            const shot = enemy.shootConfig;
            if (!shot || this.over) {
                return;
            }
            const count = shot.count || 1;
            const spread = ((shot.spreadDeg || 0) * Math.PI) / 180;
            const speed = shot.speed || 320;
            const gravity = shot.gravity || 0;
            const base = gravity
                ? this.lobAngle(enemy, speed, gravity, shot.lob)
                : Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            for (let i = 0; i < count; i += 1) {
                // A ring is spaced over the whole turn and has no endpoints.
                // Doing it as a 360-degree fan puts the first and last shot on
                // the same heading, so a "ring of 16" fires 15 and a gap.
                const offset = shot.ring
                    ? (Math.PI * 2 * i) / count
                    : (count === 1 ? 0 : spread * (i / (count - 1) - 0.5));
                const angle = base + offset;
                const bolt = this.enemyShots.create(enemy.x, enemy.y, "tb-bossshot");
                bolt.setDepth(11);
                bolt.damage = shot.damage || 10;
                bolt.body.setAllowGravity(Boolean(gravity));
                if (gravity) {
                    // Arcade adds the body's gravity to the world's, and this
                    // world pulls at 1440. Setting the configured figure
                    // directly made shots fall at 1960 against a solver that
                    // assumed 520, so every lob landed a screen short. Only
                    // the difference belongs on the body.
                    bolt.body.setGravityY(gravity - this.physics.world.gravity.y);
                }
                bolt.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                this.time.delayedCall(shot.lifetimeMs || 4000, () => bolt.active && bolt.destroy());
            }
        }

        tickEnemyShooting(enemy, now) {
            const shot = enemy.shootConfig;
            if (!shot) {
                return;
            }
            if (enemy.nextShotAt === undefined) {
                // Stagger the first volley so a wave does not fire in unison.
                enemy.nextShotAt = now + (shot.everyMs || 1800) * Phaser.Math.FloatBetween(0.5, 1.2);
                return;
            }
            if (now >= enemy.nextShotAt) {
                enemy.nextShotAt = now + (shot.everyMs || 1800);
                this.fireEnemyShots(enemy);
            }
        }

        runResult() {
            return {
                roundsCleared: this.round - 1,
                kills: this.kills,
                coins: this.coinsEarnedTotal,
                bossKills: this.bossKills,
                achievements: this.achievementsEarned,
                defeated: this.defeated,
                weaponsUsed: this.weaponsUsed,
                difficulty: this.difficulty.id,
                soulReward: this.difficulty.soulReward || 1,
            };
        }

        onDeath() {
            this.over = true;
            this.roundActive = false;
            audio.play("death");
            this.player.setTintFill(0xd4524b);
            this.physics.pause();
            this.time.delayedCall(900, () => {
                endRun(this.runResult());
            });
        }

        quitRun() {
            if (this.over) {
                return;
            }
            this.over = true;
            endRun(this.runResult());
        }

        /* -- per-frame -- */

        update(time, delta) {
            if (this.over || this.paused) {
                return;
            }
            if (this.mana < this.maxMana) {
                const manaRate = this.manaRegen * (this.loadout.manaRegenMultiplier || 1);
                this.mana = Math.min(this.maxMana, this.mana + (manaRate * delta) / 1000);
                this.updateHudMana();
            }
            if (this.loadout.regenPerSecond > 0 && this.playerHp < this.maxHp) {
                this.regenCarry += (this.loadout.regenPerSecond * delta) / 1000;
                if (this.regenCarry >= 1) {
                    const heal = Math.floor(this.regenCarry);
                    this.regenCarry -= heal;
                    this.playerHp = Math.min(this.maxHp, this.playerHp + heal);
                    updateHudHearts(this.playerHp, this.maxHp);
                }
            }
            this.tickBarrier(delta);
            this.tickBuffs();
            this.updatePlayer();
            this.updateWings();
            this.updateWornArmor();
            this.updateHeldWeapon();
            this.updateMobs();
            this.updateCoins();
            this.updateYoyo();
            this.updateProjectiles();
            if (this.input.activePointer.isDown) {
                this.fireWeapon(this.input.activePointer);
            }
        }

        /**
         * Catch the hits Arcade's discrete overlap check misses.
         *
         * A bullet body is one pixel wide and the fastest guns move it 23px in
         * a frame, so against an 18px mob it is simply on one side and then the
         * other, having never overlapped. That made the S.D.M.G. -- the best
         * gun in the game -- land about six percent of its shots. Sweep the
         * segment the projectile actually travelled and hit the nearest thing
         * on it.
         */
        sweepProjectile(projectile) {
            const dx = projectile.x - projectile.lastX;
            const dy = projectile.y - projectile.lastY;
            const travel = Math.hypot(dx, dy);
            // Only worth doing when the step outruns the body; anything slower
            // the overlap check already catches.
            if (travel <= Math.max(projectile.body.width, projectile.body.height)) {
                return;
            }
            const path = new Phaser.Geom.Line(
                projectile.lastX, projectile.lastY, projectile.x, projectile.y,
            );
            let nearest = null;
            let nearestDistance = Infinity;
            for (const mob of this.mobs.getChildren()) {
                if (!mob.active || !mob.body) {
                    continue;
                }
                const box = new Phaser.Geom.Rectangle(
                    mob.body.x, mob.body.y, mob.body.width, mob.body.height,
                );
                if (mob === projectile.sweepSkip) {
                    continue;
                }
                if (!Phaser.Geom.Intersects.LineToRectangle(path, box)) {
                    continue;
                }
                const distance = Phaser.Math.Distance.Between(
                    projectile.lastX, projectile.lastY, mob.x, mob.y,
                );
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearest = mob;
                }
            }
            if (nearest) {
                // Resolve where the hit happened, not where the frame ended,
                // so an explosion lands on the target rather than past it.
                projectile.setPosition(nearest.x, nearest.y);
                this.onProjectileImpact(projectile, nearest);
            }
        }

        updateProjectiles() {
            for (const projectile of this.projectiles.getChildren()) {
                if (!projectile.active) {
                    continue;
                }
                if (projectile.lastX === undefined) {
                    projectile.lastX = projectile.x;
                    projectile.lastY = projectile.y;
                } else {
                    this.sweepProjectile(projectile);
                    if (!projectile.active) {
                        continue;
                    }
                    projectile.sweepSkip = null;
                    projectile.lastX = projectile.x;
                    projectile.lastY = projectile.y;
                }
                if (projectile.alignToVelocity) {
                    const velocity = projectile.body.velocity;
                    if (velocity.length() > 10) {
                        projectile.setRotation(Math.atan2(velocity.y, velocity.x) + Math.PI / 2);
                    }
                }
                if (!projectile.isHoming) {
                    continue;
                }
                const target = this.nearestMob(projectile.x, projectile.y);
                if (target) {
                    const angle = Phaser.Math.Angle.Between(projectile.x, projectile.y, target.x, target.y);
                    const current = projectile.body.velocity;
                    const speed = current.length() || 420;
                    // Ease toward the target instead of snapping, so dodges matter.
                    const steered = Phaser.Math.Angle.RotateTo(
                        Math.atan2(current.y, current.x),
                        angle,
                        0.08,
                    );
                    projectile.setVelocity(Math.cos(steered) * speed, Math.sin(steered) * speed);
                }
            }
        }

        updatePlayer() {
            const keys = this.keys;
            const kb = Phaser.Input.Keyboard;
            const onGround = this.player.body.blocked.down || this.player.body.touching.down;
            const left = keys.leftA.isDown || keys.leftQ.isDown || keys.leftArrow.isDown;
            const right = keys.right.isDown || keys.rightArrow.isDown;
            const down = keys.down.isDown || keys.downArrow.isDown;
            // Bitwise OR so every key's JustDown flag is consumed this frame.
            const jumpPressed = Boolean(
                kb.JustDown(keys.jumpW) | kb.JustDown(keys.jumpZ) |
                kb.JustDown(keys.jumpSpace) | kb.JustDown(keys.jumpArrow),
            );

            const speed = this.runSpeed * this.loadout.moveSpeedMultiplier;
            if (left && !right) {
                this.player.setVelocityX(-speed);
            } else if (right && !left) {
                this.player.setVelocityX(speed);
            } else {
                this.player.setVelocityX(0);
            }

            if (onGround) {
                this.jumpsUsed = 0;
            }

            // Wings: hold jump off the ground to fly. Terraria drains the
            // meter while you climb and only refills it when you land.
            const flight = this.loadout.flight;
            const jumpHeld = keys.jumpW.isDown || keys.jumpZ.isDown
                || keys.jumpSpace.isDown || keys.jumpArrow.isDown;
            this.flying = false;
            if (flight) {
                if (onGround) {
                    this.flightLeftMs = flight.durationMs;
                } else if (jumpHeld && this.flightLeftMs > 0 && this.jumpsUsed >= this.loadout.extraJumps) {
                    this.flightLeftMs = Math.max(0, this.flightLeftMs - this.game.loop.delta);
                    this.player.setVelocityY(-(flight.speed || 240));
                    this.flying = true;
                    if (this.time.now >= (this.nextFlightPuffAt || 0)) {
                        this.nextFlightPuffAt = this.time.now + 110;
                        // Wings puff cloud; boots have none, so they burn at
                        // the heels instead and the flight still reads.
                        if (this.loadout.wings) {
                            this.burst("cloud", 2, this.player.x, this.player.body.bottom, 0xffffff);
                        } else {
                            this.burst("spark", 4, this.player.x, this.player.body.bottom, 0xffa63d);
                        }
                    }
                } else if (jumpHeld && this.player.body.velocity.y > 0) {
                    // Spent wings still let you glide down gently.
                    this.player.setVelocityY(
                        Math.min(this.player.body.velocity.y, flight.glideFallSpeed || 240),
                    );
                }
            }

            const jumpPower = this.jumpVelocity * this.loadout.jumpMultiplier;
            if (jumpPressed) {
                if (onGround) {
                    this.player.setVelocityY(-jumpPower);
                    audio.play("jump");
                    this.burst("dust", 4, this.player.x, this.player.body.bottom, 0xd8c9a8);
                } else if (this.jumpsUsed < this.loadout.extraJumps) {
                    this.jumpsUsed += 1;
                    this.player.setVelocityY(-jumpPower * 0.9);
                    audio.play("jump");
                    // Cloud in a Bottle leaves its cloud behind.
                    this.burst("cloud", 9, this.player.x, this.player.body.bottom, 0xffffff);
                }
            }
            if (down && onGround) {
                this.player.dropThroughUntil = this.time.now + 220;
            }

            // Landing kicks up dust, scaled to how hard the fall was.
            const now = this.time.now;
            if (onGround && !this.wasOnGround && this.lastFallSpeed > 260) {
                const strength = Phaser.Math.Clamp(Math.round(this.lastFallSpeed / 170), 3, 9);
                this.burst("dust", strength, this.player.x, this.player.body.bottom, 0xd8c9a8);
            }
            this.wasOnGround = onGround;
            this.lastFallSpeed = Math.max(0, this.player.body.velocity.y);

            // A running trail, so speed reads on the ground as well as the HUD.
            if (onGround && left !== right && now >= this.nextDustAt) {
                this.nextDustAt = now + (this.loadout.moveSpeedMultiplier > 1 ? 90 : 150);
                this.burst("dust", 2, this.player.x, this.player.body.bottom, 0xcbbd9c);
            }

            // NPC art faces left by default; the body turns with the aim.
            const aim = this.input.activePointer.positionToCamera(this.cameras.main);
            this.player.setFlipX(aim.x > this.player.x);

            const skin = this.skins[this.character.id];
            if (skin && skin.anims) {
                if (!onGround) {
                    this.player.anims.stop();
                    this.player.setFrame(skin.anims.jump ?? skin.anims.idle ?? 0);
                } else if (left !== right) {
                    this.player.anims.play(`tb-walk-${this.character.id}`, true);
                } else {
                    this.player.anims.stop();
                    this.player.setFrame(skin.anims.idle ?? 0);
                }
            }

            if (kb.JustDown(keys.dash) && this.loadout.dash) {
                const now = this.time.now;
                if (now >= this.dashReadyAt) {
                    this.dashReadyAt = now + (this.loadout.dash.cooldownMs || 1200);
                    audio.play("dash");
                    this.burst("spark", 12, this.player.x, this.player.y, 0x9fe0ff);
                    const world = this.input.activePointer.positionToCamera(this.cameras.main);
                    const direction = Math.sign(world.x - this.player.x) || 1;
                    this.player.setVelocityX(direction * (this.loadout.dash.speed || 900));
                    this.invincibleUntil = Math.max(this.invincibleUntil, now + 260);
                }
            }
        }

        updateMobs() {
            const now = this.time.now;
            for (const mob of this.mobs.getChildren()) {
                if (!mob.active) {
                    continue;
                }
                if (mob.isBoss) {
                    this.updateBoss(mob, now);
                    continue;
                }
                this.paintDebuffTint(mob);
                if (mob.auraTint !== undefined && now >= (mob.nextAuraAt || 0)) {
                    // A slow pulse in the affix colour: enough to pick an
                    // elite out of a wave without drowning the screen.
                    mob.nextAuraAt = now + 320;
                    this.burst("sparkle", 3, mob.x, mob.y, mob.auraTint);
                }
                this.tickDebuffs(mob, now);
                if (!mob.active) {
                    continue;
                }
                this.tickEnemyShooting(mob, now);
                // Confusion sends it the other way, which is the whole effect.
                const facing = Math.sign(this.player.x - mob.x) || 1;
                const towardPlayer = this.debuffReverses(mob) ? -facing : facing;
                const chill = this.debuffSpeed(mob);
                mob.setFlipX(mob.behavior === "flyer" ? mob.body.velocity.x > 0 : towardPlayer > 0);
                if (mob.behavior === "slime-hops") {
                    const onGround = mob.body.blocked.down || mob.body.touching.down;
                    if (onGround && now >= mob.nextHopAt) {
                        mob.setVelocity(
                            towardPlayer * Phaser.Math.Between(150, 230) * chill,
                            -Phaser.Math.Between(380, 520),
                        );
                        mob.nextHopAt = now + Phaser.Math.Between(700, 1400);
                    }
                } else if (mob.behavior === "walker") {
                    mob.setVelocityX(towardPlayer * (mob.speed || 80) * chill);
                    if (mob.body.blocked.left || mob.body.blocked.right) {
                        mob.setVelocityY(-420);
                    }
                } else if (mob.behavior === "flyer") {
                    if (this.debuffReverses(mob)) {
                        // Nothing to fly toward, so it flies away instead.
                        const away = Phaser.Math.Angle.Between(
                            this.player.x, this.player.y, mob.x, mob.y,
                        );
                        const speed = (mob.speed || 95) * chill;
                        mob.setVelocity(Math.cos(away) * speed, Math.sin(away) * speed);
                    } else {
                        this.physics.moveToObject(mob, this.player, (mob.speed || 95) * chill);
                    }
                } else if (mob.behavior === "caster") {
                    // Holds a firing line: backs off when crowded, closes when
                    // the player runs, so its shots stay the threat.
                    const range = mob.standoff || 260;
                    const distance = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                    const speed = mob.speed || 90;
                    if (distance < range * 0.75) {
                        this.physics.moveToObject(mob, this.player, -speed);
                    } else if (distance > range * 1.25) {
                        this.physics.moveToObject(mob, this.player, speed);
                    } else {
                        mob.setVelocity(mob.body.velocity.x * 0.85, mob.body.velocity.y * 0.85);
                    }
                }
            }
        }

        /**
         * Walk the boss down its phase list as its health falls. Only ever
         * forwards, and only one step per frame, so a burst of damage that
         * crosses two thresholds still plays both announcements in order.
         */
        tickBossPhase(boss) {
            const stages = boss.stages;
            if (!stages || boss.stageIndex >= stages.length - 1) {
                return;
            }
            const next = stages[boss.stageIndex + 1];
            if (boss.hp / boss.maxHp > next.atHp) {
                return;
            }
            boss.stageIndex += 1;
            this.enterBossPhase(boss, next);
        }

        enterBossPhase(boss, stage) {
            // The override merges over the pattern config rather than replacing
            // it, so a phase only has to name what it changes.
            Object.assign(boss.patternConfig, stage.config || {});
            if (stage.shoot) {
                boss.shootConfig = stage.shoot;
                // Fire on the new cadence from now, not from the old schedule.
                boss.nextShotAt = this.time.now + (stage.shoot.everyMs || 1200) * 0.5;
            }
            const changed = stage.config || {};
            if (changed.servantCount) {
                boss.servantCount = changed.servantCount;
            }
            // An empty list is a real instruction, not a missing one: the Eye
            // of Cthulhu stops calling servants in its second form.
            if (Array.isArray(changed.servantsAtHpFractions)) {
                boss.summonAtFractions = [...changed.servantsAtHpFractions];
            }
            // King Slime spaces its summons by a fraction rather than listing
            // them, so a phase that tightens the spacing has to rebuild the
            // schedule -- and only the part of it still ahead of the fight.
            if (changed.summonEveryHpFraction) {
                const step = changed.summonEveryHpFraction;
                const health = boss.hp / boss.maxHp;
                boss.summonAtFractions = [];
                for (let fraction = 1 - step; fraction > 0.01; fraction -= step) {
                    if (fraction < health) {
                        boss.summonAtFractions.push(Number(fraction.toFixed(3)));
                    }
                }
            }
            if (stage.pattern && stage.pattern !== boss.pattern) {
                boss.pattern = stage.pattern;
                this.initBossPattern(boss);
            }

            this.showBanner(boss.bossName || "", stage.say || stage.name);
            audio.play("boss-spawn");
            this.cameras.main.shake(260, 0.010);
            this.burst("spark", 24, boss.x, boss.y, boss.particleTint);
            boss.setTintFill(0xffffff);
            this.time.delayedCall(160, () => boss.active && this.restoreTint(boss));
            // The bar marks where the fight changed, so the phase is legible
            // from the health bar and not only from the banner.
            this.markBossBar(boss);
        }

        markBossBar(boss) {
            if (!this.bossBar) {
                return;
            }
            this.tweens.killTweensOf(this.bossBar);
            this.bossBar.setFillStyle(0xffe08a);
            this.time.delayedCall(220, () => {
                if (this.bossBar) {
                    this.bossBar.setFillStyle(0xd4524b);
                }
            });
        }

        updateBoss(boss, now) {
            this.tickBossPhase(boss);
            const config = boss.patternConfig;
            this.tickEnemyShooting(boss, now);

            // A wounded boss switches to its second-phase artwork, whatever
            // movement pattern it happens to use.
            if (boss.enrageAnim && boss.hp / boss.maxHp <= (config.enrageAtHp || 0.5)
                && boss.anims.currentAnim && boss.anims.currentAnim.key !== boss.enrageAnim) {
                boss.play(boss.enrageAnim);
            }

            if (boss.pattern === "worm") {
                // Burrowing worms ignore terrain and never stop coming; the
                // threat is their speed, not their pattern.
                this.physics.moveToObject(boss, this.player, config.speed || 190);
                boss.setRotation(
                    Math.atan2(boss.body.velocity.y, boss.body.velocity.x) +
                    (this.player.x < boss.x ? Math.PI : 0),
                );
                boss.setFlipY(this.player.x < boss.x);
                this.updateWormSegments(boss);
                return;
            }

            if (boss.pattern === "shooter") {
                // Hovers at a standoff distance and leans on its projectiles.
                const target = Math.max(70, this.player.y - (config.hoverHeight || 150));
                const side = config.orbitRadius || 180;
                const desiredX = this.player.x + Math.sin(now / (config.driftMs || 1600)) * side;
                boss.setVelocity(
                    (desiredX - boss.x) * (config.followX || 1.6),
                    (target - boss.y) * (config.followY || 1.8),
                );
                boss.setFlipX(this.player.x > boss.x);
                return;
            }

            if (boss.pattern === "teleporter") {
                // Never travels: it fades out, vanishes, and reappears
                // somewhere else around you, firing the moment it lands. You
                // cannot solve this one by backing away.
                boss.setVelocity(0, 0);
                if (now >= (boss.nextBlinkAt || 0)) {
                    if (!boss.blinkPending) {
                        boss.blinkPending = true;
                        boss.nextBlinkAt = now + (config.telegraphMs || 420);
                        boss.setAlpha(0.35);
                    } else {
                        boss.blinkPending = false;
                        boss.nextBlinkAt = now + (config.blinkEveryMs || 2600);
                        this.burst("sparkle", 12, boss.x, boss.y, 0xa07fe0);
                        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                        const radius = config.blinkRadius || 210;
                        boss.setPosition(
                            Phaser.Math.Clamp(
                                this.player.x + Math.cos(angle) * radius,
                                70, VIEW_WIDTH - 70,
                            ),
                            Phaser.Math.Clamp(
                                this.player.y + Math.sin(angle) * radius - 30,
                                70, this.groundTop - 70,
                            ),
                        );
                        boss.setAlpha(1);
                        this.burst("sparkle", 16, boss.x, boss.y, 0xa07fe0);
                        audio.play("boss-spawn", 400);
                        boss.nextShotAt = now + (config.arriveShotDelayMs || 220);
                    }
                }
                boss.setFlipX(this.player.x > boss.x);
                return;
            }

            if (boss.pattern === "spinner") {
                // Circles you, and the circle tightens and quickens as it is
                // worn down, so the safe ring closes rather than the damage
                // simply going up.
                const health = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
                const radius = (config.orbitRadius || 210) * (0.55 + 0.45 * health);
                const rate = (config.orbitSpeed || 1.9) * (2 - health);
                boss.orbitAngle = (boss.orbitAngle || 0) + rate * (this.game.loop.delta / 1000);
                const targetX = this.player.x + Math.cos(boss.orbitAngle) * radius;
                const targetY = this.player.y + Math.sin(boss.orbitAngle) * radius * 0.55
                    - (config.hoverHeight || 40);
                const chase = config.followX || 3.4;
                boss.setVelocity((targetX - boss.x) * chase, (targetY - boss.y) * chase);
                boss.setRotation(boss.orbitAngle + Math.PI / 2);
                return;
            }

            if (boss.pattern === "stomper") {
                const onGround = boss.body.blocked.down || boss.body.touching.down;
                if (onGround) {
                    if (boss.slamPending) {
                        boss.slamPending = false;
                        this.cameras.main.shake(220, 0.012);
                        this.shockwave(boss, config);
                    }
                    if (now >= (boss.nextSlamAt || 0)) {
                        boss.nextSlamAt = now + (config.slamEveryMs || 2400);
                        boss.slamPending = true;
                        boss.setVelocity(
                            (this.player.x - boss.x) * (config.leapLead || 1.1),
                            -(config.leapPower || 780),
                        );
                    } else {
                        boss.setVelocityX((Math.sign(this.player.x - boss.x) || 1) * (config.walkSpeed || 70));
                    }
                }
                boss.setFlipX(this.player.x > boss.x);
                return;
            }

            if (boss.pattern === "wall") {
                // It only ever goes one way. Bouncing it off the edges of a
                // single screen made a fight with nowhere to run: the wall
                // came back at you and the chase was a pacing exercise. Down
                // a corridor it walks from one end to the other and the run
                // is the fight.
                if (boss.marchDirection === undefined) {
                    boss.marchDirection = boss.x < this.arenaWidth / 2 ? 1 : -1;
                }
                // Terraria's wall speeds up as it is worn down, so a wounded
                // wall is a harder run rather than a longer one.
                const fraction = Math.max(0, boss.hp / boss.maxHp);
                const speed = (config.marchSpeed || 95)
                    * (1 + (1 - fraction) * (config.marchRamp || 0));
                boss.setVelocityX(boss.marchDirection * speed);
                boss.setVelocityY(
                    (this.groundAt(boss.x) - boss.displayHeight / 2 - boss.y) * 1.5,
                );
                boss.setFlipX(boss.marchDirection > 0);
                this.tickCorridorSqueeze(boss);
                return;
            }

            if (boss.pattern === "kingslime") {
                const onGround = boss.body.blocked.down || boss.body.touching.down;
                if (onGround && now >= boss.nextHopAt) {
                    boss.hopCount += 1;
                    if (boss.hopCount % (config.bigHopEvery || 4) === 0) {
                        // The crown move: a leap timed to land on the player's head.
                        const airTime = (config.bigHopAirTimeMs || 950) / 1000;
                        const gravity = this.physics.world.gravity.y;
                        boss.setVelocity(
                            (this.player.x - boss.x) / airTime,
                            -(gravity * airTime) / 2,
                        );
                        boss.setTintFill(0xffffff);
                        this.time.delayedCall(140, () => this.restoreTint(boss));
                    } else {
                        const toward = Math.sign(this.player.x - boss.x) || 1;
                        boss.setVelocity(
                            toward * Phaser.Math.Between(200, 300),
                            -Phaser.Math.Between(480, 620),
                        );
                    }
                    boss.nextHopAt = now + Phaser.Math.Between(850, 1500);
                }
                return;
            }

            // Charger (Eye of Cthulhu, Duke Fishron): hover above the player,
            // freeze to telegraph, then dash. Repeat. Named rather than left
            // as the fallback so every pattern in the data has a branch you
            // can find by searching for it.
            if (boss.pattern !== "charger") {
                return;
            }
            if (boss.phase === "hover") {
                const targetY = Math.max(70, this.player.y - (config.hoverHeight || 170));
                boss.setVelocity(
                    (this.player.x - boss.x) * 2.2,
                    (targetY - boss.y) * 2.2,
                );
                if (now >= boss.phaseUntil) {
                    boss.phase = "telegraph";
                    boss.phaseUntil = now + (config.telegraphMs || 450);
                    boss.dashesLeft = config.dashCount || 3;
                    boss.setVelocity(0, 0);
                    boss.setTintFill(0xffffff);
                }
            } else if (boss.phase === "telegraph") {
                if (now >= boss.phaseUntil) {
                    this.restoreTint(boss);
                    boss.phase = "dash";
                    boss.phaseUntil = now + (config.dashMs || 620);
                    const angle = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
                    const speed = config.dashSpeed || 560;
                    boss.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                }
            } else if (boss.phase === "dash" && now >= boss.phaseUntil) {
                boss.dashesLeft -= 1;
                if (boss.dashesLeft > 0) {
                    boss.phase = "telegraph";
                    boss.phaseUntil = now + (config.telegraphMs || 450);
                    boss.setVelocity(0, 0);
                    boss.setTintFill(0xffffff);
                } else {
                    boss.phase = "hover";
                    boss.phaseUntil = now + (config.hoverMs || 2300);
                }
            }

            if (boss.facePlayer) {
                // The eye's iris sits at the sprite's bottom; point it at the player.
                boss.setRotation(
                    Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y) - Math.PI / 2,
                );
            } else if (boss.spinOnDash) {
                if (boss.phase === "dash") {
                    boss.rotation += 0.28;
                } else {
                    boss.setRotation(0);
                }
            }
        }

        updateCoins() {
            // Heartreach widens the pull. Hearts get it too, which is the whole
            // point of the potion -- reaching a heart is the hard part.
            const reach = Math.max(110, (this.loadout || {}).pickupRange || 0);
            const drawIn = (drop, speed) => {
                if (!drop.active) {
                    return;
                }
                const distance = Phaser.Math.Distance.Between(
                    drop.x, drop.y, this.player.x, this.player.y,
                );
                if (distance < reach) {
                    drop.body.setAllowGravity(false);
                    this.physics.moveToObject(drop, this.player, speed);
                }
            };
            for (const coin of this.coins.getChildren()) {
                drawIn(coin, 420);
            }
            if (reach > 110) {
                for (const heart of this.pickups.getChildren()) {
                    drawIn(heart, 380);
                }
            }
        }

        updateYoyo() {
            const yoyo = this.activeYoyo;
            if (!yoyo || !yoyo.active) {
                this.activeYoyo = null;
                return;
            }
            const fromPlayer = Phaser.Math.Distance.Between(
                yoyo.x, yoyo.y, this.player.x, this.player.y,
            );
            if (!yoyo.returning && this.time.now - yoyo.launchedAt
                > (yoyo.lifetimeMs || YOYO_LIFETIME_MS)) {
                yoyo.returning = true;
            }
            if (yoyo.returning) {
                this.physics.moveToObject(yoyo, this.player, yoyo.returnSpeed || 900);
                if (fromPlayer < 26) {
                    yoyo.destroy();
                    this.activeYoyo = null;
                }
                return;
            }

            // Steered every frame rather than thrown and left to coast. A
            // ballistic yoyo sails past whatever it was aimed at and oscillates,
            // landing a tick per pass; this one goes to a target and stays on it.
            const target = this.nearestMob(yoyo.x, yoyo.y);
            let anchorX = yoyo.aimX;
            let anchorY = yoyo.aimY;
            if (target && Phaser.Math.Distance.Between(
                this.player.x, this.player.y, target.x, target.y) <= yoyo.reach) {
                anchorX = target.x;
                anchorY = target.y;
            }
            // The string still has a length: nothing is reachable past it.
            const toAnchor = Phaser.Math.Distance.Between(
                this.player.x, this.player.y, anchorX, anchorY,
            );
            if (toAnchor > yoyo.reach) {
                const angle = Phaser.Math.Angle.Between(
                    this.player.x, this.player.y, anchorX, anchorY,
                );
                anchorX = this.player.x + Math.cos(angle) * yoyo.reach;
                anchorY = this.player.y + Math.sin(angle) * yoyo.reach;
            }

            const gap = Phaser.Math.Distance.Between(yoyo.x, yoyo.y, anchorX, anchorY);
            if (gap <= YOYO_GRIP_PX) {
                yoyo.setVelocity(0, 0);
                yoyo.setPosition(anchorX, anchorY);
            } else {
                const speed = Math.min(yoyo.throwSpeed || 700, Math.max(220, gap * 6));
                this.physics.moveTo(yoyo, anchorX, anchorY, speed);
            }
        }
    }

    /* ---------- boot ---------- */

    function bindMenus() {
        document.getElementById("tb-start-run").addEventListener("click", () => {
            const preferred =
                save.lastCharacter && save.unlockedCharacters.includes(save.lastCharacter)
                    ? save.lastCharacter
                    : save.unlockedCharacters[0] || "guide";
            startRun(preferred);
        });
        document.getElementById("tb-open-characters").addEventListener("click", () => {
            renderCharacterList();
            showScreen("tb-characters");
        });
        document.getElementById("tb-open-unlocks").addEventListener("click", () => {
            renderUnlockList();
            showScreen("tb-unlocks");
        });
        document.getElementById("tb-open-packs").addEventListener("click", () => {
            renderPackList();
            showScreen("tb-packs");
        });
        document.getElementById("tb-open-bestiary").addEventListener("click", () => {
            renderBestiary();
            showScreen("tb-bestiary");
        });
        document.getElementById("tb-open-weaponry").addEventListener("click", () => {
            renderWeaponry();
            showScreen("tb-weaponry");
        });
        document.getElementById("tb-open-feats").addEventListener("click", () => {
            renderFeats();
            showScreen("tb-feats");
        });
        document.getElementById("tb-difficulty").addEventListener("click", cycleDifficulty);
        renderDifficultyButton();
        for (const button of document.querySelectorAll("[data-close]")) {
            button.addEventListener("click", () => showScreen("tb-menu"));
        }
        document.getElementById("tb-summary-back").addEventListener("click", () => {
            showScreen("tb-menu");
        });
        document.getElementById("tb-quit-run").addEventListener("click", () => {
            const scene = game && game.scene.getScene("arena");
            if (scene) {
                closeGear();
                scene.quitRun();
            }
        });
        document.getElementById("tb-open-gear").addEventListener("click", () => {
            const scene = game && game.scene.getScene("arena");
            if (scene) {
                toggleGear(scene);
            }
        });
        document.getElementById("tb-gear-close").addEventListener("click", closeGear);
        shopUi.reroll.addEventListener("click", () => {
            if (!shopState) {
                return;
            }
            const scene = shopState.scene;
            const cost = rerollCost();
            if (cost > scene.coinsCollected) {
                return;
            }
            scene.coinsCollected -= cost;
            hud.coins.textContent = String(scene.coinsCollected);
            shopState.rerollsUsed += 1;
            shopState.offers = generateOffers(scene);
            renderShop();
        });
        const muteButton = document.getElementById("tb-mute");
        if (muteButton) {
            muteButton.addEventListener("click", () => {
                save.muted = !save.muted;
                audio.setMuted(save.muted);
                persistSave();
                updateMuteButton();
                if (!save.muted) {
                    audio.play("coin");
                }
            });
        }
        shopUi.next.addEventListener("click", () => {
            if (!shopState) {
                return;
            }
            const scene = shopState.scene;
            closeGear();
            closeShop();
            scene.startNextRound();
        });
    }

    async function boot() {
        const loadingText = document.getElementById("tb-loading-text");
        const retry = document.getElementById("tb-loading-retry");
        showScreen("tb-loading");
        try {
            await loadAllData();
        } catch (error) {
            console.error("Terra Boss: data load failed", error);
            loadingText.textContent = "Could not load game data.";
            retry.hidden = false;
            retry.onclick = () => {
                retry.hidden = true;
                loadingText.textContent = "Digging up game data...";
                boot();
            };
            return;
        }
        try {
            data.frames = await fetchJson(app.dataset.framesUrl);
        } catch (error) {
            console.warn("Terra Boss: sprite frames manifest unavailable, using placeholders", error);
            data.frames = {};
        }
        try {
            data.items = await fetchJson(app.dataset.itemsUrl);
        } catch (error) {
            console.warn("Terra Boss: item sprites manifest unavailable, using placeholders", error);
            data.items = {};
        }
        try {
            data.tiles = await fetchJson(app.dataset.tilesUrl);
        } catch (error) {
            console.warn("Terra Boss: tile manifest unavailable, using placeholders", error);
            data.tiles = {};
        }
        try {
            data.decor = await fetchJson(app.dataset.decorUrl);
        } catch (error) {
            console.warn("Terra Boss: decor manifest unavailable, arenas will be bare", error);
            data.decor = {};
        }
        try {
            data.biomes = await fetchJson(app.dataset.biomesUrl);
        } catch (error) {
            console.warn("Terra Boss: biome data unavailable, falling back to one arena", error);
            data.biomes = { layouts: [], biomes: [] };
        }
        try {
            data.achievements = await fetchJson(app.dataset.achievementsUrl);
        } catch (error) {
            console.warn("Terra Boss: feats unavailable", error);
            data.achievements = { achievements: [] };
        }
        try {
            data.difficulties = await fetchJson(app.dataset.difficultiesUrl);
        } catch (error) {
            console.warn("Terra Boss: difficulty ladder unavailable", error);
            data.difficulties = { difficulties: [] };
        }
        try {
            data.modifiers = await fetchJson(app.dataset.modifiersUrl);
        } catch (error) {
            console.warn("Terra Boss: weapon prefixes unavailable", error);
            data.modifiers = { modifiers: [] };
        }
        try {
            data.debuffs = await fetchJson(app.dataset.debuffsUrl);
        } catch (error) {
            console.warn("Terra Boss: debuffs unavailable", error);
            data.debuffs = { debuffs: [] };
        }
        try {
            data.ammo = await fetchJson(app.dataset.ammoUrl);
        } catch (error) {
            console.warn("Terra Boss: ammunition unavailable", error);
            data.ammo = { ammo: [], families: {} };
        }
        try {
            data.potions = await fetchJson(app.dataset.potionsUrl);
        } catch (error) {
            console.warn("Terra Boss: potions unavailable", error);
            data.potions = { potions: [] };
        }
        try {
            data.events = await fetchJson(app.dataset.eventsUrl);
        } catch (error) {
            console.warn("Terra Boss: round events unavailable", error);
            data.events = { events: [] };
        }
        try {
            data.wornArmor = await fetchJson(app.dataset.wornArmorUrl);
        } catch (error) {
            console.warn("Terra Boss: worn armor manifest unavailable", error);
            data.wornArmor = {};
        }
        try {
            data.gore = await fetchJson(app.dataset.goreUrl);
        } catch (error) {
            console.warn("Terra Boss: gore manifest unavailable, using debris", error);
            data.gore = {};
        }
        try {
            data.wings = await fetchJson(app.dataset.wingsUrl);
        } catch (error) {
            console.warn("Terra Boss: wings manifest unavailable", error);
            data.wings = {};
        }
        // Before the packs, because applying one reads the list of packs the
        // player has switched off. The save reads nothing back out of `data`,
        // so this way round is safe and the other way is not.
        save = loadSave();
        // Last, so a pack can add to or replace anything already loaded --
        // including the sprite manifests, which is how it ships its own art.
        try {
            await loadContentPacks(app.dataset.packsUrl);
        } catch (error) {
            console.warn("Terra Boss: no content packs loaded", error);
            data.packsApplied = [];
        }
        persistSave();
        audio.setMuted(save.muted);
        updateMuteButton();
        updateSoulsChip();
        updateMenuBest();
        // Again here: the wiring pass runs before the ladder has loaded, so
        // the button hides itself and never comes back without this.
        renderDifficultyButton();
        showScreen("tb-menu");
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindMenus();
        boot();
    });

    // Console handle for poking at a live run while developing.
    window.terraBossDebug = {
        get game() { return game; },
        get save() { return save; },
        get data() { return data; },
    };
})();
