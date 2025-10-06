const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const { db, currentChar } = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const viewsDir = path.join(__dirname, 'views');

const views = loadViews(viewsDir);

db.exec(`
  CREATE TABLE IF NOT EXISTS forest_fights (
    char_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    fight_date TEXT NOT NULL,
    fights_used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (char_id, fight_date)
  )
`);

const MAX_FOREST_FIGHTS_PER_DAY = 13;
const FOREST_NEWS_KIND = 'forest';
const FOREST_ENEMIES = [
  { name: 'Goblin Scout', hp: 8, atk: 4, def: 2 },
  { name: 'Forest Wolf', hp: 10, atk: 5, def: 3 },
  { name: 'Shadow Bandit', hp: 12, atk: 6, def: 4 },
  { name: 'Vine Troll', hp: 14, atk: 7, def: 4 },
];
const BANK_LIMITS = views.bank?.LIMITS ?? { transferLimitPerDay: 2, transferMax: 500 };
const innView = views.inn || {};
const INN_BARD_FLAG = innView.BARD_DAILY_FLAG || 'inn-bard';
const getInnTodayDate =
  typeof innView.getTodayDate === 'function'
    ? innView.getTodayDate
    : (now) => now.toISOString().slice(0, 10);
const BARD_SONGS = [
  'Seth Able strums a jaunty ballad of dragons bested and hearts won.',
  'The bard whispers a haunting melody about the moonlit Vale of Shadows.',
  'A rousing chorus erupts: "Raise your mugs, for heroes never fall!"',
];
const SELL_RATE = 0.5;

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
    res.json(payload ?? {});
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

app.post('/api/pvp/attack', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const targetName = typeof req.body?.targetName === 'string' ? req.body.targetName.trim() : '';

    if (!targetName) {
      return res.status(400).json({ error: 'targetName is required' });
    }

    const attacker = ctx.getCurrentCharacter();
    if (!attacker) {
      return res.status(403).json({ error: 'No active character available' });
    }

    const target = ctx.db
      .prepare('SELECT id, name FROM characters WHERE name = ? COLLATE NOCASE')
      .get(targetName);

    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (target.id === attacker.id) {
      return res.status(400).json({ error: 'You cannot attack yourself' });
    }

    const text = `${attacker.name} eyes ${target.name} for a future duel in the fields.`;
    const insert = ctx.db.prepare('INSERT INTO news (kind, text) VALUES (?, ?)');
    const info = insert.run('pvp', text);
    const newsItem = ctx.db
      .prepare('SELECT id, kind, text, created_at FROM news WHERE id = ?')
      .get(info.lastInsertRowid);

    res.status(201).json({
      message: 'Attack intent recorded',
      news: newsItem,
    });
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
      .prepare(
        `SELECT p.id, p.char_id, c.name AS author, p.text, COALESCE(p.color, 'white') AS color, p.created_at
         FROM patrons p
         JOIN characters c ON c.id = p.char_id
         WHERE p.id = ?`
      )
      .get(info.lastInsertRowid);

    res.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

app.post('/api/inn/bard', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const today = getInnTodayDate(ctx.now());
    const existing = ctx.db
      .prepare('SELECT used_on FROM daily_flags WHERE char_id = ? AND flag = ?')
      .get(character.id, INN_BARD_FLAG);

    if (existing && existing.used_on === today) {
      return res.status(409).json({ error: 'The bard has already performed for you today.' });
    }

    ctx.db
      .prepare(
        `INSERT INTO daily_flags (char_id, flag, used_on)
         VALUES (?, ?, ?)
         ON CONFLICT(char_id, flag) DO UPDATE SET used_on = excluded.used_on`
      )
      .run(character.id, INN_BARD_FLAG, today);

    const song = BARD_SONGS[Math.floor(Math.random() * BARD_SONGS.length)] ||
      'The bard hums a comforting tune about distant heroes.';

    res.json({ song, bardAvailable: false });
  } catch (error) {
    next(error);
  }
});

