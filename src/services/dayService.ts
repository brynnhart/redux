import { config } from '../config.js';
import { PlayerRepo, type PlayerRecord } from '../repos/playerRepo.js';
import { NewsService } from './newsService.js';
import { getDailySkillUses } from './skillService.js';

export type Spirits = 'LOW' | 'NORMAL' | 'HIGH';

function getDateFormatter(tz: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function getTodayDateString(tz: string): string {
  return getDateFormatter(tz).format(new Date());
}

export class DayService {
  constructor(
    private readonly playerRepo = new PlayerRepo(),
    private readonly newsService = new NewsService(),
    private readonly rng: () => number = Math.random
  ) {}

  ensureDailyReset(playerId: string): { didReset: boolean; today: string } {
    const player = this.playerRepo.findById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const today = getTodayDateString(config.timezone);
    if (player.last_daily_reset_date === today) {
      return { didReset: false, today };
    }

    const spirits = this.rollSpirits();
    const turnsForestMax = this.getForestTurnsMax(spirits);
    const turnsPvpMax = 1;

    this.playerRepo.updatePlayerStats(player.id, {
      spirits,
      turns_forest_max: turnsForestMax,
      turns_forest_left: turnsForestMax,
      turns_pvp_max: turnsPvpMax,
      turns_pvp_left: turnsPvpMax,
      today_money_doubler_used: 0,
      today_bard_listens: 0,
      today_flirts: 0,
      has_room: 0,
      daily_flirt_used: 0,
      daily_bard_used: 0,
      daily_room_rented: 0,
      inn_bribe_count_today: 0,
      inn_breakin_used_today: 0,
      has_flirted_today: 0,
      has_listened_bard_today: 0,
      bonus_forest_fights: 0,
      room_expires_at: null,
      elixirs: player.elixirs,
      daily_skill_training_used: 0,
      skill_uses_death: getDailySkillUses(player.skill_level_death, player.skill_mastery_death === 1),
      skill_uses_mystic: getDailySkillUses(player.skill_level_mystic, player.skill_mastery_mystic === 1),
      skill_uses_thief: getDailySkillUses(player.skill_level_thief, player.skill_mastery_thief === 1),
      last_daily_reset_date: today
    });

    this.newsService.addNews({
      date: today,
      type: 'RESET',
      message: 'A new day dawns in the Realm...'
    });

    this.newsService.addNews({
      date: today,
      type: spirits === 'HIGH' ? 'SPIRITS_HIGH' : spirits === 'LOW' ? 'SPIRITS_LOW' : 'GENERIC',
      message: `${player.display_name} wakes up in ${spirits} spirits.`,
      playerId: player.id
    });

    return { didReset: true, today };
  }

  private rollSpirits(): Spirits {
    const roll = this.rng();
    if (roll < config.spiritsChances.high) {
      return 'HIGH';
    }
    if (roll < config.spiritsChances.high + config.spiritsChances.low) {
      return 'LOW';
    }
    return 'NORMAL';
  }

  private getForestTurnsMax(spirits: PlayerRecord['spirits']) {
    let turns = config.forestTurnsBase;
    if (spirits === 'HIGH') {
      turns += 5;
    }
    if (spirits === 'LOW') {
      turns -= 5;
    }
    return Math.max(config.forestTurnsMin, turns);
  }
}
