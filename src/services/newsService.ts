import { getDb } from '../db/db.js';

export type NewsSeverity = 'info' | 'highlight' | 'pvp' | 'dragon' | 'system';
export type PendingEventType = 'pvp_killed' | 'pvp_attacked_fled' | 'dragon_killed';

export interface NewsRecord {
  id: number;
  day_key: string;
  created_at: string;
  message: string;
  severity: NewsSeverity;
  player_id: string | null;
}

export interface PendingEventRecord {
  id: number;
  target_player_id: string;
  type: PendingEventType;
  payload_json: string;
  created_at: string;
}

interface AddNewsOptions {
  severity?: NewsSeverity;
  playerId?: string;
}

interface AddPendingEventInput {
  targetPlayerId: string;
  type: PendingEventType;
  payload: Record<string, string>;
}

export class NewsService {
  addDailyNews(dayKey: string, message: string, type: string) {
    const db = getDb();
    db.prepare(
      `INSERT INTO daily_news (day_key, created_at, message, type)
       VALUES (@day_key, @created_at, @message, @type)`
    ).run({
      day_key: dayKey,
      created_at: new Date().toISOString(),
      message,
      type
    });
  }

  addNews(dayKey: string, message: string, options: AddNewsOptions = {}) {
    const db = getDb();
    db.prepare(
      `INSERT INTO news_events (day_key, created_at, message, severity, player_id)
       VALUES (@day_key, @created_at, @message, @severity, @player_id)`
    ).run({
      day_key: dayKey,
      created_at: new Date().toISOString(),
      message,
      severity: options.severity ?? 'info',
      player_id: options.playerId ?? null
    });
  }

  getDailyNewsForPlayer(playerId: string, dayKey: string, limit = 100): NewsRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT * FROM news_events
         WHERE day_key = ?
           AND (player_id IS NULL OR player_id = ?)
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all([dayKey, playerId, limit]) as NewsRecord[];
  }

  addPendingEvent(input: AddPendingEventInput) {
    const db = getDb();
    db.prepare(
      `INSERT INTO pending_events (target_player_id, type, payload_json, created_at)
       VALUES (@target_player_id, @type, @payload_json, @created_at)`
    ).run({
      target_player_id: input.targetPlayerId,
      type: input.type,
      payload_json: JSON.stringify(input.payload),
      created_at: new Date().toISOString()
    });
  }

  consumePendingEventsForPlayer(playerId: string): PendingEventRecord[] {
    const db = getDb();
    const events = db
      .prepare(
        `SELECT * FROM pending_events
         WHERE target_player_id = ?
         ORDER BY created_at ASC`
      )
      .all(playerId) as PendingEventRecord[];

    if (events.length > 0) {
      db.prepare('DELETE FROM pending_events WHERE target_player_id = ?').run(playerId);
    }

    return events;
  }
}
