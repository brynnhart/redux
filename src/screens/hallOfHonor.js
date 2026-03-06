import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderHallOfHonor(session, dims, rowsData) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]Hall of Honor[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Candles burn low beside carved names. Voices drop to whispers here.[dim]');
    drawText(buffer, 3, 4, '[b]Rank  Name                   Level  Heroic Deeds[b]');
    let y = 6;
    for (let i = 0; i < Math.min(15, rowsData.length); i += 1) {
        const entry = rowsData[i];
        const rank = `${i + 1}.`.padEnd(5);
        const name = entry.display_name.slice(0, 22).padEnd(22);
        const line = `${rank}${name}  ${String(entry.level).padStart(5)}  ${String(entry.heroic_deeds_done).padStart(12)}`;
        drawText(buffer, 3, y++, line);
    }
    if (rowsData.length === 0) {
        drawText(buffer, 3, 6, 'No names are carved yet. Bring this hall a deed worth stone.');
    }
    drawText(buffer, 3, rows - 4, session.notice || 'Each line is a promise: fight, fall, rise, be remembered.');
    drawText(buffer, 3, rows - 3, '(R/T) Return to training');
    return { cols, rows, lines: toLines(buffer) };
}
