'use strict';

/**
 * server/db/PlayerDB.js
 *
 * All database operations for the players table.
 * Replaces: psock GetPlayer / PutPlayer / NewPlayer / RecordCount / all_players()
 */

const { getDB } = require('./init');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert SQLite integers (0/1) back to JS booleans for the game engine. */
function hydrate(row) {
  if (!row) return null;
  const bools = [
    'seen_master','seen_dragon','seen_violet','seen_bard','got_delicious',
    'weird','high_spirits','flirted','leftbank','divorced','dead','inn',
    'on_now','horse','amulet','olivia','asshole','done_tower','has_des',
    'is_exhausted',
  ];
  bools.forEach(k => { if (k in row) row[k] = row[k] === 1; });
  return row;
}

/** Strip JS booleans back to 0/1 for SQLite. */
function dehydrate(obj) {
  const out = { ...obj };
  Object.keys(out).forEach(k => {
    if (typeof out[k] === 'boolean') out[k] = out[k] ? 1 : 0;
  });
  return out;
}

// ── Reads ──────────────────────────────────────────────────────────────────

function getById(id) {
  return hydrate(getDB().prepare('SELECT * FROM players WHERE id = ?').get(id));
}

function getByUserId(userId) {
  return hydrate(getDB().prepare('SELECT * FROM players WHERE user_id = ?').get(userId));
}

function getAll() {
  return getDB().prepare('SELECT * FROM players ORDER BY exp DESC').all().map(hydrate);
}

function count() {
  return getDB().prepare('SELECT COUNT(*) as n FROM players').get().n;
}

function getOnline() {
  return getDB().prepare('SELECT * FROM players WHERE on_now = 1').all().map(hydrate);
}

function findByName(name) {
  return hydrate(
    getDB().prepare('SELECT * FROM players WHERE name = ? COLLATE NOCASE').get(name)
  );
}

// ── Writes ─────────────────────────────────────────────────────────────────

/**
 * Create a brand-new player record with default values.
 * Called after a user registers and enters character creation.
 */
function create(userId, charName, sex) {
  const db = getDB();
  const info = db.prepare(`
    INSERT INTO players (user_id, name, real_name, sex)
    VALUES (?, ?, ?, ?)
  `).run(userId, charName, charName, sex || 'male');
  return getById(info.lastInsertRowid);
}

/**
 * Save (overwrite) a player object back to the database.
 * Pass the full player object; only known columns are written.
 * Replaces: psock_put() / PutPlayer command.
 */
function save(player) {
  const db = getDB();
  const p  = dehydrate(player);

  // Build SET clause from the object keys (excluding id, user_id, created_at)
  const IMMUTABLE = new Set(['id', 'user_id', 'created_at']);
  const keys = Object.keys(p).filter(k => !IMMUTABLE.has(k));

  const set  = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE players SET ${set}, updated_at = unixepoch() WHERE id = @id`);
  stmt.run({ ...p, id: player.id });
  return getById(player.id);
}

/**
 * Partial update — only touch the supplied fields.
 * Useful for quick flag flips (e.g. on_now, dead, inn).
 */
function patch(id, fields) {
  const db = getDB();
  const p  = dehydrate(fields);
  const keys = Object.keys(p);
  if (!keys.length) return;
  const set  = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE players SET ${set}, updated_at = unixepoch() WHERE id = @id`).run({ ...p, id });
}

/** Mark player as online. */
function setOnline(id, isOnline) {
  if (isOnline) {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    patch(id, { on_now: 1, time_on: `${hh}:${mm}` });
  } else {
    patch(id, { on_now: 0 });
  }
}

/** Reset all daily fields (called by DailyReset cron). */
function resetDaily(id) {
  // Kids give bonus actions (mirrors original lord.js forest_fights + kids logic)
  const p       = getById(id);
  const baseAP  = Math.min(15 + (p.kids || 0), 32000);
  patch(id, {
    actions       : baseAP,
    is_exhausted  : false,
    hp            : p.hp_max,   // fully restored each new day
    pvp_fights    : 5,
    killedaplayer : false,
    seen_master   : false,
    seen_dragon   : false,
    seen_violet   : false,
    seen_bard     : false,
    got_delicious : false,
    high_spirits  : true,
    flirted       : false,
    leftbank      : false,
    divorced      : false,
    levelw        : 0,
    levelm        : 0,
    levelt        : 0,
  });
}

/**
 * Spend action points for an activity.
 *
 * @param {number} playerId
 * @param {number} amount       - number of actions to spend (usually 1)
 * @param {string} activityName - used in the failure message
 * @returns {{ success: boolean, actionsRemaining?: number, message?: string }}
 */
function spendActions(playerId, amount, activityName) {
  const p = getById(playerId);

  if (p.is_exhausted || p.actions < amount) {
    return {
      success : false,
      message : `You are too exhausted to ${activityName} today.`,
    };
  }

  const remaining = p.actions - amount;
  patch(playerId, { actions: remaining });

  if (remaining <= 0) {
    triggerExhaustion(playerId);
    return { success: true, actionsRemaining: 0 };
  }

  return { success: true, actionsRemaining: remaining };
}

/**
 * Trigger the exhaustion state.
 * Called automatically by spendActions when actions reach 0, or directly
 * when a player is defeated in combat.
 *
 * Penalties (tunable):
 *   - 10% of carried gold lost
 *   - 2% of experience lost
 *   - All remaining actions zeroed
 *   - is_exhausted flag set
 *
 * @returns {{ goldLost: number, xpLost: number }}
 */
function triggerExhaustion(playerId) {
  const p        = getById(playerId);
  const goldLost = Math.floor((p.gold || 0) * 0.10);
  const xpLost   = Math.floor((p.exp  || 0) * 0.02);

  patch(playerId, {
    actions      : 0,
    is_exhausted : true,
    gold         : Math.max(0, (p.gold || 0) - goldLost),
    exp          : Math.max(0, (p.exp  || 0) - xpLost),
    hp           : 0,
  });

  return { goldLost, xpLost };
}

/** Hard-delete a player (for admin / sysop use). */
function remove(id) {
  getDB().prepare('DELETE FROM players WHERE id = ?').run(id);
}

module.exports = {
  getById,
  getByUserId,
  getAll,
  count,
  getOnline,
  findByName,
  create,
  save,
  patch,
  setOnline,
  resetDaily,
  spendActions,
  triggerExhaustion,
  remove,
};
