import { ForestEventEngine, type EventResult } from '../events/forestEventEngine.js';
import { deadBirdRescueEvent } from '../events/events/deadBirdRescue.js';
import { fairiesEvent } from '../events/events/fairies.js';
import { jennieEvent } from '../events/events/jennie.js';
import { oldManEvent } from '../events/events/oldMan.js';
import { oldWitchEvent } from '../events/events/oldWitch.js';
import { mysticalGuessingEvent } from '../events/events/mysticalGuessing.js';
import type { PlayerRecord } from '../repos/playerRepo.js';

export interface ForestEventEncounter {
  key: string;
  text: string;
  choices?: string;
  payload?: Record<string, unknown>;
  promptField?: string;
}

export interface ForestEventOutcome {
  text: string;
  patch: Partial<Pick<PlayerRecord, 'hp' | 'hp_max' | 'gold' | 'exp' | 'gems' | 'charm' | 'turns_forest_left' | 'turns_pvp_left' | 'skill_level_death' | 'skill_level_mystic' | 'skill_level_thief' | 'skill_mastery_death' | 'skill_mastery_mystic' | 'skill_mastery_thief' | 'daily_skill_training_used'>>;
  globalNews?: string;
  personalNews?: string;
  keepOpen?: boolean;
  promptField?: string;
}

const engineEvents = [fairiesEvent, oldManEvent, oldWitchEvent, deadBirdRescueEvent, jennieEvent, mysticalGuessingEvent];

export class ForestEventService {
  private readonly engine: ForestEventEngine;

  constructor(private readonly rng: () => number = Math.random) {
    this.engine = new ForestEventEngine(engineEvents, rng);
  }

  rollEvent(player: PlayerRecord): ForestEventEncounter {
    const event = this.engine.pickEvent(player);
    const result = this.engine.execute(event, player, {});
    return this.toEncounter(event.id, result);
  }

  resolveChoice(encounter: ForestEventEncounter, player: PlayerRecord, rawChoice: string, rawTextInput?: string): ForestEventOutcome {
    const event = this.engine.getEvent(encounter.key);
    if (!event) {
      return { text: 'Nothing happens.', patch: {} };
    }

    const result = this.engine.execute(event, player, {
      choice: rawChoice,
      textInput: rawTextInput,
      payload: encounter.payload
    });

    return this.toOutcome(result);
  }

  private toEncounter(key: string, result: EventResult): ForestEventEncounter {
    const choiceText = result.choices?.map((choice) => `(${choice.key}) ${choice.label}`).join('  ');
    return {
      key,
      text: result.text.join(' '),
      choices: choiceText,
      payload: result.payload,
      promptField: result.promptField
    };
  }

  private toOutcome(result: EventResult): ForestEventOutcome {
    return {
      text: result.text.join(' '),
      patch: result.effects ?? {},
      globalNews: result.globalNews,
      personalNews: result.personalNews,
      keepOpen: result.keepOpen,
      promptField: result.promptField
    };
  }
}
