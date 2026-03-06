import { getArmorTier, getWeaponTier } from '../data/equipment.js';
import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { classLabel, skillLabel } from '../services/skillService.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderTownSquare(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);
  const player = session.player;

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'The Town Square');
  drawText(buffer, 3, 4, 'F) Forest');
  drawText(buffer, 3, 5, 'B) Bank');
  drawText(buffer, 3, 6, 'H) Healer Hut');
  drawText(buffer, 3, 7, "W) King Arthur's Weapons");
  drawText(buffer, 3, 8, "A) Abdul's Armor");
  drawText(buffer, 3, 9, 'I) Inn');
  drawText(buffer, 3, 10, 'T) Training');
  drawText(buffer, 3, 11, 'Q) Quit');

  drawText(buffer, 38, 4, 'Stats');
  if (player) {
    const weapon = getWeaponTier(player.weapon_tier);
    const armor = getArmorTier(player.armor_tier);
    drawText(buffer, 38, 5, `Name: ${player.display_name}`);
    drawText(buffer, 38, 6, `Level: ${player.level}   Exp: ${player.exp}`);
    drawText(buffer, 38, 7, `HP: ${player.hp}/${player.hp_max}`);
    drawText(buffer, 38, 8, `Gold: ${player.gold}   Bank: ${player.bank_gold}`);
    drawText(buffer, 38, 9, `Spirits: ${player.spirits}`);
    drawText(buffer, 38, 10, `Forest turns: ${player.turns_forest_left} / ${player.turns_forest_max}`);
    drawText(buffer, 38, 11, `Player fights: ${player.turns_pvp_left} / ${player.turns_pvp_max}`);
    drawText(buffer, 38, 12, `Date: ${session.todayDate ?? player.last_daily_reset_date ?? 'Unknown'}`);
    drawText(buffer, 38, 13, `Class: ${classLabel(player.class)}   Sex: ${player.sex}`);
    drawText(buffer, 38, 14, `Weapon: ${weapon.name} (T${weapon.tier}, +${weapon.bonus} atk)`);
    drawText(buffer, 38, 15, `Armor: ${armor.name} (T${armor.tier}, +${armor.bonus} def)`);
    const skillUses = player.class === 'DEATH_KNIGHT' ? player.skill_uses_death : player.class === 'MYSTICAL' ? player.skill_uses_mystic : player.skill_uses_thief;
    const skillLevel = player.class === 'DEATH_KNIGHT' ? player.skill_level_death : player.class === 'MYSTICAL' ? player.skill_level_mystic : player.skill_level_thief;
    drawText(buffer, 38, 16, `${skillLabel(player.class)}: ${skillLevel} (Uses left: ${skillUses})`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'Welcome to town.');

  return { cols, rows, lines: toLines(buffer) };
}
