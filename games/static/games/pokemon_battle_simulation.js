(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
    root.PokemonBattleSimulation = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const LEVEL = 50;
    const FALLBACK_MOVE_ID = 33;
    const STAT_KEYS = ["attack", "defense", "specialAttack", "specialDefense", "speed", "accuracy", "evasion"];
    // Critical-hit odds by stage: none, a high-crit move, Focus Energy, both.
    const CRIT_STAGE_ODDS = [0.0625, 0.125, 0.25, 0.5, 1];

    // Moves whose power is worked out at use time. The extraction stores them
    // all with a placeholder power of 1, so without these they landed for
    // almost nothing -- Electro Ball hit a Staryu for six.
    //
    // Weight-based power (Low Kick, Grass Knot, Heavy Slam, Heat Crash) is
    // absent because the species records carry no weight.
    const DYNAMIC_POWER = {
        // The faster the user is, the harder the orb hits.
        "electro-ball": ({ actorSpeed, targetSpeed }) => {
            const ratio = actorSpeed / Math.max(1, targetSpeed);
            if (ratio >= 4) return 150;
            if (ratio >= 3) return 120;
            if (ratio >= 2) return 80;
            if (ratio >= 1) return 60;
            return 40;
        },
        "sonic-slash": ({ actorSpeed, targetSpeed }) => {
            const ratio = actorSpeed / Math.max(1, targetSpeed);
            if (ratio >= 4) return 150;
            if (ratio >= 3) return 120;
            if (ratio >= 2) return 80;
            if (ratio >= 1) return 60;
            return 40;
        },
        // Gyro Ball is the mirror image: reward for being slow.
        "gyro-ball": ({ actorSpeed, targetSpeed }) => clamp(
            Math.floor((25 * targetSpeed) / Math.max(1, actorSpeed)) + 1, 1, 150),
        // The closer to fainting, the harder the swing.
        reversal: ({ actor }) => hpScaledPower(actor),
        flail: ({ actor }) => hpScaledPower(actor),
        // Punishes a target that has been setting up.
        punishment: ({ target }) => clamp(
            60 + 20 * STAT_KEYS.reduce((total, stat) => total + Math.max(0, numberOr(target.statStages?.[stat], 0)), 0),
            60, 200),
        // The last copy hits hardest.
        "trump-card": ({ move }) => {
            const remaining = Math.max(0, numberOr(move.pp, 0));
            return [200, 80, 60, 50][remaining] ?? 40;
        },
        // Scales with how much health the target still has.
        "wring-out": ({ target }) => Math.max(1, Math.floor(120 * target.hp / Math.max(1, target.maxHp))),
        "hard-press": ({ target }) => Math.max(1, Math.floor(120 * target.hp / Math.max(1, target.maxHp))),
        // The real move rolls a magnitude from 4 to 10.
        magnitude: ({ rng }) => {
            const roll = rng();
            if (roll < 0.05) return 10;
            if (roll < 0.15) return 30;
            if (roll < 0.35) return 50;
            if (roll < 0.65) return 70;
            if (roll < 0.85) return 90;
            if (roll < 0.95) return 110;
            return 150;
        },
        // No friendship is tracked, so both sit at the midpoint of their range.
        return: () => 102,
        frustration: () => 102,
    };

    // Reversal and Flail share one ladder off the user's remaining health.
    function hpScaledPower(pokemon) {
        const fraction = numberOr(pokemon.hp, 0) / Math.max(1, numberOr(pokemon.maxHp, 1));
        if (fraction < 1 / 24) return 200;
        if (fraction < 1 / 12) return 150;
        if (fraction < 1 / 4) return 100;
        if (fraction < 1 / 2) return 80;
        if (fraction < 17 / 24) return 40;
        return 20;
    }

    // What a Pokemon falls back on with nothing left to use. Typeless in the
    // real games; Normal here, with the usual quarter-of-the-damage recoil.
    const STRUGGLE = {
        id: -1,
        name: "struggle",
        displayName: "Struggle",
        type: "normal",
        power: 50,
        accuracy: 100,
        priority: 0,
        damageClass: "physical",
        maxPp: 1,
        pp: 1,
        description: "Used only if all PP are gone. It also hurts the user a little.",
        slug: "struggle",
        targetCode: 0,
        targetMode: "selected-opponent",
        makesContact: true,
        effects: {
            slug: "struggle",
            targetCode: 0,
            targetMode: "selected-opponent",
            statChanges: [],
            statusEffect: null,
            recoilRatio: 0.25,
            drainRatio: 0,
            healRatio: 0,
            flinchChance: 0,
            confusionChance: 0,
            multiHit: null,
            ohko: false,
            highCritRatio: false,
            protect: false,
            selfFaint: false,
            nonLethal: false,
            firstTurnOnly: false,
        },
    };
    const TARGET_SELF = 16;
    const TARGET_ALL_OPPONENTS = 8;
    // GBA target code 32: both opponents and the user's own partner.
    const TARGET_FOES_AND_ALLY = 32;

    const EXPLICIT_MOVE_RULES = {
        "false-swipe": { nonLethal: true },
        "fake-out": { firstTurnOnly: true, flinchChance: 100 },
        absorb: { drainRatio: 0.5 },
        "mega-drain": { drainRatio: 0.5 },
        "giga-drain": { drainRatio: 0.5 },
        "leech-life": { drainRatio: 0.5 },
        "dream-eater": { drainRatio: 0.5 },
        "drain-punch": { drainRatio: 0.5 },
        "horn-leech": { drainRatio: 0.5 },
        "parabolic-charge": { drainRatio: 0.5 },
        "oblivion-wing": { drainRatio: 0.75 },
        // --- trapping ------------------------------------------------------
        // "for two to five turns" was being read by the multi-hit regex as
        // "hits 2-5 times", so these all landed as multi-hit attacks and
        // never trapped anything. multiHit: null undoes that inference.
        bind: { trap: { min: 2, max: 5 }, multiHit: null },
        wrap: { trap: { min: 2, max: 5 }, multiHit: null },
        "fire-spin": { trap: { min: 2, max: 5 }, multiHit: null },
        whirlpool: { trap: { min: 2, max: 5 }, multiHit: null },
        "sand-tomb": { trap: { min: 2, max: 5 }, multiHit: null },
        clamp: { trap: { min: 2, max: 5 }, multiHit: null },
        // The newer binds say "four to five turns" in their own text.
        infestation: { trap: { min: 4, max: 5 }, multiHit: null },
        "magma-storm": { trap: { min: 4, max: 5 }, multiHit: null },
        "snap-trap": { trap: { min: 4, max: 5 }, multiHit: null },
        "thunder-cage": { trap: { min: 4, max: 5 }, multiHit: null },

        // --- move restriction ----------------------------------------------
        disable: { restrict: "disable" },
        encore: { restrict: "encore" },
        torment: { restrict: "torment" },
        taunt: { restrict: "taunt" },

        // --- target-side timed effects --------------------------------------
        "leech-seed": { seed: true },
        // Target code 16 reads as "self", but this one reaches everybody.
        "perish-song": { perish: true, targetMode: "all-battlers" },
        "destiny-bond": { destinyBond: true },

        // These say only "Restores the user's HP", so the generic regex reads
        // no ratio at all and they healed nothing. The amount is scaled by
        // weather at use time.
        moonlight: { healRatio: 0.5 },
        synthesis: { healRatio: 0.5 },
        "morning-sun": { healRatio: 0.5 },
        "self-destruct": { selfFaint: true },
        explosion: { selfFaint: true },
        "dragon-rage": { fixedDamage: 40 },
        "sonic-boom": { fixedDamage: 20 },
        // These set damage outright rather than scaling a base power, and the
        // data stores their power as a placeholder 1.
        "natures-madness": { targetHpFractionDamage: 0.5 },
        ruination: { targetHpFractionDamage: 0.5 },
        endeavor: { matchHpDamage: true },
        "final-gambit": { sacrificeDamage: true, selfFaint: true },
        psywave: { levelDamage: true },
        "night-shade": { levelDamage: true },
        "seismic-toss": { levelDamage: true },
        "super-fang": { targetHpFractionDamage: 0.5 },
        "water-sport": { fieldEffect: { key: "waterSport", turns: 5 } },
        "mud-sport": { fieldEffect: { key: "mudSport", turns: 5 } },
        protect: { protect: true },
        detect: { protect: true },
        // The generic pattern only catches "evade all attacks"; these say
        // "protects itself" and so shielded nothing.
        "kings-shield": { protect: true },
        "spiky-shield": { protect: true },
        "quick-guard": { protect: true },
        "crafty-guard": { protect: true },
        "mat-block": { protect: true },
        obstruct: {
            protect: true,
            statChanges: [{ stat: "defense", stages: -2, target: "target", chance: 100 }],
        },
        "silk-trap": {
            protect: true,
            statChanges: [{ stat: "speed", stages: -1, target: "target", chance: 100 }],
        },
        // "Absorbs over half the damage" is the 75% tier, not the usual half.
        "drain-kiss": { drainRatio: 0.75 },

        // --- self-applied volatiles -----------------------------------------
        // Two crit stages, which the ladder below turns into a 25% rate.
        "focus-energy": { critStages: 2 },
        endure: { endure: true },
        // Roots and rings top up a sixteenth each turn; roots also hold on.
        ingrain: { rootHeal: "ingrain" },
        "aqua-ring": { rootHeal: "aquaRing" },

        // --- the Stockpile trio ----------------------------------------------
        // Spit Up's stored power is listed as 1 in the data, so its real
        // power (100 per charge) is computed at use time.
        stockpile: { stockpile: true },
        swallow: { stockpileSpend: "heal" },
        "spit-up": { stockpileSpend: "power", stockpilePower: true },
        // Drains by the foe's Attack stat rather than by damage dealt.
        "strength-sap": { strengthSap: true },
        // A damaging move that also plants a seed.
        "sappy-seed": { seed: true },

        // --- ally and party healing -------------------------------------------
        "life-dew": { allyHeal: { ratio: 0.25 } },
        "jungle-healing": { allyHeal: { ratio: 0.25, cureStatus: true } },
        "lunar-blessing": { allyHeal: { ratio: 0.25, cureStatus: true } },
        finale: { allyHeal: { ratio: 0.25 } },
        purify: { purify: 0.5 },
        "revival-blessing": { partyRevive: 0.5 },

        // --- stat swaps --------------------------------------------------------
        // Stage swaps move the arrows around; the raw-stat ones are kept in
        // volatile state so they clear on switch-out instead of permanently
        // rewriting a party member's stats.
        "guard-swap": { swapStages: ["defense", "specialDefense"] },
        "power-swap": { swapStages: ["attack", "specialAttack"] },
        "heart-swap": { swapStages: STAT_KEYS },
        "speed-swap": { swapStats: ["speed"] },
        "power-split": { splitStats: ["attack", "specialAttack"] },
        "guard-split": { splitStats: ["defense", "specialDefense"] },
        "wonder-room": { fieldEffect: { key: "wonderRoom", turns: 5 } },

        // --- moves that roll among several conditions ---------------------------
        "dire-claw": { statusChoices: ["poison", "paralysis", "sleep"] },
        befuddle: { statusChoices: ["paralysis", "sleep", "poison"] },

        // --- stat-stage manipulation -------------------------------------------
        haze: { clearAllStages: true },
        "belly-drum": { bellyDrum: true },
        "psych-up": { copyStages: true },
        "topsy-turvy": { invertStages: true },
        acupressure: { randomBoost: 2 },
        "power-trick": { swapOwnStats: ["attack", "defense"] },

        // --- status cures -------------------------------------------------------
        refresh: { cureSelf: true },
        "heal-bell": { cureParty: true },
        aromatherapy: { cureParty: true },
        "psycho-shift": { shiftStatus: true },

        // --- the decoy ----------------------------------------------------------
        substitute: { substitute: 0.25 },

        // --- doubles support ----------------------------------------------------
        // The game is fought two-on-two, so these carry more weight here than
        // they do in the originals.
        "helping-hand": { helpingHand: 1.5 },
        "follow-me": { redirect: true },
        "rage-powder": { redirect: true },
        spotlight: { redirect: true, targetMode: "selected-opponent" },
        // After You helps a partner along; Quash holds a foe back.
        "after-you": { turnOrder: "first", turnOrderTarget: "ally" },
        quash: { turnOrder: "last" },
        "trick-room": { fieldEffect: { key: "trickRoom", turns: 5 } },
        "magic-room": { fieldEffect: { key: "magicRoom", turns: 5 } },
        gravity: { fieldEffect: { key: "gravity", turns: 5 } },

        // --- forced switching and escape blocking -------------------------------
        roar: { forceSwitch: true },
        whirlwind: { forceSwitch: true },
        "dragon-tail": { forceSwitch: true },
        "circle-throw": { forceSwitch: true },
        teleport: { selfSwitch: true },
        "baton-pass": { selfSwitch: true, passStages: true },
        "shed-tail": { substitute: 0.5, selfSwitch: true, passStages: true },
        "u-turn": { selfSwitch: true },
        "volt-switch": { selfSwitch: true },
        "flip-turn": { selfSwitch: true },
        "mean-look": { blockEscape: true },
        block: { blockEscape: true },
        "spider-web": { blockEscape: true },
        "fairy-lock": { blockEscape: true },

        // --- lingering volatiles -------------------------------------------------
        nightmare: { nightmare: true },
        curse: { curse: true },
        charge: { chargeUp: true },
        "magnet-rise": { airborne: 5 },
        telekinesis: { airborne: 3, targetsFoe: true },
        "heal-block": { healBlock: 5 },
        imprison: { imprison: true },
        embargo: { embargo: 5 },
        "lucky-chant": { luckyChant: 5 },
        "magic-coat": { magicCoat: true },
        snatch: { snatching: true },
        powder: { powder: true },
        "court-change": { courtChange: true },
        // Max Guard's text says "evade all attacks", which the generic pattern
        // just misses on the singular verb.
        guard: { protect: true },

        // --- item manipulation ---------------------------------------------------
        trick: { swapItems: true },
        switcheroo: { swapItems: true },
        bestow: { giveItem: true },
        recycle: { recycleItem: true },
        "corrosive-gas": { destroyItem: true },
        "knock-off": { destroyItem: true },
        teatime: { teatime: true },

        // --- ability manipulation ------------------------------------------------
        "role-play": { copyAbility: true },
        "skill-swap": { swapAbility: true },
        "gastro-acid": { suppressAbility: true },
        "worry-seed": { setAbility: "insomnia" },
        "simple-beam": { setAbility: "simple" },
        entrainment: { shareAbility: true },

        // --- accuracy and critical setup -----------------------------------------
        "lock-on": { lockOn: true },
        "mind-reader": { lockOn: true },
        foresight: { identify: ["ghost"] },
        "odor-sleuth": { identify: ["ghost"] },
        "miracle-eye": { identify: ["dark"] },
        "laser-focus": { laserFocus: true },

        // Both read "allows the user to strike first, if the foe is readying an
        // attack". Nothing enforced the condition, so they were plain priority
        // moves that always landed.
        "sucker-punch": { requiresTargetAttacking: true },
        "thunderclap": { requiresTargetAttacking: true },

        // --- delayed damage --------------------------------------------------------
        // Three, because the counter also ticks on the turn the move is used,
        // which lands the hit at the end of the second turn after it.
        "future-sight": { delayed: { power: 120, type: "psychic", turns: 3 } },
        "doom-desire": { delayed: { power: 140, type: "steel", turns: 3 } },

        // Heal Pulse tops up whoever it is aimed at, not the user, so the
        // self-heal the description implies has to be switched off.
        "heal-pulse": { healTarget: 0.5, healRatio: 0 },

        // --- calling and copying other moves -------------------------------------
        metronome: { callsMove: "random" },
        "mirror-move": { callsMove: "target-last" },
        copycat: { callsMove: "any-last" },
        "sleep-talk": { callsMove: "own-random" },
        assist: { callsMove: "party-random" },
        "nature-power": { callsMove: "random" },
        "me-first": { callsMove: "target-best" },
        instruct: { instruct: true },
        mimic: { copyMove: true },
        sketch: { copyMove: true },
        transform: { transform: true },

        // --- type changing -------------------------------------------------------
        soak: { setType: ["water"] },
        "magic-powder": { setType: ["psychic"] },
        "forests-curse": { addType: "grass" },
        "trick-or-treat": { addType: "ghost" },
        // Retyping the target's next move, and every Normal move on the field.
        electrify: { retypeTargetMove: "electric" },
        "ion-deluge": { fieldEffect: { key: "ionDeluge", turns: 1 } },
        grudge: { grudge: true },
        "reflect-type": { copyType: true },
        "conversion-2": { resistLastMove: true },
        camouflage: { terrainType: true },
        // Both need the target to be the opposite gender; genderless is immune.
        attract: { requiresOppositeGender: true, infatuate: true },
        captivate: {
            requiresOppositeGender: true,
            statChanges: [{ stat: "specialAttack", stages: -2, target: "target", chance: 100 }],
        },
        growl: { statChanges: [{ stat: "attack", stages: -1, target: "target", chance: 100 }] },
        "tail-whip": { statChanges: [{ stat: "defense", stages: -1, target: "target", chance: 100 }] },
        leer: { statChanges: [{ stat: "defense", stages: -1, target: "target", chance: 100 }] },
        "string-shot": { statChanges: [{ stat: "speed", stages: -2, target: "target", chance: 100 }] },
        "feather-dance": { statChanges: [{ stat: "attack", stages: -2, target: "target", chance: 100 }] },
        "baby-doll-eyes": { statChanges: [{ stat: "attack", stages: -1, target: "target", chance: 100 }] },
        charm: { statChanges: [{ stat: "attack", stages: -2, target: "target", chance: 100 }] },
        screech: { statChanges: [{ stat: "defense", stages: -2, target: "target", chance: 100 }] },
        "metal-sound": { statChanges: [{ stat: "specialDefense", stages: -2, target: "target", chance: 100 }] },
        "scary-face": { statChanges: [{ stat: "speed", stages: -2, target: "target", chance: 100 }] },
        "cotton-spore": { statChanges: [{ stat: "speed", stages: -2, target: "target", chance: 100 }] },
        "sweet-scent": { statChanges: [{ stat: "evasion", stages: -2, target: "target", chance: 100 }] },
        "sand-attack": { statChanges: [{ stat: "accuracy", stages: -1, target: "target", chance: 100 }] },
        smokescreen: { statChanges: [{ stat: "accuracy", stages: -1, target: "target", chance: 100 }] },
        flash: { statChanges: [{ stat: "accuracy", stages: -1, target: "target", chance: 100 }] },
        harden: { statChanges: [{ stat: "defense", stages: 1, target: "self", chance: 100 }] },
        withdraw: { statChanges: [{ stat: "defense", stages: 1, target: "self", chance: 100 }] },
        "defense-curl": { statChanges: [{ stat: "defense", stages: 1, target: "self", chance: 100 }] },
        "swords-dance": { statChanges: [{ stat: "attack", stages: 2, target: "self", chance: 100 }] },
        "iron-defense": { statChanges: [{ stat: "defense", stages: 2, target: "self", chance: 100 }] },
        agility: { statChanges: [{ stat: "speed", stages: 2, target: "self", chance: 100 }] },
        "rock-polish": { statChanges: [{ stat: "speed", stages: 2, target: "self", chance: 100 }] },
        "nasty-plot": { statChanges: [{ stat: "specialAttack", stages: 2, target: "self", chance: 100 }] },
        // The text says "sharply" (two stages); the move is really three.
        "tail-glow": { statChanges: [{ stat: "specialAttack", stages: 3, target: "self", chance: 100 }] },
        amnesia: { statChanges: [{ stat: "specialDefense", stages: 2, target: "self", chance: 100 }] },
        growth: { statChanges: [{ stat: "attack", stages: 1, target: "self", chance: 100 }, { stat: "specialAttack", stages: 1, target: "self", chance: 100 }] },
        "calm-mind": { statChanges: [{ stat: "specialAttack", stages: 1, target: "self", chance: 100 }, { stat: "specialDefense", stages: 1, target: "self", chance: 100 }] },
        "bulk-up": { statChanges: [{ stat: "attack", stages: 1, target: "self", chance: 100 }, { stat: "defense", stages: 1, target: "self", chance: 100 }] },
        "dragon-dance": { statChanges: [{ stat: "attack", stages: 1, target: "self", chance: 100 }, { stat: "speed", stages: 1, target: "self", chance: 100 }] },
        "quiver-dance": { statChanges: [{ stat: "specialAttack", stages: 1, target: "self", chance: 100 }, { stat: "specialDefense", stages: 1, target: "self", chance: 100 }, { stat: "speed", stages: 1, target: "self", chance: 100 }] },
    };

    const TYPE_CHART = {
        normal: { rock: 0.5, ghost: 0, steel: 0.5 },
        fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
        water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
        electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
        grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
        ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
        fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
        poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
        ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
        flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
        psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
        bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
        rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
        ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
        dragon: { dragon: 2, steel: 0.5, fairy: 0 },
        dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
        steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
        fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

    // Priority arrives from the ROM as an unsigned byte, so the negative half
    // of the scale wraps: Dragon Tail's -6 reads as 250. Left raw, the fifteen
    // moves that are meant to go last went first instead -- Dragon Tail
    // outrunning Fake Out, and Counter, Mirror Coat and Focus Punch striking
    // before the hit they are supposed to answer. The games only go up to +5,
    // so anything above that is a wrapped negative.
    const signedPriority = (value) => {
        const raw = numberOr(value, 0);
        return raw > 127 ? raw - 256 : raw;
    };
    const isBattleReady = (pokemon) => Boolean(pokemon) && numberOr(pokemon.hp, 0) > 0;

    // The ability registry lives in its own module. Looked up lazily so this
    // file keeps working (with abilities simply off) if that script is absent,
    // e.g. in isolated tests.
    const abilityRegistry = () => (typeof globalThis !== "undefined" ? globalThis : window).PokemonBattleAbilities || null;
    // Gastro Acid switches an ability off without replacing it.
    const abilityOf = (pokemon) => {
        if (pokemon?.volatileStatus?.abilitySuppressed) return null;
        return abilityRegistry()?.getAbility(pokemon?.ability?.slug) || null;
    };

    // Soak, Skill Swap and Trick rewrite a Pokemon's types, ability or held
    // item for the duration of a duel. Each stashes the original first, and
    // anything that wipes volatile state puts them back -- otherwise a party
    // member would carry a stolen item or a borrowed ability into the next
    // fight, and the run's inventory bookkeeping would drift.
    const rememberOriginal = (pokemon, key, value) => {
        if (!pokemon?.volatileStatus) return;
        if (pokemon.volatileStatus[key] === undefined) pokemon.volatileStatus[key] = value;
    };
    const restoreBattleMutations = (pokemon) => {
        const volatiles = pokemon?.volatileStatus;
        if (!volatiles) return;
        if (volatiles.originalTypes) pokemon.types = [...volatiles.originalTypes];
        if (volatiles.originalAbility !== undefined) pokemon.ability = volatiles.originalAbility;
        if (volatiles.originalItem !== undefined) {
            pokemon.heldItemKey = volatiles.originalItem;
            pokemon.heldItemSpent = false;
        }
        if (volatiles.originalMoves) pokemon.moves = volatiles.originalMoves.map((entry) => ({ ...entry }));
        if (volatiles.originalStats) pokemon.stats = { ...volatiles.originalStats };
        if (volatiles.originalIdentity) {
            pokemon.name = volatiles.originalIdentity.name;
            pokemon.key = volatiles.originalIdentity.key;
            pokemon.id = volatiles.originalIdentity.id;
            pokemon.sprites = volatiles.originalIdentity.sprites;
        }
    };

    // Multi-turn move table, looked up the same lazy way.
    const multiTurnRegistry = () => (typeof globalThis !== "undefined" ? globalThis : window).PokemonMultiTurnMoves || null;
    const multiTurnOf = (move) => multiTurnRegistry()?.getMultiTurn(move?.slug) || null;

    // Weather / hazards / screens.
    const fieldRegistry = () => (typeof globalThis !== "undefined" ? globalThis : window).PokemonBattleField || null;

    // Held items. A spent single-use item stops applying until the duel ends.
    const heldItemRegistry = () => (typeof globalThis !== "undefined" ? globalThis : window).PokemonHeldItems || null;
    const heldItemOf = (pokemon) => {
        if (!pokemon?.heldItemKey || pokemon.heldItemSpent) return null;
        // Magic Room and Embargo switch items off without removing them; the
        // engine stamps the flag on each active Pokemon every turn.
        if (pokemon.volatileStatus?.itemsSuppressed) return null;
        return heldItemRegistry()?.getItem(pokemon.heldItemKey) || null;
    };

    // Stat names as the move text writes them. The two special stats are read
    // first and their spans are subtracted from the physical matches, so a
    // move naming both keeps both.
    //
    // `needsCapital` separates the stat from the ordinary English word: the
    // text capitalises stat names ("lowers the foe's Attack") and leaves the
    // noun lowercase ("An intense attack that..."), so only a capitalised
    // hit -- or one followed by the word "stat" -- counts.
    const STAT_WORDS = [
        { stat: "specialAttack", re: /sp\.? ?atk\.?|special attack/gi, needsCapital: false },
        { stat: "specialDefense", re: /sp\.? ?def\.?|special defense/gi, needsCapital: false },
        { stat: "attack", re: /\battack\b/gi, needsCapital: true },
        { stat: "defense", re: /\bdefen[cs]e\b/gi, needsCapital: true },
        { stat: "speed", re: /\bspeed\b/gi, needsCapital: true },
        { stat: "accuracy", re: /\baccuracy\b/gi, needsCapital: false },
        { stat: "evasion", re: /\bevasiveness|\bevasion/gi, needsCapital: false },
    ];
    const ALL_STATS = ["attack", "defense", "specialAttack", "specialDefense", "speed"];
    const ALL_STATS_PHRASE = /\ball (?:of )?(?:the user'?s |its )?stats\b/gi;
    const RAISE_VERB = /\b(?:raises?|raised|raising|rises?|rising|boosts?|boosted|boosting|increases?|increased|increasing|ups?|heightens?|sharpens?)\b/gi;
    const LOWER_VERB = /\b(?:lower'?s?|lowered|lowering|reduces?|reduced|reducing|cuts?|cutting|drops?|dropped|falls?|decreases?|decreased)\b/gi;
    const MAGNITUDE_WORD = /\b(?:drastically|severely|sharply|harshly|greatly)\b/gi;
    const SELF_MARKER = /\b(?:the user'?s?|user'?s|ally|allies|party)\b/gi;
    const FOE_MARKER = /\b(?:foes?'?|targets?'?|opponents?'?|opposing)\b/gi;
    // "its" takes its meaning from whoever the sentence last named: "the user
    // ... raising its Attack" is the user, but "the foe ... reducing its
    // Attack" is the foe. Reading it as the user regardless made Tickle
    // debuff its own side.
    const PRONOUN_MARKER = /\b(?:itself|its own|its)\b/gi;

    // Read every stat change a description promises, keeping each one's own
    // direction, size and recipient.
    //
    // The previous version derived a single direction, magnitude and target
    // for the whole sentence, which broke three ways at once: any text
    // mentioning "the user" sent *all* changes to the user (27 moves debuffed
    // their own side -- Bug Buzz lowered its own Sp. Def), a move that both
    // raised and lowered got one direction for both halves (Shell Smash
    // lowered the three stats it should raise), and one "sharply" applied to
    // every stat in the list (Shift Gear raised Attack by two).
    //
    // Instead: each verb opens a segment that runs to the next verb, and a
    // stat is governed by the segment it falls in.
    function inferStatChanges(description, secondaryChance, power) {
        const raw = String(description || "");
        if (!raw) return [];

        const collect = (re) => {
            const out = [];
            re.lastIndex = 0;
            let match = re.exec(raw);
            while (match) {
                out.push({ index: match.index, end: match.index + match[0].length, text: match[0] });
                match = re.exec(raw);
            }
            return out;
        };

        const verbs = [
            ...collect(RAISE_VERB).map((hit) => ({ ...hit, dir: 1 })),
            ...collect(LOWER_VERB).map((hit) => ({ ...hit, dir: -1 })),
        ].sort((a, b) => a.index - b.index);
        if (!verbs.length) return [];

        // Each "sharply" belongs to whichever verb it sits closest to, so
        // "raises its Attack and sharply raises its Speed" gives one stage
        // and two rather than two and two.
        const magnitudeByVerb = new Map();
        collect(MAGNITUDE_WORD).forEach((adverb) => {
            let best = null;
            verbs.forEach((verb) => {
                const distance = adverb.index < verb.index
                    ? verb.index - adverb.end
                    : adverb.index - verb.end;
                if (!best || distance < best.distance) best = { verb, distance };
            });
            if (!best || best.distance > 30) return;
            magnitudeByVerb.set(best.verb.index, /drastically|severely/i.test(adverb.text) ? 3 : 2);
        });
        const named = [
            ...collect(SELF_MARKER).map((hit) => ({ ...hit, side: "self" })),
            ...collect(FOE_MARKER).map((hit) => ({ ...hit, side: "target" })),
        ].sort((a, b) => a.index - b.index);
        const markers = [
            ...named,
            ...collect(PRONOUN_MARKER).map((hit) => {
                let side = "self";
                named.forEach((marker) => { if (marker.index < hit.index) side = marker.side; });
                return { ...hit, side };
            }),
        ].sort((a, b) => a.index - b.index);

        const hits = [];
        const claimed = [];
        collect(ALL_STATS_PHRASE).forEach((hit) => {
            claimed.push(hit);
            ALL_STATS.forEach((stat) => hits.push({ ...hit, stat }));
        });
        STAT_WORDS.forEach(({ stat, re, needsCapital }) => {
            collect(re).forEach((hit) => {
                if (claimed.some((span) => hit.index < span.end && hit.end > span.index)) return;
                if (needsCapital && !/^[A-Z]/.test(hit.text) && !/^\s*stats?\b/.test(raw.slice(hit.end))) return;
                claimed.push(hit);
                hits.push({ ...hit, stat });
            });
        });
        if (!hits.length) return [];

        // A move that both raises and lowers without ever naming a foe is
        // paying its own cost (Shell Smash, Scale Shot, Fillet Away), so the
        // drop lands on the user rather than the default opponent.
        const namesFoe = markers.some((marker) => marker.side === "target");
        const selfCost = !namesFoe && verbs.some((v) => v.dir > 0) && verbs.some((v) => v.dir < 0);
        const chance = secondaryChance > 0 ? secondaryChance : 100;
        const changes = [];
        const seen = new Set();

        hits.sort((a, b) => a.index - b.index).forEach((hit) => {
            let verbIndex = -1;
            verbs.forEach((verb, i) => { if (verb.index < hit.index) verbIndex = i; });
            // Some text puts the stats before the verb ("Sp. Atk ... rise
            // sharply"); those belong to the first verb.
            const verb = verbs[verbIndex >= 0 ? verbIndex : 0];
            const magnitude = magnitudeByVerb.get(verb.index) || 1;
            // The recipient is usually named before the stat ("lowers the
            // foe's Speed") but sometimes after the whole list ("lowers
            // Attack, Sp. Atk, and Speed of poisoned foes"), so read the rest
            // of this segment before falling back to whoever the sentence
            // named earlier. Comparing against the end of the match lets a
            // marker inside the phrase count, as in "all the user's stats".
            const segmentEnd = verbs.find((v) => v.index > verb.index)?.index ?? raw.length;
            let side = null;
            markers.forEach((marker) => {
                if (marker.index >= verb.index && marker.index < hit.end) side = marker.side;
            });
            if (!side) side = markers.find((marker) => marker.index >= hit.end && marker.index < segmentEnd)?.side || null;
            // An earlier sentence's "user" on a damaging move is the
            // attack's subject, not the drop's recipient -- Bulldoze's "The
            // user hits all Pokemon... Lowers Speed of those hit." Foe
            // markers (and status-move phrasing) still carry across.
            if (!side) {
                const sentenceStart = raw.lastIndexOf(".", verb.index) + 1;
                markers.forEach((marker) => {
                    if (marker.index >= hit.end) return;
                    if (marker.side === "self" && marker.index < sentenceStart && numberOr(power, 0) > 0) return;
                    side = marker.side;
                });
            }
            if (!side) side = (verb.dir < 0 && !selfCost && numberOr(power, 0) > 0) ? "target" : "self";
            if (verb.dir < 0 && selfCost) side = "self";

            const key = `${hit.stat}:${side}`;
            if (seen.has(key)) return;
            seen.add(key);
            changes.push({ stat: hit.stat, stages: verb.dir * magnitude, target: side, chance });
        });
        return changes;
    }

    // How the games announce each condition landing.
    const STATUS_APPLIED_TEXT = {
        sleep: "fell asleep",
        burn: "was burned",
        poison: "was poisoned",
        toxic: "was badly poisoned",
        freeze: "was frozen solid",
        paralysis: "was paralyzed! It may be unable to move",
    };

    // Phrasings that actually put a target to sleep, and the ones that only
    // talk about sleep without causing it.
    const SLEEP_CAUSE = /(?:induces?|inducing)\s+sleep|sleep-inducing|fall(?:s|ing)?\s+into\s+a\s+deep\s+sleep|lull(?:s|ed)?[^.]*\b(?:asleep|sleep|slumber)|make(?:s)?\s+(?:them|it|the\s+foe)\s+sleep|cause\s+sleep|put[^.]*\bto\s+sleep/;
    const SLEEP_REFERENCE = /while\s+asleep|sleeping\s+foe|wake(?:s)?[- ]up|wakes\s+the|user\s+sleeps|prevents\s+sleep|eluding\s+sleep|nightmare|can't\s+fall\s+asleep/;

    function inferStatusEffect(description, power, secondaryChance) {
        const text = String(description || "").toLowerCase();
        if (/cure|heal.*status|status conditions/.test(text)) return null;
        let condition = null;
        if (/paraly[sz]/.test(text)) condition = "paralysis";
        else if (/badly poison|toxic poison/.test(text)) condition = "toxic";
        else if (/\bpoison/.test(text)) condition = "poison";
        else if (/\bburn/.test(text)) condition = "burn";
        // Radical Red renames freeze to frostbite on several moves.
        else if (/freez|frozen|frostbite/.test(text)) condition = "freeze";
        // The old pattern only caught three phrasings and so missed Hypnosis,
        // Spore, Sleep Powder, Sing, Grass Whistle, Dark Void, Dark Hole and
        // Relic Song -- every one of them did nothing at all. The second test
        // keeps out moves that merely *mention* sleep (Dream Eater, Snore,
        // Sleep Talk, Wake-Up Slap, Nightmare, Rest).
        else if (SLEEP_CAUSE.test(text) && !SLEEP_REFERENCE.test(text)) condition = "sleep";
        if (!condition) return null;
        return { condition, chance: power <= 0 ? 100 : (secondaryChance || 10) };
    }

    function inferMoveRules(move) {
        const slug = String(move.slug || move.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const description = String(move.description || "");
        const text = description.toLowerCase();
        const power = Math.max(0, numberOr(move.power, 0));
        const secondaryChance = clamp(numberOr(move.secondaryEffectChance, 0), 0, 100);
        const targetCode = numberOr(move.target, 0);
        const explicit = EXPLICIT_MOVE_RULES[slug] || {};
        const flinchChance = explicit.flinchChance || (/flinch/.test(text) ? (secondaryChance || (power <= 0 ? 100 : 30)) : 0);
        const confusionChance = /confus/.test(text) && !/cure/.test(text) ? (secondaryChance || (power <= 0 ? 100 : 10)) : 0;
        // Radical Red's move text never uses the word "recoil" -- it phrases
        // it as "hurts the user" / "hurting itself". "Terribly" marks the
        // half-HP tier (Head Smash); everything else is the standard third.
        const recoilRatio = /recoil|hurts? the user|hurting itself|damages the user/.test(text)
            ? (/half|terribly/.test(text) ? 0.5 : /quarter|one-fourth/.test(text) ? 0.25 : 1 / 3)
            : 0;
        // The old pattern wanted "restores half" as one phrase, but the text
        // writes "restores HP by up to half of the user's maximum HP" -- so
        // Recover, Roost, Slack Off, Soft-Boiled, Milk Drink, Heal Order,
        // Heal Pulse and Shore Up all restored nothing. Match the healing
        // verb and the fraction separately instead.
        const healRatio = /fully restores?.*hp|restores?.*hp.*fully|fully restore hp/.test(text)
            ? 1
            : /(?:restore|recover|heal|regain)[a-z]*\b[^.]{0,40}\bhalf\b/.test(text) ? 0.5 : 0;
        // "can't be used twice in a row" is a restriction, not a multi-hit --
        // matching "twice" naively turns Gigaton Hammer and Blood Moon into
        // two-hit moves, so those phrasings are excluded first.
        const usageRestriction = /can(?:'|no)?t be used twice/.test(text);
        const multiHit = usageRestriction ? null
            : /(?:2 to 5|two to five)/.test(text) ? { min: 2, max: 5 }
                : /(?:3-kick|three times|3 times)/.test(text) ? { min: 3, max: 3 }
                    : /twice|two times|two brutal|once,? then once again/.test(text) ? { min: 2, max: 2 }
                        : null;
        const ohko = /faint(?:s|ing)? if it hits/.test(text);
        const highCritRatio = /high critical-hit ratio|high crit ratio|critical hits? lands? more easily/.test(text);
        return {
            slug,
            targetCode,
            targetMode: targetCode === TARGET_SELF ? "self" : targetCode === TARGET_ALL_OPPONENTS ? "all-opponents" : targetCode === TARGET_FOES_AND_ALLY ? "adjacent-all" : "selected-opponent",
            firstTurnOnly: /usable only on (?:the )?(?:1st|first) turn|only works the first turn/.test(text),
            nonLethal: /at least 1 hp/.test(text),
            // "If the user faints..." is a *condition*, not an effect --
            // Destiny Bond and Grudge were killing their own user on use
            // because they matched the same phrase Memento does.
            selfFaint: !/^if the user faints/.test(text.trim())
                && /user faints|causes the user to faint|user explodes/.test(text),
            protect: /protects? (?:the user|itself).*attacks|evades all attacks/.test(text),
            drainRatio: /absorbs half the damage|drains half the damage/.test(text) ? 0.5 : 0,
            multiHit,
            ohko,
            highCritRatio,
            flinchChance,
            confusionChance,
            recoilRatio,
            healRatio,
            statChanges: explicit.statChanges || inferStatChanges(description, secondaryChance, power),
            statusEffect: inferStatusEffect(description, power, secondaryChance),
            ...explicit,
            slug,
            targetCode,
            targetMode: explicit.targetMode || (targetCode === TARGET_SELF ? "self" : targetCode === TARGET_ALL_OPPONENTS ? "all-opponents" : targetCode === TARGET_FOES_AND_ALLY ? "adjacent-all" : "selected-opponent"),
        };
    }

    // The extraction has no "makes contact" flag, so approximate: physical
    // moves touch the target unless they're clearly thrown, dropped, or
    // seismic. Drives Static, Rough Skin, Tough Claws, Poison Touch, etc.
    const NON_CONTACT_PHYSICAL = new Set([
        "earthquake", "magnitude", "bulldoze", "fissure", "rock-slide",
        "rock-throw", "stone-edge", "rock-blast", "rock-tomb", "sand-tomb",
        "self-destruct", "explosion", "egg-bomb", "barrage", "spike-cannon",
        "pin-missile", "bonemerang", "bone-club", "bone-rush", "razor-leaf",
        "seed-bomb", "gunk-shot", "sludge-bomb", "icicle-spear", "icicle-crash",
        "poison-sting", "twineedle", "fling", "sky-attack", "smack-down",
        "stealth-rock", "rock-wrecker", "draco-meteor", "attack-order",
        "scale-shot", "dragon-darts", "metal-burst", "psycho-cut",
        "air-slash", "razor-wind", "aura-sphere", "water-shuriken",
    ]);

    function normalizeMove(rawMove) {
        const move = rawMove || {};
        const damageClass = String(move.damage_class || move.split || "physical").toLowerCase();
        const rules = inferMoveRules(move);
        return {
            id: numberOr(move.ID, FALLBACK_MOVE_ID),
            name: move.name || "tackle",
            displayName: move.display_name || move.name || "Tackle",
            type: String(move.type_name || move.type || "normal").toLowerCase(),
            power: Math.max(0, numberOr(move.power, 0)),
            // Accuracy 0 in the data means "never misses" (Swift, Aerial
            // Ace...). The old `|| 100` laundered that 0 into a plain 100
            // that evasion stages could beat, leaving moveAccuracy's
            // always-hit branch dead.
            accuracy: numberOr(move.accuracy, 100) <= 0 ? 0 : clamp(numberOr(move.accuracy, 100), 1, 100),
            priority: signedPriority(move.priority),
            damageClass,
            maxPp: Math.max(1, numberOr(move.pp, 10)),
            pp: Math.max(1, numberOr(move.pp, 10)),
            description: move.description || "",
            slug: rules.slug,
            targetCode: rules.targetCode,
            targetMode: rules.targetMode,
            makesContact: damageClass.includes("physical")
                && Math.max(0, numberOr(move.power, 0)) > 0
                && !NON_CONTACT_PHYSICAL.has(rules.slug),
            effects: rules,
        };
    }

    function learnedMoves(species, movesById, level) {
        const learned = [];
        const seenIds = new Set();
        const seenNames = new Set();
        const sources = [
            ...(species.learnset?.level_up || []).filter((entry) => numberOr(entry.level, 0) <= level).reverse(),
        ];

        for (const entry of sources) {
            const moveId = String(entry.move_id);
            const rawMove = movesById[String(entry.move_id)] || movesById[entry.move_id];
            if (!rawMove || seenIds.has(moveId)) continue;
            const move = normalizeMove(rawMove);
            const moveName = String(move.name || move.displayName).toLowerCase();
            if (seenNames.has(moveName)) continue;
            learned.push(move);
            seenIds.add(moveId);
            seenNames.add(moveName);
        }

        const fallback = normalizeMove(movesById[String(FALLBACK_MOVE_ID)] || movesById[FALLBACK_MOVE_ID] || {
            ID: FALLBACK_MOVE_ID,
            name: "tackle",
            display_name: "Tackle",
            type_name: "normal",
            power: 40,
            accuracy: 100,
            pp: 35,
            damage_class: "physical",
        });
        // Low-level Pokemon often know fewer than four damaging moves. Empty move
        // slots should stay empty instead of becoming duplicate copies of Tackle.
        if (!learned.length) learned.push(fallback);
        return learned;
    }

    function chooseMoves(species, movesById, level) {
        return learnedMoves(species, movesById, level).slice(0, 4);
    }

    function calculateStat(base, level, isHp) {
        const value = Math.max(1, numberOr(base, 1));
        if (isHp) return Math.floor(((2 * value + 31 + 63) * level) / 100) + level + 10;
        return Math.floor((Math.floor(((2 * value + 31 + 63) * level) / 100) + 5));
    }

    // Primary/secondary are an even split; a hidden ability, when the species
    // has one, turns up 10% of the time.
    function rollAbility(species, rng) {
        const slots = Array.isArray(species?.abilities) ? species.abilities : [];
        const pick = (slotName) => slots.find((entry) => entry.slot === slotName && entry.ability);
        const roll = typeof rng === "function" ? rng() : Math.random();
        const hidden = pick("hidden");
        if (hidden && roll < 0.1) return { slug: hidden.ability, name: hidden.display_name || hidden.ability };
        const regular = [pick("primary"), pick("secondary")].filter(Boolean);
        if (!regular.length) return null;
        const chosen = regular[Math.floor((typeof rng === "function" ? rng() : Math.random()) * regular.length)] || regular[0];
        return { slug: chosen.ability, name: chosen.display_name || chosen.ability };
    }

    // PokeAPI's convention, merged onto species records at load time:
    // -1 genderless, otherwise eighths female (0 always male, 8 always female).
    function rollGender(species, rng) {
        const rate = species?.gender_rate;
        if (!Number.isFinite(rate) || rate < 0) return "genderless";
        if (rate === 0) return "male";
        if (rate >= 8) return "female";
        const roll = typeof rng === "function" ? rng() : Math.random();
        return roll < rate / 8 ? "female" : "male";
    }

    function createCombatant(species, movesById, options) {
        if (!species) throw new Error("A species record is required.");
        const config = options || {};
        const level = numberOr(config.level, LEVEL);
        const base = species.base_stats || {};
        const maxHp = calculateStat(base.hp, level, true);
        const movePool = learnedMoves(species, movesById, level);
        return {
            id: species.id,
            key: species.key,
            name: species.display_name || species.name,
            level,
            gender: config.gender || rollGender(species, config.rng),
            ability: config.ability || rollAbility(species, config.rng),
            types: (species.types || []).map((entry) => String(entry.type || entry.type_name || "normal").toLowerCase()),
            maxHp,
            hp: maxHp,
            fainted: false,
            stats: {
                attack: calculateStat(base.attack, level, false),
                defense: calculateStat(base.defense, level, false),
                specialAttack: calculateStat(base.special_attack, level, false),
                specialDefense: calculateStat(base.special_defense, level, false),
                speed: calculateStat(base.speed, level, false),
            },
            statStages: Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0])),
            statusCondition: null,
            statusTurns: 0,
            volatileStatus: {},
            // Set while a move spans more than one turn (charging, locked
            // into a rampage, storing energy). Null means free to act.
            pendingMove: null,
            // Index of the last move genuinely attempted, for Disable,
            // Encore and Torment. Null until this Pokemon actually moves.
            lastMoveIndex: null,
            // Eviolite only helps something with a real evolution left. Mega
            // Evolution is stored in the same evolves_to list, and it is not
            // an evolution for this purpose -- a Mega entry is recognisable
            // because it targets the species' own name (Snorlax -> Snorlax)
            // while a true evolution names something else.
            canStillEvolve: (species.evolution?.evolves_to || []).some((entry) => {
                const own = String(species.display_name || species.name || "").toLowerCase();
                return String(entry.target || "").toLowerCase() !== own;
            }),
            heldItemSpent: false,
            turnsActive: 0,
            moves: movePool.slice(0, 4).map((move) => ({ ...move })),
            movePool,
            sprites: {
                front: species.sprites?.front_idle || "",
                back: species.sprites?.back_idle || species.sprites?.front_idle || "",
                // Showdown GIFs animate on both sides; the renderer decodes
                // them into real frame animations at load time.
                animatedGif: Boolean(species.sprites?.animated_gif),
            },
        };
    }

    // "Charizard-Mega-X" -> "Mega Charizard X"; "Venusaur-Mega" -> "Mega Venusaur".
    function megaDisplayName(species) {
        const key = String(species?.key || "");
        const parts = key.split("-");
        const megaAt = parts.findIndex((part) => part.toLowerCase() === "mega");
        if (megaAt < 0) return species?.display_name || species?.name || "";
        const base = parts.slice(0, megaAt).join(" ");
        const suffix = parts.slice(megaAt + 1).join(" ");
        return `Mega ${base}${suffix ? ` ${suffix}` : ""}`.trim();
    }

    function typeEffectiveness(moveType, defenderTypes) {
        const matchups = TYPE_CHART[moveType] || {};
        return defenderTypes.reduce((total, type) => total * (matchups[type] ?? 1), 1);
    }

    // A handful of moves overrule the type chart for one specific defending
    // type. Freeze-Dry is the long-standing example: it is Ice, but hits
    // Water for 2x rather than the 0.5x the chart gives every other Ice move.
    // The override replaces that type's multiplier only -- the rest of the
    // defender's typing still runs through the normal chart, so Freeze-Dry on
    // a Water/Grass Ludicolo is 2x from the override and 2x from Grass.
    const MOVE_TYPE_CHART_OVERRIDES = {
        "freeze-dry": { water: 2 },
    };

    // Effectiveness for an actual move, honouring those overrides. moveType is
    // passed separately because abilities such as Normalize and Liquid Voice
    // can change it after the fact.
    function moveTypeEffectiveness(moveType, defenderTypes, move) {
        const overrides = MOVE_TYPE_CHART_OVERRIDES[move?.slug];
        if (!overrides) return typeEffectiveness(moveType, defenderTypes);
        const matchups = TYPE_CHART[moveType] || {};
        return defenderTypes.reduce(
            (total, type) => total * (overrides[type] ?? matchups[type] ?? 1),
            1,
        );
    }

    function stageMultiplier(stage) {
        const value = clamp(numberOr(stage, 0), -6, 6);
        return value >= 0 ? (2 + value) / 2 : 2 / (2 - value);
    }

    // Accuracy/evasion use a shallower 3-step curve, not the 2-step curve
    // other stats use.
    function accuracyStageMultiplier(stage) {
        const value = clamp(numberOr(stage, 0), -6, 6);
        return value >= 0 ? (3 + value) / 3 : 3 / (3 - value);
    }

    function modifiedStat(pokemon, stat, options) {
        const ability = abilityOf(pokemon);
        const weather = options?.weather || null;
        const terrain = options?.terrain || null;
        // stageFloor/stageCeil let a critical hit ignore the attacker's
        // negative stages (floor 0) and the defender's positive stages
        // (ceil 0), the way the games do.
        const stage = options?.ignoreStages
            ? 0
            : clamp(numberOr(pokemon.statStages?.[stat], 0),
                numberOr(options?.stageFloor, -6), numberOr(options?.stageCeil, 6));
        // Speed Swap, Power Split and Guard Split rewrite raw stats. Holding
        // the new value in volatile state means it clears on switch-out and
        // when the duel ends, rather than permanently editing the party.
        const raw = numberOr(pokemon.volatileStatus?.statOverride?.[stat], numberOr(pokemon.stats?.[stat], 1));
        let value = raw * stageMultiplier(stage);
        if (stat === "defense" && typeof ability?.defenseMult === "function") {
            value *= ability.defenseMult({ pokemon, weather, terrain: options?.terrain });
        }
        if (stat === "speed" && typeof ability?.speedMult === "function") {
            value *= ability.speedMult(pokemon, { weather, terrain });
        }
        const item = heldItemOf(pokemon);
        if (typeof item?.statMult === "function") {
            value *= item.statMult(stat, { pokemon, canStillEvolve: pokemon.canStillEvolve });
        }
        // Sandstorm hardens Rock Sp.Def; snow hardens Ice Defense.
        const field = fieldRegistry();
        if (field && weather) {
            value *= field.weatherStatMultiplier(weather, pokemon.types, stat);
        }
        if (stat === "specialAttack" && weather === "sun" && ability?.sunSpecialAttackMult) {
            value *= ability.sunSpecialAttackMult;
        }
        if (stat === "attack" && pokemon.statusCondition === "burn" && !ability?.ignoreBurnAttackDrop) {
            return Math.max(1, value * 0.5);
        }
        if (stat === "speed" && pokemon.statusCondition === "paralysis" && !ability?.ignoreParalysisSpeedDrop) {
            return Math.max(1, value * 0.5);
        }
        return Math.max(1, value);
    }

    // OHKO moves (Guillotine, Horn Drill, Sheer Cold...) ignore their own
    // listed accuracy, accuracy/evasion stages, and defense entirely -- they
    // use a level-difference formula instead, and always miss a higher-level
    // target.
    function ohkoAccuracy(actor, target) {
        if (abilityOf(target)?.ohkoImmune) return 0;
        if (target.level > actor.level) return 0;
        return clamp(30 + (actor.level - target.level), 0, 100);
    }

    function moveAccuracy(actor, target, move, weather) {
        const actorAbility = abilityOf(actor);
        const targetAbility = abilityOf(target);
        if (move.effects?.ohko) return ohkoAccuracy(actor, target);
        // No Guard works from either side of the field.
        if (actorAbility?.alwaysHit || targetAbility?.alwaysHit) return 100;
        // Lock-On and Mind Reader guarantee the next hit.
        if (actor.volatileStatus?.lockedOn) return 100;
        // Thunder and Hurricane never miss in rain; Blizzard never misses in
        // snow; the sun makes the first two nearly useless.
        const field = fieldRegistry();
        if (weather && field) {
            const forced = field.weatherAccuracy(weather, move.slug);
            if (forced === 100) return 100;
            if (Number.isFinite(forced)) {
                const evasion = targetAbility?.evasionMultInWeather?.(weather) || 1;
                return clamp(forced / evasion, 1, 100);
            }
        }
        if (numberOr(move.accuracy, 100) <= 0) return 100;
        // Real games combine the attacker's accuracy stage and the target's
        // evasion stage into one net stage before applying the curve, rather
        // than computing two independent ratios and dividing them (which
        // drifts from the real formula, especially near the +-6 clamp).
        // Foresight, Odor Sleuth and Miracle Eye strip the target's evasion.
        const evasionStage = (actorAbility?.ignoreTargetStages || target.volatileStatus?.identified)
            ? 0 : numberOr(target.statStages?.evasion, 0);
        const netStage = clamp(
            numberOr(actor.statStages?.accuracy, 0) - evasionStage,
            -6,
            6,
        );
        let accuracy = numberOr(move.accuracy, 100) * accuracyStageMultiplier(netStage);
        // Sand Veil and friends only help while their weather is up.
        if (weather && typeof targetAbility?.evasionMultInWeather === "function") {
            accuracy /= targetAbility.evasionMultInWeather(weather) || 1;
        }
        if (typeof actorAbility?.accuracyMultAsAttacker === "function") {
            accuracy *= actorAbility.accuracyMultAsAttacker({
                physical: move.damageClass.includes("physical"),
                move,
            });
        }
        if (move.power <= 0 && targetAbility?.statusMoveAccuracyCap) {
            accuracy = Math.min(accuracy, targetAbility.statusMoveAccuracyCap);
        }
        return clamp(accuracy, 1, 100);
    }

    function estimateMoveDamage(actor, target, move) {
        if (!actor || !target || !move || move.pp <= 0 || move.power <= 0) {
            return { min: 0, max: 0, expected: 0, effectiveness: 0, stab: 1 };
        }
        // The AI knows about absorb/immunity abilities, so it stops throwing
        // Thunderbolts at Lightning Rod. Finer damage-mod awareness is
        // deliberately out: real trainers misjudge Thick Fat too.
        const targetAbility = abilityOf(target);
        if (typeof targetAbility?.typeImmunity === "function"
            && targetAbility.typeImmunity({ moveType: move.type, move, attacker: actor, defender: target })?.immune) {
            return { min: 0, max: 0, expected: 0, effectiveness: 0, stab: 1 };
        }
        if (typeof targetAbility?.blockMove === "function" && targetAbility.blockMove({ move })) {
            return { min: 0, max: 0, expected: 0, effectiveness: 0, stab: 1 };
        }
        const effectiveness = moveTypeEffectiveness(move.type, target.types, move);
        const stab = actor.types.includes(move.type) ? 1.5 : 1;
        if (effectiveness === 0) {
            return { min: 0, max: 0, expected: 0, effectiveness, stab };
        }
        if (move.effects?.ohko) {
            // Always "lethal" if it connects -- let the AI's existing
            // guaranteed/possible-KO scoring do the rest.
            const hitChance = ohkoAccuracy(actor, target) / 100;
            return { min: target.hp, max: target.hp, expected: target.hp * hitChance, effectiveness, stab: 1 };
        }
        const physical = move.damageClass.includes("physical");
        const attackStat = modifiedStat(actor, physical ? "attack" : "specialAttack");
        const defenseStat = modifiedStat(target, physical ? "defense" : "specialDefense");
        const baseDamage = (((2 * actor.level / 5 + 2) * move.power * attackStat / Math.max(1, defenseStat)) / 50) + 2;
        const modifiedDamage = baseDamage * stab * effectiveness;
        const min = Math.max(1, Math.floor(modifiedDamage * 0.85));
        const max = Math.max(1, Math.floor(modifiedDamage));
        const hitChance = moveAccuracy(actor, target, move) / 100;
        return {
            min,
            max,
            expected: ((min + max) / 2) * hitChance,
            effectiveness,
            stab,
        };
    }

    function bestThreatDamage(attacker, target) {
        return attacker.moves.reduce((best, move) => {
            if (move.pp <= 0 || move.power <= 0) return best;
            return Math.max(best, estimateMoveDamage(attacker, target, move).max);
        }, 0);
    }

    function statusMoveScore(actor, target, move) {
        const effects = move.effects || {};
        let score = 82;
        const reasons = [];
        let useful = false;
        for (const change of effects.statChanges || []) {
            const recipient = change.target === "self" ? actor : target;
            const current = numberOr(recipient.statStages?.[change.stat], 0);
            if ((change.stages > 0 && current < 6) || (change.stages < 0 && current > -6)) {
                useful = true;
                score += Math.abs(change.stages) * 12;
                reasons.push(`${change.stat}-stage`);
            }
        }
        if (effects.statusEffect && !target.statusCondition) {
            useful = true;
            score += 29;
            reasons.push(effects.statusEffect.condition);
        }
        if (effects.confusionChance && !target.volatileStatus?.confused) {
            useful = true;
            score += 16;
            reasons.push("confusion");
        }
        if (effects.healRatio && actor.hp < actor.maxHp * 0.7) {
            useful = true;
            score += 18 + (1 - actor.hp / actor.maxHp) * 35;
            reasons.push("healing");
        }
        if (effects.protect && !actor.volatileStatus?.protected) {
            useful = true;
            score += 13;
            reasons.push("protect");
        }
        if (effects.fieldEffect) {
            useful = true;
            score += 9;
            reasons.push(effects.fieldEffect.key);
        }
        return { score: useful ? score : -250, damage: { min: 0, max: 0, expected: 0, effectiveness: 1, stab: 1 }, reason: reasons.join(",") || "no-utility" };
    }

    function scoreAiMove(actor, target, move, context) {
        const options = context || {};
        const damage = estimateMoveDamage(actor, target, move);
        if (!move || move.pp <= 0) {
            return { score: -1000, damage, reason: "unusable" };
        }
        if (move.power <= 0) return statusMoveScore(actor, target, move);
        if (damage.effectiveness === 0) return { score: -1000, damage, reason: "immune" };

        // CFRU/Radical Red starts legal moves from a common score and stacks
        // positive and negative checks. Only checks supported by this battle
        // engine are mirrored here; unsupported status/ability logic is not faked.
        let score = 100;
        const reasons = [];
        const targetCount = Math.max(1, numberOr(options.targetCount, 1));
        const reserved = options.reservedDamage || { min: 0, expected: 0 };
        const remainingHp = Math.max(0, target.hp - reserved.expected);
        const remainingMinHp = Math.max(0, target.hp - reserved.min);
        const accuracy = moveAccuracy(actor, target, move);

        score += Math.min(42, (damage.expected / Math.max(1, target.maxHp)) * 70);
        if (damage.effectiveness >= 4) {
            score += 18;
            reasons.push("4x-effective");
        } else if (damage.effectiveness > 1) {
            score += 11;
            reasons.push("super-effective");
        } else if (damage.effectiveness < 1) {
            score -= damage.effectiveness <= 0.25 ? 20 : 10;
            reasons.push("resisted");
        }
        if (damage.stab > 1) score += 4;
        score -= (100 - accuracy) * 0.12;

        if (reserved.min >= target.hp && targetCount > 1) {
            score -= 120;
            reasons.push("partner-secured-ko");
        } else if (reserved.expected >= target.hp && targetCount > 1) {
            score -= 58;
            reasons.push("partner-likely-ko");
        } else {
            const guaranteedKo = accuracy === 100 && damage.min >= remainingMinHp;
            const possibleKo = damage.max >= Math.max(1, remainingHp);
            if (guaranteedKo) {
                score += 62;
                reasons.push(reserved.expected > 0 ? "combined-ko" : "guaranteed-ko");
            } else if (possibleKo) {
                score += 31;
                reasons.push(reserved.expected > 0 ? "combined-ko-chance" : "ko-chance");
            } else if (reserved.expected > 0 && damage.expected + reserved.expected >= target.hp) {
                score += 20;
                reasons.push("partner-combo");
            }
        }

        const targetThreat = bestThreatDamage(target, actor);
        if (targetThreat >= actor.hp) {
            score += 18;
            reasons.push("dangerous-target");
        } else if (targetThreat >= actor.hp * 0.5) {
            score += 7;
        }

        if (move.priority > 0) score += 4 + move.priority * 2;
        else if (actor.stats.speed >= target.stats.speed) score += 2;

        return { score, damage, reason: reasons.join(",") || "damage" };
    }

    class BattleEngine {
        constructor(options) {
            const config = options || {};
            if (!Array.isArray(config.playerTeam) || config.playerTeam.length < 2) {
                throw new Error("The player needs at least two Pokemon.");
            }
            if (!Array.isArray(config.enemyTeam) || config.enemyTeam.length < 1) {
                throw new Error("The opponent needs at least one Pokemon.");
            }
            this.rng = typeof config.rng === "function" ? config.rng : Math.random;
            this.captureHandler = typeof config.captureHandler === "function" ? config.captureHandler : null;
            // Bag items and Poke Balls are the TRAINER's actions, not the
            // Pokemon's, so the log needs a name for whoever is playing.
            this.playerName = config.playerName || "You";
            this.aiProfile = config.aiProfile || (this.captureHandler ? "wild" : "radical-red");
            // How sharply this trainer plays. A route rookie and a gym leader
            // used to share one scorer and therefore played identically.
            this.aiSkill = String(config.aiSkill || "strong").toLowerCase();
            this.allowEnemyItems = Boolean(config.allowEnemyItems);
            // Hard mode: no Potions or Revives mid-battle, and the enemy will
            // switch to answer a bad matchup rather than only to escape a KO.
            this.blockBattleHealing = Boolean(config.blockBattleHealing);
            this.matchupSwitching = Boolean(config.matchupSwitching);
            this.teams = {
                player: config.playerTeam,
                enemy: config.enemyTeam,
            };
            Object.values(this.teams).flat().forEach((pokemon) => {
                pokemon.hp = clamp(numberOr(pokemon.hp, pokemon.maxHp), 0, Math.max(1, numberOr(pokemon.maxHp, 1)));
                pokemon.fainted = pokemon.hp <= 0;
                pokemon.statStages = { ...Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0])), ...(pokemon.statStages || {}) };
                pokemon.statusCondition = pokemon.statusCondition || null;
                pokemon.statusTurns = numberOr(pokemon.statusTurns, 0);
                pokemon.volatileStatus = pokemon.volatileStatus || {};
                pokemon.turnsActive = numberOr(pokemon.turnsActive, 0);
            });
            const configuredSlots = config.activePerSide || {};
            this.activeLimit = {
                player: clamp(numberOr(configuredSlots.player, 2), 1, 2),
                enemy: clamp(numberOr(configuredSlots.enemy, 2), 1, 2),
            };
            this.active = {
                player: this.teams.player.map((_, index) => index).slice(0, this.activeLimit.player),
                enemy: this.teams.enemy.map((_, index) => index).slice(0, this.activeLimit.enemy),
            };
            this.inventory = config.inventory || {};
            // The raw move table, so Metronome can reach the whole dex rather
            // than only what the eight Pokemon on the field happen to know.
            this.movesById = config.movesById || null;
            this.callablePoolCache = null;
            this.playerActions = [];
            this.fieldEffects = {
                waterSport: 0, mudSport: 0, wonderRoom: 0,
                trickRoom: 0, magicRoom: 0, gravity: 0, ionDeluge: 0,
            };
            // Weather covers the whole field; hazards and screens belong to
            // one side each.
            const fieldApi = fieldRegistry();
            this.weather = { kind: null, turns: 0 };
            this.terrain = { kind: null, turns: 0 };
            this.sideState = {
                player: fieldApi ? fieldApi.emptySideState() : { hazards: {}, screens: {} },
                enemy: fieldApi ? fieldApi.emptySideState() : { hazards: {}, screens: {} },
            };
            // Uproar suppresses sleep across the whole field while it lasts.
            this.uproarTurns = 0;
            // Mega Evolution is once per battle, per side.
            this.megaSpent = { player: false, enemy: false };
            this.turn = 1;
            this.phase = "command";
            this.result = null;
            this.fillActiveSlots("player", []);
            this.fillActiveSlots("enemy", []);
            // Opening switch-in abilities (Intimidate and friends). Their
            // events surface with the first resolved turn.
            this.openingEvents = [];
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ teamIndex }) => {
                    this.runSwitchInAbility(side, teamIndex, this.openingEvents);
                });
            });
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ pokemon }) => { pokemon.turnsActive = 0; });
            });
        }

        opposingSide(side) {
            return side === "player" ? "enemy" : "player";
        }

        moveUsability(pokemon, move) {
            if (!pokemon || pokemon.fainted) return { usable: false, reason: "That Pokemon cannot act." };
            if (!move || move.pp <= 0) return { usable: false, reason: "That move has no PP left." };
            const lockIndex = pokemon.volatileStatus?.choiceLockIndex;
            if (Number.isInteger(lockIndex) && abilityOf(pokemon)?.choiceLock
                && pokemon.moves.indexOf(move) !== lockIndex && pokemon.moves[lockIndex]?.pp > 0) {
                return { usable: false, reason: `${pokemon.name} is locked into ${pokemon.moves[lockIndex].displayName}!` };
            }
            if (move.effects?.firstTurnOnly && pokemon.turnsActive !== 0) {
                return { usable: false, reason: `${move.displayName} only works on this Pokemon's first active turn.` };
            }
            if (move.effects?.healRatio && pokemon.hp >= pokemon.maxHp) {
                return { usable: false, reason: `${pokemon.name} is already at full HP.` };
            }
            const volatiles = pokemon.volatileStatus || {};
            const moveIndex = pokemon.moves.indexOf(move);
            if (volatiles.disableTurns > 0 && moveIndex === volatiles.disabledMoveIndex) {
                return { usable: false, reason: `${move.displayName} is disabled.` };
            }
            if (volatiles.encoreTurns > 0 && Number.isInteger(volatiles.encoredMoveIndex)
                && moveIndex !== volatiles.encoredMoveIndex) {
                const encored = pokemon.moves[volatiles.encoredMoveIndex];
                return { usable: false, reason: `${pokemon.name} must keep using ${encored?.displayName || "its last move"}.` };
            }
            if (volatiles.tormented && Number.isInteger(pokemon.lastMoveIndex)
                && moveIndex === pokemon.lastMoveIndex) {
                return { usable: false, reason: `${pokemon.name} can't use the same move twice in a row.` };
            }
            if (volatiles.tauntTurns > 0 && move.power <= 0) {
                return { usable: false, reason: `${pokemon.name} is taunted and can only attack.` };
            }
            // Imprison seals any move the imprisoner also knows.
            const sealed = this.getActivePokemon(this.opposingSide(this.sideOf(pokemon) || "player"))
                .some(({ pokemon: foe }) => Array.isArray(foe?.volatileStatus?.imprison)
                    && foe.volatileStatus.imprison.includes(move.slug));
            if (sealed) {
                return { usable: false, reason: `${move.displayName} is sealed by Imprison.` };
            }
            const item = heldItemOf(pokemon);
            if (item?.blocksStatusMoves && move.power <= 0) {
                return { usable: false, reason: `${pokemon.name}'s Assault Vest blocks status moves.` };
            }
            if (item?.locksMove && Number.isInteger(volatiles.choiceLockedIndex)
                && moveIndex !== volatiles.choiceLockedIndex) {
                const locked = pokemon.moves[volatiles.choiceLockedIndex];
                return { usable: false, reason: `${pokemon.name} is locked into ${locked?.displayName || "its first move"}.` };
            }
            return { usable: true, reason: "" };
        }

        canUseMove(side, teamIndex, moveIndex) {
            const pokemon = this.teams[side]?.[teamIndex];
            return this.moveUsability(pokemon, pokemon?.moves?.[moveIndex]);
        }

        getActivePokemon(side) {
            return this.active[side]
                .map((teamIndex, slot) => ({ slot, teamIndex, pokemon: this.teams[side][teamIndex] }))
                .filter((entry) => isBattleReady(entry.pokemon));
        }

        syncFaintedState() {
            Object.values(this.teams).flat().forEach((pokemon) => {
                pokemon.fainted = !isBattleReady(pokemon);
            });
        }

        hasBattleReadyPokemon(side) {
            return this.teams[side].some((pokemon) => isBattleReady(pokemon));
        }

        // A Pokemon partway through a multi-turn move has no choice about its
        // action: it is replayed automatically rather than offered to the
        // player or picked by the AI. Recharging rides the same field with no
        // move to replay, so the whole commitment lives in one place.
        forcedAction(side, teamIndex) {
            const pokemon = this.teams[side]?.[teamIndex];
            const pending = pokemon?.pendingMove;
            if (!pending || !isBattleReady(pokemon)) return null;
            return {
                kind: "move",
                side,
                actorIndex: teamIndex,
                moveIndex: pending.moveIndex,
                targetSide: pending.targetSide,
                targetIndex: pending.targetIndex,
                targetSlot: pending.targetSlot,
                forced: true,
            };
        }

        isCommitted(side, teamIndex) {
            return Boolean(this.teams[side]?.[teamIndex]?.pendingMove);
        }

        // What the UI should say instead of offering a move menu.
        commitmentLabel(side, teamIndex) {
            const pokemon = this.teams[side]?.[teamIndex];
            const pending = pokemon?.pendingMove;
            if (!pending) return "";
            const move = pokemon.moves[pending.moveIndex];
            if (pending.kind === "recharge") return `${pokemon.name} must recharge.`;
            if (pending.kind === "charge") return `${pokemon.name} is charging ${move?.displayName || "its move"}.`;
            if (pending.kind === "bide") return `${pokemon.name} is storing energy.`;
            return `${pokemon.name} is locked into ${move?.displayName || "its move"}.`;
        }

        getNextCommandSlot() {
            const queued = new Set(this.playerActions.map((action) => action.actorIndex));
            const next = this.getActivePokemon("player")
                .find((entry) => !queued.has(entry.teamIndex) && !this.isCommitted("player", entry.teamIndex));
            return next ? next.slot : null;
        }

        commandsNeeded() {
            return this.getActivePokemon("player")
                .filter((entry) => !this.isCommitted("player", entry.teamIndex)).length;
        }

        canResolve() {
            return this.playerActions.length >= this.commandsNeeded();
        }

        // Baton Pass, U-turn and friends need to know who is coming in. The
        // UI asks up front, the way it already asks for a target, rather than
        // interrupting the turn once the move resolves.
        selfSwitchChoices(actorSlot) {
            const actorIndex = this.active.player[actorSlot];
            const occupied = new Set(this.active.player);
            return this.teams.player
                .map((pokemon, teamIndex) => ({ pokemon, teamIndex }))
                .filter(({ pokemon, teamIndex }) => isBattleReady(pokemon)
                    && !occupied.has(teamIndex) && teamIndex !== actorIndex);
        }

        moveNeedsSelfSwitch(actorSlot, moveIndex) {
            const actor = this.teams.player[this.active.player[actorSlot]];
            const move = actor?.moves?.[moveIndex];
            if (!move?.effects?.selfSwitch) return false;
            return this.selfSwitchChoices(actorSlot).length > 1;
        }

        queueMove(actorSlot, moveIndex, targetSlot, switchToIndex) {
            this.assertCommandPhase();
            const actorIndex = this.active.player[actorSlot];
            const targetIndex = this.active.enemy[targetSlot];
            const actor = this.teams.player[actorIndex];
            if (!actor || actor.fainted) throw new Error("That Pokemon cannot act.");
            // A Pokemon part-way through a multi-turn move has no free choice.
            if (this.isCommitted("player", actorIndex)) {
                throw new Error(this.commitmentLabel("player", actorIndex));
            }
            if (this.playerActions.some((action) => action.actorIndex === actorIndex)) throw new Error("That Pokemon already has an action.");
            const move = actor.moves[moveIndex];
            const usability = this.moveUsability(actor, move);
            // Taunt, Disable, Torment and PP loss can between them leave a
            // Pokemon with nothing legal to pick. Rejecting every option would
            // strand the player with no way to end the turn, so the command is
            // allowed through and executeMove no-ops it -- the same fallback
            // the enemy AI already uses. (A real Struggle is still missing.)
            const hasAnyUsableMove = actor.moves.some((candidate) => this.moveUsability(actor, candidate).usable);
            if (!usability.usable && hasAnyUsableMove) throw new Error(usability.reason);
            const needsTarget = move.targetMode === "selected-opponent";
            const target = this.teams.enemy[targetIndex];
            if (needsTarget && (!target || target.fainted)) throw new Error("Choose an active target.");
            this.playerActions.push({
                kind: "move",
                side: "player",
                actorIndex,
                moveIndex,
                targetSide: "enemy",
                targetIndex,
                targetSlot: needsTarget ? targetSlot : null,
                // Who Baton Pass and friends hand over to.
                switchToIndex: Number.isInteger(switchToIndex)
                    && this.selfSwitchChoices(actorSlot).some((entry) => entry.teamIndex === switchToIndex)
                    ? switchToIndex
                    : null,
            });
            return this.canResolve();
        }

        // A Pokemon can mega-evolve when it is holding the right stone and
        // its side has not already done so this battle. The stone-to-form
        // lookup is supplied by the run simulation as `megaTarget`.
        megaUsability(side, teamIndex) {
            const pokemon = this.teams[side]?.[teamIndex];
            if (!pokemon || pokemon.fainted) return { usable: false, reason: "That Pokemon cannot act." };
            if (this.megaSpent[side]) return { usable: false, reason: "Your team has already Mega Evolved this battle." };
            if (pokemon.megaEvolved) return { usable: false, reason: `${pokemon.name} has already Mega Evolved.` };
            if (!pokemon.megaTarget?.species) {
                return { usable: false, reason: `${pokemon.name} is not holding a usable Mega Stone.` };
            }
            return { usable: true, reason: "" };
        }

        queueMega(actorSlot) {
            this.assertCommandPhase();
            const actorIndex = this.active.player[actorSlot];
            const usability = this.megaUsability("player", actorIndex);
            if (!usability.usable) throw new Error(usability.reason);
            if (this.playerActions.some((action) => action.actorIndex === actorIndex)) {
                throw new Error("That Pokemon already has an action.");
            }
            if (this.isCommitted("player", actorIndex)) {
                throw new Error(this.commitmentLabel("player", actorIndex));
            }
            this.playerActions.push({ kind: "mega", side: "player", actorIndex, actorSlot });
            return this.canResolve();
        }

        queueSwitch(actorSlot, replacementIndex) {
            this.assertCommandPhase();
            const actorIndex = this.active.player[actorSlot];
            const actor = this.teams.player[actorIndex];
            const replacement = this.teams.player[replacementIndex];
            if (!actor || actor.fainted) throw new Error("That Pokemon cannot switch.");
            // A Pokemon part-way through a multi-turn move has no free choice.
            if (this.isCommitted("player", actorIndex)) {
                throw new Error(this.commitmentLabel("player", actorIndex));
            }
            if (this.playerActions.some((action) => action.actorIndex === actorIndex)) throw new Error("That Pokemon already has an action.");
            // Bind, Wrap and friends hold it in place.
            if (actor.volatileStatus?.trapped) {
                throw new Error(`${actor.name} is trapped and can't be switched out!`);
            }
            // Ingrain roots it to the spot by its own doing.
            if (actor.volatileStatus?.ingrain) {
                throw new Error(`${actor.name} is rooted in place and can't be switched out!`);
            }
            // Mean Look, Block, Spider Web and Fairy Lock cut off the exit.
            if (actor.volatileStatus?.cantEscape) {
                throw new Error(`${actor.name} can no longer escape!`);
            }
            if (!replacement || replacement.fainted) throw new Error("Choose a healthy Pokemon from the bench.");
            if (this.active.player.includes(replacementIndex)) throw new Error("That Pokemon is already active.");
            // Trapping abilities on the opposing side (Shadow Tag, Arena
            // Trap, Magnet Pull) forbid a voluntary switch.
            const actorHasLevitate = actor.ability?.slug === "levitate";
            for (const entry of this.getActivePokemon("enemy")) {
                const trap = abilityOf(entry.pokemon)?.blocksSwitchOf;
                if (typeof trap === "function" && trap(actor, actorHasLevitate)) {
                    throw new Error(`${entry.pokemon.name}'s ${entry.pokemon.ability?.name} prevents switching out!`);
                }
            }
            if (this.playerActions.some((action) => action.kind === "switch" && action.replacementIndex === replacementIndex)) {
                throw new Error("That Pokemon is already switching in.");
            }
            this.playerActions.push({
                kind: "switch",
                side: "player",
                actorIndex,
                actorSlot,
                replacementIndex,
            });
            return this.canResolve();
        }

        queueItem(actorSlot, itemKey, targetIndex) {
            this.assertCommandPhase();
            const actorIndex = this.active.player[actorSlot];
            const actor = this.teams.player[actorIndex];
            const target = this.teams.player[targetIndex];
            const item = this.inventory[itemKey];
            if (!actor || actor.fainted) throw new Error("That Pokemon cannot act.");
            // A Pokemon part-way through a multi-turn move has no free choice.
            if (this.isCommitted("player", actorIndex)) {
                throw new Error(this.commitmentLabel("player", actorIndex));
            }
            if (this.playerActions.some((action) => action.actorIndex === actorIndex)) throw new Error("That Pokemon already has an action.");
            if (!item || item.quantity <= 0) throw new Error("That item is unavailable.");
            // Hard mode keeps Potions and Revives for between duels; Poke
            // Balls go through queueCapture and are unaffected.
            if (this.blockBattleHealing && (item.effect?.type === "heal" || item.effect?.type === "revive")) {
                throw new Error("Hard mode: healing items can only be used between battles.");
            }
            if (!target) throw new Error("Choose a team member.");
            if (item.effect.type === "revive" && !target.fainted) throw new Error("Revive can only target a fainted Pokemon.");
            if (item.effect.type !== "revive" && target.fainted) throw new Error("That item cannot be used on a fainted Pokemon.");
            if (item.effect.type === "heal" && target.hp >= target.maxHp) throw new Error("That Pokemon is already at full HP.");
            this.playerActions.push({
                kind: "item",
                side: "player",
                actorIndex,
                itemKey,
                targetSide: "player",
                targetIndex,
            });
            return this.canResolve();
        }

        queueCapture(actorSlot, itemKey) {
            this.assertCommandPhase();
            if (!this.captureHandler) throw new Error("Poke Balls can only be used during a wild encounter.");
            const actorIndex = this.active.player[actorSlot];
            const actor = this.teams.player[actorIndex];
            const item = this.inventory[itemKey];
            if (!actor || actor.fainted) throw new Error("That Pokemon cannot act.");
            // A Pokemon part-way through a multi-turn move has no free choice.
            if (this.isCommitted("player", actorIndex)) {
                throw new Error(this.commitmentLabel("player", actorIndex));
            }
            if (this.playerActions.some((action) => action.actorIndex === actorIndex)) throw new Error("That Pokemon already has an action.");
            if (!item || item.category !== "capture" || item.quantity <= 0) throw new Error("That Poke Ball is unavailable.");
            this.playerActions.push({ kind: "capture", side: "player", actorIndex, itemKey });
            return this.canResolve();
        }

        cancelLastAction() {
            this.assertCommandPhase();
            return this.playerActions.pop() || null;
        }

        assertCommandPhase() {
            if (this.phase !== "command" || this.result) throw new Error("Commands are not available right now.");
        }

        buildWildEnemyActions() {
            const playerTargets = this.getActivePokemon("player");
            return this.getActivePokemon("enemy").map(({ slot, teamIndex, pokemon }) => {
                const forced = this.forcedAction("enemy", teamIndex);
                if (forced) return forced;
                const usable = pokemon.moves
                    .map((move, moveIndex) => ({ move, moveIndex }))
                    .filter(({ move }) => this.moveUsability(pokemon, move).usable);
                const chosen = usable[Math.floor(this.rng() * usable.length)] || { moveIndex: 0 };
                const target = playerTargets[Math.floor(this.rng() * playerTargets.length)] || playerTargets[0];
                const selfTarget = chosen.move?.targetMode === "self";
                return {
                    kind: "move",
                    side: "enemy",
                    actorIndex: teamIndex,
                    moveIndex: chosen.moveIndex,
                    targetSide: selfTarget ? "enemy" : "player",
                    targetIndex: selfTarget ? teamIndex : target.teamIndex,
                    targetSlot: selfTarget ? slot : target.slot,
                };
            });
        }

        // Skill tiers. `blunder` is how often the trainer ignores its own
        // judgement entirely, `window` is how far below the best score it
        // will still happily pick from. Beginners flail; leaders do not.
        skillSettings() {
            return {
                weak: { blunder: 0.35, window: 45 },
                mid: { blunder: 0.15, window: 22 },
                strong: { blunder: 0.04, window: 8 },
                boss: { blunder: 0, window: 0 },
            }[this.aiSkill] || { blunder: 0, window: 0 };
        }

        pickBySkill(candidates) {
            if (!candidates.length) return null;
            const { blunder, window } = this.skillSettings();
            // A blunder is a genuinely random legal move, which is what makes
            // early trainers feel like people rather than solvers.
            if (blunder > 0 && this.rng() < blunder) {
                return candidates[Math.floor(this.rng() * candidates.length)];
            }
            const best = Math.max(...candidates.map((candidate) => candidate.score));
            const acceptable = candidates.filter((candidate) => candidate.score >= best - window);
            const index = Math.min(acceptable.length - 1, Math.floor(this.rng() * acceptable.length));
            return acceptable[Math.max(0, index)];
        }

        // A capable trainer pulls a Pokemon out of a losing matchup instead of
        // letting it be knocked out for free. Kept to the higher tiers, and
        // capped so a full bench cannot be used to stall.
        considerEnemySwitch(slot, teamIndex, pokemon, playerTargets) {
            // Strong trainers always weigh a retreat; on hard mode the
            // middling ones do too, so only route rookies stay oblivious.
            const canSwitch = this.aiSkill === "strong" || this.aiSkill === "boss"
                || (this.matchupSwitching && this.aiSkill === "mid");
            if (!canSwitch) return null;
            if (!playerTargets.length) return null;
            this.enemySwitches = numberOr(this.enemySwitches, 0);
            if (this.enemySwitches >= 2) return null;
            // Only reconsider after it has actually been on the field a turn.
            if (numberOr(pokemon.turnsActive, 0) < 1) return null;
            if (pokemon.volatileStatus?.trapped || pokemon.pendingMove) return null;

            const incoming = Math.max(...playerTargets.map(({ pokemon: foe }) => bestThreatDamage(foe, pokemon)));
            const outgoing = Math.max(...playerTargets.map(({ pokemon: foe }) => bestThreatDamage(pokemon, foe)));
            // Losing badly means it is about to be knocked out and cannot
            // meaningfully hit back.
            const aboutToFall = incoming >= pokemon.hp;
            const cannotAnswer = outgoing < playerTargets[0].pokemon.hp * 0.25;
            // How well the current matchup is going, on the same scale the
            // candidates below are scored on.
            const standing = (outgoing / Math.max(1, playerTargets[0].pokemon.maxHp))
                - (incoming / Math.max(1, pokemon.maxHp));
            // Hard mode also switches out of a plainly losing matchup, not
            // only away from an imminent knockout. A tenth of a health bar per
            // turn of deficit is enough: taking 38% while dealing 26% reads as
            // losing to a player, and a stricter bar let obvious mismatches
            // stand.
            const losingMatchup = this.matchupSwitching && standing < -0.1;
            if ((!aboutToFall || !cannotAnswer) && !losingMatchup) return null;

            const occupied = new Set(this.active.enemy);
            let best = null;
            this.teams.enemy.forEach((candidate, index) => {
                if (occupied.has(index) || !isBattleReady(candidate)) return;
                const takes = Math.max(...playerTargets.map(({ pokemon: foe }) => bestThreatDamage(foe, candidate)));
                const deals = Math.max(...playerTargets.map(({ pokemon: foe }) => bestThreatDamage(candidate, foe)));
                // Survives what the active could not, and threatens back.
                const margin = (deals / Math.max(1, playerTargets[0].pokemon.maxHp))
                    - (takes / Math.max(1, candidate.maxHp));
                if (takes >= candidate.hp) return;
                if (!best || margin > best.margin) best = { index, margin };
            });
            if (!best) return null;
            // A panic switch just needs a survivable option; a matchup switch
            // has to be a real improvement on what is already out.
            const threshold = aboutToFall && cannotAnswer ? 0.15 : Math.max(0.15, standing + 0.35);
            if (best.margin <= threshold) return null;

            this.enemySwitches += 1;
            return {
                kind: "switch",
                side: "enemy",
                actorIndex: teamIndex,
                actorSlot: slot,
                replacementIndex: best.index,
            };
        }

        // A trainer holding a stone spends it as soon as the Pokemon carrying
        // it is on the field, the way a player almost always would.
        considerEnemyMega(slot, teamIndex) {
            if (!this.megaUsability("enemy", teamIndex).usable) return null;
            if (this.isCommitted("enemy", teamIndex)) return null;
            return { kind: "mega", side: "enemy", actorIndex: teamIndex, actorSlot: slot };
        }

        buildTrainerEnemyActions() {
            const playerTargets = this.getActivePokemon("player");
            const enemyActors = this.getActivePokemon("enemy");
            const reservedByTarget = new Map();
            return enemyActors.map(({ slot, teamIndex, pokemon }) => {
                const forced = this.forcedAction("enemy", teamIndex);
                if (forced) return forced;
                const transform = this.considerEnemyMega(slot, teamIndex);
                if (transform) return transform;
                const retreat = this.considerEnemySwitch(slot, teamIndex, pokemon, playerTargets);
                if (retreat) return retreat;
                const candidates = [];
                pokemon.moves.forEach((move, moveIndex) => {
                    if (!this.moveUsability(pokemon, move).usable) return;
                    if (move.targetMode === "self") {
                        candidates.push({
                            moveIndex,
                            targetIndex: teamIndex,
                            targetSlot: slot,
                            targetSide: "enemy",
                            ...scoreAiMove(pokemon, pokemon, move, { targetCount: 1 }),
                        });
                        return;
                    }
                    if (move.targetMode === "all-opponents") {
                        const evaluations = playerTargets.map((target) => scoreAiMove(pokemon, target.pokemon, move, {
                            targetCount: playerTargets.length,
                            reservedDamage: reservedByTarget.get(target.teamIndex),
                        }));
                        const score = evaluations.reduce((total, evaluation) => total + evaluation.score, 0) / Math.max(1, evaluations.length) + 8;
                        candidates.push({
                            moveIndex,
                            targetIndex: playerTargets[0]?.teamIndex,
                            targetSlot: playerTargets[0]?.slot,
                            targetSide: "player",
                            score,
                            damage: evaluations[0]?.damage || { min: 0, expected: 0 },
                            reason: `spread:${evaluations.map((entry) => entry.reason).join("+")}`,
                        });
                        return;
                    }
                    playerTargets.forEach((target) => {
                        const evaluation = scoreAiMove(pokemon, target.pokemon, move, {
                            targetCount: playerTargets.length,
                            reservedDamage: reservedByTarget.get(target.teamIndex),
                        });
                        candidates.push({
                            moveIndex,
                            targetIndex: target.teamIndex,
                            targetSlot: target.slot,
                            targetSide: "player",
                            ...evaluation,
                        });
                    });
                });

                if (candidates.length === 0) {
                    // No living target to fall back on: aim at the slot and
                    // let resolveMoveTargets sort it out rather than crash.
                    const target = playerTargets[0] || { teamIndex: this.active.player[0], slot: 0 };
                    return {
                        kind: "move",
                        side: "enemy",
                        actorIndex: teamIndex,
                        moveIndex: 0,
                        targetSide: "player",
                        targetIndex: target.teamIndex,
                        targetSlot: target.slot,
                        aiProfile: this.aiProfile,
                        aiScore: -1000,
                    };
                }

                const chosen = this.pickBySkill(candidates);
                const reserved = reservedByTarget.get(chosen.targetIndex) || { min: 0, expected: 0 };
                if (chosen.targetSide === "player" && pokemon.moves[chosen.moveIndex].power > 0) {
                    reservedByTarget.set(chosen.targetIndex, {
                        min: reserved.min + chosen.damage.min,
                        expected: reserved.expected + chosen.damage.expected,
                    });
                }
                return {
                    kind: "move",
                    side: "enemy",
                    actorIndex: teamIndex,
                    moveIndex: chosen.moveIndex,
                    targetSide: chosen.targetSide,
                    targetIndex: chosen.targetIndex,
                    targetSlot: chosen.targetSlot,
                    aiProfile: this.aiProfile,
                    aiScore: chosen.score,
                    aiReason: chosen.reason,
                };
            });
        }

        buildEnemyActions() {
            const actions = this.aiProfile === "wild" ? this.buildWildEnemyActions() : this.buildTrainerEnemyActions();
            return this.allowEnemyItems ? actions : actions.filter((action) => action.kind !== "item");
        }

        resolveTurn() {
            this.assertCommandPhase();
            if (!this.canResolve()) throw new Error("Both active Pokemon need a command.");
            this.phase = "resolving";
            // Committed Pokemon never reached the command menu, so their
            // replayed actions are merged in here.
            const forcedPlayerActions = this.getActivePokemon("player")
                .map(({ teamIndex }) => this.forcedAction("player", teamIndex))
                .filter(Boolean);
            const actions = [...this.playerActions, ...forcedPlayerActions, ...this.buildEnemyActions()];
            // Quick Claw is rolled once per holder per turn, and has to be
            // settled before the order is worked out rather than after.
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ pokemon }) => {
                    const chance = heldItemOf(pokemon)?.quickClawChance || 0;
                    pokemon.volatileStatus.quickClaw = chance > 0 && this.rng() < chance;
                });
            });
            actions.sort((left, right) => this.compareActions(left, right));

            // Anyone standing on the field this turn took part, which the run
            // pays experience for. Recorded here rather than from turnsActive,
            // which is only incremented once the turn survives to its end and
            // so overlooked a Pokemon that fought and fainted.
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ pokemon }) => { pokemon.duelParticipated = true; });
            });

            const events = [{ type: "turn", turn: this.turn, message: `Turn ${this.turn}` }];
            // Battle-opening ability triggers ride along with the first turn.
            if (this.openingEvents?.length) {
                events.push(...this.openingEvents);
                this.openingEvents = [];
            }
            // Position within the turn, for Analytic's "moved last" check.
            this.turnActionTotal = actions.length;
            this.turnActionIndex = 0;
            // Sucker Punch and Thunderclap need to know what their target has
            // queued but not yet done, so the turn's running order is readable
            // from inside a move.
            this.turnActions = actions;
            for (let step = 0; step < actions.length; step += 1) {
                const action = actions[step];
                const actor = this.teams[action.side][action.actorIndex];
                this.turnActionIndex += 1;
                this.turnActionStep = step;
                // After You and Quash change the order of whoever has not
                // moved yet, so the tail is re-sorted after every action.
                const reorderTail = () => {
                    const tail = actions.slice(step + 1).sort((left, right) => this.compareActions(left, right));
                    tail.forEach((entry, offset) => { actions[step + 1 + offset] = entry; });
                };
                if (!actor || actor.fainted) { reorderTail(); continue; }
                // Dragon Tail, Whirlwind, Roar and Circle Throw can pull a
                // Pokemon off the field before its own queued action comes
                // round. Only the faint check stood here, so the one that had
                // just been dragged out still took its turn from the bench.
                // Bag and Poke Ball actions belong to the trainer rather than
                // to whoever is standing, so they are not gated on this.
                if (action.kind !== "item" && action.kind !== "capture"
                    && !this.active[action.side].includes(action.actorIndex)) {
                    reorderTail();
                    continue;
                }
                if (action.kind === "mega") this.executeMega(action, events);
                else if (action.kind === "switch") this.executeSwitch(action, events);
                else if (action.kind === "item") this.executeItem(action, events);
                else if (action.kind === "capture") this.executeCapture(action, events);
                else this.executeMove(action, events);
                if (this.result === "capture") break;
                reorderTail();
            }

            if (this.result === "capture") {
                this.playerActions = [];
                this.phase = "finished";
                // A capture ends the battle as surely as a knockout; without
                // this, every volatile -- Encore, Protect, stat stages --
                // walked out of the encounter on the party.
                this.endBattleCleanup();
                return events;
            }

            this.applyEndTurnEffects(events);
            this.syncFaintedState();
            this.fillActiveSlots("enemy", events);
            this.playerActions = [];

            const playerDefeated = !this.hasBattleReadyPokemon("player");
            const enemyDefeated = !this.hasBattleReadyPokemon("enemy");
            // With the battle still live, an empty player slot is the player's
            // to fill -- the turn pauses until they pick.
            if (!playerDefeated && !enemyDefeated && this.pendingReplacements().length) {
                // The turn is only paused here -- beginNextTurn closes it once
                // the player has chosen, and does the ageing for everyone.
                this.phase = "replace";
                events.push({
                    type: "replace",
                    side: "player",
                    slots: this.pendingReplacements(),
                    message: "Choose the next Pokemon.",
                });
                return events;
            }
            if (playerDefeated || enemyDefeated) {
                this.phase = "finished";
                this.endBattleCleanup();
                this.result = enemyDefeated ? "victory" : "defeat";
                events.push({
                    type: "result",
                    result: this.result,
                    message: enemyDefeated ? "Victory! The opposing team is out of Pokemon." : "Defeat. Your team can no longer battle.",
                });
            } else {
                this.beginNextTurn(events);
            }
            return events;
        }

        // Swap in the mega form. The Pokemon keeps everything that belongs to
        // the individual -- current HP as a fraction, stat stages, status,
        // volatiles, moves and PP -- and only takes on the form's stats,
        // types, ability and sprites.
        executeMega(action, events) {
            const side = action.side;
            const pokemon = this.teams[side][action.actorIndex];
            const usability = this.megaUsability(side, action.actorIndex);
            if (!usability.usable) return;

            const target = pokemon.megaTarget.species;
            const base = target.base_stats || {};
            const hpFraction = pokemon.maxHp > 0 ? pokemon.hp / pokemon.maxHp : 1;

            // Remember what to put back when the duel ends.
            pokemon.baseForm = pokemon.baseForm || {
                id: pokemon.id,
                key: pokemon.key,
                name: pokemon.name,
                types: [...pokemon.types],
                stats: { ...pokemon.stats },
                maxHp: pokemon.maxHp,
                ability: pokemon.ability ? { ...pokemon.ability } : null,
                sprites: { ...pokemon.sprites },
            };

            const level = pokemon.level;
            pokemon.id = target.id;
            pokemon.key = target.key;
            // Every mega form's display_name in the dex is just the base
            // species ("Charizard"), so the proper label comes from the key:
            // Charizard-Mega-X -> Mega Charizard X.
            pokemon.name = megaDisplayName(target) || pokemon.name;
            pokemon.types = (target.types || []).map((entry) =>
                String(entry.type || entry.type_name || "normal").toLowerCase());
            pokemon.maxHp = calculateStat(base.hp, level, true);
            pokemon.stats = {
                attack: calculateStat(base.attack, level, false),
                defense: calculateStat(base.defense, level, false),
                specialAttack: calculateStat(base.special_attack, level, false),
                specialDefense: calculateStat(base.special_defense, level, false),
                speed: calculateStat(base.speed, level, false),
            };
            pokemon.hp = Math.max(1, Math.min(pokemon.maxHp, Math.round(pokemon.maxHp * hpFraction)));
            // Mega forms have exactly one ability.
            const megaAbility = (target.abilities || []).find((entry) => entry.ability);
            if (megaAbility) {
                pokemon.ability = { slug: megaAbility.ability, name: megaAbility.display_name || megaAbility.ability };
            }
            if (target.sprites) {
                pokemon.sprites = {
                    front: target.sprites.front_idle || pokemon.sprites.front,
                    back: target.sprites.back_idle || target.sprites.front_idle || pokemon.sprites.back,
                    animatedGif: Boolean(target.sprites.animated_gif),
                };
            }
            pokemon.megaEvolved = true;
            this.megaSpent[side] = true;

            events.push({
                type: "mega",
                side,
                targetIndex: action.actorIndex,
                speciesId: target.id,
                name: pokemon.name,
                stoneName: pokemon.megaTarget.stone?.name || "its Mega Stone",
                sprites: pokemon.sprites,
                message: `${pokemon.baseForm.name}'s ${pokemon.megaTarget.stone?.name || "Mega Stone"} is reacting! It Mega Evolved into ${pokemon.name}!`,
            });
            // A switch-in style ability (Intimidate on Mega Kangaskhan, say)
            // fires on the new form.
            const ability = abilityOf(pokemon);
            if (typeof ability?.onSwitchIn === "function") {
                ability.onSwitchIn(this.abilityContext(pokemon, side, action.actorIndex, events));
            }
        }

        executeSwitch(action, events) {
            const side = action.side === "enemy" ? "enemy" : "player";
            const outgoing = this.teams[side][action.actorIndex];
            const replacement = this.teams[side][action.replacementIndex];
            if (!outgoing || outgoing.fainted || !replacement || replacement.fainted
                || this.active[side].includes(action.replacementIndex)) return;
            outgoing.statStages = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0]));
            restoreBattleMutations(outgoing);
            outgoing.volatileStatus = {};
            outgoing.pendingMove = null;
            outgoing.toxicCounter = 0;
            // Natural Cure / Regenerator fire on the way out.
            abilityOf(outgoing)?.onSwitchOut?.(outgoing);
            this.active[side][action.actorSlot] = action.replacementIndex;
            replacement.turnsActive = -1;
            replacement.volatileStatus = {};
            replacement.pendingMove = null;
            events.push({
                type: "switch",
                side,
                slot: action.actorSlot,
                targetIndex: action.replacementIndex,
                message: side === "player"
                    ? `${outgoing.name}, come back! Go, ${replacement.name}!`
                    : `The opponent withdrew ${outgoing.name} and sent out ${replacement.name}!`,
            });
            this.runSwitchInAbility(side, action.replacementIndex, events);
        }

        // Is this target still sitting on a damaging move it has not used yet?
        // Only actions later in the running order count: one already spent is
        // no longer something Sucker Punch can interrupt.
        targetIsReadyingAttack(side, teamIndex) {
            const actions = this.turnActions || [];
            const from = Number.isInteger(this.turnActionStep) ? this.turnActionStep + 1 : 0;
            return actions.slice(from).some((action) => {
                if (action.side !== side || action.actorIndex !== teamIndex) return false;
                if (action.kind && action.kind !== "move") return false;
                const move = this.teams[side][teamIndex]?.moves?.[action.moveIndex];
                return Boolean(move) && move.power > 0;
            });
        }

        // Does this Pokemon still have a move queued and unspent this turn?
        // Flinch can only steal a turn that has not happened yet; the games
        // never proc it on a target that already moved.
        targetHasPendingMove(side, teamIndex) {
            const actions = this.turnActions || [];
            const from = Number.isInteger(this.turnActionStep) ? this.turnActionStep + 1 : 0;
            return actions.slice(from).some((action) => action.side === side
                && action.actorIndex === teamIndex
                && (!action.kind || action.kind === "move"));
        }

        // Who acts first. Called once to order the turn, and again after every
        // action so After You and Quash can reshuffle whoever is still waiting.
        compareActions(left, right) {
            const priority = (action) => {
                if (action.kind === "mega") return 30;
                if (action.kind === "switch") return 20;
                if (action.kind === "item" || action.kind === "capture") return 10;
                const mover = this.teams[action.side][action.actorIndex];
                const chosen = mover.moves[action.moveIndex];
                // Prankster, Gale Wings and Triage all bump their own moves up
                // the order rather than changing the move itself.
                const bonus = abilityOf(mover)?.priorityBonus;
                return chosen.priority
                    + (typeof bonus === "function" ? numberOr(bonus({ move: chosen, pokemon: mover }), 0) : 0);
            };
            // After You bumps its target up the order; Quash drops it to the
            // back regardless of how fast the move normally is.
            const nudge = (action) => {
                const volatiles = this.teams[action.side][action.actorIndex].volatileStatus || {};
                if (volatiles.movesLast) return -100;
                if (volatiles.movesFirst) return 0.75;
                return 0;
            };
            const leftPriority = priority(left) + nudge(left)
                + (this.teams[left.side][left.actorIndex].volatileStatus?.quickClaw ? 0.5 : 0);
            const rightPriority = priority(right) + nudge(right)
                + (this.teams[right.side][right.actorIndex].volatileStatus?.quickClaw ? 0.5 : 0);
            if (leftPriority !== rightPriority) return rightPriority - leftPriority;
            const weatherNow = this.activeWeather();
            const terrainNow = this.activeTerrain();
            const leftSpeed = modifiedStat(this.teams[left.side][left.actorIndex], "speed", { weather: weatherNow, terrain: terrainNow });
            const rightSpeed = modifiedStat(this.teams[right.side][right.actorIndex], "speed", { weather: weatherNow, terrain: terrainNow });
            // Trick Room stands the speed order on its head.
            const speedDifference = this.fieldEffects.trickRoom > 0
                ? leftSpeed - rightSpeed
                : rightSpeed - leftSpeed;
            if (speedDifference !== 0) return speedDifference;
            return this.rng() < 0.5 ? -1 : 1;
        }

        resolveMoveTargets(action, move) {
            if (move.targetMode === "self") {
                const pokemon = this.teams[action.side][action.actorIndex];
                return pokemon && !pokemon.fainted ? [{ side: action.side, teamIndex: action.actorIndex, pokemon }] : [];
            }
            const targetSide = this.opposingSide(action.side);
            // Perish Song reaches everything on the field, both sides.
            if (move.targetMode === "all-battlers") {
                return ["player", "enemy"].flatMap((eachSide) => this.getActivePokemon(eachSide)
                    .map((entry) => ({ side: eachSide, ...entry })));
            }
            if (move.targetMode === "all-opponents") {
                return this.getActivePokemon(targetSide).map((entry) => ({ side: targetSide, ...entry }));
            }
            // Earthquake, Surf, Explosion...: both opponents AND the user's
            // own partner. Everything adjacent except the user itself.
            if (move.targetMode === "adjacent-all") {
                return [
                    ...this.getActivePokemon(targetSide).map((entry) => ({ side: targetSide, ...entry })),
                    ...this.getActivePokemon(action.side)
                        .filter((entry) => entry.teamIndex !== action.actorIndex)
                        .map((entry) => ({ side: action.side, ...entry })),
                ];
            }
            // Follow Me, Rage Powder and Spotlight pull single-target moves
            // onto whoever drew the attention.
            const drawing = this.getActivePokemon(targetSide)
                .find(({ pokemon }) => pokemon && !pokemon.fainted && pokemon.volatileStatus?.redirecting);
            const aimer = this.teams[action.side]?.[action.actorIndex];
            if (drawing && !abilityOf(aimer)?.ignoreRedirection) {
                return [{ side: targetSide, ...drawing }];
            }
            const requestedIndex = this.active[targetSide][action.targetSlot];
            const requested = this.teams[targetSide][requestedIndex];
            if (requested && !requested.fainted) {
                return [{ side: targetSide, slot: action.targetSlot, teamIndex: requestedIndex, pokemon: requested }];
            }
            const redirected = this.getActivePokemon(targetSide)[0];
            return redirected ? [{ side: targetSide, ...redirected }] : [];
        }

        canPokemonAct(actor, events, actorSide, actorIndex, move) {
            // Abilities that cost their owner the turn outright. Truant is the
            // one that matters: without this it did nothing at all and Slaking
            // attacked every round like any other Pokemon.
            const actorAbility = abilityOf(actor);
            if (typeof actorAbility?.preventsAction === "function") {
                const blocked = actorAbility.preventsAction({ pokemon: actor, move, rng: this.rng });
                if (blocked) {
                    events.push({
                        type: "ability", side: actorSide, targetIndex: actorIndex,
                        abilityName: actor.ability?.name || "",
                        message: blocked.replace("{name}", actor.name),
                    });
                    return false;
                }
            }
            if (actor.volatileStatus?.flinched) {
                actor.volatileStatus.flinched = false;
                events.push({ type: "status", message: `${actor.name} flinched and couldn't move!` });
                const ability = abilityOf(actor);
                if (typeof ability?.onFlinched === "function") {
                    ability.onFlinched(this.abilityContext(actor, actorSide, actorIndex, events));
                }
                return false;
            }
            if (actor.statusCondition === "sleep") {
                // Early Bird burns sleep turns twice as fast.
                const sleepRate = numberOr(actorAbility?.sleepCounterRate, 1);
                actor.statusTurns = Math.max(0, numberOr(actor.statusTurns, 1) - sleepRate);
                // Sleep Talk and Snore are the two moves that only work while
                // their user is asleep.
                const worksAsleep = move?.effects?.callsMove === "own-random" || move?.slug === "snore";
                if (actor.statusTurns > 0 && !worksAsleep) {
                    events.push({ type: "status", message: `${actor.name} is fast asleep.` });
                    return false;
                }
                if (actor.statusTurns > 0) {
                    events.push({ type: "status", message: `${actor.name} is fast asleep, but talked in its sleep!` });
                } else {
                    actor.statusCondition = null;
                    events.push({ type: "status", message: `${actor.name} woke up!` });
                }
            }
            if (actor.statusCondition === "freeze") {
                if (this.rng() >= 0.2) {
                    events.push({ type: "status", message: `${actor.name} is frozen solid!` });
                    return false;
                }
                actor.statusCondition = null;
                events.push({ type: "status", message: `${actor.name} thawed out!` });
            }
            if (actor.statusCondition === "paralysis" && this.rng() < 0.25) {
                events.push({ type: "status", message: `${actor.name} is paralyzed! It can't move!` });
                return false;
            }
            // Infatuation costs the turn half the time, and lasts until the
            // Pokemon switches out (volatileStatus is cleared on switch).
            if (actor.volatileStatus?.infatuated && this.rng() < 0.5) {
                events.push({ type: "status", message: `${actor.name} is immobilized by love!` });
                return false;
            }
            if (actor.volatileStatus?.confused) {
                actor.volatileStatus.confusionTurns = Math.max(0, numberOr(actor.volatileStatus.confusionTurns, 1) - 1);
                if (actor.volatileStatus.confusionTurns <= 0) {
                    actor.volatileStatus.confused = false;
                    events.push({ type: "status", message: `${actor.name} snapped out of confusion!` });
                } else if (this.rng() < 1 / 3) {
                    // The self-hit is a 40-power typeless physical strike with
                    // the mon's own Attack against its own Defense, not a
                    // flat fraction of health.
                    const selfAttack = modifiedStat(actor, "attack", {});
                    const selfDefense = Math.max(1, modifiedStat(actor, "defense", {}));
                    const selfBase = (((2 * actor.level / 5 + 2) * 40 * selfAttack / selfDefense) / 50) + 2;
                    const damage = Math.max(1, Math.floor(selfBase * (0.85 + this.rng() * 0.15)));
                    actor.hp = Math.max(0, actor.hp - damage);
                    actor.fainted = actor.hp === 0;
                    events.push({ type: "status", message: "It hurt itself in its confusion!" });
                    events.push({ type: "damage", side: actorSide, targetIndex: actorIndex, damage, newHp: actor.hp, maxHp: actor.maxHp, message: "" });
                    return false;
                }
            }
            return true;
        }

        applyEndTurnEffects(events) {
            const field = fieldRegistry();
            const weatherKind = this.activeWeather();

            // Sandstorm scours everyone who isn't Rock, Ground or Steel.
            if (weatherKind && field) {
                const definition = field.getWeather(weatherKind);
                ["player", "enemy"].forEach((side) => {
                    this.getActivePokemon(side).forEach(({ teamIndex, pokemon }) => {
                        if (!field.takesWeatherChip(weatherKind, pokemon.types)) return;
                        const ability = abilityOf(pokemon);
                        if (ability?.indirectImmune || ability?.weatherChipImmune?.includes(weatherKind)) return;
                        const damage = Math.max(1, Math.floor(pokemon.maxHp * definition.chipRatio));
                        pokemon.hp = Math.max(0, pokemon.hp - damage);
                        pokemon.fainted = pokemon.hp === 0;
                        events.push({
                            type: "damage", side, targetIndex: teamIndex, damage,
                            newHp: pokemon.hp, maxHp: pokemon.maxHp,
                            message: definition.chipMessage.replace("{name}", pokemon.name),
                        });
                        if (pokemon.fainted) {
                            events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                        }
                    });
                });
            }

            // Grassy Terrain feeds everything standing on it.
            const terrainKind = this.activeTerrain();
            const terrainDef = terrainKind ? field?.getTerrain(terrainKind) : null;
            if (terrainDef?.healRatio) {
                ["player", "enemy"].forEach((side) => {
                    this.getActivePokemon(side).forEach(({ teamIndex, pokemon }) => {
                        if (!this.isGrounded(pokemon) || pokemon.hp >= pokemon.maxHp) return;
                        const amount = Math.max(1, Math.floor(pokemon.maxHp * terrainDef.healRatio));
                        const before = pokemon.hp;
                        pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + amount);
                        events.push({
                            type: "heal", side, targetIndex: teamIndex, newHp: pokemon.hp,
                            maxHp: pokemon.maxHp, amount: pokemon.hp - before,
                            message: `${pokemon.name} is healed by the grassy terrain!`,
                        });
                    });
                });
            }

            // Held items tick before the timed effects so Leftovers can
            // out-heal a small chip, as it does in the real games.
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ teamIndex, pokemon }) => {
                    const item = heldItemOf(pokemon);
                    if (typeof item?.endOfTurn !== "function") return;
                    const gluttony = abilityOf(pokemon)?.earlyBerries && heldItemRegistry()?.isBerry(pokemon.heldItemKey);
                    const context = this.itemContext(pokemon, side, teamIndex, events, {
                        healThreshold: gluttony ? 0.75 : (item.healThreshold || 0.5),
                    });
                    item.endOfTurn(context);
                });
            });

            this.tickTimedEffects(events);

            // Ability end-of-turn ticks (Speed Boost, Shed Skin, Rain Dish...)
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ teamIndex, pokemon }) => {
                    const ability = abilityOf(pokemon);
                    if (typeof ability?.endOfTurn === "function") {
                        const context = this.abilityContext(pokemon, side, teamIndex, events);
                        context.weather = weatherKind;
                        ability.endOfTurn(context);
                    }
                });
            });
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ teamIndex, pokemon }) => {
                    if (!["poison", "toxic", "burn"].includes(pokemon.statusCondition)) return;
                    // Magic Guard blocks all indirect damage.
                    if (abilityOf(pokemon)?.indirectImmune) return;
                    if (pokemon.statusCondition === "toxic") {
                        // Real Toxic caps its counter at 15 (15/16 max HP per hit);
                        // without the cap this would keep escalating forever.
                        pokemon.toxicCounter = Math.min(15, Math.max(1, numberOr(pokemon.toxicCounter, 0) + 1));
                        if (abilityOf(pokemon)?.poisonHeal) {
                            if (pokemon.hp < pokemon.maxHp) {
                                const restored = Math.min(pokemon.maxHp - pokemon.hp, Math.max(1, Math.floor(pokemon.maxHp / 8)));
                                pokemon.hp += restored;
                                events.push({
                                    type: "heal", side, targetIndex: teamIndex, newHp: pokemon.hp,
                                    maxHp: pokemon.maxHp, amount: restored,
                                    message: `${pokemon.name}'s Poison Heal restored its HP!`,
                                });
                            }
                            return;
                        }
                    }
                    // Burn and Toxic both come off a 1/16 max-HP unit; plain
                    // Poison is a flat 1/8. Toxic scales the 1/16 unit by its
                    // counter instead of reusing Poison's larger 1/8 unit.
                    const divisor = pokemon.statusCondition === "poison" ? 8 : 16;
                    const multiplier = pokemon.statusCondition === "toxic" ? pokemon.toxicCounter : 1;
                    const damage = Math.max(1, Math.floor((pokemon.maxHp * multiplier) / divisor));
                    pokemon.hp = Math.max(0, pokemon.hp - damage);
                    pokemon.fainted = pokemon.hp === 0;
                    events.push({
                        type: "damage",
                        side,
                        targetIndex: teamIndex,
                        damage,
                        newHp: pokemon.hp,
                        maxHp: pokemon.maxHp,
                        message: `${pokemon.name} was hurt by ${pokemon.statusCondition === "burn" ? "its burn" : "poison"}!`,
                    });
                    if (pokemon.fainted) events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                });
            });
        }

        executeItem(action, events) {
            if (action.side !== "player") {
                events.push({
                    type: "rule",
                    side: action.side,
                    message: "Opposing Trainers cannot use Bag items in this mode.",
                });
                return;
            }
            const item = this.inventory[action.itemKey];
            const actor = this.teams.player[action.actorIndex];
            const target = this.teams.player[action.targetIndex];
            if (!item || item.quantity <= 0 || !target) return;
            item.quantity -= 1;
            if (item.effect.type === "revive") {
                if (!target.fainted) return;
                target.fainted = false;
                target.hp = Math.max(1, Math.floor(target.maxHp * item.effect.ratio));
            } else {
                if (target.fainted) return;
                target.hp = Math.min(target.maxHp, target.hp + item.effect.amount);
            }
            events.push({
                type: "item",
                side: "player",
                actorIndex: action.actorIndex,
                targetIndex: action.targetIndex,
                itemKey: action.itemKey,
                itemName: item.name,
                newHp: target.hp,
                maxHp: target.maxHp,
                message: `${this.playerName} used a ${item.name} on ${target.name}!`,
            });
        }

        executeCapture(action, events) {
            const actor = this.teams.player[action.actorIndex];
            const item = this.inventory[action.itemKey];
            if (!this.captureHandler || !item || item.quantity <= 0) return;
            events.push({
                type: "capture-throw",
                side: "player",
                actorIndex: action.actorIndex,
                itemKey: action.itemKey,
                message: `${this.playerName} threw a ${item.name}!`,
            });
            const result = this.captureHandler(action.itemKey);
            events.push({
                type: "capture",
                caught: result.caught,
                chance: result.chance,
                shakes: result.shakes ?? (result.caught ? 3 : 1),
                pokemonName: result.pokemon.name,
                message: result.caught ? `Gotcha! ${result.pokemon.name} was caught!` : `${result.pokemon.name} broke free!`,
            });
            if (result.caught) {
                this.result = "capture";
                events.push({ type: "result", result: "capture", message: `${result.pokemon.name} was caught and fully healed.` });
            }
        }

        rollChance(chance) {
            return numberOr(chance, 0) >= 100 || this.rng() * 100 < numberOr(chance, 0);
        }

        oppositeGenders(actor, target) {
            const a = actor?.gender;
            const b = target?.gender;
            if (!a || !b || a === "genderless" || b === "genderless") return false;
            return a !== b;
        }

        // --- battlefield state ------------------------------------------------

        // Cloud Nine and Air Lock switch the sky off for everyone while their
        // owner is on the field, so weather is asked for, never read raw.
        activeWeather() {
            if (!this.weather.kind || this.weather.turns <= 0) return null;
            const suppressed = ["player", "enemy"].some((side) => this.getActivePokemon(side)
                .some(({ pokemon }) => abilityOf(pokemon)?.suppressesWeather));
            return suppressed ? null : this.weather.kind;
        }

        setWeather(kind, turns, events, sourceLabel) {
            const field = fieldRegistry();
            const definition = field?.getWeather(kind);
            if (!definition) return false;
            if (this.weather.kind === kind && this.weather.turns > 0) return false;
            this.weather = { kind, turns: numberOr(turns, 5) };
            events.push({
                type: "weather",
                weather: kind,
                turns: this.weather.turns,
                phase: "start",
                message: sourceLabel
                    ? `${sourceLabel}: ${definition.startMessage}`
                    : definition.startMessage,
            });
            return true;
        }

        // Screens live on the side that set them.
        // Terrain only touches Pokemon standing on the ground.
        isGrounded(pokemon) {
            // Gravity drags everything down, Levitate and Flying included.
            if (this.fieldEffects.gravity > 0) return true;
            // Magnet Rise and Telekinesis lift it clear for a few turns.
            if (pokemon?.volatileStatus?.airborneTurns > 0) return false;
            const field = fieldRegistry();
            if (!field) return true;
            return field.isGrounded(pokemon?.types, pokemon?.ability?.slug);
        }

        activeTerrain() {
            return this.terrain.turns > 0 ? this.terrain.kind : null;
        }

        setTerrain(kind, turns, events, sourceLabel) {
            const field = fieldRegistry();
            const definition = field?.getTerrain(kind);
            if (!definition) return false;
            if (this.terrain.kind === kind && this.terrain.turns > 0) return false;
            this.terrain = { kind, turns: numberOr(turns, 5) };
            events.push({
                type: "terrain", terrain: kind, turns: this.terrain.turns, phase: "start",
                message: sourceLabel ? `${sourceLabel}: ${definition.startMessage}` : definition.startMessage,
            });
            return true;
        }

        setScreen(side, screenKey, events) {
            const field = fieldRegistry();
            const definition = field?.SCREENS?.[screenKey];
            if (!definition) return false;
            if (definition.requiresWeather && this.activeWeather() !== definition.requiresWeather) {
                events.push({ type: "rule", side, message: "But it failed!" });
                return false;
            }
            if (this.sideState[side].screens[screenKey] > 0) {
                events.push({ type: "rule", side, message: "But it failed!" });
                return false;
            }
            this.sideState[side].screens[screenKey] = definition.turns;
            events.push({
                type: "screen", side, screen: screenKey, phase: "start",
                message: definition.setMessage.replace("{side}", side === "player" ? "your" : "the opposing"),
            });
            return true;
        }

        // Hazards are laid on the *opposing* side.
        setHazard(targetSide, hazardKey, events) {
            const field = fieldRegistry();
            const definition = field?.HAZARDS?.[hazardKey];
            if (!definition) return false;
            const current = numberOr(this.sideState[targetSide].hazards[hazardKey], 0);
            if (current >= definition.layers) {
                events.push({ type: "rule", side: targetSide, message: "But it failed!" });
                return false;
            }
            this.sideState[targetSide].hazards[hazardKey] = current + 1;
            events.push({
                type: "hazard", side: targetSide, hazard: hazardKey,
                layers: current + 1, phase: "start",
                message: definition.setMessage,
            });
            return true;
        }

        clearHazards(side, events, label) {
            const hazards = this.sideState[side].hazards;
            const had = Object.values(hazards).some((count) => count > 0);
            Object.keys(hazards).forEach((key) => { hazards[key] = 0; });
            if (had) {
                events.push({
                    type: "hazard", side, phase: "clear",
                    message: `${label} blew away the hazards on ${side === "player" ? "your" : "the opposing"} side!`,
                });
            }
            return had;
        }

        clearScreens(side, events, label) {
            const screens = this.sideState[side].screens;
            const had = Object.values(screens).some((turns) => turns > 0);
            Object.keys(screens).forEach((key) => { screens[key] = 0; });
            if (had) {
                events.push({
                    type: "screen", side, phase: "clear",
                    message: `${label} shattered ${side === "player" ? "your" : "the opposing"} screens!`,
                });
            }
            return had;
        }

        // Combined screen multiplier for an incoming attack.
        screenMultiplier(side, damageClass, critical) {
            // A critical hit ignores screens entirely.
            if (critical) return 1;
            const field = fieldRegistry();
            if (!field) return 1;
            const screens = this.sideState[side].screens;
            let multiplier = 1;
            Object.entries(screens).forEach(([key, turns]) => {
                if (turns <= 0) return;
                const definition = field.SCREENS[key];
                if (!definition?.multiplier) return;
                const applies = definition.damageClass === "both" || definition.damageClass === damageClass;
                if (applies) multiplier *= definition.multiplier;
            });
            return multiplier;
        }

        // Everything a Pokemon walks into when it arrives on the field.
        applyEntryHazards(side, teamIndex, events) {
            const field = fieldRegistry();
            const pokemon = this.teams[side][teamIndex];
            if (!field || !pokemon || pokemon.fainted) return;
            const hazards = this.sideState[side].hazards;
            const ability = abilityOf(pokemon);
            const grounded = field.isGrounded(pokemon.types, pokemon.ability?.slug);
            const announce = (template) => events.push({
                type: "hazard", side, targetIndex: teamIndex, phase: "hit",
                message: String(template).replace("{name}", pokemon.name),
            });

            // Stealth Rock reaches everyone, airborne or not.
            if (hazards.stealthRock > 0 && !ability?.indirectImmune) {
                const definition = field.HAZARDS.stealthRock;
                const effectiveness = typeEffectiveness(definition.scaleByType, pokemon.types);
                const damage = Math.max(1, Math.floor(pokemon.maxHp * definition.damageBase * effectiveness));
                pokemon.hp = Math.max(0, pokemon.hp - damage);
                pokemon.fainted = pokemon.hp === 0;
                announce(definition.damageMessage);
                events.push({ type: "damage", side, targetIndex: teamIndex, damage, newHp: pokemon.hp, maxHp: pokemon.maxHp, message: "" });
                if (pokemon.fainted) {
                    events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                    return;
                }
            }
            if (!grounded) return;

            if (hazards.spikes > 0 && !ability?.indirectImmune) {
                const definition = field.HAZARDS.spikes;
                const ratio = definition.damageByLayer[Math.min(hazards.spikes, definition.layers) - 1];
                const damage = Math.max(1, Math.floor(pokemon.maxHp * ratio));
                pokemon.hp = Math.max(0, pokemon.hp - damage);
                pokemon.fainted = pokemon.hp === 0;
                announce(definition.damageMessage);
                events.push({ type: "damage", side, targetIndex: teamIndex, damage, newHp: pokemon.hp, maxHp: pokemon.maxHp, message: "" });
                if (pokemon.fainted) {
                    events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                    return;
                }
            }

            if (hazards.toxicSpikes > 0) {
                const definition = field.HAZARDS.toxicSpikes;
                // A grounded Poison type sweeps them up on the way in.
                if (definition.absorbedByTypes.some((type) => pokemon.types.includes(type))) {
                    this.sideState[side].hazards.toxicSpikes = 0;
                    announce(definition.absorbMessage);
                } else {
                    const condition = definition.statusByLayer[Math.min(hazards.toxicSpikes, definition.layers) - 1];
                    if (!pokemon.statusCondition && !this.statusImmune(pokemon, condition)) {
                        pokemon.statusCondition = condition;
                        pokemon.statusTurns = 0;
                        pokemon.toxicCounter = 0;
                        announce(definition.statusMessage);
                        events.push({ type: "status", side, targetIndex: teamIndex, status: condition, message: "" });
                    }
                }
            }

            if (hazards.stickyWeb > 0) {
                const definition = field.HAZARDS.stickyWeb;
                announce(definition.statMessage);
                this.applyStatStage(pokemon, side, teamIndex, definition.statDrop.stat, -definition.statDrop.stages, events, null);
            }
        }

        // True while anyone on the field is mid-Uproar. Derived from the
        // commitment rather than a timer so it cannot fall out of step with
        // the lock (a faint or a switch ends both at once).
        uproarActive() {
            if (this.uproarTurns > 0) return true;
            return ["player", "enemy"].some((side) => this.getActivePokemon(side).some(({ pokemon }) => {
                const pending = pokemon.pendingMove;
                if (!pending) return false;
                return Boolean(multiTurnOf(pokemon.moves[pending.moveIndex])?.uproar);
            }));
        }

        // An uproar keeps the whole field awake and jolts anyone already
        // sleeping back out of it.
        beginUproar(actor, side, teamIndex, events) {
            if (this.uproarActive()) return;
            this.uproarTurns = 1;
            events.push({
                type: "rule", side, targetIndex: teamIndex,
                message: `${actor.name} caused an uproar!`,
            });
            ["player", "enemy"].forEach((eachSide) => {
                this.getActivePokemon(eachSide).forEach(({ teamIndex: index, pokemon }) => {
                    if (pokemon.statusCondition !== "sleep") return;
                    pokemon.statusCondition = null;
                    pokemon.statusTurns = 0;
                    events.push({
                        type: "status", side: eachSide, targetIndex: index, status: null,
                        message: `${pokemon.name} woke up in the uproar!`,
                    });
                });
            });
        }

        // Trap chip, restriction counters, Leech Seed drain and the perish
        // count, all ticked once per turn on every active Pokemon.
        tickTimedEffects(events) {
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ teamIndex, pokemon }) => {
                    const volatiles = pokemon.volatileStatus;
                    const magicGuard = abilityOf(pokemon)?.indirectImmune;
                    // Magic Room silences every held item on the field, and
                    // Embargo silences one Pokemon's for a few turns.
                    if (volatiles.embargoTurns > 0) {
                        volatiles.embargoTurns -= 1;
                        if (volatiles.embargoTurns <= 0) {
                            events.push({
                                type: "status", side, targetIndex: teamIndex, status: null,
                                message: `${pokemon.name} can use items again!`,
                            });
                        }
                    }
                    volatiles.itemsSuppressed = this.fieldEffects.magicRoom > 0 || volatiles.embargoTurns > 0;

                    if (volatiles.trapped) {
                        if (!magicGuard) {
                            const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
                            pokemon.hp = Math.max(0, pokemon.hp - damage);
                            pokemon.fainted = pokemon.hp === 0;
                            events.push({
                                type: "damage", side, targetIndex: teamIndex, damage,
                                newHp: pokemon.hp, maxHp: pokemon.maxHp,
                                message: `${pokemon.name} is hurt by ${volatiles.trapMove || "the trap"}!`,
                            });
                            if (pokemon.fainted) {
                                events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                            }
                        }
                        volatiles.trapTurns = Math.max(0, numberOr(volatiles.trapTurns, 1) - 1);
                        if (volatiles.trapTurns <= 0) {
                            volatiles.trapped = false;
                            events.push({ type: "status", side, targetIndex: teamIndex, status: null, message: `${pokemon.name} was freed!` });
                        }
                    }

                    // Leech Seed only feeds a seeder that is still on the field.
                    if (volatiles.seeded && !pokemon.fainted && !magicGuard) {
                        const drain = Math.max(1, Math.floor(pokemon.maxHp / 8));
                        pokemon.hp = Math.max(0, pokemon.hp - drain);
                        pokemon.fainted = pokemon.hp === 0;
                        events.push({
                            type: "damage", side, targetIndex: teamIndex, damage: drain,
                            newHp: pokemon.hp, maxHp: pokemon.maxHp,
                            message: `${pokemon.name}'s health is sapped by Leech Seed!`,
                        });
                        const seeder = this.teams[volatiles.seeded.side]?.[volatiles.seeded.index];
                        const seederActive = this.active[volatiles.seeded.side]?.includes(volatiles.seeded.index);
                        if (seeder && seederActive && isBattleReady(seeder) && seeder.hp < seeder.maxHp) {
                            const before = seeder.hp;
                            seeder.hp = Math.min(seeder.maxHp, seeder.hp + drain);
                            events.push({
                                type: "heal", side: volatiles.seeded.side, targetIndex: volatiles.seeded.index,
                                newHp: seeder.hp, maxHp: seeder.maxHp, amount: seeder.hp - before, message: "",
                            });
                        }
                        if (pokemon.fainted) {
                            events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                        }
                    }

                    // A nightmare only lasts while its victim sleeps.
                    if (volatiles.nightmare) {
                        if (pokemon.statusCondition !== "sleep") {
                            volatiles.nightmare = false;
                        } else if (!magicGuard && !pokemon.fainted) {
                            const damage = Math.max(1, Math.floor(pokemon.maxHp / 4));
                            pokemon.hp = Math.max(0, pokemon.hp - damage);
                            pokemon.fainted = pokemon.hp === 0;
                            events.push({
                                type: "damage", side, targetIndex: teamIndex, damage,
                                newHp: pokemon.hp, maxHp: pokemon.maxHp,
                                message: `${pokemon.name} is locked in a nightmare!`,
                            });
                            if (pokemon.fainted) events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                        }
                    }
                    if (volatiles.cursed && !magicGuard && !pokemon.fainted) {
                        const damage = Math.max(1, Math.floor(pokemon.maxHp / 4));
                        pokemon.hp = Math.max(0, pokemon.hp - damage);
                        pokemon.fainted = pokemon.hp === 0;
                        events.push({
                            type: "damage", side, targetIndex: teamIndex, damage,
                            newHp: pokemon.hp, maxHp: pokemon.maxHp,
                            message: `${pokemon.name} is afflicted by the curse!`,
                        });
                        if (pokemon.fainted) events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name} fainted!` });
                    }
                    if (volatiles.airborneTurns > 0) {
                        volatiles.airborneTurns -= 1;
                        if (volatiles.airborneTurns <= 0) {
                            events.push({
                                type: "status", side, targetIndex: teamIndex, status: null,
                                message: `${pokemon.name} came back down.`,
                            });
                        }
                    }
                    if (volatiles.healBlockTurns > 0) {
                        volatiles.healBlockTurns -= 1;
                        if (volatiles.healBlockTurns <= 0) {
                            events.push({
                                type: "status", side, targetIndex: teamIndex, status: null,
                                message: `${pokemon.name}'s Heal Block wore off!`,
                            });
                        }
                    }

                    // Roots and rings top the user up before anything else
                    // whittles it down.
                    if (!pokemon.fainted && (volatiles.ingrain || volatiles.aquaRing)) {
                        const source = volatiles.ingrain ? "Ingrain" : "Aqua Ring";
                        const restored = Math.max(1, Math.floor(pokemon.maxHp / 16));
                        const previousHp = pokemon.hp;
                        pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + restored);
                        if (pokemon.hp > previousHp) {
                            events.push({
                                type: "heal", side, targetIndex: teamIndex,
                                newHp: pokemon.hp, maxHp: pokemon.maxHp, amount: pokemon.hp - previousHp,
                                message: volatiles.ingrain
                                    ? `${pokemon.name} absorbed nutrients with its roots!`
                                    : `${source} restored ${pokemon.name}'s HP!`,
                            });
                        }
                    }

                    // Encore lets go early if the move it forced runs dry.
                    if (volatiles.encoreTurns > 0) {
                        const encored = pokemon.moves[volatiles.encoredMoveIndex];
                        volatiles.encoreTurns -= 1;
                        if (volatiles.encoreTurns <= 0 || !encored || encored.pp <= 0) {
                            volatiles.encoreTurns = 0;
                            volatiles.encoredMoveIndex = null;
                            events.push({ type: "status", side, targetIndex: teamIndex, status: null, message: `${pokemon.name}'s encore ended!` });
                        }
                    }
                    if (volatiles.disableTurns > 0) {
                        volatiles.disableTurns -= 1;
                        if (volatiles.disableTurns <= 0) {
                            volatiles.disabledMoveIndex = null;
                            events.push({ type: "status", side, targetIndex: teamIndex, status: null, message: `${pokemon.name}'s move is no longer disabled!` });
                        }
                    }
                    if (volatiles.tauntTurns > 0) {
                        volatiles.tauntTurns -= 1;
                        if (volatiles.tauntTurns <= 0) {
                            volatiles.taunted = false;
                            events.push({ type: "status", side, targetIndex: teamIndex, status: null, message: `${pokemon.name} shook off the taunt!` });
                        }
                    }

                    // The perish count runs regardless of anything else.
                    if (Number.isInteger(volatiles.perishTurns) && !pokemon.fainted) {
                        volatiles.perishTurns -= 1;
                        if (volatiles.perishTurns <= 0) {
                            volatiles.perishTurns = null;
                            pokemon.hp = 0;
                            pokemon.fainted = true;
                            events.push({ type: "faint", side, targetIndex: teamIndex, message: `${pokemon.name}'s perish count hit zero!` });
                        } else {
                            events.push({
                                type: "status", side, targetIndex: teamIndex, status: "perish",
                                message: `${pokemon.name}'s perish count fell to ${volatiles.perishTurns}!`,
                            });
                        }
                    }
                });
            });
        }

        // Future Sight and Doom Desire land turns after they were used, on
        // whoever is standing in that slot by then.
        resolveDelayedAttacks(events) {
            if (!this.delayedAttacks?.length) return;
            const still = [];
            this.delayedAttacks.forEach((entry) => {
                entry.turns -= 1;
                if (entry.turns > 0) { still.push(entry); return; }
                const victim = this.teams[entry.side][this.active[entry.side][
                    this.active[entry.side].indexOf(entry.index)] ?? entry.index];
                const target = isBattleReady(victim) ? victim : null;
                if (!target) return;
                const defense = Math.max(1, modifiedStat(target, "specialDefense", {}));
                const base = (((2 * entry.level / 5 + 2) * entry.power * entry.attack / defense) / 50) + 2;
                const damage = Math.max(1, Math.floor(base * typeEffectiveness(entry.type, target.types)));
                target.hp = Math.max(0, target.hp - damage);
                target.fainted = target.hp === 0;
                events.push({
                    type: "damage", side: entry.side, targetIndex: entry.index, damage,
                    newHp: target.hp, maxHp: target.maxHp,
                    message: `${target.name} took the ${entry.moveName} attack!`,
                });
                if (target.fainted) {
                    events.push({ type: "faint", side: entry.side, targetIndex: entry.index, message: `${target.name} fainted!` });
                }
            });
            this.delayedAttacks = still;
        }

        // Count weather, screens and Uproar down at the close of each turn.
        tickFieldTimers(events) {
            const field = fieldRegistry();
            this.resolveDelayedAttacks(events);
            ["player", "enemy"].forEach((side) => {
                if (!(this.sideState[side].luckyChant > 0)) return;
                this.sideState[side].luckyChant -= 1;
                if (this.sideState[side].luckyChant <= 0) {
                    events.push({
                        type: "screen", side, screen: "luckyChant", phase: "end",
                        message: `${side === "player" ? "Your" : "The opposing"} team's Lucky Chant wore off.`,
                    });
                }
            });
            if (this.weather.kind && this.weather.turns > 0) {
                this.weather.turns -= 1;
                if (this.weather.turns <= 0) {
                    const definition = field?.getWeather(this.weather.kind);
                    events.push({
                        type: "weather", weather: this.weather.kind, phase: "end",
                        message: definition?.endMessage || "The weather cleared.",
                    });
                    this.weather = { kind: null, turns: 0 };
                }
            }
            if (this.terrain.kind && this.terrain.turns > 0) {
                this.terrain.turns -= 1;
                if (this.terrain.turns <= 0) {
                    const definition = field?.getTerrain(this.terrain.kind);
                    events.push({
                        type: "terrain", terrain: this.terrain.kind, phase: "end",
                        message: definition?.endMessage || "The terrain faded.",
                    });
                    this.terrain = { kind: null, turns: 0 };
                }
            }
            ["player", "enemy"].forEach((side) => {
                const screens = this.sideState[side].screens;
                Object.keys(screens).forEach((key) => {
                    if (screens[key] <= 0) return;
                    screens[key] -= 1;
                    if (screens[key] > 0) return;
                    const definition = field?.SCREENS?.[key];
                    events.push({
                        type: "screen", side, screen: key, phase: "end",
                        message: (definition?.endMessage || "The screen wore off.")
                            .replace("{side}", side === "player" ? "Your" : "The opposing"),
                    });
                });
            });
            // The opening-turn flag has done its job; from here the lock
            // itself keeps the uproar going (see uproarActive).
            this.uproarTurns = 0;
        }

        // --- ability plumbing -------------------------------------------------

        sideOf(pokemon) {
            if (this.teams.player.includes(pokemon)) return "player";
            if (this.teams.enemy.includes(pokemon)) return "enemy";
            return null;
        }

        // One shared stat-stage mutator so ability triggers (Defiant, Clear
        // Body...) fire identically no matter what caused the change.
        // `source` is the Pokemon responsible, null for self-inflicted.
        applyStatStage(pokemon, side, teamIndex, stat, stages, events, source) {
            const ability = abilityOf(pokemon);
            if (stages < 0 && source && source !== pokemon && this.sideState[side]?.screens?.mist > 0) {
                events.push({
                    type: "screen", side, targetIndex: teamIndex, screen: "mist",
                    message: `${pokemon.name} is protected by the mist!`,
                });
                return 0;
            }
            if (stages < 0 && source && source !== pokemon) {
                const guard = ability?.preventStatDrop;
                if (typeof guard === "function" && guard(stat)) {
                    events.push({
                        type: "ability", side, targetIndex: teamIndex,
                        abilityName: pokemon.ability?.name || "",
                        message: `${pokemon.name}'s ${pokemon.ability?.name} prevents stat loss!`,
                    });
                    return 0;
                }
            }
            // Simple doubles every change; Contrary turns it around. Applied
            // here so it covers moves, items and ability triggers alike.
            const scale = numberOr(ability?.statStageMult, 1);
            const scaled = scale === 1 ? stages : Math.trunc(stages * scale);
            const before = numberOr(pokemon.statStages[stat], 0);
            pokemon.statStages[stat] = clamp(before + scaled, -6, 6);
            const actual = pokemon.statStages[stat] - before;
            const label = stat.replace(/([A-Z])/g, " $1").toLowerCase();
            if (actual) {
                // The games grade the wording: one stage plain, two sharply,
                // three or more drastically.
                const size = Math.abs(actual) >= 3 ? " drastically"
                    : Math.abs(actual) >= 2 ? " sharply" : "";
                events.push({
                    type: "stat", side, targetIndex: teamIndex, stat, stages: actual,
                    message: `${pokemon.name}'s ${label} ${actual > 0 ? "rose" : "fell"}${size}!`,
                });
            } else if (scaled !== 0) {
                // Already pinned at the cap, which the games call out.
                events.push({
                    type: "rule", side, targetIndex: teamIndex,
                    message: `${pokemon.name}'s ${label} won't go any ${scaled > 0 ? "higher" : "lower"}!`,
                });
            }
            if (actual < 0 && source && source !== pokemon
                && typeof ability?.onStatLoweredByFoe === "function") {
                ability.onStatLoweredByFoe(this.abilityContext(pokemon, side, teamIndex, events));
            }
            return actual;
        }

        // The bundle of callbacks registry hooks receive. Every mutation goes
        // through engine helpers so events and immunities stay consistent.
        abilityContext(pokemon, side, teamIndex, events) {
            const engine = this;
            const format = (template, other) => String(template || "")
                .replace("{name}", pokemon.name)
                .replace("{other}", other?.name || "");
            return {
                engine,
                pokemon,
                side,
                teamIndex,
                rng: () => engine.rng(),
                announce(message, other) {
                    events.push({
                        type: "ability", side, targetIndex: teamIndex,
                        abilityName: pokemon.ability?.name || "",
                        message: format(message, other),
                    });
                },
                opponents() {
                    return engine.getActivePokemon(engine.opposingSide(side));
                },
                setWeather(kind) {
                    engine.setWeather(kind, 5, events, `${pokemon.name}'s ${pokemon.ability?.name}`);
                },
                setTerrain(kind) {
                    engine.setTerrain(kind, 5, events, `${pokemon.name}'s ${pokemon.ability?.name}`);
                },
                layHazardAgainstAttacker(hazardKey) {
                    engine.setHazard(engine.opposingSide(side), hazardKey, events);
                },
                raiseStat(target, stat, stages, message) {
                    const tSide = engine.sideOf(target) || side;
                    const tIndex = engine.teams[tSide].indexOf(target);
                    if (message) this.announce(message, target);
                    engine.applyStatStage(target, tSide, tIndex, stat, stages, events, null);
                },
                dropStat(target, stat, stages, message) {
                    const tSide = engine.sideOf(target) || side;
                    const tIndex = engine.teams[tSide].indexOf(target);
                    if (message) this.announce(message, target);
                    engine.applyStatStage(target, tSide, tIndex, stat, -Math.abs(stages), events, pokemon);
                },
                dropOpponentStat(entry, stat, stages, message) {
                    if (message) this.announce(message, entry.pokemon);
                    engine.applyStatStage(
                        entry.pokemon, engine.opposingSide(side), entry.teamIndex,
                        stat, -Math.abs(stages), events, pokemon,
                    );
                },
                maximizeStat(target, stat, message) {
                    const tSide = engine.sideOf(target) || side;
                    const tIndex = engine.teams[tSide].indexOf(target);
                    if (message) this.announce(message, target);
                    const before = numberOr(target.statStages[stat], 0);
                    target.statStages[stat] = 6;
                    if (target.statStages[stat] !== before) {
                        events.push({ type: "stat", side: tSide, targetIndex: tIndex, stat, stages: 6 - before, message: "" });
                    }
                },
                tryStatus(target, condition, chance, message) {
                    if (!target || target.fainted || target.statusCondition) return;
                    if (engine.rng() * 100 >= numberOr(chance, 100)) return;
                    if (engine.statusImmune(target, condition, pokemon)) return;
                    target.statusCondition = condition;
                    target.statusTurns = condition === "sleep" ? 2 + Math.floor(engine.rng() * 3) : 0;
                    target.toxicCounter = 0;
                    const tSide = engine.sideOf(target) || engine.opposingSide(side);
                    const tIndex = engine.teams[tSide].indexOf(target);
                    this.announce(message, target);
                    events.push({ type: "status", side: tSide, targetIndex: tIndex, status: condition, message: "" });
                },
                tryInfatuate(target, source, message) {
                    if (!target || target.fainted || target.volatileStatus?.infatuated) return;
                    if (abilityOf(target)?.preventVolatile?.includes("infatuated")) return;
                    if (!engine.oppositeGenders(source, target)) return;
                    target.volatileStatus.infatuated = true;
                    this.announce(message, target);
                },
                chip(target, ratio, message) {
                    if (!target || target.fainted) return;
                    if (abilityOf(target)?.indirectImmune) return;
                    const amount = Math.max(1, Math.floor(target.maxHp * ratio));
                    target.hp = Math.max(0, target.hp - amount);
                    target.fainted = target.hp === 0;
                    const tSide = engine.sideOf(target) || engine.opposingSide(side);
                    const tIndex = engine.teams[tSide].indexOf(target);
                    this.announce(message, target);
                    events.push({ type: "damage", side: tSide, targetIndex: tIndex, damage: amount, newHp: target.hp, maxHp: target.maxHp, message: "" });
                    if (target.fainted) events.push({ type: "faint", side: tSide, targetIndex: tIndex, message: `${target.name} fainted!` });
                },
                chipOpponent(entry, ratio, message) {
                    this.chip(entry.pokemon, ratio, message);
                },
                cureStatus(target, message) {
                    if (!target.statusCondition) return;
                    target.statusCondition = null;
                    target.statusTurns = 0;
                    target.toxicCounter = 0;
                    this.announce(message, target);
                },
            };
        }

        // The callbacks a held item receives. Mirrors abilityContext so the
        // two registries feel the same from the engine's side.
        itemContext(pokemon, side, teamIndex, events, extra) {
            const engine = this;
            const format = (template, other) => String(template || "")
                .replace("{name}", pokemon.name)
                .replace("{other}", other?.name || "");
            return {
                pokemon,
                side,
                teamIndex,
                rng: () => engine.rng(),
                ...(extra || {}),
                announce(message, other) {
                    events.push({
                        type: "item", side, targetIndex: teamIndex,
                        message: format(message, other),
                    });
                },
                spend() { pokemon.heldItemSpent = true; },
                heal(target, ratio, message) {
                    this.healFlat(target, Math.max(1, Math.floor(target.maxHp * ratio)), message);
                },
                healFlat(target, amount, message) {
                    const before = target.hp;
                    target.hp = Math.min(target.maxHp, target.hp + amount);
                    if (target.hp === before) return;
                    const tSide = engine.sideOf(target) || side;
                    const tIndex = engine.teams[tSide].indexOf(target);
                    this.announce(message, target);
                    events.push({ type: "heal", side: tSide, targetIndex: tIndex, newHp: target.hp, maxHp: target.maxHp, amount: target.hp - before, message: "" });
                },
                chip(target, ratio, message) {
                    if (!target || target.fainted) return;
                    if (abilityOf(target)?.indirectImmune) return;
                    const amount = Math.max(1, Math.floor(target.maxHp * ratio));
                    target.hp = Math.max(0, target.hp - amount);
                    target.fainted = target.hp === 0;
                    const tSide = engine.sideOf(target) || side;
                    const tIndex = engine.teams[tSide].indexOf(target);
                    this.announce(message, target);
                    events.push({ type: "damage", side: tSide, targetIndex: tIndex, damage: amount, newHp: target.hp, maxHp: target.maxHp, message: "" });
                    if (target.fainted) events.push({ type: "faint", side: tSide, targetIndex: tIndex, message: `${target.name} fainted!` });
                },
                inflict(target, condition, message) {
                    if (target.statusCondition || engine.statusImmune(target, condition)) return;
                    target.statusCondition = condition;
                    target.statusTurns = 0;
                    target.toxicCounter = 0;
                    this.announce(message, target);
                    events.push({ type: "status", side, targetIndex: teamIndex, status: condition, message: "" });
                },
                cure(target, message) {
                    if (!target.statusCondition) return;
                    target.statusCondition = null;
                    target.statusTurns = 0;
                    target.toxicCounter = 0;
                    this.announce(message, target);
                    events.push({ type: "status", side, targetIndex: teamIndex, status: null, message: "" });
                },
                raiseStat(target, stat, stages) {
                    const tSide = engine.sideOf(target) || side;
                    engine.applyStatStage(target, tSide, engine.teams[tSide].indexOf(target), stat, stages, events, null);
                },
            };
        }

        // Life Orb, Shell Bell, Rocky Helmet, Weakness Policy and King's Rock
        // all resolve once a hit has landed.
        runHeldItemHits(hit) {
            const { actor, actorSide, actorIndex, target, targetSide, targetIndex, damage, effectiveness, events } = hit;
            if (damage <= 0) return;
            const attackerItem = heldItemOf(actor);
            const defenderItem = heldItemOf(target);

            if (attackerItem?.recoilOnAttack && !actor.fainted && !abilityOf(actor)?.indirectImmune) {
                this.itemContext(actor, actorSide, actorIndex, events)
                    .chip(actor, attackerItem.recoilOnAttack, "{name} was hurt by its Life Orb!");
            }
            if (typeof attackerItem?.onDamageDealt === "function" && !actor.fainted) {
                const ctx = this.itemContext(actor, actorSide, actorIndex, events, { damage });
                attackerItem.onDamageDealt(ctx);
            }
            if (target === actor || target.fainted) return;
            if (typeof defenderItem?.onContactReceived === "function" && hit.makesContact) {
                const ctx = this.itemContext(target, targetSide, targetIndex, events, { attacker: actor });
                defenderItem.onContactReceived(ctx);
            }
            if (effectiveness > 1 && typeof defenderItem?.onHitSuperEffective === "function") {
                const ctx = this.itemContext(target, targetSide, targetIndex, events);
                defenderItem.onHitSuperEffective(ctx);
                if (defenderItem.singleUse) target.heldItemSpent = true;
            }
        }

        // Post-damage triggers: contact punishment, crit rage, type-triggered
        // boosts, half-HP triggers.
        runOnHitAbilities(hit) {
            const { actor, actorSide, actorIndex, actorAbility, target, targetSide, targetIndex, targetAbility, moveType, physical, critical, damage, events } = hit;
            if (damage <= 0 || target === actor) return;
            const targetCtx = () => {
                const ctx = this.abilityContext(target, targetSide, targetIndex, events);
                ctx.attacker = actor;
                ctx.defender = target;
                ctx.moveType = moveType;
                return ctx;
            };
            const actorCtx = () => {
                const ctx = this.abilityContext(actor, actorSide, actorIndex, events);
                ctx.attacker = actor;
                ctx.defender = target;
                ctx.moveType = moveType;
                return ctx;
            };
            const contact = Boolean(hit.move.makesContact);
            if (!target.fainted) {
                if (contact && !actor.fainted && typeof targetAbility?.onContactReceived === "function") targetAbility.onContactReceived(targetCtx());
                if (physical && typeof targetAbility?.onPhysicalHitReceived === "function") targetAbility.onPhysicalHitReceived(targetCtx());
                if (typeof targetAbility?.onHitByType === "function") targetAbility.onHitByType(targetCtx());
                if (typeof targetAbility?.onDamaged === "function") targetAbility.onDamaged(targetCtx());
                if (critical && typeof targetAbility?.onCritReceived === "function") targetAbility.onCritReceived(targetCtx());
                const wasAbove = target.hp + damage > target.maxHp / 2;
                if (wasAbove && target.hp <= target.maxHp / 2
                    && typeof targetAbility?.onDamagedBelowHalf === "function") {
                    targetAbility.onDamagedBelowHalf(targetCtx());
                }
            }
            if (contact && !actor.fainted && typeof actorAbility?.onContactDealt === "function") actorAbility.onContactDealt(actorCtx());
            if (!target.fainted && !actor.fainted && typeof actorAbility?.onDamageDealt === "function") actorAbility.onDamageDealt(actorCtx());
            if (target.fainted && !actor.fainted) {
                // Aftermath scorches whoever landed the fatal contact blow --
                // unless Damp is on the field to smother it.
                if (contact && targetAbility?.chipOnContactKO) {
                    const damp = ["player", "enemy"].flatMap((side) => this.getActivePokemon(side))
                        .some((entry) => abilityOf(entry.pokemon)?.blocksSelfFaint);
                    if (!damp) {
                        const chip = Math.max(1, Math.floor(actor.maxHp / 4));
                        actor.hp = Math.max(0, actor.hp - chip);
                        actor.fainted = actor.hp === 0;
                        events.push({
                            type: "damage", side: actorSide, targetIndex: actorIndex, damage: chip,
                            newHp: actor.hp, maxHp: actor.maxHp,
                            message: `${actor.name} was caught in ${target.name}'s Aftermath!`,
                        });
                        if (actor.fainted) events.push({ type: "faint", side: actorSide, targetIndex: actorIndex, message: `${actor.name} fainted!` });
                    }
                }
                // Innards Out strikes back with the health the victim had left.
                if (targetAbility?.damageEqualToLastHp) {
                    const payback = Math.max(1, Math.min(numberOr(damage, 1), target.maxHp));
                    actor.hp = Math.max(0, actor.hp - payback);
                    actor.fainted = actor.hp === 0;
                    events.push({
                        type: "damage", side: actorSide, targetIndex: actorIndex, damage: payback,
                        newHp: actor.hp, maxHp: actor.maxHp,
                        message: `${target.name}'s Innards Out struck back!`,
                    });
                    if (actor.fainted) events.push({ type: "faint", side: actorSide, targetIndex: actorIndex, message: `${actor.name} fainted!` });
                }
            }
        }

        // Announce and run switch-in abilities for a Pokemon entering the
        // field, then walk it into whatever hazards are waiting.
        runSwitchInAbility(side, teamIndex, events) {
            const pokemon = this.teams[side][teamIndex];
            const ability = abilityOf(pokemon);
            // Drizzle, Drought, Sand Stream and Snow Warning change the sky on
            // arrival.
            const field = fieldRegistry();
            const summoned = field?.WEATHER_ABILITIES?.[pokemon?.ability?.slug];
            if (summoned) this.setWeather(summoned, 5, events, `${pokemon.name}'s ${pokemon.ability.name}`);
            const summonedTerrain = field?.TERRAIN_ABILITIES?.[pokemon?.ability?.slug];
            if (summonedTerrain) this.setTerrain(summonedTerrain, 5, events, `${pokemon.name}'s ${pokemon.ability.name}`);
            if (typeof ability?.onSwitchIn === "function") {
                ability.onSwitchIn(this.abilityContext(pokemon, side, teamIndex, events));
            }
            this.applyEntryHazards(side, teamIndex, events);
        }

        statusImmune(target, condition, source) {
            // Misty Terrain blocks everything; Electric Terrain blocks sleep.
            const terrainNow = this.activeTerrain();
            if (terrainNow && fieldRegistry()?.terrainBlocksStatus(terrainNow, condition, this.isGrounded(target))) {
                return true;
            }
            // Grass types cannot be seeded.
            if (condition === "seed" && (target.types || []).includes("grass")) return true;
            // Nobody sleeps through an uproar.
            if (condition === "sleep" && this.uproarActive()) return true;
            // Safeguard shields the whole side from status conditions.
            const side = this.sideOf(target);
            if (side && this.sideState[side]?.screens?.safeguard > 0) return true;
            // Leaf Guard only holds while the sun is out.
            const weatherNow = this.activeWeather();
            const weatherGuard = abilityOf(target)?.statusImmuneInWeather;
            if (weatherNow && Array.isArray(weatherGuard) && weatherGuard.includes(weatherNow)) return true;
            if (condition === "sleep") {
                const veiled = this.getActivePokemon(this.sideOf(target) || "player")
                    .some((entry) => abilityOf(entry.pokemon)?.sleepGuardAllies);
                if (veiled) return true;
            }
            const guard = abilityOf(target)?.preventStatus;
            if (Array.isArray(guard) && guard.includes(condition)) return true;
            // Corrosion poisons even Steel and Poison types.
            if ((condition === "poison" || condition === "toxic")
                && abilityOf(source)?.statusTargetOverride?.(condition)) {
                return false;
            }
            return this.baseStatusImmune(target, condition);
        }

        baseStatusImmune(target, condition) {
            if (condition === "burn") return target.types.includes("fire");
            if (condition === "freeze") return target.types.includes("ice");
            if (condition === "paralysis") return target.types.includes("electric");
            if (condition === "poison" || condition === "toxic") return target.types.includes("poison") || target.types.includes("steel");
            return false;
        }

        // Weather, hazard, screen and field-clearing moves. Returns true when
        // the move was one of them and has been fully handled.
        applyFieldMove(actor, actorSide, target, targetSide, move, events) {
            const field = fieldRegistry();
            if (!field) return false;
            let handled = false;

            const weatherMove = field.weatherMoveFor(move.slug);
            if (weatherMove) {
                this.setWeather(weatherMove.weather, weatherMove.turns, events, null);
                handled = true;
            }
            const terrainMove = field.terrainMoveFor(move.slug);
            if (terrainMove) {
                this.setTerrain(terrainMove.terrain, terrainMove.turns, events, null);
                handled = true;
            }
            const screenKey = field.SCREEN_MOVES?.[move.slug]
                || (field.screenFor(move.slug) ? field.screenFor(move.slug).key : null);
            if (screenKey) {
                this.setScreen(actorSide, screenKey, events);
                handled = true;
            }
            const hazard = field.hazardFor(move.slug);
            if (hazard) {
                this.setHazard(this.opposingSide(actorSide), hazard.key, events);
                handled = true;
            }
            const clearing = field.clearingMoveFor(move.slug);
            if (clearing) {
                if (clearing.hazards === "own" || clearing.hazards === "both") {
                    this.clearHazards(actorSide, events, move.displayName);
                }
                if (clearing.hazards === "both") {
                    this.clearHazards(this.opposingSide(actorSide), events, move.displayName);
                }
                if (clearing.screens === "foe") {
                    this.clearScreens(this.opposingSide(actorSide), events, move.displayName);
                }
                // Defog and Rapid Spin still do their normal job on top.
            }
            return handled;
        }

        // Bind/Disable/Leech Seed/Perish Song/Destiny Bond -- effects that sit
        // on the target and tick down, rather than resolving immediately.
        // Swaps whoever stands in `slot` for a bench Pokemon. Used by Roar and
        // Whirlwind (random replacement) and by the self-switch moves, which
        // take the first healthy one on the bench rather than prompting.
        swapInFromBench(side, slot, events, { random = false, carry = null, message = null, preferIndex = null } = {}) {
            const outgoing = this.teams[side][this.active[side][slot]];
            const occupied = new Set(this.active[side]);
            const bench = this.teams[side]
                .map((pokemon, index) => ({ pokemon, index }))
                .filter(({ pokemon, index }) => isBattleReady(pokemon) && !occupied.has(index));
            if (!bench.length) return false;
            const chosen = Number.isInteger(preferIndex)
                ? bench.find((entry) => entry.index === preferIndex)
                : null;
            const pick = chosen || (random ? bench[Math.floor(this.rng() * bench.length)] : bench[0]);
            if (outgoing) {
                outgoing.pendingMove = null;
                outgoing.toxicCounter = 0;
                abilityOf(outgoing)?.onSwitchOut?.(outgoing);
                if (!carry) outgoing.statStages = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0]));
                restoreBattleMutations(outgoing);
                outgoing.volatileStatus = {};
            }
            this.active[side][slot] = pick.index;
            pick.pokemon.turnsActive = -1;
            pick.pokemon.pendingMove = null;
            // Baton Pass and Shed Tail hand their stages and decoy along.
            pick.pokemon.volatileStatus = carry?.volatiles || {};
            if (carry?.stages) pick.pokemon.statStages = { ...carry.stages };
            events.push({
                type: "switch", side, slot, targetIndex: pick.index,
                message: message
                    ? String(message).replace("{name}", pick.pokemon.name)
                    : (side === "player"
                        ? `${outgoing?.name || "Your Pokemon"} was dragged out! Go, ${pick.pokemon.name}!`
                        : `${outgoing?.name || "The foe"} was dragged out! The opponent sent out ${pick.pokemon.name}!`),
            });
            this.runSwitchInAbility(side, pick.index, events);
            return true;
        }

        // Spending the store also gives back the Defense and Sp. Def each
        // charge granted, the way the games unwind it.
        releaseStockpile(pokemon, side, teamIndex, events) {
            const stored = numberOr(pokemon.volatileStatus.stockpile, 0);
            if (!stored) return;
            pokemon.volatileStatus.stockpile = 0;
            this.applyStatStage(pokemon, side, teamIndex, "defense", -stored, events, null);
            this.applyStatStage(pokemon, side, teamIndex, "specialDefense", -stored, events, null);
            events.push({
                type: "status", side, targetIndex: teamIndex, status: null,
                message: `${pokemon.name}'s stockpiled effect wore off!`,
            });
        }

        applyTimedEffects(actor, actorSide, actorIndex, target, targetSide, targetIndex, move, events) {
            const effects = move.effects || {};
            const failed = () => events.push({
                type: "rule", side: targetSide, targetIndex, message: "But it failed!",
            });

            if (effects.trap && !target.fainted && !target.volatileStatus.trapped) {
                const span = effects.trap;
                target.volatileStatus.trapped = true;
                target.volatileStatus.trapMove = move.displayName;
                target.volatileStatus.trapTurns = span.min + Math.floor(this.rng() * (span.max - span.min + 1));
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "trapped",
                    message: `${target.name} became trapped in the vortex!`,
                });
            }

            if (effects.restrict && !target.fainted
                && this.getActivePokemon(this.sideOf(target) || targetSide)
                    .some((entry) => abilityOf(entry.pokemon)?.restrictImmuneSelfAndAllies)) {
                events.push({
                    type: "ability", side: targetSide, targetIndex,
                    abilityName: "Aroma Veil",
                    message: `${target.name} is protected by an aromatic veil!`,
                });
            } else if (effects.restrict && !target.fainted) {
                const kind = effects.restrict;
                const volatiles = target.volatileStatus;
                if (kind === "disable") {
                    if (!Number.isInteger(target.lastMoveIndex)) return failed();
                    volatiles.disabledMoveIndex = target.lastMoveIndex;
                    volatiles.disableTurns = 4;
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: "disable",
                        message: `${target.name}'s ${target.moves[target.lastMoveIndex]?.displayName || "move"} was disabled!`,
                    });
                } else if (kind === "encore") {
                    if (!Number.isInteger(target.lastMoveIndex)) return failed();
                    volatiles.encoredMoveIndex = target.lastMoveIndex;
                    volatiles.encoreTurns = 3;
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: "encore",
                        message: `${target.name} must do an encore!`,
                    });
                } else if (kind === "torment") {
                    volatiles.tormented = true;
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: "torment",
                        message: `${target.name} was subjected to torment!`,
                    });
                } else if (kind === "taunt") {
                    volatiles.taunted = true;
                    volatiles.tauntTurns = 3;
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: "taunt",
                        message: `${target.name} fell for the taunt!`,
                    });
                }
            }

            if (effects.seed && !target.fainted) {
                if (this.statusImmune(target, "seed") || target.volatileStatus.seeded) {
                    failed();
                } else {
                    // Remember who planted it so the drain knows where to go.
                    target.volatileStatus.seeded = { side: actorSide, index: actorIndex };
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: "seeded",
                        message: `${target.name} was seeded!`,
                    });
                }
            }

            if (effects.perish && !target.fainted && !Number.isInteger(target.volatileStatus.perishTurns)) {
                target.volatileStatus.perishTurns = 3;
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "perish",
                    message: `${target.name} got a perish count of 3!`,
                });
            }

            if (effects.destinyBond) {
                actor.volatileStatus.destinyBond = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "destiny-bond",
                    message: `${actor.name} is trying to take its foe down with it!`,
                });
            }
            return undefined;
        }

        applyMoveEffects(actor, actorSide, actorIndex, target, targetSide, targetIndex, move, damage, events, options) {
            const firstTarget = options?.firstTarget !== false;
            // Magic Bounce turns a foe's status move straight back on its
            // user -- stat drops, status, hazards, taunts, all of it, since
            // everything a move does flows through this funnel. A bounced
            // move does not bounce again.
            if (target !== actor && targetSide !== actorSide && (move.power || 0) <= 0 && !this._bouncing) {
                const bouncer = !abilityOf(actor)?.ignoreDefenderAbility ? abilityOf(target) : null;
                if (bouncer?.reflectsStatus) {
                    events.push({
                        type: "ability", side: targetSide, targetIndex,
                        abilityName: target.ability?.name || "",
                        message: `${target.name} bounced the ${move.displayName} back!`,
                    });
                    this._bouncing = true;
                    try {
                        this.applyMoveEffects(target, targetSide, targetIndex, actor, actorSide, actorIndex, move, 0, events);
                    } finally {
                        this._bouncing = false;
                    }
                    return;
                }
            }
            const effects = move.effects || {};
            this.applyFieldMove(actor, actorSide, target, targetSide, move, events);
            this.applyTimedEffects(actor, actorSide, actorIndex, target, targetSide, targetIndex, move, events);
            // Strength Sap drains by the foe's Attack rather than by damage
            // dealt, and reads that stat before the drop the move's own text
            // already asks the stat-change pass for.
            if (effects.strengthSap && target !== actor && !target.fainted && !actor.fainted) {
                const drained = Math.max(1, Math.floor(modifiedStat(target, "attack", {})));
                const previousHp = actor.hp;
                actor.hp = Math.min(actor.maxHp, actor.hp + drained);
                const restored = actor.hp - previousHp;
                if (restored > 0) {
                    events.push({
                        type: "heal", side: actorSide, targetIndex: actorIndex,
                        newHp: actor.hp, maxHp: actor.maxHp, amount: restored,
                        sourceKind: "move", sourceName: move.displayName,
                        message: `${target.name}'s Attack was sapped and ${actor.name} recovered ${restored} HP!`,
                    });
                }
            }
            const actorAbility = abilityOf(actor);
            const targetAbility = actorAbility?.ignoreDefenderAbility && target !== actor ? null : abilityOf(target);
            const isDamaging = move.power > 0;
            // Sheer Force trades away the move's own extras; Shield Dust
            // blocks add-on effects riding on damaging moves aimed at us.
            const suppressSecondary = Boolean(actorAbility?.suppressOwnSecondary && isDamaging);
            const dustBlocked = Boolean(isDamaging && target !== actor && targetAbility?.blockIncomingSecondary);
            const chanceMult = actorAbility?.secondaryChanceMult || 1;
            const rollSecondary = (chance) => this.rollChance(Math.min(100, numberOr(chance, 0) * chanceMult));

            // A standing substitute takes the hit for everything aimed at its
            // owner from outside.
            const behindDecoy = target !== actor && numberOr(target.volatileStatus?.substituteHp, 0) > 0;

            for (const change of effects.statChanges || []) {
                if (change.target === "self" && !firstTarget) continue;
                if (change.target !== "self" && target.fainted) continue;
                if (change.target !== "self" && behindDecoy) continue;
                if (change.target !== "self" && change.stages < 0 && (suppressSecondary || dustBlocked)) continue;
                const recipient = change.target === "self" ? actor : target;
                const recipientSide = change.target === "self" ? actorSide : targetSide;
                const recipientIndex = change.target === "self" ? actorIndex : targetIndex;
                if (!rollSecondary(change.chance)) continue;
                this.applyStatStage(
                    recipient, recipientSide, recipientIndex, change.stat, change.stages,
                    events, change.target === "self" ? null : actor,
                );
            }

            let status = effects.statusEffect;
            // "May poison, paralyze, or sleep the foe" -- the games roll which
            // of the three lands rather than always picking the same one.
            if (status && effects.statusChoices?.length) {
                status = {
                    ...status,
                    condition: effects.statusChoices[Math.floor(this.rng() * effects.statusChoices.length)],
                };
            }
            // The games name the reason rather than silently doing nothing.
            if (status && !isDamaging && target.statusCondition) {
                const named = {
                    paralysis: "paralyzed",
                    sleep: "asleep",
                    freeze: "frozen solid",
                    toxic: "poisoned",
                    poison: "poisoned",
                    burn: "burned",
                }[target.statusCondition] || target.statusCondition;
                events.push({
                    type: "rule", side: targetSide, targetIndex,
                    message: `${target.name} is already ${named}!`,
                });
            }
            if (status && !suppressSecondary && !dustBlocked && !behindDecoy
                && !target.statusCondition
                && !this.statusImmune(target, status.condition, actor)
                && rollSecondary(status.chance)) {
                target.statusCondition = status.condition;
                target.statusTurns = status.condition === "sleep" ? 2 + Math.floor(this.rng() * 3) : 0;
                target.toxicCounter = 0;
                events.push({
                    type: "status", side: targetSide, targetIndex, status: status.condition,
                    message: `${target.name} ${STATUS_APPLIED_TEXT[status.condition] || `is now ${status.condition}`}!`,
                });
                // Synchronize bounces burn/poison/paralysis back at the source.
                if (target !== actor && typeof targetAbility?.onStatusedByFoe === "function") {
                    const ctx = this.abilityContext(target, targetSide, targetIndex, events);
                    ctx.condition = status.condition;
                    ctx.source = actor;
                    targetAbility.onStatusedByFoe(ctx);
                }
            }
            if (effects.confusionChance && !suppressSecondary && !dustBlocked
                && !target.volatileStatus.confused
                && !targetAbility?.preventVolatile?.includes("confused")
                && rollSecondary(effects.confusionChance)) {
                target.volatileStatus.confused = true;
                target.volatileStatus.confusionTurns = 2 + Math.floor(this.rng() * 4);
                events.push({ type: "status", side: targetSide, targetIndex, status: "confusion", message: `${target.name} became confused!` });
            }
            if (effects.infatuate && !target.volatileStatus.infatuated && !target.fainted
                && !targetAbility?.preventVolatile?.includes("infatuated")) {
                target.volatileStatus.infatuated = true;
                events.push({
                    type: "status",
                    side: targetSide,
                    targetIndex,
                    status: "infatuation",
                    message: `${target.name} fell in love with ${actor.name}!`,
                });
            }
            // King's Rock and Razor Fang from the bag, Stench from the ability.
            // Landing a flinch is silent, as in the mainline games: the only
            // thing worth reporting is the turn actually being lost, which
            // "X flinched and couldn't move!" says when the victim's turn
            // comes up. Announcing it here as well meant a Pokemon that was
            // knocked out first, or had already attacked, was still declared
            // to have flinched over something that never happened.
            const itemFlinch = isDamaging && !target.fainted && !dustBlocked
                && Math.max(heldItemOf(actor)?.flinchChance || 0, actorAbility?.flinchChance || 0);
            if (itemFlinch && !effects.flinchChance
                && !targetAbility?.preventVolatile?.includes("flinched")
                && this.targetHasPendingMove(targetSide, targetIndex)
                && this.rollChance(itemFlinch)) {
                target.volatileStatus.flinched = true;
            }
            if (effects.flinchChance && !target.fainted && !suppressSecondary && !dustBlocked
                && !targetAbility?.preventVolatile?.includes("flinched")
                && this.targetHasPendingMove(targetSide, targetIndex)
                && rollSecondary(effects.flinchChance)) {
                target.volatileStatus.flinched = true;
            }
            if (effects.drainRatio && damage > 0 && !actor.fainted) {
                // Liquid Ooze turns the drained HP into damage instead.
                if (target !== actor && targetAbility?.drainBackfire) {
                    const backfire = Math.max(1, Math.floor(damage * effects.drainRatio));
                    actor.hp = Math.max(0, actor.hp - backfire);
                    actor.fainted = actor.hp === 0;
                    events.push({
                        type: "damage", side: actorSide, targetIndex: actorIndex,
                        damage: backfire, newHp: actor.hp, maxHp: actor.maxHp,
                        message: `${actor.name} sucked up Liquid Ooze!`,
                    });
                    if (actor.fainted) events.push({ type: "faint", side: actorSide, targetIndex: actorIndex, message: `${actor.name} fainted!` });
                    return;
                }
                const healing = Math.max(1, Math.floor(damage * effects.drainRatio));
                const previousHp = actor.hp;
                actor.hp = Math.min(actor.maxHp, actor.hp + healing);
                const restored = actor.hp - previousHp;
                if (restored > 0) events.push({
                    type: "heal",
                    side: actorSide,
                    targetIndex: actorIndex,
                    newHp: actor.hp,
                    maxHp: actor.maxHp,
                    amount: restored,
                    sourceKind: "move",
                    sourceName: move.displayName,
                    message: actorSide === "enemy"
                        ? `${actor.name} drained ${restored} HP with ${move.displayName} (move effect, not a Trainer item).`
                        : `${actor.name} drained ${restored} HP with ${move.displayName}!`,
                });
            }
            if (effects.recoilRatio && damage > 0 && !actor.fainted
                && !actorAbility?.noRecoil && !actorAbility?.indirectImmune) {
                const recoil = Math.max(1, Math.floor(damage * effects.recoilRatio));
                actor.hp = Math.max(0, actor.hp - recoil);
                actor.fainted = actor.hp === 0;
                events.push({ type: "damage", side: actorSide, targetIndex: actorIndex, damage: recoil, newHp: actor.hp, maxHp: actor.maxHp, message: `${actor.name} was hurt by recoil!` });
            }
            if (effects.healRatio && move.power <= 0 && !actor.fainted
                && !(actor.volatileStatus?.healBlockTurns > 0)) {
                // Moonlight, Synthesis, Morning Sun and Shore Up all read the
                // sky: two thirds in their best weather, a quarter otherwise.
                const fieldApi = fieldRegistry();
                let ratio = effects.healRatio;
                if (fieldApi?.WEATHER_HEAL_MOVES.has(move.slug)) {
                    const weatherNow = this.activeWeather();
                    ratio = weatherNow ? (fieldApi.getWeather(weatherNow)?.healRatio ?? 0.5) : 0.5;
                }
                const healing = Math.max(1, Math.floor(actor.maxHp * ratio));
                const previousHp = actor.hp;
                actor.hp = Math.min(actor.maxHp, actor.hp + healing);
                const restored = actor.hp - previousHp;
                if (restored > 0) events.push({
                    type: "heal",
                    side: actorSide,
                    targetIndex: actorIndex,
                    newHp: actor.hp,
                    maxHp: actor.maxHp,
                    amount: restored,
                    sourceKind: "move",
                    sourceName: move.displayName,
                    message: actorSide === "enemy"
                        ? `${actor.name} recovered ${restored} HP using ${move.displayName} (move effect, not a Trainer item).`
                        : `${actor.name} recovered ${restored} HP using ${move.displayName}!`,
                });
            }
            // Heals that reach the ally beside the user as well.
            if (effects.allyHeal && !actor.fainted) {
                const ratio = numberOr(effects.allyHeal.ratio, 0.25);
                let helped = false;
                this.getActivePokemon(actorSide).forEach(({ teamIndex, pokemon }) => {
                    if (!isBattleReady(pokemon)) return;
                    const previousHp = pokemon.hp;
                    pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + Math.max(1, Math.floor(pokemon.maxHp * ratio)));
                    const restored = pokemon.hp - previousHp;
                    if (restored > 0) {
                        helped = true;
                        events.push({
                            type: "heal", side: actorSide, targetIndex: teamIndex,
                            newHp: pokemon.hp, maxHp: pokemon.maxHp, amount: restored,
                            sourceKind: "move", sourceName: move.displayName,
                            message: `${pokemon.name} recovered ${restored} HP!`,
                        });
                    }
                    if (effects.allyHeal.cureStatus && pokemon.statusCondition) {
                        helped = true;
                        pokemon.statusCondition = null;
                        pokemon.statusTurns = 0;
                        pokemon.toxicCounter = 0;
                        events.push({
                            type: "status", side: actorSide, targetIndex: teamIndex, status: null,
                            message: `${pokemon.name}'s status returned to normal!`,
                        });
                    }
                });
                if (!helped) events.push({ type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!" });
            }
            // Purify cures the target, and only then pays the user.
            if (effects.purify && target !== actor) {
                if (!target.statusCondition) {
                    events.push({ type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!" });
                } else {
                    target.statusCondition = null;
                    target.statusTurns = 0;
                    target.toxicCounter = 0;
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: null,
                        message: `${target.name}'s status returned to normal!`,
                    });
                    const previousHp = actor.hp;
                    actor.hp = Math.min(actor.maxHp, actor.hp + Math.max(1, Math.floor(actor.maxHp * effects.purify)));
                    const restored = actor.hp - previousHp;
                    if (restored > 0) {
                        events.push({
                            type: "heal", side: actorSide, targetIndex: actorIndex,
                            newHp: actor.hp, maxHp: actor.maxHp, amount: restored,
                            sourceKind: "move", sourceName: move.displayName,
                            message: `${actor.name} recovered ${restored} HP!`,
                        });
                    }
                }
            }
            // Revival Blessing brings a fainted bench member back at half HP.
            if (effects.partyRevive) {
                const benchIndex = this.teams[actorSide].findIndex(
                    (pokemon, index) => pokemon && pokemon.fainted && !this.active[actorSide].includes(index));
                if (benchIndex < 0) {
                    events.push({ type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!" });
                } else {
                    const revived = this.teams[actorSide][benchIndex];
                    revived.hp = Math.max(1, Math.floor(revived.maxHp * effects.partyRevive));
                    revived.fainted = false;
                    revived.statusCondition = null;
                    revived.statusTurns = 0;
                    revived.toxicCounter = 0;
                    revived.volatileStatus = {};
                    revived.statStages = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0]));
                    events.push({
                        type: "heal", side: actorSide, targetIndex: benchIndex,
                        newHp: revived.hp, maxHp: revived.maxHp, amount: revived.hp,
                        sourceKind: "move", sourceName: move.displayName,
                        message: `${revived.name} was revived and is ready to fight again!`,
                    });
                }
            }
            // Swapping stat *stages* leaves the underlying stats alone.
            if (effects.swapStages && target !== actor && !target.fainted) {
                effects.swapStages.forEach((stat) => {
                    const mine = numberOr(actor.statStages[stat], 0);
                    actor.statStages[stat] = numberOr(target.statStages[stat], 0);
                    target.statStages[stat] = mine;
                });
                events.push({
                    type: "stat", side: actorSide, targetIndex: actorIndex, stat: null, stages: 0,
                    message: `${actor.name} switched stat changes with ${target.name}!`,
                });
            }
            if ((effects.swapStats || effects.splitStats) && target !== actor && !target.fainted) {
                const mine = actor.volatileStatus.statOverride || (actor.volatileStatus.statOverride = {});
                const theirs = target.volatileStatus.statOverride || (target.volatileStatus.statOverride = {});
                (effects.swapStats || effects.splitStats).forEach((stat) => {
                    const ours = numberOr(mine[stat], numberOr(actor.stats?.[stat], 1));
                    const yours = numberOr(theirs[stat], numberOr(target.stats?.[stat], 1));
                    if (effects.swapStats) {
                        mine[stat] = yours;
                        theirs[stat] = ours;
                    } else {
                        const average = Math.floor((ours + yours) / 2);
                        mine[stat] = average;
                        theirs[stat] = average;
                    }
                });
                events.push({
                    type: "stat", side: actorSide, targetIndex: actorIndex, stat: null, stages: 0,
                    message: effects.swapStats
                        ? `${actor.name} swapped stats with ${target.name}!`
                        : `${actor.name} shared its power with ${target.name}!`,
                });
            }
            const failSelf = () => events.push({
                type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!",
            });

            // --- stat-stage manipulation ---------------------------------
            if (effects.clearAllStages) {
                ["player", "enemy"].forEach((eachSide) => {
                    this.getActivePokemon(eachSide).forEach(({ pokemon }) => {
                        pokemon.statStages = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0]));
                    });
                });
                events.push({
                    type: "rule", side: actorSide, targetIndex: actorIndex,
                    message: "All stat changes were eliminated!",
                });
            }
            if (effects.bellyDrum) {
                const cost = Math.floor(actor.maxHp / 2);
                if (actor.hp <= cost || numberOr(actor.statStages.attack, 0) >= 6) {
                    failSelf();
                } else {
                    actor.hp -= cost;
                    events.push({
                        type: "damage", side: actorSide, targetIndex: actorIndex, damage: cost,
                        newHp: actor.hp, maxHp: actor.maxHp, message: "",
                    });
                    actor.statStages.attack = 6;
                    events.push({
                        type: "stat", side: actorSide, targetIndex: actorIndex, stat: "attack", stages: 6,
                        message: `${actor.name} cut its own HP and maximized its Attack!`,
                    });
                }
            }
            if (effects.copyStages && target !== actor) {
                STAT_KEYS.forEach((stat) => { actor.statStages[stat] = numberOr(target.statStages[stat], 0); });
                events.push({
                    type: "stat", side: actorSide, targetIndex: actorIndex, stat: null, stages: 0,
                    message: `${actor.name} copied ${target.name}'s stat changes!`,
                });
            }
            if (effects.invertStages && target !== actor && !target.fainted) {
                STAT_KEYS.forEach((stat) => { target.statStages[stat] = -numberOr(target.statStages[stat], 0); });
                events.push({
                    type: "stat", side: targetSide, targetIndex, stat: null, stages: 0,
                    message: `${target.name}'s stat changes were all reversed!`,
                });
            }
            if (effects.randomBoost) {
                const options = STAT_KEYS.filter((stat) => numberOr(actor.statStages[stat], 0) < 6);
                if (!options.length) failSelf();
                else {
                    this.applyStatStage(actor, actorSide, actorIndex,
                        options[Math.floor(this.rng() * options.length)], effects.randomBoost, events, null);
                }
            }
            if (effects.swapOwnStats) {
                const overrides = actor.volatileStatus.statOverride || (actor.volatileStatus.statOverride = {});
                const [first, second] = effects.swapOwnStats;
                const firstValue = numberOr(overrides[first], numberOr(actor.stats?.[first], 1));
                const secondValue = numberOr(overrides[second], numberOr(actor.stats?.[second], 1));
                overrides[first] = secondValue;
                overrides[second] = firstValue;
                events.push({
                    type: "stat", side: actorSide, targetIndex: actorIndex, stat: null, stages: 0,
                    message: `${actor.name} switched its Attack and Defense!`,
                });
            }

            // --- status cures ---------------------------------------------
            if (effects.cureSelf) {
                if (!actor.statusCondition) {
                    failSelf();
                } else {
                    actor.statusCondition = null;
                    actor.statusTurns = 0;
                    actor.toxicCounter = 0;
                    events.push({
                        type: "status", side: actorSide, targetIndex: actorIndex, status: null,
                        message: `${actor.name}'s status returned to normal!`,
                    });
                }
            }
            if (effects.cureParty) {
                let cured = 0;
                this.teams[actorSide].forEach((pokemon, teamIndex) => {
                    if (!pokemon || !pokemon.statusCondition) return;
                    pokemon.statusCondition = null;
                    pokemon.statusTurns = 0;
                    pokemon.toxicCounter = 0;
                    cured += 1;
                    events.push({
                        type: "status", side: actorSide, targetIndex: teamIndex, status: null,
                        message: `${pokemon.name}'s status returned to normal!`,
                    });
                });
                if (!cured) failSelf();
            }
            if (effects.shiftStatus && target !== actor) {
                const carried = actor.statusCondition;
                if (!carried || target.fainted || target.statusCondition
                    || this.statusImmune(target, carried, actor)) {
                    failSelf();
                } else {
                    target.statusCondition = carried;
                    target.statusTurns = actor.statusTurns;
                    target.toxicCounter = numberOr(actor.toxicCounter, 0);
                    actor.statusCondition = null;
                    actor.statusTurns = 0;
                    actor.toxicCounter = 0;
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: carried,
                        message: `${actor.name} moved its status onto ${target.name}!`,
                    });
                }
            }

            // --- the decoy --------------------------------------------------
            if (effects.substitute) {
                const cost = Math.floor(actor.maxHp * effects.substitute);
                if (numberOr(actor.volatileStatus.substituteHp, 0) > 0) {
                    events.push({
                        type: "rule", side: actorSide, targetIndex: actorIndex,
                        message: `${actor.name} already has a substitute!`,
                    });
                } else if (cost <= 0 || actor.hp <= cost) {
                    events.push({
                        type: "rule", side: actorSide, targetIndex: actorIndex,
                        message: "But it doesn't have enough HP left to make a substitute!",
                    });
                } else {
                    actor.hp -= cost;
                    actor.volatileStatus.substituteHp = cost;
                    events.push({
                        type: "damage", side: actorSide, targetIndex: actorIndex, damage: cost,
                        newHp: actor.hp, maxHp: actor.maxHp, message: "",
                    });
                    events.push({
                        type: "status", side: actorSide, targetIndex: actorIndex, status: "substitute",
                        message: `${actor.name} put in a substitute!`,
                    });
                }
            }

            // --- doubles support ---------------------------------------------
            if (effects.helpingHand) {
                const ally = this.getActivePokemon(actorSide)
                    .find(({ pokemon }) => pokemon !== actor && pokemon && !pokemon.fainted);
                if (!ally) {
                    failSelf();
                } else {
                    ally.pokemon.volatileStatus.helpingHand = effects.helpingHand;
                    events.push({
                        type: "status", side: actorSide, targetIndex: ally.teamIndex, status: "helping-hand",
                        message: `${actor.name} is ready to help ${ally.pokemon.name}!`,
                    });
                }
            }
            if (effects.redirect) {
                actor.volatileStatus.redirecting = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "redirect",
                    message: `${actor.name} became the center of attention!`,
                });
            }
            if (effects.turnOrder) {
                const ally = effects.turnOrderTarget === "ally"
                    ? this.getActivePokemon(actorSide).find(({ pokemon }) => pokemon !== actor && pokemon && !pokemon.fainted)
                    : null;
                const recipient = effects.turnOrderTarget === "ally"
                    ? (ally ? { pokemon: ally.pokemon, side: actorSide, index: ally.teamIndex } : null)
                    : (target !== actor && !target.fainted ? { pokemon: target, side: targetSide, index: targetIndex } : null);
                if (!recipient) {
                    failSelf();
                } else if (effects.turnOrder === "first") {
                    recipient.pokemon.volatileStatus.movesFirst = true;
                    events.push({
                        type: "status", side: recipient.side, targetIndex: recipient.index, status: "after-you",
                        message: `${recipient.pokemon.name} took the kind offer!`,
                    });
                } else {
                    recipient.pokemon.volatileStatus.movesLast = true;
                    events.push({
                        type: "status", side: recipient.side, targetIndex: recipient.index, status: "quash",
                        message: `${recipient.pokemon.name}'s move was postponed!`,
                    });
                }
            }

            // --- forced and voluntary switching ------------------------------
            if (effects.forceSwitch && target !== actor && !target.fainted
                && abilityOf(target)?.anchorsSelf) {
                events.push({
                    type: "ability", side: targetSide, targetIndex,
                    abilityName: target.ability?.name || "",
                    message: `${target.name} anchors itself in place!`,
                });
            } else if (effects.forceSwitch && target !== actor && !target.fainted) {
                const slot = this.active[targetSide].indexOf(targetIndex);
                if (slot < 0 || !this.swapInFromBench(targetSide, slot, events, { random: true })) {
                    events.push({ type: "rule", side: targetSide, targetIndex, message: "But it failed!" });
                }
            }
            if (effects.selfSwitch && !actor.fainted) {
                const slot = this.active[actorSide].indexOf(actorIndex);
                const carry = effects.passStages
                    ? { stages: { ...actor.statStages }, volatiles: { ...actor.volatileStatus } }
                    : null;
                if (slot >= 0) {
                    this.swapInFromBench(actorSide, slot, events, {
                        carry,
                        // The player names the successor when queueing the
                        // move; the AI and any unchosen case take the first
                        // healthy Pokemon on the bench.
                        preferIndex: actorSide === "player" ? this.pendingSelfSwitchIndex : null,
                        message: effects.passStages
                            ? `${actor.name} passed its boosts to {name}!`
                            : `${actor.name} went back, and {name} took its place!`,
                    });
                }
                this.pendingSelfSwitchIndex = null;
            }
            if (effects.blockEscape && target !== actor && !target.fainted) {
                target.volatileStatus.cantEscape = true;
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "no-escape",
                    message: `${target.name} can no longer escape!`,
                });
            }

            // --- lingering volatiles ------------------------------------------
            if (effects.nightmare && target !== actor && !target.fainted) {
                if (target.statusCondition !== "sleep" || target.volatileStatus.nightmare) failSelf();
                else {
                    target.volatileStatus.nightmare = true;
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: "nightmare",
                        message: `${target.name} began having a nightmare!`,
                    });
                }
            }
            if (effects.curse) {
                // Ghosts pay half their HP to curse the target; everyone else
                // trades Speed for Attack and Defense.
                if (actor.types.includes("ghost")) {
                    if (target === actor || target.fainted || target.volatileStatus.cursed) {
                        failSelf();
                    } else {
                        const cost = Math.floor(actor.maxHp / 2);
                        actor.hp = Math.max(0, actor.hp - cost);
                        actor.fainted = actor.hp === 0;
                        target.volatileStatus.cursed = true;
                        events.push({
                            type: "damage", side: actorSide, targetIndex: actorIndex, damage: cost,
                            newHp: actor.hp, maxHp: actor.maxHp,
                            message: `${actor.name} cut its own HP and put a curse on ${target.name}!`,
                        });
                    }
                } else {
                    this.applyStatStage(actor, actorSide, actorIndex, "speed", -1, events, null);
                    this.applyStatStage(actor, actorSide, actorIndex, "attack", 1, events, null);
                    this.applyStatStage(actor, actorSide, actorIndex, "defense", 1, events, null);
                }
            }
            if (effects.chargeUp) {
                actor.volatileStatus.charged = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "charge",
                    message: `${actor.name} began charging power!`,
                });
            }
            if (effects.airborne) {
                const lifted = effects.targetsFoe ? target : actor;
                const liftedSide = effects.targetsFoe ? targetSide : actorSide;
                const liftedIndex = effects.targetsFoe ? targetIndex : actorIndex;
                if (!lifted || lifted.fainted) failSelf();
                else {
                    lifted.volatileStatus.airborneTurns = effects.airborne;
                    events.push({
                        type: "status", side: liftedSide, targetIndex: liftedIndex, status: "airborne",
                        message: `${lifted.name} floated up into the air!`,
                    });
                }
            }
            if (effects.healBlock && target !== actor && !target.fainted) {
                target.volatileStatus.healBlockTurns = effects.healBlock;
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "heal-block",
                    message: `${target.name} was prevented from healing!`,
                });
            }
            if (effects.embargo && target !== actor && !target.fainted) {
                target.volatileStatus.embargoTurns = effects.embargo;
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "embargo",
                    message: `${target.name} can't use items anymore!`,
                });
            }
            if (effects.imprison) {
                actor.volatileStatus.imprison = actor.moves.map((entry) => entry.slug);
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "imprison",
                    message: `${actor.name} sealed the opponent's moves!`,
                });
            }
            if (effects.luckyChant) {
                this.sideState[actorSide].luckyChant = effects.luckyChant;
                events.push({
                    type: "screen", side: actorSide, screen: "luckyChant", phase: "start",
                    message: `The Lucky Chant shielded ${actorSide === "player" ? "your" : "the opposing"} team from critical hits!`,
                });
            }
            if (effects.magicCoat) {
                actor.volatileStatus.magicCoat = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "magic-coat",
                    message: `${actor.name} shrouded itself in a magic coat!`,
                });
            }
            if (effects.snatching) {
                actor.volatileStatus.snatching = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "snatch",
                    message: `${actor.name} waits for a move to snatch!`,
                });
            }
            if (effects.powder && target !== actor && !target.fainted) {
                target.volatileStatus.powdered = true;
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "powder",
                    message: `${target.name} is covered in a combustible powder!`,
                });
            }
            if (effects.courtChange) {
                const mine = this.sideState[actorSide];
                const theirs = this.sideState[this.opposingSide(actorSide)];
                const swapped = { hazards: mine.hazards, screens: mine.screens };
                mine.hazards = theirs.hazards;
                mine.screens = theirs.screens;
                theirs.hazards = swapped.hazards;
                theirs.screens = swapped.screens;
                events.push({
                    type: "rule", side: actorSide, targetIndex: actorIndex,
                    message: `${actor.name} swapped the battle effects on either side!`,
                });
            }

            // --- item manipulation ---------------------------------------------
            const liveTarget = target !== actor && !target.fainted;
            if (effects.swapItems && liveTarget) {
                if ((!actor.heldItemKey && !target.heldItemKey)
                    || abilityOf(target)?.keepsItem || abilityOf(actor)?.keepsItem) {
                    failSelf();
                } else {
                    rememberOriginal(actor, "originalItem", actor.heldItemKey || null);
                    rememberOriginal(target, "originalItem", target.heldItemKey || null);
                    const mine = actor.heldItemKey || null;
                    actor.heldItemKey = target.heldItemKey || null;
                    target.heldItemKey = mine;
                    actor.heldItemSpent = false;
                    target.heldItemSpent = false;
                    events.push({
                        type: "item", side: actorSide, targetIndex: actorIndex,
                        message: `${actor.name} swapped items with ${target.name}!`,
                    });
                }
            }
            if (effects.giveItem && liveTarget) {
                if (!actor.heldItemKey || target.heldItemKey) {
                    failSelf();
                } else {
                    rememberOriginal(actor, "originalItem", actor.heldItemKey || null);
                    rememberOriginal(target, "originalItem", target.heldItemKey || null);
                    target.heldItemKey = actor.heldItemKey;
                    target.heldItemSpent = false;
                    actor.heldItemKey = null;
                    events.push({
                        type: "item", side: targetSide, targetIndex,
                        message: `${actor.name} handed its item to ${target.name}!`,
                    });
                }
            }
            if (effects.recycleItem) {
                if (!actor.heldItemKey || !actor.heldItemSpent) {
                    failSelf();
                } else {
                    actor.heldItemSpent = false;
                    events.push({
                        type: "item", side: actorSide, targetIndex: actorIndex,
                        message: `${actor.name} found its item again!`,
                    });
                }
            }
            if (effects.destroyItem && liveTarget) {
                if (!target.heldItemKey || abilityOf(target)?.keepsItem) {
                    if (move.power <= 0) failSelf();
                } else {
                    rememberOriginal(target, "originalItem", target.heldItemKey);
                    const lost = target.heldItemKey;
                    target.heldItemKey = null;
                    target.heldItemSpent = false;
                    events.push({
                        type: "item", side: targetSide, targetIndex,
                        message: `${actor.name} knocked off ${target.name}'s ${String(lost).replace(/-/g, " ")}!`,
                    });
                }
            }
            if (effects.teatime) {
                let ate = 0;
                ["player", "enemy"].forEach((eachSide) => {
                    this.getActivePokemon(eachSide).forEach(({ teamIndex, pokemon }) => {
                        const registry = heldItemRegistry();
                        if (!pokemon.heldItemKey || pokemon.heldItemSpent || !registry?.isBerry(pokemon.heldItemKey)) return;
                        ate += 1;
                        pokemon.heldItemSpent = true;
                        events.push({
                            type: "item", side: eachSide, targetIndex: teamIndex,
                            message: `${pokemon.name} ate its berry!`,
                        });
                    });
                });
                if (!ate) failSelf();
            }

            // --- ability manipulation --------------------------------------------
            if (effects.copyAbility && liveTarget) {
                if (!target.ability) failSelf();
                else {
                    rememberOriginal(actor, "originalAbility", actor.ability);
                    actor.ability = { ...target.ability };
                    events.push({
                        type: "ability", side: actorSide, targetIndex: actorIndex,
                        abilityName: actor.ability?.name || "",
                        message: `${actor.name} copied ${target.name}'s ${target.ability?.name}!`,
                    });
                }
            }
            if (effects.swapAbility && liveTarget) {
                rememberOriginal(actor, "originalAbility", actor.ability);
                rememberOriginal(target, "originalAbility", target.ability);
                const mine = actor.ability;
                actor.ability = target.ability;
                target.ability = mine;
                events.push({
                    type: "ability", side: actorSide, targetIndex: actorIndex,
                    abilityName: actor.ability?.name || "",
                    message: `${actor.name} swapped abilities with ${target.name}!`,
                });
            }
            if (effects.shareAbility && liveTarget) {
                if (!actor.ability) failSelf();
                else {
                    rememberOriginal(target, "originalAbility", target.ability);
                    target.ability = { ...actor.ability };
                    events.push({
                        type: "ability", side: targetSide, targetIndex,
                        abilityName: target.ability?.name || "",
                        message: `${target.name} acquired ${actor.ability?.name}!`,
                    });
                }
            }
            if (effects.setAbility && liveTarget) {
                rememberOriginal(target, "originalAbility", target.ability);
                target.ability = { slug: effects.setAbility, name: effects.setAbility.replace(/(^|-)([a-z])/g, (_, dash, letter) => (dash ? " " : "") + letter.toUpperCase()) };
                events.push({
                    type: "ability", side: targetSide, targetIndex, abilityName: target.ability.name,
                    message: `${target.name}'s Ability became ${target.ability.name}!`,
                });
            }
            if (effects.suppressAbility && liveTarget) {
                target.volatileStatus.abilitySuppressed = true;
                events.push({
                    type: "ability", side: targetSide, targetIndex, abilityName: target.ability?.name || "",
                    message: `${target.name}'s Ability was suppressed!`,
                });
            }

            if (effects.retypeTargetMove && liveTarget) {
                target.volatileStatus.moveTypeForced = effects.retypeTargetMove;
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "electrified",
                    message: `${target.name} was electrified!`,
                });
            }
            if (effects.grudge) {
                actor.volatileStatus.grudge = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "grudge",
                    message: `${actor.name} wants its target to bear a grudge!`,
                });
            }

            // --- accuracy, crit and delayed damage ---------------------------------
            if (effects.lockOn && liveTarget) {
                actor.volatileStatus.lockedOn = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "lock-on",
                    message: `${actor.name} took aim at ${target.name}!`,
                });
            }
            if (effects.identify && liveTarget) {
                target.volatileStatus.identified = true;
                // Foresight lets Normal and Fighting reach Ghosts; Miracle Eye
                // lets Psychic reach Darks. Dropping the immune type is the
                // simplest way to say that here.
                if (target.types.some((type) => effects.identify.includes(type))) {
                    const remaining = target.types.filter((type) => !effects.identify.includes(type));
                    rememberOriginal(target, "originalTypes", [...target.types]);
                    target.types = remaining.length ? remaining : ["normal"];
                }
                events.push({
                    type: "status", side: targetSide, targetIndex, status: "identified",
                    message: `${target.name} was identified!`,
                });
            }
            if (effects.laserFocus) {
                actor.volatileStatus.laserFocus = true;
                events.push({
                    type: "status", side: actorSide, targetIndex: actorIndex, status: "laser-focus",
                    message: `${actor.name} began concentrating intensely!`,
                });
            }
            if (effects.delayed && liveTarget) {
                this.delayedAttacks = this.delayedAttacks || [];
                if (this.delayedAttacks.some((entry) => entry.side === targetSide && entry.index === targetIndex)) {
                    failSelf();
                } else {
                    this.delayedAttacks.push({
                        side: targetSide, index: targetIndex, turns: effects.delayed.turns,
                        power: effects.delayed.power, type: effects.delayed.type,
                        level: actor.level, attack: modifiedStat(actor, "specialAttack", {}),
                        moveName: move.displayName, ownerName: actor.name,
                    });
                    events.push({
                        type: "status", side: targetSide, targetIndex, status: "future",
                        message: `${actor.name} foresaw an attack!`,
                    });
                }
            }
            if (effects.healTarget && liveTarget) {
                if (target.hp >= target.maxHp || target.volatileStatus?.healBlockTurns > 0) {
                    failSelf();
                } else {
                    const previousHp = target.hp;
                    target.hp = Math.min(target.maxHp, target.hp + Math.max(1, Math.floor(target.maxHp * effects.healTarget)));
                    events.push({
                        type: "heal", side: targetSide, targetIndex,
                        newHp: target.hp, maxHp: target.maxHp, amount: target.hp - previousHp,
                        sourceKind: "move", sourceName: move.displayName,
                        message: `${target.name} recovered ${target.hp - previousHp} HP!`,
                    });
                }
            }

            // --- copying the opponent ----------------------------------------------
            if (effects.copyMove && liveTarget) {
                const source = Number.isInteger(target.lastMoveIndex) ? target.moves[target.lastMoveIndex] : null;
                if (!source || actor.moves.some((entry) => entry.slug === source.slug)) {
                    failSelf();
                } else {
                    // The copy lands in this move's own slot, the way Mimic
                    // and Sketch overwrite themselves.
                    const slot = actor.moves.findIndex((entry) => entry.slug === move.slug);
                    if (slot < 0) failSelf();
                    else {
                        rememberOriginal(actor, "originalMoves", actor.moves.map((entry) => ({ ...entry })));
                        actor.moves[slot] = { ...source, pp: Math.min(5, source.maxPp), maxPp: Math.min(5, source.maxPp) };
                        events.push({
                            type: "rule", side: actorSide, targetIndex: actorIndex,
                            message: `${actor.name} learned ${source.displayName}!`,
                        });
                    }
                }
            }
            if (effects.transform && liveTarget) {
                if (actor.volatileStatus.transformed) {
                    failSelf();
                } else {
                    // Everything but HP, level and the current HP value is
                    // borrowed; all of it is put back when the duel ends.
                    rememberOriginal(actor, "originalTypes", [...actor.types]);
                    rememberOriginal(actor, "originalAbility", actor.ability);
                    rememberOriginal(actor, "originalMoves", actor.moves.map((entry) => ({ ...entry })));
                    rememberOriginal(actor, "originalStats", { ...actor.stats });
                    rememberOriginal(actor, "originalIdentity", {
                        name: actor.name, key: actor.key, id: actor.id, sprites: actor.sprites,
                    });
                    actor.volatileStatus.transformed = true;
                    actor.types = [...target.types];
                    actor.ability = target.ability ? { ...target.ability } : actor.ability;
                    actor.stats = { ...target.stats };
                    actor.statStages = { ...target.statStages };
                    actor.moves = (target.moves || []).map((entry) => ({ ...entry, pp: 5, maxPp: 5 }));
                    actor.name = target.name;
                    actor.key = target.key;
                    actor.id = target.id;
                    actor.sprites = target.sprites;
                    events.push({
                        type: "rule", side: actorSide, targetIndex: actorIndex,
                        message: `${actor.name} transformed into ${target.name}!`,
                    });
                }
            }

            // --- type changing -----------------------------------------------------
            const retype = (pokemon, side, index, types, note) => {
                if (!pokemon || pokemon.fainted || !types.length) return failSelf();
                // Remember the species' own types so switching out or the end
                // of the duel can put them back.
                if (!pokemon.volatileStatus.originalTypes) {
                    pokemon.volatileStatus.originalTypes = [...pokemon.types];
                }
                pokemon.types = [...types];
                return events.push({
                    type: "status", side, targetIndex: index, status: "type-change",
                    message: note.replace("{types}", types.join("/")),
                });
            };
            if (effects.setType && liveTarget) {
                retype(target, targetSide, targetIndex, effects.setType,
                    `${target.name} transformed into the {types} type!`);
            }
            if (effects.addType && liveTarget) {
                retype(target, targetSide, targetIndex,
                    [...target.types.filter((type) => type !== effects.addType), effects.addType],
                    `${effects.addType.replace(/^./, (c) => c.toUpperCase())} type was added to ${target.name}!`);
            }
            if (effects.copyType && liveTarget) {
                retype(actor, actorSide, actorIndex, [...target.types],
                    `${actor.name} became the same type as ${target.name}!`);
            }
            if (effects.resistLastMove) {
                // Conversion 2 wants the last move that hit; without that
                // history it takes a type that resists the target's own STAB.
                const source = target !== actor ? target.types[0] : "normal";
                const resistant = Object.keys(TYPE_CHART)
                    .filter((type) => typeEffectiveness(source, [type]) < 1);
                if (!resistant.length) failSelf();
                else {
                    retype(actor, actorSide, actorIndex, [resistant[Math.floor(this.rng() * resistant.length)]],
                        `${actor.name} became the {types} type!`);
                }
            }
            if (effects.terrainType) {
                const terrainNow = this.activeTerrain();
                const byTerrain = {
                    electric: "electric", grassy: "grass", misty: "fairy", psychic: "psychic",
                };
                retype(actor, actorSide, actorIndex, [byTerrain[terrainNow] || "normal"],
                    `${actor.name} became the {types} type!`);
            }

            if (effects.protect || effects.endure) {
                // Consecutive protection decays: each use in a row succeeds
                // at a third of the previous odds, and any other move resets
                // the streak (executeMove clears it). Endure shares the chain.
                const streak = numberOr(actor.volatileStatus.protectStreak, 0);
                if (streak > 0 && this.rng() >= Math.pow(1 / 3, streak)) {
                    actor.volatileStatus.protectStreak = 0;
                    events.push({
                        type: "rule", side: actorSide, targetIndex: actorIndex,
                        message: "But it failed!",
                    });
                } else {
                    actor.volatileStatus.protectStreak = streak + 1;
                    if (effects.protect) {
                        actor.volatileStatus.protected = true;
                        events.push({ type: "status", side: actorSide, targetIndex: actorIndex, status: "protect", message: `${actor.name} protected itself!` });
                    } else {
                        actor.volatileStatus.enduring = true;
                        events.push({ type: "status", side: actorSide, targetIndex: actorIndex, status: "endure", message: `${actor.name} braced itself!` });
                    }
                }
            }
            if (effects.critStages) {
                const volatiles = actor.volatileStatus;
                if (numberOr(volatiles.critStages, 0) >= effects.critStages) {
                    events.push({ type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!" });
                } else {
                    volatiles.critStages = effects.critStages;
                    events.push({ type: "status", side: actorSide, targetIndex: actorIndex, status: "focus", message: `${actor.name} is getting pumped!` });
                }
            }
            if (effects.stockpile) {
                const volatiles = actor.volatileStatus;
                const stored = numberOr(volatiles.stockpile, 0);
                if (stored >= 3) {
                    events.push({ type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!" });
                } else {
                    volatiles.stockpile = stored + 1;
                    events.push({
                        type: "status", side: actorSide, targetIndex: actorIndex, status: "stockpile",
                        message: `${actor.name} stockpiled ${volatiles.stockpile}!`,
                    });
                    this.applyStatStage(actor, actorSide, actorIndex, "defense", 1, events, null);
                    this.applyStatStage(actor, actorSide, actorIndex, "specialDefense", 1, events, null);
                }
            }
            // Swallow trades the whole store for HP; Spit Up already spent it
            // on damage by the time we get here.
            if (effects.stockpileSpend && !actor.fainted) {
                const stored = numberOr(actor.volatileStatus.stockpile, 0);
                if (!stored) {
                    events.push({ type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!" });
                } else {
                    if (effects.stockpileSpend === "heal") {
                        const ratio = stored === 1 ? 0.25 : stored === 2 ? 0.5 : 1;
                        const healing = Math.max(1, Math.floor(actor.maxHp * ratio));
                        const previousHp = actor.hp;
                        actor.hp = Math.min(actor.maxHp, actor.hp + healing);
                        const restored = actor.hp - previousHp;
                        events.push(restored > 0
                            ? {
                                type: "heal", side: actorSide, targetIndex: actorIndex,
                                newHp: actor.hp, maxHp: actor.maxHp, amount: restored,
                                sourceKind: "move", sourceName: move.displayName,
                                message: `${actor.name} swallowed its stockpile and recovered ${restored} HP!`,
                            }
                            : { type: "rule", side: actorSide, targetIndex: actorIndex, message: `${actor.name}'s HP is full!` });
                    }
                    this.releaseStockpile(actor, actorSide, actorIndex, events);
                }
            }
            if (effects.rootHeal) {
                const volatiles = actor.volatileStatus;
                if (volatiles[effects.rootHeal]) {
                    events.push({ type: "rule", side: actorSide, targetIndex: actorIndex, message: "But it failed!" });
                } else {
                    volatiles[effects.rootHeal] = true;
                    events.push({
                        type: "status", side: actorSide, targetIndex: actorIndex, status: effects.rootHeal,
                        message: effects.rootHeal === "ingrain"
                            ? `${actor.name} planted its roots!`
                            : `${actor.name} surrounded itself with a veil of water!`,
                    });
                }
            }
            if (effects.fieldEffect) {
                this.fieldEffects[effects.fieldEffect.key] = Math.max(this.fieldEffects[effects.fieldEffect.key] || 0, effects.fieldEffect.turns);
                events.push({ type: "status", side: actorSide, targetIndex: actorIndex, status: effects.fieldEffect.key, message: `${move.displayName} changed the battlefield!` });
            }
        }

        // Drop every trace of a multi-turn commitment. Called whenever a
        // commitment cannot continue, so nothing can stay locked forever.
        breakCommitment(actor, events, side, teamIndex) {
            if (!actor.pendingMove) return;
            const move = actor.moves[actor.pendingMove.moveIndex];
            const definition = multiTurnOf(move);
            const wasRampage = actor.pendingMove.kind === "rampage";
            actor.pendingMove = null;
            delete actor.volatileStatus.semiInvulnerable;
            if (definition?.uproar) this.uproarTurns = 0;
            if (wasRampage && definition?.confuseWhenDone !== false) {
                this.tireOutRampage(actor, events, side, teamIndex);
            }
        }

        // A rampage always ends in confusion from fatigue.
        tireOutRampage(actor, events, side, teamIndex) {
            if (actor.fainted || actor.volatileStatus.confused) return;
            if (abilityOf(actor)?.preventVolatile?.includes("confused")) return;
            actor.volatileStatus.confused = true;
            actor.volatileStatus.confusionTurns = 2 + Math.floor(this.rng() * 4);
            events.push({
                type: "status", side, targetIndex: teamIndex, status: "confusion",
                message: `${actor.name} became confused due to fatigue!`,
            });
        }

        // Turn one of a charge move: pay the PP, strike a pose, and hand the
        // turn over. Returns true when the turn is spent charging.
        beginChargeTurn(action, actor, move, multiTurn, events) {
            move.pp -= 1;
            actor.pendingMove = {
                kind: "charge",
                moveIndex: action.moveIndex,
                targetSide: action.targetSide,
                targetIndex: action.targetIndex,
                targetSlot: action.targetSlot,
            };
            if (multiTurn.invulnerable) {
                actor.volatileStatus.semiInvulnerable = multiTurn.invulnerable;
            }
            events.push({
                type: "charge",
                side: action.side,
                targetIndex: action.actorIndex,
                moveName: move.displayName,
                moveSlug: move.slug,
                hiding: multiTurn.invulnerable || "",
                message: String(multiTurn.message || "{name} began charging!").replace("{name}", actor.name),
            });
            // Skull Bash, Meteor Beam and Electro Shot boost themselves while
            // they wind up rather than when the attack lands.
            (multiTurn.chargeBoosts || []).forEach((boost) => {
                this.applyStatStage(actor, action.side, action.actorIndex, boost.stat, boost.stages, events, null);
            });
            return true;
        }

        // Bide spends two turns soaking damage, then returns double to
        // whoever hit it last.
        executeBide(action, actor, move, events) {
            const pending = actor.pendingMove;
            if (!pending) {
                move.pp -= 1;
                actor.pendingMove = {
                    kind: "bide",
                    moveIndex: action.moveIndex,
                    targetSide: action.targetSide,
                    targetIndex: action.targetIndex,
                    targetSlot: action.targetSlot,
                    turnsLeft: 2,
                    damageTaken: 0,
                };
                events.push({
                    type: "charge", side: action.side, targetIndex: action.actorIndex,
                    moveName: move.displayName, moveSlug: move.slug, hiding: "",
                    message: `${actor.name} is storing energy!`,
                });
                return;
            }
            pending.turnsLeft -= 1;
            if (pending.turnsLeft > 0) {
                events.push({
                    type: "charge", side: action.side, targetIndex: action.actorIndex,
                    moveName: move.displayName, moveSlug: move.slug, hiding: "",
                    message: `${actor.name} is storing energy!`,
                });
                return;
            }

            const stored = pending.damageTaken;
            const attacker = pending.lastAttacker;
            actor.pendingMove = null;
            events.push({
                type: "move", side: action.side, actorIndex: action.actorIndex,
                targetSide: this.opposingSide(action.side), targetIndex: pending.targetIndex,
                moveId: move.id, moveName: move.displayName, moveSlug: move.slug,
                moveType: move.type, movePower: move.power, damageClass: move.damageClass,
                priority: move.priority, targetNumber: 0, spreadFollowUp: false, hits: 1,
                message: `${actor.name} unleashed energy!`,
            });
            if (stored <= 0) {
                events.push({ type: "rule", side: action.side, targetIndex: action.actorIndex, message: "But it failed!" });
                return;
            }
            // Prefer whoever landed the last blow; fall back to any opponent.
            const foes = this.getActivePokemon(this.opposingSide(action.side));
            const chosen = foes.find((entry) => entry.pokemon === attacker) || foes[0];
            if (!chosen) {
                events.push({ type: "rule", side: action.side, targetIndex: action.actorIndex, message: "But it failed!" });
                return;
            }
            const damage = stored * 2;
            const victim = chosen.pokemon;
            victim.hp = Math.max(0, victim.hp - damage);
            victim.fainted = victim.hp === 0;
            events.push({
                type: "damage", side: this.opposingSide(action.side), targetIndex: chosen.teamIndex,
                damage, newHp: victim.hp, maxHp: victim.maxHp, effectiveness: 1,
                critical: false, hits: 1, message: "",
            });
            if (victim.fainted) {
                events.push({ type: "faint", side: this.opposingSide(action.side), targetIndex: chosen.teamIndex, message: `${victim.name} fainted!` });
            }
        }

        // Called once the move has finished resolving: sets up a recharge
        // turn, or ticks a rampage/rollout lock down.
        advanceCommitment(action, actor, move, multiTurn, events, outcome) {
            if (!multiTurn || actor.fainted) {
                if (actor.fainted) this.breakCommitment(actor, events, action.side, action.actorIndex);
                return;
            }
            const { kind } = multiTurn;
            if (kind === "recharge") {
                if (multiTurn.skipIfKnockedOut && outcome.knockedOut) return;
                actor.pendingMove = {
                    kind: "recharge",
                    moveIndex: action.moveIndex,
                    targetSide: action.targetSide,
                    targetIndex: action.targetIndex,
                    targetSlot: action.targetSlot,
                };
                return;
            }
            if (kind !== "rampage" && kind !== "rollout") return;

            // A miss or a total whiff stops the lock early.
            if (!outcome.landed) {
                this.breakCommitment(actor, events, action.side, action.actorIndex);
                return;
            }
            const pending = actor.pendingMove;
            if (!pending) {
                const turns = kind === "rampage"
                    ? multiTurn.minTurns + Math.floor(this.rng() * (multiTurn.maxTurns - multiTurn.minTurns + 1))
                    : multiTurn.maxTurns;
                if (turns <= 1) {
                    if (kind === "rampage" && multiTurn.confuseWhenDone !== false) {
                        this.tireOutRampage(actor, events, action.side, action.actorIndex);
                    }
                    return;
                }
                actor.pendingMove = {
                    kind,
                    moveIndex: action.moveIndex,
                    targetSide: action.targetSide,
                    targetIndex: action.targetIndex,
                    targetSlot: action.targetSlot,
                    turnsLeft: turns - 1,
                    // Rollout and Ice Ball double in power on every
                    // consecutive hit.
                    consecutive: 1,
                };
                return;
            }
            pending.turnsLeft -= 1;
            pending.consecutive = numberOr(pending.consecutive, 1) + 1;
            if (pending.turnsLeft <= 0) {
                actor.pendingMove = null;
                if (kind === "rampage" && multiTurn.confuseWhenDone !== false) {
                    this.tireOutRampage(actor, events, action.side, action.actorIndex);
                }
                if (multiTurn.uproar) this.uproarTurns = 0;
            }
        }

        // The pool Metronome draws from: every real move in the dex, built
        // once and kept. Falls back to what the Pokemon on the field know if
        // the caller never handed over the move table.
        callablePool() {
            if (this.callablePoolCache) return this.callablePoolCache;
            const table = this.movesById;
            if (table) {
                const seen = new Map();
                Object.values(table).forEach((raw) => {
                    const name = String(raw?.name || "");
                    // Placeholders and undocumented entries would resolve to
                    // nothing, which is not what "any move at random" means.
                    if (!name || name === "Placeholder" || /^unknown\.?$/i.test(String(raw.description || "").trim())) return;
                    const entry = normalizeMove(raw);
                    if (!seen.has(entry.slug)) seen.set(entry.slug, entry);
                });
                if (seen.size) {
                    this.callablePoolCache = [...seen.values()];
                    return this.callablePoolCache;
                }
            }
            const seen = new Map();
            Object.values(this.teams).flat().forEach((pokemon) => {
                (pokemon?.moves || []).forEach((entry) => {
                    if (entry && !seen.has(entry.slug)) seen.set(entry.slug, entry);
                });
            });
            this.callablePoolCache = [...seen.values()];
            return this.callablePoolCache;
        }

        // Which move a calling move ends up using. Returns null when there is
        // nothing to call, which the caller reports as a plain failure.
        pickCalledMove(kind, actor, target) {
            const clone = (entry) => (entry ? { ...entry, pp: Math.max(1, entry.pp) } : null);
            const usable = (entry) => entry && !/^(metronome|mirror-move|copycat|sleep-talk|assist|me-first|instruct|transform)$/.test(entry.slug);
            if (kind === "random") {
                const pool = this.callablePool().filter(usable);
                return pool.length ? clone(pool[Math.floor(this.rng() * pool.length)]) : null;
            }
            if (kind === "own-random") {
                const pool = (actor.moves || []).filter(usable);
                return pool.length ? clone(pool[Math.floor(this.rng() * pool.length)]) : null;
            }
            if (kind === "party-random") {
                const side = this.sideOf(actor) || "player";
                const active = new Set(this.active[side]);
                const pool = this.teams[side]
                    .filter((pokemon, index) => pokemon && !active.has(index))
                    .flatMap((pokemon) => pokemon.moves || [])
                    .filter(usable);
                return pool.length ? clone(pool[Math.floor(this.rng() * pool.length)]) : null;
            }
            if (kind === "target-last") {
                const entry = target && Number.isInteger(target.lastMoveIndex)
                    ? target.moves[target.lastMoveIndex] : null;
                return usable(entry) ? clone(entry) : null;
            }
            if (kind === "any-last") {
                return usable(this.lastMoveUsed) ? clone(this.lastMoveUsed) : null;
            }
            if (kind === "target-best") {
                const pool = (target?.moves || []).filter((entry) => usable(entry) && entry.power > 0);
                if (!pool.length) return null;
                const best = pool.reduce((top, entry) => (entry.power > top.power ? entry : top), pool[0]);
                // Me First hits harder than the move normally would.
                return { ...clone(best), power: Math.floor(best.power * 1.5) };
            }
            return null;
        }

        executeMove(action, events) {
            const actor = this.teams[action.side][action.actorIndex];
            // A called move (Metronome, Sleep Talk, Instruct) arrives on the
            // action rather than out of the actor's own move list.
            let move = action.overrideMove || actor.moves[action.moveIndex];
            const pending = actor.pendingMove;

            // Out of PP, disabled, taunted into a corner -- whatever the
            // reason, a Pokemon with no legal move struggles rather than
            // standing there doing nothing.
            if (!pending && !action.overrideMove && move
                && !actor.moves.some((candidate) => this.moveUsability(actor, candidate).usable)) {
                move = { ...STRUGGLE, effects: { ...STRUGGLE.effects } };
                events.push({
                    type: "rule", side: action.side, targetIndex: action.actorIndex,
                    message: `${actor.name} has no moves left!`,
                });
            }

            // The commitment was cancelled after this action was queued (the
            // Pokemon was switched or dragged out), so the replay is stale.
            if (action.forced && !pending) return;

            // Spending the recharge turn. Nothing else happens.
            if (pending?.kind === "recharge") {
                actor.pendingMove = null;
                events.push({
                    type: "rule", side: action.side, targetIndex: action.actorIndex,
                    message: `${actor.name} must recharge!`,
                });
                return;
            }

            // A committed Pokemon skips the usability gate -- its PP was
            // already paid on the turn it committed.
            if (!pending && !this.moveUsability(actor, move).usable) return;
            {
                const gate = abilityOf(actor);
                // Protean and Libero repaint the user in the move's own type.
                if (gate?.changesTypeToMove && move.type
                    && !(actor.types.length === 1 && actor.types[0] === move.type)) {
                    actor.types = [move.type];
                    events.push({
                        type: "ability", side: action.side, targetIndex: action.actorIndex,
                        abilityName: actor.ability?.name || "",
                        message: `${actor.name} became ${move.type.toUpperCase()} type!`,
                    });
                }
                // Gorilla Tactics locks the choice the moment it is exercised.
                if (gate?.choiceLock && !action.overrideMove
                    && !Number.isInteger(actor.volatileStatus?.choiceLockIndex)
                    && Number.isInteger(action.moveIndex)) {
                    actor.volatileStatus.choiceLockIndex = action.moveIndex;
                }
            }
            // A called move has already cleared the flinch/sleep/confusion
            // gate on behalf of the move that called it.
            // Damp smothers every self-destructing move on the field before
            // it goes off, the user's own included.
            if (move.effects?.selfFaint) {
                const damp = ["player", "enemy"].flatMap((side) => this.getActivePokemon(side))
                    .find((entry) => abilityOf(entry.pokemon)?.blocksSelfFaint);
                if (damp) {
                    events.push({
                        type: "ability", side: action.side, targetIndex: action.actorIndex,
                        abilityName: damp.pokemon.ability?.name || "",
                        message: `${actor.name} cannot detonate -- ${damp.pokemon.name}'s ${damp.pokemon.ability?.name} smothers it!`,
                    });
                    return;
                }
            }
            if (!action.overrideMove
                && !this.canPokemonAct(actor, events, action.side, action.actorIndex, move)) {
                // Sleep, paralysis, confusion or a flinch during a commitment
                // breaks it. Clearing here is what stops a Pokemon getting
                // stuck mid-charge forever.
                this.breakCommitment(actor, events, action.side, action.actorIndex);
                return;
            }

            actor.lastMoveIndex = action.moveIndex;
            // A Choice item locks onto whatever it opens with.
            if (heldItemOf(actor)?.locksMove && !Number.isInteger(actor.volatileStatus.choiceLockedIndex)) {
                actor.volatileStatus.choiceLockedIndex = action.moveIndex;
            }

            const multiTurn = multiTurnOf(move);

            // Emerging from a charge: the hiding place is left behind before
            // the attack resolves, so this turn's incoming hits connect.
            if (pending?.kind === "charge") {
                actor.pendingMove = null;
                delete actor.volatileStatus.semiInvulnerable;
            }

            if (multiTurn?.kind === "bide") {
                this.executeBide(action, actor, move, events);
                return;
            }
            // Solar Beam in sun and Electro Shot in rain skip winding up.
            const skipsCharge = multiTurn?.skipInWeather
                && this.activeWeather() === multiTurn.skipInWeather;
            if (multiTurn?.kind === "charge" && !pending && !skipsCharge
                && this.beginChargeTurn(action, actor, move, multiTurn, events)) {
                return;
            }

            // Metronome, Mirror Move, Copycat, Sleep Talk, Assist, Nature
            // Power and Me First all spend their own PP and then hand the turn
            // to a different move.
            if (move.effects?.callsMove && !action.overrideMove) {
                move.pp -= 1;
                const firstTarget = this.resolveMoveTargets(action, move)[0]?.pokemon || null;
                const called = this.pickCalledMove(move.effects.callsMove, actor, firstTarget);
                if (!called) {
                    events.push({
                        type: "rule", side: action.side, targetIndex: action.actorIndex,
                        message: "But it failed!",
                    });
                    return;
                }
                events.push({
                    type: "rule", side: action.side, targetIndex: action.actorIndex,
                    message: `${actor.name} used ${move.displayName} and called ${called.displayName}!`,
                });
                this.executeMove({ ...action, overrideMove: called }, events);
                return;
            }
            // Instruct makes the target take its last move again straight away.
            if (move.effects?.instruct && !action.overrideMove) {
                move.pp -= 1;
                const victim = this.resolveMoveTargets(action, move)[0];
                const repeat = victim && Number.isInteger(victim.pokemon.lastMoveIndex)
                    ? victim.pokemon.moves[victim.pokemon.lastMoveIndex] : null;
                if (!repeat) {
                    events.push({ type: "rule", side: action.side, targetIndex: action.actorIndex, message: "But it failed!" });
                    return;
                }
                events.push({
                    type: "rule", side: victim.side, targetIndex: victim.teamIndex,
                    message: `${victim.pokemon.name} was instructed to use ${repeat.displayName} again!`,
                });
                this.executeMove({
                    kind: "move", side: victim.side, actorIndex: victim.teamIndex,
                    moveIndex: victim.pokemon.lastMoveIndex,
                    targetSide: action.side, targetIndex: action.actorIndex,
                    targetSlot: this.active[action.side].indexOf(action.actorIndex),
                }, events);
                return;
            }
            this.lastMoveUsed = move;
            // Carried on the action so applyMoveEffects can reach it.
            this.pendingSelfSwitchIndex = Number.isInteger(action.switchToIndex) ? action.switchToIndex : null;

            // Powder makes a Fire move go off in the user's own face.
            if (actor.volatileStatus?.powdered && move.type === "fire" && move.power > 0) {
                move.pp -= 1;
                const burst = Math.max(1, Math.floor(actor.maxHp / 4));
                actor.hp = Math.max(0, actor.hp - burst);
                actor.fainted = actor.hp === 0;
                events.push({
                    type: "damage", side: action.side, targetIndex: action.actorIndex, damage: burst,
                    newHp: actor.hp, maxHp: actor.maxHp,
                    message: `The powder on ${actor.name} exploded!`,
                });
                if (actor.fainted) {
                    events.push({ type: "faint", side: action.side, targetIndex: action.actorIndex, message: `${actor.name} fainted!` });
                }
                return;
            }

            if (!pending) move.pp -= 1;
            if (multiTurn?.uproar) this.beginUproar(actor, action.side, action.actorIndex, events);
            const targets = this.resolveMoveTargets(action, move);
            if (!targets.length) {
                this.breakCommitment(actor, events, action.side, action.actorIndex);
                return;
            }
            // Tracks whether the lock should continue and whether a recharge
            // can be skipped.
            const outcome = { landed: false, knockedOut: false };

            // Any move other than Protect/Endure breaks the protection streak.
            if (!move.effects?.protect && !move.effects?.endure && actor.volatileStatus) {
                actor.volatileStatus.protectStreak = 0;
            }

            // Pressure drains an extra PP from anyone targeting its owner.
            targets.forEach((entry) => {
                if (entry.pokemon === actor) return;
                const extra = abilityOf(entry.pokemon)?.extraPpCost;
                if (extra) move.pp = Math.max(0, move.pp - extra);
            });

            // A multi-hit move rolls its hit count once for the whole use, not
            // per target, and the renderer needs it up front so it can replay
            // the animation for each blow. Skill Link always lands the max.
            const multiHit = move.effects?.multiHit;
            const hitCount = multiHit
                ? (abilityOf(actor)?.multiHitAlwaysMax
                    ? multiHit.max
                    : multiHit.min + Math.floor(this.rng() * (multiHit.max - multiHit.min + 1)))
                : 1;

            targets.forEach((entry, targetNumber) => {
                const target = entry.pokemon;
                const targetIndex = entry.teamIndex;
                const targetSide = entry.side;
                const effects = move.effects || {};
                events.push({
                    type: "move",
                    side: action.side,
                    actorIndex: action.actorIndex,
                    targetSide,
                    targetIndex,
                    moveId: move.id,
                    moveName: move.displayName,
                    // The renderer picks a per-move animation from this slug;
                    // the display name alone is not a reliable key.
                    moveSlug: move.slug,
                    moveType: move.type,
                    movePower: move.power,
                    damageClass: move.damageClass,
                    priority: move.priority,
                    // A spread move emits one of these per target. Only the
                    // first is the attack itself; the rest exist to carry that
                    // target's damage, so the renderer must not replay the
                    // whole animation for them.
                    targetNumber,
                    spreadFollowUp: targetNumber > 0,
                    // Number of blows this use lands, so the scene can play the
                    // effect once per hit.
                    hits: hitCount,
                    message: targetNumber === 0 ? `${actor.name} used ${move.displayName}!` : "",
                });
                // Sucker Punch and Thunderclap only connect against a target
                // that is still about to attack. If the target has already
                // moved this turn, or is switching, using an item, or has a
                // status move queued, the punch catches nothing.
                if (effects.requiresTargetAttacking && !this.targetIsReadyingAttack(targetSide, targetIndex)) {
                    events.push({
                        type: "rule", side: targetSide, targetIndex,
                        message: "But it failed!",
                    });
                    return;
                }

                // Future Sight and Doom Desire only book the strike here. Their
                // listed power belongs to the hit that lands two turns later,
                // so running the damage step now would land it twice -- once on
                // the spot and again when the timer ran out.
                if (effects.delayed) {
                    this.applyMoveEffects(actor, action.side, action.actorIndex,
                        target, targetSide, targetIndex, move, 0, events);
                    return;
                }

                // Attract and Captivate only work on the opposite gender, and
                // never on a genderless target.
                if (effects.requiresOppositeGender && !this.oppositeGenders(actor, target)) {
                    events.push({
                        type: "rule",
                        side: targetSide,
                        targetIndex,
                        message: "But it failed!",
                    });
                    return;
                }
                // Shadow Force and Phantom Force strike through Protect.
                if (target !== actor && target.volatileStatus?.protected
                    && !multiTurnOf(move)?.bypassesProtect
                    && !(move.makesContact && abilityOf(actor)?.hitsThroughProtect)) {
                    events.push({ type: "status", side: targetSide, targetIndex, status: "protect", message: `${target.name} protected itself!` });
                    return;
                }

                // Psychic Terrain refuses priority moves against anything
                // standing on it.
                if (target !== actor && move.priority > 0 && this.isGrounded(target)
                    && fieldRegistry()?.getTerrain(this.activeTerrain())?.blocksPriority) {
                    events.push({
                        type: "rule", side: targetSide, targetIndex,
                        message: `${target.name} is protected by the psychic terrain!`,
                    });
                    return;
                }

                // A target part-way through Fly/Dig/Dive/Shadow Force is out
                // of reach unless this specific move is one of the few that
                // can follow it there.
                const hiding = target !== actor ? target.volatileStatus?.semiInvulnerable : null;
                const registry = multiTurnRegistry();
                if (hiding && registry && !registry.reachesHiddenTarget(hiding, move.slug)) {
                    events.push({
                        type: "miss", side: targetSide, targetIndex,
                        message: `${actor.name}'s attack couldn't reach ${target.name}!`,
                    });
                    return;
                }

                // Magic Coat bounces an incoming status move straight back;
                // Snatch takes a self-buff for itself instead.
                if (move.power <= 0) {
                    if (target !== actor && target.volatileStatus?.magicCoat) {
                        events.push({
                            type: "rule", side: targetSide, targetIndex,
                            message: `${target.name} bounced the move back!`,
                        });
                        this.applyMoveEffects(target, targetSide, targetIndex,
                            actor, action.side, action.actorIndex, move, 0, events);
                        return;
                    }
                    if (target === actor) {
                        const thief = this.getActivePokemon(this.opposingSide(action.side))
                            .find(({ pokemon }) => pokemon && !pokemon.fainted && pokemon.volatileStatus?.snatching);
                        if (thief) {
                            thief.pokemon.volatileStatus.snatching = false;
                            events.push({
                                type: "rule", side: this.opposingSide(action.side), targetIndex: thief.teamIndex,
                                message: `${thief.pokemon.name} snatched ${actor.name}'s move!`,
                            });
                            const thiefSide = this.opposingSide(action.side);
                            this.applyMoveEffects(thief.pokemon, thiefSide, thief.teamIndex,
                                thief.pokemon, thiefSide, thief.teamIndex, move, 0, events);
                            return;
                        }
                    }
                }

                // Spit Up has nothing to spit without a store.
                if (effects.stockpilePower && !numberOr(actor.volatileStatus?.stockpile, 0)) {
                    events.push({
                        type: "rule", side: action.side, targetIndex: action.actorIndex,
                        message: "But it failed!",
                    });
                    return;
                }

                const actorAbility = abilityOf(actor);
                // Mold Breaker punches straight through the defender's ability.
                const targetAbility = target !== actor && !actorAbility?.ignoreDefenderAbility
                    ? abilityOf(target)
                    : (target === actor ? abilityOf(target) : null);
                const pushAbility = (pokemon, pokemonSide, pokemonIndex, message, other) => {
                    events.push({
                        type: "ability",
                        side: pokemonSide,
                        targetIndex: pokemonIndex,
                        abilityName: pokemon.ability?.name || "",
                        message: String(message || "")
                            .replace("{name}", pokemon.name)
                            .replace("{other}", other?.name || ""),
                    });
                };

                // Galvanize/Aerilate retype the move before anything else.
                let moveType = move.type;
                // Electrify forces this user's move Electric; Ion Deluge does
                // the same to every Normal move on the field.
                if (actor.volatileStatus?.moveTypeForced) moveType = actor.volatileStatus.moveTypeForced;
                else if (this.fieldEffects.ionDeluge > 0 && moveType === "normal") moveType = "electric";
                if (typeof actorAbility?.moveTypeOverride === "function") {
                    // Liquid Voice keys off the move itself rather than its
                    // type, so the move travels with the context.
                    const overridden = actorAbility.moveTypeOverride({ moveType, move });
                    if (overridden) moveType = overridden;
                }
                // Weather Ball takes the sky's type and hits twice as hard.
                const field = fieldRegistry();
                const weatherKind = this.activeWeather();
                let weatherBallBoost = 1;
                if (move.slug === "weather-ball" && weatherKind && field) {
                    moveType = field.WEATHER_BALL_TYPES[weatherKind] || moveType;
                    weatherBallBoost = 2;
                }
                // Terrain Pulse takes the terrain's type; Rising Voltage just
                // hits harder on Electric Terrain.
                const terrainKind = this.activeTerrain();
                let terrainPulseBoost = 1;
                if (move.slug === "terrain-pulse" && terrainKind && field) {
                    moveType = field.TERRAIN_PULSE_TYPES[terrainKind] || moveType;
                    terrainPulseBoost = 2;
                } else if (move.slug === "rising-voltage" && terrainKind === "electric"
                    && this.isGrounded(target)) {
                    terrainPulseBoost = 2;
                }

                // Soundproof / Overcoat shrug the move off entirely.
                if (target !== actor && typeof targetAbility?.blockMove === "function" && targetAbility.blockMove({ move })) {
                    pushAbility(target, targetSide, targetIndex, `{name} was protected by ${target.ability?.name}!`);
                    if (targetAbility.blockBoost) {
                        this.applyStatStage(target, targetSide, targetIndex,
                            targetAbility.blockBoost.stat, targetAbility.blockBoost.stages, events, null);
                    }
                    return;
                }

                // Absorb/redirect abilities: immune, possibly with a bonus.
                if (target !== actor && typeof targetAbility?.typeImmunity === "function") {
                    const verdict = targetAbility.typeImmunity({ moveType, move, attacker: actor, defender: target });
                    if (verdict?.immune) {
                        pushAbility(target, targetSide, targetIndex, verdict.message, actor);
                        if (verdict.healRatio) {
                            const restored = Math.min(target.maxHp - target.hp, Math.max(1, Math.floor(target.maxHp * verdict.healRatio)));
                            if (restored > 0) {
                                target.hp += restored;
                                events.push({ type: "heal", side: targetSide, targetIndex, newHp: target.hp, maxHp: target.maxHp, amount: restored, message: "" });
                            }
                        }
                        if (verdict.boost) this.applyStatStage(target, targetSide, targetIndex, verdict.boost.stat, verdict.boost.stages, events, null);
                        if (verdict.flag) target.volatileStatus[verdict.flag] = true;
                        return;
                    }
                }

                // The type chart applies to status moves too -- Thunder Wave
                // cannot touch a Ground type, Sand Attack cannot touch a
                // Flying one, Growl cannot touch a Ghost. The engine's only
                // effectiveness check sat inside the damage branch below, so
                // every status move ignored typing entirely and Thunder Wave
                // was happily paralysing Quagsire. Restricted to foes: an
                // ally-targeting move like Helping Hand is not type-checked.
                if (move.power <= 0 && targetSide !== this.sideOf(actor)
                    && typeEffectiveness(moveType, target.types) === 0
                    && !(typeof actorAbility?.bypassTypeZero === "function"
                        && actorAbility.bypassTypeZero({ moveType, defenderTypes: target.types }))) {
                    events.push({
                        type: "immune", side: targetSide, targetIndex,
                        message: `It doesn't affect ${target.name}...`,
                    });
                    return;
                }

                if (this.rng() * 100 >= moveAccuracy(actor, target, move, weatherKind)) {
                    events.push({ type: "miss", side: targetSide, targetIndex, message: `${actor.name}'s move missed ${target.name}!` });
                    return;
                }
                outcome.landed = true;

                let damage = 0;
                let landedCrit = false;
                if (move.power > 0) {
                    // Telepathy: an ally's spread move passes straight through.
                    if (targetSide === action.side && target !== actor && abilityOf(target)?.allyDamageImmune) {
                        pushAbility(target, targetSide, targetIndex, "{name} anticipated its ally's attack!");
                        return;
                    }
                    let effectiveness = moveTypeEffectiveness(moveType, target.types, move);
                    // Wonder Guard shrugs off anything that is not super
                    // effective; only the mighty may pass.
                    if (target !== actor && targetAbility?.onlySuperEffective && effectiveness <= 1) {
                        pushAbility(target, targetSide, targetIndex, `{name} was protected by ${target.ability?.name}!`);
                        return;
                    }
                    if (effectiveness === 0 && typeof actorAbility?.bypassTypeZero === "function"
                        && actorAbility.bypassTypeZero({ moveType, defenderTypes: target.types })) {
                        effectiveness = 1;
                    }
                    if (effectiveness === 0) {
                        events.push({ type: "immune", side: targetSide, targetIndex, message: `It doesn't affect ${target.name}...` });
                        return;
                    }
                    const physical = move.damageClass.includes("physical");
                    // Lucky Chant shields a whole side from critical hits.
                    const critBlocked = Boolean(targetAbility?.preventCrit)
                        || this.sideState[targetSide]?.luckyChant > 0;
                    // A high-crit move is one stage, Focus Energy is two, and
                    // they stack the way the games' ladder does.
                    const critStage = clamp((effects.highCritRatio ? 1 : 0)
                        + numberOr(actorAbility?.critStageBonus, 0)
                        + numberOr(actor.volatileStatus?.critStages, 0), 0, CRIT_STAGE_ODDS.length - 1);
                    const critChance = CRIT_STAGE_ODDS[critStage]
                        + (heldItemOf(actor)?.critBonus || 0);
                    // Laser Focus guarantees this one, then is spent. Merciless
                    // does the same against anything already poisoned.
                    const guaranteed = typeof actorAbility?.alwaysCritAgainst === "function"
                        && actorAbility.alwaysCritAgainst({ defender: target, attacker: actor });
                    const focused = Boolean(actor.volatileStatus?.laserFocus) || guaranteed;
                    if (actor.volatileStatus?.laserFocus) actor.volatileStatus.laserFocus = false;
                    // Rolled before the stat lookups: a critical hit ignores
                    // the attacker's unfavourable stages and the defender's
                    // favourable ones.
                    const critical = !effects.ohko && !critBlocked
                        && (focused || this.rng() < critChance);
                    landedCrit = critical;
                    const critMult = critical ? 1.5 * (actorAbility?.critDamageMult || 1) : 1;
                    const statOptions = { weather: weatherKind, terrain: terrainKind };
                    if (actorAbility?.ignoreTargetStages) statOptions.ignoreStages = true;
                    if (critical) statOptions.stageCeil = 0;
                    const attackStat = modifiedStat(actor, physical ? "attack" : "specialAttack",
                        { weather: weatherKind, stageFloor: critical ? 0 : -6 });
                    // Wonder Room has everyone defend with the other guard.
                    const guardStat = this.fieldEffects.wonderRoom > 0
                        ? (physical ? "specialDefense" : "defense")
                        : (physical ? "defense" : "specialDefense");
                    const defenseStat = modifiedStat(target, guardStat, statOptions);
                    // STAB follows the move's CONVERTED type: an Electrify'd
                    // or -ate-retyped move belongs to its new type.
                    const stab = actor.types.includes(moveType)
                        ? (actorAbility?.stabOverride || 1.5)
                        : 1;
                    // Spread moves hit softer per target in doubles.
                    const spreadMult = targets.length > 1 ? 0.75 : 1;
                    // Spit Up is worth 100 per stored charge, and the moves in
                    // DYNAMIC_POWER work theirs out from speed, health or PP.
                    // The data lists all of their powers as a placeholder 1.
                    const dynamic = DYNAMIC_POWER[move.slug];
                    const rawPower = effects.stockpilePower
                        ? 100 * numberOr(actor.volatileStatus?.stockpile, 0)
                        : dynamic
                            ? dynamic({
                                actor,
                                target,
                                move,
                                actorSpeed: modifiedStat(actor, "speed", { weather: weatherKind }),
                                targetSpeed: modifiedStat(target, "speed", { weather: weatherKind }),
                                rng: () => this.rng(),
                            })
                            : move.power;
                    const baseDamage = (((2 * actor.level / 5 + 2) * Math.max(1, rawPower) * attackStat / Math.max(1, defenseStat)) / 50) + 2;
                    const fieldModifier = moveType === "fire" && this.fieldEffects.waterSport > 0 ? 1 / 3
                        : moveType === "electric" && this.fieldEffects.mudSport > 0 ? 1 / 3 : 1;
                    // Rain powers up Water and damps Fire, and vice versa.
                    const weatherMult = field ? field.weatherTypeMultiplier(weatherKind, moveType) : 1;
                    // Reflect / Light Screen / Aurora Veil on the target's side.
                    const screenMult = actorAbility?.bypassScreens
                        ? 1
                        : this.screenMultiplier(targetSide, physical ? "physical" : "special", critical);
                    // Terrain boosts its own type for whoever stands on it,
                    // and damps quakes / Dragon moves against grounded targets.
                    const terrainMult = field
                        ? field.terrainDamageMultiplier(this.activeTerrain(), moveType, move.slug,
                            this.isGrounded(actor), this.isGrounded(target))
                        : 1;
                    const attackerItem = heldItemOf(actor);
                    const itemMult = typeof attackerItem?.damageMult === "function"
                        ? attackerItem.damageMult({ moveType, physical, effectiveness, move })
                        : 1;
                    // Sand Force boosts Rock/Ground/Steel in a sandstorm.
                    const weatherAttackMult = typeof actorAbility?.weatherDamageMult === "function"
                        ? actorAbility.weatherDamageMult({ weather: weatherKind, moveType })
                        : 1;
                    // Gust/Twister, Earthquake/Magnitude and Surf/Whirlpool
                    // catch a hidden target and hit twice as hard for it.
                    const exposedMult = hiding && registry
                        ? registry.hiddenTargetDamageMultiplier(hiding, move.slug)
                        : 1;
                    // Rollout and Ice Ball double every consecutive turn.
                    const rolloutMult = pending?.kind === "rollout"
                        ? Math.pow(2, Math.min(4, numberOr(pending.consecutive, 1)))
                        : 1;
                    const abilityContext = {
                        move,
                        moveType,
                        originalMoveType: move.type,
                        attacker: actor,
                        defender: target,
                        effectiveness,
                        physical,
                        makesContact: Boolean(move.makesContact),
                        moveHasSecondary: Boolean(effects.statusEffect || effects.flinchChance
                            || effects.confusionChance || (effects.statChanges || []).some((c) => c.target !== "self")),
                        moveHasRecoil: Boolean(effects.recoilRatio),
                        movedLast: this.turnActionIndex >= this.turnActionTotal,
                    };
                    let outgoingMult = 1;
                    if (typeof actorAbility?.outgoingDamageMult === "function") outgoingMult = actorAbility.outgoingDamageMult(abilityContext);
                    let incomingMult = 1;
                    if (target !== actor && typeof targetAbility?.incomingDamageMult === "function") incomingMult = targetAbility.incomingDamageMult(abilityContext);
                    // An ally's Helping Hand rides on this attack.
                    const helpMult = numberOr(actor.volatileStatus?.helpingHand, 0) || 1;
                    // Charge doubles the next Electric move and is then spent.
                    const chargeMult = actor.volatileStatus?.charged && moveType === "electric" ? 2 : 1;
                    if (chargeMult > 1) actor.volatileStatus.charged = false;
                    // Every hit of a multi-hit move rolls its own damage
                    // range (one crit roll covers the whole use, since the
                    // crit was settled before the stat lookups above).
                    const staticMult = stab * effectiveness * critMult * fieldModifier
                        * outgoingMult * incomingMult * exposedMult * rolloutMult
                        * weatherMult * screenMult * weatherAttackMult * weatherBallBoost
                        * terrainMult * terrainPulseBoost * itemMult * helpMult * chargeMult
                        * spreadMult;
                    damage = 0;
                    for (let hit = 0; hit < hitCount; hit += 1) {
                        const randomFactor = 0.85 + this.rng() * 0.15;
                        damage += Math.max(1, Math.floor(baseDamage * staticMult * randomFactor));
                    }
                    // Parental Bond tacks on a second, quarter-strength blow.
                    if (actorAbility?.extraHitRatio && hitCount === 1 && !effects.ohko) {
                        damage += Math.max(1, Math.floor(damage * actorAbility.extraHitRatio));
                    }
                    if (effects.fixedDamage) damage = effects.fixedDamage;
                    if (effects.levelDamage) damage = actor.level;
                    // Endeavor drags the target down to the user's own health;
                    // Final Gambit spends the user's remaining health as damage.
                    if (effects.matchHpDamage) damage = Math.max(0, target.hp - actor.hp);
                    if (effects.sacrificeDamage) damage = Math.max(1, actor.hp);
                    if (effects.targetHpFractionDamage) damage = Math.max(1, Math.floor(target.hp * effects.targetHpFractionDamage));
                    // OHKO moves ignore stats, STAB, crit, and the random roll
                    // entirely -- they just take the target straight to 0.
                    if (effects.ohko) damage = target.hp;
                    if (effects.nonLethal) damage = Math.min(damage, Math.max(0, target.hp - 1));
                    // A substitute soaks the whole blow and breaks when spent;
                    // nothing behind it takes damage, faints, or gets a
                    // secondary this turn.
                    const decoyHp = target !== actor && !actorAbility?.bypassScreens
                        ? numberOr(target.volatileStatus?.substituteHp, 0) : 0;
                    if (decoyHp > 0) {
                        const absorbed = Math.min(decoyHp, damage);
                        target.volatileStatus.substituteHp = decoyHp - absorbed;
                        events.push({
                            type: "damage", side: targetSide, targetIndex, damage: 0,
                            newHp: target.hp, maxHp: target.maxHp, effectiveness, critical,
                            message: `The substitute took damage for ${target.name}!`,
                        });
                        if (target.volatileStatus.substituteHp <= 0) {
                            target.volatileStatus.substituteHp = 0;
                            events.push({
                                type: "status", side: targetSide, targetIndex, status: null,
                                message: `${target.name}'s substitute faded!`,
                            });
                        }
                        // The move still connected, so a rampage keeps going.
                        outcome.landed = true;
                        return;
                    }
                    // Endure holds on from any HP, and does it first.
                    if (damage >= target.hp && target !== actor && target.volatileStatus?.enduring) {
                        damage = Math.max(0, target.hp - 1);
                        events.push({
                            type: "rule", side: targetSide, targetIndex,
                            message: `${target.name} endured the hit!`,
                        });
                    }
                    // Sturdy: hang on at 1 HP from full.
                    if (damage >= target.hp && target !== actor
                        && typeof targetAbility?.survivesKO === "function"
                        && targetAbility.survivesKO({ defender: target })) {
                        damage = Math.max(0, target.hp - 1);
                        pushAbility(target, targetSide, targetIndex, `{name} endured the hit using ${target.ability?.name}!`);
                    }
                    // Focus Sash and Focus Band do the same job from the bag.
                    const defenderItem = heldItemOf(target);
                    if (damage >= target.hp && target !== actor && target.hp > 1
                        && typeof defenderItem?.survivesKO === "function"
                        && defenderItem.survivesKO({ defender: target, rng: () => this.rng() })) {
                        damage = Math.max(0, target.hp - 1);
                        events.push({
                            type: "item", side: targetSide, targetIndex,
                            message: String(defenderItem.survivalMessage || "{name} hung on!").replace("{name}", target.name),
                        });
                        if (defenderItem.singleUse) target.heldItemSpent = true;
                    }
                    target.hp = Math.max(0, target.hp - damage);
                    target.fainted = target.hp === 0;
                    outcome.knockedOut = outcome.knockedOut || target.fainted;
                    // A Pokemon in the middle of Bide remembers what it soaked
                    // and who dealt it.
                    if (target.pendingMove?.kind === "bide") {
                        target.pendingMove.damageTaken += damage;
                        target.pendingMove.lastAttacker = actor;
                    }
                    events.push({
                        type: "damage",
                        side: targetSide,
                        targetIndex,
                        damage,
                        newHp: target.hp,
                        maxHp: target.maxHp,
                        effectiveness,
                        critical,
                        ohko: Boolean(effects.ohko),
                        hits: hitCount,
                        // The games announce a critical hit and the matchup
                        // together. This was a single-slot ternary, so a crit,
                        // a multi-hit or a one-hit KO silently swallowed the
                        // "super effective" line that should follow it.
                        message: [
                            effects.ohko ? "It's a one-hit KO!" : "",
                            hitCount > 1 ? `Hit ${hitCount} times!` : "",
                            critical ? "A critical hit!" : "",
                            effectiveness > 1 ? "It's super effective!"
                                : effectiveness < 1 ? "It's not very effective..." : "",
                        ].filter(Boolean).join(" "),
                    });
                    this.runHeldItemHits({
                        actor, actorSide: action.side, actorIndex: action.actorIndex,
                        target, targetSide, targetIndex, damage, effectiveness, events,
                        makesContact: Boolean(move.makesContact),
                    });
                    this.runOnHitAbilities({
                        actor, actorSide: action.side, actorIndex: action.actorIndex, actorAbility,
                        target, targetSide, targetIndex, targetAbility,
                        move, moveType, physical, critical, damage, events, pushAbility,
                    });
                }
                this.applyMoveEffects(actor, action.side, action.actorIndex, target, targetSide, targetIndex, move, damage, events, { firstTarget: targetNumber === 0 });
                if (target.fainted) {
                    events.push({ type: "faint", side: targetSide, targetIndex, message: `${target.name} fainted!` });
                    // Counted so the run can pay the knockout share of the
                    // duel's experience to whoever earned it.
                    if (target !== actor && targetSide !== action.side) {
                        actor.duelKnockouts = numberOr(actor.duelKnockouts, 0) + 1;
                    }
                    if (target !== actor && typeof actorAbility?.onKnockOut === "function") {
                        actorAbility.onKnockOut(this.abilityContext(actor, action.side, action.actorIndex, events));
                    }
                    // Grudge empties the PP of whatever landed the final blow.
                    if (target !== actor && target.volatileStatus?.grudge && !actor.fainted && move.pp > 0) {
                        move.pp = 0;
                        events.push({
                            type: "rule", side: action.side, targetIndex: action.actorIndex,
                            message: `${actor.name}'s ${move.displayName} lost all its PP due to the grudge!`,
                        });
                    }
                    // Destiny Bond takes whoever landed the final blow along.
                    if (target !== actor && target.volatileStatus?.destinyBond && !actor.fainted) {
                        actor.hp = 0;
                        actor.fainted = true;
                        events.push({
                            type: "faint", side: action.side, targetIndex: action.actorIndex,
                            message: `${actor.name} was dragged down by ${target.name}'s Destiny Bond!`,
                        });
                    }
                }
            });

            if (move.effects?.selfFaint && !actor.fainted) {
                actor.hp = 0;
                actor.fainted = true;
                events.push({ type: "faint", side: action.side, targetIndex: action.actorIndex, message: `${actor.name} fainted!` });
            }

            // The aim from Lock-On is spent on the next move actually thrown.
            if (actor.volatileStatus?.lockedOn && !move.effects?.lockOn) {
                actor.volatileStatus.lockedOn = false;
            }
            this.advanceCommitment(action, actor, move, multiTurn, events, outcome);
        }

        fillActiveSlots(side, events) {
            for (let slot = 0; slot < this.activeLimit[side]; slot += 1) {
                const currentIndex = this.active[side][slot];
                const current = this.teams[side][currentIndex];
                if (isBattleReady(current)) continue;
                const occupied = new Set(this.active[side]);
                const nextIndex = this.teams[side].findIndex((pokemon, index) => isBattleReady(pokemon) && !occupied.has(index));
                if (nextIndex < 0) continue;
                this.active[side][slot] = nextIndex;
                this.teams[side][nextIndex].fainted = false;
                this.teams[side][nextIndex].turnsActive = -1;
                this.teams[side][nextIndex].volatileStatus = {};
                this.teams[side][nextIndex].pendingMove = null;
                events.push({
                    type: "switch",
                    side,
                    slot,
                    targetIndex: nextIndex,
                    message: side === "player" ? `Go, ${this.teams[side][nextIndex].name}!` : `The opponent sent out ${this.teams[side][nextIndex].name}!`,
                });
                this.runSwitchInAbility(side, nextIndex, events);
            }
        }

        // Player slots that are empty while the bench still has someone.
        pendingReplacements() {
            if (this.result) return [];
            const occupied = new Set(this.active.player);
            const benchAvailable = this.teams.player
                .some((pokemon, index) => isBattleReady(pokemon) && !occupied.has(index));
            if (!benchAvailable) return [];
            const slots = [];
            for (let slot = 0; slot < this.activeLimit.player; slot += 1) {
                if (!isBattleReady(this.teams.player[this.active.player[slot]])) slots.push(slot);
            }
            return slots;
        }

        // Who the player may send into a given empty slot.
        replacementChoices() {
            const occupied = new Set(this.active.player);
            return this.teams.player
                .map((pokemon, teamIndex) => ({ pokemon, teamIndex }))
                .filter(({ pokemon, teamIndex }) => isBattleReady(pokemon) && !occupied.has(teamIndex));
        }

        // Send a chosen Pokemon into an empty slot. Returns the events for
        // that entry, and leaves the phase in "replace" while more slots wait.
        sendReplacement(slot, teamIndex) {
            if (this.phase !== "replace") throw new Error("No replacement is needed right now.");
            if (!this.pendingReplacements().includes(Number(slot))) {
                throw new Error("That slot does not need a replacement.");
            }
            const replacement = this.teams.player[teamIndex];
            if (!isBattleReady(replacement)) throw new Error("Choose a healthy Pokemon.");
            if (this.active.player.includes(Number(teamIndex))) throw new Error("That Pokemon is already in battle.");

            const events = [];
            this.active.player[Number(slot)] = Number(teamIndex);
            replacement.fainted = false;
            replacement.turnsActive = -1;
            replacement.volatileStatus = {};
            replacement.pendingMove = null;
            events.push({
                type: "switch",
                side: "player",
                slot: Number(slot),
                targetIndex: Number(teamIndex),
                message: `Go, ${replacement.name}!`,
            });
            this.runSwitchInAbility("player", Number(teamIndex), events);
            this.syncFaintedState();

            if (this.pendingReplacements().length) return events;

            // Every slot filled: finish the turn that was paused.
            if (!this.hasBattleReadyPokemon("player") || !this.hasBattleReadyPokemon("enemy")) {
                this.phase = "finished";
                this.endBattleCleanup();
                this.result = this.hasBattleReadyPokemon("player") ? "victory" : "defeat";
                events.push({
                    type: "result",
                    result: this.result,
                    message: this.result === "victory"
                        ? "Victory! The opposing team is out of Pokemon."
                        : "Defeat. Your team can no longer battle.",
                });
                return events;
            }
            this.beginNextTurn(events);
            return events;
        }

        // The bookkeeping that normally closes a turn, split out so the
        // replacement flow can run it once the player has chosen.
        // Closes a turn: ages everyone on the field, expires the one-turn
        // volatiles, and counts the field timers down.
        //
        // This used to exist twice -- once inline at the end of resolveTurn
        // and once here for the replacement flow -- and the two drifted. The
        // copy here never aged turnsActive, so a Pokemon sent in after a
        // knockout stayed on the -1 that marks "just switched in" and could
        // not use Fake Out on its first real turn, only on the one after.
        // The same copy also let Endure, Helping Hand, redirection and the
        // rest outlive their turn.
        beginNextTurn(events = []) {
            ["player", "enemy"].forEach((side) => {
                this.getActivePokemon(side).forEach(({ pokemon }) => {
                    pokemon.turnsActive = Math.max(0, numberOr(pokemon.turnsActive, 0) + 1);
                    pokemon.volatileStatus.flinched = false;
                    pokemon.volatileStatus.protected = false;
                    pokemon.volatileStatus.enduring = false;
                    pokemon.volatileStatus.destinyBond = false;
                    // One-turn support effects expire with the turn.
                    pokemon.volatileStatus.helpingHand = 0;
                    pokemon.volatileStatus.redirecting = false;
                    pokemon.volatileStatus.movesFirst = false;
                    pokemon.volatileStatus.movesLast = false;
                    pokemon.volatileStatus.magicCoat = false;
                    pokemon.volatileStatus.snatching = false;
                    pokemon.volatileStatus.moveTypeForced = null;
                });
            });
            Object.keys(this.fieldEffects).forEach((key) => {
                this.fieldEffects[key] = Math.max(0, numberOr(this.fieldEffects[key], 0) - 1);
            });
            this.tickFieldTimers(events);
            this.turn += 1;
            this.phase = "command";
        }

        // Anything a move rewrote for the duration of the duel goes back to
        // what the species record says, so nothing leaks into the next fight.
        endBattleCleanup() {
            Object.values(this.teams).flat().forEach((pokemon) => {
                if (!pokemon) return;
                restoreBattleMutations(pokemon);
                pokemon.volatileStatus = {};
                pokemon.pendingMove = null;
                // Stat stages are battle-scoped in every mainline game; they
                // survived here because only volatiles were reset.
                pokemon.statStages = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0]));
                pokemon.turnsActive = 0;
                pokemon.lastMoveIndex = null;
            });
        }

        forfeit() {
            if (this.result) return [];
            this.phase = "finished";
            this.endBattleCleanup();
            this.result = "forfeit";
            this.playerActions = [];
            return [{ type: "result", result: "forfeit", message: "You forfeited the battle." }];
        }
    }

    return {
        BattleEngine,
        TYPE_CHART,
        createCombatant,
        rollGender,
        learnedMoves,
        estimateMoveDamage,
        scoreAiMove,
        typeEffectiveness,
        megaDisplayName,
    };
}));
