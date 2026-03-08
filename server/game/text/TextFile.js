'use strict';

/**
 * server/game/text/TextFile.js
 *
 * Read and index .lrd text files.
 * Replaces: lord.js build_txt_index(), show_lord_file(), display_file(), lrdfile()
 *
 * .lrd files are plain text with LoRD color codes.
 * lordtxt.lrd has named sections separated by lines starting with '~':
 *   ~SECTIONNAME
 *   ...text...
 *   ~NEXTSECTION
 */

const fs   = require('fs');
const path = require('path');

const GAME_DATA_DIR = process.env.GAME_DATA_DIR || path.join(__dirname, '../../../gamedata');

/** In-memory index cache: filename → { sectionName: ['line', ...] } */
const _cache = new Map();

/**
 * Read a .lrd file and return its lines.
 * Searches gamedata/ directory.
 */
function readFile(filename) {
  const full = path.join(GAME_DATA_DIR, filename);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8').split(/\r?\n/);
}

/**
 * Build a section index for a .lrd file (like lordtxt.lrd).
 * Returns { SECTIONNAME: ['line1', 'line2', ...], ... }
 * Replaces: lord.js build_txt_index()
 */
function buildIndex(filename) {
  if (_cache.has(filename)) return _cache.get(filename);

  const lines = readFile(filename);
  if (!lines) return {};

  const index   = {};
  let   current = null;

  for (const line of lines) {
    if (line.startsWith('~')) {
      current = line.slice(1).trim().toUpperCase();
      index[current] = [];
    } else if (current) {
      index[current].push(line);
    }
  }

  _cache.set(filename, index);
  return index;
}

/**
 * Get a named section from lordtxt.lrd.
 * Returns array of raw (LoRD-coded) lines, or [] if not found.
 */
function getSection(sectionName) {
  const idx = buildIndex('lordtxt.lrd');
  return idx[sectionName.toUpperCase()] || [];
}

/**
 * Pick a random line from a .lrd file (for sayings, etc.)
 * Replaces the pattern: pick random line from goodsay.lrd / badsay.lrd
 */
function randomLine(filename) {
  const lines = readFile(filename);
  if (!lines || !lines.length) return '';
  const nonempty = lines.filter(l => l.trim().length > 0);
  if (!nonempty.length) return '';
  return nonempty[Math.floor(Math.random() * nonempty.length)];
}

/**
 * Get lines from one of the start*.lrd files (bar conversation seeds).
 * Picks a random file from start1..5.lrd.
 */
function randomStartFile() {
  const n = Math.floor(Math.random() * 5) + 1;
  return readFile(`start${n}.lrd`) || [];
}

/** Invalidate the cache (useful in tests or after file changes). */
function clearCache() {
  _cache.clear();
}

module.exports = {
  readFile,
  buildIndex,
  getSection,
  randomLine,
  randomStartFile,
  clearCache,
};
