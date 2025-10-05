module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'bank',
      title: 'Bank of the Realm',
      character,
      balances: character
        ? {
            purse: character.gold,
            vault: character.bank_gold,
            gems: character.gems,
          }
        : null,
      description: 'Secure your fortune and plan your investments with the royal bankers.',
    };
  },
};
