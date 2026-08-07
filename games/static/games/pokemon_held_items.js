(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PokemonHeldItems = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    // ------------------------------------------------------------------
    // Held items. The shop has always sold these and Pokemon could hold
    // them, but nothing ever read the item during a battle -- every one of
    // them was inert. Each entry below declares only the hooks it needs, the
    // same shape the ability registry uses, and the engine calls them at
    // fixed points.
    //
    // `singleUse` items are spent when they fire. Spending is battle-scoped:
    // the item comes back after the duel, matching the way this game already
    // restores HP, PP and status between fights.
    // ------------------------------------------------------------------

    // Type-boosting items all work the same way, so they are generated.
    const TYPE_BOOSTERS = {
        "black-belt": "fighting",
        charcoal: "fire",
        "mystic-water": "water",
        magnet: "electric",
        "miracle-seed": "grass",
        "never-melt-ice": "ice",
        "poison-barb": "poison",
        "soft-sand": "ground",
        "sharp-beak": "flying",
        "twisted-spoon": "psychic",
        "silver-powder": "bug",
        silverpowder: "bug",
        "hard-stone": "rock",
        "spell-tag": "ghost",
        "dragon-fang": "dragon",
        "black-glasses": "dark",
        "metal-coat": "steel",
        "silk-scarf": "normal",
        "fist-plate": "fighting",
        "sky-plate": "flying",
        "toxic-plate": "poison",
        "earth-plate": "ground",
        "stone-plate": "rock",
        "insect-plate": "bug",
        "spooky-plate": "ghost",
        "iron-plate": "steel",
        "flame-plate": "fire",
        "splash-plate": "water",
        "meadow-plate": "grass",
        "zap-plate": "electric",
        "mind-plate": "psychic",
        "icicle-plate": "ice",
        "draco-plate": "dragon",
        "dread-plate": "dark",
        "pixie-plate": "fairy",
    };

    // Berries that clear a specific condition.
    const STATUS_BERRIES = {
        "cheri-berry": ["paralysis"],
        "chesto-berry": ["sleep"],
        "pecha-berry": ["poison", "toxic"],
        "rawst-berry": ["burn"],
        "aspear-berry": ["freeze"],
        "lum-berry": ["paralysis", "sleep", "poison", "toxic", "burn", "freeze"],
    };

    const ITEMS = {
        // --- offensive multipliers ---------------------------------------
        "life-orb": {
            damageMult() { return 1.3; },
            // Paid after the hit lands, so a miss costs nothing.
            recoilOnAttack: 0.1,
        },
        "expert-belt": {
            damageMult(ctx) { return ctx.effectiveness > 1 ? 1.2 : 1; },
        },
        "muscle-band": {
            damageMult(ctx) { return ctx.physical ? 1.1 : 1; },
        },
        "wise-glasses": {
            damageMult(ctx) { return ctx.physical ? 1 : 1.1; },
        },
        "choice-band": {
            statMult(stat) { return stat === "attack" ? 1.5 : 1; },
            locksMove: true,
        },
        "choice-specs": {
            statMult(stat) { return stat === "specialAttack" ? 1.5 : 1; },
            locksMove: true,
        },
        "choice-scarf": {
            statMult(stat) { return stat === "speed" ? 1.5 : 1; },
            locksMove: true,
        },

        // --- defensive ----------------------------------------------------
        "assault-vest": {
            statMult(stat) { return stat === "specialDefense" ? 1.5 : 1; },
            blocksStatusMoves: true,
        },
        eviolite: {
            // Only helps a Pokemon that can still evolve; the engine supplies
            // that flag because it owns the species data.
            statMult(stat, ctx) {
                if (!ctx?.canStillEvolve) return 1;
                return (stat === "defense" || stat === "specialDefense") ? 1.5 : 1;
            },
        },
        "rocky-helmet": {
            onContactReceived(ctx) {
                ctx.chip(ctx.attacker, 1 / 6, "{other} was hurt by {name}'s Rocky Helmet!");
            },
        },
        "focus-sash": {
            singleUse: true,
            survivesKO(ctx) { return ctx.defender.hp >= ctx.defender.maxHp; },
            survivalMessage: "{name} hung on using its Focus Sash!",
        },
        "focus-band": {
            survivesKO(ctx) { return ctx.rng() < 0.1; },
            survivalMessage: "{name} hung on using its Focus Band!",
        },
        "weakness-policy": {
            singleUse: true,
            onHitSuperEffective(ctx) {
                ctx.announce("{name}'s Weakness Policy activated!");
                ctx.raiseStat(ctx.pokemon, "attack", 2);
                ctx.raiseStat(ctx.pokemon, "specialAttack", 2);
            },
        },

        // --- crit and flinch ----------------------------------------------
        "scope-lens": { critBonus: 0.0625 },
        "razor-claw": { critBonus: 0.0625 },
        "kings-rock": { flinchChance: 10 },
        "king-s-rock": { flinchChance: 10 },
        "razor-fang": { flinchChance: 10 },

        // --- recovery and self-inflicted status ---------------------------
        leftovers: {
            endOfTurn(ctx) {
                if (ctx.pokemon.hp >= ctx.pokemon.maxHp) return;
                ctx.heal(ctx.pokemon, 1 / 16, "{name} restored a little HP using its Leftovers!");
            },
        },
        "black-sludge": {
            endOfTurn(ctx) {
                if (ctx.pokemon.types.includes("poison")) {
                    if (ctx.pokemon.hp >= ctx.pokemon.maxHp) return;
                    ctx.heal(ctx.pokemon, 1 / 16, "{name} restored a little HP using its Black Sludge!");
                } else {
                    ctx.chip(ctx.pokemon, 1 / 8, "{name} is hurt by its Black Sludge!");
                }
            },
        },
        "shell-bell": {
            onDamageDealt(ctx) {
                if (ctx.damage <= 0 || ctx.pokemon.hp >= ctx.pokemon.maxHp) return;
                const amount = Math.max(1, Math.floor(ctx.damage / 8));
                ctx.healFlat(ctx.pokemon, amount, "{name} restored a little HP using its Shell Bell!");
            },
        },
        "toxic-orb": {
            endOfTurn(ctx) {
                if (ctx.pokemon.statusCondition) return;
                ctx.inflict(ctx.pokemon, "toxic", "{name} was badly poisoned by its Toxic Orb!");
            },
        },
        "flame-orb": {
            endOfTurn(ctx) {
                if (ctx.pokemon.statusCondition) return;
                ctx.inflict(ctx.pokemon, "burn", "{name} was burned by its Flame Orb!");
            },
        },

        // --- speed --------------------------------------------------------
        "quick-claw": {
            // Rolled once per turn when the order is decided.
            quickClawChance: 0.2,
        },

        // --- berries ------------------------------------------------------
        "oran-berry": {
            singleUse: true,
            healThreshold: 0.5,
            endOfTurn(ctx) {
                if (ctx.pokemon.hp > ctx.pokemon.maxHp * ctx.healThreshold) return;
                if (ctx.pokemon.hp >= ctx.pokemon.maxHp) return;
                ctx.healFlat(ctx.pokemon, 10, "{name} restored health using its Oran Berry!");
                ctx.spend();
            },
        },
        "sitrus-berry": {
            singleUse: true,
            healThreshold: 0.5,
            endOfTurn(ctx) {
                if (ctx.pokemon.hp > ctx.pokemon.maxHp * ctx.healThreshold) return;
                if (ctx.pokemon.hp >= ctx.pokemon.maxHp) return;
                ctx.heal(ctx.pokemon, 0.25, "{name} restored health using its Sitrus Berry!");
                ctx.spend();
            },
        },
    };

    Object.entries(TYPE_BOOSTERS).forEach(([slug, type]) => {
        ITEMS[slug] = {
            boostsType: type,
            damageMult(ctx) { return ctx.moveType === type ? 1.2 : 1; },
        };
    });

    Object.entries(STATUS_BERRIES).forEach(([slug, conditions]) => {
        ITEMS[slug] = {
            singleUse: true,
            curesConditions: conditions,
            endOfTurn(ctx) {
                if (!conditions.includes(ctx.pokemon.statusCondition)) return;
                const itemName = slug.split("-").map(
                    (part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
                ctx.cure(ctx.pokemon, `{name}'s ${itemName} cured its status problem!`);
                ctx.spend();
            },
        };
    });

    // ------------------------------------------------------------------
    // Rarity, kept next to the effects so an item's power and its price can
    // never drift apart. Anything not listed is common.
    // ------------------------------------------------------------------

    const RARITY = {
        // Reliable, run-defining effects.
        epic: ["choice-band", "choice-specs", "choice-scarf", "focus-sash"],
        rare: [
            "leftovers", "life-orb", "assault-vest", "eviolite", "expert-belt",
            "rocky-helmet", "black-sludge", "toxic-orb", "flame-orb",
            "weakness-policy", "sitrus-berry", "lum-berry",
        ],
        uncommon: [
            "muscle-band", "wise-glasses", "scope-lens", "razor-claw", "razor-fang",
            "kings-rock", "king-s-rock", "quick-claw", "shell-bell", "focus-band",
            "oran-berry", "cheri-berry", "chesto-berry", "pecha-berry",
            "rawst-berry", "aspear-berry",
        ],
        // Everything else -- the type-boost items and plates -- is common.
    };

    const RARITY_BY_SLUG = {};
    Object.entries(RARITY).forEach(([tier, slugs]) => {
        slugs.forEach((slug) => { RARITY_BY_SLUG[slug] = tier; });
    });

    function rarityOf(slug) {
        return RARITY_BY_SLUG[String(slug || "")] || "common";
    }

    // The shop should only stock items the battle engine actually reads.
    function sellableSlugs() {
        return Object.keys(ITEMS);
    }

    function getItem(slug) {
        return ITEMS[String(slug || "")] || null;
    }

    function isBerry(slug) {
        return String(slug || "").endsWith("-berry");
    }

    return { ITEMS, TYPE_BOOSTERS, STATUS_BERRIES, RARITY_BY_SLUG, getItem, isBerry, rarityOf, sellableSlugs };
}));
