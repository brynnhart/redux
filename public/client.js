const screenEl = document.getElementById('screen');
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProtocol}://${location.host}/ws`);

const RESPONSE_DELAY_MS = 90;
const BLOCK_CURSOR = '█';


const visualConfig = {
  enableCrtEffects: true,
  crtStorageKey: 'web-lord-crt-effects'
};

function loadCrtPreference() {
  const stored = localStorage.getItem(visualConfig.crtStorageKey);
  if (stored === 'off') {
    visualConfig.enableCrtEffects = false;
  } else if (stored === 'on') {
    visualConfig.enableCrtEffects = true;
  }
}

function applyCrtClass() {
  document.body.classList.toggle('crt-effects-enabled', visualConfig.enableCrtEffects);
}

function toggleCrtEffects() {
  visualConfig.enableCrtEffects = !visualConfig.enableCrtEffects;
  localStorage.setItem(visualConfig.crtStorageKey, visualConfig.enableCrtEffects ? 'on' : 'off');
  applyCrtClass();
}

loadCrtPreference();
applyCrtClass();
const clientConfig = {
  defaultSlowPrintMsPerChar: 16,
  defaultPauseAfterLineMs: 300,
  enableSlowPrint: true,
  enableEnterPauses: true
};

let lastFrame = null;
let lastUi = null;
let pendingMenuEcho = '';
let waitingForServerOutput = false;
let cursorBlinkOn = true;
let suppressNextEnterToServer = false;

const printQueue = {
  queue: [],
  active: null,
  timer: null
};

const utilityScreens = new Set([
  'WELCOME',
  'LOGIN',
  'NEW_CHARACTER',
  'TOWN',
  'TOWN_SQUARE',
  'WEAPONS_SHOP',
  'ARMOR_SHOP',
  'BANK',
  'HEALER',
  'PLAYER_RANKINGS',
  'HEROIC_DEEDS_RANKINGS',
  'OLD_MAN_MENU',
  'OLD_MAN_TOP_LIST',
  'HALL_OF_HONOR'
]);

const dramaticScreens = new Set([
  'FOREST',
  'SLAUGHTER_FIELDS',
  'DAILY_HAPPENINGS',
  'INN',
  'INN_BARTENDER',
  'INN_BREAK_IN',
  'INN_CONVERSE',
  'TRAINING'
]);

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

function clearPrintTimer() {
  if (printQueue.timer) {
    clearTimeout(printQueue.timer);
    printQueue.timer = null;
  }
}

function completeActivePrintJob() {
  const job = printQueue.active;
  if (!job) {
    return;
  }

  job.revealed = job.text;
  job.index = job.text.length;
  job.mode = 'done';

  if (job.pauseAfterMs > 0) {
    clearPrintTimer();
    printQueue.timer = setTimeout(() => {
      if (job.waitForEnter && clientConfig.enableEnterPauses) {
        job.mode = 'wait_enter';
      } else {
        printQueue.active = null;
      }
      rerender();
      processPrintQueue();
    }, job.pauseAfterMs);
    return;
  }

  if (job.waitForEnter && clientConfig.enableEnterPauses) {
    job.mode = 'wait_enter';
  } else {
    printQueue.active = null;
  }

  rerender();
  processPrintQueue();
}

function processPrintQueue() {
  if (printQueue.active || printQueue.queue.length === 0) {
    return;
  }

  const next = printQueue.queue.shift();
  printQueue.active = {
    ...next,
    index: next.mode === 'instant' ? next.text.length : 0,
    revealed: next.mode === 'instant' ? next.text : '',
    mode: next.mode === 'instant' ? 'done' : 'printing'
  };

  if (printQueue.active.mode === 'done') {
    completeActivePrintJob();
    return;
  }

  const tick = () => {
    const active = printQueue.active;
    if (!active || active.mode !== 'printing') {
      return;
    }

    active.index += 1;
    active.revealed = active.text.slice(0, active.index);
    rerender();

    if (active.index >= active.text.length) {
      completeActivePrintJob();
      return;
    }

    clearPrintTimer();
    printQueue.timer = setTimeout(tick, active.speed);
  };

  clearPrintTimer();
  printQueue.timer = setTimeout(tick, printQueue.active.speed);
}

