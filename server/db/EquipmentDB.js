'use strict';

/**
 * server/db/EquipmentDB.js
 *
 * All database operations for the equipment system:
 *   items             — the item catalogue (shop + drops)
 *   player_equipment  — equipped slots per player
 *   player_inventory  — unequipped items owned by player
 *
 * Key functions:
 *   getItem(id)
 *   getAllShopItems()
 *   getPlayerInventory(playerId)
 *   getEquippedItems(playerId)
 *   getEffectiveStats(playerId, baseStats)
 *   addToInventory(playerId, itemId)
 *   removeFromInventory(invId)
 *   equipItem(playerId, invId, slotNumber)
 *   unequipItem(playerId, slotNumber)
 *   getEquipmentSlotCount(player)
 *   getInventoryItem(invId)
 *   sellInventoryItem(playerId, invId)  — returns gold gained
 */

const { getDB } = require('./init');

// ── Helpers ────────────────────────────────────────────────────────────────

function parseMods(item) {
  if (!item) return item;
  if (typeof item.modifiers === 'string') {
    try { item.modifiers = JSON.parse(item.modifiers); } catch { item.modifiers = {}; }
  }
  return item;
}

// ── Item catalogue ─────────────────────────────────────────────────────────

function getItem(id) {
  return parseMods(getDB().prepare('SELECT * FROM items WHERE id = ?').get(id));
}

function getAllShopItems() {
  return getDB()
    .prepare("SELECT * FROM items WHERE source = 'shop' ORDER BY gold_value ASC")
    .all()
    .map(parseMods);
}

function getAllDropItems() {
  return getDB()
    .prepare("SELECT * FROM items WHERE source = 'drop' ORDER BY gold_value ASC")
    .all()
    .map(parseMods);
}

// ── Inventory ──────────────────────────────────────────────────────────────

/**
 * Returns rows joined to items, including inventory id.
 * Shape: { inv_id, player_id, item_id, name, description, rarity, source,
 *          gold_value, modifiers(parsed), equippable }
 */
function getPlayerInventory(playerId) {
  return getDB()
    .prepare(`
      SELECT pi.id AS inv_id, pi.player_id, pi.item_id,
             i.name, i.description, i.rarity, i.source,
             i.gold_value, i.modifiers, i.equippable
      FROM player_inventory pi
      JOIN items i ON i.id = pi.item_id
      WHERE pi.player_id = ?
      ORDER BY pi.id ASC
    `)
    .all(playerId)
    .map(parseMods);
}

function getInventoryItem(invId) {
  return parseMods(getDB().prepare(`
    SELECT pi.id AS inv_id, pi.player_id, pi.item_id,
           i.name, i.description, i.rarity, i.source,
           i.gold_value, i.modifiers, i.equippable
    FROM player_inventory pi
    JOIN items i ON i.id = pi.item_id
    WHERE pi.id = ?
  `).get(invId));
}

function addToInventory(playerId, itemId) {
  const info = getDB()
    .prepare('INSERT INTO player_inventory (player_id, item_id) VALUES (?, ?)')
    .run(playerId, itemId);
  return info.lastInsertRowid;
}

function removeFromInventory(invId) {
  getDB().prepare('DELETE FROM player_inventory WHERE id = ?').run(invId);
}

// ── Equipped items ─────────────────────────────────────────────────────────

/**
 * Returns rows joined to items, ordered by slot_number.
 * Shape: { equip_id, player_id, slot_number, item_id, name, description,
 *          rarity, source, gold_value, modifiers(parsed), equippable }
 */
function getEquippedItems(playerId) {
  return getDB()
    .prepare(`
      SELECT pe.id AS equip_id, pe.player_id, pe.slot_number, pe.item_id,
             i.name, i.description, i.rarity, i.source,
             i.gold_value, i.modifiers, i.equippable
      FROM player_equipment pe
      JOIN items i ON i.id = pe.item_id
      WHERE pe.player_id = ?
      ORDER BY pe.slot_number ASC
    `)
    .all(playerId)
    .map(parseMods);
}

function getEquipmentSlotCount(player) {
  return player.equipment_slots || 3;
}

/**
 * Equip an inventory item into a slot.
 * If the slot is already occupied, the existing item is moved back to inventory.
 * Returns { displaced: invRow|null } — displaced item (now in inventory) or null.
 */
