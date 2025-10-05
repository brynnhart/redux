module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const patrons = ctx.db
      .prepare(
        `SELECT p.id, c.name AS author, p.text, COALESCE(p.color, 'white') AS color, p.created_at
         FROM patrons p
         JOIN characters c ON c.id = p.char_id
         ORDER BY datetime(p.created_at) DESC`
      )
      .all();

    const hasCharacter = Boolean(character);

    return {
      patrons,
      bardAvailable: hasCharacter,
      canFlirt: hasCharacter,
      barkeep: {
        elixirs: ['Strength', 'Hit Points', 'Vitality'],
        renameCostPerLevel: 500,
        keysCostPerLevel: 1600,
      },
    };
  },
};
