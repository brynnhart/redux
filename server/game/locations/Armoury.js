'use strict';

/**
 * server/game/locations/Armoury.js
 *
 * Ported from lord.js abduls_armour() — line 10303
 *
 * Keys:
 *   (B)uy armour    — numbered list, pick by number
 *   (S)ell armour   — sell current armour for ~half price
 *   (L)ist armour   — show full armour list with prices
 *   (V)iew stats    — full stats screen
 *   (R/Q) Return
 *
 * def_needed(n): sum of trainer_stats[1..n-2].def — minimum DEF
 *   required to wear armour n. Armours 0,1,2 need 0.
 *
 * Sell price: floor(oldPrice/2 + rand(level*cha*level)),
 *   capped at oldPrice - floor(oldPrice/3).
 *
 * arm_num=0 → wearing nothing ("Nothing!")
 * arm_num=1..15 → armour_stats[arm_num]
 */

const Display    = require('../text/Display');
const PlayerDB   = require('../../db/PlayerDB');
const { showStats }    = require('../ShowStats');
const { armour_stats, trainer_stats } = require('../data/constants');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function rand(n)   { return Math.floor(Math.random() * Math.max(1, n)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

// ── Persist helper ────────────────────────────────────────────────────────

function persist(session, fields) {
  PlayerDB.patch(session.player.id, fields);
  session.player = PlayerDB.getById(session.player.id);
}

// ── def_needed(n): minimum DEF to wear armour index n ────────────────────
// Mirrors lord.js def_needed(): sum trainer_stats[1..n-2].def

function defNeeded(n) {
  if (n < 3) return 0;
  let total = 0;
  for (let i = 1; i <= n - 2 && i < trainer_stats.length; i++) {
    total += (trainer_stats[i].def || 0);
  }
  return total;
}

// ── Draw armour list (cols: number, dot-filled name, price) ───────────────

function drawArmourList(disp) {
  disp.sln('');
  disp.sln('  `2#   Name                              Price');
  disp.sln('  `2--- --------------------------------  ----------');
  for (let i = 1; i < armour_stats.length; i++) {
    const a     = armour_stats[i];
    const num   = String(i).padStart(2, ' ');
    const price = pretty(a.price);
    let   line  = a.name;
    // Dot-fill to fixed column width (matching original disp_len logic)
    while (line.length + price.length < 38) line += '.';
    disp.sln(`  \`2${num}. \`0${line}\`0${price}`);
  }
  disp.sln('');
}

// ── Draw main screen ──────────────────────────────────────────────────────

function drawScreen(session, disp) {
  const p = session.player;
  const curArm = armour_stats[p.arm_num] || armour_stats[0];

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Abdul\'s Armour Shop`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2A large woman named Paula stands behind the counter,');
  disp.sln('  eyeing you with a merchant\'s practiced smile.');
  disp.sln('');
  disp.sln(`  \`2Current Armour : \`0${p.arm || 'Nothing!'}`);
  disp.sln(`  \`2Defense Points : \`%${pretty(p.def)}`);
  disp.sln(`  \`2Gold In Hand   : \`%${pretty(p.gold)}`);
  disp.sln('');
  disp.sln('  `2(`%B`2)uy Armour');
  disp.sln('  (`%S`2)ell your current Armour');
  disp.sln('  (`%L`2)ist all Armour with prices');
  disp.sln('  (`%V`2)iew your Stats');
  disp.sln('  (`%R`2)eturn to Town Square');
  disp.sln('');
  disp.sln('  `5Abdul\'s Armour  `2(B,S,L,V,R)');
  disp.sln('');
  disp.sw(`\`2  Your command, \`0${p.name}\`2? : `);
}

// ── B — Buy Armour ────────────────────────────────────────────────────────

async function buyArmour(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Abdul\'s Armour Shop — Buy`0');
  disp.sln(SEP);
  disp.sln('');
  drawArmourList(disp);

  disp.sln(`  \`2(Gold: \`%${pretty(p.gold)}\`2)  (0 to Exit)`);
  disp.sln('');
  disp.sw('  `0Number of Armour `2: `%');

  const input = (await session.getStr(2, { allowed: /[0-9]/ })).trim();
  const n     = parseInt(input, 10);
  disp.sln('');

  if (!input || isNaN(n) || n === 0) return;
  if (n < 1 || n >= armour_stats.length) {
    disp.sln('  `2"That armour does not exist, friend."');
    disp.sln('');
    await session.more();
    return;
  }

  const newa = armour_stats[n];
  const olda = armour_stats[p.arm_num] || armour_stats[0];
  const need = defNeeded(n);
  // Player's effective base DEF = current DEF minus the bonus from current armour
  const baseDef = p.def - olda.num;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Abdul\'s Armour Shop`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln(`  \`2"\`0Hmmm I will sell you a nice \`%${newa.name}\`0 for \`%${pretty(newa.price)}\`0.`);
  disp.sln('   Agreed, friend?`2"');
  disp.sln('');
  disp.sln(`  \`2Note: It takes \`%${pretty(need)}\`2 defense points to wear this armor.`);
  disp.sln(`  \`2You currently have \`%${pretty(baseDef)} \`2defense points.`);
  disp.sln('');
  disp.sw('   `2Buy it?  [`0N`2] : `%');

  const ch = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(ch === 'Y' ? 'Y' : 'N');
  disp.sln('');

  if (ch !== 'Y') {
    disp.sln('  `2"Ok!  No rush!" the girl smiles.');
  } else if (baseDef < need) {
    disp.sln('  `2"I\'m sorry, but you are not strong enough to wear');
    disp.sln('  that armor."');
  } else if (p.arm_num > 0) {
    disp.sln('  `2"You already have armour, and you can\'t wear');
    disp.sln('  two!" You realize she is right.');
  } else if (p.gold < newa.price) {
    disp.sln('  `2"I\'m sorry, but you seem to be lacking funds at the');
    disp.sln('  moment." the girl tells you.');
  } else {
    disp.sln('  `2"Wonderful!" The girl takes your money, and helps you');
    disp.sln('  into your new armour.');
    persist(session, {
      arm     : newa.name,
      arm_num : n,
      gold    : p.gold - newa.price,
      def     : clamp(p.def + newa.num, 0, 32000),
    });
  }

  disp.sln('');
  await session.more();
}

