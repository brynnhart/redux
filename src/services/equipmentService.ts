import type { PlayerRepo, PlayerRecord } from '../repos/playerRepo.js';
import { ARMOR_TIERS, WEAPON_TIERS, getArmorTier, getSellPrice, getWeaponTier } from '../data/equipment.js';

type Slot = 'weapon' | 'armor';

export class EquipmentService {
  constructor(private readonly playerRepo: PlayerRepo) {}

  buyWeapon(player: PlayerRecord, targetTier: number) {
    return this.buy(player, targetTier, 'weapon');
  }

  buyArmor(player: PlayerRecord, targetTier: number) {
    return this.buy(player, targetTier, 'armor');
  }

  sellWeapon(player: PlayerRecord) {
    return this.sell(player, 'weapon');
  }

  sellArmor(player: PlayerRecord) {
    return this.sell(player, 'armor');
  }

  private buy(player: PlayerRecord, targetTier: number, slot: Slot) {
    const tiers = slot === 'weapon' ? WEAPON_TIERS : ARMOR_TIERS;
    if (!Number.isInteger(targetTier) || targetTier < 1 || targetTier > tiers.length) {
      return { ok: false, message: `Pick a tier between 1 and ${tiers.length}.` };
    }

    const currentTier = slot === 'weapon' ? player.weapon_tier : player.armor_tier;
    if (currentTier > 1) {
      return { ok: false, message: `You already have ${slot === 'weapon' ? 'a weapon' : 'armor'}. Sell it first.` };
    }

    if (targetTier <= currentTier) {
      return { ok: false, message: `That is not an upgrade. Try a higher tier.` };
    }

    const target = tiers[targetTier - 1];
    if (player.gold < target.price) {
      return { ok: false, message: `You need ${target.price} gold for ${target.name}.` };
    }

    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - target.price,
      ...(slot === 'weapon' ? { weapon_tier: targetTier } : { armor_tier: targetTier })
    });

    return { ok: true, message: `You buy ${target.name} for ${target.price} gold.` };
  }

  private sell(player: PlayerRecord, slot: Slot) {
    const current = slot === 'weapon' ? getWeaponTier(player.weapon_tier) : getArmorTier(player.armor_tier);
    if (current.tier <= 1) {
      return { ok: false, message: `Nobody pays for ${current.name}. Wear it and be grateful.` };
    }

    const sellPrice = getSellPrice(current.price);
    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold + sellPrice,
      ...(slot === 'weapon' ? { weapon_tier: 1 } : { armor_tier: 1 })
    });

    return { ok: true, message: `Sold ${current.name} for ${sellPrice} gold. Try not to cry.` };
  }
}
