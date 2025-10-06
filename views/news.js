function toPositiveInt(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function buildPagination(query, total, { defaultLimit, maxLimit }) {
  const requestedPage = toPositiveInt(query?.page) ?? 1;
  let limit = toPositiveInt(query?.limit) ?? defaultLimit;
  if (!limit) {
    limit = defaultLimit;
  }
  limit = Math.max(1, Math.min(limit, maxLimit));

  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);

  return {
    page,
    limit,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    offset: (page - 1) * limit,
  };
}

module.exports = {
  async get(ctx) {
    const total = ctx.db.prepare('SELECT COUNT(*) AS count FROM news').get().count;
    const pagination = buildPagination(ctx.query, total, { defaultLimit: 10, maxLimit: 100 });

    const items = ctx.db
      .prepare(
        `SELECT id, kind, text, created_at
         FROM news
         ORDER BY datetime(created_at) DESC
         LIMIT ? OFFSET ?`
      )
      .all(pagination.limit, pagination.offset);

    return {
      items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasPrev: pagination.hasPrev,
        hasNext: pagination.hasNext,
      },
    };
  },
};
