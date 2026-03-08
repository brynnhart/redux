'use strict';

/**
 * server/ws/WSHandler.js
 *
 * Attaches a WebSocket server to the HTTP server.
 * On each new connection:
 *   1. Authenticates the JWT passed in the connection URL or first message.
 *   2. Creates a Session for the user.
 *   3. Hands the session off to the GameEngine.
 *
 * Wire protocol (client → server):
 *   { type: 'auth',  token: '<jwt>' }
 *   { type: 'key',   key:   '<single char or escape sequence>' }
 *
 * Wire protocol (server → client):
 *   { type: 'output', data: '<ansi string>' }
 *   { type: 'error',  message: '<string>' }
 */

const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const Session   = require('./Session');
const GameEngine = require('../game/GameEngine');

const SECRET = process.env.JWT_SECRET || 'changeme';

/** Map of userId → active Session (one session per user). */
const activeSessions = new Map();

function attach(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('[WS] New connection from', req.socket.remoteAddress);

    let session = null;

    // First message must be auth
    const authTimeout = setTimeout(() => {
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Auth timeout' }));
        ws.close();
      }
    }, 10_000);

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Bad JSON' }));
        return;
      }

      // ── Auth ───────────────────────────────────────────────────────────────
      if (!session) {
        if (msg.type !== 'auth' || !msg.token) {
          ws.send(JSON.stringify({ type: 'error', message: 'Authenticate first' }));
          return;
        }

        let payload;
        try {
          payload = jwt.verify(msg.token, SECRET);
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
          ws.close();
          return;
        }

        clearTimeout(authTimeout);

        // Kick existing session for this user if any
        if (activeSessions.has(payload.userId)) {
          activeSessions.get(payload.userId).kick('Logged in from another location');
        }

        session = new Session(ws, payload.userId, payload.username);
        activeSessions.set(payload.userId, session);

        session.on('end', () => {
          activeSessions.delete(payload.userId);
          console.log(`[WS] Session ended for user ${payload.userId}`);
        });

        console.log(`[WS] Authenticated user ${payload.userId} (${payload.username})`);

        // Start the game engine in the background (it will drive the session)
        GameEngine.run(session).catch(err => {
          console.error(`[Game] Uncaught error for user ${payload.userId}:`, err);
          session.send('\r\n`4A fatal error occurred. Please reconnect.`0\r\n');
          session.end();
        });

        return;
      }

      // ── Key input ──────────────────────────────────────────────────────────
      if (msg.type === 'key' && typeof msg.key === 'string') {
        session.receiveKey(msg.key);
        return;
      }
    });

    ws.on('close', () => {
      if (session) {
        session.end();
        activeSessions.delete(session.userId);
      }
      console.log('[WS] Connection closed');
    });

    ws.on('error', err => {
      console.error('[WS] Socket error:', err.message);
    });
  });

  console.log('[WS] Server ready on /ws');
}

/** Get a live session by userId (for online battles, etc.). */
function getSession(userId) {
  return activeSessions.get(userId) || null;
}

module.exports = { attach, getSession };
