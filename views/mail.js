const mapMessageRow = (row) => ({
  id: row.id,
  from: row.sender_name || 'Courier',
  body: row.body,
  created_at: row.created_at,
  read_at: row.read_at,
});

module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return { inbox: [], unread: 0 };
    }

    const query = ctx.db.prepare(
      `SELECT m.id, sender.name AS sender_name, m.body, m.created_at, m.read_at
         FROM mail m
         LEFT JOIN characters sender ON sender.id = m.from_char
         WHERE m.to_char = ?
         ORDER BY datetime(m.created_at) DESC`
    );

    const inbox = query.all(character.id).map(mapMessageRow);
    const unread = inbox.reduce((count, message) => (message.read_at ? count : count + 1), 0);

    return {
      inbox,
      unread,
    };
  },
};
