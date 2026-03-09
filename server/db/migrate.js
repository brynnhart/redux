'use strict';

/**
 * server/db/migrate.js
 *
 * Safe, idempotent migration — adds any missing columns to the players table.
 * Run this against the live Fly.io database before (or instead of) a full reset:
 *
 *   fly ssh console -C "node server/db/migrate.js"
 *
 * Each ALTER TABLE is wrapped in a try/catch so re-running is always safe.
 * Existing player data is never touched.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const path     = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/lord.db');

console.log(`[migrate] Opening database at: ${DB_PATH}`);
const db = new Database(DB_PATH);

// Each entry: [column_name, SQL type + default]
const MISSING_COLUMNS = [
  ['fairy_lore',          'INTEGER NOT NULL DEFAULT 0'],
  ['light_shield',        'INTEGER NOT NULL DEFAULT 0'],
  ['magically_delicious', 'INTEGER NOT NULL DEFAULT 0'],
  ['ran_away',            'INTEGER NOT NULL DEFAULT 0'],
];

let added = 0;
let skipped = 0;

for (const [col, def] of MISSING_COLUMNS) {
  try {
    db.prepare(`ALTER TABLE players ADD COLUMN ${col} ${def}`).run();
    console.log(`[migrate] ✓ Added column: ${col}`);
    added++;
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
      console.log(`[migrate] — Already exists: ${col}`);
      skipped++;
    } else {
      console.error(`[migrate] ✗ Failed on column ${col}:`, err.message);
      process.exit(1);
    }
  }
}

console.log(`\n[migrate] Done. Added: ${added}, Already present: ${skipped}`);
db.close();
