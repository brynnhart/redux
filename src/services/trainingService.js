import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CombatService } from './combatService.js';
function loadData(fileName) {
    const filePath = path.resolve(process.cwd(), 'data', fileName);
    return JSON.parse(readFileSync(filePath, 'utf-8'));
}
const LEVELS = loadData('levels.json').sort((a, b) => a.level - b.level);
const MASTERS = loadData('masters.json').sort((a, b) => a.level - b.level);
const requirementByLevel = new Map(LEVELS.map((entry) => [entry.level, entry.exp]));
const masterByLevel = new Map(MASTERS.map((entry) => [entry.level, entry]));
export function getExpRequiredForLevel(level) {
    return requirementByLevel.get(level) ?? null;
}
export function getExpRequiredForNextLevel(level) {
    return getExpRequiredForLevel(level + 1);
}
export function getMasterForLevel(level) {
    return masterByLevel.get(level) ?? null;
}
export function isEligibleForMasterChallenge(player) {
    const requiredExp = getExpRequiredForNextLevel(player.level);
    if (requiredExp === null) {
        return { eligible: false, expNeeded: 0, requiredExp: null };
    }
    if (player.exp >= requiredExp) {
        return { eligible: true, expNeeded: 0, requiredExp };
    }
    return { eligible: false, expNeeded: requiredExp - player.exp, requiredExp };
}
export function levelUpHpGain(newLevel) {
    return 5 + Math.floor(newLevel / 2);
}
export function challengeMaster(player, master, combatService = new CombatService()) {
    const enemy = {
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
