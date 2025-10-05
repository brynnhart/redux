module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'stats',
      title: 'Adventurer Profile',
      character,
      derived: character
        ? {
            healthPercentage: character.hp_max
              ? Math.round((character.hp / character.hp_max) * 100)
              : null,
            wealth: character.gold + character.bank_gold,
          }
        : null,
      description: 'A ledger capturing your accomplishments, resources, and readiness.',
    };
  },
};
