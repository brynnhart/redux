module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const marriages = ctx.db
      .prepare(
        `SELECT m.id, c1.name AS partner_one, c2.name AS partner_two, m.since
         FROM marriages m
         JOIN characters c1 ON c1.id = m.char1_id
         JOIN characters c2 ON c2.id = m.char2_id
         ORDER BY datetime(m.since) DESC`
      )
      .all();

    return {
      id: 'conjugal',
      title: 'Hall of Vows',
      character,
      marriages,
      description: 'Records of sacred bonds and notable unions celebrated across the realm.',
    };
  },
};
