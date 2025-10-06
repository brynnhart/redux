module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return { character: null };
    }

    const details = ctx.db
      .prepare(`
        SELECT
          c.level,
          c.xp,
          c.hp,
          c.hp_max,
          c.gold,
          c.bank_gold,
          c.gems,
          w.name AS weapon_name,
          a.name AS armour_name
        FROM characters c
        LEFT JOIN shop_weapons w ON w.id = c.weapon_id
        LEFT JOIN shop_armours a ON a.id = c.armour_id
        WHERE c.id = ?
      `)
      .get(character.id);

    return {
      character: {
        level: details.level,
        xp: details.xp,
        hp: details.hp,
        hp_max: details.hp_max,
        gold: details.gold,
        bank_gold: details.bank_gold,
        gems: details.gems,
        weapon: details.weapon_name || 'Unarmed',
        armour: details.armour_name || 'Clothes',
        str: 5 + details.level,
        def: 5 + details.level,
        charm: 8 + details.level,
        ff_left: 13,
        pvp_left: 3,
        class: 'Adventurer',
        skills_total: 3,
        skills_left: 3,
      },
    };
  },
};
