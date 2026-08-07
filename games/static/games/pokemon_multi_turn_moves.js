(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PokemonMultiTurnMoves = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    // ------------------------------------------------------------------
    // Moves that span more than one turn. This is an explicit slug table on
    // purpose: the move descriptions cannot be pattern-matched safely. The
    // word "charge" appears in Tackle, Spark, Waterfall, Take Down, Flame
    // Wheel, Extreme Speed and Head Charge, none of which are two-turn
    // moves, while genuine two-turn moves phrase themselves half a dozen
    // different ways ("2nd turn", "two-turn", "vanishes, then strikes",
    // "gathers space power"). Every entry below was read off the move's own
    // description in data/pokemon/gen1.json.
    //
    // kind:
    //   charge   - turn 1 commits, turn 2 fires
    //   recharge - fires now, turn 2 is spent recovering
    //   rampage  - locked for 2-3 turns, then self-confusion
    //   rollout  - locked up to 5 turns, power doubles per consecutive hit
    //   bide     - stores damage for 2 turns, then returns double
    // ------------------------------------------------------------------

    const CHARGE_MOVES = {
        "solar-beam": { message: "{name} absorbed light!", skipInWeather: "sun" },
        "solar-blade": { message: "{name} absorbed light!", skipInWeather: "sun" },
        "razor-wind": { message: "{name} whipped up a whirlwind!" },
        "sky-attack": { message: "{name} became cloaked in a harsh light!" },
        "freeze-shock": { message: "{name} became cloaked in a freezing light!" },
        "ice-burn": { message: "{name} became cloaked in freezing air!" },
        "geomancy": { message: "{name} is absorbing power!" },
        // The charge turn itself grants the boost, so the release turn must
        // not re-apply the same stat change (see chargeBoosts handling).
        "skull-bash": {
            message: "{name} tucked in its head!",
            chargeBoosts: [{ stat: "defense", stages: 1 }, { stat: "attack", stages: 1 }],
        },
        "meteor-beam": {
            message: "{name} is overflowing with space power!",
            chargeBoosts: [{ stat: "specialAttack", stages: 1 }],
        },
        "electro-shot": {
            message: "{name} absorbed electricity!",
            chargeBoosts: [{ stat: "specialAttack", stages: 1 }],
            skipInWeather: "rain",
        },
        // Semi-invulnerable charge moves.
        fly: { message: "{name} flew up high!", invulnerable: "air" },
        bounce: { message: "{name} sprang up!", invulnerable: "air" },
        dig: { message: "{name} burrowed its way underground!", invulnerable: "ground" },
        dive: { message: "{name} hid underwater!", invulnerable: "water" },
        "phantom-force": { message: "{name} vanished instantly!", invulnerable: "vanish", bypassesProtect: true },
        "shadow-force": { message: "{name} vanished instantly!", invulnerable: "vanish", bypassesProtect: true },
    };

    // Radical Red splits these into two tiers: the classics always recharge,
    // while the elemental ultimates say "recharges unless it KOs the foe".
    // Honouring the description keeps the in-game text truthful.
    const RECHARGE_MOVES = {
        "hyper-beam": {},
        "giga-impact": {},
        "eternabeam": {},
        "rock-wrecker": {},
        "prism-laser": {},
        "blast-burn": { skipIfKnockedOut: true },
        "hydro-cannon": { skipIfKnockedOut: true },
        "frenzy-plant": { skipIfKnockedOut: true },
        "meteor-assault": { skipIfKnockedOut: true },
    };

    const RAMPAGE_MOVES = {
        outrage: {},
        thrash: {},
        "petal-dance": {},
        // Uproar locks the user the same way but ends without the confusion,
        // and keeps everyone awake while it lasts.
        uproar: { minTurns: 2, maxTurns: 5, confuseWhenDone: false, uproar: true },
    };

    const ROLLOUT_MOVES = {
        rollout: {},
        "ice-ball": {},
    };

    const MULTI_TURN_MOVES = {};
    Object.entries(CHARGE_MOVES).forEach(([slug, entry]) => {
        MULTI_TURN_MOVES[slug] = { kind: "charge", ...entry };
    });
    Object.entries(RECHARGE_MOVES).forEach(([slug, entry]) => {
        MULTI_TURN_MOVES[slug] = { kind: "recharge", ...entry };
    });
    Object.entries(RAMPAGE_MOVES).forEach(([slug, entry]) => {
        // 2-3 turns of forced attacking, then confusion from fatigue.
        MULTI_TURN_MOVES[slug] = { kind: "rampage", minTurns: 2, maxTurns: 3, confuseWhenDone: true, ...entry };
    });
    Object.entries(ROLLOUT_MOVES).forEach(([slug, entry]) => {
        MULTI_TURN_MOVES[slug] = { kind: "rollout", maxTurns: 5, ...entry };
    });
    MULTI_TURN_MOVES.bide = { kind: "bide", turns: 2, message: "{name} is storing energy!" };

    // ------------------------------------------------------------------
    // Semi-invulnerability. While a Pokemon is in one of these states most
    // moves miss outright, but a short list punches through -- and the
    // classic counters also deal double damage for catching the target
    // mid-air / underground / underwater.
    // ------------------------------------------------------------------

    const SEMI_INVULNERABLE = {
        air: {
            label: "in the air",
            hitBy: ["gust", "twister", "thunder", "hurricane", "sky-uppercut", "smack-down", "thousand-arrows", "whirlwind"],
            doubleFrom: ["gust", "twister"],
        },
        ground: {
            label: "underground",
            hitBy: ["earthquake", "magnitude", "fissure"],
            doubleFrom: ["earthquake", "magnitude"],
        },
        water: {
            label: "underwater",
            hitBy: ["surf", "whirlpool"],
            doubleFrom: ["surf", "whirlpool"],
        },
        // Shadow Force and Phantom Force cannot be reached at all.
        vanish: { label: "vanished", hitBy: [], doubleFrom: [] },
    };

    function getMultiTurn(slug) {
        return MULTI_TURN_MOVES[String(slug || "")] || null;
    }

    // True when `moveSlug` can reach a target hiding in `state`.
    function reachesHiddenTarget(state, moveSlug) {
        const rules = SEMI_INVULNERABLE[String(state || "")];
        if (!rules) return true;
        return rules.hitBy.includes(String(moveSlug || ""));
    }

    function hiddenTargetDamageMultiplier(state, moveSlug) {
        const rules = SEMI_INVULNERABLE[String(state || "")];
        if (!rules) return 1;
        return rules.doubleFrom.includes(String(moveSlug || "")) ? 2 : 1;
    }

    function hidingLabel(state) {
        return SEMI_INVULNERABLE[String(state || "")]?.label || "hidden";
    }

    return {
        MULTI_TURN_MOVES,
        SEMI_INVULNERABLE,
        getMultiTurn,
        reachesHiddenTarget,
        hiddenTargetDamageMultiplier,
        hidingLabel,
    };
}));
