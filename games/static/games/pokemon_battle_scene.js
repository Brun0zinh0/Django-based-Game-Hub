(function (root) {
    "use strict";

    const WIDTH = 960;
    const HEIGHT = 480;
    // Render order on this stage, low to high: terrain strip 3, field rails
    // 20, the Pokemon themselves, move effects from 24, screen washes 43-48,
    // HP cards and dialogue 58-63. A battler goes between the field it stands
    // on and the effects that play over it, and the trainer who throws it goes
    // one behind -- he is standing further back than the Pokemon he sent.
    const SPRITE_DEPTH = 22;
    const ENEMY_TRAINER_DEPTH = SPRITE_DEPTH - 1;
    // `standDepth` is where on the base's ellipse this slot's feet rest:
    // 0 = far rim, 1 = near rim. Slot 0 stands further back than slot 1.
    const POSITIONS = {
        enemy: [
            { x: 688, y: 194, cardX: 54, cardY: 34, standDepth: 0.34 },
            { x: 824, y: 258, cardX: 54, cardY: 114, standDepth: 0.66 },
        ],
        player: [
            { x: 282, y: 344, cardX: 598, cardY: 284, standDepth: 0.38 },
            { x: 432, y: 428, cardX: 598, cardY: 364, standDepth: 0.7 },
        ],
    };
    const PLATFORM_LAYOUT = {
        enemy: { textureKey: "battle-enemy-base", centerX: 760, bottomY: 306, contactInset: 0 },
        player: { textureKey: "battle-player-base", centerX: 350, bottomY: 480, contactInset: 0 },
    };

    // Status chips shown on each Pokemon's info card. Codes and colours follow
    // the mainline games so they read instantly.
    const STATUS_CHIPS = {
        burn: { code: "BRN", color: 0xe4623f },
        poison: { code: "PSN", color: 0xa063c4 },
        toxic: { code: "TOX", color: 0x8b3fae },
        paralysis: { code: "PAR", color: 0xd8a72b },
        freeze: { code: "FRZ", color: 0x49b0d8 },
        sleep: { code: "SLP", color: 0x7c8798 },
        confused: { code: "CNF", color: 0xd2698f },
        infatuated: { code: "LOVE", color: 0xe06aa8 },
    };

    // Type chips on the HP card. Three letters keeps two of them beside even a
    // long name without crowding the level, and the colours match the ones the
    // move buttons already use.
    // The HP bar gives up some length so the status chip can sit beside it,
    // which leaves the whole name row free for the name and its type chips.
    const HP_BAR_WIDTH = 121;

    const TYPE_CHIPS = {
        normal: { code: "NOR", color: 0x797d85 }, fire: { code: "FIR", color: 0xd9533f },
        water: { code: "WAT", color: 0x397bc6 }, electric: { code: "ELE", color: 0xd0a623 },
        grass: { code: "GRA", color: 0x4d9951 }, ice: { code: "ICE", color: 0x56aeb5 },
        fighting: { code: "FIG", color: 0xa44138 }, poison: { code: "PSN", color: 0x8753a0 },
        ground: { code: "GRD", color: 0xa4773e }, flying: { code: "FLY", color: 0x617db5 },
        psychic: { code: "PSY", color: 0xd84f79 }, bug: { code: "BUG", color: 0x718d36 },
        rock: { code: "ROC", color: 0xb0a35d }, ghost: { code: "GHO", color: 0x6a5a9b },
        dragon: { code: "DRA", color: 0x6a4bc0 }, dark: { code: "DRK", color: 0x5d4a42 },
        steel: { code: "STL", color: 0x8d8da2 }, fairy: { code: "FAI", color: 0xcf6f9c },
    };

    // One scale for every Pokemon so their relative sizes stay true; the
    // player's side is nearer the camera and reads slightly larger. Scales
    // are INTEGERS: nearest-neighbour at a fractional scale doubles some
    // pixel rows and not others, which is what read as "blurry". 2x of the
    // 96px Showdown art also matches the DS framing (sprite ~40% of screen
    // height) better than the old 1.7/1.45 did.
    const SPRITE_SCALE = { player: 2, enemy: 2 };
    // These were far tighter than the space actually available -- the enemy
    // feet sit at y=194 and the player's at y=344 on a 960x480 canvas, so the
    // old 176/200 caps were rejecting sprites that fit comfortably. Because
    // the fallback is a whole scale step, every rejected sprite dropped to 1x
    // and rendered at half the pixel size of everything beside it: 61 of the
    // 772 sprites in league reach, including Charizard, Lugia and Raichu.
    const MAX_SPRITE_HEIGHT = { player: 300, enemy: 190 };
    const MAX_SPRITE_WIDTH = { player: 440, enemy: 420 };
    // A near-miss is worth a few clipped pixels at the very top of the canvas.
    // Halving a Charizard's pixel density to save 14px of headroom is the
    // trade that made the roster look like two different art styles.
    const SPRITE_OVERFLOW_TOLERANCE = 1.12;

    // HGSS catch cadence: the slow, evenly spaced wobbles are what make the
    // wait feel tense, so the numbers live in one place and every phase of
    // the sequence reads from here.
    const CATCH_TIMING = {
        arcUp: 260, arcDown: 240, openFlash: 140, suck: 480, drop: 240,
        bounce: [180, 140], wobbleTilt: 240, wobbleReturn: 200, wobbleGap: 650,
        clickPause: 420, starPop: 380, breakout: 260,
    };
    // 18px ball art at 2x reads ~7.5% of the canvas height, matching the
    // ball-to-screen proportion of the original games.
    const CAPTURE_BALL_SCALE = 2;

    // How many pieces of a move's art to stage per battle. Three covers the
    // sets that matter without loading an archive's every last speck.
    const DS_TEXTURES_PER_MOVE = 3;

    // Moves whose FULL DS dressing was reviewed and kept -- Bubble by the
    // player's own word, Rock Blast's boulder and Leech Seed's seed by
    // contact sheet. Every other move gets DS art only through a named role,
    // and otherwise plays Showdown's choreography in Showdown's own art.
    const DS_FULL_DRESS = new Set(["bubble", "rockblast", "leechseed"]);

    // Moves animated from the handheld's own script rather than Showdown's
    // choreography. Each entry is rebuilt from hg-engine's move_anim file for
    // that move: the frame counts, wave structure and impact timing are the
    // script's own numbers at 60fps. What the script does not carry is each
    // particle's path -- that lives in the SPA emitter binary -- so the
    // trajectories are reconstructed by eye around the scripted timeline.
    // Scripts 007, 008 and 009 -- the three elemental punches -- are the same
    // script three times over, differing only in archive and colour. Each
    // opens with callfunction 33 washing the screen from 0 up to a depth in a
    // BGR555 colour, pulses that colour again through callfunction 34 at the
    // impact, and closes by running 33 back down to 0. This is that wash; the
    // particles are each move's own, because those genuinely differ.
    //
    // Colours are decoded, not chosen: BGR555 is five bits per channel with
    // red in the low bits. 2124 -> #631010, 32631 -> #bddeff, 13311 -> #ffff63.
    const bgr555 = (value) => {
        const step = (bits) => Math.round((bits & 31) * 255 / 31);
        return (step(value) << 16) | (step(value >> 5) << 8) | step(value >> 10);
    };
    // depth is the script's own second argument to callfunction 33 -- 12 for
    // the fire and thunder punches, 8 for the ice one -- read as how far the
    // wash is taken up. The screen is never fully drowned, so it maps onto a
    // modest alpha rather than a literal fraction.
    // The wash and the impact pulse overlap, as they do in the script, so
    // their alphas stack. At depth/42 with a 0.26 pulse that came to 0.47 of
    // #631010 over the whole stage and Fire Punch measured a sprite-to-
    // background contrast of 11.5 against a 21.5 baseline -- a red flash that
    // ate the Pokemon. These two numbers are tuned, not decoded: the colours
    // and the depths are the script's, the alphas they map onto are not.
    const punchWash = (scene, { envelope, shade, depth }) => {
        const FRAME = 1000 / 60;
        const peak = Math.min(0.26, depth / 60);
        const wash = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT,
            bgr555(envelope), 0).setDepth(43);
        const pulse = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT,
            bgr555(shade), 0).setDepth(44);
        return {
            // callfunction 33, from 0 up to depth.
            async in() {
                await scene.tween({ targets: wash, fillAlpha: peak, duration: 8 * FRAME });
            },
            // callfunction 34, 6, 8, ... 14: the impact pulse, 14 frames.
            async pulse() {
                await scene.tween({ targets: pulse, fillAlpha: 0.14, duration: 5 * FRAME });
                await scene.tween({ targets: pulse, fillAlpha: 0, duration: 9 * FRAME });
            },
            // callfunction 33 again, from depth back down to 0.
            async out() {
                await scene.tween({ targets: wash, fillAlpha: 0, duration: 10 * FRAME });
            },
            destroy() { wash.destroy(); pulse.destroy(); },
        };
    };

    const DS_CHOREOGRAPHIES = {
        // armips/move/move_anim/075.s: two waves of leaves leave the user
        // across the first 15 frames (addparticle emitters 2 and 1), fly
        // through a 50-frame wait, and at frame 75 the impact emitter fires
        // on the target -- the same frame the move's parsed gestures already
        // land their two 2px shakes. Archive 106's art: two drawn leaves for
        // the flight, an additive crescent for the hit.
        razorleaf: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const entry = (scene.dsParticles?.moves || {}).razorleaf;
            const set = (entry?.textures || []).slice(0, DS_TEXTURES_PER_MOVE);
            const leaves = [];
            let burst = null;
            set.forEach((texture, index) => {
                const key = `dsp-razorleaf-${index}`;
                if (!scene.textures.exists(key)) return;
                if (texture.blend === "normal") leaves.push(key);
                else burst = key;
            });
            if (!leaves.length) throw new Error("Razor Leaf's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            try {
                const jobs = [];
                for (let i = 0; i < 9; i += 1) {
                    // Wave one: three leaves at frame 0. Wave two: six more
                    // spread across the script's 15-frame launch window.
                    const launch = i < 3 ? 0 : (i - 2) * (15 / 7);
                    const spread = ((i % 3) - 1) * 26 + (i % 2 ? 9 : -9);
                    const lift = ((i % 3) - 1) * 18;
                    // Arrivals bracket the frame-75 impact.
                    const arrive = 68 + (i % 5) * 3;
                    const leaf = scene.add.image(from.x, from.y, leaves[i % leaves.length])
                        .setDepth(46)
                        .setScale(1.7 + (i % 3) * 0.25)
                        .setAlpha(0);
                    leaf.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(leaf);
                    jobs.push((async () => {
                        await delay(launch * FRAME);
                        leaf.setAlpha(1);
                        await Promise.all([
                            scene.tween({
                                targets: leaf,
                                x: to.x + spread,
                                y: to.y + lift,
                                duration: (arrive - launch) * FRAME,
                                ease: "Sine.easeIn",
                            }),
                            scene.tween({
                                targets: leaf,
                                angle: (i % 2 ? 720 : -720),
                                duration: (arrive - launch) * FRAME,
                            }),
                        ]);
                        await scene.tween({ targets: leaf, alpha: 0, duration: 6 * FRAME });
                    })());
                }
                jobs.push((async () => {
                    if (!burst) return;
                    await delay(75 * FRAME);
                    const crescents = [-40, 35].map((angle, index) => {
                        const crescent = scene.add.image(to.x, to.y, burst)
                            .setDepth(47)
                            .setAngle(angle)
                            .setAlpha(0.9)
                            .setTint(0x8feb59)
                            .setBlendMode(Phaser.BlendModes.ADD);
                        sprites.push(crescent);
                        return { crescent, swing: index ? -25 : 25 };
                    });
                    await Promise.all(crescents.map(({ crescent, swing }) => scene.tween({
                        targets: crescent,
                        scaleX: 2.3,
                        scaleY: 2.3,
                        angle: crescent.angle + swing,
                        alpha: 0,
                        duration: 20 * FRAME,
                        ease: "Cubic.easeOut",
                    })));
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/045.s: both of archive 76's emitters fire at
        // once from the user, and the user's own cry plays twice panned to
        // its side -- the growl IS the Pokemon's cry. The two 2px shakes on
        // the target and its side are already in the move's parsed gestures
        // and play alongside. Archive 76's art is a soft ring and a small
        // arc, both pale yellow; the waves radiate at the target and die out
        // short of it, as sound does. Showdown had its own idea of this move
        // -- two pulsing balls -- and the texture override dressed them in
        // these two mismatched pieces by hash, which is what made Growl spit
        // random particles.
        growl: async (scene, actorView, targetView, event) => {
            const FRAME = 1000 / 60;
            const entry = (scene.dsParticles?.moves || {}).growl;
            const set = (entry?.textures || []).slice(0, DS_TEXTURES_PER_MOVE);
            let arc = null;
            let ring = null;
            set.forEach((texture, index) => {
                const key = `dsp-growl-${index}`;
                if (!scene.textures.exists(key)) return;
                const longest = Math.max(texture.width || 0, texture.height || 0);
                const shortest = Math.min(texture.width || 1, texture.height || 1);
                if (longest / shortest >= 2) arc = key;
                else ring = key;
            });
            if (!arc && !ring) throw new Error("Growl's art is not staged");
            const actor = event ? scene.engine?.teams?.[event.side]?.[event.actorIndex] : null;
            const cry = () => {
                if (actor) window.PokemonBattleAudio?.playCry(scene.crySlugFor(actor));
            };
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const degrees = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
            const sprites = [];
            try {
                cry();
                const jobs = [];
                for (let i = 0; i < 6; i += 1) {
                    const key = (i % 2 === 0 ? ring : arc) || ring || arc;
                    const isRing = key === ring;
                    // Pairs 8 frames apart, each wave dying out part-way.
                    const start = (i >> 1) * 8;
                    const reach = 0.45 + (i % 3) * 0.12;
                    const drift = ((i % 3) - 1) * 10;
                    const wave = scene.add.image(from.x, from.y, key)
                        .setDepth(46)
                        .setScale(isRing ? 0.8 : 1.6)
                        .setAlpha(0)
                        .setTint(0xebeaab)
                        .setBlendMode(Phaser.BlendModes.ADD);
                    if (!isRing) wave.setAngle(degrees + ((i % 3) - 1) * 18);
                    wave.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(wave);
                    jobs.push((async () => {
                        await delay(start * FRAME);
                        wave.setAlpha(0.9);
                        await scene.tween({
                            targets: wave,
                            x: from.x + (to.x - from.x) * reach,
                            y: from.y + (to.y - from.y) * reach + drift,
                            scaleX: isRing ? 2.4 : 2.0,
                            scaleY: isRing ? 2.4 : 2.0,
                            alpha: 0,
                            duration: 45 * FRAME,
                            ease: "Sine.easeOut",
                        });
                    })());
                }
                // The script growls twice: cry, wait it out, cry again.
                jobs.push((async () => {
                    await delay(35 * FRAME);
                    cry();
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/052.s: archive 83's one flame is both the
        // shot and the burst. The script fires the flame and its emitter
        // together, pulses the screen shade (callfunction 34), lands a
        // single 2px shake on the target (callfunction 36) and repeats the
        // crackle three times -- with no scripted waits at all, so the
        // pacing rides on particle lifetimes we do not decode. Flight and
        // burst timing are reconstructed to the handheld's pacing around
        // that order. The parser files this script's shake at frame 0 for
        // the same no-waits reason, so the impact jolt is played here,
        // where the script means it.
        // Visibility rework: the whole move used to be additive, and
        // additive over this stage's bright field is how Ember measured a
        // +1.3 local-contrast blip at impact while Stone Edge measured
        // +10.6. Every flame is now a normal-blend CORE -- the ROM art's
        // own dark outline does the reading -- with an additive halo
        // BEHIND it carrying the glow.
        ember: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const key = "dsp-ember-0";
            if (!scene.textures.exists(key)) throw new Error("Ember's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const flame = (x, y, scale) => {
                const halo = scene.add.image(0, 0, key)
                    .setScale(1.9).setAlpha(0.6)
                    .setTint(0xffb066).setBlendMode(Phaser.BlendModes.ADD);
                halo.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                const core = scene.add.image(0, 0, key).setTint(0xeb7f2f);
                core.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                // A container, so every tween a call site runs on the piece
                // moves, scales and fades the halo with the core.
                const piece = scene.add.container(x, y, [halo, core])
                    .setDepth(46).setScale(scale);
                sprites.push(piece);
                return piece;
            };
            try {
                // The shot: one flickering flame, thirty frames, shallow arc.
                const shot = flame(from.x, from.y, 2.1);
                const flight = 30 * FRAME;
                await Promise.all([
                    scene.tween({ targets: shot, x: to.x, duration: flight }),
                    scene.tween({ targets: shot, scaleX: 1.2, scaleY: 1.2,
                        duration: 4 * FRAME, yoyo: true, repeat: 3 }),
                    (async () => {
                        await scene.tween({ targets: shot, y: Math.min(from.y, to.y) - 26,
                            duration: flight / 2, ease: "Quad.easeOut" });
                        await scene.tween({ targets: shot, y: to.y,
                            duration: flight / 2, ease: "Quad.easeIn" });
                    })(),
                ]);
                shot.setVisible(false);
                // Impact, all at once as the script orders it: the burst,
                // the shade pulse, and the jolt.
                const jobs = [];
                for (let i = 0; i < 5; i += 1) {
                    const spread = ((i % 5) - 2) * 14 + (i % 2 ? 5 : -5);
                    const pop = flame(to.x + spread * 0.4, to.y, 1.3 + (i % 3) * 0.25);
                    jobs.push(scene.tween({
                        targets: pop,
                        x: to.x + spread,
                        y: to.y - 16 - (i % 3) * 9,
                        scaleX: 1.5,
                        scaleY: 1.5,
                        alpha: 0,
                        duration: (20 + (i % 3) * 4) * FRAME,
                        ease: "Quad.easeOut",
                    }));
                }
                const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0)
                    .setDepth(44);
                jobs.push((async () => {
                    await scene.tween({ targets: shade, fillAlpha: 0.16, duration: 6 * FRAME });
                    await scene.tween({ targets: shade, fillAlpha: 0, duration: 10 * FRAME });
                    shade.destroy();
                })());
                // The jolt is NOT written here: Ember's callfunction 36 is
                // parsed into a gesture and playMoveGestures plays it. The
                // hand copy that used to sit here was a duplicate the
                // Aurora-Beam sweep missed because of a variable name.
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/055.s: the jet is a chain of emitters fired
        // in sequence -- a rope of water crossing the field -- with the
        // sound sweeping from the user's side to the target's, the splash
        // pair added ten frames in, and a double 2px shake. The parsed
        // gestures carry shakes from all three of the script's branches;
        // only one branch plays on the handheld, but at 2px the extras are
        // imperceptible and are left alone.
        watergun: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const jet = "dsp-watergun-0";
            if (!scene.textures.exists(jet)) throw new Error("Water Gun's art is not staged");
            const spray = scene.textures.exists("dsp-watergun-1") ? "dsp-watergun-1" : jet;
            const splash = scene.textures.exists("dsp-watergun-2") ? "dsp-watergun-2" : jet;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const drop = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.9)
                    .setTint(0x618deb)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                // Sixteen beads, two frames apart, each crossing in fourteen
                // -- close enough behind one another to read as one jet.
                for (let i = 0; i < 16; i += 1) {
                    const launch = i * 2;
                    const wobble = ((i % 3) - 1) * 6;
                    const bead = drop(i % 4 === 3 ? spray : jet, from.x, from.y,
                        i % 4 === 3 ? 1.4 : 1.1 + (i % 2) * 0.2);
                    bead.setAlpha(0);
                    jobs.push((async () => {
                        await delay(launch * FRAME);
                        bead.setAlpha(0.9);
                        await scene.tween({
                            targets: bead,
                            x: to.x,
                            y: to.y + wobble,
                            duration: 14 * FRAME,
                            ease: "Sine.easeIn",
                        });
                        bead.setVisible(false);
                    })());
                }
                // The script's splash pair on the target.
                for (let s = 0; s < 2; s += 1) {
                    jobs.push((async () => {
                        await delay((14 + s * 8) * FRAME);
                        const burst = drop(splash, to.x, to.y, 0.9);
                        await scene.tween({
                            targets: burst,
                            scaleX: 2.2,
                            scaleY: 2.2,
                            alpha: 0,
                            duration: 14 * FRAME,
                            ease: "Quad.easeOut",
                        });
                    })());
                }
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/022.s: the attacker itself steps forward and
        // back (callfunction 52 with +24 then -24), and the whip lands as
        // three emitters fired at once on the target, shake five frames
        // after the crack. Archive 53's art: two elongated lashes and a
        // small puff for the contact point.
        vinewhip: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const lashA = "dsp-vinewhip-0";
            if (!scene.textures.exists(lashA)) throw new Error("Vine Whip's art is not staged");
            const puff = scene.textures.exists("dsp-vinewhip-1") ? "dsp-vinewhip-1" : null;
            const lashB = scene.textures.exists("dsp-vinewhip-2") ? "dsp-vinewhip-2" : lashA;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const home = actor.x;
            const step = actor.x < to.x ? 18 : -18;
            const sprites = [];
            const green = (key, x, y, scale, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.95)
                    .setAngle(angle)
                    .setTint(0x8feb59)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The script's step in...
                await scene.tween({ targets: actor, x: home + step, duration: 8 * FRAME, ease: "Quad.easeOut" });
                const jobs = [];
                // ...then the crack: two lashes sweeping across the target.
                jobs.push((async () => {
                    const lash = green(lashA, to.x - 14, to.y - 8, 2.0, -55);
                    await Promise.all([
                        scene.tween({ targets: lash, angle: -8, duration: 7 * FRAME, ease: "Cubic.easeIn" }),
                        scene.tween({ targets: lash, alpha: 0, duration: 16 * FRAME, delay: 5 * FRAME }),
                    ]);
                })());
                jobs.push((async () => {
                    await delay(4 * FRAME);
                    const lash = green(lashB, to.x + 10, to.y, 1.7, 50);
                    await Promise.all([
                        scene.tween({ targets: lash, angle: 4, duration: 7 * FRAME, ease: "Cubic.easeIn" }),
                        scene.tween({ targets: lash, alpha: 0, duration: 14 * FRAME, delay: 4 * FRAME }),
                    ]);
                })());
                if (puff) {
                    jobs.push((async () => {
                        await delay(6 * FRAME);
                        const hit = green(puff, to.x, to.y + 6, 1.0, 0);
                        await scene.tween({
                            targets: hit,
                            scaleX: 1.9,
                            scaleY: 1.9,
                            alpha: 0,
                            duration: 12 * FRAME,
                            ease: "Quad.easeOut",
                        });
                    })());
                }
                // ...and back home while the lash fades.
                jobs.push(scene.tween({ targets: actor, x: home, duration: 10 * FRAME, delay: 6 * FRAME, ease: "Quad.easeIn" }));
                await Promise.all(jobs);
            } finally {
                actor.x = home;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/039.s: no particles at all -- the whole move
        // is `loop 2 { sound; a twelve-frame wag of the user }`. The sprite
        // pivots at its feet, so the sway reads as the body rocking while
        // the tail wags. Faithful means minimal here.
        tailwhip: async (scene, actorView) => {
            const FRAME = 1000 / 60;
            const sprite = actorView.sprite;
            const home = sprite.x;
            const homeAngle = sprite.angle || 0;
            try {
                for (let cycle = 0; cycle < 2; cycle += 1) {
                    await scene.tween({ targets: sprite, x: home - 8, angle: homeAngle - 5, duration: 3 * FRAME });
                    await scene.tween({ targets: sprite, x: home + 8, angle: homeAngle + 5, duration: 6 * FRAME, ease: "Sine.easeInOut" });
                    await scene.tween({ targets: sprite, x: home, angle: homeAngle, duration: 3 * FRAME });
                }
            } finally {
                sprite.x = home;
                sprite.angle = homeAngle;
            }
        },

        // armips/move/move_anim/098.s: the move IS the dash. cmd52 sends the
        // battler itself across with the dash sound on its own side, the hit
        // sound lands on the target's side fifteen frames later with both
        // impact emitters, cmd53 brings the battler home, and the target
        // takes a light double 1px shake -- parsed at frame 15, which is
        // exactly when the impact happens, so the gesture is left to it.
        quickattack: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const key = "dsp-quickattack-0";
            if (!scene.textures.exists(key)) throw new Error("Quick Attack's art is not staged");
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const direction = Math.sign(to.x - homeX) || 1;
            const sprites = [];
            const flash = (x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.95)
                    .setTint(0xebeaab)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The dash: most of the way there in ten frames flat.
                await scene.tween({
                    targets: actor,
                    x: to.x - direction * 44,
                    y: homeY + (targetView.sprite.y - homeY) * 0.85,
                    duration: 10 * FRAME,
                    ease: "Cubic.easeIn",
                });
                // Impact: both emitters at once, and the script's return.
                const jobs = [];
                [[-10, -6, 1.6], [10, 4, 2.0]].forEach(([dx, dy, scale]) => {
                    const pop = flash(to.x + dx, to.y + dy, scale);
                    jobs.push(scene.tween({
                        targets: pop,
                        scaleX: scale + 0.9,
                        scaleY: scale + 0.9,
                        alpha: 0,
                        duration: 12 * FRAME,
                        ease: "Quad.easeOut",
                    }));
                });
                jobs.push(scene.tween({
                    targets: actor,
                    x: homeX,
                    y: homeY,
                    duration: 10 * FRAME,
                    delay: 4 * FRAME,
                    ease: "Quad.easeOut",
                }));
                await Promise.all(jobs);
            } finally {
                actor.x = homeX;
                actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/084.s: the whole move is wrapped in a screen
        // flash -- callfunction 33 fades it in over twelve frames and the
        // mirrored call at the end takes it back out. The sparks land on the
        // target in two waves with a shade dip between them, and one 2px
        // shake, which the parsed gestures already carry. Archive 115 is two
        // golden bolt segments; everything else is placement.
        thundershock: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const boltA = "dsp-thundershock-0";
            if (!scene.textures.exists(boltA)) throw new Error("Thunder Shock's art is not staged");
            const boltB = scene.textures.exists("dsp-thundershock-1") ? "dsp-thundershock-1" : boltA;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const bolt = (key, x, y, angle, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setAngle(angle)
                    .setTint(0xebaf0a)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const glow = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xfff2b0, 0).setDepth(63);
            try {
                // Flash in, as the script opens.
                await scene.tween({ targets: glow, fillAlpha: 0.2, duration: 12 * FRAME });
                const jobs = [];
                // Two waves of sparks crackling around the target.
                for (let i = 0; i < 8; i += 1) {
                    const wave = i < 4 ? 0 : 10;
                    const dx = ((i % 4) - 1.5) * 22;
                    const dy = ((i % 3) - 1) * 20;
                    const spike = bolt(i % 2 ? boltB : boltA,
                        to.x + dx, to.y + dy, ((i % 4) - 1.5) * 40, 1.5 + (i % 2) * 0.4);
                    jobs.push((async () => {
                        await delay(wave * FRAME);
                        spike.setAlpha(0.95);
                        await scene.tween({
                            targets: spike,
                            alpha: 0,
                            scaleY: spike.scaleY + 0.6,
                            duration: 14 * FRAME,
                            ease: "Quad.easeIn",
                        });
                    })());
                }
                // The shade dip between the waves.
                const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(44);
                jobs.push((async () => {
                    await delay(5 * FRAME);
                    await scene.tween({ targets: shade, fillAlpha: 0.14, duration: 7 * FRAME });
                    await scene.tween({ targets: shade, fillAlpha: 0, duration: 10 * FRAME });
                    shade.destroy();
                })());
                await Promise.all(jobs);
                // Flash out, as the script closes.
                await scene.tween({ targets: glow, fillAlpha: 0, duration: 12 * FRAME });
            } finally {
                glow.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/016.s: two waves of wind, and then the star
        // of the script -- a triple FIFTEEN-pixel shake on the target at
        // frame 20, which the parsed gestures already deliver. Gust rocks
        // harder than anything else this early. Archive 47's swirl is drawn
        // art, so it keeps normal blending and its outline.
        gust: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const key = "dsp-gust-0";
            if (!scene.textures.exists(key)) throw new Error("Gust's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const swirl = (x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setTint(0x8571be);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                for (let i = 0; i < 6; i += 1) {
                    const wave = i < 3 ? 0 : 8;
                    const lift = ((i % 3) - 1) * 22;
                    const startX = from.x + (to.x - from.x) * 0.25;
                    const startY = from.y + (to.y - from.y) * 0.25 + lift;
                    const wind = swirl(startX, startY, 1.1 + (i % 3) * 0.25);
                    jobs.push((async () => {
                        await delay((wave + (i % 3) * 3) * FRAME);
                        wind.setAlpha(0.9);
                        await Promise.all([
                            scene.tween({
                                targets: wind,
                                x: to.x + ((i % 3) - 1) * 12,
                                y: to.y + lift * 0.4,
                                scaleX: wind.scaleX + 0.5,
                                scaleY: wind.scaleY + 0.5,
                                duration: 22 * FRAME,
                                ease: "Sine.easeIn",
                            }),
                            scene.tween({
                                targets: wind,
                                angle: (i % 2 ? 540 : -540),
                                duration: 26 * FRAME,
                            }),
                        ]);
                        await scene.tween({ targets: wind, alpha: 0, duration: 6 * FRAME });
                    })());
                }
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/043.s: the same screen-flash envelope as
        // Thunder Shock, and inside it three glares driven from the user's
        // side toward the target -- a stare, not a projectile, so the
        // streaks die out on the way rather than striking. The shakes on the
        // target and its side at frame 10 are in the parsed gestures (the
        // second pair there is the contest branch, flattened; at 2px it is
        // imperceptible). Archive 74: a big glint for the eyes, a beam
        // streak, a smaller glow.
        leer: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const glint = "dsp-leer-2";
            const beam = scene.textures.exists("dsp-leer-1") ? "dsp-leer-1" : null;
            const big = scene.textures.exists("dsp-leer-0") ? "dsp-leer-0" : glint;
            if (!scene.textures.exists(glint)) throw new Error("Leer's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const degrees = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
            const sprites = [];
            const pale = (key, x, y, scale, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setAngle(angle)
                    .setTint(0xebeaab)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const envelope = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(63);
            try {
                await scene.tween({ targets: envelope, fillAlpha: 0.18, duration: 12 * FRAME });
                const jobs = [];
                // The eyes catch the light.
                jobs.push((async () => {
                    const flare = pale(big, from.x, from.y - 12, 1.2, 0);
                    flare.setAlpha(0.95);
                    await scene.tween({
                        targets: flare,
                        scaleX: 2.2,
                        scaleY: 2.2,
                        alpha: 0,
                        duration: 14 * FRAME,
                        ease: "Quad.easeOut",
                    });
                })());
                // Three glares sweeping at the target, dying out on the way.
                for (let i = 0; i < 3; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 5 * FRAME);
                        const streak = pale(beam || glint, from.x, from.y - 8, 1.6, degrees + 90);
                        streak.setAlpha(0.9);
                        await Promise.all([
                            scene.tween({
                                targets: streak,
                                x: from.x + (to.x - from.x) * 0.8,
                                y: from.y + (to.y - from.y) * 0.8 + ((i % 3) - 1) * 14,
                                duration: 16 * FRAME,
                                ease: "Sine.easeIn",
                            }),
                            scene.tween({ targets: streak, alpha: 0, duration: 8 * FRAME, delay: 8 * FRAME }),
                        ]);
                    })());
                }
                await Promise.all(jobs);
                await scene.tween({ targets: envelope, fillAlpha: 0, duration: 12 * FRAME });
            } finally {
                envelope.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/028.s: Vine Whip's step, mirrored -- the
        // attacker recoils and returns, turning to kick, while the plume
        // travels with the sound sweeping from its side to the target's,
        // and at frame 9 the dust pair bursts around the target's face.
        // The script asks for no shake at all: sand blinds, it does not
        // hit. Archive 59: a dust puff and a grain.
        sandattack: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const puff = "dsp-sandattack-0";
            if (!scene.textures.exists(puff)) throw new Error("Sand Attack's art is not staged");
            const grain = scene.textures.exists("dsp-sandattack-1") ? "dsp-sandattack-1" : puff;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const face = { x: to.x, y: to.y - 8 };
            const actor = actorView.sprite;
            const home = actor.x;
            const back = actor.x < to.x ? -18 : 18;
            const sprites = [];
            const sand = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setTint(0xebc669)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The recoil-and-return kick.
                await scene.tween({ targets: actor, x: home + back, duration: 8 * FRAME, ease: "Quad.easeOut" });
                const jobs = [];
                jobs.push(scene.tween({ targets: actor, x: home, duration: 8 * FRAME, ease: "Quad.easeIn" }));
                // The plume: a fan of grains at the target's face.
                for (let i = 0; i < 12; i += 1) {
                    jobs.push((async () => {
                        await delay(i * FRAME);
                        const speck = sand(i % 4 === 0 ? puff : grain,
                            from.x + (to.x - from.x) * 0.12,
                            from.y + (to.y - from.y) * 0.12,
                            i % 4 === 0 ? 0.9 : 1.6);
                        speck.setAlpha(0.9);
                        await scene.tween({
                            targets: speck,
                            x: face.x + ((i % 5) - 2) * 18,
                            y: face.y + ((i % 4) - 1.5) * 16,
                            duration: 14 * FRAME,
                            ease: "Sine.easeIn",
                        });
                        await scene.tween({ targets: speck, alpha: 0, duration: 4 * FRAME });
                    })());
                }
                // Frame nine: the dust pair bursting around the face.
                for (let s = 0; s < 2; s += 1) {
                    jobs.push((async () => {
                        await delay((21 + s * 4) * FRAME);
                        const cloud = sand(puff, face.x + (s ? 14 : -14), face.y, 1.0);
                        cloud.setAlpha(0.85);
                        await scene.tween({
                            targets: cloud,
                            scaleX: 2.4,
                            scaleY: 2.4,
                            alpha: 0,
                            duration: 16 * FRAME,
                            ease: "Quad.easeOut",
                        });
                    })());
                }
                await Promise.all(jobs);
            } finally {
                actor.x = home;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/145.s: the script loads archive 168 twice --
        // one slot streams bubbles across the field, the other pops a
        // cluster on the target ten frames later, with the double 2px
        // shakes at frame 20 already in the parsed gestures. The single
        // 30x30 bubble carries its own colour, so it goes untinted.
        bubble: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const key = "dsp-bubble-0";
            if (!scene.textures.exists(key)) throw new Error("Bubble's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const bubble = (x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const pop = (sprite) => scene.tween({
                targets: sprite,
                scaleX: sprite.scaleX + 0.5,
                scaleY: sprite.scaleY + 0.5,
                alpha: 0,
                duration: 4 * FRAME,
                ease: "Quad.easeOut",
            });
            try {
                const jobs = [];
                // The stream: ten bubbles bobbing across.
                for (let i = 0; i < 10; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 2.5 * FRAME);
                        const drift = ((i % 3) - 1) * 16;
                        const orb = bubble(from.x, from.y - 6, 0.9 + (i % 3) * 0.25);
                        orb.setAlpha(0.9);
                        const flight = 30 * FRAME;
                        await Promise.all([
                            scene.tween({ targets: orb, x: to.x + ((i % 4) - 1.5) * 10, duration: flight }),
                            (async () => {
                                await scene.tween({ targets: orb, y: from.y - 6 + drift - 14,
                                    duration: flight / 2, ease: "Sine.easeInOut" });
                                await scene.tween({ targets: orb, y: to.y + drift * 0.5,
                                    duration: flight / 2, ease: "Sine.easeInOut" });
                            })(),
                        ]);
                        await pop(orb);
                    })());
                }
                // The second slot: a cluster appearing on the target and
                // popping in sequence.
                for (let i = 0; i < 6; i += 1) {
                    jobs.push((async () => {
                        await delay((12 + i * 4) * FRAME);
                        const orb = bubble(to.x + ((i % 3) - 1) * 22, to.y + ((i % 2) ? 12 : -14), 0.8 + (i % 2) * 0.3);
                        orb.setAlpha(0.85);
                        await scene.tween({ targets: orb, y: orb.y - 8, duration: 8 * FRAME, ease: "Sine.easeOut" });
                        await pop(orb);
                    })());
                }
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/093.s: no particles at all. The script swaps
        // the background for the psychic distortion, pulses the shade
        // bright, shakes the ATTACKER -- concentration, already in the
        // parsed gestures at frame 0 -- and then moves a battler with the
        // sound on the target's side: the victim shoved by nothing visible.
        // The backdrop swap becomes a violet wash; the push becomes a lift,
        // a wobble and a drop.
        confusion: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const target = targetView.sprite;
            const homeX = target.x;
            const homeY = target.y;
            const wash = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xb08cf0, 0).setDepth(44);
            const pulse = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(63);
            try {
                // The background turns; a bright pulse rides on top of it.
                await Promise.all([
                    scene.tween({ targets: wash, fillAlpha: 0.14, duration: 8 * FRAME }),
                    (async () => {
                        await scene.tween({ targets: pulse, fillAlpha: 0.22, duration: 6 * FRAME });
                        await scene.tween({ targets: pulse, fillAlpha: 0, duration: 10 * FRAME });
                    })(),
                ]);
                await delay(6 * FRAME);
                // The push: lifted, rattled, dropped.
                await scene.tween({ targets: target, y: homeY - 12, duration: 8 * FRAME, ease: "Sine.easeOut" });
                for (let i = 0; i < 2; i += 1) {
                    await scene.tween({ targets: target, x: homeX + 3, duration: 2 * FRAME });
                    await scene.tween({ targets: target, x: homeX - 3, duration: 2 * FRAME });
                }
                target.x = homeX;
                await scene.tween({ targets: target, y: homeY, duration: 6 * FRAME, ease: "Quad.easeIn" });
                await scene.tween({ targets: wash, fillAlpha: 0, duration: 10 * FRAME });
            } finally {
                target.x = homeX;
                target.y = homeY;
                wash.destroy();
                pulse.destroy();
            }
        },

        // armips/move/move_anim/081.s: a flash envelope around a silk rope --
        // the same fired-in-sequence pattern as Water Gun's jet -- and then
        // an overlay cell left ON the target: the wrap of threads. The
        // script asks for no shake at all; silk binds, it does not hit.
        stringshot: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const key = "dsp-stringshot-0";
            if (!scene.textures.exists(key)) throw new Error("String Shot's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const degrees = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
            const sprites = [];
            const silk = (x, y, scale, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setAngle(angle)
                    .setTint(0xd2eb1f)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const envelope = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(63);
            try {
                await scene.tween({ targets: envelope, fillAlpha: 0.16, duration: 12 * FRAME });
                const jobs = [];
                // The rope: fourteen threads, sagging a little as silk does.
                for (let i = 0; i < 14; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 1.5 * FRAME);
                        const thread = silk(from.x, from.y - 4, 1.8, degrees + 90);
                        thread.setAlpha(0.9);
                        await scene.tween({
                            targets: thread,
                            x: to.x + ((i % 3) - 1) * 6,
                            y: to.y + 6 + (i % 2) * 4,
                            duration: 12 * FRAME,
                            ease: "Sine.easeIn",
                        });
                        thread.setVisible(false);
                    })());
                }
                // The wrap: threads criss-crossed on the target, lingering.
                jobs.push((async () => {
                    await delay(14 * FRAME);
                    const angles = [-30, 25, -70, 60];
                    const wraps = angles.map((angle, index) => {
                        const band = silk(to.x + ((index % 2) ? 6 : -6), to.y + ((index % 2) ? -4 : 6), 2.3, angle);
                        band.setAlpha(0.85);
                        return band;
                    });
                    await delay(20 * FRAME);
                    await Promise.all(wraps.map((band) => scene.tween({
                        targets: band, alpha: 0, duration: 10 * FRAME,
                    })));
                })());
                await Promise.all(jobs);
                await scene.tween({ targets: envelope, fillAlpha: 0, duration: 12 * FRAME });
            } finally {
                envelope.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/040.s: the attacker slides in and back
        // (callfunction 57's paired nudges) throwing a drawn needle, and the
        // poison lands as two additive bursts with a magenta shade pulse and
        // the 1px shake the parsed gestures already carry. The needle is
        // drawn art: normal blending, its own palette, no tint.
        poisonsting: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const needleKey = "dsp-poisonsting-0";
            if (!scene.textures.exists(needleKey)) throw new Error("Poison Sting's art is not staged");
            const burstA = scene.textures.exists("dsp-poisonsting-1") ? "dsp-poisonsting-1" : needleKey;
            const burstB = scene.textures.exists("dsp-poisonsting-2") ? "dsp-poisonsting-2" : burstA;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const degrees = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const step = actor.x < to.x ? 12 : -12;
            const sprites = [];
            const piece = (key, x, y, scale, tint, blend) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.95);
                if (tint !== null) sprite.setTint(tint);
                if (blend) sprite.setBlendMode(blend);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xc040b0, 0).setDepth(44);
            try {
                // The dart-throw lunge.
                await scene.tween({ targets: actor, x: homeX + step, y: homeY - 5, duration: 6 * FRAME, ease: "Quad.easeOut" });
                const jobs = [];
                jobs.push(scene.tween({ targets: actor, x: homeX, y: homeY, duration: 8 * FRAME, delay: 4 * FRAME, ease: "Quad.easeIn" }));
                // The needle, flat and fast.
                jobs.push((async () => {
                    const needle = piece(needleKey, from.x, from.y, 1.6, null, null);
                    needle.setAngle(degrees + 90);
                    await scene.tween({ targets: needle, x: to.x, y: to.y, duration: 10 * FRAME, ease: "Sine.easeIn" });
                    needle.setVisible(false);
                    // Impact: the poison bursts and the shade pulse together.
                    const pops = [
                        piece(burstA, to.x - 8, to.y - 4, 1.0, null, Phaser.BlendModes.ADD),
                        piece(burstB, to.x + 9, to.y + 5, 1.1, 0xeb59e8, Phaser.BlendModes.ADD),
                    ];
                    await Promise.all([
                        ...pops.map((pop) => scene.tween({
                            targets: pop, scaleX: 2.1, scaleY: 2.1, alpha: 0,
                            duration: 12 * FRAME, ease: "Quad.easeOut",
                        })),
                        (async () => {
                            await scene.tween({ targets: shade, fillAlpha: 0.12, duration: 5 * FRAME });
                            await scene.tween({ targets: shade, fillAlpha: 0, duration: 8 * FRAME });
                        })(),
                    ]);
                })());
                await Promise.all(jobs);
            } finally {
                actor.x = homeX;
                actor.y = homeY;
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/086.s: a flash envelope, then the move's
        // signature -- TWO shade pulses 47 frames apart, the paralysis
        // settling in after the jolt. Archive 117 carries two bolt segments,
        // a wide arc and a ring; the arc is anchored top, so it reads as the
        // wave passing over the target. One 2px shake, already parsed.
        thunderwave: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const boltA = "dsp-thunderwave-0";
            if (!scene.textures.exists(boltA)) throw new Error("Thunder Wave's art is not staged");
            const boltB = scene.textures.exists("dsp-thunderwave-1") ? "dsp-thunderwave-1" : boltA;
            const ring = scene.textures.exists("dsp-thunderwave-2") ? "dsp-thunderwave-2" : null;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const spark = (key, x, y, scale, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setAngle(angle)
                    .setTint(0xebaf0a)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const glow = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xfff2b0, 0).setDepth(63);
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xd8c020, 0).setDepth(44);
            // The script's two pulses: the jolt, then the paralysis settling.
            const pulse = async () => {
                await scene.tween({ targets: shade, fillAlpha: 0.16, duration: 5 * FRAME });
                await scene.tween({ targets: shade, fillAlpha: 0, duration: 9 * FRAME });
            };
            try {
                await scene.tween({ targets: glow, fillAlpha: 0.18, duration: 12 * FRAME });
                const jobs = [];
                // The wave itself: an arc washing over the target, crackling.
                if (ring) {
                    jobs.push((async () => {
                        const arc = spark(ring, to.x, to.y - 22, 1.4, 0);
                        arc.setAlpha(0.9);
                        await scene.tween({
                            targets: arc, y: to.y + 10, scaleX: 2.2, scaleY: 1.6,
                            alpha: 0, duration: 22 * FRAME, ease: "Sine.easeIn",
                        });
                    })());
                }
                for (let i = 0; i < 6; i += 1) {
                    jobs.push((async () => {
                        await delay((i % 3) * 4 * FRAME);
                        const bit = spark(i % 2 ? boltB : boltA,
                            to.x + ((i % 3) - 1) * 20, to.y + ((i % 2) ? 12 : -12),
                            1.4, ((i % 4) - 1.5) * 45);
                        bit.setAlpha(0.95);
                        await scene.tween({ targets: bit, alpha: 0, duration: 12 * FRAME });
                    })());
                }
                jobs.push((async () => { await delay(5 * FRAME); await pulse(); })());
                await Promise.all(jobs);
                // 47 frames later, the second pulse -- with a last crackle.
                await delay(28 * FRAME);
                const late = spark(boltA, to.x, to.y, 1.5, 20);
                late.setAlpha(0.8);
                await Promise.all([
                    pulse(),
                    scene.tween({ targets: late, alpha: 0, duration: 12 * FRAME }),
                ]);
                await scene.tween({ targets: glow, fillAlpha: 0, duration: 12 * FRAME });
            } finally {
                glow.destroy();
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/024.s: the whole emitter set fired twice, ten
        // frames apart, each with its own shake -- the script says the move's
        // name out loud. Both shakes are already in the parsed gestures.
        // Archive 55: a long red kick streak, an impact ring, a burst.
        doublekick: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const streakKey = "dsp-doublekick-0";
            if (!scene.textures.exists(streakKey)) throw new Error("Double Kick's art is not staged");
            const ringKey = scene.textures.exists("dsp-doublekick-1") ? "dsp-doublekick-1" : streakKey;
            const burstKey = scene.textures.exists("dsp-doublekick-2") ? "dsp-doublekick-2" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const lunge = actor.x < to.x ? 16 : -16;
            const sprites = [];
            const red = (key, x, y, scale, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.95)
                    .setAngle(angle)
                    .setTint(0xeb3830)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            // One kick: streak in, ring and burst on contact.
            const kick = async (offsetY, tilt) => {
                const streak = red(streakKey, to.x - lunge * 2.2, to.y + offsetY, 1.7, tilt);
                const ring = red(ringKey, to.x, to.y + offsetY, 0.8, 0);
                const burst = red(burstKey, to.x + lunge * 0.3, to.y + offsetY, 0.9, 0);
                ring.setAlpha(0.9);
                burst.setAlpha(0.85);
                await Promise.all([
                    scene.tween({ targets: streak, x: to.x + lunge * 0.4, alpha: 0,
                        duration: 10 * FRAME, ease: "Quad.easeIn" }),
                    scene.tween({ targets: ring, scaleX: 2.1, scaleY: 2.1, alpha: 0,
                        duration: 12 * FRAME, ease: "Quad.easeOut" }),
                    scene.tween({ targets: burst, scaleX: 1.8, scaleY: 1.8, alpha: 0,
                        duration: 10 * FRAME, ease: "Quad.easeOut" }),
                ]);
            };
            try {
                await scene.tween({ targets: actor, x: homeX + lunge, duration: 6 * FRAME, ease: "Quad.easeOut" });
                await kick(-6, -18);
                await delay(10 * FRAME);            // the script's wait 10
                await kick(8, 16);
                await scene.tween({ targets: actor, x: homeX, duration: 8 * FRAME, ease: "Quad.easeIn" });
            } finally {
                actor.x = homeX;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/030.s: three branches picked by jumpifside --
        // the handheld swaps which horn sprite is used depending on who is
        // attacking, so the horn always points the right way. The rest is
        // callfunction 57's slide in and back with the gore on contact.
        // Archive 61's horn is drawn art: normal blending, its own palette.
        hornattack: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const hornKey = "dsp-hornattack-0";
            if (!scene.textures.exists(hornKey)) throw new Error("Horn Attack's art is not staged");
            const ringKey = scene.textures.exists("dsp-hornattack-1") ? "dsp-hornattack-1" : null;
            const burstKey = scene.textures.exists("dsp-hornattack-2") ? "dsp-hornattack-2" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            try {
                // Slide in.
                await scene.tween({ targets: actor, x: homeX + facing * 14, y: homeY - 8,
                    duration: 7 * FRAME, ease: "Quad.easeOut" });
                const jobs = [];
                // The horn, mirrored to the attacker's side -- the script's
                // three branches exist for exactly this.
                const horn = scene.add.image(to.x - facing * 26, to.y, hornKey)
                    .setDepth(46)
                    .setScale(1.8)
                    .setAlpha(0.95);
                horn.setFlipX(facing < 0);
                horn.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(horn);
                jobs.push((async () => {
                    await scene.tween({ targets: horn, x: to.x + facing * 6,
                        duration: 8 * FRAME, ease: "Quad.easeIn" });
                    await scene.tween({ targets: horn, alpha: 0, duration: 8 * FRAME });
                })());
                // The gore on contact.
                if (ringKey) {
                    jobs.push((async () => {
                        await delay(7 * FRAME);
                        const ring = scene.add.image(to.x, to.y, ringKey)
                            .setDepth(47).setScale(0.9).setAlpha(0.9)
                            .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                        ring.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                        sprites.push(ring);
                        const burst = scene.add.image(to.x + facing * 8, to.y - 6, burstKey)
                            .setDepth(47).setScale(1.0).setAlpha(0.85)
                            .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                        burst.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                        sprites.push(burst);
                        await Promise.all([
                            scene.tween({ targets: ring, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                                duration: 14 * FRAME, ease: "Quad.easeOut" }),
                            scene.tween({ targets: burst, scaleX: 1.9, scaleY: 1.9, alpha: 0,
                                duration: 12 * FRAME, ease: "Quad.easeOut" }),
                        ]);
                    })());
                }
                // Slide back.
                jobs.push(scene.tween({ targets: actor, x: homeX, y: homeY,
                    duration: 9 * FRAME, delay: 8 * FRAME, ease: "Quad.easeIn" }));
                await Promise.all(jobs);
            } finally {
                actor.x = homeX;
                actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/071.s: the only move so far whose particles
        // run the wrong way on purpose. Inside a flash envelope the first
        // emitter drains from the TARGET, waitparticle holds until it has
        // finished, and only then does the second emitter fire with a shade
        // pulse and the heal sound on the user's side. The script asks for
        // no shake at all: absorb drains, it does not hit.
        absorb: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const glowKey = "dsp-absorb-0";
            if (!scene.textures.exists(glowKey)) throw new Error("Absorb's art is not staged");
            const moteA = scene.textures.exists("dsp-absorb-1") ? "dsp-absorb-1" : glowKey;
            const moteB = scene.textures.exists("dsp-absorb-2") ? "dsp-absorb-2" : moteA;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const green = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setTint(0x8feb59)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const envelope = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(63);
            const heal = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x7fe060, 0).setDepth(44);
            try {
                await scene.tween({ targets: envelope, fillAlpha: 0.15, duration: 12 * FRAME });
                // The drain: motes lifting off the target and streaming back.
                const drain = [];
                for (let i = 0; i < 12; i += 1) {
                    drain.push((async () => {
                        await delay(i * 2 * FRAME);
                        const spread = ((i % 4) - 1.5) * 18;
                        const mote = green(i % 2 ? moteA : moteB,
                            to.x + spread, to.y + ((i % 3) - 1) * 16, 1.5 + (i % 2) * 0.4);
                        mote.setAlpha(0.9);
                        await scene.tween({
                            targets: mote,
                            x: from.x + spread * 0.3,
                            y: from.y,
                            duration: 26 * FRAME,
                            ease: "Sine.easeInOut",
                        });
                        await scene.tween({ targets: mote, alpha: 0, duration: 4 * FRAME });
                    })());
                }
                await Promise.all(drain);          // the script's waitparticle
                // Only now the second emitter: the health arriving.
                const bloom = green(glowKey, from.x, from.y, 1.0);
                bloom.setAlpha(0.9);
                await Promise.all([
                    scene.tween({ targets: bloom, scaleX: 2.4, scaleY: 2.4, alpha: 0,
                        duration: 18 * FRAME, ease: "Quad.easeOut" }),
                    (async () => {
                        await scene.tween({ targets: heal, fillAlpha: 0.13, duration: 6 * FRAME });
                        await scene.tween({ targets: heal, fillAlpha: 0, duration: 10 * FRAME });
                    })(),
                ]);
                await scene.tween({ targets: envelope, fillAlpha: 0, duration: 12 * FRAME });
            } finally {
                envelope.destroy();
                heal.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/088.s: three emitters share one drawn rock,
        // twenty frames of flight (wait 12, throw sound, wait 8, impact
        // sound) and then the heaviest single knock in this batch. The
        // gesture parser declined this script's shake -- its argument layout
        // does not match the common one -- so the jolt is played here at a
        // middling weight rather than guessed at from the raw numbers.
        rockthrow: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const key = "dsp-rockthrow-0";
            if (!scene.textures.exists(key)) throw new Error("Rock Throw's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const stone = (x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.95)
                    .setTint(0xb6a136);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const target = targetView.sprite;
            const home = target.x;
            try {
                // Twenty frames of arcing flight, tumbling as it goes.
                const rock = stone(from.x, from.y, 1.5);
                const flight = 20 * FRAME;
                await Promise.all([
                    scene.tween({ targets: rock, x: to.x, duration: flight }),
                    scene.tween({ targets: rock, angle: 540, duration: flight }),
                    (async () => {
                        await scene.tween({ targets: rock, y: Math.min(from.y, to.y) - 40,
                            duration: flight / 2, ease: "Quad.easeOut" });
                        await scene.tween({ targets: rock, y: to.y,
                            duration: flight / 2, ease: "Quad.easeIn" });
                    })(),
                ]);
                rock.setVisible(false);
                // Impact: shards out, and the target knocked.
                const jobs = [];
                for (let i = 0; i < 4; i += 1) {
                    const shard = stone(to.x, to.y, 0.8);
                    jobs.push(scene.tween({
                        targets: shard,
                        x: to.x + ((i % 2) ? 26 : -26) + ((i % 3) - 1) * 8,
                        y: to.y - 18 + (i % 2) * 26,
                        angle: (i % 2 ? 200 : -200),
                        alpha: 0,
                        duration: 16 * FRAME,
                        ease: "Quad.easeOut",
                    }));
                }
                jobs.push((async () => {
                    for (let cycle = 0; cycle < 2; cycle += 1) {
                        await scene.tween({ targets: target, x: home + 4, duration: 2 * FRAME });
                        await scene.tween({ targets: target, x: home - 4, duration: 2 * FRAME });
                    }
                    target.x = home;
                })());
                await Promise.all(jobs);
            } finally {
                target.x = home;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/061.s: a long bubble stream, and then the
        // script's own choreography for the target -- loop 2 around three
        // callfunction 52 shoves with waits between them, a zigzag rocking
        // played twice. The 264 in those calls is the target, the same
        // marker the shake gestures carry; Vine Whip's 258 moved the
        // attacker instead.
        bubblebeam: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const bigKey = "dsp-bubblebeam-0";
            if (!scene.textures.exists(bigKey)) throw new Error("Bubble Beam's art is not staged");
            const smallKey = scene.textures.exists("dsp-bubblebeam-1") ? "dsp-bubblebeam-1" : bigKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const target = targetView.sprite;
            const homeX = target.x;
            const homeY = target.y;
            const bubble = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            // One shove of the script's zigzag.
            const shove = (dx, dy, frames) => scene.tween({
                targets: target, x: homeX + dx, y: homeY + dy,
                duration: frames * FRAME, ease: "Sine.easeInOut",
            });
            try {
                const jobs = [];
                // The stream: fourteen bubbles, close behind one another.
                for (let i = 0; i < 14; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 2 * FRAME);
                        const drift = ((i % 3) - 1) * 14;
                        const orb = bubble(i % 4 === 0 ? bigKey : smallKey, from.x, from.y - 4,
                            i % 4 === 0 ? 1.0 : 0.8 + (i % 3) * 0.2);
                        if (i % 4 === 0) orb.setTint(0x618deb);
                        orb.setAlpha(0.88);
                        await scene.tween({
                            targets: orb, x: to.x + ((i % 4) - 1.5) * 10, y: to.y + drift * 0.5,
                            duration: 20 * FRAME, ease: "Sine.easeIn",
                        });
                        await scene.tween({ targets: orb, scaleX: orb.scaleX + 0.4,
                            scaleY: orb.scaleY + 0.4, alpha: 0, duration: 5 * FRAME });
                    })());
                }
                // The rocking, twice, once the stream is arriving.
                jobs.push((async () => {
                    await delay(20 * FRAME);
                    for (let cycle = 0; cycle < 2; cycle += 1) {
                        await shove(8, 8, 8);
                        await shove(16, -16, 16);
                        await shove(8, 8, 8);
                    }
                    await shove(0, 0, 6);
                })());
                await Promise.all(jobs);
            } finally {
                target.x = homeX;
                target.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/064.s: the shortest script in the set. A
        // battler nudge (callfunction 4), two frames, both emitters, one
        // sound -- and that is the whole move. Archive 95 is a small spark
        // and a speck, so the peck is the strike itself rather than anything
        // thrown. No shake is scripted and the parser found none.
        peck: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const sparkKey = "dsp-peck-0";
            if (!scene.textures.exists(sparkKey)) throw new Error("Peck's art is not staged");
            const speckKey = scene.textures.exists("dsp-peck-1") ? "dsp-peck-1" : sparkKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const violet = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.95)
                    .setTint(0xa48ceb)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The nudge in, quick and shallow.
                await scene.tween({ targets: actor, x: homeX + facing * 20, y: homeY - 4,
                    duration: 6 * FRAME, ease: "Quad.easeIn" });
                const jobs = [];
                // Two frames later, both emitters at the contact point.
                jobs.push((async () => {
                    await delay(2 * FRAME);
                    const flash = violet(sparkKey, to.x - facing * 6, to.y, 1.6);
                    const jobs2 = [scene.tween({ targets: flash, scaleX: 2.6, scaleY: 2.6,
                        alpha: 0, duration: 12 * FRAME, ease: "Quad.easeOut" })];
                    for (let i = 0; i < 4; i += 1) {
                        const speck = violet(speckKey, to.x - facing * 6, to.y, 1.8);
                        jobs2.push(scene.tween({
                            targets: speck,
                            x: to.x + ((i % 2) ? 22 : -14) - facing * 6,
                            y: to.y + ((i % 3) - 1) * 18,
                            alpha: 0,
                            duration: 14 * FRAME,
                            ease: "Quad.easeOut",
                        }));
                    }
                    await Promise.all(jobs2);
                })());
                jobs.push(scene.tween({ targets: actor, x: homeX, y: homeY,
                    duration: 9 * FRAME, delay: 4 * FRAME, ease: "Quad.easeOut" }));
                await Promise.all(jobs);
            } finally {
                actor.x = homeX;
                actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/031.s: Poison Sting's slide in and back,
        // but the sound is a repeatse of two -- the move jabs more than
        // once, which is what Fury Attack is. Two jabs at different heights
        // inside the one slide. The 2px shake is already parsed. Engine-side
        // a multi-hit move replays the light archetype for hits after the
        // first, so this plays once per use, as the script does.
        furyattack: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const ringKey = "dsp-furyattack-0";
            if (!scene.textures.exists(ringKey)) throw new Error("Fury Attack's art is not staged");
            const burstKey = scene.textures.exists("dsp-furyattack-1") ? "dsp-furyattack-1" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const pale = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0.92)
                    .setTint(0xebeaab)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const jab = async (offsetY) => {
                const ring = pale(ringKey, to.x - facing * 4, to.y + offsetY, 0.9);
                const burst = pale(burstKey, to.x + facing * 6, to.y + offsetY, 1.0);
                await Promise.all([
                    scene.tween({ targets: ring, scaleX: 2.0, scaleY: 2.0, alpha: 0,
                        duration: 11 * FRAME, ease: "Quad.easeOut" }),
                    scene.tween({ targets: burst, scaleX: 1.7, scaleY: 1.7, alpha: 0,
                        duration: 9 * FRAME, ease: "Quad.easeOut" }),
                ]);
            };
            try {
                await scene.tween({ targets: actor, x: homeX + facing * 14, y: homeY - 8,
                    duration: 7 * FRAME, ease: "Quad.easeOut" });
                await jab(-8);
                await delay(4 * FRAME);
                await jab(9);
                await scene.tween({ targets: actor, x: homeX, y: homeY,
                    duration: 9 * FRAME, ease: "Quad.easeIn" });
            } finally {
                actor.x = homeX;
                actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/062.s: a flash envelope around a sustained
        // beam -- the same cmd37 4096 that gives Bubble Beam its long stream
        // -- with the shake landing at frame 10 while the beam is still
        // running. Archive 93 is one 31x31 mote, so the beam is built the
        // way the handheld builds it: many of the same particle chained
        // along the line. The pale violet shimmer among the cyan is a
        // reconstruction; the archive carries one texture and the emitter's
        // own colour cycling is not decoded.
        aurorabeam: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const key = "dsp-aurorabeam-0";
            if (!scene.textures.exists(key)) throw new Error("Aurora Beam's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const TINTS = [0x93ebe7, 0x93ebe7, 0xb9a8f0];
            const mote = (x, y, scale, tint) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46)
                    .setScale(scale)
                    .setAlpha(0)
                    .setTint(tint)
                    .setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            const envelope = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(63);
            try {
                await scene.tween({ targets: envelope, fillAlpha: 0.16, duration: 12 * FRAME });
                const jobs = [];
                // The beam: 22 motes launched two frames apart, each crossing
                // in twelve, so the line stays filled while it runs.
                for (let i = 0; i < 22; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 2 * FRAME);
                        const wobble = ((i % 3) - 1) * 7;
                        const bead = mote(from.x, from.y + wobble, 1.1 + (i % 3) * 0.2, TINTS[i % TINTS.length]);
                        bead.setAlpha(0.85);
                        await scene.tween({
                            targets: bead, x: to.x, y: to.y + wobble * 0.5,
                            duration: 12 * FRAME, ease: "Sine.easeIn",
                        });
                        await scene.tween({ targets: bead, scaleX: bead.scaleX + 0.5,
                            scaleY: bead.scaleY + 0.5, alpha: 0, duration: 5 * FRAME });
                    })());
                }
                // The frame-10 knock is NOT written here. callfunction 36 is
                // already parsed into a gesture and played by playGestures,
                // which scales its four DS pixels to ten for this stage.
                // Repeating it here gave the target a second, weaker shake
                // over the top of the real one.
                await Promise.all(jobs);
                await scene.tween({ targets: envelope, fillAlpha: 0, duration: 12 * FRAME });
            } finally {
                envelope.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/017.s: two emitters, the sound twice, and
        // three 2px shakes -- already parsed. Archive 48's 30x12 drawn slash
        // is the only piece in this batch the role pass tagged a streak, so
        // it is the wing itself: two beats crossing the target, drawn art
        // with its own palette, with the spark on each contact.
        wingattack: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const slashKey = "dsp-wingattack-0";
            if (!scene.textures.exists(slashKey)) throw new Error("Wing Attack's art is not staged");
            const sparkKey = scene.textures.exists("dsp-wingattack-1") ? "dsp-wingattack-1" : null;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const beat = async (angle, offsetY, delayFrames) => {
                await delay(delayFrames * FRAME);
                const slash = scene.add.image(to.x - 30, to.y + offsetY, slashKey)
                    .setDepth(46).setScale(2.0).setAlpha(0.95).setAngle(angle)
                    .setTint(0x8571be);
                slash.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(slash);
                const jobs = [scene.tween({
                    targets: slash, x: to.x + 30, alpha: 0,
                    duration: 12 * FRAME, ease: "Quad.easeIn",
                })];
                if (sparkKey) {
                    const spark = scene.add.image(to.x, to.y + offsetY, sparkKey)
                        .setDepth(47).setScale(1.2).setAlpha(0.9)
                        .setTint(0xa48ceb).setBlendMode(Phaser.BlendModes.ADD);
                    spark.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(spark);
                    jobs.push(scene.tween({ targets: spark, scaleX: 2.2, scaleY: 2.2,
                        alpha: 0, duration: 12 * FRAME, ease: "Quad.easeOut" }));
                }
                await Promise.all(jobs);
            };
            try {
                await Promise.all([beat(-28, -10, 0), beat(24, 10, 6)]);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/021.s: the first script to drive BOTH
        // battlers against each other. callfunction 57 fires four times,
        // alternating the 258 marker for the attacker and 264 for the
        // target: the attacker drives in, one frame later the target is
        // knocked the opposite way, then both are put back. That collision
        // is the move; the emitters only mark where they met.
        slam: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const ringKey = "dsp-slam-0";
            if (!scene.textures.exists(ringKey)) throw new Error("Slam's art is not staged");
            const speckKey = scene.textures.exists("dsp-slam-1") ? "dsp-slam-1" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const target = targetView.sprite;
            const actorHome = { x: actor.x, y: actor.y };
            const targetHome = { x: target.x, y: target.y };
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const pale = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.92)
                    .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The attacker drives in.
                await scene.tween({ targets: actor, x: actorHome.x + facing * 14, y: actorHome.y + 4,
                    duration: 6 * FRAME, ease: "Quad.easeIn" });
                const jobs = [];
                // One frame later the target takes it the other way.
                jobs.push((async () => {
                    await delay(FRAME);
                    await scene.tween({ targets: target, x: targetHome.x + facing * 14, y: targetHome.y - 4,
                        duration: 5 * FRAME, ease: "Quad.easeOut" });
                    await scene.tween({ targets: target, x: targetHome.x, y: targetHome.y,
                        duration: 10 * FRAME, ease: "Sine.easeOut" });
                })());
                // The contact mark.
                const ring = pale(ringKey, to.x - facing * 8, to.y, 0.9);
                const jobs2 = [scene.tween({ targets: ring, scaleX: 2.3, scaleY: 2.3, alpha: 0,
                    duration: 14 * FRAME, ease: "Quad.easeOut" })];
                for (let i = 0; i < 5; i += 1) {
                    const speck = pale(speckKey, to.x - facing * 8, to.y, 1.5);
                    jobs2.push(scene.tween({
                        targets: speck,
                        x: to.x - facing * 8 + ((i % 3) - 1) * 24,
                        y: to.y - 16 + (i % 2) * 26,
                        alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                jobs.push(Promise.all(jobs2));
                jobs.push(scene.tween({ targets: actor, x: actorHome.x, y: actorHome.y,
                    duration: 10 * FRAME, delay: 5 * FRAME, ease: "Quad.easeOut" }));
                await Promise.all(jobs);
            } finally {
                actor.x = actorHome.x; actor.y = actorHome.y;
                target.x = targetHome.x; target.y = targetHome.y;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/036.s: the recoil written into the staging.
        // The attacker pulls BACK sixteen, waits fifteen frames, then charges
        // thirty-two -- twice the wind-up -- lands three emitters with four
        // 4px shakes, and is thrown back sixteen again. Take Down hurts the
        // user, and the script says so before any damage number does.
        // Archive 67's 43x42 piece is drawn art and keeps its own palette.
        takedown: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const slabKey = "dsp-takedown-0";
            if (!scene.textures.exists(slabKey)) throw new Error("Take Down's art is not staged");
            const ringKey = scene.textures.exists("dsp-takedown-1") ? "dsp-takedown-1" : null;
            const sparkKey = scene.textures.exists("dsp-takedown-2") ? "dsp-takedown-2" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            try {
                // Wind up: back sixteen, and hold the scripted fifteen frames.
                await scene.tween({ targets: actor, x: homeX - facing * 16, y: homeY + 8,
                    duration: 8 * FRAME, ease: "Quad.easeOut" });
                await delay(15 * FRAME);
                // The charge: thirty-two forward, twice the wind-up.
                await scene.tween({ targets: actor, x: homeX + facing * 32, y: homeY - 16,
                    duration: 9 * FRAME, ease: "Quad.easeIn" });
                const jobs = [];
                // Three emitters at the collision.
                const slab = scene.add.image(to.x - facing * 10, to.y, slabKey)
                    .setDepth(46).setScale(1.1).setAlpha(0.9).setTint(0xb4b383);
                slab.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(slab);
                jobs.push(scene.tween({ targets: slab, scaleX: 1.9, scaleY: 1.9, alpha: 0,
                    duration: 16 * FRAME, ease: "Quad.easeOut" }));
                if (ringKey) {
                    const ring = scene.add.image(to.x, to.y, ringKey)
                        .setDepth(47).setScale(0.9).setAlpha(0.9)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    ring.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(ring);
                    jobs.push(scene.tween({ targets: ring, scaleX: 2.4, scaleY: 2.4, alpha: 0,
                        duration: 15 * FRAME, ease: "Quad.easeOut" }));
                }
                for (let i = 0; i < 5 && sparkKey; i += 1) {
                    const spark = scene.add.image(to.x, to.y, sparkKey)
                        .setDepth(47).setScale(1.5).setAlpha(0.85)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    spark.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(spark);
                    jobs.push(scene.tween({
                        targets: spark,
                        x: to.x + ((i % 3) - 1) * 30, y: to.y - 20 + (i % 2) * 34,
                        alpha: 0, duration: 16 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                // The four knocks on the target are NOT written here:
                // callfunction 36 is parsed into a gesture and played by
                // playGestures, which scales its four DS pixels to ten. Only
                // the user's own recoil belongs to this choreography.
                jobs.push((async () => {
                    await delay(4 * FRAME);
                    await scene.tween({ targets: actor, x: homeX - facing * 16, y: homeY + 8,
                        duration: 8 * FRAME, ease: "Quad.easeOut" });
                    await scene.tween({ targets: actor, x: homeX, y: homeY,
                        duration: 10 * FRAME, ease: "Sine.easeOut" });
                })());
                await Promise.all(jobs);
            } finally {
                actor.x = homeX; actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/023.s: the emitters land, five frames pass,
        // and then callfunction 42 runs a series of percentages against the
        // 264 target marker -- 100, 130, 100, 70, 100. They are scales: the
        // target is stretched, then squashed to seventy percent, then let
        // go. The move flattens what it lands on, and the script animates
        // that rather than describing it.
        stomp: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const footKey = "dsp-stomp-0";
            if (!scene.textures.exists(footKey)) throw new Error("Stomp's art is not staged");
            const ringKey = scene.textures.exists("dsp-stomp-1") ? "dsp-stomp-1" : footKey;
            const burstKey = scene.textures.exists("dsp-stomp-2") ? "dsp-stomp-2" : ringKey;
            const to = scene.effectPoint(targetView);
            const target = targetView.sprite;
            const baseX = target.scaleX;
            const baseY = target.scaleY;
            const sprites = [];
            const pale = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.92)
                    .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            // One step of the script's percentage list, as squash and stretch.
            const scaleTo = (percent, frames) => scene.tween({
                targets: target,
                scaleY: baseY * (percent / 100),
                scaleX: baseX * (2 - percent / 100),
                duration: frames * FRAME,
                ease: "Quad.easeOut",
            });
            try {
                const jobs = [];
                // The foot coming down, and the impact around it.
                const foot = pale(footKey, to.x, to.y - 46, 1.6);
                jobs.push((async () => {
                    await scene.tween({ targets: foot, y: to.y, duration: 6 * FRAME, ease: "Quad.easeIn" });
                    await scene.tween({ targets: foot, alpha: 0, duration: 8 * FRAME });
                })());
                jobs.push((async () => {
                    await delay(5 * FRAME);
                    const ring = pale(ringKey, to.x, to.y + 8, 0.9);
                    const burst = pale(burstKey, to.x, to.y, 1.0);
                    await Promise.all([
                        scene.tween({ targets: ring, scaleX: 2.6, scaleY: 1.6, alpha: 0,
                            duration: 15 * FRAME, ease: "Quad.easeOut" }),
                        scene.tween({ targets: burst, scaleX: 1.9, scaleY: 1.9, alpha: 0,
                            duration: 12 * FRAME, ease: "Quad.easeOut" }),
                    ]);
                })());
                // 100 -> 130 -> 100 -> 70 -> 100, as written.
                jobs.push((async () => {
                    await delay(5 * FRAME);
                    await scaleTo(130, 4);
                    await scaleTo(100, 3);
                    await scaleTo(70, 4);
                    await scaleTo(100, 8);
                })());
                await Promise.all(jobs);
            } finally {
                target.setScale(baseX, baseY);
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/029.s: two sounds fired together -- the
        // charge on the user's side and the thud on the target's -- around
        // callfunction 57's slide in and back, with both emitters and one
        // 2px shake at the meeting point. A plain, hard hit.
        headbutt: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const ringKey = "dsp-headbutt-0";
            if (!scene.textures.exists(ringKey)) throw new Error("Headbutt's art is not staged");
            const flashKey = scene.textures.exists("dsp-headbutt-1") ? "dsp-headbutt-1" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const pale = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.93)
                    .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await scene.tween({ targets: actor, x: homeX + facing * 14, y: homeY - 8,
                    duration: 6 * FRAME, ease: "Quad.easeIn" });
                const ring = pale(ringKey, to.x - facing * 6, to.y - 4, 0.9);
                const flash = pale(flashKey, to.x, to.y - 4, 1.2);
                await Promise.all([
                    scene.tween({ targets: ring, scaleX: 2.4, scaleY: 2.4, alpha: 0,
                        duration: 14 * FRAME, ease: "Quad.easeOut" }),
                    scene.tween({ targets: flash, scaleX: 2.0, scaleY: 2.0, alpha: 0,
                        duration: 11 * FRAME, ease: "Quad.easeOut" }),
                    scene.tween({ targets: actor, x: homeX, y: homeY,
                        duration: 10 * FRAME, delay: 4 * FRAME, ease: "Quad.easeOut" }),
                ]);
            } finally {
                actor.x = homeX; actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/067.s: two emitters, two frames, a third,
        // and a double 2px shake -- the fastest impact in the batch, and the
        // whole thing happens at ground level. Archive 98 is Double Kick's
        // red, so the sweep and its sparks sit low against the target's feet
        // rather than at its centre.
        lowkick: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const sweepKey = "dsp-lowkick-0";
            if (!scene.textures.exists(sweepKey)) throw new Error("Low Kick's art is not staged");
            const sparkKey = scene.textures.exists("dsp-lowkick-1") ? "dsp-lowkick-1" : sweepKey;
            const speckKey = scene.textures.exists("dsp-lowkick-2") ? "dsp-lowkick-2" : sparkKey;
            const to = scene.effectPoint(targetView);
            // The feet, not the body: effectPoint is the centre, and the
            // sprite's own position is where it stands.
            const ground = { x: targetView.position.x, y: targetView.position.y - 8 };
            const facing = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const red = (key, x, y, scale, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.94).setAngle(angle || 0)
                    .setTint(0xeb3830).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                // The sweep across the ankles.
                const sweep = red(sweepKey, ground.x - facing * 30, ground.y, 1.5, facing > 0 ? 70 : -70);
                jobs.push(scene.tween({
                    targets: sweep, x: ground.x + facing * 14, alpha: 0,
                    duration: 10 * FRAME, ease: "Quad.easeIn",
                }));
                // Two frames later, the sparks kicking up.
                jobs.push((async () => {
                    await delay(2 * FRAME);
                    const flash = red(sparkKey, ground.x, ground.y, 1.4);
                    const inner = [scene.tween({ targets: flash, scaleX: 2.4, scaleY: 2.4,
                        alpha: 0, duration: 12 * FRAME, ease: "Quad.easeOut" })];
                    for (let i = 0; i < 4; i += 1) {
                        const speck = red(speckKey, ground.x, ground.y, 1.6);
                        inner.push(scene.tween({
                            targets: speck,
                            x: ground.x + ((i % 2) ? 24 : -24) + ((i % 3) - 1) * 6,
                            y: ground.y - 12 - (i % 3) * 10,
                            alpha: 0, duration: 13 * FRAME, ease: "Quad.easeOut",
                        }));
                    }
                    await Promise.all(inner);
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/037.s: the attacker flails with the same
        // callfunction 60 that wags Tail Whip's tail, twice, and each round
        // throws particles along its own cmd37 4 heading -- up-right,
        // down-right, then down-left -- while the target takes four 4px
        // shakes. Both rounds are in the parsed gestures, at frames 0 and 3.
        thrash: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const wideKey = "dsp-thrash-0";
            if (!scene.textures.exists(wideKey)) throw new Error("Thrash's art is not staged");
            const barKey = scene.textures.exists("dsp-thrash-1") ? "dsp-thrash-1" : wideKey;
            const ringKey = scene.textures.exists("dsp-thrash-2") ? "dsp-thrash-2" : barKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeAngle = actor.angle || 0;
            const sprites = [];
            const pale = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.9)
                    .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            // One flail: the wag, and debris thrown along a heading.
            const round = async (headings) => {
                const jobs = [];
                jobs.push((async () => {
                    await scene.tween({ targets: actor, x: homeX - 9, angle: homeAngle - 6, duration: 3 * FRAME });
                    await scene.tween({ targets: actor, x: homeX + 9, angle: homeAngle + 6, duration: 6 * FRAME, ease: "Sine.easeInOut" });
                    await scene.tween({ targets: actor, x: homeX, angle: homeAngle, duration: 3 * FRAME });
                })());
                headings.forEach(([dx, dy], index) => {
                    jobs.push((async () => {
                        await delay(index * 3 * FRAME);
                        const key = index === 0 ? ringKey : (index === 1 ? barKey : wideKey);
                        const bit = pale(key, to.x, to.y, 1.2 + (index % 2) * 0.3);
                        await scene.tween({
                            targets: bit, x: to.x + dx, y: to.y + dy,
                            alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut",
                        });
                    })());
                });
                await Promise.all(jobs);
            };
            try {
                await round([[34, -30], [34, 14], [30, 30]]);
                await delay(3 * FRAME);
                await round([[-30, 30], [-28, -22], [-34, -10]]);
            } finally {
                actor.x = homeX;
                actor.angle = homeAngle;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/034.s: the only script here that leaves the
        // ground. callfunction 57 drops the attacker sixteen, lifts it
        // sixteen back the other way, then drives it twenty-four forward --
        // a crouch, a leap and the landing -- with three 4px shakes and the
        // return. Archive 65's 43x42 piece is drawn art and keeps its own
        // palette.
        bodyslam: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const slabKey = "dsp-bodyslam-0";
            if (!scene.textures.exists(slabKey)) throw new Error("Body Slam's art is not staged");
            const ringKey = scene.textures.exists("dsp-bodyslam-1") ? "dsp-bodyslam-1" : null;
            const sparkKey = scene.textures.exists("dsp-bodyslam-2") ? "dsp-bodyslam-2" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            try {
                // Crouch, then leap.
                await scene.tween({ targets: actor, y: homeY + 16, duration: 7 * FRAME, ease: "Quad.easeOut" });
                await scene.tween({ targets: actor, y: homeY - 16, duration: 8 * FRAME, ease: "Quad.easeOut" });
                // Drive in.
                await scene.tween({ targets: actor, x: homeX + facing * 24, duration: 7 * FRAME, ease: "Quad.easeIn" });
                const jobs = [];
                const slab = scene.add.image(to.x - facing * 8, to.y, slabKey)
                    .setDepth(46).setScale(1.1).setAlpha(0.9).setTint(0xb4b383);
                slab.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(slab);
                jobs.push(scene.tween({ targets: slab, scaleX: 1.9, scaleY: 1.9, alpha: 0,
                    duration: 15 * FRAME, ease: "Quad.easeOut" }));
                if (ringKey) {
                    const ring = scene.add.image(to.x, to.y, ringKey)
                        .setDepth(47).setScale(0.9).setAlpha(0.9)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    ring.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(ring);
                    jobs.push(scene.tween({ targets: ring, scaleX: 2.5, scaleY: 2.5, alpha: 0,
                        duration: 14 * FRAME, ease: "Quad.easeOut" }));
                }
                for (let i = 0; i < 4 && sparkKey; i += 1) {
                    const spark = scene.add.image(to.x, to.y, sparkKey)
                        .setDepth(47).setScale(1.4).setAlpha(0.85)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    spark.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(spark);
                    jobs.push(scene.tween({
                        targets: spark, x: to.x + ((i % 2) ? 28 : -28), y: to.y - 16 + (i % 2) * 30,
                        alpha: 0, duration: 15 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                jobs.push(scene.tween({ targets: actor, x: homeX, y: homeY,
                    duration: 11 * FRAME, delay: 4 * FRAME, ease: "Quad.easeOut" }));
                await Promise.all(jobs);
            } finally {
                actor.x = homeX; actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/042.s: three needles fired in sequence --
        // addparticle2 with callfunction 66 at rising indices, four frames
        // apart -- inside one slide in and back. The parser found six shakes
        // for this script, at frames 7, 12, 17, 29, 33 and 37, which is the
        // volley landing rather than one hit. Archive 73's 17x32 needle is
        // drawn art and keeps its own palette.
        pinmissile: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const needleKey = "dsp-pinmissile-0";
            if (!scene.textures.exists(needleKey)) throw new Error("Pin Missile's art is not staged");
            const ringKey = scene.textures.exists("dsp-pinmissile-1") ? "dsp-pinmissile-1" : null;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const degrees = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const fire = async (index) => {
                const offsetY = ((index % 3) - 1) * 16;
                const needle = scene.add.image(from.x, from.y + offsetY, needleKey)
                    .setDepth(46).setScale(1.5).setAlpha(0.95)
                    .setAngle(degrees + 90).setTint(0xa1b418);
                needle.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(needle);
                await scene.tween({ targets: needle, x: to.x, y: to.y + offsetY * 0.5,
                    duration: 11 * FRAME, ease: "Sine.easeIn" });
                needle.setVisible(false);
                if (!ringKey) return;
                const hit = scene.add.image(to.x, to.y + offsetY * 0.5, ringKey)
                    .setDepth(47).setScale(0.8).setAlpha(0.9)
                    .setTint(0xd2eb1f).setBlendMode(Phaser.BlendModes.ADD);
                hit.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(hit);
                await scene.tween({ targets: hit, scaleX: 1.9, scaleY: 1.9, alpha: 0,
                    duration: 10 * FRAME, ease: "Quad.easeOut" });
            };
            try {
                await scene.tween({ targets: actor, x: homeX + facing * 14, y: homeY - 8,
                    duration: 7 * FRAME, ease: "Quad.easeOut" });
                const jobs = [];
                // Three needles, four frames apart, as the script fires them.
                for (let i = 0; i < 3; i += 1) {
                    jobs.push((async () => { await delay(i * 4 * FRAME); await fire(i); })());
                }
                jobs.push(scene.tween({ targets: actor, x: homeX, y: homeY,
                    duration: 10 * FRAME, delay: 16 * FRAME, ease: "Quad.easeIn" }));
                await Promise.all(jobs);
            } finally {
                actor.x = homeX; actor.y = homeY;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/099.s: the shade pulses BEFORE anything
        // moves -- callfunction 34 fires while the script is still waiting on
        // its sound -- and only then does callfunction 52 push the attacker
        // twenty-four forward and back. The anger comes first and the charge
        // follows it, which is the move. The pulse is tinted red here to
        // match that; the script's colour argument is not decoded.
        rage: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const ringKey = "dsp-rage-0";
            if (!scene.textures.exists(ringKey)) throw new Error("Rage's art is not staged");
            const sparkKey = scene.textures.exists("dsp-rage-1") ? "dsp-rage-1" : ringKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const rageShade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xc03028, 0).setDepth(44);
            const pale = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.92)
                    .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The temper, first.
                await scene.tween({ targets: rageShade, fillAlpha: 0.2, duration: 6 * FRAME });
                await scene.tween({ targets: rageShade, fillAlpha: 0.05, duration: 10 * FRAME });
                // Then the charge.
                await scene.tween({ targets: actor, x: homeX + facing * 24,
                    duration: 7 * FRAME, ease: "Quad.easeIn" });
                const ring = pale(ringKey, to.x - facing * 6, to.y, 0.9);
                const spark = pale(sparkKey, to.x, to.y, 1.4);
                await Promise.all([
                    scene.tween({ targets: ring, scaleX: 2.3, scaleY: 2.3, alpha: 0,
                        duration: 13 * FRAME, ease: "Quad.easeOut" }),
                    scene.tween({ targets: spark, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                        duration: 11 * FRAME, ease: "Quad.easeOut" }),
                    scene.tween({ targets: actor, x: homeX, duration: 10 * FRAME,
                        delay: 4 * FRAME, ease: "Quad.easeOut" }),
                    scene.tween({ targets: rageShade, fillAlpha: 0, duration: 12 * FRAME }),
                ]);
            } finally {
                actor.x = homeX;
                rageShade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/041.s: the name is in the timing. The slide
        // in and back carries the first needle, then five frames later a
        // second sound, a second shade pulse and the shake land -- two
        // stings, not one. Archive 72's 7x32 needle is drawn art with its
        // own palette.
        twineedle: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const needleKey = "dsp-twineedle-0";
            if (!scene.textures.exists(needleKey)) throw new Error("Twineedle's art is not staged");
            const burstKey = scene.textures.exists("dsp-twineedle-1") ? "dsp-twineedle-1" : null;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const degrees = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
            const actor = actorView.sprite;
            const homeX = actor.x;
            const homeY = actor.y;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xa8d020, 0).setDepth(44);
            const sting = async (offsetY) => {
                const needle = scene.add.image(from.x + facing * 12, from.y + offsetY, needleKey)
                    .setDepth(46).setScale(1.5).setAlpha(0.95)
                    .setAngle(degrees + 90).setTint(0xa1b418);
                needle.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(needle);
                await scene.tween({ targets: needle, x: to.x, y: to.y + offsetY * 0.4,
                    duration: 9 * FRAME, ease: "Sine.easeIn" });
                needle.setVisible(false);
                if (!burstKey) return;
                const pop = scene.add.image(to.x, to.y + offsetY * 0.4, burstKey)
                    .setDepth(47).setScale(0.9).setAlpha(0.9)
                    .setTint(0xd2eb1f).setBlendMode(Phaser.BlendModes.ADD);
                pop.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(pop);
                await scene.tween({ targets: pop, scaleX: 2.0, scaleY: 2.0, alpha: 0,
                    duration: 11 * FRAME, ease: "Quad.easeOut" });
            };
            try {
                await scene.tween({ targets: actor, x: homeX + facing * 14, y: homeY - 8,
                    duration: 7 * FRAME, ease: "Quad.easeOut" });
                await sting(-8);
                await Promise.all([
                    scene.tween({ targets: actor, x: homeX, y: homeY,
                        duration: 8 * FRAME, ease: "Quad.easeIn" }),
                    (async () => {
                        await delay(5 * FRAME);          // the script's wait 5
                        await Promise.all([
                            sting(8),
                            (async () => {
                                await scene.tween({ targets: shade, fillAlpha: 0.12, duration: 5 * FRAME });
                                await scene.tween({ targets: shade, fillAlpha: 0, duration: 9 * FRAME });
                            })(),
                        ]);
                    })(),
                ]);
            } finally {
                actor.x = homeX; actor.y = homeY;
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/132.s: no particle archive at all. The script
        // loads an overlay cell -- the coils, which the pipeline does not
        // extract -- and then keeps time: loop 5 of a two-frame beat, then
        // loop 2 of a six-frame one. Fast squeezes, then slow ones. Without
        // the cell the rhythm is the move, so it is played on the target
        // itself: five quick pinches and two long ones, narrowing as the
        // grip tightens.
        constrict: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const target = targetView.sprite;
            const baseX = target.scaleX;
            const baseY = target.scaleY;
            const squeeze = (amount, frames) => scene.tween({
                targets: target,
                scaleX: baseX * (1 - amount),
                scaleY: baseY * (1 + amount * 0.5),
                duration: frames * FRAME,
                ease: "Sine.easeInOut",
            });
            try {
                for (let i = 0; i < 5; i += 1) {
                    await squeeze(0.06 + i * 0.01, 2);
                    await squeeze(0, 2);
                }
                for (let i = 0; i < 2; i += 1) {
                    await squeeze(0.14, 6);
                    await squeeze(0, 6);
                }
            } finally {
                target.setScale(baseX, baseY);
            }
        },

        // armips/move/move_anim/444.s: four addparticle calls, at emitter
        // indices 2, 3, 1 and 0 -- four stones, not one -- then wait 25 while
        // they stand, and only after that callfunction 36's shake: two knocks
        // of six pixels against the 264 target marker. The stones break the
        // ground and hold there before anything is struck, and that pause is
        // the move. Archive 462's 30x30 stone is drawn art on normal blend and
        // keeps its own khaki; the streak and glow are additive.
        stoneedge: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const stoneKey = "dsp-stoneedge-0";
            if (!scene.textures.exists(stoneKey)) throw new Error("Stone Edge's art is not staged");
            const streakKey = scene.textures.exists("dsp-stoneedge-1") ? "dsp-stoneedge-1" : null;
            const glowKey = scene.textures.exists("dsp-stoneedge-2") ? "dsp-stoneedge-2" : null;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const stones = [];
            // Where the four break the ground, around the target's feet.
            const SPOTS = [[-46, 22], [42, 28], [-22, 36], [30, 14]];
            const raise = async (index) => {
                const [dx, dy] = SPOTS[index];
                const x = to.x + dx;
                const ground = to.y + dy;
                // They are added in sequence, not together.
                await delay(index * 4 * FRAME);
                const jobs = [];
                if (glowKey) {
                    const glow = scene.add.image(x, ground, glowKey)
                        .setDepth(45).setScale(0.7).setAlpha(0.85)
                        .setTint(0xebd046).setBlendMode(Phaser.BlendModes.ADD);
                    glow.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(glow);
                    jobs.push(scene.tween({ targets: glow, scaleX: 1.9, scaleY: 1.0,
                        alpha: 0, duration: 16 * FRAME, ease: "Quad.easeOut" }));
                }
                if (streakKey) {
                    const streak = scene.add.image(x, ground + 8, streakKey)
                        .setDepth(45).setScale(1.6, 3.0).setAlpha(0.8)
                        .setTint(0xebd046).setBlendMode(Phaser.BlendModes.ADD);
                    streak.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(streak);
                    jobs.push(scene.tween({ targets: streak, y: ground - 24, alpha: 0,
                        duration: 13 * FRAME, ease: "Quad.easeOut" }));
                }
                // The stone: drawn art, its own khaki, no additive wash.
                const stone = scene.add.image(x, ground + 26, stoneKey)
                    .setDepth(46).setScale(2.0)
                    .setAngle(index % 2 ? 14 : -11).setTint(0xb6a136);
                stone.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(stone);
                stones.push(stone);
                jobs.push(scene.tween({ targets: stone, y: ground - 30,
                    duration: 9 * FRAME, ease: "Quad.easeOut" }));
                await Promise.all(jobs);
            };
            try {
                await Promise.all([0, 1, 2, 3].map(raise));
                // wait 25: they stand before anything is hit.
                await delay(25 * FRAME);
                // The stones close in. The shake is deliberately NOT written
                // here: callfunction 36 is already parsed into a gesture and
                // played by playGestures, which scales its six DS pixels to
                // fifteen for this stage. Doing it here too gave the target a
                // second, weaker knock trailing the real one.
                await Promise.all(stones.map((stone) => scene.tween({
                    targets: stone, x: to.x, y: to.y, alpha: 0,
                    duration: 8 * FRAME, ease: "Quad.easeIn",
                })));
            } finally {
                // Nothing to restore on the target: this choreography never
                // moves it, so it must not snap it back mid-gesture either.
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/007.s: there is no battler displacement
        // anywhere in this script -- no callfunction 52, no 57 -- so the
        // puncher never travels. The fist is drawn at the target and the move
        // is staged around it: the wash goes up to 12 in 2124 (#631010), three
        // particles land, callfunction 36 knocks the target two pixels, the
        // colour pulses, and the wash comes back down. Archive 38's 22x32
        // piece is the fist and its 31x26 the burst behind it.
        firepunch: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const fistKey = "dsp-firepunch-0";
            if (!scene.textures.exists(fistKey)) throw new Error("Fire Punch's art is not staged");
            const burstKey = scene.textures.exists("dsp-firepunch-1") ? "dsp-firepunch-1" : fistKey;
            const to = scene.effectPoint(targetView);
            const facing = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const wash = punchWash(scene, { envelope: 2124, shade: 2124, depth: 12 });
            const ember = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.95)
                    .setTint(0xeb7f2f).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await wash.in();
                // The fist arrives at the target rather than travelling to it.
                const fist = ember(fistKey, to.x - facing * 30, to.y - 6, 1.5);
                fist.setAngle(facing > 0 ? -14 : 14);
                await scene.tween({ targets: fist, x: to.x - facing * 4,
                    duration: 5 * FRAME, ease: "Quad.easeIn" });
                const jobs = [wash.pulse()];
                jobs.push(scene.tween({ targets: fist, alpha: 0, duration: 9 * FRAME }));
                // Three particles, as the script adds them.
                const burst = ember(burstKey, to.x, to.y, 1.2);
                jobs.push(scene.tween({ targets: burst, scaleX: 2.6, scaleY: 2.6,
                    alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut" }));
                for (let i = 0; i < 4; i += 1) {
                    const flame = ember(burstKey, to.x, to.y, 0.9);
                    jobs.push(scene.tween({
                        targets: flame,
                        x: to.x + ((i % 2) ? 30 : -26), y: to.y - 18 - (i % 3) * 12,
                        alpha: 0, duration: 16 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                await Promise.all(jobs);
                await wash.out();
            } finally {
                wash.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/008.s: the same script as Fire Punch with a
        // different archive, and one number changed -- the wash goes to 8
        // rather than 12, in 32631 (#bddeff). Ice Punch is the palest of the
        // three on purpose. Archive 39 carries an extra 26x26 piece the other
        // two do not, so the shards come in two sizes.
        icepunch: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const fistKey = "dsp-icepunch-0";
            if (!scene.textures.exists(fistKey)) throw new Error("Ice Punch's art is not staged");
            const shardKey = scene.textures.exists("dsp-icepunch-1") ? "dsp-icepunch-1" : fistKey;
            const burstKey = scene.textures.exists("dsp-icepunch-2") ? "dsp-icepunch-2" : shardKey;
            const to = scene.effectPoint(targetView);
            const facing = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const wash = punchWash(scene, { envelope: 32631, shade: 32631, depth: 8 });
            const frost = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.95)
                    .setTint(0x93ebe7).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await wash.in();
                const fist = frost(fistKey, to.x - facing * 30, to.y - 6, 1.5);
                fist.setAngle(facing > 0 ? -14 : 14);
                await scene.tween({ targets: fist, x: to.x - facing * 4,
                    duration: 5 * FRAME, ease: "Quad.easeIn" });
                const jobs = [wash.pulse()];
                jobs.push(scene.tween({ targets: fist, alpha: 0, duration: 9 * FRAME }));
                const burst = frost(burstKey, to.x, to.y, 1.2);
                jobs.push(scene.tween({ targets: burst, scaleX: 2.5, scaleY: 2.5,
                    alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut" }));
                // Shards in the archive's two sizes, thrown outward.
                for (let i = 0; i < 6; i += 1) {
                    const shard = frost(i % 2 ? shardKey : burstKey, to.x, to.y, 0.8);
                    shard.setAngle(i * 57);
                    jobs.push(scene.tween({
                        targets: shard,
                        x: to.x + Math.cos(i * 1.05) * 38,
                        y: to.y + Math.sin(i * 1.05) * 30,
                        alpha: 0, duration: 15 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                await Promise.all(jobs);
                await wash.out();
            } finally {
                wash.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/009.s: the odd one. Its wash colour is 0 --
        // black -- so where Fire and Ice brighten the screen, Thunder Punch
        // DARKENS it, and only the impact pulse carries colour (13311,
        // #ffff63). Archive 40 gives it two 8x30 streaks rather than a fist,
        // which is why the bolts crackle at the target instead of a knuckle
        // landing on it.
        thunderpunch: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const boltKey = "dsp-thunderpunch-0";
            if (!scene.textures.exists(boltKey)) throw new Error("Thunder Punch's art is not staged");
            const boltKey2 = scene.textures.exists("dsp-thunderpunch-1") ? "dsp-thunderpunch-1" : boltKey;
            const burstKey = scene.textures.exists("dsp-thunderpunch-2") ? "dsp-thunderpunch-2" : boltKey;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const wash = punchWash(scene, { envelope: 0, shade: 13311, depth: 12 });
            const spark = (key, x, y, scaleX, scaleY, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scaleX, scaleY).setAlpha(0.95)
                    .setAngle(angle || 0)
                    .setTint(0xebaf0a).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The screen goes down, not up.
                await wash.in();
                const jobs = [wash.pulse()];
                // The two streaks, struck across the target.
                [boltKey, boltKey2].forEach((key, index) => {
                    jobs.push((async () => {
                        await delay(index * 3 * FRAME);
                        const bolt = spark(key, to.x + (index ? 16 : -14), to.y - 24,
                            1.6, 2.2, index ? 18 : -22);
                        await scene.tween({ targets: bolt, y: to.y + 10, alpha: 0,
                            duration: 10 * FRAME, ease: "Quad.easeIn" });
                    })());
                });
                const burst = spark(burstKey, to.x, to.y, 1.2, 1.2, 0);
                jobs.push(scene.tween({ targets: burst, scaleX: 2.6, scaleY: 2.6,
                    alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut" }));
                for (let i = 0; i < 4; i += 1) {
                    const arc = spark(i % 2 ? boltKey2 : boltKey, to.x, to.y, 1.0, 1.4, i * 45 - 68);
                    jobs.push(scene.tween({
                        targets: arc,
                        x: to.x + ((i % 2) ? 32 : -30), y: to.y - 14 + (i % 3) * 16,
                        alpha: 0, duration: 15 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                await Promise.all(jobs);
                await wash.out();
            } finally {
                wash.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/020.s: a loop 2 in which the attacker is
        // driven twenty-four forward and twenty-four back by callfunction 52
        // against its own 258 marker, and on each pass callfunction 42 runs
        // 100, 70, 100, 100, 100 against the target. The squeeze is the move.
        //
        // That call's last argument is 327685, which is 0x00050005 -- a packed
        // pair, not a colour. One script in the set writes the same slot
        // literally as 0x00040004, which is what gives the reading away. It is
        // the frames each step of the percentage list takes: five here, four
        // for Stomp. Which axis the percentage applies to is NOT decoded; a
        // binding narrows, so it narrows here, the same way Constrict does.
        bind: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const puffKey = "dsp-bind-0";
            if (!scene.textures.exists(puffKey)) throw new Error("Bind's art is not staged");
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const target = targetView.sprite;
            const homeX = actor.x;
            const baseX = target.scaleX;
            const baseY = target.scaleY;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const coil = (x, y, scale) => {
                const sprite = scene.add.image(x, y, puffKey)
                    .setDepth(46).setScale(scale).setAlpha(0.9)
                    .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            // One step of the percentage list, at the script's five frames.
            const scaleTo = (percent) => scene.tween({
                targets: target,
                scaleX: baseX * (percent / 100),
                scaleY: baseY * (2 - percent / 100),
                duration: 5 * FRAME,
                ease: "Sine.easeInOut",
            });
            try {
                // Both emitters land before the loop starts.
                const jobs = [0, 1].map((index) => {
                    const puff = coil(to.x + (index ? 16 : -16), to.y + (index ? 10 : -10), 1.2);
                    return scene.tween({ targets: puff, scaleX: 2.1, scaleY: 2.1, alpha: 0,
                        duration: 20 * FRAME, ease: "Quad.easeOut" });
                });
                for (let round = 0; round < 2; round += 1) {
                    await scene.tween({ targets: actor, x: homeX + facing * 24,
                        duration: 4 * FRAME, ease: "Quad.easeIn" });
                    await scene.tween({ targets: actor, x: homeX,
                        duration: 4 * FRAME, ease: "Quad.easeOut" });
                    await delay(FRAME);                 // the script's wait 1
                    await scaleTo(70);
                    await scaleTo(100);
                }
                await Promise.all(jobs);
            } finally {
                actor.x = homeX;
                target.setScale(baseX, baseY);
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/035.s: Bind's loop with the roles swapped. The
        // attacker never moves -- there is no callfunction 52 here at all --
        // and instead callfunction 60 wags the TARGET while the same
        // 100, 70, 100 squeeze runs against it. Bind drags its victim in; Wrap
        // is already holding it, so only the victim thrashes.
        wrap: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const puffKey = "dsp-wrap-0";
            if (!scene.textures.exists(puffKey)) throw new Error("Wrap's art is not staged");
            const to = scene.effectPoint(targetView);
            const target = targetView.sprite;
            const home = target.x;
            const homeAngle = target.angle || 0;
            const baseX = target.scaleX;
            const baseY = target.scaleY;
            const sprites = [];
            const scaleTo = (percent) => scene.tween({
                targets: target,
                scaleX: baseX * (percent / 100),
                scaleY: baseY * (2 - percent / 100),
                duration: 5 * FRAME,
                ease: "Sine.easeInOut",
            });
            // callfunction 60, the same wag that flails through Thrash.
            const writhe = async () => {
                await scene.tween({ targets: target, x: home - 7, angle: homeAngle - 4, duration: 3 * FRAME });
                await scene.tween({ targets: target, x: home + 7, angle: homeAngle + 4, duration: 6 * FRAME, ease: "Sine.easeInOut" });
                await scene.tween({ targets: target, x: home, angle: homeAngle, duration: 3 * FRAME });
            };
            try {
                for (let round = 0; round < 2; round += 1) {
                    const puff = scene.add.image(to.x, to.y, puffKey)
                        .setDepth(46).setScale(1.3).setAlpha(0.9)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    puff.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(puff);
                    await Promise.all([
                        scene.tween({ targets: puff, scaleX: 2.4, scaleY: 2.4, alpha: 0,
                            duration: 18 * FRAME, ease: "Quad.easeOut" }),
                        writhe(),
                        (async () => { await scaleTo(70); await scaleTo(100); })(),
                    ]);
                }
            } finally {
                target.x = home;
                target.angle = homeAngle;
                target.setScale(baseX, baseY);
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/077.s: the shortest script in this batch and
        // the one that says the most. One emitter, its sound repeated six
        // times, and callfunction 34 pulsing 31764 -- BGR555 for #a500ff, a
        // flat purple. Nothing is thrown and nothing is struck: the powder is
        // released and settles. The six repeats are the sprinkle, so the cloud
        // is built as six drifts rather than one puff.
        poisonpowder: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const cloudKey = "dsp-poisonpowder-0";
            if (!scene.textures.exists(cloudKey)) throw new Error("Poison Powder's art is not staged");
            const moteKey = scene.textures.exists("dsp-poisonpowder-1") ? "dsp-poisonpowder-1" : cloudKey;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xa500ff, 0).setDepth(44);
            const spore = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.9)
                    .setTint(0xeb59e8).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                // Six sprinkles, one per sound repeat, drifting down over it.
                for (let i = 0; i < 6; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 4 * FRAME);
                        const spread = ((i % 3) - 1) * 26;
                        const puff = spore(cloudKey, to.x + spread, to.y - 40, 0.9);
                        await scene.tween({ targets: puff, y: to.y + 12, scaleX: 1.7, scaleY: 1.7,
                            alpha: 0, duration: 26 * FRAME, ease: "Sine.easeIn" });
                    })());
                    jobs.push((async () => {
                        await delay(i * 4 * FRAME + 2 * FRAME);
                        const mote = spore(moteKey, to.x + ((i % 2) ? 20 : -20), to.y - 30, 1.3);
                        await scene.tween({ targets: mote, y: to.y + 20,
                            x: mote.x + ((i % 2) ? 12 : -12),
                            alpha: 0, duration: 24 * FRAME, ease: "Sine.easeIn" });
                    })());
                }
                // callfunction 34, in the colour the script names.
                jobs.push((async () => {
                    await scene.tween({ targets: shade, fillAlpha: 0.16, duration: 10 * FRAME });
                    await scene.tween({ targets: shade, fillAlpha: 0, duration: 10 * FRAME });
                })());
                await Promise.all(jobs);
            } finally {
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/047.s: the same callfunction 33 / 34 pair the
        // elemental punches use, so it borrows punchWash. The screen washes to
        // 12 in 32767 -- BGR555 for pure white -- and the pulse at the end is
        // 23199, which is #ffa5b5. Sing flashes PINK, and that is read off the
        // script rather than chosen because the move is pretty.
        //
        // The sound is playsepanmod 1935, -117, 117: a pan that MODULATES from
        // hard left to hard right while it plays. The notes travel with it,
        // left to right across the field, which is why they are not simply
        // dropped on the target.
        sing: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const glowKey = "dsp-sing-0";
            if (!scene.textures.exists(glowKey)) throw new Error("Sing's art is not staged");
            const noteKeys = ["dsp-sing-1", "dsp-sing-2"].filter((key) => scene.textures.exists(key));
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const wash = punchWash(scene, { envelope: 32767, shade: 23199, depth: 12 });
            const soft = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.92)
                    .setTint(0xffd2e0).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await wash.in();
                const jobs = [];
                // A soft bloom at the singer.
                const bloom = soft(glowKey, from.x, from.y, 0.7);
                jobs.push(scene.tween({ targets: bloom, scaleX: 1.5, scaleY: 1.5, alpha: 0,
                    duration: 30 * FRAME, ease: "Quad.easeOut" }));
                // Three notes, crossing the field the way the pan does.
                for (let i = 0; i < 3 && noteKeys.length; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 7 * FRAME);
                        const lift = ((i % 3) - 1) * 22;
                        const note = soft(noteKeys[i % noteKeys.length], from.x, from.y + lift, 1.3);
                        await Promise.all([
                            scene.tween({ targets: note, x: to.x, y: to.y + lift * 0.6,
                                duration: 30 * FRAME, ease: "Sine.easeInOut" }),
                            (async () => {
                                // A gentle bob on the way across.
                                await scene.tween({ targets: note, angle: 12, duration: 15 * FRAME });
                                await scene.tween({ targets: note, angle: -12, duration: 15 * FRAME });
                            })(),
                        ]);
                        await scene.tween({ targets: note, alpha: 0, duration: 6 * FRAME });
                    })());
                }
                // wait 5, then the pink.
                jobs.push((async () => { await delay(5 * FRAME); await wash.pulse(); })());
                await Promise.all(jobs);
                await wash.out();
            } finally {
                wash.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/048.s: its wash colour is 0. Like Thunder
        // Punch, Supersonic DARKENS the screen instead of brightening it --
        // the second move in the set to do so, and both are named for sound.
        //
        // callfunction 65 is NOT decoded. It appears in Sonic Boom, Psywave,
        // Shadow Ball and Fire Blast as well as here, always with one
        // particle and always with a frame count in the same slot (14 here,
        // 8 to 20 elsewhere), and every one of those moves sends a single
        // thing across the field. Read as a travel time on that evidence,
        // which is a guess with a reason behind it rather than a reading.
        supersonic: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const ringKey = "dsp-supersonic-0";
            if (!scene.textures.exists(ringKey)) throw new Error("Supersonic's art is not staged");
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const wash = punchWash(scene, { envelope: 0, shade: 0, depth: 12 });
            try {
                await wash.in();
                // One ring, crossing in the script's fourteen frames, and
                // widening as it goes the way a sound wave does.
                const wave = scene.add.image(from.x, from.y, ringKey)
                    .setDepth(46).setScale(0.6, 1.0).setAlpha(0.95)
                    .setTint(0xc9b6f5).setBlendMode(Phaser.BlendModes.ADD);
                wave.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(wave);
                await scene.tween({ targets: wave, x: to.x, y: to.y,
                    scaleX: 1.6, scaleY: 2.4, duration: 14 * FRAME, ease: "Sine.easeIn" });
                // wait 10, then the shake -- which is NOT written here.
                // callfunction 36 is parsed into a gesture and played by
                // playGestures, at two DS pixels scaled to five.
                const jobs = [scene.tween({ targets: wave, scaleX: 2.6, scaleY: 3.2,
                    alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut" })];
                for (let i = 0; i < 3; i += 1) {
                    const echo = scene.add.image(to.x, to.y, ringKey)
                        .setDepth(45).setScale(0.9, 1.4).setAlpha(0.7)
                        .setTint(0xc9b6f5).setBlendMode(Phaser.BlendModes.ADD);
                    echo.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(echo);
                    jobs.push((async () => {
                        await delay(i * 4 * FRAME);
                        await scene.tween({ targets: echo, scaleX: 2.2 + i * 0.4, scaleY: 2.8 + i * 0.4,
                            alpha: 0, duration: 16 * FRAME, ease: "Quad.easeOut" });
                    })());
                }
                await Promise.all(jobs);
                await wash.out();
            } finally {
                wash.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/103.s: no wash, no shake, no particles thrown
        // at anything -- the target is SHOVED, and the shoves are the move.
        // Three callfunction 52 calls against the 264 target marker: eight
        // forward over eight frames, sixteen back over sixteen, eight forward
        // again. Each is followed by a wait of exactly its own duration, which
        // is what settles the shape of that call: 52, count, FRAMES, DISTANCE,
        // marker. Net displacement is zero; the target is rocked and left
        // where it stood. The sound is panned hard left and never moves.
        screech: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const ringKey = "dsp-screech-0";
            if (!scene.textures.exists(ringKey)) throw new Error("Screech's art is not staged");
            const streakKey = scene.textures.exists("dsp-screech-1") ? "dsp-screech-1" : null;
            const to = scene.effectPoint(targetView);
            const target = targetView.sprite;
            const home = target.x;
            const away = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const shrill = (key, x, y, scaleX, scaleY) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scaleX, scaleY).setAlpha(0.9)
                    .setTint(0xd8e8f0).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            // One callfunction 52: travel `distance` over `frames`, then hold
            // for the wait the script pairs with it.
            const shove = async (frames, distance) => {
                await scene.tween({ targets: target, x: home + away * distance,
                    duration: frames * FRAME, ease: "Sine.easeInOut" });
                await delay(frames * FRAME);
            };
            try {
                const jobs = [];
                // Both emitters, up front, before the wait 15.
                [0, 1].forEach((index) => {
                    const ring = shrill(ringKey, to.x, to.y, 0.8, 0.8);
                    jobs.push((async () => {
                        await delay(index * 5 * FRAME);
                        await scene.tween({ targets: ring, scaleX: 2.4, scaleY: 2.4, alpha: 0,
                            duration: 22 * FRAME, ease: "Quad.easeOut" });
                    })());
                });
                for (let i = 0; i < 5 && streakKey; i += 1) {
                    const streak = shrill(streakKey, to.x, to.y, 1.4, 2.0);
                    streak.setAngle(i * 72);
                    jobs.push((async () => {
                        await delay(6 * FRAME);
                        await scene.tween({
                            targets: streak,
                            x: to.x + Math.cos(i * 1.26) * 44,
                            y: to.y + Math.sin(i * 1.26) * 36,
                            alpha: 0, duration: 20 * FRAME, ease: "Quad.easeOut",
                        });
                    })());
                }
                jobs.push((async () => {
                    await delay(15 * FRAME);            // the script's wait 15
                    await shove(8, 8);
                    await shove(16, -16);
                    await shove(8, 8);
                    target.x = home;
                })());
                await Promise.all(jobs);
            } finally {
                target.x = home;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/124.s: the only script so far that loads the
        // SAME archive twice, into particle slots 0 and 1. Slot 0 is thrown --
        // addparticle2 with callfunction 66 over fourteen frames -- and slot 1
        // is not touched until after the wait, when it lands as the splat.
        // One archive doing two jobs, kept apart by which slot it sits in.
        // Its 43x42 piece is drawn art on normal blend and keeps its own
        // purple; the rest are additive glow. The pulse is 31764, #a500ff,
        // the same purple Poison Powder uses.
        sludge: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const blobKey = "dsp-sludge-0";
            if (!scene.textures.exists(blobKey)) throw new Error("Sludge's art is not staged");
            const glowKey = scene.textures.exists("dsp-sludge-1") ? "dsp-sludge-1" : blobKey;
            const dropKey = scene.textures.exists("dsp-sludge-2") ? "dsp-sludge-2" : glowKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xa500ff, 0).setDepth(44);
            const ooze = (key, x, y, scale, drawn) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(drawn ? 1 : 0.9)
                    .setTint(drawn ? 0xb444b2 : 0xeb59e8);
                if (!drawn) sprite.setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // Slot 0: the blob crossing, in the script's fourteen frames.
                const blob = ooze(blobKey, from.x, from.y, 0.9, true);
                await Promise.all([
                    scene.tween({ targets: blob, x: to.x, y: to.y,
                        duration: 14 * FRAME, ease: "Quad.easeIn" }),
                    scene.tween({ targets: blob, angle: 220, duration: 14 * FRAME }),
                ]);
                await delay(10 * FRAME);            // the script's wait 10
                blob.setVisible(false);
                // Slot 1: the splat, and the purple over it.
                const jobs = [];
                const splat = ooze(glowKey, to.x, to.y, 1.1, false);
                jobs.push(scene.tween({ targets: splat, scaleX: 2.6, scaleY: 2.2, alpha: 0,
                    duration: 18 * FRAME, ease: "Quad.easeOut" }));
                for (let i = 0; i < 6; i += 1) {
                    const drop = ooze(dropKey, to.x, to.y, 0.8, false);
                    jobs.push(scene.tween({
                        targets: drop,
                        x: to.x + Math.cos(i * 1.05) * 42,
                        y: to.y + Math.abs(Math.sin(i * 1.05)) * 34,
                        alpha: 0, duration: 20 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                jobs.push((async () => {
                    await scene.tween({ targets: shade, fillAlpha: 0.18, duration: 5 * FRAME });
                    await scene.tween({ targets: shade, fillAlpha: 0, duration: 10 * FRAME });
                })());
                await Promise.all(jobs);
            } finally {
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/051.s: the first script here that hits BOTH
        // foes, and it says so twice. Its two callfunction 36 gestures name
        // different markers -- 264 for the target it was aimed at, then 272,
        // which the extraction already maps to targetSide. Neither is written
        // in this choreography: playGestures reads them and shakes every
        // visible Pokemon on that side, so Acid rocks both opponents in a
        // double battle without this file knowing how many there are.
        //
        // The two callfunction 34 pulses are the same purple as Sludge, five
        // frames apart, wrapped around the splash going out.
        acid: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const splashKey = "dsp-acid-0";
            if (!scene.textures.exists(splashKey)) throw new Error("Acid's art is not staged");
            const dropKey = scene.textures.exists("dsp-acid-1") ? "dsp-acid-1" : splashKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xa500ff, 0).setDepth(44);
            // Visibility rework: all-additive Acid measured ZERO added
            // local contrast at its own impact point. Cores are normal
            // blend now, outlines intact, with a soft additive sheen
            // behind each; the purple washes stay as they were.
            const acidic = (key, x, y, scale) => {
                const halo = scene.add.image(0, 0, key)
                    .setScale(1.7).setAlpha(0.5)
                    .setTint(0xf7a6f2).setBlendMode(Phaser.BlendModes.ADD);
                halo.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                const core = scene.add.image(0, 0, key).setTint(0xc93ec4);
                core.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                // A container, so every tween a call site runs on the piece
                // moves, scales and fades the halo with the core.
                const piece = scene.add.container(x, y, [halo, core])
                    .setDepth(46).setScale(scale);
                sprites.push(piece);
                return piece;
            };
            const pulse = async (peak) => {
                await scene.tween({ targets: shade, fillAlpha: peak, duration: 5 * FRAME });
                await scene.tween({ targets: shade, fillAlpha: 0, duration: 10 * FRAME });
            };
            try {
                // The spray crossing, over the script's eight frames.
                const spray = acidic(dropKey, from.x, from.y, 1.4);
                await scene.tween({ targets: spray, x: to.x, y: to.y,
                    duration: 8 * FRAME, ease: "Quad.easeIn" });
                spray.setVisible(false);
                const jobs = [pulse(0.16)];
                // Three more emitters: the splash going outward.
                const splash = acidic(splashKey, to.x, to.y, 1.2);
                jobs.push(scene.tween({ targets: splash, scaleX: 2.4, scaleY: 2.2, alpha: 0,
                    duration: 18 * FRAME, ease: "Quad.easeOut" }));
                for (let i = 0; i < 7; i += 1) {
                    jobs.push((async () => {
                        await delay(4 * FRAME);
                        const drop = acidic(dropKey, to.x, to.y, 1.25);
                        await scene.tween({
                            targets: drop,
                            x: to.x + Math.cos(i * 0.9) * 50,
                            y: to.y + Math.sin(i * 0.9) * 38,
                            alpha: 0, duration: 20 * FRAME, ease: "Quad.easeOut",
                        });
                    })());
                }
                // The second pulse, after the splash is out.
                jobs.push((async () => { await delay(14 * FRAME); await pulse(0.13); })());
                await Promise.all(jobs);
            } finally {
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/123.s: four lines of work and one of them is
        // the whole character of the move. One emitter, its sound three times,
        // two wait 10s -- and then callfunction 34 pulses colour 0. Smog
        // DARKENS the screen, which is the third move in the set to do it and
        // the only one where the colour is the point rather than a side
        // effect: the cloud is what dims the field. Nothing is thrown and
        // nothing is struck.
        smog: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const cloudKey = "dsp-smog-0";
            if (!scene.textures.exists(cloudKey)) throw new Error("Smog's art is not staged");
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const gloom = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(44);
            const fume = (x, y, scale) => {
                const sprite = scene.add.image(x, y, cloudKey)
                    .setDepth(46).setScale(scale).setAlpha(0.8)
                    .setTint(0xa86ea6).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                // The cloud boiling up over the target across the twenty
                // frames the two waits give it.
                for (let i = 0; i < 8; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 3 * FRAME);
                        const puff = fume(to.x + ((i % 4) - 1.5) * 22, to.y + 16, 0.7);
                        await scene.tween({
                            targets: puff,
                            y: to.y - 18 - (i % 3) * 10,
                            scaleX: 1.9, scaleY: 1.9, alpha: 0,
                            duration: 30 * FRAME, ease: "Sine.easeOut",
                        });
                    })());
                }
                // Colour 0: the field goes down, not up.
                jobs.push((async () => {
                    await delay(20 * FRAME);        // the two wait 10s
                    await scene.tween({ targets: gloom, fillAlpha: 0.22, duration: 10 * FRAME });
                    await scene.tween({ targets: gloom, fillAlpha: 0, duration: 12 * FRAME });
                })());
                await Promise.all(jobs);
            } finally {
                gloom.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/060.s: its loop is Screech's, verbatim --
        // eight forward over eight frames, sixteen back over sixteen, eight
        // forward again, each followed by a wait of its own length -- except
        // that Screech runs it once and Psybeam runs it TWICE. Two scripts
        // sharing a shove and differing only in the loop count is as clean a
        // confirmation of that call's shape as the set is going to give.
        // The pulse is 31764, #a500ff, though archive 91's own art is pink.
        psybeam: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const beamKey = "dsp-psybeam-0";
            if (!scene.textures.exists(beamKey)) throw new Error("Psybeam's art is not staged");
            const secondKey = scene.textures.exists("dsp-psybeam-1") ? "dsp-psybeam-1" : beamKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const target = targetView.sprite;
            const home = target.x;
            const away = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xa500ff, 0).setDepth(44);
            const psychic = (key, x, y, scale, tint) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.85)
                    .setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            // The same call Screech uses, with the wait the script pairs to it.
            const shove = async (frames, distance) => {
                await scene.tween({ targets: target, x: home + away * distance,
                    duration: frames * FRAME, ease: "Sine.easeInOut" });
                await delay(frames * FRAME);
            };
            try {
                const jobs = [];
                // The beam: motes chained along the line, pink as the art is.
                for (let i = 0; i < 14; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 3 * FRAME);
                        const wobble = ((i % 3) - 1) * 9;
                        const bead = psychic(i % 2 ? beamKey : secondKey,
                            from.x, from.y + wobble, 0.5, i % 3 ? 0xeb507f : 0xc98ceb);
                        await scene.tween({ targets: bead, x: to.x, y: to.y + wobble * 0.5,
                            duration: 14 * FRAME, ease: "Sine.easeIn" });
                        await scene.tween({ targets: bead, scaleX: 0.9, scaleY: 0.9,
                            alpha: 0, duration: 6 * FRAME });
                    })());
                }
                jobs.push((async () => {
                    await scene.tween({ targets: shade, fillAlpha: 0.15, duration: 8 * FRAME });
                    await scene.tween({ targets: shade, fillAlpha: 0, duration: 10 * FRAME });
                })());
                // loop 2, where Screech has loop 1.
                jobs.push((async () => {
                    for (let round = 0; round < 2; round += 1) {
                        await shove(8, 8);
                        await shove(16, -16);
                        await shove(8, 8);
                    }
                    target.x = home;
                })());
                await Promise.all(jobs);
            } finally {
                target.x = home;
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/101.s: the only script in the set with NO
        // loadparticle at all. Night Shade throws nothing and draws nothing --
        // the whole move is the screen going to 0, two sounds sixteen frames
        // apart panned hard left then hard right, and the screen coming back.
        // Its own archive is unmapped for the same reason, so this is the
        // first choreography with no art to depend on.
        //
        // callfunction 17 and 18 are NOT decoded, and unlike every other
        // unknown so far there is nothing to cross-reference: they appear in
        // this one script and nowhere else in the set. What can be said is
        // structural -- they are a matched pair wrapped around the wait 16, in
        // a script that has no particles to start or stop. A begin/end pair
        // with no particles left to govern is most likely the battler's own
        // drawing, so the target is taken down to a silhouette between them
        // and let back afterwards. That is a reading of the shape, not of the
        // function.
        nightshade: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const target = targetView.sprite;
            const hadTint = target.isTinted;
            const previousTint = target.tintTopLeft;
            const gloom = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(44);
            try {
                // callfunction 33: the field goes down.
                await scene.tween({ targets: gloom, fillAlpha: 0.34, duration: 10 * FRAME });
                // callfunction 17: the shade falls on it.
                await scene.tween({
                    targets: { value: 1 }, value: 0, duration: 4 * FRAME,
                    onUpdate: (tween, holder) => {
                        const level = Math.round(0x33 + holder.value * 0xcc);
                        target.setTint((level << 16) | (level << 8) | level);
                    },
                });
                await delay(16 * FRAME);            // the script's wait 16
                // callfunction 18: and lifts.
                await scene.tween({
                    targets: { value: 0 }, value: 1, duration: 6 * FRAME,
                    onUpdate: (tween, holder) => {
                        const level = Math.round(0x33 + holder.value * 0xcc);
                        target.setTint((level << 16) | (level << 8) | level);
                    },
                });
                if (hadTint) target.setTint(previousTint); else target.clearTint();
                await scene.tween({ targets: gloom, fillAlpha: 0, duration: 12 * FRAME });
            } finally {
                if (hadTint) target.setTint(previousTint); else target.clearTint();
                gloom.destroy();
            }
        },

        // armips/move/move_anim/109.s: Sludge's trick again -- one archive
        // loaded into two particle slots -- but used the other way round.
        // Sludge throws slot 0 and lands slot 1; Confuse Ray sends slot 0 out
        // and then, six frames later, opens slot 1 on top of it. The screen
        // washes to 0 for the whole thing, so the ray is the only bright
        // object on a darkened field, which is the point of it.
        confuseray: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const orbKey = "dsp-confuseray-0";
            if (!scene.textures.exists(orbKey)) throw new Error("Confuse Ray's art is not staged");
            const moteKey = scene.textures.exists("dsp-confuseray-1") ? "dsp-confuseray-1" : orbKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const gloom = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(44);
            const eerie = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.95)
                    .setTint(0xb387eb).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await scene.tween({ targets: gloom, fillAlpha: 0.3, duration: 8 * FRAME });
                const jobs = [];
                // Slot 0: the ray drifting across, wandering as it goes.
                const orb = eerie(orbKey, from.x, from.y, 1.0);
                jobs.push((async () => {
                    await scene.tween({ targets: orb, x: (from.x + to.x) / 2, y: to.y - 44,
                        duration: 16 * FRAME, ease: "Sine.easeInOut" });
                    await scene.tween({ targets: orb, x: to.x, y: to.y,
                        duration: 14 * FRAME, ease: "Sine.easeInOut" });
                    await scene.tween({ targets: orb, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                        duration: 12 * FRAME, ease: "Quad.easeOut" });
                })());
                // Slot 1, six frames behind it: the motes circling the target.
                jobs.push((async () => {
                    await delay(6 * FRAME);
                    const inner = [];
                    for (let i = 0; i < 7; i += 1) {
                        inner.push((async () => {
                            await delay(i * 4 * FRAME);
                            const angle = i * (Math.PI * 2 / 7);
                            const mote = eerie(moteKey, to.x, to.y, 1.2);
                            await scene.tween({
                                targets: mote,
                                x: to.x + Math.cos(angle) * 46,
                                y: to.y + Math.sin(angle) * 30,
                                alpha: 0, duration: 22 * FRAME, ease: "Sine.easeOut",
                            });
                        })());
                    }
                    await Promise.all(inner);
                })());
                await Promise.all(jobs);
                await scene.tween({ targets: gloom, fillAlpha: 0, duration: 10 * FRAME });
            } finally {
                gloom.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/125.s: no callfunction 66 and no displacement,
        // so the club never travels and the user never steps -- the bone is
        // drawn AT the target, the same staging the elemental punches use.
        // Three emitters land together, three frames pass, and the shake is
        // left to callfunction 36. Archive 150's 32x12 piece is drawn art on
        // normal blend and keeps its own bone colour; the role pass tagged it
        // a streak, which for once means a literal object rather than a glow.
        boneclub: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const boneKey = "dsp-boneclub-0";
            if (!scene.textures.exists(boneKey)) throw new Error("Bone Club's art is not staged");
            const ringKey = scene.textures.exists("dsp-boneclub-1") ? "dsp-boneclub-1" : null;
            const sparkKey = scene.textures.exists("dsp-boneclub-2") ? "dsp-boneclub-2" : ringKey;
            const to = scene.effectPoint(targetView);
            const facing = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const glow = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.92)
                    .setTint(0xebc669).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The club swinging down onto it, drawn art, own colour.
                const bone = scene.add.image(to.x - facing * 34, to.y - 54, boneKey)
                    .setDepth(46).setScale(2.2).setAngle(facing > 0 ? -70 : 70).setTint(0xb49850);
                bone.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(bone);
                await Promise.all([
                    scene.tween({ targets: bone, x: to.x, y: to.y - 6,
                        duration: 7 * FRAME, ease: "Quad.easeIn" }),
                    scene.tween({ targets: bone, angle: facing > 0 ? 20 : -20,
                        duration: 7 * FRAME, ease: "Quad.easeIn" }),
                ]);
                await delay(3 * FRAME);             // the script's wait 3
                const jobs = [scene.tween({ targets: bone, alpha: 0, duration: 10 * FRAME })];
                if (ringKey) {
                    const ring = glow(ringKey, to.x, to.y - 4, 0.9);
                    jobs.push(scene.tween({ targets: ring, scaleX: 2.4, scaleY: 2.4, alpha: 0,
                        duration: 14 * FRAME, ease: "Quad.easeOut" }));
                }
                for (let i = 0; i < 4 && sparkKey; i += 1) {
                    const spark = glow(sparkKey, to.x, to.y - 4, 1.2);
                    jobs.push(scene.tween({
                        targets: spark,
                        x: to.x + ((i % 2) ? 30 : -26), y: to.y - 20 + (i % 3) * 18,
                        alpha: 0, duration: 15 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/121.s: the third script to load one archive
        // into two slots, and the plainest use of it -- slot 0 is the egg,
        // thrown over callfunction 66's ten frames, and the three emitters
        // that follow the wait are what is left of it. Its shake asks for
        // times 2 rather than the usual 1, so the target is rocked twice; that
        // is callfunction 36's business and is not written here. Archive 146's
        // 20x23 egg is drawn art with no tint of its own, so it is left
        // exactly as the ROM drew it.
        eggbomb: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const eggKey = "dsp-eggbomb-0";
            if (!scene.textures.exists(eggKey)) throw new Error("Egg Bomb's art is not staged");
            const slabKey = scene.textures.exists("dsp-eggbomb-1") ? "dsp-eggbomb-1" : null;
            const burstKey = scene.textures.exists("dsp-eggbomb-2") ? "dsp-eggbomb-2" : slabKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            try {
                // Slot 0: the egg, arcing over in ten frames.
                const egg = scene.add.image(from.x, from.y, eggKey)
                    .setDepth(46).setScale(1.6);
                egg.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(egg);
                await Promise.all([
                    scene.tween({ targets: egg, x: to.x, duration: 10 * FRAME, ease: "Linear" }),
                    (async () => {
                        await scene.tween({ targets: egg, y: Math.min(from.y, to.y) - 54,
                            duration: 5 * FRAME, ease: "Quad.easeOut" });
                        await scene.tween({ targets: egg, y: to.y,
                            duration: 5 * FRAME, ease: "Quad.easeIn" });
                    })(),
                    scene.tween({ targets: egg, angle: 300, duration: 10 * FRAME }),
                ]);
                await delay(10 * FRAME);            // the script's wait 8 then 2
                egg.setVisible(false);
                // The three emitters left of it.
                const jobs = [];
                if (slabKey) {
                    const slab = scene.add.image(to.x, to.y, slabKey)
                        .setDepth(46).setScale(1.0).setAlpha(0.95).setTint(0xb4b383);
                    slab.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(slab);
                    jobs.push(scene.tween({ targets: slab, scaleX: 2.0, scaleY: 2.0, alpha: 0,
                        duration: 16 * FRAME, ease: "Quad.easeOut" }));
                }
                for (let i = 0; i < 8 && burstKey; i += 1) {
                    const shell = scene.add.image(to.x, to.y, burstKey)
                        .setDepth(47).setScale(1.1).setAlpha(0.9)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    shell.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(shell);
                    const angle = i * (Math.PI * 2 / 8);
                    jobs.push(scene.tween({
                        targets: shell,
                        x: to.x + Math.cos(angle) * 52, y: to.y + Math.sin(angle) * 40,
                        alpha: 0, duration: 17 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/140.s: the first move here to shake the CAMERA
        // rather than a battler. callfunction 68 turns up in fifty-one scripts
        // -- Explosion, Self-Destruct, Fissure, Hyper Beam, Thunder, all the
        // moves that rattle the screen in the games -- and the extraction
        // already reads it as shakeScreen, so neither that nor the target's
        // own callfunction 36 is written here. Both are gestures and both are
        // played for us.
        //
        // Worth knowing: the extraction keeps only that a screen shake
        // happened, not its arguments. The scripts distinguish 0,5 from 5,0
        // from 4,4 -- vertical, horizontal and both -- over durations from 3
        // to 20, and all of that currently collapses into one fixed shake.
        barrage: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const ballKey = "dsp-barrage-0";
            if (!scene.textures.exists(ballKey)) throw new Error("Barrage's art is not staged");
            const ringKey = scene.textures.exists("dsp-barrage-1") ? "dsp-barrage-1" : null;
            const sparkKey = scene.textures.exists("dsp-barrage-2") ? "dsp-barrage-2" : ringKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            try {
                // The ball, over callfunction 66's fifteen frames.
                const ball = scene.add.image(from.x, from.y, ballKey)
                    .setDepth(46).setScale(1.0).setTint(0xb4b383);
                ball.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(ball);
                await Promise.all([
                    scene.tween({ targets: ball, x: to.x, duration: 15 * FRAME, ease: "Linear" }),
                    (async () => {
                        await scene.tween({ targets: ball, y: Math.min(from.y, to.y) - 40,
                            duration: 8 * FRAME, ease: "Quad.easeOut" });
                        await scene.tween({ targets: ball, y: to.y,
                            duration: 7 * FRAME, ease: "Quad.easeIn" });
                    })(),
                    scene.tween({ targets: ball, angle: 360, duration: 15 * FRAME }),
                ]);
                ball.setVisible(false);
                // The two emitters that came with it.
                const jobs = [];
                if (ringKey) {
                    const ring = scene.add.image(to.x, to.y, ringKey)
                        .setDepth(47).setScale(0.9).setAlpha(0.92)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    ring.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(ring);
                    jobs.push(scene.tween({ targets: ring, scaleX: 2.5, scaleY: 2.5, alpha: 0,
                        duration: 15 * FRAME, ease: "Quad.easeOut" }));
                }
                for (let i = 0; i < 5 && sparkKey; i += 1) {
                    const spark = scene.add.image(to.x, to.y, sparkKey)
                        .setDepth(47).setScale(1.3).setAlpha(0.88)
                        .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                    spark.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(spark);
                    jobs.push(scene.tween({
                        targets: spark,
                        x: to.x + ((i % 3) - 1) * 34, y: to.y - 18 + (i % 2) * 32,
                        alpha: 0, duration: 16 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/158.s: the first script here that replaces the
        // BACKGROUND. changebg 58 swaps the whole backdrop out, the move plays
        // against it, and resetbg puts the field back. That is not implemented
        // and cannot be faked honestly -- backdrop 58 is a ROM asset nothing in
        // this project extracts. It is not a one-off either: 108 scripts call
        // changebg. What is left is what the rest of the script says -- four
        // emitters landing together and callfunction 36 asking for times 2 --
        // and archive 179's 20x45 piece is the fang, so the bite is two of
        // them closing rather than a generic flash.
        hyperfang: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const fangKey = "dsp-hyperfang-0";
            if (!scene.textures.exists(fangKey)) throw new Error("Hyper Fang's art is not staged");
            const speckKey = scene.textures.exists("dsp-hyperfang-1") ? "dsp-hyperfang-1" : null;
            const ringKey = scene.textures.exists("dsp-hyperfang-2") ? "dsp-hyperfang-2" : speckKey;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const pale = (key, x, y, scaleX, scaleY, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scaleX, scaleY).setAlpha(0.93).setAngle(angle || 0)
                    .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await delay(10 * FRAME);            // the script's wait 10
                const jobs = [];
                // Two fangs closing on it, from above and below.
                [-1, 1].forEach((side) => {
                    const fang = pale(fangKey, to.x, to.y + side * 52, 1.3, 1.3, side > 0 ? 180 : 0);
                    jobs.push(scene.tween({ targets: fang, y: to.y + side * 12,
                        duration: 8 * FRAME, ease: "Quad.easeIn" }));
                    jobs.push(scene.tween({ targets: fang, alpha: 0,
                        duration: 8 * FRAME, delay: 9 * FRAME }));
                });
                if (ringKey) {
                    const ring = pale(ringKey, to.x, to.y, 0.9, 0.9, 0);
                    jobs.push((async () => {
                        await delay(6 * FRAME);
                        await scene.tween({ targets: ring, scaleX: 2.3, scaleY: 2.3, alpha: 0,
                            duration: 14 * FRAME, ease: "Quad.easeOut" });
                    })());
                }
                for (let i = 0; i < 5 && speckKey; i += 1) {
                    const speck = pale(speckKey, to.x, to.y, 1.5, 1.5, 0);
                    jobs.push((async () => {
                        await delay(7 * FRAME);
                        await scene.tween({
                            targets: speck,
                            x: to.x + ((i % 3) - 1) * 32, y: to.y - 16 + (i % 2) * 30,
                            alpha: 0, duration: 15 * FRAME, ease: "Quad.easeOut",
                        });
                    })());
                }
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/152.s: three emitters wrapped in a callfunction
        // 33 that goes up to 8 and straight back down in 49930 -- BGR555 for
        // #52c584, a sea green. The unusual part is its callfunction 36: the
        // times argument is 0, and the extractor only emits a shake when times
        // is above zero, so NOTHING rocks the target here. That is deliberate
        // rather than an oversight, and no shake is written by hand to cover
        // it. Rock Throw's script does the same thing.
        crabhammer: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const clawKey = "dsp-crabhammer-0";
            if (!scene.textures.exists(clawKey)) throw new Error("Crabhammer's art is not staged");
            const burstKey = scene.textures.exists("dsp-crabhammer-1") ? "dsp-crabhammer-1" : clawKey;
            const dropKey = scene.textures.exists("dsp-crabhammer-2") ? "dsp-crabhammer-2" : burstKey;
            const to = scene.effectPoint(targetView);
            const facing = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const wash = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x52c584, 0).setDepth(43);
            const sea = (key, x, y, scale, tint) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.92)
                    .setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                // The claw coming down.
                const claw = sea(clawKey, to.x - facing * 30, to.y - 44, 1.4, 0xbfe8ff);
                jobs.push((async () => {
                    await scene.tween({ targets: claw, x: to.x, y: to.y - 4,
                        duration: 7 * FRAME, ease: "Quad.easeIn" });
                    await scene.tween({ targets: claw, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                        duration: 12 * FRAME, ease: "Quad.easeOut" });
                })());
                jobs.push((async () => {
                    await delay(5 * FRAME);
                    const burst = sea(burstKey, to.x, to.y, 1.0, 0xbfe8ff);
                    const inner = [scene.tween({ targets: burst, scaleX: 2.4, scaleY: 2.4,
                        alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut" })];
                    for (let i = 0; i < 6; i += 1) {
                        const drop = sea(dropKey, to.x, to.y, 1.1, 0x618deb);
                        inner.push(scene.tween({
                            targets: drop,
                            x: to.x + Math.cos(i * 1.05) * 46,
                            y: to.y + Math.sin(i * 1.05) * 34,
                            alpha: 0, duration: 16 * FRAME, ease: "Quad.easeOut",
                        }));
                    }
                    await Promise.all(inner);
                })());
                // Up to 8 and straight back down, as the two calls read.
                jobs.push((async () => {
                    await scene.tween({ targets: wash, fillAlpha: 0.14, duration: 6 * FRAME });
                    await scene.tween({ targets: wash, fillAlpha: 0, duration: 10 * FRAME });
                })());
                await Promise.all(jobs);
            } finally {
                wash.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/146.s: two rounds of a straightforward lunge,
        // and the script that pins down callfunction 57. Its arguments run
        // 57, count, FRAMES, DX, DY, marker -- a two-axis displacement, where
        // callfunction 52 carries only one. Reading the set back through that
        // shape, Body Slam's 0,+16 then 0,-16 is a crouch and a leap, and Take
        // Down's -16,+8 then +32,-16 is a wind-up and a charge, which is what
        // both were built as. Here it is 3 frames, +24, 0: straight in, and
        // straight back out again.
        dizzypunch: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const fistKey = "dsp-dizzypunch-0";
            if (!scene.textures.exists(fistKey)) throw new Error("Dizzy Punch's art is not staged");
            const starKey = scene.textures.exists("dsp-dizzypunch-1") ? "dsp-dizzypunch-1" : null;
            const ringKey = scene.textures.exists("dsp-dizzypunch-2") ? "dsp-dizzypunch-2" : starKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            try {
                for (let round = 0; round < 2; round += 1) {
                    await delay(6 * FRAME);         // the script's wait 6
                    // 57: three frames, twenty-four across, nothing vertical.
                    await scene.tween({ targets: actor, x: homeX + facing * 24,
                        duration: 3 * FRAME, ease: "Quad.easeIn" });
                    const jobs = [];
                    // The two emitters at the contact point.
                    const fist = scene.add.image(to.x - facing * 8, to.y, fistKey)
                        .setDepth(46).setScale(1.1).setAlpha(0.95);
                    fist.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(fist);
                    jobs.push(scene.tween({ targets: fist, scaleX: 1.9, scaleY: 1.9,
                        alpha: 0, duration: 13 * FRAME, ease: "Quad.easeOut" }));
                    for (let i = 0; i < 4 && ringKey; i += 1) {
                        const star = scene.add.image(to.x, to.y, i % 2 ? ringKey : (starKey || ringKey))
                            .setDepth(47).setScale(1.2).setAlpha(0.9)
                            .setTint(0xebeaab).setBlendMode(Phaser.BlendModes.ADD);
                        star.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                        sprites.push(star);
                        const angle = i * (Math.PI / 2) + round * 0.6;
                        jobs.push(scene.tween({
                            targets: star,
                            x: to.x + Math.cos(angle) * 38, y: to.y + Math.sin(angle) * 28,
                            alpha: 0, duration: 15 * FRAME, ease: "Quad.easeOut",
                        }));
                    }
                    // And straight back out, the same three frames.
                    jobs.push(scene.tween({ targets: actor, x: homeX,
                        duration: 3 * FRAME, delay: 3 * FRAME, ease: "Quad.easeOut" }));
                    await Promise.all(jobs);
                }
            } finally {
                actor.x = homeX;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/129.s: a spread move that says so in the
        // plainest way in the set -- two callfunction 36 calls back to back,
        // identical but for their marker, 264 then 272. One rocks the Pokemon
        // it was aimed at and the other rocks the whole side. Neither is
        // written here; both are gestures. The wash is 0, so the stars go out
        // over a darkened field.
        swift: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const starKey = "dsp-swift-0";
            if (!scene.textures.exists(starKey)) throw new Error("Swift's art is not staged");
            const moteKey = scene.textures.exists("dsp-swift-1") ? "dsp-swift-1" : starKey;
            const ringKey = scene.textures.exists("dsp-swift-2") ? "dsp-swift-2" : starKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const gloom = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(43);
            const gold = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.95)
                    .setTint(0xf5e79a).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await scene.tween({ targets: gloom, fillAlpha: 0.2, duration: 8 * FRAME });
                const jobs = [];
                // The two headed emitters, then the third with no heading.
                for (let i = 0; i < 6; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 3 * FRAME);
                        const lift = ((i % 3) - 1) * 26;
                        const star = gold(i % 2 ? starKey : moteKey, from.x, from.y + lift, 1.2);
                        await scene.tween({ targets: star, x: to.x, y: to.y + lift * 0.4,
                            duration: 17 * FRAME, ease: "Sine.easeIn" });
                        await scene.tween({ targets: star, scaleX: 1.8, scaleY: 1.8,
                            alpha: 0, duration: 6 * FRAME });
                    })());
                }
                // wait 2 then wait 18: the burst lands at twenty.
                jobs.push((async () => {
                    await delay(20 * FRAME);
                    const ring = gold(ringKey, to.x, to.y, 0.9);
                    await scene.tween({ targets: ring, scaleX: 2.4, scaleY: 2.4, alpha: 0,
                        duration: 14 * FRAME, ease: "Quad.easeOut" });
                })());
                await Promise.all(jobs);
                await scene.tween({ targets: gloom, fillAlpha: 0, duration: 10 * FRAME });
            } finally {
                gloom.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/161.s: the script spells the move out. After a
        // wait 40 it lands THREE separate hits, twenty frames apart, and each
        // one is a different sound (2011, then 2007, then 2055), a different
        // particle index, and its own callfunction 36. Tri Attack is three
        // strikes and the script never pretends otherwise.
        //
        // The three are tinted fire, ice and electric here. That is a CHOICE:
        // the script gives three distinct sounds and three distinct particle
        // indices, which is good evidence the three differ, but it names no
        // colours. The indices it wants are past the three textures staged per
        // move, so the art cannot be exact either.
        triattack: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const boltKey = "dsp-triattack-0";
            if (!scene.textures.exists(boltKey)) throw new Error("Tri Attack's art is not staged");
            const secondKey = scene.textures.exists("dsp-triattack-1") ? "dsp-triattack-1" : boltKey;
            const burstKey = scene.textures.exists("dsp-triattack-2") ? "dsp-triattack-2" : boltKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const gloom = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(43);
            const TINTS = [0xeb7f2f, 0x93ebe7, 0xebd046];   // fire, ice, electric
            const lit = (key, x, y, scaleX, scaleY, tint, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scaleX, scaleY).setAlpha(0.93).setAngle(angle || 0)
                    .setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                await scene.tween({ targets: gloom, fillAlpha: 0.2, duration: 8 * FRAME });
                // The five gathering emitters, over the wait 40.
                const gather = [];
                for (let i = 0; i < 5; i += 1) {
                    gather.push((async () => {
                        await delay(i * 5 * FRAME);
                        const angle = i * (Math.PI * 2 / 5);
                        const mote = lit(secondKey, from.x + Math.cos(angle) * 46,
                            from.y + Math.sin(angle) * 34, 1.0, 1.0, TINTS[i % 3], 0);
                        await scene.tween({ targets: mote, x: from.x, y: from.y,
                            alpha: 0.4, duration: 22 * FRAME, ease: "Sine.easeIn" });
                    })());
                }
                await Promise.all(gather);
                await delay(4 * FRAME);
                // Three hits, twenty frames apart, one per element.
                for (let hit = 0; hit < 3; hit += 1) {
                    if (hit) await delay(20 * FRAME);
                    const tint = TINTS[hit];
                    const bolt = lit(hit === 1 ? secondKey : boltKey, from.x, from.y, 1.3, 1.7, tint, 0);
                    await scene.tween({ targets: bolt, x: to.x, y: to.y,
                        duration: 9 * FRAME, ease: "Quad.easeIn" });
                    bolt.setVisible(false);
                    const burst = lit(burstKey, to.x, to.y, 1.0, 1.0, tint, 0);
                    scene.tween({ targets: burst, scaleX: 2.3, scaleY: 2.3, alpha: 0,
                        duration: 14 * FRAME, ease: "Quad.easeOut" });
                }
                await delay(14 * FRAME);
                await scene.tween({ targets: gloom, fillAlpha: 0, duration: 10 * FRAME });
            } finally {
                gloom.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/049.s: the script is a dispatcher -- jumpifside
        // sends each side to its own body -- and the body settles what
        // callfunction 65 does. Three waves go out, and each time the call's
        // third argument is the SAME INDEX as the addparticle2 immediately
        // above it: 1 then 2 then 3, thirteen frames each. Supersonic's lone
        // 65 carries index 1 against its own addparticle2 0, 1 in exactly the
        // same shape. So 65 binds to the particle just added and gives it a
        // duration, which is what it was read as when Supersonic was written
        // on nothing but a hunch -- three repetitions inside one script and a
        // match across two now stand behind it.
        sonicboom: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const waveKey = "dsp-sonicboom-0";
            if (!scene.textures.exists(waveKey)) throw new Error("Sonic Boom's art is not staged");
            const burstKey = scene.textures.exists("dsp-sonicboom-1") ? "dsp-sonicboom-1" : waveKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const loud = (key, x, y, scaleX, scaleY) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scaleX, scaleY).setAlpha(0.92)
                    .setTint(0xd8e8f0).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                // Three waves, thirteen frames each, four frames apart -- the
                // second and third leave before the first has landed.
                for (let i = 0; i < 3; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 4 * FRAME);
                        const wave = loud(waveKey, from.x, from.y, 0.7, 1.0);
                        await scene.tween({ targets: wave, x: to.x, y: to.y,
                            scaleX: 1.1, scaleY: 1.5,
                            duration: 13 * FRAME, ease: "Linear" });
                        await scene.tween({ targets: wave, scaleX: 1.6, scaleY: 2.0,
                            alpha: 0, duration: 8 * FRAME, ease: "Quad.easeOut" });
                    })());
                }
                // The single addparticle on the target, after the first wave.
                jobs.push((async () => {
                    await delay(17 * FRAME);
                    const burst = loud(burstKey, to.x, to.y, 0.9, 0.9);
                    await scene.tween({ targets: burst, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                        duration: 14 * FRAME, ease: "Quad.easeOut" });
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/065.s: the clearest single thing any script in
        // this set has said. Eight times over, two frames apart, it emits a
        // pair of particles and hands cmd37 mode 4 a direction:
        //
        //     0,+   +,+   +,0   +,-   0,-   -,-   -,0   -,+
        //
        // Eight compass points, forty-five degrees apart, all the way round in
        // order. The component is 4128, which is 1.0 in twelve-four fixed
        // point, so these are unit vectors. Drill Peck SPINS, and the script
        // draws the circle out longhand rather than asking for a rotation.
        //
        // Its shake asks for twelve pixels where most moves ask for two -- the
        // largest in anything built so far, thirty on this stage. That is
        // callfunction 36's business and is not written here.
        //
        // callfunction 9, which opens it, is not decoded: it appears in this
        // script and no other in all of move_anim, so there is nothing to
        // compare it against. It sits between the sound and the wait 18,
        // before a single particle exists.
        drillpeck: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const moteKey = "dsp-drillpeck-0";
            if (!scene.textures.exists(moteKey)) throw new Error("Drill Peck's art is not staged");
            const chipKey = scene.textures.exists("dsp-drillpeck-1") ? "dsp-drillpeck-1" : moteKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const homeX = actor.x;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const violet = (key, x, y, scale) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.95)
                    .setTint(0xa48ceb).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                // The bore in, over the script's wait 18.
                await scene.tween({ targets: actor, x: homeX + facing * 18,
                    duration: 9 * FRAME, ease: "Quad.easeIn" });
                const jobs = [scene.tween({ targets: actor, x: homeX,
                    duration: 14 * FRAME, delay: 12 * FRAME, ease: "Quad.easeOut" })];
                // Eight headings, two frames apart, a pair each -- as written.
                for (let step = 0; step < 8; step += 1) {
                    const degrees = 90 - step * 45;
                    const radians = degrees * Math.PI / 180;
                    for (let pair = 0; pair < 2; pair += 1) {
                        jobs.push((async () => {
                            await delay((step * 2 + pair) * FRAME);
                            const mote = violet(pair ? chipKey : moteKey, to.x, to.y, pair ? 2.4 : 1.6);
                            await scene.tween({
                                targets: mote,
                                x: to.x + Math.cos(radians) * 52,
                                y: to.y - Math.sin(radians) * 40,
                                alpha: 0, duration: 13 * FRAME, ease: "Quad.easeOut",
                            });
                        })());
                    }
                }
                await Promise.all(jobs);
            } finally {
                actor.x = homeX;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/002.s: eleven lines, and nothing in them but
        // three emitters, one shake and two sounds. No travel, no wash, no
        // displacement -- the chop is drawn at the target, the same staging as
        // Bone Club and the elemental punches. Archive 33 is red throughout,
        // and its 38x29 piece is the biggest of the three, so that one is the
        // edge of the hand and the others are what comes off it.
        karatechop: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const chopKey = "dsp-karatechop-0";
            if (!scene.textures.exists(chopKey)) throw new Error("Karate Chop's art is not staged");
            const speckKey = scene.textures.exists("dsp-karatechop-1") ? "dsp-karatechop-1" : chopKey;
            const ringKey = scene.textures.exists("dsp-karatechop-2") ? "dsp-karatechop-2" : chopKey;
            const to = scene.effectPoint(targetView);
            const facing = actorView.position.x < to.x ? 1 : -1;
            const sprites = [];
            const red = (key, x, y, scale, angle) => {
                const sprite = scene.add.image(x, y, key)
                    .setDepth(46).setScale(scale).setAlpha(0.93).setAngle(angle || 0)
                    .setTint(0xeb3830).setBlendMode(Phaser.BlendModes.ADD);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const jobs = [];
                // The edge of the hand coming down across it.
                const chop = red(chopKey, to.x - facing * 20, to.y - 34, 1.5, facing > 0 ? -50 : 50);
                jobs.push((async () => {
                    await scene.tween({ targets: chop, x: to.x + facing * 8, y: to.y + 10,
                        duration: 6 * FRAME, ease: "Quad.easeIn" });
                    await scene.tween({ targets: chop, alpha: 0, duration: 9 * FRAME });
                })());
                jobs.push((async () => {
                    await delay(4 * FRAME);
                    const ring = red(ringKey, to.x, to.y, 0.9, 0);
                    const inner = [scene.tween({ targets: ring, scaleX: 2.3, scaleY: 2.3,
                        alpha: 0, duration: 13 * FRAME, ease: "Quad.easeOut" })];
                    for (let i = 0; i < 5; i += 1) {
                        const speck = red(speckKey, to.x, to.y, 1.6, 0);
                        inner.push(scene.tween({
                            targets: speck,
                            x: to.x + ((i % 3) - 1) * 32, y: to.y - 18 + (i % 2) * 30,
                            alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut",
                        }));
                    }
                    await Promise.all(inner);
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/066.s: no callfunction 36 anywhere, so nothing
        // shakes -- and yet the script is eighty frames long. What fills it is
        // the SOUND. waitse alternates hard left and hard right at 1, 10, 10,
        // 20, 20 and on up to 80: the noise bounces from one side of the field
        // to the other, over and over, which is two Pokemon rolling. Then a
        // loop 5 lands five impacts eight frames apart from a SECOND archive.
        // The move is a tumble and a beating, and the panning is what says so.
        //
        // callfunction 10 opens it twice, with a last argument of 2 then 8. It
        // appears in three scripts in the whole set and is not decoded.
        submission: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const slabKey = "dsp-submission-0";
            if (!scene.textures.exists(slabKey)) throw new Error("Submission's art is not staged");
            const hitKey = scene.textures.exists("dsp-submission-1") ? "dsp-submission-1" : slabKey;
            const speckKey = scene.textures.exists("dsp-submission-2") ? "dsp-submission-2" : hitKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const target = targetView.sprite;
            const actorHome = actor.x;
            const targetHome = target.x;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            try {
                const jobs = [];
                // The grip: the first archive's drawn piece over the target.
                const grip = scene.add.image(to.x - facing * 20, to.y, slabKey)
                    .setDepth(45).setScale(1.2).setAlpha(0.85).setTint(0xc22e28);
                grip.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(grip);
                jobs.push(scene.tween({ targets: grip, scaleX: 1.8, scaleY: 1.8,
                    alpha: 0, duration: 40 * FRAME, ease: "Quad.easeOut" }));
                // The roll. This script commands NO displacement -- no
                // callfunction 52, no 57 -- so nothing here is a decode. What
                // it does have is a sound crossing the field eight times and
                // an undecoded callfunction 10 opening it, and something has to
                // be doing the tumbling. Both battlers rock a little about
                // their OWN positions; neither travels, because the script
                // never says they do.
                jobs.push((async () => {
                    for (let swing = 0; swing < 8; swing += 1) {
                        const side = swing % 2 === 0 ? 1 : -1;
                        await Promise.all([
                            scene.tween({ targets: actor, x: actorHome + side * 10,
                                duration: 5 * FRAME, ease: "Sine.easeInOut" }),
                            scene.tween({ targets: target, x: targetHome - side * 10,
                                duration: 5 * FRAME, ease: "Sine.easeInOut" }),
                        ]);
                    }
                })());
                // loop 5: five impacts, eight frames apart.
                jobs.push((async () => {
                    for (let hit = 0; hit < 5; hit += 1) {
                        await delay(8 * FRAME);
                        const flash = scene.add.image(to.x + ((hit % 3) - 1) * 16,
                            to.y - 10 + (hit % 2) * 18, hit % 2 ? speckKey : hitKey)
                            .setDepth(47).setScale(1.2).setAlpha(0.9)
                            .setTint(0xeb3830).setBlendMode(Phaser.BlendModes.ADD);
                        flash.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                        sprites.push(flash);
                        scene.tween({ targets: flash, scaleX: 2.2, scaleY: 2.2,
                            alpha: 0, duration: 14 * FRAME, ease: "Quad.easeOut" });
                    }
                })());
                await Promise.all(jobs);
            } finally {
                // BOTH of them. The first draft rocked the target and never put
                // it back, which is the same way the gesture player used to
                // leave a Pokemon standing off its mark.
                actor.x = actorHome;
                target.x = targetHome;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // Archive 279's full script (518.s in hg-engine's numbering): the
        // field washes to 0 -- Hex DARKENS, like every sound- and
        // ghost-shaped move before it -- holds twenty frames, then one
        // headed particle drifts to the target over thirty frames and the
        // burst lands. The strike's shake is the parsed gesture. Built
        // normal-blend-first from the start: the eye is a solid piece with
        // an additive aura breathing behind it, because this move was
        // reported invisible in its Showdown dress and the whole point of
        // the rework is that cores read on a bright field.
        hex: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const eyeKey = "dsp-hex-0";
            if (!scene.textures.exists(eyeKey)) throw new Error("Hex's art is not staged");
            const burstKey = scene.textures.exists("dsp-hex-1") ? "dsp-hex-1" : eyeKey;
            const wispKey = scene.textures.exists("dsp-hex-2") ? "dsp-hex-2" : burstKey;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const gloom = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(44);
            const ghostly = (key, x, y, scale) => {
                const halo = scene.add.image(0, 0, key)
                    .setScale(1.8).setAlpha(0.55)
                    .setTint(0xd0b3ff).setBlendMode(Phaser.BlendModes.ADD);
                halo.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                const core = scene.add.image(0, 0, key).setTint(0x8a5fc9);
                core.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                // A container, so every tween a call site runs on the piece
                // moves, scales and fades the halo with the core.
                const piece = scene.add.container(x, y, [halo, core])
                    .setDepth(46).setScale(scale);
                sprites.push(piece);
                return piece;
            };
            try {
                // callfunction 33: down to the script's twelve.
                await scene.tween({ targets: gloom, fillAlpha: 0.28, duration: 10 * FRAME });
                await delay(20 * FRAME);            // the script's wait 20
                // The eye, drifting over in the script's thirty frames.
                const eye = ghostly(eyeKey, from.x, from.y - 20, 1.6);
                await Promise.all([
                    scene.tween({ targets: eye, x: to.x, duration: 30 * FRAME, ease: "Sine.easeInOut" }),
                    (async () => {
                        await scene.tween({ targets: eye, y: to.y - 60, duration: 15 * FRAME, ease: "Sine.easeOut" });
                        await scene.tween({ targets: eye, y: to.y - 10, duration: 15 * FRAME, ease: "Sine.easeIn" });
                    })(),
                ]);
                // The burst, and the eye consumed by it.
                const jobs = [scene.tween({ targets: eye, scaleX: 2.4, scaleY: 2.4,
                    alpha: 0, duration: 8 * FRAME, ease: "Quad.easeOut" })];
                const burst = ghostly(burstKey, to.x, to.y - 10, 1.4);
                jobs.push(scene.tween({ targets: burst, scaleX: 2.6, scaleY: 2.6, alpha: 0,
                    duration: 14 * FRAME, ease: "Quad.easeOut" }));
                for (let i = 0; i < 4; i += 1) {
                    const wisp = ghostly(wispKey, to.x, to.y - 10, 1.0);
                    jobs.push(scene.tween({
                        targets: wisp,
                        x: to.x + Math.cos(i * 1.57 + 0.6) * 44,
                        y: to.y - 10 + Math.sin(i * 1.57 + 0.6) * 34,
                        alpha: 0, duration: 16 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                await Promise.all(jobs);
                await scene.tween({ targets: gloom, fillAlpha: 0, duration: 10 * FRAME });
            } finally {
                gloom.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/044.s: five particles land together -- the
        // two jaw halves and the sparks between them -- the sound two frames
        // later, and the knock at ten through the parsed gesture. The 62x26
        // halves are drawn art; under Showdown's sizing they were crushed to
        // the 36px cap, which is the blur that was reported. Here they bite
        // at 2x, top from above, bottom from below.
        bite: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const topKey = "dsp-bite-0";
            const bottomKey = "dsp-bite-1";
            if (!scene.textures.exists(topKey) || !scene.textures.exists(bottomKey)) {
                throw new Error("Bite's art is not staged");
            }
            const sparkKey = scene.textures.exists("dsp-bite-2") ? "dsp-bite-2" : null;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const jaw = (key, y, flipY) => {
                const sprite = scene.add.image(to.x, y, key)
                    .setDepth(46).setScale(2).setTint(0xb48c70).setFlipY(flipY);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const top = jaw(topKey, to.y - 64, false);
                const bottom = jaw(bottomKey, to.y + 54, true);
                // The snap: both halves close over five frames.
                await Promise.all([
                    scene.tween({ targets: top, y: to.y - 12, duration: 5 * FRAME, ease: "Quad.easeIn" }),
                    scene.tween({ targets: bottom, y: to.y + 12, duration: 5 * FRAME, ease: "Quad.easeIn" }),
                ]);
                const jobs = [];
                for (let i = 0; i < 4 && sparkKey; i += 1) {
                    const spark = scene.add.image(to.x, to.y, sparkKey)
                        .setDepth(47).setScale(1.6).setAlpha(0.95)
                        .setTint(0xebb793).setBlendMode(Phaser.BlendModes.ADD);
                    spark.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(spark);
                    jobs.push(scene.tween({
                        targets: spark,
                        x: to.x + ((i % 2) ? 26 : -26), y: to.y - 14 + (i % 2) * 26,
                        alpha: 0, duration: 12 * FRAME, ease: "Quad.easeOut",
                    }));
                }
                // Held shut through the scripted beat, then released.
                jobs.push((async () => {
                    await delay(8 * FRAME);
                    await Promise.all([
                        scene.tween({ targets: top, alpha: 0, y: to.y - 30, duration: 8 * FRAME }),
                        scene.tween({ targets: bottom, alpha: 0, y: to.y + 30, duration: 8 * FRAME }),
                    ]);
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/305.s: Bite's snap with six particles and the
        // family colour -- callfunction 34 pulses 31764, the same #a500ff
        // every poison move in this set carries. The 5x5 venom specks are the
        // third staged piece, dripping off the closed jaws.
        poisonfang: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const topKey = "dsp-poisonfang-0";
            const bottomKey = "dsp-poisonfang-1";
            if (!scene.textures.exists(topKey) || !scene.textures.exists(bottomKey)) {
                throw new Error("Poison Fang's art is not staged");
            }
            const venomKey = scene.textures.exists("dsp-poisonfang-2") ? "dsp-poisonfang-2" : null;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xa500ff, 0).setDepth(44);
            const jaw = (key, y, flipY) => {
                const sprite = scene.add.image(to.x, y, key)
                    .setDepth(46).setScale(2).setTint(0xb444b2).setFlipY(flipY);
                sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                sprites.push(sprite);
                return sprite;
            };
            try {
                const top = jaw(topKey, to.y - 64, false);
                const bottom = jaw(bottomKey, to.y + 54, true);
                await Promise.all([
                    scene.tween({ targets: top, y: to.y - 12, duration: 5 * FRAME, ease: "Quad.easeIn" }),
                    scene.tween({ targets: bottom, y: to.y + 12, duration: 5 * FRAME, ease: "Quad.easeIn" }),
                ]);
                const jobs = [];
                // The pulse, exactly the family's.
                jobs.push((async () => {
                    await scene.tween({ targets: shade, fillAlpha: 0.16, duration: 5 * FRAME });
                    await scene.tween({ targets: shade, fillAlpha: 0, duration: 12 * FRAME });
                })());
                // Venom dripping off the bite.
                for (let i = 0; i < 6 && venomKey; i += 1) {
                    jobs.push((async () => {
                        await delay(i * 2 * FRAME);
                        const drip = scene.add.image(to.x + ((i % 3) - 1) * 22, to.y, venomKey)
                            .setDepth(47).setScale(3).setAlpha(0.95)
                            .setTint(0xeb59e8).setBlendMode(Phaser.BlendModes.ADD);
                        drip.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                        sprites.push(drip);
                        await scene.tween({ targets: drip, y: to.y + 44, alpha: 0,
                            duration: 16 * FRAME, ease: "Quad.easeIn" });
                    })());
                }
                jobs.push((async () => {
                    await delay(9 * FRAME);
                    await Promise.all([
                        scene.tween({ targets: top, alpha: 0, y: to.y - 30, duration: 8 * FRAME }),
                        scene.tween({ targets: bottom, alpha: 0, y: to.y + 30, duration: 8 * FRAME }),
                    ]);
                })());
                await Promise.all(jobs);
            } finally {
                shade.destroy();
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/136.s: a displacement dance and one burst.
        // The attacker drives in twenty-four and back through its own 258
        // marker; then the TARGET is knocked twenty-four away and returned
        // through 264 -- a knockback callfunction 36 cannot express, so it is
        // choreography's to play, the same contract as Screech's shoves. The
        // burst is the knee landing. Showdown's ghost-white fighting wisps
        // are what this replaces.
        highjumpkick: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const burstKey = "dsp-highjumpkick-0";
            if (!scene.textures.exists(burstKey)) throw new Error("High Jump Kick's art is not staged");
            const flashKey = scene.textures.exists("dsp-highjumpkick-1") ? "dsp-highjumpkick-1" : burstKey;
            const to = scene.effectPoint(targetView);
            const actor = actorView.sprite;
            const target = targetView.sprite;
            const actorHome = actor.x;
            const targetHome = target.x;
            const facing = actor.x < to.x ? 1 : -1;
            const sprites = [];
            const red = (key, scale) => {
                const halo = scene.add.image(0, 0, key)
                    .setScale(1.8).setAlpha(0.6)
                    .setTint(0xff7a66).setBlendMode(Phaser.BlendModes.ADD);
                halo.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                const core = scene.add.image(0, 0, key).setTint(0xeb3830);
                core.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                const piece = scene.add.container(to.x - facing * 6, to.y - 8, [halo, core])
                    .setDepth(46).setScale(scale);
                sprites.push(piece);
                return piece;
            };
            try {
                // In on the knee, three frames as written.
                await scene.tween({ targets: actor, x: actorHome + facing * 24,
                    duration: 3 * FRAME, ease: "Quad.easeIn" });
                const jobs = [scene.tween({ targets: actor, x: actorHome,
                    duration: 3 * FRAME, delay: 2 * FRAME, ease: "Quad.easeOut" })];
                // The knockback the script writes with 52-on-264.
                jobs.push((async () => {
                    await scene.tween({ targets: target, x: targetHome + facing * 24,
                        duration: 3 * FRAME, ease: "Quad.easeOut" });
                    const burst = red(burstKey, 1.8);
                    const flash = red(flashKey, 1.2);
                    await Promise.all([
                        scene.tween({ targets: burst, scaleX: 2.8, scaleY: 2.8, alpha: 0,
                            duration: 12 * FRAME, ease: "Quad.easeOut" }),
                        scene.tween({ targets: flash, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                            duration: 9 * FRAME, ease: "Quad.easeOut" }),
                        scene.tween({ targets: target, x: targetHome,
                            duration: 3 * FRAME, delay: 4 * FRAME, ease: "Quad.easeOut" }),
                    ]);
                })());
                await Promise.all(jobs);
            } finally {
                actor.x = actorHome;
                target.x = targetHome;
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/157.s: three emitters in mode 20 -- the
        // falling mode -- then a double ten-pixel shake on the target AND on
        // the whole side, both parsed as gestures. The stones fall from above
        // the far side and land where the foes stand, which is the complaint
        // this rewrites: dressed by Showdown they read as travelling toward
        // the player. The 43x42 slab and 30x30 stones are drawn art in their
        // own khaki.
        rockslide: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const stoneKey = "dsp-rockslide-0";
            if (!scene.textures.exists(stoneKey)) throw new Error("Rock Slide's art is not staged");
            const slabKey = scene.textures.exists("dsp-rockslide-1") ? "dsp-rockslide-1" : stoneKey;
            const dustKey = scene.textures.exists("dsp-rockslide-2") ? "dsp-rockslide-2" : null;
            const to = scene.effectPoint(targetView);
            const sprites = [];
            // Where the stones land: spread across the target's side.
            const LANDINGS = [-72, -34, 4, 38, 70, -6];
            try {
                const jobs = LANDINGS.map((dx, index) => (async () => {
                    await delay(index * 4 * FRAME);
                    const key = index % 2 ? slabKey : stoneKey;
                    const stone = scene.add.image(to.x + dx, -40, key)
                        .setDepth(46).setScale(index % 2 ? 1.6 : 1.8)
                        .setAngle((index % 3 - 1) * 16).setTint(0xb6a136);
                    stone.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(stone);
                    const ground = to.y + 8 + (index % 3) * 10;
                    // Straight DOWN, ten frames, as the falling mode has it.
                    await scene.tween({ targets: stone, y: ground,
                        duration: 10 * FRAME, ease: "Quad.easeIn" });
                    const inner = [scene.tween({ targets: stone, alpha: 0,
                        duration: 10 * FRAME, delay: 4 * FRAME })];
                    if (dustKey) {
                        const dust = scene.add.image(to.x + dx, ground, dustKey)
                            .setDepth(45).setScale(1.2).setAlpha(0.9)
                            .setTint(0xebd046).setBlendMode(Phaser.BlendModes.ADD);
                        dust.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                        sprites.push(dust);
                        inner.push(scene.tween({ targets: dust, scaleX: 2.4, scaleY: 1.2,
                            alpha: 0, duration: 12 * FRAME, ease: "Quad.easeOut" }));
                    }
                    await Promise.all(inner);
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },

        // armips/move/move_anim/246.s: a charge before the throw. One emitter
        // gathers at the user, ten frames pass, a headed particle drifts out,
        // and only twenty frames later does anything land -- so the stones
        // LIFT around the user, hover, and are flung. More of them and
        // smaller, as asked: seven, none above 1.3x of art that is 24 and 30
        // pixels native, so nothing is stretched into blur.
        ancientpower: async (scene, actorView, targetView) => {
            const FRAME = 1000 / 60;
            const smallKey = "dsp-ancientpower-0";
            if (!scene.textures.exists(smallKey)) throw new Error("Ancient Power's art is not staged");
            const stoneKey = scene.textures.exists("dsp-ancientpower-1") ? "dsp-ancientpower-1" : smallKey;
            const glowKey = scene.textures.exists("dsp-ancientpower-2") ? "dsp-ancientpower-2" : null;
            const from = scene.effectPoint(actorView);
            const to = scene.effectPoint(targetView);
            const sprites = [];
            const STONES = 7;
            try {
                const stones = [];
                // The lift: stones rise from the user's feet into a loose ring.
                const lifts = [];
                for (let i = 0; i < STONES; i += 1) {
                    const angle = i * (Math.PI * 2 / STONES);
                    const stone = scene.add.image(from.x + Math.cos(angle) * 18,
                        from.y + 34, i % 2 ? stoneKey : smallKey)
                        .setDepth(46).setScale(0.9 + (i % 3) * 0.2)
                        .setAngle(i * 47).setTint(0xb6a136).setAlpha(0);
                    stone.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    sprites.push(stone);
                    stones.push(stone);
                    lifts.push((async () => {
                        await delay(i * 3 * FRAME);
                        stone.setAlpha(1);
                        await scene.tween({
                            targets: stone,
                            x: from.x + Math.cos(angle) * 40,
                            y: from.y - 26 - Math.sin(angle) * 18,
                            duration: 12 * FRAME, ease: "Quad.easeOut",
                        });
                    })());
                }
                await Promise.all(lifts);
                // The scripted hover.
                await delay(10 * FRAME);
                // The throw: each stone flung in sequence, two frames apart.
                const jobs = stones.map((stone, index) => (async () => {
                    await delay(index * 2 * FRAME);
                    await scene.tween({ targets: stone, x: to.x, y: to.y - 6 + (index % 3) * 8,
                        duration: 8 * FRAME, ease: "Quad.easeIn" });
                    stone.setVisible(false);
                    if (glowKey) {
                        const pop = scene.add.image(to.x, to.y - 6 + (index % 3) * 8, glowKey)
                            .setDepth(47).setScale(1.4).setAlpha(0.9)
                            .setTint(0xebd046).setBlendMode(Phaser.BlendModes.ADD);
                        pop.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                        sprites.push(pop);
                        await scene.tween({ targets: pop, scaleX: 2.2, scaleY: 2.2,
                            alpha: 0, duration: 9 * FRAME, ease: "Quad.easeOut" });
                    }
                })());
                await Promise.all(jobs);
            } finally {
                sprites.forEach((sprite) => sprite.destroy());
            }
        },
    };

    const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    class PokemonBattleScene extends Phaser.Scene {
        constructor() {
            super({ key: "PokemonBattle" });
            this.slotViews = { player: [], enemy: [] };
            this.slotTeamIndices = { player: [], enemy: [] };
            // Artwork a slot is wearing that is not its own species': a Mega
            // Evolution, or a Transform copy. Keyed by team index.
            this.formSprites = { player: {}, enemy: {} };
            this.visibleBoundsCache = new Map();
            this.platformSurfaceCache = new Map();
            this.playingEvents = false;
            this.captureTargetState = null;
        }

        init(data) {
            const bootstrap = data?.engine ? data : PokemonBattleScene.bootstrap;
            this.engine = bootstrap.engine;
            this.staticPrefix = bootstrap.staticPrefix;
            this.battlefield = bootstrap.battlefield || null;
            this.onReady = bootstrap.onReady;
            this.moveEffects = root.PokemonMoveEffects || null;
            this.fxManifest = bootstrap.fxManifest || { files: {} };
            this.dsParticles = bootstrap.dsParticles || { moves: {} };
            this.intro = bootstrap.intro || null;
            const settings = root.PokemonRogueSettings || {};
            this.idleFrameRate = Phaser.Math.Clamp(Number(settings.idleFrameRate) || 6, 2, 8);
            this.reducedMotion = Boolean(settings.reducedBattleMotion) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        }

        textureKey(side, teamIndex) {
            return `pokemon-${side}-${teamIndex}`;
        }

        idleAnimationKey(side, teamIndex) {
            return `pokemon-${side}-${teamIndex}-idle`;
        }

        spriteUrl(path) {
            if (!path) return "";
            if (/^(?:https?:)?\//.test(path)) return path;
            return `${this.staticPrefix}${path.replace(/^\//, "")}`;
        }

        preload() {
            // The league player's five throw frames, and the enemy trainer's
            // front sprite for the intro.
            const throwCharacter = this.intro?.playerThrowCharacter;
            if (throwCharacter) {
                for (let frame = 0; frame < 5; frame += 1) {
                    this.load.image(`capture-throw-${throwCharacter}-${frame}`,
                        this.spriteUrl(`games/assets/pokemon/capture/throw/${throwCharacter}-${frame}.png?v=4`));
                }
            }
            if (this.intro?.enemyTrainerSpriteUrl) {
                this.load.image("intro-enemy-trainer", this.intro.enemyTrainerSpriteUrl);
            }
            // Capture: the four ball families, each closed plus its two
            // halves (the DS open pose is the halves hinged apart).
            ["poke", "great", "ultra", "master"].forEach((ballKey) => {
                ["closed", "top", "bottom"].forEach((part) => {
                    this.load.image(`capture-ball-${ballKey}-${part}`,
                        this.spriteUrl(`games/assets/pokemon/capture/balls/${ballKey}-${part}.png?v=2`));
                });
            });
            // DS particle dressing for the moves actually present in this
            // battle. An archive is a set -- the flame and its smoke, the
            // rock and its dust -- so the first few pieces are staged and the
            // choreography spreads them across the effects it spawns. Only a
            // few each, since the full set is 1690 images.
            const dsMoves = this.dsParticles.moves || {};
            ["player", "enemy"].forEach((side) => {
                (this.engine.teams[side] || []).forEach((pokemon) => {
                    (pokemon.moves || []).forEach((move) => {
                        const slug = String(move.slug || "").replace(/-/g, "");
                        const entry = dsMoves[slug];
                        const set = entry?.textures?.length
                            ? entry.textures
                            : (entry?.texture ? [{ file: entry.texture }] : []);
                        set.slice(0, DS_TEXTURES_PER_MOVE).forEach((piece, index) => {
                            this.load.image(`dsp-${slug}-${index}`,
                                this.spriteUrl(`games/assets/pokemon/ds-particles/${piece.file}?v=4`));
                        });
                    });
                });
            });
            // Showdown fx textures, keyed by effect id (the file name can
            // differ: pinkicicle is icicle-pink.png).
            Object.entries(this.fxManifest.files || {}).forEach(([effectId, meta]) => {
                this.load.image(`sdfx-${effectId}`,
                    this.spriteUrl(`games/assets/pokemon/showdown-fx/${meta.file}`));
            });
            if (this.battlefield?.backdrop) {
                this.load.image("battle-backdrop", this.spriteUrl(this.battlefield.backdrop));
            }
            if (this.battlefield?.enemyBase) {
                this.load.image("battle-enemy-base", this.spriteUrl(this.battlefield.enemyBase));
            }
            if (this.battlefield?.playerBase) {
                this.load.image("battle-player-base", this.spriteUrl(this.battlefield.playerBase));
            }
            for (const side of ["player", "enemy"]) {
                this.engine.teams[side].forEach((pokemon, teamIndex) => {
                    const spritePath = side === "player" ? pokemon.sprites.back : pokemon.sprites.front;
                    // Animated GIFs can't go through Phaser's loader (it would
                    // keep only the first frame); they are decoded into frame
                    // textures in create() instead.
                    if (pokemon.sprites.animatedGif) return;
                    this.load.image(this.textureKey(side, teamIndex), this.spriteUrl(spritePath));
                });
            }
            if (this.moveEffects) {
                this.moveEffects.getSheetList().forEach((sheet) => {
                    this.load.spritesheet(sheet.key, this.spriteUrl(sheet.path), {
                        frameWidth: sheet.frameWidth,
                        frameHeight: sheet.frameHeight,
                    });
                });
            }
        }

        async create() {
            this.prepareTransparentPokemonTextures();
            await this.decodeAnimatedSprites();
            this.createMoveEffectAnimations();
            this.drawBattlefield();
            for (const side of ["enemy", "player"]) {
                for (let slot = 0; slot < 2; slot += 1) this.createSlot(side, slot);
            }
            this.createWeatherLayer();
            // Inert without the fx set: every texture lookup falls back to
            // sdfx-wisp, so if even that is missing the adapter must not run.
            this.showdownAnims = (root.PokemonShowdownAnimAdapter && this.textures.exists("sdfx-wisp"))
                ? root.PokemonShowdownAnimAdapter.createAdapter(this, {
                    textureFor: (effectId) => {
                        const key = `sdfx-${String(effectId).replace(/^fx\//, "").replace(/\.(?:png|jpg)$/, "")}`;
                        return this.textures.exists(key) ? key : (this.textures.exists("sdfx-wisp") ? "sdfx-wisp" : null);
                    },
                    // DS particle dressing: when the current move has its
                    // HeartGold texture loaded, effects wear it instead of
                    // the Showdown fx art.
                    // Which piece of this move's art to use. `variant` is a
                    // stable number the adapter derives from the effect it is
                    // spawning, so a given effect always wears the same piece
                    // and the set spreads across the move rather than
                    // flickering at random.
                    overrideFor: (slug, variant = 0, role = null) => {
                        const index = this.dsTextureIndex(slug, variant, role);
                        if (index === null) return null;
                        const key = `dsp-${slug}-${index}`;
                        return this.textures.exists(key)
                            ? key
                            : (this.textures.exists(`dsp-${slug}-0`) ? `dsp-${slug}-0` : null);
                    },
                    // How that texture wants to be drawn. Most DS particles
                    // are grey masks the handheld coloured from its emitter,
                    // so they carry their move's type colour here. The ones
                    // that are drawn objects rather than glows also ask for
                    // normal blending: additive drops their dark outline and
                    // lets the backdrop halo through the art.
                    dsStyleFor: (slug, variant = 0, role = null) => {
                        const move = (this.dsParticles.moves || {})[slug];
                        if (!move) return null;
                        // Each piece of the set carries its own blend and
                        // tint: a drawn object and a glow can share an
                        // archive and want opposite treatment. Read the same
                        // piece overrideFor just chose, or a jaw half would
                        // wear another texture's colour.
                        const set = move.textures;
                        const chosen = this.dsTextureIndex(slug, variant, role);
                        const entry = (set && chosen !== null) ? set[chosen] : (set?.[0] || move);
                        const tint = typeof entry.tint === "string"
                            ? Number.parseInt(entry.tint.replace("#", ""), 16)
                            : NaN;
                        return {
                            tint: Number.isFinite(tint) ? tint : null,
                            blend: entry.blend === "normal" ? "normal" : "add",
                        };
                    },
                })
                : null;
            this.sync(this.engine);
            // Hold the leads invisible until the send-out plays them in. The
            // HP cards stay up; only the sprites wait for their ball.
            if (this.intro && !this.reducedMotion) {
                ["player", "enemy"].forEach((side) => {
                    this.slotViews[side].forEach((view) => {
                        if (view?.sprite?.visible) view.sprite.setAlpha(0);
                    });
                });
            }
            this.scale.on("resize", () => this.sync(this.engine));
            if (typeof this.onReady === "function") this.onReady(this);
        }

        // Where a slot stands. The two-slot layout puts each Pokemon on its
        // own half of the base; with only one active per side that leaves it
        // sitting off to the side, so a solo Pokemon takes the middle.
        slotAnchor(side, slot) {
            const base = POSITIONS[side][slot];
            const soloSide = Number(this.engine?.activeLimit?.[side]) === 1;
            if (!soloSide || slot !== 0) return base;
            const layout = PLATFORM_LAYOUT[side];
            const pair = POSITIONS[side];
            return {
                ...base,
                x: layout ? layout.centerX : base.x,
                // Halfway between where the two normally stand.
                y: Math.round((pair[0].y + pair[1].y) / 2),
                standDepth: 0.5,
            };
        }

        // A tint over the battlefield plus a label naming the weather, so the
        // player can see why the damage numbers moved.
        createWeatherLayer() {
            this.weatherTint = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0)
                .setDepth(38)
                .setBlendMode(Phaser.BlendModes.MULTIPLY);
            this.fieldBanner = this.add.text(WIDTH - 12, 12, "", {
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#ffffff",
                backgroundColor: "#00000088",
                padding: { x: 7, y: 3 },
            }).setOrigin(1, 0).setDepth(60).setAlpha(0);
            this.currentWeather = null;
            this.terrainStrip = this.add.rectangle(WIDTH / 2, HEIGHT - 46, WIDTH, 92, 0xffffff, 1)
                .setDepth(3)
                .setAlpha(0);
            this.currentTerrain = null;
        }

        // Mega Evolution, in the four beats the games give it: the Key Stone
        // answers from the trainer's side, its light converges on the Pokemon,
        // the field whites out for the change, and the new form arrives on a
        // shockwave. Nothing here is decoded from a ROM -- Mega Evolution
        // postdates the HeartGold scripts this project reads -- so it is
        // authored, and the timings are chosen rather than measured.
        //
        // Everything it touches on the battler is restored before the swap
        // runs: swapSpeciesSprite re-seats position, alpha and scale itself,
        // and a tint or an offset left behind would survive into the new form.
        async animateMegaEvolution(event) {
            const view = Number.isInteger(event.targetIndex) ? this.findView(event.side, event.targetIndex) : null;
            if (!view) return;
            if (this.reducedMotion) {
                await this.swapMegaSprite(event, view);
                this.refreshStatusChip(event.side, event.targetIndex);
                return;
            }
            const sprite = view.sprite;
            const centreX = sprite.x;
            const centreY = sprite.y - sprite.displayHeight / 2;
            // The trainer's stone answers from where that trainer stands: the
            // player's off the bottom-left corner, the opponent's from the
            // far side. The light has to come from a person, not from nowhere.
            const origin = event.side === "player"
                ? { x: 96, y: HEIGHT - 40 }
                : { x: WIDTH - 96, y: 64 };
            const MEGA_GOLD = 0xf7d774;
            const MEGA_VIOLET = 0xc98cff;
            const litter = [];
            const spark = (key, x, y, scale, tint, depth) => {
                const piece = this.textures.exists(key)
                    ? this.add.image(x, y, key).setScale(scale)
                    : this.add.circle(x, y, 10 * scale, tint, 1);
                piece.setDepth(depth).setTint?.(tint);
                piece.setBlendMode(Phaser.BlendModes.ADD);
                litter.push(piece);
                return piece;
            };
            const shineKey = this.textures.exists("sdfx-shine") ? "sdfx-shine" : null;
            const wispKey = this.textures.exists("sdfx-wisp") ? "sdfx-wisp" : null;
            const gloom = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x0a0618, 0).setDepth(58);
            const flash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(63);
            const homeY = sprite.y;
            try {
                // 1. RESONANCE. The field drops away and two lights answer
                //    each other -- the trainer's stone, then the Pokemon's.
                await this.tween({ targets: gloom, fillAlpha: 0.55, duration: 220 });
                const keyStone = spark(shineKey, origin.x, origin.y, 0.5, MEGA_GOLD, 60);
                keyStone.setAlpha(0);
                await this.tween({ targets: keyStone, alpha: 1, scaleX: 0.9, scaleY: 0.9, duration: 180 });
                const answer = spark(shineKey, centreX, centreY, 0.35, MEGA_VIOLET, 60);
                answer.setAlpha(0);
                await Promise.all([
                    this.tween({ targets: answer, alpha: 1, duration: 160 }),
                    this.tween({ targets: keyStone, x: centreX, y: centreY,
                        scaleX: 0.4, scaleY: 0.4, duration: 320, ease: "Quad.easeIn" }),
                ]);
                keyStone.destroy();

                // 2. CONVERGENCE. Eight shards fall in around the Pokemon,
                //    turning as they close, while it lifts and pales.
                const converge = [];
                for (let i = 0; i < 8; i += 1) {
                    const angle = i * (Math.PI * 2 / 8);
                    const shard = spark(wispKey || shineKey,
                        centreX + Math.cos(angle) * 150,
                        centreY + Math.sin(angle) * 110,
                        0.55, i % 2 ? MEGA_GOLD : MEGA_VIOLET, 61);
                    shard.setAlpha(0.95);
                    converge.push(this.tween({
                        targets: shard,
                        x: centreX, y: centreY,
                        scaleX: 0.15, scaleY: 0.15, angle: 220,
                        duration: 430, delay: i * 32, ease: "Quad.easeIn",
                    }));
                }
                converge.push(this.tween({ targets: answer, scaleX: 1.5, scaleY: 1.5,
                    angle: 180, duration: 520 }));
                converge.push(this.tween({ targets: sprite, y: homeY - 14, duration: 520, ease: "Sine.easeOut" }));
                await Promise.all(converge);

                // 3. THE MOMENT. White out, change, and hold a beat so the
                //    swap is never seen happening.
                await this.tween({ targets: flash, fillAlpha: 0.95, duration: 140 });
                window.PokemonBattleAudio?.play("hit-super");
                sprite.y = homeY;
                sprite.clearTint();
                await this.swapMegaSprite(event, view);
                await delay(90);

                // 4. EMERGENCE. The light falls away on a ring, and the new
                //    form lands with a shudder.
                const ring = spark(shineKey, centreX, centreY, 0.3, MEGA_VIOLET, 62);
                const burst = [];
                burst.push(this.tween({ targets: ring, scaleX: 4.2, scaleY: 4.2,
                    alpha: 0, duration: 520, ease: "Quad.easeOut" }));
                for (let i = 0; i < 10; i += 1) {
                    const angle = i * (Math.PI * 2 / 10) + 0.3;
                    const mote = spark(shineKey, centreX, centreY, 0.3,
                        i % 2 ? MEGA_GOLD : MEGA_VIOLET, 62);
                    burst.push(this.tween({
                        targets: mote,
                        x: centreX + Math.cos(angle) * (120 + (i % 3) * 26),
                        y: centreY + Math.sin(angle) * (90 + (i % 3) * 20),
                        scaleX: 0.1, scaleY: 0.1, alpha: 0,
                        duration: 560, delay: i * 18, ease: "Quad.easeOut",
                    }));
                }
                burst.push(this.tween({ targets: flash, fillAlpha: 0, duration: 360 }));
                burst.push(this.tween({ targets: gloom, fillAlpha: 0, duration: 420 }));
                burst.push((async () => {
                    // The landing: a short squash the fit leaves intact,
                    // taken from the scale swapSpeciesSprite just set.
                    const toX = sprite.scaleX;
                    const toY = sprite.scaleY;
                    sprite.setScale(toX * 1.14, toY * 0.86);
                    this.cameras.main.shake(220, 0.006);
                    await this.tween({ targets: sprite, scaleX: toX, scaleY: toY,
                        duration: 320, ease: "Back.easeOut" });
                })());
                await Promise.all(burst);
            } finally {
                // A failed sprite load must not leave the field dark or the
                // battler floating.
                sprite.y = homeY;
                sprite.clearTint();
                gloom.destroy();
                flash.destroy();
                litter.forEach((piece) => piece.destroy());
            }
            this.refreshStatusChip(event.side, event.targetIndex);
        }

        swapMegaSprite(event, view) {
            return this.swapSpeciesSprite(event, view, "mega");
        }

        // Which artwork a slot should be wearing right now. Mega Evolution and
        // Transform both rewrite `sprites` on the combatant, so this is the
        // one place that decides what a slot ought to be showing.
        spritePathFor(side, pokemon) {
            if (!pokemon?.sprites) return "";
            return side === "player"
                ? (pokemon.sprites.back || pokemon.sprites.front)
                : pokemon.sprites.front;
        }

        // Load and apply another species' artwork onto a slot, keeping the
        // Pokemon's feet planted on its platform.
        async swapSpeciesSprite(event, view, variant) {
            const path = event.side === "player"
                ? (event.sprites?.back || event.sprites?.front)
                : event.sprites?.front;
            if (!path) return;
            const key = `${this.textureKey(event.side, event.targetIndex)}-${variant}`;
            const animationKey = `${this.idleAnimationKey(event.side, event.targetIndex)}-${variant}`;
            if (!this.textures.exists(key)) {
                const url = this.spriteUrl(path);
                // The mega form is a Showdown GIF like any other sprite, so it
                // goes through the same frame decoder. Loading it as a plain
                // image instead only kept the first frame, which is why a
                // Mega Evolution stood perfectly still for the rest of the
                // battle while everything around it breathed.
                await this.decodeGifTexture(key, animationKey, url);
                if (!this.textures.exists(key)) {
                    const loaded = await new Promise((resolve) => {
                        this.load.image(key, url);
                        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve(this.textures.exists(key)));
                        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => resolve(false));
                        this.load.start();
                    });
                    if (!loaded) return;
                }
            }
            view.sprite.stop();
            const formHasFrames = this.anims.exists(animationKey)
                && this.textures.get(key).has("0");
            view.sprite.setTexture(key, formHasFrames ? "0" : undefined);
            view.sprite.setPosition(view.position.x, view.position.y).setAlpha(1).setVisible(true);
            this.fitSprite(view.sprite, event.side);
            if (formHasFrames) view.sprite.play(animationKey);
            // Remember it. sync() rebuilds any slot whose idle animation is
            // not the one it expects, and the key it expects is the slot's
            // own -- so without this the very next sync put the original
            // species' artwork straight back.
            this.formSprites[event.side][event.targetIndex] = {
                textureKey: key, animationKey, spritePath: path, hasFrames: formHasFrames,
            };
        }

        // Ditto's party trick. The sprite squashes, whites out, changes
        // underneath and springs back at the copy's own size.
        async animateTransform(event) {
            const view = Number.isInteger(event.targetIndex)
                ? this.findView(event.side, event.targetIndex) : null;
            if (!view) return;
            const sprite = view.sprite;
            const variant = event.formVariant || "transform";
            if (this.reducedMotion) {
                await this.swapSpeciesSprite(event, view, variant);
                this.refreshStatusChip(event.side, event.targetIndex);
                return;
            }
            const fromX = sprite.scaleX;
            const fromY = sprite.scaleY;
            const glow = this.add
                .circle(sprite.x, sprite.y - sprite.displayHeight / 2, 26, 0xffffff, 0)
                .setDepth(58);
            await Promise.all([
                this.tween({ targets: sprite, scaleX: fromX * 1.2, scaleY: fromY * 0.8, duration: 160, ease: "Quad.easeOut" }),
                this.tween({ targets: glow, fillAlpha: 0.8, scaleX: 1.9, scaleY: 1.9, duration: 160 }),
            ]);
            await this.swapSpeciesSprite(event, view, variant);
            // fitSprite has just sized the new artwork, so the spring back has
            // to start from the copy's scale, not the shifter's.
            const toX = sprite.scaleX;
            const toY = sprite.scaleY;
            sprite.setScale(toX * 1.16, toY * 0.84);
            await Promise.all([
                this.tween({ targets: sprite, scaleX: toX, scaleY: toY, duration: 280, ease: "Back.easeOut" }),
                this.tween({ targets: glow, fillAlpha: 0, scaleX: 2.8, scaleY: 2.8, duration: 280 }),
            ]);
            glow.destroy();
            this.refreshStatusChip(event.side, event.targetIndex);
        }

        // Which piece of a move's particle set an effect should wear.
        //
        // An effect that names a shape -- half of a mouth, or a claw mark --
        // takes the piece that IS that shape, worked out by particle_roles.py
        // from the art itself. Picking by hash instead knew nothing about
        // what it was dressing: it put the upper jaw on the bottom as often
        // as the top, landed on a spark for Bite and a boulder for Crunch,
        // and gave every slash move the round burst that shares its archive
        // rather than the mark -- which is why Scratch was a white sphere.
        //
        // A move whose art cannot fill the role returns null, so the effect
        // keeps Showdown's own art rather than wearing the wrong shape.
        // Unnamed effects keep Showdown's art too, unless the move is on the
        // reviewed full-dress list -- the old hash spread was retired once
        // every incoherent-art report had traced back to it.
        dsTextureIndex(slug, variant, role) {
            const move = (this.dsParticles.moves || {})[slug];
            const set = move?.textures;
            const count = Math.min(set?.length || 1, DS_TEXTURES_PER_MOVE);
            if (role) {
                const index = move?.roles?.[role];
                return Number.isInteger(index) && index < count ? index : null;
            }
            if (!DS_FULL_DRESS.has(slug)) return null;
            return count > 1 ? Math.abs(variant) % count : 0;
        }

        // A coloured strip along the ground marks the terrain.
        async applyTerrainVisual(kind) {
            if (!this.terrainStrip) return;
            this.currentTerrain = kind || null;
            const colour = { electric: 0xf4e04d, grassy: 0x6fc16f, misty: 0xe4a8dd, psychic: 0xc07fd6 }[kind || ""];
            if (!colour) {
                await this.tween({ targets: this.terrainStrip, alpha: 0, duration: this.reducedMotion ? 0 : 300 });
                return;
            }
            this.terrainStrip.setFillStyle(colour, 1);
            await this.tween({ targets: this.terrainStrip, alpha: 0.35, duration: this.reducedMotion ? 0 : 300 });
        }

        async applyWeatherVisual(kind) {
            if (!this.weatherTint) return;
            this.currentWeather = kind || null;
            const palette = {
                rain: { color: 0x9fc4ff, alpha: 0.32, label: "RAIN" },
                sun: { color: 0xffd9a0, alpha: 0.3, label: "HARSH SUN" },
                sandstorm: { color: 0xe0c489, alpha: 0.34, label: "SANDSTORM" },
                snow: { color: 0xdaeeff, alpha: 0.3, label: "SNOW" },
            }[kind || ""] || null;

            if (!palette) {
                this.fieldBanner.setText("");
                await Promise.all([
                    this.tween({ targets: this.weatherTint, fillAlpha: 0, duration: this.reducedMotion ? 0 : 320 }),
                    this.tween({ targets: this.fieldBanner, alpha: 0, duration: this.reducedMotion ? 0 : 240 }),
                ]);
                return;
            }
            this.weatherTint.setFillStyle(palette.color, this.weatherTint.fillAlpha || 0);
            this.fieldBanner.setText(palette.label);
            await Promise.all([
                this.tween({ targets: this.weatherTint, fillAlpha: palette.alpha, duration: this.reducedMotion ? 0 : 380 }),
                this.tween({ targets: this.fieldBanner, alpha: 1, duration: this.reducedMotion ? 0 : 240 }),
            ]);
        }

        // Decode each Showdown GIF into per-frame textures and register a
        // looping idle animation. Browsers without ImageDecoder fall back to a
        // static <img> load of the first frame, so nothing breaks -- it just
        // doesn't move.
        async decodeAnimatedSprites() {
            const jobs = [];
            for (const side of ["player", "enemy"]) {
                this.engine.teams[side].forEach((pokemon, teamIndex) => {
                    if (!pokemon.sprites.animatedGif) return;
                    const path = side === "player" ? pokemon.sprites.back : pokemon.sprites.front;
                    jobs.push(this.decodeGifTexture(
                        this.textureKey(side, teamIndex),
                        this.idleAnimationKey(side, teamIndex),
                        this.spriteUrl(path),
                    ));
                });
            }
            await Promise.all(jobs);
        }

        async decodeGifTexture(textureKey, animationKey, url) {
            if (this.textures.exists(textureKey)) return;
            try {
                if (typeof window.ImageDecoder !== "function") throw new Error("ImageDecoder unavailable");
                const response = await fetch(url, { credentials: "same-origin" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const decoder = new window.ImageDecoder({
                    data: await response.arrayBuffer(),
                    type: "image/gif",
                });
                await decoder.tracks.ready;
                const track = decoder.tracks.selectedTrack;
                const frameCount = Math.max(1, Number(track?.frameCount) || 1);
                // Cap the frame count so a pathological GIF cannot allocate
                // hundreds of textures; Showdown idles run 20-60 frames.
                const limit = Math.min(frameCount, 80);
                const frameNames = [];
                let durationMs = 0;
                let canvasTexture = null;
                for (let index = 0; index < limit; index += 1) {
                    const { image } = await decoder.decode({ frameIndex: index });
                    if (!canvasTexture) {
                        // One canvas holds every frame side by side.
                        canvasTexture = this.textures.createCanvas(
                            textureKey,
                            image.displayWidth * limit,
                            image.displayHeight,
                        );
                    }
                    canvasTexture.context.drawImage(image, image.displayWidth * index, 0);
                    canvasTexture.add(
                        String(index),
                        0,
                        image.displayWidth * index,
                        0,
                        image.displayWidth,
                        image.displayHeight,
                    );
                    frameNames.push(String(index));
                    durationMs += (Number(image.duration) || 100000) / 1000;
                    image.close();
                }
                decoder.close();
                // Canvas textures are built at runtime and do not inherit the
                // game's pixelArt flag, so they sample smoothly unless told.
                canvasTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                canvasTexture.refresh();
                if (frameNames.length > 1 && !this.anims.exists(animationKey)) {
                    this.anims.create({
                        key: animationKey,
                        frames: frameNames.map((frame) => ({ key: textureKey, frame })),
                        // The GIF's own pace, scaled by the "Sprite idle
                        // speed" setting (6 is the neutral default).
                        frameRate: Math.max(2, Math.min(
                            30,
                            ((frameNames.length * 1000) / Math.max(1, durationMs))
                                * (this.idleFrameRate / 6),
                        )),
                        repeat: -1,
                    });
                }
            } catch (error) {
                // Static fallback: browser renders the first GIF frame.
                await new Promise((resolve) => {
                    this.load.image(textureKey, url);
                    this.load.once("complete", resolve);
                    this.load.start();
                });
            }
        }

        createMoveEffectAnimations() {
            if (!this.moveEffects) return;
            this.moveEffects.getSheetList().forEach((sheet) => {
                if (sheet.frames <= 1 || this.anims.exists(sheet.animationKey)) return;
                this.anims.create({
                    key: sheet.animationKey,
                    frames: this.anims.generateFrameNumbers(sheet.key, { start: 0, end: sheet.frames - 1 }),
                    frameRate: 18,
                    repeat: -1,
                });
            });
        }

        cleanTextureKey(side, teamIndex) {
            return `${this.textureKey(side, teamIndex)}-transparent`;
        }

        prepareTransparentPokemonTextures() {
            for (const side of ["player", "enemy"]) {
                this.engine.teams[side].forEach((pokemon, teamIndex) => {
                    // GIF sprites carry real alpha; only the legacy static
                    // sprites need their matte scrubbed.
                    if (pokemon.sprites.animatedGif) return;
                    const sourceKey = this.textureKey(side, teamIndex);
                    const cleanKey = this.cleanTextureKey(side, teamIndex);
                    const source = this.textures.get(sourceKey).getSourceImage();
                    const canvasTexture = this.textures.createCanvas(cleanKey, source.width, source.height);
                    const context = canvasTexture.context;
                    context.clearRect(0, 0, source.width, source.height);
                    context.drawImage(source, 0, 0);
                    const pixels = context.getImageData(0, 0, source.width, source.height);
                    const background = [pixels.data[0], pixels.data[1], pixels.data[2], pixels.data[3]];
                    if (background[3] > 0) {
                        for (let index = 0; index < pixels.data.length; index += 4) {
                            if (
                                pixels.data[index] === background[0]
                                && pixels.data[index + 1] === background[1]
                                && pixels.data[index + 2] === background[2]
                            ) {
                                pixels.data[index + 3] = 0;
                            }
                        }
                        context.putImageData(pixels, 0, 0);
                    }
                    canvasTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                    canvasTexture.refresh();
                });
            }
        }

        drawBattlefield() {
            if (this.textures.exists("battle-backdrop")) {
                this.add.image(0, 0, "battle-backdrop")
                    .setOrigin(0, 0)
                    .setDisplaySize(WIDTH, HEIGHT)
                    .setDepth(-30);

                if (this.textures.exists("battle-enemy-base")) {
                    this.add.image(760, 306, "battle-enemy-base")
                        .setOrigin(0.5, 1)
                        .setDepth(-12);
                }
                if (this.textures.exists("battle-player-base")) {
                    this.add.image(350, 480, "battle-player-base")
                        .setOrigin(0.5, 1)
                        .setDepth(-12);
                }

                const shade = this.add.graphics().setDepth(-20);
                shade.fillGradientStyle(0x06101b, 0x06101b, 0x06101b, 0x06101b, 0.03, 0.03, 0.12, 0.12);
                shade.fillRect(0, 0, WIDTH, HEIGHT);
                this.drawFieldRails();
                return;
            }

            const field = this.add.graphics();
            field.fillGradientStyle(0xdce5ed, 0xdce5ed, 0xaabeb7, 0xaabeb7, 1);
            field.fillRect(0, 0, WIDTH, HEIGHT);

            field.fillStyle(0xffffff, 0.22);
            field.fillEllipse(760, 194, 330, 104);
            field.lineStyle(4, 0x718894, 0.3);
            field.strokeEllipse(760, 194, 330, 104);
            field.fillStyle(0xf7fbff, 0.28);
            field.fillEllipse(350, 366, 420, 126);
            field.lineStyle(4, 0x718894, 0.34);
            field.strokeEllipse(350, 366, 420, 126);

            field.lineStyle(2, 0xffffff, 0.15);
            for (let y = 32; y < HEIGHT; y += 32) field.lineBetween(0, y, WIDTH, y);
            field.lineStyle(1, 0x415463, 0.08);
            for (let x = 0; x < WIDTH; x += 48) field.lineBetween(x, 0, x, HEIGHT);

            this.drawFieldRails();
        }

        drawFieldRails() {
            const rail = this.add.graphics().setDepth(20);
            rail.fillStyle(0x24364a, 0.9);
            rail.fillRect(0, 0, WIDTH, 12);
            rail.fillRect(0, HEIGHT - 12, WIDTH, 12);
            rail.fillStyle(0x67d7dd, 0.9);
            rail.fillRect(0, 12, WIDTH, 3);
            rail.fillRect(0, HEIGHT - 15, WIDTH, 3);
        }

        createSlot(side, slot) {
            const defaultPosition = this.slotAnchor(side, slot);
            const position = {
                ...defaultPosition,
                y: this.platformContactY(
                    side,
                    defaultPosition.x,
                    defaultPosition.y,
                    defaultPosition.standDepth,
                ),
            };
            // A Pokemon stands ON the field, so it has to be above the field's
            // own furniture -- the terrain strip at 3 and the rails at 20 --
            // and below the move effects that play over it from 24 up. This
            // was left at Phaser's default of 0, which put it under everything
            // including the enemy trainer, who is drawn at 44 and stood in
            // front of the Pokemon he had just sent out.
            const sprite = this.add.sprite(position.x, position.y, "__DEFAULT")
                .setOrigin(0.5, 1).setDepth(SPRITE_DEPTH);
            sprite.setVisible(false);

            const card = this.add.container(position.cardX, position.cardY);
            const panel = this.add.graphics();
            panel.fillStyle(0xf5f3e7, 0.97);
            panel.fillRoundedRect(0, 0, 308, 74, 12);
            panel.lineStyle(3, side === "player" ? 0x24537b : 0x73384f, 1);
            panel.strokeRoundedRect(0, 0, 308, 74, 12);
            panel.fillStyle(side === "player" ? 0x24537b : 0x73384f, 1);
            panel.fillRoundedRect(0, 0, 12, 74, { tl: 12, bl: 12, tr: 0, br: 0 });

            const name = this.add.text(25, 10, "", {
                fontFamily: "Trebuchet MS, Arial, sans-serif",
                fontSize: "20px",
                fontStyle: "bold",
                color: "#172236",
            });
            const level = this.add.text(278, 12, "", {
                fontFamily: "Trebuchet MS, Arial, sans-serif",
                fontSize: "14px",
                color: "#35485d",
            }).setOrigin(1, 0);
            // Gender sits just left of the level. Genderless species show
            // nothing rather than a placeholder.
            const gender = this.add.text(282, 10, "", {
                fontFamily: "Trebuchet MS, Arial, sans-serif",
                fontSize: "17px",
                fontStyle: "bold",
                color: "#3f7fc4",
            }).setOrigin(0, 0);

            const hpLabel = this.add.text(25, 42, "HP", {
                fontFamily: "Trebuchet MS, Arial, sans-serif",
                fontSize: "12px",
                fontStyle: "bold",
                color: "#35485d",
            });
            const hpTrack = this.add.rectangle(57, 48, HP_BAR_WIDTH + 6, 12, 0x263646).setOrigin(0, 0.5);
            const hpBar = this.add.rectangle(60, 48, HP_BAR_WIDTH, 7, 0x50bf6b).setOrigin(0, 0.5);
            const hpText = this.add.text(286, 39, "", {
                fontFamily: "Consolas, monospace",
                fontSize: "13px",
                color: "#172236",
            }).setOrigin(1, 0);

            // Status chip, parked on the HP row in the gap between the bar and
            // the HP readout. It used to share the name row, but the type chips
            // now own that space and a long name pushed the two into each other.
            const statusChip = this.add.container(212, 48);
            const statusBg = this.add.graphics();
            const statusText = this.add.text(0, 0, "", {
                fontFamily: "Trebuchet MS, Arial, sans-serif",
                fontSize: "12px",
                fontStyle: "bold",
                color: "#ffffff",
            }).setOrigin(0.5, 0.5);
            statusChip.add([statusBg, statusText]);
            statusChip.setVisible(false);

            // Type chips flow along the name row, and the status chip is
            // pushed along after them, so a Pokemon's typing reads at a glance
            // without a second look at the party screen. Two are enough: no
            // species carries three, even after Forest's Curse.
            const typeChips = [0, 1].map(() => {
                const chip = this.add.container(0, 12);
                const background = this.add.graphics();
                const label = this.add.text(0, 0, "", {
                    fontFamily: "Trebuchet MS, Arial, sans-serif",
                    fontSize: "11px",
                    fontStyle: "bold",
                    color: "#ffffff",
                }).setOrigin(0.5, 0.5);
                chip.add([background, label]);
                chip.setVisible(false);
                return { chip, background, label };
            });

            card.add([panel, name, level, gender, hpLabel, hpTrack, hpBar, hpText,
                ...typeChips.map((entry) => entry.chip), statusChip]);
            card.setVisible(false);

            this.slotViews[side][slot] = {
                sprite, card, name, level, gender, hpBar, hpText, position,
                statusChip, statusBg, statusText, typeChips,
            };
        }

        // A Pokemon can carry a major status and be confused at once; the major
        // one is the headline, so it wins the single chip.
        activeStatusChip(pokemon) {
            if (!pokemon || pokemon.fainted) return null;
            const major = STATUS_CHIPS[pokemon.statusCondition];
            if (major) return major;
            if (pokemon.volatileStatus?.confused) return STATUS_CHIPS.confused;
            if (pokemon.volatileStatus?.infatuated) return STATUS_CHIPS.infatuated;
            return null;
        }

        // Re-read a Pokemon's status straight from the engine and repaint its
        // chip, for the mid-turn case where sync() is held off.
        refreshStatusChip(side, teamIndex) {
            if (!side || !Number.isInteger(teamIndex)) return;
            const slot = this.slotTeamIndices[side]?.indexOf(teamIndex);
            if (slot === undefined || slot < 0) return;
            this.updateStatusChip(side, slot, this.engine?.teams?.[side]?.[teamIndex]);
        }

        // Lays out the name row: the type chips sit just after the name, and
        // the status chip after those. Types are read live from the Pokemon,
        // so Soak, Reflect Type and Transform show up here immediately.
        updateNameRow(side, slot, pokemon) {
            const view = this.slotViews[side][slot];
            if (!view) return;
            // The row owns the name too, because the chips are laid out from
            // where it ends. A Mega Evolution renames the Pokemon mid-turn, and
            // measuring the old name would leave the chips in the wrong place.
            if (pokemon?.name) view.name.setText(pokemon.name.toUpperCase());
            // Where the name ends, in card space.
            let cursor = 25 + view.name.width + 8;

            (view.typeChips || []).forEach((entry, index) => {
                const type = String(pokemon?.types?.[index] || "").toLowerCase();
                const chip = TYPE_CHIPS[type];
                if (!pokemon || pokemon.fainted || !chip) {
                    entry.chip.setVisible(false);
                    return;
                }
                entry.label.setText(chip.code);
                const width = entry.label.width + 10;
                const height = 15;
                entry.background.clear();
                entry.background.fillStyle(chip.color, 1);
                entry.background.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
                entry.background.lineStyle(1.5, 0x172236, 0.45);
                entry.background.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
                entry.chip.setPosition(cursor + width / 2, 22);
                entry.chip.setVisible(true);
                cursor += width + 4;
            });

            if (!view.statusChip) return;
            const chip = this.activeStatusChip(pokemon);
            if (!chip) {
                view.statusChip.setVisible(false);
                return;
            }
            view.statusText.setText(chip.code);
            const width = Math.max(38, view.statusText.width + 14);
            const height = 18;
            view.statusBg.clear();
            view.statusBg.fillStyle(chip.color, 1);
            view.statusBg.fillRoundedRect(-width / 2, -height / 2, width, height, 5);
            view.statusBg.lineStyle(2, 0x172236, 0.55);
            view.statusBg.strokeRoundedRect(-width / 2, -height / 2, width, height, 5);
            // Right-aligned against the HP readout, so the chip stays put
            // whatever the name and typing do on the row above.
            view.statusChip.setPosition(231 - width / 2, 48);
            view.statusChip.setVisible(true);
        }

        updateStatusChip(side, slot, pokemon) {
            this.updateNameRow(side, slot, pokemon);
        }

        // The bases are ellipses drawn in perspective, so a column of the image
        // spans from the disc's far rim down to its near rim. Standing a sprite
        // just under the topmost pixel puts it on the BACK edge, which reads as
        // floating. `depth` picks a point across that span instead: 0 = far rim,
        // 1 = near rim. Staggering it per slot also restores the front/back
        // separation the two slots are meant to have.
        platformContactY(side, worldX, fallbackY, depth = 0.5) {
            const layout = PLATFORM_LAYOUT[side];
            if (!layout || !this.textures.exists(layout.textureKey)) return fallbackY;

            const source = this.textures.get(layout.textureKey).getSourceImage();
            const width = Number(source?.width || 0);
            const height = Number(source?.height || 0);
            if (!source || width < 1 || height < 1) return fallbackY;

            const localX = Phaser.Math.Clamp(Math.round(worldX - (layout.centerX - width / 2)), 0, width - 1);
            const cacheKey = `${layout.textureKey}:${localX}:${depth}`;
            if (this.platformSurfaceCache.has(cacheKey)) return this.platformSurfaceCache.get(cacheKey);

            try {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                context.drawImage(source, 0, 0);
                const pixels = context.getImageData(0, 0, width, height).data;
                const opaque = (x, y) => pixels[(y * width + x) * 4 + 3] > 24;
                const columnTops = [];
                const columnBottoms = [];
                const radius = Math.min(24, Math.floor(width / 2));
                for (let x = Math.max(0, localX - radius); x <= Math.min(width - 1, localX + radius); x += 4) {
                    let top = -1;
                    let bottom = -1;
                    for (let y = 0; y < height; y += 1) {
                        if (!opaque(x, y)) continue;
                        if (top < 0) top = y;
                        bottom = y;
                    }
                    if (top < 0) continue;
                    columnTops.push(top);
                    columnBottoms.push(bottom);
                }
                if (!columnTops.length) return fallbackY;
                const median = (values) => {
                    const sorted = [...values].sort((left, right) => left - right);
                    return sorted[Math.floor(sorted.length / 2)];
                };
                const topY = median(columnTops);
                const bottomY = median(columnBottoms);
                const standY = topY + (bottomY - topY) * Phaser.Math.Clamp(depth, 0, 1);
                const contactY = layout.bottomY - height + standY + layout.contactInset;
                this.platformSurfaceCache.set(cacheKey, contactY);
                return contactY;
            } catch (error) {
                return fallbackY;
            }
        }

        visiblePixelBounds(sprite) {
            const frame = sprite.frame;
            const cacheKey = `${sprite.texture.key}:${String(frame?.name || "base")}`;
            if (this.visibleBoundsCache.has(cacheKey)) return this.visibleBoundsCache.get(cacheKey);
            const source = frame?.source?.image || sprite.texture.getSourceImage();
            const width = Math.max(1, Number(frame?.cutWidth || frame?.realWidth || frame?.width || source?.width || 64));
            const height = Math.max(1, Number(frame?.cutHeight || frame?.realHeight || frame?.height || source?.height || 64));
            const fallback = { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, width, height };
            if (!source || typeof document === "undefined") return fallback;
            try {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                context.drawImage(
                    source,
                    Number(frame?.cutX || 0),
                    Number(frame?.cutY || 0),
                    width,
                    height,
                    0,
                    0,
                    width,
                    height,
                );
                const pixels = context.getImageData(0, 0, width, height).data;
                let minX = width;
                let minY = height;
                let maxX = -1;
                let maxY = -1;
                for (let y = 0; y < height; y += 1) {
                    for (let x = 0; x < width; x += 1) {
                        if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
                const bounds = maxX >= minX && maxY >= minY
                    ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
                    : fallback;
                this.visibleBoundsCache.set(cacheKey, bounds);
                return bounds;
            } catch (error) {
                this.visibleBoundsCache.set(cacheKey, fallback);
                return fallback;
            }
        }

        fitSprite(sprite, side) {
            const bounds = this.visiblePixelBounds(sprite);
            // Showdown draws every sprite at true relative scale already --
            // Diglett is 43x35, Moltres 217x181. Fitting each to a fixed
            // height threw that away and made them all the same size, so one
            // scale is used for all and only the extremes are reined in.
            const exactFit = Math.min(
                MAX_SPRITE_HEIGHT[side] / bounds.height,
                MAX_SPRITE_WIDTH[side] / bounds.width,
            );
            sprite.setDisplayOrigin((bounds.minX + bounds.maxX + 1) / 2, bounds.maxY + 1);
            // Integer 2x whenever the art fits (the tolerance forgives a few
            // clipped pixels on near-misses). Art too big for that used to be
            // FLOORED to 1x, which rendered the largest Pokemon -- Onix, the
            // megas -- at half the size of everything else. Giants now fit
            // the stage exactly instead: a hair of pixel-row unevenness at
            // ~1.5x beats an 8.8m serpent smaller than a Pikachu. No
            // tolerance on this path -- giants saturate the cap, so any
            // overflow would slice their heads off at the canvas edge.
            const scale = exactFit * SPRITE_OVERFLOW_TOLERANCE >= SPRITE_SCALE[side]
                ? SPRITE_SCALE[side]
                : Math.max(1, exactFit);
            sprite.setScale(scale);
        }

        showPokemon(side, slot, teamIndex) {
            const pokemon = this.engine.teams[side][teamIndex];
            const view = this.slotViews[side][slot];
            if (!pokemon || pokemon.fainted) {
                view.sprite.setVisible(false);
                view.card.setVisible(false);
                this.slotTeamIndices[side][slot] = null;
                return;
            }
            const animated = Boolean(pokemon.sprites.animatedGif);
            // A borrowed form holds only while the combatant still carries the
            // artwork we swapped in. The engine puts `sprites` back when the
            // Pokemon switches out or the duel ends, and that is the signal
            // for the slot to wear its own species again.
            const borrowed = this.formSprites[side][teamIndex];
            const form = borrowed && borrowed.spritePath === this.spritePathFor(side, pokemon)
                ? borrowed
                : null;
            if (borrowed && !form) delete this.formSprites[side][teamIndex];
            const idleKey = form ? form.animationKey : this.idleAnimationKey(side, teamIndex);
            // sync() re-runs this for every slot after every turn. Re-seating
            // the texture and calling play() again restarted the idle loop
            // from frame 0 each time, which is what made the GIFs stutter and
            // snap back. Only touch the sprite when the occupant changed.
            const alreadyShown = this.slotTeamIndices[side][slot] === teamIndex
                && view.sprite.visible
                && (!animated || !this.anims.exists(idleKey) || view.sprite.anims?.getName() === idleKey);
            if (!alreadyShown) {
                view.sprite.stop();
                const textureKey = form
                    ? form.textureKey
                    : (animated ? this.textureKey(side, teamIndex) : this.cleanTextureKey(side, teamIndex));
                // The decoded texture names its frames "0".."N"; the static
                // fallback only has the base frame.
                const hasFrames = form
                    ? form.hasFrames
                    : (animated && this.textures.exists(textureKey)
                        && this.textures.get(textureKey).has("0"));
                view.sprite.setTexture(textureKey, hasFrames ? "0" : undefined);
                view.sprite.setPosition(view.position.x, view.position.y).setAlpha(1).setVisible(true);
                this.fitSprite(view.sprite, side);
                if (hasFrames && this.anims.exists(idleKey)) view.sprite.play(idleKey);
            } else {
                view.sprite.setVisible(true);
            }
            view.name.setText(pokemon.name.toUpperCase());
            view.level.setText(`Lv.${pokemon.level}`);
            if (view.gender) {
                const symbol = pokemon.gender === "female" ? "♀"
                    : pokemon.gender === "male" ? "♂" : "";
                view.gender.setText(symbol);
                view.gender.setColor(pokemon.gender === "female" ? "#d1568c" : "#3f7fc4");
            }
            view.card.setVisible(true);
            this.slotTeamIndices[side][slot] = teamIndex;
            this.updateHealth(side, teamIndex, pokemon.hp, pokemon.maxHp);
            this.updateStatusChip(side, slot, pokemon);
        }

        sync(engine) {
            this.engine = engine;
            if (this.playingEvents) return;
            // Keep the sky in step even if a weather event was missed (a
            // reloaded battle, or weather set outside the event stream).
            const weatherNow = typeof engine?.activeWeather === "function" ? engine.activeWeather() : null;
            if (this.weatherTint && weatherNow !== this.currentWeather) this.applyWeatherVisual(weatherNow);
            const terrainNow = typeof engine?.activeTerrain === "function" ? engine.activeTerrain() : null;
            if (this.terrainStrip && terrainNow !== this.currentTerrain) this.applyTerrainVisual(terrainNow);
            for (const side of ["player", "enemy"]) {
                for (let slot = 0; slot < 2; slot += 1) {
                    this.showPokemon(side, slot, engine.active[side][slot]);
                    // A sprite hidden by Fly/Dig must never outlive the state
                    // that hid it -- a switch or faint would strand it.
                    const view = this.slotViews[side][slot];
                    const teamIndex = engine.active[side][slot];
                    const hidden = engine.teams[side]?.[teamIndex]?.volatileStatus?.semiInvulnerable;
                    if (view?.hiddenOrigin && !hidden) {
                        view.sprite.setVisible(true).setAlpha(1);
                        view.sprite.x = view.hiddenOrigin.x;
                        view.sprite.y = view.hiddenOrigin.y;
                        view.hiddenOrigin = null;
                    }
                }
            }
        }

        // The shakes and screen jolts a move's own DS script asks for. They
        // are what gives a hit its weight, and 396 of the mapped moves carry
        // at least one. Read straight from hg-engine's scripts, where the
        // arguments are plain counts and pixel distances.
        async playMoveGestures(slug, actorView, targetView) {
            const gestures = (this.dsParticles.moves || {})[slug]?.gestures;
            if (!gestures?.length || this.reducedMotion) return;
            const FRAME_MS = 1000 / 60;
            const viewsFor = (who) => {
                if (who === "attacker") return [actorView];
                if (who === "targetSide" || who === "allButUser") {
                    const side = this.slotViews.enemy.includes(targetView) ? "enemy" : "player";
                    return this.slotViews[side].filter((view) => view?.sprite?.visible);
                }
                return [targetView];
            };
            // Every shake used to read the sprite's position when its own turn
            // came round, and put it back there afterwards. That is only safe
            // while shakes do not overlap. Sonic Boom fires nine of them four
            // frames apart: each later one captured a position taken mid-swing
            // and "restored" to it, so the target walked nineteen pixels down
            // the field and STAYED there once the move was over. The homes are
            // taken once, before anything has moved, and every shake returns to
            // those -- including when a sprite is destroyed part-way through,
            // which used to leave the loop without restoring at all.
            const homes = new Map();
            const remember = (view) => {
                const sprite = view?.sprite;
                if (sprite && !homes.has(sprite)) homes.set(sprite, sprite.x);
            };
            [actorView, targetView, ...this.slotViews.enemy, ...this.slotViews.player].forEach(remember);
            // Overlapping shakes on ONE sprite also compounded, driving it four
            // times further than any single gesture asked for. They are queued
            // per sprite instead, which is how the handheld runs them anyway:
            // one script, one shake at a time.
            const queues = new Map();
            const queueOn = (sprite, job) => {
                const previous = queues.get(sprite) || Promise.resolve();
                const next = previous.then(job, job);
                queues.set(sprite, next);
                return next;
            };
            try {
                await Promise.all(gestures.map(async (gesture) => {
                    if (gesture.frame) await delay(gesture.frame * FRAME_MS);
                    if (gesture.kind === "shakeScreen") {
                        this.cameras.main.shake(180, 0.004);
                        return;
                    }
                    if (gesture.kind !== "shake") return;
                    // DS pixels are on a 256-wide screen; this stage is 960 and
                    // draws its Pokemon at twice the size, so the distance is
                    // scaled to match rather than used raw.
                    const distance = Math.min(48, Math.max(3, (gesture.pixels || 2) * 2.5));
                    const swings = Math.min(8, Math.max(1, gesture.times || 1)) * 2;
                    await Promise.all(viewsFor(gesture.who).map(async (view) => {
                        const sprite = view?.sprite;
                        if (!sprite?.active || !homes.has(sprite)) return;
                        await queueOn(sprite, async () => {
                            const home = homes.get(sprite);
                            for (let swing = 0; swing < swings; swing += 1) {
                                if (!sprite.active) return;
                                const offset = swing % 2 === 0 ? distance : -distance;
                                await this.tween({ targets: sprite, x: home + offset, duration: 45, ease: "Sine.easeInOut" });
                            }
                        });
                    }));
                }));
            } finally {
                homes.forEach((x, sprite) => { if (sprite.active) sprite.x = x; });
            }
        }

        findView(side, teamIndex) {
            const slot = this.slotTeamIndices[side].indexOf(teamIndex);
            return slot < 0 ? null : this.slotViews[side][slot];
        }

        // A bar can only be drawn from numbers. An undefined maxHp made the
        // ratio NaN, and a NaN width renders as nothing -- an empty bar on a
        // healthy Pokemon, with "50/undefined" beside it.
        healthRatio(hp, maxHp) {
            const top = Number(maxHp);
            const now = Number(hp);
            if (!Number.isFinite(top) || top <= 0 || !Number.isFinite(now)) return null;
            return Phaser.Math.Clamp(now / top, 0, 1);
        }

        updateHealth(side, teamIndex, hp, maxHp) {
            const view = this.findView(side, teamIndex);
            if (!view) return;
            const ratio = this.healthRatio(hp, maxHp);
            if (ratio === null) return;
            const color = ratio > 0.5 ? 0x50bf6b : ratio > 0.2 ? 0xe5b93f : 0xdf554f;
            view.hpBar.setFillStyle(color);
            view.hpBar.width = Math.max(0, HP_BAR_WIDTH * ratio);
            view.hpText.setText(`${hp}/${maxHp}`);
        }

        async animateHealth(side, teamIndex, hp, maxHp) {
            const view = this.findView(side, teamIndex);
            if (!view) return;
            const ratio = this.healthRatio(hp, maxHp);
            if (ratio === null) return;
            if (this.reducedMotion) {
                this.updateHealth(side, teamIndex, hp, maxHp);
                await delay(120);
                return;
            }
            const color = ratio > 0.5 ? 0x50bf6b : ratio > 0.2 ? 0xe5b93f : 0xdf554f;
            const displayedHp = Number(String(view.hpText.text).split("/")[0]) || 0;
            const counter = { value: displayedHp };
            view.hpBar.setFillStyle(color);
            // A drain to zero takes 620ms. If the slot changes hands inside
            // that window -- a faint and its replacement, a switch, a capture
            // -- the tween kept running and wrote the OLD Pokemon's last frame
            // over the new one, leaving a full-health Pokemon with an empty
            // bar. The occupant is stamped before the tween and checked after:
            // if the slot moved on, the tween's result is discarded and
            // whoever owns the slot now keeps its own bar.
            const occupant = this.slotTeamIndices[side]?.[this.slotViews[side].indexOf(view)];
            const stillOurs = () => this.slotTeamIndices[side]?.[this.slotViews[side].indexOf(view)] === occupant;
            await Promise.all([
                this.tween({
                    targets: view.hpBar,
                    width: Math.max(0, HP_BAR_WIDTH * ratio),
                    duration: 620,
                    ease: "Sine.easeInOut",
                }),
                this.tween({
                    targets: counter,
                    value: hp,
                    duration: 620,
                    ease: "Linear",
                    onUpdate: () => { if (stillOurs()) view.hpText.setText(`${Math.round(counter.value)}/${maxHp}`); },
                }),
            ]);
            if (!stillOurs()) {
                // The tween wrote the old Pokemon's width on its way out, so
                // the bar has to be repainted from whoever holds the slot now
                // rather than merely left alone.
                const slot = this.slotViews[side].indexOf(view);
                const nowIndex = this.slotTeamIndices[side]?.[slot];
                const nowPokemon = this.engine?.teams?.[side]?.[nowIndex];
                if (nowPokemon) this.updateHealth(side, nowIndex, nowPokemon.hp, nowPokemon.maxHp);
                return;
            }
            this.updateHealth(side, teamIndex, hp, maxHp);
        }

        createStatArrow(x, y, rising, color) {
            const arrow = this.add.graphics({ x, y }).setDepth(38);
            arrow.fillStyle(0x132238, 0.72);
            if (rising) {
                arrow.fillTriangle(-10, 2, 10, 2, 0, -12);
                arrow.fillRect(-4, 1, 8, 16);
            } else {
                arrow.fillTriangle(-10, -2, 10, -2, 0, 12);
                arrow.fillRect(-4, -17, 8, 16);
            }
            arrow.fillStyle(color, 1);
            if (rising) {
                arrow.fillTriangle(-7, 1, 7, 1, 0, -8);
                arrow.fillRect(-2, 1, 4, 12);
            } else {
                arrow.fillTriangle(-7, -1, 7, -1, 0, 8);
                arrow.fillRect(-2, -13, 4, 12);
            }
            return arrow;
        }

        // Turn one of a two-turn move: the user winds up, and if the move
        // hides it (Fly, Dig, Dive, Shadow Force) the sprite leaves the field
        // in the direction that matches where it went.
        async animateChargeUp(event) {
            const view = Number.isInteger(event.targetIndex) ? this.findView(event.side, event.targetIndex) : null;
            if (!view) return;
            const hiding = event.hiding || "";

            if (!this.reducedMotion) {
                const glow = this.add.circle(view.sprite.x, view.sprite.y - view.sprite.displayHeight / 2, 26, 0xbfe6ff, 0.55).setDepth(46);
                await Promise.all([
                    this.tween({ targets: glow, scaleX: 2.4, scaleY: 2.4, alpha: 0, duration: 340, ease: "Cubic.easeOut" }),
                    this.tween({ targets: view.sprite, scaleX: view.sprite.scaleX * 1.06, scaleY: view.sprite.scaleY * 1.06, duration: 170, yoyo: true }),
                ]);
                glow.destroy();
            }

            if (!hiding) return;
            // Remember where the sprite belongs so it can come back.
            view.hiddenOrigin = { x: view.sprite.x, y: view.sprite.y };
            const exit = hiding === "air" ? { y: view.sprite.y - 90 }
                : hiding === "ground" ? { y: view.sprite.y + 60 }
                    : hiding === "water" ? { y: view.sprite.y + 40 }
                        : {};
            await this.tween({
                targets: view.sprite,
                ...exit,
                alpha: 0,
                duration: this.reducedMotion ? 0 : 260,
                ease: "Cubic.easeIn",
            });
            view.sprite.setVisible(false);
        }

        // Bring a hidden sprite back before it attacks.
        async revealHiddenSprite(side, targetIndex) {
            const view = Number.isInteger(targetIndex) ? this.findView(side, targetIndex) : null;
            if (!view?.hiddenOrigin) return;
            const { x, y } = view.hiddenOrigin;
            view.hiddenOrigin = null;
            view.sprite.setVisible(true);
            await this.tween({
                targets: view.sprite,
                x, y, alpha: 1,
                duration: this.reducedMotion ? 0 : 220,
                ease: "Cubic.easeOut",
            });
        }

        async animateStatChange(event) {
            const view = Number.isInteger(event.targetIndex) ? this.findView(event.side, event.targetIndex) : null;
            if (!view) return;

            const rising = Number(event.stages) > 0;
            const magnitude = Math.max(1, Math.abs(Number(event.stages) || 1));
            const color = rising ? 0xffbd4a : 0x65a9ff;
            const bounds = view.sprite.getBounds();
            const centerX = bounds.centerX;
            const centerY = bounds.centerY;
            const count = Phaser.Math.Clamp(2 + magnitude, 3, 5);
            const spread = Phaser.Math.Clamp(bounds.width * 0.62, 46, 82);
            const startY = rising ? bounds.bottom + 5 : bounds.top - 6;
            const endY = rising ? bounds.top - 24 : bounds.bottom + 24;
            const halo = this.add.ellipse(centerX, centerY, Math.max(70, bounds.width * 1.08), Math.max(64, bounds.height * 0.9), color, 0.16)
                .setStrokeStyle(4, color, 0.62)
                .setDepth(-1);
            const arrows = Array.from({ length: count }, (_, index) => {
                const ratio = count === 1 ? 0.5 : index / (count - 1);
                const arrowX = centerX - spread / 2 + spread * ratio;
                return this.createStatArrow(arrowX, startY + (index % 2) * (rising ? 7 : -7), rising, color);
            });
            const spriteY = view.sprite.y;

            try {
                view.sprite.setTint(color);
                if (this.reducedMotion) {
                    await delay(300);
                    return;
                }
                await delay(220);
                await Promise.all([
                    this.tween({
                        targets: halo,
                        scaleX: 1.18,
                        scaleY: 1.12,
                        alpha: 0,
                        duration: 720,
                        ease: "Sine.easeOut",
                    }),
                    this.tween({
                        targets: view.sprite,
                        y: spriteY + (rising ? -7 : 7),
                        duration: 240,
                        yoyo: true,
                        ease: "Sine.easeInOut",
                    }),
                    ...arrows.map((arrow, index) => this.tween({
                        targets: arrow,
                        y: endY,
                        alpha: 0,
                        duration: 620 + index * 35,
                        delay: index * 55,
                        ease: rising ? "Cubic.easeOut" : "Cubic.easeIn",
                    })),
                ]);
            } finally {
                view.sprite.setY(spriteY).clearTint();
                halo.destroy();
                arrows.forEach((arrow) => arrow.destroy());
            }
        }

        // A lead materialises out of its ball's white flash.
        async materialiseLead(view) {
            const sprite = view.sprite;
            const flash = this.add.circle(sprite.x, sprite.y - sprite.displayHeight / 2, 30, 0xffffff, 0.95)
                .setDepth(46);
            this.tween({ targets: flash, scale: 2.4, alpha: 0, duration: 300, ease: "Quad.easeOut" })
                .then(() => flash.destroy());
            window.PokemonBattleAudio?.play("open");
            sprite.setTintFill(0xffffff);
            await this.tween({ targets: sprite, alpha: 1, duration: 220, ease: "Quad.easeOut" });
            sprite.clearTint();
        }

        // A small ball arcs from the thrower to a lead's position. The throw
        // cue is the caller's to play -- once per side, or a doubles intro
        // fires four whooshes in two seconds and grates.
        async tossIntroBall(fromX, fromY, view) {
            const ball = this.createCaptureBall(fromX, fromY, "poke-ball").setScale(2);
            await this.tween({
                targets: ball,
                x: (fromX + view.position.x) / 2,
                y: Math.min(fromY, view.position.y) - 90,
                angle: 240,
                duration: 180,
                ease: "Quad.easeOut",
            });
            await this.tween({
                targets: ball,
                x: view.position.x,
                y: view.position.y - 30,
                angle: 420,
                duration: 160,
                ease: "Quad.easeIn",
            });
            ball.destroy();
        }

        // The DS battle opening: the enemy trainer stands on the far platform
        // and their leads come out first, then the player's back sprite plays
        // the throw and sends out their own. Idempotent, and instant under
        // reduced motion or when no intro config was given.
        // The cry file carries the same compact slug as the Showdown
        // sprite; species without an animated sprite fall back to their
        // slugified name, accents folded, gender marks as f/m.
        crySlugFor(pokemon) {
            const front = pokemon?.sprites?.front || pokemon?.sprites?.front_idle || "";
            const match = /([a-z0-9-]+)\.gif$/i.exec(front);
            if (match) return match[1];
            return String(pokemon?.name || "")
                .toLowerCase().replace(/♀/g, "f").replace(/♂/g, "m")
                .normalize("NFKD").replace(/[̀-ͯ]/g, "")
                .replace(/[^a-z0-9]/g, "");
        }

        // Send-out pop plus the species' own cry, as the DS games do.
        announceArrival(side, slot) {
            const teamIndex = this.slotTeamIndices?.[side]?.[slot];
            const pokemon = teamIndex === null || teamIndex === undefined
                ? null : this.engine.teams[side][teamIndex];
            window.PokemonBattleAudio?.play("sendout");
            if (pokemon) window.PokemonBattleAudio?.playCry(this.crySlugFor(pokemon));
        }

        async playIntro() {
            if (this.introPlayed) return;
            this.introPlayed = true;
            const showAll = () => {
                ["player", "enemy"].forEach((side) => {
                    this.slotViews[side].forEach((view) => {
                        if (view?.sprite?.visible) view.sprite.setAlpha(1).clearTint();
                    });
                });
            };
            if (!this.intro || this.reducedMotion) {
                showAll();
                return;
            }
            try {
                const activeViews = (side) => this.slotViews[side]
                    .filter((view) => view?.sprite?.visible);
                const enemyViews = activeViews("enemy");
                const playerViews = activeViews("player");

                // The HP cards ride in with the send-out rather than waiting
                // on an empty field: each is parked just past its own edge --
                // enemy cards live on the left of the stage, player cards on
                // the right -- and slides home as its side arrives. The
                // finally below guarantees nobody's card is left off-screen.
                [...enemyViews, ...playerViews].forEach((view) => {
                    const fromLeft = view.position.cardX < WIDTH / 2;
                    view.card.x = view.position.cardX + (fromLeft ? -380 : 380);
                });
                const slideCards = (views) => Promise.all(views.map((view, index) => (async () => {
                    await delay(index * 90);
                    await this.tween({ targets: view.card, x: view.position.cardX,
                        duration: 320, ease: "Cubic.easeOut" });
                })()));

                // --- enemy side first, as the DS games order it ---
                const slideEnemy = slideCards(enemyViews);
                if (this.intro.enemyTrainerSpriteUrl && this.textures.exists("intro-enemy-trainer") && enemyViews.length) {
                    const anchor = enemyViews[0];
                    // Behind the Pokemon, not over it. The player's own trainer
                    // below stays at 44 on purpose: that one is the back
                    // sprite in the foreground, nearest the camera.
                    const trainer = this.add.image(anchor.position.x + 70, anchor.position.y, "intro-enemy-trainer")
                        .setOrigin(0.5, 1).setDepth(ENEMY_TRAINER_DEPTH).setScale(2);
                    await delay(500);
                    window.PokemonBattleAudio?.play("throw");
                    for (const view of enemyViews) {
                        await this.tossIntroBall(trainer.x - 20, trainer.y - 60, view);
                        await this.materialiseLead(view);
                        this.announceArrival("enemy", this.slotViews.enemy.indexOf(view));
                    }
                    await this.tween({ targets: trainer, x: 1030, alpha: 0.6, duration: 300, ease: "Quad.easeIn" });
                    trainer.destroy();
                } else {
                    // Wild battles: the Pokemon is simply there, fading in.
                    for (const view of enemyViews) {
                        await this.tween({ targets: view.sprite, alpha: 1, duration: 260, ease: "Quad.easeOut" });
                        this.announceArrival("enemy", this.slotViews.enemy.indexOf(view));
                    }
                }

                await slideEnemy;

                // --- player side: the back sprite winds up and throws ---
                const slidePlayer = slideCards(playerViews);
                const character = this.intro.playerThrowCharacter;
                if (character && this.textures.exists(`capture-throw-${character}-0`) && playerViews.length) {
                    const trainer = this.add.image(-60, 452, `capture-throw-${character}-0`)
                        .setOrigin(0.5, 1).setDepth(44).setScale(2);
                    await this.tween({ targets: trainer, x: 130, duration: 240, ease: "Quad.easeOut" });
                    await this.playThrowFrames(trainer, character);
                    window.PokemonBattleAudio?.play("throw");
                    for (const view of playerViews) {
                        await this.tossIntroBall(160, 400, view);
                        await this.materialiseLead(view);
                        this.announceArrival("player", this.slotViews.player.indexOf(view));
                    }
                    await this.tween({ targets: trainer, x: -60, duration: 260, ease: "Quad.easeIn" });
                    trainer.destroy();
                } else {
                    for (const view of playerViews) {
                        await this.tween({ targets: view.sprite, alpha: 1, duration: 260, ease: "Quad.easeOut" });
                        this.announceArrival("player", this.slotViews.player.indexOf(view));
                    }
                }
                await slidePlayer;
            } finally {
                // Whatever happened, nobody stays invisible -- and no card
                // stays parked off-screen either.
                showAll();
                ["player", "enemy"].forEach((side) => {
                    this.slotViews[side].forEach((view) => {
                        if (view?.card && view?.position) view.card.x = view.position.cardX;
                    });
                });
            }
        }

        // Steps an image through the character's five throw frames.
        async playThrowFrames(image, character) {
            for (let frame = 0; frame < 5; frame += 1) {
                const key = `capture-throw-${character}-${frame}`;
                if (this.textures.exists(key)) image.setTexture(key);
                await delay(70);
            }
        }

        // "great-ball" -> "great"; anything unrecognised throws a plain Poke
        // Ball, so a future ball type works before it has art.
        captureBallKey(itemKey) {
            const key = String(itemKey || "").replace(/-ball$/, "");
            return ["poke", "great", "ultra", "master"].includes(key) ? key : "poke";
        }

        createCaptureBall(x, y, itemKey) {
            const key = this.captureBallKey(itemKey);
            const closed = this.add.image(0, 0, `capture-ball-${key}-closed`);
            const top = this.add.image(0, 0, `capture-ball-${key}-top`).setOrigin(0.5, 1).setVisible(false);
            const bottom = this.add.image(0, 0, `capture-ball-${key}-bottom`).setOrigin(0.5, 0).setVisible(false);
            const ball = this.add.container(x, y, [bottom, top, closed])
                .setDepth(45)
                .setScale(CAPTURE_BALL_SCALE);
            ball.setOpen = (open) => {
                closed.setVisible(!open);
                top.setVisible(open).setPosition(0, open ? -3 : 0).setAngle(open ? -14 : 0);
                bottom.setVisible(open).setPosition(0, open ? 1 : 0);
            };
            return ball;
        }

        createCaptureBurst(x, y, color) {
            const burst = this.add.graphics({ x, y }).setDepth(47);
            burst.lineStyle(4, color, 0.95);
            for (let ray = 0; ray < 10; ray += 1) {
                const angle = (Math.PI * 2 * ray) / 10;
                burst.lineBetween(
                    Math.cos(angle) * 11,
                    Math.sin(angle) * 11,
                    Math.cos(angle) * 31,
                    Math.sin(angle) * 31,
                );
            }
            burst.fillStyle(0xffffff, 0.92);
            burst.fillCircle(0, 0, 9);
            return burst;
        }

        restoreCaptureTarget() {
            const state = this.captureTargetState;
            if (!state?.sprite) return;
            state.sprite
                .setPosition(state.x, state.y)
                .setScale(state.scaleX, state.scaleY)
                .setAlpha(state.alpha)
                .setVisible(true);
            // The absorb beam tints the sprite red; drop it here too so an
            // interrupted throw can never leave a Pokemon stuck glowing.
            state.sprite.clearTint();
            this.captureTargetState = null;
        }

        async animateCaptureThrow(event) {
            this.captureBall?.destroy();
            this.captureBall = null;
            this.restoreCaptureTarget();
            const actor = this.findView("player", event.actorIndex);
            const targetEntry = this.getFirstVisibleView("enemy");
            if (!actor || !targetEntry) return;
            const start = this.effectPoint(actor);
            const target = this.effectPoint(targetEntry.view);
            if (!start || !target) return;
            // Created hidden: the ball used to sit visibly on the player's
            // base for the length of the trainer's run-in before snapping to
            // the hand. It appears only once it is actually IN a hand -- or,
            // when no throw art exists for this league, at the lead as the
            // pre-trainer sequence had it.
            const ball = this.createCaptureBall(start.x, start.y - 18, event.itemKey)
                .setVisible(false);
            const targetSprite = targetEntry.view.sprite;
            const groundY = targetEntry.view.position.y - 13;
            this.captureBall = ball;
            this.captureTargetState = {
                view: targetEntry.view,
                sprite: targetSprite,
                x: targetSprite.x,
                y: targetSprite.y,
                scaleX: targetSprite.scaleX,
                scaleY: targetSprite.scaleY,
                alpha: targetSprite.alpha,
                groundY,
            };
            if (this.reducedMotion) {
                targetSprite.setScale(0.05).setAlpha(0);
                ball.setPosition(target.x, groundY).setVisible(true);
                return;
            }

            // 0. The trainer runs in at the bottom-left and hurls the ball;
            //    the arc then starts from their hand rather than the Pokemon.
            const throwCharacter = this.intro?.playerThrowCharacter;
            let trainer = null;
            if (throwCharacter && this.textures.exists(`capture-throw-${throwCharacter}-0`)) {
                trainer = this.add.image(-60, 452, `capture-throw-${throwCharacter}-0`)
                    .setOrigin(0.5, 1).setDepth(44).setScale(2);
                await this.tween({ targets: trainer, x: 120, duration: 220, ease: "Quad.easeOut" });
                // The ball's first visible frame is in the hand.
                ball.setPosition(150, 400).setVisible(true);
                await this.playThrowFrames(trainer, throwCharacter);
            } else {
                ball.setVisible(true);
            }

            // 1. Arc the ball over to the target, spinning. The trainer backs
            //    out while the ball flies.
            window.PokemonBattleAudio?.play("throw");
            if (trainer) {
                this.tween({ targets: trainer, x: -60, duration: 260, ease: "Quad.easeIn" })
                    .then(() => trainer.destroy());
            }
            await this.tween({
                targets: ball,
                x: (start.x + target.x) / 2,
                y: Math.min(start.y, target.y) - 115,
                angle: 300,
                duration: CATCH_TIMING.arcUp,
                ease: "Quad.easeOut",
            });
            await this.tween({
                targets: ball,
                x: target.x,
                y: target.y - 6,
                angle: 360,
                duration: CATCH_TIMING.arcDown,
                ease: "Quad.easeIn",
            });

            // 2. The ball hinges open under a white flash -- the DS games have
            //    no beam, just the flash and the red silhouette.
            ball.setAngle(0);
            ball.setOpen(true);
            window.PokemonBattleAudio?.play("open");
            const flash = this.add.circle(target.x, target.y - 6, 26, 0xffffff, 0.95).setDepth(46);
            this.tween({
                targets: flash, scale: 2.1, alpha: 0,
                duration: CATCH_TIMING.openFlash + 160, ease: "Quad.easeOut",
            }).then(() => flash.destroy());
            await delay(CATCH_TIMING.openFlash);

            // 3. The Pokemon turns to red light and is drawn up into the ball.
            targetSprite.setTintFill(0xff5a5a);
            await this.tween({
                targets: targetSprite,
                x: target.x,
                y: target.y - 6,
                scaleX: targetSprite.scaleX * 0.08,
                scaleY: targetSprite.scaleY * 0.08,
                alpha: 0,
                duration: CATCH_TIMING.suck,
                ease: "Cubic.easeIn",
            });
            targetSprite.clearTint();

            // 4. Ball snaps shut, then drops and bounces twice.
            ball.setOpen(false);
            await this.tween({
                targets: ball,
                scaleX: CAPTURE_BALL_SCALE * 0.85, scaleY: CAPTURE_BALL_SCALE * 1.12,
                duration: 80, yoyo: true, ease: "Sine.easeInOut",
            });
            ball.setScale(CAPTURE_BALL_SCALE);
            await this.tween({ targets: ball, y: groundY - 10, duration: CATCH_TIMING.drop, ease: "Quad.easeIn" });
            window.PokemonBattleAudio?.play("bounce");
            await this.tween({ targets: ball, y: groundY - 26, duration: CATCH_TIMING.bounce[0] / 2, ease: "Quad.easeOut" });
            await this.tween({ targets: ball, y: groundY, duration: CATCH_TIMING.bounce[0] / 2, ease: "Quad.easeIn" });
            window.PokemonBattleAudio?.play("bounce");
            await this.tween({ targets: ball, y: groundY - 10, duration: CATCH_TIMING.bounce[1] / 2, ease: "Quad.easeOut" });
            await this.tween({ targets: ball, y: groundY, duration: CATCH_TIMING.bounce[1] / 2, ease: "Quad.easeIn" });
        }

        getFirstVisibleView(side) {
            for (let slot = 0; slot < this.slotViews[side].length; slot += 1) {
                const view = this.slotViews[side][slot];
                if (view?.sprite?.visible) return { slot, view };
            }
            return null;
        }

        async animateCaptureResult(event) {
            const state = this.captureTargetState;
            const target = state?.view;
            const ball = this.captureBall;
            if (!ball || !target || !state) return;
            const shakes = Phaser.Math.Clamp(Number(event.shakes ?? (event.caught ? 3 : 1)), 0, 3);
            if (this.reducedMotion) {
                await delay(140 + shakes * 70);
                if (!event.caught) {
                    this.restoreCaptureTarget();
                    ball.destroy();
                    this.captureBall = null;
                }
                return;
            }

            // Each wobble is a tilt-and-settle with a long beat of stillness
            // after -- the slow DS cadence is what makes the wait feel tense.
            for (let shake = 0; shake < shakes; shake += 1) {
                const direction = shake % 2 === 0 ? 1 : -1;
                await delay(CATCH_TIMING.wobbleGap - CATCH_TIMING.wobbleTilt - CATCH_TIMING.wobbleReturn);
                window.PokemonBattleAudio?.play("shake");
                await this.tween({
                    targets: ball,
                    angle: ball.angle + 26 * direction,
                    x: ball.x + 8 * direction,
                    duration: CATCH_TIMING.wobbleTilt,
                    ease: "Sine.easeOut",
                });
                await this.tween({
                    targets: ball,
                    angle: ball.angle - 26 * direction,
                    x: ball.x - 8 * direction,
                    duration: CATCH_TIMING.wobbleReturn,
                    ease: "Sine.easeInOut",
                });
            }

            if (event.caught) {
                // The click: button flashes, then the stars confirm it.
                await delay(CATCH_TIMING.clickPause);
                window.PokemonBattleAudio?.play("click");
                const click = this.add.circle(ball.x, ball.y, 5, 0xfff6c8, 1).setDepth(48);
                await this.tween({ targets: click, scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 260, ease: "Cubic.easeOut" });
                click.destroy();
                window.PokemonBattleAudio?.play("stars");
                const successBurst = this.createCaptureBurst(ball.x, ball.y, 0xffdd65).setScale(0.45);
                // Three yellow stars pop above the stilled ball, DS style.
                const stars = [[-26, -30], [0, -40], [26, -30]].map(([dx, dy]) => {
                    const star = this.add.star(ball.x, ball.y - 8, 5, 3, 7, 0xffe27a, 1)
                        .setDepth(48).setStrokeStyle(1.5, 0x8d5d1e, 0.8);
                    return this.tween({
                        targets: star,
                        x: ball.x + dx,
                        y: ball.y + dy,
                        angle: dx * 3,
                        alpha: 0,
                        duration: CATCH_TIMING.starPop,
                        ease: "Cubic.easeOut",
                    }).then(() => star.destroy());
                });
                await Promise.all([
                    this.tween({ targets: successBurst, scaleX: 1, scaleY: 1, alpha: 0, duration: 360, ease: "Cubic.easeOut" }),
                    ...stars,
                ]);
                successBurst.destroy();
                await delay(180);
                return;
            }

            // Break out: the ball hinges open and the Pokemon reforms out of
            // the same red light that took it in.
            await delay(160);
            window.PokemonBattleAudio?.play("break");
            ball.setOpen?.(true);
            const escapeBurst = this.createCaptureBurst(ball.x, ball.y, 0x9fe7ff).setScale(0.55);
            state.sprite
                .setPosition(ball.x, ball.y + 12)
                .setScale(state.scaleX * 0.08, state.scaleY * 0.08)
                .setAlpha(0)
                .setVisible(true);
            state.sprite.setTintFill(0xff5a5a);
            await Promise.all([
                this.tween({
                    targets: ball,
                    scaleX: CAPTURE_BALL_SCALE * 1.5, scaleY: CAPTURE_BALL_SCALE * 1.5,
                    alpha: 0, angle: ball.angle + 55,
                    duration: CATCH_TIMING.breakout, ease: "Quad.easeOut",
                }),
                this.tween({ targets: escapeBurst, scaleX: 1.35, scaleY: 1.35, alpha: 0, duration: 360, ease: "Cubic.easeOut" }),
                this.tween({
                    targets: state.sprite,
                    x: state.x,
                    y: state.y,
                    scaleX: state.scaleX,
                    scaleY: state.scaleY,
                    alpha: state.alpha,
                    duration: 390,
                    ease: "Back.easeOut",
                }),
            ]);
            // Fade the light off the sprite once it is back in place.
            state.sprite.setPosition(state.x, state.y).setScale(state.scaleX, state.scaleY).setAlpha(state.alpha);
            state.sprite.clearTint();
            escapeBurst.destroy();
            ball.destroy();
            this.captureBall = null;
            this.captureTargetState = null;
        }

        finishCaptureAnimation(event) {
            if (!event.caught) return;
            this.captureBall?.destroy();
            this.captureBall = null;
            this.captureTargetState = null;
        }

        tween(config) {
            if (this.reducedMotion) {
                if (config.targets && config.x !== undefined) config.targets.x = typeof config.x === "number" ? config.x : config.targets.x;
                return Promise.resolve();
            }
            return new Promise((resolve) => {
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(failsafe);
                    resolve();
                };
                const duration = Number(config.duration) || 0;
                const initialDelay = Number(config.delay) || 0;
                const cycles = Math.max(1, (Number(config.repeat) || 0) + 1) * (config.yoyo ? 2 : 1);
                const failsafe = window.setTimeout(finish, initialDelay + duration * cycles + 450);
                this.tweens.add({ ...config, onComplete: finish, onStop: finish });
            });
        }

        effectPoint(view) {
            if (!view?.sprite) return null;
            const bounds = view.sprite.getBounds();
            return { x: bounds.centerX, y: bounds.centerY };
        }

        createEffectSprite(effect, x, y, scaleMultiplier = 1) {
            const sprite = this.add.sprite(x, y, effect.textureKey, 0)
                .setScale(effect.scale * scaleMultiplier)
                .setDepth(30);
            if (effect.additive) sprite.setBlendMode(Phaser.BlendModes.ADD);
            if (this.anims.exists(effect.animationKey)) sprite.play(effect.animationKey);
            return sprite;
        }

        async battlefieldFlash(effect) {
            if (this.reducedMotion) return;
            const flash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, effect.tint, effect.heavy ? 0.13 : 0.075)
                .setDepth(24);
            await this.tween({ targets: flash, alpha: 0, duration: effect.heavy ? 260 : 180, ease: "Quad.easeOut" });
            flash.destroy();
        }

        async animateImpact(effect, target, offsetX = 0, offsetY = 0, scaleMultiplier = 1) {
            const sprite = this.createEffectSprite(effect, target.x + offsetX, target.y + offsetY, scaleMultiplier);
            const finalScale = effect.scale * scaleMultiplier * 1.34;
            await this.tween({
                targets: sprite,
                scaleX: finalScale,
                scaleY: finalScale,
                alpha: 0,
                angle: 35,
                duration: effect.duration,
                ease: "Cubic.easeOut",
            });
            sprite.destroy();
        }

        async animateProjectile(effect, source, target, index = 0, total = 1, arcing = false) {
            if (index > 0) await delay(index * 42);
            const spread = total > 1 ? (index - (total - 1) / 2) * 15 : 0;
            const start = { x: source.x, y: source.y + spread * 0.35 };
            const end = { x: target.x, y: target.y + spread };
            const sprite = this.createEffectSprite(effect, start.x, start.y, total > 1 ? 0.82 : 1);
            sprite.setAngle(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI);
            if (arcing) {
                const midpoint = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 58 - index * 4 };
                await this.tween({ targets: sprite, x: midpoint.x, y: midpoint.y, angle: sprite.angle + 100, duration: effect.duration * 0.48, ease: "Quad.easeOut" });
                await this.tween({ targets: sprite, x: end.x, y: end.y, angle: sprite.angle + 180, duration: effect.duration * 0.52, ease: "Quad.easeIn" });
            } else {
                await this.tween({ targets: sprite, x: end.x, y: end.y, angle: sprite.angle + 45, duration: effect.duration, ease: "Sine.easeInOut" });
            }
            sprite.destroy();
            await this.animateImpact(effect, target, spread * 0.2, spread * 0.25, total > 1 ? 0.55 : 0.75);
        }

        async animateStrike(effect, target) {
            const count = effect.heavy ? 3 : 1;
            const strikes = Array.from({ length: count }, async (_, index) => {
                if (index > 0) await delay(index * 55);
                const offsetX = (index - (count - 1) / 2) * 22;
                const sprite = this.createEffectSprite(effect, target.x + offsetX, target.y - 72, count > 1 ? 0.72 : 1);
                await this.tween({ targets: sprite, y: target.y + 4, alpha: 0.15, duration: effect.duration * 0.62, ease: "Expo.easeIn" });
                sprite.destroy();
                return this.animateImpact(effect, target, offsetX, 0, count > 1 ? 0.58 : 0.78);
            });
            await Promise.all(strikes);
        }

        async animateRise(effect, target) {
            const count = Math.max(3, effect.particles);
            await Promise.all(Array.from({ length: count }, async (_, index) => {
                if (index > 0) await delay(index * 38);
                const offsetX = (index - (count - 1) / 2) * 28;
                const sprite = this.createEffectSprite(effect, target.x + offsetX, target.y + 38, 0.62 + index * 0.08);
                await this.tween({
                    targets: sprite,
                    y: target.y - 12 - (index % 2) * 16,
                    alpha: 0,
                    angle: index % 2 ? 75 : -75,
                    duration: effect.duration,
                    ease: "Back.easeOut",
                });
                sprite.destroy();
            }));
        }

        async animateOrbit(effect, source, target) {
            const count = Math.max(4, effect.particles);
            await Promise.all(Array.from({ length: count }, async (_, index) => {
                if (index > 0) await delay(index * 28);
                const angle = (Math.PI * 2 * index) / count;
                const sprite = this.createEffectSprite(effect, source.x + Math.cos(angle) * 38, source.y + Math.sin(angle) * 28, 0.68);
                await this.tween({
                    targets: sprite,
                    x: target.x + Math.cos(angle) * 10,
                    y: target.y + Math.sin(angle) * 10,
                    angle: 220,
                    duration: effect.duration + index * 10,
                    ease: "Cubic.easeIn",
                });
                sprite.destroy();
            }));
            await this.animateImpact(effect, target, 0, 0, 0.9);
        }

        async animateBurst(effect, target) {
            const count = Math.max(4, effect.particles);
            await Promise.all(Array.from({ length: count }, (_, index) => {
                const angle = (Math.PI * 2 * index) / count;
                return this.animateImpact(effect, target, Math.cos(angle) * 28, Math.sin(angle) * 22, 0.65 + (index % 2) * 0.2);
            }));
        }

        async animateAttacker(view, targetPoint, effect) {
            if (!view || this.reducedMotion) return;
            const sprite = view.sprite;
            if (effect.motion === "impact") {
                const dx = Phaser.Math.Clamp(targetPoint.x - sprite.x, -58, 58);
                const dy = Phaser.Math.Clamp(targetPoint.y - sprite.y, -22, 22);
                await this.tween({ targets: sprite, x: sprite.x + dx, y: sprite.y + dy, duration: 105, yoyo: true, ease: "Quad.easeOut" });
                return;
            }
            await this.tween({ targets: sprite, scaleX: sprite.scaleX * 1.06, scaleY: sprite.scaleY * 1.06, duration: 90, yoyo: true, ease: "Sine.easeOut" });
        }

        // `isRepeat` marks the 2nd..Nth blow of a multi-hit move: the follow-up
        // strikes reuse the effect but skip the attacker's wind-up, so five
        // hits stay snappy instead of replaying the full lunge each time.
        async animateMoveEffect(event, isRepeat = false) {
            const actorView = this.findView(event.side, event.actorIndex);
            const targetView = this.findView(event.targetSide, event.targetIndex);
            if (!actorView || !targetView || !this.moveEffects) return;
            const effect = this.moveEffects.resolveMoveEffect(event);
            const source = this.effectPoint(actorView);
            const target = this.effectPoint(targetView);
            if (this.reducedMotion) {
                const sprite = this.createEffectSprite(effect, target.x, target.y, 0.72).setAlpha(0.75);
                await delay(70);
                sprite.destroy();
                return;
            }

            // Showdown's hand-tuned choreography first; anything it does not
            // cover -- and any adapter failure -- falls through to the
            // archetype system, so a move never loses its animation entirely.
            // Multi-hit repeats keep the light archetype replay: replaying a
            // full Showdown sequence five times is slower than the game
            // should feel.
            // Showdown keys are compact ids: "swordsdance", not "swords-dance".
            const slug = String(event.moveSlug || "").replace(/-/g, "");
            // The move travels with the slug so the adapter can pick one of
            // Showdown's shared animations when the move has no bespoke one.
            const moveInfo = {
                slug,
                damageClass: event.damageClass,
                power: event.movePower,
                type: event.moveType,
                selfTargeted: event.targetSide === event.side && event.targetIndex === event.actorIndex,
            };
            // The handheld's own scripted animation outranks Showdown's
            // choreography where we carry one -- the exact ROM look is the
            // point. Reduced motion already took the quiet path above, and
            // multi-hit repeats keep the light replay.
            if (!isRepeat && DS_CHOREOGRAPHIES[slug]) {
                try {
                    await Promise.all([
                        DS_CHOREOGRAPHIES[slug](this, actorView, targetView, event),
                        this.playMoveGestures(slug, actorView, targetView),
                    ]);
                    return;
                } catch (error) {
                    console.warn("ds choreography failed, falling back:", slug, error);
                }
            }
            if (!isRepeat && this.showdownAnims?.hasAnim(slug, moveInfo)) {
                try {
                    await Promise.all([
                        this.showdownAnims.playMove(slug, actorView, targetView, moveInfo),
                        // The handheld's own hits, played alongside the
                        // choreography rather than instead of it.
                        this.playMoveGestures(slug, actorView, targetView),
                    ]);
                    return;
                } catch (error) {
                    console.warn("showdown anim failed, falling back:", slug, error);
                }
            }

            if (effect.heavy && !isRepeat) this.cameras.main.shake(110, 0.0018);
            const actorAnimation = isRepeat
                ? Promise.resolve()
                : this.animateAttacker(actorView, target, effect);
            let effectAnimation;
            if (effect.motion === "impact") effectAnimation = this.animateImpact(effect, target);
            else if (effect.motion === "strike") effectAnimation = this.animateStrike(effect, target);
            else if (effect.motion === "rise") effectAnimation = this.animateRise(effect, target);
            else if (effect.motion === "orbit") effectAnimation = this.animateOrbit(effect, source, target);
            else if (effect.motion === "burst") effectAnimation = this.animateBurst(effect, target);
            else {
                const count = effect.motion === "volley" ? Math.max(3, effect.particles) : 1;
                effectAnimation = Promise.all(Array.from({ length: count }, (_, index) => this.animateProjectile(
                    effect,
                    source,
                    target,
                    index,
                    count,
                    effect.motion === "arc",
                )));
            }
            await Promise.all([
                actorAnimation,
                effectAnimation,
                isRepeat ? Promise.resolve() : this.battlefieldFlash(effect),
            ]);
        }

        async animateEvent(event) {
            if (event.type === "move") {
                // A spread move arrives once per target. Animate the attack on
                // the first only -- the follow-ups still land their damage,
                // which the "damage" events flash and shake for.
                if (event.spreadFollowUp) return;
                // Coming out of Fly/Dig/Dive before the attack lands.
                await this.revealHiddenSprite(event.side, event.actorIndex);
                // A multi-hit move plays its effect once per blow, so Double
                // Kick reads as two strikes rather than one.
                const hits = Phaser.Math.Clamp(Number(event.hits) || 1, 1, 5);
                for (let hit = 0; hit < hits; hit += 1) {
                    await this.animateMoveEffect(event, hit > 0);
                    if (hit < hits - 1) await delay(this.reducedMotion ? 40 : 110);
                }
            } else if (event.type === "damage") {
                const view = this.findView(event.side, event.targetIndex);
                if (view) {
                    if (event.damage > 0) {
                        const effectiveness = Number(event.effectiveness);
                        window.PokemonBattleAudio?.play(effectiveness > 1 ? "hit-super"
                            : effectiveness > 0 && effectiveness < 1 ? "hit-weak" : "hit-normal");
                    }
                    if (!this.reducedMotion) this.cameras.main.shake(90, 0.0025);
                    await Promise.all([
                        this.animateHealth(event.side, event.targetIndex, event.newHp, event.maxHp),
                        this.tween({ targets: view.sprite, alpha: 0.25, duration: 80, yoyo: true, repeat: 1 }),
                    ]);
                }
            } else if (event.type === "item") {
                await this.animateHealth("player", event.targetIndex, event.newHp, event.maxHp);
                const view = this.findView("player", event.targetIndex);
                if (view) await this.tween({ targets: view.sprite, alpha: 0.45, duration: 100, yoyo: true, repeat: 1 });
            } else if (event.type === "heal") {
                if ((event.amount ?? 1) > 0) window.PokemonBattleAudio?.play("heal");
                await this.animateHealth(event.side, event.targetIndex, event.newHp, event.maxHp);
                const view = this.findView(event.side, event.targetIndex);
                if (view) await this.tween({ targets: view.sprite, alpha: 0.55, duration: 120, yoyo: true, repeat: 1 });
            } else if (event.type === "stat") {
                await this.animateStatChange(event);
            } else if (event.type === "mega") {
                await this.animateMegaEvolution(event);
            } else if (event.type === "transform") {
                await this.animateTransform(event);
            } else if (event.type === "weather") {
                await this.applyWeatherVisual(event.phase === "end" ? null : event.weather);
            } else if (event.type === "terrain") {
                await this.applyTerrainVisual(event.phase === "end" ? null : event.terrain);
            } else if (event.type === "hazard" || event.type === "screen") {
                // The message carries the meaning; a short pulse marks it.
                if (!this.reducedMotion && this.fieldBanner) {
                    await this.tween({ targets: this.fieldBanner, alpha: 0.95, duration: 120, yoyo: true });
                }
            } else if (event.type === "charge") {
                await this.animateChargeUp(event);
            } else if (event.type === "ability") {
                // A gold shimmer marks an ability trigger apart from a status.
                const view = Number.isInteger(event.targetIndex) ? this.findView(event.side, event.targetIndex) : null;
                this.refreshStatusChip(event.side, event.targetIndex);
                if (view && !this.reducedMotion) {
                    const glow = this.add.circle(view.sprite.x, view.sprite.y - view.sprite.displayHeight / 2, 30, 0xffe9a0, 0.5).setDepth(46);
                    await Promise.all([
                        this.tween({ targets: glow, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 300, ease: "Cubic.easeOut" }),
                        this.tween({ targets: view.sprite, alpha: 0.6, duration: 90, yoyo: true, repeat: 1 }),
                    ]);
                    glow.destroy();
                }
            } else if (event.type === "status") {
                const view = Number.isInteger(event.targetIndex) ? this.findView(event.side, event.targetIndex) : null;
                // sync() is inert while events play, so refresh the chip here or
                // a status would not show until the turn ended.
                this.refreshStatusChip(event.side, event.targetIndex);
                if (view) await this.tween({ targets: view.sprite, alpha: 0.55, duration: 85, yoyo: true, repeat: 1 });
            } else if (event.type === "faint") {
                const view = this.findView(event.side, event.targetIndex);
                const fallen = this.engine.teams[event.side]?.[event.targetIndex];
                window.PokemonBattleAudio?.play("faint");
                if (fallen) window.PokemonBattleAudio?.playCry(this.crySlugFor(fallen));
                this.refreshStatusChip(event.side, event.targetIndex);
                if (view) await this.tween({ targets: view.sprite, y: view.sprite.y + 32, alpha: 0, duration: 260, ease: "Quad.easeIn" });
            } else if (event.type === "switch") {
                this.showPokemon(event.side, event.slot, event.targetIndex);
                this.announceArrival(event.side, event.slot);
                const view = this.slotViews[event.side][event.slot];
                if (view && !this.reducedMotion) {
                    view.sprite.setAlpha(0).setY(view.position.y + 24);
                    await this.tween({ targets: view.sprite, y: view.position.y, alpha: 1, duration: 260, ease: "Back.easeOut" });
                }
            } else if (event.type === "capture-throw") {
                await this.animateCaptureThrow(event);
            } else if (event.type === "capture") {
                await this.animateCaptureResult(event);
            }
        }

        async playEvents(events, onMessage, waitForAdvance) {
            this.playingEvents = true;
            // An animation is decoration: if one throws, the turn still has to
            // finish. Letting it reject used to abort the caller mid-turn --
            // after a capture that meant the "party or PC?" prompt never
            // opened and the caught Pokemon was quietly dropped.
            const animate = async (event) => {
                try {
                    await this.animateEvent(event);
                } catch (error) {
                    console.warn("battle animation failed:", event.type, event.moveSlug || "", error);
                }
            };
            try {
                for (const event of events) {
                    if (event.type === "capture") {
                        await animate(event);
                        if (event.message && typeof onMessage === "function") onMessage(event.message, event.type);
                        if (event.message && typeof waitForAdvance === "function") await waitForAdvance(event);
                        else if (event.message) await delay(this.reducedMotion ? 160 : 680);
                        try {
                            this.finishCaptureAnimation(event);
                        } catch (error) {
                            console.warn("capture cleanup failed:", error);
                        }
                        continue;
                    }
                    if (event.message && typeof onMessage === "function") onMessage(event.message, event.type);
                    if (event.message && typeof waitForAdvance === "function") await waitForAdvance(event);
                    else if (event.message) await delay(this.reducedMotion ? 160 : event.type === "turn" ? 420 : 680);
                    await animate(event);
                }
            } finally {
                this.playingEvents = false;
            }
        }
    }

    async function createGame(parent, engine, staticPrefix, battlefield, intro) {
        // The Showdown fx manifest rides in through the bootstrap like the
        // engine does; a missing file just means no Showdown animations.
        // Bumped whenever the generators rewrite these manifests -- without
        // it the browser serves a stale copy and the schema silently drifts
        // out from under the loader.
        const MANIFEST_VERSION = "20260808-12";
        const fxManifest = await fetch(`${staticPrefix}games/assets/pokemon/showdown-fx/manifest.json?v=${MANIFEST_VERSION}`)
            .then((response) => (response.ok ? response.json() : { files: {} }))
            .catch(() => ({ files: {} }));
        // DS particle dressing, decoded from the owner's HeartGold ROM; the
        // map is move slug -> one texture. Missing file means no dressing.
        const dsParticles = await fetch(`${staticPrefix}games/assets/pokemon/ds-particles/moves.json?v=${MANIFEST_VERSION}`)
            .then((response) => (response.ok ? response.json() : { moves: {} }))
            .catch(() => ({ moves: {} }));
        return new Promise((resolve) => {
            let game;
            PokemonBattleScene.bootstrap = {
                engine,
                staticPrefix,
                battlefield,
                fxManifest,
                dsParticles,
                intro: intro || null,
                onReady: (scene) => {
                    if (root.PokemonBattleView) root.PokemonBattleView.activeScene = scene;
                    resolve({ game, scene });
                },
            };
            game = new Phaser.Game({
                type: Phaser.AUTO,
                width: WIDTH,
                height: HEIGHT,
                parent,
                transparent: true,
                pixelArt: true,
                antialias: false,
                roundPixels: true,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                    width: WIDTH,
                    height: HEIGHT,
                },
                scene: PokemonBattleScene,
                callbacks: {
                    preBoot(phaserGame) {
                        phaserGame.registry.set("battleEngine", engine);
                    },
                },
            });
        });
    }

    root.PokemonBattleView = { createGame, dsChoreographies: DS_CHOREOGRAPHIES };
}(window));
