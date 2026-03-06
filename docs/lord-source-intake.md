# LORD source intake + migration kickoff

You can share the Synchronet LORD code with me **without ZIP uploads** by pulling it directly from GitHub into this repo.

## Fastest path (recommended)

Run:

```bash
./scripts/fetch-lord-source.sh
```

That command sparse-clones Synchronet and copies `xtrn/lord` into `./vendor/lord`.

If you want a custom destination:

```bash
./scripts/fetch-lord-source.sh ./lord
```

## Alternative: keep upstream repo as a submodule

```bash
git submodule add https://github.com/SynchronetBBS/sbbs.git vendor/sbbs
cd vendor/sbbs
git sparse-checkout init --cone
git sparse-checkout set xtrn/lord
```

## If you already have a `/lord` folder in this repo

Great — that is enough to start. Next, share any constraints that affect parity:

- Must gameplay text/flow be 100% identical, or can UX be modernized?
- Do we keep classic "daily turns" semantics exactly?
- Any account requirements (email verification, reset flow, password policy)?
- Single-node deploy only, or future multi-node scaling?

## Full-conversion blueprint (Node + SQLite + web terminal)

1. **Source audit**
   - Inventory game loop, persistence points, and file I/O in existing JS code.
   - Capture command grammar and edge cases.
2. **Domain extraction**
   - Move battle/town/forest mechanics into pure TypeScript modules.
   - Add deterministic tests around core mechanics before behavior changes.
3. **Persistence layer**
   - SQLite schema for users, characters, inventory, events, combat logs, and day resets.
   - Migration system (Prisma or Knex).
4. **Authentication**
   - Built-in account creation + login.
   - Argon2/bcrypt password hashing, secure session cookies, CSRF protections.
5. **Web terminal UI**
   - Browser terminal interface (xterm.js or equivalent).
   - Preserve command-driven input and ANSI-like output styling.
6. **Server API**
   - Node.js service to process commands, enforce turns, and persist state.
   - Clear separation between game engine and HTTP/session concerns.
7. **Compatibility + rollout**
   - Golden transcript tests versus legacy outputs for key player flows.
   - Import script for any legacy player data we decide to keep.

## Definition of done for MVP

- Account signup/login/logout working.
- New character creation and saved progress in SQLite.
- Main LORD gameplay loop accessible through browser terminal.
- Daily reset/turn logic implemented.
- Basic admin controls (reset day, inspect player/account health).

