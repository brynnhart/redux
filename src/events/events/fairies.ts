import type { ForestEvent } from '../forestEventEngine.js';

export const fairiesEvent: ForestEvent = {
  id: 'fairies',
  weight: 30,
  execute(player, session, rng = Math.random) {
    const choice = session.choice?.toUpperCase();
    if (!choice) {
      return {
        text: [
          'You stumble upon a group of fairies bathing in a crystal pool.',
          'One fairy notices you watching.'
        ],
        choices: [
          { key: 'A', label: 'Ask for blessing' },
          { key: 'C', label: 'Catch a fairy' },
          { key: 'L', label: 'Leave quietly' }
        ]
      };
    }

    if (choice === 'A') {
      const gainCharm = rng() < 0.2;
      return {
        text: [
          'The fairies giggle and swirl around you in silver light.',
          gainCharm ? 'Their blessing fills your body and your smile grows brighter.' : 'Their blessing restores your strength.'
        ],
        effects: { hp: player.hp_max, charm: gainCharm ? player.charm + 1 : player.charm },
        globalNews: `${player.display_name} received a fairy blessing in the forest.`
      };
    }

    if (choice === 'C') {
      const roll = rng();
      if (roll < 0.6) {
        return { text: ['You lunge, but the fairy zips away and pelts you with laughter.'] };
      }
      if (roll < 0.9) {
        return {
          text: ['You catch a fairy ribbon before she vanishes. It shimmers with strange power. A tiny fairy now owes you a life.'],
          effects: { has_fairy: 1 }
        };
      }
      return {
        text: ['You dive into a thorn bush. Every fairy in the pool cackles at you.'],
        effects: { hp: 1 }
      };
    }

    return { text: ['You leave quietly and the forest returns to its usual whispers.'] };
  }
};
