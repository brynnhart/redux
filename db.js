const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'lord.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS shop_weapons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stat INTEGER NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shop_armours (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stat INTEGER NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    hp INTEGER NOT NULL DEFAULT 0,
    hp_max INTEGER NOT NULL DEFAULT 0,
    gold INTEGER NOT NULL DEFAULT 0,
    bank_gold INTEGER NOT NULL DEFAULT 0,
    gems INTEGER NOT NULL DEFAULT 0,
    sleeping INTEGER NOT NULL DEFAULT 0,
    weapon_id TEXT REFERENCES shop_weapons(id) ON DELETE SET NULL,
    armour_id TEXT REFERENCES shop_armours(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_char INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    from_char INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
  );

  CREATE TABLE IF NOT EXISTS patrons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    char_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_flags (
    char_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    flag TEXT NOT NULL,
    used_on TEXT NOT NULL,
    PRIMARY KEY (char_id, flag)
  );

  CREATE TABLE IF NOT EXISTS presence (
    char_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    last_heartbeat_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marriages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    char1_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    char2_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    since TEXT NOT NULL DEFAULT (datetime('now'))
  );

`);

const characterColumns = db.prepare('PRAGMA table_info(characters)').all();
const characterColumnNames = new Set(characterColumns.map((column) => column.name));
if (!characterColumnNames.has('weapon_id')) {
  db.exec(
    "ALTER TABLE characters ADD COLUMN weapon_id TEXT REFERENCES shop_weapons(id) ON DELETE SET NULL"
  );
}
if (!characterColumnNames.has('armour_id')) {
  db.exec(
    "ALTER TABLE characters ADD COLUMN armour_id TEXT REFERENCES shop_armours(id) ON DELETE SET NULL"
  );
}

const seed = db.transaction(() => {
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('player');
  const now = new Date().toISOString();

  let userId = existingUser?.id;
  if (!userId) {
    const info = db
      .prepare('INSERT INTO users (username) VALUES (?)')
      .run('player');
    userId = info.lastInsertRowid;
  }

  const existingChar = db.prepare('SELECT id FROM characters WHERE name = ?').get('PunkyRoo');
  let charId = existingChar?.id;
  if (!charId) {
    const info = db
      .prepare(`
        INSERT INTO characters (
          user_id, name, level, xp, hp, hp_max, gold, bank_gold, gems, sleeping, weapon_id, armour_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        userId,
        'PunkyRoo',
        1,
        0,
        25,
        25,
        120,
        350,
        3,
        0,
        null,
        null,
        now
      );
    charId = info.lastInsertRowid;
  }

  const upsertWeapon = db.prepare(`
    INSERT INTO shop_weapons (id, name, stat, price)
    VALUES (@id, @name, @stat, @price)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, stat = excluded.stat, price = excluded.price
  `);

  const weapons = [
    { id: 'weapon-dagger', name: 'Dagger', stat: 3, price: 35 },
    { id: 'weapon-sword', name: 'Longsword', stat: 9, price: 150 },
    { id: 'weapon-axe', name: 'Battle Axe', stat: 13, price: 245 },
  ];
  weapons.forEach((weapon) => upsertWeapon.run(weapon));

  const upsertArmour = db.prepare(`
    INSERT INTO shop_armours (id, name, stat, price)
    VALUES (@id, @name, @stat, @price)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, stat = excluded.stat, price = excluded.price
  `);

  const armours = [
    { id: 'armour-wooden-shield', name: 'Wooden Shield', stat: 3, price: 40 },
    { id: 'armour-chainmail', name: 'Chainmail', stat: 8, price: 135 },
    { id: 'armour-plate', name: 'Steel Plate', stat: 14, price: 280 },
  ];
  armours.forEach((armour) => upsertArmour.run(armour));

  db.prepare(
    `UPDATE characters SET weapon_id = COALESCE(weapon_id, 'weapon-dagger') WHERE id = ?`
  ).run(charId);

  db.prepare(
    `UPDATE characters SET armour_id = COALESCE(armour_id, 'armour-wooden-shield') WHERE id = ?`
  ).run(charId);

  const newsCount = db.prepare('SELECT COUNT(*) AS count FROM news').get().count;
  if (newsCount === 0) {
    const insertNews = db.prepare('INSERT INTO news (kind, text, created_at) VALUES (?, ?, ?)');
    insertNews.run('announcement', 'The town crier proclaims a new age in the land.', now);
    insertNews.run('rumor', 'Whispers speak of a dragon stirring beyond the Dark Forest.', now);
  }

  const mailCount = db.prepare('SELECT COUNT(*) AS count FROM mail').get().count;
  if (mailCount === 0) {
    db.prepare(
      'INSERT INTO mail (to_char, from_char, body, created_at) VALUES (?, ?, ?, ?)' 
    ).run(charId, null, 'Welcome to the realm, PunkyRoo! Visit the Inn to meet fellow adventurers.', now);
  }

  const patronsCount = db.prepare('SELECT COUNT(*) AS count FROM patrons').get().count;
  if (patronsCount === 0) {
    const insertPatron = db.prepare(
      'INSERT INTO patrons (char_id, text, color, created_at) VALUES (?, ?, ?, ?)' 
    );
    insertPatron.run(charId, 'A bard hums a familiar tune about the legend of Red Dragon.', 'cyan', now);
    insertPatron.run(charId, 'A weary traveler mutters: "Keep your blade sharp and your wits sharper."', 'yellow', now);
  }
});

seed();

function currentChar() {
  return db.prepare('SELECT * FROM characters WHERE name = ?').get('PunkyRoo');
}

module.exports = {
  db,
  currentChar,
};
