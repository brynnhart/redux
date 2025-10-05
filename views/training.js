module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const masterLevel = character && character.level >= 10 ? 15 : 8;
    const masterName = character && character.level >= 10 ? 'Sir Turgon' : 'Turgon';

    return {
      master: {
        name: masterName,
        level: masterLevel,
      },
      canChallenge: Boolean(character && character.level >= 5),
    };
  },
};
