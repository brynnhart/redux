import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderHello(session, dims) {
    const cols = Math.max(20, dims.cols);
    const rows = Math.max(10, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, 'Legend of the Red Dragon (Web)');
    drawText(buffer, 3, 4, 'Hello LoRD');
    drawText(buffer, 3, 6, 'Press keys; last key will display below');
    drawText(buffer, 3, 8, `Last key: ${session.lastKey ?? '(none)'}`);
    drawText(buffer, 3, rows - 3, 'ESC later will quit, not implemented yet');
    drawText(buffer, 3, rows - 2, `Session: ${session.id}`);
    return { cols, rows, lines: toLines(buffer) };
}
