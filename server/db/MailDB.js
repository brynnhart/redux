'use strict';

/**
 * server/db/MailDB.js
 *
 * Per-player in-game mail.
 * Replaces: psock CheckMail / GetMail / WriteMail / KillMail
 *           + lordsrv flat-file smail{N}.lrd handling
 */

const { getDB } = require('./init');

/** Check if a player has unread mail. */
function hasMail(toPlayerId) {
  const row = getDB()
    .prepare('SELECT COUNT(*) as n FROM mail WHERE to_player = ? AND read = 0')
    .get(toPlayerId);
  return row.n > 0;
}

/** Fetch and mark-as-read all unread mail for a player. Returns array of mail rows. */
function fetchMail(toPlayerId) {
  const db   = getDB();
  const rows = db.prepare('SELECT * FROM mail WHERE to_player = ? ORDER BY sent_at ASC').all(toPlayerId);
  if (rows.length) {
    db.prepare('UPDATE mail SET read = 1 WHERE to_player = ?').run(toPlayerId);
  }
  return rows;
}

/** Send mail from one player to another. fromPlayerId can be null for NPC/system mail. */
function sendMail(toPlayerId, fromPlayerId, body) {
  getDB()
    .prepare('INSERT INTO mail (to_player, from_player, body) VALUES (?, ?, ?)')
    .run(toPlayerId, fromPlayerId ?? null, body);
}

/** Delete all mail for a player (called after reading). */
function deleteMail(toPlayerId) {
  getDB().prepare('DELETE FROM mail WHERE to_player = ?').run(toPlayerId);
}

module.exports = { hasMail, fetchMail, sendMail, deleteMail };
