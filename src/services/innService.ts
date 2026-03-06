import { randomUUID } from 'node:crypto';

import { config } from '../config.js';
import { getDb } from '../db/db.js';
import { getWeaponById } from '../data/equipment.js';
import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';
import type { NewsService } from './newsService.js';

export interface InnTarget {
  id: string;
  display_name: string;
  level: number;
  has_room: number;
  weapon_id: string;
}

interface ActionResult {
  ok: boolean;
  message: string;
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export class InnService {
  constructor(
    private readonly playerRepo: PlayerRepo,
    private readonly newsService: NewsService,
    private readonly rng: () => number = Math.random
  ) {}

  flirt(player: PlayerRecord, today: string, style: 'SWEET' | 'COCKY' | 'WEIRD'): ActionResult {
    if (player.inn_flirt_used_today || player.has_flirted_today) {
      return { ok: false, message: 'Violet smiles politely. You already had your shot today.' };
    }

    const minExp = style === 'WEIRD' ? player.level * 20 : player.level * 30;
    const maxExp = style === 'WEIRD' ? player.level * 40 : player.level * 60;
    const expGain = randInt(minExp, Math.max(minExp, maxExp), this.rng);

    const patch: Partial<PlayerRecord> = {
      exp: player.exp + expGain,
      has_flirted_today: 1,
      daily_flirt_used: 1,
      inn_flirt_used_today: 1
    };

    const rewards: string[] = [`+${expGain} exp`];
    if (this.rng() < 0.1) {
      patch.charm = player.charm + 1;
      rewards.push('+1 charm');
    }
    if (this.rng() < 0.05) {
      patch.gems = player.gems + 1;
      rewards.push('+1 gem');
    }

    this.playerRepo.updatePlayerStats(player.id, patch);
    this.newsService.addNews(today, `${player.display_name} spent time flirting with Violet at the Inn.`, { severity: 'info' });

    const opener = style === 'SWEET'
      ? 'You talk sweetly, and Violet laughs behind her hand.'
      : style === 'COCKY'
        ? 'You swagger and boast. Violet rolls her eyes... then grins.'
        : 'You ramble about moonlit turnips. Violet cannot look away.';

    return { ok: true, message: `${opener} Rewards: ${rewards.join(', ')}.` };
  }

  listenToBard(player: PlayerRecord, today: string): ActionResult {
    if (player.bard_listens_used_today >= config.bardMaxListensPerDay || player.has_listened_bard_today) {
      return { ok: false, message: 'Seth Able has no encore for you today.' };
    }

    const bonus = config.innBardBonusFights;
    const patch: Partial<PlayerRecord> = {
      turns_forest_left: player.turns_forest_left + bonus,
      bonus_forest_fights: player.bonus_forest_fights + bonus,
      has_listened_bard_today: 1,
      daily_bard_used: 1,
      bard_listens_used_today: player.bard_listens_used_today + 1
    };

    let doublerText = '';
    if (!player.today_money_doubler_used && this.rng() < config.moneyDoublerChance) {
      const doubled = this.safeDouble(player.bank_gold);
      patch.bank_gold = doubled.value;
      patch.today_money_doubler_used = 1;
      doublerText = ` Somewhere magic has happened! Bank gold doubled from ${player.bank_gold} to ${doubled.value}${doubled.clamped ? ' (vault cap reached)' : ''}.`;
      this.newsService.addNews(today, 'Somewhere magic has happened!', { severity: 'highlight', playerId: player.id });
    }

    this.playerRepo.updatePlayerStats(player.id, patch);

    this.newsService.addNews(today, `${player.display_name} listened to Seth Able and gained extra Forest courage.`, { severity: 'info' });

    return { ok: true, message: `${this.getLyrics()} (+${bonus} bonus forest fights)${doublerText}` };
  }

  rentRoom(player: PlayerRecord, today: string): ActionResult {
    if (player.has_room) {
      return { ok: false, message: 'You already rented a room for tonight.' };
    }

    const cost = Math.max(1, config.innRoomCostPerLevel * player.level);
    if (player.gold < cost) {
      return { ok: false, message: `Room cost is ${cost} gold. You only have ${player.gold}.` };
    }

    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - cost,
      has_room: 1,
      in_room: 1,
      daily_room_rented: 1,
      room_paid_until_day_key: today,
      room_expires_at: `${today}T23:59:59`
    });

    this.newsService.addNews(today, `${player.display_name} rented a room at the Inn.`, { severity: 'info' });

