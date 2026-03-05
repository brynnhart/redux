import { getArmorTier, getWeaponTier } from '../data/equipment.js';
import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';
import type { NewsService } from './newsService.js';

export interface InnTarget {
  id: string;
  display_name: string;
  level: number;
  has_room: number;
}

interface ActionResult {
  ok: boolean;
  message: string;
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export class InnService {
  constructor(
    private readonly playerRepo: PlayerRepo,
    private readonly newsService: NewsService,
    private readonly rng: () => number = Math.random
  ) {}

  flirt(player: PlayerRecord, today: string): ActionResult {
    if (player.daily_flirt_used) {
      return { ok: false, message: 'Violet has heard enough pickup lines from you today.' };
    }

    const expGain = Math.floor(100 + player.level * 20 + player.charm * 0.5);
    const patch = {
      exp: player.exp + expGain,
      daily_flirt_used: 1
    };

    let rewardText = '';
    if (this.rng() < 0.1) {
      patch.gems = player.gems + 1;
      rewardText += ' She flips you a sparkling gem.';
    }
    if (this.rng() < 0.2) {
      const goldGain = player.level * 200;
      patch.gold = (patch.gold ?? player.gold) + goldGain;
      rewardText += ` You also find ${goldGain} gold in your pocket somehow.`;
    }

    this.playerRepo.updatePlayerStats(player.id, patch);
    this.newsService.addNews({
      date: today,
      type: 'GENERIC',
      message: `Violet giggled at ${player.display_name}'s awful pickup line.`
    });

    return { ok: true, message: `Violet laughs despite herself. +${expGain} exp.${rewardText}` };
  }

  listenToBard(player: PlayerRecord, today: string): ActionResult {
    if (player.daily_bard_used) {
      return { ok: false, message: 'Seth Able is saving his voice for tomorrow.' };
    }

    const roll = this.rng();
    const lyrics = this.getLyrics();
    const patch = { daily_bard_used: 1 };
    let outcome = '';

    if (roll < 0.6) {
      patch.turns_forest_left = player.turns_forest_left + 1;
      outcome = 'You feel adventurous. (+1 forest fight)';
    } else if (roll < 0.85) {
      patch.turns_forest_left = player.turns_forest_left + 2;
      outcome = 'Your blood sings with battle. (+2 forest fights)';
    } else if (roll < 0.95) {
      patch.hp = player.hp_max;
      outcome = 'You feel restored to full health.';
    } else {
      patch.charm = player.charm + 1;
      outcome = 'You learn a smoother smile. (+1 charm)';
    }

    this.playerRepo.updatePlayerStats(player.id, patch);
    this.newsService.addNews({
      date: today,
      type: 'GENERIC',
      message: `${player.display_name} listened to Seth Able and left humming.`
    });

    return { ok: true, message: `${lyrics} ${outcome}` };
  }

  rentRoom(player: PlayerRecord, today: string): ActionResult {
    if (player.has_room) {
      return { ok: false, message: 'You already have a room key for tonight.' };
    }

    const cost = Math.floor(300 + player.level * 150);
    if (player.gold < cost) {
      return { ok: false, message: `A room costs ${cost} gold. You only have ${player.gold}.` };
    }

    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - cost,
      has_room: 1,
      daily_room_rented: 1
    });

    this.newsService.addNews({
      date: today,
      type: 'GENERIC',
      message: `${player.display_name} rented a room at the Inn.`
    });

