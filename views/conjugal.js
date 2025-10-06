module.exports = {
  async get(ctx) {
    const marriages = ctx.db
      .prepare(
        `SELECT
           c1.name AS p1,
           c2.name AS p2,
           strftime('%Y-%m-%d', m.since) AS since
         FROM marriages m
         JOIN characters c1 ON c1.id = m.char1_id
         JOIN characters c2 ON c2.id = m.char2_id
         ORDER BY datetime(m.since) DESC`
      )
      .all();

    return { marriages };
  },
};
