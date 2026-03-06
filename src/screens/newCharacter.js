import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderNewCharacter(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const masked = session.prompt?.hidden ? '*'.repeat(session.inputBuffer.length) : session.inputBuffer;
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, 'Create New Character');
    drawText(buffer, 3, 4, `Username: ${session.draft.username ?? ''}`);
    drawText(buffer, 3, 5, `Password: ${session.draft.password ? '********' : ''}`);
    drawText(buffer, 3, 6, `Display Name: ${session.draft.displayName ?? ''}`);
    drawText(buffer, 3, 7, `Sex: ${session.draft.sex ?? ''} (M/F)`);
    drawText(buffer, 3, 8, `Class: ${session.draft.class ?? ''} (1 DK, 2 Mystical, 3 Thief)`);
    drawText(buffer, 3, 10, 'Prompt order: username -> password -> display name -> sex -> class');
    if (session.mode === 'TEXT_ENTRY' && session.prompt) {
        drawText(buffer, 3, 12, `> ${masked}_`);
    }
    drawText(buffer, 3, rows - 4, session.notice || 'Press N to begin character creation, Q to go back.');
    drawText(buffer, 3, rows - 2, 'Class: 1=Death Knight, 2=Mystical, 3=Thief');
    return { cols, rows, cells: toCells(buffer) };
}
