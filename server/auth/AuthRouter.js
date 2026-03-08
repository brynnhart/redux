'use strict';

/**
 * server/auth/AuthRouter.js
 *
 * POST /api/auth/register  — create a user account
 * POST /api/auth/login     — authenticate, return JWT
 * GET  /api/auth/me        — return current user info (requires token)
 */

const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { getDB } = require('../db/init');

const router     = express.Router();
const SALT_ROUNDS = 12;
const SECRET      = process.env.JWT_SECRET || 'changeme';
const EXPIRES_IN  = process.env.JWT_EXPIRES_IN || '7d';

// ── Middleware ─────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

/** POST /api/auth/register */
router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3–30 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDB();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const info = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);

  const token = jwt.sign({ userId: info.lastInsertRowid, username }, SECRET, { expiresIn: EXPIRES_IN });
  res.status(201).json({ token, userId: info.lastInsertRowid, username });
});

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const db   = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  db.prepare('UPDATE users SET last_login = unixepoch() WHERE id = ?').run(user.id);

  const token = jwt.sign({ userId: user.id, username: user.username }, SECRET, { expiresIn: EXPIRES_IN });
  res.json({ token, userId: user.id, username: user.username });
});

/** GET /api/auth/me */
router.get('/me', requireAuth, (req, res) => {
  const db   = getDB();
  const user = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if they have a character
  const player = db.prepare('SELECT id, name, level, exp, dead FROM players WHERE user_id = ?').get(user.id);
  res.json({ ...user, player: player || null });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
