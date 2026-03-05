import type { ScreenBuffer } from './buffer.js';

export function drawText(buffer: ScreenBuffer, x: number, y: number, text: string): void {
  if (y < 0 || y >= buffer.length) {
    return;
  }

  const row = buffer[y];
  for (let i = 0; i < text.length; i += 1) {
    const col = x + i;
    if (col < 0 || col >= row.length) {
      continue;
    }
    row[col] = text[i];
  }
}

export function drawBox(buffer: ScreenBuffer, x: number, y: number, w: number, h: number): void {
  if (w < 2 || h < 2) {
    return;
  }

  const horizontal = '-'.repeat(Math.max(0, w - 2));
  drawText(buffer, x + 1, y, horizontal);
  drawText(buffer, x + 1, y + h - 1, horizontal);

  for (let row = y + 1; row < y + h - 1; row += 1) {
    drawText(buffer, x, row, '|');
    drawText(buffer, x + w - 1, row, '|');
  }

  drawText(buffer, x, y, '+');
  drawText(buffer, x + w - 1, y, '+');
  drawText(buffer, x, y + h - 1, '+');
  drawText(buffer, x + w - 1, y + h - 1, '+');
}
