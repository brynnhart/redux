'use strict';

/**
 * server/game/GameEngine.js
 *
 * Top-level game loop.
 *
 * RULE: Never call session.send/sendln() with LoRD backtick codes.
 *       Always use disp.sln() / disp.sw() which route through LordColors.toAnsi().
 *       session.send() is reserved for raw ANSI bytes only (clear, cursor, etc.)
 */

const PlayerDB   = require('../db/PlayerDB');
const StateDB    = require('../db/StateDB');
const Display    = require('./text/Display');

// ── Entry point ────────────────────────────────────────────────────────────

async function run(session) {
  const disp = Display.forSession(session);

  session.clearScreen();
  let player = PlayerDB.getByUserId(session.userId);

  if (!player) {
    player = await newPlayer(session, disp);
    if (!player) {
      disp.sln('`4Character creation failed. Goodbye.`0');
      session.end();
      return;
    }
  } else {
    await checkDaily(player);
    player = PlayerDB.getById(player.id);
  }

  PlayerDB.setOnline(player.id, true);
  session.player = player;

  try {
    await gameLoop(session, disp);
  } finally {
    PlayerDB.patch(player.id, { on_now: false });
  }
}

// ── Daily check ────────────────────────────────────────────────────────────

async function checkDaily(player) {
  // TODO: compare player.time to today's day number
}

// ── Character creation — mirrors lord.js new_player() ─────────────────────

async function newPlayer(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('`%                ** Welcome to the realm, new warrior! **`0');
  disp.sln('');

  // ── Name ───────────────────────────────────────────────────────────────────
  let name = '';
  while (true) {
    disp.sw('`2What would you like as an alias`0? ');
    disp.sln('');
    disp.sw('`2Name: `%');
    name = (await session.getStr(20)).trim();
    if (!name) continue;
    if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
      disp.sln('`4Name may only contain letters, numbers, and spaces.');
      continue;
    }
    disp.sln('');
    // Confirm name — matches original "Chester? [Y] :"
    disp.sw(`\`2${name}\`0? [\`%Y\`0] : `);
    const conf = await session.prompt('', ['Y', 'N', '\r']);
    if (conf === 'N') continue;
    break;
  }

  // ── Sex ────────────────────────────────────────────────────────────────────
  disp.sln('');
  disp.sw('`2And your gender?  (`%M`2/`%F`2) [`%M`2]: ');
  const sex = await session.prompt('', ['M', 'F']);
  disp.sln('');
  disp.sln('');

  // Flavor response — matches original
  if (sex === 'M') {
    disp.sln('`2Then don\'t be wearing any dresses, eh.');
  } else {
    disp.sln('`2Good.  We need more women in this world.');
  }

  // ── Class selection — uses K/D/L keys matching original ───────────────────
  disp.sln('');
  disp.sln('`2As you remember your childhood, you remember...');
  disp.sln('');
  disp.sln('`5(`%K`5)illing a lot of woodland creatures.');
  disp.sln('`5(`%D`5)abbling in the mystical forces.');
  disp.sln('`5(`%L`5)ying, cheating, and stealing from the blind.');
  disp.sln('');
  disp.sw('`2Pick one.  (`%K`2,`%D`2,`%L`2) : ');

  const classKey = await session.prompt('', ['K', 'D', 'L']);
  disp.sln('');
  disp.sln('');

  // clss: 0=Normal(K=warrior), 1=Death Knight(D), 2=Thief(L)
  // Note: Mystic is unlocked via King Arthur's court, not at creation in original
  const clssMap   = { K: 0, D: 1, L: 2 };
  const clss      = clssMap[classKey];
  const classDesc = {
    K: [
      '`2Now that you\'ve grown up, you have decided to study the ways of the',
      '`2Normal Warrior.  You fight hard, live strong, and gain the most',
      '`2hitpoints and strength per level of any class.',
    ],
    D: [
      '`2Now that you\'ve grown up, you have decided to study the ways of the',
      '`2Death Knights.  All beginners want the power to use their body',
      '`2and weapon as one.  To inflict twice the damage with the finess only',
      '`2a warrior of perfect mind can do.',
    ],
    L: [
      '`2Now that you\'ve grown up, you have decided the life of a Thief',
      '`2suits you well.  You are quick, you are cunning, and you know',
      '`2how to separate a man from his gold when he isn\'t looking.',
    ],
  };

  classDesc[classKey].forEach(l => disp.sln(l));
  disp.sln('');
  await session.more();

  // ── Create record ──────────────────────────────────────────────────────────
  const player = PlayerDB.create(session.userId, name, sex);
  PlayerDB.patch(player.id, { clss });

  return PlayerDB.getById(player.id);
}

// ── Main game loop ─────────────────────────────────────────────────────────

