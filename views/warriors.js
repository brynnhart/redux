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
    const total = ctx.db.prepare('SELECT COUNT(*) AS count FROM characters').get().count;
    const pagination = buildPagination(ctx.query, total, { defaultLimit: 25, maxLimit: 100 });

    const items = ctx.db
      .prepare(
        `SELECT c.name, c.level, c.created_at, CASE WHEN p.last_heartbeat_at IS NULL THEN 0 ELSE 1 END AS online
         FROM characters c
         LEFT JOIN presence p ON p.char_id = c.id
         ORDER BY c.level DESC, datetime(c.created_at) ASC
         LIMIT ? OFFSET ?`
      )
      .all(pagination.limit, pagination.offset)
      .map((row) => ({
        name: row.name,
        level: row.level,
        created_at: row.created_at,
        online: Boolean(row.online),
      }));

    const payload = {
      items,
      list: items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasPrev: pagination.hasPrev,
        hasNext: pagination.hasNext,
      },
    };

    return {
      ...payload,
      warriors: {
        items: payload.items,
        list: payload.list,
        pagination: payload.pagination,
      },
    };
  },
};
