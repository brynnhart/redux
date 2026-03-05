import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';

import { parseClientMessage, type KeyMessage, type ScreenMessage } from './protocol.js';
import { getDbPath } from './db/db.js';
import { runMigrations } from './db/migrate.js';
import { PlayerRepo, type PlayerClass, type PlayerSex } from './repos/playerRepo.js';
import { AuthService } from './services/authService.js';
import { DayService } from './services/dayService.js';
import { NewsService } from './services/newsService.js';
import { ForestService } from './services/forestService.js';
import { BankService } from './services/bankService.js';
import { HealerService } from './services/healerService.js';
import { commitPrompt, createSession, resetDraft, setScreen, startPrompt, type Session } from './session.js';
import { renderWelcome } from './screens/welcome.js';
import { renderLogin } from './screens/login.js';
import { renderNewCharacter } from './screens/newCharacter.js';
import { renderTownSquare } from './screens/townSquare.js';
import { renderDailyHappenings } from './screens/dailyHappenings.js';
import { renderForest } from './screens/forest.js';
import { renderBank } from './screens/bank.js';
import { renderHealer } from './screens/healer.js';

const app = Fastify({ logger: true });
const playerRepo = new PlayerRepo();
const authService = new AuthService();
const newsService = new NewsService();
const dayService = new DayService(playerRepo, newsService);
const forestService = new ForestService(playerRepo, newsService);
const bankService = new BankService(playerRepo);
const healerService = new HealerService(playerRepo);

runMigrations();
app.log.info({ dbPath: getDbPath() }, 'Migrations complete');

await app.register(websocket);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await app.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/'
});

app.get('/', (_request, reply) => {
  reply.sendFile('index.html');
});

function refreshPlayer(session: Session) {
  if (!session.playerId) {
    session.player = undefined;
    return;
  }
  session.player = playerRepo.findById(session.playerId) ?? undefined;
}

function loadDailyNews(session: Session, today: string) {
  if (!session.playerId) {
    session.dailyNews = [];
    return;
  }
  session.dailyNews = newsService.getMergedNews(session.playerId, today, 50);
  session.todayDate = today;
}

function handlePostLogin(session: Session, playerId: string, displayName: string) {
  session.playerId = playerId;
  const { today } = dayService.ensureDailyReset(playerId);

  newsService.addNews({
    date: today,
    type: 'LOGIN',
    message: `${displayName} has logged in.`
  });

  refreshPlayer(session);
  loadDailyNews(session, today);
  setScreen(session, 'DAILY_HAPPENINGS');
  session.notice = 'Press any key to continue...';
}

function beginLogin(session: Session) {
  setScreen(session, 'LOGIN');
  resetDraft(session);
  session.notice = 'Enter username.';
  startPrompt(session, 'username');
}

function beginNewCharacter(session: Session) {
  setScreen(session, 'NEW_CHARACTER');
  resetDraft(session);
  session.notice = 'Choose a username.';
  startPrompt(session, 'username');
}


function enterForest(session: Session) {
  if (!session.player || !session.playerId) {
    session.notice = 'No player loaded.';
    return;
  }
  const { today } = dayService.ensureDailyReset(session.playerId);
  refreshPlayer(session);
  loadDailyNews(session, today);

  if ((session.player?.turns_forest_left ?? 0) <= 0) {
    setScreen(session, 'TOWN_SQUARE');
    session.notice = 'You are too tired. Come back tomorrow.';
    return;
  }

  setScreen(session, 'FOREST');
  session.notice = 'You enter the Forest. It smells like danger and cabbage.';
}

function returnToTown(session: Session, message = 'You return to town.') {
  setScreen(session, 'TOWN_SQUARE');
  session.notice = message;
}

function handleWelcomeKey(session: Session, message: KeyMessage, close: () => void) {
  const key = message.key.toUpperCase();
  if (key === '1') {
    beginLogin(session);
  } else if (key === '2') {
    beginNewCharacter(session);
  } else if (key === 'Q') {
    close();
  } else {
    session.notice = 'Use 1, 2, or Q.';
  }
}

function processLoginCommit(session: Session, field: string, value: string) {
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

function parseClass(value: string): PlayerClass | null {
  if (value === '1') return 'DEATH_KNIGHT';
  if (value === '2') return 'MYSTICAL';
  if (value === '3') return 'THIEF';
  return null;
}

function processNewCharacterCommit(session: Session, field: string, value: string) {
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
    session.draft.sex = sex as PlayerSex;
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
    } catch {
      session.notice = 'Unable to create character. Try a different username.';
      startPrompt(session, 'username');
    }
  }
}

function handleForestChoiceEvent(session: Session, key: string) {
  if (!session.player || !session.playerId) {
    session.notice = 'You blink and forget where you were.';
    return;
  }

  const today = dayService.ensureDailyReset(session.playerId).today;
  session.notice = forestService.resolveEventChoice(session.player, today, key);
}

