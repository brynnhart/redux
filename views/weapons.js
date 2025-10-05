module.exports = {
  async get() {
    return {
      items: [
        { id: 'weapon-dagger', name: 'Dagger', stat: 3, price: 35 },
        { id: 'weapon-sword', name: 'Longsword', stat: 9, price: 150 },
        { id: 'weapon-axe', name: 'Battle Axe', stat: 13, price: 245 },
      ],
      resaleHint: '~½ price; charm may improve offer',
    };
  },
};