function resetPrintQueue() {
  clearPrintTimer();
  printQueue.queue = [];
  printQueue.active = null;
}

function enqueuePrintJob(job) {
  printQueue.queue.push(job);
  processPrintQueue();
}

function shouldUseSlowPrint(ui, notice) {
  if (!clientConfig.enableSlowPrint || !notice) {
    return false;
  }

  const screenState = ui?.screenState ?? '';
  if (utilityScreens.has(screenState)) {
    return false;
  }

  if (dramaticScreens.has(screenState)) {
    return true;
  }

  return /(dragon|defeat|victory|killed|slain|rescue|olivia|weird|event|master|death|daily news|reading the realm news|press \[enter\]|press enter)/i.test(notice);
}

function shouldWaitForEnter(ui, notice) {
  if (!clientConfig.enableEnterPauses || !notice) {
    return false;
  }

  const screenState = ui?.screenState ?? '';
  if (screenState === 'DAILY_HAPPENINGS') {
    return (notice.length > 80) || /showing entries|realm news|highlight|killed|dragon|defeated/i.test(notice);
  }

  return /(dragon|victory|defeat|killed|slain|dies|death|rescue|olivia|master|challenge|event)/i.test(notice);
}

function handleIncomingNotice(frame, ui) {
  const notice = ui?.notice ?? '';
  const previous = lastUi?.notice ?? '';

  if (!notice || notice === previous) {
    return;
  }

  resetPrintQueue();

  const mode = shouldUseSlowPrint(ui, notice) ? 'slow' : 'instant';
  enqueuePrintJob({
    text: notice,
    sourceText: notice,
    mode,
    speed: clientConfig.defaultSlowPrintMsPerChar,
    pauseAfterMs: clientConfig.defaultPauseAfterLineMs,
    waitForEnter: shouldWaitForEnter(ui, notice)
  });
}

function applyPrintQueueOverlay(rows) {
  const active = printQueue.active;
  if (!active || !active.sourceText || rows.length === 0) {
    return;
  }

  const renderText = active.mode === 'wait_enter'
    ? `${active.revealed}   Press ENTER to continue`
    : active.revealed;

  for (const row of rows) {
    const rowText = row.map((cell) => cell.char).join('');
    const idx = rowText.indexOf(active.sourceText);
    if (idx === -1) {
      continue;
    }

    for (let i = 0; i < active.sourceText.length && idx + i < row.length; i += 1) {
      row[idx + i].char = ' ';
    }

    for (let i = 0; i < renderText.length && idx + i < row.length; i += 1) {
      row[idx + i].char = renderText[i];
    }
    break;
  }
}

function renderFrame(frame, ui) {
  const rows = cellsToRows(frame?.cells);
  if (rows.length === 0) {
    screenEl.textContent = '';
    return;
  }

  applyLocalEcho(rows, ui);
  applyPrintQueueOverlay(rows);

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
    handleIncomingNotice(msg.frame, msg.ui ?? {});
    lastFrame = msg.frame;
    lastUi = msg.ui ?? { inputMode: 'MENU', hiddenInput: false, inputBuffer: '' };
    waitingForServerOutput = false;
    pendingMenuEcho = '';
    rerender();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'F2') {
    event.preventDefault();
    toggleCrtEffects();
    return;
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
  }

  const isEnterOrSpace = event.key === 'Enter' || event.key === ' ';
  const active = printQueue.active;

  if (active?.mode === 'printing' && isEnterOrSpace) {
    completeActivePrintJob();
    suppressNextEnterToServer = true;
    return;
  }

  if (active?.mode === 'wait_enter' && isEnterOrSpace) {
    printQueue.active = null;
    suppressNextEnterToServer = true;
    rerender();
    processPrintQueue();
    return;
  }

  if (suppressNextEnterToServer && isEnterOrSpace) {
    suppressNextEnterToServer = false;
    return;
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
