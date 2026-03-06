import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';
import type { NewsService } from './newsService.js';
import { config } from '../config.js';
import { getArmorById, getWeaponById } from '../data/equipment.js';
import { getDayIndexFromDayKey } from './dayKey.js';

export type PvpMode = 'FIELDS' | 'INN_BREAKIN';
export type PvpAction = 'ATTACK' | 'RUN';

export interface PvpEncounterState {
  attackerId: string;
  targetId: string;
  targetName: string;
  mode: PvpMode;
  attackerHp: number;
  targetHp: number;
  rounds: string[];
  over: boolean;
}

export interface PvpActionResult {
  ok: boolean;
  message: string;
  state?: PvpEncounterState;
  over: boolean;
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export class PvpService {
  constructor(
    private readonly playerRepo: PlayerRepo,
    private readonly newsService: NewsService,
    private readonly rng: () => number = Math.random
  ) {}

  createEncounter(attacker: PlayerRecord, target: PlayerRecord, mode: PvpMode): PvpActionResult {
    if (!attacker.is_alive) {
      return { ok: false, message: 'You are dead and in no shape to attack anyone.', over: true };
    }
    if (attacker.turns_pvp_left <= 0) {
      return { ok: false, message: 'You already used your PvP attempt today.', over: true };
    }
    if (!target.is_alive) {
      return { ok: false, message: 'That target is already dead.', over: true };
    }
    if (mode === 'FIELDS' && target.in_inn_room) {
      return { ok: false, message: 'That target is sleeping in an Inn room.', over: true };
    }

    return {
      ok: true,
      over: false,
      message: `You close in on ${target.display_name}.`,
      state: {
        attackerId: attacker.id,
        targetId: target.id,
        targetName: target.display_name,
        mode,
        attackerHp: attacker.hp,
        targetHp: target.hp,
        rounds: ['Steel flashes in the dark...'],
        over: false
      }
    };
  }

  takeAction(state: PvpEncounterState, action: PvpAction, todayDayKey: string): PvpActionResult {
    const attacker = this.playerRepo.findById(state.attackerId);
    const target = this.playerRepo.findById(state.targetId);
    if (!attacker || !target) {
      return { ok: false, over: true, message: 'Combat target vanished.' };
    }

    if (action === 'RUN') {
      this.consumeAttempt(attacker);
      const msg = `${attacker.display_name} has attacked ${target.display_name} and has run away.`;
      this.newsService.addNews(todayDayKey, msg, { severity: 'pvp' });
      this.newsService.addDailyNews({ day: getDayIndexFromDayKey(todayDayKey), type: 'PVP_FLEE', actorId: attacker.id, targetId: target.id, message: `${attacker.display_name} has run away like a scared rat.` });
      return { ok: true, over: true, message: 'You run away like a scared rat.' };
    }

    const rounds = [...state.rounds];
    let attackerHp = state.attackerHp;
    let targetHp = state.targetHp;

    const opening = this.playerDamage(attacker, target);
    targetHp = Math.max(0, targetHp - opening);
    rounds.push(`You strike ${target.display_name} for ${opening} damage.`);

    if (targetHp <= 0) {
      const resultText = this.resolveAttackerWin(attacker, target, todayDayKey);
      return {
        ok: true,
        over: true,
        message: `${rounds.join(' ')} ${resultText}`
      };
    }

    const retaliation = this.playerDamage(target, attacker);
    attackerHp = Math.max(0, attackerHp - retaliation);
    rounds.push(`${target.display_name} hits back for ${retaliation} damage.`);

    if (attackerHp <= 0) {
      const resultText = this.resolveDefenderWin(attacker, target, todayDayKey);
      return {
        ok: true,
        over: true,
        message: `${rounds.join(' ')} ${resultText}`
      };
    }

    return {
      ok: true,
      over: false,
      message: rounds.join(' '),
      state: {
        ...state,
        attackerHp,
        targetHp,
        rounds
      }
    };
  }

  private resolveAttackerWin(attacker: PlayerRecord, target: PlayerRecord, todayDayKey: string) {
    const expGain = Math.max(200, Math.min(250000, Math.round(target.level * 2000 + target.exp * 0.05)));
    const stealPct = this.rng() * 0.25;
    const stolen = Math.max(0, Math.floor(target.gold_on_hand * stealPct));

    this.playerRepo.updatePlayerStats(attacker.id, {
      exp: attacker.exp + expGain,
      gold_on_hand: attacker.gold_on_hand + stolen,
      turns_pvp_left: 0,
      player_kills: attacker.player_kills + 1,
      hp: Math.max(1, attacker.hp)
    });

    this.playerRepo.updatePlayerStats(target.id, {
      hp: 0,
      is_alive: 0,
      in_inn_room: 0,
      last_killed_at: new Date().toISOString(),
      killed_by_player_id: attacker.id,
      gold_on_hand: Math.max(0, target.gold_on_hand - stolen)
    });

    const goldText = stolen > 0 ? ` You steal ${stolen} gold.` : ' You find no gold on him.';
    this.newsService.addNews(todayDayKey, `${attacker.display_name} has killed ${target.display_name}.`, { severity: 'pvp' });
    this.newsService.pvpKill(attacker.id, target.id, { dayKey: todayDayKey, killerName: attacker.display_name, victimName: target.display_name });
    return `You kill ${target.display_name}. +${expGain} exp.${goldText}`;
  }

  private resolveDefenderWin(attacker: PlayerRecord, target: PlayerRecord, todayDayKey: string) {
    this.playerRepo.updatePlayerStats(attacker.id, {
      hp: 0,
      is_alive: 0,
      turns_pvp_left: 0,
      last_killed_at: new Date().toISOString(),
      killed_by_player_id: target.id
    });

    this.newsService.addNews(todayDayKey, `${attacker.display_name} has attacked ${target.display_name} and has been killed in self-defense.`, { severity: 'pvp' });
    this.newsService.addDailyNews({ day: getDayIndexFromDayKey(todayDayKey), type: 'PVP_DEFEND', actorId: attacker.id, targetId: target.id, message: `${attacker.display_name} has attacked ${target.display_name} and has been killed in self-defense.` });

    return `${target.display_name} kills you in self-defense.`;
  }

  private consumeAttempt(attacker: PlayerRecord) {
    this.playerRepo.updatePlayerStats(attacker.id, {
      turns_pvp_left: 0
    });
  }

  private playerDamage(attacker: PlayerRecord, defender: PlayerRecord) {
    const weapon = getWeaponById(attacker.weapon_id);
    const armor = getArmorById(defender.armor_id);
    const atk = config.baseAtk + weapon.atk_bonus;
    const def = config.baseDef + armor.def_bonus;
    const raw = randInt(Math.max(1, Math.floor(atk * 0.8)), Math.max(1, Math.floor(atk * 1.2)), this.rng);
    return Math.max(1, raw - def);
  }
}
