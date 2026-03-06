import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderForest(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);
  const player = session.player;

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'The Forest');

  if (player) {
    drawText(buffer, 3, 4, `Name: ${player.display_name}  Level: ${player.level}  Lap: ${player.current_lap}`);
    drawText(buffer, 3, 5, `HP: ${player.hp}/${player.hp_max}  Gold: ${player.gold}  Gems: ${player.gems}`);
    drawText(buffer, 3, 6, `Forest fights left: ${player.turns_forest_left}  Fairy: ${player.has_fairy ? 'Yes' : 'No'}`);
  }

  const dragonOption = player && player.level >= 12 ? '  (S)earch Red Dragon' : '';
  drawText(buffer, 3, 8, `(L)ook  (A)ttack  S(k)ill  (R)un  (T)own  (B)ank${dragonOption}`);
  if (player && player.level < 12) {
    drawText(buffer, 3, 9, 'Only Ultimate Warriors may challenge the Red Dragon.');
  }
  drawText(buffer, 3, rows - 5, 'Forest is loud, violent, and full of bad decision-making.');
  drawText(buffer, 3, rows - 4, session.notice || 'You stand among the trees.');

  return { cols, rows, lines: toLines(buffer) };
}