async function gameLoop(session, disp) {
  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    session.clearScreen();
    showTownMenu(session, disp, session.player);

    const key = await session.getKeyUpper();
    if (!key || !session.alive) break;

    switch (key) {
      case 'F': await require('./locations/Forest').enter(session);         break;
      case 'K': await require('./locations/KingsArthurs').enter(session);   break;
      case 'H': await require('./locations/Healer').enter(session);         break;
      case 'I': await require('./locations/Inn').enter(session);            break;
      case 'Y': await require('./locations/Bank').enter(session);           break;
      case 'W': /* TODO: Write mail */                                       break;
      case 'C': /* TODO: Conjugality list */                                 break;
      case 'S': await require('./locations/Arena').enter(session);          break;  // Slaughter/PvP
      case 'A': await require('./locations/Armoury').enter(session);        break;
      case 'V': await showStats(session, disp);                             break;
      case 'T': await require('./locations/Arena').enter(session);          break;  // Turgon's training
      case 'L': await require('./systems/LeaderboardRouter').show(session); break;
      case 'D': await showDailyNews(session, disp);                        break;
      case 'O': /* TODO: Other places */                                     break;
      case 'M': /* TODO: Make announcement */                                break;
      case 'P': /* TODO: People online */                                    break;
      case 'Q':
        disp.sln('');
        disp.sln(`\`2Fare thee well, \`%${session.player.name}\`2. May your sword stay sharp!`);
        disp.sln('');
        session.end();
        return;
    }
  }
}

// ── Town Square display — matches lordtownsquare.png exactly ──────────────
//
// Layout observed in screenshot:
//   Line 1 : "Legend Of The Red Dragon - Town Square"  (cyan location name)
//   Line 2 : -=- separator
//   Line 3 : flavor text (2 lines)
//   Line 5 : blank
//   Lines 6-14: two-column menu (9 rows × 2 cols)
//   blank
//   status : "The Town Square  (? for menu)"
//   keys   : "(F,S,K,A,H,V,I,T,Y,L,W,D,C,O,X,M,P,Q)"
//   prompt : "Your command, [Name]? [fights:ff] :"

function showTownMenu(session, disp, player) {
  const LC  = require('./text/LordColors');
  const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

  // Title — location name in cyan, rest in default
  disp.sln('`%Legend of the Red Dragon `0- `3Town Square`0');
  disp.sln(SEP);

  // Flavor text
  disp.sln('`2The streets are crowded, it is difficult to');
  disp.sln('push your way through the mob....');
  disp.sln('');

  // Two-column menu helper.
  // Pattern matching original: `2(`%K`2)ey Text
  // We build each cell then pad to a fixed display-width before joining.
  const COL_WIDTH = 39; // display chars for left column
  const cell = (k, txt) => `\`2(\`%${k}\`2)${txt}`;
  const row  = (lk, lt, rk, rt) => {
    const leftRaw  = cell(lk, lt);
    const leftDisp = LC.dispLen(leftRaw);
    const pad      = ' '.repeat(Math.max(1, COL_WIDTH - leftDisp));
    const rightRaw = rk ? cell(rk, rt) : '';
    disp.sln(leftRaw + pad + rightRaw);
  };

  row('F', 'orest',                  'S', 'laughter other players');
  row('K', 'ing Arthurs Weapons',    'A', 'bduls Armour');
  row('H', 'ealers Hut',             'V', 'iew your stats');
  row('I', 'nn',                     'T', 'urgons Warrior Training');
  row('Y', 'e Old Bank',             'L', 'ist Warriors');
  row('W', 'rite Mail',              'D', 'aily News');
  row('C', 'onjugality List',        'O', 'ther Places');
  row('X', 'pert Mode',              'M', 'ake Announcement');
  row('P', 'eople Online',           'Q', 'uit to Fields');
  disp.sln('');

  // Status / prompt line
  disp.sln('`2The Town Square  `0(`2? for menu`0)');
  disp.sln('`2(F,K,H,I,Y,W,C,X,P,S,A,V,T,L,D,O,M,Q)');
  disp.sln('');
  disp.sw(`\`2Your command, \`%${player.name}\`2? [\`%${player.forest_fights}\`2] : `);
}

// ── View Stats — mirrors Stats.webp ───────────────────────────────────────

async function showStats(session, disp) {
  const p   = session.player;
  const SEP = '`2' + '-=-=-'.repeat(15) + '-';
  const classLabels = ['Normal', 'Death Knight', 'Thief', 'Mystic'];

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

  // Class-specific skill line
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

// ── Daily News stub ────────────────────────────────────────────────────────

async function showDailyNews(session, disp) {
  const LogDB = require('../db/LogDB');
  const SEP   = '`2' + '-=-=-'.repeat(15) + '-';

  session.clearScreen();
  disp.sln('`2The Daily Happenings....');
  disp.sln(SEP);

  const entries = LogDB.getToday();
  if (!entries.length) {
    disp.sln('`2Nothing of note has happened today.');
  } else {
    for (const e of entries) {
      disp.sln(e.line);
    }
  }

  disp.sln('');
  await session.more();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getClassName(clss) {
  return ['Normal', 'Death Knight', 'Thief', 'Mystic'][clss] || 'Normal';
}

module.exports = { run };
