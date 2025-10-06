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
  modals: {
    async readmail(ctx) {
      const character = ctx.getCurrentCharacter();
      if (!character) {
        return { inbox: [] };
      }

      const inbox = ctx.db
        .prepare(
          `SELECT m.id, sender.name AS sender_name, m.body, m.created_at, m.read_at
           FROM mail m
           LEFT JOIN characters sender ON sender.id = m.from_char
           WHERE m.to_char = ?
           ORDER BY datetime(m.created_at) DESC`
        )
        .all(character.id)
        .map((row) => ({
          id: row.id,
          from: row.sender_name,
          body: row.body,
          created_at: row.created_at,
          read_at: row.read_at,
        }));

      return { inbox };
    },
  },
};
