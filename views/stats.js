const MAX_FOREST_FIGHTS_PER_DAY = 13;

function formatIsoDate(date) {
  if (!date) {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof date === 'string') {
    return new Date(date).toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();
    if (!character) {
      return { character: null, stats: null };
    }

    const details = ctx.db
      .prepare(`
        SELECT
          c.id,
          c.name,
          c.level,
          c.xp,
          c.hp,
          c.hp_max,
          c.gold,
          c.bank_gold,
          c.gems,
          w.name AS weapon_name,
          COALESCE(w.stat, 0) AS weapon_stat,
          a.name AS armour_name,
          COALESCE(a.stat, 0) AS armour_stat
        FROM characters c
        LEFT JOIN shop_weapons w ON w.id = c.weapon_id
        LEFT JOIN shop_armours a ON a.id = c.armour_id
        WHERE c.id = ?
      `)
      .get(character.id);

    const baseStat = 5 + details.level;

    const today = formatIsoDate(ctx.now());
    const fightsRow = ctx.db
      .prepare('SELECT fights_used FROM forest_fights WHERE char_id = ? AND fight_date = ?')
      .get(character.id, today);
    const fightsUsed = fightsRow?.fights_used ?? 0;
    const forestFightsLeft = Math.max(0, MAX_FOREST_FIGHTS_PER_DAY - fightsUsed);

    return {
      character: {
        id: details.id,
        name: details.name,
        level: details.level,
        xp: details.xp,
        hp: details.hp,
        hp_max: details.hp_max,
        gold: details.gold,
        bank_gold: details.bank_gold,
        gems: details.gems,
        charm: 8 + details.level,
      },
      stats: {
        strength: baseStat + details.weapon_stat,
        defense: baseStat + details.armour_stat,
        className: 'Adventurer',
        totalSkillsPerDay: 3,
        skillUsesLeft: 3,
        forestFightsLeft,
        pvpFightsLeft: 3,
        weapon: details.weapon_name || 'Unarmed',
        armor: details.armour_name || 'Clothes',
        goldInHand: details.gold,
      },
    };
  },
};
