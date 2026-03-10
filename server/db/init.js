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

      -- Daily resource
      actions         INTEGER NOT NULL DEFAULT 15,  -- replaces forest_fights
      is_exhausted    INTEGER NOT NULL DEFAULT 0,   -- set when actions reach 0 via combat loss
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
      has_fairy       INTEGER NOT NULL DEFAULT 0,   -- thief fairy companion
      fairy_lore      INTEGER NOT NULL DEFAULT 0,   -- fairy lore level
      light_shield    INTEGER NOT NULL DEFAULT 0,   -- mystic light shield
      magically_delicious INTEGER NOT NULL DEFAULT 0, -- Jennie GIFT gate
      ran_away        INTEGER NOT NULL DEFAULT 0,   -- fled from battle today

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
      killedaplayer   INTEGER NOT NULL DEFAULT 0,   -- killed a player today (allows dirt writing)
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
      which_castle        INTEGER NOT NULL DEFAULT 1,   -- current correct rescue castle (1-5)
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

  // ── Equipment system ───────────────────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      rarity      TEXT    NOT NULL DEFAULT 'common',   -- common/uncommon/rare
      source      TEXT    NOT NULL DEFAULT 'shop',     -- shop/drop
      gold_value  INTEGER NOT NULL DEFAULT 0,
      modifiers   TEXT    NOT NULL DEFAULT '{}',       -- JSON: {attack:5, defense:3, ...}
      equippable  INTEGER NOT NULL DEFAULT 1           -- boolean 1/0
    );

    CREATE TABLE IF NOT EXISTS player_equipment (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      slot_number INTEGER NOT NULL,
      item_id     INTEGER NOT NULL REFERENCES items(id),
      UNIQUE(player_id, slot_number)
    );

    CREATE TABLE IF NOT EXISTS player_inventory (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      item_id     INTEGER NOT NULL REFERENCES items(id)
    );
  `);

  // Add equipment_slots column to players if missing
  try {
    db.prepare('ALTER TABLE players ADD COLUMN equipment_slots INTEGER NOT NULL DEFAULT 3').run();
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  // ── Seed items table (idempotent — only if empty) ──────────────────────────
  const itemCount = db.prepare('SELECT COUNT(*) as n FROM items').get().n;
  if (itemCount === 0) {
    const insertItem = db.prepare(`
      INSERT INTO items (name, description, rarity, source, gold_value, modifiers, equippable)
      VALUES (@name, @description, @rarity, @source, @gold_value, @modifiers, @equippable)
    `);

    const seedItems = db.transaction((items) => {
      for (const item of items) insertItem.run(item);
    });

    // ── Weapons (attack modifiers) — 16 tiers ─────────────────────────────
    // Mirrored against armour for balanced split-purchase play
    const weapons = [
      { name: 'Stick',         description: 'A sturdy walking stick repurposed for violence.',   gold_value: 200,       modifiers: JSON.stringify({ attack: 5   }) },
      { name: 'Dagger',        description: 'Quick and light; favored by those who value speed.', gold_value: 1000,      modifiers: JSON.stringify({ attack: 10  }) },
      { name: 'Short Sword',   description: 'Reliable and easy to carry.',                        gold_value: 3000,      modifiers: JSON.stringify({ attack: 20  }) },
      { name: 'Long Sword',    description: 'The weapon of the common soldier.',                  gold_value: 10000,     modifiers: JSON.stringify({ attack: 30  }) },
      { name: 'Huge Axe',      description: 'Devastating in strong hands.',                       gold_value: 30000,     modifiers: JSON.stringify({ attack: 40  }) },
      { name: 'Bone Cruncher', description: 'Its name explains everything you need to know.',    gold_value: 100000,    modifiers: JSON.stringify({ attack: 60  }) },
      { name: 'Twin Swords',   description: 'Two blades, twice the carnage.',                     gold_value: 150000,    modifiers: JSON.stringify({ attack: 80  }) },
      { name: 'Power Axe',     description: 'Enchanted steel that hums with fury.',               gold_value: 200000,    modifiers: JSON.stringify({ attack: 120 }) },
      { name: "Able's Sword",  description: "Forged by the legendary smith Able.",                gold_value: 400000,    modifiers: JSON.stringify({ attack: 180 }) },
      { name: "Wan's Weapon",  description: 'Its origin is a mystery even to its owner.',         gold_value: 1000000,   modifiers: JSON.stringify({ attack: 250 }) },
      { name: 'Spear of Gold', description: 'A golden spear blessed by forgotten gods.',          gold_value: 4000000,   modifiers: JSON.stringify({ attack: 350 }) },
      { name: 'Crystal Shard', description: 'A razor sliver of pure crystallized power.',         gold_value: 10000000,  modifiers: JSON.stringify({ attack: 500 }) },
      { name: "Nira's Teeth",  description: 'Nobody asks what Nira was.',                         gold_value: 40000000,  modifiers: JSON.stringify({ attack: 800 }) },
      { name: 'Blood Sword',   description: 'It drinks what it spills.',                          gold_value: 100000000, modifiers: JSON.stringify({ attack: 1200}) },
      { name: 'Death Sword',   description: 'The last weapon you will ever need.',                gold_value: 400000000, modifiers: JSON.stringify({ attack: 2000}) },
    ];

    // ── Armour (defense modifiers) — 16 tiers ─────────────────────────────
    const armours = [
      { name: 'Coat',             description: 'Better than nothing. Barely.',                    gold_value: 200,       modifiers: JSON.stringify({ defense: 5   }) },
      { name: 'Heavy Coat',       description: 'Thick wool with some toughened leather panels.',  gold_value: 1000,      modifiers: JSON.stringify({ defense: 10  }) },
      { name: 'Leather Vest',     description: 'Supple, quiet, and better than cloth.',           gold_value: 3000,      modifiers: JSON.stringify({ defense: 20  }) },
      { name: 'Bronze Armour',    description: 'The first step toward real protection.',          gold_value: 10000,     modifiers: JSON.stringify({ defense: 30  }) },
      { name: 'Iron Armour',      description: 'Heavy, reliable, and completely unfashionable.',  gold_value: 30000,     modifiers: JSON.stringify({ defense: 40  }) },
      { name: 'Graphite Armour',  description: 'Lightweight and surprisingly strong.',            gold_value: 100000,    modifiers: JSON.stringify({ defense: 60  }) },
      { name: "Erdrick's Armour", description: 'Once worn by the hero Erdrick himself.',          gold_value: 150000,    modifiers: JSON.stringify({ defense: 80  }) },
      { name: 'Armour of Death',  description: 'It was taken from someone who no longer needed it.',gold_value: 200000,  modifiers: JSON.stringify({ defense: 120 }) },
      { name: "Able's Armour",    description: 'A matched set with the famous sword.',            gold_value: 400000,    modifiers: JSON.stringify({ defense: 180 }) },
      { name: 'Full Body Armour', description: 'Head to toe in forged steel.',                    gold_value: 1000000,   modifiers: JSON.stringify({ defense: 250 }) },
      { name: 'Blood Armour',     description: 'Stained crimson. Do not ask how.',                gold_value: 4000000,   modifiers: JSON.stringify({ defense: 350 }) },
      { name: 'Magic Protection', description: 'Woven with spells older than the kingdom.',       gold_value: 10000000,  modifiers: JSON.stringify({ defense: 500 }) },
      { name: "Belar's Mail",     description: 'Belar was never defeated in battle.',             gold_value: 40000000,  modifiers: JSON.stringify({ defense: 800 }) },
      { name: 'Golden Armour',    description: 'Blinding to behold, impenetrable to strike.',    gold_value: 100000000, modifiers: JSON.stringify({ defense: 1200}) },
      { name: 'Armour of Lore',   description: 'Ancient armour said to carry the knowledge of ages.',gold_value: 400000000,modifiers: JSON.stringify({ defense: 2000}) },
    ];

    const allShopItems = [
      ...weapons.map(w => ({ ...w, rarity: 'common', source: 'shop', equippable: 1 })),
      ...armours.map(a => ({ ...a, rarity: 'common', source: 'shop', equippable: 1 })),
    ];

    seedItems(allShopItems);
    console.log(`[DB] Seeded ${allShopItems.length} items`);
  }

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
