(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PokemonBattleAbilities = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    // ------------------------------------------------------------------
    // Ability registry. Each entry declares only the hooks it uses; the
    // battle engine calls them at fixed points. Abilities whose systems
    // don't exist yet (weather, terrain, held items, fleeing) are marked
    // dormant: true so they can be listed in the UI without pretending to
    // work. Radical Red's custom abilities with no documented behaviour are
    // intentionally absent and act as no-ops.
    // ------------------------------------------------------------------

    const heal = (pokemon, ratio) => {
        const amount = Math.max(1, Math.floor(pokemon.maxHp * ratio));
        const before = pokemon.hp;
        pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + amount);
        return pokemon.hp - before;
    };

    const PUNCH = /punch/;
    const BITE = /fang|bite|crunch/;
    const PULSE = /pulse|aura-sphere|dark-pulse|water-pulse|dragon-pulse|origin-pulse|heal-pulse/;
    const SLASH = /slash|cut|blade|sacred-sword|razor-shell|leaf-blade|x-scissor/;
    const POWDER = /powder|spore/;
    // What Bulletproof stops: the games' "ballistic" set of balls and bombs.
    const BALLISTIC = /ball|bomb|barrage|cannon|missile|shell-trap|beak-blast|rock-wrecker/;
    // The wind set Wind Rider answers.
    const WIND = /gust|hurricane|air-cutter|razor-wind|heat-wave|icy-wind|tailwind|twister|whirlwind|petal-blizzard|bleakwind|sandsear|wildbolt|springtide/;
    const SOUND = /growl|roar|sing|supersonic|screech|snore|uproar|metal-sound|grass-whistle|hyper-voice|bug-buzz|chatter|round|echoed-voice|boomburst|disarming-voice|noble-roar|confide|sparkling-aria|clanging|overdrive|snarl/;

    const ABILITIES = {
        // --- type immunity / absorb / redirect ------------------------------
        "lightning-rod": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "electric") return null;
                return { immune: true, boost: { stat: "specialAttack", stages: 1 }, message: "{name}'s Lightning Rod drew in the attack!" };
            },
        },
        "volt-absorb": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "electric") return null;
                return { immune: true, healRatio: 0.25, message: "{name}'s Volt Absorb restored its HP!" };
            },
        },
        "water-absorb": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "water") return null;
                return { immune: true, healRatio: 0.25, message: "{name}'s Water Absorb restored its HP!" };
            },
        },
        "dry-skin": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "water") return null;
                return { immune: true, healRatio: 0.25, message: "{name}'s Dry Skin soaked up the water!" };
            },
            incomingDamageMult(ctx) { return ctx.moveType === "fire" ? 1.25 : 1; },
        },
        "flash-fire": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "fire") return null;
                return { immune: true, flag: "flashFire", message: "{name}'s Flash Fire powered up its Fire moves!" };
            },
            outgoingDamageMult(ctx) {
                return ctx.moveType === "fire" && ctx.attacker.volatileStatus?.flashFire ? 1.5 : 1;
            },
        },
        levitate: {
            typeImmunity(ctx) {
                if (ctx.moveType !== "ground") return null;
                return { immune: true, message: "{name} floats with Levitate!" };
            },
        },
        scrappy: {
            // Attacker-side: Normal and Fighting moves hit Ghosts.
            bypassTypeZero(ctx) {
                return (ctx.moveType === "normal" || ctx.moveType === "fighting")
                    && ctx.defenderTypes.includes("ghost");
            },
        },
        corrosion: {
            statusTargetOverride(condition) { return condition === "poison" || condition === "toxic"; },
        },

        // --- incoming damage modifiers --------------------------------------
        "thick-fat": {
            incomingDamageMult(ctx) { return ctx.moveType === "fire" || ctx.moveType === "ice" ? 0.5 : 1; },
        },
        filter: {
            incomingDamageMult(ctx) { return ctx.effectiveness > 1 ? 0.75 : 1; },
        },
        multiscale: {
            incomingDamageMult(ctx) { return ctx.defender.hp >= ctx.defender.maxHp ? 0.5 : 1; },
        },
        "ice-scales": {
            incomingDamageMult(ctx) { return ctx.physical ? 1 : 0.5; },
        },
        "fur-coat": {
            incomingDamageMult(ctx) { return ctx.physical ? 0.5 : 1; },
        },
        "marvel-scale": {
            defenseMult(ctx) { return ctx.pokemon.statusCondition ? 1.5 : 1; },
        },
        "shell-armor": { preventCrit: true },
        "battle-armor": { preventCrit: true },
        "wonder-skin": {
            statusMoveAccuracyCap: 50,
        },

        // --- outgoing damage modifiers --------------------------------------
        technician: {
            outgoingDamageMult(ctx) { return ctx.move.power > 0 && ctx.move.power <= 60 ? 1.5 : 1; },
        },
        hustle: {
            outgoingDamageMult(ctx) { return ctx.physical ? 1.5 : 1; },
            accuracyMultAsAttacker(ctx) { return ctx.physical ? 0.8 : 1; },
        },
        guts: {
            outgoingDamageMult(ctx) { return ctx.physical && ctx.attacker.statusCondition ? 1.5 : 1; },
            ignoreBurnAttackDrop: true,
        },
        "toxic-boost": {
            outgoingDamageMult(ctx) {
                const status = ctx.attacker.statusCondition;
                return ctx.physical && (status === "poison" || status === "toxic") ? 1.5 : 1;
            },
        },
        "sheer-force": {
            outgoingDamageMult(ctx) { return ctx.moveHasSecondary ? 1.3 : 1; },
            suppressOwnSecondary: true,
        },
        reckless: {
            outgoingDamageMult(ctx) { return ctx.moveHasRecoil ? 1.2 : 1; },
        },
        "iron-fist": {
            outgoingDamageMult(ctx) { return PUNCH.test(ctx.move.slug) ? 1.2 : 1; },
        },
        "strong-jaw": {
            outgoingDamageMult(ctx) { return BITE.test(ctx.move.slug) ? 1.5 : 1; },
        },
        "mega-launcher": {
            outgoingDamageMult(ctx) { return PULSE.test(ctx.move.slug) ? 1.5 : 1; },
        },
        sharpness: {
            outgoingDamageMult(ctx) { return SLASH.test(ctx.move.slug) ? 1.5 : 1; },
        },
        "tough-claws": {
            outgoingDamageMult(ctx) { return ctx.makesContact ? 1.3 : 1; },
        },
        adaptability: { stabOverride: 2 },
        "tinted-lens": {
            outgoingDamageMult(ctx) { return ctx.effectiveness < 1 && ctx.effectiveness > 0 ? 2 : 1; },
        },
        neuroforce: {
            outgoingDamageMult(ctx) { return ctx.effectiveness > 1 ? 1.25 : 1; },
        },
        sniper: { critDamageMult: 1.5 },
        rivalry: {
            outgoingDamageMult(ctx) {
                const a = ctx.attacker.gender;
                const b = ctx.defender.gender;
                if (!a || !b || a === "genderless" || b === "genderless") return 1;
                return a === b ? 1.25 : 0.75;
            },
        },
        analytic: {
            outgoingDamageMult(ctx) { return ctx.movedLast ? 1.3 : 1; },
        },
        overgrow: {
            outgoingDamageMult(ctx) { return ctx.moveType === "grass" && ctx.attacker.hp <= ctx.attacker.maxHp / 3 ? 1.5 : 1; },
        },
        blaze: {
            outgoingDamageMult(ctx) { return ctx.moveType === "fire" && ctx.attacker.hp <= ctx.attacker.maxHp / 3 ? 1.5 : 1; },
        },
        torrent: {
            outgoingDamageMult(ctx) { return ctx.moveType === "water" && ctx.attacker.hp <= ctx.attacker.maxHp / 3 ? 1.5 : 1; },
        },
        swarm: {
            outgoingDamageMult(ctx) { return ctx.moveType === "bug" && ctx.attacker.hp <= ctx.attacker.maxHp / 3 ? 1.5 : 1; },
        },
        galvanize: {
            moveTypeOverride(ctx) { return ctx.moveType === "normal" ? "electric" : null; },
            outgoingDamageMult(ctx) { return ctx.originalMoveType === "normal" ? 1.2 : 1; },
        },
        aerilate: {
            moveTypeOverride(ctx) { return ctx.moveType === "normal" ? "flying" : null; },
            outgoingDamageMult(ctx) { return ctx.originalMoveType === "normal" ? 1.2 : 1; },
        },
        "parental-bond": { extraHitRatio: 0.25 },

        // --- status / volatile immunities -----------------------------------
        limber: { preventStatus: ["paralysis"] },
        immunity: { preventStatus: ["poison", "toxic"] },
        insomnia: { preventStatus: ["sleep"] },
        "vital-spirit": { preventStatus: ["sleep"] },
        "water-veil": { preventStatus: ["burn"] },
        "magma-armor": { preventStatus: ["freeze"] },
        "own-tempo": { preventVolatile: ["confused"] },
        "inner-focus": { preventVolatile: ["flinched"] },
        oblivious: { preventVolatile: ["infatuated"] },
        "shield-dust": { blockIncomingSecondary: true },
        overcoat: {
            blockMove(ctx) { return POWDER.test(ctx.move.slug); },
            // Also keeps the sand and snow off.
            weatherChipImmune: ["sandstorm", "snow"],
        },
        soundproof: {
            blockMove(ctx) { return SOUND.test(ctx.move.slug); },
        },
        "clear-body": { preventStatDrop: () => true },
        "hyper-cutter": { preventStatDrop: (stat) => stat === "attack" },
        unaware: { ignoreTargetStages: true },

        // --- contact reactions ----------------------------------------------
        static: {
            onContactReceived(ctx) { ctx.tryStatus(ctx.attacker, "paralysis", 30, "{name}'s Static paralyzed {other}!"); },
        },
        "flame-body": {
            onContactReceived(ctx) { ctx.tryStatus(ctx.attacker, "burn", 30, "{name}'s Flame Body burned {other}!"); },
        },
        "effect-spore": {
            onContactReceived(ctx) {
                const roll = ctx.rng() * 100;
                if (roll < 9) ctx.tryStatus(ctx.attacker, "poison", 100, "{name}'s Effect Spore poisoned {other}!");
                else if (roll < 19) ctx.tryStatus(ctx.attacker, "paralysis", 100, "{name}'s Effect Spore paralyzed {other}!");
                else if (roll < 30) ctx.tryStatus(ctx.attacker, "sleep", 100, "{name}'s Effect Spore put {other} to sleep!");
            },
        },
        "rough-skin": {
            onContactReceived(ctx) { ctx.chip(ctx.attacker, 1 / 8, "{other} was hurt by {name}'s Rough Skin!"); },
        },
        "cute-charm": {
            onContactReceived(ctx) {
                if (ctx.rng() * 100 >= 30) return;
                ctx.tryInfatuate(ctx.attacker, ctx.defender, "{name}'s Cute Charm infatuated {other}!");
            },
        },
        "tangling-hair": {
            onContactReceived(ctx) { ctx.dropStat(ctx.attacker, "speed", 1, "{name}'s Tangling Hair lowered {other}'s Speed!"); },
        },
        "weak-armor": {
            onPhysicalHitReceived(ctx) {
                ctx.dropStat(ctx.defender, "defense", 1, null);
                ctx.raiseStat(ctx.defender, "speed", 2, "{name}'s Weak Armor traded defense for speed!");
            },
        },
        "poison-touch": {
            onContactDealt(ctx) { ctx.tryStatus(ctx.defender, "poison", 30, "{name}'s Poison Touch poisoned {other}!"); },
        },
        "anger-point": {
            onCritReceived(ctx) { ctx.maximizeStat(ctx.defender, "attack", "{name}'s Anger Point maxed its Attack!"); },
        },
        justified: {
            onHitByType(ctx) {
                if (ctx.moveType === "dark") ctx.raiseStat(ctx.defender, "attack", 1, "{name}'s Justified raised its Attack!");
            },
        },
        berserk: {
            onDamagedBelowHalf(ctx) { ctx.raiseStat(ctx.defender, "specialAttack", 1, "{name}'s Berserk raised its Sp. Atk!"); },
        },
        stamina: {
            onDamaged(ctx) { ctx.raiseStat(ctx.defender, "defense", 1, "{name}'s Stamina raised its Defense!"); },
        },

        // --- accuracy --------------------------------------------------------
        "no-guard": { alwaysHit: true },
        "compound-eyes": { accuracyMultAsAttacker: () => 1.3 },

        // --- recoil / indirect damage ---------------------------------------
        "rock-head": { noRecoil: true },
        "magic-guard": { indirectImmune: true },
        "liquid-ooze": { drainBackfire: true },

        // --- end of turn / switch -------------------------------------------
        "speed-boost": {
            endOfTurn(ctx) { ctx.raiseStat(ctx.pokemon, "speed", 1, "{name}'s Speed Boost raised its Speed!"); },
        },
        "shed-skin": {
            endOfTurn(ctx) {
                if (!ctx.pokemon.statusCondition || ctx.rng() >= 1 / 3) return;
                ctx.cureStatus(ctx.pokemon, "{name}'s Shed Skin cured its status!");
            },
        },
        "bad-dreams": {
            endOfTurn(ctx) {
                ctx.opponents().forEach((entry) => {
                    if (entry.pokemon.statusCondition !== "sleep") return;
                    ctx.chipOpponent(entry, 1 / 8, "{other} is tormented by Bad Dreams!");
                });
            },
        },
        "natural-cure": {
            onSwitchOut(pokemon) { pokemon.statusCondition = null; pokemon.statusTurns = 0; pokemon.toxicCounter = 0; },
        },
        regenerator: {
            onSwitchOut(pokemon) { heal(pokemon, 1 / 3); },
        },
        "quick-feet": {
            speedMult(pokemon) { return pokemon.statusCondition ? 1.5 : 1; },
            ignoreParalysisSpeedDrop: true,
        },

        // --- switch-in -------------------------------------------------------
        intimidate: {
            onSwitchIn(ctx) {
                ctx.opponents().forEach((entry) => {
                    ctx.dropOpponentStat(entry, "attack", 1, "{name}'s Intimidate cut {other}'s Attack!");
                });
            },
        },
        download: {
            onSwitchIn(ctx) {
                const foes = ctx.opponents();
                if (!foes.length) return;
                const def = foes.reduce((sum, e) => sum + e.pokemon.stats.defense, 0);
                const spd = foes.reduce((sum, e) => sum + e.pokemon.stats.specialDefense, 0);
                const stat = def < spd ? "attack" : "specialAttack";
                ctx.raiseStat(ctx.pokemon, stat, 1, "{name}'s Download raised its power!");
            },
        },
        trace: {
            onSwitchIn(ctx) {
                const foes = ctx.opponents().filter((e) => e.pokemon.ability && !ABILITIES[e.pokemon.ability.slug]?.untraceable);
                if (!foes.length) return;
                const source = foes[Math.floor(ctx.rng() * foes.length)];
                ctx.pokemon.ability = { ...source.pokemon.ability, traced: true };
                ctx.announce(`{name}'s Trace copied ${source.pokemon.name}'s ${source.pokemon.ability.name}!`);
            },
            untraceable: true,
        },

        // --- misc engine hooks -----------------------------------------------
        sturdy: {
            survivesKO(ctx) { return ctx.defender.hp >= ctx.defender.maxHp; },
            ohkoImmune: true,
        },
        "serene-grace": { secondaryChanceMult: 2 },
        "skill-link": { multiHitAlwaysMax: true },
        moxie: {
            onKnockOut(ctx) { ctx.raiseStat(ctx.pokemon, "attack", 1, "{name}'s Moxie raised its Attack!"); },
        },
        defiant: {
            onStatLoweredByFoe(ctx) { ctx.raiseStat(ctx.pokemon, "attack", 2, "{name}'s Defiant sharply raised its Attack!"); },
        },
        competitive: {
            onStatLoweredByFoe(ctx) { ctx.raiseStat(ctx.pokemon, "specialAttack", 2, "{name}'s Competitive sharply raised its Sp. Atk!"); },
        },
        steadfast: {
            onFlinched(ctx) { ctx.raiseStat(ctx.pokemon, "speed", 1, "{name}'s Steadfast raised its Speed!"); },
        },
        synchronize: {
            onStatusedByFoe(ctx) {
                if (!["burn", "poison", "toxic", "paralysis"].includes(ctx.condition)) return;
                ctx.tryStatus(ctx.source, ctx.condition, 100, "{name}'s Synchronize passed the status back!");
            },
        },
        pressure: { extraPpCost: 1 },
        "mold-breaker": { ignoreDefenderAbility: true },
        "magnet-pull": {
            blocksSwitchOf(pokemon) { return pokemon.types.includes("steel"); },
        },
        "arena-trap": {
            blocksSwitchOf(pokemon, defenderHasLevitate) { return !pokemon.types.includes("flying") && !defenderHasLevitate; },
        },
        "shadow-tag": {
            blocksSwitchOf() { return true; },
        },

        // --- weather ---------------------------------------------------------
        // The engine reads WEATHER_ABILITIES for the four summoners, so they
        // only need to exist here to count as implemented.
        drizzle: { summonsWeather: "rain" },
        drought: { summonsWeather: "sun" },
        "sand-stream": { summonsWeather: "sandstorm" },
        "snow-warning": { summonsWeather: "snow" },

        chlorophyll: { speedMult: (pokemon, ctx) => (ctx?.weather === "sun" ? 2 : 1) },
        "swift-swim": { speedMult: (pokemon, ctx) => (ctx?.weather === "rain" ? 2 : 1) },
        "sand-rush": { speedMult: (pokemon, ctx) => (ctx?.weather === "sandstorm" ? 2 : 1) },
        "slush-rush": { speedMult: (pokemon, ctx) => (ctx?.weather === "snow" ? 2 : 1) },

        "sand-veil": {
            weatherChipImmune: ["sandstorm"],
            evasionMultInWeather: (weather) => (weather === "sandstorm" ? 1.25 : 1),
        },
        "sand-force": {
            weatherChipImmune: ["sandstorm"],
            weatherDamageMult: ({ weather, moveType }) => (weather === "sandstorm"
                && ["rock", "ground", "steel"].includes(moveType) ? 1.3 : 1),
        },
        "rain-dish": {
            endOfTurn(ctx) {
                if (ctx.weather !== "rain" || ctx.pokemon.hp >= ctx.pokemon.maxHp) return;
                const restored = heal(ctx.pokemon, 1 / 16);
                if (restored > 0) ctx.announce("{name} drank in the rain!");
            },
        },
        "ice-body": {
            weatherChipImmune: ["snow"],
            endOfTurn(ctx) {
                if (ctx.weather !== "snow" || ctx.pokemon.hp >= ctx.pokemon.maxHp) return;
                const restored = heal(ctx.pokemon, 1 / 16);
                if (restored > 0) ctx.announce("{name} healed in the snow!");
            },
        },
        hydration: {
            endOfTurn(ctx) {
                if (ctx.weather !== "rain" || !ctx.pokemon.statusCondition) return;
                ctx.cureStatus(ctx.pokemon, "{name} was cured by the rain!");
            },
        },
        "solar-power": {
            sunSpecialAttackMult: 1.5,
            endOfTurn(ctx) {
                if (ctx.weather !== "sun") return;
                ctx.chip(ctx.pokemon, 1 / 8, "{name} is scorched by the sun!");
            },
        },
        // Only shields while the sun is out.
        "leaf-guard": { statusImmuneInWeather: ["sun"] },
        "cloud-nine": { suppressesWeather: true },

        // --- terrain ---------------------------------------------------------
        // The engine reads TERRAIN_ABILITIES for the four summoners.
        "electric-surge": { summonsTerrain: "electric" },
        "grassy-surge": { summonsTerrain: "grassy" },
        "misty-surge": { summonsTerrain: "misty" },
        "psychic-surge": { summonsTerrain: "psychic" },
        "surge-surfer": { speedMult: (pokemon, ctx) => (ctx?.terrain === "electric" ? 2 : 1) },

        // --- held items ------------------------------------------------------
        unburden: {
            // Doubles speed once the holder has used up what it was carrying.
            speedMult: (pokemon) => (pokemon.heldItemSpent ? 2 : 1),
        },
        gluttony: { earlyBerries: true },
        harvest: {
            endOfTurn(ctx) {
                const berries = (typeof globalThis !== "undefined" ? globalThis : window).PokemonHeldItems;
                if (!ctx.pokemon.heldItemSpent || !berries?.isBerry(ctx.pokemon.heldItemKey)) return;
                if (ctx.rng() >= 0.5) return;
                ctx.pokemon.heldItemSpent = false;
                ctx.announce("{name} harvested its berry!");
            },
        },
        frisk: {
            onSwitchIn(ctx) {
                const seen = ctx.opponents()
                    .map((entry) => entry.pokemon)
                    .filter((foe) => foe.heldItemKey);
                if (!seen.length) return;
                seen.forEach((foe) => ctx.announce(`{name} frisked ${foe.name}!`, foe));
            },
        },
        "air-lock": { suppressesWeather: true },

        // Trick, Switcheroo, Knock Off and Corrosive Gas all exist now, so
        // Sticky Hold has something to hang on against.
        "sticky-hold": { keepsItem: true },
        // Read by the run simulation when it rolls post-duel drops.
        pickup: { extraDropChance: 0.5 },
        // Gen 5 gave Stench a battle use, and Gen 9 gave Illuminate one; both
        // are worth more here than the encounter-rate effects they replaced,
        // which this game has no wild-encounter system to apply.
        stench: { flinchChance: 10 },
        illuminate: { ignoreTargetStages: true },

        // --- turn denial ------------------------------------------------------
        truant: {
            // Loafs every other turn. volatileStatus is wiped on switch, so a
            // fresh switch-in always gets to move before the first rest.
            preventsAction(ctx) {
                const volatiles = ctx.pokemon.volatileStatus || (ctx.pokemon.volatileStatus = {});
                if (volatiles.truantLoafing) {
                    volatiles.truantLoafing = false;
                    return "{name} is loafing around!";
                }
                volatiles.truantLoafing = true;
                return null;
            },
        },
        "early-bird": { sleepCounterRate: 2 },

        // --- stat-stage scaling ----------------------------------------------
        simple: { statStageMult: 2 },
        contrary: { statStageMult: -1 },

        // --- priority ---------------------------------------------------------
        prankster: {
            priorityBonus(ctx) { return ctx.move.damageClass?.includes("status") ? 1 : 0; },
        },
        "gale-wings": {
            priorityBonus(ctx) {
                return ctx.move.type === "flying" && ctx.pokemon.hp >= ctx.pokemon.maxHp ? 1 : 0;
            },
        },
        triage: {
            priorityBonus(ctx) { return ctx.move.effects?.healRatio ? 3 : 0; },
        },

        // --- crit -------------------------------------------------------------
        "super-luck": { critStageBonus: 1 },
        merciless: {
            alwaysCritAgainst(ctx) {
                const status = ctx.defender?.statusCondition;
                return status === "poison" || status === "toxic";
            },
        },

        // --- further type absorbers (same shape as Lightning Rod) -------------
        "storm-drain": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "water") return null;
                return { immune: true, boost: { stat: "specialAttack", stages: 1 }, message: "{name}'s Storm Drain drew in the attack!" };
            },
        },
        "motor-drive": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "electric") return null;
                return { immune: true, boost: { stat: "speed", stages: 1 }, message: "{name}'s Motor Drive boosted its Speed!" };
            },
        },
        "sap-sipper": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "grass") return null;
                return { immune: true, boost: { stat: "attack", stages: 1 }, message: "{name}'s Sap Sipper boosted its Attack!" };
            },
        },
        "earth-eater": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "ground") return null;
                return { immune: true, healRatio: 0.25, message: "{name} ate the ground!" };
            },
        },
        "well-baked-body": {
            typeImmunity(ctx) {
                if (ctx.moveType !== "fire") return null;
                return { immune: true, boost: { stat: "defense", stages: 2 }, message: "{name}'s Well-Baked Body soaked up the fire!" };
            },
        },

        // --- further damage modifiers ----------------------------------------
        "solid-rock": {
            incomingDamageMult(ctx) { return ctx.effectiveness > 1 ? 0.75 : 1; },
        },
        "prism-armor": {
            incomingDamageMult(ctx) { return ctx.effectiveness > 1 ? 0.75 : 1; },
        },
        heatproof: {
            incomingDamageMult(ctx) { return ctx.moveType === "fire" ? 0.5 : 1; },
        },
        "shadow-shield": {
            incomingDamageMult(ctx) { return ctx.defender.hp >= ctx.defender.maxHp ? 0.5 : 1; },
        },
        "water-bubble": {
            incomingDamageMult(ctx) { return ctx.moveType === "fire" ? 0.5 : 1; },
            outgoingDamageMult(ctx) { return ctx.moveType === "water" ? 2 : 1; },
            preventStatus: ["burn"],
        },
        fluffy: {
            // Halves what it can feel, but fire goes straight through the coat.
            incomingDamageMult(ctx) {
                if (ctx.moveType === "fire") return 2;
                return ctx.makesContact ? 0.5 : 1;
            },
        },
        "punk-rock": {
            outgoingDamageMult(ctx) { return SOUND.test(ctx.move.slug) ? 1.3 : 1; },
            incomingDamageMult(ctx) { return SOUND.test(ctx.move.slug) ? 0.5 : 1; },
        },
        "huge-power": {
            outgoingDamageMult(ctx) { return ctx.physical ? 2 : 1; },
        },
        "pure-power": {
            outgoingDamageMult(ctx) { return ctx.physical ? 2 : 1; },
        },
        "flare-boost": {
            outgoingDamageMult(ctx) { return !ctx.physical && ctx.attacker.statusCondition === "burn" ? 1.5 : 1; },
        },
        defeatist: {
            outgoingDamageMult(ctx) { return ctx.attacker.hp <= ctx.attacker.maxHp / 2 ? 0.5 : 1; },
        },
        "steely-spirit": {
            outgoingDamageMult(ctx) { return ctx.moveType === "steel" ? 1.5 : 1; },
        },
        transistor: {
            outgoingDamageMult(ctx) { return ctx.moveType === "electric" ? 1.3 : 1; },
        },
        "dragons-maw": {
            outgoingDamageMult(ctx) { return ctx.moveType === "dragon" ? 1.5 : 1; },
        },
        "rocky-payload": {
            outgoingDamageMult(ctx) { return ctx.moveType === "rock" ? 1.5 : 1; },
        },
        refrigerate: {
            moveTypeOverride(ctx) { return ctx.moveType === "normal" ? "ice" : null; },
            outgoingDamageMult(ctx) { return ctx.originalMoveType === "normal" ? 1.2 : 1; },
        },
        pixilate: {
            moveTypeOverride(ctx) { return ctx.moveType === "normal" ? "fairy" : null; },
            outgoingDamageMult(ctx) { return ctx.originalMoveType === "normal" ? 1.2 : 1; },
        },
        "liquid-voice": {
            moveTypeOverride(ctx) { return SOUND.test(ctx.move?.slug || "") ? "water" : null; },
        },

        // --- further blockers and guards -------------------------------------
        bulletproof: {
            blockMove(ctx) { return BALLISTIC.test(ctx.move.slug); },
        },
        dazzling: {
            blockMove(ctx) { return ctx.move.priority > 0; },
        },
        "queenly-majesty": {
            blockMove(ctx) { return ctx.move.priority > 0; },
        },
        "armor-tail": {
            blockMove(ctx) { return ctx.move.priority > 0; },
        },
        "white-smoke": { preventStatDrop: () => true },
        "full-metal-body": { preventStatDrop: () => true },
        turboblaze: { ignoreDefenderAbility: true },
        teravolt: { ignoreDefenderAbility: true },

        // --- further contact reactions ---------------------------------------
        "iron-barbs": {
            onContactReceived(ctx) { ctx.chip(ctx.attacker, 1 / 8, "{other} was hurt by {name}'s Iron Barbs!"); },
        },
        gooey: {
            onContactReceived(ctx) { ctx.dropStat(ctx.attacker, "speed", 1, "{name}'s Gooey lowered {other}'s Speed!"); },
        },

        // --- further switch-in / knockout ------------------------------------
        "intrepid-sword": {
            onSwitchIn(ctx) { ctx.raiseStat(ctx.pokemon, "attack", 1, "{name}'s Intrepid Sword raised its Attack!"); },
        },
        "beast-boost": {
            onKnockOut(ctx) {
                const stats = ctx.pokemon.stats || {};
                const best = ["attack", "defense", "specialAttack", "specialDefense", "speed"]
                    .reduce((top, stat) => (stats[stat] > (stats[top] ?? -Infinity) ? stat : top), "attack");
                ctx.raiseStat(ctx.pokemon, best, 1, "{name}'s Beast Boost raised its best stat!");
            },
        },
        "chilling-neigh": {
            onKnockOut(ctx) { ctx.raiseStat(ctx.pokemon, "attack", 1, "{name}'s Chilling Neigh raised its Attack!"); },
        },
        "grim-neigh": {
            onKnockOut(ctx) { ctx.raiseStat(ctx.pokemon, "specialAttack", 1, "{name}'s Grim Neigh raised its Sp. Atk!"); },
        },

        // --- the switch-and-status layer, awakened ---------------------------
        protean: { changesTypeToMove: true },
        libero: { changesTypeToMove: true },
        "magic-bounce": { reflectsStatus: true },
        "poison-heal": { poisonHeal: true },
        "suction-cups": { anchorsSelf: true },
        damp: { blocksSelfFaint: true },
        telepathy: { allyDamageImmune: true },
        "wonder-guard": { onlySuperEffective: true },
        "unseen-fist": { hitsThroughProtect: true },
        infiltrator: { bypassScreens: true },
        stalwart: { ignoreRedirection: true },
        "propeller-tail": { ignoreRedirection: true },
        "aroma-veil": { restrictImmuneSelfAndAllies: true },
        "sweet-veil": { preventStatus: ["sleep"], sleepGuardAllies: true },
        comatose: { preventStatus: ["burn", "poison", "toxic", "paralysis", "freeze", "sleep"] },
        "purifying-salt": {
            preventStatus: ["burn", "poison", "toxic", "paralysis", "freeze", "sleep"],
            incomingDamageMult(ctx) { return ctx.moveType === "ghost" ? 0.5 : 1; },
        },
        stakeout: {
            // Doubles against anything that switched in this turn.
            outgoingDamageMult(ctx) { return (ctx.defender?.turnsActive ?? 1) <= 0 ? 2 : 1; },
        },
        "toxic-chain": {
            onDamageDealt(ctx) { ctx.tryStatus(ctx.defender, "toxic", 30, "{name}'s Toxic Chain badly poisoned {other}!"); },
        },
        "thermal-exchange": {
            preventStatus: ["burn"],
            onHitByType(ctx) {
                if (ctx.moveType === "fire") ctx.raiseStat(ctx.defender, "attack", 1, "{name}'s Thermal Exchange raised its Attack!");
            },
        },
        "watercompaction": {
            onHitByType(ctx) {
                if (ctx.moveType === "water") ctx.raiseStat(ctx.defender, "defense", 2, "{name}'s Water Compaction hardened it!");
            },
        },
        "wind-rider": {
            blockMove(ctx) { return WIND.test(ctx.move.slug); },
            blockBoost: { stat: "attack", stages: 1 },
        },
        "sand-spit": {
            onDamaged(ctx) { ctx.setWeather("sandstorm"); },
        },
        "seed-sower": {
            onDamaged(ctx) { ctx.setTerrain("grassy"); },
        },
        "cotton-down": {
            onDamaged(ctx) { ctx.dropStat(ctx.attacker, "speed", 1, "{name}'s Cotton Down slowed {other}!"); },
        },
        "toxic-debris": {
            onPhysicalHitReceived(ctx) { ctx.layHazardAgainstAttacker("toxicSpikes"); },
        },
        aftermath: { chipOnContactKO: true },
        "innards-out": { damageEqualToLastHp: true },
        "anger-shell": {
            onDamagedBelowHalf(ctx) {
                ctx.raiseStat(ctx.defender, "attack", 1, "{name}'s Anger Shell flared!");
                ctx.raiseStat(ctx.defender, "specialAttack", 1, null);
                ctx.raiseStat(ctx.defender, "speed", 1, null);
                ctx.dropStat(ctx.defender, "defense", 1, null);
                ctx.dropStat(ctx.defender, "specialDefense", 1, null);
            },
        },
        "slow-start": {
            outgoingDamageMult(ctx) { return ctx.physical && (ctx.attacker.turnsActive ?? 9) < 5 ? 0.5 : 1; },
            speedMult: (pokemon) => ((pokemon.turnsActive ?? 9) < 5 ? 0.5 : 1),
        },
        "gorilla-tactics": {
            choiceLock: true,
            outgoingDamageMult(ctx) { return ctx.physical ? 1.5 : 1; },
        },
        "grass-pelt": {
            defenseMult(ctx) { return ctx.terrain === "grassy" ? 1.5 : 1; },
        },

        // --- dormant: system not built yet -----------------------------------
        // There is no way to flee a battle in this game, so nothing can make
        // fleeing succeed.
        "run-away": { dormant: "wild-flee" },
    };

    // Everything below is carried by a species in the dataset but has no
    // working implementation. They are listed rather than left absent so
    // isImplemented() reports the truth and the UI can stop claiming they
    // work: an ability that silently does nothing is worse than one that
    // says so. Grouped by what each would need before it could be written.
    const DORMANT_ABILITIES = {
        // Form changes and mid-battle transformations: the engine has no
        // concept of a Pokemon becoming a different Pokemon.
        "form-change": ["zen-mode", "schooling", "shields-down", "stance-change",
            "power-construct", "battle-bond", "zero-to-hero", "disguise", "ice-face",
            "hunger-switch", "gulp-missile", "forecast", "flower-gift", "imposter",
            "illusion", "multitype", "tera-shell", "primal-armor"],
        // Field-wide stat auras and the gen 9 paradox boosters.
        "field-aura": ["fairy-aura", "dark-aura", "vessel-of-ruin", "sword-of-ruin",
            "tablets-of-ruin", "beads-of-ruin", "protosynthesis", "quark-drive",
            "orichalcumpulse", "hadron-engine", "supremeoverlord", "victory-star",
            "friend-guard", "plus", "minus", "steam-engine", "electromrphosis"],
        // Extreme weather that blocks other weather outright.
        "primal-weather": ["desolate-land", "primordial-sea", "delta-stream"],
        // Ability copying, swapping and suppression between Pokemon.
        "ability-swap": ["neutralize-gas", "mummy", "lingering-aroma", "receiver",
            "as-one", "wandering-soul", "good-as-gold"],
        // Needs the held-item layer to expose berry timing and item theft.
        "item-layer": ["unnerve", "cheek-pouch", "ripen", "magician", "harvest-plus"],
        // Needs switch tracking, forced-switch control or ally targeting.
        "switch-layer": ["wimp-out", "emergency-exit",
            "dancer",
            "perish-body", "screen-cleaner",
            "quick-draw",
            "mountaineer",
            
            
            "heavy-metal", "soul-heart",
            "striker", "super-luck-plus"],
    };
    // Radical Red's own inventions have no documented behaviour to copy, so
    // they stay no-ops -- but named ones, not silent ones.
    const CUSTOM_ABILITIES = ["feline-prowess", "sage-power", "bone-zone", "bull-rush",
        "valiant-shield", "self-sufficient", "fatal-precision", "blazing-soul",
        "alchemic-power", "quill-rush", "bad-company", "cash-splash", "blubber-defense",
        "frozen-mist", "phoenix-down", "parasitic-waste", "oraoraoraora"];

    Object.entries(DORMANT_ABILITIES).forEach(([reason, slugs]) => {
        slugs.forEach((slug) => { if (!ABILITIES[slug]) ABILITIES[slug] = { dormant: reason }; });
    });
    CUSTOM_ABILITIES.forEach((slug) => {
        if (!ABILITIES[slug]) ABILITIES[slug] = { dormant: "radical-red-custom" };
    });

    function getAbility(slug) {
        return ABILITIES[String(slug || "")] || null;
    }

    function isImplemented(slug) {
        const entry = getAbility(slug);
        return Boolean(entry) && !entry.dormant;
    }

    return { ABILITIES, getAbility, isImplemented };
}));
