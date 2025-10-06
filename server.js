const fs = require('fs');
const path = require('path');
const express = require('express');

const { db, currentChar } = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const viewsDir = path.join(__dirname, 'views');

const views = loadViews(viewsDir);

app.use(express.json());
app.use(express.static(publicDir));

app.get('/api/view/:id', async (req, res, next) => {
  const viewModule = views[req.params.id];
  if (!viewModule || typeof viewModule.get !== 'function') {
    return res.status(404).json({ ok: false, error: 'Unknown view' });
  }

  try {
    const ctx = createContext(req, res);
    const payload = await viewModule.get(ctx);
    res.json({ ok: true, data: payload ?? {} });
  } catch (error) {
    next(error);
  }
});

app.get('/api/modal/:view/:modal', async (req, res, next) => {
  const viewModule = views[req.params.view];
  if (!viewModule || typeof viewModule.get !== 'function') {
    return res.status(404).json({ ok: false, error: 'Unknown view' });
  }

  const modalHandler = viewModule.modals?.[req.params.modal];
  if (typeof modalHandler !== 'function') {
    return res.status(404).json({ ok: false, error: 'Unknown modal' });
  }

  try {
    const ctx = createContext(req, res);
    const payload = await modalHandler(ctx);
    res.json({ ok: true, data: payload ?? {} });
  } catch (error) {
    next(error);
  }
});

app.post('/api/announce', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const insert = ctx.db.prepare('INSERT INTO news (kind, text) VALUES (?, ?)');
    const info = insert.run('announcement', text);
    const item = ctx.db
      .prepare('SELECT id, kind, text, created_at FROM news WHERE id = ?')
      .get(info.lastInsertRowid);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mail/send', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const toName = typeof req.body?.toName === 'string' ? req.body.toName.trim() : '';
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

    if (!toName || !body) {
      return res.status(400).json({ error: 'Recipient and body are required' });
    }

    const toChar = ctx.db
      .prepare('SELECT id FROM characters WHERE name = ? COLLATE NOCASE')
      .get(toName);

    if (!toChar) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const fromChar = ctx.getCurrentCharacter();
    const insert = ctx.db.prepare(
      'INSERT INTO mail (to_char, from_char, body) VALUES (?, ?, ?)'
    );
    const info = insert.run(toChar.id, fromChar?.id ?? null, body);
    const item = ctx.db
      .prepare(
        `SELECT m.id, sender.name AS sender_name, m.body, m.created_at, m.read_at
         FROM mail m
         LEFT JOIN characters sender ON sender.id = m.from_char
         WHERE m.id = ?`
      )
      .get(info.lastInsertRowid);

    res.json({
      message: {
        id: item.id,
        from: item.sender_name || 'Courier',
        body: item.body,
        created_at: item.created_at,
        read_at: item.read_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/inn/converse', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const color = typeof req.body?.color === 'string' ? req.body.color.trim() || null : null;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const insert = ctx.db.prepare(
      'INSERT INTO patrons (char_id, text, color) VALUES (?, ?, ?)' 
    );
    const info = insert.run(character.id, text, color);
    const entry = ctx.db
      .prepare('SELECT id, char_id, text, color, created_at FROM patrons WHERE id = ?')
      .get(info.lastInsertRowid);

    res.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

app.post('/api/bank/deposit', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const update = ctx.db.transaction((charId, amt) => {
      const current = ctx.db
        .prepare('SELECT gold, bank_gold FROM characters WHERE id = ?')
        .get(charId);

      if (!current) {
        throw new Error('Character not found');
      }

      if (current.gold < amt) {
        return null;
      }

      ctx.db
        .prepare('UPDATE characters SET gold = gold - ?, bank_gold = bank_gold + ? WHERE id = ?')
        .run(amt, amt, charId);

      return ctx.db
        .prepare('SELECT gold, bank_gold FROM characters WHERE id = ?')
        .get(charId);
    });

    const updated = update(character.id, amount);
    if (!updated) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    res.json({ balances: updated });
  } catch (error) {
    next(error);
  }
});

app.post('/api/bank/withdraw', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const update = ctx.db.transaction((charId, amt) => {
      const current = ctx.db
        .prepare('SELECT gold, bank_gold FROM characters WHERE id = ?')
        .get(charId);

      if (!current) {
        throw new Error('Character not found');
      }

      if (current.bank_gold < amt) {
        return null;
      }

      ctx.db
        .prepare('UPDATE characters SET gold = gold + ?, bank_gold = bank_gold - ? WHERE id = ?')
        .run(amt, amt, charId);

      return ctx.db
        .prepare('SELECT gold, bank_gold FROM characters WHERE id = ?')
        .get(charId);
    });

    const updated = update(character.id, amount);
    if (!updated) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    res.json({ balances: updated });
  } catch (error) {
    next(error);
  }
});

app.post('/api/presence/heartbeat', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    ctx.db
      .prepare(`
        INSERT INTO presence (char_id, last_heartbeat_at)
        VALUES (?, CURRENT_TIMESTAMP)
        ON CONFLICT(char_id) DO UPDATE SET last_heartbeat_at = CURRENT_TIMESTAMP
      `)
      .run(character.id);

    const presence = ctx.db
      .prepare('SELECT char_id, last_heartbeat_at FROM presence WHERE char_id = ?')
      .get(character.id);

    res.json({ presence });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

function loadViews(dir) {
  const modules = {};
  if (!fs.existsSync(dir)) {
    return modules;
  }

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.js')) {
      continue;
    }

    const id = path.basename(file, '.js');
    const modulePath = path.join(dir, file);
    const viewModule = require(modulePath);
    modules[id] = viewModule;
  }

  return modules;
}

function createContext(req, res) {
  let cachedChar;

  const context = {
    req,
    res,
    db,
    params: req.params,
    query: req.query,
    now: () => new Date(),
  };

  Object.defineProperty(context, 'currentChar', {
    enumerable: true,
    get: () => {
      if (cachedChar === undefined) {
        cachedChar = currentChar() || null;
      }
      return cachedChar;
    },
  });

  context.getCurrentCharacter = () => context.currentChar;
  context.currentCharacter = context.currentChar;

  return context;
}
