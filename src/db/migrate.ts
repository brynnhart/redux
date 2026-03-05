import { getDb } from './db.js';

const SCHEMA_VERSION = 1;

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

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(SCHEMA_VERSION));
}
