module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const stories = ctx.db
      .prepare('SELECT id, kind, text, created_at FROM news ORDER BY datetime(created_at) DESC')
      .all();

    return {
      id: 'news',
      title: 'Chronicles of the Realm',
      character,
      stories,
      description: 'Daily proclamations, whispered rumors, and battlefield reports compiled for adventurers.',
    };
  },
};
