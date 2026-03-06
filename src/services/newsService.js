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
        const message = pickOne([
            `${context.killerName} sent ${context.victimName} to the graveyard before moonrise.`,
            `${context.killerName} carved through ${context.victimName} and left only silence behind.`,
            `${context.victimName} crossed ${context.killerName} and paid in blood.`,
            `${context.killerName} cut down ${context.victimName} in the ${context.mode === 'INN' ? 'Inn corridors' : 'fields'}.`
        ]);
        this.addDailyNews({
            day: getDayIndexFromDayKey(context.dayKey),
            type: 'PVP_KILL',
            actorId: killerId,
            targetId: victimId,
            message,
            payload: context
        });
    }
    selfDefenseKill(attackerId, defenderId, context) {
        const message = pickOne([
            `${context.attackerName} lunged at ${context.defenderName} and was slain in self-defense.`,
            `${context.defenderName} turned ${context.attackerName}'s ambush into a funeral.`,
            `${context.attackerName} chose the wrong target; ${context.defenderName} answered with steel.`,
            `${context.attackerName} broke against ${context.defenderName} and did not rise again.`
        ]);
        this.addDailyNews({
            day: getDayIndexFromDayKey(context.dayKey),
            type: 'PVP_DEFEND',
            actorId: attackerId,
            targetId: defenderId,
            message,
            payload: context
        });
    }
    dragonKill(playerId, context) {
        const message = pickOne([
            `${context.playerName} has slain the Red Dragon and set the skies trembling.`,
            `${context.playerName} stood before the Red Dragon and walked away victorious.`,
            `The Red Dragon fell today beneath ${context.playerName}'s blade.`,
            `${context.playerName} ended the Red Dragon's reign in fire and blood.`
        ]);
        this.addDailyNews({
            day: getDayIndexFromDayKey(context.dayKey),
            type: 'DRAGON_KILL',
            actorId: playerId,
            message,
            payload: context
        });
    }
    masterBeaten(playerId, dayKey, masterName, newLevel, playerName) {
        const message = pickOne([
            `${playerName} defeated ${masterName} and claimed the next rank.`,
            `${masterName} was forced to bow as ${playerName} took victory.`,
            `${playerName} broke ${masterName}'s defense and rose to level ${newLevel}.`,
            `${playerName} humbled ${masterName} in the training ring.`
        ]);
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'MASTER_BEATEN',
            actorId: playerId,
            message,
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
        const message = pickOne([
            `${playerName} and ${npcName} left the Inn to cheers and bad advice.`,
            `${playerName} pledged heart and trouble to ${npcName}.`,
            `${playerName} married ${npcName}; wagers are now being taken on how long it lasts.`
        ]);
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'MARRIAGE',
            actorId: playerId,
            message,
            payload: { npcName }
        });
    }
    divorce(playerId, dayKey, npcName, playerName) {
        const message = pickOne([
            `${playerName} and ${npcName} called it quits before the ale went warm.`,
            `${playerName} left ${npcName}; the Inn bookie paid out heavily.`,
            `${playerName} and ${npcName} split, loudly, and in public.`
        ]);
        this.addDailyNews({
            day: getDayIndexFromDayKey(dayKey),
            type: 'DIVORCE',
            actorId: playerId,
            message,
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
function pickOne(options) {
    return options[Math.floor(Math.random() * options.length)] ?? options[0] ?? '';
}
