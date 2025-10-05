module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const news = ctx.db
      .prepare(
        'SELECT id, kind, text, created_at FROM news ORDER BY datetime(created_at) DESC LIMIT 5'
      )
      .all();

    return {
      id: 'town',
      title: 'Town Square',
      character,
      notices: news,
      description:
        'The heart of the realm where adventurers gather to hear the latest happenings.',
    };
  },
};
