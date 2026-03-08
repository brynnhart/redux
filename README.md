# Legend of the Red Dragon — Web Port

A web-based port of the classic BBS door game LoRD, built on Node.js + WebSockets + xterm.js.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment file and edit it
cp .env.example .env
# Edit .env — at minimum set a strong JWT_SECRET

# 3. Create the database
npm run db:init

# 4. Copy your LoRD game data files into gamedata/
mkdir -p gamedata
cp /path/to/lord/lordtxt.lrd  gamedata/
cp /path/to/lord/goodsay.lrd  gamedata/
cp /path/to/lord/badsay.lrd   gamedata/
cp /path/to/lord/normsay.lrd  gamedata/
cp /path/to/lord/start*.lrd   gamedata/
cp /path/to/lord/dstart.lrd   gamedata/
cp /path/to/lord/gstart.lrd   gamedata/

# 5. Start the server
npm start
# or for development with auto-reload:
npm run dev
```

Then open http://localhost:3000 in your browser.

## Project Structure

```
lord-web/
├── server/
│   ├── index.js                  # Entry point — Express + WebSocket + cron
│   ├── auth/
│   │   └── AuthRouter.js         # POST /api/auth/register|login, GET /api/auth/me
│   ├── cron/
│   │   └── DailyReset.js         # Daily maintenance (resets, marriages, log)
│   ├── db/
│   │   ├── init.js               # Schema creation + getDB()
│   │   ├── PlayerDB.js           # Player CRUD
│   │   ├── StateDB.js            # Game-wide state (heroes, marriages)
│   │   ├── LogDB.js              # Daily happenings log
│   │   ├── MailDB.js             # In-game mail
│   │   └── ConversationDB.js     # Bar/garden conversations
│   ├── game/
│   │   ├── GameEngine.js         # Main game loop — session → game dispatch
│   │   ├── data/
│   │   │   └── constants.js      # Static game data (monsters, trainers, items)
│   │   ├── locations/            # One file per town location
│   │   │   ├── Forest.js         # TODO: forest() ~3351 lines
│   │   │   ├── Inn.js            # TODO: red_dragon_inn()
│   │   │   ├── Tavern.js         # TODO: talk_with_bartender()
│   │   │   ├── Bank.js           # TODO: ye_old_bank()
│   │   │   ├── Healer.js         # TODO: healers()
│   │   │   ├── Armoury.js        # TODO: abduls_armour()
│   │   │   ├── Arena.js          # TODO: turgons()
│   │   │   ├── KingsArthurs.js   # TODO: king_arthurs() + raise_class()
│   │   │   └── Dragon.js         # TODO: fight_dragon()
│   │   ├── systems/
│   │   │   ├── Battle.js         # Core combat engine (battle, beefUp, calcHit)
│   │   │   └── LeaderboardRouter.js  # Rankings display + GET /api/leaderboard
│   │   └── text/
│   │       ├── LordColors.js     # Backtick color codes → ANSI (lord_to_ansi)
│   │       ├── TextFile.js       # .lrd file reader + section indexer
│   │       └── Display.js        # Session-bound output helpers
│   └── ws/
│       ├── WSHandler.js          # WebSocket server, auth, session lifecycle
│       └── Session.js            # Per-player I/O (send, getKey, getStr, more)
├── client/
│   ├── index.html                # Login / register page
│   ├── game.html                 # Terminal (xterm.js) game page
│   ├── leaderboard.html          # Public rankings page
│   ├── css/style.css
│   └── js/
│       ├── auth.js               # Login / register UI logic
│       └── terminal.js           # xterm.js + WebSocket bridge
├── gamedata/                     # .lrd text files (copy from Synchronet source)
├── data/                         # SQLite database (auto-created)
├── .env.example
├── .gitignore
└── package.json
```

## Implementation Roadmap

See the analysis document for the full phase plan. The short version:

### Done (scaffolding)
- ✅ Project structure, package.json, .env
- ✅ SQLite schema (all 55 player fields + state + mail + log + conversations)
- ✅ Auth (register/login/JWT)
- ✅ WebSocket server with auth and session lifecycle
- ✅ Session I/O layer (send/getKey/getStr/more — all async/await)
- ✅ LordColors (backtick → ANSI converter)
- ✅ TextFile (.lrd reader + section indexer)
- ✅ Display helpers (showFile, showSection, showLines)
- ✅ Battle system foundation (calcHit, beefUp, battle loop)
- ✅ PlayerDB, StateDB, LogDB, MailDB, ConversationDB
- ✅ Daily reset cron (resetDaily, incrementDay, log pruning)
- ✅ Leaderboard REST endpoint + public page
- ✅ xterm.js client with keyboard forwarding
- ✅ All location stubs (Forest, Inn, Tavern, Bank, Healer, Armoury, Arena, KingsArthurs, Dragon)

### Next steps (port from lord.js)
- [ ] GameEngine: new_player() — character creation wizard
- [ ] GameEngine: load_player() — daily maintenance check, returning player flow
- [ ] GameEngine: showTownMenu() — full lordtxt.lrd-based town display
- [ ] Each location: port full logic from lord.js (see analysis doc for line references)
- [ ] Marriage/romance system (seth_marriage, violet_marriage, romance, have_baby)
- [ ] Mail compose/read UI
- [ ] Online PvP (attack_player, online_battle via WS)
- [ ] Class skills (Death Knight, Thief, Mystic)
- [ ] IGM support (optional — defer to v2)

## Key Architectural Note

The original lord.js uses **synchronous, blocking** I/O (`dk.console.getkey()`).
In this port, ALL I/O is **async/await**. Every function that takes user input must
be declared `async` and use `await session.getKey()` or `await session.getStr()`.
This cascades up through the entire call stack — plan every location function as async.

## Synchronet API → Web Replacement Map

| Synchronet | Web replacement |
|---|---|
| `dk.console.print(str)` | `session.send(str)` |
| `dk.console.getkey()` | `await session.getKey()` |
| `dk.console.clear()` | `session.clearScreen()` |
| `dk.console.rows` | `24` (fixed) |
| `psock` (data server) | Direct DB calls via PlayerDB/StateDB etc. |
| `RecordFile` | `better-sqlite3` via PlayerDB |
| `fmutex` / file locks | DB transactions |
| `system.qwk_id` | `process.env.JWT_SECRET` or config |
| `js.exec_dir` | `__dirname` |
