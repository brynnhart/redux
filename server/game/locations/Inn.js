'use strict';

/**
 * server/game/locations/Inn.js
 *
 * TODO: Port from lord.js — red_dragon_inn() — lord.js lines 9894–10015
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

/**
 * Enter the Inn location.
 * @param {Session} session
 */
async function enter(session) {
  const disp   = Display.forSession(session);
  // const player = session.player;  // uncomment when implementing

  session.clearScreen();
  disp.sln('`%Inn`0');
  disp.sln('');
  disp.sln('`4This location is not yet implemented.`0');
  disp.sln('');
  await session.more();
}

module.exports = { enter };
