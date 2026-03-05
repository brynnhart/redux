export type ScreenBuffer = string[][];

export function createBuffer(cols: number, rows: number): ScreenBuffer {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
}

export function toLines(buffer: ScreenBuffer): string[] {
  return buffer.map((row) => row.join(''));
}
