module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const charId = character?.id;
    const inbox = charId
      ? ctx.db
          .prepare(
            'SELECT id, to_char, from_char, body, created_at, read_at FROM mail WHERE to_char = ? ORDER BY datetime(created_at) DESC'
          )
          .all(charId)
      : [];

    return {
      id: 'mail',
      title: 'Postmaster General',
      character,
      inbox,
      description: 'Messages dispatched across the realm arrive sealed with wax and wonder.',
    };
  },
};
