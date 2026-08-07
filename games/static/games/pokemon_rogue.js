(function () {
    "use strict";

    const app = document.getElementById("pokemon-rogue-app");
    if (!app) return;

    const ui = {
        loading: document.getElementById("pokemon-loading"),
        loadingText: document.getElementById("pokemon-loading-text"),
        screenTitle: document.getElementById("screen-title"),
        screenMode: document.getElementById("screen-mode"),
        mainMenu: document.getElementById("main-menu"),
        menuPlay: document.getElementById("menu-play"),
        menuSettings: document.getElementById("menu-settings"),
        leagueSelection: document.getElementById("league-selection"),
        leagueChoiceGrid: document.getElementById("league-choice-grid"),
        leagueSelectionBack: document.getElementById("league-selection-back"),
        leagueStart: document.getElementById("league-start"),
        leaguePlayerAvatar: document.getElementById("league-player-avatar"),
        leagueTitleArt: document.getElementById("league-title-art"),
        leagueStartEra: document.getElementById("league-start-era"),
        leagueStartTitle: document.getElementById("league-start-title"),
        leagueDexPill: document.getElementById("league-dex-pill"),
        leagueDexRegionLabel: document.getElementById("league-dex-region-label"),
        leagueDexTotal: document.getElementById("league-dex-total"),
        leaguePlayerName: document.getElementById("league-player-name"),
        backToLeagues: document.getElementById("back-to-leagues"),
        continueToStarters: document.getElementById("continue-to-starters"),
        continueRun: document.getElementById("continue-run"),
        continueRunCopy: document.getElementById("continue-run-copy"),
        menuLegacy: document.getElementById("menu-legacy"),
        menuLegacyBalance: document.getElementById("menu-legacy-balance"),
        legacyShop: document.getElementById("legacy-shop"),
        legacyBalance: document.getElementById("legacy-balance"),
        legacyClose: document.getElementById("legacy-close"),
        lsMoney: document.getElementById("ls-money"),
        lsMoneyCopy: document.getElementById("ls-money-copy"),
        lsStarter: document.getElementById("ls-starter"),
        lsMagnet: document.getElementById("ls-magnet"),
        lsLoot: document.getElementById("ls-loot"),
        lsLootResult: document.getElementById("ls-loot-result"),
        lsLootSprite: document.getElementById("ls-loot-sprite"),
        lsLootText: document.getElementById("ls-loot-text"),
        starterScreen: document.getElementById("starter-screen"),
        backToMode: document.getElementById("back-to-mode"),
        starterModeLabel: document.getElementById("starter-mode-label"),
        starterLeagueLabel: document.getElementById("starter-league-label"),
        starterBlurb: document.getElementById("starter-blurb"),
        roomKicker: document.getElementById("room-kicker"),
        trainerIntroChallenger: document.getElementById("trainer-intro-challenger"),
        starterChoices: document.getElementById("starter-choices"),
        starterCount: document.getElementById("starter-count"),
        rerollStarters: document.getElementById("reroll-starters"),
        startKantoRun: document.getElementById("start-kanto-run"),
        openLeagueDex: document.getElementById("open-league-dex"),
        leagueDexCount: document.getElementById("league-dex-count"),
        leagueBestRound: document.getElementById("league-best-round"),
        leagueMilestoneLabel: document.getElementById("league-milestone-label"),
        leagueMilestoneCopy: document.getElementById("league-milestone-copy"),
        leagueMilestoneBar: document.getElementById("league-milestone-bar"),
        legendaryStatus: document.getElementById("legendary-status"),
        mewStatus: document.getElementById("mew-status"),
        rewardCareerCard: document.querySelector(".reward-career-card"),
        normalMode: document.getElementById("normal-mode"),
        hardMode: document.getElementById("hard-mode"),
        hardModeLock: document.getElementById("hard-mode-lock"),
        modeDescription: document.getElementById("mode-description"),
        trainerIntro: document.getElementById("trainer-intro"),
        trainerIntroKicker: document.getElementById("trainer-intro-kicker"),
        trainerIntroRank: document.getElementById("trainer-intro-rank"),
        trainerIntroParty: document.getElementById("trainer-intro-party"),
        trainerIntroSprite: document.getElementById("trainer-intro-sprite"),
        trainerIntroClass: document.getElementById("trainer-intro-class"),
        trainerIntroName: document.getElementById("trainer-intro-name"),
        trainerIntroTypes: document.getElementById("trainer-intro-types"),
        trainerIntroQuote: document.getElementById("trainer-intro-quote"),
        trainerIntroStart: document.getElementById("trainer-intro-start"),
        shell: document.getElementById("pokemon-battle-shell"),
        message: document.getElementById("battle-message"),
        battleContinue: document.getElementById("battle-continue"),
        round: document.getElementById("battle-round"),
        renderer: document.getElementById("battle-renderer"),
        playerTeam: document.getElementById("player-team-strip"),
        enemyTeam: document.getElementById("enemy-team-strip"),
        attack: document.getElementById("command-attack"),
        mega: document.getElementById("mega-trigger"),
        megaHint: document.getElementById("mega-trigger-hint"),
        stageFrame: document.querySelector(".battle-stage-frame"),
        pokemon: document.getElementById("command-pokemon"),
        item: document.getElementById("command-item"),
        forfeit: document.getElementById("command-forfeit"),
        commandPanel: document.getElementById("battle-command-panel"),
        submenu: document.getElementById("battle-submenu"),
        submenuTitle: document.getElementById("submenu-title"),
        submenuContent: document.getElementById("submenu-content"),
        submenuBack: document.getElementById("submenu-back"),
        confirmation: document.getElementById("forfeit-confirmation"),
        cancelForfeit: document.getElementById("cancel-forfeit"),
        confirmForfeit: document.getElementById("confirm-forfeit"),
        result: document.getElementById("battle-result"),
        resultCard: document.getElementById("battle-result-card"),
        resultKicker: document.getElementById("battle-result-kicker"),
        resultSymbol: document.getElementById("battle-result-symbol"),
        resultTitle: document.getElementById("battle-result-title"),
        resultText: document.getElementById("battle-result-text"),
        resultRewards: document.getElementById("battle-result-rewards"),
        resultRecovery: document.getElementById("battle-result-recovery"),
        resultBody: document.getElementById("battle-result-body"),
        slotReport: document.getElementById("result-slot-report"),
        slotRevival: document.getElementById("result-slot-revival"),
        resultUnlocks: document.getElementById("battle-result-unlocks"),
        restart: document.getElementById("battle-restart"),
        room: document.getElementById("between-rounds"),
        roomHeading: document.getElementById("room-heading"),
        roomRound: document.getElementById("room-round"),
        roomWins: document.getElementById("room-wins"),
        roomLegacy: document.getElementById("room-legacy"),
        roomOpenDex: document.getElementById("room-open-dex"),
        roomMode: document.getElementById("room-mode"),
        shopOffers: document.getElementById("shop-offers"),
        roomMoney: document.getElementById("room-money"),
        bagCount: document.getElementById("bag-count"),
        roomTeam: document.getElementById("room-team"),
        openPc: document.getElementById("open-pc"),
        openOrder: document.getElementById("open-order"),

        pcCount: document.getElementById("pc-count"),
        wildEncounter: document.getElementById("wild-encounter"),
        wildPreview: document.getElementById("wild-preview"),
        wildFee: document.getElementById("wild-fee"),
        nextDuel: document.getElementById("next-duel"),
        openBag: document.getElementById("open-bag"),
        shopRefresh: document.getElementById("shop-refresh"),
        shopRefreshFee: document.getElementById("shop-refresh-fee"),

        roomFeedback: document.getElementById("room-feedback"),
        roomDialog: document.getElementById("room-dialog"),
        roomDialogKicker: document.getElementById("room-dialog-kicker"),
        roomDialogTitle: document.getElementById("room-dialog-title"),
        roomDialogContent: document.getElementById("room-dialog-content"),
        closeRoomDialog: document.getElementById("close-room-dialog"),
        settingsDialog: document.getElementById("game-settings"),
        settingsForm: document.getElementById("settings-form"),
        closeSettings: document.getElementById("close-settings"),
        cancelSettings: document.getElementById("cancel-settings"),
        idleAnimationSpeed: document.getElementById("idle-animation-speed"),
        reducedBattleMotion: document.getElementById("reduced-battle-motion"),
        soundEnabled: document.getElementById("sound-enabled"),
        backgroundMusic: document.getElementById("pokemon-background-music"),
        musicVolume: document.getElementById("music-volume"),
        musicVolumeValue: document.getElementById("music-volume-value"),
        musicPlaylist: document.getElementById("music-playlist"),
        musicNowPlaying: document.getElementById("music-now-playing"),
    };

    // Each league keeps its own run progress, and one shared record tracks how
    // far the player has unlocked so the selection screen can offer any league
    // whose predecessor is finished.
    const progressStorageKey = (leagueId) => `pokemon-rogue:${leagueId || "kanto"}-progress:v1`;
    const UNLOCK_STORAGE_KEY = "pokemon-rogue:unlocked-leagues:v1";
    // Filled from the template: league number -> config URL.
    const LEAGUE_URLS = (() => {
        try {
            return JSON.parse(document.getElementById("pokemon-rogue-app").dataset.leagueUrls || "{}");
        } catch (error) {
            console.warn("League URL map could not be read.", error);
            return {};
        }
    })();
    const SETTINGS_STORAGE_KEY = "pokemon-rogue:settings:v1";
    const DEFAULT_SETTINGS = { idleFrameRate: 6, reducedBattleMotion: false, soundEnabled: true, musicVolume: 0.3, musicPlaylist: "all" };
    const SPRITERS_ASSET_ROOT = "games/assets/pokemon/spriters-resource/";
    const KANTO_AREA_PREVIEWS = {
        "route-1": "viridian-forest",
        "route-2-viridian-forest": "viridian-forest",
        "route-3-mt-moon": "mt-moon",
        "cerulean-routes": "cerulean-cave",
        "vermilion-routes": "power-plant",
        "diglett-cave-route-10": "diglett-cave",
        "rock-tunnel-lavender": "rock-tunnel",
        "southern-routes": "safari-zone",
        "safari-zone": "safari-zone",
        "seafoam-cinnabar": "seafoam-islands",
        "victory-road": "victory-road",
    };
    const MENU_BACKGROUNDS = [
        "menu-bg-01-pokemon",
        "menu-bg-02-milotic",
        "menu-bg-03-mew",
        "menu-bg-04-sinnoh-trio",
        "menu-bg-05-pokemon-intro",
    ];
    const MENU_BACKGROUND_ROOT = "games/assets/pokemon/menu-backgrounds/";
    const PC_BACKGROUNDS = [1, 2, 3, 4].map((number) => `ui/pc-box-${String(number).padStart(2, "0")}.png`);
    const LEAGUE_PLAYER_AVATARS = [
        null,
        { name: "Red", file: "league-01-red.png" },
        { name: "Ethan", file: "league-02-ethan.png" },
        { name: "Lyra", file: "league-03-lyra.png" },
        { name: "Lucas", file: "league-04-lucas.png" },
        { name: "Hilbert", file: "league-05-hilbert.png" },
        { name: "Hilda", file: "league-06-hilda.png" },
        { name: "Nate", file: "league-07-nate.png" },
        { name: "Rosa", file: "league-08-rosa.png" },
        { name: "Leaf", file: "league-09-leaf.png" },
    ];
    const LEAGUE_NAMES = [null, "Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Paldea"];

    const TYPE_COLORS = {
        normal: "#797d85", fire: "#d9533f", water: "#397bc6", electric: "#d0a623",
        grass: "#4d9951", ice: "#56aeb5", fighting: "#a44138", poison: "#8753a0",
        ground: "#a4773e", flying: "#617db5", psychic: "#d84f79", bug: "#718d36",
        rock: "#8d7844", ghost: "#5f568c", dragon: "#6750bd", dark: "#4d4652",
        steel: "#687e8e", fairy: "#c76699",
    };

    let dataset;
    // The Showdown manifest, kept so the icon sheet can be addressed later.
    let spriteManifest = null;
    let leagueConfig;
    let trainerCatalog;
    let leagueRun;
    let engine;
    let scene;
    let phaserGame;
    let battleMode = "duel";
    let activeTrainer = null;
    let locked = true;
    let battleAdvanceCleanup = null;
    let rewardGranted = false;
    // A ?screen=room preview fabricates a run; it must never write a save.
    const isPreviewBoot = new URLSearchParams(window.location.search).get("screen") === "room";
    // How the last wild encounter ended, so the room can report that instead
    // of repeating the post-duel summary. A wild encounter pays no reward and
    // heals nothing, so the duel copy was announcing a full recovery over a
    // team that was still down to its last few HP.
    let lastWildSummary = null;
    let runState = null;
    let selectedRunMode = "normal";
    let selectedPcTheme = 0;
    let currentMenuBackground = -1;
    let gameSettings = loadGameSettings();
    let displayedStarterChoices = [];
    const selectedStarterIds = new Set();
    // ------------------------------------------------------------------
    // Background music. The playlist is the sounds/Pokerogue/music folder
    // itself, the same customisable arrangement the battle royale uses:
    // drop files in, every sub-folder is a selectable playlist, playback
    // shuffles through a refillable bag so nothing repeats until the whole
    // pool has played. Browsers block audio before the first gesture, so
    // the player also retries on the first pointer or key press.
    const backgroundMusicPlayer = (() => {
        const audio = ui.backgroundMusic;
        const allTracks = (() => {
            try {
                return JSON.parse(document.getElementById("pokemon-music-tracks")?.textContent || "[]");
            } catch (error) {
                console.warn("The music track list could not be read.", error);
                return [];
            }
        })();
        let activeTracks = allTracks;
        let currentIndex = -1;
        let shuffleBag = [];
        let errorCount = 0;

        const setNowPlaying = (text) => {
            if (ui.musicNowPlaying) ui.musicNowPlaying.textContent = text;
        };

        function refillShuffleBag() {
            shuffleBag = activeTracks.map((_track, index) => index);
            for (let index = shuffleBag.length - 1; index > 0; index -= 1) {
                const swap = Math.floor(Math.random() * (index + 1));
                [shuffleBag[index], shuffleBag[swap]] = [shuffleBag[swap], shuffleBag[index]];
            }
            // Never replay the track that just finished back to back.
            if (shuffleBag.length > 1 && shuffleBag[0] === currentIndex) {
                [shuffleBag[0], shuffleBag[1]] = [shuffleBag[1], shuffleBag[0]];
            }
        }

        function attemptPlayback() {
            if (!audio || !activeTracks.length || !audio.paused) return;
            const request = audio.play();
            if (request) request.catch(() => { /* blocked until the first gesture */ });
        }

        function loadTrack(index, shouldPlay) {
            if (!audio || !activeTracks.length) {
                setNowPlaying("No music found");
                return;
            }
            currentIndex = (index + activeTracks.length) % activeTracks.length;
            const track = activeTracks[currentIndex];
            setNowPlaying(track.title);
            audio.src = track.url;
            audio.load();
            if (shouldPlay) attemptPlayback();
        }

        function playNext() {
            if (!activeTracks.length) return;
            if (!shuffleBag.length) refillShuffleBag();
            loadTrack(shuffleBag.shift(), true);
        }

        function handleError() {
            errorCount += 1;
            // A missing or unreadable file skips ahead; only give up once
            // every track in the pool has failed.
            if (errorCount < activeTracks.length) playNext();
            else setNowPlaying("Music unavailable");
        }

        function applyPlaylist(playlistId, shouldPlay) {
            const requested = playlistId === "all"
                ? allTracks
                : allTracks.filter((track) => track.playlist === playlistId);
            activeTracks = requested.length ? requested : allTracks;
            errorCount = 0;
            currentIndex = -1;
            shuffleBag = [];
            if (activeTracks.length) {
                refillShuffleBag();
                loadTrack(shuffleBag.shift(), shouldPlay);
            } else {
                setNowPlaying("No music found");
            }
        }

        let appliedPlaylist = null;
        let started = false;
        return {
            hasTracks: allTracks.length > 0,
            // No-op until start(): applyGameSettings runs once at module
            // init, before the audio should make a sound.
            applySettings() {
                if (!audio || !started) return;
                audio.volume = gameSettings.musicVolume;
                if (appliedPlaylist !== gameSettings.musicPlaylist) {
                    appliedPlaylist = gameSettings.musicPlaylist;
                    applyPlaylist(appliedPlaylist, true);
                }
            },
            previewVolume(value) {
                if (audio) audio.volume = Math.max(0, Math.min(1, value));
            },
            start() {
                if (started) return;
                started = true;
                if (!audio || !allTracks.length) { setNowPlaying("No music found"); return; }
                audio.addEventListener("ended", playNext);
                audio.addEventListener("error", handleError);
                const unlock = () => attemptPlayback();
                document.addEventListener("pointerdown", unlock);
                document.addEventListener("keydown", unlock);
                audio.addEventListener("playing", () => {
                    document.removeEventListener("pointerdown", unlock);
                    document.removeEventListener("keydown", unlock);
                }, { once: true });
                appliedPlaylist = gameSettings.musicPlaylist;
                audio.volume = gameSettings.musicVolume;
                applyPlaylist(appliedPlaylist, true);
            },
        };
    })();

    applyGameSettings();
    window.PokemonBattleAudio?.preload(app.dataset.staticPrefix);

    function loadLeagueProgress(leagueId) {
        try {
            const stored = window.localStorage.getItem(progressStorageKey(leagueId));
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.warn("League progression could not be loaded.", error);
            return null;
        }
    }

    function saveLeagueProgress(progress, leagueId) {
        try {
            window.localStorage.setItem(progressStorageKey(leagueId), JSON.stringify(progress));
        } catch (error) {
            console.warn("League progression could not be saved.", error);
        }
    }

    function highestUnlockedLeague() {
        try {
            return Math.max(1, Number(window.localStorage.getItem(UNLOCK_STORAGE_KEY)) || 1);
        } catch (error) {
            return 1;
        }
    }

    function unlockLeague(number) {
        if (!Number.isFinite(number) || number <= highestUnlockedLeague()) return;
        try {
            window.localStorage.setItem(UNLOCK_STORAGE_KEY, String(number));
        } catch (error) {
            console.warn("League unlock could not be saved.", error);
        }
    }

    // --- Legacy wallet: the permanent meta-currency --------------------------
    // Legacy earned in any run banks here the moment a duel pays it, survives
    // defeat, and buys permanent upgrades in the main menu Legacy Shop.
    const WALLET_STORAGE_KEY = "pokemon-rogue:legacy-wallet:v1";
    const LEGACY_LEAGUE_IDS = ["kanto", "johto", "hoenn", "sinnoh"];
    const BANKROLL_COSTS = [20, 35, 50, 70, 90];
    const BANKROLL_STEP = 400;
    const STARTER_COST = 120;
    const MAGNET_COST = 80;
    const LOOT_COST = 30;
    let shinyAvailable = new Set();

    function loadWallet() {
        try {
            const stored = JSON.parse(window.localStorage.getItem(WALLET_STORAGE_KEY) || "{}");
            return {
                balance: Math.max(0, Number(stored.balance) || 0),
                startingMoneyRank: Math.min(BANKROLL_COSTS.length, Math.max(0, Number(stored.startingMoneyRank) || 0)),
                extraStarter: Boolean(stored.extraStarter),
                stoneMagnet: Boolean(stored.stoneMagnet),
                shinies: [...new Set((stored.shinies || []).map(Number))],
            };
        } catch (error) {
            return { balance: 0, startingMoneyRank: 0, extraStarter: false, stoneMagnet: false, shinies: [] };
        }
    }
    let legacyWallet = loadWallet();

    function saveWallet() {
        try {
            window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(legacyWallet));
        } catch (error) { /* storage unavailable */ }
        if (ui.menuLegacyBalance) ui.menuLegacyBalance.textContent = `Permanent upgrades · ◆${legacyWallet.balance}`;
    }

    function bankLegacy(amount) {
        const earned = Math.max(0, Number(amount) || 0);
        if (!earned) return;
        legacyWallet.balance += earned;
        saveWallet();
    }

    function walletPerks() {
        return {
            startingMoney: legacyWallet.startingMoneyRank * BANKROLL_STEP,
            extraStarter: legacyWallet.extraStarter,
            stoneMagnet: legacyWallet.stoneMagnet,
        };
    }

    function shinySlugFor(species) {
        const override = spriteManifest?.sprites?.[String(species.id)];
        if (override?.front?.endsWith(".gif")) return override.front.split("/").pop().replace(".gif", "");
        return String(species.display_name || "").toLowerCase()
            .replace(/\u2640/g, "f").replace(/\u2642/g, "m")
            .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    }

    // Unlocked shinies repaint the species everywhere new sprites are drawn:
    // menus, dex, and every Pokemon created from here on.
    function applyShinyUnlocks() {
        if (!dataset) return;
        const owned = new Set(legacyWallet.shinies.map(Number));
        dataset.pokemon.forEach((species) => {
            if (!owned.has(Number(species.id))) return;
            const slug = shinySlugFor(species);
            if (!shinyAvailable.has(slug)) return;
            species.sprites = {
                ...species.sprites,
                front_idle: `games/assets/pokemon/showdown/front-shiny/${slug}.gif`,
                back_idle: `games/assets/pokemon/showdown/back-shiny/${slug}.gif`,
                animated_gif: true,
            };
        });
    }

    function caughtSpeciesUnion() {
        const union = new Set();
        LEGACY_LEAGUE_IDS.forEach((leagueId) => {
            try {
                const stored = JSON.parse(window.localStorage.getItem(progressStorageKey(leagueId)) || "{}");
                (stored.caughtSpeciesIds || []).forEach((id) => union.add(Number(id)));
            } catch (error) { /* unreadable progress stays out of the pool */ }
        });
        return union;
    }

    function shinyLootPool() {
        const owned = new Set(legacyWallet.shinies.map(Number));
        const byId = new Map((dataset?.pokemon || []).map((species) => [Number(species.id), species]));
        return [...caughtSpeciesUnion()]
            .filter((id) => !owned.has(id))
            .filter((id) => {
                const species = byId.get(id);
                return species && shinyAvailable.has(shinySlugFor(species));
            });
    }

    function renderLegacyShop() {
        if (!ui.legacyShop) return;
        ui.legacyBalance.textContent = `◆ ${legacyWallet.balance}`;
        const rank = legacyWallet.startingMoneyRank;
        const maxed = rank >= BANKROLL_COSTS.length;
        ui.lsMoneyCopy.textContent = `Start every run with extra money. Now: +₽${rank * BANKROLL_STEP} (rank ${rank}/${BANKROLL_COSTS.length}).`;
        ui.lsMoney.textContent = maxed ? "MAXED" : `RANK ${rank + 1} · ◆${BANKROLL_COSTS[rank]}`;
        ui.lsMoney.disabled = maxed || legacyWallet.balance < (BANKROLL_COSTS[rank] ?? Infinity);
        ui.lsMoney.classList.toggle("is-owned", maxed);
        ui.lsStarter.textContent = legacyWallet.extraStarter ? "OWNED" : `◆${STARTER_COST}`;
        ui.lsStarter.disabled = legacyWallet.extraStarter || legacyWallet.balance < STARTER_COST;
        ui.lsStarter.classList.toggle("is-owned", legacyWallet.extraStarter);
        ui.lsMagnet.textContent = legacyWallet.stoneMagnet ? "OWNED" : `◆${MAGNET_COST}`;
        ui.lsMagnet.disabled = legacyWallet.stoneMagnet || legacyWallet.balance < MAGNET_COST;
        ui.lsMagnet.classList.toggle("is-owned", legacyWallet.stoneMagnet);
        const pool = shinyLootPool();
        ui.lsLoot.textContent = pool.length ? `ROLL · ◆${LOOT_COST}` : "NO NEW SHINIES";
        ui.lsLoot.disabled = !pool.length || legacyWallet.balance < LOOT_COST;
    }

    function refreshPerksOutsideRun() {
        // A purchase takes effect on the next run; rebuild now if none is
        // live so the very next start sees it.
        if (leagueRun && !runState?.party?.length) buildLeagueRun();
    }

    function openLegacyShop() {
        ui.lsLootResult.hidden = true;
        renderLegacyShop();
        if (!ui.legacyShop.open) ui.legacyShop.showModal();
    }

    function buyLegacyItem(kind) {
        if (kind === "money") {
            const rank = legacyWallet.startingMoneyRank;
            const cost = BANKROLL_COSTS[rank];
            if (cost === undefined || legacyWallet.balance < cost) return;
            legacyWallet.balance -= cost;
            legacyWallet.startingMoneyRank = rank + 1;
        } else if (kind === "starter") {
            if (legacyWallet.extraStarter || legacyWallet.balance < STARTER_COST) return;
            legacyWallet.balance -= STARTER_COST;
            legacyWallet.extraStarter = true;
        } else if (kind === "magnet") {
            if (legacyWallet.stoneMagnet || legacyWallet.balance < MAGNET_COST) return;
            legacyWallet.balance -= MAGNET_COST;
            legacyWallet.stoneMagnet = true;
        } else if (kind === "loot") {
            const pool = shinyLootPool();
            if (!pool.length || legacyWallet.balance < LOOT_COST) return;
            legacyWallet.balance -= LOOT_COST;
            const id = pool[Math.floor(Math.random() * pool.length)];
            legacyWallet.shinies.push(id);
            applyShinyUnlocks();
            const species = dataset.pokemon.find((entry) => Number(entry.id) === id);
            if (species) {
                ui.lsLootSprite.src = spriteUrl(species.sprites.front_idle);
                ui.lsLootSprite.alt = `Shiny ${species.display_name}`;
                ui.lsLootText.textContent = `Shiny ${species.display_name} unlocked! It will appear shiny from now on.`;
                ui.lsLootResult.hidden = false;
            }
        }
        saveWallet();
        refreshPerksOutsideRun();
        renderLegacyShop();
    }

    function loadGameSettings() {
        try {
            const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
            return { ...DEFAULT_SETTINGS, ...(stored ? JSON.parse(stored) : {}) };
        } catch (error) {
            console.warn("Pokemon Rogue settings could not be loaded.", error);
            return { ...DEFAULT_SETTINGS };
        }
    }

    function applyGameSettings() {
        gameSettings.idleFrameRate = Math.max(2, Math.min(8, Number(gameSettings.idleFrameRate) || DEFAULT_SETTINGS.idleFrameRate));
        gameSettings.reducedBattleMotion = Boolean(gameSettings.reducedBattleMotion);
        gameSettings.soundEnabled = gameSettings.soundEnabled !== false;
        gameSettings.musicVolume = Math.max(0, Math.min(1, Number(gameSettings.musicVolume ?? DEFAULT_SETTINGS.musicVolume)));
        gameSettings.musicPlaylist = typeof gameSettings.musicPlaylist === "string" ? gameSettings.musicPlaylist : "all";
        window.PokemonRogueSettings = { ...gameSettings };
        document.documentElement.dataset.battleMotion = gameSettings.reducedBattleMotion ? "reduced" : "full";
        if (currentMenuBackground >= 0) applyMenuBackground(currentMenuBackground);
        backgroundMusicPlayer.applySettings();
    }


    function applyMenuBackground(index) {
        const background = MENU_BACKGROUNDS[index];
        if (!background) return;
        const extension = gameSettings.reducedBattleMotion ? "jpg" : "gif";
        const path = spriteUrl(`${MENU_BACKGROUND_ROOT}${background}.${extension}`);
        ui.mainMenu.style.setProperty("--pokemon-menu-background", `url("${path}")`);
        ui.mainMenu.dataset.background = background;
        ui.mainMenu.dataset.backgroundMotion = extension === "gif" ? "animated" : "still";
    }

    function chooseRandomMenuBackground() {
        const candidates = MENU_BACKGROUNDS
            .map((_, index) => index)
            .filter((index) => index !== currentMenuBackground);
        const randomIndex = Math.floor(Math.random() * candidates.length);
        currentMenuBackground = candidates[randomIndex] ?? 0;
        applyMenuBackground(currentMenuBackground);
    }

    function saveGameSettings() {
        try {
            window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(gameSettings));
        } catch (error) {
            console.warn("Pokemon Rogue settings could not be saved.", error);
        }
        applyGameSettings();
    }

    function syncSettingsForm() {
        ui.idleAnimationSpeed.value = String(gameSettings.idleFrameRate);
        ui.reducedBattleMotion.checked = gameSettings.reducedBattleMotion;
        ui.soundEnabled.checked = gameSettings.soundEnabled;
        if (ui.musicVolume) {
            const percent = Math.round(gameSettings.musicVolume * 100);
            ui.musicVolume.value = String(percent);
            ui.musicVolumeValue.textContent = `${percent}%`;
        }
        if (ui.musicPlaylist) ui.musicPlaylist.value = gameSettings.musicPlaylist;
    }

    function openSettings() {
        syncSettingsForm();
        if (!ui.settingsDialog.open) ui.settingsDialog.showModal();
        window.requestAnimationFrame(() => ui.idleAnimationSpeed.focus());
    }

    function hideFrontEndScreens() {
        [ui.mainMenu, ui.leagueSelection, ui.leagueStart, ui.starterScreen].forEach((screen) => {
            screen.hidden = true;
        });
    }

    function showMainMenu() {
        hideFrontEndScreens();
        chooseRandomMenuBackground();
        ui.loading.hidden = true;
        ui.shell.hidden = true;
        ui.room.hidden = true;
        ui.trainerIntro.hidden = true;
        ui.result.hidden = true;
        ui.mainMenu.hidden = false;
        ui.screenTitle.textContent = "Pokemon Rogue";
        ui.screenMode.textContent = "MAIN MENU";
        window.requestAnimationFrame(() => ui.menuPlay.focus());
    }

    // What each party member got out of the duel: experience earned, whether
    // it fought, and any level, evolution or new move that came of it.
    function renderTeamReport(experience) {
        ui.slotReport.replaceChildren();
        const changes = experience?.changes || [];
        if (!changes.length) return;

        const panel = document.createElement("div");
        panel.id = "team-report";
        panel.className = "team-report";
        const heading = document.createElement("strong");
        heading.textContent = "Team report";
        panel.append(heading);

        changes.forEach((change) => {
            const row = document.createElement("article");
            row.className = "team-report-row";
            row.classList.toggle("is-benched", !change.participated);

            const name = document.createElement("span");
            name.className = "team-report-name";
            name.textContent = change.evolution
                ? `${change.evolution.from} → ${change.evolution.to}`
                : change.name;
            row.append(name);

            const gain = document.createElement("span");
            gain.className = "team-report-exp";
            gain.textContent = change.participated
                ? `+${change.experience} EXP${change.knockouts ? ` · ${change.knockouts} KO` : ""}`
                : `+${change.experience} EXP · benched`;
            row.append(gain);

            const notes = [];
            if (change.leveledUp) notes.push(`Lv.${change.fromLevel} → Lv.${change.toLevel}`);
            if (change.evolution) notes.push("Evolved!");
            if (change.learnedMoves?.length) notes.push(`Learned ${change.learnedMoves.join(", ")}`);
            if (notes.length) {
                const detail = document.createElement("small");
                detail.className = "team-report-notes";
                detail.textContent = notes.join(" · ");
                row.append(detail);
            }
            panel.append(row);
        });
        ui.slotReport.append(panel);
    }

    // Hard mode's post-duel revival is not optional: the free revive is the
    // mode's whole safety net, and clicking past it by accident quietly
    // buried a team member for the rest of the run. The victory screen's
    // continue button stays locked until the allowance is spent. The
    // champion screen is exempt -- the run is over, there is nothing left
    // to revive for.
    function syncRevivalGate() {
        const mustRevive = !runState.leagueComplete && Boolean(leagueRun?.revivalChoices().length);
        if (mustRevive) {
            ui.restart.disabled = true;
            ui.restart.textContent = "REVIVE A POKEMON FIRST";
        } else if (ui.restart.disabled) {
            ui.restart.disabled = false;
            ui.restart.textContent = "CONTINUE TO SHOP";
        }
    }

    // Hard mode brings exactly one knocked-out party member back after each
    // duel, and the player picks which. Rendered onto the victory screen next
    // to the recovery summary.
    function renderRevivalChoice() {
        document.getElementById("revival-choice")?.remove();
        const choices = leagueRun.revivalChoices();
        if (!choices.length) return;

        const panel = document.createElement("div");
        panel.id = "revival-choice";
        panel.className = "revival-choice";
        const heading = document.createElement("strong");
        heading.textContent = `Revive one Pokemon (${Math.round(leagueRun.state.pendingRevival.ratio * 100)}% HP)`;
        panel.append(heading);
        const grid = document.createElement("div");
        grid.className = "target-grid";
        choices.forEach(({ pokemon, index }) => {
            const button = makeButton(`${pokemon.name} · L${pokemon.level}`, "revival-option", () => {
                try {
                    const revived = leagueRun.reviveAfterDuel(index);
                    setResultMessage(`${revived.name} was revived with ${revived.hp} HP.`);
                    renderRevivalChoice();
                    renderProgressUi();
                    syncRevivalGate();
                } catch (error) {
                    setResultMessage(error.message, "danger");
                }
            });
            const icon = document.createElement("span");
            applyPokemonIcon(icon, pokemon);
            button.prepend(icon);
            grid.append(button);
        });
        panel.append(grid);
        // The prompt goes above whatever note the last pick left behind.
        ui.slotRevival.prepend(panel);
    }

    function setResultMessage(text, tone) {
        const note = document.getElementById("revival-note") || document.createElement("p");
        note.id = "revival-note";
        note.className = `revival-note${tone === "danger" ? " is-danger" : ""}`;
        note.textContent = text;
        if (!note.isConnected) ui.slotRevival.append(note);
    }

    // Builds (or rebuilds) the run against whatever league config is loaded.
    function buildLeagueRun() {
        const leagueId = leagueConfig.league.id;
        leagueRun = new window.PokemonRunSimulation.LeagueRun({
            dataset,
            leagueConfig,
            trainerCatalog,
            battleApi: window.PokemonBattleSimulation,
            progress: loadLeagueProgress(leagueId),
            metaPerks: walletPerks(),
            onProgressChange: (progress) => {
                saveLeagueProgress(progress, leagueId);
                // Finishing a league opens the next one on the selection screen.
                const unlocked = Number(leagueRun?.progressSummary()?.unlockedLeagueNumber || 0);
                if (unlocked) unlockLeague(unlocked);
                renderProgressUi();
            },
        });
        runState = leagueRun.state;
        const unlocked = Number(leagueRun.progressSummary()?.unlockedLeagueNumber || 0);
        if (unlocked) unlockLeague(unlocked);
        renderLeagueIdentity();
    }

    // Swap to a different league's rules without reloading the page.
    async function switchLeague(leagueNumber) {
        const url = LEAGUE_URLS[String(leagueNumber)];
        if (!url) throw new Error(`${LEAGUE_NAMES[leagueNumber]} has no adventure data yet.`);
        if (Number(leagueConfig.league.number) === Number(leagueNumber)) return;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${LEAGUE_NAMES[leagueNumber]} rules returned ${response.status}.`);
        leagueConfig = await response.json();
        buildLeagueRun();
        renderProgressUi();
    }

    function renderLeagueChoices() {
        ui.leagueChoiceGrid.replaceChildren();
        const currentLeagueNumber = Number(leagueConfig.league.number);
        const highestUnlocked = Math.max(highestUnlockedLeague(), currentLeagueNumber);
        for (let leagueNumber = 1; leagueNumber <= 9; leagueNumber += 1) {
            const avatar = LEAGUE_PLAYER_AVATARS[leagueNumber];
            const unlocked = leagueNumber <= highestUnlocked;
            // Playable when its rules exist and the player has reached it.
            const available = unlocked && Boolean(LEAGUE_URLS[String(leagueNumber)]);
            const button = makeButton("", "league-choice", available
                ? async () => {
                    try {
                        await switchLeague(leagueNumber);
                        showLeagueSetup();
                    } catch (error) {
                        setMessage(error.message, "danger");
                    }
                }
                : () => {});
            button.classList.toggle("is-available", available);
            button.classList.toggle("is-unlocked", unlocked && !available);
            button.disabled = !available;
            const image = document.createElement("img");
            image.src = spritersAssetUrl(`league-trainers/${avatar.file}`);
            image.alt = `${avatar.name}, ${LEAGUE_NAMES[leagueNumber]} player character`;
            const copy = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = `${LEAGUE_NAMES[leagueNumber]} League`;
            const status = document.createElement("small");
            status.textContent = available
                ? `PLAY AS ${avatar.name.toUpperCase()}${leagueNumber === currentLeagueNumber ? " · CURRENT" : ""} · AVAILABLE`
                : unlocked
                    ? `PLAY AS ${avatar.name.toUpperCase()} · UNLOCKED · COMING NEXT`
                    : `PLAY AS ${avatar.name.toUpperCase()} · LOCKED`;
            if (unlocked && !available) button.title = `${LEAGUE_NAMES[leagueNumber]} is unlocked. Its adventure data will plug into the same story route system.`;
            copy.append(name, status);
            button.append(image, copy);
            ui.leagueChoiceGrid.append(button);
        }
    }

    function showLeagueSelection() {
        hideFrontEndScreens();
        ui.loading.hidden = true;
        ui.shell.hidden = true;
        ui.room.hidden = true;
        ui.trainerIntro.hidden = true;
        ui.result.hidden = true;
        ui.leagueSelection.hidden = false;
        ui.screenTitle.textContent = "League Selection";
        ui.screenMode.textContent = "CHOOSE A REGION";
        renderLeagueChoices();
        window.requestAnimationFrame(() => ui.leagueChoiceGrid.querySelector("button:not(:disabled)")?.focus());
    }

    // --- run save / continue ------------------------------------------------
    // The whole run checkpoints to localStorage between rounds, one slot per
    // league, so a closed tab resumes where the shop screen last stood.
    const runStorageKey = (leagueId) => `pokemon-rogue:${leagueId || "kanto"}-run:v1`;

    function saveRunCheckpoint() {
        if (isPreviewBoot || !leagueRun || !runState?.party?.length || runState.leagueComplete) return;
        try {
            window.localStorage.setItem(runStorageKey(runState.leagueId), JSON.stringify(leagueRun.exportState()));
        } catch (error) {
            console.warn("The run could not be checkpointed.", error);
        }
    }

    function loadSavedRun(leagueId) {
        try {
            const raw = window.localStorage.getItem(runStorageKey(leagueId));
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function clearSavedRun(leagueId) {
        try {
            window.localStorage.removeItem(runStorageKey(leagueId));
        } catch (error) { /* storage unavailable */ }
    }

    function continueSavedRun() {
        const leagueId = leagueConfig.league.id;
        const saved = loadSavedRun(leagueId);
        if (!saved) return;
        // Always resume onto a fresh run instance: after an in-session defeat
        // the old instance still holds its finished party.
        buildLeagueRun();
        if (!leagueRun.importState(saved)) {
            clearSavedRun(leagueId);
            renderProgressUi();
            return;
        }
        runState = leagueRun.state;
        selectedRunMode = runState.mode === "hard" ? "hard" : "normal";
        rewardGranted = false;
        enterBetweenRounds();
    }

    // Ends the current run and goes back to the league's own menu, keeping the
    // loaded league and its saved progress. A defeat used to reload the page,
    // which threw the player out to the main menu and made them pick the
    // region again.
    function endRunToLeagueMenu() {
        cancelBattleAdvance();
        locked = true;
        if (phaserGame) phaserGame.destroy(true);
        phaserGame = null;
        scene = null;
        // Cleared unconditionally: a battle abandoned while its view was still
        // mounting leaves a canvas behind that destroy() never sees.
        ui.renderer.replaceChildren();
        // The engine is left in place: renderStatus and friends read it
        // without guarding, and the next duel replaces it wholesale.
        battleMode = "duel";
        activeTrainer = null;
        rewardGranted = false;
        lastWildSummary = null;
        setReorderMode(false);
        clearSavedRun(leagueConfig.league.id);
        showLeagueSetup();
    }

    function showLeagueSetup() {
        hideFrontEndScreens();
        ui.loading.hidden = true;
        ui.shell.hidden = true;
        ui.room.hidden = true;
        ui.trainerIntro.hidden = true;
        ui.result.hidden = true;
        ui.leagueStart.hidden = false;
        ui.screenTitle.textContent = leagueConfig.league.name;
        ui.screenMode.textContent = "MODE · DEX · RECORD";
        renderLeagueIdentity();
        renderProgressUi();
        window.requestAnimationFrame(() => ui.normalMode.focus());
    }

    function selectRunMode(mode) {
        if (mode === "hard" && !leagueRun.progress.hardModeUnlocked) return;
        selectedRunMode = mode === "hard" ? "hard" : "normal";
        renderProgressUi();
        ui.starterModeLabel.textContent = `${selectedRunMode.toUpperCase()} MODE`;
        if (displayedStarterChoices.length) renderStarterChoices();
    }

    function renderProgressUi() {
        if (!leagueRun) return;
        const progress = leagueRun.progressSummary();
        const storyMilestones = leagueConfig.story_route?.milestones || [];
        const storyTotal = progress.storyMilestoneTotal || storyMilestones.length;
        const storyCleared = progress.leagueCompleted ? storyTotal : progress.bestStoryMilestone;
        const nextMilestone = storyMilestones[storyCleared];
        const percentage = storyTotal
            ? Math.min(100, (storyCleared / storyTotal) * 100)
            : Math.min(100, (progress.bestRounds / Math.max(1, progress.milestoneRounds)) * 100);
        ui.leagueDexCount.textContent = progress.registered;
        ui.leagueBestRound.textContent = progress.bestRounds;
        ui.leagueMilestoneLabel.textContent = progress.leagueCompleted
            ? `${regionName().toUpperCase()} CHAMPION DEFEATED · STORY COMPLETE`
            : nextMilestone
                ? `${regionName().toUpperCase()} STORY · ${storyCleared}/${storyTotal} · NEXT: ${nextMilestone.title.toUpperCase()}`
                : `CLEAR ${progress.milestoneRounds} ROUNDS · ${progress.bestRounds}/${progress.milestoneRounds}`;
        // Named Johto for every league, so Hoenn's start screen promised the
        // region the player had already beaten. The prize is the league's own
        // configured successor; the last league promises Hard Mode alone.
        const nextLeagueName = leagueConfig?.story_route?.next_league?.name;
        ui.leagueMilestoneCopy.textContent = progress.leagueCompleted
            ? `Hard Mode${nextLeagueName ? ` and the ${nextLeagueName}` : ""} ${nextLeagueName ? "are" : "is"} unlocked`
            : `Defeat the Champion to unlock Hard Mode${nextLeagueName ? ` + ${nextLeagueName}` : ""}`;
        ui.leagueMilestoneBar.style.width = `${percentage}%`;
        ui.legendaryStatus.textContent = progress.legendaryWildUnlocked ? "LEGENDARY WILDS UNLOCKED" : "LEGENDARIES LOCKED";
        ui.mewStatus.textContent = progress.mewWildUnlocked
            ? "Mew can now appear in the wild"
            : `Mew mastery · ${progress.masteryRegistered}/${progress.masteryTotal} registered`;
        ui.rewardCareerCard.classList.toggle("is-unlocked", progress.legendaryWildUnlocked);
        ui.rewardCareerCard.classList.toggle("is-mastered", progress.mewWildUnlocked);
        ui.hardMode.disabled = !progress.hardModeUnlocked;
        ui.hardModeLock.textContent = progress.hardModeUnlocked
            ? "No HP or KO recovery after wins"
            : `Locked · Defeat the ${regionName()} Champion`;
        if (!progress.hardModeUnlocked && selectedRunMode === "hard") selectedRunMode = "normal";
        const hard = selectedRunMode === "hard";
        ui.normalMode.classList.toggle("is-selected", !hard);
        ui.normalMode.setAttribute("aria-pressed", String(!hard));
        ui.hardMode.classList.toggle("is-selected", hard);
        ui.hardMode.setAttribute("aria-pressed", String(hard));
        ui.modeDescription.textContent = hard
            ? "HP and fainted Pokemon persist after wins. Only status conditions and PP recover automatically."
            : "Your team fully heals, revives, clears status, and restores PP after a win.";
        if (ui.roomOpenDex) ui.roomOpenDex.textContent = `DEX ${progress.registered}/${progress.dexTotal}`;
        if (ui.continueRun) {
            const saved = loadSavedRun(leagueConfig.league.id);
            const resumable = Boolean(saved?.state?.party?.length && !saved?.state?.leagueComplete);
            ui.continueRun.hidden = !resumable;
            if (resumable) {
                ui.continueRunCopy.textContent =
                    `ROUND ${saved.state.round} · ${saved.state.mode === "hard" ? "HARD" : "NORMAL"}`;
            }
        }
    }

    function setMessage(text, tone) {
        ui.message.textContent = text;
        ui.message.dataset.tone = tone || "normal";
    }

    function cancelBattleAdvance() {
        if (typeof battleAdvanceCleanup === "function") battleAdvanceCleanup();
        battleAdvanceCleanup = null;
        if (ui.battleContinue) ui.battleContinue.hidden = true;
    }

    function waitForBattleAdvance(event) {
        return new Promise((resolve) => {
            const button = ui.battleContinue;
            if (!button) {
                window.setTimeout(resolve, 700);
                return;
            }
            button.hidden = false;
            button.disabled = true;
            button.innerHTML = `${event.type === "result" ? "FINISH" : "CONTINUE"} <span aria-hidden="true">▶</span>`;
            let settled = false;
            let armed = false;
            let armTimer = null;
            const finish = () => {
                if (settled) return;
                settled = true;
                window.clearTimeout(armTimer);
                button.hidden = true;
                button.disabled = false;
                button.removeEventListener("click", finish);
                document.removeEventListener("keydown", onKeyDown);
                battleAdvanceCleanup = null;
                resolve();
            };
            const onKeyDown = (keyboardEvent) => {
                if (!armed) return;
                if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
                keyboardEvent.preventDefault();
                finish();
            };
            battleAdvanceCleanup = finish;
            armTimer = window.setTimeout(() => {
                if (settled) return;
                armed = true;
                button.disabled = false;
                button.addEventListener("click", finish);
                document.addEventListener("keydown", onKeyDown);
                button.focus();
            }, 220);
        });
    }

    function makeButton(label, className, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
    }

    function spriteUrl(path) {
        return `${app.dataset.staticPrefix}${String(path || "").replace(/^\//, "")}`;
    }

    function itemSpriteUrl(item) {
        const id = Number(item?.id ?? item?.ID);
        const path = String(item?.sprite || "");
        const canonicalPath = Number.isFinite(id)
            ? path.replace(/\/items\/[^/]+\.png$/i, `/items/${id}.png`)
            : path;
        return spriteUrl(canonicalPath);
    }

    function spritersAssetUrl(path) {
        return spriteUrl(`${SPRITERS_ASSET_ROOT}${path}`);
    }

    function resolveBattlefield(mode, trainer) {
        const config = leagueConfig?.battle_scenes || {};
        const available = new Set(config.scenes || []);
        let sceneId = config.default || "route";

        if (mode === "wild") {
            const areaId = leagueRun?.state?.wildEncounter?.area?.id;
            sceneId = config.wild_area_scenes?.[areaId] || sceneId;
        } else if (trainer?.storyMilestoneId) {
            sceneId = config.milestone_scenes?.[trainer.storyMilestoneId] || sceneId;
        } else {
            const specialty = (trainer?.specialties || []).find((type) => config.specialty_scenes?.[type]);
            sceneId = config.specialty_scenes?.[specialty] || sceneId;
        }

        if (!available.has(sceneId)) sceneId = config.default || "route";
        const assetRoot = config.asset_root || `${SPRITERS_ASSET_ROOT}battle-scenes/kanto/`;
        return {
            id: sceneId,
            label: `${titleCase(sceneId)} field`,
            backdrop: `${assetRoot}${sceneId}-backdrop.png`,
            enemyBase: `${assetRoot}${sceneId}-enemy-base.png`,
            playerBase: `${assetRoot}${sceneId}-player-base.png`,
        };
    }

    // Title art per league: FireRed's in-game art for Kanto, the official
    // Emerald wordmark for Hoenn, and a hand-drawn HGSS-style plate for
    // Johto (no clean 2D rip of that logo exists on the archives used here).
    const LEAGUE_TITLE_ART = {
        1: { file: "ui/kanto-title.png", alt: "Pokemon FireRed title artwork" },
        2: { file: "ui/johto-title.svg", alt: "Johto League wordmark in the HeartGold style" },
        3: { file: "ui/hoenn-title.svg", alt: "Pokemon Emerald wordmark" },
        4: { file: "ui/sinnoh-title.svg", alt: "Sinnoh League wordmark in the Platinum style" },
    };

    // The region map behind the league screens. Leagues with no map of their
    // own keep Kanto's rather than showing nothing.
    const LEAGUE_MAP_ART = {
        1: "ui/kanto-town-map.png",
        2: "ui/johto-town-map.png",
        3: "ui/hoenn-town-map.png",
        4: "ui/sinnoh-town-map.png",
    };

    function regionName() {
        return LEAGUE_NAMES[Number(leagueConfig?.league?.number) || 1] || "Kanto";
    }

    function renderLeagueIdentity() {
        const league = leagueConfig?.league || {};
        const leagueNumber = Number(league.number) || 1;
        const avatar = LEAGUE_PLAYER_AVATARS[leagueNumber] || LEAGUE_PLAYER_AVATARS[1];
        ui.leaguePlayerAvatar.src = spritersAssetUrl(`league-trainers/${avatar.file}`);
        ui.leaguePlayerAvatar.alt = `${avatar.name}, League ${leagueNumber} player character, seen from behind`;
        ui.leaguePlayerName.textContent = avatar.name.toUpperCase();

        const art = LEAGUE_TITLE_ART[leagueNumber] || LEAGUE_TITLE_ART[1];
        ui.leagueTitleArt.src = spritersAssetUrl(art.file);
        ui.leagueTitleArt.alt = art.alt;
        const mapArt = LEAGUE_MAP_ART[leagueNumber] || LEAGUE_MAP_ART[1];
        document.documentElement.style.setProperty(
            "--league-map", `url("${spritersAssetUrl(mapArt)}")`);
        ui.leagueStartEra.textContent = `LEAGUE ${leagueNumber} · GENERATION ${Number(league.generation) || leagueNumber}`;
        ui.leagueStartTitle.textContent = league.name || `${regionName()} League`;
        const [dexFrom, dexTo] = league.dex_range || [1, 151];
        const pad = (value) => String(value).padStart(3, "0");
        ui.leagueDexPill.textContent = `DEX ${pad(dexFrom)}—${pad(dexTo)}`;
        ui.leagueDexRegionLabel.textContent = `${regionName().toUpperCase()} LEAGUE DEX`;
        ui.leagueDexTotal.textContent = String(dexTo - dexFrom + 1);
    }

    function titleCase(value) {
        return String(value || "")
            .split(/[-\s]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }

    function trainerLabel(trainer) {
        if (!trainer) return `${regionName()} Trainer`;
        if (String(trainer.name).toLowerCase() === String(trainer.trainer_class).toLowerCase()) return trainer.name;
        return `${trainer.trainer_class} ${trainer.name}`;
    }

    function milestoneTrainerName(milestone) {
        return leagueRun?.trainersById?.get(String(milestone?.trainer_id))?.name || milestone?.title || "the next boss";
    }

    function showTrainerIntro(duel) {
        const trainer = duel.trainer;
        activeTrainer = trainer;
        locked = true;
        hideFrontEndScreens();
        ui.loading.hidden = true;
        ui.room.hidden = true;
        ui.shell.hidden = true;
        ui.result.hidden = true;
        ui.trainerIntro.hidden = false;
        ui.trainerIntro.dataset.rank = trainer.boss ? "boss" : trainer.rival ? "rival" : "trainer";
        ui.trainerIntroKicker.textContent = trainer.storyMilestoneId
            ? `${regionName().toUpperCase()} STORY · MILESTONE ${trainer.storyMilestoneNumber}/${trainer.storyMilestoneTotal} · ${trainer.storyChapter.toUpperCase()}`
            : trainer.rival
                ? `${regionName().toUpperCase()} RIVAL · ENCOUNTER ${trainer.rivalAppearance}/${trainer.rivalTotal}`
                : `${regionName().toUpperCase()} LEAGUE · DUEL ${runState.round}`;
        ui.trainerIntroRank.textContent = trainer.storyMilestoneId
            ? trainer.storyTitle.toUpperCase()
            : trainer.boss ? "BOSS DUEL" : trainer.rival ? "RIVAL BATTLE" : "TRAINER BATTLE";
        // Also static in the markup: every boss reveal called you the KANTO
        // CHALLENGER, Johto and Hoenn included.
        if (ui.trainerIntroChallenger) {
            ui.trainerIntroChallenger.innerHTML = `${regionName().toUpperCase()}<br>CHALLENGER`;
        }
        ui.trainerIntroClass.textContent = trainer.trainer_class;
        ui.trainerIntroName.textContent = trainer.name;
        ui.trainerIntroQuote.textContent = `“${trainer.intro_line}”`;
        ui.trainerIntroSprite.src = spriteUrl(trainer.sprite);
        ui.trainerIntroSprite.alt = `${trainerLabel(trainer)} trainer sprite`;
        ui.trainerIntroStart.textContent = trainer.storyMilestoneId
            ? `CHALLENGE ${trainer.name.toUpperCase()}`
            : trainer.boss ? "FACE THE BOSS" : "START DUEL";
        ui.trainerIntroParty.replaceChildren();
        // One ball per Pokemon THE TRAINER brings -- this card is about the
        // opponent, not the player's own party.
        (duel.enemyTeam || []).forEach(() => {
            const marker = document.createElement("span");
            ui.trainerIntroParty.append(marker);
        });
        ui.trainerIntroTypes.replaceChildren();
        (trainer.specialties || ["mixed"]).forEach((type) => {
            const chip = document.createElement("span");
            chip.className = "trainer-type-chip";
            chip.style.setProperty("--type-color", TYPE_COLORS[type] || "#526b7b");
            chip.textContent = type === "mixed" ? "Mixed team" : `${titleCase(type)} trainer`;
            ui.trainerIntroTypes.append(chip);
        });
        ui.screenTitle.textContent = trainer.storyMilestoneId
            ? `${trainer.storyChapter} · ${trainer.name}`
            : `${leagueConfig.league.name} · Duel ${runState.round}`;
        const specialty = (trainer.specialties || ["mixed"]).map(titleCase).join(" / ").toUpperCase();
        ui.screenMode.textContent = `${trainer.storyMilestoneId ? "STORY BOSS" : trainer.boss ? "BOSS" : "TRAINER BATTLE"} · TEAM OF ${duel.enemyTeam.length} · NO TRAINER ITEMS · ${specialty}`;

        return new Promise((resolve) => {
            let resolved = false;
            const finish = () => {
                if (resolved) return;
                resolved = true;
                document.removeEventListener("keydown", onKeyDown);
                ui.trainerIntroStart.onclick = null;
                ui.trainerIntro.hidden = true;
                resolve();
            };
            const onKeyDown = (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                finish();
            };
            ui.trainerIntroStart.onclick = finish;
            document.addEventListener("keydown", onKeyDown);
            window.requestAnimationFrame(() => ui.trainerIntroStart.focus());
        });
    }

    async function launchTrainerDuel(duel) {
        if (duel.trainer.boss || duel.trainer.rival || duel.milestone) {
            await showTrainerIntro(duel);
        } else {
            ui.screenTitle.textContent = `${leagueConfig.league.name} · Duel ${runState.round}`;
            ui.screenMode.textContent = `TRAINER BATTLE · TEAM OF ${duel.enemyTeam.length} · NO TRAINER ITEMS`;
        }
        await mountBattle(duel.enemyTeam, "duel", duel.trainer);
    }

    function createEngine(playerTeam, inventory, enemyTeam, mode, trainer) {
        const simulation = window.PokemonBattleSimulation;
        const preparedPlayerTeam = playerTeam || leagueRun.state.party;
        const preparedEnemyTeam = enemyTeam || leagueRun.buildEnemyTeam();
        // Held items can change between duels, so the Mega form each Pokemon
        // can reach is resolved fresh every battle.
        preparedPlayerTeam.forEach((pokemon) => {
            pokemon.megaTarget = leagueRun.megaTargetFor(pokemon);
            pokemon.megaEvolved = false;
        });
        return new simulation.BattleEngine({
            playerTeam: preparedPlayerTeam,
            enemyTeam: preparedEnemyTeam,
            inventory: inventory || leagueRun.state.inventory,
            // Metronome picks from the whole dex rather than only the moves
            // the Pokemon on the field happen to know.
            movesById: dataset?.moves || null,
            // Hard mode: no Potions or Revives mid-battle, and trainers switch
            // out of a losing matchup instead of only away from a knockout.
            blockBattleHealing: leagueRun.battleHealingBlocked(),
            matchupSwitching: leagueRun.state.mode === "hard",
            activePerSide: mode === "wild" ? { player: 1, enemy: 1 } : { player: 2, enemy: 2 },
            aiProfile: mode === "wild" ? "wild" : "radical-red",
            // How well this particular trainer plays. Route rookies blunder;
            // gym leaders and bosses do not.
            aiSkill: mode === "wild"
                ? "weak"
                : String(trainer?.strength || leagueRun.trainerStrengthForRound() || "mid").toLowerCase(),
            allowEnemyItems: false,
            // The battle log credits bag items and Poke Balls to the league's
            // own player character rather than to the Pokemon standing there.
            playerName: (LEAGUE_PLAYER_AVATARS[Number(leagueConfig.league.number)]
                || LEAGUE_PLAYER_AVATARS[1]).name,
            captureHandler: mode === "wild" ? (itemKey) => leagueRun.tryCatch(itemKey) : null,
        });
    }

    function renderStarterChoices() {
        ui.starterChoices.replaceChildren();
        const featuredStarterIds = new Set((leagueConfig.starter_rules.featured_starter_ids || []).map(Number));
        displayedStarterChoices.forEach((species) => {
            const button = makeButton("", "starter-card", () => {
                const id = Number(species.id);
                if (selectedStarterIds.has(id)) selectedStarterIds.delete(id);
                else if (selectedStarterIds.size < leagueRun.starterPickCount()) selectedStarterIds.add(id);
                renderStarterChoices();
            });
            const isFeaturedStarter = featuredStarterIds.has(Number(species.id));
            button.classList.toggle("is-featured-starter", isFeaturedStarter);
            button.setAttribute("aria-pressed", String(selectedStarterIds.has(Number(species.id))));
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.src = spriteUrl(species.sprites.front_idle);
            const copy = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = species.display_name;
            const details = document.createElement("small");
            const stage = species.tags.includes("stage-1") ? "STAGE 1" : "BASIC";
            details.textContent = `${isFeaturedStarter ? `${regionName().toUpperCase()} STARTER` : "EARLY ROUTE"} · Lv.5 · ${stage} · ${species.types.map((type) => type.display_name).join(" / ")}`;
            copy.append(name, details);
            button.append(sprite, copy);
            ui.starterChoices.append(button);
        });
        ui.starterCount.textContent = `${selectedStarterIds.size} / ${leagueRun.starterPickCount()} SELECTED`;
        // This screen named Kanto in every league, both in the header and in
        // the "one random Kanto starter" blurb.
        if (ui.starterLeagueLabel) ui.starterLeagueLabel.textContent = `${regionName().toUpperCase()} LEAGUE`;
        if (ui.starterBlurb) {
            ui.starterBlurb.textContent = `Pick two from four: one random ${regionName()} starter`
                + " and three early-route Pokémon.";
        }
        ui.startKantoRun.disabled = selectedStarterIds.size !== leagueRun.starterPickCount();
        ui.startKantoRun.textContent = selectedRunMode === "hard" ? "START HARD RUN" : "START RUN";
    }

    function showStarterSelection() {
        selectedStarterIds.clear();
        displayedStarterChoices = leagueRun.starterChoices();
        hideFrontEndScreens();
        ui.loading.hidden = true;
        ui.shell.hidden = true;
        ui.room.hidden = true;
        ui.trainerIntro.hidden = true;
        ui.result.hidden = true;
        ui.starterScreen.hidden = false;
        ui.screenTitle.textContent = "Choose Your Team";
        ui.screenMode.textContent = `${selectedRunMode.toUpperCase()} · ${leagueConfig.league.name.toUpperCase()}`;
        ui.starterModeLabel.textContent = `${selectedRunMode.toUpperCase()} MODE`;
        renderProgressUi();
        renderStarterChoices();
        window.requestAnimationFrame(() => ui.starterChoices.querySelector("button")?.focus());
    }

    async function mountBattle(enemyTeam, mode, trainer) {
        battleMode = mode || "duel";
        activeTrainer = battleMode === "duel" ? (trainer || leagueRun.state.currentTrainer) : null;
        locked = true;
        cancelBattleAdvance();
        hideFrontEndScreens();
        ui.room.hidden = true;
        ui.trainerIntro.hidden = true;
        ui.shell.hidden = false;
        ui.result.hidden = true;
        if (phaserGame) {
            phaserGame.destroy(true);
            ui.renderer.replaceChildren();
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
        }
        engine = createEngine(leagueRun.state.party, leagueRun.state.inventory, enemyTeam, battleMode, activeTrainer);
        const battlefield = resolveBattlefield(battleMode, activeTrainer);
        ui.renderer.dataset.battleScene = battlefield.id;
        renderStatus();
        // Which back sprite throws the ball, and which trainer stands on the
        // far platform during the intro. Wild battles have no enemy trainer.
        const intro = {
            playerThrowCharacter: ({ 1: "red", 2: "ethan", 3: "lyra", 4: "lucas" })[Number(leagueConfig.league.number)] || "red",
            enemyTrainerSpriteUrl: battleMode === "wild" ? null : spriteUrl(activeTrainer?.sprite || ""),
            wild: battleMode === "wild",
        };
        const view = await window.PokemonBattleView.createGame("battle-renderer", engine, app.dataset.staticPrefix, battlefield, intro);
        phaserGame = view.game;
        scene = view.scene;
        // The DS send-out plays before the command menu unlocks.
        await scene.playIntro?.();
        locked = false;
        renderStatus();
        const opening = battleMode === "wild"
            ? `A wild ${engine.teams.enemy[0].name} appeared in ${leagueRun.state.wildEncounter?.area?.name || regionName()}! This is a 1 vs 1 encounter: weaken it or throw a Poke Ball from the Bag.`
            : `${trainerLabel(activeTrainer)} sent out ${engine.teams.enemy.slice(0, 2).map((pokemon) => pokemon.name).join(" and ")}! What will ${engine.teams.player[0].name} and its ally do?`;
        setMessage(opening, "prompt");
        ui.attack.focus();
    }

    async function startSelectedRun() {
        if (selectedStarterIds.size !== leagueRun.starterPickCount()) return;
        // A finished run leaves its party on the old instance; a new run
        // starts on a fresh one or start() refuses it.
        if (leagueRun.state.party.length) buildLeagueRun();
        clearSavedRun(leagueConfig.league.id);
        leagueRun.start([...selectedStarterIds], selectedRunMode);
        runState = leagueRun.state;
        rewardGranted = false;
        lastWildSummary = null;
        ui.screenTitle.textContent = `${regionName()} League · Duel 1`;
        ui.screenMode.textContent = `${runState.mode === "hard" ? "HARD" : "NORMAL"} · 2 VS 2 · TEAM OF 2`;
        await launchTrainerDuel(leagueRun.prepareDuel());
    }

    // Short codes match the mainline games' status abbreviations so they read
    // instantly to anyone who has played one.
    const STATUS_LABELS = {
        burn: { code: "BRN", label: "Burned", detail: "Attack halved, chip damage each turn" },
        poison: { code: "PSN", label: "Poisoned", detail: "Chip damage each turn" },
        toxic: { code: "TOX", label: "Badly poisoned", detail: "Chip damage grows each turn" },
        paralysis: { code: "PAR", label: "Paralyzed", detail: "Speed halved, may lose the turn" },
        freeze: { code: "FRZ", label: "Frozen", detail: "Cannot move until it thaws" },
        sleep: { code: "SLP", label: "Asleep", detail: "Cannot move until it wakes" },
    };

    const VOLATILE_LABELS = {
        confused: { code: "CNF", label: "Confused", detail: "May hurt itself instead of attacking" },
    };

    // REORDER turns the team grid into a drag surface instead of opening a
    // separate dialog with arrow buttons.
    let reorderMode = false;
    let draggedPartyIndex = null;

    function setReorderMode(active) {
        reorderMode = Boolean(active);
        draggedPartyIndex = null;
        if (ui.openOrder) {
            ui.openOrder.setAttribute("aria-pressed", String(reorderMode));
            ui.openOrder.classList.toggle("is-active", reorderMode);
            ui.openOrder.textContent = reorderMode ? "DONE" : "REORDER";
        }
        ui.roomTeam?.classList.toggle("is-reordering", reorderMode);
        renderRoomTeam();
        setRoomFeedback(reorderMode
            ? "Drag a Pokemon onto another to swap places. The first two lead the next duel."
            : "Spend your reward, prepare the team, then choose the next encounter.", "normal");
    }

    function attachTeamCardBehaviour(card, index, pokemon) {
        if (!reorderMode) {
            // Normal mode: the card is the way into that Pokemon's page.
            card.tabIndex = 0;
            card.setAttribute("role", "button");
            card.title = `View ${pokemon.name}`;
            card.addEventListener("click", () => showPokemonSummary("party", index));
            card.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    showPokemonSummary("party", index);
                }
            });
            return;
        }

        card.draggable = true;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.title = `Drag ${pokemon.name}, or use the arrow keys`;
        card.addEventListener("dragstart", (event) => {
            draggedPartyIndex = index;
            card.classList.add("is-dragging");
            event.dataTransfer.effectAllowed = "move";
            // Firefox needs data set for a drag to start at all.
            event.dataTransfer.setData("text/plain", String(index));
        });
        card.addEventListener("dragend", () => {
            card.classList.remove("is-dragging");
            document.querySelectorAll(".room-pokemon-card.is-drop-target")
                .forEach((node) => node.classList.remove("is-drop-target"));
        });
        card.addEventListener("dragover", (event) => {
            if (draggedPartyIndex === null || draggedPartyIndex === index) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            card.classList.add("is-drop-target");
        });
        card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
        card.addEventListener("drop", (event) => {
            event.preventDefault();
            card.classList.remove("is-drop-target");
            const from = draggedPartyIndex;
            draggedPartyIndex = null;
            if (from === null || from === index) return;
            movePartyMember(from, index);
        });
        // Keyboard equivalent, so reordering does not require a mouse.
        card.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                if (index > 0) movePartyMember(index, index - 1, index - 1);
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                if (index < runState.party.length - 1) movePartyMember(index, index + 1, index + 1);
            }
        });
    }

    function movePartyMember(from, to, focusIndex) {
        try {
            leagueRun.movePartyPokemon(from, to);
        } catch (error) {
            setRoomFeedback(error.message, "danger");
            return;
        }
        renderBetweenRounds();
        const cards = ui.roomTeam?.querySelectorAll(".room-pokemon-card");
        const target = cards?.[Number.isInteger(focusIndex) ? focusIndex : to];
        if (target) target.focus();
        const moved = runState.party[Number.isInteger(focusIndex) ? focusIndex : to];
        setRoomFeedback(`${moved?.name || "Pokemon"} moved to position ${(Number.isInteger(focusIndex) ? focusIndex : to) + 1}.`, "success");
    }

    // Held items had no way of being equipped at all before this: the shop
    // sold them and heldItemKey existed, but nothing ever assigned it.
    function buildHeldItemRow(index, pokemon, location = "party") {
        const row = document.createElement("div");
        row.className = "room-held-row";
        const held = pokemon.heldItemKey ? leagueRun.itemByKey(pokemon.heldItemKey) : null;

        const select = document.createElement("select");
        select.className = "room-held-select";
        const none = document.createElement("option");
        none.value = "";
        none.textContent = held ? "— take it back —" : "No held item";
        select.append(none);
        Object.values(leagueRun.state.inventory)
            .filter((item) => item.quantity > 0 && (item.category === "held" || item.category === "mega-stone"))
            .forEach((item) => {
                const option = document.createElement("option");
                option.value = item.key;
                option.textContent = `${item.name} ×${item.quantity}`;
                select.append(option);
            });
        select.disabled = select.options.length <= 1 && !held;
        select.addEventListener("change", () => {
            try {
                if (select.value) leagueRun.setHeldItem(select.value, location, index);
                else leagueRun.clearHeldItem(location, index);
                renderBetweenRounds();
                setRoomFeedback(select.value
                    ? `${pokemon.name} is now holding ${leagueRun.itemByKey(select.value)?.name || "an item"}.`
                    : `${pokemon.name} is no longer holding anything.`, "normal");
            } catch (error) {
                setRoomFeedback(error.message, "danger");
                renderRoomTeam();
            }
        });

        const label = document.createElement("span");
        label.className = "room-held-label";
        if (held) {
            const mega = leagueRun.megaTargetFor(pokemon);
            label.textContent = mega ? `${held.name} · MEGA READY` : held.name;
            label.classList.toggle("is-mega", Boolean(mega));
            label.title = mega
                ? `${pokemon.name} can Mega Evolve into ${window.PokemonBattleSimulation.megaDisplayName(mega.species)} in battle.`
                : held.description || held.name;
        } else {
            label.textContent = "Holding nothing";
        }
        row.append(label, select);
        return row;
    }

    // The sheet is a 12-wide grid of 40x30 icons indexed by national dex
    // number, so an icon is a background offset rather than its own request.
    function applyPokemonIcon(element, pokemon) {
        const dex = Number(dataset?.pokemon?.find((s) => Number(s.id) === Number(pokemon.id))?.dex_number)
            || Number(pokemon.dexNumber) || 0;
        const sheet = spriteManifest?.icon_sheet;
        if (!sheet || !dex) {
            element.style.backgroundImage = "none";
            return;
        }
        element.style.backgroundImage = `url("${spriteUrl(sheet)}")`;
        element.style.backgroundPosition = `${-(dex % 12) * 40}px ${-Math.floor(dex / 12) * 30}px`;
    }

    // Lazy slug -> description index over the dataset's ability records.
    let abilityDescriptions = null;
    function abilityDescription(slug) {
        if (!abilityDescriptions) {
            abilityDescriptions = {};
            Object.values(dataset?.abilities || {}).forEach((record) => {
                (record.slugs || []).forEach((s) => { abilityDescriptions[s] = record.description || ""; });
            });
        }
        const text = abilityDescriptions[slug] || "";
        // Say so when the battle engine has no implementation for this one,
        // rather than describing an effect that will never happen.
        const abilities = window.PokemonBattleAbilities;
        if (slug && abilities && !abilities.isImplemented(slug)) {
            return `${text}${text ? " " : ""}(Not simulated in this battle engine yet.)`;
        }
        return text;
    }

    // Genderless species get nothing rather than a placeholder glyph.
    function genderSymbol(pokemon) {
        // Nidoran's own name ends in the symbol, so adding one would read
        // "Nidoran♂ ♂".
        if (/[♀♂]\s*$/.test(String(pokemon?.name || ""))) return "";
        if (pokemon?.gender === "female") return " ♀";
        if (pokemon?.gender === "male") return " ♂";
        return "";
    }

    function statusEffects(pokemon) {
        const effects = [];
        const condition = STATUS_LABELS[pokemon?.statusCondition];
        if (condition) effects.push({ ...condition, key: pokemon.statusCondition });
        for (const [key, info] of Object.entries(VOLATILE_LABELS)) {
            if (pokemon?.volatileStatus?.[key]) effects.push({ ...info, key });
        }
        return effects;
    }

    function statusSummary(pokemon) {
        const effects = statusEffects(pokemon);
        return effects.length ? effects.map((effect) => effect.label).join(", ") : "";
    }

    function renderStatusBadges(pokemon, className) {
        const effects = statusEffects(pokemon);
        if (!effects.length) return null;
        const wrapper = document.createElement("span");
        wrapper.className = className || "status-badges";
        for (const effect of effects) {
            const badge = document.createElement("b");
            badge.className = `status-badge status-${effect.key}`;
            badge.textContent = effect.code;
            badge.title = `${effect.label} — ${effect.detail}`;
            wrapper.append(badge);
        }
        return wrapper;
    }

    function renderTeamStrip(container, side) {
        container.replaceChildren();
        const active = new Set(engine.active[side]);
        engine.teams[side].forEach((pokemon, index) => {
            const marker = document.createElement("span");
            marker.className = "team-marker";
            marker.classList.toggle("is-active", active.has(index) && !pokemon.fainted);
            marker.classList.toggle("is-fainted", pokemon.fainted);
            const status = statusSummary(pokemon);
            marker.title = `${pokemon.name}: ${pokemon.hp}/${pokemon.maxHp} HP${status ? ` · ${status}` : ""}`;
            marker.setAttribute("aria-label", marker.title);
            // The Showdown icon sheet was downloaded and listed in the
            // manifest but never used -- the strips were loading whole
            // animated GIFs and scaling them down to a thumbnail.
            const sprite = document.createElement("span");
            sprite.className = "team-marker-icon";
            applyPokemonIcon(sprite, pokemon);
            marker.append(sprite);
            // A fainted Pokemon's lingering status is noise -- it can't act.
            const badges = pokemon.fainted ? null : renderStatusBadges(pokemon, "marker-status");
            if (badges) {
                marker.classList.add("has-status");
                marker.append(badges);
            }
            container.append(marker);
        });
    }

    function renderStatus() {
        ui.round.textContent = engine.result ? "BATTLE OVER" : `TURN ${engine.turn}`;
        renderTeamStrip(ui.playerTeam, "player");
        renderTeamStrip(ui.enemyTeam, "enemy");
        const disabled = locked || Boolean(engine.result);
        ui.attack.disabled = disabled;
        ui.pokemon.disabled = disabled;
        // Matches what the bag will actually list, so the button is never
        // live for a bag that opens empty -- on hard mode every healing item
        // is withheld, which this check used to count as usable.
        ui.item.disabled = disabled || !Object.values(engine.inventory).some((item) => {
            if (item.quantity <= 0) return false;
            const isHealing = item.effect?.type === "heal" || item.effect?.type === "revive";
            if (engine.blockBattleHealing && isHealing) return false;
            return item.effect || (battleMode === "wild" && item.category === "capture");
        });
        ui.forfeit.disabled = locked || Boolean(engine.result);
        if (engine.result) showResult(engine.result);
    }

    // The MEGA trigger rides on the acting Pokemon's HP card and only shows
    // while a move is being chosen, the way the games surface it beside the
    // move list rather than as a top-level command.
    function hideMegaTrigger() {
        if (ui.mega) ui.mega.hidden = true;
    }

    function showMegaTrigger() {
        if (!ui.mega || !ui.stageFrame) return;
        const actor = currentActor();
        if (!actor || locked || engine.result || typeof engine.megaUsability !== "function") {
            hideMegaTrigger();
            return;
        }
        if (!actor.pokemon.megaTarget?.species) {
            hideMegaTrigger();
            return;
        }
        const usability = engine.megaUsability("player", actor.teamIndex);
        ui.mega.hidden = false;
        ui.mega.disabled = !usability.usable;
        ui.mega.title = usability.usable
            ? `Mega Evolve into ${window.PokemonBattleSimulation.megaDisplayName(actor.pokemon.megaTarget.species)}`
            : usability.reason;
        if (ui.megaHint) {
            ui.megaHint.textContent = usability.usable
                ? window.PokemonBattleSimulation.megaDisplayName(actor.pokemon.megaTarget.species).toUpperCase()
                : "UNAVAILABLE";
        }
        positionMegaTrigger(actor.slot);
    }

    // The HP cards are drawn inside the canvas, which is scaled to whatever
    // width the container has, so the card's canvas coordinates are converted
    // into CSS pixels before the button is placed.
    function positionMegaTrigger(slot) {
        const canvas = ui.renderer?.querySelector("canvas");
        if (!canvas || !ui.mega) return;
        const CANVAS_WIDTH = 960;
        const CANVAS_HEIGHT = 480;
        // Matches POSITIONS.player[...] cardX / cardY in the battle scene.
        const cardX = 598;
        const cardY = slot === 1 ? 364 : 284;
        const scaleX = canvas.clientWidth / CANVAS_WIDTH;
        const scaleY = canvas.clientHeight / CANVAS_HEIGHT;
        const frame = ui.stageFrame.getBoundingClientRect();
        const canvasBox = canvas.getBoundingClientRect();
        const offsetX = canvasBox.left - frame.left;
        const offsetY = canvasBox.top - frame.top;
        // Tucked against the card's top-left corner, just above it.
        ui.mega.style.left = `${offsetX + cardX * scaleX}px`;
        ui.mega.style.top = `${offsetY + (cardY - 26) * scaleY}px`;
    }

    function triggerMega() {
        if (locked || engine.result) return;
        const actor = currentActor();
        if (!actor) return;
        try {
            engine.queueMega(actor.slot);
            // Mega Evolving is not this Pokemon's action any more -- it
            // happens at the top of the turn and the Pokemon still attacks --
            // so the command menu stays on it, waiting for a move.
            const name = window.PokemonBattleSimulation
                .megaDisplayName(actor.pokemon.megaTarget.species);
            setMessage(`${actor.pokemon.name} will Mega Evolve into ${name}. Now choose its move.`, "prompt");
            showMegaTrigger();
            renderStatus();
        } catch (error) {
            setMessage(error.message, "danger");
        }
    }

    function showSubmenu(title) {
        ui.submenu.hidden = false;
        ui.commandPanel.classList.add("is-submenu-open");
        ui.submenuTitle.textContent = title;
        ui.submenuContent.replaceChildren();
    }

    function closeSubmenu() {
        hideMegaTrigger();
        ui.submenu.hidden = true;
        ui.commandPanel.classList.remove("is-submenu-open");
        ui.submenuContent.replaceChildren();
        ui.attack.setAttribute("aria-pressed", "false");
        ui.pokemon.setAttribute("aria-pressed", "false");
        ui.item.setAttribute("aria-pressed", "false");
    }

    function currentActor() {
        const slot = engine.getNextCommandSlot();
        if (slot === null) return null;
        const teamIndex = engine.active.player[slot];
        return { slot, teamIndex, pokemon: engine.teams.player[teamIndex] };
    }

    function showMoves() {
        if (locked || engine.result) return;
        const actor = currentActor();
        if (!actor) return;
        ui.attack.setAttribute("aria-pressed", "true");
        ui.pokemon.setAttribute("aria-pressed", "false");
        ui.item.setAttribute("aria-pressed", "false");
        showSubmenu(`Choose ${actor.pokemon.name}'s move`);
        showMegaTrigger();
        // Status conditions live on the battlefield HP cards now. Repeating
        // them here pushed the four moves out of view and forced the menu to
        // scroll, so the move list gets the whole panel.
        const grid = document.createElement("div");
        grid.className = "move-grid";
        actor.pokemon.moves.forEach((move, moveIndex) => {
            const button = makeButton("", "move-choice", () => {
                if (move.targetMode === "selected-opponent") {
                    showEnemyTargets(actor, moveIndex);
                    return;
                }
                // Baton Pass and the other switch moves ask who comes in.
                if (engine.moveNeedsSelfSwitch(actor.slot, moveIndex)) {
                    showSelfSwitchChoices(actor, moveIndex, null);
                    return;
                }
                try {
                    const ready = engine.queueMove(actor.slot, moveIndex, null);
                    actionQueued(ready);
                } catch (error) {
                    setMessage(error.message, "danger");
                }
            });
            const usability = engine.canUseMove("player", actor.teamIndex, moveIndex);
            button.disabled = !usability.usable;
            if (!usability.usable) button.title = usability.reason;
            button.style.setProperty("--type-color", TYPE_COLORS[move.type] || TYPE_COLORS.normal);
            const name = document.createElement("strong");
            name.textContent = move.displayName;
            const details = document.createElement("span");
            details.textContent = `${move.type.toUpperCase()} · ${move.power > 0 ? `PWR ${move.power}` : "STATUS"} · PP ${move.pp}/${move.maxPp}`;
            button.append(name, details);
            grid.append(button);
        });
        ui.submenuContent.append(grid);
    }

    function showEnemyTargets(actor, moveIndex) {
        showSubmenu("Choose an opponent");
        const targetGrid = document.createElement("div");
        targetGrid.className = "target-grid";
        engine.getActivePokemon("enemy").forEach(({ slot, pokemon }) => {
            const button = makeButton(`${pokemon.name} · ${pokemon.hp}/${pokemon.maxHp} HP`, "target-choice target-enemy", () => {
                // U-turn and Volt Switch pick a target and then a successor.
                if (engine.moveNeedsSelfSwitch(actor.slot, moveIndex)) {
                    showSelfSwitchChoices(actor, moveIndex, slot);
                    return;
                }
                try {
                    const ready = engine.queueMove(actor.slot, moveIndex, slot);
                    actionQueued(ready);
                } catch (error) {
                    setMessage(error.message, "danger");
                }
            });
            const badges = renderStatusBadges(pokemon, "status-badges");
            if (badges) {
                button.append(badges);
                button.title = statusSummary(pokemon);
            }
            targetGrid.append(button);
        });
        ui.submenuContent.append(targetGrid);
    }

    // Baton Pass, U-turn, Volt Switch, Flip Turn, Teleport and Shed Tail all
    // leave the field, so the player names the successor here rather than
    // having the engine take whoever happens to be first on the bench.
    function showSelfSwitchChoices(actor, moveIndex, targetSlot) {
        const move = actor.pokemon.moves[moveIndex];
        showSubmenu(`Who comes in after ${move.displayName}?`);
        const grid = document.createElement("div");
        grid.className = "target-grid";
        engine.selfSwitchChoices(actor.slot).forEach(({ pokemon, teamIndex }) => {
            const button = makeButton(
                `${pokemon.name} · ${pokemon.hp}/${pokemon.maxHp} HP`,
                "target-choice target-ally",
                () => {
                    try {
                        const ready = engine.queueMove(actor.slot, moveIndex, targetSlot, teamIndex);
                        actionQueued(ready);
                    } catch (error) {
                        setMessage(error.message, "danger");
                    }
                },
            );
            const icon = document.createElement("span");
            applyPokemonIcon(icon, pokemon);
            button.prepend(icon);
            const badges = renderStatusBadges(pokemon, "status-badges");
            if (badges) button.append(badges);
            grid.append(button);
        });
        ui.submenuContent.append(grid);
    }

    function showPokemonTeam() {
        if (locked || engine.result) return;
        const actor = currentActor();
        if (!actor) return;
        ui.attack.setAttribute("aria-pressed", "false");
        ui.pokemon.setAttribute("aria-pressed", "true");
        ui.item.setAttribute("aria-pressed", "false");
        showSubmenu(`Team · switch ${actor.pokemon.name}`);
        const grid = document.createElement("div");
        grid.className = "battle-team-grid";
        engine.teams.player.forEach((pokemon, teamIndex) => {
            const activeSlot = engine.active.player.indexOf(teamIndex);
            const isActive = activeSlot >= 0;
            const button = makeButton("", "battle-team-choice", () => {
                try {
                    const ready = engine.queueSwitch(actor.slot, teamIndex);
                    actionQueued(ready);
                } catch (error) {
                    setMessage(error.message, "danger");
                }
            });
            button.disabled = isActive || pokemon.fainted;
            button.classList.toggle("is-active", isActive);
            button.classList.toggle("is-fainted", pokemon.fainted);
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.src = spriteUrl(pokemon.sprites.front);
            const copy = document.createElement("span");
            const heading = document.createElement("strong");
            heading.textContent = `${pokemon.name}${genderSymbol(pokemon)} · Lv.${pokemon.level}`;
            if (pokemon.ability?.name) heading.title = `Ability: ${pokemon.ability.name}`;
            const status = document.createElement("small");
            status.textContent = pokemon.fainted
                ? "FAINTED"
                : `${pokemon.hp}/${pokemon.maxHp} HP`;
            if (!pokemon.fainted) {
                const badges = renderStatusBadges(pokemon, "status-badges");
                if (badges) {
                    status.append(" ");
                    status.append(badges);
                }
            }
            const role = document.createElement("em");
            role.textContent = isActive ? `ACTIVE ${activeSlot + 1}` : "SWITCH IN";
            copy.append(heading, status, role);
            button.append(sprite, copy);
            grid.append(button);
        });
        ui.submenuContent.append(grid);
    }

    function showItems() {
        if (locked || engine.result) return;
        const actor = currentActor();
        if (!actor) return;
        ui.attack.setAttribute("aria-pressed", "false");
        ui.pokemon.setAttribute("aria-pressed", "false");
        ui.item.setAttribute("aria-pressed", "true");
        showSubmenu(`Use an item — ${actor.pokemon.name}'s action`);
        const grid = document.createElement("div");
        grid.className = "item-grid";
        // Hard mode keeps healing for between duels, so those items are left
        // out of the battle bag rather than shown and then refused.
        const healingBlocked = engine.blockBattleHealing;
        const battleItems = Object.entries(engine.inventory).filter(([, item]) => {
            // Selling or using the last one leaves the entry behind on zero.
            // The room bag and the held-item picker already skip those; this
            // list showed them greyed out at x0 instead.
            if (item.quantity <= 0) return false;
            const isHealing = item.effect?.type === "heal" || item.effect?.type === "revive";
            if (healingBlocked && isHealing) return false;
            return item.effect || (battleMode === "wild" && item.category === "capture");
        });
        if (healingBlocked) {
            const note = document.createElement("p");
            note.className = "submenu-note";
            note.textContent = "Hard mode — Potions and Revives can only be used between battles.";
            ui.submenuContent.append(note);
        }
        battleItems.forEach(([itemKey, item]) => {
            const button = makeButton("", "item-choice", () => {
                if (item.category === "capture") {
                    try {
                        const ready = engine.queueCapture(actor.slot, itemKey);
                        actionQueued(ready);
                    } catch (error) {
                        setMessage(error.message, "danger");
                    }
                } else {
                    showItemTargets(actor, itemKey);
                }
            });
            button.disabled = item.quantity <= 0;
            if (item.sprite) {
                const icon = document.createElement("img");
                icon.alt = "";
                icon.src = itemSpriteUrl(item);
                button.append(icon);
            }
            const copy = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = item.name;
            const quantity = document.createElement("small");
            quantity.textContent = `×${item.quantity}`;
            copy.append(name, quantity);
            button.append(copy);
            grid.append(button);
        });
        ui.submenuContent.append(grid);
    }

    function showItemTargets(actor, itemKey) {
        const item = engine.inventory[itemKey];
        showSubmenu(`Use ${item.name} on...`);
        const grid = document.createElement("div");
        grid.className = "target-grid team-target-grid";
        engine.teams.player.forEach((pokemon, targetIndex) => {
            const invalidRevive = item.effect.type === "revive" && !pokemon.fainted;
            const invalidHeal = item.effect.type !== "revive" && (pokemon.fainted || pokemon.hp >= pokemon.maxHp);
            const button = makeButton(`${pokemon.name} · ${pokemon.fainted ? "FAINTED" : `${pokemon.hp}/${pokemon.maxHp} HP`}`, "target-choice", () => {
                try {
                    const ready = engine.queueItem(actor.slot, itemKey, targetIndex);
                    actionQueued(ready);
                } catch (error) {
                    setMessage(error.message, "danger");
                }
            });
            button.disabled = invalidRevive || invalidHeal;
            grid.append(button);
        });
        ui.submenuContent.append(grid);
    }

    // What the committed Pokemon on the field are locked into, if any.
    function commitmentNotes() {
        return engine.getActivePokemon("player")
            .filter((entry) => engine.isCommitted("player", entry.teamIndex))
            .map((entry) => engine.commitmentLabel("player", entry.teamIndex))
            .filter(Boolean);
    }

    // Committed Pokemon never reach the command menu. When every active one
    // is mid-move there is nothing to choose, so the turn plays itself.
    function promptNextCommand() {
        if (engine.result) return;
        const next = currentActor();
        const notes = commitmentNotes();
        if (!next) {
            setMessage(notes.join(" ") || "The battle continues...", "prompt");
            resolveTurn();
            return;
        }
        const prefix = notes.length ? `${notes.join(" ")} ` : "";
        setMessage(`${prefix}What will ${next.pokemon.name} do?`, "prompt");
        ui.attack.focus();
    }

    function actionQueued(ready) {
        closeSubmenu();
        if (ready) {
            resolveTurn();
            return;
        }
        const next = currentActor();
        if (!next) {
            resolveTurn();
            return;
        }
        setMessage(`Now choose ${next.pokemon.name}'s action.`, "prompt");
        renderStatus();
    }

    async function resolveTurn() {
        locked = true;
        closeSubmenu();
        renderStatus();
        const events = engine.resolveTurn();
        // The turn has already happened in the engine; playback is only the
        // telling of it. A failure here must not skip what comes after --
        // that is how a caught Pokemon used to vanish, with the prompt that
        // files it away never reached.
        try {
            await scene.playEvents(
                events,
                (message, type) => setMessage(message, type === "result" ? "result" : "normal"),
                waitForBattleAdvance,
            );
        } catch (error) {
            console.warn("battle playback failed; continuing with the turn result.", error);
        }
        scene.sync(engine);
        if (battleMode === "wild" && engine.result === "capture") {
            locked = true;
            leagueRun.settleAfterWildEncounter();
            noteWildOutcome("capture", runState.pendingCapture?.name);
            enterBetweenRounds();
            showCaptureDestination(runState.pendingCapture);
            return;
        }
        locked = Boolean(engine.result);
        renderStatus();
        if (engine.phase === "replace") {
            showReplacementPicker();
            return;
        }
        promptNextCommand();
    }

    // A fainted slot used to be refilled automatically by the engine. Now the
    // battle pauses here and the player picks who comes out next.
    function showReplacementPicker() {
        const slots = engine.pendingReplacements();
        if (!slots.length) {
            promptNextCommand();
            return;
        }
        locked = true;
        renderStatus();
        const slot = slots[0];
        const remaining = slots.length > 1 ? ` (${slots.length} slots to fill)` : "";
        setMessage(`Choose the next Pokemon${remaining}.`, "prompt");
        showSubmenu("Send out which Pokemon?");
        const grid = document.createElement("div");
        grid.className = "target-grid";
        engine.replacementChoices().forEach(({ pokemon, teamIndex }) => {
            const button = makeButton(
                `${pokemon.name}${genderSymbol(pokemon)} · Lv.${pokemon.level} · ${pokemon.hp}/${pokemon.maxHp} HP`,
                "target-choice target-ally",
                () => sendReplacement(slot, teamIndex),
            );
            const badges = renderStatusBadges(pokemon, "status-badges");
            if (badges) {
                button.append(badges);
                button.title = statusSummary(pokemon);
            }
            grid.append(button);
        });
        ui.submenuContent.append(grid);
    }

    async function sendReplacement(slot, teamIndex) {
        let events;
        try {
            events = engine.sendReplacement(slot, teamIndex);
        } catch (error) {
            setMessage(error.message, "danger");
            return;
        }
        closeSubmenu();
        await scene.playEvents(
            events,
            (message, type) => setMessage(message, type === "result" ? "result" : "normal"),
            waitForBattleAdvance,
        );
        scene.sync(engine);
        if (engine.phase === "replace") {
            showReplacementPicker();
            return;
        }
        // renderStatus shows the end-of-battle result when there is one.
        locked = Boolean(engine.result);
        renderStatus();
        if (engine.result) return;
        promptNextCommand();
    }

    function setRoomFeedback(message, tone) {
        ui.roomFeedback.textContent = message;
        ui.roomFeedback.dataset.tone = tone || "normal";
    }

    function createShopCard(offer) {
        const card = document.createElement("article");
        card.className = "shop-card";
        const iconWrap = document.createElement("span");
        iconWrap.className = "shop-card-icon";
        const copy = document.createElement("span");
        copy.className = "shop-card-copy";
        const name = document.createElement("strong");
        const blurb = document.createElement("small");
        blurb.className = "shop-card-meta";
        const buy = makeButton(`BUY\n₽${offer.price}`, "shop-buy", () => purchaseOffer(offer));
        const icon = document.createElement("img");
        icon.alt = `${offer.item.name} icon`;
        icon.src = itemSpriteUrl(offer.item);
        iconWrap.append(icon);
        name.textContent = offer.item.name;
        const category = offer.category.replace("-", " ").toUpperCase();
        const owned = runState.inventory[offer.item.key]?.quantity || 0;
        blurb.textContent = `${category} · Owned: ${owned}${offer.stock === 1 ? " · LAST ONE" : ""}`;
        // Rarity is what drives price and availability now, so it is shown.
        if (offer.rarity) {
            card.dataset.rarity = offer.rarity;
            const gem = document.createElement("span");
            gem.className = "shop-rarity";
            gem.textContent = offer.rarity.toUpperCase();
            copy.append(gem);
        }
        const showDescription = offer.category === "held"
            || offer.category === "mega-stone"
            || String(offer.item.name).toLowerCase().includes("berry");
        card.classList.toggle("is-pokemon", offer.category === "evolution" || offer.category === "mega-stone");
        card.classList.toggle("has-description", showDescription);
        buy.disabled = offer.stock <= 0 || runState.money < offer.price;
        copy.append(name, blurb);
        if (showDescription) {
            const description = document.createElement("small");
            description.className = "shop-card-description";
            description.textContent = offer.item.description || "A held item used by its holder during battle.";
            copy.append(description);
            card.title = description.textContent;
        }
        card.append(iconWrap, copy, buy);
        return card;
    }

    function renderShop() {
        ui.shopOffers.replaceChildren();
        runState.shopOffers.forEach((offer) => ui.shopOffers.append(createShopCard(offer)));
        renderShopRefresh();
    }

    // The restock button hides itself entirely on a league that prices the
    // service at zero, rather than sitting there permanently disabled.
    function renderShopRefresh() {
        if (!ui.shopRefresh) return;
        const fee = leagueRun.shopRefreshFee();
        const offered = fee > 0 && runState.shopOffers.length > 0;
        ui.shopRefresh.hidden = !offered;
        if (!offered) return;
        ui.shopRefreshFee.textContent = `₽${fee.toLocaleString("en-US")}`;
        const affordable = runState.money >= fee;
        ui.shopRefresh.disabled = !affordable;
        ui.shopRefresh.title = affordable
            ? "Put a fresh set of goods on the counter."
            : `You need ₽${(fee - runState.money).toLocaleString("en-US")} more to restock.`;
    }

    function renderRoomTeam() {
        ui.roomTeam.replaceChildren();
        runState.party.forEach((pokemon, index) => {
            const ratio = pokemon.hp / Math.max(1, pokemon.maxHp);
            const card = document.createElement("article");
            card.className = "room-pokemon-card";
            card.classList.toggle("is-fainted", pokemon.fainted);
            card.classList.toggle("is-low", !pokemon.fainted && ratio <= 0.35);
            card.classList.toggle("is-lead", index < 2);

            const order = document.createElement("span");
            order.className = "room-pokemon-order";
            order.textContent = index < 2 ? `LEAD ${index + 1}` : `#${index + 1}`;

            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.src = spriteUrl(pokemon.sprites.front);
            const details = document.createElement("div");
            const heading = document.createElement("div");
            heading.className = "room-pokemon-name";
            const name = document.createElement("strong");
            name.textContent = pokemon.name;
            const level = document.createElement("span");
            level.textContent = `Lv.${pokemon.level}`;
            heading.append(name, level);

            const track = document.createElement("div");
            track.className = "room-hp-track";
            const fill = document.createElement("div");
            fill.className = "room-hp-fill";
            fill.classList.toggle("is-low", ratio <= 0.5 && ratio > 0.2);
            fill.classList.toggle("is-critical", ratio <= 0.2);
            fill.style.width = `${Math.max(0, ratio * 100)}%`;
            track.append(fill);
            const hp = document.createElement("div");
            hp.className = "room-pokemon-hp";
            const xpNeeded = leagueRun.experienceNeeded(pokemon.level);
            hp.textContent = pokemon.fainted
                ? "FAINTED"
                : `HP ${pokemon.hp}/${pokemon.maxHp} · EXP ${pokemon.experience || 0}/${xpNeeded}`;
            const types = document.createElement("div");
            types.className = "room-type-row";
            pokemon.types.forEach((type) => {
                const chip = document.createElement("span");
                chip.className = "room-type";
                chip.style.setProperty("--type-color", TYPE_COLORS[type] || TYPE_COLORS.normal);
                chip.textContent = type.toUpperCase();
                types.append(chip);
            });
            if (pokemon.ability?.name) {
                const abilityChip = document.createElement("span");
                abilityChip.className = "room-ability";
                abilityChip.textContent = pokemon.ability.name.toUpperCase();
                abilityChip.title = abilityDescription(pokemon.ability.slug) || `Ability: ${pokemon.ability.name}`;
                types.append(abilityChip);
            }
            details.append(heading, track, hp, types);
            card.append(order, sprite, details);
            attachTeamCardBehaviour(card, index, pokemon);
            ui.roomTeam.append(card);
        });
    }

    function renderBetweenRounds() {
        saveRunCheckpoint();
        const story = leagueRun.storyStatus();
        const nextBossName = milestoneTrainerName(story.next);
        // Static in the markup, so every league's shop screen read KANTO.
        if (ui.roomKicker) {
            ui.roomKicker.textContent = `LEAGUE ${Number(leagueConfig?.league?.number) || 1} · ${regionName().toUpperCase()}`;
        }
        ui.roomHeading.textContent = story.leagueComplete
            ? `${regionName()} adventure complete`
            : story.nextReady
                ? `${story.next.chapter} · ${nextBossName} awaits`
                : `Duel ${runState.round} complete`;
        ui.roomRound.textContent = `DUEL ${runState.round} · STORY ${story.completed}/${story.total}`;
        ui.roomWins.textContent = `${runState.wins} ${runState.wins === 1 ? "WIN" : "WINS"}`;
        ui.roomLegacy.textContent = `LEGACY ${runState.legacy}`;
        ui.roomMode.textContent = runState.mode === "hard" ? "HARD" : "NORMAL";
        ui.roomMode.classList.toggle("is-hard", runState.mode === "hard");
        ui.roomMoney.textContent = `₽${runState.money.toLocaleString("en-US")}`;
        ui.bagCount.textContent = Object.values(runState.inventory).reduce((total, item) => total + item.quantity, 0);
        ui.pcCount.textContent = runState.pc.length;
        const wildArea = leagueRun.currentWildArea();
        // Kanto has dedicated preview art; the other leagues show the area's
        // own battle backdrop, so the card never falls back to FireRed art.
        if (Number(leagueConfig.league.number) === 1) {
            const previewName = KANTO_AREA_PREVIEWS[wildArea.id] || "viridian-forest";
            ui.wildPreview.style.backgroundImage = `url("${spritersAssetUrl(`area-previews/${previewName}.png`)}")`;
        } else {
            const scenes = leagueConfig.battle_scenes || {};
            const sceneId = scenes.wild_area_scenes?.[wildArea.id] || scenes.default || "route";
            ui.wildPreview.style.backgroundImage = `url("${spriteUrl(`${scenes.asset_root}${sceneId}-backdrop.png`)}")`;
        }
        ui.wildFee.textContent = runState.wildEncounterUsed
            ? `${wildArea.shortName.toUpperCase()} · USED`
            : `${wildArea.shortName.toUpperCase()} · FEE ₽${leagueRun.wildFee()}`;
        ui.wildEncounter.disabled = runState.wildEncounterUsed;
        ui.nextDuel.disabled = story.leagueComplete;
        ui.nextDuel.textContent = story.leagueComplete
            ? "LEAGUE COMPLETE"
            : story.nextReady
                ? `FACE ${nextBossName.toUpperCase()} →`
                : "NEXT TRAINER →";
        renderProgressUi();
        renderShop();
        renderRoomTeam();
    }

    function purchaseOffer(offer) {
        try {
            const item = leagueRun.buyOffer(offer.offerId);
            setRoomFeedback(`${item.name} was added to the Bag.`, "success");
            renderBetweenRounds();
        } catch (error) {
            setRoomFeedback(error.message, "danger");
        }
    }

    function openRoomDialog(kicker, title, variant = "") {
        ui.roomDialogKicker.textContent = kicker;
        ui.roomDialogTitle.textContent = title;
        ui.roomDialogContent.replaceChildren();
        ui.roomDialog.classList.toggle("is-pc", variant === "pc");
        ui.roomDialog.classList.toggle("is-bag", variant === "bag");
        ui.roomDialog.classList.toggle("is-moves", variant === "moves");
        ui.roomDialog.classList.toggle("is-order", variant === "order");
        if (!ui.roomDialog.open) ui.roomDialog.showModal();
    }

    function showLeagueDex() {
        const progress = leagueRun.progressSummary();
        openRoomDialog(`${regionName().toUpperCase()} LEAGUE`, `League Dex · ${progress.registered}/${progress.dexTotal} registered`);

        const summary = document.createElement("div");
        summary.className = "dex-summary";
        [
            [`${progress.registered}/${progress.dexTotal}`, "REGISTERED"],
            [`ROUND ${progress.bestRounds}`, "BEST RECORD"],
        ].forEach(([value, label]) => {
            const card = document.createElement("span");
            const strong = document.createElement("strong");
            strong.textContent = value;
            card.append(strong, label);
            summary.append(card);
        });

        const mastery = document.createElement("p");
        mastery.className = "dex-mastery-note";
        // Named Kanto and Mew outright, so Johto's reward was announced as
        // Kanto's; the mythical differs per league (Celebi, Jirachi...).
        const mythicalId = Number(leagueConfig?.league_progression?.mew_species_id);
        const mythicalName = dataset?.pokemon?.find((p) => Number(p.id) === mythicalId)?.display_name
            || "the region's Mythical Pokémon";
        mastery.textContent = progress.mewWildUnlocked
            ? `${regionName()} mastery complete — ${mythicalName} is now part of the random wild encounter pool.`
            : `League reward: unlock ${mythicalName}.`;

        const grid = document.createElement("div");
        grid.className = "dex-grid";
        leagueRun.getDexEntries().forEach((entry) => {
            const species = entry.species;
            const card = document.createElement("article");
            card.className = "dex-entry";
            card.classList.toggle("is-registered", entry.registered);
            card.classList.toggle("is-locked", entry.locked);
            const number = document.createElement("small");
            number.textContent = `#${String(species.dex_number).padStart(3, "0")}`;
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.src = spriteUrl(species.sprites.front_idle);
            const name = document.createElement("strong");
            name.textContent = entry.locked && !entry.registered ? "LOCKED" : species.display_name;
            const status = document.createElement("em");
            status.textContent = entry.locked
                ? (entry.reward === "mew" ? "MASTER REWARD" : "LEAGUE REWARD")
                : (entry.registered ? "REGISTERED" : "UNDISCOVERED");
            card.append(number, sprite, name, status);
            grid.append(card);
        });
        ui.roomDialogContent.append(summary, mastery, grid);
    }

    function showPokemonTargets(title, predicate, onSelect) {
        openRoomDialog("CHOOSE A TARGET", title);
        const grid = document.createElement("div");
        grid.className = "replace-grid";
        [["party", runState.party], ["pc", runState.pc]].forEach(([location, pokemonList]) => {
            pokemonList.forEach((pokemon, index) => {
                const button = makeButton("", "replace-choice", () => onSelect(location, index, pokemon));
                button.disabled = !predicate(location, index, pokemon);
                const sprite = document.createElement("img");
                sprite.alt = "";
                sprite.src = spriteUrl(pokemon.sprites.front);
                const copy = document.createElement("span");
                const name = document.createElement("strong");
                name.textContent = pokemon.name;
                const details = document.createElement("small");
                details.textContent = `${location.toUpperCase()} · Lv.${pokemon.level} · ${pokemon.hp}/${pokemon.maxHp} HP`;
                copy.append(name, details);
                button.append(sprite, copy);
                grid.append(button);
            });
        });
        ui.roomDialogContent.append(grid);
    }

    function showHealingTargets(item) {
        const canUse = (location, index, pokemon) => item.effect.type === "revive"
            ? pokemon.fainted
            : !pokemon.fainted && pokemon.hp < pokemon.maxHp;
        showPokemonTargets(`Use ${item.name}`, canUse, (location, index, pokemon) => {
            if (item.quantity <= 0) return;
            if (item.effect.type === "revive") {
                pokemon.fainted = false;
                pokemon.hp = Math.max(1, Math.floor(pokemon.maxHp * item.effect.ratio));
            } else {
                pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + item.effect.amount);
            }
            item.quantity -= 1;
            ui.roomDialog.close();
            setRoomFeedback(`${item.name} restored ${pokemon.name}.`, "success");
            renderBetweenRounds();
        });
    }

    function showEvolutionTargets(item) {
        const groupName = item.category === "mega-stone" ? "mega-stones" : "evolution-items";
        const canUse = (location, index, pokemon) => Boolean(leagueRun.evolutionForItem(pokemon, item.id, groupName));
        showPokemonTargets(`Use ${item.name}`, canUse, (location, index) => {
            try {
                const result = leagueRun.useEvolutionItem(item.key, location, index);
                ui.roomDialog.close();
                setRoomFeedback(`${result.from} evolved into ${result.to}!`, "success");
                renderBetweenRounds();
            } catch (error) {
                setRoomFeedback(error.message, "danger");
            }
        });
    }

    function showBagDialog(lastMessage) {
        openRoomDialog("INVENTORY", "Bag", "bag");
        const summary = document.createElement("div");
        summary.className = "bag-summary";
        const summaryCopy = document.createElement("span");
        const totalItems = Object.values(runState.inventory).reduce((total, item) => total + item.quantity, 0);
        summaryCopy.textContent = lastMessage || `${totalItems} items available · choose an amount before selling.`;
        const money = document.createElement("strong");
        money.textContent = `₽${runState.money.toLocaleString("en-US")}`;
        summary.append(summaryCopy, money);
        const list = document.createElement("div");
        list.className = "bag-list";
        Object.values(runState.inventory).filter((item) => item.quantity > 0).forEach((item) => {
            const row = document.createElement("article");
            row.className = "bag-row";
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.src = itemSpriteUrl(item);
            const copy = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = item.name;
            const description = document.createElement("small");
            description.textContent = item.description;
            copy.append(name, description);
            const quantity = document.createElement("b");
            quantity.textContent = `×${item.quantity}`;
            const actions = document.createElement("span");
            actions.className = "bag-actions";
            if (item.effect || item.category === "evolution" || item.category === "mega-stone") {
                const use = makeButton("USE", "inventory-button", () => {
                    if (item.effect) showHealingTargets(item);
                    else showEvolutionTargets(item);
                });
                actions.append(use);
            }
            const sellControl = document.createElement("span");
            sellControl.className = "bag-sell-control";
            const amount = document.createElement("input");
            amount.className = "bag-sell-quantity";
            amount.type = "number";
            amount.min = "1";
            amount.max = String(item.quantity);
            amount.value = "1";
            amount.setAttribute("aria-label", `Quantity of ${item.name} to sell`);
            const sellQuantity = (count) => {
                try {
                    const quantityToSell = Math.max(1, Math.min(item.quantity, Number(count) || 1));
                    const earned = leagueRun.sellItem(item.key, quantityToSell);
                    const feedback = `Sold ${item.name} ×${quantityToSell} for ₽${earned}.`;
                    setRoomFeedback(feedback, "success");
                    renderBetweenRounds();
                    showBagDialog(feedback);
                } catch (error) {
                    setRoomFeedback(error.message, "danger");
                }
            };
            const usable = item.effect?.type === "heal" || item.effect?.type === "revive";
            if (usable) {
                const use = makeButton("USE", "inventory-button inventory-use", () => {
                    const targets = runState.party
                        .map((pokemon, index) => ({ pokemon, index }))
                        .filter(({ pokemon }) => item.effect.type === "revive"
                            ? pokemon.fainted
                            : !pokemon.fainted && pokemon.hp < pokemon.maxHp);
                    if (!targets.length) {
                        showBagDialog(item.effect.type === "revive"
                            ? "No fainted Pokemon to revive." : "Everyone is already healthy.");
                        return;
                    }
                    openRoomDialog("BAG", `Use ${item.name} on...`, "bag");
                    const grid = document.createElement("div");
                    grid.className = "target-grid team-target-grid";
                    targets.forEach(({ pokemon, index }) => {
                        const pickTarget = makeButton(
                            `${pokemon.name} · ${pokemon.fainted ? "FAINTED" : `${pokemon.hp}/${pokemon.maxHp} HP`}`,
                            "target-choice", () => {
                                try {
                                    const used = leagueRun.useItemFromBag(item.key, "party", index);
                                    setRoomFeedback(`${used.item.name} used on ${used.pokemon.name}.`, "success");
                                    renderBetweenRounds();
                                    showBagDialog(`${used.item.name} used on ${used.pokemon.name}.`);
                                } catch (error) {
                                    setRoomFeedback(error.message, "danger");
                                    showBagDialog(error.message);
                                }
                            });
                        grid.append(pickTarget);
                    });
                    ui.roomDialogContent.append(grid);
                });
                actions.append(use);
            }
            const sell = makeButton("SELL", "inventory-button inventory-sell", () => sellQuantity(amount.value));
            const sellAll = makeButton(`SELL ALL · ₽${item.sellPrice * item.quantity}`, "inventory-button inventory-sell inventory-sell-all", () => sellQuantity(item.quantity));
            sellControl.append(amount, sell, sellAll);
            actions.append(sellControl);
            row.append(sprite, copy, quantity, actions);
            list.append(row);
        });
        if (!list.children.length) {
            const empty = document.createElement("p");
            empty.className = "empty-pc";
            empty.textContent = "The Bag is empty.";
            list.append(empty);
        }
        ui.roomDialogContent.append(summary, list);
    }

    // One page per Pokemon holding everything about it, the way the modern
    // games do it -- stats, ability, held item and moves together, instead of
    // a separate stats table and move manager.
    function showPokemonSummary(location, index) {
        const list = runState[location] || [];
        const pokemon = list[index];
        if (!pokemon) return;
        openRoomDialog(location === "pc" ? "PC BOX" : "PARTY",
            `${pokemon.name}${genderSymbol(pokemon)} · Lv.${pokemon.level}`, "summary");

        const page = document.createElement("div");
        page.className = "summary-page";

        // --- portrait and identity ---
        const hero = document.createElement("div");
        hero.className = "summary-hero";
        const art = document.createElement("img");
        art.className = "summary-art";
        art.alt = "";
        art.src = spriteUrl(pokemon.sprites.front);
        const identity = document.createElement("div");
        identity.className = "summary-identity";
        const title = document.createElement("strong");
        title.textContent = `${pokemon.name}${genderSymbol(pokemon)}`;
        const level = document.createElement("small");
        const xpNeeded = leagueRun.experienceNeeded(pokemon.level);
        level.textContent = `Lv.${pokemon.level} · EXP ${pokemon.experience || 0}/${xpNeeded}`;
        const types = document.createElement("div");
        types.className = "summary-types";
        pokemon.types.forEach((type) => {
            const chip = document.createElement("span");
            chip.className = "room-type";
            chip.style.setProperty("--type-color", TYPE_COLORS[type] || TYPE_COLORS.normal);
            chip.textContent = type.toUpperCase();
            types.append(chip);
        });
        identity.append(title, level, types);
        hero.append(art, identity);

        // --- health ---
        const health = document.createElement("div");
        health.className = "summary-health";
        const ratio = pokemon.hp / Math.max(1, pokemon.maxHp);
        const track = document.createElement("div");
        track.className = "room-hp-track";
        const fill = document.createElement("div");
        fill.className = "room-hp-fill";
        fill.classList.toggle("is-low", ratio <= 0.5 && ratio > 0.2);
        fill.classList.toggle("is-critical", ratio <= 0.2);
        fill.style.width = `${Math.max(0, ratio * 100)}%`;
        track.append(fill);
        const hpLabel = document.createElement("small");
        hpLabel.textContent = pokemon.fainted ? "FAINTED" : `HP ${pokemon.hp}/${pokemon.maxHp}`;
        health.append(hpLabel, track);

        // --- stat spread with bars ---
        const stats = document.createElement("div");
        stats.className = "summary-stats";
        const rows = [
            ["HP", pokemon.maxHp],
            ["Attack", pokemon.stats.attack],
            ["Defense", pokemon.stats.defense],
            ["Sp. Atk", pokemon.stats.specialAttack],
            ["Sp. Def", pokemon.stats.specialDefense],
            ["Speed", pokemon.stats.speed],
        ];
        const highest = Math.max(...rows.map(([, value]) => Number(value) || 0), 1);
        rows.forEach(([label, value]) => {
            const row = document.createElement("div");
            row.className = "summary-stat-row";
            const name = document.createElement("small");
            name.textContent = label;
            const number = document.createElement("strong");
            number.textContent = value;
            const bar = document.createElement("div");
            bar.className = "summary-stat-track";
            const barFill = document.createElement("i");
            barFill.style.width = `${(Number(value) / highest) * 100}%`;
            bar.append(barFill);
            row.append(name, number, bar);
            stats.append(row);
        });

        // --- ability and held item ---
        const traits = document.createElement("div");
        traits.className = "summary-traits";
        const abilityBlock = document.createElement("div");
        abilityBlock.className = "summary-trait";
        const abilityLabel = document.createElement("small");
        abilityLabel.textContent = "ABILITY";
        const abilityName = document.createElement("strong");
        abilityName.textContent = pokemon.ability?.name || "—";
        const abilityText = document.createElement("p");
        abilityText.textContent = abilityDescription(pokemon.ability?.slug) || "";
        abilityBlock.append(abilityLabel, abilityName, abilityText);

        const itemBlock = document.createElement("div");
        itemBlock.className = "summary-trait";
        const itemLabel = document.createElement("small");
        itemLabel.textContent = "HELD ITEM";
        itemBlock.append(itemLabel, buildHeldItemRow(index, pokemon, location));
        traits.append(abilityBlock, itemBlock);

        // --- moves, editable in place ---
        const movesBlock = document.createElement("div");
        movesBlock.className = "summary-moves";
        const movesHeader = document.createElement("div");
        movesHeader.className = "summary-moves-header";
        const movesTitle = document.createElement("strong");
        movesTitle.textContent = "MOVES";
        const editMoves = makeButton("CHANGE MOVES", "dialog-button",
            () => showPokemonMoveLibrary(location, index));
        movesHeader.append(movesTitle, editMoves);
        const moveGrid = document.createElement("div");
        moveGrid.className = "summary-move-grid";
        pokemon.moves.forEach((move) => {
            const card = document.createElement("article");
            card.className = "summary-move";
            card.style.setProperty("--type-color", TYPE_COLORS[move.type] || TYPE_COLORS.normal);
            const name = document.createElement("strong");
            name.textContent = move.displayName;
            const meta = document.createElement("small");
            const summaryMeta = moveMetaParts(move, { pp: "current" });
            meta.textContent = summaryMeta.text;
            meta.dataset.damageClass = summaryMeta.damageClass;
            const text = document.createElement("p");
            text.textContent = move.description || "";
            card.append(name, meta, text);
            moveGrid.append(card);
        });
        movesBlock.append(movesHeader, moveGrid);

        // --- flip through the party without going back ---
        const nav = document.createElement("div");
        nav.className = "summary-nav";
        const previous = makeButton("← PREVIOUS", "dialog-button",
            () => showPokemonSummary(location, (index - 1 + list.length) % list.length));
        const position = document.createElement("small");
        position.textContent = `${index + 1} / ${list.length}`;
        const next = makeButton("NEXT →", "dialog-button",
            () => showPokemonSummary(location, (index + 1) % list.length));
        previous.disabled = list.length < 2;
        next.disabled = list.length < 2;
        nav.append(previous, position, next);

        page.append(hero, health, stats, traits, movesBlock, nav);
        ui.roomDialogContent.append(page);
    }

    // Whether a move runs off Attack or Special Attack decides which of a
    // Pokemon's stats it actually uses, so it belongs next to the power rather
    // than buried in the description.
    const DAMAGE_CLASS_LABELS = { physical: "PHYSICAL", special: "SPECIAL", status: "STATUS" };

    function moveDamageClass(move) {
        const raw = String(move.damageClass || "").toLowerCase();
        if (DAMAGE_CLASS_LABELS[raw]) return raw;
        return move.power > 0 ? "physical" : "status";
    }

    // TYPE · CLASS · PWR · ACC · PP, skipping power for a status move.
    function moveMetaParts(move, { pp = "max" } = {}) {
        const damageClass = moveDamageClass(move);
        const parts = [move.type.toUpperCase(), DAMAGE_CLASS_LABELS[damageClass]];
        if (move.power > 0) parts.push(`PWR ${move.power}`);
        parts.push(`ACC ${move.accuracy}%`);
        parts.push(pp === "current" ? `PP ${move.pp}/${move.maxPp}` : `PP ${move.maxPp}`);
        return { damageClass, text: parts.join(" · ") };
    }

    function showPokemonMoveLibrary(location, index) {
        const pokemon = runState[location]?.[index];
        if (!pokemon) return;
        openRoomDialog("MOVE MANAGER", `${pokemon.name} · Lv.${pokemon.level}`, "moves");
        const selectedIds = pokemon.moves.map((move) => Number(move.id));
        const knownMoves = leagueRun.knownMoves(location, index);
        const heading = document.createElement("div");
        heading.className = "move-manager-heading";
        const headingCopy = document.createElement("span");
        const headingTitle = document.createElement("strong");
        headingTitle.textContent = "EQUIPPED MOVE SET";
        const headingStatus = document.createElement("small");
        headingCopy.append(headingTitle, headingStatus);
        const back = makeButton("← BACK TO SUMMARY", "dialog-button", () => showPokemonSummary(location, index));
        heading.append(headingCopy, back);
        const library = document.createElement("div");
        library.className = "move-library";
        const footer = document.createElement("div");
        footer.className = "move-manager-footer";
        const cancel = makeButton("CANCEL", "dialog-button", () => showPokemonSummary(location, index));
        const save = makeButton("SAVE MOVES", "dialog-button", () => {
            try {
                leagueRun.setPokemonMoves(location, index, selectedIds);
                setRoomFeedback(`${pokemon.name}'s move set was updated.`, "success");
                renderBetweenRounds();
                showPokemonSummary(location, index);
            } catch (error) {
                headingStatus.textContent = error.message;
            }
        });
        footer.append(cancel, save);

        const renderLibrary = () => {
            headingStatus.textContent = `${selectedIds.length}/4 selected · at least one move is required`;
            save.disabled = selectedIds.length < 1 || selectedIds.length > 4;
            library.replaceChildren();
            knownMoves.forEach((move) => {
                const selected = selectedIds.includes(Number(move.id));
                const choice = makeButton("", "move-library-choice", () => {
                    const moveId = Number(move.id);
                    const selectedIndex = selectedIds.indexOf(moveId);
                    if (selectedIndex >= 0) {
                        if (selectedIds.length === 1) {
                            headingStatus.textContent = "A Pokemon must keep at least one move.";
                            return;
                        }
                        selectedIds.splice(selectedIndex, 1);
                    } else if (selectedIds.length < 4) {
                        selectedIds.push(moveId);
                    } else {
                        headingStatus.textContent = "Four moves are already equipped. Remove one first.";
                        return;
                    }
                    renderLibrary();
                });
                choice.classList.toggle("is-selected", selected);
                choice.setAttribute("aria-pressed", String(selected));
                choice.style.setProperty("--type-color", TYPE_COLORS[move.type] || TYPE_COLORS.normal);
                const name = document.createElement("strong");
                name.textContent = `${selected ? "✓ " : ""}${move.displayName}`;
                const details = document.createElement("small");
                const libraryMeta = moveMetaParts(move);
                details.textContent = libraryMeta.text;
                details.dataset.damageClass = libraryMeta.damageClass;
                const description = document.createElement("small");
                description.textContent = move.description || "No additional effect description.";
                choice.append(name, details, description);
                library.append(choice);
            });
        };
        renderLibrary();
        ui.roomDialogContent.append(heading, library, footer);
    }

    function showPcDialog() {
        openRoomDialog("RUN STORAGE", `PC · ${runState.pc.length} Pokemon`, "pc");
        const picker = document.createElement("div");
        picker.className = "pc-theme-picker";
        const label = document.createElement("span");
        label.textContent = "BOX BACKGROUND";
        picker.append(label);
        PC_BACKGROUNDS.forEach((background, index) => {
            const button = makeButton("", "pc-theme-button", () => {
                selectedPcTheme = index;
                ui.roomDialog.style.setProperty("--pc-background", `url("${spritersAssetUrl(background)}")`);
                picker.querySelectorAll(".pc-theme-button").forEach((entry, entryIndex) => {
                    entry.classList.toggle("is-selected", entryIndex === selectedPcTheme);
                    entry.setAttribute("aria-pressed", String(entryIndex === selectedPcTheme));
                });
            });
            button.type = "button";
            button.title = `PC box background ${index + 1}`;
            button.setAttribute("aria-label", button.title);
            button.setAttribute("aria-pressed", String(index === selectedPcTheme));
            button.classList.toggle("is-selected", index === selectedPcTheme);
            button.style.backgroundImage = `url("${spritersAssetUrl(background)}")`;
            picker.append(button);
        });
        ui.roomDialog.style.setProperty("--pc-background", `url("${spritersAssetUrl(PC_BACKGROUNDS[selectedPcTheme])}")`);
        ui.roomDialogContent.append(picker);
        if (!runState.pc.length) {
            const empty = document.createElement("p");
            empty.className = "empty-pc";
            empty.textContent = "Captured Pokemon sent to the PC will appear here for this run.";
            ui.roomDialogContent.append(empty);
            return;
        }
        const grid = document.createElement("div");
        grid.className = "replace-grid";
        runState.pc.forEach((pokemon, pcIndex) => {
            const card = makeButton("", "replace-choice pc-entry", () => movePcPokemon(pcIndex));
            card.className = "replace-choice pc-entry";
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.src = spriteUrl(pokemon.sprites.front);
            const copy = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = pokemon.name;
            const details = document.createElement("small");
            details.textContent = `Lv.${pokemon.level} · ${pokemon.types.join(" / ")} · ${pokemon.hp}/${pokemon.maxHp} HP · MOVE TO TEAM`;
            copy.append(name, details);
            card.append(sprite, copy);
            grid.append(card);
        });
        ui.roomDialogContent.append(grid);
    }

    function movePcPokemon(pcIndex) {
        const pokemon = runState.pc[pcIndex];
        if (!pokemon) return;
        if (runState.party.length < leagueConfig.league.battle_format.maximum_party_size) {
            try {
                leagueRun.movePokemonFromPc(pcIndex);
                ui.roomDialog.close();
                setRoomFeedback(`${pokemon.name} moved from the PC to the team.`, "success");
                renderBetweenRounds();
            } catch (error) {
                setRoomFeedback(error.message, "danger");
            }
            return;
        }

        openRoomDialog("TEAM SWAP", `Bring ${pokemon.name} into the team`);
        const prompt = document.createElement("p");
        prompt.className = "dex-mastery-note";
        prompt.textContent = "The team is full. Choose the Pokemon that should move to the PC.";
        const grid = document.createElement("div");
        grid.className = "replace-grid";
        runState.party.forEach((partyPokemon, partyIndex) => {
            const choice = makeButton("", "replace-choice", () => {
                try {
                    const result = leagueRun.movePokemonFromPc(pcIndex, partyIndex);
                    ui.roomDialog.close();
                    setRoomFeedback(`${result.added.name} joined the team. ${result.swapped.name} moved to the PC.`, "success");
                    renderBetweenRounds();
                } catch (error) {
                    setRoomFeedback(error.message, "danger");
                }
            });
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.src = spriteUrl(partyPokemon.sprites.front);
            const copy = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = partyPokemon.name;
            const details = document.createElement("small");
            details.textContent = `Lv.${partyPokemon.level} · ${partyPokemon.hp}/${partyPokemon.maxHp} HP · SEND TO PC`;
            copy.append(name, details);
            choice.append(sprite, copy);
            grid.append(choice);
        });
        ui.roomDialogContent.append(prompt, grid);
    }

    function showCaptureDestination(pokemon) {
        openRoomDialog("CAUGHT", `${pokemon.name} was caught!`);
        const summary = document.createElement("div");
        summary.className = "capture-success";
        const sprite = document.createElement("img");
        sprite.alt = "";
        sprite.src = spriteUrl(pokemon.sprites.front);
        const text = document.createElement("p");
        text.textContent = `${pokemon.name} is fully healed. Choose where it should go for this run.`;
        summary.append(sprite, text);
        const actions = document.createElement("div");
        actions.className = "capture-destination-actions";
        const party = makeButton("ADD TO TEAM", "dialog-button", () => storeCapture("party"));
        party.disabled = runState.party.length >= leagueConfig.league.battle_format.maximum_party_size;
        const pc = makeButton("SEND TO PC", "dialog-button", () => storeCapture("pc"));
        actions.append(party, pc);
        ui.roomDialogContent.append(summary, actions);
    }

    function storeCapture(destination) {
        try {
            const pokemon = leagueRun.storeCapturedPokemon(destination);
            ui.roomDialog.close();
            setRoomFeedback(`${pokemon.name} was added to the ${destination === "party" ? "team" : "PC"}.`, "success");
            renderBetweenRounds();
        } catch (error) {
            setRoomFeedback(error.message, "danger");
        }
    }

    function showWildEncounterDialog(encounter, lastMessage) {
        openRoomDialog("WILD ENCOUNTER", `A wild ${encounter.pokemon.name} appeared!`);
        const card = document.createElement("div");
        card.className = "wild-encounter-card";
        const sprite = document.createElement("img");
        sprite.alt = encounter.pokemon.name;
        sprite.src = spriteUrl(encounter.pokemon.sprites.front);
        const details = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = `${encounter.pokemon.name} · Lv.${encounter.pokemon.level}`;
        const message = document.createElement("p");
        message.textContent = lastMessage || "Choose a Poke Ball. A failed throw consumes the Ball, but you can try again.";
        details.append(name, message);
        card.append(sprite, details);

        const balls = document.createElement("div");
        balls.className = "capture-ball-list";
        Object.values(runState.inventory).filter((item) => item.category === "capture" && item.quantity > 0).forEach((item) => {
            const chance = leagueRun.catchChance(encounter.pokemon, item.catchModifier);
            const button = makeButton("", "capture-ball", () => {
                try {
                    const result = leagueRun.tryCatch(item.key);
                    if (result.caught) showCaptureDestination(result.pokemon);
                    else showWildEncounterDialog(runState.wildEncounter, `${result.ball} failed. ${result.pokemon.name} broke free!`);
                } catch (error) {
                    showWildEncounterDialog(runState.wildEncounter, error.message);
                }
            });
            const icon = document.createElement("img");
            icon.alt = "";
            icon.src = itemSpriteUrl(item);
            const copy = document.createElement("span");
            const ballName = document.createElement("strong");
            ballName.textContent = item.name;
            const odds = document.createElement("small");
            odds.textContent = `×${item.quantity} · ~${Math.round(chance * 100)}%`;
            copy.append(ballName, odds);
            button.append(icon, copy);
            balls.append(button);
        });
        if (!balls.children.length) {
            const noBalls = document.createElement("p");
            noBalls.className = "empty-pc";
            noBalls.textContent = "There are no Poke Balls left in the Bag.";
            balls.append(noBalls);
        }
        const leave = makeButton("LEAVE ENCOUNTER", "dialog-button dialog-button-danger", () => {
            leagueRun.leaveWildEncounter();
            ui.roomDialog.close();
            setRoomFeedback("The wild Pokemon escaped. The encounter is used for this round.");
            renderBetweenRounds();
        });
        ui.roomDialogContent.append(card, balls, leave);
    }

    async function startWildEncounter() {
        try {
            const encounter = leagueRun.startWildEncounter();
            renderBetweenRounds();
            ui.screenTitle.textContent = `${regionName()} · ${encounter.area.name}`;
            const rarity = encounter.rareKind ? `${encounter.rareKind.toUpperCase()} · ` : "";
            ui.screenMode.textContent = `${rarity}1 VS 1 · WILD ${encounter.pokemon.name.toUpperCase()} · Lv.${encounter.pokemon.level}`;
            await mountBattle([encounter.pokemon], "wild");
        } catch (error) {
            setRoomFeedback(error.message, "danger");
        }
    }

    // What the room should say after a wild encounter. Whatever the encounter
    // cost the team stays spent, so that is worth stating outright.
    function noteWildOutcome(outcome, wildName) {
        const name = wildName || "The wild Pokemon";
        const headline = {
            victory: `${name} fainted.`,
            forfeit: `${name} escaped.`,
            capture: `${name} was caught!`,
        }[outcome] || `The encounter with ${name} ended.`;
        const hurt = (engine?.teams.player || []).some((pokemon) => pokemon.fainted || pokemon.hp < pokemon.maxHp);
        lastWildSummary = hurt ? `${headline} Your team did not recover from it.` : headline;
    }

    function enterBetweenRounds(options) {
        const config = options || {};
        hideFrontEndScreens();
        // A continued run enters the room with no battle engine mounted yet.
        if (engine) {
            runState.party = engine.teams.player;
            runState.inventory = engine.inventory;
        }
        if (config.preview && runState.wins === 0) {
            runState.wins = 1;
            runState.money = 1800;
            runState.legacy = 2;
            leagueRun.generateShopOffers();
        }
        ui.result.hidden = true;
        ui.shell.hidden = true;
        ui.trainerIntro.hidden = true;
        ui.room.hidden = false;
        ui.screenTitle.textContent = "Between Rounds";
        ui.screenMode.textContent = `${runState.mode === "hard" ? "HARD MODE" : "NORMAL MODE"} · SHOP · TEAM · WILD`;
        renderBetweenRounds();
        const story = leagueRun.storyStatus();
        const storyGuidance = story.nextReady
            ? `${milestoneTrainerName(story.next)} is ready for a story battle at ${story.next.chapter}.`
            : story.next
                ? `Next milestone: ${story.next.title} at average Lv.${story.requiredLevel}. Random Trainers fill the road between bosses.`
                : "The regional story is complete.";
        // A wild encounter is not a duel: completeDuel never runs, so nothing
        // is healed and nothing is paid. Report what actually happened rather
        // than the duel's recovery line.
        const wildSummary = lastWildSummary;
        lastWildSummary = null;
        setRoomFeedback(wildSummary
            ? `${wildSummary} ${storyGuidance}`
            : runState.mode === "hard"
                ? `Hard Mode: HP and KOs persist. ${storyGuidance}`
                : `Your team fully recovered. ${storyGuidance}`);
        ui.wildEncounter.focus();
    }

    async function startNextRound() {
        try {
            const duel = leagueRun.beginNextDuel();
            rewardGranted = false;
            lastWildSummary = null;
            ui.screenTitle.textContent = `${leagueConfig.league.name} · Duel ${runState.round}`;
            ui.screenMode.textContent = `${runState.mode === "hard" ? "HARD" : "NORMAL"} · 2 VS 2 · TEAM OF ${runState.party.length}`;
            await launchTrainerDuel(duel);
        } catch (error) {
            setRoomFeedback(error.message, "danger");
        }
    }

    function resetResultPanel(outcome) {
        // These named Kanto outright, so a Johto duel still finished under a
        // KANTO LEAGUE banner however far the player had travelled.
        const region = regionName().toUpperCase();
        const presentation = {
            victory: { kicker: `${region} LEAGUE · DUEL ${runState.round} CLEAR`, symbol: "★" },
            defeat: { kicker: `${region} LEAGUE · RUN ENDED`, symbol: "×" },
            forfeit: { kicker: `${region} LEAGUE · BATTLE CLOSED`, symbol: "↩" },
            wild: { kicker: `${region} WILD ENCOUNTER`, symbol: "!" },
        }[outcome] || { kicker: "BATTLE RESULT", symbol: "•" };
        ui.result.dataset.outcome = outcome;
        ui.restart.disabled = false;
        ui.resultKicker.textContent = presentation.kicker;
        ui.resultSymbol.textContent = presentation.symbol;
        ui.resultRewards.replaceChildren();
        ui.resultRewards.hidden = true;
        ui.resultRecovery.textContent = "";
        ui.resultRecovery.hidden = true;
        ui.resultUnlocks.replaceChildren();
        ui.resultUnlocks.hidden = true;
        // Nothing cleared these before, so the previous duel's team report and
        // its "X was revived" note carried onto the next result screen.
        ui.slotReport.replaceChildren();
        ui.slotRevival.replaceChildren();
        ui.resultBody.scrollTop = 0;
    }

    function createResultReward(label, value, kind, item) {
        const card = document.createElement("article");
        card.className = `result-reward-card is-${kind}`;
        const icon = document.createElement("span");
        icon.className = "result-reward-icon";
        if (item?.sprite) {
            const image = document.createElement("img");
            image.alt = `${item.name} icon`;
            image.src = itemSpriteUrl(item);
            icon.append(image);
        } else {
            icon.textContent = kind === "money" ? "₽" : (kind === "legacy" ? "◆" : "XP");
        }
        const copy = document.createElement("span");
        const caption = document.createElement("small");
        caption.textContent = label;
        const amount = document.createElement("strong");
        amount.textContent = value;
        copy.append(caption, amount);
        card.append(icon, copy);
        return card;
    }

    function renderVictoryRewards(reward) {
        if (!reward) return;
        ui.resultRewards.replaceChildren(
            createResultReward("PRIZE MONEY", `₽${reward.money.toLocaleString("en-US")}`, "money"),
            createResultReward("LEGACY", `+${reward.legacy}`, "legacy"),
            createResultReward("EXP SHARE", `+${reward.experience.amount}`, "experience"),
        );
        reward.drops.forEach((drop) => {
            ui.resultRewards.append(createResultReward("ITEM DROP", `${drop.name} ×${drop.quantity}`, "item", drop));
        });
        ui.resultRewards.hidden = false;

        const healedPercent = Math.round(Number(reward.recovery.healedHpRatio || 0) * 100);
        ui.resultRecovery.textContent = reward.recovery.healedHp
            ? "TEAM READY · HP, status, KOs and PP fully restored"
            : healedPercent
                ? `HARD MODE · ${healedPercent}% HP recovered · status and PP restored`
                : "HARD MODE · HP and KOs preserved · status and PP restored";
        ui.resultRecovery.hidden = false;
        renderTeamReport(reward.experience);
        renderRevivalChoice();

        const unlockLabels = {
            "hard-mode-unlocked": "HARD MODE UNLOCKED",
            "legendary-wild-unlocked": "LEGENDARY WILD ENCOUNTERS UNLOCKED",
            "mew-unlocked": "MEW WILD ENCOUNTER UNLOCKED",
            "league-completed": `${regionName().toUpperCase()} LEAGUE COMPLETE`,
        };
        reward.progressionChanges
            .map((change) => {
                if (change.type === "story-milestone-cleared") return `STORY CLEAR · ${change.title}`;
                if (change.type === "next-league-unlocked") return `${change.leagueName || "NEXT LEAGUE"} UNLOCKED`;
                return unlockLabels[change.type];
            })
            .filter(Boolean)
            .forEach((label) => {
                const badge = document.createElement("strong");
                badge.textContent = label;
                ui.resultUnlocks.append(badge);
            });
        const levelUps = reward.experience.changes.filter((change) => change.toLevel > change.fromLevel);
        if (levelUps.length) {
            window.PokemonBattleAudio?.play("levelup");
            const badge = document.createElement("strong");
            badge.textContent = `LEVEL UP · ${levelUps.map((change) => `${change.name} Lv.${change.toLevel}`).join(" · ")}`;
            ui.resultUnlocks.append(badge);
        }
        ui.resultUnlocks.hidden = ui.resultUnlocks.childElementCount === 0;
    }

    function showResult(result) {
        if (battleMode === "wild" && (result === "victory" || result === "forfeit")) {
            resetResultPanel("wild");
            const wildName = leagueRun.state.wildEncounter?.pokemon.name || "The wild Pokemon";
            leagueRun.leaveWildEncounter();
            leagueRun.settleAfterWildEncounter();
            noteWildOutcome(result, wildName);
            ui.resultTitle.textContent = result === "victory" ? "WILD POKEMON FAINTED" : "ENCOUNTER LEFT";
            ui.resultText.textContent = result === "victory"
                ? `${wildName} can no longer be caught this round.`
                : `${wildName} escaped. The encounter fee is not refunded.`;
            ui.restart.textContent = "RETURN TO SHOP";
            ui.result.hidden = false;
            return;
        }
        resetResultPanel(result);
        let copy = {
            victory: ["VICTORY", `${trainerLabel(activeTrainer)} has no Pokemon left.`],
            defeat: ["DEFEAT", "Your team can no longer continue."],
            forfeit: ["BATTLE FORFEITED", "The run ended by your decision."],
        }[result];
        if (result === "victory") {
            let reward = runState.lastReward;
            if (!rewardGranted) {
                runState.party = engine.teams.player;
                runState.inventory = engine.inventory;
                reward = leagueRun.completeDuel();
                rewardGranted = true;
                bankLegacy(reward.legacy);
            }
            renderVictoryRewards(reward);
            if (runState.leagueComplete) {
                // Every league gets its own finish, not Kanto's: the copy here
                // named Kanto and promised the Johto unlock however far you had
                // actually travelled.
                const nextLeague = leagueConfig.story_route?.next_league?.name;
                copy = [
                    `${regionName().toUpperCase()} CHAMPION`,
                    `${trainerLabel(activeTrainer)} has been defeated. Hard Mode`
                        + `${nextLeague ? ` and the ${nextLeague}` : ""} ${nextLeague ? "are" : "is"} now unlocked.`,
                ];
                ui.resultKicker.textContent = `${leagueConfig.league.name.toUpperCase()} · ADVENTURE COMPLETE`;
                ui.restart.textContent = "RETURN TO LEAGUES";
                clearSavedRun(leagueConfig.league.id);
            } else {
                ui.restart.textContent = "CONTINUE TO SHOP";
                syncRevivalGate();
            }
        } else {
            ui.restart.textContent = "RETURN TO LEAGUE";
        }
        ui.resultTitle.textContent = copy[0];
        ui.resultText.textContent = copy[1];
        ui.result.hidden = false;
    }

    function requestForfeit() {
        if (locked || engine.result) return;
        ui.confirmation.showModal();
    }

    async function confirmForfeit() {
        ui.confirmation.close();
        locked = true;
        const events = engine.forfeit();
        await scene.playEvents(events, (message) => setMessage(message, "result"), waitForBattleAdvance);
        renderStatus();
    }

    async function boot() {
        try {
            ui.loadingText.textContent = "Loading league rules and Radical Red data...";
            const [dataResponse, leagueResponse, trainerResponse, genderResponse, spriteResponse] = await Promise.all([
                fetch(app.dataset.dataUrl),
                fetch(app.dataset.leagueUrl),
                fetch(app.dataset.trainersUrl),
                fetch(app.dataset.genderUrl),
                fetch(app.dataset.spritesUrl),
            ]);
            if (!dataResponse.ok) throw new Error(`Pokemon data returned ${dataResponse.status}.`);
            if (!leagueResponse.ok) throw new Error(`League rules returned ${leagueResponse.status}.`);
            if (!trainerResponse.ok) throw new Error(`Trainer data returned ${trainerResponse.status}.`);
            if (!genderResponse.ok) throw new Error(`Gender data returned ${genderResponse.status}.`);
            if (!spriteResponse.ok) throw new Error(`Sprite manifest returned ${spriteResponse.status}.`);
            let genderData;
            let spriteData;
            [dataset, leagueConfig, trainerCatalog, genderData, spriteData] = await Promise.all([
                dataResponse.json(),
                leagueResponse.json(),
                trainerResponse.json(),
                genderResponse.json(),
                spriteResponse.json(),
            ]);
            // The Radical Red extraction has no gender data, so fold the
            // PokeAPI ratios onto each species before anything reads them.
            const genderRates = genderData?.gender_rate || {};
            // Showdown's animated GIFs replace the static Radical Red battle
            // sprites for every species the manifest covers.
            spriteManifest = spriteData || null;
            const spriteOverrides = spriteData?.sprites || {};
            dataset.pokemon.forEach((species) => {
                const rate = genderRates[String(species.dex_number)];
                species.gender_rate = Number.isFinite(rate) ? rate : -1;
                const override = spriteOverrides[String(species.id)];
                // The run needs to know which species can actually be drawn:
                // a few late-generation evolution targets have no art in
                // either set, and evolving into one would put an invisible
                // Pokemon in the party.
                species.has_battle_sprite = Boolean(override?.front);
                if (override) {
                    species.sprites = {
                        ...species.sprites,
                        front_idle: override.front,
                        back_idle: override.back,
                        animated_gif: true,
                    };
                }
            });
            try {
                const shinyResponse = await fetch(`${app.dataset.staticPrefix}games/assets/pokemon/showdown/shiny-manifest.json?v=1`);
                shinyAvailable = new Set((await shinyResponse.json()).slugs || []);
            } catch (error) {
                shinyAvailable = new Set();
            }
            applyShinyUnlocks();
            saveWallet();
            buildLeagueRun();
            const params = new URLSearchParams(window.location.search);
            selectedRunMode = params.get("mode") === "hard" && leagueRun.progress.hardModeUnlocked ? "hard" : "normal";
            renderProgressUi();
            if (params.get("screen") === "room") {
                const previewStarters = leagueRun.getStarterPool().slice(0, leagueConfig.starter_rules.count);
                leagueRun.start(previewStarters.map((pokemon) => pokemon.id), selectedRunMode);
                engine = createEngine(runState.party, runState.inventory, leagueRun.buildEnemyTeam());
                ui.loading.hidden = true;
                enterBetweenRounds({ preview: true });
            } else if (params.get("screen") === "league") {
                showLeagueSelection();
            } else if (params.get("screen") === "setup") {
                showLeagueSetup();
            } else if (params.get("screen") === "starters") {
                showStarterSelection();
            } else {
                showMainMenu();
            }
        } catch (error) {
            console.error(error);
            ui.shell.hidden = true;
            ui.trainerIntro.hidden = true;
            ui.loading.hidden = false;
            ui.loading.classList.add("has-error");
            ui.loadingText.textContent = `Battle failed to load: ${error.message}`;
        }
    }

    ui.attack.addEventListener("click", showMoves);
    ui.mega?.addEventListener("click", triggerMega);
    ui.pokemon.addEventListener("click", showPokemonTeam);
    ui.item.addEventListener("click", showItems);
    ui.forfeit.addEventListener("click", requestForfeit);
    ui.submenuBack.addEventListener("click", closeSubmenu);
    ui.cancelForfeit.addEventListener("click", () => ui.confirmation.close());
    ui.confirmForfeit.addEventListener("click", confirmForfeit);
    ui.restart.addEventListener("click", () => {
        if (battleMode === "wild" && (engine.result === "victory" || engine.result === "forfeit")) enterBetweenRounds();
        else if (engine.result === "victory" && runState.leagueComplete) showLeagueSelection();
        else if (engine.result === "victory") enterBetweenRounds();
        // A defeat or forfeit ends the run, but the league stays loaded.
        else endRunToLeagueMenu();
    });
    ui.openBag.addEventListener("click", () => showBagDialog());
    ui.shopRefresh.addEventListener("click", () => {
        try {
            const { fee, nextFee } = leagueRun.refreshShopOffers();
            setRoomFeedback(
                `The counter was restocked for ₽${fee.toLocaleString("en-US")}. `
                + `The next restock costs ₽${nextFee.toLocaleString("en-US")}.`,
                "success",
            );
            renderBetweenRounds();
        } catch (error) {
            setRoomFeedback(error.message, "danger");
        }
    });
    ui.openPc.addEventListener("click", showPcDialog);
    ui.openOrder.addEventListener("click", () => setReorderMode(!reorderMode));
    ui.openLeagueDex.addEventListener("click", showLeagueDex);
    ui.roomOpenDex.addEventListener("click", showLeagueDex);
    ui.normalMode.addEventListener("click", () => selectRunMode("normal"));
    ui.hardMode.addEventListener("click", () => selectRunMode("hard"));
    ui.menuPlay.addEventListener("click", showLeagueSelection);
    ui.menuSettings.addEventListener("click", openSettings);
    ui.leagueSelectionBack.addEventListener("click", showMainMenu);
    ui.backToLeagues.addEventListener("click", showLeagueSelection);
    ui.continueToStarters.addEventListener("click", showStarterSelection);
    ui.continueRun?.addEventListener("click", continueSavedRun);
    ui.menuLegacy?.addEventListener("click", openLegacyShop);
    ui.legacyClose?.addEventListener("click", () => ui.legacyShop.close());
    ui.lsMoney?.addEventListener("click", () => buyLegacyItem("money"));
    ui.lsStarter?.addEventListener("click", () => buyLegacyItem("starter"));
    ui.lsMagnet?.addEventListener("click", () => buyLegacyItem("magnet"));
    ui.lsLoot?.addEventListener("click", () => buyLegacyItem("loot"));
    ui.backToMode.addEventListener("click", showLeagueSetup);
    // Closing without saving must not keep the previewed loudness. Called
    // from every path out of the dialog rather than the dialog's close
    // event, which not every embedder dispatches.
    const revertMusicPreview = () => backgroundMusicPlayer.previewVolume(gameSettings.musicVolume);
    ui.closeSettings.addEventListener("click", () => { ui.settingsDialog.close(); revertMusicPreview(); });
    ui.cancelSettings.addEventListener("click", () => { ui.settingsDialog.close(); revertMusicPreview(); });
    ui.settingsDialog.addEventListener("close", revertMusicPreview);
    ui.settingsDialog.addEventListener("cancel", revertMusicPreview);
    ui.musicVolume?.addEventListener("input", () => {
        ui.musicVolumeValue.textContent = `${ui.musicVolume.value}%`;
        backgroundMusicPlayer.previewVolume(Number(ui.musicVolume.value) / 100);
    });
    ui.settingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        gameSettings = {
            idleFrameRate: Number(ui.idleAnimationSpeed.value),
            reducedBattleMotion: ui.reducedBattleMotion.checked,
            soundEnabled: ui.soundEnabled.checked,
            musicVolume: ui.musicVolume ? Number(ui.musicVolume.value) / 100 : gameSettings.musicVolume,
            musicPlaylist: ui.musicPlaylist ? ui.musicPlaylist.value : gameSettings.musicPlaylist,
        };
        saveGameSettings();
        ui.settingsDialog.close();
        ui.menuSettings.focus();
    });
    ui.wildEncounter.addEventListener("click", startWildEncounter);
    ui.nextDuel.addEventListener("click", startNextRound);
    ui.closeRoomDialog.addEventListener("click", () => ui.roomDialog.close());
    ui.rerollStarters.addEventListener("click", showStarterSelection);
    ui.startKantoRun.addEventListener("click", () => startSelectedRun().catch((error) => {
        console.error(error);
        ui.loading.hidden = false;
        ui.loadingText.textContent = `The run could not start: ${error.message}`;
    }));

    backgroundMusicPlayer.start();
    window.setTimeout(boot, 0);
}());
