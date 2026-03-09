'use strict';

/**
 * server/game/ShowStats.js
 *
 * Shared player stats display — ported from lord.js show_stats().
 * Used by GameEngine (V key), Arena (V key), and any other location that needs it.
 */

const Display = require('./text/Display');

async function showStats(session, disp) {
  const p   = session.player;
  disp = disp || Display.forSession(session);
  const SEP = '`2' + '-=-=-'.repeat(15) + '-';

  session.clearScreen();
  disp.sln('`5Player\'s Stats...');
  disp.sln(SEP);

  disp.sln(`\`2Experience     : \`%${p.exp}`);
  disp.sln(`\`2Level          : \`%${p.level}` +
           `\`0                  \`2HitPoints      :(\`%${p.hp} \`2of \`%${p.hp_max}\`2)`);
  disp.sln(`\`2Forest Fights  : \`%${p.forest_fights}` +
           `\`0                  \`2Player Fights Left : \`%${p.pvp_fights}`);
  disp.sln(`\`2Gold In Hand   : \`%${p.gold}` +
           `\`0                  \`2Gold In Bank   : \`%${p.bank}`);
  disp.sln(`\`2Weapon         : \`%${p.weapon}` +
           `\`0                  \`2Attack Strength : \`%${p.str}`);
  disp.sln(`\`2Armour         : \`%${p.arm}` +
           `\`0                  \`2Defensive Strength : \`%${p.def}`);
  disp.sln(`\`2Charm          : \`%${p.cha}` +
           `\`0                  \`2Gems           : \`%${p.gem}`);

  if (p.clss === 1) {
    disp.sln('');
    disp.sln(`\`2Death Knight Skills: \`%${p.skillw}\`0                \`2Uses Today: (\`%${p.levelw}\`2)`);
    disp.sln('');
    disp.sln('`2You are currently interested in `%Death Knight`2 skills.');
  } else if (p.clss === 2) {
    disp.sln('');
    disp.sln(`\`2Thieving Skills: \`%${p.skillt}\`0                  \`2Uses Today: (\`%${p.levelt}\`2)`);
    disp.sln('');
    disp.sln('`2You are currently interested in `%Thieving`2 skills.');
  } else if (p.clss === 3) {
    disp.sln('');
    disp.sln(`\`2Mystical Skills: \`%${p.skillm}\`0                  \`2Uses Today: (\`%${p.levelm}\`2)`);
    disp.sln('');
    disp.sln('`2You are currently interested in `%Mystical`2 skills.');
  }

  disp.sln('');
  await session.more();
}

module.exports = { showStats };
