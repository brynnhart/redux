import { getDb } from '../db/db.js';
import { getDayIndexFromDayKey } from './dayKey.js';
export class NewsService {
    addDailyNews(input) {
        const db = getDb();
        const safeMessage = sanitizeNewsMessage(input.message);
        db.prepare(`INSERT INTO daily_news (day, day_key, date, created_at, type, actor_player_id, target_player_id, player_id, payload_json, message)
       VALUES (@day, @day_key, @date, @created_at, @type, @actor_player_id, @target_player_id, @player_id, @payload_json, @message)`).run({
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
    addNews(dayKey, message, options = {}) {
        const db = getDb();
        db.prepare(`INSERT INTO news_events (day_key, created_at, message, severity, player_id)
       VALUES (@day_key, @created_at, @message, @severity, @player_id)`).run({
            day_key: dayKey,
            created_at: new Date().toISOString(),
            message,
            severity: options.severity ?? 'info',
            player_id: options.playerId ?? null
        });
    }
    getDailyNews(day, limit = 30, offset = 0) {
        const db = getDb();
        return db
            .prepare(`SELECT id, day, day_key, created_at, type, actor_player_id, target_player_id, payload_json, message
         FROM daily_news
         WHERE day = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`)
            .all([day, limit, Math.max(0, offset)]);
    }
    getDailyNewsForPlayer(_playerId, dayKey, limit = 30, offset = 0) {
        return this.getDailyNews(getDayIndexFromDayKey(dayKey), limit, offset);
    }
    hasMoreDailyNews(day, offset, limit) {
        const db = getDb();
        const row = db
            .prepare('SELECT 1 FROM daily_news WHERE day = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?')
            .get([day, Math.max(0, offset + limit)]);
        return Boolean(row);
    }
    pvpKill(killerId, victimId, context) {
        this.addDailyNews({
            day: getDayIndexFromDayKey(context.dayKey),
            type: 'PVP_KILL',
            actorId: killerId,
            targetId: victimId,
            message: `${context.killerName} has killed ${context.victimName}.`,
            payload: context
        });
    }
    dragonKill(playerId, context) {
        this.addDailyNews({
            day: getDayIndexFromDayKey(context.dayKey),
            type: 'DRAGON_KILL',
            actorId: playerId,
            message: `${context.playerName} has defeated the Red Dragon.`,
            payload: context
        });
    }
    masterBeaten(playerId, dayKey, masterName, newLevel, playerName) {
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'MASTER_BEATEN',
            actorId: playerId,
            message: `${playerName} has beaten ${masterName}.`,
            payload: { masterName, newLevel }
        });
    }
    moneyDoubler(playerId, dayKey, beforeGold, afterGold) {
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'MONEY_DOUBLER',
            actorId: playerId,
            message: 'Somewhere magic has happened!',
            payload: { beforeGold, afterGold }
        });
    }
    marriage(playerId, dayKey, npcName, playerName) {
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'MARRIAGE',
            actorId: playerId,
            message: `${playerName} married ${npcName}.`,
            payload: { npcName }
        });
    }
    divorce(playerId, dayKey, npcName, playerName) {
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'DIVORCE',
            actorId: playerId,
            message: `${playerName} left ${npcName}.`,
            payload: { npcName }
        });
    }
    rareEvent(playerId, dayKey, title, playerName) {
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'RARE_EVENT',
            actorId: playerId,
            message: `${playerName}: ${title}`,
            payload: { title }
        });
    }
    addPendingEvent(input) {
        const db = getDb();
        db.prepare(`INSERT INTO pending_events (target_player_id, type, payload_json, created_at)
       VALUES (@target_player_id, @type, @payload_json, @created_at)`).run({
            target_player_id: input.targetPlayerId,
            type: input.type,
            payload_json: JSON.stringify(input.payload),
            created_at: new Date().toISOString()
        });
    }
    consumePendingEventsForPlayer(playerId) {
        const db = getDb();
        const events = db
            .prepare(`SELECT * FROM pending_events
         WHERE target_player_id = ?
         ORDER BY created_at ASC`)
            .all(playerId);
        if (events.length > 0) {
            db.prepare('DELETE FROM pending_events WHERE target_player_id = ?').run(playerId);
        }
        return events;
    }
}
function sanitizeNewsMessage(message) {
    const noControlChars = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u001b]/g, '');
    return noControlChars.slice(0, 200);
}
function dayIndexToDayKey(day) {
    const date = new Date(day * 86400000);
    return date.toISOString().slice(0, 10);
}
