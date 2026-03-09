'use strict';

/**
 * server/game/locations/KingsArthurs.js
 *
 * Ported from lord.js king_arthurs() — lines 10016–10302
 *
 * Keys: (B)uy  (S)ell  (L)ist weapons  (Y)our stats  (R)eturn  (?)redraw
 *
 * Weapon rules (from source):
 *   - You can only carry ONE weapon at a time (sell before buying)
 *   - Sell price = price/2 + random(level*cha*level), capped at price*2/3
 *   - Selling sets weapon_num=0 (Fists) and removes the str bonus
 *   - Buying sets weapon_num=n and adds the str bonus
 *   - weapon_num === 0 means no weapon (Fists), nothing to sell
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');
const { weapon_stats } = require('../data/constants');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function rand(n)   { return Math.floor(Math.random() * Math.max(1, n)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

// ── Weapon list display ────────────────────────────────────────────────────
// Replaces display_weapons() + lrdfile('BUYWEP') — rendered as a clean list.

function drawWeaponList(disp, currentNum) {
  disp.sln('');
  disp.sln('  `%King Arthur\'s Weapons — For Sale`0');
  disp.sln(SEP);
  disp.sln('');

  for (let i = 1; i < weapon_stats.length; i++) {
    const w     = weapon_stats[i];
    const num   = String(i).padStart(2, ' ');
    const owned = (i === currentNum) ? ' `%<< yours' : '';
    // Dot-fill between name and price, matching original formatting
    let   label = w.name;
    const price = pretty(w.price);
    while ((label + price).length < 42) label += '.';
    disp.sln(`\`2  ${num}. ${label}\`0${price}${owned}`);
  }
  disp.sln('');
}

// ── Full screen draw ───────────────────────────────────────────────────────

function drawScreen(session, disp) {
  session.clearScreen();
  const p = session.player;

  disp.sln('');
  disp.sln('  `%King Arthur\'s Weapons`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2You walk into a large weapons hall.  Weapons of all kinds line the');
  disp.sln('  walls.  A fat man walks up to you.');
  disp.sln('');
  disp.sln('  `0"Welcome to my shop.  I have the finest weapons in the land!"');
  disp.sln('');

  drawWeaponList(disp, p.weapon_num);

  showPrompt(session, disp);
}

// ── Status + prompt line ───────────────────────────────────────────────────

function showPrompt(session, disp) {
  const p = session.player;
  disp.sln(`\`2  Current weapon: \`0${p.weapon}`);
  disp.sln(`\`2  Gold: \`0${pretty(p.gold)}`);
  disp.sln('');
  disp.sln('  `5King Arthur\'s Weapons  `2(B,S,L,Y,R)  (`0? for menu`2)');
  disp.sln('');
  disp.sw(`\`2  Your command, \`0${p.name}\`2? : `);
}

// ── Sell weapon — lord.js sell_weapon() ───────────────────────────────────

async function sellWeapon(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%King Arthur\'s Weapons`0');
  disp.sln(SEP);
  disp.sln('');

  if (p.weapon_num === 0) {
    disp.sln('  `2"`0What the...?!!`2" the stout man shouts. "`0You don\'t have');
    disp.sln('  a weapon to sell!`2"');
    disp.sln('');
    await session.more();
    return;
  }

  const oldw = weapon_stats[p.weapon_num];
  const mult = clamp(p.level * p.cha * p.level, 1, 65530);
  let   price = Math.floor(oldw.price / 2 + rand(mult));
  // Cap at 2/3 of original price
  const cap = oldw.price - Math.floor(oldw.price / 3);
  if (price > cap) price = cap;

  disp.sln(`\`2  "\`0Hmmm I will buy your \`%${p.weapon}\`0 for \`%${pretty(price)}\`0, Agreed?\`2"`);
  disp.sln('');
  disp.sw('   Sell it?  [`0N`2] : `%');

  const ch = await session.prompt('', ['Y', 'N', '\r']);
  const sell = (ch === 'Y');
  disp.sln(sell ? 'Y' : 'N');
  disp.sln('');

  if (!sell) {
    disp.sln('  `2"`0You don\'t want to sell?!  Fine!  I don\'t want your stinken\' weapon!`2"');
    disp.sln('');
    await session.more();
    return;
  }

  disp.sln('  `2"`0Great!`2" The fat man takes your weapon, and gives you the money.');
  p.gold       = clamp(p.gold + price, 0, 2000000000);
  p.str        = Math.max(5, p.str - oldw.num);
  p.weapon_num = 0;
  p.weapon     = weapon_stats[0].name;

  PlayerDB.patch(p.id, {
    gold: p.gold, str: p.str,
    weapon_num: p.weapon_num, weapon: p.weapon,
  });
  session.player = PlayerDB.getById(p.id);

  disp.sln('');
  await session.more();
}

// ── Buy weapon — lord.js buy_weapon() ─────────────────────────────────────

async function buyWeapon(session, disp) {
  const p = session.player;

  // Show weapon list first
  session.clearScreen();
  disp.sln('');
  disp.sln('  `%King Arthur\'s Weapons`0');
  disp.sln(SEP);
  drawWeaponList(disp, p.weapon_num);

  disp.sln(`\`2  (\`0Gold: \`%${pretty(p.gold)}\`2)  (\`00 to exit\`2)`);
  disp.sw('  `0Number Of Weapon `2: `%');

  const input = (await session.getStr(2, { allowed: /[0-9]/ })).trim();
  const n     = parseInt(input, 10);
  disp.sln('');

  if (!n || isNaN(n) || n <= 0 || n >= weapon_stats.length) {
    return; // 0 or invalid = exit
  }

  const oldw = weapon_stats[p.weapon_num];
  const neww = weapon_stats[n];

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%King Arthur\'s Weapons`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln(`\`2  "\`0Hmmm I will sell you my FAVORITE \`%${neww.name}\`0 for \`%${pretty(neww.price)} \`0gold!\`2"`);
  disp.sln('');
  disp.sln(`\`2  Note: It takes \`%${pretty(neww.num)} \`2strength points to wield this weapon.`);
  disp.sln(`\`2  You currently have \`%${pretty(p.str - oldw.num)} \`2base strength points.`);
  disp.sln('');
  disp.sw('  `2Buy it?  [`0N`2] : `%');

  const ch = await session.prompt('', ['Y', 'N', '\r']);
  const buy = (ch === 'Y');
  disp.sln(buy ? 'Y' : 'N');
  disp.sln('');

  if (!buy) {
    disp.sln('  `2"`0Fine..You will come back...`2" the man grunts.');
    disp.sln('');
    await session.more();
    return;
  }

  // Validation — same order as original source
  if (p.str < neww.num) {
    disp.sln('  `2"`0You silly fool! You aren\'t strong enough to carry');
    disp.sln('  that weapon!`2"');
    disp.sln('');
    await session.more();
    return;
  }

  if (p.weapon_num > 0) {
    disp.sln('  `2"`0You fool!  You already have a weapon, and you can\'t carry');
    disp.sln('  two!`2"  You realize he is right.');
    disp.sln('');
    await session.more();
    return;
  }

  if (p.gold < neww.price) {
    disp.sln('  `2"`0You stupid fool!  You don\'t have that much gold!');
    disp.sln('  I knew you were up to no good the moment I saw you!`2"');
    disp.sln('');
    await session.more();
    return;
  }

  // Purchase
  disp.sln('  `2"`0Great!`2" The fat man takes your money, and gives you the weapon.');
  p.weapon_num = n;
  p.weapon     = neww.name;
  p.gold       = clamp(p.gold - neww.price, 0, 2000000000);
  p.str        = clamp(p.str + neww.num, 0, 32000);

  PlayerDB.patch(p.id, {
    gold: p.gold, str: p.str,
    weapon_num: p.weapon_num, weapon: p.weapon,
  });
  session.player = PlayerDB.getById(p.id);

  disp.sln('');
  await session.more();
}

// ── Entry point ───────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);

  drawScreen(session, disp);

  while (session.alive) {
    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) break;
    disp.sln(ch);

    switch (ch) {
      case 'B':
        await buyWeapon(session, disp);
        drawScreen(session, disp);
        break;

      case 'S':
        await sellWeapon(session, disp);
        drawScreen(session, disp);
        break;

      case 'L':
        session.clearScreen();
        drawWeaponList(disp, session.player.weapon_num);
        showPrompt(session, disp);
        break;

      case 'Y': {
        // Show stats inline
        const p = session.player;
        disp.sln('');
        disp.sln(`\`2  HP   : \`%${pretty(p.hp)}\`2 / \`%${pretty(p.hp_max)}`);
        disp.sln(`\`2  STR  : \`%${pretty(p.str)}   \`2DEF: \`%${pretty(p.def)}`);
        disp.sln(`\`2  Gold : \`%${pretty(p.gold)}`);
        disp.sln(`\`2  Wpn  : \`0${p.weapon}`);
        disp.sln('');
        showPrompt(session, disp);
        break;
      }

      case '?':
        drawScreen(session, disp);
        break;

      case 'R':
      case 'Q':
      case '\r':
        return;

      default:
        // Re-show prompt only
        showPrompt(session, disp);
        break;
    }
  }
}

module.exports = { enter };
