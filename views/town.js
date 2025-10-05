module.exports = {
  async get(ctx) {
    const rawCharacter = ctx.getCurrentCharacter();

    const character = rawCharacter
      ? {
          name: rawCharacter.name,
          level: rawCharacter.level,
          hp: rawCharacter.hp,
          hp_max: rawCharacter.hp_max,
          gold: rawCharacter.gold,
          bank_gold: rawCharacter.bank_gold,
          gems: rawCharacter.gems,
        }
      : null;

    const unreadMail = rawCharacter
      ? ctx.db
          .prepare('SELECT COUNT(*) AS count FROM mail WHERE to_char = ? AND read_at IS NULL')
          .get(rawCharacter.id).count
      : 0;

    const todayNews = ctx.db
      .prepare(
        `SELECT id, text, created_at
         FROM news
         WHERE DATE(created_at) = DATE('now', 'localtime')
         ORDER BY datetime(created_at) DESC`
      )
      .all();

    return {
      character,
      unreadMail,
      todayNews,
    };
  },
};
