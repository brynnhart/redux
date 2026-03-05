import { config } from '../config.js';
import { PlayerRepo, type PlayerRecord } from '../repos/playerRepo.js';
import { NewsService } from './newsService.js';

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
