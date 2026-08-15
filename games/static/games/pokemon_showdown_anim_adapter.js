(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.PokemonShowdownAnimAdapter = factory();
}(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    // Showdown's own projection, ported verbatim from battle-animations.ts
    // pos(): their space has x across, y up, z toward the far side, and the
    // near (player) side sits at z=0 while the far side sits at z=200. One
    // affine, calibrated from their two side bases onto our two platform
    // midpoints, turns their stage into ours; each participant's their-space
    // coordinates are then back-solved so an anim aimed at a sprite lands on
    // the real sprite, not the side midpoint.
    const SD = {
        baseLeft: 210, baseTop: 245, spanLeft: 220, spanTop: -110,
        // Showdown shrinks the far side with depth -- their scale runs 2.0 at
        // the near row down to 1.0 at the far one. This stage does not: both
        // rows draw their Pokemon at the same size. Keeping their perspective
        // made every effect aimed at the player's row twice as large and
        // twice as far from its target as the same effect aimed at the
        // enemy's, which threw half of Crunch's jaw off the bottom of the
        // canvas. A flat scale matches the stage, and because solve() uses
        // the same number the participants still land on their own sprites.
        FLAT_SCALE: 1.0,
        project(loc) {
            const z = loc.z || 0;
            const scale = SD.FLAT_SCALE;
            return {
                left: SD.baseLeft + SD.spanLeft * (z / 200) + (loc.x || 0) * scale,
                top: SD.baseTop + SD.spanTop * (z / 200) - (loc.y || 0) * scale,
                scale,
            };
        },
        // Inverse: which their-space x/y puts project() onto this left/top,
        // for a fixed side depth z.
        solve(left, top, z) {
            const scale = SD.FLAT_SCALE;
            return {
                x: (left - SD.baseLeft - SD.spanLeft * (z / 200)) / scale,
                y: (SD.baseTop + SD.spanTop * (z / 200) - top) / scale,
                z,
            };
        },
    };

    const EASES = {
        linear: "Linear", swing: "Sine.easeInOut", quadratic: "Quad.easeInOut",
        accel: "Quad.easeIn", decel: "Quad.easeOut", ballistic: "Cubic.easeOut",
        ballistic2: "Cubic.easeIn", ballistic2Under: "Quad.easeIn",
        ballisticUp: "Cubic.easeOut", ballisticUnder: "Quad.easeInOut",
        doubleRebound: "Bounce.easeOut", bounce: "Bounce.easeOut",
    };
    const easeFor = (name) => EASES[name] || "Linear";

    function createAdapter(scene, options) {
        // The factory does not close over the UMD wrapper's `root` parameter
        // (it is a sibling argument, not an enclosing scope), so the data
        // module is read off the global directly.
        const tables = globalThis.PokemonShowdownMoveAnims;
        if (!tables) return { hasAnim: () => false, playMove: () => Promise.resolve() };

        // Waits use the wall clock for the same reason the tween failsafe does:
        // a sleeping scene clock must not strand a battle mid-animation.
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
        // Showdown's timings are written for its own stage and play a touch
        // hurried here, where the sprites are larger and there is more to
        // read. Every duration and delay the choreography supplies passes
        // through this, so the whole sequence keeps its shape and only its
        // pace changes.
        const TIME_SCALE = 1.25;
        const beat = (ms) => Math.round(Math.max(0, Number(ms) || 0) * TIME_SCALE);
        // Phaser drops a tween whose target has been destroyed without ever
        // firing onComplete. Cleanup destroys effect images every move, so a
        // plain onComplete promise could hang the battle forever -- onStop
        // and a duration-based failsafe guarantee it always settles.
        const tween = (targets, config) => new Promise((resolve) => {
            let settled = false;
            const finish = () => { if (!settled) { settled = true; resolve(); } };
            scene.tweens.add({ targets, ...config, onComplete: finish, onStop: finish });
            // Wall-clock, not the scene clock: if the loop is asleep -- a
            // backgrounded tab, a hidden canvas -- the scene clock stops too,
            // and a battle waiting on this promise would never continue.
            setTimeout(finish, (config.duration || 0) + 600);
        });

        // ---- affine: their stage -> our canvas --------------------------------
        // Calibrated per playMove from the participating views, but the side
        // bases are stable, so the mapping is computed once from the scene's
        // platform midpoints and reused.
        let affine = null;
        function calibrate() {
            if (affine) return affine;
            const mid = (side) => {
                const views = scene.slotViews[side].filter(Boolean);
                const xs = views.map((view) => view.position.x);
                const ys = views.map((view) => view.position.y);
                return {
                    x: xs.reduce((a, b) => a + b, 0) / xs.length,
                    y: ys.reduce((a, b) => a + b, 0) / ys.length,
                };
            };
            const near = mid("player");                    // their z = 0
            const far = mid("enemy");                      // their z = 200
            const nearBase = SD.project({ x: 0, y: 0, z: 0 });
            const farBase = SD.project({ x: 0, y: 0, z: 200 });
            const ax = (far.x - near.x) / (farBase.left - nearBase.left);
            const bx = near.x - ax * nearBase.left;
            const ay = (far.y - near.y) / (farBase.top - nearBase.top);
            const by = near.y - ay * nearBase.top;
            affine = {
                toCanvas(projected) {
                    return { x: ax * projected.left + bx, y: ay * projected.top + by };
                },
                fromCanvas(x, y) {
                    return { left: (x - bx) / ax, top: (y - by) / ay };
                },
                effectScale: Math.abs(ax),
            };
            return affine;
        }

        function place(loc) {
            const map = calibrate();
            const projected = SD.project(loc);
            const point = map.toCanvas(projected);
            // effectScale is how much wider this stage is than their coordinate
            // space (1.86x). That is the whole correction. There used to be a
            // further * 0.5 here, and it belonged to the perspective project()
            // once had: their scale ran 2.0 at the near row, so 2.0 * ratio *
            // 0.5 came back to ratio. Flattening that scale to 1.0 left the
            // halving behind with nothing to undo, and every effect drew at
            // half size -- rocks landed at 18px against a 190px Pokemon, which
            // is where the MIN_EFFECT_PX floor was quietly catching them.
            return { x: point.x, y: point.y, scale: projected.scale * map.effectScale };
        }

        // ---- effect sprites ---------------------------------------------------
        const live = new Set();
        // Slug of the move currently playing, for the DS-particle dressing.
        let currentSlug = null;
        // Counts the effects one play spawns. A move whose choreography
        // fires the same effect over and over would otherwise wear a
        // single piece of its art throughout; walking the counter hands
        // successive spawns different pieces, which is how the handheld
        // looks when several emitters run at once. Each sprite keeps
        // whatever it was given for its whole life, so nothing flickers.
        let spawnOrder = 0;

        // Showdown names the effect it is spawning -- 'fire1', 'wisp',
        // 'rock1'. Turning that name into a small stable number lets a move
        // hand each of its effects a different piece of its own art, while
        // the same effect always gets the same piece rather than flickering.
        function variantOf(effect) {
            const name = effect && typeof effect === "object"
                ? String(effect.url || "")
                : String(effect ?? "");
            let hash = 0;
            for (let i = 0; i < name.length; i += 1) {
                hash = (hash * 31 + name.charCodeAt(i)) | 0;
            }
            return Math.abs(hash);
        }

        // Showdown's effect names carry shape. 'topbite' and 'bottombite'
        // are the two halves of a mouth; 'rightslash' and 'leftclaw' are
        // marks. That has to reach the art picker, because a DS set holds
        // several unrelated pieces and choosing between them by hash knows
        // nothing about what it is dressing -- it put the upper jaw on the
        // bottom as often as the top, and drew Scratch as the round burst
        // that shares its archive rather than the claw mark.
        function roleOf(effect) {
            const raw = effect && typeof effect === "object"
                ? String(effect.url || "")
                : String(effect ?? "");
            const name = raw.split("/").pop().replace(/\.(?:png|jpg)$/, "");
            if (name.startsWith("top")) return "top";
            if (name.startsWith("bottom")) return "bottom";
            if (/slash|claw/.test(name)) return "streak";
            return null;
        }

        function textureKeyFor(effect, variant, role) {
            // The current move's HeartGold particle art, when staged,
            // dresses every effect the choreography spawns.
            const override = currentSlug && options.overrideFor
                ? options.overrideFor(currentSlug, variant, role) : null;
            if (override) return override;
            if (effect && typeof effect === "object") {
                const match = String(effect.url || "").match(/fx\/([\w.-]+)\.(?:png|jpg)/);
                if (match && options.textureFor(match[1])) return options.textureFor(match[1]);
                return options.textureFor("wisp");
            }
            return options.textureFor(String(effect)) || options.textureFor("wisp");
        }

        // Showdown's scale numbers assume its own art -- roughly a 100px
        // wisp. A DS particle is 12-50px, so the same scale renders it either
        // invisible or screen-filling (Signal Beam came out at 29px, Thunder
        // Wave at 933px). Every swapped texture is normalised to the size the
        // choreography was written against.
        // These two were fitted by eye while place() was still halving, so
        // they absorbed the halving: 36 * 1.86 is the same 67px on screen that
        // 72 * 0.93 was. Both are halved alongside the fix so the DS-dressed
        // moves keep the exact sizes their contact sheets were reviewed at --
        // the bug was in Showdown's own art, and only that should change.
        const SHOWDOWN_REFERENCE_PX = 36;
        // A DS particle is pixel art from a 256px-wide screen. Blowing a
        // 12px puff up to the full reference size reads as a blurry smear, so
        // the enlargement is capped and small art simply stays small. Halved
        // with the reference above, and for the same reason.
        const DS_MAX_MAGNIFICATION = 1.5;
        // Nothing on a 960x480 stage should be a 1500px smear or a 12px
        // speck. Thunder Wave's own choreography ends at 27x, which is fine
        // for Showdown's stage and absurd on ours.
        const MIN_EFFECT_PX = 18;
        const MAX_EFFECT_PX = 170;

        function sizeCorrection(key, image) {
            if (!String(key).startsWith("dsp-")) return 1;
            const natural = Math.max(image.width, image.height);
            if (!natural) return 1;
            return Math.min(SHOWDOWN_REFERENCE_PX / natural, DS_MAX_MAGNIFICATION);
        }

        // Clamp a requested scale so the sprite lands inside the sane range.
        function boundedScale(image, scale) {
            const natural = Math.max(image.width, image.height) || 1;
            const requested = natural * Math.abs(scale);
            if (requested > MAX_EFFECT_PX) return (MAX_EFFECT_PX / natural) * Math.sign(scale || 1);
            if (requested < MIN_EFFECT_PX) return (MIN_EFFECT_PX / natural) * Math.sign(scale || 1);
            return scale;
        }

        // Showdown's own art is drawn thin and layered many deep -- half its
        // keyframes ask for less than half opacity. A DS particle is one
        // sprite standing on its own, so the same number leaves it looking
        // like a ghost. Its opacity is lifted into the top of the range
        // instead, and drawn objects go further still: a boulder is not
        // translucent.
        function dsAlpha(requested, blend) {
            const asked = Math.max(0, Math.min(1, Number(requested ?? 1)));
            const floor = blend === "normal" ? 0.9 : 0.55;
            return floor + (1 - floor) * asked;
        }

        function spawnEffect(effect, start) {
            const at = place(start);
            const variant = variantOf(effect) + spawnOrder;
            spawnOrder += 1;
            const role = roleOf(effect);
            const key = textureKeyFor(effect, variant, role);
            const image = scene.add.image(at.x, at.y, key).setDepth(46);
            const isDs = String(key).startsWith("dsp-");
            const dsStyle = isDs && options.dsStyleFor
                ? options.dsStyleFor(currentSlug, variant, role)
                : null;
            image.dsBlend = dsStyle?.blend || null;
            image.setAlpha(isDs ? dsAlpha(start.opacity, image.dsBlend) : (start.opacity ?? 1));
            image.baseSizeCorrection = sizeCorrection(key, image);
            image.setScale(boundedScale(image, (start.scale ?? 1) * at.scale * image.baseSizeCorrection));
            // Showdown's fx art is smooth and wants LINEAR; DS particles are
            // pixel art and go blurry under it.
            image.texture.setFilter(isDs
                ? Phaser.Textures.FilterMode.NEAREST
                : Phaser.Textures.FilterMode.LINEAR);
            // Most DS particles are glows and want additive blending, but a
            // few are drawn objects -- Rock Blast's boulder, Leech Seed's
            // seed -- whose dark outline additive blending erases, leaving
            // the backdrop showing through as a halo. Those ask for normal
            // blending instead. The tint puts back the colour the handheld
            // applied from the emitter, which the art itself does not carry.
            if (isDs) {
                const style = dsStyle;
                image.setBlendMode(style && style.blend === "normal"
                    ? Phaser.BlendModes.NORMAL
                    : Phaser.BlendModes.ADD);
                if (style && style.tint !== null && style.tint !== undefined) {
                    image.setTint(style.tint);
                }
            }
            live.add(image);
            return image;
        }

        function driveEffect(image, start, end, ease, after, jobs) {
            jobs.push((async () => {
                if (start.time) await wait(beat(start.time));
                if (!image.active) return;
                image.setVisible(true);
                const to = place(end);
                await tween(image, {
                    x: to.x, y: to.y,
                    scale: boundedScale(image, (end.scale ?? start.scale ?? 1) * to.scale * (image.baseSizeCorrection || 1)),
                    alpha: String(image.texture?.key || "").startsWith("dsp-")
                        ? dsAlpha(end.opacity ?? start.opacity, image.dsBlend)
                        : (end.opacity ?? image.alpha),
                    duration: Math.max(60, beat((end.time ?? 600) - (start.time || 0))),
                    ease: easeFor(ease),
                });
                if (!image.active) return;
                if (after === "explode") {
                    await tween(image, { scale: image.scale * 1.8, alpha: 0, duration: 140, ease: "Quad.easeOut" });
                } else if (after === "fade") {
                    await tween(image, { alpha: 0, duration: 150, ease: "Quad.easeOut" });
                }
                image.destroy();
                live.delete(image);
            })());
        }

        // ---- sprite proxies ---------------------------------------------------
        // Coordinates are numbers in their space; anim bodies do arithmetic on
        // them and hand the results back through showEffect/anim. Helper signs
        // are copied from their Sprite class verbatim.
        function makeProxy(view, isFrontSprite, jobs) {
            const sprite = view.sprite;
            const saved = {
                x: sprite.x, y: sprite.y,
                scaleX: sprite.scaleX, scaleY: sprite.scaleY, alpha: sprite.alpha,
            };
            const z = isFrontSprite ? 200 : 0;
            const map = calibrate();
            // A Pokemon's sprite stands ON its platform: view.position is
            // where its feet are, and the art runs upward from there. Aiming
            // effects at that point closed Bite's jaws around the platform,
            // with the lower half below the Pokemon entirely. They aim at the
            // middle of the body instead, which is also where the scene's own
            // effectPoint() has always pointed.
            const bounds = typeof sprite.getBounds === "function" ? sprite.getBounds() : null;
            const anchorX = bounds ? bounds.centerX : view.position.x;
            const anchorY = bounds ? bounds.centerY : view.position.y;
            // How far the aiming point sits above the feet, so that moving
            // the sprite still lands its feet where the choreography meant.
            const anchorLift = anchorY - view.position.y;
            const origin = map.fromCanvas(anchorX, anchorY);
            const sd = SD.solve(origin.left, origin.top, z);
            let queue = Promise.resolve();
            const proxy = {
                x: sd.x, y: sd.y, z: sd.z,
                sp: { w: 96, h: 96 },
                isFrontSprite,
                isMissedPokemon: false,
                behindx(offset) { return proxy.x + (isFrontSprite ? 1 : -1) * offset; },
                behindy(offset) { return proxy.y + (isFrontSprite ? -1 : 1) * offset; },
                leftof(offset) { return proxy.x + (isFrontSprite ? 1 : -1) * offset; },
                behind(offset) { return proxy.z + (isFrontSprite ? 1 : -1) * offset; },
                anim(end, ease) {
                    queue = queue.then(async () => {
                        if (!sprite.active) return;
                        const to = place({
                            x: end.x ?? proxy.x, y: end.y ?? proxy.y, z: end.z ?? proxy.z,
                        });
                        await tween(sprite, {
                            x: to.x, y: to.y - anchorLift,
                            scaleX: saved.scaleX * (end.scale ?? 1),
                            scaleY: saved.scaleY * (end.scale ?? 1),
                            alpha: end.opacity ?? sprite.alpha,
                            duration: beat(end.time ?? 500),
                            ease: easeFor(ease),
                        });
                    });
                    jobs.push(queue);
                    return proxy;
                },
                delay(ms) {
                    queue = queue.then(() => wait(beat(ms)));
                    jobs.push(queue);
                    return proxy;
                },
                restore() {
                    if (!sprite.active) return;
                    sprite.setPosition(saved.x, saved.y)
                        .setScale(saved.scaleX, saved.scaleY)
                        .setAlpha(saved.alpha);
                },
            };
            return proxy;
        }

        // ---- the scene surface anim bodies call -------------------------------
        function makeSceneApi(jobs) {
            const map = calibrate();
            const sideAnchor = (isFar) => {
                const z = isFar ? 200 : 0;
                const views = scene.slotViews[isFar ? "enemy" : "player"].filter(Boolean);
                const view = views[0];
                const origin = map.fromCanvas(view.position.x, view.position.y);
                return { ...SD.solve(origin.left, origin.top, z) };
            };
            return {
                timeOffset: 0,
                battle: { mySide: sideAnchor(false), farSide: sideAnchor(true) },
                showEffect(effect, start, end, ease, after) {
                    const image = spawnEffect(effect, start);
                    if (start.time) image.setVisible(false);
                    driveEffect(image, start, end, ease, after, jobs);
                    return image;
                },
                animateEffect(image, effect, start, end, ease, after) {
                    // Called as animateEffect(existing, ...showEffectArgs).
                    driveEffect(image, start, end, ease, after, jobs);
                    return image;
                },
                backgroundEffect(background, duration, opacity, delayMs) {
                    jobs.push((async () => {
                        if (delayMs) await wait(delayMs);
                        const urlMatch = String(background).match(/fx\/([\w.-]+)\.(?:png|jpg)/);
                        let wash;
                        if (urlMatch && options.textureFor(urlMatch[1])) {
                            wash = scene.add.image(480, 240, options.textureFor(urlMatch[1]))
                                .setDepth(40).setAlpha(0).setDisplaySize(960, 480);
                        } else {
                            const hex = /^#/.test(String(background))
                                ? parseInt(String(background).slice(1), 16)
                                : 0x000000;
                            wash = scene.add.rectangle(480, 240, 960, 480, hex, 1).setDepth(40).setAlpha(0);
                        }
                        live.add(wash);
                        const hold = Math.max(0, (duration || 600) - 400);
                        await tween(wash, { alpha: opacity ?? 0.4, duration: 200 });
                        await wait(hold);
                        await tween(wash, { alpha: 0, duration: 200 });
                        wash.destroy();
                        live.delete(wash);
                    })());
                },
                activityWait(ms) { jobs.push(wait(beat(ms))); },
                wait(ms) { jobs.push(wait(beat(ms))); },
            };
        }

        // Showdown's move table only lists moves with bespoke choreography.
        // Everything else runs one of the shared animations it keeps in
        // BattleOtherAnims, chosen by how the move behaves. Without this the
        // most-used moves in the game were exactly the ones that fell back to
        // our own archetype system: Tackle alone is learned by 369 species,
        // and Water Gun, Ember and Thunder Shock are close behind.
        const SOUND_MOVE = /growl|roar|sing|supersonic|screech|snore|uproar|metalsound|grasswhistle|hypervoice|bugbuzz|chatter|round|echoedvoice|boomburst|disarmingvoice|nobleroar|confide|sparklingaria|clanging|overdrive|snarl/;
        const PUNCH_MOVE = /punch/;
        const BITE_MOVE = /fang|bite|crunch/;
        const SLASH_MOVE = /slash|cut|blade|sword|razorshell|xscissor/;
        const KICK_MOVE = /kick|stomp|trample/;
        function genericAnimFor(move) {
            const slug = String(move?.slug || "");
            const damageClass = String(move?.damageClass || "");
            const power = Number(move?.power) || 0;
            if (damageClass.includes("status")) {
                if (SOUND_MOVE.test(slug)) return "sound";
                // Buffs land on the user, debuffs on the target.
                return move?.selfTargeted ? "selfstatus" : "lightstatus";
            }
            if (SOUND_MOVE.test(slug)) return "sound";
            if (PUNCH_MOVE.test(slug)) return "punchattack";
            if (BITE_MOVE.test(slug)) return "bite";
            if (SLASH_MOVE.test(slug)) return "slashattack";
            if (KICK_MOVE.test(slug)) return "kick";
            // Physical moves with power make contact; specials stay at range.
            if (damageClass.includes("physical") && power > 0) return "contactattack";
            return "attack";
        }
        function resolveAnim(slug, move) {
            const entry = tables.BattleMoveAnims[slug];
            if (entry && typeof entry.anim === "function") return entry.anim;
            const generic = tables.BattleOtherAnims?.[genericAnimFor(move)];
            return typeof generic?.anim === "function" ? generic.anim : null;
        }

        return {
            hasAnim(slug, move) {
                return Boolean(resolveAnim(slug, move));
            },
            async playMove(slug, actorView, targetView, move) {
                const anim = resolveAnim(slug, move);
                if (!anim) return;
                const entry = { anim };
                currentSlug = slug;
                spawnOrder = 0;
                const jobs = [];
                const actorIsFront = scene.slotViews.enemy.includes(actorView);
                const attacker = makeProxy(actorView, actorIsFront, jobs);
                const defender = makeProxy(targetView, !actorIsFront, jobs);
                try {
                    entry.anim(makeSceneApi(jobs), [attacker, defender]);
                    // Jobs can enqueue more jobs while awaited (chained anims),
                    // so drain until the list stops growing.
                    let done = 0;
                    while (done < jobs.length) {
                        const batch = jobs.slice(done);
                        done = jobs.length;
                        await Promise.all(batch);
                    }
                } finally {
                    currentSlug = null;
                    attacker.restore();
                    defender.restore();
                    live.forEach((object) => {
                        scene.tweens.killTweensOf(object);
                        object.destroy();
                    });
                    live.clear();
                }
            },
        };
    }

    return { createAdapter };
}));
