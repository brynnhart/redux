export function createBuffer(cols, rows) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
}
export function toLines(buffer) {
    return buffer.map((row) => row.join(''));
}
