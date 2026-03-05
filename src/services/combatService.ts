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
        enemyHp -= this.playerDamage(player.level, rounds);
        if (enemyHp <= 0) break;
        playerHp -= this.enemyDamage(player.level);
      } else {
        playerHp -= this.enemyDamage(player.level);
        if (playerHp <= 0) break;
        enemyHp -= this.playerDamage(player.level, rounds);
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

  private playerDamage(level: number, rounds: string[]) {
    const min = Math.max(1, Math.floor(level * 2));
    const max = Math.max(min, Math.floor(level * 4));
    const base = randInt(min, max, this.rng);
    if (this.rng() < 0.08) {
      rounds.push('POWER MOVE! You explode with righteous nonsense!');
      return base * 3;
    }
    return base;
  }

  private enemyDamage(level: number) {
    const min = Math.max(1, Math.floor(level * 1));
    const max = Math.max(min, Math.floor(level * 3));
    return randInt(min, max, this.rng);
  }
}
