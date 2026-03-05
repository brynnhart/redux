import { FOREST_EVENTS, type ForestEventKey } from '../content/forestEvents.js';
import type { PlayerRecord } from '../repos/playerRepo.js';

export interface ForestEventEncounter {
  key: ForestEventKey;
  text: string;
  choices?: string;
  payload?: Record<string, unknown>;
}

export interface ForestEventOutcome {
  text: string;
  patch: Partial<Pick<PlayerRecord, 'hp' | 'gold' | 'exp' | 'gems' | 'charm'>>;
  globalNews?: string;
  personalNews?: string;
  bigGemHaul?: boolean;
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export class ForestEventService {
  constructor(private readonly rng: () => number = Math.random) {}

  rollEvent(): ForestEventEncounter {
    if (this.rng() < 0.05) {
      return {
        key: 'somewhere_magic_happened',
        text: 'You feel a weird static in your teeth... somewhere magic has happened.'
      };
    }

    const totalWeight = FOREST_EVENTS.filter((event) => event.key !== 'somewhere_magic_happened').reduce((sum, event) => sum + event.weight, 0);
    let roll = this.rng() * totalWeight;

    for (const event of FOREST_EVENTS) {
      if (event.key === 'somewhere_magic_happened') continue;
      roll -= event.weight;
      if (roll <= 0) {
        return this.startEvent(event.key);
      }
    }

    return this.startEvent('angels_singing');
  }

  startEvent(key: ForestEventKey): ForestEventEncounter {
    if (key === 'fairies_bathing') {
      return {
        key,
        text: 'A ring of fairies are bathing in moonlit mud. Tiny wings. Bad ideas.',
        choices: '(A)sk for a blessing, (C)atch a fairy, (R)eturn quietly'
      };
    }

    if (key === 'dead_bird_scroll') {
      return {
        key,
        text: 'A dead bird clutches a blood-spotted scroll: "Find my daughter. Reward awaits."',
        choices: 'Choose a location: (1) Inn (2) Bank (3) Gardens (4) Graveyard (5) Keep',
        payload: { correctChoice: String(randInt(1, 5, this.rng)) }
      };
    }

    if (key === 'old_man_directions') {
      return {
        key,
        text: 'An old man squints at a map upside down. "Young one, directions?"',
        choices: '(Y)es, help him. (N)o, flee awkwardly.'
      };
    }

    if (key === 'somewhere_magic_happened') {
      return { key, text: 'Somewhere magic has happened!' };
    }

    return { key: 'angels_singing', text: 'You hear the voice of angels singing between the trees.' };
  }

  resolveImmediate(encounter: ForestEventEncounter, player: PlayerRecord): ForestEventOutcome {
    if (encounter.key === 'somewhere_magic_happened') {
      return {
        text: `Gold crackles and doubles in your pack. (${player.gold} -> ${player.gold * 2})`,
        patch: { gold: player.gold * 2 },
        globalNews: 'Somewhere magic has happened!'
      };
    }

    const gems = randInt(1, 3, this.rng);
    return {
      text: `A hymn hits your soul. You find ${gems} glittering gems in the moss.`,
      patch: { gems: player.gems + gems },
      bigGemHaul: gems >= 10
    };
  }

  resolveChoice(encounter: ForestEventEncounter, player: PlayerRecord, rawChoice: string): ForestEventOutcome {
    const choice = rawChoice.toUpperCase();

    if (encounter.key === 'fairies_bathing') {
      if (choice === 'A') {
        return { text: 'The fairies boop your forehead. You feel refreshed.', patch: { hp: player.hp_max } };
      }
      if (choice === 'C') {
        return { text: 'You dive heroically and grab... a thornberry bush. Ouch.', patch: { hp: 1 } };
      }
      return { text: 'You back away slowly. The fairies heckle you in rhyme.', patch: {} };
    }

    if (encounter.key === 'dead_bird_scroll') {
      const correctChoice = String(encounter.payload?.correctChoice ?? '1');
      if (choice === correctChoice) {
        const gemReward = randInt(10, 30, this.rng);
        const expReward = randInt(15, 35, this.rng);
        return {
          text: `You found her! A hidden cache spills ${gemReward} gems and ${expReward} experience into your lap.`,
          patch: { gems: player.gems + gemReward, exp: player.exp + expReward },
          bigGemHaul: gemReward >= 10
        };
      }
      return { text: 'Wrong chest. A troll springs out and clobbers you silly.', patch: { hp: Math.max(1, player.hp - 5) } };
    }

    if (encounter.key === 'old_man_directions') {
      if (choice === 'Y') {
        return {
          text: 'He nods, thanks you, and calls you "shockingly polite." You gain 8 experience.',
          patch: { exp: player.exp + 8 }
        };
      }
      return { text: 'You pretend you do not speak Common. He is not fooled.', patch: {} };
    }

    return { text: 'Nothing happens. Probably haunted.', patch: {} };
  }
}
