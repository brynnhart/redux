module.exports = {
  async get(ctx) {
    const items = ctx.db
      .prepare('SELECT id, kind, text, created_at FROM news ORDER BY datetime(created_at) DESC')
      .all();

    return { items };
  },
};
