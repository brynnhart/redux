const BARD_DAILY_FLAG = 'inn-bard';

function getTodayDate(now) {
  return now.toISOString().slice(0, 10);
}

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
    let bardAvailable = false;

    if (hasCharacter) {
      const today = getTodayDate(ctx.now());
      const flag = ctx.db
        .prepare('SELECT used_on FROM daily_flags WHERE char_id = ? AND flag = ?')
        .get(character.id, BARD_DAILY_FLAG);
      bardAvailable = !flag || flag.used_on !== today;
    }

    return {
      patrons,
      bardAvailable,
      canFlirt: hasCharacter,
      barkeep: {
        elixirs: ['Strength', 'Hit Points', 'Vitality'],
        renameCostPerLevel: 500,
        keysCostPerLevel: 1600,
      },
    };
  },
  BARD_DAILY_FLAG,
  getTodayDate,
};
