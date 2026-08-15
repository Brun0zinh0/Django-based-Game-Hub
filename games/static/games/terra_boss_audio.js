/* Terra Boss — synthesised sound effects.
 *
 * Every sound is built from oscillators and noise at runtime, so the game
 * ships no audio files and nothing extra to download. Browsers refuse to
 * start audio before a user gesture, so the context is created lazily on the
 * first click or key press.
 */
(() => {
    "use strict";

    let context = null;
    let master = null;
    let muted = false;

    function ensureContext() {
        if (context) {
            if (context.state === "suspended") {
                context.resume();
            }
            return context;
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return null;
        }
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0.5;
        master.connect(context.destination);
        return context;
    }

    function noiseBuffer(seconds) {
        const frames = Math.max(1, Math.floor(context.sampleRate * seconds));
        const buffer = context.createBuffer(1, frames, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i += 1) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /** One enveloped oscillator. */
    function tone({ type = "square", from, to, duration = 0.12, gain = 0.3, delay = 0 }) {
        const start = context.currentTime + delay;
        const osc = context.createOscillator();
        const amp = context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, start);
        if (to && to !== from) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
        }
        amp.gain.setValueAtTime(0.0001, start);
        amp.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.015, duration / 3));
        amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(amp).connect(master);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    /** Filtered noise burst — impacts, explosions, dashes. */
    function noise({ duration = 0.12, gain = 0.25, from = 2200, to = 300, delay = 0, q = 1 }) {
        const start = context.currentTime + delay;
        const source = context.createBufferSource();
        source.buffer = noiseBuffer(duration + 0.02);
        const filter = context.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.value = q;
        filter.frequency.setValueAtTime(from, start);
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
        const amp = context.createGain();
        amp.gain.setValueAtTime(gain, start);
        amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        source.connect(filter).connect(amp).connect(master);
        source.start(start);
        source.stop(start + duration + 0.02);
    }

    const SOUNDS = {
        "shoot-bow": () => {
            noise({ duration: 0.09, gain: 0.12, from: 3000, to: 900, q: 2 });
            tone({ type: "triangle", from: 620, to: 260, duration: 0.09, gain: 0.1 });
        },
        "shoot-gun": () => {
            noise({ duration: 0.11, gain: 0.22, from: 3600, to: 400, q: 0.7 });
            tone({ type: "square", from: 260, to: 90, duration: 0.08, gain: 0.14 });
        },
        "shoot-staff": () => {
            tone({ type: "sine", from: 520, to: 1180, duration: 0.16, gain: 0.16 });
            tone({ type: "sine", from: 780, to: 1560, duration: 0.16, gain: 0.08, delay: 0.02 });
        },
        "shoot-throwable": () => tone({ type: "sine", from: 300, to: 150, duration: 0.12, gain: 0.16 }),
        "shoot-launcher": () => {
            noise({ duration: 0.2, gain: 0.2, from: 900, to: 180, q: 0.6 });
            tone({ type: "sawtooth", from: 190, to: 70, duration: 0.2, gain: 0.14 });
        },
        "shoot-yoyo": () => tone({ type: "triangle", from: 420, to: 760, duration: 0.1, gain: 0.12 }),
        hit: () => tone({ type: "square", from: 340, to: 210, duration: 0.06, gain: 0.13 }),
        kill: () => {
            tone({ type: "triangle", from: 420, to: 130, duration: 0.16, gain: 0.16 });
            noise({ duration: 0.12, gain: 0.1, from: 1600, to: 300 });
        },
        explode: () => {
            noise({ duration: 0.35, gain: 0.3, from: 1200, to: 90, q: 0.5 });
            tone({ type: "sawtooth", from: 160, to: 45, duration: 0.32, gain: 0.2 });
        },
        coin: () => {
            tone({ type: "square", from: 980, duration: 0.05, gain: 0.1 });
            tone({ type: "square", from: 1460, duration: 0.08, gain: 0.09, delay: 0.05 });
        },
        heart: () => {
            tone({ type: "sine", from: 620, duration: 0.1, gain: 0.14 });
            tone({ type: "sine", from: 930, duration: 0.14, gain: 0.12, delay: 0.08 });
        },
        hurt: () => {
            tone({ type: "sawtooth", from: 320, to: 90, duration: 0.24, gain: 0.22 });
            noise({ duration: 0.14, gain: 0.14, from: 900, to: 200 });
        },
        jump: () => tone({ type: "square", from: 340, to: 620, duration: 0.09, gain: 0.1 }),
        dash: () => noise({ duration: 0.18, gain: 0.16, from: 400, to: 2600, q: 1.6 }),
        "boss-spawn": () => {
            tone({ type: "sawtooth", from: 130, to: 48, duration: 1.1, gain: 0.26 });
            tone({ type: "square", from: 92, to: 40, duration: 1.1, gain: 0.14, delay: 0.05 });
            noise({ duration: 0.8, gain: 0.12, from: 500, to: 60, q: 0.6 });
        },
        "round-clear": () => {
            [523, 659, 784, 1047].forEach((frequency, index) => {
                tone({ type: "square", from: frequency, duration: 0.15, gain: 0.12, delay: index * 0.09 });
            });
        },
        buy: () => {
            tone({ type: "sine", from: 880, duration: 0.1, gain: 0.14 });
            tone({ type: "sine", from: 1320, duration: 0.16, gain: 0.11, delay: 0.07 });
        },
        death: () => {
            tone({ type: "sawtooth", from: 420, to: 60, duration: 1.0, gain: 0.26 });
            tone({ type: "square", from: 210, to: 40, duration: 1.1, gain: 0.16, delay: 0.1 });
        },
    };

    let lastPlayedAt = Object.create(null);

    /* ---------- music ----------
     *
     * Original chiptune built the same way as the effects: oscillators, no
     * files. Each mood is a scale, a chord loop and a rhythm; the melody is
     * generated from those rather than written out, so a loop never repeats
     * note for note the way a fixed eight-bar phrase does.
     */

    const SEMITONE = Math.pow(2, 1 / 12);

    function midiToHz(note) {
        return 440 * Math.pow(SEMITONE, note - 69);
    }

    const MOODS = {
        // i - VI - III - VII in A minor: open and unhurried.
        menu: {
            bpm: 88, root: 57, scale: [0, 2, 3, 5, 7, 8, 10],
            chords: [[0, 3, 7], [-4, 0, 5], [3, 7, 10], [-1, 3, 7]],
            lead: "triangle", bass: "triangle",
            leadGain: 0.055, bassGain: 0.075, arpGain: 0.03,
            drums: false, density: 0.45,
        },
        // Same key, tighter turnaround, and a kick under it.
        battle: {
            bpm: 132, root: 57, scale: [0, 2, 3, 5, 7, 8, 10],
            chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-1, 3, 7]],
            lead: "square", bass: "square",
            leadGain: 0.05, bassGain: 0.08, arpGain: 0.028,
            drums: true, density: 0.62,
        },
        // D minor with a flattened sixth leaning on it; faster and heavier.
        boss: {
            bpm: 152, root: 50, scale: [0, 2, 3, 5, 7, 8, 11],
            chords: [[0, 3, 7], [-4, 0, 3], [-2, 1, 5], [-1, 4, 8]],
            lead: "sawtooth", bass: "square",
            leadGain: 0.045, bassGain: 0.085, arpGain: 0.03,
            drums: true, density: 0.78,
        },
    };

    let music = null;

    function musicVoice({ type, note, time, duration, gain, detune = 0 }) {
        const osc = context.createOscillator();
        const amp = context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(midiToHz(note), time);
        if (detune) {
            osc.detune.setValueAtTime(detune, time);
        }
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.exponentialRampToValueAtTime(gain, time + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(amp).connect(music.gain);
        osc.start(time);
        osc.stop(time + duration + 0.02);
    }

    function musicDrum(time, strong) {
        const source = context.createBufferSource();
        const amp = context.createGain();
        const filter = context.createBiquadFilter();
        source.buffer = noiseBuffer(0.12);
        filter.type = strong ? "lowpass" : "highpass";
        filter.frequency.value = strong ? 220 : 5200;
        amp.gain.setValueAtTime(strong ? 0.16 : 0.045, time);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + (strong ? 0.11 : 0.05));
        source.connect(filter).connect(amp).connect(music.gain);
        source.start(time);
        source.stop(time + 0.14);
    }

    /** Schedule one sixteenth-note step of the current mood. */
    function musicStep(step, time) {
        const mood = MOODS[music.mood];
        const chord = mood.chords[Math.floor(step / 16) % mood.chords.length];
        const beat = step % 16;

        if (beat % 8 === 0) {
            musicVoice({
                type: mood.bass, note: mood.root + chord[0] - 12, time,
                duration: 0.46, gain: mood.bassGain,
            });
        }
        // Arpeggio walks the chord, so the harmony is audible without a pad.
        if (beat % 2 === 0) {
            const tone = chord[(beat / 2) % chord.length];
            musicVoice({
                type: "square", note: mood.root + tone, time,
                duration: 0.13, gain: mood.arpGain, detune: 4,
            });
        }
        // Melody: scale tones over the chord, on an off-beat bias so it sits
        // against the arpeggio instead of doubling it.
        if (Math.random() < mood.density && beat % 2 === 1) {
            const degree = Math.floor(Math.random() * mood.scale.length);
            const octave = Math.random() < 0.3 ? 12 : 0;
            musicVoice({
                type: mood.lead,
                note: mood.root + 12 + mood.scale[degree] + octave,
                time, duration: 0.16, gain: mood.leadGain,
            });
        }
        if (mood.drums) {
            if (beat % 8 === 0) {
                musicDrum(time, true);
            } else if (beat % 4 === 2) {
                musicDrum(time, false);
            }
        }
    }

    function musicTick() {
        if (!music || !context) {
            return;
        }
        const mood = MOODS[music.mood];
        const stepSeconds = 60 / mood.bpm / 4;
        // Schedule a little ahead so a busy frame cannot cause a gap, but
        // never run away if the tab was suspended and the clock jumped.
        const horizon = context.currentTime + 0.35;
        if (music.nextStepAt < context.currentTime) {
            music.nextStepAt = context.currentTime;
        }
        while (music.nextStepAt < horizon) {
            musicStep(music.step, music.nextStepAt);
            music.step = (music.step + 1) % (16 * MOODS[music.mood].chords.length);
            music.nextStepAt += stepSeconds;
        }
    }

    const api = {
        /** Wake the audio context; safe to call repeatedly. */
        unlock() {
            ensureContext();
        },
        isMuted() {
            return muted;
        },
        setMuted(value) {
            muted = Boolean(value);
            if (master) {
                master.gain.value = muted ? 0 : 0.5;
            }
        },
        /**
         * Play a named sound. `throttleMs` collapses repeats so a wave of
         * simultaneous hits stays one audible impact instead of a wall of noise.
         */
        play(name, throttleMs = 0) {
            if (muted || !SOUNDS[name]) {
                return;
            }
            if (!ensureContext()) {
                return;
            }
            const now = performance.now();
            if (throttleMs && now - (lastPlayedAt[name] || 0) < throttleMs) {
                return;
            }
            lastPlayedAt[name] = now;
            try {
                SOUNDS[name]();
            } catch (error) {
                // A dead audio context must never break the game loop.
                console.warn("Terra Boss audio failed", name, error);
            }
        },
        names() {
            return Object.keys(SOUNDS);
        },

        /**
         * Start, or cross over to, a mood. Calling it with the mood already
         * playing is a no-op, so the caller can say what it wants every round
         * without restarting the loop underneath itself.
         */
        playMusic(mood) {
            if (!MOODS[mood] || !ensureContext()) {
                return;
            }
            if (music && music.mood === mood) {
                return;
            }
            if (!music) {
                const gain = context.createGain();
                // Well under the effects: music should never bury a boss cue.
                gain.gain.value = 0.34;
                gain.connect(master);
                music = { gain, mood, step: 0, nextStepAt: context.currentTime, timer: null };
                music.timer = setInterval(musicTick, 80);
            } else {
                music.mood = mood;
                // Restart on a bar so the chord change lands where it should.
                music.step = 0;
            }
            musicTick();
        },

        stopMusic() {
            if (!music) {
                return;
            }
            clearInterval(music.timer);
            try {
                music.gain.disconnect();
            } catch (error) {
                // Already torn down with the context; nothing to do.
            }
            music = null;
        },

        currentMusic() {
            return music ? music.mood : null;
        },

        moods() {
            return Object.keys(MOODS);
        },
    };

    for (const eventName of ["pointerdown", "keydown"]) {
        window.addEventListener(eventName, () => api.unlock(), { once: false, passive: true });
    }

    window.TerraBossAudio = api;
})();
