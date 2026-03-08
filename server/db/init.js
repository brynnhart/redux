'use strict';

/**
 * server/db/init.js
 *
 * Creates (or migrates) the SQLite database.
 * Schema is derived directly from recorddefs.js Player_Def + Server_State_Def.
 *
 * Run standalone:  node server/db/init.js [--reset]
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/lord.db');

let _db = null;

function getDB() {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

function initDB() {
  const db = getDB();

  // ── Users (auth accounts, separate from in-game players) ──────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password    TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      last_login  INTEGER
    );
  `);

  // ── Players (from recorddefs.js Player_Def — all 55 fields) ───────────────
  // clss: 0=normal, 1=Death Knight, 2=Thief, 3=Mystic
  // sex:  'M' or 'F'
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      -- Identity
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name            TEXT    NOT NULL,               -- in-game character name (max 20)
      real_name       TEXT    NOT NULL DEFAULT '',    -- account username copy
      sex             TEXT    NOT NULL DEFAULT 'M',   -- 'M' or 'F'

      -- Stats
      hp              INTEGER NOT NULL DEFAULT 20,
      hp_max          INTEGER NOT NULL DEFAULT 20,
      str             INTEGER NOT NULL DEFAULT 10,
      def             INTEGER NOT NULL DEFAULT 1,
      cha             INTEGER NOT NULL DEFAULT 1,
      exp             INTEGER NOT NULL DEFAULT 1,
      level           INTEGER NOT NULL DEFAULT 1,

      -- Equipment
      weapon_num      INTEGER NOT NULL DEFAULT 1,
      weapon          TEXT    NOT NULL DEFAULT 'Stick',
      arm_num         INTEGER NOT NULL DEFAULT 1,
      arm             TEXT    NOT NULL DEFAULT 'Coat',

      -- Economy
      gold            INTEGER NOT NULL DEFAULT 500,
      bank            INTEGER NOT NULL DEFAULT 0,
      gem             INTEGER NOT NULL DEFAULT 0,
      transferred_gold INTEGER NOT NULL DEFAULT 0,

      -- Class skills (0=not chosen, 1=Death Knight, 2=Thief, 3=Mystic)
      clss            INTEGER NOT NULL DEFAULT 0,
      skillw          INTEGER NOT NULL DEFAULT 0,   -- Death Knight skill pts
      skillm          INTEGER NOT NULL DEFAULT 0,   -- Mystical skill pts
      skillt          INTEGER NOT NULL DEFAULT 0,   -- Thieving skill pts
      levelw          INTEGER NOT NULL DEFAULT 0,   -- DK uses today
      levelm          INTEGER NOT NULL DEFAULT 0,   -- Mystic uses today
      levelt          INTEGER NOT NULL DEFAULT 0,   -- Thief uses today

      -- Daily state
      forest_fights   INTEGER NOT NULL DEFAULT 15,
      pvp_fights      INTEGER NOT NULL DEFAULT 0,   -- fights available vs players today
      seen_master     INTEGER NOT NULL DEFAULT 0,   -- Boolean
      seen_dragon     INTEGER NOT NULL DEFAULT 0,
      seen_violet     INTEGER NOT NULL DEFAULT 0,
      seen_bard       INTEGER NOT NULL DEFAULT 0,
      got_delicious   INTEGER NOT NULL DEFAULT 0,
      weird           INTEGER NOT NULL DEFAULT 0,   -- weird forest event today
      high_spirits    INTEGER NOT NULL DEFAULT 1,
      flirted         INTEGER NOT NULL DEFAULT 0,
      leftbank        INTEGER NOT NULL DEFAULT 0,
      divorced        INTEGER NOT NULL DEFAULT 0,

      -- Status flags
      dead            INTEGER NOT NULL DEFAULT 0,
      inn             INTEGER NOT NULL DEFAULT 0,   -- sleeping at inn
      on_now          INTEGER NOT NULL DEFAULT 0,   -- currently online
      horse           INTEGER NOT NULL DEFAULT 0,
      amulet          INTEGER NOT NULL DEFAULT 0,   -- amulet of accuracy

      -- Olivia / special events
      olivia          INTEGER NOT NULL DEFAULT 0,
      asshole         INTEGER NOT NULL DEFAULT 0,   -- kicked Olivia
      olivia_count    INTEGER NOT NULL DEFAULT 0,
      done_tower      INTEGER NOT NULL DEFAULT 0,

      -- Social
      married_to      INTEGER NOT NULL DEFAULT -1,  -- player id, or -1
      kids            INTEGER NOT NULL DEFAULT 0,
      laid            INTEGER NOT NULL DEFAULT 0,

      -- Description
      has_des         INTEGER NOT NULL DEFAULT 0,
      des1            TEXT    NOT NULL DEFAULT '',
      des2            TEXT    NOT NULL DEFAULT '',

      -- Progress
      drag_kills      INTEGER NOT NULL DEFAULT 0,
      pvp             INTEGER NOT NULL DEFAULT 0,   -- total player kills
      last_reincarnated INTEGER NOT NULL DEFAULT 0,

      -- Session tracking
      time            INTEGER NOT NULL DEFAULT 0,   -- unix day # last played
      time_on         TEXT    NOT NULL DEFAULT '00:00',
      gone            INTEGER NOT NULL DEFAULT 0,   -- days absent

      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // ── Game state (single row) ────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_state (
      id                  INTEGER PRIMARY KEY DEFAULT 1,
      latesthero          TEXT    NOT NULL DEFAULT 'Master Turgon',
      married_to_seth     INTEGER NOT NULL DEFAULT -1,  -- player id or -1
      married_to_violet   INTEGER NOT NULL DEFAULT -1,  -- player id or -1
      won_by              INTEGER NOT NULL DEFAULT -1,  -- player id or -1
      last_bar            INTEGER NOT NULL DEFAULT -1,  -- player id
      forest_gold         INTEGER NOT NULL DEFAULT 100,
      days                INTEGER NOT NULL DEFAULT 0,
      last_reset          INTEGER NOT NULL DEFAULT 0    -- unix timestamp
    );

    -- Ensure there is always exactly one row
    INSERT OR IGNORE INTO game_state (id) VALUES (1);
  `);

  // ── Daily log ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS log_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      line        TEXT    NOT NULL
    );
  `);

  // ── Mail ──────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS mail (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      to_player   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      from_player INTEGER,                             -- null = system/NPC
      body        TEXT    NOT NULL,
      sent_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      read        INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Bar / Garden conversations (ring buffers) ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel     TEXT    NOT NULL,   -- 'bar', 'darkbar', 'garden', 'dirt'
      player_id   INTEGER,
      line        TEXT    NOT NULL,
      posted_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_conv_channel ON conversations(channel, posted_at);
  `);

  // ── Sessions (for reconnect support) ──────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT    PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player_id   INTEGER REFERENCES players(id) ON DELETE SET NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at  INTEGER NOT NULL,
      last_seen   INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  console.log('[DB] Schema ready');
  return db;
}

// ── Standalone reset ───────────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  if (process.argv.includes('--reset') && fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('[DB] Existing database removed');
  }
  initDB();
  console.log('[DB] Done');
  process.exit(0);
}

module.exports = { initDB, getDB };
