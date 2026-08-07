(function (root) {
    "use strict";

    const WIDTH = 960;
    const HEIGHT = 480;
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

    const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    class PokemonBattleScene extends Phaser.Scene {
        constructor() {
            super({ key: "PokemonBattle" });
            this.slotViews = { player: [], enemy: [] };
            this.slotTeamIndices = { player: [], enemy: [] };
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
            // battle -- one texture per move keeps the load bounded (the full
            // set is 1689 images).
            const dsMoves = this.dsParticles.moves || {};
            ["player", "enemy"].forEach((side) => {
                (this.engine.teams[side] || []).forEach((pokemon) => {
                    (pokemon.moves || []).forEach((move) => {
                        const slug = String(move.slug || "").replace(/-/g, "");
                        const entry = dsMoves[slug];
                        if (!entry?.texture) return;
                        this.load.image(`dsp-${slug}`,
                            this.spriteUrl(`games/assets/pokemon/ds-particles/${entry.texture}?v=3`));
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
                    overrideFor: (slug) => {
                        const key = `dsp-${slug}`;
                        return this.textures.exists(key) ? key : null;
                    },
                    // How that texture wants to be drawn. Most DS particles
                    // are grey masks the handheld coloured from its emitter,
                    // so they carry their move's type colour here. The ones
                    // that are drawn objects rather than glows also ask for
                    // normal blending: additive drops their dark outline and
                    // lets the backdrop halo through the art.
                    dsStyleFor: (slug) => {
                        const entry = (this.dsParticles.moves || {})[slug];
                        if (!entry) return null;
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

        // Stone flash, burst, then the form swap. The new sprite has to be
        // loaded on the fly because the mega form was never on the field when
        // preload() ran.
        async animateMegaEvolution(event) {
            const view = Number.isInteger(event.targetIndex) ? this.findView(event.side, event.targetIndex) : null;
            if (!view) return;
            const sprite = view.sprite;
            const centreX = sprite.x;
            const centreY = sprite.y - sprite.displayHeight / 2;

            if (!this.reducedMotion) {
                const stone = this.add.circle(centreX, centreY - 46, 9, 0xf5d16b, 1).setDepth(62);
                const halo = this.add.circle(centreX, centreY, 18, 0xd9a8ff, 0.55).setDepth(61);
                await Promise.all([
                    this.tween({ targets: stone, y: centreY, duration: 380, ease: "Cubic.easeIn" }),
                    this.tween({ targets: halo, scaleX: 2.6, scaleY: 2.6, alpha: 0.85, duration: 380 }),
                ]);
                await this.tween({ targets: [stone, halo], scaleX: 4.4, scaleY: 4.4, alpha: 0, duration: 300, ease: "Cubic.easeOut" });
                stone.destroy();
                halo.destroy();
                const flash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(63);
                await this.tween({ targets: flash, fillAlpha: 0.85, duration: 130 });
                await this.swapMegaSprite(event, view);
                await this.tween({ targets: flash, fillAlpha: 0, duration: 260 });
                flash.destroy();
            } else {
                await this.swapMegaSprite(event, view);
            }
            this.refreshStatusChip(event.side, event.targetIndex);
        }

        // Load and apply the mega form's artwork, keeping the Pokemon's feet
        // planted on its platform.
        async swapMegaSprite(event, view) {
            const path = event.side === "player"
                ? (event.sprites?.back || event.sprites?.front)
                : event.sprites?.front;
            if (!path) return;
            const key = `${this.textureKey(event.side, event.targetIndex)}-mega`;
            const animationKey = `${this.idleAnimationKey(event.side, event.targetIndex)}-mega`;
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
            const megaHasFrames = this.anims.exists(animationKey)
                && this.textures.get(key).has("0");
            view.sprite.setTexture(key, megaHasFrames ? "0" : undefined);
            view.sprite.setPosition(view.position.x, view.position.y).setAlpha(1).setVisible(true);
            this.fitSprite(view.sprite, event.side);
            if (megaHasFrames) view.sprite.play(animationKey);
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
            const sprite = this.add.sprite(position.x, position.y, "__DEFAULT").setOrigin(0.5, 1);
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
            const idleKey = this.idleAnimationKey(side, teamIndex);
            // sync() re-runs this for every slot after every turn. Re-seating
            // the texture and calling play() again restarted the idle loop
            // from frame 0 each time, which is what made the GIFs stutter and
            // snap back. Only touch the sprite when the occupant changed.
            const alreadyShown = this.slotTeamIndices[side][slot] === teamIndex
                && view.sprite.visible
                && (!animated || !this.anims.exists(idleKey) || view.sprite.anims?.getName() === idleKey);
            if (!alreadyShown) {
                view.sprite.stop();
                const textureKey = animated ? this.textureKey(side, teamIndex) : this.cleanTextureKey(side, teamIndex);
                // The decoded texture names its frames "0".."N"; the static
                // fallback only has the base frame.
                const hasFrames = animated && this.textures.exists(textureKey)
                    && this.textures.get(textureKey).has("0");
                view.sprite.setTexture(textureKey, hasFrames ? "0" : undefined);
                view.sprite.setPosition(view.position.x, view.position.y).setAlpha(1).setVisible(true);
                this.fitSprite(view.sprite, side);
                if (animated && this.anims.exists(idleKey)) view.sprite.play(idleKey);
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

        findView(side, teamIndex) {
            const slot = this.slotTeamIndices[side].indexOf(teamIndex);
            return slot < 0 ? null : this.slotViews[side][slot];
        }

        updateHealth(side, teamIndex, hp, maxHp) {
            const view = this.findView(side, teamIndex);
            if (!view) return;
            const ratio = Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1);
            const color = ratio > 0.5 ? 0x50bf6b : ratio > 0.2 ? 0xe5b93f : 0xdf554f;
            view.hpBar.setFillStyle(color);
            view.hpBar.width = Math.max(0, HP_BAR_WIDTH * ratio);
            view.hpText.setText(`${hp}/${maxHp}`);
        }

        async animateHealth(side, teamIndex, hp, maxHp) {
            const view = this.findView(side, teamIndex);
            if (!view) return;
            if (this.reducedMotion) {
                this.updateHealth(side, teamIndex, hp, maxHp);
                await delay(120);
                return;
            }
            const ratio = Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1);
            const color = ratio > 0.5 ? 0x50bf6b : ratio > 0.2 ? 0xe5b93f : 0xdf554f;
            const displayedHp = Number(String(view.hpText.text).split("/")[0]) || 0;
            const counter = { value: displayedHp };
            view.hpBar.setFillStyle(color);
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
                    onUpdate: () => view.hpText.setText(`${Math.round(counter.value)}/${maxHp}`),
                }),
            ]);
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

                // --- enemy side first, as the DS games order it ---
                const enemyViews = activeViews("enemy");
                if (this.intro.enemyTrainerSpriteUrl && this.textures.exists("intro-enemy-trainer") && enemyViews.length) {
                    const anchor = enemyViews[0];
                    const trainer = this.add.image(anchor.position.x + 70, anchor.position.y, "intro-enemy-trainer")
                        .setOrigin(0.5, 1).setDepth(44).setScale(2);
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

                // --- player side: the back sprite winds up and throws ---
                const playerViews = activeViews("player");
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
            } finally {
                // Whatever happened, nobody stays invisible.
                showAll();
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
            const ball = this.createCaptureBall(start.x, start.y - 18, event.itemKey);
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
                ball.setPosition(target.x, groundY);
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
                ball.setPosition(150, 400);
                await this.playThrowFrames(trainer, throwCharacter);
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
            if (!isRepeat && this.showdownAnims?.hasAnim(slug, moveInfo)) {
                try {
                    await this.showdownAnims.playMove(slug, actorView, targetView, moveInfo);
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
        const MANIFEST_VERSION = "20260808-4";
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

    root.PokemonBattleView = { createGame };
}(window));
