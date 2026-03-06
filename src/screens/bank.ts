import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderBank(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);
  const player = session.player;
  const masked = session.prompt?.hidden ? '*'.repeat(session.inputBuffer.length) : session.inputBuffer;

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'The Bank');

  if (player) {
    drawText(buffer, 3, 4, `Pocket Gold: ${player.gold}`);
    drawText(buffer, 3, 5, `Bank Gold:   ${player.bank_gold}`);
  }

  drawText(buffer, 3, 7, '1) Deposit gold');
  drawText(buffer, 3, 8, '2) Withdraw gold');
  drawText(buffer, 3, 9, '3) Deposit ALL pocket gold');
  drawText(buffer, 3, 10, '4) Balance');
  drawText(buffer, 3, 11, 'Q) Return to town');

  if (session.mode === 'TEXT_ENTRY' && session.prompt) {
    drawText(buffer, 3, 14, `Amount > ${masked}_`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'The banker squints at you suspiciously.');

  return { cols, rows, lines: toLines(buffer) };
}
