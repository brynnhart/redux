import { getArmorById, getWeaponById } from '../data/equipment.js';
import type { PlayerRecord } from '../repos/playerRepo.js';
import { classLabel } from './skillService.js';
import { getExpRequiredForNextLevel } from './trainingService.js';

export interface StatsViewModel {
  title: string;
  lines: string[];
}

function formatNumber(value: number): string {
  return Math.max(0, value).toLocaleString('en-US');
}

function formatBoolYesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function formatSpirit(spirit: PlayerRecord['spirits']): string {
  return spirit ?? 'NORMAL';
}

function formatRoomStatus(player: PlayerRecord): string {
  return formatBoolYesNo(Boolean(player.in_inn_room));
}

function getNextLevelThreshold(level: number): number | null {
  return getExpRequiredForNextLevel(level);
}

function formatNextLevel(player: PlayerRecord): { nextLevelLabel: string; expNeededLabel: string } {
  if (player.level >= 12) {
    return {
      nextLevelLabel: 'Ultimate Warrior',
      expNeededLabel: '0'
    };
  }

  const threshold = getNextLevelThreshold(player.level);
  if (threshold === null) {
    return {
      nextLevelLabel: 'Unknown',
      expNeededLabel: '0'
    };
  }

  return {
    nextLevelLabel: formatNumber(threshold),
    expNeededLabel: formatNumber(Math.max(0, threshold - player.exp))
  };
}

function formatSkillLine(label: string, level: number, uses: number, masteryFlag: number): string {
  const mastery = masteryFlag ? ' [Mastered]' : '';
  return `${label}: ${level} (${uses} uses)${mastery}`;
}

export function buildStatsView(player: PlayerRecord): StatsViewModel {
  const weapon = getWeaponById(player.weapon_id);
  const armor = getArmorById(player.armor_id);
  const onHand = player.gold_on_hand;
  const inBank = player.gold_in_bank;
  const nextLevel = formatNextLevel(player);
  const flirtUsed = Boolean(player.flirt_used_today);
  const trainingUsed = Boolean(player.training_challenge_used_today);
  const sethListens = Math.max(player.bard_listens_used_today ?? 0, 0);

  return {
    title: 'Your Character Stats',
    lines: [
      `Name: ${player.display_name}                Class: ${classLabel(player.class)}`,
      `Sex: ${player.sex}                         Spirits: ${formatSpirit(player.spirits)}`,
      '',
      `Level: ${player.level}                      Heroic Deeds: ${player.heroic_deeds_done}`,
      `EXP: ${formatNumber(player.exp)}                    Current Lap: ${player.current_lap}`,
      `EXP Needed: ${nextLevel.expNeededLabel}              Next Level: ${nextLevel.nextLevelLabel}`,
      '',
      `HP: ${player.hp}/${player.hp_max}`,
      `Weapon: ${weapon.name}              Atk Bonus: ${weapon.atk_bonus}`,
      `Armor: ${armor.name}             Def Bonus: ${armor.def_bonus}`,
      '',
      `Gold On Hand: ${formatNumber(onHand)}`,
      `Gold In Bank: ${formatNumber(inBank)}`,
      `Gems: ${formatNumber(player.gems)}`,
      `Elixirs: ${formatNumber(player.elixirs ?? 0)}   Charm: ${formatNumber(player.charm)}`,
      '',
      `Forest Fights: ${player.turns_forest_left}/${player.turns_forest_max}`,
      `PvP Attacks: ${player.turns_pvp_left}/${player.turns_pvp_max}`,
      `Training Challenge Used: ${formatBoolYesNo(trainingUsed)}`,
      `Flirt Used: ${formatBoolYesNo(flirtUsed)}`,
      `Seth Listens Used: ${sethListens}`,
      `Money Doubler Used: ${formatBoolYesNo(Boolean(player.money_doubler_used_today))}`,
      `Roomed: ${formatRoomStatus(player)}`,
      '',
      formatSkillLine('Death Knight Skill', player.skill_level_death, player.skill_uses_death, player.skill_mastery_death),
      formatSkillLine('Mystical Skill', player.skill_level_mystic, player.skill_uses_mystic, player.skill_mastery_mystic),
      formatSkillLine('Thieving Skill', player.skill_level_thief, player.skill_uses_thief, player.skill_mastery_thief)
    ]
  };
}
