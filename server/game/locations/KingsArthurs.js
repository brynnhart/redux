'use strict';

/**
 * server/game/locations/KingsArthurs.js
 *
 * TODO: Port from lord.js — king_arthurs(), raise_class() — lord.js lines 10016–10302, 10578–10796
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

/**
 * Enter the KingsArthurs location.
 * @param {Session} session
 */
async function enter(session) {
  const disp   = Display.forSession(session);
  // const player = session.player;  // uncomment when implementing

  session.clearScreen();
  disp.sln('`%KingsArthurs`0');
  disp.sln('');
  disp.sln('`4This location is not yet implemented.`0');
  disp.sln('');
  await session.more();
}

module.exports = { enter };
