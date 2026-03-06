import { getDb } from '../db/db.js';
import { getDayIndexFromDayKey } from './dayKey.js';

export type NewsSeverity = 'info' | 'highlight' | 'pvp' | 'dragon' | 'system';
export type PendingEventType = 'pvp_killed' | 'pvp_attacked_fled' | 'dragon_killed';

export interface NewsRecord {
  id: number;
  day: number;
  day_key: string;
  created_at: string;
  message: string;
  type: string;
  actor_player_id: string | null;
  target_player_id: string | null;
  payload_json: string | null;
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

interface AddDailyNewsInput {
  day: number;
  type: string;
  actorId?: string;
  targetId?: string;
  message: string;
  payload?: Record<string, unknown>;
}

export class NewsService {
  addDailyNews(input: AddDailyNewsInput) {
    const db = getDb();
    const safeMessage = sanitizeNewsMessage(input.message);
    db.prepare(
      `INSERT INTO daily_news (day, day_key, date, created_at, type, actor_player_id, target_player_id, player_id, payload_json, message)
       VALUES (@day, @day_key, @date, @created_at, @type, @actor_player_id, @target_player_id, @player_id, @payload_json, @message)`
    ).run({
      day: input.day,
      day_key: dayIndexToDayKey(input.day),
      created_at: new Date().toISOString(),
      date: dayIndexToDayKey(input.day),
      type: input.type,
      actor_player_id: input.actorId ?? null,
      target_player_id: input.targetId ?? null,
      player_id: input.actorId ?? null,
      payload_json: input.payload ? JSON.stringify(input.payload) : null,
      message: safeMessage
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

  getDailyNews(day: number, limit = 30, offset = 0): NewsRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT id, day, day_key, created_at, type, actor_player_id, target_player_id, payload_json, message
         FROM daily_news
         WHERE day = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all([day, limit, Math.max(0, offset)]) as NewsRecord[];
  }

  getDailyNewsForPlayer(_playerId: string, dayKey: string, limit = 30, offset = 0): NewsRecord[] {
    return this.getDailyNews(getDayIndexFromDayKey(dayKey), limit, offset);
  }

  hasMoreDailyNews(day: number, offset: number, limit: number): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT 1 FROM daily_news WHERE day = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?')
      .get([day, Math.max(0, offset + limit)]) as { 1: number } | undefined;
    return Boolean(row);
  }

  pvpKill(killerId: string, victimId: string, context: { dayKey: string; killerName: string; victimName: string }) {
    this.addDailyNews({
      day: getDayIndexFromDayKey(context.dayKey),
      type: 'PVP_KILL',
      actorId: killerId,
      targetId: victimId,
      message: `${context.killerName} has killed ${context.victimName}.`,
      payload: context
    });
  }

  dragonKill(playerId: string, context: { dayKey: string; playerName: string }) {
    this.addDailyNews({
      day: getDayIndexFromDayKey(context.dayKey),
      type: 'DRAGON_KILL',
      actorId: playerId,
      message: `${context.playerName} has defeated the Red Dragon.`,
      payload: context
    });
  }

  masterBeaten(playerId: string, dayKey: string, masterName: string, newLevel: number, playerName: string) {
    this.addDailyNews({
      day: getDayIndexFromDayKey(dayKey),
      type: 'MASTER_BEATEN',
      actorId: playerId,
      message: `${playerName} has beaten ${masterName}.`,
      payload: { masterName, newLevel }
    });
  }

  moneyDoubler(playerId: string, dayKey: string, beforeGold: number, afterGold: number) {
    this.addDailyNews({
      day: getDayIndexFromDayKey(dayKey),
      type: 'MONEY_DOUBLER',
      actorId: playerId,
      message: 'Somewhere magic has happened!',
      payload: { beforeGold, afterGold }
    });
  }

  marriage(playerId: string, dayKey: string, npcName: string, playerName: string) {
    this.addDailyNews({
      day: getDayIndexFromDayKey(dayKey),
      type: 'MARRIAGE',
      actorId: playerId,
      message: `${playerName} married ${npcName}.`,
      payload: { npcName }
    });
  }

  divorce(playerId: string, dayKey: string, npcName: string, playerName: string) {
    this.addDailyNews({
      day: getDayIndexFromDayKey(dayKey),
      type: 'DIVORCE',
      actorId: playerId,
      message: `${playerName} left ${npcName}.`,
      payload: { npcName }
    });
  }

  rareEvent(playerId: string, dayKey: string, title: string, playerName: string) {
    this.addDailyNews({
      day: getDayIndexFromDayKey(dayKey),
      type: 'RARE_EVENT',
      actorId: playerId,
      message: `${playerName}: ${title}`,
      payload: { title }
    });
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

function sanitizeNewsMessage(message: string): string {
  const noControlChars = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u001b]/g, '');
  return noControlChars.slice(0, 200);
}

function dayIndexToDayKey(day: number): string {
  const date = new Date(day * 86400000);
  return date.toISOString().slice(0, 10);
}
