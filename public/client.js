const screenEl = document.getElementById('screen');
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProtocol}://${location.host}/ws`);

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

function renderFrame(frame) {
  const fragment = document.createDocumentFragment();
  const rows = Array.isArray(frame.cells) ? frame.cells : [];

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
        currentText = cell.char ?? ' ';
        continue;
      }

      if (styleKey(currentStyle) === styleKey(nextStyle)) {
        currentText += cell.char ?? ' ';
      } else {
        const node = createStyledSpan(currentText, currentStyle);
        if (node) {
          fragment.appendChild(node);
        }
        currentStyle = nextStyle;
        currentText = cell.char ?? ' ';
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
    renderFrame(msg.frame);
  }
});

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
  }

  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(
    JSON.stringify({
      type: 'key',
      key: event.key,
      code: event.code,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey
    })
  );
});

window.addEventListener('resize', () => {
  if (ws.readyState === WebSocket.OPEN) {
    sendResize();
  }
});
