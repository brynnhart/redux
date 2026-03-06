import { config } from '../config.js';
import { getArmorById, getWeaponById } from '../data/equipment.js';
import type { PlayerRecord } from '../repos/playerRepo.js';

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
        const hit = this.playerDamage(player, enemy.attackMin);
        enemyHp -= hit;
        rounds.push(`You hit ${enemy.name} for ${hit} damage!`);
        if (enemyHp <= 0) break;

        const retaliate = this.enemyDamage(player, enemy, (enemy.weakenedTurns ?? 0) > 0);
        playerHp -= retaliate;
        rounds.push(`${enemy.name} hits you for ${retaliate} damage!`);
        if (enemy.weakenedTurns && enemy.weakenedTurns > 0) {
          enemy.weakenedTurns -= 1;
        }
      } else {
        const retaliate = this.enemyDamage(player, enemy, (enemy.weakenedTurns ?? 0) > 0);
        playerHp -= retaliate;
        rounds.push(`${enemy.name} hits you for ${retaliate} damage!`);
        if (enemy.weakenedTurns && enemy.weakenedTurns > 0) {
          enemy.weakenedTurns -= 1;
        }
        if (playerHp <= 0) break;

        const hit = this.playerDamage(player, enemy.attackMin);
        enemyHp -= hit;
        rounds.push(`You hit ${enemy.name} for ${hit} damage!`);
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

    const baseDamage = this.playerDamage(player, enemy.attackMin);

    if (skillKey === 'DEATH_ATTACK') {
      const damage = Math.floor(baseDamage * (2 + this.rng()));
      enemyHp -= damage;
      rounds.push('In a scream of rage you unleash a terrifying blow...');
      rounds.push(`You hit ${enemy.name} for ${damage} damage!`);
    } else if (skillKey === 'MYSTIC_PINCH') {
      const damage = Math.floor(baseDamage * (2.2 + this.rng() * 0.6));
      enemyHp -= damage;
      rounds.push('You pinch reality real hard. The air squeals.');
      rounds.push(`You hit ${enemy.name} for ${damage} damage!`);
    } else if (skillKey === 'MYSTIC_HEAL') {
      const heal = Math.max(1, Math.floor(player.hp_max * (0.15 + this.rng() * 0.2)));
      playerHp = Math.min(player.hp_max, player.hp + heal);
      rounds.push(`You bend your mind inward and mend ${playerHp - player.hp} HP.`);
    } else if (skillKey === 'THIEF_SNEAKY') {
      const damage = Math.floor(baseDamage * (2 + this.rng() * 1.2));
      enemyHp -= damage;
      rounds.push('Ultra Sneaky Move! You strike from a ridiculous angle.');
      rounds.push(`You hit ${enemy.name} for ${damage} damage!`);
    } else if (skillKey === 'THIEF_PASS_MARK') {
      enemyWeakenedTurns = 2;
      rounds.push('Pass Mark! You tag a weak point in your foe.');
      rounds.push(`${enemy.name} is Weakened (damage down) for 2 turns.`);
    }

    if (enemyHp > 0) {
      const retaliate = this.enemyDamage(player, enemy, enemyWeakenedTurns > 0);
      playerHp = Math.max(0, playerHp - retaliate);
      if (enemyWeakenedTurns > 0) {
        enemyWeakenedTurns -= 1;
      }
      rounds.push(`${enemy.name} hits you for ${retaliate} damage!`);
    }

    return {
      playerHpAfter: playerHp,
      enemyHpAfter: Math.max(0, enemyHp),
      rounds,
      enemyWeakenedTurns
    };
  }

  private playerDamage(player: PlayerRecord, monsterDef: number) {
    const weapon = getWeaponById(player.weapon_id);
    const playerAtk = config.baseAtk + weapon.atk_bonus;
    const rawMin = Math.max(1, Math.floor(playerAtk * 0.8));
    const rawMax = Math.max(rawMin, Math.floor(playerAtk * 1.2));
    const raw = randInt(rawMin, rawMax, this.rng);
    return Math.max(1, raw - monsterDef);
  }

  private enemyDamage(player: PlayerRecord, enemy: ActiveEnemy, weakened = false) {
    const armor = getArmorById(player.armor_id);
    const playerDef = config.baseDef + armor.def_bonus;
    const rawMin = Math.max(1, Math.floor(enemy.attackMin * 0.8));
    const rawMax = Math.max(rawMin, Math.floor(enemy.attackMax * 1.2));
    const raw = randInt(rawMin, rawMax, this.rng);
    const reduced = Math.max(1, raw - playerDef);
    return weakened ? Math.max(1, Math.floor(reduced * 0.75)) : reduced;
  }
}
