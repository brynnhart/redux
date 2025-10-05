const fs = require('fs');
const path = require('path');
const express = require('express');

const { db, currentChar } = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const viewsDir = path.join(__dirname, 'views');

const views = loadViews(viewsDir);

app.use(express.static(publicDir));

app.get('/api/view/:id', async (req, res, next) => {
  const viewModule = views[req.params.id];
  if (!viewModule || typeof viewModule.get !== 'function') {
    return res.status(404).json({ error: 'Unknown view' });
  }

  try {
    const ctx = createContext(req, res);
    const payload = await viewModule.get(ctx);
    res.json(payload ?? null);
  } catch (error) {
    next(error);
  }
});

app.get('/api/modal/:view/:modal', async (req, res, next) => {
  const viewModule = views[req.params.view];
  if (!viewModule || typeof viewModule.get !== 'function') {
    return res.status(404).json({ error: 'Unknown view' });
  }

  const modalHandler = viewModule.modals?.[req.params.modal];
  if (typeof modalHandler !== 'function') {
    return res.status(404).json({ error: 'Unknown modal' });
  }

  try {
    const ctx = createContext(req, res);
    const payload = await modalHandler(ctx);
    res.json(payload ?? null);
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
  const context = {
    req,
    res,
    db,
    params: req.params,
    query: req.query,
    currentCharacter: undefined,
  };

  context.getCurrentCharacter = () => {
    if (context.currentCharacter === undefined) {
      context.currentCharacter = currentChar() || null;
    }

    return context.currentCharacter;
  };

  context.currentCharacter = context.getCurrentCharacter();

  return context;
}
