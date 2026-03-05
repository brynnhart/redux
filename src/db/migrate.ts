import { getDb } from './db.js';

const SCHEMA_VERSION = 2;

export function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const versionRow = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value?: string } | undefined;

  const currentVersion = Number(versionRow?.value ?? '0');

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        pass_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_login_at TEXT,
        display_name TEXT NOT NULL,
        sex TEXT NOT NULL CHECK (sex IN ('M','F')),
        class TEXT NOT NULL CHECK (class IN ('DEATH_KNIGHT','MYSTICAL','THIEF')),
        level INTEGER NOT NULL DEFAULT 1,
        exp INTEGER NOT NULL DEFAULT 0,
        hp INTEGER NOT NULL DEFAULT 20,
        hp_max INTEGER NOT NULL DEFAULT 20,
        gold INTEGER NOT NULL DEFAULT 0,
        bank_gold INTEGER NOT NULL DEFAULT 500,
        gems INTEGER NOT NULL DEFAULT 0,
        charm INTEGER NOT NULL DEFAULT 0,
        turns_forest INTEGER NOT NULL DEFAULT 0,
        turns_pvp INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  if (currentVersion < 2) {
    db.exec(`
      ALTER TABLE players ADD COLUMN turns_forest_max INTEGER NOT NULL DEFAULT 30;
      ALTER TABLE players ADD COLUMN turns_forest_left INTEGER NOT NULL DEFAULT 30;
      ALTER TABLE players ADD COLUMN turns_pvp_max INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE players ADD COLUMN turns_pvp_left INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE players ADD COLUMN last_daily_reset_date TEXT;
      ALTER TABLE players ADD COLUMN spirits TEXT NOT NULL DEFAULT 'NORMAL' CHECK (spirits IN ('LOW','NORMAL','HIGH'));
      ALTER TABLE players ADD COLUMN today_money_doubler_used INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN today_bard_listens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN today_flirts INTEGER NOT NULL DEFAULT 0;
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_news (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        player_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_daily_news_date ON daily_news (date);
      CREATE INDEX IF NOT EXISTS idx_daily_news_player_date ON daily_news (player_id, date);
    `);

    db.exec(`
      UPDATE players SET turns_forest_max = COALESCE(turns_forest_max, 30);
      UPDATE players SET turns_forest_left = COALESCE(turns_forest_left, turns_forest, turns_forest_max);
      UPDATE players SET turns_pvp_max = COALESCE(turns_pvp_max, 1);
      UPDATE players SET turns_pvp_left = COALESCE(turns_pvp_left, turns_pvp, turns_pvp_max);
      UPDATE players SET spirits = COALESCE(spirits, 'NORMAL');
      UPDATE players SET today_money_doubler_used = COALESCE(today_money_doubler_used, 0);
      UPDATE players SET today_bard_listens = COALESCE(today_bard_listens, 0);
      UPDATE players SET today_flirts = COALESCE(today_flirts, 0);
    `);
  }

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(SCHEMA_VERSION));
}
