const DEFAULT_CELL = Object.freeze({
    char: ' ',
    fg: 'white',
    bg: 'black',
    bold: false,
    dim: false
});

function createCell() {
    return { ...DEFAULT_CELL };
}

export function createBuffer(cols, rows) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => createCell()));
}

export function toCells(buffer) {
    return buffer.map((row) => row.map((cell) => ({ ...cell })));
}

export function toLines(buffer) {
    return buffer.map((row) => row.map((cell) => cell.char).join(''));
}
