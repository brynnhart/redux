'use strict';

/**
 * server/game/locations/Bank.js
 *
 * Ported from lord.js ye_old_bank() — lines 15886–16206
 *
 * Keys: (W)ithdraw  (D)eposit  (T)ransfer  (R/Q)eturn  (?)redraw
 *
 * Transfer limits (matching original settings defaults):
 *   transfer_amount    = 2,000,000 gold max per transfer
 *   transfers_per_day  = 2 transfers per day
 *
 * On first exit: 1-in-30 chance Aidan offers the Amulet of Accuracy.
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function rand(n)   { return Math.floor(Math.random() * Math.max(1, n)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP            = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';
const MAX_GOLD       = 2000000000;
const TRANSFER_MAX   = 2000000;
const TRANSFERS_DAY  = 2;

const CLASS_LIST = ['stranger', 'warrior', 'magician', 'thief'];

// ── Persist helper ────────────────────────────────────────────────────────

function persist(session, fields) {
  PlayerDB.patch(session.player.id, fields);
  session.player = PlayerDB.getById(session.player.id);
}

// ── Draw full screen ──────────────────────────────────────────────────────

function drawScreen(session, disp) {
  session.clearScreen();
  const p = session.player;

  disp.sln('');
  disp.sln('  `%Ye Olde Bank`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2You enter the cool stone building.  A portly banker sits behind');
  disp.sln('  a heavy oak desk, eyeing you with professional suspicion.');
  disp.sln('');
  disp.sln('  `2(`%W`2)ithdraw gold from your account');
  disp.sln('  (`%D`2)eposit gold into your account');
  disp.sln('  (`%T`2)ransfer gold to another player');
  disp.sln('  (`%R`2)eturn to Town Square');
  disp.sln('');
  showStatus(disp, p);
  disp.sln('  `5The Bank  `2(W,D,T,R)');
  disp.sln('');
  disp.sw(`\`2  Your command, \`0${p.name}\`2? : `);
}

function showStatus(disp, p) {
  disp.sw(`\`2  Gold In Hand : \`0${pretty(p.gold)}`);
  disp.sln(`   \`2Gold In Bank : \`0${pretty(p.bank)}`);
  disp.sln('');
}

// ── W — Withdraw ──────────────────────────────────────────────────────────

async function withdraw(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Ye Olde Bank`0');
  disp.sln(SEP);
  disp.sln('');
  showStatus(disp, p);
  disp.sln('  `2"How much gold would you like to withdraw?" `0(1 for ALL of it)');
  disp.sln('');
  disp.sw('  `0AMOUNT : `%');

  const input = (await session.getStr(11, { allowed: /[0-9]/ })).trim();
  let   amt   = parseInt(input, 10);
  disp.sln('');

  if (!input || isNaN(amt) || amt === 0) {
    disp.sln('  "Okay. Maybe another time."');
  } else if (amt < 0) {
    disp.sln('  "Uh...Wouldn\'t that be depositing?!"');
  } else {
    // 1 = withdraw all
    if (amt === 1 && p.bank > 1) amt = p.bank;
    // Cap to avoid exceeding gold limit
    if (p.gold + amt > MAX_GOLD) amt = MAX_GOLD - p.gold;

    if (amt > p.bank) {
      const title = p.sex === 'M' ? 'sir' : 'ma\'am';
      disp.sln(`  "I'm afraid you don't have that much in your account, ${title}."`);
    } else if (amt <= 0) {
      disp.sln('  "You can\'t carry any more gold, friend."');
    } else {
      persist(session, { gold: p.gold + amt, bank: p.bank - amt });
      disp.sln(`  Done!  ${pretty(amt)} withdrawn.`);
    }
  }

  disp.sln('');
  await session.more();
}

// ── D — Deposit ───────────────────────────────────────────────────────────

async function deposit(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Ye Olde Bank`0');
  disp.sln(SEP);
  disp.sln('');
  showStatus(disp, p);
  disp.sln('  `2"How much gold would you like to deposit?" `0(1 for ALL of it)');
  disp.sln('');
  disp.sw('  `0AMOUNT : `%');

  const input = (await session.getStr(11, { allowed: /[0-9]/ })).trim();
  let   amt   = parseInt(input, 10);
  disp.sln('');

  if (!input || isNaN(amt) || amt === 0) {
    disp.sln('  "Okay. Maybe another time."');
  } else if (amt < 0) {
    disp.sln('  "Uh...Wouldn\'t that be withdrawing?!"');
  } else {
    // 1 = deposit all
    if (amt === 1 && p.gold > 1) amt = p.gold;
    // Cap to avoid exceeding bank limit
    if (p.bank + amt > MAX_GOLD) amt = MAX_GOLD - p.bank;

    if (p.bank >= MAX_GOLD) {
      persist(session, { bank: MAX_GOLD });
      disp.sln('  "I\'m sorry, but we can only keep 2,000,000,000 gold at a time."');
    } else if (amt > p.gold) {
      const title = p.sex === 'M' ? 'sir' : 'ma\'am';
      disp.sln(`  "I'm afraid you don't have that much on you, ${title}."`);
    } else if (amt <= 0) {
      disp.sln('  "Your account is already full, friend."');
    } else {
      persist(session, { gold: p.gold - amt, bank: p.bank + amt });
      disp.sln(`  Done!  ${pretty(amt)} deposited.`);
    }
  }

  disp.sln('');
  await session.more();
}

// ── T — Transfer gold to another player ──────────────────────────────────

async function transfer(session, disp) {
  const p = session.player;

  // Daily transfer limit check
  if ((p.transferred_gold || 0) >= TRANSFERS_DAY) {
    disp.sln('');
    disp.sln('  `0"Very sorry, but all couriers are busy today."');
    disp.sln('');
    await session.more();
    return;
  }

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Ye Olde Bank`0');
  disp.sln(SEP);
  disp.sln('');
  showStatus(disp, p);
  disp.sln('  `2"How much gold would you like to transfer?"');
  disp.sln('');
  disp.sw('  `0AMOUNT : `%');

  const input = (await session.getStr(11, { allowed: /[0-9]/ })).trim();
  let   amt   = parseInt(input, 10);
  disp.sln('');

  if (!input || isNaN(amt) || amt === 0) {
    disp.sln('  "Okay. Maybe some other time."');
    await session.more();
    return;
  }
  if (amt < 0) {
    disp.sln('  "Uh...Wouldn\'t that be taking money from their account?!"');
    await session.more();
    return;
  }
  if (amt > p.bank) {
    const title = p.sex === 'M' ? 'sir' : 'woman';
    disp.sln(`  "I'm afraid you don't have that much in your account, ${title}."`);
    await session.more();
    return;
  }
  if (amt > TRANSFER_MAX) {
    disp.sln(`  "Our messenger will not carry more than ${pretty(TRANSFER_MAX)} gold pieces at a time!"`);
    await session.more();
    return;
  }

  disp.sln('  "And who would you like to send this gold to?"');
  disp.sln('');
  disp.sw('  `2Recipient name : `%');

  const recipName = (await session.getStr(20)).trim();
  disp.sln('');

  if (!recipName) {
    disp.sln('  Gold Not Sent!');
    await session.more();
    return;
  }

  // Find the player by name (case-insensitive)
  const all    = PlayerDB.getAll();
  const recip  = all.find(pl =>
    pl.name.trim().toLowerCase() === recipName.toLowerCase() &&
    pl.id !== session.player.id
  );

  if (!recip) {
    disp.sln(`  "I don't know anyone by that name, ${p.sex === 'M' ? 'sir' : 'ma\'am'}."`);
    disp.sln('  Gold Not Sent!');
    await session.more();
    return;
  }

  // Perform transfer — deduct from sender's bank, add to recipient's bank
  persist(session, {
    bank: p.bank - amt,
    transferred_gold: (p.transferred_gold || 0) + 1,
  });
  PlayerDB.patch(recip.id, { bank: clamp(recip.bank + amt, 0, MAX_GOLD) });

  disp.sln(`  Done!  \`0${recip.name}\`2 will be notified!`);
  disp.sln('');

  // TODO: send in-game mail notification when mail system is implemented
  await session.more();
}

// ── Exit event: Aidan and the Amulet of Accuracy ─────────────────────────
// Triggers once per visit (leftbank flag), 1-in-30 chance, only if no amulet.

async function aidanEvent(session, disp) {
  const p = session.player;

  if (p.amulet) return;               // already has one
  if (p.leftbank) return;             // already fired this session

  // Mark as seen regardless of outcome
  persist(session, { leftbank: true });

  if (rand(30) !== 0) return;         // 1-in-30 chance

  const classLabel = CLASS_LIST[p.clss] || 'stranger';
  const cost       = p.level * 1000;

  session.clearScreen();
  disp.sln('  `%A Random Event!`0');
  disp.sln('`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');
  disp.sln('  `2While leaving the bank, a stranger approaches you..');
  disp.sln('');
  disp.sln(`  \`2"\`0Hello there ${classLabel}. My name is Aidan. I have something that might`);
  disp.sln('  interest you. It\'s just a little necklace I found in the forest, but');
  disp.sln('  the old man in the Dark Cloak Tavern called it an \'`%Amulet of Accuracy`2\'');
  disp.sln(`  I have no use for it. I'll sell it to you - only \`0${pretty(cost)} \`2gold"`);
  disp.sln('');
  disp.sln('');
  disp.sw('  `2Buy the Amulet? [`0N`2] : `%');

  const ch = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(ch === 'Y' ? 'Y' : 'N');

  if (ch !== 'Y') return;

  // Re-read player in case gold changed
  session.player = PlayerDB.getById(session.player.id);
  const pp = session.player;

  if (pp.amulet) {
    disp.sln('');
    disp.sln('  `2"I\'m sorry, but you already have an amulet. I cannot sell you another."');
  } else if (pp.gold < cost) {
    disp.sln('');
    disp.sln('  `2"I\'m sorry, but it seems you don\'t have enough gold to make');
    disp.sln('  the trade. Maybe some other time."');
  } else {
    disp.sln('');
    disp.sln('  `2"Thank you. I believe you\'ll enjoy that little amulet.');
    disp.sln('  It may come in handy in battle."');
    persist(session, { gold: pp.gold - cost, amulet: true });
  }

  disp.sln('');
  await session.more();
}

// ── Thief fairy steal event (key '2') ─────────────────────────────────────

async function thiefFairySteal(session, disp) {
  const p = session.player;

  if (p.clss !== 3) {
    disp.sln('  Steal?  Never!');
    return;
  }
  if (!p.has_fairy) {
    disp.sln('  You\'re a thief, find the key.');
    return;
  }

  disp.sln('  `0** `%TRICKY EVENT! `0**`2');
  disp.sln('');
  disp.sln('  The buzzing in your pocket reminds you');
  disp.sln('  that the little fairy can feel your emotions.');
  disp.sln('');
  await session.more();

  disp.sln('  `%IT ESCAPES FROM YOUR POCKET AND PICKS THE LOCK!');
  disp.sln('');
  await session.more();

  const amt = (rand(500) + 500) * p.level;
  persist(session, { has_fairy: false, gold: clamp(p.gold + amt, 0, MAX_GOLD) });
  disp.sln(`  \`2You steal \`0${pretty(amt)} \`2while the banker isn't looking.`);
  disp.sln('');
  await session.more();
}

// ── Entry point ───────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);

  // Reset the leftbank flag each visit so Aidan can fire once per visit
  persist(session, { leftbank: false });

  drawScreen(session, disp);

  while (session.alive) {
    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) break;
    disp.sln(ch);

    switch (ch) {
      case 'W':
        await withdraw(session, disp);
        drawScreen(session, disp);
        break;

      case 'D':
        await deposit(session, disp);
        drawScreen(session, disp);
        break;

      case 'T':
        await transfer(session, disp);
        drawScreen(session, disp);
        break;

      case '?':
        drawScreen(session, disp);
        break;

      // ── Easter eggs from original source ──────────────────────────────
      case '1':
        disp.sln(''); disp.sln(''); disp.sln('  Nice rock.'); disp.sln('');
        break;

      case '2':
        disp.sln(''); disp.sln('');
        await thiefFairySteal(session, disp);
        disp.sln('');
        break;

      case '3':
        disp.sln(''); disp.sln(''); disp.sln('  Maybe there is a Genie in there.'); disp.sln('');
        break;

      case '4':
        disp.sln('');
        disp.sln('  `2Look wise guy, these are `0NOT `2secret keys.  They say these things');
        disp.sln('  when you click on pictures in RIP.  Nothing more. (Then again...)');
        disp.sln('');
        break;

      case 'R':
      case 'Q':
      case '\r':
        await aidanEvent(session, disp);
        return;

      default:
        break;
    }
  }
}

module.exports = { enter };
