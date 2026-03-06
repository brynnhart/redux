import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';

export function renderDailyHappenings(session, dims) {
    const cols = Math.max(88, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);

    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]The Daily News[b][c:white]');
    drawText(buffer, 3, 2, `[dim]Word from across the realm — Day ${session.todayDayNumber ?? '?'}.[dim]`);
    drawText(buffer, 3, 4, '[b][c:cyan]Latest Rumors and Bloodshed:[b][c:white]');

    const lines = session.dailyNews ?? [];
    if (lines.length === 0) {
        drawText(buffer, 3, 6, '[dim]No one made history yet today.[dim]');
    }
    else {
        const maxRows = Math.min(lines.length, rows - 13);
        for (let i = 0; i < maxRows; i += 1) {
            const entry = lines[i]?.message ?? '';
            const prefix = i % 2 === 0 ? '[c:white]*[c:white]' : '[c:yellow]*[c:white]';
            drawText(buffer, 3, 6 + i, `${prefix} ${entry}`);
        }
    }

    if (session.dailyNewsHasMore) {
        drawText(buffer, 3, rows - 6, '[c:cyan](N)[c:white] Older reports');
    }
    if (session.dailyNewsOffset > 0) {
        drawText(buffer, 3, rows - 5, '[c:cyan](P)[c:white] Newer reports');
    }

    drawText(buffer, 3, rows - 4, session.notice || '[dim]The crier lowers his voice and waits.[dim]');
    drawText(buffer, 3, rows - 3, '[c:cyan][Enter][c:white] Town   [c:cyan]N[c:white] Older   [c:cyan]P[c:white] Newer');

    return { cols, rows, cells: toCells(buffer) };
}
