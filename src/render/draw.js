const SUPPORTED_COLORS = new Set(['green', 'red', 'yellow', 'cyan', 'magenta', 'white', 'blue']);
const TOKEN_REGEX = /\[(c:(?:green|red|yellow|cyan|magenta|white|blue)|dim|b)\]/g;

function tokenizeStyledText(text) {
    const rawText = String(text);
    TOKEN_REGEX.lastIndex = 0;

    const output = [];
    const styles = {
        fg: 'white',
        bold: false,
        dim: false
    };

    let cursor = 0;
    let match;

    while ((match = TOKEN_REGEX.exec(rawText)) !== null) {
        if (match.index > cursor) {
            const segment = rawText.slice(cursor, match.index);
            for (const char of segment) {
                output.push({
                    char,
                    fg: styles.fg,
                    bold: styles.bold,
                    dim: styles.dim
                });
            }
        }

        const token = match[1];
        if (token.startsWith('c:')) {
            const color = token.slice(2);
            if (SUPPORTED_COLORS.has(color)) {
                styles.fg = color;
            }
        }
        else if (token === 'b') {
            styles.bold = !styles.bold;
        }
        else if (token === 'dim') {
            styles.dim = !styles.dim;
        }

        cursor = match.index + match[0].length;
    }

    if (cursor < rawText.length) {
        const segment = rawText.slice(cursor);
        for (const char of segment) {
            output.push({
                char,
                fg: styles.fg,
                bold: styles.bold,
                dim: styles.dim
            });
        }
    }

    return output;
}

export function drawText(buffer, x, y, text) {
    if (y < 0 || y >= buffer.length) {
        return;
    }

    const row = buffer[y];
    const chars = tokenizeStyledText(text);

    for (let i = 0; i < chars.length; i += 1) {
        const col = x + i;
        if (col < 0 || col >= row.length) {
            continue;
        }

        const styledChar = chars[i];
        const cell = row[col];
        cell.char = styledChar.char;
        cell.fg = styledChar.fg;
        cell.bold = styledChar.bold;
        cell.dim = styledChar.dim;
    }
}

export function drawBox(buffer, x, y, w, h) {
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
