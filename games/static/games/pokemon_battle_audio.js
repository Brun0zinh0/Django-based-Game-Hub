(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.PokemonBattleAudio = factory();
}(typeof self !== "undefined" ? self : this, function () {
    "use strict";
    const CAPTURE_KEYS = ["throw", "open", "bounce", "shake", "click", "break", "stars"];
    // The battle set rides the same SDAT rip as the capture cues: the three
    // effectiveness knocks, the faint thud, the recovery chime, the level-up
    // jingle and the send-out pop.
    const BATTLE_KEYS = ["hit-normal", "hit-super", "hit-weak", "faint", "heal", "levelup", "sendout"];
    // Bumped when the wav content changes under the same filenames.
    const VERSION = 2;
    const BATTLE_VERSION = 1;
    const bank = new Map();
    let prefix = "";

    function preload(staticPrefix) {
        prefix = staticPrefix || "";
        CAPTURE_KEYS.forEach((key) => {
            const clip = new Audio(`${prefix}games/assets/pokemon/audio/capture/${key}.wav?v=${VERSION}`);
            clip.preload = "auto";
            bank.set(key, clip);
        });
        BATTLE_KEYS.forEach((key) => {
            const clip = new Audio(`${prefix}games/assets/pokemon/audio/battle/${key}.wav?v=${BATTLE_VERSION}`);
            clip.preload = "auto";
            bank.set(key, clip);
        });
    }

    function fire(clip, volume) {
        const settings = globalThis.PokemonRogueSettings;
        if (!settings || settings.soundEnabled === false) return;
        if (!clip) return;
        try {
            const voice = clip.cloneNode();
            voice.volume = volume;
            const attempt = voice.play();
            if (attempt && attempt.catch) attempt.catch(() => {});
        } catch (error) { /* ignored: sound is best-effort */ }
    }

    // Fire-and-forget: cloning lets rapid wobbles overlap, and every failure
    // (missing file, autoplay policy before the first gesture) is swallowed --
    // sound must never break an animation.
    function play(key) {
        fire(bank.get(key), 0.6);
    }

    // One cry per species, fetched lazily by its Showdown slug and cached.
    // A species with no cry on disk simply stays silent.
    function playCry(slug) {
        if (!slug) return;
        const key = `cry:${slug}`;
        if (!bank.has(key)) {
            const clip = new Audio(`${prefix}games/assets/pokemon/audio/cries/${slug}.mp3`);
            clip.preload = "auto";
            bank.set(key, clip);
        }
        fire(bank.get(key), 0.5);
    }

    return { preload, play, playCry };
}));
