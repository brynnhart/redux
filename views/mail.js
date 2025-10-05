module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return { inbox: [], unread: 0 };
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

    const unread = inbox.filter((message) => !message.read_at).length;

    return {
      inbox,
      unread,
    };
  },
};
