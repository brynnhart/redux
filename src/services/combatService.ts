import { getArmorTier, getWeaponTier } from '../data/equipment.js';
import type { PlayerRecord } from '../repos/playerRepo.js';

const WEAPON_LEVEL_SCALE_BASE = 0.35;
const WEAPON_LEVEL_SCALE_STEP = 0.05;
const ARMOR_MITIGATION_FACTOR = 0.15;

export interface ActiveEnemy {
  key: string;
  name: string;
  maxHp: number;
  hp: number;
  attackMin: number;
  attackMax: number;
  goldReward: number;
  expReward: number;
  gemChance: number;
}

export interface CombatResult {
  playerHpAfter: number;
  enemyHpAfter: number;
  playerWon: boolean;
  playerDied: boolean;
  rounds: string[];
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export class CombatService {
  constructor(private readonly rng: () => number = Math.random) {}

  fight(player: PlayerRecord, enemy: ActiveEnemy): CombatResult {
    let playerHp = player.hp;
    let enemyHp = enemy.hp;
    const rounds: string[] = [];

    const playerStarts = this.rng() < 0.6;
    rounds.push(playerStarts ? 'You lunge first before it can blink.' : `${enemy.name} gets the jump on you!`);

    while (playerHp > 0 && enemyHp > 0) {
      if (playerStarts) {
        enemyHp -= this.playerDamage(player, rounds);
        if (enemyHp <= 0) break;
        playerHp -= this.enemyDamage(player.level, player.armor_tier);
      } else {
        playerHp -= this.enemyDamage(player.level, player.armor_tier);
        if (playerHp <= 0) break;
        enemyHp -= this.playerDamage(player, rounds);
      }
    }

    const playerWon = enemyHp <= 0;
    const playerDied = playerHp <= 0;

    rounds.push(playerWon ? `You crush ${enemy.name} into mulch.` : 'Everything goes black. Trees laugh at you.');

    return {
      playerHpAfter: Math.max(0, playerHp),
      enemyHpAfter: Math.max(0, enemyHp),
      playerWon,
      playerDied,
      rounds
    };
  }

  private playerDamage(player: PlayerRecord, rounds: string[]) {
    const min = Math.max(1, Math.floor(player.level * 2));
    const max = Math.max(min, Math.floor(player.level * 4));
    const base = randInt(min, max, this.rng);
    const weapon = getWeaponTier(player.weapon_tier);
    const scaledBonus = Math.floor(weapon.bonus * (WEAPON_LEVEL_SCALE_BASE + player.level * WEAPON_LEVEL_SCALE_STEP));
    const damage = base + scaledBonus;

    if (this.rng() < 0.08) {
      rounds.push('POWER MOVE! You explode with righteous nonsense!');
      return damage * 3;
    }
    return damage;
  }

  private enemyDamage(level: number, armorTier: number) {
    const min = Math.max(1, Math.floor(level * 1));
    const max = Math.max(min, Math.floor(level * 3));
    const raw = randInt(min, max, this.rng);
    const armor = getArmorTier(armorTier);
    const mitigated = raw - Math.floor(armor.bonus * ARMOR_MITIGATION_FACTOR);
    return Math.max(1, mitigated);
  }
}
