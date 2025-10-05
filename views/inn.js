module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const patrons = ctx.db
      .prepare(
        'SELECT id, text, color, created_at FROM patrons ORDER BY datetime(created_at) DESC'
      )
      .all();

    return {
      id: 'inn',
      title: 'The Gilded Griffin Inn',
      character,
      patrons,
      description: 'Warm hearths, tall tales, and fresh rumors await the weary traveler.',
    };
  },
};
