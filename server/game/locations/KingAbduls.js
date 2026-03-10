'use strict';

/**
 * server/game/locations/KingAbduls.js
 *
 * King Abdul's Equipment — replaces both King Arthur's Weapons and Barney's
 * Armour Shop. A single shop selling all 30 base items (weapons + armour) as
 * general equipment. Gold is the only purchase gate — no stat requirements.
 *
 * Purchased items go to player_inventory. Player equips them from ShowStats.
 *
 * Keys:
 *   (B)rowse items  — paginated shop list, buy by number
 *   (I)nventory     — quick peek at what you're carrying
 *   (V)iew stats    — full stats + equipment screen
 *   (R/Q) Return
 */

const Display     = require('../text/Display');
const PlayerDB    = require('../../db/PlayerDB');
const EquipmentDB = require('../../db/EquipmentDB');
const { showStats } = require('../ShowStats');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

function persist(session, fields) {
  PlayerDB.patch(session.player.id, fields);
  session.player = PlayerDB.getById(session.player.id);
}

// ── Rarity colour codes ────────────────────────────────────────────────────

function rarityColour(rarity) {
  switch (rarity) {
    case 'uncommon': return '`#';
    case 'rare':     return '`%';
    default:         return '`0';
  }
}

// ── Draw the full item list ────────────────────────────────────────────────

function drawItemList(disp, items, playerGold) {
  disp.sln('');
  disp.sln('  `2 #   Item                            Modifier         Price');
  disp.sln('  `2---  ------------------------------  ---------------  ----------');

  for (let i = 0; i < items.length; i++) {
    const item   = items[i];
    const num    = String(i + 1).padStart(2, ' ');
    const col    = rarityColour(item.rarity);
    const mods   = EquipmentDB.formatMods(item.modifiers);
    const price  = pretty(item.gold_value);
    const canBuy = playerGold >= item.gold_value;

    // Truncate name to 30 chars
    let name = item.name.substring(0, 30);
    while (name.length < 30) name += ' ';

    // Truncate mod string to 15 chars
    let modStr = mods.substring(0, 15);
    while (modStr.length < 15) modStr += ' ';

    const dimmed = canBuy ? '' : '`4';
    disp.sln(`  ${dimmed}${num}. ${col}${name}  \`2${modStr}  \`0${price}`);
  }
  disp.sln('');
}

// ── Main screen ────────────────────────────────────────────────────────────

function drawScreen(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%King Abdul\'s Equipment`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2A large man with a booming voice steps out from behind an enormous');
  disp.sln('  display of weapons and armour, spreading his arms wide.');
  disp.sln('');
  disp.sln('  `0"Welcome! I am Abdul, and I sell the finest equipment in the land!');
  disp.sln('  No strength requirements, no fussing — only gold!"');
  disp.sln('');
  disp.sln(`  \`2Gold in hand : \`%${pretty(p.gold)}`);
  disp.sln('');
  disp.sln('  (`%B`2)rowse and buy equipment');
  disp.sln('  (`%I`2)nventory — items you carry');
  disp.sln('  (`%V`2)iew your Stats & Equipment');
  disp.sln('  (`%R`2)eturn to Town Square');
  disp.sln('');
  disp.sln('  `5King Abdul\'s Equipment  `2(B,I,V,R)');
  disp.sln('');
  disp.sw(`\`2  Your command, \`0${p.name}\`2? : `);
}

// ── B — Browse & Buy ───────────────────────────────────────────────────────

async function browseAndBuy(session, disp) {
  const p     = session.player;
  const items = EquipmentDB.getAllShopItems();

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%King Abdul\'s Equipment — For Sale`0');
  disp.sln(SEP);
  disp.sln('');
  drawItemList(disp, items, p.gold);

  disp.sln(`  \`2(Gold: \`%${pretty(p.gold)}\`2)  (0 to Exit)`);
  disp.sln('');
  disp.sw('  `0Item number `2: `%');

  const input = (await session.getStr(3, { allowed: /[0-9]/ })).trim();
  const n     = parseInt(input, 10);
  disp.sln('');

  if (!input || isNaN(n) || n === 0) return;
  if (n < 1 || n > items.length) {
    disp.sln('  `2"That number does not match any item I carry, friend."');
    disp.sln('');
    await session.more();
    return;
  }

  const item = items[n - 1];

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%King Abdul\'s Equipment`0');
  disp.sln(SEP);
  disp.sln('');

  const modStr = EquipmentDB.formatMods(item.modifiers);
  disp.sln(`  \`2"\`0${item.description}\`2"`);
  disp.sln('');
  disp.sln(`  \`2Item     : \`%${item.name}`);
  disp.sln(`  \`2Modifier : \`0${modStr}`);
  disp.sln(`  \`2Price    : \`%${pretty(item.gold_value)} gold`);
  disp.sln('');

  if (p.gold < item.gold_value) {
    disp.sln(`  \`2"I am sorry, friend — you need \`%${pretty(item.gold_value - p.gold)} \`2more gold for that one."`);
    disp.sln('');
    await session.more();
    return;
  }

  disp.sw(`  \`2Buy the \`0${item.name}\`2 for \`%${pretty(item.gold_value)}\`2 gold?  [\`0N\`2] : \`%`);

  const ch = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(ch === 'Y' ? 'Y' : 'N');
  disp.sln('');

  if (ch !== 'Y') {
    disp.sln('  `2"No rush! The item will still be here when you return."');
  } else {
    // Deduct gold
    persist(session, { gold: clamp(p.gold - item.gold_value, 0, 2000000000) });
    // Add to inventory
    EquipmentDB.addToInventory(session.player.id, item.id);
    disp.sln(`  \`2"Excellent choice!" Abdul wraps the \`0${item.name}\`2 and hands it to you.`);
    disp.sln('  "It will sit in your pack until you equip it. Use `%V`2 to manage your gear."');
  }

  disp.sln('');
  await session.more();
}

// ── I — Inventory peek ─────────────────────────────────────────────────────

async function showInventory(session, disp) {
  const p   = session.player;
  const inv = EquipmentDB.getPlayerInventory(p.id);

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Your Pack`0');
  disp.sln(SEP);
  disp.sln('');

  if (inv.length === 0) {
    disp.sln('  `2Your pack is empty.');
  } else {
    disp.sln('  `2Item                            Modifier');
    disp.sln('  `2------------------------------  ---------------');
    for (const row of inv) {
      const mods = EquipmentDB.formatMods(row.modifiers);
      let name = row.name.substring(0, 30);
      while (name.length < 30) name += ' ';
      disp.sln(`  \`0${name}  \`2${mods}`);
    }
  }

  disp.sln('');
  disp.sln('  `2(Equip items from the `%V`2)iew Stats screen.)');
  disp.sln('');
  await session.more();
}

// ── Entry point ────────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);

  drawScreen(session, disp);

  while (session.alive) {
    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) break;
    disp.sln(ch);

    switch (ch) {
      case 'B':
        await browseAndBuy(session, disp);
        drawScreen(session, disp);
        break;

      case 'I':
        await showInventory(session, disp);
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
