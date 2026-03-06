import { config } from '../config.js';
import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';

export interface HealResult {
  healed: number;
  cost: number;
  message: string;
}

export class HealerService {
  constructor(private readonly playerRepo: PlayerRepo) {}

  private getGoldOnHand(player: PlayerRecord) {
    return player.gold_on_hand ?? player.gold_pocket ?? player.gold;
  }

  private getMissingHp(player: PlayerRecord) {
    return Math.max(0, player.hp_max - player.hp);
  }

  private getCostPerHp() {
    return Math.max(1, config.healerCostPerHp);
  }

  private getMaxAffordable(player: PlayerRecord) {
    return Math.floor(this.getGoldOnHand(player) / this.getCostPerHp());
  }

  getHealAllPossible(player: PlayerRecord) {
    const missing = this.getMissingHp(player);
    const maxAffordable = this.getMaxAffordable(player);
    return Math.min(missing, maxAffordable);
  }

  heal(player: PlayerRecord, requestedHp: number): HealResult {
    const missing = this.getMissingHp(player);
    if (missing <= 0) {
      return { healed: 0, cost: 0, message: 'You are already at full health.' };
    }

    const minPurchase = Math.max(1, config.healerMinPurchase);
    if (requestedHp < minPurchase) {
      return { healed: 0, cost: 0, message: `You must heal at least ${minPurchase} HP.` };
    }

    const maxAffordable = this.getMaxAffordable(player);
    const cap = config.healerAllowOverheal ? Number.POSITIVE_INFINITY : missing;
    const healed = Math.max(0, Math.min(requestedHp, cap, maxAffordable));

    if (healed <= 0) {
      return { healed: 0, cost: 0, message: 'You can’t afford healing.' };
    }

    const totalCost = healed * this.getCostPerHp();
    this.playerRepo.updatePlayerStats(player.id, {
      hp: Math.min(player.hp_max, player.hp + healed),
      gold_on_hand: this.getGoldOnHand(player) - totalCost
    });

    return { healed, cost: totalCost, message: `You recovered ${healed} HP for ${totalCost} gold.` };
  }

  healAllPossible(player: PlayerRecord): HealResult {
    const healAmount = this.getHealAllPossible(player);
    if (healAmount <= 0) {
      const missing = this.getMissingHp(player);
      return {
        healed: 0,
        cost: 0,
        message: missing <= 0 ? 'You are already at full health.' : 'You can’t afford healing.'
      };
    }

    return this.heal(player, healAmount);
  }
}
