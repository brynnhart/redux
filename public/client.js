const screenEl = document.getElementById('screen');
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProtocol}://${location.host}/ws`);

function renderFrame(frame) {
  screenEl.textContent = frame.lines.join('\n');
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
