'use strict';

/**
 * server/game/locations/Armoury.js
 *
 * TODO: Port from lord.js — abduls_armour() — lord.js lines 10303–10577
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

/**
 * Enter the Armoury location.
 * @param {Session} session
 */
async function enter(session) {
  const disp   = Display.forSession(session);
  // const player = session.player;  // uncomment when implementing

  session.clearScreen();
  disp.sln('`%Armoury`0');
  disp.sln('');
  disp.sln('`4This location is not yet implemented.`0');
  disp.sln('');
  await session.more();
}

module.exports = { enter };
