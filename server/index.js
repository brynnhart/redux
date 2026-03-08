'use strict';

/**
 * server/index.js
 * Entry point — spins up Express (HTTP + static files) and the WebSocket server.
 * Also starts the daily-reset cron job.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http    = require('http');
const express = require('express');
const path    = require('path');

const { initDB }      = require('./db/init');
const WSHandler       = require('./ws/WSHandler');
const AuthRouter      = require('./auth/AuthRouter');
const LeaderboardRouter = require('./game/systems/LeaderboardRouter');
const DailyReset      = require('./cron/DailyReset');

const PORT = process.env.PORT || 3000;

async function main() {
  // ── 1. Database ────────────────────────────────────────────────────────────
  initDB();
  console.log('[DB] Initialized');

  // ── 2. Express app ─────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());

  // Serve the client folder as static files
  app.use(express.static(path.join(__dirname, '../client')));

  // REST routes
  app.use('/api/auth',        AuthRouter);
  app.use('/api/leaderboard', LeaderboardRouter);

  // Fallback — serve index.html for any unknown route (SPA-style)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });

  // ── 3. HTTP server ─────────────────────────────────────────────────────────
  const server = http.createServer(app);

  // ── 4. WebSocket server ────────────────────────────────────────────────────
  WSHandler.attach(server);
  console.log('[WS] WebSocket handler attached');

  // ── 5. Cron jobs ───────────────────────────────────────────────────────────
  DailyReset.start();
  console.log('[Cron] Daily reset scheduled');

  // ── 6. Listen ──────────────────────────────────────────────────────────────
  server.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
