# Web LoRD

Ticket 000 scaffold for a WebSocket-driven browser terminal.

## Features

- Fastify server in TypeScript.
- Static frontend served from `public/`.
- WebSocket endpoint at `/ws`.
- Minimal JSON protocol (`key`, `resize`, `screen`).
- Per-connection session state (`id`, `cols`, `rows`, `lastKey`).
- Full-frame screen redraw with a simple text buffer renderer.

## Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Protocol v0

Server -> Client:

```json
{ "type": "screen", "frame": { "cols": 80, "rows": 25, "lines": ["..."] } }
```

Client -> Server (`key`):

```json
{ "type": "key", "key": "A", "code": "KeyA", "ctrl": false, "alt": false, "shift": false }
```

Client -> Server (`resize`, optional):

```json
{ "type": "resize", "cols": 100, "rows": 30 }
```
