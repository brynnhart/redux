import { ENEMY_TABLE } from '../content/enemies.js';
import type { PlayerRecord } from '../repos/playerRepo.js';
import { ForestStateRepo, type ForestEncounterState } from '../repos/forestStateRepo.js';
import type { PlayerRepo } from '../repos/playerRepo.js';
import type { NewsService } from './newsService.js';
import { CombatService, type ActiveEnemy } from './combatService.js';
import { ForestEventService, type ForestEventEncounter } from './forestEventService.js';

export interface ForestEventResolution {
  text: string;
  promptField?: string;
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export class ForestService {
  constructor(
    private readonly playerRepo: PlayerRepo,
    private readonly newsService: NewsService,
    private readonly stateRepo = new ForestStateRepo(),
    private readonly combatService = new CombatService(),
    private readonly eventService = new ForestEventService(),
    private readonly rng: () => number = Math.random
  ) {}

  getEncounter(playerId: string): ForestEncounterState {
    return this.stateRepo.findByPlayerId(playerId);
  }

  look(player: PlayerRecord, today: string): string {
    const current = this.stateRepo.findByPlayerId(player.id);
    if (current.encounterType !== 'NONE') {
      return 'You are already in the middle of something awful. Resolve it first.';
    }

    if (this.rng() < 0.7) {
      const enemy = this.generateEnemy(player.level);
      this.stateRepo.upsertEncounter(player.id, 'ENEMY', enemy.key, enemy as unknown as Record<string, unknown>);
      return `You spot ${enemy.name}! It snarls, probably about taxes. (A)ttack or (R)un.`;
    }

    const event = this.eventService.rollEvent(player);
    this.stateRepo.upsertEncounter(player.id, 'EVENT', event.key, event.payload);
    return `You wander deeper into the forest... ${event.text} ${event.choices ?? ''}`;
  }

  attack(player: PlayerRecord, today: string): string {
    const current = this.stateRepo.findByPlayerId(player.id);
    if (current.encounterType !== 'ENEMY') {
      return 'Attack what? Maybe (L)ook first.';
    }

    if (player.turns_forest_left <= 0) {
      return 'You are too tired to swing at anything.';
    }

    const enemy = current.encounterPayload as unknown as ActiveEnemy;
    const result = this.combatService.fight(player, enemy);

    const patch: Partial<PlayerRecord> = {
      hp: result.playerDied ? 1 : result.playerHpAfter,
      turns_forest_left: result.playerDied ? 0 : player.turns_forest_left - 1
    };

    if (result.playerWon) {
      let goldEarned = enemy.goldReward;
      const expEarned = enemy.expReward;
      if (this.rng() < 0.1) {
        const bonusGold = randInt(2, 10 + player.level * 2, this.rng);
        goldEarned += bonusGold;
      }

      let gemDrop = 0;
      if (this.rng() < enemy.gemChance) {
        gemDrop = 1;
      }

      patch.gold = player.gold + goldEarned;
      patch.exp = player.exp + expEarned;
      patch.gems = player.gems + gemDrop;

      this.stateRepo.clearEncounter(player.id);
      this.playerRepo.updatePlayerStats(player.id, patch);

      if (gemDrop >= 10) {
        this.newsService.addNews({ date: today, type: 'GENERIC', message: `${player.display_name} was showered in gems.`, playerId: player.id });
      }
      if (this.rng() < 0.12) {
        this.newsService.addNews({ date: today, type: 'GENERIC', message: `${player.display_name} walks out of the forest acting chipper.` });
      }

      return `${result.rounds.join(' ')} Loot: +${goldEarned} gold, +${expEarned} exp${gemDrop ? `, +${gemDrop} gem` : ''}.`;
    }

    this.playerRepo.updatePlayerStats(player.id, patch);
    this.stateRepo.clearEncounter(player.id);

    if (result.playerDied) {
      this.newsService.addNews({ date: today, type: 'GENERIC', message: `${player.display_name} was killed in the forest.` });
      return `${result.rounds.join(' ')} You crawl back to town at 1 HP. Your forest day is over.`;
    }

    return `${result.rounds.join(' ')} You survive, barely.`;
  }

  run(player: PlayerRecord): string {
    const current = this.stateRepo.findByPlayerId(player.id);
    if (current.encounterType !== 'ENEMY') {
      return 'You run in a circle and end up exactly where you started.';
    }

    this.stateRepo.clearEncounter(player.id);
    return 'You bolt between the trees and escape. No turn spent.';
  }

  resolveEventChoice(player: PlayerRecord, today: string, choice: string, textInput?: string): ForestEventResolution {
    const current = this.stateRepo.findByPlayerId(player.id);
    if (current.encounterType !== 'EVENT' || !current.encounterKey) {
      return { text: 'No event is waiting for a choice.' };
    }

    const encounter: ForestEventEncounter = {
      key: current.encounterKey as ForestEventEncounter['key'],
      text: '',
      payload: current.encounterPayload
    };

    const outcome = this.eventService.resolveChoice(encounter, player, choice, textInput);
    this.playerRepo.updatePlayerStats(player.id, outcome.patch);

    if (outcome.keepOpen) {
      this.stateRepo.upsertEncounter(player.id, 'EVENT', encounter.key, encounter.payload);
      return { text: outcome.text, promptField: outcome.promptField };
    }

    this.stateRepo.clearEncounter(player.id);

    if (outcome.globalNews) {
      this.newsService.addNews({ date: today, type: 'GENERIC', message: outcome.globalNews });
    }

    return { text: `${outcome.text} Press any key to continue...` };
  }

  clearEncounter(playerId: string) {
    this.stateRepo.clearEncounter(playerId);
  }

  private generateEnemy(level: number): ActiveEnemy {
    const candidates = ENEMY_TABLE.filter((enemy) => level >= enemy.minLevel && level <= enemy.maxLevel);
    const fallback = ENEMY_TABLE.filter((enemy) => enemy.minLevel <= level).slice(-3);
    const pool = candidates.length > 0 ? candidates : fallback;
    const template = pool[randInt(0, pool.length - 1, this.rng)];

    const maxHp = template.hpBase + template.hpPerLevel * level;
    return {
      key: template.key,
      name: template.name,
      hp: maxHp,
      maxHp,
      attackMin: template.attackBase + template.attackPerLevel * Math.max(1, level - 1),
      attackMax: template.attackBase + template.attackPerLevel * level + 2,
      goldReward: template.goldBase + template.goldPerLevel * level,
      expReward: template.expBase + template.expPerLevel * level,
      gemChance: template.gemChance
    };
  }
}
