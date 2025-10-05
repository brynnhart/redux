module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'slaughter',
      title: 'The Arena of Slaughter',
      character,
      description:
        'Only the bravest (or most reckless) step into the arena to test their might against brutal foes.',
      challenges: [
        { name: 'Gladiator Melee', recommendedLevel: 5 },
        { name: 'Beastmaster Trials', recommendedLevel: 8 },
        { name: 'Endless Horde', recommendedLevel: 12 },
      ],
    };
  },
};
