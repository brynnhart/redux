import { config } from '../../config.js';
import type { ForestEvent } from '../forestEventEngine.js';

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export const mysticalGuessingEvent: ForestEvent = {
  id: 'mystical_guessing',
  weight: 1,
  canTrigger: (player) => player.class === 'MYSTICAL',
  execute: (player, session, rng = Math.random) => {
    const payload = session.payload ?? {};
    const target = Number(payload.target ?? randInt(1, 100, rng));
    const remaining = Number(payload.remaining ?? 7);

    if (!session.choice) {
      return {
        text: ['A hooded mystic grins. "I think of a number from 1 to 100. Can you find it in 7 guesses?"'],
        choices: [
          { key: 'G', label: 'Guess a number' },
          { key: 'Q', label: 'Walk away' }
        ],
        keepOpen: true,
        payload: { target, remaining }
      };
    }

    const choice = session.choice.toUpperCase();
    if (choice === 'Q') {
      return { text: ['You bow out of the puzzle and the mystic vanishes into smoke.'] };
    }

    if (choice === 'G') {
      return {
        text: [`Enter your guess (1-100). Tries left: ${remaining}`],
        keepOpen: true,
        promptField: 'mystic_guess',
        payload: { target, remaining }
      };
    }

    if (choice === 'T') {
      const guess = Number(session.textInput);
      if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
        return {
          text: ['That is not a valid guess. Use a whole number from 1 to 100.'],
          keepOpen: true,
          promptField: 'mystic_guess',
          payload: { target, remaining }
        };
      }

      const nextRemaining = remaining - 1;
      if (guess === target) {
        const nextSkill = player.skill_level_mystic + 1;
        return {
          text: ['Correct! The mystic nods with respect. (+1 mystic skill)'],
          effects: {
            exp: player.exp + 12 + player.level * 2,
            skill_level_mystic: nextSkill,
            skill_mastery_mystic: nextSkill >= config.skillMasteryLevel ? 1 : player.skill_mastery_mystic
          },
          globalNews: `${player.display_name} solved a mystical number trial.`
        };
      }

      if (nextRemaining <= 0) {
        return {
          text: [`Wrong. The number was ${target}. "More training," the mystic says.`]
        };
      }

      return {
        text: [guess < target ? 'Higher.' : 'Lower.', `Guesses left: ${nextRemaining}.`],
        choices: [
          { key: 'G', label: 'Guess again' },
          { key: 'Q', label: 'Give up' }
        ],
        keepOpen: true,
        payload: { target, remaining: nextRemaining }
      };
    }

    return {
      text: ['The mystic waits patiently for a real choice.'],
      keepOpen: true,
      payload: { target, remaining }
    };
  }
};
