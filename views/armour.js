module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'armour',
      title: "Rhea's Armory",
      character,
      description: 'Layer yourself in protection with shields and armor built to weather any storm.',
      inventory: [
        { name: 'Chainmail Hauberk', cost: 180, defense: 14 },
        { name: 'Runed Shield', cost: 200, defense: 16 },
        { name: 'Leather Brigandine', cost: 110, defense: 9 },
      ],
    };
  },
};
