import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PlayerRecord } from '../repos/playerRepo.js';
import { CombatService, type ActiveEnemy } from './combatService.js';

interface LevelRequirement {
  level: number;
  exp: number;
}

export interface MasterDefinition {
  level: number;
  name: string;
  title: string;
  hp: number;
  atk: number;
  def: number;
  flavor_intro: string;
  flavor_win: string;
  flavor_loss: string;
}

function loadData<T>(fileName: string): T {
  const filePath = path.resolve(process.cwd(), 'data', fileName);
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

const LEVELS = loadData<LevelRequirement[]>('levels.json').sort((a, b) => a.level - b.level);
const MASTERS = loadData<MasterDefinition[]>('masters.json').sort((a, b) => a.level - b.level);

const requirementByLevel = new Map(LEVELS.map((entry) => [entry.level, entry.exp]));
const masterByLevel = new Map(MASTERS.map((entry) => [entry.level, entry]));

export function getExpRequiredForLevel(level: number): number | null {
  return requirementByLevel.get(level) ?? null;
}

export function getExpRequiredForNextLevel(level: number): number | null {
  return getExpRequiredForLevel(level + 1);
}

export function getMasterForLevel(level: number): MasterDefinition | null {
  return masterByLevel.get(level) ?? null;
}

export function isEligibleForMasterChallenge(player: PlayerRecord): { eligible: boolean; expNeeded: number; requiredExp: number | null } {
  const requiredExp = getExpRequiredForNextLevel(player.level);
  if (requiredExp === null) {
    return { eligible: false, expNeeded: 0, requiredExp: null };
  }

  if (player.exp >= requiredExp) {
    return { eligible: true, expNeeded: 0, requiredExp };
  }

  return { eligible: false, expNeeded: requiredExp - player.exp, requiredExp };
}

export function levelUpHpGain(newLevel: number): number {
  return 5 + Math.floor(newLevel / 2);
}

export function challengeMaster(player: PlayerRecord, master: MasterDefinition, combatService = new CombatService()) {
  const enemy: ActiveEnemy = {
    key: `master_${master.level}`,
    name: `${master.name}, ${master.title}`,
    maxHp: master.hp,
    hp: master.hp,
    attackMin: master.atk,
    attackMax: master.atk + 4,
    goldReward: 0,
    expReward: 0,
    gemChance: 0
  };

  return combatService.fight(player, enemy);
}
