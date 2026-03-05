import { ARMOR_TIERS, getArmorTier, getSellPrice } from '../data/equipment.js';
import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { Session } from '../session.js';

interface Dimensions { cols: number; rows: number }

export function renderArmorShop(session: Session, dims: Dimensions) {
  const cols = Math.max(90, dims.cols);
  const rows = Math.max(28, dims.rows);
  const buffer = createBuffer(cols, rows);
  const player = session.player;
  const masked = session.prompt?.hidden ? '*'.repeat(session.inputBuffer.length) : session.inputBuffer;

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, "Abdul's Armor");

  if (player) {
    const current = getArmorTier(player.armor_tier);
    drawText(buffer, 3, 4, `Gold: ${player.gold}`);
    drawText(buffer, 3, 5, `Current armor: T${current.tier} ${current.name} (+${current.bonus} def)`);
    drawText(buffer, 3, 6, `Sell value now: ${getSellPrice(current.price)} gold`);
  }

  drawText(buffer, 3, 8, '1-15) Armor tiers:');
  ARMOR_TIERS.forEach((tier, i) => {
    const col = i < 8 ? 3 : 46;
    const row = 9 + (i % 8);
    drawText(buffer, col, row, `${tier.tier.toString().padStart(2, ' ')}. ${tier.name.padEnd(18, ' ')} ${tier.price}`);
  });

  drawText(buffer, 3, 19, 'B) Buy tier (prompt)   S) Sell current   R/T) Return to Town');
  drawText(buffer, 3, 20, 'F) Forest   W) Weapons   H) Healer');

  if (session.mode === 'TEXT_ENTRY' && session.prompt?.field === 'armor_tier') {
    drawText(buffer, 3, 22, `Buy which tier > ${masked}_`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'Abdul stares: no touching unless you pay.');
  return { cols, rows, lines: toLines(buffer) };
}
