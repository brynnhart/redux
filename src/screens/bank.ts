import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { config } from '../config.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderBank(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);
  const player = session.player;

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Ye Olde Bank');

  if (player) {
    const onHand = player.gold_on_hand ?? player.gold_pocket ?? player.gold;
    const inBank = player.gold_in_bank ?? player.gold_bank ?? player.bank_gold;
    drawText(buffer, 3, 4, `On hand: ${onHand} gold`);
    drawText(buffer, 3, 5, `In bank: ${inBank} gold`);
    drawText(buffer, 3, 6, `Daily interest: ${(config.bankInterestRate * 100).toFixed(0)}%`);
  }

  drawText(buffer, 3, 8, '(D) Deposit');
  drawText(buffer, 3, 9, '(W) Withdraw');
  drawText(buffer, 3, 10, '(1) Deposit ALL');
  drawText(buffer, 3, 11, '(2) Withdraw ALL');
  drawText(buffer, 3, 12, '(R) Return to Town');

  if (session.bankState === 'DEPOSIT_PROMPT') {
    drawText(buffer, 3, 14, `Deposit how much? (1=All, R=Return) ${session.inputBuffer}_`);
  } else if (session.bankState === 'WITHDRAW_PROMPT') {
    drawText(buffer, 3, 14, `Withdraw how much? (2=All, R=Return) ${session.inputBuffer}_`);
  } else {
    drawText(buffer, 3, 14, `Command> ${session.inputBuffer}`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'You stash your gold where thieves can\'t easily sniff it.');

  return { cols, rows, lines: toLines(buffer) };
}
