import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { Session } from '../session.js';
import type { InnTarget } from '../services/innService.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderInn(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'The Inn');
  drawText(buffer, 3, 4, '(V) Flirt with Violet');
  drawText(buffer, 3, 5, '(S) Listen to Seth Able');
  drawText(buffer, 3, 6, '(R) Rent a room');
  drawText(buffer, 3, 7, '(T) Talk to the Bartender');
  drawText(buffer, 3, 8, '(Q) Return to Town');

  if (session.player) {
    drawText(buffer, 40, 4, `Gold: ${session.player.gold}`);
    drawText(buffer, 40, 5, `Charm: ${session.player.charm}`);
    drawText(buffer, 40, 6, `Room: ${session.player.has_room ? 'YES' : 'NO'}`);
    drawText(buffer, 40, 7, `Flirt used: ${session.player.daily_flirt_used ? 'YES' : 'NO'}`);
    drawText(buffer, 40, 8, `Bard used: ${session.player.daily_bard_used ? 'YES' : 'NO'}`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'The hearth is warm and the gossip is loud.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderInnBartender(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Bartender');
  drawText(buffer, 3, 4, 'Bartender squints at you.');
  drawText(buffer, 3, 6, '(B) Bribe bartender (enter the Inn)');
  drawText(buffer, 3, 7, '(N) Change your name (stub)');
  drawText(buffer, 3, 8, '(Q) Back');

  drawText(buffer, 3, rows - 4, session.notice || 'He polishes a mug that never gets clean.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderInnBreakIn(session: Session, dims: Dimensions, targets: InnTarget[]) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Inn Break-In');

  if (targets.length === 0) {
    drawText(buffer, 3, 4, 'No valid victims right now.');
  } else {
    drawText(buffer, 3, 4, 'Choose a victim by number:');
    const maxRows = Math.min(12, targets.length);
    for (let i = 0; i < maxRows; i += 1) {
      const target = targets[i]!;
      const roomTag = target.has_room ? ' [ROOM]' : '';
      drawText(buffer, 3, 6 + i, `${i + 1}) ${target.display_name} (Lvl ${target.level})${roomTag}`);
    }
  }

  drawText(buffer, 3, rows - 5, '(1-9) Select target   (Q) Back to Bartender');
  drawText(buffer, 3, rows - 4, session.notice || 'The bartender watches and counts your coins.');
  return { cols, rows, lines: toLines(buffer) };
}
