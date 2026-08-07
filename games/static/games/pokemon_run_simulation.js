(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.PokemonRunSimulation = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    class LeagueRun {
        constructor(options) {
            const config = options || {};
            this.dataset = config.dataset;
            this.rules = config.leagueConfig;
            this.battleApi = config.battleApi;
            this.trainerCatalog = Array.isArray(config.trainerCatalog?.trainers)
                ? config.trainerCatalog.trainers
                : [];
            this.trainersById = new Map(this.trainerCatalog.map((trainer) => [String(trainer.id), trainer]));
            this.rng = typeof config.rng === "function" ? config.rng : Math.random;
            if (!this.dataset || !this.rules || !this.battleApi) throw new Error("League data, rules, and battle API are required.");

            this.speciesById = new Map(this.dataset.pokemon.map((pokemon) => [Number(pokemon.id), pokemon]));
            this.itemsById = new Map(Object.values(this.dataset.items).map((item) => [Number(item.ID), item]));
            this.groupIds = this.dataset.item_organization?.groups || {};
            this.baseSpecies = this.dataset.pokemon.filter((pokemon) => this.isLeagueBaseSpecies(pokemon));
            this.onProgressChange = typeof config.onProgressChange === "function" ? config.onProgressChange : null;
            // Permanent Legacy-shop upgrades: a starting bankroll, a third
            // starter pick, and friendlier Mega Stone odds.
            this.metaPerks = config.metaPerks || {};
            this.progress = this.normalizeProgress(config.progress);
            this.state = {
                leagueId: this.rules.league.id,
                mode: "normal",
                round: 1,
                wins: 0,
                money: 0,
                legacy: 0,
                party: [],
                pc: [],
                inventory: {},
                shopOffers: [],
                // How many times the counter has been restocked since the last
                // duel, so each restock in the same visit costs more.
                shopRefreshes: 0,
                wildEncounter: null,
                wildEncounterUsed: false,
                // How many rival battles this run has already served.
                rivalBattlesFought: 0,
                pendingCapture: null,
                seenHeldItemIds: new Set(),
                seenMegaStoneIds: new Set(),
                currentTrainer: null,
                trainerHistoryIds: [],
                storyMilestoneIndex: 0,
                randomDuelsSinceMilestone: 0,
                currentStoryMilestone: null,
                leagueComplete: false,
                lastReward: null,
            };
        }

        // --- run save / continue -------------------------------------------
        // A checkpoint of the whole run, taken between rounds. Everything in
        // state is plain data except the two Sets; Pokemon are the plain
        // objects createCombatant builds, so they survive JSON unchanged.
        // megaTarget is stripped because it is derived fresh every battle.
        exportState() {
            const plain = { ...this.state };
            plain.seenHeldItemIds = [...this.state.seenHeldItemIds];
            plain.seenMegaStoneIds = [...this.state.seenMegaStoneIds];
            const shed = (pokemon) => {
                const copy = { ...pokemon };
                delete copy.megaTarget;
                return copy;
            };
            plain.party = this.state.party.map(shed);
            plain.pc = this.state.pc.map(shed);
            return { schema: 1, leagueId: this.rules.league.id, savedAt: Date.now(), state: plain };
        }

        importState(saved) {
            if (!saved || saved.schema !== 1 || saved.leagueId !== this.rules.league.id) return false;
            const incoming = saved.state;
            if (!incoming || !Array.isArray(incoming.party) || !incoming.party.length) return false;
            if (this.state.party.length) throw new Error("This run has already started.");
            this.state = {
                ...this.state,
                ...incoming,
                seenHeldItemIds: new Set(incoming.seenHeldItemIds || []),
                seenMegaStoneIds: new Set(incoming.seenMegaStoneIds || []),
                // Battle-scoped leftovers never resume mid-fight.
                wildEncounter: null,
                pendingCapture: incoming.pendingCapture || null,
            };
            return true;
        }

        normalizeProgress(progress) {
            const source = progress && typeof progress === "object" ? progress : {};
            const caughtIds = source.caughtSpeciesIds instanceof Set ? [...source.caughtSpeciesIds] : (source.caughtSpeciesIds || []);
            const usedIds = source.usedSpeciesIds instanceof Set ? [...source.usedSpeciesIds] : (source.usedSpeciesIds || []);
            const registeredIds = source.dexSpeciesIds instanceof Set ? [...source.dexSpeciesIds] : (source.dexSpeciesIds || []);
            // Schema 3 and older stored national dex numbers under a key that
            // every reader treats as a species id. Translate those once, on
            // load, rather than re-interpreting them as ids forever.
            const storedAsDexNumbers = Number(source.schemaVersion || 0) < 4;
            const normalizeDexIds = (values) => values
                .map((value) => (storedAsDexNumbers
                    ? this.legacyDexNumberToSpeciesId(value)
                    : this.canonicalLeagueSpeciesId(value)))
                .filter((value) => value !== null);
            // dexSpeciesIds is the union (anything ever seen, via either path)
            // -- that's what "X / 151 REGISTERED" reads. caught/used are real,
            // independent subsets now, tracked for future dex-detail screens.
            const dexSpeciesIds = new Set(normalizeDexIds([...registeredIds, ...caughtIds, ...usedIds]));
            const caughtSpeciesIds = new Set(normalizeDexIds(caughtIds));
            const usedSpeciesIds = new Set(normalizeDexIds(usedIds));
            const storyTotal = this.storyMilestones().length;
            const legacyCompletion = Boolean(source.hardModeUnlocked);
            const leagueCompleted = Boolean(source.leagueCompleted || legacyCompletion);
            const nextLeagueNumber = Number(this.storyRoute()?.next_league?.number || (Number(this.rules.league.number) + 1));
            const normalized = {
                schemaVersion: 4,
                leagueId: this.rules.league.id,
                bestRounds: Math.max(0, Number(source.bestRounds) || 0),
                bestStoryMilestone: clamp(Number(source.bestStoryMilestone) || (leagueCompleted ? storyTotal : 0), 0, storyTotal),
                leagueCompleted,
                hardModeUnlocked: Boolean(source.hardModeUnlocked || leagueCompleted),
                legendaryWildUnlocked: Boolean(source.legendaryWildUnlocked || (leagueCompleted && this.storyRoute()?.unlock_legendary_wilds_on_completion)),
                unlockedLeagueNumber: Math.max(
                    Number(this.rules.league.number),
                    Number(source.unlockedLeagueNumber) || Number(this.rules.league.number),
                    leagueCompleted ? nextLeagueNumber : Number(this.rules.league.number),
                ),
                mewWildUnlocked: Boolean(source.mewWildUnlocked),
                dexSpeciesIds,
                caughtSpeciesIds,
                usedSpeciesIds,
            };
            const rules = this.progressionRules();
            if (!storyTotal && normalized.bestRounds >= Number(rules.hard_mode_unlock_rounds)) normalized.hardModeUnlocked = true;
            if (!storyTotal && normalized.bestRounds >= Number(rules.legendary_wild_unlock_rounds)) normalized.legendaryWildUnlocked = true;
            const masteryIds = this.masterySpeciesIds();
            if (masteryIds.every((id) => normalized.dexSpeciesIds.has(id))) normalized.mewWildUnlocked = true;
            return normalized;
        }

        progressSnapshot() {
            const sortIds = (set) => [...set].sort((left, right) => left - right);
            return {
                schemaVersion: this.progress.schemaVersion,
                leagueId: this.progress.leagueId,
                bestRounds: this.progress.bestRounds,
                bestStoryMilestone: this.progress.bestStoryMilestone,
                leagueCompleted: this.progress.leagueCompleted,
                hardModeUnlocked: this.progress.hardModeUnlocked,
                legendaryWildUnlocked: this.progress.legendaryWildUnlocked,
                unlockedLeagueNumber: this.progress.unlockedLeagueNumber,
                mewWildUnlocked: this.progress.mewWildUnlocked,
                dexSpeciesIds: sortIds(this.progress.dexSpeciesIds),
                caughtSpeciesIds: sortIds(this.progress.caughtSpeciesIds),
                usedSpeciesIds: sortIds(this.progress.usedSpeciesIds),
            };
        }

        emitProgressChange(changes) {
            if (this.onProgressChange) this.onProgressChange(this.progressSnapshot(), changes || []);
        }

        progressionRules() {
            return this.rules.league_progression || {
                hard_mode_unlock_rounds: this.rules.league.duels || 10,
                legendary_wild_unlock_rounds: this.rules.league.duels || 10,
                mew_species_id: 151,
                mew_mastery_excluded_species_ids: [151],
            };
        }

        storyRoute() {
            return this.rules.story_route || null;
        }

        storyMilestones() {
            return Array.isArray(this.storyRoute()?.milestones) ? this.storyRoute().milestones : [];
        }

        nextStoryMilestone() {
            return this.storyMilestones()[this.state.storyMilestoneIndex] || null;
        }

        storyMilestoneReady(milestoneOverride) {
            const milestone = milestoneOverride || this.nextStoryMilestone();
            if (!milestone || this.state.leagueComplete) return false;
            const firstMilestone = this.state.storyMilestoneIndex === 0;
            const requiredRandomDuels = firstMilestone
                ? Number(this.storyRoute()?.minimum_random_duels_before_first_boss || 0)
                : Number(milestone.minimum_random_duels_after_previous || 0);
            return this.averagePartyLevel() >= Number(milestone.minimum_average_level || 1)
                && this.state.randomDuelsSinceMilestone >= requiredRandomDuels;
        }

        storyStatus() {
            const milestones = this.storyMilestones();
            const next = this.nextStoryMilestone();
            const firstMilestone = this.state.storyMilestoneIndex === 0;
            const requiredRandomDuels = next
                ? (firstMilestone
                    ? Number(this.storyRoute()?.minimum_random_duels_before_first_boss || 0)
                    : Number(next.minimum_random_duels_after_previous || 0))
                : 0;
            return {
                completed: this.state.storyMilestoneIndex,
                total: milestones.length,
                leagueComplete: this.state.leagueComplete,
                next,
                nextReady: this.storyMilestoneReady(next),
                averageLevel: Math.floor(this.averagePartyLevel()),
                requiredLevel: Number(next?.minimum_average_level || 0),
                randomDuelsSinceMilestone: this.state.randomDuelsSinceMilestone,
                requiredRandomDuels,
            };
        }

        masterySpeciesIds() {
            const excluded = new Set((this.progressionRules().mew_mastery_excluded_species_ids || []).map(Number));
            return this.baseSpecies.map((pokemon) => Number(pokemon.id)).filter((id) => !excluded.has(id));
        }

        progressSummary() {
            const leagueIds = new Set(this.baseSpecies.map((pokemon) => Number(pokemon.id)));
            const masteryIds = this.masterySpeciesIds();
            const registered = [...this.progress.dexSpeciesIds].filter((id) => leagueIds.has(id)).length;
            const caught = [...this.progress.caughtSpeciesIds].filter((id) => leagueIds.has(id)).length;
            const used = [...this.progress.usedSpeciesIds].filter((id) => leagueIds.has(id)).length;
            const masteryRegistered = masteryIds.filter((id) => this.progress.dexSpeciesIds.has(id)).length;
            const masteryUsed = masteryIds.filter((id) => this.progress.usedSpeciesIds.has(id)).length;
            return {
                bestRounds: this.progress.bestRounds,
                bestStoryMilestone: this.progress.bestStoryMilestone,
                storyMilestoneTotal: this.storyMilestones().length,
                leagueCompleted: this.progress.leagueCompleted,
                registered,
                caught,
                dexTotal: leagueIds.size,
                used,
                masteryRegistered,
                masteryUsed,
                masteryTotal: masteryIds.length,
                hardModeUnlocked: this.progress.hardModeUnlocked,
                legendaryWildUnlocked: this.progress.legendaryWildUnlocked,
                unlockedLeagueNumber: this.progress.unlockedLeagueNumber,
                mewWildUnlocked: this.progress.mewWildUnlocked,
                milestoneRounds: Number(this.progressionRules().hard_mode_unlock_rounds),
            };
        }

        getDexEntries() {
            const mewId = Number(this.progressionRules().mew_species_id);
            return [...this.baseSpecies]
                .sort((left, right) => Number(left.dex_number) - Number(right.dex_number))
                .map((species) => {
                    const id = Number(species.id);
                    const tags = new Set(species.tags || []);
                    const isMew = id === mewId;
                    const isLegendary = tags.has("legendary");
                    const registered = this.progress.dexSpeciesIds.has(id);
                    return {
                        species,
                        registered,
                        caught: this.progress.caughtSpeciesIds.has(id),
                        used: this.progress.usedSpeciesIds.has(id),
                        locked: (isMew && !this.progress.mewWildUnlocked)
                            || (isLegendary && !this.progress.legendaryWildUnlocked),
                        reward: isMew ? "mew" : (isLegendary ? "legendary" : null),
                    };
                });
        }

        recordCaughtSpecies(pokemon) {
            return this.recordDexSpecies([pokemon], this.progress.caughtSpeciesIds);
        }

        recordUsedSpecies(pokemonList) {
            return this.recordDexSpecies(pokemonList, this.progress.usedSpeciesIds);
        }

        recordDexSpecies(pokemonList, subset) {
            const changes = [];
            // A species already in the dex can still be new to the caught or
            // used subset, and that alone has to trigger a save -- otherwise
            // catching something you had only battled never persisted.
            let subsetGrew = false;
            (pokemonList || []).forEach((pokemon) => {
                const id = this.canonicalLeagueSpeciesId(pokemon);
                if (id === null) return;
                if (subset && !subset.has(id)) {
                    subset.add(id);
                    subsetGrew = true;
                }
                if (this.progress.dexSpeciesIds.has(id)) return;
                this.progress.dexSpeciesIds.add(id);
                changes.push({ type: "dex-registered", speciesId: id, name: this.speciesById.get(id)?.display_name || pokemon.name });
            });
            const masteryIds = this.masterySpeciesIds();
            if (!this.progress.mewWildUnlocked && masteryIds.every((id) => this.progress.dexSpeciesIds.has(id))) {
                this.progress.mewWildUnlocked = true;
                changes.push({ type: "mew-unlocked", speciesId: Number(this.progressionRules().mew_species_id) });
            }
            if (changes.length || subsetGrew) this.emitProgressChange(changes);
            return changes;
        }

        completeStoryBattle() {
            const changes = [];
            const milestone = this.state.currentStoryMilestone;
            if (!milestone) {
                this.state.randomDuelsSinceMilestone += 1;
                return changes;
            }
            const milestones = this.storyMilestones();
            const expected = milestones[this.state.storyMilestoneIndex];
            if (!expected || String(expected.id) !== String(milestone.id)) return changes;

            this.state.storyMilestoneIndex += 1;
            this.state.randomDuelsSinceMilestone = 0;
            this.progress.bestStoryMilestone = Math.max(this.progress.bestStoryMilestone, this.state.storyMilestoneIndex);
            changes.push({
                type: "story-milestone-cleared",
                milestoneId: milestone.id,
                title: milestone.title,
                chapter: milestone.chapter,
                trainerId: milestone.trainer_id,
                completed: this.state.storyMilestoneIndex,
                total: milestones.length,
            });

            const routeComplete = Boolean(milestone.finale) || this.state.storyMilestoneIndex >= milestones.length;
            if (routeComplete) {
                const route = this.storyRoute() || {};
                const nextLeagueNumber = Number(route.next_league?.number || (Number(this.rules.league.number) + 1));
                this.state.leagueComplete = true;
                if (!this.progress.leagueCompleted) {
                    this.progress.leagueCompleted = true;
                    changes.push({ type: "league-completed", leagueId: this.rules.league.id });
                }
                if (route.unlock_hard_mode_on_completion && !this.progress.hardModeUnlocked) {
                    this.progress.hardModeUnlocked = true;
                    changes.push({ type: "hard-mode-unlocked", milestoneId: milestone.id });
                }
                if (route.unlock_legendary_wilds_on_completion && !this.progress.legendaryWildUnlocked) {
                    this.progress.legendaryWildUnlocked = true;
                    changes.push({ type: "legendary-wild-unlocked", milestoneId: milestone.id });
                }
                if (route.unlock_next_league_on_completion && this.progress.unlockedLeagueNumber < nextLeagueNumber) {
                    this.progress.unlockedLeagueNumber = nextLeagueNumber;
                    changes.push({
                        type: "next-league-unlocked",
                        leagueId: route.next_league?.id,
                        leagueName: route.next_league?.name,
                        leagueNumber: nextLeagueNumber,
                    });
                }
            }
            this.state.currentStoryMilestone = null;
            return changes;
        }

        updateRoundProgress() {
            const changes = this.completeStoryBattle();
            if (this.state.wins > this.progress.bestRounds) {
                this.progress.bestRounds = this.state.wins;
                changes.push({ type: "best-round", rounds: this.state.wins });
            }
            const rules = this.progressionRules();
            if (!this.storyMilestones().length && !this.progress.hardModeUnlocked && this.state.wins >= Number(rules.hard_mode_unlock_rounds)) {
                this.progress.hardModeUnlocked = true;
                changes.push({ type: "hard-mode-unlocked", rounds: this.state.wins });
            }
            if (!this.storyMilestones().length && !this.progress.legendaryWildUnlocked && this.state.wins >= Number(rules.legendary_wild_unlock_rounds)) {
                this.progress.legendaryWildUnlocked = true;
                changes.push({ type: "legendary-wild-unlocked", rounds: this.state.wins });
            }
            if (changes.length) this.emitProgressChange(changes);
            return changes;
        }

        inDexRange(pokemon) {
            const [minimum, maximum] = this.rules.league.dex_range;
            return Number(pokemon.dex_number) >= minimum && Number(pokemon.dex_number) <= maximum;
        }

        // The ordinary form of a species, as opposed to its Mega, regional or
        // battle forms, which share a dex number but carry their own ids.
        //
        // This used to test `id === dex_number`, which is true for Kanto and
        // Johto only because Radical Red numbers those two regions to match
        // the National Dex. From Hoenn on the two diverge -- Treecko is id 277
        // against dex number 252 -- and every species in the league failed the
        // test, leaving the region with no starters and no opponents. The
        // canonical form is instead the lowest-id entry for its dex number
        // that is not marked as an alternate form.
        canonicalIdForDexNumber(dexNumber) {
            if (!this.canonicalByDexNumber) {
                const formTags = ["mega-evolution", "regional-form", "battle-form"];
                this.canonicalByDexNumber = new Map();
                this.dataset.pokemon.forEach((pokemon) => {
                    const dex = Number(pokemon.dex_number);
                    const isForm = (pokemon.tags || []).some((tag) => formTags.includes(tag));
                    const current = this.canonicalByDexNumber.get(dex);
                    if (!current
                        || (current.isForm && !isForm)
                        || (current.isForm === isForm && Number(pokemon.id) < Number(current.id))) {
                        this.canonicalByDexNumber.set(dex, { id: Number(pokemon.id), isForm });
                    }
                });
            }
            return this.canonicalByDexNumber.get(Number(dexNumber))?.id ?? null;
        }

        isLeagueBaseSpecies(pokemon) {
            return this.inDexRange(pokemon)
                && Number(pokemon.id) === this.canonicalIdForDexNumber(pokemon.dex_number);
        }

        // The dex key is the SPECIES ID, because that is what getDexEntries,
        // progressSummary and masterySpeciesIds all compare against. This
        // used to return the national dex number instead, which is only the
        // same thing in Kanto (ids 1-151 == dex 1-151). Everywhere else the
        // dataset's ids are offset -- Treecko is id 277, dex 252 -- so a
        // Hoenn catch either registered a species 25 slots earlier in the
        // dex or, where the number fell outside the league, was dropped
        // entirely. That is why Hoenn and Sinnoh recorded the wrong Pokemon
        // or none at all.
        canonicalLeagueSpeciesId(pokemonOrId) {
            const suppliedId = Number(typeof pokemonOrId === "object" ? pokemonOrId?.id : pokemonOrId);
            if (!Number.isFinite(suppliedId)) return null;
            const species = this.speciesById.get(suppliedId)
                || (typeof pokemonOrId === "object" ? pokemonOrId : null);
            const dexNumber = Number(species?.dex_number ?? suppliedId);
            const canonicalId = this.canonicalIdForDexNumber(dexNumber);
            if (canonicalId === null) return null;
            const canonical = this.speciesById.get(canonicalId);
            return canonical && this.isLeagueBaseSpecies(canonical) ? canonicalId : null;
        }

        // Records written before the key was corrected hold dex numbers, so
        // they have to be read as dex numbers exactly once and translated.
        legacyDexNumberToSpeciesId(value) {
            const canonicalId = this.canonicalIdForDexNumber(Number(value));
            if (canonicalId === null) return null;
            const canonical = this.speciesById.get(canonicalId);
            return canonical && this.isLeagueBaseSpecies(canonical) ? canonicalId : null;
        }

        hasExcludedTag(pokemon, excludedTags) {
            const tags = new Set(pokemon.tags || []);
            return (excludedTags || []).some((tag) => tags.has(tag));
        }

        isStarterEligible(pokemon) {
            const allowed = new Set(this.rules.starter_rules.allowed_evolution_tags);
            return Boolean(pokemon)
                && (pokemon.tags || []).some((tag) => allowed.has(tag))
                && !this.hasExcludedTag(pokemon, this.rules.starter_rules.excluded_tags);
        }

        configuredSpecies(ids) {
            return (ids || [])
                .map((id) => this.speciesById.get(Number(id)))
                .filter((pokemon) => pokemon && this.isLeagueBaseSpecies(pokemon));
        }

        // Wild areas are the one place a league may offer species from outside
        // its own dex, because the real routes do: Johto is full of Zubat and
        // Geodude. isLeagueBaseSpecies would drop every one of them, which
        // quietly deleted 21 of Johto's 50 listed encounters and left the
        // early routes with two species between them. Alternate forms are
        // still refused -- only a dex number's canonical entry can appear.
        configuredWildSpecies(ids) {
            return (ids || [])
                .map((id) => this.speciesById.get(Number(id)))
                .filter((pokemon) => pokemon
                    && Number(pokemon.id) === this.canonicalIdForDexNumber(pokemon.dex_number));
        }

        getFeaturedStarterPool() {
            return this.configuredSpecies(this.rules.starter_rules.featured_starter_ids).filter((pokemon) => this.isStarterEligible(pokemon));
        }

        getEarlyGameStarterPool() {
            return this.configuredSpecies(this.rules.starter_rules.early_game_species_ids)
                .filter((pokemon) => !this.hasExcludedTag(pokemon, this.rules.starter_rules.excluded_tags));
        }

        getStarterPool() {
            const configured = [...this.getFeaturedStarterPool(), ...this.getEarlyGameStarterPool()];
            if (configured.length) return [...new Map(configured.map((pokemon) => [Number(pokemon.id), pokemon])).values()];
            return this.baseSpecies.filter((pokemon) => this.isStarterEligible(pokemon));
        }

        sampleDistinct(values, count) {
            const pool = [...values];
            const result = [];
            while (pool.length && result.length < count) {
                const index = Math.floor(this.rng() * pool.length);
                result.push(pool.splice(index, 1)[0]);
            }
            return result;
        }

        starterChoices() {
            const rules = this.rules.starter_rules;
            const featuredCount = Number(rules.featured_starter_count || 1);
            const featuredPool = this.getFeaturedStarterPool();
            const earlyPool = this.getEarlyGameStarterPool();
            if (!featuredPool.length || !earlyPool.length) return this.sampleDistinct(this.getStarterPool(), Number(rules.choice_pool_size));
            const featured = this.sampleDistinct(featuredPool, featuredCount);
            const early = this.sampleDistinct(earlyPool, Number(rules.choice_pool_size) - featured.length);
            const choices = [...featured, ...early];
            if (choices.length !== Number(rules.choice_pool_size)) throw new Error("The league starter draft is missing configured Pokemon.");
            return this.sampleDistinct(choices, choices.length);
        }

        createPokemon(species, level) {
            const pokemon = this.battleApi.createCombatant(species, this.dataset.moves, { level });
            pokemon.experience = 0;
            pokemon.heldItemKey = null;
            pokemon.caughtThisRun = false;
            return pokemon;
        }

        cloneMove(move, ppOverride) {
            const maximum = Number(move.maxPp || move.pp || 1);
            return {
                ...move,
                effects: { ...(move.effects || {}) },
                maxPp: maximum,
                pp: Math.max(0, Math.min(maximum, ppOverride === undefined ? maximum : Number(ppOverride))),
            };
        }

        mergeMoveKnowledge(source, target) {
            const known = new Map();
            [...(target.movePool || []), ...(source.movePool || []), ...(source.moves || [])].forEach((move) => {
                if (!known.has(Number(move.id))) known.set(Number(move.id), this.cloneMove(move));
            });
            target.movePool = [...known.values()];

            const currentById = new Map((source.moves || []).map((move) => [Number(move.id), move]));
            const selected = [];
            (source.moves || []).forEach((move) => {
                const learned = known.get(Number(move.id));
                if (learned && selected.length < 4) selected.push(this.cloneMove(learned, move.pp));
            });
            (target.moves || []).forEach((move) => {
                if (selected.length >= 4 || selected.some((entry) => Number(entry.id) === Number(move.id))) return;
                const previous = currentById.get(Number(move.id));
                selected.push(this.cloneMove(move, previous?.pp));
            });
            target.moves = selected.length ? selected : target.movePool.slice(0, 1).map((move) => this.cloneMove(move));
            return target;
        }

        knownMoves(location, index) {
            const pokemon = this.state[location]?.[index];
            if (!pokemon) return [];
            if (!Array.isArray(pokemon.movePool) || !pokemon.movePool.length) {
                const species = this.speciesById.get(Number(pokemon.id));
                const refreshed = this.createPokemon(species, pokemon.level);
                this.mergeMoveKnowledge(pokemon, refreshed);
                pokemon.movePool = refreshed.movePool;
            }
            return pokemon.movePool.map((move) => this.cloneMove(move));
        }

        setPokemonMoves(location, index, moveIds) {
            const pokemon = this.state[location]?.[index];
            if (!pokemon) throw new Error("That Pokemon is unavailable.");
            const uniqueIds = [...new Set((moveIds || []).map(Number))];
            if (!uniqueIds.length || uniqueIds.length > 4) throw new Error("Choose between one and four moves.");
            const known = new Map(this.knownMoves(location, index).map((move) => [Number(move.id), move]));
            if (uniqueIds.some((id) => !known.has(id))) throw new Error("That Pokemon has not learned one of those moves.");
            const current = new Map((pokemon.moves || []).map((move) => [Number(move.id), move]));
            pokemon.moves = uniqueIds.map((id) => {
                const move = known.get(id);
                return this.cloneMove(move, current.get(id)?.pp);
            });
            return pokemon.moves;
        }

        movePartyPokemon(fromIndex, toIndex) {
            const from = Number(fromIndex);
            const to = Number(toIndex);
            if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error("Choose a valid party position.");
            if (from < 0 || from >= this.state.party.length || to < 0 || to >= this.state.party.length) {
                throw new Error("That party position is unavailable.");
            }
            if (from === to) return this.state.party;
            const [pokemon] = this.state.party.splice(from, 1);
            this.state.party.splice(to, 0, pokemon);
            return this.state.party;
        }

        start(starterIds, mode) {
            if (this.state.party.length) throw new Error("This run has already started.");
            const selectedMode = mode === "hard" ? "hard" : "normal";
            if (selectedMode === "hard" && !this.progress.hardModeUnlocked) {
                throw new Error(this.storyMilestones().length
                    ? `Defeat the ${this.rules.league.name} Champion to unlock Hard Mode.`
                    : `Clear ${this.progressionRules().hard_mode_unlock_rounds} rounds to unlock Hard Mode.`);
            }
            const uniqueIds = [...new Set(starterIds.map(Number))];
            if (uniqueIds.length !== this.starterPickCount()) throw new Error(`Choose exactly ${this.starterPickCount()} starters.`);
            const legal = new Set(this.getStarterPool().map((pokemon) => Number(pokemon.id)));
            if (uniqueIds.some((id) => !legal.has(id))) throw new Error("One of the selected starters is not legal for this league.");
            this.state.mode = selectedMode;
            this.state.money = Math.max(0, Number(this.metaPerks.startingMoney || 0));
            this.state.party = uniqueIds.map((id) => this.createPokemon(this.speciesById.get(id), this.rules.starter_rules.level));
            this.addInventoryById(4, 5, "capture");
            this.addInventoryById(13, 2, "healing");
            this.recordUsedSpecies(this.state.party);
            return this.state.party;
        }

        // How many starters this player picks: the league's own count,
        // plus one with the Legacy shop's Third Starter upgrade.
        starterPickCount() {
            return Number(this.rules.starter_rules.count) + (this.metaPerks.extraStarter ? 1 : 0);
        }

        averagePartyLevel() {
            if (!this.state.party.length) return this.rules.starter_rules.level;
            return this.state.party.reduce((total, pokemon) => total + pokemon.level, 0) / this.state.party.length;
        }

        // The level a species could first legitimately exist at, found by
        // walking back up its evolution chain and taking the deepest
        // requirement along the way. Venusaur needs Bulbasaur to reach 16 and
        // then Ivysaur to reach 32, so its answer is 32.
        earliestLevelFor(speciesId) {
            if (!this.earliestLevelCache) this.earliestLevelCache = new Map();
            const id = Number(speciesId);
            if (this.earliestLevelCache.has(id)) return this.earliestLevelCache.get(id);
            // Seed before recursing so a cyclic chain cannot spin forever.
            this.earliestLevelCache.set(id, 1);

            if (!this.evolutionSources) {
                this.evolutionSources = new Map();
                (this.dataset.evolution_chains || []).forEach((chain) => {
                    (chain.evolutions || []).forEach((entry) => {
                        const target = Number(entry.target_species_id);
                        if (!this.evolutionSources.has(target)) this.evolutionSources.set(target, []);
                        this.evolutionSources.get(target).push(entry);
                    });
                });
            }

            const sources = this.evolutionSources.get(id) || [];
            if (!sources.length) {
                this.earliestLevelCache.set(id, 1);
                return 1;
            }
            // Easiest route in: the cheapest of the ways to reach this form.
            let best = Infinity;
            sources.forEach((entry) => {
                const from = Number(entry.from_species_id);
                if (from === id) return;
                const previous = this.earliestLevelFor(from);
                const required = Number(entry.condition?.min_level) || 0;
                best = Math.min(best, Math.max(previous, required));
            });
            const answer = Number.isFinite(best) ? Math.max(1, best) : 1;
            this.earliestLevelCache.set(id, answer);
            return answer;
        }

        progressionSpeciesPool(excludedTags, levelCap) {
            const round = this.state.round;
            const baseStatCap = this.opponentBaseStatCap(round);
            return this.baseSpecies.filter((pokemon) => {
                if (this.hasExcludedTag(pokemon, excludedTags)) return false;
                if (Number.isFinite(baseStatCap) && this.baseStatTotal(pokemon) > baseStatCap) return false;
                // An evolved form cannot show up below the level its own
                // evolution needs -- a Weepinbell at 13 is eight levels early.
                if (Number.isFinite(levelCap) && this.earliestLevelFor(pokemon.id) > levelCap) return false;
                const tags = new Set(pokemon.tags || []);
                if (round < this.rules.opponent_scaling.allow_stage_2_from_duel) {
                    return tags.has("basic") || tags.has("stage-1");
                }
                if (round < this.rules.opponent_scaling.allow_fully_evolved_from_duel) {
                    return !tags.has("stage-3");
                }
                return true;
            });
        }

        baseStatTotal(species) {
            const provided = Number(species?.base_stats?.total);
            if (Number.isFinite(provided)) return provided;
            return ["hp", "attack", "defense", "special_attack", "special_defense", "speed"]
                .reduce((total, stat) => total + (Number(species?.base_stats?.[stat]) || 0), 0);
        }

        opponentBaseStatCap(roundOverride) {
            const round = Number(roundOverride || this.state.round);
            const caps = this.rules.opponent_scaling?.base_stat_total_caps || [];
            const match = [...caps]
                .sort((left, right) => Number(left.through_duel) - Number(right.through_duel))
                .find((entry) => round <= Number(entry.through_duel));
            const cap = Number(match?.maximum);
            return Number.isFinite(cap) ? cap : Infinity;
        }

        enemyLevel(trainerOverride) {
            const scaling = this.rules.opponent_scaling;
            const storyOffset = Number(trainerOverride?.storyLevelOffset || 0);
            if (trainerOverride?.storyMilestoneId) {
                return Math.max(scaling.minimum_level, Math.floor(this.averagePartyLevel() + storyOffset));
            }
            const openingUntil = Number(scaling.opening_level_until_duel ?? scaling.opening_pool_until_duel ?? 0);
            const openingLevel = Number(scaling.opening_level);
            if (this.state.round <= openingUntil && Number.isFinite(openingLevel)) {
                return Math.max(1, Math.floor(openingLevel));
            }
            const rawLevel = this.averagePartyLevel() - scaling.level_lag + (this.state.round - 1) * scaling.progression_bonus_per_duel;
            return Math.max(scaling.minimum_level, Math.floor(rawLevel + storyOffset));
        }

        // Levels across an opposing team. A flat line of identical levels
        // reads as generated rather than trained, so the roster ramps up to an
        // ace in the last slot the way a real trainer's does, centred on the
        // target level so the difficulty curve is unchanged.
        enemyTeamLevels(baseLevel, count) {
            const scaling = this.rules.opponent_scaling || {};
            const spread = Number(scaling.level_spread ?? 2);
            const minimum = Number(scaling.minimum_level ?? 2);
            if (count <= 1 || spread <= 0) {
                return Array.from({ length: count }, () => Math.max(minimum, baseLevel));
            }
            const low = baseLevel - Math.floor(spread / 2);
            return Array.from({ length: count }, (unused, index) => {
                const ramp = Math.round((spread * index) / (count - 1));
                // A little jitter on the rank and file, never on the ace.
                const jitter = index === count - 1 || this.rng() < 0.65 ? 0 : -1;
                return Math.max(minimum, low + ramp + jitter);
            });
        }

        opponentSpeciesPool(levelCap) {
            const scaling = this.rules.opponent_scaling;
            const progressionPool = this.progressionSpeciesPool(scaling.excluded_tags, levelCap);
            if (this.state.round > Number(scaling.opening_pool_until_duel || 0)) return progressionPool;
            const openingIds = new Set((scaling.opening_species_ids || []).map(Number));
            if (!openingIds.size) return progressionPool;
            const openingPool = progressionPool.filter((species) => openingIds.has(Number(species.id)));
            return openingPool.length >= this.rules.league.battle_format.active_per_side
                ? openingPool
                : progressionPool;
        }

        trainerRules() {
            return this.rules.trainer_rules || {};
        }

        trainerStrengthForRound(roundOverride) {
            const round = Number(roundOverride || this.state.round);
            const rules = this.trainerRules();
            if (this.storyMilestoneReady()) return "boss";
            const scheduledId = rules.boss_schedule?.[String(round)];
            const isBossRound = Boolean(scheduledId)
                || (Number(rules.boss_every_rounds) > 0 && round % Number(rules.boss_every_rounds) === 0);
            if (isBossRound) return "boss";
            const progression = [...(rules.strength_progression || [])]
                .sort((left, right) => Number(left.from_round) - Number(right.from_round));
            let strength = progression[0]?.strength || "weak";
            progression.forEach((entry) => {
                if (round >= Number(entry.from_round)) strength = entry.strength;
            });
            return strength;
        }

        selectTrainer() {
            const round = this.state.round;
            const rules = this.trainerRules();
            const milestone = this.storyMilestoneReady() ? this.nextStoryMilestone() : null;
            const scheduledId = milestone?.trainer_id || rules.boss_schedule?.[String(round)];
            let trainer = scheduledId ? this.trainersById.get(String(scheduledId)) : null;
            if (milestone) {
                const source = trainer || {};
                trainer = {
                    id: source.id || milestone.trainer_id || `story-boss-${milestone.id}`,
                    name: source.name || milestone.title || "League Boss",
                    trainer_class: milestone.trainer_class || source.trainer_class || "Story Boss",
                    league_generations: source.league_generations || [Number(this.rules.league.generation)],
                    sprite_generation: source.sprite_generation || Number(this.rules.league.generation),
                    specialties: source.specialties || ["mixed"],
                    strength: "boss",
                    boss: true,
                    sprite: source.sprite || "",
                    intro_line: milestone.intro_line || source.intro_line || "Your league journey is tested here.",
                    storyMilestoneId: milestone.id,
                    storyChapter: milestone.chapter,
                    storyTitle: milestone.title,
                    storyMilestoneNumber: this.state.storyMilestoneIndex + 1,
                    storyMilestoneTotal: this.storyMilestones().length,
                    storyTeamSpeciesIds: [...(milestone.team_species_ids || [])],
                    storyLevelOffset: Number(milestone.level_offset || 0),
                    finale: Boolean(milestone.finale),
                };
                this.state.currentStoryMilestone = milestone;
            } else {
                this.state.currentStoryMilestone = null;
            }
            // The region's rival turns up a few times among the random duels:
            // an early, a mid and a late meeting, each with a bigger team and
            // a further-evolved ace. A story boss always outranks the rival,
            // so a rival due on a milestone round simply waits for the next
            // free one -- the appointments are "from round", not "at round".
            const rival = this.rules.rival;
            if (!trainer && !milestone && rival) {
                const fought = Number(this.state.rivalBattlesFought || 0);
                const dueRound = (rival.rounds || [])[fought];
                if (dueRound !== undefined && round >= Number(dueRound)) {
                    const team = (rival.teams || [])[Math.min(fought, (rival.teams || []).length - 1)] || [];
                    trainer = {
                        id: `rival-${this.rules.league.id}-${fought + 1}`,
                        name: rival.name || "Rival",
                        trainer_class: rival.trainer_class || "Rival",
                        league_generations: [Number(this.rules.league.generation)],
                        sprite_generation: Number(this.rules.league.generation),
                        specialties: ["mixed"],
                        strength: this.trainerStrengthForRound(round),
                        boss: false,
                        rival: true,
                        rivalAppearance: fought + 1,
                        rivalTotal: (rival.rounds || []).length,
                        sprite: rival.sprite || "",
                        intro_line: rival.intro_line || "We meet again!",
                        storyTeamSpeciesIds: [...team],
                        storyLevelOffset: Number((rival.level_offsets || [])[fought] || 0),
                    };
                    this.state.rivalBattlesFought = fought + 1;
                }
            }
            if (!trainer) {
                const generations = new Set((rules.catalog_generations || [this.rules.league.generation]).map(Number));
                const strength = this.trainerStrengthForRound(round);
                // Story trainers are never random encounters. The tier check
                // alone let this through: Johto's and Hoenn's gym leaders and
                // Elite Four were authored as mid/strong, the very tiers the
                // random pool draws from, so Lance could turn up as a filler
                // duel before his own gym.
                const eligible = this.trainerCatalog.filter((entry) => (
                    entry.strength === strength
                    && !entry.boss
                    && (entry.league_generations || []).some((generation) => generations.has(Number(generation)))
                ));
                const unseen = eligible.filter((entry) => !this.state.trainerHistoryIds.includes(String(entry.id)));
                const pool = unseen.length ? unseen : eligible;
                if (pool.length) trainer = pool[Math.floor(this.rng() * pool.length)];
            }
            if (!trainer) {
                trainer = {
                    id: `${this.rules.league.id}-trainer-${round}`,
                    name: `${this.rules.league.name || "League"} Trainer`,
                    trainer_class: "League Challenger",
                    league_generations: [Number(this.rules.league.generation)],
                    sprite_generation: Number(this.rules.league.generation),
                    specialties: ["mixed"],
                    strength: this.trainerStrengthForRound(round),
                    boss: false,
                    sprite: "",
                    intro_line: "Let us see which team is better prepared.",
                };
            }
            this.state.currentTrainer = trainer;
            this.state.trainerHistoryIds.push(String(trainer.id));
            return trainer;
        }

        enemyTeamSize(trainer) {
            const scaling = this.rules.opponent_scaling || {};
            const minimum = Math.max(1, Number(scaling.minimum_team_size || this.rules.league.battle_format.active_per_side));
            const maximum = Math.min(
                Number(this.rules.league.battle_format.maximum_party_size || 6),
                Math.max(minimum, Number(scaling.maximum_team_size || 6)),
            );
            if (Array.isArray(trainer?.storyTeamSpeciesIds) && trainer.storyTeamSpeciesIds.length) {
                return Math.max(minimum, Math.min(maximum, trainer.storyTeamSpeciesIds.length));
            }
            const variationFrom = Math.max(1, Number(scaling.team_size_variation_from_duel || 1));
            if (this.state.round < variationFrom) {
                const openingSize = Number(scaling.opening_team_size || this.rules.league.battle_format.active_per_side);
                return Math.max(minimum, Math.min(maximum, openingSize));
            }
            const strength = String(trainer?.strength || this.trainerStrengthForRound()).toLowerCase();
            const configured = scaling.team_size_offsets_by_strength?.[strength];
            const offsets = Array.isArray(configured) && configured.length
                ? configured.map(Number)
                : (strength === "weak" ? [-1, 0] : strength === "mid" ? [-1, 0, 1] : [0, 1]);
            const offset = offsets[Math.min(offsets.length - 1, Math.floor(this.rng() * offsets.length))] || 0;

            // The base used to be the player's party size, which meant
            // catching a few Pokemon instantly handed every trainer a full
            // team -- three one duel, six the next. `match_player_party_size`
            // was already false in the config; it just wasn't read.
            const base = scaling.match_player_party_size
                ? this.state.party.length
                : this.scheduledTeamSize(this.state.round);
            return Math.max(minimum, Math.min(maximum, base + offset));
        }

        // Team size as a function of how far the run has come, so the curve
        // is about progress rather than how much the player has caught.
        scheduledTeamSize(round) {
            const scaling = this.rules.opponent_scaling || {};
            const schedule = [...(scaling.team_size_by_round || [])]
                .sort((left, right) => Number(left.from_duel) - Number(right.from_duel));
            if (!schedule.length) {
                // No table configured: grow by one every few duels.
                const every = Math.max(1, Number(scaling.team_size_growth_every_duels || 4));
                const opening = Number(scaling.opening_team_size || 2);
                return opening + Math.floor(Math.max(0, Number(round) - 1) / every);
            }
            let size = Number(schedule[0].size) || 1;
            schedule.forEach((entry) => {
                if (Number(round) >= Number(entry.from_duel)) size = Number(entry.size);
            });
            return size;
        }

        buildEnemyTeam(trainerOverride) {
            const trainer = trainerOverride || null;
            const count = this.enemyTeamSize(trainer);
            if (Array.isArray(trainer?.storyTeamSpeciesIds) && trainer.storyTeamSpeciesIds.length) {
                const configuredTeam = trainer.storyTeamSpeciesIds
                    .slice(0, count)
                    .map((id) => this.speciesById.get(Number(id)))
                    .filter(Boolean);
                if (configuredTeam.length >= this.rules.league.battle_format.active_per_side) {
                    // A story roster is listed in order, so its last entry is
                    // the ace and takes the top level.
                    const levels = this.enemyTeamLevels(this.enemyLevel(trainer), configuredTeam.length);
                    return this.equipEnemyTeam(
                        configuredTeam.map((species, index) => this.createPokemon(species, levels[index])),
                        trainer,
                    );
                }
            }
            const level = this.enemyLevel(trainer);
            const pool = this.opponentSpeciesPool(level);
            const specialties = new Set((trainer?.specialties || []).filter((type) => type !== "mixed"));
            const specializedPool = specialties.size
                ? pool.filter((species) => (species.types || []).some((type) => specialties.has(type.type)))
                : [];
            const typeBias = clamp(Number(this.trainerRules().type_team_bias || 0), 0, 1);
            const specializedCount = Math.min(specializedPool.length, Math.ceil(count * typeBias));
            const selected = specializedCount ? this.sampleDistinct(specializedPool, specializedCount) : [];
            const selectedIds = new Set(selected.map((species) => Number(species.id)));
            const remaining = pool.filter((species) => !selectedIds.has(Number(species.id)));
            selected.push(...this.sampleDistinct(remaining, count - selected.length));
            const levels = this.enemyTeamLevels(level, selected.length);
            return this.equipEnemyTeam(
                selected.map((species, index) => this.createPokemon(species, levels[index])),
                trainer,
            );
        }

        hardModeRules() {
            return this.state.mode === "hard" ? (this.rules.hard_mode || {}) : null;
        }

        // The mega stone, if any, that turns this species into something.
        megaStoneForSpecies(pokemon) {
            const stones = this.groupIds["mega-stones"] || [];
            for (const itemId of stones) {
                if (this.evolutionForItem(pokemon, itemId, "mega-stones")) {
                    const record = this.makeInventoryItem(itemId, "mega-stone");
                    if (record) return record;
                }
            }
            return null;
        }

        // Opposing Pokemon carry nothing on normal mode. On hard, some of them
        // hold an item and a boss may bring a Mega Evolution of its own, so the
        // player's own stones and items stop being a one-sided advantage.
        equipEnemyTeam(team, trainer) {
            const rules = this.hardModeRules();
            if (!rules || !team.length) return team;
            const isBoss = Boolean(trainer?.boss || trainer?.storyMilestoneId);
            const registry = (typeof globalThis !== "undefined" ? globalThis : window).PokemonHeldItems;
            const itemIds = this.itemIdBySlug();
            // Only items the battle engine actually reads, and never a mega
            // stone -- those are placed deliberately below.
            const holdable = (registry ? registry.sellableSlugs() : [])
                .filter((slug) => itemIds.has(slug));
            // Hard mode's armed trainers hold off for the first couple of
            // duels: a fresh two-Pokemon party with an empty bag was meeting
            // item-boosted enemies on round one, the deadliest spike the
            // balance study measured.
            const itemsFrom = Number(rules.enemy_items_from_duel ?? 0);
            const armed = isBoss || this.state.round >= itemsFrom;
            const chance = armed ? Number((isBoss ? rules.boss_held_item_chance : rules.enemy_held_item_chance) ?? 0) : 0;

            if (holdable.length) {
                team.forEach((pokemon) => {
                    if (this.rng() >= chance) return;
                    pokemon.heldItemKey = holdable[Math.floor(this.rng() * holdable.length)];
                    pokemon.heldItemSpent = false;
                });
            }

            if (isBoss && this.rng() < Number(rules.boss_mega_chance ?? 0)) {
                // Whoever leads gets first refusal. Handing the stone to the
                // ace reads better on paper, but the ace starts on the bench
                // behind a full team, so the transformation almost never
                // happened -- the bench is only the fallback now.
                const leads = Number(this.rules.league.battle_format?.active_per_side || 2);
                const order = [
                    ...team.map((pokemon, index) => index).filter((index) => index < leads),
                    ...team.map((pokemon, index) => index).filter((index) => index >= leads).reverse(),
                ];
                for (const index of order) {
                    const pokemon = team[index];
                    const species = this.speciesById.get(Number(pokemon.id));
                    const stone = species ? this.megaStoneForSpecies(species) : null;
                    if (!stone) continue;
                    pokemon.heldItemKey = stone.key;
                    pokemon.heldItemSpent = false;
                    pokemon.megaTarget = this.megaTargetFor(pokemon);
                    pokemon.megaEvolved = false;
                    if (pokemon.megaTarget) break;
                }
            }
            return team;
        }

        prepareDuel() {
            const trainer = this.selectTrainer();
            return {
                trainer,
                milestone: this.state.currentStoryMilestone,
                enemyTeam: this.buildEnemyTeam(trainer),
            };
        }

        itemCategory(itemId) {
            const id = Number(itemId);
            if ([1, 2, 3, 4].includes(id)) return "capture";
            if ((this.groupIds["mega-stones"] || []).includes(id)) return "mega-stone";
            if ((this.groupIds["evolution-items"] || []).includes(id)) return "evolution";
            if ((this.groupIds["held-items"] || []).includes(id)) return "held";
            if ((this.groupIds.healing || []).includes(id)) return "healing";
            return "other";
        }

        healingEffect(itemName) {
            const name = String(itemName).toLowerCase();
            if (name.includes("revive")) return { type: "revive", ratio: name.includes("max") ? 1 : 0.5 };
            const amounts = [
                ["max potion", 9999], ["full restore", 9999], ["hyper potion", 120],
                ["super potion", 50], ["fresh water", 30], ["soda pop", 50],
                ["lemonade", 70], ["moomoo milk", 100], ["potion", 20],
            ];
            const match = amounts.find(([fragment]) => name.includes(fragment));
            return match ? { type: "heal", amount: match[1] } : null;
        }

        captureModifier(itemName) {
            const name = String(itemName).toLowerCase();
            if (name.includes("master")) return 99;
            if (name.includes("ultra")) return 2;
            if (name.includes("great")) return 1.5;
            return 1;
        }

        makeInventoryItem(itemId, categoryOverride) {
            const raw = this.itemsById.get(Number(itemId));
            if (!raw) throw new Error(`Missing item ${itemId}.`);
            const category = categoryOverride || this.itemCategory(itemId);
            const basePrice = this.rules.shop.price_by_category[category] || 500;
            const item = {
                id: Number(raw.ID),
                key: raw.slug,
                name: raw.name,
                description: raw.description || "No battle description is available for this item.",
                sprite: this.canonicalItemSprite(raw),
                category,
                quantity: 0,
                buyPrice: basePrice,
                sellPrice: Math.max(1, Math.floor(basePrice * this.rules.shop.sell_ratio)),
            };
            if (category === "healing") item.effect = this.healingEffect(raw.name);
            if (category === "capture") item.catchModifier = this.captureModifier(raw.name);
            return item;
        }

        canonicalItemSprite(rawItem) {
            const path = String(rawItem?.sprite || "");
            const id = Number(rawItem?.ID);
            if (!path || !Number.isFinite(id)) return path;
            return path.replace(/\/items\/[^/]+\.png$/i, `/items/${id}.png`);
        }

        availableItemIds(kind, fallbackIds) {
            const tiers = this.rules.item_quality_progression?.[kind] || [];
            let available = [...(fallbackIds || [])];
            [...tiers]
                .sort((left, right) => Number(left.from_duel) - Number(right.from_duel))
                .forEach((tier) => {
                    if (this.state.round >= Number(tier.from_duel)) available = [...(tier.item_ids || [])];
                });
            return [...new Set(available.map(Number).filter((id) => this.itemsById.has(id)))];
        }

        addInventoryById(itemId, quantity, categoryOverride) {
            const template = this.makeInventoryItem(itemId, categoryOverride);
            if (!this.state.inventory[template.key]) this.state.inventory[template.key] = template;
            this.state.inventory[template.key].quantity += quantity;
            return this.state.inventory[template.key];
        }

        rewardDrops() {
            const rules = this.rules.duel_rewards;
            const count = rules.drop_count_min + Math.floor(this.rng() * (rules.drop_count_max - rules.drop_count_min + 1));
            const drops = [];
            for (let index = 0; index < count; index += 1) {
                const useCapturePool = this.rng() < 0.55;
                const pool = useCapturePool
                    ? this.availableItemIds("capture", rules.capture_item_ids)
                    : this.availableItemIds("healing", rules.healing_item_ids);
                const itemId = pool[Math.floor(this.rng() * pool.length)];
                const item = this.addInventoryById(itemId, 1, useCapturePool ? "capture" : "healing");
                const existing = drops.find((drop) => drop.key === item.key);
                if (existing) existing.quantity += 1;
                else drops.push({ key: item.key, name: item.name, sprite: item.sprite, quantity: 1 });
            }
            // Pickup scavenges an extra item per holder after the duel.
            const abilities = window.PokemonBattleAbilities;
            (this.state.party || []).forEach((pokemon) => {
                const chance = abilities?.getAbility(pokemon?.ability?.slug)?.extraDropChance || 0;
                if (!chance || this.rng() >= chance) return;
                const pool = this.availableItemIds("healing", rules.healing_item_ids);
                const item = this.addInventoryById(pool[Math.floor(this.rng() * pool.length)], 1, "healing");
                const existing = drops.find((drop) => drop.key === item.key);
                if (existing) existing.quantity += 1;
                else drops.push({ key: item.key, name: item.name, sprite: item.sprite, quantity: 1, pickedUpBy: pokemon.name });
            });
            return drops;
        }

        experienceNeeded(level) {
            const progression = this.rules.progression;
            return progression.experience_to_next_level_base + level * progression.experience_to_next_level_growth;
        }

        replacePokemon(location, index, nextPokemon) {
            this.state[location][index] = nextPokemon;
        }

        preserveBattleCondition(source, target) {
            // Evolving raises max HP, and the games raise current HP by the
            // same amount -- a Pokemon at full health stays at full health.
            // Copying the old value straight across left it visibly short.
            const gained = Math.max(0, Number(target.maxHp || 0) - Number(source.maxHp || 0));
            target.hp = source.fainted
                ? 0
                : Math.min(target.maxHp, Math.max(0, Number(source.hp || 0) + gained));
            target.fainted = Boolean(source.fainted) || target.hp <= 0;
            target.caughtThisRun = Boolean(source.caughtThisRun);
            if (source.status !== undefined) target.status = source.status;
            if (source.statusCondition !== undefined) target.statusCondition = source.statusCondition;
            return target;
        }

        // What a level-up evolution is allowed to produce. The target must be
        // a dex number's canonical entry, so a level-up can never hand out an
        // Alolan Marowak or a Hisuian Typhlosion, and it must have art to draw
        // with. It does NOT have to sit inside the current league's dex:
        // requiring that stranded every line whose next stage belongs to
        // another region, so a Johto-caught Abra stayed an Abra at level 32
        // and Kanto's Tangela could never become Tangrowth.
        canEvolveInto(species) {
            return Boolean(species)
                && Number(species.id) === this.canonicalIdForDexNumber(species.dex_number)
                && species.has_battle_sprite !== false;
        }

        evolveAtLevel(location, index) {
            const pokemon = this.state[location][index];
            const species = this.speciesById.get(Number(pokemon.id));
            const evolution = (species.evolution?.evolves_to || []).find((entry) => (
                entry.trigger === "level-up"
                && Number(entry.condition?.min_level || Infinity) <= pokemon.level
                && this.speciesById.has(Number(entry.target_species_id))
                && this.canEvolveInto(this.speciesById.get(Number(entry.target_species_id)))
            ));
            if (!evolution) return null;
            const targetSpecies = this.speciesById.get(Number(evolution.target_species_id));
            const evolved = this.createPokemon(targetSpecies, pokemon.level);
            this.mergeMoveKnowledge(pokemon, evolved);
            evolved.experience = pokemon.experience;
            evolved.heldItemKey = pokemon.heldItemKey;
            this.preserveBattleCondition(pokemon, evolved);
            this.replacePokemon(location, index, evolved);
            return { from: pokemon.name, to: evolved.name, level: evolved.level };
        }

        // What a single party member earns from a duel. A Pokemon that was
        // actually sent out earns the full award; one that sat on the bench
        // earns the Exp. Share cut, and each knockout adds a little on top.
        //
        // Splitting it this way is the point: an even split kept the whole
        // team at one level forever, which flattened every team-building
        // decision. Now the Pokemon doing the work pull ahead.
        experienceShareFor(pokemon, base) {
            const progression = this.rules.progression;
            // Set by the engine for anything that stood on the field, so a
            // Pokemon that fought and fainted still earns a fighter's share.
            const participated = Boolean(pokemon?.duelParticipated);
            const benchShare = progression.experience_share
                ? Number(progression.bench_experience_share ?? 0.5)
                : 0;
            const share = participated ? 1 : benchShare;
            const knockouts = Number(pokemon?.duelKnockouts || 0);
            const bonus = participated
                ? knockouts * Number(progression.knockout_experience_bonus ?? 0.2)
                : 0;
            return {
                amount: Math.max(0, Math.round(base * (share + bonus))),
                participated,
                knockouts,
            };
        }

        awardExperience() {
            // Hard mode levels slower, so more random trainers fit between the
            // story bosses and there are more chances to fill the dex.
            const modeScale = Number(this.hardModeRules()?.experience_multiplier ?? 1);
            const base = Math.max(1, Math.round((this.rules.progression.base_experience_per_duel
                + (this.state.round - 1) * this.rules.progression.experience_growth_per_duel) * modeScale));
            const changes = [];
            let highest = 0;
            this.state.party.forEach((pokemon, index) => {
                const split = this.experienceShareFor(pokemon, base);
                highest = Math.max(highest, split.amount);
                pokemon.experience = (pokemon.experience || 0) + split.amount;
                const before = pokemon.level;
                const knownBefore = new Set((pokemon.movePool || pokemon.moves || []).map((move) => Number(move.id)));
                while (pokemon.experience >= this.experienceNeeded(pokemon.level)) {
                    pokemon.experience -= this.experienceNeeded(pokemon.level);
                    pokemon.level += 1;
                    const species = this.speciesById.get(Number(pokemon.id));
                    const refreshed = this.createPokemon(species, pokemon.level);
                    this.mergeMoveKnowledge(pokemon, refreshed);
                    refreshed.experience = pokemon.experience;
                    refreshed.heldItemKey = pokemon.heldItemKey;
                    this.preserveBattleCondition(pokemon, refreshed);
                    this.state.party[index] = refreshed;
                    pokemon = refreshed;
                }
                const evolution = this.evolveAtLevel("party", index);
                const current = this.state.party[index];
                // Anything in the pool now that was not there before was
                // learned on the way up, including through an evolution.
                const learnedMoves = (current.movePool || current.moves || [])
                    .filter((move) => !knownBefore.has(Number(move.id)))
                    .map((move) => move.displayName || move.name)
                    .filter(Boolean);
                // Every party member gets a line, so the victory screen can
                // show what each one did rather than only the ones that grew.
                changes.push({
                    name: current.name,
                    previousName: evolution ? evolution.from : null,
                    experience: split.amount,
                    participated: split.participated,
                    knockouts: split.knockouts,
                    fromLevel: before,
                    toLevel: current.level,
                    leveledUp: current.level > before,
                    evolution,
                    learnedMoves,
                });
                // Battle-scoped tallies, cleared once they have been counted.
                current.duelKnockouts = 0;
                current.duelParticipated = false;
            });
            return { amount: highest, base, changes };
        }

        recoverAfterDuel() {
            const recovery = this.rules.between_duel_recovery?.[this.state.mode]
                || this.rules.between_duel_recovery?.normal
                || { heal_hp: true, revive_fainted: true, clear_status: true, restore_pp: true };
            this.state.party.forEach((pokemon) => {
                // A Mega Evolution lasts for the duel only -- put the base
                // form back so the run's party is never left transformed.
                this.revertMega(pokemon);
                // Single-use items are spent for the duel only, matching the
                // between-duel recovery this mode already grants.
                pokemon.heldItemSpent = false;
                if (recovery.revive_fainted && pokemon.fainted) pokemon.fainted = false;
                if (recovery.heal_hp && !pokemon.fainted) {
                    pokemon.hp = pokemon.maxHp;
                } else if (recovery.heal_hp_ratio && !pokemon.fainted) {
                    // Hard mode gives a share of maximum HP back rather than
                    // a full heal, so damage carries between duels but a long
                    // run does not become unwinnable.
                    const restored = Math.max(1, Math.floor(pokemon.maxHp * Number(recovery.heal_hp_ratio)));
                    pokemon.hp = Math.min(pokemon.maxHp, Math.max(1, pokemon.hp) + restored);
                }
                if (recovery.clear_status) {
                    pokemon.status = null;
                    pokemon.statusCondition = null;
                    pokemon.volatileStatus = {};
                    pokemon.pendingMove = null;
                    // Stat stages and toxic counters are battle-scoped state.
                    // BattleEngine mutates party objects in place and never
                    // clears these itself (only a mid-battle switch does), so
                    // without this a Pokemon that stays in for a whole duel
                    // carries any leftover boosts/drops into the next one.
                    pokemon.statStages = {
                        attack: 0,
                        defense: 0,
                        specialAttack: 0,
                        specialDefense: 0,
                        speed: 0,
                        accuracy: 0,
                        evasion: 0,
                    };
                    pokemon.turnsActive = 0;
                    pokemon.toxicCounter = 0;
                }
                if (recovery.restore_pp) {
                    pokemon.moves.forEach((move) => { move.pp = move.maxPp; });
                }
            });
            // Hard mode brings a set number of knocked-out party members back,
            // and the player chooses which. The allowance is left pending on
            // the state so the between-duel screen can prompt for it.
            const allowance = Number(recovery.revive_choice_count || 0);
            const fainted = this.state.party
                .map((pokemon, index) => ({ pokemon, index }))
                .filter(({ pokemon }) => pokemon.fainted);
            this.state.pendingRevival = allowance > 0 && fainted.length
                ? { remaining: Math.min(allowance, fainted.length), ratio: Number(recovery.revive_hp_ratio || 0.5) }
                : null;
            return {
                mode: this.state.mode,
                healedHp: Boolean(recovery.heal_hp),
                healedHpRatio: Number(recovery.heal_hp_ratio || 0),
                revived: Boolean(recovery.revive_fainted),
                clearedStatus: Boolean(recovery.clear_status),
                restoredPp: Boolean(recovery.restore_pp),
                pendingRevival: this.state.pendingRevival ? { ...this.state.pendingRevival } : null,
            };
        }

        // Who the player may bring back with the hard-mode revival allowance.
        revivalChoices() {
            if (!this.state.pendingRevival?.remaining) return [];
            return this.state.party
                .map((pokemon, index) => ({ pokemon, index }))
                .filter(({ pokemon }) => pokemon.fainted);
        }

        reviveAfterDuel(partyIndex) {
            const pending = this.state.pendingRevival;
            if (!pending?.remaining) throw new Error("No revival is available right now.");
            const pokemon = this.state.party[Number(partyIndex)];
            if (!pokemon) throw new Error("Choose a Pokemon from your team.");
            if (!pokemon.fainted) throw new Error(`${pokemon.name} has not fainted.`);
            pokemon.fainted = false;
            pokemon.hp = Math.max(1, Math.floor(pokemon.maxHp * pending.ratio));
            pending.remaining -= 1;
            if (pending.remaining <= 0) this.state.pendingRevival = null;
            return pokemon;
        }

        // Hard mode keeps Potions and Revives for between duels.
        battleHealingBlocked() {
            const recovery = this.rules.between_duel_recovery?.[this.state.mode];
            return Boolean(recovery?.block_battle_healing);
        }

        compatibleEvolutionItemIds(groupName, options) {
            const filter = options || {};
            const group = new Set(this.groupIds[groupName] || []);
            const owned = [...this.state.party, ...this.state.pc]
                .filter((pokemon) => !filter.caughtOnly || pokemon.caughtThisRun);
            const result = new Set();
            owned.forEach((pokemon) => {
                const species = this.speciesById.get(Number(pokemon.id));
                (species.evolution?.evolves_to || []).forEach((entry) => {
                    const itemId = Number(entry.condition?.item_id);
                    const target = this.speciesById.get(Number(entry.target_species_id));
                    if (group.has(itemId) && target && this.inDexRange(target)) result.add(itemId);
                });
            });
            return [...result];
        }

        randomPrice(category) {
            const base = this.rules.shop.price_by_category[category] || 500;
            const variance = this.rules.shop.price_variance;
            const factor = 1 - variance + this.rng() * variance * 2;
            return Math.max(50, Math.round((base * factor) / 50) * 50);
        }

        makeOffer(itemId, category, stock, rarity) {
            const item = this.makeInventoryItem(itemId, category);
            const tier = rarity || this.itemRarity(itemId, category);
            const multiplier = Number(this.rules.shop.price_by_rarity?.[tier]) || 1;
            return {
                offerId: `${this.state.round}-${category}-${item.id}`,
                item,
                category,
                rarity: tier,
                // Rarity, not just category, decides what something costs.
                price: Math.max(1, Math.round(this.randomPrice(category) * multiplier)),
                stock: stock ?? (category === "held" || category === "mega-stone" || category === "evolution" ? 1 : 99),
            };
        }

        chooseUnseen(groupName, seenSet, excludedIds) {
            const excluded = excludedIds || new Set();
            const pool = (this.groupIds[groupName] || []).filter((id) => !seenSet.has(id) && !excluded.has(id));
            if (!pool.length) return null;
            const id = pool[Math.floor(this.rng() * pool.length)];
            seenSet.add(id);
            return id;
        }

        // How many things are on sale this round.
        shopSlotCount(round) {
            const shop = this.rules.shop;
            const schedule = [...(shop.slots_by_round || [])]
                .sort((left, right) => Number(left.from_duel) - Number(right.from_duel));
            if (!schedule.length) return Number(shop.offer_count) || 5;
            let slots = Number(schedule[0].slots) || 3;
            schedule.forEach((entry) => {
                if (Number(round) >= Number(entry.from_duel)) slots = Number(entry.slots);
            });
            return slots;
        }

        // The rarity mix on offer this round.
        shopRarityWeights(round) {
            const shop = this.rules.shop;
            const schedule = [...(shop.rarity_weights_by_round || [])]
                .sort((left, right) => Number(left.from_duel) - Number(right.from_duel));
            let weights = { common: 100, uncommon: 0, rare: 0, epic: 0 };
            schedule.forEach((entry) => {
                if (Number(round) >= Number(entry.from_duel)) weights = entry.weights;
            });
            return weights;
        }

        rollRarity(round) {
            const weights = this.shopRarityWeights(round);
            const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);
            const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
            let roll = this.rng() * total;
            for (const [tier, weight] of entries) {
                roll -= Number(weight);
                if (roll <= 0) return tier;
            }
            return entries.length ? entries[0][0] : "common";
        }

        itemRarity(itemId, category) {
            const table = this.rules.shop.item_rarity || {};
            // Hard mode lets a boss Mega Evolve 75% of the time. Leaving the
            // player's own stones at epic -- a tier rolled under 5% of the
            // shop slots -- meant facing Megas constantly while almost never
            // being offered one, so hard mode may soften a category's tier.
            const hardTable = this.state.mode === "hard" ? (this.rules.hard_mode?.item_rarity || {}) : {};
            let forCategory = hardTable[category] ?? table[category];
            // The Stone Magnet drops Mega Stones one rarity tier shopwide.
            if (category === "mega-stone" && this.metaPerks.stoneMagnet && typeof forCategory === "string") {
                const ladder = ["epic", "rare", "uncommon", "common"];
                const index = ladder.indexOf(forCategory);
                if (index >= 0 && index < ladder.length - 1) forCategory = ladder[index + 1];
            }
            if (typeof forCategory === "string") return forCategory;
            if (forCategory && forCategory[String(itemId)]) return forCategory[String(itemId)];
            if (category === "held") {
                const raw = this.itemsById.get(Number(itemId));
                const registry = (typeof globalThis !== "undefined" ? globalThis : window).PokemonHeldItems;
                return registry?.rarityOf(raw?.slug) || "common";
            }
            return "common";
        }

        // Everything the shop could stock this round, tagged with rarity.
        shopCandidates(round) {
            const shop = this.rules.shop;
            const candidates = [];
            const push = (id, category) => {
                candidates.push({ id, category, rarity: this.itemRarity(id, category) });
            };
            this.availableItemIds("capture", shop.general_capture_item_ids).forEach((id) => push(id, "capture"));
            this.availableItemIds("healing", shop.general_healing_item_ids).forEach((id) => push(id, "healing"));

            // Only stock held items the battle engine actually reads -- the
            // group has 344 members but the vast majority have no effect, so
            // selling from the raw group meant selling mostly inert objects.
            const registry = (typeof globalThis !== "undefined" ? globalThis : window).PokemonHeldItems;
            const sellable = new Set(registry ? registry.sellableSlugs() : []);
            const megaSet = new Set(this.groupIds["mega-stones"] || []);
            (this.groupIds["held-items"] || []).forEach((id) => {
                if (megaSet.has(id)) return;
                const raw = this.itemsById.get(Number(id));
                if (!raw || !sellable.has(raw.slug)) return;
                push(id, "held");
            });

            this.compatibleEvolutionItemIds("evolution-items", { caughtOnly: true })
                .forEach((id) => push(id, "evolution"));

            if (Number(round) >= Number(shop.mega_stones_from_duel || 0)) {
                this.compatibleEvolutionItemIds("mega-stones")
                    .filter((id) => !this.state.seenMegaStoneIds.has(id))
                    .forEach((id) => push(id, "mega-stone"));
            }
            return candidates;
        }

        generateShopOffers() {
            const shop = this.rules.shop;
            const round = this.state.round;
            const slots = this.shopSlotCount(round);
            const candidates = this.shopCandidates(round);
            const used = new Set();
            const offers = [];

            const perCategory = {};
            const caps = shop.max_per_category || {};
            const weights = shop.category_weights || {};
            const take = (pool) => {
                const available = pool.filter((entry) => !used.has(entry.id)
                    && (perCategory[entry.category] || 0) < (caps[entry.category] ?? Infinity));
                if (!available.length) return null;
                // Pick the category first, by weight, then an item inside it.
                // Otherwise the ~55 sellable held items drown out the three
                // Poke Balls and the shop stops selling what players need.
                const byCategory = new Map();
                available.forEach((entry) => {
                    if (!byCategory.has(entry.category)) byCategory.set(entry.category, []);
                    byCategory.get(entry.category).push(entry);
                });
                const categories = [...byCategory.keys()];
                const total = categories.reduce((sum, name) => sum + (Number(weights[name]) || 1), 0);
                let roll = this.rng() * total;
                let picked = categories[categories.length - 1];
                for (const name of categories) {
                    roll -= Number(weights[name]) || 1;
                    if (roll <= 0) { picked = name; break; }
                }
                const bucket = byCategory.get(picked);
                const choice = bucket[Math.floor(this.rng() * bucket.length)];
                used.add(choice.id);
                perCategory[choice.category] = (perCategory[choice.category] || 0) + 1;
                if (choice.category === "mega-stone") this.state.seenMegaStoneIds.add(choice.id);
                if (choice.category === "held") this.state.seenHeldItemIds.add(choice.id);
                return this.makeOffer(choice.id, choice.category, undefined, choice.rarity);
            };

            // A shop with nothing to heal with is useless, so those slots are
            // reserved before rarity gets a say.
            (shop.guaranteed_categories || []).forEach((category) => {
                if (offers.length >= slots) return;
                const offer = take(candidates.filter((entry) => entry.category === category));
                if (offer) offers.push(offer);
            });

            // Remaining slots roll a rarity and pick within it, falling back
            // down the tiers when a rarity has nothing left to give.
            const ladder = ["epic", "rare", "uncommon", "common"];
            while (offers.length < slots) {
                const wanted = this.rollRarity(round);
                const order = [wanted, ...ladder.filter((tier) => tier !== wanted)];
                let offer = null;
                for (const tier of order) {
                    offer = take(candidates.filter((entry) => entry.rarity === tier));
                    if (offer) break;
                }
                if (!offer) break;
                offers.push(offer);
            }

            this.state.shopOffers = offers.slice(0, slots);
            return this.state.shopOffers;
        }

        // What the next restock costs. It climbs with the round so it keeps
        // pace with prize money, and again with each restock in the same visit
        // so a rich player cannot spin the counter until a Mega Stone appears.
        shopRefreshFee() {
            const refresh = this.rules.shop.refresh;
            if (!refresh) return 0;
            const base = Number(refresh.fee_base || 0);
            if (base <= 0) return 0;
            const perDuel = base + (this.state.round - 1) * Number(refresh.fee_growth_per_duel || 0);
            const step = Number(refresh.fee_multiplier_per_use || 1);
            return Math.round(perDuel * (step ** Number(this.state.shopRefreshes || 0)));
        }

        canRefreshShop() {
            const fee = this.shopRefreshFee();
            return fee > 0 && this.state.money >= fee;
        }

        // Pay to put a fresh set of goods on the counter.
        refreshShopOffers() {
            const fee = this.shopRefreshFee();
            if (fee <= 0) throw new Error("This counter does not restock.");
            if (this.state.money < fee) {
                throw new Error(`You need ₽${fee - this.state.money} more to restock the counter.`);
            }
            const before = this.state.shopOffers.map((offer) => offer.item.id).sort().join(",");
            this.state.money -= fee;
            this.state.shopRefreshes = Number(this.state.shopRefreshes || 0) + 1;
            // Paying for the same shelf back would feel like a swindle, so a
            // roll that changes nothing is re-rolled a few times before giving
            // up -- late shops can be drawing from a nearly exhausted pool.
            for (let attempt = 0; attempt < 4; attempt += 1) {
                this.generateShopOffers();
                const after = this.state.shopOffers.map((offer) => offer.item.id).sort().join(",");
                if (after !== before) break;
            }
            return { fee, offers: this.state.shopOffers, nextFee: this.shopRefreshFee() };
        }

        completeDuel() {
            const rewardRules = this.rules.duel_rewards;
            const money = rewardRules.money_base + (this.state.round - 1) * rewardRules.money_growth_per_duel;
            const legacy = rewardRules.legacy_base + Math.floor((this.state.round - 1) / rewardRules.legacy_growth_every);
            this.state.money += money;
            this.state.legacy += legacy;
            this.state.wins += 1;
            const drops = this.rewardDrops();
            const experience = this.awardExperience();
            const recovery = this.recoverAfterDuel();
            const progressionChanges = this.updateRoundProgress();
            const shop = this.generateShopOffers();
            this.state.lastReward = { money, legacy, drops, experience, recovery, progressionChanges, shop };
            return this.state.lastReward;
        }

        buyOffer(offerId) {
            const offer = this.state.shopOffers.find((entry) => entry.offerId === offerId);
            if (!offer || offer.stock <= 0) throw new Error("That offer is sold out.");
            if (this.state.money < offer.price) throw new Error("Not enough money.");
            this.state.money -= offer.price;
            this.addInventoryById(offer.item.id, 1, offer.category);
            if (offer.stock !== 99) offer.stock -= 1;
            return offer.item;
        }

        // Using a Potion or Revive from the Bag between duels. This is the
        // sustain hard mode's rules promise -- battle healing is blocked
        // there, so the space between rounds is where the Bag earns its
        // keep. Normal mode rarely needs it, but it works there too.
        useItemFromBag(itemKey, location, index) {
            if (this.state.wildEncounter) throw new Error("Finish the encounter first.");
            const item = this.state.inventory[itemKey];
            if (!item || item.quantity <= 0) throw new Error("That item is not in the Bag.");
            const effect = item.effect;
            if (!effect || (effect.type !== "heal" && effect.type !== "revive")) {
                throw new Error("That item cannot be used from the Bag.");
            }
            const list = location === "pc" ? this.state.pc : this.state.party;
            const pokemon = list[index];
            if (!pokemon) throw new Error("Choose a Pokemon to use it on.");
            if (effect.type === "revive") {
                if (!pokemon.fainted) throw new Error(`${pokemon.name} is still standing.`);
                pokemon.fainted = false;
                pokemon.hp = Math.max(1, Math.floor(pokemon.maxHp * Number(effect.ratio || 0.5)));
            } else {
                if (pokemon.fainted) throw new Error(`${pokemon.name} needs a Revive first.`);
                if (pokemon.hp >= pokemon.maxHp) throw new Error(`${pokemon.name} is already at full HP.`);
                const amount = effect.ratio
                    ? Math.max(1, Math.floor(pokemon.maxHp * Number(effect.ratio)))
                    : Math.max(1, Number(effect.amount || 0));
                pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + amount);
            }
            item.quantity -= 1;
            return { pokemon, item };
        }

        sellItem(itemKey, quantity) {
            const item = this.state.inventory[itemKey];
            const count = Math.max(1, Number(quantity) || 1);
            if (!item || item.quantity < count) throw new Error("That quantity is not available.");
            item.quantity -= count;
            const earned = item.sellPrice * count;
            this.state.money += earned;
            return earned;
        }

        evolutionForItem(pokemon, itemId, groupName) {
            const group = new Set(this.groupIds[groupName] || []);
            if (!group.has(Number(itemId))) return null;
            const species = this.speciesById.get(Number(pokemon.id));
            return (species.evolution?.evolves_to || []).find((entry) => {
                const target = this.speciesById.get(Number(entry.target_species_id));
                return Number(entry.condition?.item_id) === Number(itemId) && target && this.inDexRange(target);
            }) || null;
        }

        // --- held items -------------------------------------------------
        // Nothing could hold an item before this: heldItemKey was only ever
        // set to null or copied between forms, so every held item and mega
        // stone the shop sold was inert.
        setHeldItem(itemKey, location, index) {
            const item = this.state.inventory[itemKey];
            const pokemon = this.state[location]?.[index];
            if (!item || item.quantity <= 0 || !pokemon) throw new Error("That item cannot be given.");
            if (item.category !== "held" && item.category !== "mega-stone") {
                throw new Error(`${item.name} is not a held item.`);
            }
            const previous = pokemon.heldItemKey;
            if (previous === itemKey) throw new Error(`${pokemon.name} is already holding that.`);
            if (previous) this.returnHeldItemToBag(previous);
            pokemon.heldItemKey = itemKey;
            item.quantity -= 1;
            if (item.quantity <= 0) delete this.state.inventory[itemKey];
            return { pokemon: pokemon.name, item: item.name, replaced: previous };
        }

        clearHeldItem(location, index) {
            const pokemon = this.state[location]?.[index];
            if (!pokemon?.heldItemKey) throw new Error("That Pokemon is not holding anything.");
            const key = pokemon.heldItemKey;
            pokemon.heldItemKey = null;
            this.returnHeldItemToBag(key);
            return { pokemon: pokemon.name, item: key };
        }

        returnHeldItemToBag(itemKey) {
            const id = this.itemIdBySlug().get(itemKey);
            if (Number.isFinite(id)) this.addInventoryById(id, 1);
        }

        // Inventory is keyed by item slug; the raw table is keyed by id.
        itemIdBySlug() {
            if (!this.slugToItemId) {
                this.slugToItemId = new Map();
                this.itemsById.forEach((raw, id) => { this.slugToItemId.set(raw.slug, Number(id)); });
            }
            return this.slugToItemId;
        }

        itemByKey(itemKey) {
            const id = this.itemIdBySlug().get(itemKey);
            if (!Number.isFinite(id)) return null;
            const raw = this.itemsById.get(id);
            if (!raw) return null;
            return {
                id,
                key: itemKey,
                name: raw.name,
                description: raw.description || "",
                category: this.itemCategory(id),
            };
        }

        // Undo a Mega Evolution, keeping level, experience, moves and the
        // stone. HP is carried across as a fraction so a hurt Pokemon stays
        // hurt rather than being quietly healed by reverting.
        revertMega(pokemon) {
            const base = pokemon?.baseForm;
            if (!base) return false;
            const fraction = pokemon.maxHp > 0 ? pokemon.hp / pokemon.maxHp : 1;
            pokemon.id = base.id;
            pokemon.key = base.key;
            pokemon.name = base.name;
            pokemon.types = [...base.types];
            pokemon.stats = { ...base.stats };
            pokemon.maxHp = base.maxHp;
            pokemon.hp = Math.max(0, Math.min(base.maxHp, Math.round(base.maxHp * fraction)));
            if (base.ability) pokemon.ability = { ...base.ability };
            pokemon.sprites = { ...base.sprites };
            pokemon.baseForm = null;
            pokemon.megaEvolved = false;
            return true;
        }

        // The mega form a Pokemon would reach with what it is holding, or null.
        megaTargetFor(pokemon) {
            if (!pokemon?.heldItemKey) return null;
            const record = this.itemByKey(pokemon.heldItemKey);
            if (!record || record.category !== "mega-stone") return null;
            const evolution = this.evolutionForItem(pokemon, record.id, "mega-stones");
            if (!evolution) return null;
            const species = this.speciesById.get(Number(evolution.target_species_id));
            return species ? { species, stone: record } : null;
        }

        useEvolutionItem(itemKey, location, index) {
            const item = this.state.inventory[itemKey];
            const pokemon = this.state[location]?.[index];
            if (!item || item.quantity <= 0 || !pokemon) throw new Error("That item cannot be used.");
            // Mega stones are held, not consumed -- the transformation now
            // happens in battle and reverts afterwards.
            if (item.category === "mega-stone") {
                throw new Error(`${item.name} must be given to a Pokemon to hold.`);
            }
            const evolution = this.evolutionForItem(pokemon, item.id, "evolution-items");
            if (!evolution) throw new Error(`${item.name} has no use for that Pokemon.`);
            const targetSpecies = this.speciesById.get(Number(evolution.target_species_id));
            const evolved = this.createPokemon(targetSpecies, pokemon.level);
            this.mergeMoveKnowledge(pokemon, evolved);
            evolved.experience = pokemon.experience;
            evolved.heldItemKey = pokemon.heldItemKey;
            this.preserveBattleCondition(pokemon, evolved);
            this.state[location][index] = evolved;
            item.quantity -= 1;
            return { from: pokemon.name, to: evolved.name };
        }

        wildFee() {
            const rules = this.rules.wild_encounter;
            return rules.fee_base + (this.state.round - 1) * rules.fee_growth_per_duel;
        }

        // Areas follow story progress, not the duel counter. Gating them on the
        // raw round meant the two clocks ran at different speeds: the duel count
        // climbs every fight while a badge needs several, so the map raced ahead
        // and pinned itself to the last area for most of the run.
        areaGate(area) {
            return area.from_milestone === undefined
                ? { at: Number(area.from_round), now: this.state.round }
                : { at: Number(area.from_milestone), now: this.state.storyMilestoneIndex };
        }

        currentWildArea() {
            const rules = this.rules.wild_encounter;
            const configured = [...(rules.area_progression || [])]
                .sort((left, right) => this.areaGate(left).at - this.areaGate(right).at);
            let selected = configured[0] || null;
            configured.forEach((area) => {
                const gate = this.areaGate(area);
                if (gate.now >= gate.at) selected = area;
            });
            if (!selected) {
                return {
                    id: "kanto-wilds",
                    name: "Kanto Wilds",
                    shortName: "Kanto Wilds",
                    species: this.progressionSpeciesPool(rules.excluded_tags),
                };
            }
            const species = this.configuredWildSpecies(selected.species_ids)
                .filter((pokemon) => !this.hasExcludedTag(pokemon, rules.excluded_tags));
            return {
                id: selected.id,
                name: selected.name,
                shortName: selected.short_name || selected.name,
                fromMilestone: Number(this.areaGate(selected).at),
                species: species.length ? species : this.progressionSpeciesPool(rules.excluded_tags),
            };
        }

        chooseWildSpecies(areaOverride) {
            const rules = this.rules.wild_encounter;
            const progression = this.progressionRules();
            const roll = this.rng();
            const mewId = Number(progression.mew_species_id);
            const mew = this.baseSpecies.find((pokemon) => Number(pokemon.id) === mewId);
            const mewChance = this.progress.mewWildUnlocked && mew ? Number(rules.mew_chance || 0) : 0;
            if (mewChance > 0 && roll < mewChance) return mew;

            // Mythicals belong in the rare pool too, minus the one holding the
            // league's own ultra-rare slot above. Hoenn has two -- Jirachi
            // takes the slot, so tagging on "legendary" alone left Deoxys with
            // no way into the game at all.
            const legendaryPool = this.baseSpecies.filter((pokemon) => {
                if (Number(pokemon.id) === mewId) return false;
                const tags = pokemon.tags || [];
                return tags.includes("legendary") || tags.includes("mythical");
            });
            const legendaryChanceByMode = rules.legendary_chance_by_mode || {};
            const configuredLegendaryChance = legendaryChanceByMode[this.state.mode] ?? rules.legendary_chance ?? 0;
            const legendaryChance = this.progress.legendaryWildUnlocked ? Number(configuredLegendaryChance) : 0;
            if (legendaryChance > 0 && legendaryPool.length && roll < mewChance + legendaryChance) {
                return legendaryPool[Math.floor(this.rng() * legendaryPool.length)];
            }

            const area = areaOverride || this.currentWildArea();
            const pool = area.species;
            return pool[Math.floor(this.rng() * pool.length)];
        }

        startWildEncounter() {
            if (this.state.wildEncounter || this.state.pendingCapture) throw new Error("A wild encounter is already active.");
            if (this.state.wildEncounterUsed) throw new Error("The wild encounter for this round has already been used.");
            const fee = this.wildFee();
            if (this.state.money < fee) throw new Error(`You need ₽${fee - this.state.money} more for this encounter.`);
            this.state.money -= fee;
            this.state.wildEncounterUsed = true;
            this.recordUsedSpecies(this.state.party);
            const area = this.currentWildArea();
            const species = this.chooseWildSpecies(area);
            const level = Math.max(2, Math.floor(this.averagePartyLevel() - this.rules.wild_encounter.level_lag));
            const pokemon = this.createPokemon(species, level);
            const tags = new Set(species.tags || []);
            const mewId = Number(this.progressionRules().mew_species_id);
            const rareKind = Number(species.id) === mewId ? "mew" : (tags.has("legendary") ? "legendary" : null);
            this.state.wildEncounter = {
                pokemon,
                fee,
                attempts: 0,
                area: { id: area.id, name: area.name, shortName: area.shortName },
                rareKind,
            };
            return this.state.wildEncounter;
        }

        catchChance(pokemon, modifier) {
            const species = this.speciesById.get(Number(pokemon.id));
            const total = Number(species.base_stats?.total || 400);
            const base = clamp(0.78 - Math.max(0, total - 250) / 950, 0.22, 0.78);
            return clamp(base * modifier, 0.05, 0.98);
        }

        tryCatch(itemKey) {
            const encounter = this.state.wildEncounter;
            const item = this.state.inventory[itemKey];
            if (!encounter) throw new Error("There is no wild Pokemon here.");
            if (!item || item.category !== "capture" || item.quantity <= 0) throw new Error("That Poke Ball is unavailable.");
            item.quantity -= 1;
            encounter.attempts += 1;
            const chance = item.catchModifier >= 99 ? 1 : this.catchChance(encounter.pokemon, item.catchModifier);
            const roll = this.rng();
            const caught = roll < chance;
            const shakes = caught ? 3 : clamp(Math.floor((chance / Math.max(roll, 0.0001)) * 3), 0, 2);
            if (caught) {
                encounter.pokemon.hp = encounter.pokemon.maxHp;
                encounter.pokemon.fainted = false;
                encounter.pokemon.caughtThisRun = true;
                this.recordCaughtSpecies(encounter.pokemon);
                this.state.pendingCapture = encounter.pokemon;
                this.state.wildEncounter = null;
            }
            return { caught, chance, shakes, pokemon: encounter.pokemon, ball: item.name };
        }

        leaveWildEncounter() {
            this.state.wildEncounter = null;
        }

        // A wild encounter costs HP and nothing else. The battle engine
        // clears its own battle-scoped state; this clears what the engine
        // deliberately leaves alone -- status conditions and spent PP -- so
        // only the health bar remembers the encounter.
        settleAfterWildEncounter() {
            this.state.party.forEach((pokemon) => {
                // A wild battle ends like any other: the form goes back. Only
                // the duel path reverted it, so Mega Evolving against a wild
                // Pokemon left the party member transformed for the rest of
                // the run -- and, since it still counted as Mega Evolved, it
                // could never transform again.
                this.revertMega(pokemon);
                pokemon.heldItemSpent = false;
                pokemon.volatileStatus = {};
                pokemon.pendingMove = null;
                pokemon.statusCondition = null;
                pokemon.statusTurns = 0;
                pokemon.toxicCounter = 0;
                (pokemon.moves || []).forEach((move) => { move.pp = move.maxPp; });
            });
        }

        storeCapturedPokemon(destination) {
            const pokemon = this.state.pendingCapture;
            if (!pokemon) throw new Error("There is no captured Pokemon to store.");
            if (destination === "party") {
                if (this.state.party.length >= this.rules.league.battle_format.maximum_party_size) throw new Error("The party is full.");
                this.state.party.push(pokemon);
            } else if (destination === "pc") {
                this.state.pc.push(pokemon);
            } else {
                throw new Error("Choose the party or PC.");
            }
            this.state.pendingCapture = null;
            return pokemon;
        }

        movePokemonFromPc(pcIndex, partyIndex) {
            const stored = this.state.pc[pcIndex];
            if (!stored) throw new Error("That PC Pokemon is unavailable.");
            const maximum = this.rules.league.battle_format.maximum_party_size;
            if (this.state.party.length < maximum && (partyIndex === undefined || partyIndex === null)) {
                this.state.pc.splice(pcIndex, 1);
                this.state.party.push(stored);
                return { added: stored, swapped: null };
            }
            const active = this.state.party[partyIndex];
            if (!active) throw new Error("Choose a team Pokemon to swap.");
            this.state.party[partyIndex] = stored;
            this.state.pc[pcIndex] = active;
            return { added: stored, swapped: active };
        }

        beginNextDuel() {
            if (this.state.leagueComplete) throw new Error(`${this.rules.league.name} is complete. Choose the next league or start Hard Mode.`);
            const living = this.state.party.filter((pokemon) => !pokemon.fainted);
            if (living.length < this.rules.league.battle_format.active_per_side) throw new Error("Heal at least two Pokemon before the next duel.");
            this.state.party = [...living, ...this.state.party.filter((pokemon) => pokemon.fainted)];
            this.state.round += 1;
            this.state.shopOffers = [];
            this.state.shopRefreshes = 0;
            this.state.wildEncounter = null;
            // A capture still awaiting its "party or PC?" answer is filed to
            // the PC rather than dropped. Clearing it outright meant that if
            // anything interrupted the prompt, the Pokemon the player had just
            // earned disappeared from the run entirely.
            if (this.state.pendingCapture) {
                this.state.pc.push(this.state.pendingCapture);
                this.state.pendingCapture = null;
            }
            this.state.wildEncounterUsed = false;
            this.recordUsedSpecies(this.state.party);
            return this.prepareDuel();
        }
    }

    return { LeagueRun };
}));
