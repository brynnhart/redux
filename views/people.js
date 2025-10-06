const ONLINE_WINDOW_SECONDS = 60;

module.exports = {
  async get(ctx) {
    const citizens = ctx.db
      .prepare(
        `SELECT c.name, p.last_heartbeat_at
         FROM presence p
         JOIN characters c ON c.id = p.char_id
         WHERE p.last_heartbeat_at >= datetime('now', ?)
         ORDER BY datetime(p.last_heartbeat_at) DESC`
      )
      .all(`-${ONLINE_WINDOW_SECONDS} seconds`)
      .map((row) => ({
        name: row.name,
        last_heartbeat_at: row.last_heartbeat_at,
      }));

    return { citizens };
  },
};
