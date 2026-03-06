import { ENEMY_TABLE } from '../content/enemies.js';
import { config } from '../config.js';
import { getDb } from '../db/db.js';
import type { PlayerRecord } from '../repos/playerRepo.js';
import { ForestStateRepo, type ForestEncounterState } from '../repos/forestStateRepo.js';
import type { PlayerRepo } from '../repos/playerRepo.js';
import type { NewsService } from './newsService.js';
import { CombatService, type ActiveEnemy } from './combatService.js';
import { ForestEventService, type ForestEventEncounter } from './forestEventService.js';
import { consumeClassSkillUsePatch } from './skillService.js';
import { getDayIndexFromDayKey } from './dayKey.js';

export interface ForestEventResolution {
  text: string;
  promptField?: string;
}


interface DragonBattleResult {
  text: string;
  playerWon: boolean;
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

      patch.gold_on_hand = player.gold_on_hand + goldEarned;
      patch.exp = player.exp + expEarned;
      patch.gems = player.gems + gemDrop;

      this.stateRepo.clearEncounter(player.id);
      this.playerRepo.updatePlayerStats(player.id, patch);

      if (gemDrop >= 10) {
        this.newsService.addNews(today, `${player.display_name} was showered in gems.`, { severity: 'highlight', playerId: player.id });
      }
      if (this.rng() < 0.12) {
        this.newsService.addNews(today, `${player.display_name} walks out of the forest acting chipper.`, { severity: 'info' });
      }

