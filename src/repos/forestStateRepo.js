import { getDb } from '../db/db.js';
export class ForestStateRepo {
    findByPlayerId(playerId) {
        const db = getDb();
        const row = db
            .prepare('SELECT * FROM forest_state WHERE player_id = ?')
            .get(playerId);
        if (!row || row.encounter_type === 'NONE') {
            return { encounterType: 'NONE' };
        }
        return {
            encounterType: row.encounter_type,
            encounterKey: row.encounter_key ?? undefined,
            encounterPayload: row.encounter_payload ? JSON.parse(row.encounter_payload) : undefined
        };
    }
    upsertEncounter(playerId, encounterType, encounterKey, encounterPayload) {
        const db = getDb();
        db.prepare(`INSERT INTO forest_state (player_id, encounter_type, encounter_key, encounter_payload, updated_at)
       VALUES (@player_id, @encounter_type, @encounter_key, @encounter_payload, @updated_at)
       ON CONFLICT(player_id)
       DO UPDATE SET
         encounter_type = excluded.encounter_type,
         encounter_key = excluded.encounter_key,
         encounter_payload = excluded.encounter_payload,
         updated_at = excluded.updated_at`).run({
            player_id: playerId,
            encounter_type: encounterType,
            encounter_key: encounterKey,
            encounter_payload: encounterPayload ? JSON.stringify(encounterPayload) : null,
            updated_at: new Date().toISOString()
        });
    }
    clearEncounter(playerId) {
        const db = getDb();
        db.prepare(`INSERT INTO forest_state (player_id, encounter_type, encounter_key, encounter_payload, updated_at)
       VALUES (?, 'NONE', NULL, NULL, ?)
       ON CONFLICT(player_id)
       DO UPDATE SET
         encounter_type = 'NONE',
         encounter_key = NULL,
         encounter_payload = NULL,
         updated_at = excluded.updated_at`).run([playerId, new Date().toISOString()]);
    }
}
