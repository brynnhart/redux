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
    const basePayload = {
      id: 'forest',
      title: 'The Whispering Forest',
      description:
        'Towering trees and lurking creatures test the courage of any who wander beneath the canopy.',
      encounters: [
        'Scouting parties report strange tracks near the old druid circle.',
        'A faint glow has been seen between the ancient oaks at twilight.',
      ],
    };

    if (!character) {
      return {
        ...basePayload,
        character: null,
        fightsLeft: MAX_FOREST_FIGHTS_PER_DAY,
        weapon: null,
        hp: null,
        hpMax: null,
      };
    }

    const today = formatIsoDate(ctx.now());
    const details = ctx.db
      .prepare(
        `SELECT c.id, c.name, c.level, c.hp, c.hp_max,
                w.name AS weapon_name,
                COALESCE(w.stat, 0) AS weapon_stat
         FROM characters c
         LEFT JOIN shop_weapons w ON w.id = c.weapon_id
         WHERE c.id = ?`
      )
      .get(character.id);

    const fightsRow = ctx.db
      .prepare('SELECT fights_used FROM forest_fights WHERE char_id = ? AND fight_date = ?')
      .get(character.id, today);

    const fightsUsed = fightsRow?.fights_used ?? 0;
    const fightsLeft = Math.max(0, MAX_FOREST_FIGHTS_PER_DAY - fightsUsed);

    return {
      ...basePayload,
      character: details
        ? { id: details.id, name: details.name, level: details.level }
        : null,
      fightsLeft,
      weapon: details
        ? {
            name: details.weapon_name || 'Unarmed',
            stat: details.weapon_stat || 0,
          }
        : null,
      hp: details?.hp ?? null,
      hpMax: details?.hp_max ?? null,
    };
  },
};
