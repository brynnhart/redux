'use strict';

/**
 * server/game/systems/LeaderboardRouter.js
 *
 * Two exports:
 *   module.exports        — Express router  (used by server/index.js)
 *   module.exports.show   — async in-game display function (used by GameEngine)
 */

const express  = require('express');
const PlayerDB = require('../../db/PlayerDB');
const StateDB  = require('../../db/StateDB');
const Display  = require('../text/Display');

// ── In-game rankings display ───────────────────────────────────────────────

async function show(session) {
  const disp    = Display.forSession(session);
  const players = PlayerDB.getAll();
  const state   = StateDB.get();

  session.clearScreen();
  disp.sln('`%                 The Mighty Warriors of the Realm`0');
  disp.sln('`0' + '═'.repeat(79));
  disp.sln('');
  disp.sln('`2Rank  Name                Level   Experience    Dragon Kills  PvP');
  disp.sln('`0' + '─'.repeat(79));

  if (!players.length) {
    disp.sln('');
    disp.sln('`6  No warriors have entered the realm yet.');
  } else {
    players.slice(0, 20).forEach((p, idx) => {
      const rank  = String(idx + 1).padStart(3);
      const name  = p.name.padEnd(20);
      const level = String(p.level).padEnd(8);
      const exp   = String(p.exp).padEnd(14);
      const drags = String(p.drag_kills).padEnd(14);
      const pvp   = String(p.pvp);
      disp.sln(`\`0${rank}  \`%${name}\`0${level}\`%${exp}\`0${drags}\`%${pvp}`);
    });
  }

  disp.sln('');
  disp.sln(`\`2Latest Hero: \`%${state.latesthero}`);
  disp.sln('');
  await session.more();
}

// ── REST router ────────────────────────────────────────────────────────────

const router = express.Router();

router.get('/', (req, res) => {
  const players = PlayerDB.getAll();
  const state   = StateDB.get();

  res.json({
    players: players.slice(0, 50).map((p, i) => ({
      rank       : i + 1,
      name       : p.name,
      level      : p.level,
      exp        : p.exp,
      drag_kills : p.drag_kills,
      pvp        : p.pvp,
      dead       : !!p.dead,
      sex        : p.sex,
    })),
    latesthero : state.latesthero,
    days       : state.days,
  });
});

// Export the router as the module default (for server/index.js require())
// and attach show() as a named property (for GameEngine require().show)
router.show = show;
module.exports = router;
