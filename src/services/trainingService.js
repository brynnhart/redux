import { CombatService } from './combatService.js';
import { loadRepoJson } from '../data/loadRepoJson.js';

const LEVELS = loadRepoJson('levels.json', import.meta.url).sort((a, b) => a.level - b.level);
const MASTERS = loadRepoJson('masters.json', import.meta.url).sort((a, b) => a.level - b.level);
const requirementByLevel = new Map(LEVELS.map((entry) => [entry.level, entry.exp]));
const masterByLevel = new Map(MASTERS.map((entry) => [entry.level, entry]));

function getExpRequiredForLevel(level) {
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
        defense: master.def,
        goldReward: 0,
        expReward: 0,
        gemChance: 0
    };
    return combatService.fight(player, enemy);
}
