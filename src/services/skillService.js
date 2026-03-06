import { config } from '../config.js';
export function getSkillPath(klass) {
    if (klass === 'DEATH_KNIGHT')
        return 'DEATH';
    if (klass === 'MYSTICAL')
        return 'MYSTIC';
    return 'THIEF';
}
export function getDailySkillUses(level, hasMastery) {
    const base = 1 + Math.floor(level / 3) + (hasMastery ? 1 : 0);
    return Math.min(config.skillDailyUsesCap, Math.max(1, base));
}
export function classLabel(klass) {
    if (klass === 'DEATH_KNIGHT')
        return 'Death Knight';
    if (klass === 'MYSTICAL')
        return 'Mystical Student';
    return 'Thieving Apprentice';
}
export function skillLabel(klass) {
    if (klass === 'DEATH_KNIGHT')
        return 'Death Skill';
    if (klass === 'MYSTICAL')
        return 'Mystic Skill';
    return 'Thief Skill';
}
export function getClassSkillLevel(player) {
    if (player.class === 'DEATH_KNIGHT')
        return player.skill_level_death;
    if (player.class === 'MYSTICAL')
        return player.skill_level_mystic;
    return player.skill_level_thief;
}
export function getClassSkillUses(player) {
    if (player.class === 'DEATH_KNIGHT')
        return player.skill_uses_death;
    if (player.class === 'MYSTICAL')
        return player.skill_uses_mystic;
    return player.skill_uses_thief;
}
export function consumeClassSkillUsePatch(player) {
    if (player.class === 'DEATH_KNIGHT') {
        return { skill_uses_death: Math.max(0, player.skill_uses_death - 1) };
    }
    if (player.class === 'MYSTICAL') {
        return { skill_uses_mystic: Math.max(0, player.skill_uses_mystic - 1) };
    }
    return { skill_uses_thief: Math.max(0, player.skill_uses_thief - 1) };
}
export function trainClassSkillPatch(player) {
    const path = getSkillPath(player.class);
    const patch = { training_challenge_used_today: 1 };
    if (path === 'DEATH') {
        const next = player.skill_level_death + 1;
        patch.skill_level_death = next;
        patch.skill_mastery_death = next >= config.skillMasteryLevel ? 1 : player.skill_mastery_death;
    }
    else if (path === 'MYSTIC') {
        const next = player.skill_level_mystic + 1;
        patch.skill_level_mystic = next;
        patch.skill_mastery_mystic = next >= config.skillMasteryLevel ? 1 : player.skill_mastery_mystic;
    }
    else {
        const next = player.skill_level_thief + 1;
        patch.skill_level_thief = next;
        patch.skill_mastery_thief = next >= config.skillMasteryLevel ? 1 : player.skill_mastery_thief;
    }
    return patch;
}
