import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderDailyHappenings(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, `Daily Happenings (${session.todayDate ?? 'Today'})`);

  const lines = session.dailyNews.length > 0 ? session.dailyNews : [];
  if (lines.length === 0) {
    drawText(buffer, 3, 4, 'No news yet today.');
  } else {
    for (let i = 0; i < Math.min(lines.length, rows - 9); i++) {
      drawText(buffer, 3, 4 + i, `- ${lines[i]?.message ?? ''}`);
    }
  }

  drawText(buffer, 3, rows - 4, session.notice || 'Press any key to continue...');
  drawText(buffer, 3, rows - 2, 'Any key) Continue to Town Square');

  return { cols, rows, lines: toLines(buffer) };
}
