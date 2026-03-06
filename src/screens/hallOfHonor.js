import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderHallOfHonor(session, dims, rowsData) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, 'Hall of Honor');
    drawText(buffer, 3, 4, 'Rank  Name                   Level  Heroic Deeds');
    let y = 6;
    for (let i = 0; i < Math.min(15, rowsData.length); i += 1) {
        const entry = rowsData[i];
        const rank = `${i + 1}.`.padEnd(5);
        const name = entry.display_name.slice(0, 22).padEnd(22);
        const line = `${rank}${name}  ${String(entry.level).padStart(5)}  ${String(entry.heroic_deeds_done).padStart(12)}`;
        drawText(buffer, 3, y++, line);
    }
    if (rowsData.length === 0) {
        drawText(buffer, 3, 6, 'No names carved here yet. Be heroic first.');
    }
    drawText(buffer, 3, rows - 4, session.notice || 'Legends are measured in deeds, not excuses.');
    drawText(buffer, 3, rows - 3, '(R/T) Return to training');
    return { cols, rows, lines: toLines(buffer) };
}
