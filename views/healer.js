module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'healer',
      title: 'Sanctum of Menders',
      character,
      description: 'Kindly clerics and herbalists patch wounds, mend armor, and soothe troubled minds.',
      services: [
        { name: 'Mend Wounds', cost: 40, description: 'Restores hit points to their maximum.' },
        { name: 'Purify Toxins', cost: 75, description: 'Removes poisons and crippling curses.' },
        { name: 'Blessed Rest', cost: 20, description: 'Spend an hour in peace to recover stamina.' },
      ],
    };
  },
};
