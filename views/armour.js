module.exports = {
  async get(ctx) {
    const items = ctx.db
      .prepare('SELECT id, name, stat, price FROM shop_armours ORDER BY price ASC')
      .all();

    return {
      items,
      resaleHint: 'Merchants usually offer around 50% of the listed price.',
    };
  },
};
