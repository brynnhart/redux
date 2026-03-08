'use strict';

/**
 * server/db/LogDB.js
 *
 * Daily news / happenings log.
 * Replaces: psock LogEntry / GetLogFrom / GetLogRange + lordsrv logit()
 */

const { getDB } = require('./init');

/** Append one or more lines to the log. */
function append(lines) {
  const db   = getDB();
  const stmt = db.prepare('INSERT INTO log_entries (line) VALUES (?)');
  const insertMany = db.transaction(ls => ls.forEach(l => stmt.run(l)));
  insertMany(Array.isArray(lines) ? lines : [lines]);
}

/** Fetch log entries from a given unix timestamp forward. */
function getFrom(sinceTimestamp) {
  return getDB()
    .prepare('SELECT * FROM log_entries WHERE logged_at >= ? ORDER BY logged_at ASC')
    .all(sinceTimestamp);
}

/** Fetch log entries between two unix timestamps. */
function getRange(fromTimestamp, toTimestamp) {
  return getDB()
    .prepare('SELECT * FROM log_entries WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at ASC')
    .all(fromTimestamp, toTimestamp);
}

/** Fetch today's log entries. */
function getToday() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return getFrom(Math.floor(midnight.getTime() / 1000));
}

/** Prune entries older than N days (call from daily reset). */
function prune(keepDays = 2) {
  const cutoff = Math.floor(Date.now() / 1000) - keepDays * 86400;
  getDB().prepare('DELETE FROM log_entries WHERE logged_at < ?').run(cutoff);
}

module.exports = { append, getFrom, getRange, getToday, prune };
