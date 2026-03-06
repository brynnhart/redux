import { getWeaponById } from '../data/equipment.js';
import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { Session } from '../session.js';
import type { InnTarget } from '../services/innService.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderInn(session: Session, dims: Dimensions) {
  const cols = Math.max(80, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'The Inn');
  drawText(buffer, 3, 4, '(G) Get a room');
  drawText(buffer, 3, 5, '(T) Talk to bartender');
  drawText(buffer, 3, 6, '(S) Sit and listen to Seth Able');
  drawText(buffer, 3, 7, '(F) Flirt with Violet');
  drawText(buffer, 3, 8, '(C) Converse with patrons');
  drawText(buffer, 3, 9, '(O) The Old Man in the Corner');
  drawText(buffer, 3, 10, '(R) Return to Town');

  if (session.player) {
    drawText(buffer, 44, 4, `Gold: ${session.player.gold_on_hand}`);
    drawText(buffer, 44, 5, `Charm: ${session.player.charm}`);
    drawText(buffer, 44, 6, `Roomed: ${session.player.in_inn_room ? 'YES' : 'NO'}`);
    drawText(buffer, 44, 7, `Flirt used: ${session.player.inn_flirt_used_today ? 'YES' : 'NO'}`);
    drawText(buffer, 44, 8, `Seth listens: ${session.player.bard_listens_used_today}`);
    drawText(buffer, 44, 9, `Forest fights: ${session.player.turns_forest_left}/${session.player.turns_forest_max}`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'The hearth is warm and the gossip is loud.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderInnConverse(session: Session, dims: Dimensions) {
  const cols = Math.max(80, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Patrons');
  drawText(buffer, 3, 4, 'Nobody is saying anything interesting... yet.');
  drawText(buffer, 3, 6, '(R) Return to the Inn');

  drawText(buffer, 3, rows - 4, session.notice || 'Mugs clink. Someone snores by the fire.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderInnBartender(session: Session, dims: Dimensions) {
  const cols = Math.max(80, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Bartender');
  drawText(buffer, 3, 4, '(B) Bribe to break into rooms');
  drawText(buffer, 3, 5, '(A) Attack sleeping enemies');
  drawText(buffer, 3, 7, '(E) Exit');

  if (session.player) {
    drawText(buffer, 46, 4, `Gold: ${session.player.gold_on_hand}`);
    drawText(buffer, 46, 5, `Bribed today: ${session.player.inn_breakin_used_today ? 'YES' : 'NO'}`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'He polishes a mug that never gets clean.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderInnBreakIn(session: Session, dims: Dimensions, targets: InnTarget[]) {
  const cols = Math.max(80, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Slaughter in the Inn');

  if (targets.length === 0) {
    drawText(buffer, 3, 4, 'No eligible sleepers tonight.');
  } else {
    drawText(buffer, 3, 4, 'Choose a target:');
    const maxRows = Math.min(9, targets.length);
    for (let i = 0; i < maxRows; i += 1) {
      const target = targets[i]!;
      const weapon = getWeaponById(target.weapon_id);
      drawText(buffer, 3, 6 + i, `${i + 1}) ${target.display_name} L${target.level}  Weapon: ${weapon.name}`);
    }
  }

  drawText(buffer, 3, rows - 5, '(1-9) Choose target    (Q) Back');
  drawText(buffer, 3, rows - 4, session.notice || 'The hallway is quiet except for nervous breathing.');
  return { cols, rows, lines: toLines(buffer) };
}
