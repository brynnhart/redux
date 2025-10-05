module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const citizens = ctx.db
      .prepare('SELECT name, level, sleeping, created_at FROM characters ORDER BY level DESC, name ASC')
      .all();

    return {
      id: 'people',
      title: 'People of the Realm',
      character,
      citizens,
      description: 'A register of notable heroes, wanderers, and residents currently in the land.',
    };
  },
};
