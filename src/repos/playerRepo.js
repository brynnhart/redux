import { getDb } from '../db/db.js';
export class PlayerRepo {
    createPlayer(data) {
        const now = new Date().toISOString();
        const db = getDb();
        db.prepare(`INSERT INTO players (
        id, username, pass_hash, created_at, last_login_at, display_name, sex, class
      ) VALUES (
        @id, @username, @pass_hash, @created_at, @last_login_at, @display_name, @sex, @class
      )`).run({
            id: data.id,
            username: data.username,
            pass_hash: data.pass_hash,
            created_at: now,
            last_login_at: now,
            display_name: data.display_name,
            sex: data.sex,
            class: data.class
        });
        return this.findById(data.id);
    }
    findByUsername(username) {
        const db = getDb();
        const player = db
            .prepare('SELECT * FROM players WHERE username = ? COLLATE NOCASE')
            .get(username);
        return player ?? null;
    }
    findById(id) {
        const db = getDb();
        const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
        return player ?? null;
    }
    updateLastLogin(id) {
        const db = getDb();
        db.prepare('UPDATE players SET last_login_at = ? WHERE id = ?').run([new Date().toISOString(), id]);
    }
    updatePlayerStats(id, patch) {
        const entries = Object.entries(patch);
        if (entries.length === 0) {
            return;
        }
        const setSql = entries.map(([key]) => `${key} = @${key}`).join(', ');
        const db = getDb();
        db.prepare(`UPDATE players SET ${setSql} WHERE id = @id`).run({ id, ...patch });
    }
    listInnTargets(excludePlayerId) {
        const db = getDb();
        return db
            .prepare(`SELECT id, display_name, level, is_alive, in_inn_room, weapon_tier, weapon_id
         FROM players
         WHERE id != ?
           AND is_alive = 1
           AND in_inn_room = 1
         ORDER BY level DESC, display_name COLLATE NOCASE ASC
         LIMIT 50`)
            .all(excludePlayerId);
    }
    listFieldsTargets(excludePlayerId) {
        const db = getDb();
        return db
            .prepare(`SELECT id, display_name, level, is_alive, in_inn_room, weapon_id
         FROM players
         WHERE id != ?
           AND is_alive = 1
           AND in_inn_room = 0
         ORDER BY level DESC, display_name COLLATE NOCASE ASC
         LIMIT 50`)
            .all(excludePlayerId);
    }
    listHallOfHonor(limit = 20) {
        const db = getDb();
        return db
            .prepare(`SELECT id, display_name, level, heroic_deeds_done
         FROM players
         ORDER BY heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC
         LIMIT ?`)
            .all(limit);
    }
    listPlayerRankings(limit = 50) {
        const db = getDb();
        return db
            .prepare(`SELECT id, display_name, class, level, exp, heroic_deeds_done, current_lap, is_alive, last_login_at,
          skill_mastery_death, skill_mastery_mystic, skill_mastery_thief
         FROM players
         ORDER BY heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC
         LIMIT ?`)
            .all(limit);
    }
    listHeroicDeedsRankings(limit = 50) {
        const db = getDb();
        return db
            .prepare(`SELECT id, display_name, class, level, exp, heroic_deeds_done, current_lap, is_alive, last_login_at
         FROM players
         ORDER BY heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC
         LIMIT ?`)
            .all(limit);
    }
    listOldManTop(category, limit = 10) {
        const db = getDb();
        const orderBy = {
            kills: 'player_kills DESC, heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
            laid: 'times_laid DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
            dragons: 'heroic_deeds_done DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
            bank: 'gold_in_bank DESC, level DESC, exp DESC, display_name COLLATE NOCASE ASC',
            strongest: 'score DESC, display_name COLLATE NOCASE ASC'
        };
        return db
            .prepare(`SELECT
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
         LIMIT ?`)
            .all(limit);
    }
}