    return { ok: true, message: `You rent a room for ${cost} gold and lock the door.` };
  }

  bribeBartender(player: PlayerRecord): ActionResult {
    if (player.level <= 1) {
      return { ok: false, message: 'The bartender laughs: come back when you survive level 1.' };
    }

    const cost = Math.floor(200 + player.level * 100);
    if (player.gold < cost) {
      return { ok: false, message: `Bribe costs ${cost} gold. You only have ${player.gold}.` };
    }

    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - cost,
      inn_bribe_count_today: player.inn_bribe_count_today + 1
    });

    return { ok: true, message: `You slide ${cost} gold across the bar. The back door opens.` };
  }

  getBreakInTargets(attacker: PlayerRecord): InnTarget[] {
    const targets = this.playerRepo.listInnTargets(attacker.id);
    return targets.filter((target) => target.level <= attacker.level);
  }

  breakInAttack(attacker: PlayerRecord, victimId: string, today: string): ActionResult {
    if (attacker.turns_pvp_left <= 0) {
      return { ok: false, message: 'You are out of player fights today.' };
    }

    const victim = this.playerRepo.findById(victimId);
    if (!victim || victim.id === attacker.id) {
      return { ok: false, message: 'That victim is gone.' };
    }

    if (victim.level > attacker.level) {
      return { ok: false, message: 'You may only break in on your level or lower (for now).' };
    }

    const rounds: string[] = [];
    let attackerHp = attacker.hp;
    let victimHp = victim.hp;

    while (attackerHp > 0 && victimHp > 0) {
      victimHp -= this.playerDamage(attacker, victim, rounds);
      if (victimHp <= 0) {
        break;
      }
      attackerHp -= this.playerDamage(victim, attacker, rounds);
    }

    const attackerWon = victimHp <= 0;
    if (attackerWon) {
      const xpGain = Math.floor(victim.level * 5000 + victim.exp * 0.05);
      const stealAmount = Math.min(victim.gold, Math.floor(victim.bank_gold * 0.01));

      this.playerRepo.updatePlayerStats(attacker.id, {
        exp: attacker.exp + xpGain,
        gold: attacker.gold + stealAmount,
        hp: Math.max(1, attackerHp),
        turns_pvp_left: attacker.turns_pvp_left - 1
      });

      this.playerRepo.updatePlayerStats(victim.id, {
        gold: victim.gold - stealAmount,
        hp: 1
      });

      this.newsService.addNews({
        date: today,
        type: 'GENERIC',
        message: `${attacker.display_name} broke into ${victim.display_name}'s inn space and won.`
      });

      return {
        ok: true,
        message: `${rounds.join(' ')} You win! +${xpGain} exp and steal ${stealAmount} gold.`
      };
    }

    this.playerRepo.updatePlayerStats(attacker.id, {
      hp: 1,
      turns_pvp_left: Math.max(0, attacker.turns_pvp_left - 1),
      turns_forest_left: 0
    });

    this.newsService.addNews({
      date: today,
      type: 'GENERIC',
      message: `${attacker.display_name} died trying to break into ${victim.display_name}'s inn space.`
    });

    return { ok: true, message: `${rounds.join(' ')} You lose and wake up at 1 HP. Your forest day is over.` };
  }

  private getLyrics() {
    const lines = [
      'Seth sings: "Swing low, sweet cabbage cart, carry me home for loot..."',
      'Seth strums: "Oh hero mine, your boots are mud, your coin purse full of holes..."',
      'Seth croons: "Raise your mug and duck your debts, the moon forgives all fools..."'
    ];
    return lines[randInt(0, lines.length - 1, this.rng)] ?? lines[0]!;
  }

  private playerDamage(attacker: PlayerRecord, defender: PlayerRecord, rounds: string[]) {
    const min = Math.max(1, Math.floor(attacker.level * 2));
    const max = Math.max(min, Math.floor(attacker.level * 4));
    const base = randInt(min, max, this.rng);
    const weapon = getWeaponTier(attacker.weapon_tier);
    const armor = getArmorTier(defender.armor_tier);
    const damage = Math.max(1, base + Math.floor(weapon.bonus * 0.4) - Math.floor(armor.bonus * 0.15));

    if (this.rng() < 0.08) {
      rounds.push(`${attacker.display_name} lands a brutal cheap shot!`);
      return damage * 2;
    }
    return damage;
  }
}
