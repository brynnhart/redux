const ONLINE_WINDOW_SECONDS = 60;

module.exports = {
  async get(ctx) {
    const citizens = ctx.db
      .prepare(
        `SELECT c.name,
                c.level,
                p.last_heartbeat_at,
                CAST(strftime('%s', 'now') - strftime('%s', p.last_heartbeat_at) AS INTEGER) AS seconds_since
         FROM presence p
         JOIN characters c ON c.id = p.char_id
         WHERE p.last_heartbeat_at >= datetime('now', ?)
         ORDER BY datetime(p.last_heartbeat_at) DESC`
      )
      .all(`-${ONLINE_WINDOW_SECONDS} seconds`);

    return { citizens, online_window_seconds: ONLINE_WINDOW_SECONDS };
  },
};
