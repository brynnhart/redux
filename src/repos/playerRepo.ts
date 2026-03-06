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
  gold_on_hand: number;
  gold_in_bank: number;
  gems: number;
  charm: number;
  last_day_seen: string | null;
  flirt_used_today: number;
  bard_listens_used_today: number;
  inn_room_expires_day_key: string | null;
  is_alive: number;
  last_killed_at: string | null;
  in_inn_room: number;
  pvp_used_today: number;
  killed_by_player_id: string | null;
  player_kills: number;
  times_laid: number;
  spirits: Spirits;
  turns_forest_max: number;
  turns_forest_left: number;
  turns_pvp_max: number;
  turns_pvp_left: number;
  money_doubler_used_today: number;
  inn_bribe_count_today: number;
  elixirs: number;
  inn_breakin_used_today: number;
  weapon_tier: number;
  armor_tier: number;
  weapon_id: string;
  armor_id: string;
  skill_level_death: number;
  skill_level_mystic: number;
  skill_level_thief: number;
  skill_uses_death: number;
  skill_uses_mystic: number;
  skill_uses_thief: number;
  skill_mastery_death: number;
  skill_mastery_mystic: number;
  skill_mastery_thief: number;
  training_challenge_used_today: number;
  heroic_deeds_done: number;
  dragon_kills_total: number;
  current_lap: number;
  has_fairy: number;
  dragon_fought_today: number;
  olivia_seen: number;
  olivia_clue_stage: number;
  olivia_used_today: number;
  mastery_title: string | null;
}

export interface HallOfHonorRecord {
  id: string;
  display_name: string;
  level: number;
  heroic_deeds_done: number;
}

export interface RankingRecord {
  id: string;
  display_name: string;
  class: PlayerClass;
  level: number;
  exp: number;
  heroic_deeds_done: number;
  current_lap: number;
  is_alive: number;
  last_login_at: string | null;
}

export type OldManCategory = 'kills' | 'laid' | 'dragons' | 'bank' | 'strongest';

export interface OldManTopRecord {
  id: string;
  display_name: string;
  level: number;
  heroic_deeds_done: number;
  exp: number;
  player_kills: number;
  times_laid: number;
  gold_in_bank: number;
  score: number;
}

export interface InnTargetRecord {
  id: string;
  display_name: string;
  level: number;
  is_alive: number;
  in_inn_room: number;
  weapon_tier: number;
  weapon_id: string;
}

export interface FieldsTargetRecord {
  id: string;
  display_name: string;
  level: number;
  is_alive: number;
  in_inn_room: number;
  weapon_id: string;
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
  | 'gold_on_hand'
  | 'gold_in_bank'
  | 'gems'
  | 'charm'
  | 'last_day_seen'
  | 'flirt_used_today'
  | 'bard_listens_used_today'
  | 'inn_room_expires_day_key'
  | 'is_alive'
  | 'last_killed_at'
  | 'in_inn_room'
  | 'pvp_used_today'
  | 'killed_by_player_id'
  | 'player_kills'
  | 'times_laid'
  | 'spirits'
  | 'turns_forest_max'
  | 'turns_forest_left'
  | 'turns_pvp_max'
  | 'turns_pvp_left'
  | 'money_doubler_used_today'
  | 'inn_bribe_count_today'
  | 'elixirs'
  | 'inn_breakin_used_today'
  | 'weapon_tier'
  | 'armor_tier'
  | 'weapon_id'
  | 'armor_id'
  | 'skill_level_death'
  | 'skill_level_mystic'
  | 'skill_level_thief'
  | 'skill_uses_death'
  | 'skill_uses_mystic'
  | 'skill_uses_thief'
  | 'skill_mastery_death'
  | 'skill_mastery_mystic'
  | 'skill_mastery_thief'
  | 'training_challenge_used_today'
  | 'heroic_deeds_done'
  | 'dragon_kills_total'
  | 'current_lap'
  | 'has_fairy'
  | 'dragon_fought_today'
  | 'olivia_seen'
  | 'olivia_clue_stage'
  | 'olivia_used_today'
  | 'mastery_title'
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

  listInnTargets(excludePlayerId: string): InnTargetRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, display_name, level, is_alive, in_inn_room, weapon_tier, weapon_id
         FROM players
         WHERE id != ?
           AND is_alive = 1
           AND in_inn_room = 1
         ORDER BY level DESC, display_name COLLATE NOCASE ASC
         LIMIT 50`
      )
      .all(excludePlayerId) as InnTargetRecord[];
  }

  listFieldsTargets(excludePlayerId: string): FieldsTargetRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, display_name, level, is_alive, in_inn_room, weapon_id
         FROM players
         WHERE id != ?
           AND is_alive = 1
           AND in_inn_room = 0
         ORDER BY level DESC, display_name COLLATE NOCASE ASC
         LIMIT 50`
      )
      .all(excludePlayerId) as FieldsTargetRecord[];
  }

  listHallOfHonor(limit = 20): HallOfHonorRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, display_name, level, heroic_deeds_done
         FROM players
         ORDER BY heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC
         LIMIT ?`
      )
      .all(limit) as HallOfHonorRecord[];
  }

  listPlayerRankings(limit = 50): RankingRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, display_name, class, level, exp, heroic_deeds_done, current_lap, is_alive, last_login_at
         FROM players
         ORDER BY heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC
         LIMIT ?`
      )
      .all(limit) as RankingRecord[];
  }

  listHeroicDeedsRankings(limit = 50): RankingRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, display_name, class, level, exp, heroic_deeds_done, current_lap, is_alive, last_login_at
         FROM players
         ORDER BY heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC
         LIMIT ?`
      )
      .all(limit) as RankingRecord[];
  }

  listOldManTop(category: OldManCategory, limit = 10): OldManTopRecord[] {
    const db = getDb();
    const orderBy: Record<OldManCategory, string> = {
      kills: 'player_kills DESC, heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
      laid: 'times_laid DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
      dragons: 'heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
      bank: 'gold_in_bank DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
      strongest: 'score DESC, display_name COLLATE NOCASE ASC'
    };
    return db
      .prepare(
        `SELECT
          id,
          display_name,
          level,
          heroic_deeds_done,
          exp,
          player_kills,
          times_laid,
          gold_in_bank,
          ((heroic_deeds_done * 1000000) + (level * 10000) + exp) AS score
         FROM players
         ORDER BY ${orderBy[category]}
         LIMIT ?`
      )
      .all(limit) as OldManTopRecord[];
  }
}
