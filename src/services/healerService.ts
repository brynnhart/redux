import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';

export class HealerService {
  constructor(private readonly playerRepo: PlayerRepo) {}

  costPerHp(_player: PlayerRecord) {
    return 2;
  }

  heal(player: PlayerRecord, requestedHp: number): string {
    const missing = Math.max(0, player.hp_max - player.hp);
    if (missing <= 0) {
      return 'You look fine. Stop wasting my time.';
    }

    const costPerHp = this.costPerHp(player);
    const affordable = Math.floor(player.gold / costPerHp);
    const desired = Math.min(missing, requestedHp);
    const healed = Math.min(desired, affordable);

    if (healed <= 0) {
      return 'No gold, no healing. The hut is not a charity.';
    }

    const totalCost = healed * costPerHp;
    this.playerRepo.updatePlayerStats(player.id, {
      hp: Math.min(player.hp_max, player.hp + healed),
      gold: player.gold - totalCost
    });

    return `You recover ${healed} HP for ${totalCost} gold.`;
  }
}
