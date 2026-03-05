import { getDb } from '../db/db.js';

export type PlayerClass = 'DEATH_KNIGHT' | 'MYSTICAL' | 'THIEF';
export type PlayerSex = 'M' | 'F';
export type Spirits = 'LOW' | 'NORMAL' | 'HIGH';

export interface PlayerRecord {
  id: string;
  username: string;
  pass_hash: string;
  created_at: string;
  last_login_at: string | null;
  display_name: string;
  sex: PlayerSex;
  class: PlayerClass;
  level: number;
  exp: number;
  hp: number;
  hp_max: number;
  gold: number;
  bank_gold: number;
  gems: number;
  charm: number;
  last_daily_reset_date: string | null;
  spirits: Spirits;
  turns_forest_max: number;
  turns_forest_left: number;
  turns_pvp_max: number;
  turns_pvp_left: number;
  today_money_doubler_used: number;
  today_bard_listens: number;
  today_flirts: number;
  weapon_tier: number;
  armor_tier: number;
}

export interface NewPlayerInput {
  id: string;
  username: string;
  pass_hash: string;
  display_name: string;
  sex: PlayerSex;
  class: PlayerClass;
}

type MutablePlayerStats = Pick<
  PlayerRecord,
  | 'level'
  | 'exp'
  | 'hp'
  | 'hp_max'
  | 'gold'
  | 'bank_gold'
  | 'gems'
  | 'charm'
  | 'last_daily_reset_date'
  | 'spirits'
  | 'turns_forest_max'
  | 'turns_forest_left'
  | 'turns_pvp_max'
  | 'turns_pvp_left'
  | 'today_money_doubler_used'
  | 'today_bard_listens'
  | 'today_flirts'
  | 'weapon_tier'
  | 'armor_tier'
>;

export class PlayerRepo {
  createPlayer(data: NewPlayerInput): PlayerRecord {
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(
      `INSERT INTO players (
        id, username, pass_hash, created_at, last_login_at, display_name, sex, class
      ) VALUES (
        @id, @username, @pass_hash, @created_at, @last_login_at, @display_name, @sex, @class
      )`
    ).run({
      id: data.id,
      username: data.username,
      pass_hash: data.pass_hash,
      created_at: now,
      last_login_at: now,
      display_name: data.display_name,
      sex: data.sex,
      class: data.class
    });

    return this.findById(data.id)!;
  }

  findByUsername(username: string): PlayerRecord | null {
    const db = getDb();
    const player = db
      .prepare('SELECT * FROM players WHERE username = ? COLLATE NOCASE')
      .get(username) as PlayerRecord | undefined;
    return player ?? null;
  }

  findById(id: string): PlayerRecord | null {
    const db = getDb();
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRecord | undefined;
    return player ?? null;
  }

  updateLastLogin(id: string) {
    const db = getDb();
    db.prepare('UPDATE players SET last_login_at = ? WHERE id = ?').run([new Date().toISOString(), id]);
  }

  updatePlayerStats(id: string, patch: Partial<MutablePlayerStats>) {
    const entries = Object.entries(patch);
    if (entries.length === 0) {
      return;
    }

    const setSql = entries.map(([key]) => `${key} = @${key}`).join(', ');
    const db = getDb();
    db.prepare(`UPDATE players SET ${setSql} WHERE id = @id`).run({ id, ...patch });
  }
}
