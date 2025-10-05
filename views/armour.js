module.exports = {
  async get() {
    return {
      items: [
        { id: 'armour-wooden-shield', name: 'Wooden Shield', stat: 3, price: 40 },
        { id: 'armour-chainmail', name: 'Chainmail', stat: 8, price: 135 },
        { id: 'armour-plate', name: 'Steel Plate', stat: 14, price: 280 },
      ],
      resaleHint: '~½ price; charm may improve offer',
    };
  },
};
