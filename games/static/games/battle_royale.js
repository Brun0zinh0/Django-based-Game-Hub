(() => {
    "use strict";

    const canvas = document.getElementById("battle-canvas");
    if (!canvas) {
        return;
    }

    const context = window.GameGpuRuntime
        ? window.GameGpuRuntime.create2DContext(canvas)
        : canvas.getContext("2d", {
            alpha: false,
            desynchronized: true,
        });
    if (!context) {
        return;
    }
    const gameAssets = {
        wizards: {
            image: new Image(),
            renderSource: null,
            ready: false,
        },
        bonusWizards: {
            image: new Image(),
            renderSource: null,
            ready: false,
        },
        biomes: {
            image: new Image(),
            ready: false,
        },
        materials: {
            image: new Image(),
            ready: false,
        },
        terrain: {
            image: new Image(),
            ready: false,
        },
        props: {
            image: new Image(),
            ready: false,
        },
        zombies: {
            image: new Image(),
            ready: false,
        },
    };
    const wizardPaletteSources = new Map();
    const bonusWizardPaletteSources = new Map();
    const biomeTexturePatterns = new Map();
    const obstacleTexturePatterns = new Map();
    const overlay = document.getElementById("battle-overlay");
    const overlayEyebrow = document.getElementById("overlay-eyebrow");
    const overlayTitle = document.getElementById("overlay-title");
    const overlayMessage = document.getElementById("overlay-message");
    const startButton = document.getElementById("start-battle");
    const roundElement = document.getElementById("round-value");
    const pointsElement = document.getElementById("points-value");
    const pointsGainElement = document.getElementById("points-gain");
    const playersLeftElement = document.getElementById("players-left");
    const healthElement = document.getElementById("health-value");
    const healthFill = document.getElementById("health-fill");
    const topHealthValue = document.getElementById("top-health-value");
    const topHealthFill = document.getElementById("top-health-fill");
    const topUltimateValue = document.getElementById("top-ultimate-value");
    const topUltimateFill = document.getElementById("top-ultimate-fill");
    const topDashValue = document.getElementById("top-dash-value");
    const topDashFill = document.getElementById("top-dash-fill");
    const killCountElement = document.getElementById("kill-count");
    const zoneTimerElement = document.getElementById("zone-timer");
    const buildStatusElement = document.getElementById("build-status");
    const shieldStatusElement = document.getElementById("shield-status");
    const compactDpsElement = document.getElementById("compact-dps");
    const compactHealthElement = document.getElementById("compact-health");
    const compactShieldElement = document.getElementById("compact-shield");
    const dashStatusElement = document.getElementById("dash-status");
    const abilityStatusElement = document.getElementById("ability-status");
    const legacyStatusElement = document.getElementById("legacy-status");
    const terrainStatusElement = document.getElementById("terrain-status");
    const enemyStatusElement = document.getElementById("enemy-status");
    const battlePage = document.querySelector(".battle-page");
    const fullscreenToggle = document.getElementById("fullscreen-toggle");
    const fullscreenLabel = fullscreenToggle.querySelector(
        "[data-fullscreen-label]",
    );
    const statusElement = document.getElementById("battle-status");
    const roundRewards = document.getElementById("round-rewards");
    const rewardKills = document.getElementById("reward-kills");
    const rewardPoints = document.getElementById("reward-points");
    const upgradeShop = document.getElementById("upgrade-shop");
    const shopPoints = document.getElementById("shop-points");
    const shopHelp = document.getElementById("shop-help");
    const talentPointsElement = document.getElementById("talent-points");
    const rewardTalent = document.getElementById("reward-talent");
    const rewardLegacy = document.getElementById("reward-legacy");
    const defeatStats = document.getElementById("defeat-stats");
    const defeatRound = document.getElementById("defeat-round");
    const defeatKills = document.getElementById("defeat-kills");
    const defeatTime = document.getElementById("defeat-time");
    const defeatDamageDealt = document.getElementById(
        "defeat-damage-dealt",
    );
    const defeatDamageTaken = document.getElementById(
        "defeat-damage-taken",
    );
    const defeatLegacy = document.getElementById("defeat-legacy");
    const buildSummaryList = document.getElementById("build-summary-list");
    const buildSummaryCount = document.getElementById("build-summary-count");
    const selectedSkinName = document.getElementById("selected-skin-name");
    const legacyCreditsElement = document.getElementById("legacy-credits");
    const menuCharacterCanvas = document.getElementById(
        "menu-character-preview",
    );
    const menuCharacterContext = window.GameGpuRuntime
        ? window.GameGpuRuntime.create2DContext(
            menuCharacterCanvas,
            { alpha: true, desynchronized: true },
        )
        : menuCharacterCanvas.getContext("2d", {
            alpha: true,
            desynchronized: true,
        });
    const characterPreviewCard = document.querySelector(
        ".character-preview-card",
    );
    const characterPreviewDescription = document.getElementById(
        "character-preview-description",
    );
    const previewElementBadge = document.getElementById(
        "preview-element-badge",
    );
    const wardrobeToggle = document.getElementById("wardrobe-toggle");
    const wardrobePanel = document.getElementById("wardrobe-panel");
    const settingsToggle = document.getElementById("settings-toggle");
    const settingsDialog = document.getElementById("game-settings-dialog");
    const settingsClose = document.getElementById("settings-close");
    const settingsLegacyCredits = document.getElementById(
        "settings-legacy-credits",
    );
    const settingsSkinsCount = document.getElementById(
        "settings-skins-count",
    );
    const settingsElementsCount = document.getElementById(
        "settings-elements-count",
    );
    const backgroundMusic = document.getElementById(
        "battle-background-music",
    );
    const nowPlayingTitle = document.getElementById("now-playing-title");
    const musicVolumeControl = document.getElementById("music-volume");
    const musicVolumeValue = document.getElementById("music-volume-value");
    const musicPlaylistControl = document.getElementById("music-playlist");
    const musicTracksData = document.getElementById("battle-music-tracks");
    const musicTracks = (() => {
        try {
            const parsed = JSON.parse(musicTracksData?.textContent || "[]");
            return Array.isArray(parsed)
                ? parsed.filter(
                    (track) =>
                        track
                        && typeof track.title === "string"
                        && typeof track.url === "string",
                )
                : [];
        } catch (error) {
            return [];
        }
    })();
    const resetSaveButton = document.getElementById("reset-save-button");
    const resetSaveHelp = document.getElementById("reset-save-help");
    const skillTreePanel = document.getElementById("skill-tree-panel");
    const skillTreeElement = document.getElementById("skill-tree");
    const skillAvatar = document.getElementById("skill-avatar");
    const skillAvatarName = document.getElementById("skill-avatar-name");
    const skillTreeTitle = document.getElementById("skill-tree-title");
    const skillPassive = document.getElementById("skill-passive");
    const skillChoiceHelp = document.getElementById("skill-choice-help");
    const upgradeButtons = Array.from(
        document.querySelectorAll("[data-upgrade]"),
    );
    const elementalButtons = Array.from(
        document.querySelectorAll("[data-element]"),
    );
    const roguePathsElement = document.getElementById("rogue-paths");
    const skinButtons = Array.from(
        document.querySelectorAll("[data-skin]"),
    );

    const VIEW_WIDTH = canvas.width;
    const VIEW_HEIGHT = canvas.height;
    const WORLD_WIDTH = 7200;
    const WORLD_HEIGHT = 5400;
    const START_ZONE_RADIUS = 2200;
    const END_ZONE_RADIUS = 220;
    const OBSTACLE_CELL_SIZE = 256;
    const OBSTACLE_GRID_COLUMNS =
        Math.ceil(WORLD_WIDTH / OBSTACLE_CELL_SIZE) + 2;
    const HUD_UPDATE_INTERVAL = 1 / 15;
    const MAX_UPGRADE_LEVEL = 5;
    const MAX_SKILL_TIERS = 8;
    const PROFILE_STORAGE_KEY = "rogueBattleProfileV1";
    const DEFAULT_MUSIC_VOLUME = 0.35;
    const CAMERA_ZOOM_LEVELS = [1, 0.9, 0.82, 0.75, 0.69, 0.64];
    const UPGRADE_DEFINITIONS = {
        vitality: {
            label: "Vitalité",
            description: "+25 santé",
            baseCost: 40,
            costStep: 30,
        },
        power: {
            label: "Puissance",
            description: "+8 dégâts",
            baseCost: 45,
            costStep: 35,
        },
        cadence: {
            label: "Cadence",
            description: "Tirs 10 % plus rapides",
            baseCost: 50,
            costStep: 35,
        },
        dash: {
            label: "Rune de dash",
            description: "Débloque le dash, puis allonge sa portée",
            baseCost: 100,
            costStep: 90,
            maxLevel: 3,
        },
        fullAuto: {
            label: "Rune automatique",
            description: "Maintenir le clic pour tirer",
            baseCost: 300,
            costStep: 0,
            maxLevel: 1,
        },
        mobility: {
            label: "Mobilité",
            description: "+22 vitesse",
            baseCost: 35,
            costStep: 30,
        },
        armor: {
            label: "Armure",
            description: "+12 bouclier",
            baseCost: 45,
            costStep: 35,
        },
        scavenger: {
            label: "Pillard",
            description: "Butin amélioré",
            baseCost: 40,
            costStep: 30,
        },
        vision: {
            label: "Vision tactique",
            description: "Caméra dézoomée",
            baseCost: 55,
            costStep: 40,
        },
    };
    const SPECIAL_ABILITIES = {
        fire: {
            skillId: "fire-dash",
            name: "Nova de braise",
            maxCharge: 360,
            color: "#fb7185",
        },
        ice: {
            skillId: "ice-step",
            name: "Dôme cryogénique",
            maxCharge: 340,
            color: "#67e8f9",
        },
        storm: {
            skillId: "blink",
            name: "Surcharge fulgurante",
            maxCharge: 350,
            color: "#c4b5fd",
        },
        wind: {
            skillId: "hurricane",
            name: "Œil de l’ouragan",
            maxCharge: 340,
            color: "#86efac",
        },
        psychic: {
            skillId: "mind-break",
            name: "Rupture mentale",
            maxCharge: 350,
            color: "#f0abfc",
        },
        vampire: {
            skillId: "blood-moon",
            name: "Lune de sang",
            maxCharge: 370,
            color: "#f43f5e",
        },
        investor: {
            skillId: "gold-rush",
            name: "Ruée dorée",
            maxCharge: 340,
            color: "#facc15",
        },
        magnetic: {
            skillId: "magnetic-storm",
            name: "Tempête magnétique",
            maxCharge: 350,
            color: "#94a3b8",
        },
    };
    const ENVIRONMENTS = [
        {
            id: "forest",
            label: "Forêt des Brumes",
            ground: "#102c2b",
            groundAlt: "#173b35",
            grid: "rgba(118, 194, 164, 0.1)",
            wall: "#66746f",
            wallEdge: "#c7d2ce",
            hazard: "#6b4f35",
            foliage: "#1f5c46",
            accent: "#6ee7b7",
            detail: "#2f6b52",
            detailType: "leaves",
            gimmick: "Clairières de vie",
            gimmickHint: "Les clairières restaurent lentement la santé.",
            sceneryKinds: ["fern", "shrub", "moss", "pebble"],
        },
        {
            id: "badlands",
            label: "Canyon Rouge",
            ground: "#30211f",
            groundAlt: "#493027",
            grid: "rgba(251, 146, 60, 0.09)",
            wall: "#8b5e4a",
            wallEdge: "#fdba74",
            hazard: "#6d3b2a",
            foliage: "#78613b",
            accent: "#fb923c",
            detail: "#8a4f36",
            detailType: "cracks",
            gimmick: "Portails du canyon",
            gimmickHint: "Les portails reliés permettent de traverser l’arène.",
            sceneryKinds: ["dry-grass", "pebble", "bones", "debris"],
        },
        {
            id: "frost",
            label: "Toundra Fracturée",
            ground: "#183044",
            groundAlt: "#20475c",
            grid: "rgba(186, 230, 253, 0.11)",
            wall: "#718da0",
            wallEdge: "#d8f3ff",
            hazard: "#31536b",
            foliage: "#3d6d70",
            accent: "#7dd3fc",
            detail: "#4f7186",
            detailType: "ice",
            gimmick: "Blizzards gelants",
            gimmickHint: "Les zones de blizzard ralentissent fortement.",
            sceneryKinds: ["snow", "pine", "pebble", "ice-shard"],
        },
        {
            id: "ruins",
            label: "Cité Engloutie",
            ground: "#202b38",
            groundAlt: "#293a48",
            grid: "rgba(148, 163, 184, 0.11)",
            wall: "#5d6875",
            wallEdge: "#cbd5e1",
            hazard: "#40535c",
            foliage: "#31594d",
            accent: "#fbbf24",
            detail: "#4b6073",
            detailType: "tiles",
            gimmick: "Champs d’orage",
            gimmickHint: "Les anciens générateurs infligent des dégâts par pulsations.",
            sceneryKinds: ["moss", "debris", "pebble", "rune"],
        },
        {
            id: "necropolis",
            minimumRound: 10,
            label: "Nécropole Éveillée",
            ground: "#1b1f26",
            groundAlt: "#262b34",
            grid: "rgba(148, 163, 184, 0.09)",
            wall: "#4c525e",
            wallEdge: "#c3cbd8",
            hazard: "#2f3a44",
            foliage: "#3b4a44",
            accent: "#a3e635",
            detail: "#454f5c",
            detailType: "tiles",
            gimmick: "Réveil des morts",
            gimmickHint:
                "Les morts se relèvent sans fin et s’en prennent à tous.",
            sceneryKinds: ["bones", "debris", "pebble", "rune"],
        },
    ];
    const ENEMY_ELEMENTS = {
        fire: { label: "Incendiaire", icon: "F", color: "#fb7185" },
        ice: { label: "Cryomancien", icon: "G", color: "#67e8f9" },
        storm: { label: "Électromancien", icon: "E", color: "#c4b5fd" },
    };
    const ENEMY_TRAITS = {
        guardian: { label: "Gardien", icon: "B", color: "#60a5fa" },
        assassin: { label: "Assassin", icon: "D", color: "#fbbf24" },
        vampire: { label: "Vampire", icon: "V", color: "#f472b6" },
    };
    const ELEMENT_DEFINITIONS = {
        fire: {
            label: "Voie de la Braise",
            cost: 0,
            avatarName: "Kaela",
            avatar: "🔥",
            passive: "Les tirs embrasent les ennemis.",
            color: "#fb7185",
            nodes: [
                {
                    id: "searing-rounds",
                    tier: 1,
                    label: "Munitions ardentes",
                    description: "+15 % de dégâts directs.",
                },
                {
                    id: "hungry-flame",
                    tier: 1,
                    label: "Flamme vorace",
                    description: "Les brûlures infligent 50 % de dégâts en plus.",
                },
                {
                    id: "phoenix-heart",
                    tier: 2,
                    label: "Cœur du phénix",
                    description: "Une élimination rend 8 points de santé.",
                },
                {
                    id: "blast-core",
                    tier: 2,
                    label: "Cœur explosif",
                    description: "Les impacts blessent les ennemis proches.",
                },
                {
                    id: "fire-dash",
                    tier: 3,
                    label: "Nova de braise",
                    description: "Débloque E : une explosion qui brûle les ennemis proches.",
                    specialAbility: true,
                },
                {
                    id: "combustion",
                    tier: 3,
                    label: "Combustion",
                    description: "+25 % de dégâts contre une cible en feu.",
                },
                {
                    id: "inferno",
                    tier: 4,
                    label: "Inferno",
                    description: "Chaque élimination déclenche une explosion.",
                },
                {
                    id: "rebirth",
                    tier: 4,
                    label: "Renaissance",
                    description: "Évite une mort par round et revient à 35 %.",
                },
                {
                    id: "wildfire",
                    tier: 5,
                    label: "Feu sauvage",
                    description: "Les brûlures se propagent aux ennemis proches.",
                },
                {
                    id: "scorched-earth",
                    tier: 5,
                    label: "Terre brûlée",
                    description: "La ruée laisse une large vague de flammes.",
                },
                {
                    id: "executioner",
                    tier: 6,
                    label: "Exécuteur",
                    description: "+35 % de dégâts sur les cibles affaiblies.",
                },
                {
                    id: "solar-plating",
                    tier: 6,
                    label: "Plaques solaires",
                    description: "+20 santé et +20 bouclier maximum.",
                },
                {
                    id: "meteor",
                    tier: 7,
                    label: "Impact météore",
                    description: "15 % des tirs déclenchent un impact de zone.",
                },
                {
                    id: "ember-economy",
                    tier: 7,
                    label: "Moisson de braises",
                    description: "Les éliminations rapportent 25 % de points en plus.",
                },
                {
                    id: "apocalypse",
                    tier: 8,
                    label: "Apocalypse",
                    description: "Brûlures et explosions deviennent dévastatrices.",
                },
                {
                    id: "eternal-phoenix",
                    tier: 8,
                    label: "Phénix éternel",
                    description: "Renaissance possède deux charges et rend 50 %.",
                },
            ],
        },
        ice: {
            label: "Voie du Givre",
            cost: 0,
            avatarName: "Niva",
            avatar: "❄",
            passive: "Les tirs ralentissent les ennemis.",
            color: "#67e8f9",
            nodes: [
                {
                    id: "deep-freeze",
                    tier: 1,
                    label: "Froid mordant",
                    description: "Le ralentissement devient plus puissant.",
                },
                {
                    id: "crystal-armor",
                    tier: 1,
                    label: "Armure de cristal",
                    description: "+30 bouclier au début du round.",
                },
                {
                    id: "shatter",
                    tier: 2,
                    label: "Fracture",
                    description: "+25 % de dégâts contre les cibles ralenties.",
                },
                {
                    id: "frost-leech",
                    tier: 2,
                    label: "Sangsue de givre",
                    description: "Une élimination rend 12 points de bouclier.",
                },
                {
                    id: "permafrost",
                    tier: 3,
                    label: "Permafrost",
                    description: "Le ralentissement dure beaucoup plus longtemps.",
                },
                {
                    id: "ice-step",
                    tier: 3,
                    label: "Dôme cryogénique",
                    description: "Débloque E : gèle les ennemis et renforce ton bouclier.",
                    specialAbility: true,
                },
                {
                    id: "blizzard",
                    tier: 4,
                    label: "Blizzard",
                    description: "Les impacts gèlent aussi les ennemis proches.",
                },
                {
                    id: "glacial-fortress",
                    tier: 4,
                    label: "Forteresse glaciaire",
                    description: "Le bouclier se régénère après 3 s sans dégâts.",
                },
                {
                    id: "snowball",
                    tier: 5,
                    label: "Cœur de neige",
                    description: "Projectiles de givre plus larges et plus puissants.",
                },
                {
                    id: "ice-barrier",
                    tier: 5,
                    label: "Barrière boréale",
                    description: "+25 bouclier et une aura de glace.",
                },
                {
                    id: "avalanche",
                    tier: 6,
                    label: "Avalanche",
                    description: "Les impacts de givre infligent des dégâts de zone.",
                },
                {
                    id: "cryostasis",
                    tier: 6,
                    label: "Cryostase",
                    description: "Subis 25 % de dégâts en moins sous 35 % de santé.",
                },
                {
                    id: "absolute-zero",
                    tier: 7,
                    label: "Zéro absolu",
                    description: "15 % des tirs immobilisent presque leur cible.",
                },
                {
                    id: "mirror-shards",
                    tier: 7,
                    label: "Éclats miroirs",
                    description: "Renvoie 15 % des dégâts directs à l’attaquant.",
                },
                {
                    id: "whiteout",
                    tier: 8,
                    label: "Voile blanc",
                    description: "Les ennemis proches sont ralentis en permanence.",
                },
                {
                    id: "immortal-glacier",
                    tier: 8,
                    label: "Glacier immortel",
                    description: "Réduit tous les dégâts reçus de 20 %.",
                },
            ],
        },
        storm: {
            label: "Voie de la Tempête",
            cost: 0,
            avatarName: "Volt",
            avatar: "ϟ",
            passive:
                "Les tirs créent des arcs et ralentissent la cadence ennemie.",
            color: "#c084fc",
            nodes: [
                {
                    id: "charged-bolts",
                    tier: 1,
                    label: "Éclairs chargés",
                    description: "Les arcs atteignent une cible supplémentaire.",
                },
                {
                    id: "tailwind",
                    tier: 1,
                    label: "Vent arrière",
                    description: "+35 de vitesse de déplacement.",
                },
                {
                    id: "capacitor",
                    tier: 2,
                    label: "Condensateur",
                    description: "Cadence de tir améliorée de 15 %.",
                },
                {
                    id: "storm-shield",
                    tier: 2,
                    label: "Égide statique",
                    description: "+25 bouclier au début du round.",
                },
                {
                    id: "arc-mastery",
                    tier: 3,
                    label: "Maîtrise des arcs",
                    description: "Les chaînes vont plus loin et frappent plus fort.",
                },
                {
                    id: "blink",
                    tier: 3,
                    label: "Surcharge fulgurante",
                    description: "Débloque E : une chaîne d’éclairs et une cadence extrême.",
                    specialAbility: true,
                },
                {
                    id: "tempest",
                    tier: 4,
                    label: "Tempête vivante",
                    description: "Les arcs atteignent deux cibles supplémentaires.",
                },
                {
                    id: "overload",
                    tier: 4,
                    label: "Surcharge",
                    description: "20 % de chances d’infliger un impact surchargé.",
                },
                {
                    id: "ionization",
                    tier: 5,
                    label: "Ionisation",
                    description: "10 % de chances de surcharger chaque impact.",
                },
                {
                    id: "slipstream",
                    tier: 5,
                    label: "Couloir de vent",
                    description: "+45 de vitesse de déplacement.",
                },
                {
                    id: "thunderclap",
                    tier: 6,
                    label: "Coup de tonnerre",
                    description: "Les impacts électrisent une petite zone.",
                },
                {
                    id: "static-reserve",
                    tier: 6,
                    label: "Réserve statique",
                    description: "Une élimination rend 15 points de bouclier.",
                },
                {
                    id: "ball-lightning",
                    tier: 7,
                    label: "Foudre globulaire",
                    description: "Les arcs gagnent une cible et une forte portée.",
                },
                {
                    id: "tempest-step",
                    tier: 7,
                    label: "Pas de tempête",
                    description: "Le dash déclenche deux secondes de surcharge.",
                },
                {
                    id: "storm-god",
                    tier: 8,
                    label: "Avatar de l’orage",
                    description: "Trois arcs supplémentaires frappent plus fort.",
                },
                {
                    id: "time-warp",
                    tier: 8,
                    label: "Distorsion temporelle",
                    description: "Cadence et recharge du dash accélérées de 25 %.",
                },
            ],
        },
        wind: {
            label: "Voie du Vent",
            avatarName: "Aeris",
            avatar: "🜁",
            passive: "Les tirs repoussent les ennemis.",
            color: "#86efac",
            cost: 80,
            nodes: [
                {
                    id: "forceful-gust",
                    tier: 1,
                    label: "Rafale puissante",
                    description: "Le recul des tirs augmente de 45 %.",
                },
                {
                    id: "windrunner",
                    tier: 1,
                    label: "Coureur des vents",
                    description: "+35 de vitesse de déplacement.",
                },
                {
                    id: "razor-wind",
                    tier: 2,
                    label: "Vent tranchant",
                    description: "+15 % de dégâts directs.",
                },
                {
                    id: "air-shield",
                    tier: 2,
                    label: "Égide aérienne",
                    description: "+25 bouclier au début du round.",
                },
                {
                    id: "hurricane",
                    tier: 3,
                    label: "Œil de l’ouragan",
                    description: "Débloque E : repousse violemment tous les ennemis proches.",
                    specialAbility: true,
                },
                {
                    id: "pressure-wave",
                    tier: 3,
                    label: "Onde de pression",
                    description: "Les impacts repoussent aussi les cibles voisines.",
                },
                {
                    id: "jetstream",
                    tier: 4,
                    label: "Courant-jet",
                    description: "Cadence de tir améliorée de 15 %.",
                },
                {
                    id: "second-wind",
                    tier: 4,
                    label: "Second souffle",
                    description: "Une élimination rend 10 points de santé.",
                },
                {
                    id: "vortex-rounds",
                    tier: 5,
                    label: "Munitions vortex",
                    description: "Le recul dure plus longtemps et désorganise les groupes.",
                },
                {
                    id: "aerial-armor",
                    tier: 5,
                    label: "Armure céleste",
                    description: "+20 santé et +20 bouclier maximum.",
                },
                {
                    id: "gale-dash",
                    tier: 6,
                    label: "Dash de bourrasque",
                    description: "Le dash se recharge 30 % plus vite.",
                },
                {
                    id: "air-economy",
                    tier: 6,
                    label: "Moisson des alizés",
                    description: "Les éliminations rapportent 20 % de points en plus.",
                },
                {
                    id: "tornado",
                    tier: 7,
                    label: "Tornade",
                    description: "15 % des impacts déclenchent un recul massif.",
                },
                {
                    id: "eye-calm",
                    tier: 7,
                    label: "Calme absolu",
                    description: "Réduit de 15 % les dégâts reçus.",
                },
                {
                    id: "tempest-lord",
                    tier: 8,
                    label: "Seigneur des tempêtes",
                    description: "Le recul et les dégâts du Vent deviennent extrêmes.",
                },
                {
                    id: "untouchable-sky",
                    tier: 8,
                    label: "Ciel intouchable",
                    description: "+65 vitesse et recharge de dash accélérée.",
                },
            ],
        },
        psychic: {
            label: "Voie Psychique",
            avatarName: "Myra",
            avatar: "◉",
            passive: "Les tirs réduisent la puissance d’attaque ennemie.",
            color: "#f0abfc",
            cost: 130,
            nodes: [
                {
                    id: "mind-spike",
                    tier: 1,
                    label: "Pointe mentale",
                    description: "+15 % de dégâts directs.",
                },
                {
                    id: "deep-doubt",
                    tier: 1,
                    label: "Doute profond",
                    description: "L’affaiblissement devient 40 % plus puissant.",
                },
                {
                    id: "perfect-focus",
                    tier: 2,
                    label: "Concentration parfaite",
                    description: "Cadence de tir améliorée de 15 %.",
                },
                {
                    id: "mental-ward",
                    tier: 2,
                    label: "Barrière mentale",
                    description: "+25 bouclier au début du round.",
                },
                {
                    id: "mind-break",
                    tier: 3,
                    label: "Rupture mentale",
                    description: "Débloque E : neutralise les attaques ennemies dans une large zone.",
                    specialAbility: true,
                },
                {
                    id: "psychic-backlash",
                    tier: 3,
                    label: "Retour psychique",
                    description: "Renvoie 12 % des dégâts directs reçus.",
                },
                {
                    id: "mass-hysteria",
                    tier: 4,
                    label: "Hystérie collective",
                    description: "Les impacts affaiblissent aussi les ennemis proches.",
                },
                {
                    id: "foresight",
                    tier: 4,
                    label: "Prescience",
                    description: "15 % de chances d’éviter un impact direct.",
                },
                {
                    id: "domination",
                    tier: 5,
                    label: "Domination",
                    description: "Les effets psychiques durent deux fois plus longtemps.",
                },
                {
                    id: "brain-drain",
                    tier: 5,
                    label: "Drain cérébral",
                    description: "Les éliminations chargent l’ultime de 15 %.",
                },
                {
                    id: "neural-overload",
                    tier: 6,
                    label: "Surcharge neurale",
                    description: "+25 % de dégâts contre une cible affaiblie.",
                },
                {
                    id: "lucid-armor",
                    tier: 6,
                    label: "Armure lucide",
                    description: "+25 santé et +15 bouclier maximum.",
                },
                {
                    id: "mind-chain",
                    tier: 7,
                    label: "Pensée en chaîne",
                    description: "Les tirs propagent l’affaiblissement à deux cibles.",
                },
                {
                    id: "psychic-economy",
                    tier: 7,
                    label: "Secrets arrachés",
                    description: "Les éliminations rapportent 20 % de points en plus.",
                },
                {
                    id: "collective-collapse",
                    tier: 8,
                    label: "Effondrement collectif",
                    description: "Tous les ennemis proches restent légèrement affaiblis.",
                },
                {
                    id: "ascended-mind",
                    tier: 8,
                    label: "Esprit transcendé",
                    description: "+20 % cadence et réduction générale des dégâts.",
                },
            ],
        },
        vampire: {
            label: "Voie Vampirique",
            avatarName: "Vesper",
            avatar: "♥",
            passive: "Les dégâts infligés restaurent ta santé.",
            color: "#f43f5e",
            cost: 200,
            nodes: [
                {
                    id: "bloodthirst",
                    tier: 1,
                    label: "Soif de sang",
                    description: "Le vol de vie passe de 12 % à 20 %.",
                },
                {
                    id: "sanguine-bolts",
                    tier: 1,
                    label: "Traits sanguins",
                    description: "+15 % de dégâts directs.",
                },
                {
                    id: "blood-shield",
                    tier: 2,
                    label: "Égide écarlate",
                    description: "+25 bouclier au début du round.",
                },
                {
                    id: "night-predator",
                    tier: 2,
                    label: "Prédateur nocturne",
                    description: "+35 de vitesse de déplacement.",
                },
                {
                    id: "blood-moon",
                    tier: 3,
                    label: "Lune de sang",
                    description: "Débloque E : draine tous les ennemis proches.",
                    specialAbility: true,
                },
                {
                    id: "crimson-execution",
                    tier: 3,
                    label: "Exécution carmine",
                    description: "+30 % de dégâts contre les cibles sous 35 % de santé.",
                },
                {
                    id: "bat-swarm",
                    tier: 4,
                    label: "Nuée de chauves-souris",
                    description: "Les impacts volent aussi la vie des cibles proches.",
                },
                {
                    id: "coagulation",
                    tier: 4,
                    label: "Coagulation",
                    description: "Le soin excédentaire devient du bouclier.",
                },
                {
                    id: "hemorrhage",
                    tier: 5,
                    label: "Hémorragie",
                    description: "Les tirs appliquent un saignement de courte durée.",
                },
                {
                    id: "dark-regeneration",
                    tier: 5,
                    label: "Régénération obscure",
                    description: "Régénère lentement sous 45 % de santé.",
                },
                {
                    id: "mist-dash",
                    tier: 6,
                    label: "Dash de brume",
                    description: "Le dash se recharge 30 % plus vite.",
                },
                {
                    id: "vampire-economy",
                    tier: 6,
                    label: "Tribut de sang",
                    description: "Les éliminations rapportent 20 % de points en plus.",
                },
                {
                    id: "soul-feast",
                    tier: 7,
                    label: "Festin d’âmes",
                    description: "Une élimination rend 18 santé et charge l’ultime.",
                },
                {
                    id: "blood-armor",
                    tier: 7,
                    label: "Armure de sang",
                    description: "+30 santé et +20 bouclier maximum.",
                },
                {
                    id: "ancient-vampire",
                    tier: 8,
                    label: "Vampire ancestral",
                    description: "Le vol de vie et les dégâts augmentent fortement.",
                },
                {
                    id: "undying-night",
                    tier: 8,
                    label: "Nuit immortelle",
                    description: "Évite une mort par round et revient à 40 %.",
                },
            ],
        },
        investor: {
            label: "Voie de l’Investisseur",
            cost: 260,
            avatarName: "Crésus",
            avatar: "💰",
            passive: "Tous les points gagnés rapportent 40 % de plus.",
            color: "#facc15",
            generatedFromTier: 1,
            nodes: [
                {
                    id: "gold-rush",
                    tier: 3,
                    label: "Ruée dorée",
                    description:
                        "Débloque E : les points doublent pendant 8 s.",
                    specialAbility: true,
                },
            ],
        },
        magnetic: {
            label: "Voie Magnétique",
            cost: 320,
            avatarName: "Ferro",
            avatar: "🧲",
            passive:
                "Les balles suivent l’ennemi mais infligent 25 % de dégâts " +
                "en moins.",
            color: "#94a3b8",
            generatedFromTier: 1,
            nodes: [
                {
                    id: "magnetic-storm",
                    tier: 3,
                    label: "Tempête magnétique",
                    description:
                        "Débloque E : attire les ennemis et renforce le guidage.",
                    specialAbility: true,
                },
            ],
        },
    };
    const SKINS = {
        aqua: {
            name: "Mage voyageur",
            cost: 0,
            atlasIndex: 0,
            style: "male",
            color: "#2dd4bf",
            secondary: "#0f766e",
            accent: "#99f6e4",
            outline: "#d9fffa",
            visor: "#e0f2fe",
            bullet: "#fff7ae",
        },
        ember: {
            name: "Sorcière écarlate",
            cost: 30,
            atlasIndex: 1,
            style: "female",
            color: "#fb7185",
            secondary: "#9f1239",
            accent: "#fdba74",
            outline: "#ffe4e8",
            visor: "#fef3c7",
            bullet: "#fdba74",
        },
        royal: {
            name: "Félin arcanique",
            cost: 75,
            atlasIndex: 2,
            style: "cat",
            color: "#a78bfa",
            secondary: "#5b21b6",
            accent: "#e9d5ff",
            outline: "#f5f3ff",
            visor: "#fdf4ff",
            bullet: "#ddd6fe",
        },
        solar: {
            name: "Saurien runique",
            cost: 140,
            atlasIndex: 3,
            style: "lizard",
            color: "#fbbf24",
            secondary: "#b45309",
            accent: "#fef08a",
            outline: "#fff7d6",
            visor: "#ffffff",
            bullet: "#fef08a",
        },
        phantom: {
            name: "Vampire nocturne",
            cost: 220,
            atlasIndex: 4,
            style: "vampire",
            color: "#93c5fd",
            secondary: "#1e3a8a",
            accent: "#e0f2fe",
            outline: "#f8fbff",
            visor: "#c4b5fd",
            bullet: "#bae6fd",
        },
        automaton: {
            name: "Automate arcanique",
            cost: 320,
            atlasIndex: 5,
            style: "robot",
            color: "#67e8f9",
            secondary: "#164e63",
            accent: "#cffafe",
            outline: "#ecfeff",
            visor: "#a5f3fc",
            bullet: "#67e8f9",
        },
        skeleton: {
            name: "Squelette occultiste",
            cost: 420,
            atlas: "bonus",
            atlasIndex: 0,
            style: "skeleton",
            color: "#60a5fa",
            secondary: "#1e3a8a",
            accent: "#f8fafc",
            outline: "#dbeafe",
            visor: "#e0f2fe",
            bullet: "#93c5fd",
        },
        clown: {
            name: "Clownesse astrale",
            cost: 520,
            atlas: "bonus",
            atlasIndex: 1,
            style: "clown",
            color: "#f472b6",
            secondary: "#9d174d",
            accent: "#67e8f9",
            outline: "#fce7f3",
            visor: "#fdf2f8",
            bullet: "#f9a8d4",
        },
        mermaid: {
            name: "Sirène des abysses",
            cost: 650,
            atlas: "bonus",
            atlasIndex: 2,
            style: "mermaid",
            color: "#2dd4bf",
            secondary: "#115e59",
            accent: "#a5f3fc",
            outline: "#ccfbf1",
            visor: "#ecfeff",
            bullet: "#5eead4",
        },
        bride: {
            name: "Mariée mystique",
            cost: 800,
            atlas: "bonus",
            atlasIndex: 3,
            style: "bride",
            color: "#e2e8f0",
            secondary: "#64748b",
            accent: "#fef3c7",
            outline: "#ffffff",
            visor: "#fff7ed",
            bullet: "#f8fafc",
        },
    };
    const keys = new Set();

    let actors = [];
    let bullets = [];
    let particles = [];
    const MAX_PARTICLES = 400;
    let energyArcs = [];
    let powerEffects = [];
    let scenery = [];
    let groundDetails = [];
    let obstacles = [];
    let arenaLayout = null;
    const GROUND_TILE = 16;
    const GROUND_CHUNK_TILES = 32;
    const GROUND_CHUNK_SIZE = GROUND_TILE * GROUND_CHUNK_TILES;
    const GROUND_CHUNK_LIMIT = 40;
    const GROUND_CHUNKS_PER_FRAME = 2;
    const groundChunks = new Map();
    const groundChunkOrder = [];
    let mapFeatures = [];
    let supplyCrates = [];
    let pickups = [];
    let player = null;
    let matchState = "ready";
    let elapsed = 0;
    let roundKills = 0;
    let profile = loadProfile();
    let campaign = createCampaign();
    let roundSettings = createRoundSettings(campaign.round);
    let pointsGainTimer = null;
    let selectedSkin = profile.selectedSkin;
    let previewElementOverride = null;
    let resetConfirmationTimer = null;
    let currentMusicIndex = -1;
    let musicShuffleBag = [];
    let musicErrorCount = 0;
    let activeMusicTracks = musicTracks;
    let currentEnvironment = ENVIRONMENTS[0];
    let previousEnvironmentId = null;
    let mapAnnouncementTimer = 6;
    let dashRequested = false;
    let lastFrame = performance.now();
    let lastWorldRender = 0;
    let lastPreviewRender = 0;
    let hudUpdateAccumulator = 0;
    let camera = { x: 0, y: 0, zoom: 1 };
    const renderBounds = { left: 0, right: 0, top: 0, bottom: 0 };
    const organicBlobPointX = new Float64Array(24);
    const organicBlobPointY = new Float64Array(24);
    const obstacleSpatialGrid = new Map();
    let obstacleSpatialGridReady = false;
    let obstacleQueryStamp = 0;
    let mouse = {
        screenX: VIEW_WIDTH / 2,
        screenY: VIEW_HEIGHT / 2,
        down: false,
        moved: false,
    };
    let zone = {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        radius: START_ZONE_RADIUS,
    };

    const clamp = (value, minimum, maximum) =>
        Math.max(minimum, Math.min(maximum, value));

    const randomBetween = (minimum, maximum) =>
        minimum + Math.random() * (maximum - minimum);

    const distanceBetween = (first, second) =>
        Math.hypot(first.x - second.x, first.y - second.y);

    function updateRenderBounds(margin = 0) {
        const visibleWidth = VIEW_WIDTH / camera.zoom;
        const visibleHeight = VIEW_HEIGHT / camera.zoom;
        renderBounds.left = camera.x - margin;
        renderBounds.right = camera.x + visibleWidth + margin;
        renderBounds.top = camera.y - margin;
        renderBounds.bottom = camera.y + visibleHeight + margin;
    }

    function circleIntersectsView(x, y, radius = 0) {
        return (
            x + radius >= renderBounds.left &&
            x - radius <= renderBounds.right &&
            y + radius >= renderBounds.top &&
            y - radius <= renderBounds.bottom
        );
    }

    function rectangleIntersectsView(left, top, right, bottom) {
        return (
            right >= renderBounds.left &&
            left <= renderBounds.right &&
            bottom >= renderBounds.top &&
            top <= renderBounds.bottom
        );
    }

    function obstacleCellKey(cellX, cellY) {
        return cellY * OBSTACLE_GRID_COLUMNS + cellX;
    }

    function rebuildObstacleSpatialGrid() {
        obstacleSpatialGrid.clear();

        for (const obstacle of obstacles) {
            const halfWidth = obstacle.shape === "rectangle"
                ? obstacle.width / 2
                : obstacle.radius;
            const halfHeight = obstacle.shape === "rectangle"
                ? obstacle.height / 2
                : obstacle.radius;
            const minimumCellX = Math.floor(
                (obstacle.x - halfWidth) / OBSTACLE_CELL_SIZE,
            );
            const maximumCellX = Math.floor(
                (obstacle.x + halfWidth) / OBSTACLE_CELL_SIZE,
            );
            const minimumCellY = Math.floor(
                (obstacle.y - halfHeight) / OBSTACLE_CELL_SIZE,
            );
            const maximumCellY = Math.floor(
                (obstacle.y + halfHeight) / OBSTACLE_CELL_SIZE,
            );

            for (let cellY = minimumCellY; cellY <= maximumCellY; cellY += 1) {
                for (
                    let cellX = minimumCellX;
                    cellX <= maximumCellX;
                    cellX += 1
                ) {
                    const key = obstacleCellKey(cellX, cellY);
                    let bucket = obstacleSpatialGrid.get(key);
                    if (!bucket) {
                        bucket = [];
                        obstacleSpatialGrid.set(key, bucket);
                    }
                    bucket.push(obstacle);
                }
            }
        }

        obstacleSpatialGridReady = true;
    }

    function visitNearbyObstacles(point, padding, visitor) {
        if (!obstacleSpatialGridReady) {
            for (const obstacle of obstacles) {
                const result = visitor(obstacle);
                if (result) {
                    return result;
                }
            }
            return null;
        }

        obstacleQueryStamp += 1;
        const queryStamp = obstacleQueryStamp;
        const minimumCellX = Math.floor(
            (point.x - padding) / OBSTACLE_CELL_SIZE,
        );
        const maximumCellX = Math.floor(
            (point.x + padding) / OBSTACLE_CELL_SIZE,
        );
        const minimumCellY = Math.floor(
            (point.y - padding) / OBSTACLE_CELL_SIZE,
        );
        const maximumCellY = Math.floor(
            (point.y + padding) / OBSTACLE_CELL_SIZE,
        );

        for (let cellY = minimumCellY; cellY <= maximumCellY; cellY += 1) {
            for (
                let cellX = minimumCellX;
                cellX <= maximumCellX;
                cellX += 1
            ) {
                const bucket = obstacleSpatialGrid.get(
                    obstacleCellKey(cellX, cellY),
                );
                if (!bucket) {
                    continue;
                }

                for (const obstacle of bucket) {
                    if (obstacle._queryStamp === queryStamp) {
                        continue;
                    }
                    obstacle._queryStamp = queryStamp;
                    const result = visitor(obstacle);
                    if (result) {
                        return result;
                    }
                }
            }
        }

        return null;
    }

    function prepareBiomeTexturePatterns() {
        const atlas = gameAssets.biomes.image;
        if (!atlas.naturalWidth || !atlas.naturalHeight) {
            return;
        }
        const cellWidth = Math.floor(atlas.naturalWidth / 2);
        const cellHeight = Math.floor(atlas.naturalHeight / 2);
        const environmentIds = ["forest", "badlands", "frost", "ruins"];

        environmentIds.forEach((environmentId, index) => {
            const tile = document.createElement("canvas");
            tile.width = 512;
            tile.height = 512;
            const tileContext = tile.getContext("2d");
            tileContext.imageSmoothingEnabled = true;
            tileContext.imageSmoothingQuality = "high";
            tileContext.drawImage(
                atlas,
                (index % 2) * cellWidth,
                Math.floor(index / 2) * cellHeight,
                cellWidth,
                cellHeight,
                0,
                0,
                tile.width,
                tile.height,
            );
            const pattern = context.createPattern(tile, "repeat");
            if (pattern) {
                biomeTexturePatterns.set(environmentId, pattern);
            }
        });
    }

    function prepareObstacleTexturePatterns() {
        const atlas = gameAssets.materials.image;
        if (!atlas.naturalWidth || !atlas.naturalHeight) {
            return;
        }
        const cellWidth = Math.floor(atlas.naturalWidth / 3);
        const cellHeight = Math.floor(atlas.naturalHeight / 3);
        const materialIds = [
            "bark",
            "foliage",
            "rock",
            "wall",
            "mud",
            "blizzard",
            "clearing",
            "portal",
            "generator",
        ];
        obstacleTexturePatterns.clear();

        materialIds.forEach((materialId, index) => {
            const tile = document.createElement("canvas");
            tile.width = cellWidth;
            tile.height = cellHeight;
            const tileContext = tile.getContext("2d");
            tileContext.imageSmoothingEnabled = false;
            tileContext.drawImage(
                atlas,
                (index % 3) * cellWidth,
                Math.floor(index / 3) * cellHeight,
                cellWidth,
                cellHeight,
                0,
                0,
                tile.width,
                tile.height,
            );
            const pattern = context.createPattern(tile, "repeat");
            if (pattern) {
                obstacleTexturePatterns.set(materialId, pattern);
            }
        });
        gameAssets.materials.ready = obstacleTexturePatterns.size === 9;
    }

    function prepareWizardAtlas(asset, paletteSources) {
        const source = asset.image;
        if (!source.naturalWidth || !source.naturalHeight) {
            return;
        }

        const prepared = document.createElement("canvas");
        prepared.width = source.naturalWidth;
        prepared.height = source.naturalHeight;
        const preparedContext = prepared.getContext(
            "2d",
            { willReadFrequently: true },
        );
        preparedContext.imageSmoothingEnabled = false;
        preparedContext.drawImage(source, 0, 0);

        asset.renderSource = prepared;
        paletteSources.clear();
        for (const [elementId, definition] of Object.entries(
            ELEMENT_DEFINITIONS,
        )) {
            paletteSources.set(
                elementId,
                createElementalWizardAtlas(prepared, definition.color),
            );
        }
        asset.ready = true;
    }

    function parseHexColor(hexColor) {
        const normalized = hexColor.replace("#", "");
        const colorValue = Number.parseInt(normalized, 16);
        return {
            red: (colorValue >> 16) & 255,
            green: (colorValue >> 8) & 255,
            blue: colorValue & 255,
        };
    }

    function createElementalWizardAtlas(source, elementColor) {
        const tinted = document.createElement("canvas");
        tinted.width = source.width;
        tinted.height = source.height;
        const tintedContext = tinted.getContext(
            "2d",
            { willReadFrequently: true },
        );
        tintedContext.imageSmoothingEnabled = false;
        tintedContext.drawImage(source, 0, 0);
        const pixels = tintedContext.getImageData(
            0,
            0,
            tinted.width,
            tinted.height,
        );
        const target = parseHexColor(elementColor);

        for (let offset = 0; offset < pixels.data.length; offset += 4) {
            if (pixels.data[offset + 3] === 0) {
                continue;
            }
            const red = pixels.data[offset];
            const green = pixels.data[offset + 1];
            const blue = pixels.data[offset + 2];
            const maximum = Math.max(red, green, blue);
            const minimum = Math.min(red, green, blue);
            const isBlueGarment =
                blue >= 38 &&
                blue > red * 1.12 &&
                blue >= green * 0.78 &&
                maximum - minimum >= 18;
            if (!isBlueGarment) {
                continue;
            }

            const shade = clamp(
                (maximum * 0.82 + minimum * 0.18) / 220,
                0.18,
                1.08,
            );
            const highlight = clamp((maximum - 185) / 90, 0, 0.58);
            pixels.data[offset] = Math.round(
                target.red * shade * (1 - highlight) +
                255 * highlight,
            );
            pixels.data[offset + 1] = Math.round(
                target.green * shade * (1 - highlight) +
                255 * highlight,
            );
            pixels.data[offset + 2] = Math.round(
                target.blue * shade * (1 - highlight) +
                255 * highlight,
            );
        }

        tintedContext.putImageData(pixels, 0, 0);
        return tinted;
    }

    function getWizardAtlasBundle(skinId, elementName) {
        const usesBonusAtlas =
            Boolean(skinId) && SKINS[skinId]?.atlas === "bonus";
        const asset = usesBonusAtlas
            ? gameAssets.bonusWizards
            : gameAssets.wizards;
        const palettes = usesBonusAtlas
            ? bonusWizardPaletteSources
            : wizardPaletteSources;
        return {
            source:
                palettes.get(elementName) ||
                asset.renderSource ||
                asset.image,
            ready: asset.ready,
            rowCount: usesBonusAtlas ? 4 : 8,
        };
    }

    function loadGameAssets() {
        gameAssets.wizards.image.addEventListener("load", () => {
            prepareWizardAtlas(
                gameAssets.wizards,
                wizardPaletteSources,
            );
        });
        gameAssets.bonusWizards.image.addEventListener("load", () => {
            prepareWizardAtlas(
                gameAssets.bonusWizards,
                bonusWizardPaletteSources,
            );
        });
        gameAssets.biomes.image.addEventListener("load", () => {
            gameAssets.biomes.ready = true;
            prepareBiomeTexturePatterns();
        });
        gameAssets.materials.image.addEventListener("load", () => {
            prepareObstacleTexturePatterns();
        });
        gameAssets.terrain.image.addEventListener("load", () => {
            gameAssets.terrain.ready = true;
            groundChunks.clear();
            groundChunkOrder.length = 0;
        });
        gameAssets.props.image.addEventListener("load", () => {
            gameAssets.props.ready = true;
        });
        gameAssets.zombies.image.addEventListener("load", () => {
            gameAssets.zombies.ready = true;
        });
        gameAssets.wizards.image.src = canvas.dataset.wizardAtlas;
        gameAssets.bonusWizards.image.src =
            canvas.dataset.bonusWizardAtlas;
        gameAssets.biomes.image.src = canvas.dataset.biomeAtlas;
        if (window.ENVIRONMENT_MATERIAL_ATLAS_DATA) {
            gameAssets.materials.image.src =
                `data:image/jpeg;base64,` +
                window.ENVIRONMENT_MATERIAL_ATLAS_DATA;
        }
        gameAssets.terrain.image.src = canvas.dataset.terrainAtlas;
        gameAssets.props.image.src = canvas.dataset.propAtlas;
        gameAssets.zombies.image.src = canvas.dataset.zombieAtlas;
    }

    function createDefaultProfile() {
        return {
            legacyCredits: 0,
            unlockedSkins: ["aqua"],
            unlockedElements: ["fire", "ice", "storm"],
            selectedSkin: "aqua",
            musicVolume: DEFAULT_MUSIC_VOLUME,
            musicPlaylist: "all",
        };
    }

    function loadProfile() {
        const defaultProfile = createDefaultProfile();

        try {
            const stored = JSON.parse(
                window.localStorage.getItem(PROFILE_STORAGE_KEY),
            );
            if (!stored || typeof stored !== "object") {
                return defaultProfile;
            }
            const unlockedSkins = Array.isArray(stored.unlockedSkins)
                ? stored.unlockedSkins.filter((skinId) => skinId in SKINS)
                : [];
            if (!unlockedSkins.includes("aqua")) {
                unlockedSkins.unshift("aqua");
            }
            const selected =
                unlockedSkins.includes(stored.selectedSkin)
                    ? stored.selectedSkin
                    : "aqua";
            const unlockedElements = Array.isArray(
                stored.unlockedElements,
            )
                ? stored.unlockedElements.filter(
                    (elementId) => elementId in ELEMENT_DEFINITIONS,
                )
                : [];
            for (const freeElement of ["fire", "ice", "storm"]) {
                if (!unlockedElements.includes(freeElement)) {
                    unlockedElements.push(freeElement);
                }
            }
            return {
                legacyCredits: Math.max(
                    0,
                    Math.floor(Number(stored.legacyCredits) || 0),
                ),
                unlockedSkins,
                unlockedElements,
                selectedSkin: selected,
                musicVolume: Number.isFinite(Number(stored.musicVolume))
                    ? Math.max(0, Math.min(1, Number(stored.musicVolume)))
                    : defaultProfile.musicVolume,
                musicPlaylist:
                    typeof stored.musicPlaylist === "string"
                    && (
                        stored.musicPlaylist === "all"
                        || musicTracks.some(
                            (track) =>
                                track.playlist === stored.musicPlaylist,
                        )
                    )
                        ? stored.musicPlaylist
                        : defaultProfile.musicPlaylist,
            };
        } catch (error) {
            return defaultProfile;
        }
    }

    function saveProfile() {
        try {
            window.localStorage.setItem(
                PROFILE_STORAGE_KEY,
                JSON.stringify(profile),
            );
        } catch (error) {
            statusElement.textContent =
                "La sauvegarde locale est indisponible dans ce navigateur.";
        }
    }

    function updateMusicVolume(value, shouldSave = false) {
        profile.musicVolume = clamp(Number(value) || 0, 0, 1);
        backgroundMusic.volume = profile.musicVolume;
        const percentage = Math.round(profile.musicVolume * 100);
        musicVolumeControl.value = String(percentage);
        musicVolumeValue.textContent = `${percentage} %`;
        if (shouldSave) {
            saveProfile();
        }
    }

    function attemptMusicPlayback() {
        if (!activeMusicTracks.length || !backgroundMusic.paused) {
            return;
        }
        const playRequest = backgroundMusic.play();
        if (playRequest) {
            playRequest.catch(() => {
                // Les navigateurs peuvent bloquer l'audio avant le premier
                // clic. Le prochain geste du joueur relancera la lecture.
            });
        }
    }

    function unlockMusicFromInteraction() {
        attemptMusicPlayback();
    }

    function stopMusicUnlockListeners() {
        document.removeEventListener(
            "pointerdown",
            unlockMusicFromInteraction,
        );
        document.removeEventListener("keydown", unlockMusicFromInteraction);
    }

    function loadMusicTrack(index, shouldPlay = false) {
        if (!activeMusicTracks.length) {
            nowPlayingTitle.textContent = "Aucune musique trouvée";
            return;
        }
        currentMusicIndex =
            (index + activeMusicTracks.length) % activeMusicTracks.length;
        const track = activeMusicTracks[currentMusicIndex];
        nowPlayingTitle.textContent = track.title;
        backgroundMusic.src = track.url;
        backgroundMusic.load();
        if (shouldPlay) {
            attemptMusicPlayback();
        }
    }

    function refillMusicShuffleBag() {
        musicShuffleBag = activeMusicTracks.map((_track, index) => index);
        for (let index = musicShuffleBag.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [musicShuffleBag[index], musicShuffleBag[swapIndex]] = [
                musicShuffleBag[swapIndex],
                musicShuffleBag[index],
            ];
        }
        if (
            musicShuffleBag.length > 1
            && musicShuffleBag[0] === currentMusicIndex
        ) {
            [musicShuffleBag[0], musicShuffleBag[1]] = [
                musicShuffleBag[1],
                musicShuffleBag[0],
            ];
        }
    }

    function playNextMusicTrack() {
        if (!activeMusicTracks.length) return;
        if (!musicShuffleBag.length) refillMusicShuffleBag();
        loadMusicTrack(musicShuffleBag.shift(), true);
    }

    function handleMusicError() {
        musicErrorCount += 1;
        if (musicErrorCount < activeMusicTracks.length) {
            playNextMusicTrack();
            return;
        }
        nowPlayingTitle.textContent = "Musique indisponible";
    }

    function updateMusicPlaylist(
        playlistId,
        shouldSave = false,
        shouldPlay = false,
    ) {
        const requestedTracks = playlistId === "all"
            ? musicTracks
            : musicTracks.filter(
                (track) => track.playlist === playlistId,
            );
        const selectedPlaylist = requestedTracks.length
            ? playlistId
            : "all";
        activeMusicTracks = selectedPlaylist === "all"
            ? musicTracks
            : requestedTracks;
        profile.musicPlaylist = selectedPlaylist;
        musicPlaylistControl.value = selectedPlaylist;
        musicErrorCount = 0;
        currentMusicIndex = -1;
        musicShuffleBag = [];
        if (activeMusicTracks.length) {
            refillMusicShuffleBag();
            loadMusicTrack(musicShuffleBag.shift(), shouldPlay);
        }
        if (shouldSave) {
            saveProfile();
        }
    }

    function initialiseBackgroundMusic() {
        updateMusicVolume(profile.musicVolume);
        updateMusicPlaylist(profile.musicPlaylist, false, true);
    }

    function awardLegacyCredits(amount) {
        const earned = Math.max(0, Math.round(amount));
        profile.legacyCredits += earned;
        campaign.legacyEarned += earned;
        saveProfile();
        updateSkinSelector();
        return earned;
    }

    function getSpecialAbilityDefinition() {
        if (!campaign.elementPath) {
            return null;
        }
        const ability = SPECIAL_ABILITIES[campaign.elementPath];
        return ability && hasSkill(ability.skillId) ? ability : null;
    }

    function createCampaign() {
        return {
            round: 1,
            points: 0,
            totalKills: 0,
            legacyEarned: 0,
            damageDealt: 0,
            damageTaken: 0,
            survivalTime: 0,
            upgrades: {
                vitality: 0,
                power: 0,
                cadence: 0,
                dash: 0,
                fullAuto: 0,
                mobility: 0,
                armor: 0,
                scavenger: 0,
                vision: 0,
            },
            elementPath: null,
            elementLevel: 0,
            talentPoints: 0,
            killTalentProgress: 0,
            roundTalentFromKills: 0,
            skillNodes: [],
            seed: Math.floor(Math.random() * 1000000000),
            generatedTiers: {},
        };
    }

    function getRoundRewardMultiplier(round) {
        return Math.pow(1.15, Math.max(0, round - 1));
    }

    function createRoundSettings(round) {
        const difficulty = round - 1;

        return {
            botCount: Math.min(46, 18 + difficulty * 4),
            duration: Math.min(210, 150 + difficulty * 6),
            botHealth: Math.min(170, 66 + difficulty * 9),
            botSpeedMinimum: Math.min(175, 108 + difficulty * 6),
            botSpeedMaximum: Math.min(205, 136 + difficulty * 6),
            botDamage: Math.min(19, 7 + difficulty * 1.15),
            botSpread: Math.max(0.075, 0.24 - difficulty * 0.018),
            botFireMinimum: Math.max(0.42, 0.98 - difficulty * 0.05),
            botFireMaximum: Math.max(0.68, 1.38 - difficulty * 0.055),
            zoneDamage: 5.5 + difficulty * 0.85,
            killReward: Math.max(
                1,
                Math.round(3 * getRoundRewardMultiplier(round)),
            ),
            completionBonus: Math.max(
                1,
                Math.round((14 + round * 4) * getRoundRewardMultiplier(round)),
            ),
            eliteCount: Math.min(8, 1 + Math.floor((round + 1) / 3)),
            crateCount: Math.min(16, 8 + Math.floor(round / 2)),
            enemyAbilityLevel: Math.min(6, 1 + Math.floor(round / 2)),
            enemyAbilityChance: Math.min(1, 0.18 + difficulty * 0.13),
            enemyTraitChance: Math.min(0.9, Math.max(0, difficulty - 1) * 0.11),
        };
    }

    function getUpgradeCost(upgradeName) {
        const definition = UPGRADE_DEFINITIONS[upgradeName];
        const level = campaign.upgrades[upgradeName];
        return definition.baseCost + definition.costStep * level;
    }

    function getUpgradeMaxLevel(upgradeName) {
        return UPGRADE_DEFINITIONS[upgradeName].maxLevel ||
            MAX_UPGRADE_LEVEL;
    }

    const KILLS_PER_TALENT_POINT = 10;

    function awardKillTalent() {
        campaign.killTalentProgress += 1;
        if (campaign.killTalentProgress < KILLS_PER_TALENT_POINT) {
            return;
        }
        campaign.killTalentProgress -= KILLS_PER_TALENT_POINT;
        campaign.talentPoints += 1;
        campaign.roundTalentFromKills += 1;
        statusElement.textContent =
            "Essence de talent gagnée : 10 éliminations.";
    }

    const GENERATED_SKILL_POOL = [
        {
            id: "gen-ultimate-charge",
            label: "Charge accélérée",
            description: "L’ultime se charge 15 % plus vite.",
            requires: "ultimate",
        },
        {
            id: "gen-ultimate-radius",
            label: "Onde élargie",
            description: "Le rayon de l’ultime augmente de 20 %.",
            requires: "ultimate",
        },
        {
            id: "gen-ultimate-damage",
            label: "Puissance ultime",
            description: "L’ultime inflige 25 % de dégâts en plus.",
            requires: "ultimate",
        },
        {
            id: "gen-dash-distance",
            label: "Foulée allongée",
            description: "Le dash parcourt 18 % de distance en plus.",
            requires: "dash",
        },
        {
            id: "gen-dash-cooldown",
            label: "Récupération rapide",
            description: "Le dash récupère 20 % plus vite.",
            requires: "dash",
        },
        {
            id: "gen-damage",
            label: "Frappe affûtée",
            description: "+8 % de dégâts.",
        },
        {
            id: "gen-health",
            label: "Constitution",
            description: "+10 % de santé maximale.",
        },
        {
            id: "gen-cadence",
            label: "Cadence rapide",
            description: "+8 % de cadence de tir.",
        },
        {
            id: "gen-shield",
            label: "Égide",
            description: "+25 de bouclier maximum.",
        },
        {
            id: "gen-speed",
            label: "Célérité",
            description: "+6 % de vitesse.",
        },
        {
            id: "gen-investor-points",
            label: "Intérêts composés",
            description: "+15 % de points gagnés.",
            requires: "path:investor",
        },
        {
            id: "gen-investor-crates",
            label: "Butin doré",
            description: "Les caisses rapportent 40 % de points en plus.",
            requires: "path:investor",
        },
        {
            id: "gen-investor-kill",
            label: "Dividendes",
            description: "+2 points par élimination.",
            requires: "path:investor",
        },
        {
            id: "gen-magnetic-turn",
            label: "Champ resserré",
            description: "Les balles virent 25 % plus vite.",
            requires: "path:magnetic",
        },
        {
            id: "gen-magnetic-damage",
            label: "Noyau dense",
            description: "Récupère 8 % de la pénalité de dégâts.",
            requires: "path:magnetic",
        },
        {
            id: "gen-magnetic-range",
            label: "Attraction élargie",
            description: "Portée de guidage +30 %.",
            requires: "path:magnetic",
        },
    ];

    function createSeededRandom(seed) {
        let state = seed >>> 0;
        return function nextRandom() {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296;
        };
    }

    function countSkill(skillId) {
        let total = 0;
        for (const takenId of campaign.skillNodes) {
            if (takenId === skillId) {
                total += 1;
            }
        }
        return total;
    }

    function isGeneratedOptionAvailable(option) {
        if (!option.requires) {
            return true;
        }
        if (option.requires === "ultimate") {
            return Boolean(getSpecialAbilityDefinition());
        }
        if (option.requires === "dash") {
            return campaign.upgrades.dash > 0;
        }
        if (option.requires.startsWith("path:")) {
            return campaign.elementPath === option.requires.slice(5);
        }
        return false;
    }

    function getGeneratedTierOptions(tier, count) {
        if (count <= 0) {
            return [];
        }
        const cachedIds = campaign.generatedTiers[tier];
        if (cachedIds) {
            return cachedIds
                .map((id) =>
                    GENERATED_SKILL_POOL.find((option) => option.id === id),
                )
                .filter(Boolean);
        }
        let pool = GENERATED_SKILL_POOL.filter(isGeneratedOptionAvailable);
        if (pool.length < count) {
            pool = GENERATED_SKILL_POOL.filter((option) => !option.requires);
        }
        const nextRandom = createSeededRandom(campaign.seed + tier * 7919);
        const remaining = pool.slice();
        const picked = [];
        while (picked.length < count && remaining.length > 0) {
            const index = Math.floor(nextRandom() * remaining.length);
            picked.push(remaining.splice(index, 1)[0]);
        }
        campaign.generatedTiers[tier] = picked.map((option) => option.id);
        return picked;
    }

    function getTierOptions(tier) {
        const definition = ELEMENT_DEFINITIONS[campaign.elementPath];
        if (!definition) {
            return [];
        }
        const generatedFrom =
            definition.generatedFromTier || MAX_SKILL_TIERS + 1;
        if (tier < generatedFrom) {
            return definition.nodes.filter((node) => node.tier === tier);
        }
        const curated = definition.nodes.filter((node) =>
            definition.generatedFromTier
                ? node.tier <= tier && !hasSkill(node.id)
                : node.tier === tier && !hasSkill(node.id),
        );
        return curated.concat(
            getGeneratedTierOptions(tier, 3 - curated.length),
        );
    }

    function getUltimateChargeMultiplier() {
        return 1 + 0.15 * countSkill("gen-ultimate-charge");
    }

    function getUltimateDamageMultiplier() {
        return 1 + 0.25 * countSkill("gen-ultimate-damage");
    }

    function getUltimateRadiusMultiplier() {
        return 1 + 0.2 * countSkill("gen-ultimate-radius");
    }

    function hasSkill(skillId) {
        return campaign.skillNodes.includes(skillId);
    }

    function updateElementLevel() {
        campaign.elementLevel = campaign.elementPath
            ? Math.min(5, 1 + Math.floor(campaign.skillNodes.length / 2))
            : 0;
    }

    function countSurvivors() {
        return actors.filter(
            (actor) => actor.alive && !actor.isZombie,
        ).length;
    }

    const ZOMBIE_CONTACT_DAMAGE = 14;
    const ZOMBIE_CONTACT_INTERVAL = 0.85;
    const ZOMBIE_RESPAWN_DELAY = 3.5;
    // ~1,5x le rétrécissement max en un ZOMBIE_RESPAWN_DELAY (zone.radius
    // perd au plus 6 * 0,5 * 0,5 / duration * (END-START) ~ 14,6 px/s au
    // point le plus raide du smoothstep, à round 10 (duration = 204 s) :
    // 3,5 s de vie => ~51 px). Volontairement PAS plus large : les salles
    // (hors spawn) sont semées une seule fois, à la génération de l'arène,
    // à une distance de la salle de spawn qui ne peut jamais descendre sous
    // ROOM_SEPARATION + les deux moitiés de salle (voir battle_royale_map.js
    // placeRooms) ; passé un certain rétrécissement de zone.radius, aucune
    // marge ne rend plus aucune salle hors-spawn atteignable, donc élargir
    // la marge ne fait que réduire le taux de réussite en milieu de round
    // sans rien gagner en fin de round (mesuré par simulation).
    const ZOMBIE_SPAWN_ZONE_MARGIN = 80;
    // Deux seuils plutôt qu'un seul : le zombie verrouille le joueur à
    // ZOMBIE_AGGRO_RANGE et ne le relâche qu'au-delà de
    // ZOMBIE_AGGRO_RELEASE, sinon il hésiterait entre le joueur et un bot
    // en oscillant autour d'une frontière unique.
    const ZOMBIE_AGGRO_RANGE = 700;
    const ZOMBIE_AGGRO_RELEASE = 1150;
    let zombieRespawnTimer = 0;
    let zombieSerial = 0;

    function getZombiePopulationTarget() {
        return currentEnvironment.id === "necropolis"
            ? Math.min(
                18,
                8 + Math.floor((campaign.round - 10) / 2),
            )
            : 0;
    }

    function spawnZombie() {
        // Comme randomPointInZone/randomArenaPoint : on retire un point tant
        // qu'il tombe trop près du joueur (pour qu'un renfort en cours de
        // round n'apparaisse jamais dans la pièce qu'il occupe déjà) ou tant
        // qu'il tombe hors de la zone qui rétrécit (sinon, en fin de round,
        // les renforts apparaissent hors zone et meurent avant d'avoir pu
        // approcher qui que ce soit). Les deux contraintes partagent le même
        // compteur de tentatives pour que la boucle reste bornée.
        let point;
        let attempts = 0;

        do {
            point = randomArenaPointAwayFromSpawn(220);
            attempts += 1;
        } while (
            attempts < 30 &&
            (
                (player && distanceBetween(point, player) < 600) ||
                distanceBetween(point, zone) >
                    zone.radius - ZOMBIE_SPAWN_ZONE_MARGIN
            )
        );

        zombieSerial += 1;
        const zombie = createActor(
            `zombie-${zombieSerial}`,
            point.x,
            point.y,
            false,
            false,
        );
        zombie.isZombie = true;
        zombie.zombieKind = Math.random() < 0.5 ? "zombie" : "skeleton";
        zombie.maxHealth = 54 + campaign.round * 3;
        zombie.health = zombie.maxHealth;
        zombie.shield = 0;
        zombie.maxShield = 0;
        zombie.speed = randomBetween(130, 160);
        zombie.element = null;
        zombie.trait = null;
        actors.push(zombie);
    }

    function chooseEnvironment() {
        const choices = ENVIRONMENTS.filter(
            (environment) =>
                environment.id !== previousEnvironmentId &&
                campaign.round >= (environment.minimumRound || 1),
        );
        currentEnvironment =
            choices[Math.floor(Math.random() * choices.length)] ||
            ENVIRONMENTS[0];
        previousEnvironmentId = currentEnvironment.id;
    }

    function createEnemyBuild(isElite) {
        const abilityLevel =
            roundSettings.enemyAbilityLevel + (isElite ? 1 : 0);
        const elementNames = Object.keys(ENEMY_ELEMENTS);
        const traitNames = Object.keys(ENEMY_TRAITS);
        const hasElement =
            campaign.round >= 2 &&
            (isElite || Math.random() < roundSettings.enemyAbilityChance);
        const hasTrait =
            campaign.round >= 3 &&
            (isElite || Math.random() < roundSettings.enemyTraitChance);

        return {
            level: Math.min(7, abilityLevel),
            element: hasElement
                ? elementNames[Math.floor(Math.random() * elementNames.length)]
                : null,
            trait: hasTrait
                ? traitNames[Math.floor(Math.random() * traitNames.length)]
                : null,
        };
    }

    function clearPointsGain() {
        if (pointsGainTimer !== null) {
            window.clearTimeout(pointsGainTimer);
            pointsGainTimer = null;
        }
        pointsGainElement.classList.remove("visible");
        pointsGainElement.textContent = "";
    }

    let goldRushTimer = 0;

    function getPointsMultiplier() {
        return (
            (campaign.elementPath === "investor" ? 1.4 : 1) *
            (1 + 0.15 * countSkill("gen-investor-points")) *
            (goldRushTimer > 0 ? 2 : 1)
        );
    }

    function awardPoints(amount, announcement) {
        const awardedPoints = Math.max(
            0,
            Math.round(amount * getPointsMultiplier()),
        );
        if (awardedPoints === 0) {
            return awardedPoints;
        }

        campaign.points += awardedPoints;
        pointsElement.textContent = String(campaign.points);
        shopPoints.textContent = String(campaign.points);

        clearPointsGain();
        pointsGainElement.textContent = `+${awardedPoints}`;
        // Relance l'animation même si deux récompenses sont rapprochées.
        void pointsGainElement.offsetWidth;
        pointsGainElement.classList.add("visible");
        pointsGainTimer = window.setTimeout(clearPointsGain, 1800);

        if (announcement) {
            statusElement.textContent =
                `${announcement} +${awardedPoints} points. ` +
                `Total : ${campaign.points}.`;
        }
        return awardedPoints;
    }

    function createActor(id, x, y, isPlayer = false, isElite = false) {
        const hue = Math.floor(randomBetween(345, 375)) % 360;
        const enemyBuild = isPlayer
            ? { level: 0, element: null, trait: null }
            : createEnemyBuild(isElite);
        let maxHealth = isPlayer
            ? 100 +
                campaign.upgrades.vitality * 25 +
                (hasSkill("solar-plating") ? 20 : 0) +
                (hasSkill("aerial-armor") ? 20 : 0) +
                (hasSkill("lucid-armor") ? 25 : 0) +
                (hasSkill("blood-armor") ? 30 : 0)
            : roundSettings.botHealth * (1 + enemyBuild.level * 0.025);
        if (isElite) {
            maxHealth = Math.round(maxHealth * 1.7);
        }
        if (isPlayer) {
            maxHealth *= 1 + 0.1 * countSkill("gen-health");
        }
        maxHealth = Math.round(maxHealth);
        const skin = SKINS[selectedSkin];
        const pathShield = isPlayer
            ? (hasSkill("crystal-armor") ? 30 : 0) +
                (hasSkill("storm-shield") ? 25 : 0) +
                (hasSkill("solar-plating") ? 20 : 0) +
                (hasSkill("ice-barrier") ? 25 : 0) +
                (hasSkill("air-shield") ? 25 : 0) +
                (hasSkill("aerial-armor") ? 20 : 0) +
                (hasSkill("mental-ward") ? 25 : 0) +
                (hasSkill("lucid-armor") ? 15 : 0) +
                (hasSkill("blood-shield") ? 25 : 0) +
                (hasSkill("blood-armor") ? 20 : 0) +
                25 * countSkill("gen-shield")
            : enemyBuild.trait === "guardian"
                ? 18 + enemyBuild.level * 8
                : 0;
        const baseShotDamage = isPlayer
            ? 32 + campaign.upgrades.power * 8
            : roundSettings.botDamage *
                (isElite ? 1.35 : 1) *
                (1 + enemyBuild.level * 0.035);
        const reviveCharges = isPlayer
            ? hasSkill("eternal-phoenix")
                ? 2
                : hasSkill("rebirth") || hasSkill("undying-night")
                    ? 1
                    : 0
            : 0;

        return {
            id,
            x,
            y,
            radius: isPlayer ? 19 : isElite ? 23 : 17,
            health: maxHealth,
            maxHealth,
            shield: isPlayer
                ? campaign.upgrades.armor * 12 + pathShield
                : pathShield,
            maxShield: isPlayer
                ? 60 + campaign.upgrades.armor * 12 + pathShield
                : pathShield,
            alive: true,
            isPlayer,
            isElite,
            isZombie: false,
            zombieKind: "zombie",
            contactCooldown: 0,
            angle: 0,
            speed: isPlayer
                ? (255 +
                    campaign.upgrades.mobility * 22 +
                    (hasSkill("tailwind") ? 35 : 0) +
                    (hasSkill("slipstream") ? 45 : 0) +
                    (hasSkill("windrunner") ? 35 : 0) +
                    (hasSkill("untouchable-sky") ? 65 : 0) +
                    (hasSkill("night-predator") ? 35 : 0)) *
                    (1 + 0.06 * countSkill("gen-speed"))
                : (isElite ? 1.08 : 1) * randomBetween(
                    roundSettings.botSpeedMinimum,
                    roundSettings.botSpeedMaximum,
                ),
            shotDamage:
                baseShotDamage *
                (isPlayer && hasSkill("searing-rounds") ? 1.15 : 1) *
                (isPlayer && hasSkill("razor-wind") ? 1.15 : 1) *
                (isPlayer && hasSkill("mind-spike") ? 1.15 : 1) *
                (isPlayer && hasSkill("sanguine-bolts") ? 1.15 : 1) *
                (isPlayer && hasSkill("ancient-vampire") ? 1.2 : 1) *
                (isPlayer ? 1 + 0.08 * countSkill("gen-damage") : 1),
            fireDelay: isPlayer
                ? 0.42 *
                    (0.9 ** campaign.upgrades.cadence) *
                    (hasSkill("capacitor") ? 0.85 : 1) *
                    (hasSkill("time-warp") ? 0.75 : 1) *
                    (hasSkill("jetstream") ? 0.85 : 1) *
                    (hasSkill("perfect-focus") ? 0.85 : 1) *
                    (hasSkill("ascended-mind") ? 0.8 : 1) /
                    (1 + 0.08 * countSkill("gen-cadence"))
                : 1,
            shotSpread: isPlayer ? 0.025 : roundSettings.botSpread,
            cooldown: isPlayer ? 0 : randomBetween(1.2, 2.2),
            animationClock: randomBetween(0, 1),
            movementDistance: 0,
            lastStepX: 0,
            lastStepY: 0,
            lastRoomId: null,
            routeKey: null,
            routePath: null,
            routeIndex: 0,
            inMud: false,
            walkDustCarry: 0,
            shieldFlashTimer: 0,
            isMoving: false,
            attackAnimationTimer: 0,
            dashCooldown: isPlayer
                ? 0
                : randomBetween(2.5, 6.5),
            dashCooldownMaximum: 5,
            specialCharge: 0,
            overdriveTimer: 0,
            burnTimer: 0,
            burnDamage: 0,
            burnOwner: null,
            slowTimer: 0,
            slowFactor: 1,
            attackSlowTimer: 0,
            attackSlowFactor: 1,
            weakenTimer: 0,
            weakenFactor: 1,
            lastHitTimer: 99,
            teleportCooldown: 0,
            featureFxCooldown: 0,
            reviveCharges,
            reviveAvailable: reviveCharges > 0,
            kills: 0,
            spawnShield: isPlayer ? 3.5 : 0,
            aiSeed: randomBetween(0, Math.PI * 2),
            aiTarget: null,
            huntingPlayer: false,
            aiTargetRefresh: randomBetween(0, 0.16),
            element: enemyBuild.element,
            elementLevel: enemyBuild.level,
            trait: enemyBuild.trait,
            skinId: isPlayer ? selectedSkin : null,
            color: isPlayer
                ? skin.color
                : isElite
                    ? "#fbbf24"
                    : `hsl(${hue} 86% 68%)`,
            outline: isPlayer ? skin.outline : "#ffd9df",
        };
    }

    function pointInsideObstacle(point, obstacle, padding = 0) {
        if (!obstacle.alive) {
            return false;
        }

        if (obstacle.shape === "rectangle") {
            return (
                point.x > obstacle.x - obstacle.width / 2 - padding &&
                point.x < obstacle.x + obstacle.width / 2 + padding &&
                point.y > obstacle.y - obstacle.height / 2 - padding &&
                point.y < obstacle.y + obstacle.height / 2 + padding
            );
        }

        return distanceBetween(point, obstacle) < obstacle.radius + padding;
    }

    function pointBlocked(point, padding = 0) {
        return Boolean(
            visitNearbyObstacles(
                point,
                padding,
                (obstacle) => {
                    if (
                        obstacle.solid &&
                        pointInsideObstacle(point, obstacle, padding)
                    ) {
                        return obstacle;
                    }
                    return null;
                },
            ),
        );
    }

    function randomPointInZone(minimumDistanceFromPlayer = 0) {
        let point;
        let attempts = 0;

        do {
            const angle = randomBetween(0, Math.PI * 2);
            const radius = Math.sqrt(Math.random()) * (zone.radius - 55);
            point = {
                x: zone.x + Math.cos(angle) * radius,
                y: zone.y + Math.sin(angle) * radius,
            };
            attempts += 1;
        } while (
            player &&
            (
                distanceBetween(point, player) < minimumDistanceFromPlayer ||
                pointBlocked(point, 35)
            ) &&
            attempts < 30
        );

        return point;
    }

    function createScenery() {
        scenery = [];

        for (let index = 0; index < 320; index += 1) {
            const point = randomPointInZone(70);
            if (pointBlocked(point, 18)) {
                continue;
            }
            scenery.push({
                x: point.x,
                y: point.y,
                size: randomBetween(10, 32),
                kind: currentEnvironment.sceneryKinds[
                    Math.floor(
                        Math.random() *
                        currentEnvironment.sceneryKinds.length
                    )
                ],
                rotation: randomBetween(0, Math.PI * 2),
                spriteIndex: Math.floor(Math.random() * 64),
            });
        }
    }

    function createGroundDetails() {
        groundDetails = [];

        for (let index = 0; index < 520; index += 1) {
            const point = randomPointInZone(0);
            groundDetails.push({
                x: point.x,
                y: point.y,
                size: randomBetween(5, 22),
                rotation: randomBetween(0, Math.PI * 2),
                type: currentEnvironment.detailType,
            });
        }
    }

    function createMapFeatures() {
        mapFeatures = [];

        if (currentEnvironment.id === "forest") {
            for (let index = 0; index < 6; index += 1) {
                const point = randomArenaPoint(220);
                mapFeatures.push({
                    id: `grove-${index}`,
                    type: "healing-grove",
                    x: point.x,
                    y: point.y,
                    radius: randomBetween(105, 145),
                    phase: randomBetween(0, Math.PI * 2),
                });
            }
        } else if (currentEnvironment.id === "badlands") {
            for (let pair = 0; pair < 4; pair += 1) {
                for (let side = 0; side < 2; side += 1) {
                    const point = randomArenaPoint(260);
                    mapFeatures.push({
                        id: `portal-${pair}-${side}`,
                        type: "portal",
                        pair,
                        side,
                        x: point.x,
                        y: point.y,
                        radius: 42,
                        phase: randomBetween(0, Math.PI * 2),
                    });
                }
            }
        } else if (currentEnvironment.id === "frost") {
            for (let index = 0; index < 9; index += 1) {
                const point = randomArenaPoint(170);
                mapFeatures.push({
                    id: `blizzard-${index}`,
                    type: "blizzard",
                    x: point.x,
                    y: point.y,
                    radius: randomBetween(115, 165),
                    slowFactor: 0.42,
                    phase: randomBetween(0, Math.PI * 2),
                });
            }
        } else if (currentEnvironment.id === "necropolis") {
            // Pas de champ de danger : la horde de zombies est déjà le
            // gimmick de la zone, elle n'a pas besoin d'un hasard de terrain.
        } else {
            for (let index = 0; index < 7; index += 1) {
                const point = randomArenaPoint(180);
                mapFeatures.push({
                    id: `surge-${index}`,
                    type: "storm-field",
                    x: point.x,
                    y: point.y,
                    radius: randomBetween(95, 135),
                    phase: randomBetween(0, Math.PI * 2),
                });
            }
        }
    }

    // Comme randomPointInZone : la marge est une distance minimale au joueur,
    // et le point tiré ne doit pas tomber dans un obstacle déjà posé.
    function randomArenaPoint(margin) {
        if (!arenaLayout || arenaLayout.rooms.length === 0) {
            return randomPointInZone(margin);
        }

        let point;
        let attempts = 0;

        do {
            const room = arenaLayout.rooms[
                Math.floor(Math.random() * arenaLayout.rooms.length)
            ];
            point = window.BattleRoyaleMap.randomPointInRoom(room, margin);
            attempts += 1;
        } while (
            player &&
            (
                distanceBetween(point, player) < margin ||
                pointBlocked(point, 35)
            ) &&
            attempts < 30
        );

        return point;
    }

    function randomArenaPointAwayFromSpawn(margin) {
        if (arenaLayout && arenaLayout.rooms.length > 1) {
            const choices = arenaLayout.rooms.filter((room) => !room.isSpawn);
            const room = choices[
                Math.floor(Math.random() * choices.length)
            ];
            return window.BattleRoyaleMap.randomPointInRoom(room, margin);
        }
        return randomArenaPoint(margin);
    }

    function createObstacles() {
        obstacles = [];
        obstacleSpatialGridReady = false;
        const wallHealth = 110 + campaign.round * 11;

        function addWall(x, y, width, height, orientation) {
            obstacles.push({
                id: `wall-${obstacles.length}`,
                type: "wall",
                shape: "rectangle",
                x,
                y,
                width,
                height,
                orientation,
                solid: true,
                destructible: true,
                health: wallHealth,
                maxHealth: wallHealth,
                alive: true,
            });
        }

        if (arenaLayout) {
            for (const wall of arenaLayout.walls) {
                addWall(wall.x, wall.y, wall.width, wall.height, wall.orientation);
            }
        } else {
            const structureCount = Math.min(
                18,
                12 + Math.floor(campaign.round / 2),
            );
            for (let index = 0; index < structureCount; index += 1) {
                const center = randomPointInZone(270);
                const layout = Math.floor(Math.random() * 3);
                const width = randomBetween(170, 260);
                const height = randomBetween(125, 210);
                const thickness = randomBetween(20, 30);
                const opening = Math.floor(Math.random() * 4);

                if (layout === 0) {
                    if (opening !== 0) {
                        addWall(center.x, center.y - height / 2, width, thickness);
                    }
                    if (opening !== 1) {
                        addWall(center.x, center.y + height / 2, width, thickness);
                    }
                    if (opening !== 2) {
                        addWall(center.x - width / 2, center.y, thickness, height);
                    }
                    if (opening !== 3) {
                        addWall(center.x + width / 2, center.y, thickness, height);
                    }
                } else if (layout === 1) {
                    addWall(center.x - width * 0.28, center.y, thickness, height);
                    addWall(center.x + width * 0.28, center.y, thickness, height);
                    addWall(
                        center.x,
                        center.y + (opening % 2 ? -1 : 1) * height * 0.45,
                        width * 0.58,
                        thickness,
                    );
                } else {
                    addWall(center.x, center.y, width, thickness);
                    addWall(
                        center.x + (opening % 2 ? -1 : 1) * width * 0.38,
                        center.y + height * 0.35,
                        thickness,
                        height * 0.7,
                    );
                }
            }
        }

        const naturalCount = arenaLayout
            ? Math.min(70, 46 + campaign.round * 2)
            : Math.min(140, 94 + campaign.round * 4);
        for (let index = 0; index < naturalCount; index += 1) {
            const point = randomArenaPoint(210);
            const treeChance = currentEnvironment.id === "forest"
                ? 0.72
                : currentEnvironment.id === "frost"
                    ? 0.5
                    : 0.28;
            const isTree = Math.random() < treeChance;
            obstacles.push({
                id: `natural-${index}`,
                type: isTree ? "tree" : "boulder",
                shape: "circle",
                x: point.x,
                y: point.y,
                radius: isTree
                    ? randomBetween(25, 34)
                    : randomBetween(30, 45),
                solid: true,
                destructible: false,
                alive: true,
                spriteIndex: Math.floor(Math.random() * 64),
            });
        }

        const hazardCount = Math.min(
            24,
            15 + Math.floor(campaign.round / 2),
        );
        for (let index = 0; index < hazardCount; index += 1) {
            const point = randomArenaPoint(150);
            obstacles.push({
                id: `mud-${index}`,
                type: "mud",
                shape: "circle",
                x: point.x,
                y: point.y,
                radius: randomBetween(72, 128),
                solid: false,
                destructible: false,
                slowFactor: currentEnvironment.id === "frost" ? 0.5 : 0.6,
                environment: currentEnvironment.id,
                alive: true,
            });
        }

        rebuildObstacleSpatialGrid();
    }

    function createSupplyCrates() {
        supplyCrates = [];

        for (let index = 0; index < roundSettings.crateCount; index += 1) {
            const point = randomArenaPoint(140);
            const maxHealth = 48 + campaign.round * 4;
            supplyCrates.push({
                id: `crate-${index}`,
                x: point.x,
                y: point.y,
                radius: 22,
                health: maxHealth,
                maxHealth,
                alive: true,
            });
        }
    }

    function spawnPickup(x, y, forcedType = null) {
        const types = ["health", "shield", "credits", "overdrive"];
        const type = forcedType ||
            types[Math.floor(Math.random() * types.length)];
        const colors = {
            health: "#5eead4",
            shield: "#60a5fa",
            credits: "#fde68a",
            overdrive: "#fb7185",
        };

        pickups.push({
            x,
            y,
            type,
            color: colors[type],
            radius: 12,
            life: 22,
            phase: randomBetween(0, Math.PI * 2),
        });
    }

    function destroyCrate(crate) {
        if (!crate.alive) {
            return;
        }

        crate.alive = false;
        createBurst(crate.x, crate.y, "#fbbf24", 15);
        spawnPickup(crate.x - 15, crate.y);
        const supportTypes = ["health", "shield", "overdrive"];
        spawnPickup(
            crate.x + 15,
            crate.y,
            Math.random() < 0.4
                ? "credits"
                : supportTypes[
                    Math.floor(Math.random() * supportTypes.length)
                ],
        );
    }

    function prepareRound() {
        elapsed = 0;
        hudUpdateAccumulator = 0;
        roundKills = 0;
        bullets = [];
        particles = [];
        energyArcs = [];
        powerEffects = [];
        pickups = [];
        roundSettings = createRoundSettings(campaign.round);
        chooseEnvironment();
        mapAnnouncementTimer = 6;
        const zoneMargin = START_ZONE_RADIUS + 80;
        zone = {
            x: randomBetween(zoneMargin, WORLD_WIDTH - zoneMargin),
            y: randomBetween(zoneMargin, WORLD_HEIGHT - zoneMargin),
            radius: START_ZONE_RADIUS,
        };
        arenaLayout = window.BattleRoyaleMap
            ? window.BattleRoyaleMap.generateArena(
                zone.x,
                zone.y,
                START_ZONE_RADIUS,
                currentEnvironment.id,
            )
            : null;
        groundChunks.clear();
        groundChunkOrder.length = 0;

        player = createActor("player", zone.x, zone.y, true);
        actors = [player];
        createObstacles();
        createMapFeatures();

        for (let index = 0; index < roundSettings.botCount; index += 1) {
            const point = randomArenaPointAwayFromSpawn(180);
            const isElite = index < roundSettings.eliteCount;
            actors.push(
                createActor(`bot-${index}`, point.x, point.y, false, isElite),
            );
        }

        zombieRespawnTimer = ZOMBIE_RESPAWN_DELAY;
        zombieSerial = 0;
        const zombiePopulationTarget = getZombiePopulationTarget();
        for (
            let index = 0;
            index < zombiePopulationTarget;
            index += 1
        ) {
            spawnZombie();
        }

        createGroundDetails();
        createScenery();
        createSupplyCrates();
        updateCamera();
        updateHud();
    }

    function updateUpgradeShop() {
        shopPoints.textContent = String(campaign.points);
        const shopIsOpen = matchState === "between-rounds";

        for (const button of upgradeButtons) {
            const upgradeName = button.dataset.upgrade;
            const level = campaign.upgrades[upgradeName];
            const maximumLevel = getUpgradeMaxLevel(upgradeName);
            const isMaximum = level >= maximumLevel;
            const cost = getUpgradeCost(upgradeName);
            const levelElement = button.querySelector("[data-upgrade-level]");
            const costElement = button.querySelector("[data-upgrade-cost]");

            levelElement.textContent = maximumLevel === 1
                ? isMaximum
                    ? "Acquise"
                    : "Perk unique"
                : `Niv. ${level}/${maximumLevel}`;
            costElement.textContent = isMaximum ? "MAX" : `${cost} pts`;
            button.disabled =
                !shopIsOpen || isMaximum || campaign.points < cost;
            button.classList.toggle("maxed", isMaximum);
        }

        if (matchState === "ready") {
            shopHelp.textContent =
                "Termine le premier round pour gagner tes premiers points.";
        } else if (matchState === "between-rounds") {
            shopHelp.textContent =
                "Tes améliorations restent actives pendant toute la campagne.";
        }

        updateElementalPaths();
        updateSkinSelector();
        renderBuildSummary();
    }

    function updateElementalPaths() {
        const canChoosePath =
            matchState === "ready" || matchState === "between-rounds";
        const chosenPath = campaign.elementPath;
        roguePathsElement.hidden = Boolean(chosenPath);

        for (const button of elementalButtons) {
            const elementName = button.dataset.element;
            const definition = ELEMENT_DEFINITIONS[elementName];
            const isChosen = chosenPath === elementName;
            const isChoiceLocked = Boolean(chosenPath && !isChosen);
            const isAccountUnlocked =
                profile.unlockedElements.includes(elementName);
            const progress = button.querySelector("[data-path-progress]");

            if (isChosen) {
                progress.textContent =
                    `${campaign.skillNodes.length} ` +
                    `${campaign.skillNodes.length > 1 ? "talents" : "talent"}`;
            } else if (isChoiceLocked) {
                progress.textContent = "Voie verrouillée";
            } else if (!isAccountUnlocked) {
                progress.textContent = `Débloquer · ${definition.cost} ◆`;
            } else {
                progress.textContent = "Choisir cet avatar";
            }

            button.disabled =
                !canChoosePath || isChoiceLocked || isChosen;
            button.classList.toggle("selected", isChosen);
            button.classList.toggle(
                "locked",
                isChoiceLocked || !isAccountUnlocked,
            );
            button.setAttribute("aria-pressed", String(isChosen));
            button.setAttribute(
                "aria-label",
                `${definition.avatarName}, ${definition.label}. ` +
                (
                    isAccountUnlocked
                        ? definition.passive
                        : `Verrouillée, ${definition.cost} jetons héritage.`
                ),
            );
        }

        talentPointsElement.textContent = String(campaign.talentPoints);
        renderSkillTree();

        const mustChoosePath =
            matchState === "ready" && !campaign.elementPath;
        const hasPendingTalent =
            matchState === "between-rounds" &&
            campaign.talentPoints > 0;
        if (matchState === "ready" || matchState === "between-rounds") {
            startButton.disabled = mustChoosePath || hasPendingTalent;
            startButton.title = mustChoosePath
                ? "Choisis d’abord un avatar."
                : hasPendingTalent
                    ? "Dépense ton essence avant le prochain round."
                    : "";
        }
    }

    function renderSkillTree() {
        const pathName = campaign.elementPath;
        skillTreeElement.replaceChildren();

        if (!pathName) {
            skillTreePanel.hidden = true;
            shopHelp.textContent =
                "Choisis un avatar : sa capacité de départ est gratuite.";
            return;
        }

        const definition = ELEMENT_DEFINITIONS[pathName];
        skillTreePanel.hidden = false;
        skillTreePanel.className =
            `skill-tree-panel path-${pathName}`;
        skillAvatar.textContent = definition.avatar;
        skillAvatarName.textContent = definition.avatarName;
        skillTreeTitle.textContent = definition.label;
        skillPassive.textContent = `Passif : ${definition.passive}`;
        const nextTier = campaign.skillNodes.length + 1;
        {
            const tierElement = document.createElement("div");
            tierElement.className = "skill-tier";
            const tierTitle = document.createElement("strong");
            tierTitle.textContent = nextTier > MAX_SKILL_TIERS
                ? `Palier ${nextTier} · pouvoirs aléatoires`
                : `Palier ${nextTier} · choisis un seul pouvoir`;
            tierElement.append(tierTitle);

            const nodes = getTierOptions(nextTier);
            const isRevealed = campaign.talentPoints > 0;

            for (const node of nodes) {
                const button = document.createElement("button");
                const isAvailable =
                    isRevealed &&
                    matchState === "between-rounds" &&
                    campaign.talentPoints > 0;
                button.type = "button";
                button.className = "skill-node";
                if (isRevealed) {
                    button.dataset.skillNode = node.id;
                }
                button.disabled = !isAvailable;
                button.classList.toggle("available", isAvailable);
                button.classList.toggle("mysterious", !isRevealed);
                button.classList.toggle(
                    "ability-node",
                    isRevealed && Boolean(node.specialAbility),
                );

                const label = document.createElement("strong");
                label.textContent = isRevealed
                    ? node.label
                    : "Talent inconnu";
                const description = document.createElement("small");
                description.textContent = isRevealed
                    ? node.description
                    : "Le contenu sera révélé au prochain palier.";
                const state = document.createElement("i");
                state.textContent = !isRevealed
                    ? "???"
                    : isAvailable
                        ? node.specialAbility
                            ? "E · Débloquer"
                            : "Choisir"
                        : "Indisponible";
                button.append(label, description, state);
                tierElement.append(button);
            }

            skillTreeElement.append(tierElement);
        }

        if (campaign.talentPoints > 0) {
            skillChoiceHelp.textContent =
                `Essence disponible : choisis une amélioration du palier ` +
                `${nextTier}. ` +
                (nextTier > MAX_SKILL_TIERS
                    ? "Les autres seront verrouillées."
                    : "L’autre sera verrouillée.");
            shopHelp.textContent =
                "Un choix est requis avant de lancer le prochain round.";
        } else if (campaign.skillNodes.length >= MAX_SKILL_TIERS) {
            skillChoiceHelp.textContent =
                "Voie maîtrisée : les paliers suivants sont aléatoires.";
        } else {
            skillChoiceHelp.textContent =
                "Remporte un round pour recevoir une essence de talent.";
        }
    }

    function updateSkinSelector() {
        const canChoose =
            matchState === "ready" || matchState === "between-rounds";

        for (const button of skinButtons) {
            const skinId = button.dataset.skin;
            const definition = SKINS[skinId];
            const isUnlocked = profile.unlockedSkins.includes(skinId);
            const isSelected = skinId === selectedSkin;
            const costElement = button.querySelector("[data-skin-cost]");
            button.disabled = !canChoose;
            button.classList.toggle("selected", isSelected);
            button.classList.toggle("locked", !isUnlocked);
            button.setAttribute("aria-pressed", String(isSelected));
            button.setAttribute(
                "aria-label",
                `${definition.name}${isUnlocked
                    ? isSelected
                        ? ", sélectionné"
                        : ", débloqué"
                    : `, à débloquer, ${definition.cost} jetons`}`,
            );
            costElement.textContent = isUnlocked
                ? isSelected
                    ? "Équipé"
                    : "Acquis"
                : `${definition.cost} ◆`;
        }
        selectedSkinName.textContent = SKINS[selectedSkin].name;
        legacyCreditsElement.textContent = String(profile.legacyCredits);
        legacyStatusElement.textContent =
            `◆ ${profile.legacyCredits} héritage`;
        updateMenuCharacterPreviewDetails();
        updateSettingsSummary();
    }

    function getPreviewElementName() {
        return previewElementOverride || campaign.elementPath;
    }

    function updateMenuCharacterPreviewDetails() {
        const elementName = getPreviewElementName();
        const definition = elementName
            ? ELEMENT_DEFINITIONS[elementName]
            : null;
        const previewColor = definition
            ? definition.color
            : SKINS[selectedSkin].color;

        selectedSkinName.textContent = SKINS[selectedSkin].name;
        characterPreviewCard.style.setProperty(
            "--preview-color",
            previewColor,
        );
        previewElementBadge.textContent = definition
            ? `${definition.avatar} ${definition.label}`
            : "Élément à choisir";
        if (definition && previewElementOverride && !campaign.elementPath) {
            characterPreviewDescription.textContent =
                `Aperçu de classe · ${definition.passive}`;
        } else if (definition) {
            characterPreviewDescription.textContent =
                `${definition.avatarName} · ${definition.passive}`;
        } else {
            characterPreviewDescription.textContent =
                "Survole une classe pour essayer sa robe et son bâton.";
        }
    }

    function drawMenuCharacterPreview(timestamp) {
        if (overlay.classList.contains("hidden")) {
            return;
        }

        const width = menuCharacterCanvas.width;
        const height = menuCharacterCanvas.height;
        const elementName = getPreviewElementName();
        const definition = elementName
            ? ELEMENT_DEFINITIONS[elementName]
            : null;
        const color = definition
            ? definition.color
            : SKINS[selectedSkin].color;
        const pulse = 0.5 + Math.sin(timestamp / 470) * 0.08;

        menuCharacterContext.clearRect(0, 0, width, height);
        menuCharacterContext.save();
        const glow = menuCharacterContext.createRadialGradient(
            width / 2,
            height * 0.54,
            8,
            width / 2,
            height * 0.54,
            78,
        );
        glow.addColorStop(0, `${color}66`);
        glow.addColorStop(0.58, `${color}18`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        menuCharacterContext.fillStyle = glow;
        menuCharacterContext.fillRect(0, 0, width, height);

        menuCharacterContext.translate(width / 2, height * 0.72);
        menuCharacterContext.rotate(timestamp / 8200);
        menuCharacterContext.strokeStyle = `${color}88`;
        menuCharacterContext.lineWidth = 2;
        menuCharacterContext.globalAlpha = pulse;
        menuCharacterContext.beginPath();
        menuCharacterContext.arc(0, 0, 52, 0, Math.PI * 2);
        menuCharacterContext.moveTo(-42, 0);
        menuCharacterContext.lineTo(42, 0);
        menuCharacterContext.moveTo(0, -42);
        menuCharacterContext.lineTo(0, 42);
        menuCharacterContext.stroke();
        menuCharacterContext.restore();

        const atlasBundle = getWizardAtlasBundle(
            selectedSkin,
            elementName,
        );
        const atlas = atlasBundle.source;
        const atlasWidth = atlas.naturalWidth || atlas.width;
        const atlasHeight = atlas.naturalHeight || atlas.height;
        if (!atlasBundle.ready || !atlasWidth || !atlasHeight) {
            return;
        }

        const animationStep = Math.floor(timestamp / 210) % 12;
        const animationFrame = animationStep < 8
            ? 1 + (animationStep % 3)
            : animationStep < 10
                ? 4
                : 5;
        const cellWidth = atlasWidth / 6;
        const cellHeight = atlasHeight / atlasBundle.rowCount;
        const targetSize = 142;
        const walkBounce = animationFrame === 2 ? -3 : 0;
        menuCharacterContext.save();
        menuCharacterContext.imageSmoothingEnabled = false;
        menuCharacterContext.drawImage(
            atlas,
            animationFrame * cellWidth,
            SKINS[selectedSkin].atlasIndex * cellHeight,
            cellWidth,
            cellHeight,
            (width - targetSize) / 2,
            17 + walkBounce,
            targetSize,
            targetSize,
        );
        menuCharacterContext.restore();
    }

    function updateSettingsSummary() {
        settingsLegacyCredits.textContent = String(profile.legacyCredits);
        settingsSkinsCount.textContent =
            `${profile.unlockedSkins.length} / ${Object.keys(SKINS).length}`;
        settingsElementsCount.textContent =
            `${profile.unlockedElements.length} / ` +
            `${Object.keys(ELEMENT_DEFINITIONS).length}`;
    }

    function setWardrobeOpen(isOpen) {
        wardrobePanel.hidden = !isOpen;
        wardrobeToggle.setAttribute("aria-expanded", String(isOpen));
        wardrobeToggle.textContent = isOpen
            ? "Fermer le vestiaire"
            : "Changer / acheter un skin";
    }

    function cancelResetConfirmation() {
        if (resetConfirmationTimer) {
            window.clearTimeout(resetConfirmationTimer);
            resetConfirmationTimer = null;
        }
        resetSaveButton.classList.remove("confirming");
        resetSaveButton.dataset.confirming = "false";
        resetSaveButton.textContent = "Réinitialiser ma progression";
        resetSaveHelp.textContent =
            "Efface les jetons, skins et éléments achetés, puis restaure " +
            "uniquement le skin gratuit et les trois éléments de départ.";
    }

    function openSettingsDialog() {
        updateSettingsSummary();
        cancelResetConfirmation();
        if (!settingsDialog.open) {
            settingsDialog.showModal();
        }
    }

    function closeSettingsDialog() {
        cancelResetConfirmation();
        if (settingsDialog.open) {
            settingsDialog.close();
        }
    }

    function resetSavedProgress() {
        try {
            window.localStorage.removeItem(PROFILE_STORAGE_KEY);
        } catch (error) {
            statusElement.textContent =
                "La sauvegarde locale est indisponible dans ce navigateur.";
        }

        profile = createDefaultProfile();
        updateMusicVolume(profile.musicVolume);
        updateMusicPlaylist(profile.musicPlaylist, false, true);
        selectedSkin = profile.selectedSkin;
        previewElementOverride = null;
        campaign = createCampaign();
        matchState = "ready";
        battlePage.classList.remove("battle-running");
        overlay.classList.remove("hidden");
        mouse.down = false;
        dashRequested = false;
        roundRewards.hidden = true;
        defeatStats.hidden = true;
        upgradeShop.hidden = false;
        overlayEyebrow.textContent = "Nouvelle campagne";
        overlayTitle.textContent = "Choisis ton avatar";
        overlayMessage.textContent =
            "Sauvegarde réinitialisée. Les trois éléments de départ et le " +
            "skin gratuit sont de nouveau disponibles.";
        startButton.disabled = true;
        startButton.textContent = "Lancer le round 1";
        setWardrobeOpen(false);
        saveProfile();
        prepareRound();
        updateUpgradeShop();
        closeSettingsDialog();
        statusElement.textContent =
            "Sauvegarde réinitialisée et nouvelle campagne prête.";
    }

    function requestSaveReset() {
        if (resetSaveButton.dataset.confirming === "true") {
            resetSavedProgress();
            return;
        }

        resetSaveButton.dataset.confirming = "true";
        resetSaveButton.classList.add("confirming");
        resetSaveButton.textContent = "Confirmer la remise à zéro";
        resetSaveHelp.textContent =
            "Attention : cette action est définitive. Clique une seconde " +
            "fois dans les 6 secondes pour confirmer.";
        resetConfirmationTimer = window.setTimeout(
            cancelResetConfirmation,
            6000,
        );
    }

    function renderBuildSummary() {
        const items = [];

        if (campaign.elementPath) {
            const path = ELEMENT_DEFINITIONS[campaign.elementPath];
            items.push({
                kind: "Passif",
                label: `${path.avatar} ${path.avatarName}`,
                detail: path.passive,
                color: path.color,
            });
        }

        for (const [upgradeName, level] of Object.entries(
            campaign.upgrades,
        )) {
            if (level > 0) {
                items.push({
                    kind: "Stat",
                    label: UPGRADE_DEFINITIONS[upgradeName].label,
                    detail:
                        `${UPGRADE_DEFINITIONS[upgradeName].description} · ` +
                        (
                            getUpgradeMaxLevel(upgradeName) === 1
                                ? "perk acquis"
                                : `niveau ${level}/` +
                                    `${getUpgradeMaxLevel(upgradeName)}`
                        ),
                    color: "#5eead4",
                });
            }
        }

        if (campaign.elementPath) {
            const path = ELEMENT_DEFINITIONS[campaign.elementPath];
            for (const skillId of campaign.skillNodes) {
                const node = path.nodes.find(
                    (candidate) => candidate.id === skillId,
                );
                if (node) {
                    items.push({
                        kind: `Palier ${node.tier}`,
                        label: node.label,
                        detail: node.description,
                        color: path.color,
                    });
                }
            }
        }

        buildSummaryList.replaceChildren();
        buildSummaryCount.textContent = `${items.length} bonus`;

        if (items.length === 0) {
            const empty = document.createElement("tr");
            empty.className = "empty-build";
            const cell = document.createElement("td");
            cell.colSpan = 8;
            cell.textContent =
                "Choisis une voie pour commencer ton build.";
            empty.append(cell);
            buildSummaryList.append(empty);
            return;
        }

        for (let index = 0; index < items.length; index += 4) {
            const row = document.createElement("tr");
            for (const item of items.slice(index, index + 4)) {
                const kind = document.createElement("td");
                kind.className = "summary-kind";
                kind.style.setProperty("--summary-color", item.color);
                kind.textContent = item.kind;
                const summary = document.createElement("td");
                const label = document.createElement("strong");
                label.textContent = item.label;
                const detail = document.createElement("small");
                detail.textContent = item.detail;
                summary.append(label, detail);
                row.append(kind, summary);
            }
            while (row.children.length < 8) {
                const emptyKind = document.createElement("td");
                const emptySummary = document.createElement("td");
                row.append(emptyKind, emptySummary);
            }
            buildSummaryList.append(row);
        }
    }

    function selectSkin(skinName) {
        if (
            !(skinName in SKINS) ||
            (matchState !== "ready" && matchState !== "between-rounds")
        ) {
            return;
        }

        const definition = SKINS[skinName];
        const isUnlocked = profile.unlockedSkins.includes(skinName);
        if (!isUnlocked) {
            if (profile.legacyCredits < definition.cost) {
                const missing = definition.cost - profile.legacyCredits;
                statusElement.textContent =
                    `${definition.name} nécessite encore ${missing} jeton` +
                    `${missing === 1 ? "" : "s"} d’héritage.`;
                return;
            }
            profile.legacyCredits -= definition.cost;
            profile.unlockedSkins.push(skinName);
            statusElement.textContent =
                `${definition.name} débloqué pour toutes tes aventures.`;
        } else {
            statusElement.textContent = `${definition.name} équipé.`;
        }

        selectedSkin = skinName;
        profile.selectedSkin = skinName;
        saveProfile();
        if (player) {
            player.skinId = skinName;
            player.color = definition.color;
            player.outline = definition.outline;
        }
        updateSkinSelector();
    }

    function purchaseUpgrade(upgradeName) {
        if (
            matchState !== "between-rounds" ||
            !(upgradeName in UPGRADE_DEFINITIONS)
        ) {
            return;
        }

        const level = campaign.upgrades[upgradeName];
        const cost = getUpgradeCost(upgradeName);
        if (
            level >= getUpgradeMaxLevel(upgradeName) ||
            campaign.points < cost
        ) {
            return;
        }

        campaign.points -= cost;
        campaign.upgrades[upgradeName] += 1;
        if (upgradeName === "vision") {
            updateCamera();
        }
        shopHelp.textContent =
            "Amélioration débloquée pour les prochains rounds.";
        statusElement.textContent =
            `Amélioration ${upgradeName} niveau ` +
            `${campaign.upgrades[upgradeName]} débloquée.`;
        updateHud();
        updateUpgradeShop();
    }

    function selectElementPath(elementName) {
        if (
            (matchState !== "ready" && matchState !== "between-rounds") ||
            !(elementName in ELEMENT_DEFINITIONS) ||
            campaign.elementPath
        ) {
            return;
        }

        const definition = ELEMENT_DEFINITIONS[elementName];
        const isUnlocked = profile.unlockedElements.includes(elementName);
        if (!isUnlocked) {
            if (profile.legacyCredits < definition.cost) {
                const missing = definition.cost - profile.legacyCredits;
                statusElement.textContent =
                    `${definition.label} nécessite encore ${missing} jeton` +
                    `${missing === 1 ? "" : "s"} d’héritage.`;
                return;
            }
            profile.legacyCredits -= definition.cost;
            profile.unlockedElements.push(elementName);
            saveProfile();
        }

        campaign.elementPath = elementName;
        previewElementOverride = null;
        updateElementLevel();
        shopHelp.textContent =
            `${definition.avatarName} rejoint la campagne avec son passif.`;
        statusElement.textContent =
            isUnlocked
                ? `Avatar choisi : ${definition.avatarName}, ${definition.label}.`
                : `${definition.label} débloquée définitivement et choisie.`;
        updateHud();
        updateUpgradeShop();
    }

    function purchaseSkill(skillId) {
        if (
            matchState !== "between-rounds" ||
            !campaign.elementPath ||
            campaign.talentPoints <= 0
        ) {
            return;
        }

        const expectedTier = campaign.skillNodes.length + 1;
        const node = getTierOptions(expectedTier).find(
            (candidate) => candidate.id === skillId,
        );
        if (!node) {
            return;
        }

        campaign.skillNodes.push(node.id);
        campaign.talentPoints -= 1;
        updateElementLevel();
        shopHelp.textContent =
            `${node.label} débloqué pour les prochains rounds.`;
        statusElement.textContent =
            `Talent choisi : ${node.label}. Les autres options du palier ` +
            "sont désormais verrouillées.";
        updateHud();
        updateUpgradeShop();
    }

    function beginRound() {
        clearPointsGain();
        goldRushTimer = 0;
        magneticStormTimer = 0;
        prepareRound();
        matchState = "running";
        defeatStats.hidden = true;
        battlePage.classList.add("battle-running");
        overlay.classList.add("hidden");
        mouse.down = false;
        statusElement.textContent = `Le round ${campaign.round} a commencé.`;
        statusElement.textContent +=
            ` ${currentEnvironment.gimmickHint}`;
        canvas.focus();
        lastFrame = performance.now();
        updateUpgradeShop();
    }

    function handlePrimaryAction() {
        if (
            (matchState === "ready" && !campaign.elementPath) ||
            (
                matchState === "between-rounds" &&
                campaign.talentPoints > 0
            )
        ) {
            return;
        }

        if (matchState === "finished") {
            campaign = createCampaign();
            matchState = "ready";
            prepareRound();
            overlayEyebrow.textContent = "Nouvelle campagne";
            overlayTitle.textContent = "Choisis ton avatar";
            overlayMessage.textContent =
                "Chaque voie possède un passif et huit talents exclusifs. " +
                "Ton premier choix restera actif pendant toute la campagne.";
            roundRewards.hidden = true;
            defeatStats.hidden = true;
            upgradeShop.hidden = false;
            startButton.disabled = true;
            startButton.textContent = "Lancer le round 1";
            updateUpgradeShop();
            return;
        }
        if (matchState === "between-rounds") {
            campaign.round += 1;
        } else if (matchState !== "ready") {
            return;
        }

        beginRound();
    }

    function completeRound() {
        if (matchState !== "running") {
            return;
        }

        matchState = "between-rounds";
        battlePage.classList.remove("battle-running");
        mouse.down = false;
        const roundPointsEarned = awardPoints(
            roundSettings.completionBonus,
            `Round ${campaign.round} remporté.`,
        );
        const talentEarned = 1 + campaign.roundTalentFromKills;
        campaign.talentPoints += 1;
        campaign.roundTalentFromKills = 0;
        const legacyEarned = awardLegacyCredits(
            (8 + campaign.round * 4) *
                getRoundRewardMultiplier(campaign.round),
        );
        const nextSettings = createRoundSettings(campaign.round + 1);
        overlay.classList.remove("hidden");
        overlayEyebrow.textContent = `Round ${campaign.round} remporté`;
        overlayTitle.textContent = "Victoire royale !";
        overlayMessage.textContent =
            `Prochain round : ${nextSettings.botCount} adversaires, capacités ` +
            `niveau ${nextSettings.enemyAbilityLevel}. Choisis un pouvoir ` +
            "puis prépare tes statistiques.";
        rewardKills.textContent = String(roundKills);
        rewardPoints.textContent = `+${roundPointsEarned}`;
        rewardTalent.textContent = `+${talentEarned}`;
        rewardLegacy.textContent = `+${legacyEarned}`;
        roundRewards.hidden = false;
        defeatStats.hidden = true;
        upgradeShop.hidden = false;
        startButton.textContent = `Lancer le round ${campaign.round + 1}`;
        statusElement.textContent =
            `Round ${campaign.round} remporté. ` +
            `${roundPointsEarned} points et ${legacyEarned} ` +
            "jetons d’héritage gagnés.";
        updateHud();
        updateUpgradeShop();
    }

    function formatCampaignTime(seconds) {
        const totalSeconds = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    function finishCampaign() {
        if (matchState !== "running") {
            return;
        }

        const survivors = countSurvivors();
        const position = survivors + 1;
        matchState = "finished";
        battlePage.classList.remove("battle-running");
        mouse.down = false;
        overlay.classList.remove("hidden");
        overlayEyebrow.textContent =
            `Fin de campagne · Round ${campaign.round}`;
        overlayTitle.textContent = `Éliminé · place ${position}`;
        overlayMessage.textContent =
            `Tu as atteint le round ${campaign.round} avec ` +
            `${campaign.totalKills} élimination` +
            `${campaign.totalKills === 1 ? "" : "s"}. Tes améliorations de ` +
            `combat seront réinitialisées, mais tes ${profile.legacyCredits} ` +
            "jetons d’héritage et tes skins sont sauvegardés.";
        roundRewards.hidden = true;
        defeatRound.textContent = String(campaign.round);
        defeatKills.textContent = String(campaign.totalKills);
        defeatTime.textContent = formatCampaignTime(
            campaign.survivalTime,
        );
        defeatDamageDealt.textContent = String(
            Math.round(campaign.damageDealt),
        );
        defeatDamageTaken.textContent = String(
            Math.round(campaign.damageTaken),
        );
        defeatLegacy.textContent = String(campaign.legacyEarned);
        defeatStats.hidden = false;
        upgradeShop.hidden = true;
        startButton.textContent = "Nouvelle campagne";
        statusElement.textContent =
            `Campagne terminée au round ${campaign.round}. Place ${position}. ` +
            `${campaign.legacyEarned} jetons conservés.`;
    }

    function applyDamage(target, amount, attacker = null, options = {}) {
        if (!target.alive || amount <= 0) {
            return 0;
        }

        if (
            target.isPlayer &&
            target.spawnShield > 0 &&
            !options.ignoreSpawnShield
        ) {
            return 0;
        }

        target.lastHitTimer = 0;
        if (target.isPlayer) {
            if (
                attacker &&
                !options.dot &&
                hasSkill("foresight") &&
                Math.random() < 0.15
            ) {
                createPowerEffect(
                    "storm",
                    target.x,
                    target.y,
                    "#f0abfc",
                    52,
                    0.3,
                );
                return 0;
            }
            if (
                hasSkill("cryostasis") &&
                target.health / target.maxHealth <= 0.35
            ) {
                amount *= 0.75;
            }
            if (hasSkill("immortal-glacier")) {
                amount *= 0.8;
            }
            if (hasSkill("eye-calm")) {
                amount *= 0.85;
            }
            if (hasSkill("ascended-mind")) {
                amount *= 0.85;
            }
        }

        let remainingDamage = amount;
        let absorbedDamage = 0;
        const healthBefore = target.health;
        if (!options.bypassShield && target.shield > 0) {
            const absorbed = Math.min(target.shield, remainingDamage);
            target.shield -= absorbed;
            remainingDamage -= absorbed;
            absorbedDamage = absorbed;
            if (absorbed > 0) {
                target.shieldFlashTimer = 0.25;
                createBurst(target.x, target.y, "#60a5fa", 4);
            }
        }

        const healthDamage = Math.min(healthBefore, remainingDamage);
        target.health -= remainingDamage;
        const appliedDamage = absorbedDamage + healthDamage;
        if (target.isPlayer) {
            campaign.damageTaken += appliedDamage;
        } else if (attacker?.isPlayer) {
            campaign.damageDealt += appliedDamage;
        }
        if (
            attacker?.isPlayer &&
            !target.isPlayer &&
            !options.noAbilityCharge
        ) {
            chargeSpecialAbility(absorbedDamage + healthDamage);
        }
        if (target.health <= 0) {
            if (target.isPlayer && target.reviveAvailable) {
                target.reviveCharges -= 1;
                target.reviveAvailable = target.reviveCharges > 0;
                target.health = Math.ceil(
                    target.maxHealth *
                    (
                        hasSkill("eternal-phoenix")
                            ? 0.5
                            : hasSkill("undying-night")
                                ? 0.4
                                : 0.35
                    ),
                );
                target.shield = Math.min(target.maxShield, 20);
                target.spawnShield = 1.8;
                createBurst(target.x, target.y, "#fb7185", 32, "fire");
                createPowerEffect(
                    "fire",
                    target.x,
                    target.y,
                    "#fb7185",
                    130,
                    0.75,
                );
                statusElement.textContent =
                    hasSkill("undying-night")
                        ? "Nuit immortelle : Vesper revient au combat."
                        : "Renaissance activée : Kaela refuse de tomber.";
            } else {
                eliminate(target, attacker);
            }
        }

        if (
            target.isPlayer &&
            attacker &&
            attacker.alive &&
            !attacker.isPlayer &&
            remainingDamage > 0 &&
            hasSkill("mirror-shards") &&
            !options.reflected
        ) {
            applyDamage(
                attacker,
                remainingDamage * 0.15,
                target,
                { ignoreSpawnShield: true, reflected: true },
            );
            createPowerEffect(
                "ice",
                target.x,
                target.y,
                "#bae6fd",
                58,
                0.35,
            );
        }

        if (
            target.isPlayer &&
            attacker &&
            attacker.alive &&
            !attacker.isPlayer &&
            remainingDamage > 0 &&
            hasSkill("psychic-backlash") &&
            !options.reflected
        ) {
            applyDamage(
                attacker,
                remainingDamage * 0.12,
                target,
                {
                    ignoreSpawnShield: true,
                    reflected: true,
                    noAbilityCharge: true,
                },
            );
            createPowerEffect(
                "storm",
                target.x,
                target.y,
                "#f0abfc",
                54,
                0.35,
            );
        }

        return appliedDamage;
    }

    function healPlayer(amount, overflowToShield = false) {
        if (!player?.alive || amount <= 0) {
            return 0;
        }

        const healthBefore = player.health;
        player.health = Math.min(
            player.maxHealth,
            player.health + amount,
        );
        const restoredHealth = player.health - healthBefore;
        const overflow = amount - restoredHealth;
        if (overflowToShield && overflow > 0) {
            player.shield = Math.min(
                player.maxShield,
                player.shield + overflow,
            );
        }
        return restoredHealth;
    }

    function chargeSpecialAbility(damage) {
        const ability = getSpecialAbilityDefinition();
        if (!ability || !player?.alive || damage <= 0) {
            return;
        }
        player.specialCharge = Math.min(
            ability.maxCharge / getUltimateChargeMultiplier(),
            player.specialCharge + damage,
        );
    }

    function activateSpecialAbility() {
        if (matchState !== "running" || !player?.alive) {
            return;
        }

        const ability = getSpecialAbilityDefinition();
        if (!ability) {
            statusElement.textContent =
                "Ta capacité E se trouve au palier 3 de l’arbre de compétences.";
            return;
        }
        if (player.specialCharge < ability.maxCharge / getUltimateChargeMultiplier()) {
            const percentage = Math.floor(
                (player.specialCharge / (ability.maxCharge / getUltimateChargeMultiplier())) * 100,
            );
            statusElement.textContent =
                `${ability.name} est chargée à ${percentage} %. ` +
                "Inflige des dégâts pour la remplir.";
            return;
        }

        player.specialCharge = 0;
        createBurst(player.x, player.y, ability.color, 36, campaign.elementPath);

        if (campaign.elementPath === "fire") {
            const radius = 300 * getUltimateRadiusMultiplier();
            const damage =
                (76 + campaign.upgrades.power * 5) *
                getUltimateDamageMultiplier();
            createPowerEffect(
                "fire",
                player.x,
                player.y,
                ability.color,
                radius,
                0.95,
            );
            for (const target of actors) {
                if (
                    target.alive &&
                    !target.isPlayer &&
                    distanceBetween(player, target) <= radius
                ) {
                    applyDamage(target, damage, player, {
                        ignoreSpawnShield: true,
                        noAbilityCharge: true,
                    });
                    target.burnTimer = Math.max(target.burnTimer, 4.5);
                    target.burnDamage = Math.max(
                        target.burnDamage,
                        10 + campaign.elementLevel * 2,
                    );
                    target.burnOwner = player;
                }
            }
        } else if (campaign.elementPath === "ice") {
            const radius = 310 * getUltimateRadiusMultiplier();
            const damage =
                (36 + campaign.upgrades.power * 2) *
                getUltimateDamageMultiplier();
            createPowerEffect(
                "ice",
                player.x,
                player.y,
                ability.color,
                radius,
                1.1,
            );
            player.shield = Math.min(
                player.maxShield,
                player.shield + 45,
            );
            player.spawnShield = Math.max(player.spawnShield, 0.65);
            for (const target of actors) {
                if (
                    target.alive &&
                    !target.isPlayer &&
                    distanceBetween(player, target) <= radius
                ) {
                    applyDamage(target, damage, player, {
                        ignoreSpawnShield: true,
                        noAbilityCharge: true,
                    });
                    target.slowTimer = Math.max(target.slowTimer, 3.2);
                    target.slowFactor = Math.min(target.slowFactor, 0.1);
                }
            }
        } else if (campaign.elementPath === "storm") {
            const chainRange = 640 * getUltimateRadiusMultiplier();
            const targets = actors
                .filter(
                    (target) =>
                        target.alive &&
                        !target.isPlayer &&
                        distanceBetween(player, target) <= chainRange,
                )
                .sort(
                    (first, second) =>
                        distanceBetween(player, first) -
                        distanceBetween(player, second),
                )
                .slice(0, 8);
            createPowerEffect(
                "storm",
                player.x,
                player.y,
                ability.color,
                240,
                0.85,
            );
            let previous = player;
            for (const target of targets) {
                energyArcs.push({
                    x1: previous.x,
                    y1: previous.y,
                    x2: target.x,
                    y2: target.y,
                    color: ability.color,
                    life: 0.6,
                    maximumLife: 0.6,
                });
                applyDamage(
                    target,
                    (62 + campaign.upgrades.power * 3) *
                        getUltimateDamageMultiplier(),
                    player,
                    {
                        ignoreSpawnShield: true,
                        noAbilityCharge: true,
                    },
                );
                previous = target;
            }
            player.overdriveTimer = Math.max(player.overdriveTimer, 5);
            player.dashCooldown = 0;
        } else if (campaign.elementPath === "wind") {
            const radius = 400 * getUltimateRadiusMultiplier();
            createPowerEffect(
                "storm",
                player.x,
                player.y,
                ability.color,
                radius,
                1,
            );
            for (const target of actors) {
                if (
                    !target.alive ||
                    target.isPlayer ||
                    distanceBetween(player, target) > radius
                ) {
                    continue;
                }
                const angle = Math.atan2(
                    target.y - player.y,
                    target.x - player.x,
                );
                applyDamage(
                    target,
                    (48 + campaign.upgrades.power * 2) *
                        getUltimateDamageMultiplier(),
                    player,
                    {
                        ignoreSpawnShield: true,
                        noAbilityCharge: true,
                    },
                );
                moveActor(
                    target,
                    Math.cos(angle) * 360,
                    Math.sin(angle) * 360,
                );
            }
            player.dashCooldown = 0;
        } else if (campaign.elementPath === "psychic") {
            const radius = 470 * getUltimateRadiusMultiplier();
            createPowerEffect(
                "storm",
                player.x,
                player.y,
                ability.color,
                radius,
                1.1,
            );
            for (const target of actors) {
                if (
                    !target.alive ||
                    target.isPlayer ||
                    distanceBetween(player, target) > radius
                ) {
                    continue;
                }
                applyDamage(
                    target,
                    (38 + campaign.upgrades.power * 2) *
                        getUltimateDamageMultiplier(),
                    player,
                    {
                        ignoreSpawnShield: true,
                        noAbilityCharge: true,
                    },
                );
                target.weakenTimer = Math.max(target.weakenTimer, 8);
                target.weakenFactor = Math.min(
                    target.weakenFactor,
                    0.35,
                );
                target.attackSlowTimer = Math.max(
                    target.attackSlowTimer,
                    8,
                );
                target.attackSlowFactor = Math.max(
                    target.attackSlowFactor,
                    1.8,
                );
            }
        } else if (campaign.elementPath === "vampire") {
            const radius = 380 * getUltimateRadiusMultiplier();
            let drainedHealth = 0;
            createPowerEffect(
                "fire",
                player.x,
                player.y,
                ability.color,
                radius,
                1.05,
            );
            for (const target of actors) {
                if (
                    !target.alive ||
                    target.isPlayer ||
                    distanceBetween(player, target) > radius
                ) {
                    continue;
                }
                drainedHealth += applyDamage(
                    target,
                    (70 + campaign.upgrades.power * 3) *
                        getUltimateDamageMultiplier(),
                    player,
                    {
                        ignoreSpawnShield: true,
                        noAbilityCharge: true,
                    },
                );
                energyArcs.push({
                    x1: target.x,
                    y1: target.y,
                    x2: player.x,
                    y2: player.y,
                    color: ability.color,
                    life: 0.7,
                    maximumLife: 0.7,
                });
            }
            healPlayer(
                drainedHealth * 0.55,
                hasSkill("coagulation"),
            );
        } else if (campaign.elementPath === "investor") {
            goldRushTimer = 8;
            awardPoints(40, "Ruée dorée : les points doublent !");
            createPowerEffect(
                "investor",
                player.x,
                player.y,
                "#facc15",
                90 * getUltimateRadiusMultiplier(),
                0.6,
            );
        } else if (campaign.elementPath === "magnetic") {
            magneticStormTimer = 6;
            const pullRadius = 260 * getUltimateRadiusMultiplier();
            for (const target of actors) {
                if (!target.alive || target.isPlayer) {
                    continue;
                }
                const distance = Math.hypot(
                    target.x - player.x,
                    target.y - player.y,
                );
                if (distance > pullRadius || distance <= 0) {
                    continue;
                }
                const pull = (1 - distance / pullRadius) * 120;
                moveActor(
                    target,
                    ((player.x - target.x) / distance) * pull,
                    ((player.y - target.y) / distance) * pull,
                );
            }
            createPowerEffect(
                "magnetic",
                player.x,
                player.y,
                "#94a3b8",
                pullRadius,
                0.6,
            );
        }

        statusElement.textContent = `${ability.name} déchaînée !`;
        updateHud();
    }

    function applyElementalHit(target, bullet) {
        if (
            !bullet.element ||
            bullet.elementLevel <= 0
        ) {
            return;
        }

        const level = bullet.elementLevel;
        const isPlayerPower = bullet.owner.isPlayer;
        if (bullet.element === "fire") {
            target.burnTimer =
                2.2 + level * 0.55 +
                (isPlayerPower && hasSkill("apocalypse") ? 1.5 : 0);
            target.burnDamage =
                (3 + level * 2.5) *
                (
                    isPlayerPower && hasSkill("hungry-flame")
                        ? 1.5
                        : 1
                ) *
                (
                    isPlayerPower && hasSkill("apocalypse")
                        ? 1.4
                        : 1
                );
            target.burnOwner = bullet.owner;
            createBurst(target.x, target.y, "#fb7185", 5, "fire");
            createPowerEffect(
                "fire",
                target.x,
                target.y,
                "#fb7185",
                46 + level * 5,
                0.45,
            );

            if (isPlayerPower && hasSkill("blast-core")) {
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        nearby !== target &&
                        distanceBetween(target, nearby) < 90
                    ) {
                        applyDamage(
                            nearby,
                            bullet.damage * 0.22,
                            bullet.owner,
                        );
                    }
                }
            }
            if (isPlayerPower && hasSkill("wildfire")) {
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        nearby !== target &&
                        distanceBetween(target, nearby) < 125
                    ) {
                        nearby.burnTimer = Math.max(nearby.burnTimer, 2.4);
                        nearby.burnDamage = Math.max(
                            nearby.burnDamage,
                            target.burnDamage * 0.65,
                        );
                        nearby.burnOwner = bullet.owner;
                    }
                }
            }
            if (
                isPlayerPower &&
                hasSkill("meteor") &&
                Math.random() < 0.15
            ) {
                createPowerEffect(
                    "fire",
                    target.x,
                    target.y,
                    "#fbbf24",
                    135,
                    0.7,
                );
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        distanceBetween(target, nearby) < 135
                    ) {
                        applyDamage(
                            nearby,
                            bullet.damage * 0.55,
                            bullet.owner,
                        );
                    }
                }
            }
        } else if (bullet.element === "ice") {
            target.slowTimer =
                1.4 +
                level * 0.7 +
                (isPlayerPower && hasSkill("deep-freeze") ? 0.8 : 0) +
                (isPlayerPower && hasSkill("permafrost") ? 1.4 : 0);
            target.slowFactor = Math.max(
                0.38,
                0.82 -
                    level * 0.1 -
                    (
                        isPlayerPower && hasSkill("deep-freeze")
                            ? 0.18
                            : 0
                    ),
            );
            if (
                isPlayerPower &&
                hasSkill("absolute-zero") &&
                Math.random() < 0.15
            ) {
                target.slowTimer = Math.max(target.slowTimer, 1.5);
                target.slowFactor = 0.12;
            }
            createBurst(target.x, target.y, "#67e8f9", 5, "ice");
            createPowerEffect(
                "ice",
                target.x,
                target.y,
                "#67e8f9",
                48 + level * 5,
                0.5,
            );

            if (isPlayerPower && hasSkill("blizzard")) {
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        nearby !== target &&
                        distanceBetween(target, nearby) < 120
                    ) {
                        applyDamage(
                            nearby,
                            bullet.damage * 0.2,
                            bullet.owner,
                        );
                        nearby.slowTimer = 1.2;
                        nearby.slowFactor = 0.55;
                    }
                }
            }
            if (isPlayerPower && hasSkill("avalanche")) {
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        nearby !== target &&
                        distanceBetween(target, nearby) < 105
                    ) {
                        applyDamage(
                            nearby,
                            bullet.damage * 0.3,
                            bullet.owner,
                        );
                    }
                }
            }
        } else if (bullet.element === "storm") {
            target.attackSlowTimer = Math.max(
                target.attackSlowTimer,
                2.2 + level * 0.55,
            );
            target.attackSlowFactor = Math.max(
                target.attackSlowFactor,
                1.28 + level * 0.09,
            );
            const chainRange =
                210 +
                level * 45 +
                (
                    isPlayerPower && hasSkill("arc-mastery")
                        ? 100
                        : 0
                ) +
                (
                    isPlayerPower && hasSkill("ball-lightning")
                        ? 130
                        : 0
                );
            const chainCount =
                (isPlayerPower ? 1 : Math.min(2, Math.ceil(level / 3))) +
                (
                    isPlayerPower && hasSkill("charged-bolts")
                        ? 1
                        : 0
                ) +
                (isPlayerPower && hasSkill("tempest") ? 2 : 0) +
                (isPlayerPower && hasSkill("ball-lightning") ? 1 : 0) +
                (isPlayerPower && hasSkill("storm-god") ? 3 : 0);
            const candidates = actors
                .filter((actor) =>
                    actor.alive &&
                    actor !== bullet.owner &&
                    actor !== target &&
                    distanceBetween(actor, target) < chainRange,
                )
                .sort(
                    (first, second) =>
                        distanceBetween(first, target) -
                        distanceBetween(second, target),
                )
                .slice(0, chainCount);

            let origin = target;
            for (const chainedTarget of candidates) {
                energyArcs.push({
                    x1: origin.x,
                    y1: origin.y,
                    x2: chainedTarget.x,
                    y2: chainedTarget.y,
                    color: "#c084fc",
                    life: 0.2,
                    maximumLife: 0.2,
                });
                applyDamage(
                    chainedTarget,
                    bullet.damage *
                        (0.28 +
                            level * 0.06 +
                            (
                                isPlayerPower && hasSkill("arc-mastery")
                                    ? 0.15
                                    : 0
                            ) +
                            (
                                isPlayerPower && hasSkill("storm-god")
                                    ? 0.18
                                    : 0
                            )),
                    bullet.owner,
                );
                origin = chainedTarget;
            }
            createBurst(target.x, target.y, "#c4b5fd", 6, "storm");
            createPowerEffect(
                "storm",
                target.x,
                target.y,
                "#c4b5fd",
                55 + level * 5,
                0.42,
            );
            if (isPlayerPower && hasSkill("thunderclap")) {
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        nearby !== target &&
                        distanceBetween(target, nearby) < 95
                    ) {
                        applyDamage(
                            nearby,
                            bullet.damage * 0.24,
                            bullet.owner,
                        );
                    }
                }
            }
        } else if (bullet.element === "wind") {
            const pushAngle = Math.atan2(
                target.y - bullet.owner.y,
                target.x - bullet.owner.x,
            );
            let pushForce = 58 + level * 19;
            if (isPlayerPower && hasSkill("forceful-gust")) {
                pushForce *= 1.45;
            }
            if (isPlayerPower && hasSkill("vortex-rounds")) {
                pushForce *= 1.3;
            }
            if (isPlayerPower && hasSkill("tempest-lord")) {
                pushForce *= 1.35;
            }
            if (
                isPlayerPower &&
                hasSkill("tornado") &&
                Math.random() < 0.15
            ) {
                pushForce *= 2.2;
                createPowerEffect(
                    "storm",
                    target.x,
                    target.y,
                    "#86efac",
                    120,
                    0.7,
                );
            }
            moveActor(
                target,
                Math.cos(pushAngle) * pushForce,
                Math.sin(pushAngle) * pushForce,
            );
            createBurst(target.x, target.y, "#86efac", 7, "wind");
            createPowerEffect(
                "storm",
                target.x,
                target.y,
                "#86efac",
                55 + level * 6,
                0.42,
            );

            if (isPlayerPower && hasSkill("pressure-wave")) {
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        nearby !== target &&
                        distanceBetween(target, nearby) < 125
                    ) {
                        const nearbyAngle = Math.atan2(
                            nearby.y - target.y,
                            nearby.x - target.x,
                        );
                        moveActor(
                            nearby,
                            Math.cos(nearbyAngle) * pushForce * 0.55,
                            Math.sin(nearbyAngle) * pushForce * 0.55,
                        );
                    }
                }
            }
        } else if (bullet.element === "psychic") {
            const duration =
                (3 + level * 0.65) *
                (
                    isPlayerPower && hasSkill("domination")
                        ? 1.75
                        : 1
                );
            const weakenedPower = Math.max(
                0.42,
                0.84 -
                    level * 0.045 -
                    (
                        isPlayerPower && hasSkill("deep-doubt")
                            ? 0.12
                            : 0
                    ),
            );
            target.weakenTimer = Math.max(target.weakenTimer, duration);
            target.weakenFactor = Math.min(
                target.weakenFactor,
                weakenedPower,
            );
            createBurst(target.x, target.y, "#f0abfc", 7, "psychic");
            createPowerEffect(
                "storm",
                target.x,
                target.y,
                "#f0abfc",
                58 + level * 6,
                0.48,
            );

            if (isPlayerPower && hasSkill("mass-hysteria")) {
                for (const nearby of actors) {
                    if (
                        nearby.alive &&
                        !nearby.isPlayer &&
                        nearby !== target &&
                        distanceBetween(target, nearby) < 150
                    ) {
                        nearby.weakenTimer = Math.max(
                            nearby.weakenTimer,
                            duration * 0.65,
                        );
                        nearby.weakenFactor = Math.min(
                            nearby.weakenFactor,
                            weakenedPower,
                        );
                    }
                }
            }
            if (isPlayerPower && hasSkill("mind-chain")) {
                const chainedTargets = actors
                    .filter(
                        (nearby) =>
                            nearby.alive &&
                            !nearby.isPlayer &&
                            nearby !== target &&
                            distanceBetween(target, nearby) < 230,
                    )
                    .sort(
                        (first, second) =>
                            distanceBetween(target, first) -
                            distanceBetween(target, second),
                    )
                    .slice(0, 2);
                for (const chainedTarget of chainedTargets) {
                    chainedTarget.weakenTimer = Math.max(
                        chainedTarget.weakenTimer,
                        duration * 0.6,
                    );
                    chainedTarget.weakenFactor = Math.min(
                        chainedTarget.weakenFactor,
                        weakenedPower,
                    );
                    energyArcs.push({
                        x1: target.x,
                        y1: target.y,
                        x2: chainedTarget.x,
                        y2: chainedTarget.y,
                        color: "#f0abfc",
                        life: 0.24,
                        maximumLife: 0.24,
                    });
                }
            }
        } else if (bullet.element === "vampire") {
            createBurst(target.x, target.y, "#f43f5e", 7, "vampire");
            createPowerEffect(
                "fire",
                target.x,
                target.y,
                "#f43f5e",
                52 + level * 6,
                0.44,
            );
            if (
                isPlayerPower &&
                hasSkill("hemorrhage") &&
                Math.random() < 0.3
            ) {
                target.burnTimer = Math.max(target.burnTimer, 3.5);
                target.burnDamage = Math.max(
                    target.burnDamage,
                    4 + level * 2,
                );
                target.burnOwner = bullet.owner;
            }
        }
    }

    function eliminate(target, attacker = null) {
        if (!target.alive) {
            return;
        }

        target.alive = false;
        target.health = 0;

        if (attacker && attacker !== target) {
            attacker.kills += 1;

            if (attacker.isPlayer && !target.isPlayer) {
                roundKills += 1;
                campaign.totalKills += 1;
                const rewardMultiplier =
                    (target.isElite ? 2 : 1) *
                    (
                        hasSkill("ember-economy")
                            ? 1.25
                            : hasSkill("air-economy") ||
                                hasSkill("psychic-economy") ||
                                hasSkill("vampire-economy")
                                ? 1.2
                                : 1
                    );
                awardPoints(
                    roundSettings.killReward * rewardMultiplier,
                    target.isElite
                        ? "Élite éliminée."
                        : "Adversaire éliminé.",
                );
                if (!target.isZombie) {
                    awardKillTalent();
                }
                if (countSkill("gen-investor-kill") > 0) {
                    awardPoints(2 * countSkill("gen-investor-kill"), null);
                }

                const dropChance =
                    0.3 + campaign.upgrades.scavenger * 0.06;
                if (target.isElite || Math.random() < dropChance) {
                    spawnPickup(target.x, target.y);
                }

                if (hasSkill("phoenix-heart")) {
                    player.health = Math.min(
                        player.maxHealth,
                        player.health + 8,
                    );
                }
                if (hasSkill("frost-leech")) {
                    player.shield = Math.min(
                        player.maxShield,
                        player.shield + 12,
                    );
                }
                if (hasSkill("static-reserve")) {
                    player.shield = Math.min(
                        player.maxShield,
                        player.shield + 15,
                    );
                }
                if (hasSkill("second-wind")) {
                    healPlayer(10);
                }
                if (hasSkill("soul-feast")) {
                    healPlayer(18, hasSkill("coagulation"));
                }
                if (
                    hasSkill("brain-drain") ||
                    hasSkill("soul-feast")
                ) {
                    const ability = getSpecialAbilityDefinition();
                    if (ability) {
                        player.specialCharge = Math.min(
                            ability.maxCharge / getUltimateChargeMultiplier(),
                            player.specialCharge +
                                ability.maxCharge / getUltimateChargeMultiplier() * 0.15,
                        );
                    }
                }

                if (
                    campaign.elementPath === "fire" &&
                    hasSkill("inferno")
                ) {
                    createBurst(target.x, target.y, "#fb7185", 20, "fire");
                    const infernoRadius = hasSkill("apocalypse")
                        ? 210
                        : 165;
                    const infernoDamage =
                        (42 + campaign.upgrades.power * 2) *
                        (hasSkill("apocalypse") ? 1.55 : 1);
                    createPowerEffect(
                        "fire",
                        target.x,
                        target.y,
                        "#fb7185",
                        infernoRadius,
                        0.7,
                    );
                    for (const nearby of actors) {
                        if (
                            nearby.alive &&
                            !nearby.isPlayer &&
                            nearby !== target &&
                            distanceBetween(target, nearby) < infernoRadius
                        ) {
                            applyDamage(
                                nearby,
                                infernoDamage,
                                attacker,
                            );
                        }
                    }
                }
            }
        }

        createBurst(
            target.x,
            target.y,
            target.color,
            18,
            target.isPlayer ? campaign.elementPath : target.element,
        );

        if (target.isPlayer) {
            finishCampaign();
        }
    }

    const ELEMENT_PARTICLE_KINDS = {
        fire: "ember",
        ice: "shard",
        storm: "spark",
        wind: "gust",
        psychic: "pulse",
        vampire: "droplet",
    };

    function createBurst(x, y, color, amount = 7, element = null) {
        const kind = ELEMENT_PARTICLE_KINDS[element] || "square";
        for (let index = 0; index < amount; index += 1) {
            const angle = randomBetween(0, Math.PI * 2);
            const speed = randomBetween(35, 150);
            const particle = {
                kind,
                x,
                y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                life: randomBetween(0.25, 0.7),
                maximumLife: 0.7,
                size: randomBetween(2, 5),
                color,
                spin: randomBetween(-4, 4),
                rotation: randomBetween(0, Math.PI * 2),
            };
            if (kind === "ember") {
                particle.velocityY -= randomBetween(20, 60);
                particle.life = randomBetween(0.35, 0.8);
                particle.maximumLife = 0.8;
            } else if (kind === "shard") {
                particle.size = randomBetween(3, 6);
            } else if (kind === "spark") {
                particle.life = randomBetween(0.12, 0.3);
                particle.maximumLife = 0.3;
                particle.velocityX *= 1.8;
                particle.velocityY *= 1.8;
            } else if (kind === "gust") {
                particle.originX = x;
                particle.originY = y;
                particle.life = randomBetween(0.3, 0.6);
                particle.maximumLife = 0.6;
            } else if (kind === "pulse") {
                particle.velocityX = 0;
                particle.velocityY = 0;
                particle.size = randomBetween(4, 9);
                particle.life = randomBetween(0.3, 0.5);
                particle.maximumLife = 0.5;
            } else if (kind === "droplet") {
                particle.velocityY = Math.abs(particle.velocityY) * 0.6;
            }
            pushParticle(particle);
        }
    }

    const WALK_DUST_TINTS = {
        forest: "#4e8064",
        badlands: "#9a6644",
        frost: "#dcecf7",
        ruins: "#77879a",
    };

    function spawnWalkDust(actor) {
        const step = Math.hypot(actor.lastStepX, actor.lastStepY);
        const backX = step > 0 ? -actor.lastStepX / step : 0;
        const backY = step > 0 ? -actor.lastStepY / step : 0;
        const inMud = actor.inMud;
        const color = inMud
            ? currentEnvironment.hazard
            : WALK_DUST_TINTS[currentEnvironment.id] || "#8b8f98";
        pushParticle({
            kind: "dust",
            x: actor.x + backX * actor.radius * 0.8 +
                randomBetween(-4, 4),
            y: actor.y + backY * actor.radius * 0.8 +
                randomBetween(-2, 6),
            velocityX: backX * randomBetween(14, 30) +
                randomBetween(-8, 8),
            velocityY: backY * randomBetween(14, 30) -
                randomBetween(2, 10),
            life: inMud ? randomBetween(0.3, 0.45) : randomBetween(0.35, 0.55),
            maximumLife: 0.55,
            size: inMud ? randomBetween(5, 8) : randomBetween(3, 6),
            color,
        });
    }

    function createPowerEffect(
        type,
        x,
        y,
        color,
        radius = 60,
        duration = 0.45,
    ) {
        powerEffects.push({
            type,
            x,
            y,
            color,
            radius,
            life: duration,
            maximumLife: duration,
            rotation: randomBetween(0, Math.PI * 2),
        });
    }

    function shoot(shooter, angle, spread = shooter.shotSpread) {
        if (!shooter.alive || shooter.cooldown > 0) {
            return;
        }

        const shotAngle = angle + randomBetween(-spread, spread);
        const muzzleDistance = shooter.radius + 9;
        const bulletSpeed = shooter.isPlayer ? 720 : 575;
        const bulletElement = shooter.isPlayer
            ? campaign.elementPath
            : shooter.element;
        const bulletElementLevel = shooter.isPlayer
            ? campaign.elementLevel
            : shooter.elementLevel;
        const snowballShot =
            shooter.isPlayer &&
            bulletElement === "ice" &&
            hasSkill("snowball");
        const magneticShot =
            shooter.isPlayer && bulletElement === "magnetic";

        bullets.push({
            x: shooter.x + Math.cos(shotAngle) * muzzleDistance,
            y: shooter.y + Math.sin(shotAngle) * muzzleDistance,
            velocityX: Math.cos(shotAngle) * bulletSpeed,
            velocityY: Math.sin(shotAngle) * bulletSpeed,
            owner: shooter,
            damage:
                shooter.shotDamage *
                (snowballShot ? 1.1 : 1) *
                (
                    shooter.weakenTimer > 0
                        ? shooter.weakenFactor
                        : 1
                ) *
                (
                    magneticShot
                        ? Math.min(1, 0.75 + 0.08 * countSkill("gen-magnetic-damage"))
                        : 1
                ),
            radius: snowballShot ? 6 : shooter.isPlayer ? 4 : 3.5,
            life: 1.55,
            element: bulletElement,
            homing: magneticShot,
            homingRange: 420 * (1 + 0.3 * countSkill("gen-magnetic-range")),
            homingTurnRate:
                3.2 * (1 + 0.25 * countSkill("gen-magnetic-turn")),
            elementLevel: bulletElementLevel,
            color: bulletElement
                ? (
                    shooter.isPlayer
                        ? ELEMENT_DEFINITIONS[bulletElement].color
                        : ENEMY_ELEMENTS[bulletElement].color
                )
                : shooter.isPlayer
                    ? SKINS[selectedSkin].bullet
                    : "#ff9cad",
        });

        shooter.attackAnimationTimer = 0.3;
        shooter.cooldown = (
            shooter.isPlayer
            ? shooter.fireDelay * (shooter.overdriveTimer > 0 ? 0.55 : 1)
            : randomBetween(
                roundSettings.botFireMinimum,
                roundSettings.botFireMaximum,
            ) * Math.max(0.72, 1 - shooter.elementLevel * 0.035)
        ) * (
            shooter.attackSlowTimer > 0
                ? shooter.attackSlowFactor
                : 1
        );
    }

    function updatePlayer(deltaTime) {
        if (!player.alive) {
            return;
        }

        let movementX = 0;
        let movementY = 0;

        if (keys.has("arrowleft") || keys.has("a") || keys.has("q")) {
            movementX -= 1;
        }
        if (keys.has("arrowright") || keys.has("d")) {
            movementX += 1;
        }
        if (keys.has("arrowup") || keys.has("w") || keys.has("z")) {
            movementY -= 1;
        }
        if (keys.has("arrowdown") || keys.has("s")) {
            movementY += 1;
        }

        const rawMovementLength = Math.hypot(movementX, movementY);
        const movementLength = rawMovementLength || 1;

        if (
            dashRequested
            && campaign.upgrades.dash > 0
            && player.dashCooldown <= 0
        ) {
            const dashX = rawMovementLength
                ? movementX / movementLength
                : Math.cos(player.angle);
            const dashY = rawMovementLength
                ? movementY / movementLength
                : Math.sin(player.angle);
            const dashDistance =
                165 *
                (1 + 0.2 * (campaign.upgrades.dash - 1)) *
                (hasSkill("blink") ? 1.35 : 1) *
                (hasSkill("tempest-step") ? 1.12 : 1) *
                (hasSkill("gale-dash") ? 1.18 : 1) *
                (hasSkill("mist-dash") ? 1.15 : 1) *
                (1 + 0.18 * countSkill("gen-dash-distance"));
            moveActor(player, dashX * dashDistance, dashY * dashDistance);
            const dashCooldownMultiplier =
                (hasSkill("fire-dash") ? 0.65 : 1) *
                (hasSkill("ice-step") ? 0.8 : 1) *
                (hasSkill("blink") ? 0.6 : 1) *
                (hasSkill("time-warp") ? 0.75 : 1) *
                (hasSkill("gale-dash") ? 0.68 : 1) *
                (hasSkill("mist-dash") ? 0.7 : 1) *
                (hasSkill("untouchable-sky") ? 0.72 : 1) *
                Math.pow(0.8, countSkill("gen-dash-cooldown"));
            player.dashCooldownMaximum = 5 * dashCooldownMultiplier;
            player.dashCooldown = player.dashCooldownMaximum;
            player.spawnShield = Math.max(player.spawnShield, 0.28);
            createBurst(player.x, player.y, player.color, 15, campaign.elementPath);
            createPowerEffect(
                campaign.elementPath || "storm",
                player.x,
                player.y,
                player.color,
                62,
                0.4,
            );

            if (hasSkill("tempest-step")) {
                player.overdriveTimer = Math.max(
                    player.overdriveTimer,
                    2,
                );
            }

            if (hasSkill("fire-dash")) {
                createBurst(player.x, player.y, "#fb7185", 22, "fire");
                const fireDashRadius = hasSkill("scorched-earth")
                    ? 155
                    : 95;
                createPowerEffect(
                    "fire",
                    player.x,
                    player.y,
                    "#fb7185",
                    fireDashRadius,
                    hasSkill("scorched-earth") ? 0.8 : 0.45,
                );
                for (const target of actors) {
                    if (
                        target.alive &&
                        !target.isPlayer &&
                        distanceBetween(player, target) < fireDashRadius
                    ) {
                        applyDamage(
                            target,
                            (
                                18 + campaign.upgrades.power * 2
                            ) * (
                                hasSkill("scorched-earth") ? 1.45 : 1
                            ),
                            player,
                        );
                        target.burnTimer = 2.5;
                        target.burnDamage = 7;
                        target.burnOwner = player;
                    }
                }
            }
        }
        dashRequested = false;

        const terrainMultiplier =
            getTerrainMultiplier(player) *
            (player.slowTimer > 0 ? player.slowFactor : 1);
        moveActor(
            player,
            (movementX / movementLength) *
                player.speed *
                terrainMultiplier *
                deltaTime,
            (movementY / movementLength) *
                player.speed *
                terrainMultiplier *
                deltaTime,
        );

        const mouseWorldX = camera.x + mouse.screenX / camera.zoom;
        const mouseWorldY = camera.y + mouse.screenY / camera.zoom;
        player.angle = Math.atan2(
            mouseWorldY - player.y,
            mouseWorldX - player.x,
        );

        if (mouse.down && campaign.upgrades.fullAuto > 0) {
            shoot(player, player.angle);
        }
    }

    function findClosestTarget(actor) {
        // Un zombie qui a vu le joueur le poursuit sans se laisser distraire
        // par les sorciers. Sans ce verrou il héritait de la pénalité de
        // ciblage ci-dessous et, avec 18 à 46 bots sur la carte, ne
        // choisissait jamais le joueur : la horde tournait hors écran en
        // chassant des bots, et le joueur ne croisait jamais un zombie.
        if (actor.isZombie) {
            if (player && player.alive) {
                const playerDistance = distanceBetween(actor, player);
                if (playerDistance <= ZOMBIE_AGGRO_RANGE) {
                    actor.huntingPlayer = true;
                } else if (playerDistance > ZOMBIE_AGGRO_RELEASE) {
                    actor.huntingPlayer = false;
                }
                if (actor.huntingPlayer) {
                    return { target: player, distance: playerDistance };
                }
            } else {
                actor.huntingPlayer = false;
            }
        }

        let closest = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        let closestScore = Number.POSITIVE_INFINITY;

        for (const candidate of actors) {
            if (
                !candidate.alive ||
                candidate === actor ||
                (actor.isZombie && candidate.isZombie)
            ) {
                continue;
            }

            const distance = distanceBetween(actor, candidate);
            // Les bots privilégient légèrement les autres bots afin que le
            // joueur ne reçoive pas tous les tirs en même temps. Les zombies
            // ne tirent pas : cette pénalité n'a pas de sens pour eux, et
            // les éloignait systématiquement du joueur.
            const score =
                candidate.isPlayer && !actor.isZombie
                    ? distance * 1.7
                    : distance;
            if (score < closestScore) {
                closest = candidate;
                closestDistance = distance;
                closestScore = score;
            }
        }

        return { target: closest, distance: closestDistance };
    }

    function getBotTarget(bot, deltaTime) {
        bot.aiTargetRefresh = Math.max(
            0,
            bot.aiTargetRefresh - deltaTime,
        );
        if (
            !bot.aiTarget ||
            !bot.aiTarget.alive ||
            bot.aiTarget === bot ||
            bot.aiTargetRefresh <= 0
        ) {
            const closest = findClosestTarget(bot);
            bot.aiTarget = closest.target;
            bot.aiTargetRefresh = randomBetween(0.12, 0.2);
            return {
                target: closest.target,
                distance: closest.distance,
                refreshed: true,
            };
        }

        return {
            target: bot.aiTarget,
            distance: distanceBetween(bot, bot.aiTarget),
            refreshed: false,
        };
    }

    const WAYPOINT_ARRIVAL_RADIUS = 60;

    function resolveActorRoom(actor) {
        const room = window.BattleRoyaleMap.findRoomAt(
            arenaLayout,
            actor.x,
            actor.y,
        );
        if (room) {
            actor.lastRoomId = room.id;
            return room.id;
        }
        return actor.lastRoomId;
    }

    function clearActorRoute(actor) {
        actor.routeKey = null;
        actor.routePath = null;
        actor.routeIndex = 0;
    }

    // Le trajet est mémorisé sur le bot : sans index persistant, le point de
    // passage le plus proche redevient la porte que le bot vient de franchir
    // et celui-ci fait demi-tour à chaque image. L'index n'avance jamais à
    // reculons, et le chemin n'est recalculé qu'au changement d'itinéraire ou
    // sur la cadence aiTargetRefresh.
    function getBotRouteDirection(bot, targetX, targetY, allowRepath) {
        if (!arenaLayout) {
            return null;
        }
        const fromRoomId = resolveActorRoom(bot);
        const targetRoom = window.BattleRoyaleMap.findRoomAt(
            arenaLayout,
            targetX,
            targetY,
        );
        if (
            fromRoomId === null ||
            !targetRoom ||
            targetRoom.id === fromRoomId
        ) {
            clearActorRoute(bot);
            return null;
        }

        const routeKey = `${fromRoomId}>${targetRoom.id}`;
        if (routeKey !== bot.routeKey) {
            bot.routeKey = routeKey;
            bot.routePath = window.BattleRoyaleMap.findPath(
                arenaLayout.graph,
                `room-${fromRoomId}`,
                `room-${targetRoom.id}`,
            );
            bot.routeIndex = 0;
        } else if (allowRepath || !bot.routePath) {
            bot.routePath = window.BattleRoyaleMap.findPath(
                arenaLayout.graph,
                `room-${fromRoomId}`,
                `room-${targetRoom.id}`,
            );
        }

        const path = bot.routePath;
        if (!path || path.length === 0) {
            return null;
        }

        let index = Math.min(bot.routeIndex, path.length - 1);
        while (
            index < path.length - 1 &&
            Math.hypot(path[index].x - bot.x, path[index].y - bot.y) <
                WAYPOINT_ARRIVAL_RADIUS
        ) {
            index += 1;
        }
        bot.routeIndex = index;

        const waypoint = path[index];
        const deltaX = waypoint.x - bot.x;
        const deltaY = waypoint.y - bot.y;
        const length = Math.hypot(deltaX, deltaY);
        if (length < 1) {
            return null;
        }
        return { x: deltaX / length, y: deltaY / length };
    }

    function updateZombieSpawns(deltaTime) {
        const target = getZombiePopulationTarget();
        if (target <= 0) {
            return;
        }
        const alive = actors.filter(
            (actor) => actor.alive && actor.isZombie,
        ).length;
        if (alive >= target) {
            return;
        }
        zombieRespawnTimer -= deltaTime;
        if (zombieRespawnTimer > 0) {
            return;
        }
        zombieRespawnTimer = ZOMBIE_RESPAWN_DELAY;
        spawnZombie();
    }

    function updateBots(deltaTime) {
        for (const bot of actors) {
            if (!bot.alive || bot.isPlayer) {
                continue;
            }

            const zoneDistance = Math.hypot(bot.x - zone.x, bot.y - zone.y);
            const isFleeingZone = zoneDistance > zone.radius - 65;
            const { target, distance, refreshed } = getBotTarget(
                bot,
                deltaTime,
            );
            let movementX = 0;
            let movementY = 0;

            if (isFleeingZone) {
                const angleToCenter = Math.atan2(
                    zone.y - bot.y,
                    zone.x - bot.x,
                );
                movementX = Math.cos(angleToCenter);
                movementY = Math.sin(angleToCenter);
            } else if (target) {
                const targetAngle = Math.atan2(
                    target.y - bot.y,
                    target.x - bot.x,
                );
                bot.angle = targetAngle;

                if (
                    bot.trait === "assassin" &&
                    bot.dashCooldown <= 0 &&
                    distance > 145 &&
                    distance < 430
                ) {
                    const dashDistance = 95 + bot.elementLevel * 12;
                    moveActor(
                        bot,
                        Math.cos(targetAngle) * dashDistance,
                        Math.sin(targetAngle) * dashDistance,
                    );
                    bot.dashCooldown = Math.max(
                        4.5,
                        8.5 - bot.elementLevel * 0.45,
                    );
                    createPowerEffect(
                        "storm",
                        bot.x,
                        bot.y,
                        ENEMY_TRAITS.assassin.color,
                        62,
                        0.35,
                    );
                }

                if (distance > 255 || bot.isZombie) {
                    movementX = Math.cos(targetAngle);
                    movementY = Math.sin(targetAngle);
                } else if (distance < 125) {
                    movementX = -Math.cos(targetAngle);
                    movementY = -Math.sin(targetAngle);
                } else {
                    const strafeDirection =
                        Math.sin(elapsed * 1.7 + bot.aiSeed) > 0 ? 1 : -1;
                    movementX = Math.cos(targetAngle + strafeDirection * 1.4);
                    movementY = Math.sin(targetAngle + strafeDirection * 1.4);
                }

                if (distance < 520 && !bot.isZombie) {
                    shoot(bot, targetAngle);
                }
            }

            const movementMultiplier =
                (bot.slowTimer > 0 ? bot.slowFactor : 1) *
                getTerrainMultiplier(bot);
            // La fuite garde sa destination, mais elle emprunte les portes au
            // lieu de foncer dans les murs : la poursuite ne prend jamais le
            // pas sur la fuite.
            let route = null;
            if (isFleeingZone) {
                route = getBotRouteDirection(
                    bot,
                    zone.x,
                    zone.y,
                    refreshed,
                );
            } else if (bot.aiTarget) {
                route = getBotRouteDirection(
                    bot,
                    bot.aiTarget.x,
                    bot.aiTarget.y,
                    refreshed,
                );
            } else {
                clearActorRoute(bot);
            }
            const avoidedMovement = avoidObstacle(
                bot,
                route ? route.x : movementX,
                route ? route.y : movementY,
            );
            moveActor(
                bot,
                avoidedMovement.x * bot.speed * movementMultiplier * deltaTime,
                avoidedMovement.y * bot.speed * movementMultiplier * deltaTime,
            );

            if (bot.isZombie) {
                bot.contactCooldown = Math.max(
                    0,
                    bot.contactCooldown - deltaTime,
                );
                if (bot.contactCooldown <= 0) {
                    for (const target of actors) {
                        if (
                            !target.alive ||
                            target.isZombie ||
                            distanceBetween(bot, target) >
                                bot.radius + target.radius + 6
                        ) {
                            continue;
                        }
                        applyDamage(
                            target,
                            ZOMBIE_CONTACT_DAMAGE,
                            bot,
                        );
                        bot.contactCooldown = ZOMBIE_CONTACT_INTERVAL;
                        break;
                    }
                }
            }
        }
    }

    function getTerrainMultiplier(actor) {
        if (actor.isPlayer && hasSkill("ice-step")) {
            return 1;
        }

        const terrainHazard = visitNearbyObstacles(
            actor,
            actor.radius,
            (obstacle) => {
                if (
                    obstacle.type === "mud" &&
                    pointInsideObstacle(actor, obstacle)
                ) {
                    actor.inMud = true;
                    return obstacle;
                }
                return null;
            },
        );
        const blizzard = featureContaining(actor, "blizzard");
        return Math.min(
            terrainHazard ? terrainHazard.slowFactor : 1,
            blizzard ? blizzard.slowFactor : 1,
        );
    }

    function avoidObstacle(actor, movementX, movementY) {
        if (movementX === 0 && movementY === 0) {
            return { x: 0, y: 0 };
        }

        const length = Math.hypot(movementX, movementY) || 1;
        const normalX = movementX / length;
        const normalY = movementY / length;
        const probe = {
            x: actor.x + normalX * (actor.radius + 48),
            y: actor.y + normalY * (actor.radius + 48),
        };

        if (!pointBlocked(probe, actor.radius + 5)) {
            return { x: normalX, y: normalY };
        }

        const direction =
            Math.sin(actor.aiSeed + elapsed * 0.8) >= 0 ? 1 : -1;
        return {
            x: -normalY * direction,
            y: normalX * direction,
        };
    }

    function resolveActorObstacles(actor) {
        visitNearbyObstacles(actor, actor.radius, (obstacle) => {
            if (!obstacle.alive || !obstacle.solid) {
                return null;
            }

            if (obstacle.shape === "circle") {
                const deltaX = actor.x - obstacle.x;
                const deltaY = actor.y - obstacle.y;
                const distance = Math.hypot(deltaX, deltaY);
                const minimumDistance = actor.radius + obstacle.radius;

                if (distance < minimumDistance) {
                    const safeDistance = distance || 0.001;
                    const overlap = minimumDistance - safeDistance;
                    const normalX = distance ? deltaX / safeDistance : 1;
                    const normalY = distance ? deltaY / safeDistance : 0;
                    actor.x += normalX * overlap;
                    actor.y += normalY * overlap;
                }
                return null;
            }

            const left = obstacle.x - obstacle.width / 2;
            const right = obstacle.x + obstacle.width / 2;
            const top = obstacle.y - obstacle.height / 2;
            const bottom = obstacle.y + obstacle.height / 2;
            const nearestX = clamp(actor.x, left, right);
            const nearestY = clamp(actor.y, top, bottom);
            const deltaX = actor.x - nearestX;
            const deltaY = actor.y - nearestY;
            const distance = Math.hypot(deltaX, deltaY);

            if (distance > 0 && distance < actor.radius) {
                const overlap = actor.radius - distance;
                actor.x += (deltaX / distance) * overlap;
                actor.y += (deltaY / distance) * overlap;
            } else if (
                actor.x > left - actor.radius &&
                actor.x < right + actor.radius &&
                actor.y > top - actor.radius &&
                actor.y < bottom + actor.radius
            ) {
                const exits = [
                    { value: Math.abs(actor.x - (left - actor.radius)), axis: "x", target: left - actor.radius },
                    { value: Math.abs(actor.x - (right + actor.radius)), axis: "x", target: right + actor.radius },
                    { value: Math.abs(actor.y - (top - actor.radius)), axis: "y", target: top - actor.radius },
                    { value: Math.abs(actor.y - (bottom + actor.radius)), axis: "y", target: bottom + actor.radius },
                ].sort((first, second) => first.value - second.value);
                actor[exits[0].axis] = exits[0].target;
            }
            return null;
        });
    }

    function moveActor(actor, deltaX, deltaY) {
        const startX = actor.x;
        const startY = actor.y;
        const steps = Math.max(
            1,
            Math.ceil(Math.hypot(deltaX, deltaY) / 14),
        );

        for (let step = 0; step < steps; step += 1) {
            actor.x += deltaX / steps;
            resolveActorObstacles(actor);
            actor.y += deltaY / steps;
            resolveActorObstacles(actor);
            keepInsideWorld(actor);
        }
        const stepX = actor.x - startX;
        const stepY = actor.y - startY;
        actor.lastStepX = stepX;
        actor.lastStepY = stepY;
        actor.movementDistance += Math.hypot(stepX, stepY);
    }

    function keepInsideWorld(actor) {
        actor.x = clamp(actor.x, actor.radius, WORLD_WIDTH - actor.radius);
        actor.y = clamp(actor.y, actor.radius, WORLD_HEIGHT - actor.radius);
    }

    function damageObstacle(obstacle, damage) {
        if (!obstacle.destructible || !obstacle.alive) {
            return;
        }

        obstacle.health -= damage;
        createBurst(
            obstacle.x,
            obstacle.y,
            obstacle.health > 0 ? "#94a3b8" : "#fbbf24",
            obstacle.health > 0 ? 4 : 22,
        );

        if (obstacle.health <= 0) {
            obstacle.alive = false;
        }
    }

    function findBulletObstacle(bullet) {
        return visitNearbyObstacles(
            bullet,
            bullet.radius,
            (obstacle) => {
                if (
                    obstacle.alive &&
                    obstacle.solid &&
                    pointInsideObstacle(bullet, obstacle, bullet.radius)
                ) {
                    return obstacle;
                }
                return null;
            },
        );
    }

    let magneticStormTimer = 0;

    function steerHomingBullet(bullet, deltaTime) {
        let closest = null;
        let closestDistance = bullet.homingRange;
        for (const target of actors) {
            if (!target.alive || target === bullet.owner) {
                continue;
            }
            const distance = Math.hypot(
                target.x - bullet.x,
                target.y - bullet.y,
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = target;
            }
        }
        if (!closest) {
            return;
        }

        const speed = Math.hypot(bullet.velocityX, bullet.velocityY);
        if (speed <= 0) {
            return;
        }
        const currentAngle = Math.atan2(bullet.velocityY, bullet.velocityX);
        const desiredAngle = Math.atan2(
            closest.y - bullet.y,
            closest.x - bullet.x,
        );
        let difference = desiredAngle - currentAngle;
        while (difference > Math.PI) {
            difference -= Math.PI * 2;
        }
        while (difference < -Math.PI) {
            difference += Math.PI * 2;
        }
        const turnRate =
            bullet.homingTurnRate * (magneticStormTimer > 0 ? 2 : 1);
        const maximumTurn = turnRate * deltaTime;
        const applied = clamp(difference, -maximumTurn, maximumTurn);
        const newAngle = currentAngle + applied;
        bullet.velocityX = Math.cos(newAngle) * speed;
        bullet.velocityY = Math.sin(newAngle) * speed;
    }

    function updateBullets(deltaTime) {
        for (const bullet of bullets) {
            if (bullet.homing) {
                steerHomingBullet(bullet, deltaTime);
            }
            bullet.x += bullet.velocityX * deltaTime;
            bullet.y += bullet.velocityY * deltaTime;
            bullet.life -= deltaTime;

            if (
                bullet.x < 0 ||
                bullet.x > WORLD_WIDTH ||
                bullet.y < 0 ||
                bullet.y > WORLD_HEIGHT
            ) {
                bullet.life = 0;
                continue;
            }

            const hitObstacle = findBulletObstacle(bullet);
            if (hitObstacle) {
                bullet.life = 0;
                damageObstacle(hitObstacle, bullet.damage);
                createBurst(bullet.x, bullet.y, "#cbd5e1", 5);
                continue;
            }

            for (const target of actors) {
                if (
                    !target.alive ||
                    target === bullet.owner ||
                    bullet.life <= 0
                ) {
                    continue;
                }

                if (
                    distanceBetween(bullet, target) <
                    bullet.radius + target.radius
                ) {
                    bullet.life = 0;
                    createBurst(bullet.x, bullet.y, bullet.color, 7, bullet.element);
                    let directDamage = bullet.damage;
                    if (
                        bullet.owner.isPlayer &&
                        hasSkill("combustion") &&
                        target.burnTimer > 0
                    ) {
                        directDamage *= 1.25;
                    }
                    if (
                        bullet.owner.isPlayer &&
                        hasSkill("shatter") &&
                        target.slowTimer > 0
                    ) {
                        directDamage *= 1.25;
                    }
                    if (
                        bullet.owner.isPlayer &&
                        hasSkill("executioner") &&
                        target.health / target.maxHealth <= 0.35
                    ) {
                        directDamage *= 1.35;
                    }
                    if (
                        bullet.owner.isPlayer &&
                        hasSkill("neural-overload") &&
                        target.weakenTimer > 0
                    ) {
                        directDamage *= 1.25;
                    }
                    if (
                        bullet.owner.isPlayer &&
                        hasSkill("crimson-execution") &&
                        target.health / target.maxHealth <= 0.35
                    ) {
                        directDamage *= 1.3;
                    }
                    if (
                        bullet.owner.isPlayer &&
                        bullet.element === "wind" &&
                        hasSkill("tempest-lord")
                    ) {
                        directDamage *= 1.25;
                    }
                    const overloadChance = bullet.owner.isPlayer
                        ? (hasSkill("overload") ? 0.2 : 0) +
                            (hasSkill("ionization") ? 0.1 : 0)
                        : 0;
                    if (
                        overloadChance > 0 &&
                        Math.random() < overloadChance
                    ) {
                        directDamage *= 1.8;
                        createBurst(target.x, target.y, "#e9d5ff", 14);
                        createPowerEffect(
                            "storm",
                            target.x,
                            target.y,
                            "#e9d5ff",
                            82,
                            0.5,
                        );
                    }
                    applyElementalHit(target, bullet);
                    const damageDealt = applyDamage(
                        target,
                        directDamage,
                        bullet.owner,
                    );
                    if (
                        bullet.owner.isPlayer &&
                        bullet.element === "vampire" &&
                        damageDealt > 0
                    ) {
                        const stealRatio =
                            hasSkill("ancient-vampire")
                                ? 0.28
                                : hasSkill("bloodthirst")
                                    ? 0.2
                                    : 0.12;
                        healPlayer(
                            damageDealt * stealRatio,
                            hasSkill("coagulation"),
                        );
                        energyArcs.push({
                            x1: target.x,
                            y1: target.y,
                            x2: player.x,
                            y2: player.y,
                            color: "#f43f5e",
                            life: 0.28,
                            maximumLife: 0.28,
                        });
                        if (hasSkill("bat-swarm")) {
                            const nearbyVictims = actors
                                .filter(
                                    (nearby) =>
                                        nearby.alive &&
                                        !nearby.isPlayer &&
                                        nearby !== target &&
                                        distanceBetween(target, nearby) < 125,
                                )
                                .slice(0, 3);
                            for (const nearby of nearbyVictims) {
                                const swarmDamage = applyDamage(
                                    nearby,
                                    directDamage * 0.18,
                                    bullet.owner,
                                );
                                healPlayer(
                                    swarmDamage * stealRatio,
                                    hasSkill("coagulation"),
                                );
                                energyArcs.push({
                                    x1: nearby.x,
                                    y1: nearby.y,
                                    x2: player.x,
                                    y2: player.y,
                                    color: "#fb7185",
                                    life: 0.24,
                                    maximumLife: 0.24,
                                });
                            }
                        }
                    }
                    if (
                        !bullet.owner.isPlayer &&
                        bullet.owner.trait === "vampire" &&
                        damageDealt > 0
                    ) {
                        bullet.owner.health = Math.min(
                            bullet.owner.maxHealth,
                            bullet.owner.health + damageDealt * 0.18,
                        );
                    }
                }
            }

            if (bullet.life > 0 && bullet.owner.isPlayer) {
                for (const crate of supplyCrates) {
                    if (
                        crate.alive &&
                        distanceBetween(bullet, crate) <
                            bullet.radius + crate.radius
                    ) {
                        bullet.life = 0;
                        crate.health -= bullet.damage;
                        createBurst(bullet.x, bullet.y, "#fbbf24", 5);
                        if (crate.health <= 0) {
                            destroyCrate(crate);
                        }
                        break;
                    }
                }
            }
        }

        bullets = bullets.filter((bullet) => bullet.life > 0);
    }

    function updateActorEffects(deltaTime) {
        for (const actor of actors) {
            if (!actor.alive) {
                continue;
            }

            actor.slowTimer = Math.max(0, actor.slowTimer - deltaTime);
            actor.attackSlowTimer = Math.max(
                0,
                actor.attackSlowTimer - deltaTime,
            );
            actor.weakenTimer = Math.max(
                0,
                actor.weakenTimer - deltaTime,
            );
            if (actor.attackSlowTimer === 0) {
                actor.attackSlowFactor = 1;
            }
            if (actor.weakenTimer === 0) {
                actor.weakenFactor = 1;
            }
            actor.overdriveTimer = Math.max(
                0,
                actor.overdriveTimer - deltaTime,
            );
            actor.dashCooldown = Math.max(
                0,
                actor.dashCooldown - deltaTime,
            );
            actor.teleportCooldown = Math.max(
                0,
                actor.teleportCooldown - deltaTime,
            );
            actor.featureFxCooldown = Math.max(
                0,
                actor.featureFxCooldown - deltaTime,
            );
            actor.attackAnimationTimer = Math.max(
                0,
                actor.attackAnimationTimer - deltaTime,
            );
            actor.isMoving = actor.movementDistance > 0.25;
            if (actor.isPlayer && actor.isMoving) {
                actor.walkDustCarry += actor.movementDistance;
                if (actor.walkDustCarry >= 14) {
                    actor.walkDustCarry = 0;
                    spawnWalkDust(actor);
                }
            }
            if (actor.isMoving) {
                actor.animationClock += deltaTime * (
                    actor.isPlayer ? 8.5 : 7
                );
            }
            actor.lastHitTimer += deltaTime;

            if (
                actor.isPlayer &&
                hasSkill("glacial-fortress") &&
                actor.lastHitTimer >= 3 &&
                actor.shield < actor.maxShield
            ) {
                actor.shield = Math.min(
                    actor.maxShield,
                    actor.shield + 6 * deltaTime,
                );
            }
            if (
                !actor.isPlayer &&
                actor.trait === "guardian" &&
                actor.lastHitTimer >= 4 &&
                actor.shield < actor.maxShield
            ) {
                actor.shield = Math.min(
                    actor.maxShield,
                    actor.shield + (2 + actor.elementLevel * 0.45) * deltaTime,
                );
            }

            if (actor.isPlayer && hasSkill("whiteout")) {
                for (const enemy of actors) {
                    if (
                        enemy.alive &&
                        !enemy.isPlayer &&
                        distanceBetween(actor, enemy) < 175
                    ) {
                        enemy.slowTimer = Math.max(enemy.slowTimer, 0.25);
                        enemy.slowFactor = Math.min(enemy.slowFactor, 0.72);
                    }
                }
            }
            if (
                actor.isPlayer &&
                hasSkill("dark-regeneration") &&
                actor.health / actor.maxHealth <= 0.45
            ) {
                healPlayer(3.2 * deltaTime);
            }
            if (actor.isPlayer && hasSkill("collective-collapse")) {
                for (const enemy of actors) {
                    if (
                        enemy.alive &&
                        !enemy.isPlayer &&
                        distanceBetween(actor, enemy) < 190
                    ) {
                        enemy.weakenTimer = Math.max(
                            enemy.weakenTimer,
                            0.3,
                        );
                        enemy.weakenFactor = Math.min(
                            enemy.weakenFactor,
                            0.72,
                        );
                    }
                }
            }

            if (actor.burnTimer > 0) {
                actor.burnTimer = Math.max(0, actor.burnTimer - deltaTime);
                if (actor.featureFxCooldown <= 0) {
                    createBurst(actor.x, actor.y, "#fb7185", 3, "fire");
                    actor.featureFxCooldown = 0.28;
                }
                applyDamage(
                    actor,
                    actor.burnDamage * deltaTime,
                    actor.burnOwner,
                    { ignoreSpawnShield: true, dot: true },
                );
                if (actor.burnTimer === 0) {
                    actor.burnOwner = null;
                }
            }
        }
    }

    function featureContaining(actor, featureType = null) {
        return mapFeatures.find(
            (feature) =>
                (!featureType || feature.type === featureType) &&
                distanceBetween(actor, feature) <
                    actor.radius + feature.radius,
        );
    }

    function stormFieldIsActive(feature) {
        return Math.sin(elapsed * 2.4 + feature.phase) > 0.1;
    }

    function updateMapFeatures(deltaTime) {
        for (const actor of actors) {
            if (!actor.alive) {
                continue;
            }

            if (currentEnvironment.id === "forest") {
                const grove = featureContaining(actor, "healing-grove");
                if (grove && actor.health < actor.maxHealth) {
                    actor.health = Math.min(
                        actor.maxHealth,
                        actor.health +
                            (2.2 + campaign.round * 0.08) * deltaTime,
                    );
                    if (actor.featureFxCooldown <= 0) {
                        createBurst(actor.x, actor.y, "#6ee7b7", 3);
                        actor.featureFxCooldown = 0.7;
                    }
                }
            } else if (currentEnvironment.id === "badlands") {
                const portal = featureContaining(actor, "portal");
                if (portal && actor.teleportCooldown <= 0) {
                    const destination = mapFeatures.find(
                        (feature) =>
                            feature.type === "portal" &&
                            feature.pair === portal.pair &&
                            feature.side !== portal.side,
                    );
                    if (destination) {
                        createPowerEffect(
                            "storm",
                            actor.x,
                            actor.y,
                            "#fb923c",
                            72,
                            0.45,
                        );
                        actor.x = destination.x;
                        actor.y = destination.y;
                        actor.teleportCooldown = 3;
                        createPowerEffect(
                            "storm",
                            actor.x,
                            actor.y,
                            "#fde68a",
                            85,
                            0.55,
                        );
                        if (actor.isPlayer) {
                            statusElement.textContent =
                                "Téléportation instantanée à travers le canyon.";
                        }
                    }
                }
            } else if (currentEnvironment.id === "ruins") {
                const field = featureContaining(actor, "storm-field");
                if (field && stormFieldIsActive(field)) {
                    applyDamage(
                        actor,
                        (4.2 + campaign.round * 0.18) * deltaTime,
                        null,
                        { ignoreSpawnShield: true },
                    );
                    if (actor.featureFxCooldown <= 0) {
                        createBurst(actor.x, actor.y, "#fbbf24", 4, "storm");
                        actor.featureFxCooldown = 0.38;
                    }
                }
            }
        }
    }

    function collectPickup(pickup) {
        const lootMultiplier = 1 + campaign.upgrades.scavenger * 0.15;
        const investorCrateMultiplier =
            1 + 0.4 * countSkill("gen-investor-crates");
        if (pickup.type === "health") {
            const healing = Math.round(35 * lootMultiplier);
            player.health = Math.min(
                player.maxHealth,
                player.health + healing,
            );
            statusElement.textContent =
                `Kit de soin récupéré : +${healing} santé.`;
        } else if (pickup.type === "shield") {
            const shielding = Math.round(30 * lootMultiplier);
            player.shield = Math.min(
                player.maxShield,
                player.shield + shielding,
            );
            statusElement.textContent =
                `Bouclier récupéré : +${shielding}.`;
        } else if (pickup.type === "credits") {
            awardPoints(
                (5 + campaign.round) * lootMultiplier *
                    investorCrateMultiplier,
                "Cache de points récupérée.",
            );
        } else if (pickup.type === "overdrive") {
            const duration = Math.round(9 * lootMultiplier);
            player.overdriveTimer = Math.max(
                player.overdriveTimer,
                duration,
            );
            statusElement.textContent =
                `Surcharge : cadence doublée pendant ${duration} s.`;
        }

        createBurst(pickup.x, pickup.y, pickup.color, 12);
        pickup.life = 0;
    }

    function updatePickups(deltaTime) {
        for (const pickup of pickups) {
            pickup.life -= deltaTime;
            pickup.phase += deltaTime * 3;

            if (
                pickup.life > 0 &&
                player.alive &&
                distanceBetween(player, pickup) <
                    player.radius + pickup.radius + 5
            ) {
                collectPickup(pickup);
            }
        }

        pickups = pickups.filter((pickup) => pickup.life > 0);
    }

    function pushParticle(particle) {
        if (particles.length >= MAX_PARTICLES) {
            particles.shift();
        }
        particles.push(particle);
    }

    function updateParticles(deltaTime) {
        for (const particle of particles) {
            particle.x += particle.velocityX * deltaTime;
            particle.y += particle.velocityY * deltaTime;
            particle.velocityX *= 0.96;
            particle.velocityY *= 0.96;
            if (particle.kind === "dust") {
                particle.size = Math.max(
                    0.6,
                    particle.size - deltaTime * 5,
                );
            } else if (particle.kind === "ember") {
                particle.velocityY -= 55 * deltaTime;
            } else if (particle.kind === "shard") {
                particle.velocityY += 150 * deltaTime;
                particle.rotation += particle.spin * deltaTime;
            } else if (particle.kind === "spark") {
                particle.velocityX += randomBetween(-260, 260) * deltaTime;
                particle.velocityY += randomBetween(-260, 260) * deltaTime;
            } else if (particle.kind === "gust") {
                const offsetX = particle.x - particle.originX;
                const offsetY = particle.y - particle.originY;
                particle.velocityX += -offsetY * 6 * deltaTime;
                particle.velocityY += offsetX * 6 * deltaTime;
            } else if (particle.kind === "pulse") {
                particle.size += 46 * deltaTime;
            } else if (particle.kind === "droplet") {
                particle.velocityY += 240 * deltaTime;
            }
            particle.life -= deltaTime;
        }

        particles = particles.filter((particle) => particle.life > 0);

        for (const arc of energyArcs) {
            arc.life -= deltaTime;
        }
        energyArcs = energyArcs.filter((arc) => arc.life > 0);

        for (const effect of powerEffects) {
            effect.life -= deltaTime;
            effect.rotation += deltaTime * 2.4;
        }
        powerEffects = powerEffects.filter((effect) => effect.life > 0);
    }

    function updateZone(deltaTime) {
        const progress = clamp(elapsed / roundSettings.duration, 0, 1);
        const easedProgress = progress * progress * (3 - 2 * progress);
        zone.radius =
            START_ZONE_RADIUS +
            (END_ZONE_RADIUS - START_ZONE_RADIUS) * easedProgress;
        const phaseDuration = roundSettings.duration / 5;
        const phase = Math.min(5, Math.floor(elapsed / phaseDuration) + 1);
        const damagePerSecond =
            roundSettings.zoneDamage + phase * 2.25;

        for (const actor of actors) {
            if (!actor.alive) {
                continue;
            }

            const distanceFromCenter = Math.hypot(
                actor.x - zone.x,
                actor.y - zone.y,
            );

            if (distanceFromCenter > zone.radius) {
                applyDamage(
                    actor,
                    damagePerSecond * deltaTime,
                    null,
                    { bypassShield: true, ignoreSpawnShield: true },
                );
            }
        }
    }

    function updateCamera() {
        const focus = player || { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
        const visionLevel = campaign.upgrades.vision || 0;
        camera.zoom = CAMERA_ZOOM_LEVELS[visionLevel];
        const visibleWidth = VIEW_WIDTH / camera.zoom;
        const visibleHeight = VIEW_HEIGHT / camera.zoom;
        camera.x = clamp(
            focus.x - visibleWidth / 2,
            0,
            WORLD_WIDTH - visibleWidth,
        );
        camera.y = clamp(
            focus.y - visibleHeight / 2,
            0,
            WORLD_HEIGHT - visibleHeight,
        );
    }

    function updateHud() {
        if (!player) {
            return;
        }

        const survivors = countSurvivors();
        const health = Math.max(0, Math.ceil(player.health));
        const healthPercentage = clamp(
            (player.health / player.maxHealth) * 100,
            0,
            100,
        );
        const remainingTime = Math.max(
            0,
            Math.ceil(roundSettings.duration - elapsed),
        );
        const activeFireDelay = Math.max(
            0.04,
            player.fireDelay * (player.overdriveTimer > 0 ? 0.55 : 1),
        );
        const theoreticalDps = Math.max(
            0,
            Math.round(player.shotDamage / activeFireDelay),
        );

        roundElement.textContent = String(campaign.round);
        pointsElement.textContent = String(campaign.points);
        playersLeftElement.textContent = String(survivors);
        healthElement.textContent = `${health} / ${player.maxHealth}`;
        compactDpsElement.textContent = String(theoreticalDps);
        compactHealthElement.textContent =
            `${health}/${player.maxHealth}`;
        compactShieldElement.textContent =
            String(Math.max(0, Math.ceil(player.shield)));
        healthFill.style.width = `${healthPercentage}%`;
        healthFill.classList.toggle("danger", healthPercentage <= 35);
        topHealthValue.textContent = `${health} / ${player.maxHealth}`;
        topHealthFill.style.width = `${healthPercentage}%`;
        topHealthFill.classList.toggle("danger", healthPercentage <= 35);
        killCountElement.textContent = String(campaign.totalKills);
        zoneTimerElement.textContent = `${remainingTime} s`;

        if (campaign.elementPath) {
            const definition = ELEMENT_DEFINITIONS[campaign.elementPath];
            buildStatusElement.textContent =
                `${definition.avatar} ${definition.avatarName} · ` +
                `${campaign.skillNodes.length} ` +
                `${campaign.skillNodes.length > 1 ? "talents" : "talent"}`;
            buildStatusElement.style.color = definition.color;
        } else {
            buildStatusElement.textContent = "Arme standard";
            buildStatusElement.style.color = "";
        }
        buildStatusElement.textContent += campaign.upgrades.fullAuto > 0
            ? " · Automatique"
            : " · Semi-auto";
        if (campaign.upgrades.dash > 0) {
            buildStatusElement.textContent += " · Dash";
        }
        if (player.overdriveTimer > 0) {
            buildStatusElement.textContent +=
                ` · Surcharge ${Math.ceil(player.overdriveTimer)} s`;
        }
        shieldStatusElement.textContent =
            `Bouclier ${Math.ceil(player.shield)}`;
        dashStatusElement.textContent = campaign.upgrades.dash <= 0
            ? "Dash verrouillé · perk 100 pts"
            : player.dashCooldown <= 0
                ? `Dash ${campaign.upgrades.dash}/3 prêt`
                : `Dash ${campaign.upgrades.dash}/3 · ` +
                    `${player.dashCooldown.toFixed(1)} s`;
        const ability = getSpecialAbilityDefinition();
        const abilityPercentage = ability
            ? clamp(
                (player.specialCharge / (ability.maxCharge / getUltimateChargeMultiplier())) * 100,
                0,
                100,
            )
            : 0;
        topUltimateFill.style.width = `${abilityPercentage}%`;
        topUltimateFill.style.background = ability
            ? ability.color
            : "";
        topUltimateValue.textContent = !ability
            ? "Verrouillée"
            : abilityPercentage >= 100
                ? "Prête · E"
                : `${Math.floor(abilityPercentage)} %`;
        const dashMaximum = Math.max(
            0.01,
            player.dashCooldownMaximum || 5,
        );
        const dashPercentage = campaign.upgrades.dash <= 0
            ? 0
            : clamp(
                (1 - player.dashCooldown / dashMaximum) * 100,
                0,
                100,
            );
        topDashFill.style.width = `${dashPercentage}%`;
        topDashValue.textContent = campaign.upgrades.dash <= 0
            ? "Verrouillé"
            : player.dashCooldown <= 0
                ? "Prêt"
                : `${player.dashCooldown.toFixed(1)} s`;
        abilityStatusElement.classList.toggle(
            "ready",
            Boolean(
                ability &&
                player.specialCharge >= ability.maxCharge / getUltimateChargeMultiplier(),
            ),
        );
        if (!ability) {
            abilityStatusElement.textContent =
                "E · capacité au palier 3";
            abilityStatusElement.style.color = "";
        } else if (player.specialCharge >= ability.maxCharge / getUltimateChargeMultiplier()) {
            abilityStatusElement.textContent =
                `E · ${ability.name} prête`;
            abilityStatusElement.style.color = ability.color;
        } else {
            const percentage = Math.floor(
                (player.specialCharge / (ability.maxCharge / getUltimateChargeMultiplier())) * 100,
            );
            abilityStatusElement.textContent =
                `E · ${ability.name} ${percentage} %`;
            abilityStatusElement.style.color = ability.color;
        }
        const activeFeature = featureContaining(player);
        if (activeFeature?.type === "healing-grove") {
            terrainStatusElement.textContent = "Clairière · régénération";
            terrainStatusElement.style.color = "#6ee7b7";
        } else if (activeFeature?.type === "portal") {
            terrainStatusElement.textContent = "Portail du canyon";
            terrainStatusElement.style.color = "#fde68a";
        } else if (activeFeature?.type === "blizzard") {
            terrainStatusElement.textContent = "Blizzard · fort ralentissement";
            terrainStatusElement.style.color = "#bae6fd";
        } else if (
            activeFeature?.type === "storm-field" &&
            stormFieldIsActive(activeFeature)
        ) {
            terrainStatusElement.textContent = "Champ d’orage · danger";
            terrainStatusElement.style.color = "#fbbf24";
        } else if (getTerrainMultiplier(player) < 1) {
            terrainStatusElement.textContent =
                `${currentEnvironment.label} · terrain ralenti`;
            terrainStatusElement.style.color = "#fbbf24";
        } else {
            terrainStatusElement.textContent =
                `${currentEnvironment.label} · ${currentEnvironment.gimmick}`;
            terrainStatusElement.style.color = currentEnvironment.accent;
        }
        const empoweredEnemies = actors.filter(
            (actor) =>
                actor.alive &&
                !actor.isPlayer &&
                (actor.element || actor.trait),
        );
        enemyStatusElement.textContent = empoweredEnemies.length
            ? `${empoweredEnemies.length} ennemis améliorés · niv. ` +
                `${roundSettings.enemyAbilityLevel}`
            : "Menace standard";
        enemyStatusElement.style.color = empoweredEnemies.length
            ? "#fbbf24"
            : "";
    }

    function update(deltaTime) {
        if (matchState !== "running") {
            return;
        }

        elapsed += deltaTime;
        campaign.survivalTime += deltaTime;
        mapAnnouncementTimer = Math.max(
            0,
            mapAnnouncementTimer - deltaTime,
        );
        goldRushTimer = Math.max(0, goldRushTimer - deltaTime);
        magneticStormTimer = Math.max(0, magneticStormTimer - deltaTime);

        for (const actor of actors) {
            actor.cooldown = Math.max(0, actor.cooldown - deltaTime);
            actor.spawnShield = Math.max(0, actor.spawnShield - deltaTime);
            actor.shieldFlashTimer = Math.max(
                0,
                actor.shieldFlashTimer - deltaTime,
            );
            actor.movementDistance = 0;
            actor.inMud = false;
        }

        updatePlayer(deltaTime);
        updateZombieSpawns(deltaTime);
        updateBots(deltaTime);
        updateBullets(deltaTime);
        updateActorEffects(deltaTime);
        updateMapFeatures(deltaTime);
        updatePickups(deltaTime);
        updateParticles(deltaTime);
        updateZone(deltaTime);
        updateCamera();
        hudUpdateAccumulator += deltaTime;
        if (hudUpdateAccumulator >= HUD_UPDATE_INTERVAL) {
            hudUpdateAccumulator %= HUD_UPDATE_INTERVAL;
            updateHud();
        }

        if (
            matchState === "running" &&
            player.alive &&
            countSurvivors() === 1
        ) {
            completeRound();
        }
    }

    function tileNoise(tileX, tileY) {
        let hash = (tileX * 374761393 + tileY * 668265263) | 0;
        hash = Math.imul(hash ^ (hash >>> 13), 1274126177) | 0;
        return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
    }

    function getTerrainTiles(kind) {
        const manifest = window.ARENA_ART_MANIFEST;
        const biome = manifest && manifest.terrain
            ? manifest.terrain[currentEnvironment.id]
            : null;
        const tiles = biome ? biome[kind] : null;
        return tiles && tiles.length > 0 ? tiles : null;
    }

    function buildGroundChunk(chunkX, chunkY) {
        const groundTiles = getTerrainTiles("ground");
        const floorTiles = getTerrainTiles("floor") || groundTiles;
        if (!groundTiles || !gameAssets.terrain.ready) {
            return null;
        }

        const surface = document.createElement("canvas");
        surface.width = GROUND_CHUNK_SIZE;
        surface.height = GROUND_CHUNK_SIZE;
        const surfaceContext = surface.getContext("2d");
        surfaceContext.imageSmoothingEnabled = false;

        const originX = chunkX * GROUND_CHUNK_SIZE;
        const originY = chunkY * GROUND_CHUNK_SIZE;

        for (let row = 0; row < GROUND_CHUNK_TILES; row += 1) {
            for (let column = 0; column < GROUND_CHUNK_TILES; column += 1) {
                const worldX = originX + column * GROUND_TILE;
                const worldY = originY + row * GROUND_TILE;
                const inRoom = window.BattleRoyaleMap
                    ? Boolean(window.BattleRoyaleMap.findRoomAt(
                        arenaLayout,
                        worldX + GROUND_TILE / 2,
                        worldY + GROUND_TILE / 2,
                    ))
                    : false;
                const tiles = inRoom ? floorTiles : groundTiles;
                const tileIndex = Math.min(
                    tiles.length - 1,
                    Math.floor(
                        tileNoise(
                            Math.floor(worldX / GROUND_TILE),
                            Math.floor(worldY / GROUND_TILE),
                        ) * tiles.length,
                    ),
                );
                const tile = tiles[tileIndex];
                surfaceContext.drawImage(
                    gameAssets.terrain.image,
                    tile[0] * GROUND_TILE,
                    tile[1] * GROUND_TILE,
                    GROUND_TILE,
                    GROUND_TILE,
                    column * GROUND_TILE,
                    row * GROUND_TILE,
                    GROUND_TILE,
                    GROUND_TILE,
                );
            }
        }

        return surface;
    }

    function getGroundChunk(chunkX, chunkY, budget) {
        const key = `${chunkX}:${chunkY}`;
        const cached = groundChunks.get(key);
        if (cached) {
            const position = groundChunkOrder.indexOf(key);
            if (position >= 0) {
                groundChunkOrder.splice(position, 1);
            }
            groundChunkOrder.push(key);
            return cached;
        }
        if (budget.built >= GROUND_CHUNKS_PER_FRAME) {
            return null;
        }

        const surface = buildGroundChunk(chunkX, chunkY);
        if (!surface) {
            return null;
        }
        budget.built += 1;
        groundChunks.set(key, surface);
        groundChunkOrder.push(key);
        while (groundChunkOrder.length > GROUND_CHUNK_LIMIT) {
            groundChunks.delete(groundChunkOrder.shift());
        }
        return surface;
    }

    function drawGroundTiles() {
        // Le test de disponibilité vient AVANT le remplissage : sinon le
        // chemin de repli peint l'écran entier ici, puis drawGrid le
        // repeint aussitôt, soit deux remplissages plein écran par image.
        if (!gameAssets.terrain.ready || !getTerrainTiles("ground")) {
            return false;
        }

        const visibleWidth = VIEW_WIDTH / camera.zoom;
        const visibleHeight = VIEW_HEIGHT / camera.zoom;
        context.fillStyle = currentEnvironment.ground;
        context.fillRect(camera.x, camera.y, visibleWidth, visibleHeight);

        const firstChunkX = Math.floor(camera.x / GROUND_CHUNK_SIZE);
        const firstChunkY = Math.floor(camera.y / GROUND_CHUNK_SIZE);
        const lastChunkX = Math.floor(
            (camera.x + visibleWidth) / GROUND_CHUNK_SIZE,
        );
        const lastChunkY = Math.floor(
            (camera.y + visibleHeight) / GROUND_CHUNK_SIZE,
        );
        const budget = { built: 0 };

        context.save();
        context.imageSmoothingEnabled = false;
        for (let chunkY = firstChunkY; chunkY <= lastChunkY; chunkY += 1) {
            for (
                let chunkX = firstChunkX;
                chunkX <= lastChunkX;
                chunkX += 1
            ) {
                const surface = getGroundChunk(chunkX, chunkY, budget);
                if (!surface) {
                    continue;
                }
                context.drawImage(
                    surface,
                    chunkX * GROUND_CHUNK_SIZE,
                    chunkY * GROUND_CHUNK_SIZE,
                );
            }
        }
        context.restore();
        return true;
    }

    function drawGrid() {
        const visibleWidth = VIEW_WIDTH / camera.zoom;
        const visibleHeight = VIEW_HEIGHT / camera.zoom;
        context.fillStyle = currentEnvironment.ground;
        context.fillRect(
            camera.x,
            camera.y,
            visibleWidth,
            visibleHeight,
        );

        const groundTexture = biomeTexturePatterns.get(
            currentEnvironment.id,
        );
        if (groundTexture) {
            context.save();
            context.globalAlpha = 0.52;
            context.fillStyle = groundTexture;
            context.fillRect(
                camera.x,
                camera.y,
                visibleWidth,
                visibleHeight,
            );
            context.restore();
        }

        context.fillStyle = currentEnvironment.groundAlt;
        context.globalAlpha = groundTexture ? 0.2 : 0.42;
        context.beginPath();
        if (circleIntersectsView(zone.x - 430, zone.y + 260, 520)) {
            context.arc(
                zone.x - 430,
                zone.y + 260,
                520,
                0,
                Math.PI * 2,
            );
        }
        if (circleIntersectsView(zone.x + 610, zone.y - 410, 440)) {
            context.arc(
                zone.x + 610,
                zone.y - 410,
                440,
                0,
                Math.PI * 2,
            );
        }
        context.fill();
        context.globalAlpha = 1;

        context.strokeStyle = currentEnvironment.grid;
        context.lineWidth = 1;

        const gridSize = 80;
        const startX = Math.floor(camera.x / gridSize) * gridSize;
        const endX = camera.x + visibleWidth + gridSize;
        const startY = Math.floor(camera.y / gridSize) * gridSize;
        const endY = camera.y + visibleHeight + gridSize;

        context.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            context.moveTo(x, camera.y);
            context.lineTo(x, camera.y + visibleHeight);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            context.moveTo(camera.x, y);
            context.lineTo(camera.x + visibleWidth, y);
        }
        context.stroke();
    }

    function drawGroundDetails() {
        const visibleWidth = VIEW_WIDTH / camera.zoom;
        const visibleHeight = VIEW_HEIGHT / camera.zoom;
        for (const detail of groundDetails) {
            if (
                detail.x < camera.x - 40 ||
                detail.x > camera.x + visibleWidth + 40 ||
                detail.y < camera.y - 40 ||
                detail.y > camera.y + visibleHeight + 40
            ) {
                continue;
            }

            context.save();
            context.translate(detail.x, detail.y);
            context.rotate(detail.rotation);
            context.strokeStyle = currentEnvironment.detail;
            context.fillStyle = currentEnvironment.detail;
            context.globalAlpha = 0.42;

            if (detail.type === "leaves") {
                context.beginPath();
                context.ellipse(
                    -detail.size * 0.35,
                    0,
                    detail.size,
                    detail.size * 0.34,
                    -0.35,
                    0,
                    Math.PI * 2,
                );
                context.ellipse(
                    detail.size * 0.38,
                    detail.size * 0.12,
                    detail.size * 0.78,
                    detail.size * 0.3,
                    0.45,
                    0,
                    Math.PI * 2,
                );
                context.fill();
            } else if (detail.type === "cracks") {
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(-detail.size, 0);
                context.lineTo(-detail.size * 0.15, -detail.size * 0.24);
                context.lineTo(detail.size * 0.3, detail.size * 0.16);
                context.lineTo(detail.size, -detail.size * 0.18);
                context.moveTo(detail.size * 0.2, detail.size * 0.1);
                context.lineTo(detail.size * 0.02, detail.size * 0.7);
                context.stroke();
            } else if (detail.type === "ice") {
                context.lineWidth = 1.5;
                context.beginPath();
                for (let ray = 0; ray < 6; ray += 1) {
                    const angle = (Math.PI * 2 * ray) / 6;
                    context.moveTo(0, 0);
                    context.lineTo(
                        Math.cos(angle) * detail.size,
                        Math.sin(angle) * detail.size,
                    );
                }
                context.stroke();
                context.fillStyle = "rgba(224, 242, 254, 0.35)";
                context.beginPath();
                context.arc(0, 0, detail.size * 0.22, 0, Math.PI * 2);
                context.fill();
            } else {
                context.lineWidth = 1.5;
                context.strokeRect(
                    -detail.size,
                    -detail.size * 0.65,
                    detail.size * 2,
                    detail.size * 1.3,
                );
                context.beginPath();
                context.arc(0, 0, detail.size * 0.18, 0, Math.PI * 2);
                context.fill();
            }
            context.restore();
        }
    }

    function fillFeaturePattern(materialId, radius, alpha) {
        const pattern = obstacleTexturePatterns.get(materialId);
        if (!pattern) {
            return;
        }
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = pattern;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    function drawMapFeatures() {
        for (const feature of mapFeatures) {
            if (feature.type !== "portal" || feature.side !== 0) {
                continue;
            }
            const destination = mapFeatures.find(
                (candidate) =>
                    candidate.type === "portal" &&
                    candidate.pair === feature.pair &&
                    candidate.side === 1,
            );
            if (
                !destination ||
                !rectangleIntersectsView(
                    Math.min(feature.x, destination.x),
                    Math.min(feature.y, destination.y),
                    Math.max(feature.x, destination.x),
                    Math.max(feature.y, destination.y),
                )
            ) {
                continue;
            }
            context.save();
            context.globalAlpha = 0.12;
            context.strokeStyle = "#fdba74";
            context.lineWidth = 3;
            context.setLineDash([18, 18]);
            context.beginPath();
            context.moveTo(feature.x, feature.y);
            context.lineTo(destination.x, destination.y);
            context.stroke();
            context.restore();
        }

        for (const feature of mapFeatures) {
            if (
                !circleIntersectsView(
                    feature.x,
                    feature.y,
                    feature.radius + 28,
                )
            ) {
                continue;
            }

            context.save();
            context.translate(feature.x, feature.y);

            if (feature.type === "healing-grove") {
                fillFeaturePattern("clearing", feature.radius, 0.4);
                const gradient = context.createRadialGradient(
                    0,
                    0,
                    8,
                    0,
                    0,
                    feature.radius,
                );
                gradient.addColorStop(0, "rgba(110, 231, 183, 0.3)");
                gradient.addColorStop(0.72, "rgba(34, 197, 94, 0.12)");
                gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
                context.fillStyle = gradient;
                context.beginPath();
                context.arc(0, 0, feature.radius, 0, Math.PI * 2);
                context.fill();
                context.strokeStyle = "rgba(110, 231, 183, 0.7)";
                context.lineWidth = 3;
                context.setLineDash([12, 9]);
                context.beginPath();
                context.arc(
                    0,
                    0,
                    feature.radius * 0.82,
                    elapsed * 0.2 + feature.phase,
                    Math.PI * 2 + elapsed * 0.2 + feature.phase,
                );
                context.stroke();
                context.setLineDash([]);
                context.fillStyle = "#a7f3d0";
                context.font = "900 20px system-ui";
                context.textAlign = "center";
                context.fillText("+", 0, 7);
            } else if (feature.type === "portal") {
                fillFeaturePattern("portal", feature.radius - 4, 0.5);
                context.rotate(elapsed * 0.75 + feature.phase);
                context.shadowColor = "#fb923c";
                context.shadowBlur = 22;
                context.strokeStyle = "#fdba74";
                context.lineWidth = 6;
                context.beginPath();
                context.arc(0, 0, feature.radius, 0, Math.PI * 2);
                context.stroke();
                context.strokeStyle = "#fef3c7";
                context.lineWidth = 2;
                context.setLineDash([8, 7]);
                context.beginPath();
                context.arc(0, 0, feature.radius - 10, 0, Math.PI * 2);
                context.stroke();
                context.setLineDash([]);
                context.rotate(-elapsed * 0.75 - feature.phase);
                context.fillStyle = "#fff7ed";
                context.font = "900 12px system-ui";
                context.textAlign = "center";
                context.fillText(String(feature.pair + 1), 0, 4);
            } else if (feature.type === "blizzard") {
                fillFeaturePattern("blizzard", feature.radius, 0.45);
                const gradient = context.createRadialGradient(
                    0,
                    0,
                    0,
                    0,
                    0,
                    feature.radius,
                );
                gradient.addColorStop(0, "rgba(224, 242, 254, 0.28)");
                gradient.addColorStop(0.7, "rgba(125, 211, 252, 0.15)");
                gradient.addColorStop(1, "rgba(125, 211, 252, 0)");
                context.fillStyle = gradient;
                context.beginPath();
                context.arc(0, 0, feature.radius, 0, Math.PI * 2);
                context.fill();
                context.strokeStyle = "rgba(186, 230, 253, 0.75)";
                context.lineWidth = 3;
                for (let band = 0; band < 4; band += 1) {
                    const offset =
                        ((elapsed * 45 + band * 48 + feature.phase * 20) %
                            (feature.radius * 2)) -
                        feature.radius;
                    context.beginPath();
                    context.arc(
                        offset * 0.35,
                        offset * 0.18,
                        feature.radius * (0.3 + band * 0.12),
                        0.15,
                        Math.PI * 1.2,
                    );
                    context.stroke();
                }
            } else {
                const generatorPattern =
                    obstacleTexturePatterns.get("generator");
                if (generatorPattern) {
                    context.save();
                    context.globalAlpha = 0.5;
                    context.fillStyle = generatorPattern;
                    context.beginPath();
                    for (let side = 0; side < 6; side += 1) {
                        const angle = (Math.PI * 2 * side) / 6;
                        const x = Math.cos(angle) * feature.radius;
                        const y = Math.sin(angle) * feature.radius;
                        if (side === 0) {
                            context.moveTo(x, y);
                        } else {
                            context.lineTo(x, y);
                        }
                    }
                    context.closePath();
                    context.fill();
                    context.restore();
                }
                const active = stormFieldIsActive(feature);
                const pulse = 1 + Math.sin(
                    elapsed * 2.4 + feature.phase,
                ) * 0.08;
                context.scale(pulse, pulse);
                context.fillStyle = active
                    ? "rgba(251, 191, 36, 0.16)"
                    : "rgba(71, 85, 105, 0.14)";
                context.strokeStyle = active ? "#fbbf24" : "#64748b";
                context.shadowColor = active ? "#fbbf24" : "transparent";
                context.shadowBlur = active ? 18 : 0;
                context.lineWidth = 4;
                context.beginPath();
                for (let side = 0; side < 6; side += 1) {
                    const angle = (Math.PI * 2 * side) / 6;
                    const x = Math.cos(angle) * feature.radius;
                    const y = Math.sin(angle) * feature.radius;
                    if (side === 0) {
                        context.moveTo(x, y);
                    } else {
                        context.lineTo(x, y);
                    }
                }
                context.closePath();
                context.fill();
                context.stroke();
                context.font = "900 24px system-ui";
                context.textAlign = "center";
                context.fillStyle = active ? "#fde68a" : "#94a3b8";
                context.fillText("ϟ", 0, 8);
            }

            context.restore();
        }
        context.globalAlpha = 1;
        context.shadowBlur = 0;
        context.setLineDash([]);
    }

    function drawZone() {
        const visibleWidth = VIEW_WIDTH / camera.zoom;
        const visibleHeight = VIEW_HEIGHT / camera.zoom;
        context.fillStyle = "rgba(248, 91, 112, 0.13)";
        context.fillRect(
            camera.x,
            camera.y,
            visibleWidth,
            visibleHeight,
        );

        if (circleIntersectsView(zone.x, zone.y, zone.radius + 5)) {
            context.beginPath();
            context.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
            context.fillStyle = "rgba(57, 152, 255, 0.08)";
            context.fill();
            context.strokeStyle = "#60a5fa";
            context.lineWidth = 5;
            context.stroke();
        }
    }

    function traceOrganicBlob(
        x,
        y,
        radius,
        seed,
        pointCount = 14,
        variation = 0.13,
    ) {
        for (let index = 0; index < pointCount; index += 1) {
            const angle = (Math.PI * 2 * index) / pointCount;
            const wobble =
                Math.sin(seed * 0.017 + index * 2.37) * variation +
                Math.cos(seed * 0.011 + index * 1.61) *
                    variation *
                    0.45;
            const pointRadius = radius * (1 + wobble);
            organicBlobPointX[index] = x + Math.cos(angle) * pointRadius;
            organicBlobPointY[index] = y + Math.sin(angle) * pointRadius;
        }

        context.beginPath();
        context.moveTo(
            (
                organicBlobPointX[pointCount - 1] +
                organicBlobPointX[0]
            ) / 2,
            (
                organicBlobPointY[pointCount - 1] +
                organicBlobPointY[0]
            ) / 2,
        );
        for (let index = 0; index < pointCount; index += 1) {
            const nextIndex = (index + 1) % pointCount;
            context.quadraticCurveTo(
                organicBlobPointX[index],
                organicBlobPointY[index],
                (
                    organicBlobPointX[index] +
                    organicBlobPointX[nextIndex]
                ) / 2,
                (
                    organicBlobPointY[index] +
                    organicBlobPointY[nextIndex]
                ) / 2,
            );
        }
        context.closePath();
    }

    function drawPropSprite(kind, spriteIndex, x, y, diameter) {
        if (!gameAssets.props.ready || !window.ARENA_ART_MANIFEST) {
            return false;
        }
        const byKind = window.ARENA_ART_MANIFEST.props;
        const options = byKind && byKind[kind]
            ? byKind[kind][currentEnvironment.id]
            : null;
        if (!options || options.length === 0) {
            return false;
        }

        const sprite = options[spriteIndex % options.length];
        const scale = diameter / sprite.width;
        const drawWidth = sprite.width * scale;
        const drawHeight = sprite.height * scale;
        context.save();
        context.imageSmoothingEnabled = false;
        context.drawImage(
            gameAssets.props.image,
            sprite.x,
            sprite.y,
            sprite.width,
            sprite.height,
            x - drawWidth / 2,
            y + diameter / 2 - drawHeight,
            drawWidth,
            drawHeight,
        );
        context.restore();
        return true;
    }

    function drawWallTiles(obstacle, healthRatio) {
        const tiles = getTerrainTiles("wall");
        if (!tiles || !gameAssets.terrain.ready) {
            return false;
        }

        const left = obstacle.x - obstacle.width / 2;
        const top = obstacle.y - obstacle.height / 2;
        const right = left + obstacle.width;
        const bottom = top + obstacle.height;

        context.save();
        context.beginPath();
        context.rect(left, top, obstacle.width, obstacle.height);
        context.clip();
        context.imageSmoothingEnabled = false;

        const firstTileX = Math.floor(left / GROUND_TILE);
        const firstTileY = Math.floor(top / GROUND_TILE);
        const lastTileX = Math.floor((right - 0.001) / GROUND_TILE);
        const lastTileY = Math.floor((bottom - 0.001) / GROUND_TILE);
        for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
            for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
                const index = Math.min(
                    tiles.length - 1,
                    Math.floor(tileNoise(tileX, tileY) * tiles.length),
                );
                const tile = tiles[index];
                context.drawImage(
                    gameAssets.terrain.image,
                    tile[0] * GROUND_TILE,
                    tile[1] * GROUND_TILE,
                    GROUND_TILE,
                    GROUND_TILE,
                    tileX * GROUND_TILE,
                    tileY * GROUND_TILE,
                    GROUND_TILE,
                    GROUND_TILE,
                );
            }
        }

        // Teinte de dégâts PROGRESSIVE, pas un seuil. Un mur est un abri
        // destructible : le joueur doit lire combien il en reste avant qu'il
        // tombe. Le palier unique à 0,45 laissait toute la plage 45-75 %
        // parfaitement intacte à l'écran, alors que le chemin de repli, lui,
        // y dessine déjà sa fissure.
        if (healthRatio < 1) {
            context.globalAlpha = (1 - healthRatio) * 0.55;
            context.fillStyle = "#111827";
            context.fillRect(left, top, obstacle.width, obstacle.height);
        }
        context.restore();

        // Les lignes de bord suivent l'ORIENTATION du mur. Tracées
        // horizontalement pour tout le monde, elles peignaient un tiret de
        // 26 px en travers de la face des murs horizontaux : un mur vertical
        // couvre [top, bottom] de la pièce, les murs horizontaux sont
        // centrés sur ces mêmes lignes avec 13 px de part et d'autre, et les
        // verticaux passent en dernier. Et les longs côtés d'un mur vertical
        // n'avaient alors aucun contour — ce qui compte d'autant plus que le
        // mur de badlands est à 2,5 de luminance de son propre sol.
        //
        // buildWalls (battle_royale_map.js) connaît l'orientation réelle du
        // mur — l'axe du côté de salle qui l'a produit — et la pose sur
        // obstacle.orientation ; on la lit en priorité. Un stub très court
        // (9-25 px, sous le seuil de fusion des portes) peut avoir
        // width < height alors qu'il est architecturalement horizontal, donc
        // la comparaison de dimensions n'est qu'un repli. Les murs de
        // l'ancien générateur dispersé (createObstacles, sans arenaLayout)
        // ne portent pas ce tag et retombent sur ce même repli, inchangés.
        const horizontal = obstacle.orientation
            ? obstacle.orientation === "horizontal"
            : obstacle.width >= obstacle.height;
        context.save();
        context.strokeStyle = "rgba(8, 12, 20, 0.55)";
        context.lineWidth = 3;
        context.beginPath();
        if (horizontal) {
            context.moveTo(left, top + 1.5);
            context.lineTo(right, top + 1.5);
        } else {
            context.moveTo(left + 1.5, top);
            context.lineTo(left + 1.5, bottom);
        }
        context.stroke();
        context.strokeStyle = "rgba(255, 255, 255, 0.18)";
        context.lineWidth = 2;
        context.beginPath();
        if (horizontal) {
            context.moveTo(left, bottom - 1);
            context.lineTo(right, bottom - 1);
        } else {
            context.moveTo(right - 1, top);
            context.lineTo(right - 1, bottom);
        }
        context.stroke();
        context.restore();

        return true;
    }

    function drawObstacles() {
        for (const obstacle of obstacles) {
            if (!obstacle.alive) {
                continue;
            }

            if (obstacle.shape === "rectangle") {
                if (
                    !rectangleIntersectsView(
                        obstacle.x - obstacle.width / 2,
                        obstacle.y - obstacle.height / 2,
                        obstacle.x + obstacle.width / 2,
                        obstacle.y + obstacle.height / 2,
                    )
                ) {
                    continue;
                }
            } else if (
                !circleIntersectsView(
                    obstacle.x,
                    obstacle.y,
                    obstacle.radius,
                )
            ) {
                continue;
            }

            if (obstacle.type === "mud") {
                const mudPattern = obstacleTexturePatterns.get("mud");
                if (mudPattern) {
                    context.save();
                    context.translate(obstacle.x, obstacle.y);
                    context.fillStyle = mudPattern;
                    context.globalAlpha = 0.85;
                    context.beginPath();
                    context.arc(0, 0, obstacle.radius, 0, Math.PI * 2);
                    context.fill();
                    context.restore();
                }
                context.fillStyle = currentEnvironment.hazard;
                context.globalAlpha = mudPattern ? 0.3 : 0.52;
                context.strokeStyle = currentEnvironment.accent;
                context.lineWidth = 3;
                context.beginPath();
                context.arc(
                    obstacle.x,
                    obstacle.y,
                    obstacle.radius,
                    0,
                    Math.PI * 2,
                );
                context.fill();
                context.stroke();
                context.globalAlpha = 0.34;
                context.lineWidth = 2;
                for (let ring = 1; ring <= 3; ring += 1) {
                    context.beginPath();
                    context.ellipse(
                        obstacle.x +
                            Math.sin(obstacle.x + ring) * obstacle.radius * 0.1,
                        obstacle.y +
                            Math.cos(obstacle.y + ring) * obstacle.radius * 0.08,
                        obstacle.radius * (0.18 + ring * 0.18),
                        obstacle.radius * (0.08 + ring * 0.08),
                        ring * 0.7,
                        0,
                        Math.PI * 2,
                    );
                    context.stroke();
                }
                context.globalAlpha = 1;
            } else if (obstacle.type === "wall") {
                const healthRatio = clamp(
                    obstacle.health / obstacle.maxHealth,
                    0,
                    1,
                );
                if (drawWallTiles(obstacle, healthRatio)) {
                    continue;
                }
                const wallTexture = obstacleTexturePatterns.get("wall");
                context.fillStyle = wallTexture || (
                    healthRatio > 0.45
                        ? currentEnvironment.wall
                        : "#3f4650"
                );
                context.strokeStyle = currentEnvironment.wallEdge;
                context.lineWidth = 2;
                context.beginPath();
                context.roundRect(
                    obstacle.x - obstacle.width / 2,
                    obstacle.y - obstacle.height / 2,
                    obstacle.width,
                    obstacle.height,
                    5,
                );
                context.fill();
                if (wallTexture) {
                    context.save();
                    context.globalAlpha = healthRatio > 0.45 ? 0.16 : 0.48;
                    context.fillStyle = healthRatio > 0.45
                        ? currentEnvironment.wall
                        : "#111827";
                    context.fill();
                    context.restore();
                }
                context.stroke();

                context.save();
                context.globalAlpha = 0.28;
                context.strokeStyle = currentEnvironment.wallEdge;
                context.lineWidth = 1.5;
                if (currentEnvironment.id === "ruins") {
                    for (
                        let x = obstacle.x - obstacle.width / 2 + 24;
                        x < obstacle.x + obstacle.width / 2;
                        x += 42
                    ) {
                        context.beginPath();
                        context.moveTo(x, obstacle.y - obstacle.height / 2);
                        context.lineTo(x, obstacle.y + obstacle.height / 2);
                        context.stroke();
                    }
                    context.beginPath();
                    context.moveTo(
                        obstacle.x - obstacle.width / 2,
                        obstacle.y,
                    );
                    context.lineTo(
                        obstacle.x + obstacle.width / 2,
                        obstacle.y,
                    );
                    context.stroke();
                } else if (currentEnvironment.id === "badlands") {
                    for (
                        let y = obstacle.y - obstacle.height / 2 + 10;
                        y < obstacle.y + obstacle.height / 2;
                        y += 13
                    ) {
                        context.beginPath();
                        context.moveTo(
                            obstacle.x - obstacle.width / 2 + 5,
                            y,
                        );
                        context.lineTo(
                            obstacle.x + obstacle.width / 2 - 5,
                            y + 2,
                        );
                        context.stroke();
                    }
                } else if (currentEnvironment.id === "frost") {
                    context.beginPath();
                    context.moveTo(
                        obstacle.x - obstacle.width * 0.35,
                        obstacle.y + obstacle.height * 0.42,
                    );
                    context.lineTo(
                        obstacle.x - obstacle.width * 0.08,
                        obstacle.y - obstacle.height * 0.42,
                    );
                    context.moveTo(
                        obstacle.x + obstacle.width * 0.05,
                        obstacle.y + obstacle.height * 0.42,
                    );
                    context.lineTo(
                        obstacle.x + obstacle.width * 0.3,
                        obstacle.y - obstacle.height * 0.42,
                    );
                    context.stroke();
                } else {
                    context.strokeStyle = currentEnvironment.foliage;
                    context.lineWidth = 3;
                    context.beginPath();
                    context.moveTo(
                        obstacle.x - obstacle.width * 0.42,
                        obstacle.y - obstacle.height * 0.45,
                    );
                    context.bezierCurveTo(
                        obstacle.x - obstacle.width * 0.15,
                        obstacle.y,
                        obstacle.x + obstacle.width * 0.12,
                        obstacle.y - obstacle.height * 0.2,
                        obstacle.x + obstacle.width * 0.38,
                        obstacle.y + obstacle.height * 0.42,
                    );
                    context.stroke();
                }
                context.restore();

                if (healthRatio < 0.75) {
                    context.strokeStyle = "#1f2937";
                    context.lineWidth = 2;
                    context.beginPath();
                    context.moveTo(
                        obstacle.x - obstacle.width * 0.18,
                        obstacle.y - obstacle.height * 0.35,
                    );
                    context.lineTo(obstacle.x, obstacle.y);
                    context.lineTo(
                        obstacle.x + obstacle.width * 0.16,
                        obstacle.y + obstacle.height * 0.34,
                    );
                    context.stroke();
                }
            } else if (obstacle.type === "boulder") {
                if (drawPropSprite(
                    "boulder",
                    obstacle.spriteIndex || 0,
                    obstacle.x,
                    obstacle.y,
                    obstacle.radius * 2,
                )) {
                    continue;
                }
                const rockTexture = obstacleTexturePatterns.get("rock");
                const rockSeed = obstacle.x * 0.17 + obstacle.y * 0.31;
                context.save();
                context.fillStyle =
                    rockTexture || currentEnvironment.wall;
                traceOrganicBlob(
                    obstacle.x,
                    obstacle.y,
                    obstacle.radius,
                    rockSeed,
                );
                context.fill();
                if (rockTexture) {
                    context.save();
                    context.globalAlpha = 0.14;
                    context.fillStyle = currentEnvironment.wall;
                    traceOrganicBlob(
                        obstacle.x,
                        obstacle.y,
                        obstacle.radius,
                        rockSeed,
                    );
                    context.fill();
                    context.restore();
                }
                context.strokeStyle = "rgba(10, 17, 28, 0.68)";
                context.lineWidth = 2.25;
                traceOrganicBlob(
                    obstacle.x,
                    obstacle.y,
                    obstacle.radius,
                    rockSeed,
                );
                context.stroke();
                context.fillStyle = "rgba(255, 255, 255, 0.12)";
                traceOrganicBlob(
                    obstacle.x - obstacle.radius * 0.25,
                    obstacle.y - obstacle.radius * 0.3,
                    obstacle.radius * 0.4,
                    rockSeed + 19,
                    10,
                    0.18,
                );
                context.fill();
                context.strokeStyle = "rgba(15, 23, 42, 0.28)";
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(
                    obstacle.x - obstacle.radius * 0.65,
                    obstacle.y + obstacle.radius * 0.15,
                );
                context.lineTo(
                    obstacle.x - obstacle.radius * 0.08,
                    obstacle.y - obstacle.radius * 0.05,
                );
                context.lineTo(
                    obstacle.x + obstacle.radius * 0.52,
                    obstacle.y + obstacle.radius * 0.45,
                );
                context.moveTo(
                    obstacle.x + obstacle.radius * 0.05,
                    obstacle.y - obstacle.radius * 0.76,
                );
                context.lineTo(
                    obstacle.x - obstacle.radius * 0.08,
                    obstacle.y - obstacle.radius * 0.05,
                );
                context.stroke();
                context.restore();
            } else if (obstacle.type === "tree") {
                if (drawPropSprite(
                    "tree",
                    obstacle.spriteIndex || 0,
                    obstacle.x,
                    obstacle.y,
                    obstacle.radius * 2.4,
                )) {
                    continue;
                }
                const treeSeed = obstacle.x * 0.13 + obstacle.y * 0.29;
                context.save();
                context.shadowColor = "rgba(2, 8, 12, 0.34)";
                context.shadowBlur = 8;
                context.shadowOffsetY = 5;
                context.fillStyle =
                    obstacleTexturePatterns.get("bark") || "#7c4a2d";
                context.strokeStyle = "rgba(32, 20, 15, 0.76)";
                context.lineWidth = 2;
                context.beginPath();
                context.roundRect(
                    obstacle.x - 7,
                    obstacle.y - 4,
                    14,
                    obstacle.radius + 9,
                    4,
                );
                context.fill();
                context.stroke();
                const crownPoints = [
                    [0, 0, 1],
                    [-0.58, 0.08, 0.62],
                    [0.56, 0.05, 0.64],
                    [-0.18, -0.55, 0.58],
                    [0.3, -0.48, 0.55],
                ];
                for (const [offsetX, offsetY, scale] of crownPoints) {
                    context.fillStyle =
                        obstacleTexturePatterns.get("foliage") ||
                        currentEnvironment.foliage;
                    traceOrganicBlob(
                        obstacle.x + offsetX * obstacle.radius,
                        obstacle.y + offsetY * obstacle.radius,
                        obstacle.radius * scale,
                        treeSeed + offsetX * 41 + offsetY * 67,
                        13,
                        0.14,
                    );
                    context.fill();
                    if (scale === 1) {
                        context.strokeStyle = "rgba(4, 24, 24, 0.52)";
                        context.lineWidth = 2;
                        context.stroke();
                    }
                }
                context.shadowBlur = 0;
                context.shadowOffsetY = 0;
                context.fillStyle = "rgba(255, 255, 255, 0.14)";
                traceOrganicBlob(
                    obstacle.x - obstacle.radius * 0.32,
                    obstacle.y - obstacle.radius * 0.42,
                    obstacle.radius * 0.26,
                    treeSeed + 101,
                    9,
                    0.2,
                );
                context.fill();
                context.restore();
            }
        }
    }

    // Biome -> kinds de son propre sceneryKinds qui dessinent un sprite de
    // props.bush dans drawScenery, plutôt que la forme procédurale de repli
    // (croix d'ossements, ellipse de galet, cercle de rune, ...). PAR BIOME,
    // pas une liste blanche globale unique : un même kind peut être
    // "sprite" pour un biome et rester "procédural" pour un autre — "bones"
    // dessine les tas de crânes du pack undead pour necropolis, mais
    // badlands a aussi "bones" dans son propre sceneryKinds et doit
    // continuer à le dessiner en croix d'ossements procédurale ; badlands
    // n'a donc PAS de ligne "bones" ici. "snow" et "pine" ouvrent l'accès
    // aux buissons de la toundra, qui n'en avait aucun à l'origine. Tout
    // kind listé dans la rangée d'un biome doit exister dans le
    // sceneryKinds de CE biome, et tout biome ayant de l'art dans
    // props.bush doit avoir au moins un kind partagé entre les deux — sans
    // quoi ses sprites ne sont jamais dessinés. build_arena_art.py relit
    // cette table et casse la construction si les deux côtés divergent.
    const BUSH_SCENERY_KINDS_BY_BIOME = {
        forest: ["fern", "shrub", "moss"],
        badlands: ["dry-grass"],
        frost: ["snow", "pine"],
        ruins: ["moss"],
        necropolis: ["bones"],
    };

    function drawScenery() {
        for (const item of scenery) {
            if (!circleIntersectsView(item.x, item.y, item.size * 2)) {
                continue;
            }

            if (
                (BUSH_SCENERY_KINDS_BY_BIOME[currentEnvironment.id] || [])
                    .includes(item.kind)
            ) {
                if (drawPropSprite(
                    "bush",
                    item.spriteIndex || 0,
                    item.x,
                    item.y,
                    item.size * 2.2,
                )) {
                    continue;
                }
                context.save();
                context.translate(item.x, item.y);
                context.rotate(item.rotation);
                context.strokeStyle = currentEnvironment.foliage;
                context.fillStyle = currentEnvironment.accent;
                context.lineWidth = Math.max(1.5, item.size * 0.1);
                for (let leaf = 0; leaf < 5; leaf += 1) {
                    const angle = (Math.PI * 2 * leaf) / 5;
                    context.save();
                    context.rotate(angle);
                    context.beginPath();
                    context.moveTo(0, 0);
                    context.quadraticCurveTo(
                        item.size * 0.55,
                        -item.size * 0.24,
                        item.size,
                        0,
                    );
                    context.quadraticCurveTo(
                        item.size * 0.55,
                        item.size * 0.24,
                        0,
                        0,
                    );
                    context.fill();
                    context.stroke();
                    context.restore();
                }
                context.restore();
            } else if (item.kind === "pine") {
                context.save();
                context.translate(item.x, item.y);
                context.rotate(item.rotation * 0.15);
                context.fillStyle = "#5b4632";
                context.fillRect(-2, 0, 4, item.size * 0.9);
                context.fillStyle = currentEnvironment.foliage;
                context.strokeStyle = currentEnvironment.accent;
                context.lineWidth = 1.5;
                for (let layer = 0; layer < 3; layer += 1) {
                    const y = item.size * (0.25 - layer * 0.32);
                    const width = item.size * (0.65 + layer * 0.18);
                    context.beginPath();
                    context.moveTo(0, y - item.size * 0.75);
                    context.lineTo(-width, y + item.size * 0.45);
                    context.lineTo(width, y + item.size * 0.45);
                    context.closePath();
                    context.fill();
                    context.stroke();
                }
                context.restore();
            } else if (item.kind === "snow") {
                context.fillStyle = "rgba(224, 242, 254, 0.38)";
                context.beginPath();
                context.ellipse(
                    item.x,
                    item.y,
                    item.size * 1.3,
                    item.size * 0.58,
                    item.rotation,
                    0,
                    Math.PI * 2,
                );
                context.fill();
                context.strokeStyle = "rgba(186, 230, 253, 0.4)";
                context.lineWidth = 1;
                context.stroke();
            } else if (item.kind === "ice-shard") {
                context.save();
                context.translate(item.x, item.y);
                context.rotate(item.rotation);
                context.fillStyle = "rgba(186, 230, 253, 0.42)";
                context.strokeStyle = "#7dd3fc";
                context.lineWidth = 1.5;
                context.beginPath();
                context.moveTo(0, -item.size);
                context.lineTo(item.size * 0.42, item.size * 0.48);
                context.lineTo(0, item.size * 0.2);
                context.lineTo(-item.size * 0.35, item.size * 0.55);
                context.closePath();
                context.fill();
                context.stroke();
                context.restore();
            } else if (item.kind === "bones") {
                context.save();
                context.translate(item.x, item.y);
                context.rotate(item.rotation);
                context.strokeStyle = "#d6c7a1";
                context.lineWidth = 4;
                context.beginPath();
                context.moveTo(-item.size, 0);
                context.lineTo(item.size, 0);
                context.moveTo(-item.size * 0.7, -5);
                context.lineTo(-item.size * 0.7, 5);
                context.moveTo(item.size * 0.7, -5);
                context.lineTo(item.size * 0.7, 5);
                context.stroke();
                context.restore();
            } else if (item.kind === "rune") {
                context.save();
                context.translate(item.x, item.y);
                context.rotate(item.rotation);
                context.strokeStyle = "rgba(251, 191, 36, 0.55)";
                context.lineWidth = 2;
                context.beginPath();
                context.arc(0, 0, item.size * 0.72, 0, Math.PI * 2);
                context.moveTo(-item.size * 0.48, -item.size * 0.48);
                context.lineTo(item.size * 0.48, item.size * 0.48);
                context.moveTo(item.size * 0.48, -item.size * 0.48);
                context.lineTo(-item.size * 0.48, item.size * 0.48);
                context.stroke();
                context.restore();
            } else {
                context.fillStyle = item.kind === "debris"
                    ? currentEnvironment.wall
                    : "#4d6076";
                context.beginPath();
                context.ellipse(
                    item.x,
                    item.y,
                    item.size,
                    item.size * 0.62,
                    item.rotation,
                    0,
                    Math.PI * 2,
                );
                context.fill();
                context.strokeStyle = currentEnvironment.wallEdge;
                context.globalAlpha = 0.32;
                context.lineWidth = 1.5;
                context.stroke();
                context.globalAlpha = 1;
            }
        }
    }

    function drawLoot() {
        for (const crate of supplyCrates) {
            if (
                !crate.alive ||
                !circleIntersectsView(crate.x, crate.y, 36)
            ) {
                continue;
            }

            context.save();
            context.translate(crate.x, crate.y);
            context.shadowColor = "rgba(180, 125, 35, 0.34)";
            context.shadowBlur = 10;
            context.shadowOffsetY = 4;
            context.fillStyle = "#172434";
            context.strokeStyle = "#08111e";
            context.lineWidth = 2.5;
            context.beginPath();
            context.roundRect(-22, -18, 44, 36, 6);
            context.fill();
            context.stroke();

            context.shadowBlur = 0;
            context.shadowOffsetY = 0;
            const lidGradient = context.createLinearGradient(0, -16, 0, 2);
            lidGradient.addColorStop(0, "#4a5f73");
            lidGradient.addColorStop(1, "#26394b");
            context.fillStyle = lidGradient;
            context.beginPath();
            context.roundRect(-19, -15, 38, 13, 4);
            context.fill();
            context.strokeStyle = "rgba(190, 210, 226, 0.2)";
            context.lineWidth = 1;
            context.stroke();

            context.fillStyle = "#9b6a22";
            context.fillRect(-18, -2, 36, 4);
            context.fillRect(-16, 11, 32, 3);
            context.fillStyle = "#d7a746";
            context.fillRect(-18, -2, 36, 1);
            context.fillRect(-17, -14, 4, 28);
            context.fillRect(13, -14, 4, 28);

            context.fillStyle = "#c48a2c";
            context.strokeStyle = "#5d3b13";
            context.lineWidth = 1.5;
            context.beginPath();
            context.roundRect(-6, -7, 12, 14, 3);
            context.fill();
            context.stroke();
            context.fillStyle = "#fff1a8";
            context.fillRect(-1, -3, 2, 6);

            context.fillStyle = "#f2c768";
            for (const x of [-16, 16]) {
                for (const y of [-12, 12]) {
                    context.beginPath();
                    context.arc(x, y, 1.4, 0, Math.PI * 2);
                    context.fill();
                }
            }
            context.restore();

            context.fillStyle = "rgba(4, 9, 17, 0.75)";
            context.fillRect(crate.x - 20, crate.y - 29, 40, 4);
            const crateHealthGradient = context.createLinearGradient(
                crate.x - 20,
                0,
                crate.x + 20,
                0,
            );
            crateHealthGradient.addColorStop(0, "#b7791f");
            crateHealthGradient.addColorStop(1, "#fde68a");
            context.fillStyle = crateHealthGradient;
            context.fillRect(
                crate.x - 20,
                crate.y - 29,
                40 * clamp(crate.health / crate.maxHealth, 0, 1),
                4,
            );
        }

        for (const pickup of pickups) {
            if (!circleIntersectsView(pickup.x, pickup.y, pickup.radius + 22)) {
                continue;
            }

            const pulse = 1 + Math.sin(pickup.phase) * 0.12;
            context.save();
            context.translate(pickup.x, pickup.y);
            context.scale(pulse, pulse);
            context.shadowColor = pickup.color;
            context.shadowBlur = 18;
            context.fillStyle = pickup.color;
            context.beginPath();
            context.arc(0, 0, pickup.radius, 0, Math.PI * 2);
            context.fill();
            context.shadowBlur = 0;
            context.fillStyle = "#0f1d31";
            context.font = "900 12px system-ui";
            context.textAlign = "center";
            context.textBaseline = "middle";
            const symbol = {
                health: "+",
                shield: "S",
                credits: "P",
                overdrive: "»",
            }[pickup.type];
            context.fillText(symbol, 0, 0);
            context.restore();
        }
    }

    function getActorVisualRadius(actor) {
        if (!gameAssets.wizards.ready) {
            return actor.radius;
        }
        if (actor.isElite) {
            return 42;
        }
        return actor.isPlayer ? 38 : 34;
    }

    function getWizardAtlasIndex(actor) {
        if (actor.isPlayer) {
            return SKINS[actor.skinId || selectedSkin].atlasIndex;
        }
        if (actor.element === "fire") {
            return 5;
        }
        if (actor.element === "ice") {
            return 6;
        }
        if (actor.element === "storm") {
            return 7;
        }
        const numericId = Number.parseInt(
            String(actor.id).replace(/\D/g, ""),
            10,
        );
        return 5 + ((Number.isFinite(numericId) ? numericId : 0) % 3);
    }

    function getWizardAnimationFrame(actor) {
        if (actor.attackAnimationTimer > 0) {
            return actor.attackAnimationTimer > 0.14 ? 4 : 5;
        }
        if (actor.isMoving) {
            return 1 + (Math.floor(actor.animationClock) % 3);
        }
        return 0;
    }

    function drawWizardSprite(actor) {
        const elementalPalette = actor.isPlayer
            ? campaign.elementPath
            : actor.element;
        const skinId = actor.isPlayer
            ? actor.skinId || selectedSkin
            : null;
        const atlasBundle = getWizardAtlasBundle(
            skinId,
            elementalPalette,
        );
        const atlas = atlasBundle.source;
        const atlasWidth = atlas.naturalWidth || atlas.width;
        const atlasHeight = atlas.naturalHeight || atlas.height;
        if (
            !atlasBundle.ready ||
            !atlasWidth ||
            !atlasHeight
        ) {
            return false;
        }

        const characterRow = getWizardAtlasIndex(actor);
        const animationFrame = getWizardAnimationFrame(actor);
        const cellWidth = atlasWidth / 6;
        const cellHeight = atlasHeight / atlasBundle.rowCount;
        const targetSize = actor.isElite
            ? 82
            : actor.isPlayer
                ? 76
                : 68;
        const walkBounce =
            actor.isMoving && animationFrame === 2 ? -2 : 0;

        context.save();
        context.imageSmoothingEnabled = false;
        context.drawImage(
            atlas,
            animationFrame * cellWidth,
            characterRow * cellHeight,
            cellWidth,
            cellHeight,
            -targetSize / 2,
            -targetSize / 2 + walkBounce,
            targetSize,
            targetSize,
        );
        context.restore();
        return true;
    }

    function drawPlayerAvatar(actor) {
        const skin = SKINS[actor.skinId || selectedSkin];
        const radius = actor.radius;
        const gradient = context.createRadialGradient(
            -radius * 0.35,
            -radius * 0.42,
            2,
            0,
            0,
            radius * 1.15,
        );
        gradient.addColorStop(0, skin.accent);
        gradient.addColorStop(0.46, skin.color);
        gradient.addColorStop(1, skin.secondary);

        context.shadowColor = skin.color;
        context.shadowBlur = 20;
        context.fillStyle = skin.secondary;
        context.beginPath();
        context.ellipse(-radius * 0.78, 0, 8, 13, -0.25, 0, Math.PI * 2);
        context.ellipse(radius * 0.78, 0, 8, 13, 0.25, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
        context.strokeStyle = skin.outline;
        context.lineWidth = 2.5;
        context.stroke();

        context.fillStyle = skin.visor;
        context.globalAlpha = 0.92;
        context.beginPath();
        context.ellipse(
            radius * 0.24,
            0,
            radius * 0.47,
            radius * 0.28,
            0,
            0,
            Math.PI * 2,
        );
        context.fill();
        context.globalAlpha = 1;
        context.strokeStyle = skin.accent;
        context.lineWidth = 2;

        if (skin.style === "sentinel") {
            context.beginPath();
            context.moveTo(-10, -9);
            context.lineTo(-2, 0);
            context.lineTo(-10, 9);
            context.moveTo(-4, -12);
            context.lineTo(4, 0);
            context.lineTo(-4, 12);
            context.stroke();
        } else if (skin.style === "drake") {
            context.fillStyle = skin.accent;
            context.beginPath();
            context.moveTo(-9, -14);
            context.lineTo(-2, -23);
            context.lineTo(2, -13);
            context.moveTo(-9, 14);
            context.lineTo(-2, 23);
            context.lineTo(2, 13);
            context.fill();
            context.beginPath();
            context.arc(-5, 0, 5, 0, Math.PI * 2);
            context.stroke();
        } else if (skin.style === "arcanist") {
            context.beginPath();
            for (let index = 0; index < 6; index += 1) {
                const angle = (Math.PI * 2 * index) / 6;
                const x = Math.cos(angle) * 10;
                const y = Math.sin(angle) * 10;
                if (index === 0) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }
            }
            context.closePath();
            context.stroke();
            context.fillStyle = skin.accent;
            context.fill();
        } else if (skin.style === "paladin") {
            context.fillStyle = skin.accent;
            for (let index = 0; index < 8; index += 1) {
                context.save();
                context.rotate((Math.PI * 2 * index) / 8);
                context.fillRect(-2, -radius - 6, 4, 8);
                context.restore();
            }
            context.beginPath();
            context.arc(-5, 0, 6, 0, Math.PI * 2);
            context.stroke();
        } else {
            context.globalAlpha = 0.45;
            context.fillStyle = skin.accent;
            context.beginPath();
            context.arc(-8, -5, radius * 0.65, 0, Math.PI * 2);
            context.fill();
            context.globalAlpha = 1;
            context.beginPath();
            context.moveTo(-12, -10);
            context.lineTo(1, 0);
            context.lineTo(-12, 10);
            context.stroke();
        }
    }

    // 9 colonnes de 32 px, pas 8 de 36 : mesuré sur la planche (9 blobs
    // d'encre par rangée à un pas de 32 px exact, 288 / 9 = 32 ; voir
    // task-4-report.md). Le squelette occupe donc 6 colonnes (3-8), pas 5.
    const ZOMBIE_CELL_COLUMNS = 9;
    const ZOMBIE_CELL_ROWS = 4;
    const ZOMBIE_DRAW_HEIGHT = 62;
    const ZOMBIE_FRAMES = {
        zombie: [0, 3],
        skeleton: [3, 9],
    };

    function getZombieFacingRow(angle) {
        const normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
        if (normalized >= -Math.PI / 4 && normalized < Math.PI / 4) {
            return 2;
        }
        if (normalized >= Math.PI / 4 && normalized < Math.PI * 0.75) {
            return 0;
        }
        if (normalized < -Math.PI / 4 && normalized >= -Math.PI * 0.75) {
            return 3;
        }
        return 1;
    }

    function drawZombieSprite(actor) {
        const sheet = gameAssets.zombies.image;
        const sheetWidth = sheet.naturalWidth || sheet.width;
        const sheetHeight = sheet.naturalHeight || sheet.height;
        if (!gameAssets.zombies.ready || !sheetWidth || !sheetHeight) {
            return false;
        }

        const cellWidth = sheetWidth / ZOMBIE_CELL_COLUMNS;
        const cellHeight = sheetHeight / ZOMBIE_CELL_ROWS;
        const range = ZOMBIE_FRAMES[actor.zombieKind] ||
            ZOMBIE_FRAMES.zombie;
        const frameCount = range[1] - range[0];
        // Même cadence que getWizardAnimationFrame (Math.floor(clock) % N,
        // sans multiplicateur) : animationClock avance à 7/s pour tout
        // actor non-joueur (voir la boucle d'effets plus bas), donc ceci
        // défile à 7 images/s, identique au rythme de marche de tous les
        // autres ennemis. Le brief d'origine multipliait par 6 (42 images/s
        // sur un cycle de 3 images, un scintillement), corrigé après revue.
        const frame = actor.isMoving
            ? range[0] + (Math.floor(actor.animationClock) % frameCount)
            : range[0];
        const row = getZombieFacingRow(actor.angle);
        const drawHeight = ZOMBIE_DRAW_HEIGHT;
        const drawWidth = drawHeight * (cellWidth / cellHeight);

        context.save();
        context.imageSmoothingEnabled = false;
        context.drawImage(
            sheet,
            frame * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
            actor.x - drawWidth / 2,
            actor.y + actor.radius - drawHeight,
            drawWidth,
            drawHeight,
        );
        context.restore();
        return true;
    }

    function drawActor(actor) {
        if (!actor.alive) {
            return;
        }

        // Les zombies se dessinent en coordonnées du monde, sans rotation
        // (leur feuille n'a que 4 directions, pas une rotation continue) :
        // la tentative se fait donc AVANT context.save()/rotate(), et
        // seul le bloc "corps" tourné est sauté en cas de succès — la barre
        // de vie et l'étiquette, calculées après context.restore() plus
        // bas, doivent rester affichées pour eux comme pour tout autre
        // ennemi (un zombie encaisse les tirs du joueur comme n'importe
        // quel autre actor, voir updateBullets).
        const visualRadius = getActorVisualRadius(actor);
        const drewZombieSprite = actor.isZombie && drawZombieSprite(actor);

        if (!drewZombieSprite) {
            context.save();
            context.translate(actor.x, actor.y);
            context.rotate(actor.angle);
            if (Math.cos(actor.angle) < 0) {
                context.scale(1, -1);
            }

            if (actor.isPlayer) {
                if (!drawWizardSprite(actor)) {
                    drawPlayerAvatar(actor);
                }
            } else {
                const enemyColor = actor.element
                    ? ENEMY_ELEMENTS[actor.element].color
                    : actor.color;
                if (!drawWizardSprite(actor)) {
                    context.shadowColor = enemyColor;
                    context.shadowBlur = actor.isElite ? 16 : 9;
                    context.fillStyle = actor.color;
                    context.beginPath();
                    context.arc(0, 0, actor.radius, 0, Math.PI * 2);
                    context.fill();
                    context.shadowBlur = 0;
                    context.strokeStyle = enemyColor;
                    context.lineWidth = actor.element ? 3 : 2;
                    context.stroke();
                }

                if (actor.trait) {
                    context.strokeStyle = ENEMY_TRAITS[actor.trait].color;
                    context.lineWidth = 2;
                    context.setLineDash([5, 4]);
                    context.beginPath();
                    context.arc(0, 0, visualRadius + 3, 0, Math.PI * 2);
                    context.stroke();
                    context.setLineDash([]);
                }
            }

            context.restore();
        }

        // Contrairement au corps (dessiné en rotation locale ci-dessus, sauté
        // pour un zombie sprite réussi), cet anneau est un cercle : il rend
        // à l'identique en coordonnées du monde, rotation ou non. On le
        // dessine donc ici, hors du bloc "corps", pour qu'il s'affiche pour
        // TOUT actor affecté — zombie sprite inclus — au lieu de disparaître
        // dès qu'un zombie se dessine avec sa feuille de sprites.
        if (
            actor.burnTimer > 0 ||
            actor.slowTimer > 0 ||
            actor.attackSlowTimer > 0 ||
            actor.weakenTimer > 0
        ) {
            context.strokeStyle = actor.burnTimer > 0
                ? "#fb7185"
                : actor.slowTimer > 0
                    ? "#67e8f9"
                    : actor.attackSlowTimer > 0
                        ? "#c4b5fd"
                        : "#f0abfc";
            context.lineWidth = 3;
            context.beginPath();
            context.arc(actor.x, actor.y, visualRadius + 3, 0, Math.PI * 2);
            context.stroke();
        }

        if (
            actor.isPlayer &&
            (actor.spawnShield > 0 || actor.shield > 0)
        ) {
            drawShieldOrbiter(actor, visualRadius);
        }

        const healthWidth = actor.isElite ? 52 : 38;
        // Un zombie n'est pas un disque centré sur actor.y comme les autres
        // actors : c'est un sprite haut ancré à sa base (actor.y +
        // actor.radius, voir drawZombieSprite), dont le sommet réel est
        // actor.y + actor.radius - ZOMBIE_DRAW_HEIGHT. La formule
        // "visualRadius" placerait la barre 1 px À L'INTÉRIEUR de la tête du
        // sprite (visualRadius = 34 une fois l'atlas des sorciers chargé,
        // contre un sommet de sprite à 45 px au-dessus d'actor.y) ; on
        // calcule donc son propre sommet plutôt que de réutiliser
        // visualRadius, en gardant le même dégagement de 10 px que tous les
        // autres actors.
        const healthBarY = actor.isZombie
            ? actor.y + actor.radius - ZOMBIE_DRAW_HEIGHT - 10
            : actor.y - visualRadius - 10;
        context.fillStyle = "rgba(4, 9, 17, 0.75)";
        context.fillRect(
            actor.x - healthWidth / 2,
            healthBarY,
            healthWidth,
            5,
        );
        context.fillStyle =
            actor.health / actor.maxHealth > 0.35 ? "#5eead4" : "#fb7185";
        context.fillRect(
            actor.x - healthWidth / 2,
            healthBarY,
            healthWidth * clamp(actor.health / actor.maxHealth, 0, 1),
            5,
        );

        if (actor.isPlayer) {
            context.fillStyle = "#ffffff";
            context.font = "700 12px system-ui";
            context.textAlign = "center";
            context.fillText("TOI", actor.x, actor.y + visualRadius + 13);
        } else if (actor.isElite) {
            context.fillStyle = "#fde68a";
            context.font = "800 10px system-ui";
            context.textAlign = "center";
            context.fillText("ÉLITE", actor.x, actor.y + visualRadius + 12);
        } else if (actor.element || actor.trait) {
            const symbols = [
                actor.element
                    ? ENEMY_ELEMENTS[actor.element].icon
                    : "",
                actor.trait
                    ? ENEMY_TRAITS[actor.trait].icon
                    : "",
            ].join("");
            context.fillStyle = actor.element
                ? ENEMY_ELEMENTS[actor.element].color
                : ENEMY_TRAITS[actor.trait].color;
            context.font = "900 9px system-ui";
            context.textAlign = "center";
            context.fillText(
                symbols,
                actor.x,
                actor.y + visualRadius + 11,
            );
        }
    }

    function drawShieldOrbiter(actor, visualRadius) {
        const spawnProtected = actor.spawnShield > 0;
        const orbitSpeed = spawnProtected ? 5.2 : 2.1;
        const orbitAngle = elapsed * orbitSpeed;
        const bob = Math.sin(elapsed * 3) * 2;
        const orbitRadius = visualRadius + 10;
        const shieldX = actor.x + Math.cos(orbitAngle) * orbitRadius;
        const shieldY = actor.y + Math.sin(orbitAngle) * orbitRadius + bob;
        const flash = actor.shieldFlashTimer > 0;
        const strength = actor.maxShield > 0
            ? clamp(actor.shield / actor.maxShield, 0, 1)
            : 0;
        const alpha = spawnProtected
            ? 0.95
            : clamp(0.55 + strength * 0.45, 0.55, 1);
        const scale = flash ? 1.35 : 1;

        context.save();
        context.translate(shieldX, shieldY);
        context.scale(scale, scale);
        context.globalAlpha = alpha;
        if (spawnProtected || flash) {
            context.shadowColor = flash ? "#ffffff" : "#60a5fa";
            context.shadowBlur = 10;
        }
        context.fillStyle = flash ? "#ffffff" : "#60a5fa";
        context.strokeStyle = "#dbeafe";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(0, -6);
        context.quadraticCurveTo(5.5, -6, 5.5, -2);
        context.quadraticCurveTo(5.5, 4, 0, 8);
        context.quadraticCurveTo(-5.5, 4, -5.5, -2);
        context.quadraticCurveTo(-5.5, -6, 0, -6);
        context.closePath();
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(0, -4);
        context.lineTo(0, 5.5);
        context.moveTo(-3.5, 0);
        context.lineTo(3.5, 0);
        context.strokeStyle = "rgba(219, 234, 254, 0.85)";
        context.lineWidth = 1;
        context.stroke();
        context.restore();
    }

    function drawPowerEffects() {
        for (const effect of powerEffects) {
            if (
                !circleIntersectsView(
                    effect.x,
                    effect.y,
                    effect.radius + 18,
                )
            ) {
                continue;
            }

            const progress = 1 - effect.life / effect.maximumLife;
            const alpha = clamp(1 - progress, 0, 1);
            const radius = effect.radius * (0.32 + progress * 0.68);
            context.save();
            context.translate(effect.x, effect.y);
            context.rotate(effect.rotation);
            context.globalAlpha = alpha;

            if (effect.type === "fire") {
                const gradient = context.createRadialGradient(
                    0,
                    0,
                    0,
                    0,
                    0,
                    radius,
                );
                gradient.addColorStop(0, "rgba(254, 240, 138, 0.7)");
                gradient.addColorStop(0.35, effect.color);
                gradient.addColorStop(1, "rgba(251, 113, 133, 0)");
                context.fillStyle = gradient;
                context.beginPath();
                context.arc(0, 0, radius, 0, Math.PI * 2);
                context.fill();
                context.strokeStyle = "#fef08a";
                context.lineWidth = 3;
                for (let index = 0; index < 6; index += 1) {
                    const angle = (Math.PI * 2 * index) / 6;
                    context.beginPath();
                    context.moveTo(
                        Math.cos(angle) * radius * 0.28,
                        Math.sin(angle) * radius * 0.28,
                    );
                    context.lineTo(
                        Math.cos(angle + 0.12) * radius,
                        Math.sin(angle + 0.12) * radius,
                    );
                    context.stroke();
                }
            } else if (effect.type === "ice") {
                context.strokeStyle = effect.color;
                context.fillStyle = "rgba(224, 242, 254, 0.42)";
                context.lineWidth = 3;
                context.beginPath();
                context.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
                context.stroke();
                for (let index = 0; index < 8; index += 1) {
                    const angle = (Math.PI * 2 * index) / 8;
                    context.save();
                    context.rotate(angle);
                    context.beginPath();
                    context.moveTo(radius * 0.25, -5);
                    context.lineTo(radius, 0);
                    context.lineTo(radius * 0.25, 5);
                    context.closePath();
                    context.fill();
                    context.stroke();
                    context.restore();
                }
            } else {
                context.strokeStyle = effect.color;
                context.shadowColor = effect.color;
                context.shadowBlur = 14;
                context.lineWidth = 3;
                context.setLineDash([10, 7]);
                context.beginPath();
                context.arc(0, 0, radius, 0, Math.PI * 2);
                context.stroke();
                context.setLineDash([]);
                for (let index = 0; index < 4; index += 1) {
                    const angle = (Math.PI * 2 * index) / 4;
                    context.beginPath();
                    context.moveTo(0, 0);
                    context.lineTo(
                        Math.cos(angle + 0.2) * radius * 0.48,
                        Math.sin(angle + 0.2) * radius * 0.48,
                    );
                    context.lineTo(
                        Math.cos(angle) * radius,
                        Math.sin(angle) * radius,
                    );
                    context.stroke();
                }
            }

            context.restore();
        }
        context.globalAlpha = 1;
        context.setLineDash([]);
        context.shadowBlur = 0;
    }

    function drawBulletsAndParticles() {
        for (const bullet of bullets) {
            if (!circleIntersectsView(bullet.x, bullet.y, 30)) {
                continue;
            }

            context.strokeStyle = bullet.color;
            context.globalAlpha = 0.4;
            context.lineWidth = bullet.radius * 1.15;
            context.beginPath();
            context.moveTo(
                bullet.x - bullet.velocityX * 0.025,
                bullet.y - bullet.velocityY * 0.025,
            );
            context.lineTo(bullet.x, bullet.y);
            context.stroke();
            context.globalAlpha = 1;
            context.shadowColor = bullet.color;
            context.shadowBlur = bullet.element ? 12 : 4;
            context.fillStyle = bullet.color;
            context.beginPath();
            context.arc(
                bullet.x,
                bullet.y,
                bullet.radius,
                0,
                Math.PI * 2,
            );
            context.fill();
        }
        context.shadowBlur = 0;

        for (const arc of energyArcs) {
            if (
                !rectangleIntersectsView(
                    Math.min(arc.x1, arc.x2) - 18,
                    Math.min(arc.y1, arc.y2) - 18,
                    Math.max(arc.x1, arc.x2) + 18,
                    Math.max(arc.y1, arc.y2) + 18,
                )
            ) {
                continue;
            }

            context.globalAlpha = clamp(
                arc.life / arc.maximumLife,
                0,
                1,
            );
            context.strokeStyle = arc.color;
            context.lineWidth = 4;
            context.beginPath();
            context.moveTo(arc.x1, arc.y1);
            context.lineTo(
                (arc.x1 + arc.x2) / 2 + randomBetween(-14, 14),
                (arc.y1 + arc.y2) / 2 + randomBetween(-14, 14),
            );
            context.lineTo(arc.x2, arc.y2);
            context.stroke();
        }

        for (const particle of particles) {
            if (
                !circleIntersectsView(
                    particle.x,
                    particle.y,
                    particle.size,
                )
            ) {
                continue;
            }

            const alpha = clamp(
                particle.life / particle.maximumLife,
                0,
                1,
            );
            context.globalAlpha = alpha;
            context.fillStyle = particle.color;
            if (particle.kind === "dust") {
                context.beginPath();
                context.arc(
                    particle.x,
                    particle.y,
                    particle.size / 2,
                    0,
                    Math.PI * 2,
                );
                context.fill();
            } else if (particle.kind === "ember") {
                context.shadowColor = particle.color;
                context.shadowBlur = 8;
                context.beginPath();
                context.arc(
                    particle.x,
                    particle.y,
                    particle.size * (0.5 + alpha * 0.5),
                    0,
                    Math.PI * 2,
                );
                context.fill();
                context.shadowBlur = 0;
            } else if (particle.kind === "shard") {
                context.save();
                context.translate(particle.x, particle.y);
                context.rotate(particle.rotation);
                context.beginPath();
                context.moveTo(0, -particle.size);
                context.lineTo(particle.size * 0.6, 0);
                context.lineTo(0, particle.size);
                context.lineTo(-particle.size * 0.6, 0);
                context.closePath();
                context.fill();
                context.restore();
            } else if (particle.kind === "spark") {
                context.strokeStyle = particle.color;
                context.lineWidth = 1.6;
                const dirX = particle.velocityX;
                const dirY = particle.velocityY;
                const length = Math.max(Math.hypot(dirX, dirY), 1);
                const unitX = (dirX / length) * particle.size * 2.4;
                const unitY = (dirY / length) * particle.size * 2.4;
                context.beginPath();
                context.moveTo(
                    particle.x - unitX,
                    particle.y - unitY,
                );
                context.lineTo(
                    particle.x - unitY * 0.35,
                    particle.y + unitX * 0.35,
                );
                context.lineTo(
                    particle.x + unitX,
                    particle.y + unitY,
                );
                context.stroke();
            } else if (particle.kind === "gust") {
                context.strokeStyle = particle.color;
                context.lineWidth = 1.4;
                context.beginPath();
                context.arc(
                    particle.x,
                    particle.y,
                    particle.size * 1.6,
                    particle.rotation,
                    particle.rotation + Math.PI * 0.9,
                );
                context.stroke();
            } else if (particle.kind === "pulse") {
                context.strokeStyle = particle.color;
                context.lineWidth = 2;
                context.beginPath();
                context.arc(
                    particle.x,
                    particle.y,
                    particle.size,
                    0,
                    Math.PI * 2,
                );
                context.stroke();
            } else if (particle.kind === "droplet") {
                context.beginPath();
                context.moveTo(particle.x, particle.y - particle.size);
                context.quadraticCurveTo(
                    particle.x + particle.size * 0.8,
                    particle.y + particle.size * 0.4,
                    particle.x,
                    particle.y + particle.size,
                );
                context.quadraticCurveTo(
                    particle.x - particle.size * 0.8,
                    particle.y + particle.size * 0.4,
                    particle.x,
                    particle.y - particle.size,
                );
                context.fill();
            } else {
                context.fillRect(
                    particle.x - particle.size / 2,
                    particle.y - particle.size / 2,
                    particle.size,
                    particle.size,
                );
            }
        }
        context.globalAlpha = 1;
    }

    function drawMinimap() {
        const width = 145;
        const height = 96;
        const x = VIEW_WIDTH - width - 16;
        const y = 16;
        const scaleX = width / WORLD_WIDTH;
        const scaleY = height / WORLD_HEIGHT;

        context.fillStyle = "rgba(5, 12, 23, 0.78)";
        context.fillRect(x, y, width, height);
        context.strokeStyle = "rgba(213, 230, 255, 0.35)";
        context.lineWidth = 1;
        context.strokeRect(x, y, width, height);

        context.beginPath();
        context.arc(
            x + zone.x * scaleX,
            y + zone.y * scaleY,
            zone.radius * scaleX,
            0,
            Math.PI * 2,
        );
        context.strokeStyle = "#60a5fa";
        context.lineWidth = 2;
        context.stroke();

        for (const actor of actors) {
            if (!actor.alive) {
                continue;
            }
            context.fillStyle = actor.isPlayer ? "#5eead4" : "#fb7185";
            if (actor.isElite) {
                context.fillStyle = "#fbbf24";
            } else if (actor.isPlayer) {
                context.fillStyle = actor.color;
            } else if (actor.isZombie) {
                context.fillStyle = "#a3e635";
            }
            context.fillRect(
                x + actor.x * scaleX - 1.5,
                y + actor.y * scaleY - 1.5,
                actor.isPlayer ? 5 : 3,
                actor.isPlayer ? 5 : 3,
            );
        }

        for (const crate of supplyCrates) {
            if (!crate.alive) {
                continue;
            }
            context.fillStyle = "#fbbf24";
            context.fillRect(
                x + crate.x * scaleX - 1,
                y + crate.y * scaleY - 1,
                2,
                2,
            );
        }

        for (const feature of mapFeatures) {
            context.fillStyle = {
                "healing-grove": "#6ee7b7",
                portal: "#fb923c",
                blizzard: "#bae6fd",
                "storm-field": "#fbbf24",
            }[feature.type];
            context.beginPath();
            context.arc(
                x + feature.x * scaleX,
                y + feature.y * scaleY,
                feature.type === "portal" ? 2.4 : 1.8,
                0,
                Math.PI * 2,
            );
            context.fill();
        }

        for (const obstacle of obstacles) {
            if (!obstacle.alive || obstacle.type === "mud") {
                continue;
            }
            context.fillStyle = obstacle.type === "wall"
                ? "#94a3b8"
                : obstacle.type === "tree"
                    ? "#4ade80"
                    : "#64748b";
            context.fillRect(
                x + obstacle.x * scaleX - 0.8,
                y + obstacle.y * scaleY - 0.8,
                1.6,
                1.6,
            );
        }
    }

    function drawCrosshair() {
        if (!mouse.moved) {
            return;
        }

        context.strokeStyle = "rgba(255, 255, 255, 0.9)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(mouse.screenX, mouse.screenY, 10, 0, Math.PI * 2);
        context.moveTo(mouse.screenX - 15, mouse.screenY);
        context.lineTo(mouse.screenX - 5, mouse.screenY);
        context.moveTo(mouse.screenX + 5, mouse.screenY);
        context.lineTo(mouse.screenX + 15, mouse.screenY);
        context.moveTo(mouse.screenX, mouse.screenY - 15);
        context.lineTo(mouse.screenX, mouse.screenY - 5);
        context.moveTo(mouse.screenX, mouse.screenY + 5);
        context.lineTo(mouse.screenX, mouse.screenY + 15);
        context.stroke();
    }

    function drawMapAnnouncement() {
        if (mapAnnouncementTimer <= 0) {
            return;
        }

        const alpha = clamp(mapAnnouncementTimer / 1.2, 0, 1);
        const width = 530;
        const height = 66;
        const x = (VIEW_WIDTH - width) / 2;
        const y = 118;
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = "rgba(5, 12, 23, 0.88)";
        context.strokeStyle = currentEnvironment.accent;
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(x, y, width, height, 12);
        context.fill();
        context.stroke();
        context.textAlign = "center";
        context.fillStyle = currentEnvironment.accent;
        context.font = "900 12px system-ui";
        context.fillText(
            `${currentEnvironment.label} · ${currentEnvironment.gimmick}`,
            VIEW_WIDTH / 2,
            y + 23,
        );
        context.fillStyle = "#dbeafe";
        context.font = "700 11px system-ui";
        context.fillText(
            currentEnvironment.gimmickHint,
            VIEW_WIDTH / 2,
            y + 45,
        );
        context.restore();
    }

    function render() {
        context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        updateRenderBounds(70);
        context.save();
        context.scale(camera.zoom, camera.zoom);
        context.translate(-camera.x, -camera.y);

        if (!drawGroundTiles()) {
            drawGrid();
            drawGroundDetails();
        }
        drawZone();
        drawMapFeatures();
        drawObstacles();
        drawScenery();
        drawLoot();

        for (const actor of actors) {
            if (circleIntersectsView(actor.x, actor.y, 72)) {
                drawActor(actor);
            }
        }

        drawPowerEffects();
        drawBulletsAndParticles();
        context.restore();
        drawMapAnnouncement();
        drawMinimap();
        drawCrosshair();
    }

    function animationLoop(timestamp) {
        const deltaTime = Math.min((timestamp - lastFrame) / 1000, 0.035);
        lastFrame = timestamp;

        update(deltaTime);
        if (
            matchState === "running" ||
            timestamp - lastWorldRender >= 100
        ) {
            render();
            lastWorldRender = timestamp;
        }
        if (
            !overlay.classList.contains("hidden") &&
            timestamp - lastPreviewRender >= 1000 / 30
        ) {
            drawMenuCharacterPreview(timestamp);
            lastPreviewRender = timestamp;
        }
        requestAnimationFrame(animationLoop);
    }

    function updateMousePosition(event) {
        const bounds = canvas.getBoundingClientRect();
        mouse.screenX = ((event.clientX - bounds.left) / bounds.width) *
            VIEW_WIDTH;
        mouse.screenY = ((event.clientY - bounds.top) / bounds.height) *
            VIEW_HEIGHT;
        mouse.moved = true;
    }

    function updateFullscreenControl() {
        const isFullscreen = document.fullscreenElement === battlePage;
        fullscreenToggle.setAttribute("aria-pressed", String(isFullscreen));
        fullscreenLabel.textContent = isFullscreen
            ? "Quitter le plein écran"
            : "Plein écran";
    }

    async function toggleFullscreenMode() {
        try {
            if (document.fullscreenElement === battlePage) {
                await document.exitFullscreen();
            } else {
                await battlePage.requestFullscreen();
            }
        } catch (error) {
            statusElement.textContent =
                "Le plein écran a été refusé par le navigateur.";
        }
    }

    const controlledKeys = new Set([
        "arrowleft",
        "arrowright",
        "arrowup",
        "arrowdown",
        "a",
        "d",
        "q",
        "s",
        "w",
        "z",
    ]);

    window.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if (key === "f" && !event.repeat && !settingsDialog.open) {
            event.preventDefault();
            toggleFullscreenMode();
            return;
        }
        if (key === " " && matchState === "running") {
            event.preventDefault();
            if (!event.repeat && campaign.upgrades.dash > 0) {
                dashRequested = true;
            }
            return;
        }
        if (key === "e" && matchState === "running") {
            event.preventDefault();
            if (!event.repeat) {
                activateSpecialAbility();
            }
            return;
        }
        if (controlledKeys.has(key)) {
            event.preventDefault();
            keys.add(key);
        }
    });

    window.addEventListener("keyup", (event) => {
        keys.delete(event.key.toLowerCase());
    });

    window.addEventListener("blur", () => {
        keys.clear();
        mouse.down = false;
        dashRequested = false;
    });

    canvas.addEventListener("pointermove", updateMousePosition);
    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || matchState !== "running") {
            return;
        }
        updateMousePosition(event);
        mouse.down = true;
        const mouseWorldX = camera.x + mouse.screenX / camera.zoom;
        const mouseWorldY = camera.y + mouse.screenY / camera.zoom;
        player.angle = Math.atan2(
            mouseWorldY - player.y,
            mouseWorldX - player.x,
        );
        shoot(player, player.angle);
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointerup", (event) => {
        mouse.down = false;
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
    });
    canvas.addEventListener("pointercancel", () => {
        mouse.down = false;
    });
    canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    startButton.addEventListener("click", handlePrimaryAction);
    fullscreenToggle.addEventListener("click", toggleFullscreenMode);
    document.addEventListener("fullscreenchange", updateFullscreenControl);
    settingsToggle.addEventListener("click", openSettingsDialog);
    settingsClose.addEventListener("click", closeSettingsDialog);
    resetSaveButton.addEventListener("click", requestSaveReset);
    musicVolumeControl.addEventListener("input", () => {
        updateMusicVolume(Number(musicVolumeControl.value) / 100);
    });
    musicVolumeControl.addEventListener("change", () => {
        updateMusicVolume(
            Number(musicVolumeControl.value) / 100,
            true,
        );
    });
    musicPlaylistControl.addEventListener("change", () => {
        updateMusicPlaylist(
            musicPlaylistControl.value,
            true,
            true,
        );
    });
    backgroundMusic.addEventListener("ended", playNextMusicTrack);
    backgroundMusic.addEventListener("error", handleMusicError);
    backgroundMusic.addEventListener("playing", () => {
        musicErrorCount = 0;
        stopMusicUnlockListeners();
    });
    document.addEventListener("pointerdown", unlockMusicFromInteraction);
    document.addEventListener("keydown", unlockMusicFromInteraction);
    // Only the tab you are looking at makes a sound. A hidden one used to keep
    // playing, and since this game and Pokemon Rogue draw on the same nine
    // tracks, leaving either open in another tab laid a second copy of the
    // same song over the first, a minute or so out of step. It resumes only if
    // hiding is what stopped it, so a tab that never got its first click stays
    // silent.
    let musicPausedByHiding = false;
    document.addEventListener("visibilitychange", () => {
        if (!backgroundMusic) return;
        if (document.hidden) {
            if (!backgroundMusic.paused) {
                musicPausedByHiding = true;
                backgroundMusic.pause();
            }
        } else if (musicPausedByHiding) {
            musicPausedByHiding = false;
            const request = backgroundMusic.play();
            if (request) request.catch(() => { /* blocked until a gesture */ });
        }
    });
    settingsDialog.addEventListener("close", cancelResetConfirmation);
    settingsDialog.addEventListener("click", (event) => {
        if (event.target === settingsDialog) {
            closeSettingsDialog();
        }
    });
    wardrobeToggle.addEventListener("click", () => {
        setWardrobeOpen(wardrobePanel.hidden);
    });
    for (const button of upgradeButtons) {
        button.addEventListener("click", () => {
            purchaseUpgrade(button.dataset.upgrade);
        });
    }
    for (const button of elementalButtons) {
        button.addEventListener("click", () => {
            selectElementPath(button.dataset.element);
        });
        button.addEventListener("pointerenter", () => {
            previewElementOverride = button.dataset.element;
            updateMenuCharacterPreviewDetails();
        });
        button.addEventListener("pointerleave", () => {
            previewElementOverride = null;
            updateMenuCharacterPreviewDetails();
        });
        button.addEventListener("focus", () => {
            previewElementOverride = button.dataset.element;
            updateMenuCharacterPreviewDetails();
        });
        button.addEventListener("blur", () => {
            previewElementOverride = null;
            updateMenuCharacterPreviewDetails();
        });
    }
    skillTreeElement.addEventListener("click", (event) => {
        const button = event.target.closest("[data-skill-node]");
        if (button) {
            purchaseSkill(button.dataset.skillNode);
        }
    });
    for (const button of skinButtons) {
        button.addEventListener("click", () => {
            selectSkin(button.dataset.skin);
        });
    }

    initialiseBackgroundMusic();
    loadGameAssets();
    prepareRound();
    updateUpgradeShop();
    requestAnimationFrame(animationLoop);
})();
