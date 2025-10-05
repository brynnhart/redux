module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'forest',
      title: 'The Whispering Forest',
      character,
      description:
        'Towering trees and lurking creatures test the courage of any who wander beneath the canopy.',
      encounters: [
        'Scouting parties report strange tracks near the old druid circle.',
        'A faint glow has been seen between the ancient oaks at twilight.',
      ],
    };
  },
};
