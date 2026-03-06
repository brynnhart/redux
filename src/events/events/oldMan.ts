import type { ForestEvent } from '../forestEventEngine.js';

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export const oldManEvent: ForestEvent = {
  id: 'old_man',
  weight: 25,
  execute(player, session, rng = Math.random) {
    const choice = session.choice?.toUpperCase();
    if (!choice) {
      return {
        text: ['An old man approaches you looking lost.'],
        choices: [
          { key: 'Y', label: 'Help him' },
          { key: 'N', label: 'Ignore him' }
        ]
      };
    }

    if (choice !== 'Y') {
      return { text: ['You ignore him and keep walking.'] };
    }

    const rewardRoll = rng();
    if (rewardRoll < 0.33) {
      return {
        text: ['He thanks you warmly and calls you kind-hearted. (+1 charm, -1 forest fight)'],
        effects: { charm: player.charm + 1, turns_forest_left: Math.max(0, player.turns_forest_left - 1) }
      };
    }

    if (rewardRoll < 0.66) {
      const gold = randInt(100, 250, rng) + player.level * 40;
      return {
        text: [`He slips you a heavy pouch. (+${gold} gold, -1 forest fight)`],
        effects: { gold: player.gold + gold, turns_forest_left: Math.max(0, player.turns_forest_left - 1) }
      };
    }

    const exp = 75 + player.level * 60;
    return {
      text: [`He teaches you an old trail trick. (+${exp} exp, -1 forest fight)`],
      effects: { exp: player.exp + exp, turns_forest_left: Math.max(0, player.turns_forest_left - 1) }
    };
  }
};
