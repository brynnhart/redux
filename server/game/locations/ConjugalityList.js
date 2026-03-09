'use strict';

/**
 * server/game/locations/ConjugalityList.js
 *
 * Ported from lord.js conjugality_list() — line 16207
 *
 * Displays all player-player marriages (married_to field, shown once per
 * pair by only printing when the lower-indexed player is iterated) plus
 * NPC marriages to Violet and Seth Able stored in game_state.
 *
 * Phrase list cycles through romantic descriptors so each couple gets
 * a different label, wrapping back to the start as needed.
 *
 * Accessed via (C) on the Town Square menu.
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');
const StateDB  = require('../../db/StateDB');

const PHRASES = [
  'hitched with',
  'attached to',
  'in love with',
  'a love slave to',
  'smitten with love for',
  'in matrimony with',
  'in marital bliss with',
  'wedded to',
];

async function enter(session) {
  const disp  = Display.forSession(session);
  const state = StateDB.get();
  const all   = PlayerDB.getAll();

  session.clearScreen();
  disp.sln('');
  disp.sln('                     `%** CONJUGALITY LIST **`0');
  disp.sln('                    `2-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');

  let some        = false;
  let phraseIndex = 0;

  all.forEach((op, i) => {
    if (op.name === 'X') return;   // deleted player slot

    // Player–player marriage: only print once per pair, for the
    // lower-index player (mirrors the original `i < op.married_to` guard)
    if (op.married_to > -1 && i < op.married_to) {
      const spouse = all.find(p => p.id === op.married_to);
      if (spouse) {
        disp.sln(`  \`0${op.name} \`2is ${PHRASES[phraseIndex]} \`0${spouse.name}\`2.`);
        phraseIndex = (phraseIndex + 1) % PHRASES.length;
        some = true;
      }
    }

    // NPC marriages — stored by player id in game_state
    if (op.id === state.married_to_seth) {
      disp.sln(`  \`0${op.name} \`2is the property of \`0Seth Able\`2.`);
      some = true;
    }
    if (op.id === state.married_to_violet) {
      disp.sln(`  \`0${op.name} \`2belongs to \`0Violet\`2.`);
      some = true;
    }
  });

  if (!some) {
    disp.sln('  `%No one is married in this realm.');
  }

  disp.sln('');
  await session.more();
}

module.exports = { enter };
