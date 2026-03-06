import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderSlaughterFields(session, dims) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, 'Slaughter Other Players');
    if (session.pvpEncounter && !session.pvpEncounter.over) {
        drawText(buffer, 3, 4, `Fighting: ${session.pvpEncounter.targetName}`);
        drawText(buffer, 3, 5, `Your HP: ${session.pvpEncounter.attackerHp}   Target HP: ${session.pvpEncounter.targetHp}`);
        drawText(buffer, 3, 7, '(A) Attack');
        drawText(buffer, 3, 8, '(R) Run away');
        drawText(buffer, 3, 9, '(Q) Return to Town');
    }
    else {
        drawText(buffer, 3, 4, 'You scan the Warfield for potential victims...');
        drawText(buffer, 3, 6, '(L) List targets');
        drawText(buffer, 3, 7, '(1-9) Select target after listing');
        drawText(buffer, 3, 8, '(R) Return to Town');
        const targets = session.pvpFieldsTargets ?? [];
        if (targets.length > 0) {
            drawText(buffer, 3, 10, 'Eligible targets:');
            const max = Math.min(9, targets.length);
            for (let i = 0; i < max; i += 1) {
                const t = targets[i];
                drawText(buffer, 3, 12 + i, `${i + 1}) ${t.display_name}  L${t.level}  ${t.in_inn_room ? 'In Room' : 'Alive'}`);
            }
        }
    }

    if (session.mode === 'TEXT_ENTRY' && (session.prompt?.field === 'fields_confirm' || session.prompt?.field === 'pvp_press_quote')) {
        drawText(buffer, 3, rows - 3, `${session.inputBuffer}_`);
    }
    drawText(buffer, 3, rows - 4, session.notice || 'Blood in the grass, quiet in the trees.');
    return { cols, rows, cells: toCells(buffer) };
}
