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
    // ── Login routines ───────────────────────────────────────────────────
    await wakeUp(session, disp);
    await checkMarriage(session, disp);
    await checkWonBy(session, disp);
    await gameLoop(session, disp);
  } finally {
    PlayerDB.patch(player.id, { on_now: false });
  }
}

// ── Daily check ────────────────────────────────────────────────────────────

async function checkDaily(player) {
  // nothing needed here — wake_up / check_marriage run after the player
  // is set on the session, so they can use session.send / session.more
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

// ── Wake up (inn scene on login) ──────────────────────────────────────────

async function wakeUp(session, disp) {
  const p = session.player;
  if (!p.inn) return;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%You Wake Up At The Inn`0');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');
  disp.sln('  `2You yawn and stretch, rubbing sleep from your eyes.  The');
  disp.sln('  smell of bacon and fresh bread drifts up from the common room.');
  disp.sln('');
  disp.sln('  `2You feel well-rested and ready to take on the world.');
  disp.sln('');
  disp.sln('  \`%Welcome back to the realm, \`0' + p.name + '\`2!');
  disp.sln('');

  // Restore HP to max on inn login
  if (p.hp < p.hp_max) {
    PlayerDB.patch(p.id, { hp: p.hp_max, inn: false });
    session.player = PlayerDB.getById(p.id);
    disp.sln('  \`2Your Hit Points have been restored to \`%' + p.hp_max + '\`2!');
  } else {
    PlayerDB.patch(p.id, { inn: false });
    session.player = PlayerDB.getById(p.id);
  }
  disp.sln('');
  await session.more();
}

// ── Check marriage mail (daily marriage perks / events at login) ──────────

async function checkMarriage(session, disp) {
  const MailDB = require('../db/MailDB');
  const StateDB = require('../db/StateDB');
  const p     = session.player;
  const state = StateDB.get();

  // NPC marriage — Violet
  if (p.married_to === -2 && state.married_to_violet === p.id) {
    const msgs = [
      '  `#\"I missed you so much today!  The house seemed empty without you.\"',
      '  `#\"I baked your favourite bread today, darling.  Hurry home soon!\"',
      '  `#\"Some warrior came asking for you today.  I told them you were busy.\"',
      '  `#\"I found a gem in the garden today!  I left it on the table for you.\"',
      '  `#\"Thinking of you always, my love.\"',
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    // Gem gift (1 in 4 chance — matches the gem message)
    const giveGem = (msg.includes('gem'));
    if (giveGem) {
      PlayerDB.patch(p.id, { gem: (p.gem || 0) + 1 });
      session.player = PlayerDB.getById(p.id);
    }
    MailDB.sendMail(p.id, null,
      '  `%A Note From Violet\n' +
      '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n' +
      msg
    );
  }

  // NPC marriage — Seth Able
  if (p.married_to === -2 && state.married_to_seth === p.id) {
    const msgs = [
      '  `%"I wrote a new song about you today.  I\'ll play it tonight."',
      '  `%"The crowd loved the ballad last night.  They asked if you\'d be there."',
      '  `%"I found two gold pieces in my old coat.  Saved them for you, love."',
      '  `%"Thinking of you while I tune this old mandolin."',
      '  `%"A warrior insulted me today.  I bet you\'d have words with them!"',
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    const giveGold = msg.includes('gold pieces');
    if (giveGold) {
      PlayerDB.patch(p.id, { gold: Math.min((p.gold || 0) + 2, 2000000000) });
      session.player = PlayerDB.getById(p.id);
    }
    MailDB.sendMail(p.id, null,
      '  `%A Note From Seth Able\n' +
      '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n' +
      msg
    );
  }

  // Kids give a small experience bonus once per real-world day
  if ((p.kids || 0) > 0) {
    const bonus = p.kids * p.level * 10;
    PlayerDB.patch(p.id, { exp: Math.min((p.exp || 0) + bonus, 2000000000) });
    session.player = PlayerDB.getById(p.id);
  }
}

// ── Check for game-over / won_by screen ───────────────────────────────────

async function checkWonBy(session, disp) {
  const StateDB = require('../db/StateDB');
  const state   = StateDB.get();
  if (state.won_by < 0) return;

  const winner = PlayerDB.getById(state.won_by);
  const name   = winner ? winner.name : state.latesthero;

  session.clearScreen();
  disp.sln('');
  disp.sln('`c`%         ** THE RED DRAGON HAS BEEN SLAIN! **');
  disp.sln('');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');
  disp.sln('  \`0' + name + '\`2 has defeated the mighty \`4Red Dragon\`2 and saved the realm!');
  disp.sln('');
  disp.sln('  `2The kingdom erupts in celebration!  Songs are sung in every tavern,');
  disp.sln('  banners hang from every window, and children dance in the streets.');
  disp.sln('');
  disp.sln('  \`%' + name + ' \`2is hailed as the greatest warrior who ever lived!');
  disp.sln('');
  disp.sln('  `2A new day will dawn soon and the realm will be reborn...');
  disp.sln('');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');

  if (winner && winner.id === session.player.id) {
    disp.sln('  `%YOU are the hero of legend!  Your name will be remembered forever.');
    disp.sln('');
  }

  await session.more();
}



async function gameLoop(session, disp) {
  // Check for incoming mail before the first town menu draw
  const { checkIncomingMail } = require('./locations/WriteMail');
  await checkIncomingMail(session, Display.forSession(session));

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
      case 'W': await require('./locations/WriteMail').enter(session);       break;
      case 'C': await require('./locations/ConjugalityList').enter(session); break;
      case 'S': await require('./locations/Arena').enter(session);          break;  // Slaughter/PvP
      case 'A': await require('./locations/Armoury').enter(session);        break;
      case 'V': await showStats(session, disp);                             break;
      case 'T': await require('./locations/Turgons').enter(session);        break;  // Turgon's training
      case 'L': await require('./systems/LeaderboardRouter').show(session); break;
      case 'D': await showDailyNews(session, disp);                        break;
      case 'O': await require('./locations/OtherPlaces').enter(session);     break;
      case 'M': await require('./Announce').makeAnnouncement(session, disp); break;
      case 'P': await require('./locations/PeopleOnline').enter(session);    break;
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
  await require('./ShowStats').showStats(session, disp);
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
