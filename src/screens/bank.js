import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { config } from '../config.js';
export function renderBank(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]Ye Olde Bank & Ledger House[b][c:white]');
    drawText(buffer, 3, 2, '[dim]A thin clerk smiles like a trap. Your coin is safe-ish here.[dim]');
    if (player) {
        const onHand = player.gold_on_hand;
        const inBank = player.gold_in_bank;
        drawText(buffer, 3, 4, '[b][c:cyan]Ledger Snapshot[b][c:white]');
        drawText(buffer, 3, 5, `Pocket Balance .... [c:yellow]${onHand}[c:white] gold`);
        drawText(buffer, 3, 6, `Vault Balance ..... [c:green]${inBank}[c:white] gold`);
        drawText(buffer, 3, 7, `Daily Interest .... ${(config.bankInterestRate * 100).toFixed(0)}%`);
    }
    drawText(buffer, 3, 9, '[b][c:magenta]Transactions[b][c:white]');
    drawText(buffer, 3, 10, '[c:green]1[c:white]/[c:green]D[c:white]) Deposit amount   [c:green]3[c:white]) Deposit ALL now');
    drawText(buffer, 3, 11, '[c:green]2[c:white]/[c:green]W[c:white]) Withdraw amount  [c:green]4[c:white]) Show balances');
    drawText(buffer, 3, 12, '[c:green]Q[c:white]/[c:green]R[c:white]) Return to Town');
    if (session.bankState === 'DEPOSIT_PROMPT') {
        drawText(buffer, 3, 14, `[b][c:cyan]Deposit how much?[b][c:white] ${session.inputBuffer}_`);
    }
    else if (session.bankState === 'WITHDRAW_PROMPT') {
        drawText(buffer, 3, 14, `[b][c:cyan]Withdraw how much?[b][c:white] ${session.inputBuffer}_`);
    }
    else {
        drawText(buffer, 3, 14, `[b][c:cyan]Ledger Command>[b][c:white] ${session.inputBuffer}`);
    }
    drawText(buffer, 3, rows - 5, '[dim]Muscle memory: smash 3 to dump pocket gold before heading back out.[dim]');
    drawText(buffer, 3, rows - 4, session.notice ? `[c:yellow]${session.notice}[c:white]` : '[c:green]The clerk licks his thumb, then your coin, then your ledger.[c:white]');
    return { cols, rows, cells: toCells(buffer) };
}