// ── S — Sell Armour ───────────────────────────────────────────────────────

async function sellArmour(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Abdul\'s Armour Shop — Sell`0');
  disp.sln(SEP);
  disp.sln('');

  if (p.arm_num === 0) {
    disp.sln('  `2"You silly kidder!!" Paula laughs, "You don\'t have');
    disp.sln('  any armour to sell!"');
    disp.sln('');
    await session.more();
    return;
  }

  const olda = armour_stats[p.arm_num];

  // Sell price: floor(price/2 + rand(level*cha*level)), capped at price - floor(price/3)
  const mult     = p.level * p.cha * p.level;
  const randPart = rand(Math.min(mult, 65530));
  let   price    = Math.floor(olda.price / 2 + randPart);
  const cap      = olda.price - Math.floor(olda.price / 3);
  if (price > cap) price = cap;

  disp.sln(`  \`2"\`0Hmmm I will buy your \`%${p.arm} \`0for \`%${pretty(price)}\`0 gold.`);
  disp.sln('  Agreed, friend?`2"');
  disp.sln('');
  disp.sw('  `2Sell it?  [`0N`2] : `%');

  const ch = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(ch === 'Y' ? 'Y' : 'N');
  disp.sln('');

  if (ch !== 'Y') {
    disp.sln('  `2"Thats ok.  Your armour probably has sentimental value to you."');
    disp.sln('');
    await session.more();
    return;
  }

  disp.sln('  `2"Good doing business with you!" The girl takes your armour');
  disp.sln('  and gives you the money.');

  const newGold = clamp(p.gold + price, 0, 2000000000);
  const newDef  = Math.max(0, p.def - olda.num);

  persist(session, {
    arm     : 'Nothing!',
    arm_num : 0,
    gold    : newGold,
    def     : newDef,
  });

  if (newGold >= 2000000000) {
    disp.sln('  Wow, you have a lot of money!');
  }

  disp.sln('');
  await session.more();
}

// ── L — List Armour ───────────────────────────────────────────────────────

async function listArmour(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Abdul\'s Armour — Full List`0');
  disp.sln(SEP);
  disp.sln('');
  drawArmourList(disp);

  // Mark current armour
  if (p.arm_num > 0) {
    disp.sln(`  \`2You are currently wearing: \`0${p.arm}`);
    disp.sln('');
  }

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
        await buyArmour(session, disp);
        drawScreen(session, disp);
        break;

      case 'S':
        await sellArmour(session, disp);
        drawScreen(session, disp);
        break;

      case 'L':
        await listArmour(session, disp);
        drawScreen(session, disp);
        break;

      case 'V':
      case 'Y':
        await showStats(session, disp);
        drawScreen(session, disp);
        break;

      case '?':
        drawScreen(session, disp);
        break;

      case 'R':
      case 'Q':
      case '\r':
        return;

      default:
        break;
    }
  }
}

module.exports = { enter };
