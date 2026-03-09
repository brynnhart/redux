'use strict';

/**
 * server/game/locations/PeopleOnline.js
 *
 * Ported from lord.js warriors_on_now() — line 5671
 *
 * Shows all players currently online (on_now = 1) with their name
 * and the time they logged in.  The original also showed a "where"
 * field from a per-node .lrd file; we display "In the Realm" since
 * we have no per-session location tracking yet.
 *
 * Accessed via (P) on the Town Square menu.
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

// Pad a string to a fixed width with trailing spaces
function pad(str, width) {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

async function enter(session) {
  const disp   = Display.forSession(session);
  const me     = session.player;
  const all    = PlayerDB.getAll();
  const online = all.filter(p => p.on_now && p.name !== 'X');

  session.clearScreen();
  disp.sln('');
  disp.sln('                         `%Warriors in the Realm Now`0');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');

  if (!online.length) {
    disp.sln('  `2No other warriors are online right now.');
  } else {
    // Column header
    disp.sln(`  \`2${pad('Name', 25)}   Arrived At`);
    disp.sln(`  \`2${pad('----', 25)}   ----------`);
    disp.sln('');

    online.forEach(op => {
      const marker = op.id === me.id ? ' `%<-- You`2' : '';
      disp.sln(`  \`0${pad(op.name, 25)}   \`%${op.time_on || '??:??'}\`2${marker}`);
    });
  }

  disp.sln('');
  disp.sln(`  \`2${online.length} warrior${online.length !== 1 ? 's' : ''} online.`);
  disp.sln('');
  await session.more();
}

module.exports = { enter };
