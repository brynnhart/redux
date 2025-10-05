module.exports = {
  async get(ctx) {
    const current = ctx.getCurrentCharacter();
    const targetsStmt = current
      ? ctx.db.prepare(
          `SELECT c.name, c.level, c.xp, CASE WHEN p.last_heartbeat_at IS NULL THEN 0 ELSE 1 END AS online
           FROM characters c
           LEFT JOIN presence p ON p.char_id = c.id
           WHERE c.id != ?
           ORDER BY c.level DESC, c.xp DESC`
        )
      : ctx.db.prepare(
          `SELECT c.name, c.level, c.xp, CASE WHEN p.last_heartbeat_at IS NULL THEN 0 ELSE 1 END AS online
           FROM characters c
           LEFT JOIN presence p ON p.char_id = c.id
           ORDER BY c.level DESC, c.xp DESC`
        );

    const rows = current ? targetsStmt.all(current.id) : targetsStmt.all();

    const targets = rows.map((row) => ({
      name: row.name,
      level: row.level,
      exp: row.xp,
      online: Boolean(row.online),
    }));

    return { targets };
  },
};
