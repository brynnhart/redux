module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    const stats = character
      ? {
          goldInHand: character.gold,
          weapon: 'Rusty Dagger',
          armor: 'Traveler\'s Cloak',
          charm: 8 + character.level,
          className: 'Adventurer',
          totalSkillsPerDay: 3,
          skillUsesLeft: 3,
          pvpFightsLeft: 3,
          forestFightsLeft: 13,
          strength: 5 + character.level,
        }
      : null;

    return {
      id: 'stats',
      title: 'Adventurer Profile',
      character,
      stats,
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
