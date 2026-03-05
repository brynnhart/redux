import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderWelcome(session: Session, dims: Dimensions) {
  const cols = Math.max(60, dims.cols);
  const rows = Math.max(20, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Legend of the Red Dragon (Web)');
  drawText(buffer, 3, 4, '1) Login');
  drawText(buffer, 3, 5, '2) Create new character');
  drawText(buffer, 3, 6, 'Q) Quit');
  drawText(buffer, 3, rows - 4, session.notice || 'Choose an option.');
  drawText(buffer, 3, rows - 2, `Session: ${session.id}`);

  return { cols, rows, lines: toLines(buffer) };
}
