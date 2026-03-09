'use strict';

/**
 * server/game/locations/Healer.js
 *
 * Ported from lord.js healers() — lines 10797–10976
 *
 * Pricing:  5 * player.level gold per 1 HP
 * Keys:     (H)eal all   (C)hoose amount   (R/Q)eturn
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

function pretty(n) { return Math.floor(n).toLocaleString(); }
const SEP = '`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

// ── Persist HP + gold changes to DB ──────────────────────────────────────

function persist(session) {
  const p = session.player;
  PlayerDB.patch(p.id, { hp: p.hp, gold: p.gold });
  session.player = PlayerDB.getById(p.id);
}

// ── Draw the full healer screen (header + status + menu options) ──────────

function drawScreen(session, disp) {
  session.clearScreen();
  const p       = session.player;
  const costPer = 5 * p.level;

  disp.sln('');
  disp.sln('  `%Healers Hut`0');
  disp.sln(SEP);
  disp.sln('');

  if (p.hp >= p.hp_max) {
    disp.sln('  `0"You look fine to us!"`2 the healers tell you.');
    disp.sln('');
    return true; // at full health — caller should just more() and exit
  }

  disp.sw(`\`2  HitPoints: (\`0${pretty(p.hp)} \`2of \`0${pretty(p.hp_max)}\`2)`);
  disp.sln(`   \`2Gold: \`0${pretty(p.gold)}`);
  disp.sln(`  \`2(it costs \`%${pretty(costPer)} \`2gold to heal 1 hitpoint)`);
  disp.sln('');
  disp.sln('  `2(`%H`2)eal me all the way up');
  disp.sln('  (`%C`2)hoose the amount to be healed');
  disp.sln('  (`%R`2)eturn to where you came from');
  disp.sln('');
  disp.sw('  `5The Healers Hut   `2(H,C,R)  `2Your command? : ');

  return false; // still injured
}

// ── Heal all (H key) — lord.js heal_all() ─────────────────────────────────

async function healAll(session, disp) {
  const p       = session.player;
  const costPer = 5 * p.level;
  const need    = p.hp_max - p.hp;

  if (p.hp >= p.hp_max) {
    disp.sln('');
    disp.sln('  `0"You look fine to us!"`2');
    disp.sln('');
    await session.more();
    return true; // fully healed, exit healer
  }

  const fullCost = need * costPer;

  if (p.gold >= fullCost) {
    p.gold -= fullCost;
    p.hp    = p.hp_max;
    disp.sln('');
    disp.sln(`\`0  ${pretty(need)}\`2 hit points are healed and you feel much better.`);
    disp.sln('');
    await session.more();
    persist(session);
    return true; // fully healed — exit
  }

  // Partial heal — heal as much as gold allows
  const afford = Math.floor(p.gold / costPer);
  disp.sln('');
  if (afford < 1) {
    disp.sln('  `2"I\'m afraid you can\'t afford any healing."');
  } else {
    p.gold -= afford * costPer;
    p.hp   += afford;
    disp.sln(`  \`2${pretty(afford)} hit points are healed and you feel much better.`);
    persist(session);
  }
  disp.sln('');
  await session.more();
  return false; // still injured
}

// ── Heal some (C key) — lord.js heal_some() ──────────────────────────────

async function healSome(session, disp) {
  const p       = session.player;
  const costPer = 5 * p.level;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Healers Hut`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sw(`\`2  HitPoints: (\`0${pretty(p.hp)} \`2of \`0${pretty(p.hp_max)}\`2)`);
  disp.sln(`   \`2Gold: \`0${pretty(p.gold)}`);
  disp.sln(`  \`2(it costs \`%${pretty(costPer)} \`2gold to heal 1 hitpoint)`);
  disp.sln('');
  disp.sln('  "How many hit points would you like healed?"');
  disp.sln('');
  disp.sw('  `0AMOUNT : `%');

  const input = (await session.getStr(5, { allowed: /[0-9]/ })).trim();
  const amt   = parseInt(input, 10);

  disp.sln('');

  if (!input || isNaN(amt) || amt === 0) {
    disp.sln('  "Maybe some other time.."');
  } else if (amt < 0) {
    disp.sln('  "Uh...Wouldn\'t that be hurting yourself?!"');
  } else if (amt * costPer > p.gold) {
    disp.sln('  "I\'m afraid you don\'t have enough gold to cover that."');
  } else if (amt > (p.hp_max - p.hp)) {
    disp.sln('  "It would be deadly to over heal yourself!!"');
  } else {
    p.gold -= amt * costPer;
    p.hp   += amt;
    disp.sln('  Done!');
    persist(session);
  }

  disp.sln('');
  await session.more();
}

// ── Entry point ───────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);

  // Guard: hp should never be negative
  if (session.player.hp < 1) {
    session.player.hp = 1;
    PlayerDB.patch(session.player.id, { hp: 1 });
    session.player = PlayerDB.getById(session.player.id);
  }

  // Draw initial screen. If already at full health, show message and leave.
  if (drawScreen(session, disp)) {
    await session.more();
    return;
  }

  // Main healer loop — screen is already drawn, just wait for keypress
  while (session.alive) {
    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) break;
    disp.sln(ch);

    switch (ch) {
      case 'H': {
        const done = await healAll(session, disp);
        if (done) return; // fully healed — leave
        // Redraw for next command
        if (drawScreen(session, disp)) { await session.more(); return; }
        break;
      }

      case 'C':
        await healSome(session, disp);
        // Redraw after heal-some
        if (drawScreen(session, disp)) { await session.more(); return; }
        break;

      case '?':
        if (drawScreen(session, disp)) { await session.more(); return; }
        break;

      // Easter-egg look-around responses from original source
      case '1':
        disp.sln(''); disp.sln('  I wonder what\'s cooking..'); disp.sln('');
        break;
      case '2':
        disp.sln(''); disp.sln('  Eye am not sure what you\'re looking at.'); disp.sln('');
        break;
      case '3':
        disp.sln(''); disp.sln('  Used to be a patient..  Hmmm.'); disp.sln('');
        break;

      case 'R':
      case 'Q':
      case '\r':
        return;

      default:
        // Unknown key — re-show the prompt line without redrawing everything
        disp.sw('  `5The Healers Hut   `2(H,C,R)  `2Your command? : ');
        break;
    }
  }
}

module.exports = { enter };
