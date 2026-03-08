'use strict';

/**
 * server/db/StateDB.js
 *
 * Single-row game state table.
 * Replaces: psock GetState / put_state() / get_state()
 */

const { getDB } = require('./init');

function get() {
  return getDB().prepare('SELECT * FROM game_state WHERE id = 1').get();
}

function patch(fields) {
  const db   = getDB();
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set  = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE game_state SET ${set} WHERE id = 1`).run(fields);
}

function setLatestHero(name) {
  patch({ latesthero: name });
}

function setMarriedToSeth(playerId) {
  patch({ married_to_seth: playerId });
}

function setMarriedToViolet(playerId) {
  patch({ married_to_violet: playerId });
}

function setWonBy(playerId) {
  patch({ won_by: playerId });
}

function addForestGold(amount) {
  getDB().prepare('UPDATE game_state SET forest_gold = forest_gold + ? WHERE id = 1').run(amount);
}

function resetForestGold(minAmount) {
  const current = get().forest_gold;
  const next    = Math.max(minAmount, 100);
  patch({ forest_gold: next });
  return current;
}

function incrementDay() {
  getDB().prepare('UPDATE game_state SET days = days + 1, last_reset = unixepoch() WHERE id = 1').run();
}

module.exports = {
  get,
  patch,
  setLatestHero,
  setMarriedToSeth,
  setMarriedToViolet,
  setWonBy,
  addForestGold,
  resetForestGold,
  incrementDay,
};
