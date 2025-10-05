module.exports = {
  async get(ctx) {
    const page = Math.max(1, parseInt(ctx.query.page, 10) || 1);
    let limit = parseInt(ctx.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      limit = 10;
    }
    limit = Math.min(limit, 100);

    const total = ctx.db.prepare('SELECT COUNT(*) AS count FROM news').get().count;
    const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * limit;

    const items = ctx.db
      .prepare(
        `SELECT id, kind, text, created_at
         FROM news
         ORDER BY datetime(created_at) DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    return {
      items,
      pagination: {
        page: currentPage,
        limit,
        total,
        totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
      },
    };
  },
};
