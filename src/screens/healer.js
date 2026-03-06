import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderHealer(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, 'The Healer Hut');
    if (player) {
        const missing = Math.max(0, player.hp_max - player.hp);
        const costPerHp = 2;
        drawText(buffer, 3, 4, `HP: ${player.hp}/${player.hp_max}  Gold: ${player.gold_on_hand}`);
        drawText(buffer, 3, 5, `Missing HP: ${missing}  Cost per HP: ${costPerHp}`);
        drawText(buffer, 3, 6, `Heal ALL cost: ${missing * costPerHp}`);
    }
    drawText(buffer, 3, 8, '1) Heal ALL possible');
    drawText(buffer, 3, 9, '2) Heal 5 HP');
    drawText(buffer, 3, 10, 'R/T) Return to Town');
    drawText(buffer, 3, 11, 'F) Forest  B) Bank  W) Weapons  A) Armor');
    drawText(buffer, 3, rows - 4, session.notice || 'The healer taps a jar labeled "donations".');
    return { cols, rows, lines: toLines(buffer) };
}
