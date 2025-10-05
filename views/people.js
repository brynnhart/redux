module.exports = {
  async get(ctx) {
    const online = ctx.db
      .prepare(
        `SELECT c.name, p.last_heartbeat_at
         FROM presence p
         JOIN characters c ON c.id = p.char_id
         ORDER BY datetime(p.last_heartbeat_at) DESC`
      )
      .all();

    return { online };
  },
};
