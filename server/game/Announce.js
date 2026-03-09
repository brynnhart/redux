'use strict';

/**
 * server/game/Announce.js
 *
 * Shared Make Announcement function — ported from lord.js announce() line 9397.
 * Used from: town square (GameEngine M key), Inn (M key).
 *
 * Confirms before proceeding, then collects multi-line message (blank line ends).
 * Appends to daily log via LogDB.
 */

const LogDB = require('../db/LogDB');

async function makeAnnouncement(session, disp) {
  const p = session.player;

  disp.sln('');
  disp.sln('');
  disp.sln('  `2Are you sure you want to announce something?  It will appear to');
  disp.sln('  EVERYONE in the daily happenings.');
  disp.sln('');
  disp.sw('  Make Announcement? [`0Y`2] : `%');

  const ch  = await session.prompt('', ['Y', 'N', '\r']);
  const yes = (ch !== 'N');
  disp.sln(yes ? 'Y' : 'N');
  if (!yes) return;

  const lines = [`  \`0${p.name}\`2 Announces:\`%`];

  disp.sln('');
  disp.sln('  Enter message now.  Blank line quits.');
  disp.sln('');

  while (session.alive) {
    disp.sw('  `2> `%');
    const line = (await session.getStr(75)).trim();
    disp.sln('');
    if (!line) break;
    lines.push(`  \`%${line}`);
  }

  if (lines.length > 1) {
    LogDB.append(lines.join('\n'));
    disp.sln('  `2Announcement Made!');
  } else {
    disp.sln('  `2(Nothing announced.)');
  }
  disp.sln('');
  await session.more();
}

module.exports = { makeAnnouncement };