function handleMenuKey(session: Session, message: KeyMessage, close: () => void) {
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

  if (session.state === 'DAILY_HAPPENINGS') {
    returnToTown(session, 'Welcome to town.');
    return;
  }

  if (session.playerId && ['T', 'R'].includes(key) && session.state !== 'FOREST') {
    returnToTown(session);
    return;
  }

  if (session.playerId && key === 'F') {
    enterForest(session);
    return;
  }

  if (session.playerId && key === 'B') {
    setScreen(session, 'BANK');
    session.notice = 'Welcome to the bank. Mind the ledgers.';
    return;
  }

  if (session.playerId && key === 'H') {
    setScreen(session, 'HEALER');
    session.notice = 'The healer eyes your wounds and your wallet.';
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

  if (session.state === 'BANK') {
    if (!session.player) {
      returnToTown(session, 'No player loaded.');
      return;
    }

    if (key === '1') {
      session.notice = bankService.deposit(session.player, session.player.gold).message;
      refreshPlayer(session);
      return;
    }
    if (key === '2') {
      session.pendingBankAction = 'DEPOSIT';
      session.notice = 'Deposit how much?';
      startPrompt(session, 'bank_amount');
      return;
    }
    if (key === '3') {
      session.notice = bankService.withdraw(session.player, session.player.bank_gold).message;
      refreshPlayer(session);
      return;
    }
    if (key === '4') {
      session.pendingBankAction = 'WITHDRAW';
      session.notice = 'Withdraw how much?';
      startPrompt(session, 'bank_amount');
      return;
    }
    if (key === 'V') {
      session.notice = `Balances — Carried: ${session.player.gold}, Bank: ${session.player.bank_gold}.`;
      return;
    }
    session.notice = 'Bank keys: 1/2 deposit, 3/4 withdraw, V to view, R/T to town.';
    return;
  }

  if (session.state === 'HEALER') {
    if (!session.player) {
      returnToTown(session, 'No player loaded.');
      return;
    }

    if (key === '1') {
      session.notice = healerService.heal(session.player, session.player.hp_max - session.player.hp);
      refreshPlayer(session);
      return;
    }

    if (key === '2') {
      session.notice = healerService.heal(session.player, 5);
      refreshPlayer(session);
      return;
    }

    session.notice = 'Healer keys: 1 heal all possible, 2 heal 5 HP, R/T to town.';
    return;
  }

  if (session.state === 'FOREST') {
    if (!session.player || !session.playerId) {
      returnToTown(session, 'You stumble back to town.');
      return;
    }

    const { today } = dayService.ensureDailyReset(session.playerId);
    refreshPlayer(session);

    if ((session.player?.turns_forest_left ?? 0) <= 0) {
      returnToTown(session, 'You are too tired. Come back tomorrow.');
      return;
    }

    if (key === 'T') {
      returnToTown(session, 'You return to town with twigs in your hair.');
      return;
    }

    if (key === 'L') {
      session.notice = forestService.look(session.player, today);
      return;
    }

    if (key === 'A') {
      session.notice = forestService.attack(session.player, today);
      refreshPlayer(session);
      if ((session.player?.turns_forest_left ?? 0) <= 0) {
        returnToTown(session, 'You are too tired. Come back tomorrow.');
      }
      return;
    }

    if (key === 'R') {
      session.notice = forestService.run(session.player);
      return;
    }

    if (['1', '2', '3', '4', '5', 'Y', 'N', 'C'].includes(key)) {
      handleForestChoiceEvent(session, key);
      return;
    }

    session.notice = 'Forest keys: L to look, A to attack, R to run, T for town, B bank, H healer.';
  }
}

function processBankCommit(session: Session, value: string) {
  if (!session.player || !session.pendingBankAction) {
    session.notice = 'The banker has no idea what you are doing.';
    return;
  }

  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) {
    session.notice = 'That amount is nonsense. Use a positive integer.';
    startPrompt(session, 'bank_amount');
    return;
  }

  if (session.pendingBankAction === 'DEPOSIT') {
    session.notice = bankService.deposit(session.player, amount).message;
  } else {
    session.notice = bankService.withdraw(session.player, amount).message;
  }

  session.pendingBankAction = undefined;
  refreshPlayer(session);
}

function handleTextEntry(session: Session, message: KeyMessage) {
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
    } else if (session.state === 'NEW_CHARACTER') {
      processNewCharacterCommit(session, field, value);
    } else if (session.state === 'BANK' && field === 'bank_amount') {
      processBankCommit(session, value);
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

function renderSession(session: Session) {
  if (session.playerId) {
    refreshPlayer(session);
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
  return renderTownSquare(session, { cols: session.cols, rows: session.rows });
}

app.get('/ws', { websocket: true }, (connection) => {
  const session = createSession();

  const sendScreen = () => {
    const screen: ScreenMessage = {
      type: 'screen',
      frame: renderSession(session)
    };
    connection.socket.send(JSON.stringify(screen));
  };

  sendScreen();

  connection.socket.on('message', (raw) => {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
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
    } else {
      handleMenuKey(session, message, () => connection.socket.close());
    }

    sendScreen();
  });
});

await app.listen({ host: '0.0.0.0', port: 3000 });
