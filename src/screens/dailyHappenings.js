import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderDailyHappenings(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, `The Daily News for Day ${session.todayDayNumber ?? '?'}`);
    const lines = session.dailyNews;
    if (lines.length === 0) {
        drawText(buffer, 3, 4, 'No news yet today.');
    }
    else {
        for (let i = 0; i < Math.min(lines.length, rows - 10); i++) {
            drawText(buffer, 3, 4 + i, `- ${lines[i]?.message ?? ''}`);
        }
    }
    if (session.dailyNewsHasMore) {
        drawText(buffer, 3, rows - 5, '(More) Press N for older lines');
    }
    if (session.dailyNewsOffset > 0) {
        drawText(buffer, 3, rows - 4, 'Press P for newer lines');
    }
    drawText(buffer, 3, rows - 3, session.notice || 'Press [Enter] to continue...');
    drawText(buffer, 3, rows - 2, '[Enter] town  N next page  P previous page');
    return { cols, rows, lines: toLines(buffer) };
}
