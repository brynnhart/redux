# How to provide LORD source files for migration

Since chat file uploads are limited, use one of these paths:

1. **Best option (repeatable): run the fetch script in this repo**
   ```bash
   ./scripts/fetch-lord-source.sh
   ```
   This pulls `xtrn/lord` from Synchronet and copies it into `./vendor/lord`.

2. **Git submodule (if you want a pinned upstream reference)**
   ```bash
   git submodule add https://github.com/SynchronetBBS/sbbs.git vendor/sbbs
   cd vendor/sbbs && git sparse-checkout init --cone && git sparse-checkout set xtrn/lord
   ```

3. **Manual export**
   Download that subdirectory and place it under `vendor/lord/`.

## What to send next so implementation can start

After files are in `vendor/lord`, provide:

- Any gameplay behavior you want preserved exactly vs. modernized.
- Whether multiplayer concurrency must mirror BBS turn-order semantics.
- Password policy / account recovery requirements.
- Hosting constraints (single-node Node.js process vs. containerized deploy).

## High-level migration blueprint (recommended)

- **Runtime**: Node.js + Express (or Fastify) server.
- **Persistence**: SQLite with Prisma/Knex migrations.
- **Auth**: built-in username/password with bcrypt/argon2 + session cookies.
- **UI**: terminal-emulator style web client (xterm.js or custom ANSI-like renderer).
- **Game logic**: isolate legacy mechanics into a pure domain module first, then wrap routes.
- **Compatibility**: preserve key command grammar and game-day cycles.

