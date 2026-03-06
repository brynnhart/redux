import { createBuffer, toCells } from '../render/buffer.js';
import { drawText } from '../render/draw.js';

export function renderDailyHappenings(session, dims) {
    const cols = Math.max(88, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);

    drawText(buffer, 1, 1, '[b][c:yellow]LoRD Daily Happenings[b][c:white]');
    drawText(buffer, 1, 2, `[dim]Realm gossip and blood-price whispers — Day ${session.todayDayNumber ?? '?'}.[dim]`);
    drawText(buffer, 1, 3, '[c:yellow]=-=-=-[c:white]');

    const lines = session.dailyNews ?? [];
    if (lines.length === 0) {
        drawText(buffer, 1, 5, '[dim]No gossip yet. The realm holds its breath.[dim]');
    }
    else {
        const maxRows = Math.min(lines.length, Math.max(0, Math.floor((rows - 12) / 3)));
        for (let i = 0; i < maxRows; i += 1) {
            const entry = lines[i]?.message ?? '';
            const row = 5 + i * 3;
            drawText(buffer, 1, row, `${entry}`);
            drawText(buffer, 1, row + 1, '[dim]"The taverns will be shouting about this tonight."[dim]');
            drawText(buffer, 1, row + 2, '[c:yellow]=-=-=-[c:white]');
        }
    }

    if (session.dailyNewsHasMore) {
        drawText(buffer, 1, rows - 6, '[c:cyan](N)[c:white] Older reports');
    }
    if (session.dailyNewsOffset > 0) {
        drawText(buffer, 1, rows - 5, '[c:cyan](P)[c:white] Newer reports');
    }

    drawText(buffer, 1, rows - 4, session.notice || '[dim]A courier folds a fresh sheet and waits for your nod.[dim]');
    drawText(buffer, 1, rows - 3, '[c:cyan][Enter][c:white] Town   [c:cyan]N[c:white] Older   [c:cyan]P[c:white] Newer');

    return { cols, rows, cells: toCells(buffer) };
}
