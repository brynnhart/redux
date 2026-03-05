import { getDb } from '../db/db.js';

export type EncounterType = 'NONE' | 'ENEMY' | 'EVENT';

export interface ForestStateRecord {
  player_id: string;
  encounter_type: EncounterType;
  encounter_key: string | null;
  encounter_payload: string | null;
  updated_at: string;
}

export interface ForestEncounterState {
  encounterType: EncounterType;
  encounterKey?: string;
  encounterPayload?: Record<string, unknown>;
}

export class ForestStateRepo {
  findByPlayerId(playerId: string): ForestEncounterState {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM forest_state WHERE player_id = ?')
      .get(playerId) as ForestStateRecord | undefined;

    if (!row || row.encounter_type === 'NONE') {
      return { encounterType: 'NONE' };
    }

    return {
      encounterType: row.encounter_type,
      encounterKey: row.encounter_key ?? undefined,
      encounterPayload: row.encounter_payload ? (JSON.parse(row.encounter_payload) as Record<string, unknown>) : undefined
    };
  }

  upsertEncounter(playerId: string, encounterType: Exclude<EncounterType, 'NONE'>, encounterKey: string, encounterPayload?: Record<string, unknown>) {
    const db = getDb();
    db.prepare(
      `INSERT INTO forest_state (player_id, encounter_type, encounter_key, encounter_payload, updated_at)
       VALUES (@player_id, @encounter_type, @encounter_key, @encounter_payload, @updated_at)
       ON CONFLICT(player_id)
       DO UPDATE SET
         encounter_type = excluded.encounter_type,
         encounter_key = excluded.encounter_key,
         encounter_payload = excluded.encounter_payload,
         updated_at = excluded.updated_at`
    ).run({
      player_id: playerId,
      encounter_type: encounterType,
      encounter_key: encounterKey,
      encounter_payload: encounterPayload ? JSON.stringify(encounterPayload) : null,
      updated_at: new Date().toISOString()
    });
  }

  clearEncounter(playerId: string) {
    const db = getDb();
    db.prepare(
      `INSERT INTO forest_state (player_id, encounter_type, encounter_key, encounter_payload, updated_at)
       VALUES (?, 'NONE', NULL, NULL, ?)
       ON CONFLICT(player_id)
       DO UPDATE SET
         encounter_type = 'NONE',
         encounter_key = NULL,
         encounter_payload = NULL,
         updated_at = excluded.updated_at`
    ).run([playerId, new Date().toISOString()]);
  }
}
