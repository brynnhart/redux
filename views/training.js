module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'training',
      title: 'Guild Training Grounds',
      character,
      description: 'Seasoned mentors offer lessons to hone your combat prowess and tactical insight.',
      drills: [
        { name: 'Sword Forms', benefit: '+5 attack skill', cost: 50 },
        { name: 'Shield Walls', benefit: '+5 defense skill', cost: 50 },
        { name: 'Battle Meditation', benefit: '+10 stamina', cost: 70 },
      ],
    };
  },
};
