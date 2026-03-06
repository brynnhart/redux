import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderLogin(session, dims) {
    const cols = Math.max(60, dims.cols);
    const rows = Math.max(20, dims.rows);
    const buffer = createBuffer(cols, rows);
    const masked = session.prompt?.hidden ? '*'.repeat(session.inputBuffer.length) : session.inputBuffer;
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, 'Login');
    drawText(buffer, 3, 4, 'Enter credentials for an existing character.');
    drawText(buffer, 3, 6, `Username: ${session.draft.loginUsername ?? ''}`);
    drawText(buffer, 3, 7, `Password: ${session.prompt?.field === 'password' ? masked : ''}`);
    if (session.mode === 'TEXT_ENTRY' && session.prompt) {
        drawText(buffer, 3, 9, `> ${masked}_`);
    }
    drawText(buffer, 3, rows - 4, session.notice || 'Press U for username, Q to go back.');
    drawText(buffer, 3, rows - 2, 'Controls: U) Username P) Password Enter) Submit prompt Q) Back');
    return { cols, rows, lines: toLines(buffer) };
}