      return `${result.rounds.join(' ')} Loot: +${goldEarned} gold, +${expEarned} exp${gemDrop ? `, +${gemDrop} gem` : ''}.`;
    }

    this.playerRepo.updatePlayerStats(player.id, patch);
    this.stateRepo.clearEncounter(player.id);

    if (result.playerDied) {
      this.newsService.addNews(today, `${player.display_name} was killed in the forest.`, { severity: 'pvp' });
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

  useSkill(player: PlayerRecord, today: string, skillKey: string): string {
    const current = this.stateRepo.findByPlayerId(player.id);
    if (current.encounterType !== 'ENEMY') {
      return 'There is nothing here worth using a skill on.';
    }

    if (player.turns_forest_left <= 0) {
      return 'You are too tired to focus your class skill.';
    }

    const usesLeft = player.class === 'DEATH_KNIGHT' ? player.skill_uses_death : player.class === 'MYSTICAL' ? player.skill_uses_mystic : player.skill_uses_thief;
    if (usesLeft <= 0) {
      return 'Your class skills are spent for today.';
    }

    const enemy = current.encounterPayload as unknown as ActiveEnemy;
    const result = this.combatService.useSkill(player, enemy, skillKey);

    const patch: Partial<PlayerRecord> = {
      hp: Math.max(0, result.playerHpAfter),
      turns_forest_left: Math.max(0, player.turns_forest_left - 1),
      ...consumeClassSkillUsePatch(player)
    };

    if (result.enemyHpAfter <= 0) {
      let goldEarned = enemy.goldReward;
      const expEarned = enemy.expReward;
      let gemDrop = 0;
      if (this.rng() < enemy.gemChance) {
        gemDrop = 1;
      }
      patch.gold_on_hand = player.gold_on_hand + goldEarned;
      patch.exp = player.exp + expEarned;
      patch.gems = player.gems + gemDrop;
      this.playerRepo.updatePlayerStats(player.id, patch);
      this.stateRepo.clearEncounter(player.id);
      return `${result.rounds.join(' ')} ${enemy.name} falls. Loot: +${goldEarned} gold, +${expEarned} exp${gemDrop ? `, +${gemDrop} gem` : ''}.`;
    }

    this.playerRepo.updatePlayerStats(player.id, patch);
    enemy.hp = result.enemyHpAfter;
    enemy.weakenedTurns = result.enemyWeakenedTurns;
    this.stateRepo.upsertEncounter(player.id, 'ENEMY', enemy.key, enemy as unknown as Record<string, unknown>);

    if (result.playerHpAfter <= 0) {
      this.stateRepo.clearEncounter(player.id);
      this.newsService.addNews(today, `${player.display_name} was killed in the forest.`, { severity: 'pvp' });
      this.playerRepo.updatePlayerStats(player.id, { hp: 1, turns_forest_left: 0 });
      return `${result.rounds.join(' ')} You collapse after the technique backfires.`;
    }

    return `${result.rounds.join(' ')} ${enemy.name} remains at ${result.enemyHpAfter} HP.`;
  }

  searchDragon(player: PlayerRecord, today: string): DragonBattleResult {
    if (player.level < 12) {
      return {
        text: 'Only Ultimate Warriors may challenge the Red Dragon.',
        playerWon: false
      };
    }

    if (player.dragon_fought_today) {
      return {
        text: 'You have already challenged the Red Dragon today. Return tomorrow if you still crave doom.',
        playerWon: false
      };
    }

    const current = this.stateRepo.findByPlayerId(player.id);
    if (current.encounterType !== 'NONE') {
      return {
        text: 'You are already in an encounter. Resolve it before chasing dragons.',
        playerWon: false
      };
    }

    const rounds: string[] = ['You track scorched footprints and sulfur to a cavern of bones.'];
    let playerHp = Math.max(0, player.hp);
    let dragonHp = config.dragonHp;
    let fairyUsed = false;

    while (playerHp > 0 && dragonHp > 0) {
      if (this.rng() >= config.playerMissChance) {
        const hit = this.combatService.playerAttackDamage(player, config.dragonAttackMin);
        dragonHp = Math.max(0, dragonHp - hit);
        rounds.push(`You strike the Red Dragon for ${hit} damage!`);
      } else {
        rounds.push('Your blow whistles past a wall of crimson scales.');
      }

      if (dragonHp <= 0) {
        break;
      }

      if (this.rng() < config.dragonMissChance) {
        rounds.push('The Red Dragon snaps at air and misses you!');
        continue;
      }

      let retaliate = this.combatService.enemyAttackDamage(player, {
        key: 'red_dragon',
        name: 'Red Dragon',
        maxHp: config.dragonHp,
        hp: dragonHp,
        attackMin: config.dragonAttackMin,
        attackMax: config.dragonAttackMax,
        goldReward: 0,
        expReward: 0,
        gemChance: 0
      });

      if (this.rng() < config.dragonCritChance) {
        retaliate = Math.max(1, Math.floor(retaliate * config.dragonCritMult));
        rounds.push("CRITICAL! The dragon's claws rip through your guard!");
      }

      playerHp = Math.max(0, playerHp - retaliate);
      rounds.push(`The Red Dragon mauls you for ${retaliate} damage!`);

      if (playerHp <= 0 && player.has_fairy && !fairyUsed) {
        fairyUsed = true;
        playerHp = Math.max(1, Math.ceil(player.hp_max * config.dragonFairyReviveHpRatio));
        rounds.push("A fairy's tiny hands pull you back from death!");
      }
    }

    const db = getDb();
    db.exec('BEGIN');
    try {
      if (dragonHp <= 0) {
        const lapBefore = player.current_lap || 1;
        const lapAfter = lapBefore + 1;
        const patch: Partial<PlayerRecord> = {
          heroic_deeds_done: player.heroic_deeds_done + 1,
          dragon_kills_total: (player.dragon_kills_total ?? 0) + 1,
          current_lap: lapAfter,
          dragon_fought_today: 1,
          level: 1,
          exp: 0,
          hp_max: config.baseHp,
          hp: config.baseHp,
          gold_on_hand: config.dragonResetGoldOnHand,
        };

        if (!config.dragonResetKeepBankGold) {
          patch.gold_in_bank = 0;
        }

        if (!config.dragonResetKeepEquipment) {
          patch.weapon_id = 'stick';
          patch.armor_id = 'rags';
          patch.weapon_tier = 1;
          patch.armor_tier = 1;
        }

        if (!config.dragonResetKeepElixirs) {
          patch.elixirs = 0;
        }

        if (!config.dragonResetKeepCharm) {
          patch.charm = 0;
        }

        if (!config.dragonResetKeepSkillMastery) {
          patch.skill_mastery_death = 0;
          patch.skill_mastery_mystic = 0;
          patch.skill_mastery_thief = 0;
        }

        if (fairyUsed) {
          patch.has_fairy = 0;
        }

        this.playerRepo.updatePlayerStats(player.id, patch);
        this.newsService.addNews(today, `${player.display_name} has defeated the Red Dragon!`, { severity: 'dragon' });
        this.newsService.dragonKill(player.id, { dayKey: today, playerName: player.display_name });
        db.prepare(
          `INSERT INTO player_history (player_id, day_key, event_type, lap_before, lap_after, created_at)
           VALUES (?, ?, 'dragon_kill', ?, ?, ?)`
        ).run([player.id, today, lapBefore, lapAfter, new Date().toISOString()]);

        db.exec('COMMIT');
        return {
          text: `${rounds.join(' ')} You have slain the Red Dragon! You return to Level 1 to begin your next heroic deed...`,
          playerWon: true
        };
      }

      const deathPatch: Partial<PlayerRecord> = {
        hp: 1,
        turns_forest_left: 0,
        dragon_fought_today: 1,
        has_fairy: fairyUsed ? 0 : player.has_fairy
      };
      this.playerRepo.updatePlayerStats(player.id, deathPatch);
      this.newsService.addNews(today, `The Red Dragon has killed ${player.display_name}!`, { severity: 'dragon' });
      this.newsService.addDailyNews({ day: getDayIndexFromDayKey(today), type: 'DRAGON_KILLED', targetId: player.id, message: `The Red Dragon has killed ${player.display_name}.` });
      db.exec('COMMIT');

      return {
        text: `${rounds.join(' ')} The Red Dragon leaves you broken. Your forest day is over.`,
        playerWon: false
      };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
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
      this.newsService.addNews(today, outcome.globalNews, { severity: 'info' });
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
