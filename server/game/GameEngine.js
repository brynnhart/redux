'use strict';

/**
 * server/game/GameEngine.js
 *
 * Top-level game loop. Called once per WebSocket connection after auth.
 * Mirrors lord.js main() → start() → command_prompt() flow.
 *
 * TODO: Port lord.js hello(), new_player(), load_player(), start(), command_prompt()
 */

const PlayerDB  = require('../db/PlayerDB');
const StateDB   = require('../db/StateDB');
const LordColors = require('./text/LordColors');
const TextFile  = require('./text/TextFile');
const Display   = require('./text/Display');
const path      = require('path');

const GAME_DATA_DIR = process.env.GAME_DATA_DIR || path.join(__dirname, '../../gamedata');

/**
 * Entry point called by WSHandler for each authenticated connection.
 * @param {Session} session
 */
async function run(session) {
  // Convenience: bind display helpers to this session
  const disp = Display.forSession(session);

  // ── Welcome ──────────────────────────────────────────────────────────────
  session.clearScreen();
  await disp.showFile('welcome.lrd');   // optional splash file

  // ── Load or create player ─────────────────────────────────────────────────
  let player = PlayerDB.getByUserId(session.userId);

  if (!player) {
    // New character creation
    player = await newPlayer(session, disp);
    if (!player) {
      session.sendln('`4Character creation failed. Goodbye.`0');
      session.end();
      return;
    }
  } else {
    // Returning player — daily maintenance check
    await checkDaily(player);
    player = PlayerDB.getById(player.id); // reload after any reset
  }

  PlayerDB.setOnline(player.id, true);
  session.player = player;

  try {
    await gameLoop(session, disp);
  } finally {
    PlayerDB.patch(player.id, { on_now: false });
  }
}

// ── Daily check ────────────────────────────────────────────────────────────

async function checkDaily(player) {
  // TODO: compare player.time to today's day number
  // If different, call PlayerDB.resetDaily(player.id) and run daily events
  // This mirrors lord.js daily_maint() called at session start
}

// ── New player creation ────────────────────────────────────────────────────

async function newPlayer(session, disp) {
  // TODO: Port lord.js new_player() function
  // Steps:
  //   1. Display welcome / intro text
  //   2. Ask for character name (validate with check_name())
  //   3. Ask for sex (M/F)
  //   4. Choose profession (Death Knight / Thief / Mystic / Normal) — lord.js choose_profession()
  //   5. Create DB record via PlayerDB.create()
  //   6. Return player object

  session.sendln('\r\n`%Welcome to the Legend of the Red Dragon!`0\r\n');
  session.send('`2Enter your character\'s name`0: ');
  const name = await session.getStr(20, { allowed: /[a-zA-Z0-9 ]/ });
  if (!name.trim()) return null;

  session.send('\r\n`2Sex (`%M`2/`%F`2)`0: ');
  const sex = await session.prompt('', ['M', 'F']);

  session.sendln('\r\n');
  const player = PlayerDB.create(session.userId, name.trim(), sex);
  return player;
}

// ── Main game loop ─────────────────────────────────────────────────────────

async function gameLoop(session, disp) {
  // TODO: Port lord.js start() and command_prompt()
  // The loop reads one command key and dispatches to the correct location.

  const player = session.player;

  while (session.alive) {
    session.clearScreen();
    await showTownMenu(session, disp, player);

    const key = await session.getKeyUpper();
    if (!key || !session.alive) break;

    switch (key) {
      case 'F': {
        const Forest = require('./locations/Forest');
        await Forest.enter(session);
        break;
      }
      case 'T': {
        const Tavern = require('./locations/Tavern');
        await Tavern.enter(session);
        break;
      }
      case 'I': {
        const Inn = require('./locations/Inn');
        await Inn.enter(session);
        break;
      }
      case 'A': {
        const Armoury = require('./locations/Armoury');
        await Armoury.enter(session);
        break;
      }
      case 'H': {
        const Healer = require('./locations/Healer');
        await Healer.enter(session);
        break;
      }
      case 'B': {
        const Bank = require('./locations/Bank');
        await Bank.enter(session);
        break;
      }
      case 'K': {
        const KingsArthurs = require('./locations/KingsArthurs');
        await KingsArthurs.enter(session);
        break;
      }
      case 'M': {
        const Arena = require('./locations/Arena');
        await Arena.enter(session);
        break;
      }
      case 'D': {
        const Dragon = require('./locations/Dragon');
        await Dragon.enter(session);
        break;
      }
      case 'S': {
        const Rankings = require('./systems/Rankings');
        await Rankings.show(session);
        break;
      }
      case 'P': {
        // Player list
        // TODO
        break;
      }
      case 'Q':
        session.sendln('\r\n`%Goodbye, ' + player.name + '!`0\r\n');
        session.end();
        return;
    }

    // Reload player after each action (stats may have changed)
    session.player = PlayerDB.getById(player.id);
  }
}

// ── Town menu display ──────────────────────────────────────────────────────

async function showTownMenu(session, disp, player) {
  // TODO: Port lord.js hello() display + command_prompt() menu rendering
  // This is a placeholder — the real version reads from lordtxt.lrd sections
  const p = player;
  session.sendln(`\`%Legend of the Red Dragon  \`2Day \`%${StateDB.get().days}\`0`);
  session.sendln('`0' + '─'.repeat(79));
  session.sendln(`  \`2Name\`0: \`%${p.name.padEnd(20)}\`2  Level\`0: \`%${p.level}  \`2Class\`0: \`%${getClassName(p.clss)}`);
  session.sendln(`  \`2  HP\`0: \`%${p.hp}/${p.hp_max}  \`2Gold\`0: \`%${p.gold}  \`2EXP\`0: \`%${p.exp}`);
  session.sendln('`0' + '─'.repeat(79));
  session.sendln('');
  session.sendln('  `%F`2)orest          `%T`2)avern         `%I`2)nn');
  session.sendln('  `%A`2)rmoury         `%H`2)ealer         `%B`2)ank');
  session.sendln('  `%K`2)ing\'s Court    `%M`2)aster\'s Arena `%D`2)ragon\'s Lair');
  session.sendln('  `%S`2)cores/Rankings `%P`2)layer List     `%Q`2)uit');
  session.sendln('');
  session.send('  `2Your command`0: ');
}

function getClassName(clss) {
  return ['Normal', 'Death Knight', 'Thief', 'Mystic'][clss] || 'Normal';
}

module.exports = { run };
