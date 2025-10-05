module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return { character: null };
    }

    return {
      character: {
        level: character.level,
        xp: character.xp,
        hp: character.hp,
        hp_max: character.hp_max,
        gold: character.gold,
        bank_gold: character.bank_gold,
        gems: character.gems,
        weapon: 'Rusty Dagger',
        armour: "Traveler's Cloak",
        str: 5 + character.level,
        def: 5 + character.level,
        charm: 8 + character.level,
        ff_left: 13,
        pvp_left: 3,
        class: 'Adventurer',
        skills_total: 3,
        skills_left: 3,
      },
    };
  },
};
