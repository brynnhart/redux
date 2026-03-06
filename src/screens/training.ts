import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { classLabel } from '../services/skillService.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderTraining(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);
  const player = session.player;

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, "Turgon's Warrior Training");
  drawText(buffer, 3, 4, 'C) Train Class Skills (once per day)');
  drawText(buffer, 3, 5, 'Q/T) Return to Town');

  if (player) {
    drawText(buffer, 3, 7, `Class: ${classLabel(player.class)}`);
    drawText(buffer, 3, 8, `Trained today: ${player.daily_skill_training_used ? 'Yes' : 'No'}`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'Sweat, bruises, and progress.');
  return { cols, rows, lines: toLines(buffer) };
}
