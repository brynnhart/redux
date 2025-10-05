module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    const masterName = character && character.level >= 10 ? 'Sir Turgon the Unyielding' : 'Turgon the Blade';

    return {
      id: 'training',
      title: 'Guild Training Grounds',
      character,
      training: { masterName },
      description: 'Seasoned mentors offer lessons to hone your combat prowess and tactical insight.',
      drills: [
        { name: 'Sword Forms', benefit: '+5 attack skill', cost: 50 },
        { name: 'Shield Walls', benefit: '+5 defense skill', cost: 50 },
        { name: 'Battle Meditation', benefit: '+10 stamina', cost: 70 },
      ],
    };
  },
};
