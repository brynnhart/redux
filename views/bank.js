module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      onHand: character?.gold ?? 0,
      inBank: character?.bank_gold ?? 0,
      canTransfer: Boolean(character),
      transferLimitPerDay: 2,
      transferMax: 500,
    };
  },
};
