import { randomUUID } from 'node:crypto';
import { getDb } from '../db/db.js';

export type NewsType = 'LOGIN' | 'RESET' | 'SPIRITS_HIGH' | 'SPIRITS_LOW' | 'GENERIC';

export interface NewsRecord {
  id: string;
  date: string;
  created_at: string;
  type: NewsType;
  message: string;
  player_id: string | null;
}

interface AddNewsInput {
  date: string;
  type: NewsType;
  message: string;
  playerId?: string;
}

export class NewsService {
  addNews(input: AddNewsInput) {
    const db = getDb();
    db.prepare(
      `INSERT INTO daily_news (id, date, created_at, type, message, player_id)
      VALUES (@id, @date, @created_at, @type, @message, @player_id)`
    ).run({
      id: randomUUID(),
      date: input.date,
      created_at: new Date().toISOString(),
      type: input.type,
      message: input.message,
      player_id: input.playerId ?? null
    });
  }

  getNewsForDate(date: string, limit = 50): NewsRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT * FROM daily_news
         WHERE date = ? AND player_id IS NULL
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all([date, limit]) as NewsRecord[];
  }

  getNewsForPlayerAndDate(playerId: string, date: string, limit = 50): NewsRecord[] {
    const db = getDb();
    return db
      .prepare(
        `SELECT * FROM daily_news
         WHERE date = ? AND player_id = ?
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all([date, playerId, limit]) as NewsRecord[];
  }

  getMergedNews(playerId: string, date: string, limit = 50): NewsRecord[] {
    const merged = [
      ...this.getNewsForDate(date, limit),
      ...this.getNewsForPlayerAndDate(playerId, date, limit)
    ];

    return merged
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  }
}
