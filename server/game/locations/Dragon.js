'use strict';

/**
 * server/game/locations/Dragon.js
 *
 * TODO: Port from lord.js — fight_dragon() — lord.js lines 11919–12219
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

/**
 * Enter the Dragon location.
 * @param {Session} session
 */
async function enter(session) {
  const disp   = Display.forSession(session);
  // const player = session.player;  // uncomment when implementing

  session.clearScreen();
  disp.sln('`%Dragon`0');
  disp.sln('');
  disp.sln('`4This location is not yet implemented.`0');
  disp.sln('');
  await session.more();
}

module.exports = { enter };
