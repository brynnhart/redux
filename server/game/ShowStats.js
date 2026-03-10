'use strict';

/**
 * server/game/ShowStats.js
 *
 * Player stats display — now the central hub for character info, equipment
 * management, and inventory.
 *
 * Sections:
 *   1. Character Stats — base + effective stat display with equipment bonuses
 *   2. Equipped Items  — current slots; (U)nequip
 *   3. Inventory       — items in pack; (E)quip, (S)ell
 *
 * Called from GameEngine (V key) and any location that needs the full stats screen.
 */

const Display     = require('./text/Display');
const { genderLabel } = require('./utils/pronouns');
const PlayerDB    = require('../db/PlayerDB');
const EquipmentDB = require('../db/EquipmentDB');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2' + '-=-=-'.repeat(15) + '-';

function rarityLabel(rarity) {
  switch (rarity) {
    case 'uncommon': return ' `#[uncommon]`2';
    case 'rare':     return ' `%[rare]`2';
    default:         return '';
  }
}

async function showStats(session, diagDisp) {
  const disp = diagDisp || Display.forSession(session);

  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    const p        = session.player;

    const equipped   = EquipmentDB.getEquippedItems(p.id);
    const inventory  = EquipmentDB.getPlayerInventory(p.id);
    const slotCount  = EquipmentDB.getEquipmentSlotCount(p);
    const effective  = EquipmentDB.getEffectiveStats(p.id, p);
    const bonuses    = effective.bonuses;

    session.clearScreen();

    // ── Section 1: Character Stats
    disp.sln('`5Player\'s Stats & Equipment');
    disp.sln(SEP);
    disp.sln('');
    disp.sln(`\`2Experience     : \`%${pretty(p.exp)}`);
    disp.sln(`\`2Gender         : \`%${genderLabel(p.sex)}`
             + `\`0                  \`2Level          : \`%${p.level}` +
             `\`0                  \`2HitPoints      :(\`%${p.hp} \`2of \`%${p.hp_max}\`2)`);
    disp.sln(`\`2Actions Today  : \`%${p.actions ?? 15}${p.is_exhausted ? ' \`4(EXHAUSTED)' : ''}` +
             `\`0                  \`2Player Fights Left : \`%${p.pvp_fights}`);
    disp.sln(`\`2Gold In Hand   : \`%${pretty(p.gold)}` +
             `\`0                  \`2Gold In Bank   : \`%${pretty(p.bank)}`);

    const atkBonus = bonuses.attack  ? ` \`2(\`0base ${pretty(p.str - bonuses.attack)} \`2+ \`%${pretty(bonuses.attack)} \`2equip)` : '';
    const defBonus = bonuses.defense ? ` \`2(\`0base ${pretty(p.def - bonuses.defense)} \`2+ \`%${pretty(bonuses.defense)} \`2equip)` : '';

    disp.sln(`\`2Attack Strength : \`%${pretty(effective.str)}${atkBonus}`);
    disp.sln(`\`2Defense         : \`%${pretty(effective.def)}${defBonus}`);
    if (bonuses.hp)       disp.sln(`\`2HP Bonus        : \`%+${pretty(bonuses.hp)} from equipment`);
    if (bonuses.goldFind) disp.sln(`\`2Gold Find Bonus : \`%+${bonuses.goldFind}%`);
    if (bonuses.expGain)  disp.sln(`\`2Exp Gain Bonus  : \`%+${bonuses.expGain}%`);
    disp.sln(`\`2Charm          : \`%${p.cha}` +
             `\`0                  \`2Gems           : \`%${p.gem}`);

    if (p.clss === 1) {
      disp.sln('');
      disp.sln(`\`2Death Knight Skills: \`%${p.skillw}\`0                \`2Uses Today: (\`%${p.levelw}\`2)`);
      disp.sln('\`2You are currently interested in \`%Death Knight\`2 skills.');
    } else if (p.clss === 2) {
      disp.sln('');
      disp.sln(`\`2Thieving Skills: \`%${p.skillt}\`0                  \`2Uses Today: (\`%${p.levelt}\`2)`);
      disp.sln('\`2You are currently interested in \`%Thieving\`2 skills.');
    } else if (p.clss === 3) {
      disp.sln('');
      disp.sln(`\`2Mystical Skills: \`%${p.skillm}\`0                  \`2Uses Today: (\`%${p.levelm}\`2)`);
      disp.sln('\`2You are currently interested in \`%Mystical\`2 skills.');
    }

    // ── Section 2: Equipped Items
    disp.sln('');
    disp.sln(`\`2=== EQUIPPED ITEMS (\`%${equipped.length}\`2/\`%${slotCount}\`2 slots used) ===`);
    disp.sln('');
    for (let s = 1; s <= slotCount; s++) {
      const eq = equipped.find(e => e.slot_number === s);
      if (eq) {
        const mods = EquipmentDB.formatMods(eq.modifiers);
        disp.sln(`  \`0[\`%${s}\`0] \`2${eq.name.padEnd(22, ' ')}  \`0${mods}${rarityLabel(eq.rarity)}`);
      } else {
        disp.sln(`  \`2[${s}] (empty)`);
      }
    }
    if (equipped.length > 0) {
      disp.sln('');
      disp.sln('  (`%U`2)nequip an item from a slot');
    }

    // ── Section 3: Inventory
    disp.sln('');
    disp.sln(`\`2=== INVENTORY (\`%${inventory.length}\`2 items) ===`);
    disp.sln('');
    if (inventory.length === 0) {
      disp.sln('  `2Your pack is empty.  Visit \`%K\`2ing Abdul\'s Equipment to buy gear.');
    } else {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < Math.min(inventory.length, 26); i++) {
        const item  = inventory[i];
        const label = letters[i];
        const mods  = item.equippable
          ? EquipmentDB.formatMods(item.modifiers)
          : '(not equippable)';
        disp.sln(`  \`0[${label}] \`2${item.name.padEnd(22, ' ')}  \`0${mods}${rarityLabel(item.rarity)}`);
      }
    }

    disp.sln('');
    if (inventory.some(i => i.equippable)) disp.sln('  (`%E`2)quip an item from your pack');
    if (inventory.length > 0)              disp.sln('  (`%S`2)ell an item from your pack');
    disp.sln('  (`%R`2)eturn');
    disp.sln('');
    disp.sw(`\`2  Command (\`0E\`2/\`0U\`2/\`0S\`2/\`0R\`2), \`0${p.name}\`2? : `);

    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) return;
    disp.sln(ch);

    if (ch === 'R' || ch === 'Q' || ch === '\r') return;
    if (ch === 'E') await equipFlow(session, disp, inventory, equipped, slotCount);
    else if (ch === 'U') await unequipFlow(session, disp, equipped);
    else if (ch === 'S') await sellFlow(session, disp, inventory);
  }
}

