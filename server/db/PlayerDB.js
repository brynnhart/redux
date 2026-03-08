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
  `).run(userId, charName, charName, sex || 'M');
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
  patch(id, { on_now: isOnline });
}

/** Reset all daily fields (called by DailyReset cron). */
function resetDaily(id) {
  patch(id, {
    forest_fights : 15,
    pvp_fights    : 0,
    seen_master   : false,
    seen_dragon   : false,
    seen_violet   : false,
    seen_bard     : false,
    got_delicious : false,
    weird         : false,
    high_spirits  : true,
    flirted       : false,
    leftbank      : false,
    divorced      : false,
    levelw        : 0,
    levelm        : 0,
    levelt        : 0,
  });
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
  remove,
};
