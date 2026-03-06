import type { PlayerRecord } from '../repos/playerRepo.js';

export interface Choice {
  key: string;
  label: string;
}

export interface GameEffects {
  hp?: number;
  hp_max?: number;
  gold?: number;
  exp?: number;
  gems?: number;
  charm?: number;
  turns_forest_left?: number;
  turns_pvp_left?: number;
  skill_level_death?: number;
  skill_level_mystic?: number;
  skill_level_thief?: number;
  skill_mastery_death?: number;
  skill_mastery_mystic?: number;
  skill_mastery_thief?: number;
  daily_skill_training_used?: number;
}

export interface EventResult {
  text: string[];
  choices?: Choice[];
  effects?: GameEffects;
  payload?: Record<string, unknown>;
  keepOpen?: boolean;
  promptField?: string;
  globalNews?: string;
  personalNews?: string;
}

export interface EventContext {
  choice?: string;
  textInput?: string;
  payload?: Record<string, unknown>;
}

export interface ForestEvent {
  id: string;
  weight: number;
  minLevel?: number;
  maxLevel?: number;
  canTrigger?: (player: PlayerRecord) => boolean;
  execute: (player: PlayerRecord, session: EventContext, rng?: () => number) => EventResult;
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export class ForestEventEngine {
  constructor(private readonly events: ForestEvent[], private readonly rng: () => number = Math.random) {}

  pickEvent(player: PlayerRecord): ForestEvent {
    const pool = this.events.filter((event) => {
      if (event.minLevel !== undefined && player.level < event.minLevel) return false;
      if (event.maxLevel !== undefined && player.level > event.maxLevel) return false;
      if (event.canTrigger && !event.canTrigger(player)) return false;
      return true;
    });

    const totalWeight = pool.reduce((sum, event) => sum + event.weight, 0);
    let roll = this.rng() * Math.max(totalWeight, 1);

    for (const event of pool) {
      roll -= event.weight;
      if (roll <= 0) return event;
    }

    return pool[randInt(0, Math.max(0, pool.length - 1), this.rng)] ?? this.events[0];
  }

  execute(event: ForestEvent, player: PlayerRecord, context: EventContext): EventResult {
    return event.execute(player, context, this.rng);
  }

  getEvent(id: string) {
    return this.events.find((event) => event.id === id);
  }
}
