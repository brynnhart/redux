import { createBuffer, toCells } from '../render/buffer.js';
import { drawText } from '../render/draw.js';
export function renderForest(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;

    drawText(buffer, 2, 1, '[b]Forest[b]');
    drawText(buffer, 2, 3, 'Actions:');
    drawText(buffer, 2, 5, '(L)ook for something to kill');
    drawText(buffer, 2, 6, '(H)ealers hut');
    drawText(buffer, 2, 7, '(R)eturn to town');

    drawText(buffer, 2, rows - 4, session.notice ? `[c:yellow]${session.notice}[c:white]` : 'The forest waits.');

    if (player) {
        drawText(buffer, 2, rows - 2, `HitPoints: (${player.hp} of ${player.hp_max})  Fights: ${player.turns_forest_left}  Gold: ${player.gold_on_hand}  Gems: ${player.gems}`);
    }
    drawText(buffer, 2, rows - 1, '[b]Command?[b]');

    return { cols, rows, cells: toCells(buffer) };
}
