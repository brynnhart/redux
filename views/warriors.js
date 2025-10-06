module.exports = {
  async get(ctx) {
    const page = Math.max(1, parseInt(ctx.query.page, 10) || 1);
    let limit = parseInt(ctx.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      limit = 25;
    }
    limit = Math.min(limit, 100);

    const total = ctx.db.prepare('SELECT COUNT(*) AS count FROM characters').get().count;
    const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * limit;

    const list = ctx.db
      .prepare(
        `SELECT c.name, c.level, c.created_at, CASE WHEN p.last_heartbeat_at IS NULL THEN 0 ELSE 1 END AS online
         FROM characters c
         LEFT JOIN presence p ON p.char_id = c.id
         ORDER BY c.level DESC, datetime(c.created_at) ASC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset)
      .map((row) => ({
        name: row.name,
        level: row.level,
        created_at: row.created_at,
        online: Boolean(row.online),
      }));

    const payload = {
      list,
      pagination: {
        page: currentPage,
        limit,
        total,
        totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
      },
    };

    return {
      ...payload,
      warriors: payload,
    };
  },
};