function equipItem(playerId, invId, slotNumber) {
  const db = getDB();

  // Get the inventory row
  const invRow = getInventoryItem(invId);
  if (!invRow || invRow.player_id !== playerId) {
    throw new Error('Inventory item not found or does not belong to player');
  }

  // Check slot occupancy
  const existing = db.prepare(
    'SELECT * FROM player_equipment WHERE player_id = ? AND slot_number = ?'
  ).get(playerId, slotNumber);

  let displaced = null;

  db.transaction(() => {
    if (existing) {
      // Move displaced item back to inventory
      const newInvId = addToInventory(playerId, existing.item_id);
      db.prepare('DELETE FROM player_equipment WHERE id = ?').run(existing.id);
      displaced = getInventoryItem(newInvId);
    }

    // Remove from inventory
    db.prepare('DELETE FROM player_inventory WHERE id = ?').run(invId);

    // Insert into equipment
    db.prepare(
      'INSERT INTO player_equipment (player_id, slot_number, item_id) VALUES (?, ?, ?)'
    ).run(playerId, slotNumber, invRow.item_id);
  })();

  return { displaced };
}

/**
 * Unequip a slot — moves item to inventory.
 * Returns the new inventory row, or null if slot was empty.
 */
function unequipItem(playerId, slotNumber) {
  const db = getDB();

  const equipped = db.prepare(
    'SELECT * FROM player_equipment WHERE player_id = ? AND slot_number = ?'
  ).get(playerId, slotNumber);

  if (!equipped) return null;

  let newInvId;
  db.transaction(() => {
    db.prepare('DELETE FROM player_equipment WHERE id = ?').run(equipped.id);
    newInvId = addToInventory(playerId, equipped.item_id);
  })();

  return getInventoryItem(newInvId);
}

// ── Effective stats ────────────────────────────────────────────────────────

/**
 * Returns combined base + equipment bonus stats for use in combat.
 *
 * baseStats shape: { str, def, hp_max, ... }
 * Returns: { str, def, hp_max, goldFind, expGain, bonuses }
 *   goldFind / expGain are multipliers (e.g. 1.10 = +10%)
 */
function getEffectiveStats(playerId, baseStats) {
  const equipped = getEquippedItems(playerId);
  const bonuses  = { attack: 0, defense: 0, hp: 0, goldFind: 0, expGain: 0 };

  for (const item of equipped) {
    const mods = item.modifiers || {};
    for (const [stat, value] of Object.entries(mods)) {
      bonuses[stat] = (bonuses[stat] || 0) + value;
    }
  }

  return {
    str:      (baseStats.str    || 0) + bonuses.attack,
    def:      (baseStats.def    || 0) + bonuses.defense,
    hp_max:   (baseStats.hp_max || 0) + bonuses.hp,
    goldFind: 1 + (bonuses.goldFind / 100),
    expGain:  1 + (bonuses.expGain  / 100),
    bonuses,
  };
}

// ── Sell item from inventory ───────────────────────────────────────────────

/**
 * Sells an inventory item. Returns gold gained (floor(gold_value * 0.5)).
 * Throws if item not found / doesn't belong to player.
 */
function sellInventoryItem(playerId, invId) {
  const invRow = getInventoryItem(invId);
  if (!invRow || invRow.player_id !== playerId) {
    throw new Error('Item not found or does not belong to player');
  }
  const goldGained = Math.floor(invRow.gold_value * 0.5);
  removeFromInventory(invId);
  return goldGained;
}

// ── Format helper (for display) ────────────────────────────────────────────

/**
 * Returns a short modifier string for display, e.g. "+5 ATK" or "+7 DEF"
 * For items with no modifiers, returns "(no bonus)".
 */
function formatMods(modifiers) {
  if (!modifiers || Object.keys(modifiers).length === 0) return '(no bonus)';
  const parts = [];
  if (modifiers.attack)   parts.push(`+${modifiers.attack} ATK`);
  if (modifiers.defense)  parts.push(`+${modifiers.defense} DEF`);
  if (modifiers.hp)       parts.push(`+${modifiers.hp} HP`);
  if (modifiers.goldFind) parts.push(`+${modifiers.goldFind}% Gold Find`);
  if (modifiers.expGain)  parts.push(`+${modifiers.expGain}% Exp Gain`);
  return parts.join(', ');
}

module.exports = {
  getItem,
  getAllShopItems,
  getAllDropItems,
  getPlayerInventory,
  getInventoryItem,
  addToInventory,
  removeFromInventory,
  getEquippedItems,
  getEquipmentSlotCount,
  equipItem,
  unequipItem,
  getEffectiveStats,
  sellInventoryItem,
  formatMods,
};
