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
  drawText(buffer, 3, 4, '(B) Bartender');
  drawText(buffer, 3, 5, '(S) Seth Able / Bard');
  drawText(buffer, 3, 6, '(F) Flirt with Violet');
  drawText(buffer, 3, 7, '(R) Rent a room');
  drawText(buffer, 3, 8, '(L) List patrons / rumors');
  drawText(buffer, 3, 9, '(Q) Quit to Town');

  if (session.player) {
    drawText(buffer, 42, 4, `Gold: ${session.player.gold}`);
    drawText(buffer, 42, 5, `Gems: ${session.player.gems}`);
    drawText(buffer, 42, 6, `Elixirs: ${session.player.elixirs}`);
    drawText(buffer, 42, 7, `Charm: ${session.player.charm}`);
    drawText(buffer, 42, 8, `Roomed: ${session.player.has_room ? 'YES' : 'NO'}`);
    drawText(buffer, 42, 9, `Flirted: ${session.player.has_flirted_today ? 'YES' : 'NO'}`);
    drawText(buffer, 42, 10, `Bard: ${session.player.has_listened_bard_today ? 'YES' : 'NO'}`);
  }

  drawText(buffer, 3, rows - 4, session.notice || 'The hearth is warm and the gossip is loud.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderInnFlirt(session: Session, dims: Dimensions) {
  const cols = Math.max(80, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Violet');
  drawText(buffer, 3, 4, 'How do you approach her?');
  drawText(buffer, 3, 6, '1) Talk sweet');
  drawText(buffer, 3, 7, '2) Act cocky');
  drawText(buffer, 3, 8, '3) Be weird');
  drawText(buffer, 3, 10, 'Q) Back to Inn');

  drawText(buffer, 3, rows - 4, session.notice || 'She waits, amused.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderInnBartender(session: Session, dims: Dimensions) {
  const cols = Math.max(80, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Bartender');
  drawText(buffer, 3, 4, '1) Buy elixir (1000 gold)');
  drawText(buffer, 3, 5, '2) Trade gems for elixir (2 gems -> 1)');
  drawText(buffer, 3, 6, '3) Change name (stub)');
  drawText(buffer, 3, 7, '4) Bribe for room break-ins (2000 gold)');
  drawText(buffer, 3, 8, 'A) Attack sleepers (if bribed)');
  drawText(buffer, 3, 10, 'Q) Back');

  if (session.player) {
    drawText(buffer, 46, 4, `Gold: ${session.player.gold}`);
    drawText(buffer, 46, 5, `Gems: ${session.player.gems}`);
    drawText(buffer, 46, 6, `Elixirs: ${session.player.elixirs}`);
    drawText(buffer, 46, 7, `Bribed today: ${session.player.inn_breakin_used_today ? 'YES' : 'NO'}`);
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
