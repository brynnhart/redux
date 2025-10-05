module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'weapons',
      title: "Derrin's Arsenal",
      character,
      description: 'Blades, bows, and implements of war forged by the finest smiths in the land.',
      inventory: [
        { name: 'Steel Longsword', cost: 150, attack: 12 },
        { name: 'Oak Longbow', cost: 120, attack: 10 },
        { name: 'Enchanted Dagger', cost: 220, attack: 15 },
      ],
    };
  },
};
