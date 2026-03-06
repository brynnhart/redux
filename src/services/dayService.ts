import { config } from '../config.js';
import { getDayIndexFromDayKey, getTodayDayKey } from './dayKey.js';
import { getDb } from '../db/db.js';
import { PlayerRepo } from '../repos/playerRepo.js';
import { NewsService, type PendingEventRecord } from './newsService.js';
import { getDailySkillUses } from './skillService.js';

function isDayKeyBefore(left: string | null, right: string): boolean {
  if (!left) {
    return true;
  }
  return left < right;
}

export class DayService {
  constructor(
    private readonly playerRepo = new PlayerRepo(),
    private readonly newsService = new NewsService(),
    private readonly rng: () => number = Math.random
  ) {}

  ensureDailyReset(playerId: string): { didReset: boolean; todayDayKey: string; spirits?: 'LOW' | 'NORMAL' | 'HIGH' } {
    const player = this.playerRepo.findById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const todayDayKey = getTodayDayKey();
    if (player.last_day_seen === todayDayKey) {
      return { didReset: false, todayDayKey };
    }

    const spirits = this.rolloverPlayerToNewDay(playerId, todayDayKey);
    return { didReset: true, todayDayKey, spirits };
  }

  private rolloverPlayerToNewDay(playerId: string, todayDayKey: string): 'LOW' | 'NORMAL' | 'HIGH' {
    const db = getDb();
    const player = this.playerRepo.findById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const spirits = this.rollSpirits();
    const forestMax = config.forestFightsPerDay;
    const bankBeforeInterest = player.gold_in_bank;
    const rawInterest = Math.floor(bankBeforeInterest * config.bankInterestRate);
    const interest = config.bankInterestCap === null ? rawInterest : Math.min(rawInterest, config.bankInterestCap);
    const bankAfterInterest = this.safeAdd(bankBeforeInterest, interest).value;

    const pendingEvents = this.newsService.consumePendingEventsForPlayer(playerId);
    const shouldExpireRoom = config.roomExpiresDaily || isDayKeyBefore(player.inn_room_expires_day_key, todayDayKey);
    const pendingEventNews = this.mapPendingEventsToNews(pendingEvents);

    db.exec('BEGIN');
    try {
      this.playerRepo.updatePlayerStats(player.id, {
        last_day_seen: todayDayKey,
        spirits,
        turns_forest_max: forestMax,
        turns_forest_left: forestMax + (spirits === 'HIGH' ? 1 : 0),
        turns_pvp_max: config.pvpAttacksPerDay,
        turns_pvp_left: config.pvpAttacksPerDay,
        flirt_used_today: 0,
        bard_listens_used_today: 0,
        money_doubler_used_today: 0,
        training_challenge_used_today: 0,
        skill_uses_death: getDailySkillUses(player.skill_level_death, player.skill_mastery_death === 1),
        skill_uses_mystic: getDailySkillUses(player.skill_level_mystic, player.skill_mastery_mystic === 1),
        skill_uses_thief: getDailySkillUses(player.skill_level_thief, player.skill_mastery_thief === 1),
        in_inn_room: shouldExpireRoom ? 0 : player.in_inn_room,
        inn_room_expires_day_key: shouldExpireRoom ? null : player.inn_room_expires_day_key,
        is_alive: 1,
        hp: player.hp_max,
        killed_by_player_id: null,
        gold_in_bank: bankAfterInterest,
        inn_bribe_count_today: 0,
        inn_breakin_used_today: 0,
        dragon_fought_today: 0,
        olivia_used_today: 0
      });

      this.newsService.addNews(todayDayKey, 'A new day dawns in the realm...', { severity: 'system' });
      this.newsService.addNews(todayDayKey, 'You wake up early, strap your weapon to your back, and head for the Town Square...', {
        severity: 'highlight',
        playerId: player.id
      });
      this.newsService.addNews(todayDayKey, `You are in ${spirits} spirits today.`, {
        severity: 'highlight',
        playerId: player.id
      });
      if (!player.is_alive) {
        this.newsService.addNews(todayDayKey, 'You wake up sore, but alive.', { severity: 'highlight', playerId: player.id });
      }

      if (interest > 0) {
        this.newsService.addNews(todayDayKey, `The bank paid you ${interest} gold in interest.`, {
          severity: 'info',
          playerId: player.id
        });
        this.newsService.addDailyNews({ day: getDayIndexFromDayKey(todayDayKey), type: 'BANK_INTEREST', actorId: player.id, message: `The bank paid ${player.display_name} ${interest} gold in interest.`, payload: { interest } });
        db.prepare('INSERT INTO bank_transactions (player_id, day_key, type, amount, created_at) VALUES (?, ?, ?, ?, ?)').run([player.id, todayDayKey, 'interest', interest, new Date().toISOString()]);
      }

      for (const event of pendingEventNews) {
        this.newsService.addNews(todayDayKey, event.message, {
          severity: event.severity,
          playerId: event.playerId ?? undefined
        });
      }
      db.exec('COMMIT');
      return spirits;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  private mapPendingEventsToNews(events: PendingEventRecord[]) {
    return events.map((event) => {
      const payload = this.parsePayload(event.payload_json);
      if (event.type === 'pvp_killed') {
        const killerName = payload.killerName ?? 'Someone';
        const victimName = payload.victimName ?? 'someone';
        return { message: `${killerName} has killed ${victimName}.`, severity: 'pvp' as const, playerId: null };
      }
      if (event.type === 'pvp_attacked_fled') {
        const attackerName = payload.attackerName ?? 'An enemy';
        return {
          message: `${attackerName} attacked you in the night, but you escaped.`,
          severity: 'pvp' as const,
          playerId: event.target_player_id
        };
      }

      const victimName = payload.victimName ?? 'an adventurer';
      return { message: `The Red Dragon has killed ${victimName}!`, severity: 'dragon' as const, playerId: null };
    });
  }

  private parsePayload(payloadJson: string): Record<string, string> {
    try {
      const parsed = JSON.parse(payloadJson);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    } catch {
      return {};
    }
    return {};
  }

  private safeAdd(left: number, right: number) {
    const BIGINT_MAX = 9_223_372_036_854_775_807;
    const total = left + right;
    if (total > BIGINT_MAX) {
      return { value: BIGINT_MAX, clamped: true };
    }
    return { value: total, clamped: false };
  }

  private rollSpirits(): 'LOW' | 'NORMAL' | 'HIGH' {
    const roll = this.rng();
    if (roll < config.spiritsChances.high) {
      return 'HIGH';
    }
    if (roll < config.spiritsChances.high + config.spiritsChances.low) {
      return 'LOW';
    }
    return 'NORMAL';
  }
}