// ── Equip flow ─────────────────────────────────────────────────────────────

async function equipFlow(session, disp, inventory, equipped, slotCount) {
  const equippable = inventory.filter(i => i.equippable);
  if (equippable.length === 0) {
    disp.sln(''); disp.sln('  `2You have nothing in your pack that can be equipped.'); disp.sln('');
    await session.more(); return;
  }
  if (equipped.length >= slotCount) {
    disp.sln(''); disp.sln(`  \`2All \`%${slotCount}\`2 equipment slots are full.  Unequip something first.`); disp.sln('');
    await session.more(); return;
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  disp.sln(''); disp.sln('  `2Which item would you like to equip?'); disp.sln('');
  for (let i = 0; i < Math.min(equippable.length, 26); i++) {
    const item = equippable[i];
    const mods = EquipmentDB.formatMods(item.modifiers);
    disp.sln(`    \`0(${letters[i]}) \`2${item.name.padEnd(22, ' ')}  \`0${mods}`);
  }
  disp.sln('');
  disp.sw(`  \`2Choice (\`0Q\`2 to cancel) : \`%`);

  const validLetters = letters.slice(0, equippable.length).split('');
  validLetters.push('Q', '\r');
  const itemCh = await session.prompt('', validLetters);
  disp.sln(itemCh || ''); disp.sln('');

  if (!itemCh || itemCh === 'Q' || itemCh === '\r') {
    disp.sln('  `2Cancelled.'); disp.sln(''); await session.more(); return;
  }

  const idx    = letters.indexOf(itemCh);
  const chosen = equippable[idx];
  if (!chosen) return;

  const usedSlots = new Set(equipped.map(e => e.slot_number));
  let freeSlot = null;
  for (let s = 1; s <= slotCount; s++) {
    if (!usedSlots.has(s)) { freeSlot = s; break; }
  }
  if (freeSlot === null) {
    disp.sln('  `2All slots are full. Unequip something first.'); disp.sln('');
    await session.more(); return;
  }

  EquipmentDB.equipItem(session.player.id, chosen.inv_id, freeSlot);
  const mods = EquipmentDB.formatMods(chosen.modifiers);
  disp.sln(`  \`0${chosen.name}\`2 equipped in slot ${freeSlot}. (\`0${mods}\`2)`);
  disp.sln(''); await session.more();
}

// ── Unequip flow ───────────────────────────────────────────────────────────

async function unequipFlow(session, disp, equipped) {
  if (equipped.length === 0) {
    disp.sln(''); disp.sln('  `2You have nothing equipped.'); disp.sln('');
    await session.more(); return;
  }
  disp.sln(''); disp.sln('  `2Which slot to unequip?'); disp.sln('');
  for (const eq of equipped) {
    const mods = EquipmentDB.formatMods(eq.modifiers);
    disp.sln(`    \`0(${eq.slot_number}) \`2${eq.name.padEnd(22, ' ')}  \`0${mods}`);
  }
  disp.sln('');
  disp.sw(`  \`2Slot (\`0Q\`2 to cancel) : \`%`);

  const validSlots = equipped.map(e => String(e.slot_number));
  validSlots.push('Q', '\r');
  const slotCh = await session.prompt('', validSlots);
  disp.sln(slotCh || ''); disp.sln('');

  if (!slotCh || slotCh === 'Q' || slotCh === '\r') {
    disp.sln('  `2Cancelled.'); disp.sln(''); await session.more(); return;
  }

  const slotNum = parseInt(slotCh, 10);
  const eq      = equipped.find(e => e.slot_number === slotNum);
  if (!eq) return;

  EquipmentDB.unequipItem(session.player.id, slotNum);
  disp.sln(`  \`0${eq.name}\`2 unequipped and moved to your pack.`);
  disp.sln(''); await session.more();
}

// ── Sell flow ──────────────────────────────────────────────────────────────

async function sellFlow(session, disp, inventory) {
  if (inventory.length === 0) {
    disp.sln(''); disp.sln('  `2Your pack is empty.'); disp.sln('');
    await session.more(); return;
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  disp.sln(''); disp.sln('  `2Which item to sell? (50% of value)'); disp.sln('');
  for (let i = 0; i < Math.min(inventory.length, 26); i++) {
    const item    = inventory[i];
    const sellVal = Math.floor(item.gold_value * 0.5);
    disp.sln(`    \`0(${letters[i]}) \`2${item.name.padEnd(22, ' ')}  \`2Sell: \`%${pretty(sellVal)}\`2 gold`);
  }
  disp.sln('');
  disp.sw(`  \`2Choice (\`0Q\`2 to cancel) : \`%`);

  const validLetters = letters.slice(0, inventory.length).split('');
  validLetters.push('Q', '\r');
  const itemCh = await session.prompt('', validLetters);
  disp.sln(itemCh || ''); disp.sln('');

  if (!itemCh || itemCh === 'Q' || itemCh === '\r') {
    disp.sln('  `2Cancelled.'); disp.sln(''); await session.more(); return;
  }

  const idx    = letters.indexOf(itemCh);
  const chosen = inventory[idx];
  if (!chosen) return;

  const sellVal = Math.floor(chosen.gold_value * 0.5);
  disp.sw(`  \`2Sell \`0${chosen.name}\`2 for \`%${pretty(sellVal)}\`2?  [\`0N\`2] : \`%`);
  const conf = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(conf === 'Y' ? 'Y' : 'N'); disp.sln('');

  if (conf !== 'Y') {
    disp.sln('  `2Cancelled.'); disp.sln(''); await session.more(); return;
  }

  const goldGained = EquipmentDB.sellInventoryItem(session.player.id, chosen.inv_id);
  const p          = session.player;
  const newGold    = clamp(p.gold + goldGained, 0, 2000000000);
  PlayerDB.patch(p.id, { gold: newGold });
  session.player = PlayerDB.getById(p.id);

  disp.sln(`  \`2You sell the \`0${chosen.name}\`2 for \`%${pretty(goldGained)}\`2 gold.`);
  disp.sln(''); await session.more();
}

module.exports = { showStats };
