'use strict';

/**
 * server/game/locations/Arena.js
 *
 * TODO: Port from lord.js — turgons() — lord.js lines 15572–15885
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

/**
 * Enter the Arena location.
 * @param {Session} session
 */
async function enter(session) {
  const disp   = Display.forSession(session);
  // const player = session.player;  // uncomment when implementing

  session.clearScreen();
  disp.sln('`%Arena`0');
  disp.sln('');
  disp.sln('`4This location is not yet implemented.`0');
  disp.sln('');
  await session.more();
}

module.exports = { enter };
