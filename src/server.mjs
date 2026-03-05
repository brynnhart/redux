import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const DB_PATH = './data/players.json';

function loadStore() {
  if (!existsSync(DB_PATH)) {
    return { players: [], nextId: 1 };
  }
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveStore(store) {
  writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
}

const store = loadStore();

function getOrCreatePlayer(username) {
  let player = store.players.find((p) => p.username.toLowerCase() === username.toLowerCase());
  if (!player) {
    const now = new Date().toISOString();
    player = {
      id: store.nextId++,
      username,
      level: 1,
      exp: 0,
      hp: 30,
      max_hp: 30,
      gold: 100,
      bank_gold: 0,
      gems: 0,
      charm: 0,
      spirits: 0,
      forest_fights: 5,
      pvp_fights: 1,
      weapon_tier: 0,
      armor_tier: 0,
      created_at: now,
      updated_at: now
    };
    store.players.push(player);
    saveStore(store);
  }
  return player;
}

function townOps(p) { return [
  { type: 'clear' },
  { type: 'title', text: '═══ Web LoRD :: The Realm Awaits ═══' },
  { type: 'line', text: `Hero: ${p.username}  Lvl:${p.level}  HP:${p.hp}/${p.max_hp}` },
  { type: 'line', text: `Gold:${p.gold}  Bank:${p.bank_gold}  Gems:${p.gems}  Charm:${p.charm}` },
  { type: 'line', text: `Forest Fights:${p.forest_fights}  PvP:${p.pvp_fights}  Spirits:${p.spirits}` },
  { type: 'line', text: '' },
  { type: 'line', text: '[F] Forest (coming soon)' },
  { type: 'line', text: '[B] Bank' },
  { type: 'line', text: '[I] Inn (coming soon)' },
  { type: 'line', text: '[Q] Quit session' },
  { type: 'prompt', text: 'Town > ' }
]; }

function loginOps() { return [
  { type: 'clear' },
  { type: 'title', text: '═══ Web LoRD :: The Realm Awaits ═══' },
  { type: 'line', text: '' },
  { type: 'line', text: 'Welcome, traveler.' },
  { type: 'line', text: 'Enter your hero name to continue:' },
  { type: 'prompt', text: '> ' }
]; }

function bankOps(p) { return [
  { type: 'clear' },
  { type: 'title', text: 'Iron Bank of Web LoRD' },
  { type: 'line', text: '' },
  { type: 'line', text: `Gold on hand: ${p.gold}` },
  { type: 'line', text: `Gold in bank: ${p.bank_gold}` },
  { type: 'line', text: '' },
  { type: 'line', text: 'Bank actions are part of Milestone 3.' },
  { type: 'line', text: 'Press [T] to return to Town Square.' },
  { type: 'prompt', text: 'Bank > ' }
]; }

function wsAcceptValue(key) {
  return createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function encodeWsText(text) {
  const payload = Buffer.from(text);
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}

function decodeWsText(buffer) {
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x8) return null;
  if (opcode !== 0x1) return undefined;
  const second = buffer[1];
  const masked = Boolean(second & 0x80);
  let len = second & 0x7f;
  let offset = 2;
  if (len === 126) { len = buffer.readUInt16BE(offset); offset += 2; }
  else if (len === 127) { len = Number(buffer.readBigUInt64BE(offset)); offset += 8; }
  let payload = buffer.subarray(offset, offset + len);
  if (masked) {
    const mask = payload.subarray(0, 4);
    payload = payload.subarray(4);
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
  }
  return payload.toString('utf8');
}

const html = readFileSync('./public/index.html', 'utf8');
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  res.writeHead(404).end('Not found');
});

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') return socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  socket.write(['HTTP/1.1 101 Switching Protocols','Upgrade: websocket','Connection: Upgrade',`Sec-WebSocket-Accept: ${wsAcceptValue(key)}`,'\r\n'].join('\r\n'));

  const state = { mode: 'login', player: null };
  const send = (ops) => socket.write(encodeWsText(JSON.stringify({ type: 'screen', ops })));
  send(loginOps());

  socket.on('data', (chunk) => {
    const decoded = decodeWsText(Buffer.from(chunk));
    if (decoded === null) return socket.end();
    if (!decoded) return;
    let msg;
    try { msg = JSON.parse(decoded); } catch { return; }
    if (msg.type !== 'input' && msg.type !== 'key') return;
    const value = String((msg.type === 'input' ? msg.text : msg.key) ?? '').trim();

    if (state.mode === 'login') {
      if (!value) return send(loginOps());
      state.player = getOrCreatePlayer(value);
      state.mode = 'town';
      return send(townOps(state.player));
    }
    if (!state.player) { state.mode = 'login'; return send(loginOps()); }

    const keyInput = value.toUpperCase();
    if (state.mode === 'town') {
      if (keyInput === 'B') { state.mode = 'bank'; return send(bankOps(state.player)); }
      if (keyInput === 'Q') return socket.end();
      return send(townOps(state.player));
    }

    if (state.mode === 'bank') {
      if (keyInput === 'T') { state.mode = 'town'; return send(townOps(state.player)); }
      return send(bankOps(state.player));
    }
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Web LoRD listening on http://0.0.0.0:3000');
});
