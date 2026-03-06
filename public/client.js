const screenEl = document.getElementById('screen');
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProtocol}://${location.host}/ws`);

const RESPONSE_DELAY_MS = 90;
const BLOCK_CURSOR = '█';

let lastFrame = null;
let lastUi = null;
let pendingMenuEcho = '';
let waitingForServerOutput = false;
let cursorBlinkOn = true;

function styleKey(cell) {
  return `${cell.fg}|${cell.bold ? '1' : '0'}|${cell.dim ? '1' : '0'}`;
}

function createStyledSpan(text, cellStyle) {
  if (!text) {
    return null;
  }

  if (!cellStyle || (!cellStyle.bold && !cellStyle.dim && cellStyle.fg === 'white')) {
    return document.createTextNode(text);
  }

  const span = document.createElement('span');
  span.textContent = text;

  if (cellStyle.fg) {
    span.classList.add(`tok-color-${cellStyle.fg}`);
  }

  if (cellStyle.dim) {
    span.classList.add('tok-dim');
  }

  if (cellStyle.bold) {
    span.classList.add('tok-bold');
  }

  return span;
}

function cellsToRows(cells) {
  const rows = Array.isArray(cells) ? cells : [];
  return rows.map((row) => row.map((cell) => ({ ...cell, char: cell.char ?? ' ' })));
}

function findCursorPosition(rows, ui) {
  const displayInput = ui?.hiddenInput ? '*'.repeat(ui.inputBuffer.length) : ui?.inputBuffer ?? '';

  if (displayInput.length > 0) {
    for (let r = rows.length - 1; r >= 0; r -= 1) {
      const rowText = rows[r].map((cell) => cell.char).join('');
      const idx = rowText.lastIndexOf(displayInput);
      if (idx !== -1) {
        return { row: r, col: Math.min(rows[r].length - 1, idx + displayInput.length) };
      }
    }
  }

  for (let r = rows.length - 1; r >= 0; r -= 1) {
    for (let c = rows[r].length - 1; c >= 0; c -= 1) {
      if (rows[r][c].char === '_') {
        return { row: r, col: c };
      }
    }
  }

  const lastRow = rows.length - 1;
  return { row: lastRow, col: Math.max(0, rows[lastRow].length - 1) };
}

function applyLocalEcho(rows, ui) {
  if (!pendingMenuEcho || ui?.inputMode !== 'MENU' || rows.length === 0) {
    return;
  }

  let targetRow = rows.length - 1;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].some((cell) => cell.char !== ' ')) {
      targetRow = i;
      break;
    }
  }

  const row = rows[targetRow];
  let insertCol = row.length - 1;
  while (insertCol > 0 && row[insertCol].char === ' ') {
    insertCol -= 1;
  }
  insertCol = Math.min(row.length - 1, insertCol + 2);

  for (let i = 0; i < pendingMenuEcho.length && insertCol + i < row.length; i += 1) {
    row[insertCol + i].char = pendingMenuEcho[i];
  }
}

function renderFrame(frame, ui) {
  const rows = cellsToRows(frame?.cells);
  if (rows.length === 0) {
    screenEl.textContent = '';
    return;
  }

  applyLocalEcho(rows, ui);

  const showCursor = !waitingForServerOutput && cursorBlinkOn && ui?.inputMode !== null;
  if (showCursor) {
    const { row, col } = findCursorPosition(rows, ui);
    if (rows[row]?.[col]) {
      rows[row][col].char = BLOCK_CURSOR;
    }
  }

  const fragment = document.createDocumentFragment();

  for (const [rowIndex, row] of rows.entries()) {
    let currentStyle = null;
    let currentText = '';

    for (const cell of row) {
      const nextStyle = {
        fg: cell.fg || 'white',
        bold: Boolean(cell.bold),
        dim: Boolean(cell.dim)
      };

      if (!currentStyle) {
        currentStyle = nextStyle;
        currentText = cell.char;
        continue;
      }

      if (styleKey(currentStyle) === styleKey(nextStyle)) {
        currentText += cell.char;
      } else {
        const node = createStyledSpan(currentText, currentStyle);
        if (node) {
          fragment.appendChild(node);
        }
        currentStyle = nextStyle;
        currentText = cell.char;
      }
    }

    const node = createStyledSpan(currentText, currentStyle);
    if (node) {
      fragment.appendChild(node);
    }

    if (rowIndex < rows.length - 1) {
      fragment.appendChild(document.createElement('br'));
    }
  }

  screenEl.replaceChildren(fragment);
}

function rerender() {
  if (lastFrame) {
    renderFrame(lastFrame, lastUi);
  }
}

function sendResize() {
  const cols = Math.max(20, Math.floor(window.innerWidth / 10));
  const rows = Math.max(10, Math.floor(window.innerHeight / 20));
  ws.send(JSON.stringify({ type: 'resize', cols, rows }));
}

ws.addEventListener('open', () => {
  sendResize();
});

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'screen') {
    lastFrame = msg.frame;
    lastUi = msg.ui ?? { inputMode: 'MENU', hiddenInput: false, inputBuffer: '' };
    waitingForServerOutput = false;
    pendingMenuEcho = '';
    rerender();
  }
});

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
  }

  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const outbound = {
    type: 'key',
    key: event.key,
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey
  };

  const isSingleMenuKey =
    lastUi?.inputMode === 'MENU' && event.key.length === 1 && !event.ctrlKey && !event.altKey;

  if (isSingleMenuKey) {
    pendingMenuEcho = event.key;
    rerender();
  }

  setTimeout(() => {
    waitingForServerOutput = true;
    rerender();
    ws.send(JSON.stringify(outbound));
  }, RESPONSE_DELAY_MS);
});

window.addEventListener('resize', () => {
  if (ws.readyState === WebSocket.OPEN) {
    sendResize();
  }
});

setInterval(() => {
  cursorBlinkOn = !cursorBlinkOn;
  rerender();
}, 500);