app.post('/api/forest/fight', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const today = formatIsoDate(ctx.now());
    const result = ctx.db.transaction((charId, dateStr) => {
      const state = ctx.db
        .prepare(
          `SELECT c.id, c.name, c.level, c.xp, c.hp, c.hp_max, c.gold,
                  COALESCE(w.stat, 0) AS weapon_stat,
                  COALESCE(a.stat, 0) AS armour_stat
           FROM characters c
           LEFT JOIN shop_weapons w ON w.id = c.weapon_id
           LEFT JOIN shop_armours a ON a.id = c.armour_id
           WHERE c.id = ?`
        )
        .get(charId);

      if (!state) {
        throw new Error('Character not found');
      }

      if (state.hp <= 0) {
        return { error: 'You are too weak to fight today.', status: 400 };
      }

      const fightsRow = ctx.db
        .prepare('SELECT fights_used FROM forest_fights WHERE char_id = ? AND fight_date = ?')
        .get(charId, dateStr);
      const fightsUsed = fightsRow?.fights_used ?? 0;
      if (fightsUsed >= MAX_FOREST_FIGHTS_PER_DAY) {
        return { error: 'No forest fights left today.', status: 409 };
      }

      const fightCount = fightsUsed + 1;
      const seed = computeForestSeed(dateStr, charId, fightCount);
      const rng = createDeterministicRng(seed);
      const enemy = selectForestEnemy(state.level, rng);
      const outcome = resolveForestFight(state, enemy, rng);

      const nextHp = Math.max(0, Math.min(state.hp_max, state.hp + outcome.deltaHp));
      const nextGold = Math.max(0, state.gold + outcome.gold);
      const nextXp = Math.max(0, state.xp + outcome.xp);

      ctx.db
        .prepare(
          `INSERT INTO forest_fights (char_id, fight_date, fights_used)
           VALUES (?, ?, ?)
           ON CONFLICT(char_id, fight_date) DO UPDATE SET fights_used = excluded.fights_used`
        )
        .run(charId, dateStr, fightCount);

      ctx.db
        .prepare('UPDATE characters SET hp = ?, gold = ?, xp = ? WHERE id = ?')
        .run(nextHp, nextGold, nextXp, charId);

      const newsText = outcome.victory
        ? `${state.name} bested ${enemy.name} in the forest.`
        : `${state.name} was battered by ${enemy.name} in the forest.`;

      ctx.db.prepare('INSERT INTO news (kind, text) VALUES (?, ?)').run(FOREST_NEWS_KIND, newsText);

      return {
        seed,
        enemy,
        roll: outcome.roll,
        result: {
          deltaHp: outcome.deltaHp,
          gold: outcome.gold,
          xp: outcome.xp,
          victory: outcome.victory,
        },
        character: {
          id: state.id,
          name: state.name,
          hp: nextHp,
          hpMax: state.hp_max,
          gold: nextGold,
          xp: nextXp,
        },
        fightsLeft: Math.max(0, MAX_FOREST_FIGHTS_PER_DAY - fightCount),
      };
    })(character.id, today);

    if (result?.error) {
      const status = result.status && Number.isInteger(result.status) ? result.status : 400;
      return res.status(status).json({ error: result.error });
    }

    ctx.reloadCharacter();
    res.json({
      enemy: result.enemy,
      roll: result.roll,
      result: result.result,
      seed: result.seed,
      fightsLeft: result.fightsLeft,
      character: result.character,
    });
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

    if (amount > BANK_LIMITS.transferMax) {
      return res.status(400).json({ error: 'Amount exceeds transfer maximum' });
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

    if (amount > BANK_LIMITS.transferMax) {
      return res.status(400).json({ error: 'Amount exceeds transfer maximum' });
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

app.post('/api/weapons/buy', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId.trim() : '';
    if (!itemId) {
      return res.status(400).json({ error: 'Item is required' });
    }

    const result = ctx.db.transaction((charId, weaponId) => {
      const item = ctx.db
        .prepare('SELECT id, name, stat, price FROM shop_weapons WHERE id = ?')
        .get(weaponId);
      if (!item) {
        return { error: 'Weapon not found' };
      }

      const current = ctx.db
        .prepare('SELECT gold FROM characters WHERE id = ?')
        .get(charId);
      if (!current) {
        throw new Error('Character not found');
      }

      if (current.gold < item.price) {
        return { error: 'Insufficient funds' };
      }

      ctx.db
        .prepare('UPDATE characters SET gold = gold - ?, weapon_id = ? WHERE id = ?')
        .run(item.price, item.id, charId);

      const snapshot = getEquipmentSnapshot(ctx.db, charId);
      return { snapshot, cost: item.price };
    })(character.id, itemId);

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    ctx.reloadCharacter();
    res.json({
      character: serializeEquipment(result.snapshot),
      transaction: { type: 'buy', spent: result.cost },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/weapons/sell', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId.trim() : '';
    if (!itemId) {
      return res.status(400).json({ error: 'Item is required' });
    }

    const result = ctx.db.transaction((charId, weaponId) => {
      const equipped = ctx.db
        .prepare('SELECT weapon_id FROM characters WHERE id = ?')
        .get(charId);
      if (!equipped) {
        throw new Error('Character not found');
      }

      if (equipped.weapon_id !== weaponId) {
        return { error: 'Weapon not equipped' };
      }

      const item = ctx.db
        .prepare('SELECT id, price FROM shop_weapons WHERE id = ?')
        .get(weaponId);
      if (!item) {
        return { error: 'Weapon not found' };
      }

      const saleValue = Math.floor(item.price * SELL_RATE);

      ctx.db
        .prepare('UPDATE characters SET gold = gold + ?, weapon_id = NULL WHERE id = ?')
        .run(saleValue, charId);

      const snapshot = getEquipmentSnapshot(ctx.db, charId);
      return { snapshot, saleValue };
    })(character.id, itemId);

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    ctx.reloadCharacter();
    res.json({
      character: serializeEquipment(result.snapshot),
      transaction: { type: 'sell', received: result.saleValue },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/armour/buy', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId.trim() : '';
    if (!itemId) {
      return res.status(400).json({ error: 'Item is required' });
    }

    const result = ctx.db.transaction((charId, armourId) => {
      const item = ctx.db
        .prepare('SELECT id, name, stat, price FROM shop_armours WHERE id = ?')
        .get(armourId);
      if (!item) {
        return { error: 'Armour not found' };
      }

      const current = ctx.db
        .prepare('SELECT gold FROM characters WHERE id = ?')
        .get(charId);
      if (!current) {
        throw new Error('Character not found');
      }

      if (current.gold < item.price) {
        return { error: 'Insufficient funds' };
      }

      ctx.db
        .prepare('UPDATE characters SET gold = gold - ?, armour_id = ? WHERE id = ?')
        .run(item.price, item.id, charId);

      const snapshot = getEquipmentSnapshot(ctx.db, charId);
      return { snapshot, cost: item.price };
    })(character.id, itemId);

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    ctx.reloadCharacter();
    res.json({
      character: serializeEquipment(result.snapshot),
      transaction: { type: 'buy', spent: result.cost },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/armour/sell', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId.trim() : '';
    if (!itemId) {
      return res.status(400).json({ error: 'Item is required' });
    }

    const result = ctx.db.transaction((charId, armourId) => {
      const equipped = ctx.db
        .prepare('SELECT armour_id FROM characters WHERE id = ?')
        .get(charId);
      if (!equipped) {
        throw new Error('Character not found');
      }

      if (equipped.armour_id !== armourId) {
        return { error: 'Armour not equipped' };
      }

      const item = ctx.db
        .prepare('SELECT id, price FROM shop_armours WHERE id = ?')
        .get(armourId);
      if (!item) {
        return { error: 'Armour not found' };
      }

      const saleValue = Math.floor(item.price * SELL_RATE);

      ctx.db
        .prepare('UPDATE characters SET gold = gold + ?, armour_id = NULL WHERE id = ?')
        .run(saleValue, charId);

      const snapshot = getEquipmentSnapshot(ctx.db, charId);
      return { snapshot, saleValue };
    })(character.id, itemId);

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    ctx.reloadCharacter();
    res.json({
      character: serializeEquipment(result.snapshot),
      transaction: { type: 'sell', received: result.saleValue },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/healer/heal', async (req, res, next) => {
  try {
    const ctx = createContext(req, res);
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return res.status(403).json({ error: 'No active character' });
    }

    const modeRaw = typeof req.body?.mode === 'string' ? req.body.mode.trim().toLowerCase() : '';
    if (modeRaw !== 'all' && modeRaw !== 'some') {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    let requestedAmount = null;
    if (modeRaw === 'some') {
      const amountValue = Number(req.body?.amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      requestedAmount = Math.floor(amountValue);
    }

    const result = ctx.db.transaction((charId, mode, amount) => {
      const current = ctx.db
        .prepare('SELECT hp, hp_max, gold FROM characters WHERE id = ?')
        .get(charId);
      if (!current) {
        throw new Error('Character not found');
      }

      const missing = Math.max(current.hp_max - current.hp, 0);
      if (missing <= 0) {
        return { error: 'Already at full health' };
      }

      let healAmount = mode === 'all' ? missing : Math.min(amount, missing);
      if (!Number.isFinite(healAmount) || healAmount <= 0) {
        return { error: 'Invalid amount' };
      }

      const cost = healAmount * 2;
      if (current.gold < cost) {
        return { error: 'Insufficient funds' };
      }

      ctx.db
        .prepare('UPDATE characters SET hp = hp + ?, gold = gold - ? WHERE id = ?')
        .run(healAmount, cost, charId);

      const updated = ctx.db
        .prepare('SELECT hp, hp_max, gold FROM characters WHERE id = ?')
        .get(charId);

      return { healed: healAmount, spent: cost, character: updated };
    })(character.id, modeRaw, requestedAmount);

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    ctx.reloadCharacter();

    let view = null;
    if (views.healer?.get) {
      view = await views.healer.get(ctx);
    }

    res.json({
      healed: result.healed,
      spent: result.spent,
      character: {
        hp: result.character.hp,
        hpMax: result.character.hp_max,
        gold: result.character.gold,
      },
      view,
    });
  } catch (error) {
    next(error);
  }
});

function formatIsoDate(date) {
  if (!date) {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof date === 'string') {
    return new Date(date).toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function computeForestSeed(dateStr, charId, fightCount) {
  return crypto.createHash('sha256').update(`${dateStr}|${charId}|${fightCount}`).digest('hex');
}

function createDeterministicRng(seed) {
  const divisor = 0xffffffffffff;
  let state = seed || '';
  return () => {
    state = crypto.createHash('sha256').update(String(state)).digest('hex');
    const fragment = state.slice(0, 12);
    const value = parseInt(fragment, 16);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value / divisor;
  };
}

function selectForestEnemy(level, rng) {
  const roll = rng();
  const index = Number.isFinite(roll) ? Math.floor(roll * FOREST_ENEMIES.length) : 0;
  const base = FOREST_ENEMIES[index % FOREST_ENEMIES.length] || FOREST_ENEMIES[0];
  const levelBonus = Math.max(0, Math.floor(level / 3));
  const defenceBonus = Math.max(0, Math.floor(level / 5));
  return {
    name: base.name,
    hp: base.hp + levelBonus,
    atk: base.atk + levelBonus,
    def: base.def + defenceBonus,
  };
}

function resolveForestFight(state, enemy, rng) {
  const playerAttack = 5 + state.level + (state.weapon_stat || 0);
  const playerDefense = 5 + state.level + (state.armour_stat || 0);

  const youRoll = 1 + Math.floor(rng() * 20);
  const enemyRoll = 1 + Math.floor(rng() * 20);

  const damageToEnemy = Math.max(1, Math.floor(playerAttack * 0.6) + youRoll - enemy.def);
  const victory = damageToEnemy >= enemy.hp;

  let damageTaken;
  if (victory) {
    const glancing = Math.max(0, Math.floor(enemy.atk * 0.3) + Math.floor(enemyRoll / 2) - Math.floor(playerDefense * 0.5));
    damageTaken = Math.max(0, glancing);
  } else {
    const assault = Math.max(1, Math.floor(enemy.atk * 0.7) + enemyRoll);
    damageTaken = Math.max(1, assault - Math.floor(playerDefense * 0.5));
  }

  damageTaken = Math.min(Number.isFinite(damageTaken) ? damageTaken : 0, state.hp);
  const deltaHp = -damageTaken;

  const xpReward = victory ? 5 + Math.floor(rng() * (4 + enemy.atk)) : 1;
  const goldReward = victory ? 8 + Math.floor(rng() * (5 + enemy.def)) : 0;

  return {
    roll: { you: youRoll, enemy: enemyRoll },
    deltaHp,
    xp: xpReward,
    gold: goldReward,
    victory,
  };
}

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

function getEquipmentSnapshot(database, charId) {
  return database
    .prepare(`
      SELECT
        c.id,
        c.gold,
        c.weapon_id,
        c.armour_id,
        w.name AS weapon_name,
        w.stat AS weapon_stat,
        w.price AS weapon_price,
        a.name AS armour_name,
        a.stat AS armour_stat,
        a.price AS armour_price
      FROM characters c
      LEFT JOIN shop_weapons w ON w.id = c.weapon_id
      LEFT JOIN shop_armours a ON a.id = c.armour_id
      WHERE c.id = ?
    `)
    .get(charId);
}

function serializeEquipment(row) {
  if (!row) {
    return { gold: 0, weapon: null, armour: null };
  }

  const weapon = row.weapon_id
    ? {
        id: row.weapon_id,
        name: row.weapon_name,
        stat: row.weapon_stat,
        price: row.weapon_price,
      }
    : null;

  const armour = row.armour_id
    ? {
        id: row.armour_id,
        name: row.armour_name,
        stat: row.armour_stat,
        price: row.armour_price,
      }
    : null;

  return {
    gold: row.gold,
    weapon,
    armour,
  };
}

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
  context.reloadCharacter = () => {
    cachedChar = undefined;
    return context.currentChar;
  };

  return context;
}
