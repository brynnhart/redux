import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { parseClientMessage } from './protocol.js';
import { getDbPath } from './db/db.js';
import { runMigrations } from './db/migrate.js';
import { PlayerRepo } from './repos/playerRepo.js';
import { AuthService } from './services/authService.js';
import { DayService } from './services/dayService.js';
import { NewsService } from './services/newsService.js';
import { ForestService } from './services/forestService.js';
import { BankService } from './services/bankService.js';
import { HealerService } from './services/healerService.js';
import { EquipmentService } from './services/equipmentService.js';
import { commitPrompt, createSession, resetDraft, setScreen, startPrompt } from './session.js';
import { renderWelcome } from './screens/welcome.js';
import { renderLogin } from './screens/login.js';
import { renderNewCharacter } from './screens/newCharacter.js';
import { renderTownSquare } from './screens/townSquare.js';
import { renderDailyHappenings } from './screens/dailyHappenings.js';
import { renderForest } from './screens/forest.js';
import { renderBank } from './screens/bank.js';
import { renderHealer } from './screens/healer.js';
import { renderWeaponsShop } from './screens/weaponsShop.js';
import { renderArmorShop } from './screens/armorShop.js';
import { renderInn, renderInnBartender, renderInnBreakIn, renderInnConverse } from './screens/inn.js';
import { renderSlaughterFields } from './screens/slaughter.js';
import { renderTraining } from './screens/training.js';
import { handleNavigationHelperInput, isNavigationHelperScreen, renderNavigationHelperScreen } from './screens/navigationHelpers.js';
import { InnService } from './services/innService.js';
import { trainClassSkillPatch } from './services/skillService.js';
import { challengeMaster, getMasterForLevel, isEligibleForMasterChallenge, levelUpHpGain } from './services/trainingService.js';
import { renderHallOfHonor } from './screens/hallOfHonor.js';
import { renderHeroicDeedsRankings, renderOldManMenu, renderOldManTopList, renderPlayerRankings } from './screens/leaderboard.js';
import { config } from './config.js';
import { PvpService } from './services/pvpService.js';
import { getDayIndexFromDayKey, getTodayDayKey } from './services/dayKey.js';
const app = Fastify({ logger: true });
const playerRepo = new PlayerRepo();
const authService = new AuthService();
const newsService = new NewsService();
const dayService = new DayService(playerRepo, newsService);
const forestService = new ForestService(playerRepo, newsService);
const bankService = new BankService(playerRepo);
const healerService = new HealerService(playerRepo);
const equipmentService = new EquipmentService(playerRepo);
const innService = new InnService(playerRepo, newsService);
const pvpService = new PvpService(playerRepo, newsService);
runMigrations();
app.log.info({ dbPath: getDbPath() }, 'Migrations complete');
await app.register(websocket);
await app.register(fastifyStatic, {
    root: new URL('../public/', import.meta.url),
    prefix: '/'
});
app.get('/', (_request, reply) => {
    reply.sendFile('index.html');
});
app.get('/api/leaderboard/players', (request, reply) => {
    const limit = Math.min(200, Math.max(1, Number(request.query.limit ?? '50') || 50));
    reply.send({ rows: playerRepo.listPlayerRankings(limit) });
});
app.get('/api/leaderboard/deeds', (request, reply) => {
    const limit = Math.min(200, Math.max(1, Number(request.query.limit ?? '50') || 50));
    reply.send({ rows: playerRepo.listHeroicDeedsRankings(limit) });
});
app.get('/api/leaderboard/oldman', (request, reply) => {
    const query = request.query;
    const category = (query.category ?? 'kills');
    if (!['kills', 'laid', 'dragons', 'bank', 'strongest'].includes(category)) {
        reply.code(400).send({ error: 'Invalid category' });
        return;
    }
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? '10') || 10));
    reply.send({ rows: playerRepo.listOldManTop(category, limit) });
});
app.get('/api/news/today', (request, reply) => {
    const dayKey = request.query.dayKey ?? getTodayDayKey();
    const limit = Math.min(50, Math.max(1, Number(request.query.limit ?? '30') || 30));
    const day = getDayIndexFromDayKey(dayKey);
    reply.send({ day, dayKey, rows: newsService.getDailyNews(day, limit, 0) });
});
app.get('/api/news/day/:day', (request, reply) => {
    const params = request.params;
    const day = Number(params.day);
    if (!Number.isInteger(day) || day < 0) {
        reply.code(400).send({ error: 'Invalid day' });
        return;
    }
    const query = request.query;
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? '50') || 50));
    const offset = Math.max(0, Number(query.offset ?? '0') || 0);
    reply.send({ day, rows: newsService.getDailyNews(day, limit, offset) });
});
function refreshPlayer(session) {
    if (!session.playerId) {
        session.player = undefined;
        return;
    }
    session.player = playerRepo.findById(session.playerId) ?? undefined;
}
function loadDailyNews(session, dayKey, offset = session.dailyNewsOffset) {
    const day = getDayIndexFromDayKey(dayKey);
    session.dailyNewsOffset = Math.max(0, offset);
    session.dailyNews = newsService.getDailyNews(day, 30, session.dailyNewsOffset);
    session.dailyNewsHasMore = newsService.hasMoreDailyNews(day, session.dailyNewsOffset, 30);
    session.todayDate = dayKey;
    session.todayDayNumber = day;
}
function handlePostLogin(session, playerId, displayName) {
    session.playerId = playerId;
    const { didReset, todayDayKey, spirits } = dayService.ensureDailyReset(playerId);
    newsService.addNews(todayDayKey, `${displayName} has logged in.`, { severity: 'info' });
    refreshPlayer(session);
    session.dailyNewsOffset = 0;
    loadDailyNews(session, todayDayKey, 0);
    session.pendingNewDaySpirits = didReset ? spirits : undefined;
    setScreen(session, config.enableDailyNewsAutoShow ? 'DAILY_HAPPENINGS' : 'TOWN_SQUARE');
    if (didReset) {
        const spiritText = spirits ?? session.player?.spirits ?? 'NORMAL';
        session.notice = `You wake up early, strap your weapon to your back, and head for the Town Square... You are in ${spiritText} spirits today. Press [Enter] to continue...`;
    }
    else {
        session.notice = config.enableDailyNewsAutoShow ? 'Press [Enter] to continue...' : 'Welcome to town.';
    }
}
function beginLogin(session) {
    setScreen(session, 'LOGIN');
    resetDraft(session);
    session.notice = 'Enter username.';
    startPrompt(session, 'username');
}
function beginNewCharacter(session) {
    setScreen(session, 'NEW_CHARACTER');
    resetDraft(session);
    session.notice = 'Choose a username.';
    startPrompt(session, 'username');
}
function enterForest(session) {
    if (!session.player || !session.playerId) {
        session.notice = 'No player loaded.';
        return;
    }
    const { todayDayKey } = dayService.ensureDailyReset(session.playerId);
    refreshPlayer(session);
    session.dailyNewsOffset = 0;
    loadDailyNews(session, todayDayKey, 0);
    if ((session.player?.turns_forest_left ?? 0) <= 0) {
        setScreen(session, 'TOWN_SQUARE');
        session.notice = 'You are too tired. Come back tomorrow.';
        return;
    }
    setScreen(session, 'FOREST');
    session.notice = 'You enter the Forest. It smells like danger and cabbage.';
}
function returnToTown(session, message = 'You return to town.') {
    setScreen(session, 'TOWN_SQUARE');
    session.notice = message;
}
function oldManCategoryFromInput(input) {
    if (input === '1')
        return 'kills';
    if (input === '2')
        return 'laid';
    if (input === '3')
        return 'dragons';
    if (input === '4')
        return 'bank';
    if (input === '5')
        return 'strongest';
    return null;
}
function shouldUseLineInput(session) {
    if (!session.playerId)
        return false;
    return session.state === 'DAILY_HAPPENINGS' || isNavigationHelperScreen(session.state);
}
function applyNavigationHelperTransition(session, transition, close) {
    if (transition.type === 'logout') {
        close();
        return;
    }
    if (transition.type === 'goto') {
        setScreen(session, transition.screenId);
        session.notice = transition.notice ?? '';
        return;
    }
    if (transition.type === 'stay') {
        if (transition.notice) {
            session.notice = transition.notice;
        }
        return;
    }
    if (transition.type === 'error') {
        session.notice = transition.message ?? 'Huh?';
        return;
    }
    if (!session.player) {
        session.notice = 'No player loaded.';
        return;
    }
    const patch = transition.patch ?? {};
    const onHand = session.player.gold_on_hand;
    const nextGold = Math.max(0, onHand + (patch.gold_on_hand ?? 0));
    const nextGems = Math.max(0, (session.player.gems ?? 0) + (patch.gems ?? 0));
    const nextCharm = Math.max(0, (session.player.charm ?? 0) + (patch.charm ?? 0));
    const nextHp = Math.max(1, Math.min(session.player.hp_max, session.player.hp + (patch.hp ?? 0)));
    playerRepo.updatePlayerStats(session.player.id, {
        gold_on_hand: nextGold,
        gems: nextGems,
        charm: nextCharm,
        hp: nextHp
    });
    refreshPlayer(session);
    session.notice = transition.notice;
}
function enterInn(session) {
    if (!session.player || !session.playerId) {
        session.notice = 'No player loaded.';
        return;
    }
    const { todayDayKey } = dayService.ensureDailyReset(session.playerId);
    refreshPlayer(session);
    session.dailyNewsOffset = 0;
    loadDailyNews(session, todayDayKey, 0);
    setScreen(session, 'INN');
    session.notice = 'The Sleeping Dragon hums with wagers, whispers, and trouble-for-hire.';
}
function enterTraining(session) {
    if (!session.player || !session.playerId) {
        session.notice = 'No player loaded.';
        return;
    }
    const { todayDayKey } = dayService.ensureDailyReset(session.playerId);
    refreshPlayer(session);
    session.dailyNewsOffset = 0;
    loadDailyNews(session, todayDayKey, 0);
    setScreen(session, 'TRAINING');
    session.notice = "Turgon's hall answers with steel on steel. Respect the floor or bleed on it.";
}
function enterSlaughterFields(session) {
    if (!session.player || !session.playerId) {
        session.notice = 'No player loaded.';
        return;
    }
    const { todayDayKey } = dayService.ensureDailyReset(session.playerId);
    refreshPlayer(session);
    session.dailyNewsOffset = 0;
    loadDailyNews(session, todayDayKey, 0);
    session.pvpFieldsTargets = playerRepo.listFieldsTargets(session.playerId);
    session.pvpEncounter = undefined;
    session.pvpTargetSelection = undefined;
    setScreen(session, 'SLAUGHTER_FIELDS');
    session.notice = 'You scan the Warfield for potential victims...';
}
function trainingQuestionMessage(session) {
    if (!session.player) {
        return 'No player loaded.';
    }
    const master = getMasterForLevel(session.player.level);
    if (!master) {
        return 'Turgon nods once. "No masters remain. Only the Dragon."';
    }
    const eligibility = isEligibleForMasterChallenge(session.player);
    if (eligibility.eligible) {
        return `${master.name} says: You carry enough scars to be tested. Step into the circle and prove your rank.`;
    }
    if (eligibility.requiredExp === null) {
        return `${master.name} says: This hall has taught you all it can. Seek your lesson in dragonfire.`;
    }
    return `${master.name} says: Not yet. Earn ${eligibility.expNeeded} more experience, then ask me again with steadier hands.`;
}
function resolveMasterChallenge(session, todayDayKey) {
    if (!session.player) {
        return 'No player loaded.';
    }
    if (session.player.training_challenge_used_today) {
        return 'Turgon points to the blood-slick ring: one master challenge per day. Return at dawn.';
    }
    const master = getMasterForLevel(session.player.level);
    if (!master) {
        return 'No master remains at your rank. The next judge is the Dragon.';
    }
    const eligibility = isEligibleForMasterChallenge(session.player);
    if (!eligibility.eligible) {
        return 'The hall denies you. You have not earned the rite.';
    }
    const result = challengeMaster(session.player, master);
    const rounds = [master.flavor_intro, ...result.rounds];
    const patch = {
        training_challenge_used_today: 1
    };
    if (result.playerWon) {
        const nextLevel = session.player.level + 1;
        const hpGain = levelUpHpGain(nextLevel);
        patch.level = nextLevel;
        patch.hp_max = session.player.hp_max + hpGain;
        patch.hp = session.player.hp_max + hpGain;
        playerRepo.updatePlayerStats(session.player.id, patch);
        newsService.addNews(todayDayKey, `${session.player.display_name} defeated ${master.name} and reached level ${nextLevel}!`, { severity: 'highlight' });
        newsService.masterBeaten(session.player.id, todayDayKey, master.name, nextLevel, session.player.display_name);
        return `${rounds.join(' ')} ${master.flavor_win} The hall salutes your victory. You gain ${hpGain} max HP and reach level ${nextLevel}.`;
    }
    patch.hp = 1;
    playerRepo.updatePlayerStats(session.player.id, patch);
    return `${rounds.join(' ')} ${master.flavor_loss} The bells toll once as you crawl away at 1 HP.`;
}
function handleWelcomeKey(session, message, close) {
    const key = message.key.toUpperCase();
    if (key === '1') {
        beginLogin(session);
    }
    else if (key === '2') {
        beginNewCharacter(session);
    }
    else if (key === 'Q') {
        close();
    }
    else {
        session.notice = 'Use 1, 2, or Q.';
    }
}
function processLoginCommit(session, field, value) {
    if (!value) {
        session.notice = 'Input cannot be empty.';
        startPrompt(session, field, field === 'password');
        return;
    }
    if (field === 'username') {
        session.draft.loginUsername = value;
        session.notice = 'Enter password.';
        startPrompt(session, 'password', true);
        return;
    }
    const username = session.draft.loginUsername;
    if (!username) {
        session.notice = 'Enter username first.';
        startPrompt(session, 'username');
        return;
    }
    const player = playerRepo.findByUsername(username);
    if (!player || !authService.verifyPassword(value, player.pass_hash)) {
        session.notice = 'Invalid username or password.';
        startPrompt(session, 'username');
        return;
    }
    playerRepo.updateLastLogin(player.id);
    handlePostLogin(session, player.id, player.display_name);
}
function parseClass(value) {
    if (value === '1')
        return 'DEATH_KNIGHT';
    if (value === '2')
        return 'MYSTICAL';
    if (value === '3')
        return 'THIEF';
    return null;
}
function processNewCharacterCommit(session, field, value) {
    if (field !== 'confirm' && !value) {
        session.notice = 'Input cannot be empty.';
        startPrompt(session, field, field === 'password');
        return;
    }
    if (field === 'username') {
        if (playerRepo.findByUsername(value)) {
            session.notice = 'Username already exists. Choose another.';
            startPrompt(session, 'username');
            return;
        }
        session.draft.username = value;
        session.notice = 'Set a password.';
        startPrompt(session, 'password', true);
        return;
    }
    if (field === 'password') {
        session.draft.password = value;
        session.notice = 'Choose a display name.';
        startPrompt(session, 'display_name');
        return;
    }
    if (field === 'display_name') {
        session.draft.displayName = value;
        session.notice = 'Select sex (M/F).';
        startPrompt(session, 'sex');
        return;
    }
    if (field === 'sex') {
        const sex = value.toUpperCase();
        if (sex !== 'M' && sex !== 'F') {
            session.notice = 'Sex must be M or F.';
            startPrompt(session, 'sex');
            return;
        }
        session.draft.sex = sex;
        session.notice = 'Select class: 1=Death Knight, 2=Mystical, 3=Thief.';
        startPrompt(session, 'class');
        return;
    }
    if (field === 'class') {
        const klass = parseClass(value);
        if (!klass) {
            session.notice = 'Class must be 1, 2, or 3.';
            startPrompt(session, 'class');
            return;
        }
        session.draft.class = klass;
        session.notice = 'Create character now? (Y/N)';
        startPrompt(session, 'confirm');
        return;
    }
    if (field === 'confirm') {
        const choice = value.toUpperCase();
        if (choice !== 'Y') {
            session.notice = 'Creation canceled. Returning to welcome.';
            setScreen(session, 'WELCOME');
            resetDraft(session);
            return;
        }
        if (!session.draft.username || !session.draft.password || !session.draft.displayName || !session.draft.sex || !session.draft.class) {
            session.notice = 'Missing character fields. Restarting creation.';
            beginNewCharacter(session);
            return;
        }
        try {
            const player = playerRepo.createPlayer({
                id: randomUUID(),
                username: session.draft.username,
                pass_hash: authService.hashPassword(session.draft.password),
                display_name: session.draft.displayName,
                sex: session.draft.sex,
                class: session.draft.class
            });
            handlePostLogin(session, player.id, player.display_name);
            resetDraft(session);
        }
        catch {
            session.notice = 'Unable to create character. Try a different username.';
            startPrompt(session, 'username');
        }
    }
}
function handleForestChoiceEvent(session, key, textInput) {
    if (!session.player || !session.playerId) {
        session.notice = 'You blink and forget where you were.';
        return;
    }
    const todayDayKey = dayService.ensureDailyReset(session.playerId).todayDayKey;
    const outcome = forestService.resolveEventChoice(session.player, todayDayKey, key, textInput);
    session.notice = outcome.text;
    refreshPlayer(session);
    session.dailyNewsOffset = 0;
    loadDailyNews(session, todayDayKey, 0);
    if (outcome.promptField) {
        startPrompt(session, outcome.promptField);
    }
}
function handleMenuKey(session, message, close) {
    const key = message.key.toUpperCase();
    if (session.state === 'WELCOME') {
        handleWelcomeKey(session, message, close);
        return;
    }
    if (session.state === 'LOGIN') {
        if (key === 'Q') {
            setScreen(session, 'WELCOME');
            session.notice = 'Back at welcome screen.';
            resetDraft(session);
            return;
        }
        if (key === 'U') {
            startPrompt(session, 'username');
            return;
        }
        if (key === 'P') {
            startPrompt(session, 'password', true);
            return;
        }
        session.notice = 'Use U to enter username, P for password, or Q to go back.';
        return;
    }
    if (session.state === 'NEW_CHARACTER') {
        if (key === 'Q') {
            setScreen(session, 'WELCOME');
            session.notice = 'Character creation canceled.';
            resetDraft(session);
            return;
        }
        if (key === 'N') {
            resetDraft(session);
            session.notice = 'Choose a username.';
            startPrompt(session, 'username');
            return;
        }
        session.notice = 'Press N to start prompts, or Q to return.';
        return;
    }
    if (session.playerId && key === 'V' && session.state !== 'DAILY_HAPPENINGS' && session.state !== 'VIEW_STATS') {
        setScreen(session, 'VIEW_STATS');
        session.notice = 'You review your current character sheet.';
        return;
    }
    if (session.state === 'DAILY_HAPPENINGS') {
        if (key === 'N' && session.dailyNewsHasMore && session.todayDate) {
            const nextOffset = session.dailyNewsOffset + 30;
            loadDailyNews(session, session.todayDate, nextOffset);
            session.notice = `Showing entries ${nextOffset + 1}-${nextOffset + session.dailyNews.length}.`;
            return;
        }
        if (key === 'P' && session.dailyNewsOffset > 0 && session.todayDate) {
            const prevOffset = Math.max(0, session.dailyNewsOffset - 30);
            loadDailyNews(session, session.todayDate, prevOffset);
            session.notice = prevOffset === 0 ? 'Showing latest entries.' : `Showing entries ${prevOffset + 1}-${prevOffset + session.dailyNews.length}.`;
            return;
        }
        const wakeupNotice = session.pendingNewDaySpirits
            ? `You are in ${session.pendingNewDaySpirits} spirits today.`
            : 'Welcome to town.';
        session.pendingNewDaySpirits = undefined;
        returnToTown(session, wakeupNotice);
        return;
    }
    if (session.playerId &&
        ['T', 'R'].includes(key) &&
        ['BANK', 'HEALER', 'WEAPONS_SHOP', 'ARMOR_SHOP'].includes(session.state)) {
        returnToTown(session);
        return;
    }
    if (session.playerId && key === 'F' && session.state === 'TOWN_SQUARE') {
        enterForest(session);
        return;
    }
    if (session.playerId && key === 'W' && session.state === 'TOWN_SQUARE') {
        setScreen(session, 'WEAPONS_SHOP');
        session.notice = "Arthur says: pick steel or stop breathing on my wares.";
        return;
    }
    if (session.playerId && key === 'A' && session.state === 'TOWN_SQUARE') {
        setScreen(session, 'ARMOR_SHOP');
        session.notice = "Abdul grunts: armor first, whining later.";
        return;
    }
    if (session.playerId && key === 'B' && session.state === 'TOWN_SQUARE') {
        setScreen(session, 'BANK');
        session.notice = 'Welcome to the bank. Mind the ledgers.';
        return;
    }
    if (session.playerId && key === 'H' && session.state === 'TOWN_SQUARE') {
        setScreen(session, 'HEALER');
        session.notice = 'The healer eyes your wounds and your wallet.';
        return;
    }
    if (session.playerId && key === 'I' && session.state === 'TOWN_SQUARE') {
        enterInn(session);
        return;
    }
    if (session.playerId && key === 'T' && session.state === 'TOWN_SQUARE') {
        enterTraining(session);
        return;
    }
    if (session.playerId && key === 'S' && session.state === 'TOWN_SQUARE') {
        enterSlaughterFields(session);
        return;
    }
    if (session.playerId && key === 'L' && session.state === 'TOWN_SQUARE') {
        setScreen(session, 'PLAYER_RANKINGS');
        session.notice = 'The rankings board creaks as you scan the names.';
        return;
    }
    if (session.playerId && (key === 'N' || key === 'D') && session.state === 'TOWN_SQUARE') {
        if (!session.todayDate) {
            session.notice = 'No day is loaded yet.';
            return;
        }
        session.dailyNewsOffset = 0;
        loadDailyNews(session, session.todayDate, 0);
        setScreen(session, 'DAILY_HAPPENINGS');
        session.notice = 'Reading the realm news...';
        return;
    }
    if (session.state === 'TOWN_SQUARE') {
        if (key === 'Q') {
            close();
            return;
        }
        session.notice = `${key} is not implemented yet.`;
        return;
    }
    if (session.state === 'TRAINING') {
        if (!session.player || !session.playerId) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        const todayDayKey = dayService.ensureDailyReset(session.playerId).todayDayKey;
        refreshPlayer(session);
        if (!session.player) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'R' || key === 'T') {
            returnToTown(session, "You leave Turgon's hall with aching muscles.");
            return;
        }
        if (key === 'Q') {
            session.notice = trainingQuestionMessage(session);
            return;
        }
        if (key === 'H') {
            setScreen(session, 'HALL_OF_HONOR');
            session.notice = 'Stone tablets remember what mortals forget.';
            return;
        }
        if (key === 'A') {
            session.notice = resolveMasterChallenge(session, todayDayKey);
            refreshPlayer(session);
            loadDailyNews(session, todayDayKey);
            return;
        }
        if (key === 'C') {
            if (session.player.training_challenge_used_today) {
                session.notice = 'You already trained class skills today.';
                return;
            }
            playerRepo.updatePlayerStats(session.player.id, trainClassSkillPatch(session.player));
            refreshPlayer(session);
            loadDailyNews(session, todayDayKey);
            session.notice = `${session.player?.display_name ?? 'You'} trained class skills.`;
            return;
        }
        session.notice = 'Training keys: Q question, A attack, H hall, C class train, R/T town.';
        return;
    }
    if (session.state === 'SLAUGHTER_FIELDS') {
        if (!session.player || !session.playerId) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        const todayDayKey = dayService.ensureDailyReset(session.playerId).todayDayKey;
        refreshPlayer(session);
        if (!session.player) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'Q') {
            session.pvpEncounter = undefined;
            session.pvpTargetSelection = undefined;
            returnToTown(session, 'You leave the fields.');
            return;
        }
        if (session.pvpEncounter && !session.pvpEncounter.over) {
            if (key === 'A') {
                const result = pvpService.takeAction(session.pvpEncounter, 'ATTACK', todayDayKey);
                session.notice = result.message;
                session.pvpEncounter = result.state;
                refreshPlayer(session);
                loadDailyNews(session, todayDayKey);
                if (result.over) {
                    session.pvpEncounter = undefined;
                    session.pvpFieldsTargets = playerRepo.listFieldsTargets(session.playerId);
                }
                return;
            }
            if (key === 'R') {
                const result = pvpService.takeAction(session.pvpEncounter, 'RUN', todayDayKey);
                session.notice = result.message;
                session.pvpEncounter = undefined;
                session.pvpFieldsTargets = playerRepo.listFieldsTargets(session.playerId);
                refreshPlayer(session);
                loadDailyNews(session, todayDayKey);
                return;
            }
            session.notice = 'PvP keys: A attack, R run.';
            return;
        }
        if (key === 'L') {
            session.pvpFieldsTargets = playerRepo.listFieldsTargets(session.playerId);
            session.notice = session.pvpFieldsTargets.length > 0 ? 'You spot possible victims.' : 'No eligible victims in the fields.';
            return;
        }
        if (/^[1-9]$/.test(key)) {
            const targets = playerRepo.listFieldsTargets(session.playerId);
            const target = targets[Number(key) - 1];
            if (!target) {
                session.notice = 'No such target on this list.';
                return;
            }
            session.pvpTargetSelection = target.id;
            session.notice = `Attack ${target.display_name} (Level ${target.level})? (Y/N)`;
            startPrompt(session, 'fields_confirm');
            return;
        }
        session.notice = 'Fields keys: L list, 1-9 attack, R/Q town.';
        return;
    }
    if (session.state === 'HALL_OF_HONOR') {
        if (key === 'R' || key === 'T') {
            setScreen(session, 'TRAINING');
            session.notice = 'Back to the training floor. The hall falls quiet around you.';
            return;
        }
        session.notice = 'Hall keys: R/T return to the training floor.';
        return;
    }
    if (session.state === 'PLAYER_RANKINGS') {
        if (key === '' || key === 'Q' || key === 'R' || key === 'T') {
            returnToTown(session, 'You step away from the rankings board.');
            return;
        }
        if (key === 'H') {
            setScreen(session, 'HEROIC_DEEDS_RANKINGS');
            session.notice = 'Heroic deeds tell the real story.';
            return;
        }
        session.notice = 'Ranking keys: H heroic deeds, Enter/Q/R/T return.';
        return;
    }
    if (session.state === 'HEROIC_DEEDS_RANKINGS') {
        if (key === '' || key === 'Q' || key === 'R' || key === 'T') {
            setScreen(session, 'PLAYER_RANKINGS');
            session.notice = 'Back to player rankings.';
            return;
        }
        session.notice = 'Heroic Deeds keys: Enter/Q/R/T return.';
        return;
    }
    if (session.state === 'OLD_MAN_MENU') {
        if (key === 'Q' || key === 'R') {
            setScreen(session, 'INN');
            session.notice = 'You leave the old man to his muttering.';
            return;
        }
        const category = oldManCategoryFromInput(key);
        if (category) {
            session.oldManCategory = category;
            setScreen(session, 'OLD_MAN_TOP_LIST');
            session.notice = 'The old man cackles and points at the board.';
            return;
        }
        session.notice = 'Old man keys: 1-5 category, R/Q return.';
        return;
    }
    if (session.state === 'OLD_MAN_TOP_LIST') {
        if (key === '' || key === 'Q' || key === 'R') {
            setScreen(session, 'OLD_MAN_MENU');
            session.notice = 'Pick another tale from the old man.';
            return;
        }
        session.notice = 'Top list keys: Enter/Q/R return.';
        return;
    }
    if (session.state === 'INN') {
        if (!session.player || !session.playerId) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        const todayDayKey = dayService.ensureDailyReset(session.playerId).todayDayKey;
        refreshPlayer(session);
        const freshPlayer = session.player;
        if (!freshPlayer) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'R') {
            returnToTown(session, 'You leave the Inn.');
            return;
        }
        if (key === 'T') {
            setScreen(session, 'INN_BARTENDER');
            session.notice = 'The bartender lifts one brow: "Coin first. Names never."';
            return;
        }
        if (key === 'F') {
            session.notice = innService.flirt(freshPlayer, todayDayKey).message;
            refreshPlayer(session);
            loadDailyNews(session, todayDayKey);
            return;
        }
        if (key === 'S') {
            session.notice = innService.listenToBard(freshPlayer, todayDayKey).message;
            refreshPlayer(session);
            loadDailyNews(session, todayDayKey);
            return;
        }
        if (key === 'G') {
            session.notice = innService.rentRoom(freshPlayer, todayDayKey).message;
            refreshPlayer(session);
            loadDailyNews(session, todayDayKey);
            return;
        }
        if (key === 'C') {
            setScreen(session, 'INN_CONVERSE');
            session.notice = 'You listen for scandal.';
            return;
        }
        if (key === 'O') {
            setScreen(session, 'OLD_MAN_MENU');
            session.notice = 'In the corner, the old man waves you over.';
            return;
        }
        session.notice = 'Inn keys: G room, T bartender, S Seth rite, F Violet, C rumors, O old man, R town.';
        return;
    }
    if (session.state === 'INN_CONVERSE') {
        if (key === 'R' || key === 'Q') {
            setScreen(session, 'INN');
            session.notice = 'You drift back into the common room and its smiling liars.';
            return;
        }
        session.notice = 'Converse keys: R/Q return.';
        return;
    }
    if (session.state === 'INN_BARTENDER') {
        if (!session.player || !session.playerId) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'E' || key === 'Q') {
            setScreen(session, 'INN');
            session.notice = 'You step away from the bar.';
            return;
        }
        if (key === 'B') {
            const result = innService.bribeBartender(session.player);
            session.notice = result.message;
            refreshPlayer(session);
            return;
        }
        if (key === 'A') {
            refreshPlayer(session);
            if (!session.player?.inn_breakin_used_today) {
                session.notice = 'Pay the bartender first if you want keys and sins.';
                return;
            }
            setScreen(session, 'INN_BREAK_IN');
            session.notice = 'Choose whose door you kick in.';
            return;
        }
        session.notice = 'Bartender keys: B bribe, A attack, E exit.';
        return;
    }
    if (session.state === 'INN_BREAK_IN') {
        if (!session.player || !session.playerId) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        const todayDayKey = dayService.ensureDailyReset(session.playerId).todayDayKey;
        refreshPlayer(session);
        if (!session.player) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'Q') {
            setScreen(session, 'INN_BARTENDER');
            session.notice = 'You step back to the bar. He was expecting you.';
            return;
        }
        const targets = innService.getBreakInTargets(session.player);
        if (/^[1-9]$/.test(key)) {
            const idx = Number(key) - 1;
            const target = targets[idx];
            if (!target) {
                session.notice = 'No such target on this list.';
                return;
            }
            session.innTargetSelection = target.id;
            session.notice = `Attack ${target.display_name}? (Y/N)`;
            startPrompt(session, 'inn_confirm');
            return;
        }
        session.notice = 'Break-in keys: 1-9 to choose, Q to back.';
        return;
    }
    if (session.state === 'BANK') {
        if (!session.player) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'Q' || key === 'R') {
            returnToTown(session);
            return;
        }
        if (key === '1' || key === 'D') {
            session.pendingBankAction = 'DEPOSIT';
            session.notice = 'How much are you shoving into the vault?';
            startPrompt(session, 'bank_amount');
            return;
        }
        if (key === '2' || key === 'W') {
            session.pendingBankAction = 'WITHDRAW';
            session.notice = 'How much are you pulling from the vault?';
            startPrompt(session, 'bank_amount');
            return;
        }
        if (key === '3') {
            session.notice = bankService.depositAll(session.player).message;
            refreshPlayer(session);
            return;
        }
        if (key === '4') {
            session.notice = `Balances — Pocket: ${session.player.gold_on_hand}, Bank: ${session.player.gold_in_bank}.`;
            return;
        }
        session.notice = 'Wrong ledger key. Use 1/D deposit, 2/W withdraw, 3 all, 4 balance, Q/R town.';
        return;
    }
    if (session.state === 'HEALER') {
        if (!session.player) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === '1') {
            session.notice = healerService.healAllPossible(session.player).message;
            refreshPlayer(session);
            return;
        }
        if (key === '2') {
            session.notice = healerService.heal(session.player, 5).message;
            refreshPlayer(session);
            return;
        }
        session.notice = 'Healer keys: 1 heal all possible, 2 heal 5 HP, R/T to town.';
        return;
    }
    if (session.state === 'WEAPONS_SHOP') {
        if (!session.player) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'B') {
            session.pendingEquipmentAction = 'BUY_WEAPON';
            session.notice = 'Buy which weapon tier? (1-15)';
            startPrompt(session, 'weapon_tier');
            return;
        }
        if (key === 'S') {
            session.notice = equipmentService.sellWeapon(session.player).message;
            refreshPlayer(session);
            return;
        }
        if (key === 'L') {
            session.notice = 'Browse fast: 1-15 from Stick to Death Sword.';
            return;
        }
        session.notice = 'Weapons keys: B buy, S sell, L list, R/T town.';
        return;
    }
    if (session.state === 'ARMOR_SHOP') {
        if (!session.player) {
            returnToTown(session, 'No player loaded.');
            return;
        }
        if (key === 'B') {
            session.pendingEquipmentAction = 'BUY_ARMOR';
            session.notice = 'Buy which armor tier? (1-15)';
            startPrompt(session, 'armor_tier');
            return;
        }
        if (key === 'S') {
            session.notice = equipmentService.sellArmor(session.player).message;
            refreshPlayer(session);
            return;
        }
        if (key === 'L') {
            session.notice = 'Browse fast: 1-15 armor tiers, same price ladder.';
            return;
        }
        session.notice = 'Armor keys: B buy, S sell, L list, R/T town.';
        return;
    }
    if (session.state === 'FOREST') {
        if (!session.player || !session.playerId) {
            returnToTown(session, 'You stumble back to town.');
            return;
        }
        const { todayDayKey } = dayService.ensureDailyReset(session.playerId);
        refreshPlayer(session);
        if ((session.player?.turns_forest_left ?? 0) <= 0) {
            returnToTown(session, 'You are too tired. Come back tomorrow.');
            return;
        }
        if (key === 'T') {
            returnToTown(session, 'You return to town with twigs in your hair.');
            return;
        }
        if (key === 'B') {
            const depositResult = bankService.depositAll(session.player);
            refreshPlayer(session);
            session.notice = `${depositResult.message} A vulture banker swoops in, snatches your coins, and vanishes toward town.`;
            return;
        }
        if (key === 'L') {
            session.notice = `[LOOK] ${forestService.look(session.player, todayDayKey)}`;
            return;
        }
        const forestEncounter = forestService.getEncounter(session.player.id);
        if (key === 'S' && forestEncounter.encounterType === 'NONE') {
            const result = forestService.searchDragon(session.player, todayDayKey);
            session.notice = result.text;
            refreshPlayer(session);
            loadDailyNews(session, todayDayKey);
            if (!result.playerWon && (session.player?.turns_forest_left ?? 0) <= 0) {
                returnToTown(session, 'You stagger back toward town after the dragon fight.');
            }
            return;
        }
        if (key === 'A' && forestEncounter.encounterType !== 'EVENT') {
            session.notice = `[ATTACK] ${forestService.attack(session.player, todayDayKey)}`;
            refreshPlayer(session);
            if ((session.player?.turns_forest_left ?? 0) <= 0) {
                returnToTown(session, 'You are too tired. Come back tomorrow.');
            }
            return;
        }
        if ((key === 'K' || key === 'S') && forestEncounter.encounterType === 'ENEMY') {
            if (session.player.class === 'DEATH_KNIGHT') {
                session.notice = `Death Knight skill: (D)eath Knight Attack [uses left: ${session.player.skill_uses_death}]`;
            }
            else if (session.player.class === 'MYSTICAL') {
                session.notice = `Mystic skills: (P)inch Real Hard, (M)ind Heal [uses left: ${session.player.skill_uses_mystic}]`;
            }
            else {
                session.notice = `Thief skills: (U)ltra Sneaky Move, (P)ass Mark [uses left: ${session.player.skill_uses_thief}]`;
            }
            return;
        }
        if (key === 'D' && forestEncounter.encounterType === 'ENEMY' && session.player.class === 'DEATH_KNIGHT') {
            session.notice = forestService.useSkill(session.player, todayDayKey, 'DEATH_ATTACK');
            refreshPlayer(session);
            return;
        }
        if (key === 'P' && forestEncounter.encounterType === 'ENEMY' && session.player.class === 'MYSTICAL') {
            session.notice = forestService.useSkill(session.player, todayDayKey, 'MYSTIC_PINCH');
            refreshPlayer(session);
            return;
        }
        if (key === 'M' && forestEncounter.encounterType === 'ENEMY' && session.player.class === 'MYSTICAL') {
            session.notice = forestService.useSkill(session.player, todayDayKey, 'MYSTIC_HEAL');
            refreshPlayer(session);
            return;
        }
        if (key === 'U' && forestEncounter.encounterType === 'ENEMY' && session.player.class === 'THIEF') {
            session.notice = forestService.useSkill(session.player, todayDayKey, 'THIEF_SNEAKY');
            refreshPlayer(session);
            return;
        }
        if (key === 'P' && forestEncounter.encounterType === 'ENEMY' && session.player.class === 'THIEF') {
            session.notice = forestService.useSkill(session.player, todayDayKey, 'THIEF_PASS_MARK');
            refreshPlayer(session);
            return;
        }
        if (key === 'R' && forestEncounter.encounterType !== 'EVENT') {
            session.notice = `[RUN] ${forestService.run(session.player)}`;
            return;
        }
        if (['1', '2', '3', '4', '5', 'Y', 'N', 'C', 'A', 'L', 'G', 'T', 'Q'].includes(key)) {
            handleForestChoiceEvent(session, key);
            return;
        }
        session.notice = 'That is not a forest rhythm key. Use L look, A attack, R run, T town, B bank.';
    }
}
function processBankCommit(session, value) {
    if (!session.player || !session.pendingBankAction) {
        session.notice = 'The banker has no idea what you are doing.';
        return;
    }
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount <= 0) {
        session.notice = 'That number is garbage. Enter a whole positive amount.';
        startPrompt(session, 'bank_amount');
        return;
    }
    if (session.pendingBankAction === 'DEPOSIT') {
        session.notice = bankService.deposit(session.player, amount).message;
    }
    else {
        session.notice = bankService.withdraw(session.player, amount).message;
    }
    session.pendingBankAction = undefined;
    refreshPlayer(session);
}
function processEquipmentCommit(session, value) {
    if (!session.player || !session.pendingEquipmentAction) {
        session.notice = 'The shopkeeper ignores your mumbling.';
        return;
    }
    const command = value.trim().toUpperCase();
    if (command === 'R') {
        session.pendingEquipmentAction = undefined;
        session.notice = 'Purchase canceled.';
        return;
    }
    const tier = Number(value);
    if (!Number.isInteger(tier)) {
        session.notice = 'Use a whole tier number.';
        startPrompt(session, session.pendingEquipmentAction === 'BUY_WEAPON' ? 'weapon_tier' : 'armor_tier');
        return;
    }
    if (session.pendingEquipmentAction === 'BUY_WEAPON') {
        session.notice = equipmentService.buyWeapon(session.player, tier).message;
    }
    else {
        session.notice = equipmentService.buyArmor(session.player, tier).message;
    }
    session.pendingEquipmentAction = undefined;
    refreshPlayer(session);
}
function handleTextEntry(session, message) {
    const prompt = session.prompt;
    if (!prompt) {
        session.mode = 'MENU';
        return;
    }
    if (message.key === 'Enter') {
        const field = prompt.field;
        const value = commitPrompt(session);
        if (session.state === 'LOGIN') {
            processLoginCommit(session, field, value);
        }
        else if (session.state === 'NEW_CHARACTER') {
            processNewCharacterCommit(session, field, value);
        }
        else if (session.state === 'BANK' && field === 'bank_amount') {
            processBankCommit(session, value);
        }
        else if (field === 'weapon_tier' || field === 'armor_tier') {
            processEquipmentCommit(session, value);
        }
        else if (field === 'inn_confirm' && session.state === 'INN_BREAK_IN') {
            if (!session.player || !session.playerId || !session.innTargetSelection) {
                session.notice = 'No target selected.';
                return;
            }
            const choice = value.toUpperCase();
            if (choice !== 'Y') {
                session.notice = 'You decide not to kick that door tonight.';
                session.innTargetSelection = undefined;
                return;
            }
            const todayDayKey = dayService.ensureDailyReset(session.playerId).todayDayKey;
            session.notice = innService.breakInAttack(session.player, session.innTargetSelection, todayDayKey).message;
            session.innTargetSelection = undefined;
            refreshPlayer(session);
            loadDailyNews(session, todayDayKey);
        }
        else if (field === 'fields_confirm' && session.state === 'SLAUGHTER_FIELDS') {
            if (!session.player || !session.playerId || !session.pvpTargetSelection) {
                session.notice = 'No target selected.';
                return;
            }
            const choice = value.toUpperCase();
            if (choice !== 'Y') {
                session.notice = 'You decide to let this one live... for now.';
                session.pvpTargetSelection = undefined;
                return;
            }
            const target = playerRepo.findById(session.pvpTargetSelection);
            if (!target) {
                session.notice = 'That target is gone.';
                session.pvpTargetSelection = undefined;
                return;
            }
            const create = pvpService.createEncounter(session.player, target, 'FIELDS');
            session.notice = create.message;
            session.pvpEncounter = create.state;
            session.pvpTargetSelection = undefined;
        }
        else if (field === 'jennie_word' && session.state === 'FOREST') {
            if (!session.player || !session.playerId) {
                session.notice = 'Jennie is gone.';
                return;
            }
            handleForestChoiceEvent(session, 'T', value);
        }
        else if (field === 'mystic_guess' && session.state === 'FOREST') {
            if (!session.player || !session.playerId) {
                session.notice = 'The mystic is gone.';
                return;
            }
            handleForestChoiceEvent(session, 'T', value);
        }
        return;
    }
    if (message.key === 'Backspace') {
        session.inputBuffer = session.inputBuffer.slice(0, -1);
        return;
    }
    if (message.key.length === 1 && !message.ctrl && !message.alt) {
        session.inputBuffer += message.key;
    }
}
function renderSession(session) {
    if (session.playerId) {
        refreshPlayer(session);
    }
    if (isNavigationHelperScreen(session.state)) {
        return renderNavigationHelperScreen(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'WELCOME') {
        return renderWelcome(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'LOGIN') {
        return renderLogin(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'NEW_CHARACTER') {
        return renderNewCharacter(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'DAILY_HAPPENINGS') {
        return renderDailyHappenings(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'FOREST') {
        return renderForest(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'BANK') {
        return renderBank(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'HEALER') {
        return renderHealer(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'WEAPONS_SHOP') {
        return renderWeaponsShop(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'ARMOR_SHOP') {
        return renderArmorShop(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'INN') {
        return renderInn(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'TRAINING') {
        return renderTraining(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'HALL_OF_HONOR') {
        return renderHallOfHonor(session, { cols: session.cols, rows: session.rows }, playerRepo.listHallOfHonor());
    }
    if (session.state === 'PLAYER_RANKINGS') {
        return renderPlayerRankings(session, { cols: session.cols, rows: session.rows }, playerRepo.listPlayerRankings());
    }
    if (session.state === 'HEROIC_DEEDS_RANKINGS') {
        return renderHeroicDeedsRankings(session, { cols: session.cols, rows: session.rows }, playerRepo.listHeroicDeedsRankings());
    }
    if (session.state === 'OLD_MAN_MENU') {
        return renderOldManMenu(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'OLD_MAN_TOP_LIST') {
        return renderOldManTopList(session, { cols: session.cols, rows: session.rows }, session.oldManCategory, playerRepo.listOldManTop(session.oldManCategory ?? 'kills'));
    }
    if (session.state === 'INN_BARTENDER') {
        return renderInnBartender(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'INN_CONVERSE') {
        return renderInnConverse(session, { cols: session.cols, rows: session.rows });
    }
    if (session.state === 'INN_BREAK_IN') {
        return renderInnBreakIn(session, { cols: session.cols, rows: session.rows }, session.player ? innService.getBreakInTargets(session.player) : []);
    }
    if (session.state === 'SLAUGHTER_FIELDS') {
        return renderSlaughterFields(session, { cols: session.cols, rows: session.rows });
    }
    return renderTownSquare(session, { cols: session.cols, rows: session.rows });
}
app.get('/ws', { websocket: true }, (connection) => {
    const session = createSession();
    const socket = connection.socket ?? connection;
    const sendScreen = () => {
        const screen = {
            type: 'screen',
            frame: renderSession(session)
        };
        socket.send(JSON.stringify(screen));
    };
    sendScreen();
    socket.on('message', (raw) => {
        let payload;
        try {
            payload = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
        const message = parseClientMessage(payload);
        if (!message) {
            return;
        }
        if (message.type === 'resize') {
            session.cols = message.cols;
            session.rows = message.rows;
            sendScreen();
            return;
        }
        const prettyKey = message.key || message.code;
        session.lastKey = prettyKey;
        if (session.mode === 'TEXT_ENTRY') {
            handleTextEntry(session, message);
            sendScreen();
            return;
        }
        if (shouldUseLineInput(session)) {
            if (message.key === 'Backspace') {
                session.inputBuffer = session.inputBuffer.slice(0, -1);
                sendScreen();
                return;
            }
            if (message.key === 'Enter') {
                if (session.state === 'DAILY_HAPPENINGS') {
                    const wakeupNotice = session.pendingNewDaySpirits
                        ? `You are in ${session.pendingNewDaySpirits} spirits today.`
                        : 'Welcome to town.';
                    session.pendingNewDaySpirits = undefined;
                    returnToTown(session, wakeupNotice);
                }
                else {
                    const transition = handleNavigationHelperInput(session, session.inputBuffer);
                    applyNavigationHelperTransition(session, transition, () => socket.close());
                }
                session.inputBuffer = '';
                sendScreen();
                return;
            }
            if (message.key.length === 1 && !message.ctrl && !message.alt) {
                session.inputBuffer += message.key;
            }
            sendScreen();
            return;
        }
        handleMenuKey(session, message, () => socket.close());
        sendScreen();
    });
});
await app.listen({ host: '0.0.0.0', port: 3000 });