    return { ok: true, message: 'You rent a room. You sleep behind a locked door...' };
  }

  buyElixir(player: PlayerRecord): ActionResult {
    if (player.gold < config.innElixirGoldCost) {
      return { ok: false, message: `An elixir costs ${config.innElixirGoldCost} gold.` };
    }
    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - config.innElixirGoldCost,
      elixirs: player.elixirs + 1
    });
    return { ok: true, message: 'You buy a bitter elixir and pocket it for later.' };
  }

  tradeGemsForElixir(player: PlayerRecord): ActionResult {
    if (player.gems < config.innGemTradeCost) {
      return { ok: false, message: `${config.innGemTradeCost} gems are required for one elixir.` };
    }
    this.playerRepo.updatePlayerStats(player.id, {
      gems: player.gems - config.innGemTradeCost,
      elixirs: player.elixirs + 1
    });
    return { ok: true, message: `Trade made: -${config.innGemTradeCost} gems, +1 elixir.` };
  }

  bribeBartender(player: PlayerRecord): ActionResult {
    if (player.level <= 1) {
      return { ok: false, message: 'The bartender snorts: level 1 pups are not invited upstairs.' };
    }
    if (player.inn_breakin_used_today) {
      return { ok: true, message: 'The bartender nods. You already paid for tonight\'s access.' };
    }
    if (player.gold < config.innBribeCost) {
      return { ok: false, message: `Bribe costs ${config.innBribeCost} gold.` };
    }

    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - config.innBribeCost,
      inn_breakin_used_today: 1,
      inn_bribe_count_today: player.inn_bribe_count_today + 1
    });

    return { ok: true, message: 'You slide coins over. The bartender whispers: "quiet doors, third hall."' };
  }

  getBreakInTargets(attacker: PlayerRecord): InnTarget[] {
    if (attacker.level <= 1 || !attacker.inn_breakin_used_today) {
      return [];
    }
    const targets = this.playerRepo.listInnTargets(attacker.id);
    return targets.filter((target) => target.level <= attacker.level + 1);
  }

  breakInAttack(attacker: PlayerRecord, victimId: string, today: string): ActionResult {
    if (attacker.level <= 1) {
      return { ok: false, message: 'Level 1 adventurers cannot break into rooms.' };
    }
    if (!attacker.inn_breakin_used_today) {
      return { ok: false, message: 'You need to bribe the bartender first.' };
    }

    const victim = this.playerRepo.findById(victimId);
    if (!victim || victim.id === attacker.id || !victim.has_room) {
      return { ok: false, message: 'That room is unavailable.' };
    }
    if (victim.level > attacker.level + 1) {
      return { ok: false, message: 'That target is too high level for your break-in.' };
    }

    const rounds: string[] = [`You force ${victim.display_name}'s lock.`];
    let attackerHp = attacker.hp;
    let victimHp = victim.hp;

    while (attackerHp > 0 && victimHp > 0) {
      victimHp -= this.playerDamage(attacker, victim, rounds);
      if (victimHp <= 0) break;
      attackerHp -= this.playerDamage(victim, attacker, rounds);
    }

    if (victimHp <= 0) {
      const xpGain = Math.min(attacker.level * 2500, victim.level * 3500);
      const stealAmount = Math.max(0, Math.floor(victim.gold * 0.15));
      this.playerRepo.updatePlayerStats(attacker.id, {
        exp: attacker.exp + xpGain,
        gold: attacker.gold + stealAmount,
        hp: Math.max(1, attackerHp),
        turns_pvp_left: Math.max(0, attacker.turns_pvp_left - 1)
      });
      this.playerRepo.updatePlayerStats(victim.id, {
        gold: Math.max(0, victim.gold - stealAmount),
        hp: 1
      });
      this.recordBreakIn(attacker.id, victim.id, 'killed');
      this.newsService.addNews(today, `${attacker.display_name} broke into ${victim.display_name}'s room and won.`, { severity: 'pvp' });
      return { ok: true, message: `${rounds.join(' ')} You win. +${xpGain} exp, ${stealAmount} gold stolen.` };
    }

    this.playerRepo.updatePlayerStats(attacker.id, {
      hp: 1,
      turns_forest_left: 0,
      turns_pvp_left: Math.max(0, attacker.turns_pvp_left - 1)
    });
    this.recordBreakIn(attacker.id, victim.id, 'killed');
    this.newsService.addNews(today, `${attacker.display_name} died during an Inn break-in on ${victim.display_name}.`, { severity: 'pvp' });
    return { ok: true, message: `${rounds.join(' ')} You are thrown out half-dead. Your day is done.` };
  }


  private safeDouble(value: number) {
    const BIGINT_MAX = 9_223_372_036_854_775_807;
    const doubled = value * 2;
    if (doubled > BIGINT_MAX) {
      return { value: BIGINT_MAX, clamped: true };
    }
    return { value: doubled, clamped: false };
  }

  private recordBreakIn(attackerPlayerId: string, targetPlayerId: string, result: string) {
    getDb()
      .prepare('INSERT INTO inn_breakins (id, attacker_player_id, target_player_id, created_at, result) VALUES (@id, @attacker_player_id, @target_player_id, @created_at, @result)')
      .run({ id: randomUUID(), attacker_player_id: attackerPlayerId, target_player_id: targetPlayerId, created_at: new Date().toISOString(), result });
  }

  private getLyrics() {
    const lines = [
      'Seth Able sings: "Raise your blade, then raise your tab; heroes pay both debts."',
      'Seth Able hums: "Moon over rooftops, steel under cloaks, courage in short supply."',
      'Seth Able grins: "If dawn finds you breathing, call that a ballad ending well."'
    ];
    return lines[randInt(0, lines.length - 1, this.rng)] ?? lines[0]!;
  }

  private playerDamage(attacker: PlayerRecord, defender: PlayerRecord, rounds: string[]) {
    const base = randInt(Math.max(1, attacker.level * 2), Math.max(2, attacker.level * 4), this.rng);
    const weapon = getWeaponById(attacker.weapon_id);
    const damage = Math.max(1, base + Math.floor(weapon.atk_bonus * 0.35));
    if (this.rng() < 0.08) {
      rounds.push(`${attacker.display_name} lands a savage hit!`);
      return damage * 2;
    }
    return damage;
  }
}
