module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    const hp = character?.hp ?? 0;
    const hpMax = character?.hp_max ?? 0;
    const missing = Math.max(hpMax - hp, 0);
    const priceAll = missing * 2;
    const priceSome = Math.ceil(missing / 2) * 2;

    return {
      hp,
      hpMax,
      priceAll,
      priceSome,
    };
  },
};
