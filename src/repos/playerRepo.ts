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
  gold_on_hand: number;
  gold_in_bank: number;
  gold_pocket: number;
  gold_bank: number;
  gems: number;
  charm: number;
  last_daily_reset_date: string | null;
  last_day_key: string | null;
  forest_fights_used_today: number;
  forest_fights_max_today: number;
  player_fight_used_today: number;
  inn_flirt_used_today: number;
  flirt_used_today: number;
  bard_listens_used_today: number;
  seth_listens_used_today: number;
  in_room: number;
  room_paid_until_day_key: string | null;
  inn_room_day_key: string | null;
  inn_room_expires_day_key: string | null;
  is_dead: number;
  is_alive: number;
  last_killed_at: string | null;
  in_inn_room: number;
  inn_room_expires_at: string | null;
  pvp_used_today: number;
  killed_by_player_id: string | null;
  player_kills: number;
  spirits: Spirits;
  turns_forest_max: number;
  turns_forest_left: number;
  turns_pvp_max: number;
  turns_pvp_left: number;
  today_money_doubler_used: number;
  money_doubler_used_today: number;
  today_bard_listens: number;
  today_flirts: number;
  has_room: number;
  daily_flirt_used: number;
  daily_bard_used: number;
  daily_room_rented: number;
  inn_bribe_count_today: number;
  elixirs: number;
  room_expires_at: string | null;
  inn_breakin_used_today: number;
  has_flirted_today: number;
  has_listened_bard_today: number;
  bonus_forest_fights: number;
  extra_forest_fights_today: number;
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
  daily_skill_training_used: number;
  training_challenge_used_today: number;
  heroic_deeds: number;
  heroic_deeds_done: number;
  dragon_kills_total: number;
  current_lap: number;
  has_fairy: number;
  dragon_fought_today: number;
  mastery_title: string | null;
}

export interface HallOfHonorRecord {
  id: string;
  display_name: string;
  level: number;
  heroic_deeds_done: number;
}

export interface InnTargetRecord {
  id: string;
  display_name: string;
  level: number;
  has_room: number;
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
  | 'gold'
  | 'bank_gold'
  | 'gold_on_hand'
  | 'gold_in_bank'
  | 'gold_pocket'
  | 'gold_bank'
  | 'gems'
  | 'charm'
  | 'last_daily_reset_date'
  | 'last_day_key'
  | 'forest_fights_used_today'
  | 'forest_fights_max_today'
  | 'player_fight_used_today'
  | 'inn_flirt_used_today'
  | 'flirt_used_today'
  | 'bard_listens_used_today'
  | 'seth_listens_used_today'
  | 'in_room'
  | 'room_paid_until_day_key'
  | 'inn_room_day_key'
  | 'inn_room_expires_day_key'
  | 'is_dead'
  | 'is_alive'
  | 'last_killed_at'
  | 'in_inn_room'
  | 'inn_room_expires_at'
  | 'pvp_used_today'
  | 'killed_by_player_id'
  | 'player_kills'
  | 'spirits'
  | 'turns_forest_max'
  | 'turns_forest_left'
  | 'turns_pvp_max'
  | 'turns_pvp_left'
  | 'today_money_doubler_used'
  | 'money_doubler_used_today'
  | 'today_bard_listens'
  | 'today_flirts'
  | 'has_room'
  | 'daily_flirt_used'
  | 'daily_bard_used'
  | 'daily_room_rented'
  | 'inn_bribe_count_today'
  | 'elixirs'
  | 'room_expires_at'
  | 'inn_breakin_used_today'
  | 'has_flirted_today'
  | 'has_listened_bard_today'
  | 'bonus_forest_fights'
  | 'extra_forest_fights_today'
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
  | 'daily_skill_training_used'
  | 'training_challenge_used_today'
  | 'heroic_deeds'
  | 'heroic_deeds_done'
  | 'dragon_kills_total'
  | 'current_lap'
  | 'has_fairy'
  | 'dragon_fought_today'
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
    const syncedPatch: Partial<MutablePlayerStats> = { ...patch };

    if (patch.gold !== undefined) {
      if (patch.gold_pocket === undefined) syncedPatch.gold_pocket = patch.gold;
      if (patch.gold_on_hand === undefined) syncedPatch.gold_on_hand = patch.gold;
    }
    if (patch.gold_pocket !== undefined) {
      if (patch.gold === undefined) syncedPatch.gold = patch.gold_pocket;
      if (patch.gold_on_hand === undefined) syncedPatch.gold_on_hand = patch.gold_pocket;
    }
    if (patch.gold_on_hand !== undefined) {
      if (patch.gold === undefined) syncedPatch.gold = patch.gold_on_hand;
      if (patch.gold_pocket === undefined) syncedPatch.gold_pocket = patch.gold_on_hand;
    }
    if (patch.bank_gold !== undefined) {
      if (patch.gold_bank === undefined) syncedPatch.gold_bank = patch.bank_gold;
      if (patch.gold_in_bank === undefined) syncedPatch.gold_in_bank = patch.bank_gold;
    }
    if (patch.gold_bank !== undefined) {
      if (patch.bank_gold === undefined) syncedPatch.bank_gold = patch.gold_bank;
      if (patch.gold_in_bank === undefined) syncedPatch.gold_in_bank = patch.gold_bank;
    }
    if (patch.gold_in_bank !== undefined) {
      if (patch.bank_gold === undefined) syncedPatch.bank_gold = patch.gold_in_bank;
      if (patch.gold_bank === undefined) syncedPatch.gold_bank = patch.gold_in_bank;
    }
    if (patch.today_money_doubler_used !== undefined && patch.money_doubler_used_today === undefined) {
      syncedPatch.money_doubler_used_today = patch.today_money_doubler_used;
    }
    if (patch.money_doubler_used_today !== undefined && patch.today_money_doubler_used === undefined) {
      syncedPatch.today_money_doubler_used = patch.money_doubler_used_today;
    }

    const entries = Object.entries(syncedPatch);
    if (entries.length === 0) {
      return;
    }

    const setSql = entries.map(([key]) => `${key} = @${key}`).join(', ');
    const db = getDb();
    db.prepare(`UPDATE players SET ${setSql} WHERE id = @id`).run({ id, ...syncedPatch });
  }

  listInnTargets(excludePlayerId: string): InnTargetRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, display_name, level, has_room, is_alive, in_inn_room, weapon_tier, weapon_id
         FROM players
         WHERE id != ?
           AND has_room = 1
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
}
