import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { classLabel } from '../services/skillService.js';
import { getMasterForLevel, isEligibleForMasterChallenge } from '../services/trainingService.js';
import type { Session } from '../session.js';

interface Dimensions {
  cols: number;
  rows: number;
}

export function renderTraining(session: Session, dims: Dimensions) {
  const cols = Math.max(72, dims.cols);
  const rows = Math.max(24, dims.rows);
  const buffer = createBuffer(cols, rows);
  const player = session.player;

  drawBox(buffer, 0, 0, cols, rows);
  drawText(buffer, 3, 2, "Turgon's Warrior Training");
  drawText(buffer, 3, 4, '(Q) Question the master');
  drawText(buffer, 3, 5, '(A) Attack the master');
  drawText(buffer, 3, 6, '(H) Hall of Honor');
  drawText(buffer, 3, 7, '(C) Train Class Skills (once per day)');
  drawText(buffer, 3, 8, '(R/T) Return to town');

  drawText(buffer, 3, 10, 'You enter the mighty training hall. Steel rings. Someone yelps.');

  if (player) {
    const master = getMasterForLevel(player.level);
    const eligibility = isEligibleForMasterChallenge(player);
    drawText(buffer, 3, 12, `Class: ${classLabel(player.class)} | Level: ${player.level} | EXP: ${player.exp}`);
    drawText(buffer, 3, 13, `Current master: ${master ? `${master.name}, ${master.title}` : 'None (Dragon-ready)'}`);
    drawText(buffer, 3, 14, `Master challenge used today: ${player.training_challenge_used_today ? 'Yes' : 'No'}`);
    drawText(buffer, 3, 15, `Class training used today: ${player.training_challenge_used_today ? 'Yes' : 'No'}`);
    if (master && eligibility.requiredExp !== null) {
      drawText(
        buffer,
        3,
        16,
        eligibility.eligible
          ? 'Status: You are ready to challenge this master.'
          : `Status: Not ready. Need ${eligibility.expNeeded} more EXP.`
      );
    }
  }

  drawText(buffer, 3, rows - 4, session.notice || 'Turgon folds his arms and squints at you like you owe him money.');
  return { cols, rows, lines: toLines(buffer) };
}
