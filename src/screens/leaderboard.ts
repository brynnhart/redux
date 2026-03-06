import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import type { OldManCategory, OldManTopRecord, RankingRecord } from '../repos/playerRepo.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

function fmt(value: number) {
  return value.toLocaleString('en-US');
}

function playerRowPrefix(session: Session, id: string) {
  return session.playerId === id ? '>' : ' ';
}

function findRank<T extends { id: string }>(rows: T[], playerId?: string) {
  if (!playerId) return null;
  const idx = rows.findIndex((row) => row.id === playerId);
  return idx >= 0 ? idx + 1 : null;
}

export function renderPlayerRankings(session: Session, dims: Dimensions, rowsData: RankingRecord[]) {
  const cols = Math.max(90, dims.cols);
  const rows = Math.max(25, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Player Rankings');
  drawText(buffer, 3, 4, ' Rk Name                 Deeds Lap Lvl Class         EXP          Alive');

  const maxRows = Math.min(rowsData.length, rows - 11);
  for (let i = 0; i < maxRows; i += 1) {
    const p = rowsData[i]!;
    const line = `${playerRowPrefix(session, p.id)}${String(i + 1).padStart(3)} ${p.display_name.slice(0, 20).padEnd(20)} ${String(p.heroic_deeds_done).padStart(5)} ${String(p.current_lap).padStart(3)} ${String(p.level).padStart(3)} ${p.class.slice(0, 12).padEnd(12)} ${fmt(p.exp).padStart(12)} ${p.is_alive ? 'Alive' : 'Dead '}`;
    drawText(buffer, 3, 6 + i, line);
  }

  if (rowsData.length === 0) {
    drawText(buffer, 3, 6, 'No warriors yet.');
  }

  const yourRank = findRank(rowsData, session.playerId);
  drawText(buffer, 3, rows - 5, yourRank ? `You are ranked #${yourRank}.` : 'You are unranked.');
  drawText(buffer, 3, rows - 4, session.notice || 'Press Enter or Q to return to town.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderHeroicDeedsRankings(session: Session, dims: Dimensions, rowsData: RankingRecord[]) {
  const cols = Math.max(90, dims.cols);
  const rows = Math.max(25, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'Heroic Deeds Done');
  drawText(buffer, 3, 4, ' Rk Player               Deeds Lvl        EXP  Last Active');

  const maxRows = Math.min(rowsData.length, rows - 11);
  for (let i = 0; i < maxRows; i += 1) {
    const p = rowsData[i]!;
    const day = p.last_login_at ? p.last_login_at.slice(0, 10) : 'never';
    const line = `${playerRowPrefix(session, p.id)}${String(i + 1).padStart(3)} ${p.display_name.slice(0, 20).padEnd(20)} ${String(p.heroic_deeds_done).padStart(5)} ${String(p.level).padStart(3)} ${fmt(p.exp).padStart(10)}  ${day}`;
    drawText(buffer, 3, 6 + i, line);
  }

  if (rowsData.length === 0) {
    drawText(buffer, 3, 6, 'No deeds recorded yet.');
  }

  const yourRank = findRank(rowsData, session.playerId);
  drawText(buffer, 3, rows - 5, yourRank ? `You are ranked #${yourRank}.` : 'You are unranked.');
  drawText(buffer, 3, rows - 4, session.notice || 'Press Enter or Q to return to rankings.');
  return { cols, rows, lines: toLines(buffer) };
}

export function renderOldManMenu(session: Session, dims: Dimensions) {
  const cols = Math.max(80, dims.cols);
  const rows = Math.max(25, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, 'The Old Man in the Corner');
  drawText(buffer, 3, 4, '(1) Most Player Kills');
  drawText(buffer, 3, 5, '(2) Most Times Laid');
  drawText(buffer, 3, 6, '(3) Most Dragons Slain');
  drawText(buffer, 3, 7, '(4) Richest in Bank');
  drawText(buffer, 3, 8, '(5) Strongest');
  drawText(buffer, 3, 10, '(R/Q) Return to Inn');
  drawText(buffer, 3, rows - 4, session.notice || 'Pick a list and let the old man judge everyone.');
  return { cols, rows, lines: toLines(buffer) };
}

function oldManLabel(category: OldManCategory | undefined) {
  switch (category) {
    case 'kills':
      return 'Most Player Kills';
    case 'laid':
      return 'Most Times Laid';
    case 'dragons':
      return 'Most Dragons Slain';
    case 'bank':
      return 'Richest in Bank';
    case 'strongest':
      return 'Strongest';
    default:
      return 'Top List';
  }
}

export function renderOldManTopList(
  session: Session,
  dims: Dimensions,
  category: OldManCategory | undefined,
  rowsData: OldManTopRecord[]
) {
  const cols = Math.max(90, dims.cols);
  const rows = Math.max(25, dims.rows);
  const buffer = createBuffer(cols, rows);

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, `Old Man Rankings: ${oldManLabel(category)}`);

  let header = ' Rk Name                 Value';
  if (category === 'strongest') {
    header = ' Rk Name                 Score';
  }
  drawText(buffer, 3, 4, header);

  const maxRows = Math.min(rowsData.length, rows - 11);
  for (let i = 0; i < maxRows; i += 1) {
    const p = rowsData[i]!;
    let value = p.player_kills;
    if (category === 'laid') value = p.times_laid;
    if (category === 'dragons') value = p.heroic_deeds_done;
    if (category === 'bank') value = p.gold_in_bank;
    if (category === 'strongest') value = p.score;

    const line = `${playerRowPrefix(session, p.id)}${String(i + 1).padStart(3)} ${p.display_name.slice(0, 20).padEnd(20)} ${fmt(value).padStart(15)}`;
    drawText(buffer, 3, 6 + i, line);
  }

  if (rowsData.length === 0) {
    drawText(buffer, 3, 6, 'Nobody has made this list yet.');
  }

  const yourRank = findRank(rowsData, session.playerId);
  drawText(buffer, 3, rows - 5, yourRank ? `You are ranked #${yourRank}.` : 'You are unranked.');
  drawText(buffer, 3, rows - 4, session.notice || 'Press Enter or Q to return to the old man.');
  return { cols, rows, lines: toLines(buffer) };
}
