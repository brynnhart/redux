'use strict';

/**
 * server/game/systems/Rankings.js + LeaderboardRouter
 *
 * Generates player rankings and serves them via REST for the public
 * leaderboard page.
 *
 * Replaces: generate_rankings() and show_game_stats() from lord.js
 */

const express   = require('express');
const PlayerDB  = require('../../db/PlayerDB');
const StateDB   = require('../../db/StateDB');
const Display   = require('../text/Display');

// ── In-game rankings display ───────────────────────────────────────────────

async function show(session) {
  const disp    = Display.forSession(session);
  const players = PlayerDB.getAll(); // sorted by exp DESC
  const state   = StateDB.get();

  session.clearScreen();
  disp.sln('`%                 The Mighty Warriors of the Realm');
  disp.sln('`0' + '═'.repeat(79));
  disp.sln('');
  disp.sln('`2Rank  Name                Level   Exp          Dragon Kills  PvP Kills');
  disp.sln('`0' + '─'.repeat(79));

  players.slice(0, 20).forEach((p, idx) => {
    const rank   = String(idx + 1).padStart(4);
    const name   = p.name.padEnd(20);
    const level  = String(p.level).padEnd(8);
    const exp    = String(p.exp).padEnd(13);
    const drags  = String(p.drag_kills).padEnd(14);
    const pvp    = String(p.pvp);
    disp.sln(`\`2${rank}  \`%${name}\`2${level}\`%${exp}\`2${drags}\`%${pvp}`);
  });

  disp.sln('');
  disp.sln(`\`2Latest Hero: \`%${state.latesthero}`);
  disp.sln('');
  await session.more();
}

// ── REST router for public leaderboard ────────────────────────────────────

const router = express.Router();

/** GET /api/leaderboard */
router.get('/', (req, res) => {
  const players = PlayerDB.getAll();
  const state   = StateDB.get();

  const ranked = players.slice(0, 50).map((p, i) => ({
    rank       : i + 1,
    name       : p.name,
    level      : p.level,
    exp        : p.exp,
    drag_kills : p.drag_kills,
    pvp        : p.pvp,
    dead       : !!p.dead,
    sex        : p.sex,
  }));

  res.json({
    players    : ranked,
    latesthero : state.latesthero,
    days       : state.days,
  });
});

module.exports = show;
module.exports.router = router;

// Express wants a plain router exported for use in index.js
// Export as default AND named so both work:
Object.assign(module.exports, router);
// Simpler: just re-export router as the module so AuthRouter usage works
module.exports = router;
module.exports.show = show;
