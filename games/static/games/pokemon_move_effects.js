(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PokemonMoveEffects = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const BASE_PATH = "games/assets/pokemon/battle-effects/rhh/";

    // Generated from rhh/manifest.json by fetch_battle_effect_sprites.py.
    // RHH stores each effect as a vertical strip of square frames.
    const SHEETS = {
        air_slash: { file: "air_slash.png", frameWidth: 16, frameHeight: 16, frames: 3 },
        beam: { file: "beam.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        bent_spoon: { file: "bent_spoon.png", frameWidth: 16, frameHeight: 16, frames: 12 },
        big_rock: { file: "big_rock.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        black_ball: { file: "black_ball.png", frameWidth: 8, frameHeight: 8, frames: 1 },
        chop: { file: "chop.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        claw_slash: { file: "claw_slash.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        claw_slash_2: { file: "claw_slash_2.png", frameWidth: 32, frameHeight: 32, frames: 4 },
        colored_orbs: { file: "colored_orbs.png", frameWidth: 16, frameHeight: 16, frames: 6 },
        cut: { file: "cut.png", frameWidth: 32, frameHeight: 32, frames: 4 },
        dirt_mound: { file: "dirt_mound.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        dragon_pulse: { file: "dragon_pulse.png", frameWidth: 32, frameHeight: 16, frames: 1 },
        drill: { file: "drill.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        electric_orbs: { file: "electric_orbs.png", frameWidth: 8, frameHeight: 8, frames: 4 },
        electricity: { file: "electricity.png", frameWidth: 32, frameHeight: 32, frames: 4 },
        embers: { file: "embers.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        explosion: { file: "explosion.png", frameWidth: 32, frameHeight: 32, frames: 4 },
        explosion_2: { file: "explosion_2.png", frameWidth: 32, frameHeight: 32, frames: 6 },
        eye_sparkle: { file: "eye_sparkle.png", frameWidth: 16, frameHeight: 16, frames: 4 },
        fangs: { file: "fangs.png", frameWidth: 32, frameHeight: 32, frames: 2 },
        fire: { file: "fire.png", frameWidth: 32, frameHeight: 32, frames: 8 },
        fire_plume: { file: "fire_plume.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        flying_dirt: { file: "flying_dirt.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        gear: { file: "gear.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        ghostly_spirit: { file: "ghostly_spirit.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        gold_stars: { file: "gold_stars.png", frameWidth: 16, frameHeight: 24, frames: 1 },
        gust: { file: "gust.png", frameWidth: 32, frameHeight: 32, frames: 2 },
        hit: { file: "hit.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        horn_hit: { file: "horn_hit.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        humanoid_foot: { file: "humanoid_foot.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        hydro_pump: { file: "hydro_pump.png", frameWidth: 16, frameHeight: 16, frames: 4 },
        ice_chunk: { file: "ice_chunk.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        ice_spikes: { file: "ice_spikes.png", frameWidth: 8, frameHeight: 8, frames: 8 },
        icicle_spear: { file: "icicle_spear.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        impact: { file: "impact.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        impact_2: { file: "impact_2.png", frameWidth: 32, frameHeight: 32, frames: 6 },
        leaf: { file: "leaf.png", frameWidth: 16, frameHeight: 16, frames: 9 },
        leaves: { file: "leaves.png", frameWidth: 48, frameHeight: 48, frames: 1 },
        lightning: { file: "lightning.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        magenta_heart: { file: "magenta_heart.png", frameWidth: 16, frameHeight: 16, frames: 1 },
        mega_particles: { file: "mega_particles.png", frameWidth: 16, frameHeight: 16, frames: 3 },
        mega_stone: { file: "mega_stone.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        mega_symbol: { file: "mega_symbol.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        metal_ball: { file: "metal_ball.png", frameWidth: 16, frameHeight: 16, frames: 1 },
        mud_bomb: { file: "mud_bomb.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        music_notes: { file: "music_notes.png", frameWidth: 16, frameHeight: 16, frames: 6 },
        petal: { file: "petal.png", frameWidth: 16, frameHeight: 16, frames: 7 },
        poison_bubble: { file: "poison_bubble.png", frameWidth: 16, frameHeight: 16, frames: 3 },
        poison_column: { file: "poison_column.png", frameWidth: 32, frameHeight: 32, frames: 16 },
        poison_jab: { file: "poison_jab.png", frameWidth: 16, frameHeight: 16, frames: 1 },
        psycho_cut: { file: "psycho_cut.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        punch_impact: { file: "punch_impact.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        razor_leaf: { file: "razor_leaf.png", frameWidth: 32, frameHeight: 16, frames: 1 },
        red_fist: { file: "red_fist.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        rocks: { file: "rocks.png", frameWidth: 32, frameHeight: 32, frames: 6 },
        scratch: { file: "scratch.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        seed: { file: "seed.png", frameWidth: 16, frameHeight: 16, frames: 3 },
        shadow_ball: { file: "shadow_ball.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        sharp_teeth: { file: "sharp_teeth.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        shock: { file: "shock.png", frameWidth: 32, frameHeight: 32, frames: 6 },
        slam_hit: { file: "slam_hit.png", frameWidth: 32, frameHeight: 32, frames: 8 },
        slash: { file: "slash.png", frameWidth: 32, frameHeight: 32, frames: 4 },
        small_ember: { file: "small_ember.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        snowflakes: { file: "snowflakes.png", frameWidth: 16, frameHeight: 16, frames: 14 },
        spark_0: { file: "spark_0.png", frameWidth: 8, frameHeight: 8, frames: 8 },
        sparkle_1: { file: "sparkle_1.png", frameWidth: 32, frameHeight: 32, frames: 8 },
        sparkle_3: { file: "sparkle_3.png", frameWidth: 16, frameHeight: 16, frames: 4 },
        speed_dust: { file: "speed_dust.png", frameWidth: 16, frameHeight: 16, frames: 3 },
        spinning_fire: { file: "spinning_fire.png", frameWidth: 32, frameHeight: 32, frames: 4 },
        splash: { file: "splash.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        stone_edge: { file: "stone_edge.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        straight_beam: { file: "straight_beam.png", frameWidth: 16, frameHeight: 16, frames: 3 },
        sword: { file: "sword.png", frameWidth: 32, frameHeight: 32, frames: 2 },
        teeth: { file: "teeth.png", frameWidth: 32, frameHeight: 32, frames: 4 },
        tornado: { file: "tornado.png", frameWidth: 64, frameHeight: 64, frames: 3 },
        toxic_bubble: { file: "toxic_bubble.png", frameWidth: 16, frameHeight: 16, frames: 8 },
        vine: { file: "vine.png", frameWidth: 32, frameHeight: 32, frames: 5 },
        water_column: { file: "water_column.png", frameWidth: 16, frameHeight: 16, frames: 8 },
        water_gun: { file: "water_gun.png", frameWidth: 16, frameHeight: 16, frames: 3 },
        water_impact: { file: "water_impact.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        water_orb: { file: "water_orb.png", frameWidth: 16, frameHeight: 16, frames: 4 },
        web: { file: "web.png", frameWidth: 32, frameHeight: 32, frames: 1 },
        whirlwind: { file: "whirlwind.png", frameWidth: 64, frameHeight: 64, frames: 1 },
        wisp_fire: { file: "wisp_fire.png", frameWidth: 32, frameHeight: 32, frames: 4 },
    };

    // Per-TYPE fallback. Any move without its own entry below still animates
    // through these, so nothing ever renders without an effect.
    const TYPE_PROFILES = {
        normal: { sheet: "hit", motion: "impact", scale: 2.25, tint: 0xf4efe3 },
        fire: { sheet: "fire", motion: "projectile", scale: 2.05, tint: 0xff6b35, additive: true },
        water: { sheet: "water_orb", motion: "projectile", scale: 3.2, tint: 0x59c8ff, additive: true },
        electric: { sheet: "electricity", motion: "strike", scale: 2.5, tint: 0xffe45c, additive: true },
        grass: { sheet: "leaf", motion: "volley", scale: 2.4, particles: 5, tint: 0x77d65b },
        ice: { sheet: "ice_chunk", motion: "projectile", scale: 2.15, tint: 0x9eeeff, additive: true },
        fighting: { sheet: "punch_impact", motion: "impact", scale: 2.45, tint: 0xffa45f },
        poison: { sheet: "poison_bubble", motion: "volley", scale: 2.8, particles: 4, tint: 0xb86cff, additive: true },
        ground: { sheet: "mud_bomb", motion: "rise", scale: 1.35, particles: 3, tint: 0xc68f53 },
        flying: { sheet: "air_slash", motion: "volley", scale: 3, particles: 3, tint: 0xb9ecff, additive: true },
        psychic: { sheet: "colored_orbs", motion: "orbit", scale: 2.6, particles: 5, tint: 0xf26dff, additive: true },
        bug: { sheet: "web", motion: "projectile", scale: 2.05, tint: 0xa6d64d },
        rock: { sheet: "rocks", motion: "arc", scale: 1.85, particles: 3, tint: 0xc5a06b },
        ghost: { sheet: "shadow_ball", motion: "projectile", scale: 2, tint: 0x9b72ff, additive: true },
        dragon: { sheet: "dragon_pulse", motion: "projectile", scale: 2.45, tint: 0x7f8dff, additive: true },
        dark: { sheet: "black_ball", motion: "projectile", scale: 4.8, tint: 0x6f5a9f, additive: true },
        steel: { sheet: "metal_ball", motion: "arc", scale: 2.8, particles: 3, tint: 0xd5e3ea },
        fairy: { sheet: "sparkle_1", motion: "orbit", scale: 2.15, particles: 6, tint: 0xff9fe5, additive: true },
    };

    // Per-MOVE overrides, keyed by the move slug in gen1.json. Only the fields
    // that differ from the type profile need listing; the rest are inherited.
    // Chosen to cover the moves that actually turn up on Kanto-dex movesets.
    const MOVE_EFFECTS = {

        // --- electric
        thunderbolt: { sheet: "lightning", motion: "strike", scale: 2.4 },
        thunder: { sheet: "lightning", motion: "strike", scale: 2.9, particles: 3 },
        "thunder-shock": { sheet: "spark_0", motion: "strike", scale: 3 },
        discharge: { sheet: "shock", motion: "burst", scale: 2.6, particles: 4 },
        "wild-charge": { sheet: "shock", motion: "impact", scale: 2.7 },
        spark: { sheet: "spark_0", motion: "impact", scale: 3.2 },
        "volt-tackle": { sheet: "shock", motion: "impact", scale: 3 },
        "charge-beam": { sheet: "electric_orbs", motion: "projectile", scale: 3.4 },
        "zap-cannon": { sheet: "electric_orbs", motion: "projectile", scale: 3.6 },

        // --- water
        "hydro-pump": { sheet: "hydro_pump", motion: "projectile", scale: 3.4, particles: 3 },
        surf: { sheet: "water_column", motion: "burst", scale: 2.8, particles: 5 },
        "water-gun": { sheet: "water_gun", motion: "projectile", scale: 3 },
        "aqua-tail": { sheet: "water_impact", motion: "impact", scale: 2.6 },
        waterfall: { sheet: "water_column", motion: "rise", scale: 2.4, particles: 3 },
        brine: { sheet: "water_orb", motion: "projectile", scale: 3.1, particles: 3 },
        "water-pulse": { sheet: "water_orb", motion: "projectile", scale: 3.3 },
        bubble: { sheet: "water_orb", motion: "volley", scale: 2.6, particles: 5 },
        "bubble-beam": { sheet: "water_orb", motion: "volley", scale: 2.8, particles: 5 },
        splash: { sheet: "splash", motion: "impact", scale: 1.4 },

        // --- fire
        flamethrower: { sheet: "fire_plume", motion: "projectile", scale: 2.4, particles: 3 },
        "fire-blast": { sheet: "fire_plume", motion: "burst", scale: 3, particles: 4 },
        "flare-blitz": { sheet: "spinning_fire", motion: "impact", scale: 2.8 },
        ember: { sheet: "small_ember", motion: "projectile", scale: 2.2 },
        "flame-burst": { sheet: "embers", motion: "burst", scale: 2.4, particles: 4 },
        "fire-punch": { sheet: "fire_plume", motion: "impact", scale: 2.3 },
        "fire-spin": { sheet: "spinning_fire", motion: "orbit", scale: 2.4, particles: 4 },
        "will-o-wisp": { sheet: "wisp_fire", motion: "orbit", scale: 2.2, particles: 3 },
        overheat: { sheet: "fire_plume", motion: "burst", scale: 3.2, particles: 5 },
        "heat-wave": { sheet: "embers", motion: "burst", scale: 2.8, particles: 5 },

        // --- slashing and contact
        slash: { sheet: "claw_slash", motion: "impact", scale: 2.4 },
        cut: { sheet: "cut", motion: "impact", scale: 2.3 },
        scratch: { sheet: "scratch", motion: "impact", scale: 2.3 },
        "fury-swipes": { sheet: "claw_slash", motion: "impact", scale: 2, particles: 3 },
        "night-slash": { sheet: "claw_slash_2", motion: "impact", scale: 2.5, tint: 0x9a7cc4 },
        "cross-poison": { sheet: "claw_slash_2", motion: "impact", scale: 2.4, tint: 0xc07cff },
        "shadow-claw": { sheet: "claw_slash_2", motion: "impact", scale: 2.5, tint: 0x9b72ff },
        "metal-claw": { sheet: "claw_slash", motion: "impact", scale: 2.3, tint: 0xd5e3ea },
        "dragon-claw": { sheet: "claw_slash", motion: "impact", scale: 2.5, tint: 0x7f8dff },
        "leaf-blade": { sheet: "cut", motion: "impact", scale: 2.4, tint: 0x77d65b },
        "psycho-cut": { sheet: "psycho_cut", motion: "projectile", scale: 2.6, tint: 0xf26dff },
        "razor-shell": { sheet: "cut", motion: "impact", scale: 2.4, tint: 0x59c8ff },
        "sacred-sword": { sheet: "sword", motion: "impact", scale: 2.6 },
        "aerial-ace": { sheet: "cut", motion: "impact", scale: 2.4, tint: 0xb9ecff },

        // --- punches, kicks, slams
        "mach-punch": { sheet: "red_fist", motion: "impact", scale: 2.4 },
        "cross-chop": { sheet: "chop", motion: "impact", scale: 2.7 },
        "karate-chop": { sheet: "chop", motion: "impact", scale: 2.4 },
        "jump-kick": { sheet: "humanoid_foot", motion: "impact", scale: 2.6 },
        "high-jump-kick": { sheet: "humanoid_foot", motion: "impact", scale: 2.8 },
        "double-kick": { sheet: "humanoid_foot", motion: "impact", scale: 2.3, particles: 2 },
        "sucker-punch": { sheet: "red_fist", motion: "impact", scale: 2.5, tint: 0x6f5a9f },
        "drain-punch": { sheet: "red_fist", motion: "impact", scale: 2.4 },
        slam: { sheet: "slam_hit", motion: "impact", scale: 2.6 },
        stomp: { sheet: "humanoid_foot", motion: "impact", scale: 2.7 },
        "body-slam": { sheet: "slam_hit", motion: "impact", scale: 2.8 },
        "take-down": { sheet: "impact_2", motion: "impact", scale: 2.7 },
        "double-edge": { sheet: "impact_2", motion: "impact", scale: 3 },
        "giga-impact": { sheet: "impact_2", motion: "impact", scale: 3.3 },
        thrash: { sheet: "impact", motion: "impact", scale: 2.8, particles: 3 },
        "zen-headbutt": { sheet: "impact_2", motion: "impact", scale: 2.6, tint: 0xf26dff },
        headbutt: { sheet: "impact", motion: "impact", scale: 2.5 },
        tackle: { sheet: "impact", motion: "impact", scale: 2.3 },
        "skull-bash": { sheet: "impact_2", motion: "impact", scale: 2.9 },
        "extreme-speed": { sheet: "impact", motion: "impact", scale: 2.6, particles: 2 },
        "quick-attack": { sheet: "impact", motion: "impact", scale: 2.2 },

        // --- bites, horns, drills
        crunch: { sheet: "sharp_teeth", motion: "impact", scale: 1.5 },
        bite: { sheet: "fangs", motion: "impact", scale: 2.4 },
        "poison-fang": { sheet: "fangs", motion: "impact", scale: 2.4, tint: 0xb86cff },
        "ice-fang": { sheet: "fangs", motion: "impact", scale: 2.4, tint: 0x9eeeff },
        "fire-fang": { sheet: "fangs", motion: "impact", scale: 2.4, tint: 0xff6b35 },
        "thunder-fang": { sheet: "fangs", motion: "impact", scale: 2.4, tint: 0xffe45c },
        "bug-bite": { sheet: "teeth", motion: "impact", scale: 2.3, tint: 0xa6d64d },
        "horn-attack": { sheet: "horn_hit", motion: "impact", scale: 2.5 },
        "drill-peck": { sheet: "drill", motion: "impact", scale: 1.5 },
        "drill-run": { sheet: "drill", motion: "impact", scale: 1.6 },
        "horn-drill": { sheet: "drill", motion: "impact", scale: 1.7 },
        peck: { sheet: "horn_hit", motion: "impact", scale: 2.2 },

        // --- explosions
        explosion: { sheet: "explosion_2", motion: "burst", scale: 3.4, particles: 5 },
        "self-destruct": { sheet: "explosion", motion: "burst", scale: 3.2, particles: 5 },

        // --- ground and rock
        earthquake: { sheet: "flying_dirt", motion: "rise", scale: 2.4, particles: 5 },
        "earth-power": { sheet: "flying_dirt", motion: "rise", scale: 2.2, particles: 4 },
        magnitude: { sheet: "flying_dirt", motion: "rise", scale: 2.2, particles: 4 },
        bulldoze: { sheet: "dirt_mound", motion: "rise", scale: 2.2, particles: 3 },
        dig: { sheet: "dirt_mound", motion: "rise", scale: 2.4 },
        "stomping-tantrum": { sheet: "dirt_mound", motion: "rise", scale: 2.3, particles: 3 },
        "stone-edge": { sheet: "stone_edge", motion: "rise", scale: 2.4, particles: 3 },
        "rock-slide": { sheet: "big_rock", motion: "arc", scale: 1.3, particles: 3 },
        "rock-blast": { sheet: "rocks", motion: "volley", scale: 2, particles: 5 },
        "rock-throw": { sheet: "big_rock", motion: "arc", scale: 1.2 },
        "ancient-power": { sheet: "rocks", motion: "orbit", scale: 2.2, particles: 4 },
        "power-gem": { sheet: "rocks", motion: "volley", scale: 2.1, particles: 4, tint: 0xffe9a8 },
        rollout: { sheet: "big_rock", motion: "impact", scale: 1.3 },

        // --- steel and poison
        "gyro-ball": { sheet: "gear", motion: "projectile", scale: 2.6 },
        "flash-cannon": { sheet: "beam", motion: "projectile", scale: 1.5, tint: 0xd5e3ea },
        "iron-head": { sheet: "impact_2", motion: "impact", scale: 2.7, tint: 0xd5e3ea },
        "poison-jab": { sheet: "poison_jab", motion: "impact", scale: 3.4 },
        "gunk-shot": { sheet: "poison_column", motion: "projectile", scale: 2.6, particles: 3 },
        "sludge-bomb": { sheet: "toxic_bubble", motion: "volley", scale: 2.8, particles: 5 },
        sludge: { sheet: "toxic_bubble", motion: "projectile", scale: 2.6 },
        acid: { sheet: "toxic_bubble", motion: "volley", scale: 2.4, particles: 4 },
        toxic: { sheet: "toxic_bubble", motion: "projectile", scale: 2.6 },
        "poison-sting": { sheet: "poison_jab", motion: "projectile", scale: 2.8 },

        // --- grass
        "razor-leaf": { sheet: "razor_leaf", motion: "volley", scale: 2.6, particles: 5 },
        "petal-blizzard": { sheet: "petal", motion: "volley", scale: 2.6, particles: 6 },
        "petal-dance": { sheet: "petal", motion: "orbit", scale: 2.4, particles: 6 },
        "leaf-storm": { sheet: "leaves", motion: "burst", scale: 1.6, particles: 4 },
        "vine-whip": { sheet: "vine", motion: "impact", scale: 2.4 },
        "power-whip": { sheet: "vine", motion: "impact", scale: 2.7 },
        "seed-bomb": { sheet: "seed", motion: "arc", scale: 2.8, particles: 3 },
        "bullet-seed": { sheet: "seed", motion: "volley", scale: 2.4, particles: 5 },
        "solar-beam": { sheet: "beam", motion: "projectile", scale: 1.7, tint: 0x9cf07a },
        "giga-drain": { sheet: "leaf", motion: "orbit", scale: 2.4, particles: 5 },
        absorb: { sheet: "leaf", motion: "orbit", scale: 2, particles: 3 },
        "mega-drain": { sheet: "leaf", motion: "orbit", scale: 2.2, particles: 4 },

        // --- psychic
        psychic: { sheet: "colored_orbs", motion: "orbit", scale: 2.8, particles: 6 },
        psybeam: { sheet: "straight_beam", motion: "projectile", scale: 3, tint: 0xf26dff },
        confusion: { sheet: "bent_spoon", motion: "orbit", scale: 2.4, particles: 3 },
        "future-sight": { sheet: "eye_sparkle", motion: "orbit", scale: 2.6, particles: 4 },
        "dream-eater": { sheet: "eye_sparkle", motion: "orbit", scale: 2.4, particles: 4 },

        // --- ice
        "ice-beam": { sheet: "beam", motion: "projectile", scale: 1.6, tint: 0x9eeeff },
        blizzard: { sheet: "snowflakes", motion: "burst", scale: 2.6, particles: 6 },
        "icicle-spear": { sheet: "icicle_spear", motion: "volley", scale: 2.4, particles: 5 },
        "icicle-crash": { sheet: "icicle_spear", motion: "arc", scale: 2.6, particles: 3 },
        "ice-punch": { sheet: "ice_chunk", motion: "impact", scale: 2.4 },
        "ice-shard": { sheet: "ice_spikes", motion: "projectile", scale: 3.4 },
        "aurora-beam": { sheet: "beam", motion: "projectile", scale: 1.5, tint: 0xa8f0e0 },
        "freeze-dry": { sheet: "ice_spikes", motion: "projectile", scale: 3.2 },
        "powder-snow": { sheet: "snowflakes", motion: "volley", scale: 2.2, particles: 5 },
        haze: { sheet: "black_ball", motion: "burst", scale: 4.2, particles: 4, tint: 0x9eeeff },

        // --- flying
        gust: { sheet: "gust", motion: "projectile", scale: 2.6 },
        whirlwind: { sheet: "whirlwind", motion: "orbit", scale: 1.5 },
        hurricane: { sheet: "tornado", motion: "rise", scale: 1.5, particles: 3 },
        twister: { sheet: "tornado", motion: "rise", scale: 1.3, particles: 3 },
        "air-slash": { sheet: "air_slash", motion: "volley", scale: 3.2, particles: 3 },
        "wing-attack": { sheet: "gust", motion: "impact", scale: 2.5 },
        fly: { sheet: "gust", motion: "impact", scale: 2.6 },
        "brave-bird": { sheet: "impact_2", motion: "impact", scale: 2.9, tint: 0xb9ecff },

        // --- ghost and dark
        "shadow-ball": { sheet: "shadow_ball", motion: "projectile", scale: 2.4 },
        "shadow-punch": { sheet: "ghostly_spirit", motion: "impact", scale: 2.4 },
        "shadow-sneak": { sheet: "ghostly_spirit", motion: "impact", scale: 2.2 },
        lick: { sheet: "ghostly_spirit", motion: "impact", scale: 2.2 },
        "night-shade": { sheet: "ghostly_spirit", motion: "projectile", scale: 2.4 },
        "dark-pulse": { sheet: "black_ball", motion: "projectile", scale: 5.2 },
        assurance: { sheet: "impact", motion: "impact", scale: 2.4, tint: 0x6f5a9f },
        payback: { sheet: "impact", motion: "impact", scale: 2.5, tint: 0x6f5a9f },

        // --- dragon
        outrage: { sheet: "dragon_pulse", motion: "impact", scale: 2.8, particles: 3 },
        "dragon-pulse": { sheet: "dragon_pulse", motion: "projectile", scale: 2.8 },
        "dragon-rage": { sheet: "dragon_pulse", motion: "projectile", scale: 2.5 },
        "dragon-rush": { sheet: "impact_2", motion: "impact", scale: 2.9, tint: 0x7f8dff },
        "draco-meteor": { sheet: "big_rock", motion: "arc", scale: 1.4, particles: 4, tint: 0x7f8dff },

        // --- fairy and sound
        "dazzling-gleam": { sheet: "sparkle_3", motion: "burst", scale: 3, particles: 6 },
        moonblast: { sheet: "sparkle_1", motion: "projectile", scale: 2.6, particles: 3 },
        "play-rough": { sheet: "impact", motion: "impact", scale: 2.5, tint: 0xff9fe5 },
        charm: { sheet: "magenta_heart", motion: "orbit", scale: 3, particles: 4 },
        attract: { sheet: "magenta_heart", motion: "orbit", scale: 3.2, particles: 5 },
        "sweet-kiss": { sheet: "magenta_heart", motion: "orbit", scale: 3, particles: 4 },
        sing: { sheet: "music_notes", motion: "orbit", scale: 2.6, particles: 5 },
        "hyper-voice": { sheet: "music_notes", motion: "burst", scale: 2.8, particles: 6 },
        screech: { sheet: "music_notes", motion: "burst", scale: 2.6, particles: 5 },
        supersonic: { sheet: "music_notes", motion: "volley", scale: 2.4, particles: 4 },
        growl: { sheet: "music_notes", motion: "orbit", scale: 2.2, particles: 3 },

        // --- stat and utility moves that read better with a distinct look
        agility: { sheet: "speed_dust", motion: "orbit", scale: 2.8, particles: 4 },
        "swords-dance": { sheet: "sword", motion: "orbit", scale: 2.6, particles: 3 },
        "quiver-dance": { sheet: "sparkle_3", motion: "orbit", scale: 2.4, particles: 5 },
        "calm-mind": { sheet: "colored_orbs", motion: "orbit", scale: 2.2, particles: 4 },
        "nasty-plot": { sheet: "black_ball", motion: "orbit", scale: 3.6, particles: 3 },
        "dragon-dance": { sheet: "dragon_pulse", motion: "orbit", scale: 2.2, particles: 3 },
        recover: { sheet: "sparkle_3", motion: "orbit", scale: 2.4, particles: 5, tint: 0x9cf0b8 },
        synthesis: { sheet: "sparkle_3", motion: "orbit", scale: 2.4, particles: 5, tint: 0x9cf07a },
        "leech-seed": { sheet: "seed", motion: "projectile", scale: 2.6 },
        "string-shot": { sheet: "web", motion: "projectile", scale: 2.4 },
        smokescreen: { sheet: "black_ball", motion: "burst", scale: 4, particles: 4 },
        "sand-attack": { sheet: "flying_dirt", motion: "volley", scale: 2, particles: 4 },

        // --- frequent status moves, so buffs/debuffs don't all look alike
        endeavor: { sheet: "impact_2", motion: "impact", scale: 2.5 },
        captivate: { sheet: "magenta_heart", motion: "orbit", scale: 2.8, particles: 4 },
        "psych-up": { sheet: "colored_orbs", motion: "orbit", scale: 2.3, particles: 4 },
        safeguard: { sheet: "sparkle_3", motion: "orbit", scale: 2.6, particles: 5, tint: 0xa8f0e0 },
        tailwind: { sheet: "gust", motion: "orbit", scale: 2.4, particles: 3 },
        belch: { sheet: "toxic_bubble", motion: "burst", scale: 3, particles: 5 },
        "destiny-bond": { sheet: "ghostly_spirit", motion: "orbit", scale: 2.4, particles: 3 },
        swagger: { sheet: "colored_orbs", motion: "orbit", scale: 2.4, particles: 3 },
        "rain-dance": { sheet: "water_orb", motion: "rise", scale: 2.4, particles: 6 },
        "sunny-day": { sheet: "embers", motion: "rise", scale: 2.4, particles: 5 },
        sandstorm: { sheet: "flying_dirt", motion: "orbit", scale: 2.2, particles: 6 },
        snowscape: { sheet: "snowflakes", motion: "rise", scale: 2.2, particles: 6 },
        hailstorm: { sheet: "snowflakes", motion: "burst", scale: 2.6, particles: 6 },
        "thunder-punch": { sheet: "shock", motion: "impact", scale: 2.4 },
        "chip-away": { sheet: "impact", motion: "impact", scale: 2.4 },
        "last-resort": { sheet: "impact_2", motion: "impact", scale: 3.1 },
        "raging-bull": { sheet: "horn_hit", motion: "impact", scale: 2.8 },
        "mirror-coat": { sheet: "colored_orbs", motion: "burst", scale: 2.6, particles: 4 },
        flatter: { sheet: "colored_orbs", motion: "orbit", scale: 2.3, particles: 3 },
        "toxic-spikes": { sheet: "toxic_bubble", motion: "volley", scale: 2.2, particles: 4 },
        "iron-defense": { sheet: "gear", motion: "orbit", scale: 2.4, particles: 3 },
        "bulk-up": { sheet: "red_fist", motion: "orbit", scale: 2.4, particles: 3 },
        "wring-out": { sheet: "impact_2", motion: "impact", scale: 2.6 },
        "heal-pulse": { sheet: "sparkle_3", motion: "orbit", scale: 2.6, particles: 5, tint: 0x9cf0b8 },
        "super-fang": { sheet: "sharp_teeth", motion: "impact", scale: 1.4 },
        "confuse-ray": { sheet: "ghostly_spirit", motion: "orbit", scale: 2.4, particles: 4 },
        amnesia: { sheet: "bent_spoon", motion: "orbit", scale: 2.4, particles: 3 },
        "acid-armor": { sheet: "toxic_bubble", motion: "orbit", scale: 2.4, particles: 4 },
        "belly-drum": { sheet: "red_fist", motion: "orbit", scale: 2.6, particles: 3 },
        endure: { sheet: "sparkle_3", motion: "orbit", scale: 2.2, particles: 3 },
        protect: { sheet: "sparkle_3", motion: "orbit", scale: 2.6, particles: 4, tint: 0xa8f0e0 },
        rest: { sheet: "sparkle_3", motion: "orbit", scale: 2.4, particles: 5, tint: 0x9cb8f0 },
        "focus-energy": { sheet: "sparkle_1", motion: "orbit", scale: 2.2, particles: 4 },
        "double-team": { sheet: "speed_dust", motion: "orbit", scale: 2.6, particles: 5 },
        harden: { sheet: "gear", motion: "orbit", scale: 2.2, particles: 2 },
        withdraw: { sheet: "gear", motion: "orbit", scale: 2.2, particles: 2 },
        "defense-curl": { sheet: "gear", motion: "orbit", scale: 2.2, particles: 2 },
        "leer": { sheet: "eye_sparkle", motion: "orbit", scale: 2.4, particles: 3 },
        "tail-whip": { sheet: "speed_dust", motion: "orbit", scale: 2.2, particles: 3 },
        "poison-powder": { sheet: "toxic_bubble", motion: "volley", scale: 2.2, particles: 5 },
        "sleep-powder": { sheet: "sparkle_3", motion: "volley", scale: 2.2, particles: 5, tint: 0xc9b8f0 },
        "stun-spore": { sheet: "sparkle_3", motion: "volley", scale: 2.2, particles: 5, tint: 0xffe45c },
        "thunder-wave": { sheet: "electric_orbs", motion: "strike", scale: 3.2 },
        "hyper-beam": { sheet: "beam", motion: "projectile", scale: 1.8, tint: 0xffd8a8 },
        "tri-attack": { sheet: "straight_beam", motion: "projectile", scale: 3, tint: 0xffe9a8 },
    };

    const MELEE_PATTERN = /(punch|kick|tackle|slam|scratch|claw|fang|bite|headbutt|stomp|chop|slash|strike|cut|grip|throw|jab|tail|rush|charge)/i;
    const VOLLEY_PATTERN = /(double|triple|fury|barrage|pin missile|bullet seed|rock blast|scale shot|bone rush|arm thrust|population bomb)/i;
    const BURST_PATTERN = /(explosion|self-destruct|eruption|boomburst|hyper voice|overdrive|earthquake|magnitude|bulldoze|fissure|discharge|surf|blizzard|heat wave|dazzling gleam)/i;
    const BEAM_PATTERN = /(beam|pulse|cannon|ray|laser|gun|flamethrower|hydro pump|thunderbolt|ice beam|solar beam|dragon breath)/i;

    function getSheetList() {
        return Object.entries(SHEETS).map(([name, sheet]) => ({
            ...sheet,
            name,
            key: `move-effect-${name}`,
            animationKey: `move-effect-${name}-loop`,
            path: `${BASE_PATH}${sheet.file}`,
        }));
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    function resolveMoveEffect(move) {
        const data = move || {};
        const type = String(data.moveType || data.type || "normal").toLowerCase();
        const name = String(data.moveName || data.name || "");
        const power = Math.max(0, Number(data.movePower ?? data.power) || 0);
        const damageClass = String(data.damageClass || data.damage_class || "physical").toLowerCase();

        const typeProfile = TYPE_PROFILES[type] || TYPE_PROFILES.normal;
        // A move's own entry wins; anything it leaves out falls back to its type.
        const slug = slugify(data.moveSlug || data.slug || name);
        const override = MOVE_EFFECTS[slug] || null;
        const base = override ? { ...typeProfile, ...override } : typeProfile;
        const known = Boolean(override) && Boolean(SHEETS[base.sheet]);
        const profile = known || SHEETS[base.sheet] ? base : typeProfile;

        let motion = profile.motion;
        let particles = profile.particles || 1;

        // Name-pattern heuristics only apply when the move has no explicit
        // entry -- an authored motion should never be second-guessed.
        if (!override) {
            if (damageClass.includes("status")) motion = "orbit";
            else if (BURST_PATTERN.test(name)) motion = type === "ground" ? "rise" : "burst";
            else if (VOLLEY_PATTERN.test(name)) {
                motion = "volley";
                particles = Math.max(4, particles);
            } else if (MELEE_PATTERN.test(name)) motion = "impact";
            else if (BEAM_PATTERN.test(name)) motion = "projectile";
        }

        const powerScale = power >= 120 ? 1.35 : power >= 90 ? 1.18 : power > 0 && power <= 45 ? 0.88 : 1;
        if (power >= 110 && motion !== "impact") particles = Math.max(particles, 3);
        return {
            type,
            name,
            slug,
            matched: Boolean(override),
            sheet: profile.sheet,
            textureKey: `move-effect-${profile.sheet}`,
            animationKey: `move-effect-${profile.sheet}-loop`,
            motion,
            scale: profile.scale * powerScale,
            particles,
            tint: profile.tint,
            additive: Boolean(profile.additive),
            duration: power >= 110 ? 390 : power >= 75 ? 320 : 260,
            power,
            heavy: power >= 100,
        };
    }

    return { BASE_PATH, SHEETS, TYPE_PROFILES, MOVE_EFFECTS, getSheetList, resolveMoveEffect };
}));
