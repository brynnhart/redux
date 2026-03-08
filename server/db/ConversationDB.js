'use strict';

/**
 * server/db/ConversationDB.js
 *
 * Ring-buffer conversations for bar, darkbar, garden, dirt.
 * Replaces: psock GetConversation / AddToConversation + .lrd conversation files
 */

const { getDB } = require('./init');

const LIMITS = { bar: 18, darkbar: 18, garden: 20, dirt: 1 };
const CHANNELS = Object.keys(LIMITS);

function validChannel(ch) {
  return CHANNELS.includes(ch);
}

/** Get the most recent N lines for a channel. */
function getLines(channel) {
  if (!validChannel(channel)) throw new Error(`Unknown channel: ${channel}`);
  const limit = LIMITS[channel];
  const rows  = getDB()
    .prepare('SELECT line FROM conversations WHERE channel = ? ORDER BY posted_at DESC LIMIT ?')
    .all(channel, limit);
  return rows.map(r => r.line).reverse();
}

/**
 * Append a line (or lines) to a channel.
 * The 'dirt' channel is cleared first (it's always the latest single entry).
 */
function addLines(channel, lines, playerId = null) {
  if (!validChannel(channel)) throw new Error(`Unknown channel: ${channel}`);
  const db     = getDB();
  const limit  = LIMITS[channel];
  const ls     = Array.isArray(lines) ? lines : [lines];

  const insert = db.prepare(
    'INSERT INTO conversations (channel, player_id, line) VALUES (?, ?, ?)'
  );

  db.transaction(() => {
    if (channel === 'dirt') {
      db.prepare('DELETE FROM conversations WHERE channel = ?').run('dirt');
    }
    ls.forEach(l => insert.run(channel, playerId ?? null, l));

    // Prune to ring-buffer limit
    const count = db
      .prepare('SELECT COUNT(*) as n FROM conversations WHERE channel = ?')
      .get(channel).n;
    if (count > limit) {
      db.prepare(`
        DELETE FROM conversations WHERE channel = ? AND id IN (
          SELECT id FROM conversations WHERE channel = ?
          ORDER BY posted_at ASC LIMIT ?
        )
      `).run(channel, channel, count - limit);
    }
  })();
}

/** Seed a channel with default lines (used on first run if channel is empty). */
function seedIfEmpty(channel, lines) {
  const db  = getDB();
  const has = db.prepare('SELECT COUNT(*) as n FROM conversations WHERE channel = ?').get(channel).n;
  if (!has) addLines(channel, lines);
}

module.exports = { getLines, addLines, seedIfEmpty, CHANNELS };
