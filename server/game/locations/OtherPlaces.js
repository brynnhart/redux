'use strict';

/**
 * server/game/locations/OtherPlaces.js
 *
 * In the original BBS door game, "Other Places" (O key) was a launcher for
 * third-party IGM (In-Game Module) add-ons installed by the sysop.  There
 * was no built-in content — it was purely a plugin infrastructure.
 *
 * In this web port we use this space for custom extensions.
 * For now it shows a coming-soon placeholder.
 */

const Display = require('../text/Display');

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

async function enter(session) {
  const disp = Display.forSession(session);
  const p    = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Other Places`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2You step off the cobblestones into the less-traveled parts of the realm.');
  disp.sln('');
  disp.sln('  `2A weathered sign nailed to a post reads:');
  disp.sln('');
  disp.sln('  `0  +-----------------------------------------------+');
  disp.sln('  `0  |                                               |');
  disp.sln('  `0  |   `%More destinations are being constructed.   `0|');
  disp.sln('  `0  |                                               |');
  disp.sln('  `0  |   `2Check back soon, adventurer.               `0|');
  disp.sln('  `0  |                                               |');
  disp.sln('  `0  +-----------------------------------------------+');
  disp.sln('');
  disp.sln(`  \`2You tip your hat to no one in particular, \`0${p.name}\`2,`);
  disp.sln('  `2and make your way back to town.');
  disp.sln('');

  await session.more();
}

module.exports = { enter };
