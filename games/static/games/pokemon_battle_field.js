(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PokemonBattleField = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    // ------------------------------------------------------------------
    // Battlefield state: weather, entry hazards and screens. Like the
    // ability and multi-turn registries this is an explicit slug table --
    // the move descriptions are too loose to infer from ("A 5-turn
    // sandstorm...", "A wall of light...", "Levitating rocks are laid...").
    //
    // Note the dex ships Snowscape rather than Hail, so snow boosts Ice
    // Defense instead of chipping. Sandstorm is the only chipping weather.
    // ------------------------------------------------------------------

    const WEATHER = {
        rain: {
            key: "rain",
            label: "Rain",
            startMessage: "It started to rain!",
            endMessage: "The rain stopped.",
            ongoingMessage: "Rain continues to fall.",
            // Move-type damage multipliers.
            typeMultipliers: { water: 1.5, fire: 0.5 },
            // Moves that never miss / always miss regardless of accuracy.
            perfectAccuracy: ["thunder", "hurricane"],
            healRatio: 0.25,
        },
        sun: {
            key: "sun",
            label: "Harsh sunlight",
            startMessage: "The sunlight turned harsh!",
            endMessage: "The sunlight faded.",
            ongoingMessage: "The sunlight is strong.",
            typeMultipliers: { fire: 1.5, water: 0.5 },
            // Thunder and Hurricane are wildly inaccurate under the sun.
            accuracyOverrides: { thunder: 50, hurricane: 50 },
            healRatio: 2 / 3,
            // Solar Beam and Solar Blade fire the same turn.
            skipsCharge: "sun",
        },
        sandstorm: {
            key: "sandstorm",
            label: "Sandstorm",
            startMessage: "A sandstorm kicked up!",
            endMessage: "The sandstorm subsided.",
            ongoingMessage: "The sandstorm rages.",
            chipRatio: 1 / 16,
            chipMessage: "{name} is buffeted by the sandstorm!",
            // Immune types take no chip damage.
            chipImmuneTypes: ["rock", "ground", "steel"],
            // Rock types get a Special Defense boost while it blows.
            statBoost: { types: ["rock"], stat: "specialDefense", multiplier: 1.5 },
            healRatio: 0.25,
        },
        snow: {
            key: "snow",
            label: "Snow",
            startMessage: "It started to snow!",
            endMessage: "The snow stopped.",
            ongoingMessage: "Snow continues to fall.",
            perfectAccuracy: ["blizzard"],
            // Snowscape boosts Ice Defense rather than dealing chip damage.
            statBoost: { types: ["ice"], stat: "defense", multiplier: 1.5 },
            healRatio: 0.25,
            allowsAuroraVeil: true,
        },
    };

    // Moves that set weather, keyed by slug.
    const WEATHER_MOVES = {
        "rain-dance": { weather: "rain", turns: 5 },
        "sunny-day": { weather: "sun", turns: 5 },
        sandstorm: { weather: "sandstorm", turns: 5 },
        snowscape: { weather: "snow", turns: 5 },
        "chilly-reception": { weather: "snow", turns: 5 },
    };

    // Abilities that set weather the moment their owner enters.
    const WEATHER_ABILITIES = {
        drizzle: "rain",
        drought: "sun",
        "sand-stream": "sandstorm",
        "snow-warning": "snow",
    };

    // ------------------------------------------------------------------
    // Terrain. Everything here reaches only *grounded* Pokemon -- anything
    // Flying or holding Levitate is above it and unaffected.
    // ------------------------------------------------------------------

    const TERRAIN = {
        electric: {
            key: "electric",
            label: "Electric Terrain",
            startMessage: "An electric current runs across the battlefield!",
            endMessage: "The electricity disappeared from the battlefield.",
            boostType: "electric",
            boostMultiplier: 1.3,
            // Grounded Pokemon cannot be put to sleep.
            blocksStatus: ["sleep"],
        },
        grassy: {
            key: "grassy",
            label: "Grassy Terrain",
            startMessage: "Grass grew to cover the battlefield!",
            endMessage: "The grass disappeared from the battlefield.",
            boostType: "grass",
            boostMultiplier: 1.3,
            healRatio: 1 / 16,
            // The ground absorbs quakes.
            dampens: { moves: ["earthquake", "bulldoze", "magnitude"], multiplier: 0.5 },
        },
        misty: {
            key: "misty",
            label: "Misty Terrain",
            startMessage: "Mist swirled around the battlefield!",
            endMessage: "The mist disappeared from the battlefield.",
            // Halves Dragon moves aimed at grounded targets.
            weakensTypeAgainstGrounded: { type: "dragon", multiplier: 0.5 },
            blocksAllStatus: true,
        },
        psychic: {
            key: "psychic",
            label: "Psychic Terrain",
            startMessage: "The battlefield got weird!",
            endMessage: "The weirdness disappeared from the battlefield.",
            boostType: "psychic",
            boostMultiplier: 1.3,
            // Priority moves cannot touch a grounded Pokemon.
            blocksPriority: true,
        },
    };

    const TERRAIN_MOVES = {
        "electric-terrain": { terrain: "electric", turns: 5 },
        "grassy-terrain": { terrain: "grassy", turns: 5 },
        "misty-terrain": { terrain: "misty", turns: 5 },
        "psychic-terrain": { terrain: "psychic", turns: 5 },
    };

    const TERRAIN_ABILITIES = {
        "electric-surge": "electric",
        "grassy-surge": "grassy",
        "misty-surge": "misty",
        "psychic-surge": "psychic",
    };

    // Terrain Pulse takes the terrain's type and doubles.
    const TERRAIN_PULSE_TYPES = {
        electric: "electric",
        grassy: "grass",
        misty: "fairy",
        psychic: "psychic",
    };

    // ------------------------------------------------------------------
    // Entry hazards. `layers` caps how many times a hazard can stack; the
    // damage/effect is read off the layer count.
    // ------------------------------------------------------------------

    const HAZARDS = {
        stealthRock: {
            key: "stealthRock",
            label: "Stealth Rock",
            layers: 1,
            setMessage: "Pointed stones float in the air around the opposing team!",
            // Damage is 1/8 scaled by how well Rock hits the arriving type.
            damageBase: 1 / 8,
            scaleByType: "rock",
            grounded: false,
            damageMessage: "Pointed stones dug into {name}!",
        },
        spikes: {
            key: "spikes",
            label: "Spikes",
            layers: 3,
            setMessage: "Spikes were scattered around the opposing team!",
            damageByLayer: [1 / 8, 1 / 6, 1 / 4],
            grounded: true,
            damageMessage: "{name} was hurt by the spikes!",
        },
        toxicSpikes: {
            key: "toxicSpikes",
            label: "Toxic Spikes",
            layers: 2,
            setMessage: "Poison spikes were scattered around the opposing team!",
            statusByLayer: ["poison", "toxic"],
            grounded: true,
            // A grounded Poison type soaks the spikes up instead.
            absorbedByTypes: ["poison"],
            absorbMessage: "{name} absorbed the poison spikes!",
            statusMessage: "{name} was poisoned by the spikes!",
        },
        stickyWeb: {
            key: "stickyWeb",
            label: "Sticky Web",
            layers: 1,
            setMessage: "A sticky web spreads out beneath the opposing team!",
            statDrop: { stat: "speed", stages: 1 },
            grounded: true,
            statMessage: "{name} was caught in a sticky web!",
        },
    };

    const HAZARD_MOVES = {
        "stealth-rock": "stealthRock",
        spikes: "spikes",
        "toxic-spikes": "toxicSpikes",
        "sticky-web": "stickyWeb",
    };

    // ------------------------------------------------------------------
    // Screens and side-wide protections.
    // ------------------------------------------------------------------

    const SCREENS = {
        reflect: {
            key: "reflect",
            label: "Reflect",
            turns: 5,
            setMessage: "Reflect raised {side} Defense!",
            endMessage: "{side} Reflect wore off.",
            damageClass: "physical",
            multiplier: 0.5,
        },
        lightScreen: {
            key: "lightScreen",
            label: "Light Screen",
            turns: 5,
            setMessage: "Light Screen raised {side} Special Defense!",
            endMessage: "{side} Light Screen wore off.",
            damageClass: "special",
            multiplier: 0.5,
        },
        auroraVeil: {
            key: "auroraVeil",
            label: "Aurora Veil",
            turns: 5,
            setMessage: "Aurora Veil made {side} stronger against attacks!",
            endMessage: "{side} Aurora Veil wore off.",
            damageClass: "both",
            multiplier: 0.5,
            // Only settable while it is snowing.
            requiresWeather: "snow",
        },
        safeguard: {
            key: "safeguard",
            label: "Safeguard",
            turns: 5,
            setMessage: "{side} team became cloaked in a mystical veil!",
            endMessage: "{side} Safeguard wore off.",
            blocksStatus: true,
        },
        mist: {
            key: "mist",
            label: "Mist",
            turns: 5,
            setMessage: "{side} team became shrouded in mist!",
            endMessage: "{side} Mist lifted.",
            blocksStatDrops: true,
        },
    };

    const SCREEN_MOVES = {
        reflect: "reflect",
        "light-screen": "lightScreen",
        "aurora-veil": "auroraVeil",
        safeguard: "safeguard",
        mist: "mist",
    };

    // Moves that clear field state rather than set it.
    const CLEARING_MOVES = {
        "rapid-spin": { hazards: "own" },
        defog: { hazards: "both", screens: "foe", evasionDrop: true },
        "brick-break": { screens: "foe" },
        "psychic-fangs": { screens: "foe" },
        "raging-bull": { screens: "foe" },
    };

    // Weather Ball changes type and doubles in power outside clear skies.
    const WEATHER_BALL_TYPES = {
        rain: "water",
        sun: "fire",
        sandstorm: "rock",
        snow: "ice",
    };

    // Moves whose healing scales with the sky.
    const WEATHER_HEAL_MOVES = new Set(["moonlight", "synthesis", "morning-sun", "shore-up"]);

    function getWeather(kind) {
        return WEATHER[String(kind || "")] || null;
    }

    // Flying types and Levitate float over ground-based hazards.
    function isGrounded(types, abilitySlug) {
        if (abilitySlug === "levitate") return false;
        return !(types || []).includes("flying");
    }

    // Damage multiplier the weather applies to a move of this type.
    function weatherTypeMultiplier(kind, moveType) {
        const weather = getWeather(kind);
        if (!weather) return 1;
        return weather.typeMultipliers?.[String(moveType || "")] ?? 1;
    }

    // Returns null when the weather has nothing to say about accuracy.
    function weatherAccuracy(kind, moveSlug) {
        const weather = getWeather(kind);
        if (!weather) return null;
        const slug = String(moveSlug || "");
        if (weather.perfectAccuracy?.includes(slug)) return 100;
        const override = weather.accuracyOverrides?.[slug];
        return Number.isFinite(override) ? override : null;
    }

    // Whether this Pokemon takes end-of-turn chip from the weather.
    function takesWeatherChip(kind, types) {
        const weather = getWeather(kind);
        if (!weather?.chipRatio) return false;
        const immune = weather.chipImmuneTypes || [];
        return !(types || []).some((type) => immune.includes(type));
    }

    // Sandstorm's Rock Sp.Def boost and Snow's Ice Defense boost.
    function weatherStatMultiplier(kind, types, stat) {
        const boost = getWeather(kind)?.statBoost;
        if (!boost || boost.stat !== stat) return 1;
        return (types || []).some((type) => boost.types.includes(type)) ? boost.multiplier : 1;
    }

    function hazardFor(slug) {
        const key = HAZARD_MOVES[String(slug || "")];
        return key ? HAZARDS[key] : null;
    }

    function screenFor(slug) {
        const key = SCREEN_MOVES[String(slug || "")];
        return key ? SCREENS[key] : null;
    }

    function weatherMoveFor(slug) {
        return WEATHER_MOVES[String(slug || "")] || null;
    }

    function getTerrain(kind) {
        return TERRAIN[String(kind || "")] || null;
    }

    function terrainMoveFor(slug) {
        return TERRAIN_MOVES[String(slug || "")] || null;
    }

    // Damage multiplier the terrain applies. The boost only counts when the
    // *attacker* is standing on it; the damping and Dragon weakening count
    // when the *target* is.
    function terrainDamageMultiplier(kind, moveType, moveSlug, attackerGrounded, defenderGrounded) {
        const terrain = getTerrain(kind);
        if (!terrain) return 1;
        let multiplier = 1;
        if (attackerGrounded && terrain.boostType === moveType) multiplier *= terrain.boostMultiplier;
        if (defenderGrounded && terrain.weakensTypeAgainstGrounded?.type === moveType) {
            multiplier *= terrain.weakensTypeAgainstGrounded.multiplier;
        }
        if (terrain.dampens?.moves.includes(String(moveSlug || ""))) {
            multiplier *= terrain.dampens.multiplier;
        }
        return multiplier;
    }

    // Whether the terrain refuses this status to a grounded Pokemon.
    function terrainBlocksStatus(kind, condition, grounded) {
        const terrain = getTerrain(kind);
        if (!terrain || !grounded) return false;
        if (terrain.blocksAllStatus) return true;
        return Boolean(terrain.blocksStatus?.includes(condition));
    }

    function clearingMoveFor(slug) {
        return CLEARING_MOVES[String(slug || "")] || null;
    }

    // An empty per-side hazard/screen record.
    function emptySideState() {
        return {
            hazards: { stealthRock: 0, spikes: 0, toxicSpikes: 0, stickyWeb: 0 },
            screens: { reflect: 0, lightScreen: 0, auroraVeil: 0, safeguard: 0, mist: 0 },
        };
    }

    return {
        WEATHER,
        WEATHER_MOVES,
        WEATHER_ABILITIES,
        WEATHER_BALL_TYPES,
        WEATHER_HEAL_MOVES,
        TERRAIN,
        TERRAIN_MOVES,
        TERRAIN_ABILITIES,
        TERRAIN_PULSE_TYPES,
        getTerrain,
        terrainMoveFor,
        terrainDamageMultiplier,
        terrainBlocksStatus,
        HAZARDS,
        SCREENS,
        CLEARING_MOVES,
        getWeather,
        isGrounded,
        weatherTypeMultiplier,
        weatherAccuracy,
        takesWeatherChip,
        weatherStatMultiplier,
        hazardFor,
        screenFor,
        weatherMoveFor,
        clearingMoveFor,
        emptySideState,
    };
}));
