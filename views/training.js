module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const masterName = character && character.level >= 10 ? 'Sir Turgon' : 'Turgon';
    const canChallenge = Boolean(character && character.level >= 5);

    return {
      training: {
        masterName,
        canChallenge,
      },
    };
  },
};
