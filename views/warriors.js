module.exports = {
  async get(ctx) {
    const list = ctx.db
      .prepare(
        `SELECT c.name, c.level, c.created_at, CASE WHEN p.last_heartbeat_at IS NULL THEN 0 ELSE 1 END AS online
         FROM characters c
         LEFT JOIN presence p ON p.char_id = c.id
         ORDER BY c.level DESC, datetime(c.created_at) ASC`
      )
      .all()
      .map((row) => ({
        name: row.name,
        level: row.level,
        created_at: row.created_at,
        online: Boolean(row.online),
      }));

    return { list };
  },
};
