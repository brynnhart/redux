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
  weakenedTurns?: number;
}

export interface CombatResult {
  playerHpAfter: number;
  enemyHpAfter: number;
  playerWon: boolean;
  playerDied: boolean;
  rounds: string[];
}

export interface SkillActionResult {
  playerHpAfter: number;
  enemyHpAfter: number;
  rounds: string[];
  enemyWeakenedTurns?: number;
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
        playerHp -= this.enemyDamage(player.level, player.armor_tier, (enemy.weakenedTurns ?? 0) > 0);
        if (enemy.weakenedTurns && enemy.weakenedTurns > 0) {
          enemy.weakenedTurns -= 1;
        }
      } else {
        playerHp -= this.enemyDamage(player.level, player.armor_tier, (enemy.weakenedTurns ?? 0) > 0);
        if (enemy.weakenedTurns && enemy.weakenedTurns > 0) {
          enemy.weakenedTurns -= 1;
        }
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

  useSkill(player: PlayerRecord, enemy: ActiveEnemy, skillKey: string): SkillActionResult {
    const rounds: string[] = [];
    let enemyHp = enemy.hp;
    let playerHp = player.hp;
    let enemyWeakenedTurns = enemy.weakenedTurns ?? 0;

    const baseDamage = this.rollBasePlayerDamage(player);

    if (skillKey === 'DEATH_ATTACK') {
      const damage = Math.floor(baseDamage * (2 + this.rng()));
      enemyHp -= damage;
      rounds.push('In a scream of rage you unleash a terrifying blow...');
      rounds.push(`You carve into ${enemy.name} for ${damage} damage.`);
    } else if (skillKey === 'MYSTIC_PINCH') {
      const damage = Math.floor(baseDamage * (2.2 + this.rng() * 0.6));
      enemyHp -= damage;
      rounds.push('You pinch reality real hard. The air squeals.');
      rounds.push(`${enemy.name} takes ${damage} mystic damage.`);
    } else if (skillKey === 'MYSTIC_HEAL') {
      const heal = Math.max(1, Math.floor(player.hp_max * (0.15 + this.rng() * 0.2)));
      playerHp = Math.min(player.hp_max, player.hp + heal);
      rounds.push(`You bend your mind inward and mend ${playerHp - player.hp} HP.`);
    } else if (skillKey === 'THIEF_SNEAKY') {
      const damage = Math.floor(baseDamage * (2 + this.rng() * 1.2));
      enemyHp -= damage;
      rounds.push('Ultra Sneaky Move! You strike from a ridiculous angle.');
      rounds.push(`${enemy.name} reels for ${damage} damage.`);
    } else if (skillKey === 'THIEF_PASS_MARK') {
      enemyWeakenedTurns = 2;
      rounds.push('Pass Mark! You tag a weak point in your foe.');
      rounds.push(`${enemy.name} is Weakened (damage down) for 2 turns.`);
    }

    if (enemyHp > 0) {
      const retaliate = this.enemyDamage(player.level, player.armor_tier, enemyWeakenedTurns > 0);
      playerHp = Math.max(0, playerHp - retaliate);
      if (enemyWeakenedTurns > 0) {
        enemyWeakenedTurns -= 1;
      }
      rounds.push(`${enemy.name} retaliates for ${retaliate} damage.`);
    }

    return {
      playerHpAfter: playerHp,
      enemyHpAfter: Math.max(0, enemyHp),
      rounds,
      enemyWeakenedTurns
    };
  }

  private playerDamage(player: PlayerRecord, rounds: string[]) {
    const damage = this.rollBasePlayerDamage(player);

    if (this.rng() < 0.08) {
      rounds.push('POWER MOVE! You explode with righteous nonsense!');
      return damage * 3;
    }
    return damage;
  }

  private rollBasePlayerDamage(player: PlayerRecord) {
    const min = Math.max(1, Math.floor(player.level * 2));
    const max = Math.max(min, Math.floor(player.level * 4));
    const base = randInt(min, max, this.rng);
    const weapon = getWeaponTier(player.weapon_tier);
    const scaledBonus = Math.floor(weapon.bonus * (WEAPON_LEVEL_SCALE_BASE + player.level * WEAPON_LEVEL_SCALE_STEP));
    return base + scaledBonus;
  }

  private enemyDamage(level: number, armorTier: number, weakened = false) {
    const min = Math.max(1, Math.floor(level * 1));
    const max = Math.max(min, Math.floor(level * 3));
    const raw = randInt(min, max, this.rng);
    const armor = getArmorTier(armorTier);
    const mitigated = raw - Math.floor(armor.bonus * ARMOR_MITIGATION_FACTOR);
    const weakenedAdjusted = weakened ? Math.floor(mitigated * 0.75) : mitigated;
    return Math.max(1, weakenedAdjusted);
  }
}
