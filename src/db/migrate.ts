import { getDb } from './db.js';

const SCHEMA_VERSION = 9;

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

  
  if (currentVersion < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS forest_state (
        player_id TEXT PRIMARY KEY,
        encounter_type TEXT NOT NULL CHECK (encounter_type IN ('NONE','ENEMY','EVENT')),
        encounter_key TEXT,
        encounter_payload TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      );
    `);
  }

  if (currentVersion < 4) {
    db.exec(`
      ALTER TABLE players ADD COLUMN weapon_tier INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE players ADD COLUMN armor_tier INTEGER NOT NULL DEFAULT 1;
    `);

    db.exec(`
      UPDATE players SET weapon_tier = COALESCE(weapon_tier, 1);
      UPDATE players SET armor_tier = COALESCE(armor_tier, 1);
    `);
  }

  
  if (currentVersion < 5) {
    db.exec(`
      ALTER TABLE players ADD COLUMN has_room INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN daily_flirt_used INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN daily_bard_used INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN daily_room_rented INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN inn_bribe_count_today INTEGER NOT NULL DEFAULT 0;
    `);

    db.exec(`
      UPDATE players SET has_room = COALESCE(has_room, 0);
      UPDATE players SET daily_flirt_used = COALESCE(daily_flirt_used, 0);
      UPDATE players SET daily_bard_used = COALESCE(daily_bard_used, 0);
      UPDATE players SET daily_room_rented = COALESCE(daily_room_rented, 0);
      UPDATE players SET inn_bribe_count_today = COALESCE(inn_bribe_count_today, 0);
    `);
  }


  if (currentVersion < 6) {
    db.exec(`
      ALTER TABLE players ADD COLUMN skill_level_death INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN skill_level_mystic INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN skill_level_thief INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN skill_uses_death INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE players ADD COLUMN skill_uses_mystic INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE players ADD COLUMN skill_uses_thief INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE players ADD COLUMN skill_mastery_death INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN skill_mastery_mystic INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN skill_mastery_thief INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN daily_skill_training_used INTEGER NOT NULL DEFAULT 0;
    `);

    db.exec(`
      UPDATE players SET skill_level_death = COALESCE(skill_level_death, 0);
      UPDATE players SET skill_level_mystic = COALESCE(skill_level_mystic, 0);
      UPDATE players SET skill_level_thief = COALESCE(skill_level_thief, 0);
      UPDATE players SET skill_uses_death = COALESCE(skill_uses_death, 1);
      UPDATE players SET skill_uses_mystic = COALESCE(skill_uses_mystic, 1);
      UPDATE players SET skill_uses_thief = COALESCE(skill_uses_thief, 1);
      UPDATE players SET skill_mastery_death = COALESCE(skill_mastery_death, 0);
      UPDATE players SET skill_mastery_mystic = COALESCE(skill_mastery_mystic, 0);
      UPDATE players SET skill_mastery_thief = COALESCE(skill_mastery_thief, 0);
      UPDATE players SET daily_skill_training_used = COALESCE(daily_skill_training_used, 0);
    `);
  }


  if (currentVersion < 7) {
    db.exec(`
      ALTER TABLE players ADD COLUMN elixirs INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN room_expires_at TEXT;
      ALTER TABLE players ADD COLUMN inn_breakin_used_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN has_flirted_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN has_listened_bard_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN bonus_forest_fights INTEGER NOT NULL DEFAULT 0;
    `);

    db.exec(`
      UPDATE players SET elixirs = COALESCE(elixirs, 0);
      UPDATE players SET inn_breakin_used_today = COALESCE(inn_breakin_used_today, 0);
      UPDATE players SET has_flirted_today = COALESCE(has_flirted_today, 0);
      UPDATE players SET has_listened_bard_today = COALESCE(has_listened_bard_today, 0);
      UPDATE players SET bonus_forest_fights = COALESCE(bonus_forest_fights, 0);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS inn_breakins (
        id TEXT PRIMARY KEY,
        attacker_player_id TEXT NOT NULL,
        target_player_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        result TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_inn_breakins_attacker ON inn_breakins (attacker_player_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_inn_breakins_target ON inn_breakins (target_player_id, created_at);
    `);
  }


  if (currentVersion < 8) {
    db.exec(`
      ALTER TABLE players ADD COLUMN gold_pocket INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN gold_bank INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN money_doubler_used_today INTEGER NOT NULL DEFAULT 0;
    `);

    db.exec(`
      UPDATE players SET gold_pocket = COALESCE(gold_pocket, gold, 0);
      UPDATE players SET gold_bank = COALESCE(gold_bank, bank_gold, 0);
      UPDATE players SET money_doubler_used_today = COALESCE(money_doubler_used_today, today_money_doubler_used, 0);
    `);
  }

  if (currentVersion < 9) {
    db.exec(`
      ALTER TABLE players ADD COLUMN last_day_key TEXT;
      ALTER TABLE players ADD COLUMN forest_fights_used_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN forest_fights_max_today INTEGER NOT NULL DEFAULT 30;
      ALTER TABLE players ADD COLUMN player_fight_used_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN inn_flirt_used_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN bard_listens_used_today INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN in_room INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE players ADD COLUMN room_paid_until_day_key TEXT;
      ALTER TABLE players ADD COLUMN is_dead INTEGER NOT NULL DEFAULT 0;
    `);

    db.exec(`
      UPDATE players
      SET
        last_day_key = COALESCE(last_day_key, last_daily_reset_date),
        forest_fights_used_today = COALESCE(forest_fights_used_today, 0),
        forest_fights_max_today = COALESCE(forest_fights_max_today, turns_forest_max, 30),
        player_fight_used_today = COALESCE(player_fight_used_today, CASE WHEN turns_pvp_left <= 0 THEN 1 ELSE 0 END),
        inn_flirt_used_today = COALESCE(inn_flirt_used_today, has_flirted_today, daily_flirt_used, 0),
        bard_listens_used_today = COALESCE(bard_listens_used_today, has_listened_bard_today, daily_bard_used, 0),
        in_room = COALESCE(in_room, has_room, 0),
        is_dead = COALESCE(is_dead, 0);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS news_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        player_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_news_events_day_key ON news_events (day_key);
      CREATE INDEX IF NOT EXISTS idx_news_events_player_day_key ON news_events (player_id, day_key);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_player_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pending_events_target_player ON pending_events (target_player_id, created_at);
    `);
  }
db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(SCHEMA_VERSION));
}
