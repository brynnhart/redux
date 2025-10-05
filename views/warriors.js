module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const leaderboard = ctx.db
      .prepare('SELECT name, level, xp FROM characters ORDER BY level DESC, xp DESC LIMIT 20')
      .all();

    return {
      id: 'warriors',
      title: 'Hall of Warriors',
      character,
      leaderboard,
      description: 'Renowned fighters whose deeds echo through tavern songs and battlefield legends.',
    };
  },
};
