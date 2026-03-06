const screenEl = document.getElementById('screen');
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProtocol}://${location.host}/ws`);

const COLOR_TOKENS = new Set(['green', 'red', 'yellow', 'cyan', 'magenta', 'white']);
const STYLE_TOKENS = new Set(['dim', 'b']);
const TOKEN_REGEX = /\[(c:(?:green|red|yellow|cyan|magenta|white)|dim|b)\]/g;

function parseLineTokens(line) {
  TOKEN_REGEX.lastIndex = 0;
  const segments = [];
  const rawLine = String(line);
  let cursor = 0;
  const activeStyles = new Set();
  let match;

  while ((match = TOKEN_REGEX.exec(rawLine)) !== null) {
    if (match.index > cursor) {
      segments.push({
        text: rawLine.slice(cursor, match.index),
        styles: new Set(activeStyles)
      });
    }

    const token = match[1];

    if (token.startsWith('c:')) {
      for (const style of Array.from(activeStyles)) {
        if (style.startsWith('c:')) {
          activeStyles.delete(style);
        }
      }

      const color = token.slice(2);
      if (COLOR_TOKENS.has(color)) {
        activeStyles.add(`c:${color}`);
      }
    } else if (STYLE_TOKENS.has(token)) {
      if (activeStyles.has(token)) {
        activeStyles.delete(token);
      } else {
        activeStyles.add(token);
      }
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < rawLine.length) {
    segments.push({
      text: rawLine.slice(cursor),
      styles: new Set(activeStyles)
    });
  }

  return segments;
}

function createSegmentNode(segment) {
  if (segment.styles.size === 0) {
    return document.createTextNode(segment.text);
  }

  const span = document.createElement('span');
  span.textContent = segment.text;

  for (const style of segment.styles) {
    if (style.startsWith('c:')) {
      span.classList.add(`tok-color-${style.slice(2)}`);
    }

    if (style === 'dim') {
      span.classList.add('tok-dim');
    }

    if (style === 'b') {
      span.classList.add('tok-bold');
    }
  }

  return span;
}

function renderFrame(frame) {
  const fragment = document.createDocumentFragment();

  for (const [lineIndex, line] of frame.lines.entries()) {
    const segments = parseLineTokens(line);

    if (segments.length === 0) {
      fragment.appendChild(document.createTextNode(''));
    } else {
      for (const segment of segments) {
        fragment.appendChild(createSegmentNode(segment));
      }
    }

    if (lineIndex < frame.lines.length - 1) {
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
