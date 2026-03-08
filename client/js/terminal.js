/* client/js/terminal.js */

'use strict';

// ── Auth check ────────────────────────────────────────────────────────────────

const token = sessionStorage.getItem('lord_token');
if (!token) {
  window.location.href = 'index.html';
}

// ── xterm.js setup ────────────────────────────────────────────────────────────

const term = new Terminal({
  cols            : 80,
  rows            : 24,
  fontFamily      : '"Courier New", Courier, monospace',
  fontSize        : 16,
  theme: {
    background    : '#000000',
    foreground    : '#cccccc',
    cursor        : '#cccccc',
    black         : '#000000',
    red           : '#cc2200',
    green         : '#22aa44',
    yellow        : '#cc9900',
    blue          : '#2244cc',
    magenta       : '#882288',
    cyan          : '#228888',
    white         : '#cccccc',
    brightBlack   : '#555555',
    brightRed     : '#ff4422',
    brightGreen   : '#44cc66',
    brightYellow  : '#ffcc00',
    brightBlue    : '#4466ff',
    brightMagenta : '#cc44cc',
    brightCyan    : '#44cccc',
    brightWhite   : '#ffffff',
  },
  cursorBlink     : true,
  scrollback      : 500,
  convertEol      : false,
  disableStdin    : true,   // We handle input ourselves via WebSocket
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

window.addEventListener('resize', () => fitAddon.fit());

// ── WebSocket connection ──────────────────────────────────────────────────────

const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws       = new WebSocket(`${protocol}://${location.host}/ws`);

ws.addEventListener('open', () => {
  // Authenticate immediately
  ws.send(JSON.stringify({ type: 'auth', token }));
});

ws.addEventListener('message', (evt) => {
  let msg;
  try { msg = JSON.parse(evt.data); } catch { return; }

  switch (msg.type) {
    case 'output':
      term.write(msg.data);
      break;

    case 'error':
      term.write(`\r\n\x1b[31m[Error] ${msg.message}\x1b[0m\r\n`);
      if (msg.message === 'Invalid token' || msg.message === 'Auth timeout') {
        sessionStorage.removeItem('lord_token');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
      }
      break;
  }
});

ws.addEventListener('close', () => {
  term.write('\r\n\x1b[33m[Disconnected from server]\x1b[0m\r\n');
});

ws.addEventListener('error', () => {
  term.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n');
});

// ── Keyboard input ─────────────────────────────────────────────────────────────

/**
 * Capture keypresses and forward them to the server over WebSocket.
 * The terminal is in "remote echo" mode — the server controls what appears.
 */
document.addEventListener('keydown', (evt) => {
  if (ws.readyState !== WebSocket.OPEN) return;

  // Don't capture browser shortcuts
  if (evt.ctrlKey && (evt.key === 'c' || evt.key === 'v' || evt.key === 'a')) return;

  let key = null;

  if (evt.key.length === 1) {
    key = evt.key;
  } else {
    // Map special keys to their escape sequences / control chars
    const SPECIAL = {
      'Enter'     : '\r',
      'Backspace' : '\x08',
      'Delete'    : '\x7f',
      'Escape'    : '\x1b',
      'Tab'       : '\t',
      'ArrowUp'   : '\x1b[A',
      'ArrowDown' : '\x1b[B',
      'ArrowRight': '\x1b[C',
      'ArrowLeft' : '\x1b[D',
      'Home'      : '\x1b[H',
      'End'       : '\x1b[F',
      'PageUp'    : '\x1b[5~',
      'PageDown'  : '\x1b[6~',
    };
    key = SPECIAL[evt.key] || null;
  }

  if (key) {
    evt.preventDefault();
    ws.send(JSON.stringify({ type: 'key', key }));
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

document.getElementById('btn-logout').addEventListener('click', () => {
  ws.close();
  sessionStorage.removeItem('lord_token');
  window.location.href = 'index.html';
});
