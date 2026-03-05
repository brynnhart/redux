import { getDb } from '../db/db.js';

export type PlayerClass = 'DEATH_KNIGHT' | 'MYSTICAL' | 'THIEF';
export type PlayerSex = 'M' | 'F';

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
  turns_forest: number;
  turns_pvp: number;
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
  'level' | 'exp' | 'hp' | 'hp_max' | 'gold' | 'bank_gold' | 'gems' | 'charm' | 'turns_forest' | 'turns_pvp'
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
