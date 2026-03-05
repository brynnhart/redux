# Web LoRD

Standalone web-first LoRD-inspired game server, starting from a clean architecture.

## Current status

This repository includes Milestone 0 + Milestone 1 foundations:

- Node.js server with WebSocket session endpoint.
- Terminal-style browser client (`public/index.html`).
- File-backed persistence (`data/players.json`) with player create/load.
- Login/create player by name.
- Basic Town Square flow with Bank screen stub.

## Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Protocol (initial)

Client -> server:

- `{ "type": "input", "text": "..." }`
- `{ "type": "key", "key": "..." }` (reserved for future real-time keypress flows)
- `{ "type": "resize", "cols": 80, "rows": 25 }` (reserved)

Server -> client:

- `{ "type": "screen", "ops": [...] }`
  - `clear`
  - `title`
  - `line`
  - `prompt`
