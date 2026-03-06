import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db/db.js';
import { getWeaponById } from '../data/equipment.js';
import { getDayIndexFromDayKey } from './dayKey.js';
function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
const BIGINT_MAX = 9_223_372_036_854_775_807;
export class InnService {
    playerRepo;
    newsService;
    rng;
    constructor(playerRepo, newsService, rng = Math.random) {
        this.playerRepo = playerRepo;
        this.newsService = newsService;
        this.rng = rng;
    }
    flirt(player, today) {
        if (player.flirt_used_today) {
            return { ok: false, message: 'You already flirted today.' };
        }
        const expGain = 150 + randInt(0, 150, this.rng);
        const goldGain = randInt(0, 50, this.rng);
        this.playerRepo.updatePlayerStats(player.id, {
            exp: player.exp + expGain,
            gold_on_hand: player.gold_on_hand + goldGain,
            flirt_used_today: 1
        });
        this.newsService.addNews(today, `${player.display_name} flirted with Violet at the Inn.`, { severity: 'info' });
        return { ok: true, message: `Violet laughs and plays along. (+${expGain} exp, +${goldGain} gold)` };
    }
    listenToBard(player, today) {
        if (player.bard_listens_used_today >= config.sethMaxListensPerDay) {
            return { ok: false, message: 'Seth Able has no encore for you today.' };
        }
        const roll = this.rng();
        const bonus = roll < 0.65 ? 1 : roll < 0.9 ? 2 : 3;
        const hpRestored = this.rng() < 0.08;
        const patch = {
            turns_forest_left: player.turns_forest_left + bonus,
            bard_listens_used_today: player.bard_listens_used_today + 1
        };
        if (hpRestored) {
            patch.hp = player.hp_max;
        }
        let moneyDoublerText = '';
        const doublerUsedToday = player.money_doubler_used_today;
        if (!doublerUsedToday && this.rng() < config.moneyDoublerChance) {
            const bankBefore = player.gold_in_bank;
            const doubled = this.safeMultiply(bankBefore, 2);
            patch.gold_in_bank = doubled.value;
            patch.money_doubler_used_today = 1;
            this.newsService.moneyDoubler(player.id, today, bankBefore, doubled.value);
            this.recordBankTransaction(player.id, today, 'money_doubler', Math.max(0, doubled.value - bankBefore));
            moneyDoublerText = doubled.clamped
                ? ' Somewhere magic has happened! Your vault detonates with power, but the kingdom caps how much gold can exist.'
                : ' Somewhere magic has happened! Your bank gold has been doubled!';
        }
        this.playerRepo.updatePlayerStats(player.id, patch);
        this.newsService.addNews(today, `${player.display_name} listened to Seth Able and felt a strange wonder and awakening.`, { severity: 'info' });
        const hpText = hpRestored ? ' Your health is fully restored.' : '';
        return { ok: true, message: `${this.getLyrics()} (+${bonus} extra forest fights)${hpText}${moneyDoublerText}` };
    }
    rentRoom(player, today) {
        if (player.in_inn_room) {
            return { ok: false, message: 'You already rented a room for tonight.' };
        }
        const cost = Math.max(1, config.innRoomCost);
        if (player.gold_on_hand < cost) {
            return { ok: false, message: `Room cost is ${cost} gold. You only have ${player.gold_on_hand}.` };
        }
        this.playerRepo.updatePlayerStats(player.id, {
            gold_on_hand: player.gold_on_hand - cost,
            in_inn_room: 1,
            inn_room_expires_day_key: today
        });
        this.newsService.addNews(today, `${player.display_name} rented a room at the Inn.`, { severity: 'info' });
        return { ok: true, message: 'You rent a room. You sleep behind a locked door...' };
    }
    buyElixir(player) {
        if (player.gold_on_hand < config.innElixirGoldCost) {
            return { ok: false, message: `An elixir costs ${config.innElixirGoldCost} gold.` };
        }
        this.playerRepo.updatePlayerStats(player.id, {
            gold_on_hand: player.gold_on_hand - config.innElixirGoldCost,
            elixirs: player.elixirs + 1
        });
        return { ok: true, message: 'You buy a bitter elixir and pocket it for later.' };
    }
    tradeGemsForElixir(player) {
        if (player.gems < config.innGemTradeCost) {
            return { ok: false, message: `${config.innGemTradeCost} gems are required for one elixir.` };
        }
        this.playerRepo.updatePlayerStats(player.id, {
            gems: player.gems - config.innGemTradeCost,
            elixirs: player.elixirs + 1
        });
        return { ok: true, message: `Trade made: -${config.innGemTradeCost} gems, +1 elixir.` };
    }
    bribeBartender(player) {
        if (player.level <= 1) {
            return { ok: false, message: 'The bartender snorts: level 1 pups are not invited upstairs.' };
        }
        if (player.inn_breakin_used_today) {
            return { ok: true, message: 'The bartender nods. You already paid for tonight\'s access.' };
        }
        if (player.gold_on_hand < config.innBribeCost) {
            return { ok: false, message: `Bribe costs ${config.innBribeCost} gold.` };
        }
        this.playerRepo.updatePlayerStats(player.id, {
            gold_on_hand: player.gold_on_hand - config.innBribeCost,
            inn_breakin_used_today: 1,
            inn_bribe_count_today: player.inn_bribe_count_today + 1
        });
        return { ok: true, message: 'You slide coins over. The bartender whispers: "quiet doors, third hall."' };
    }
    getBreakInTargets(attacker) {
        if (attacker.level <= 1 || !attacker.inn_breakin_used_today || attacker.turns_pvp_left <= 0) {
            return [];
        }
        const targets = this.playerRepo.listInnTargets(attacker.id);
        return targets.filter((target) => target.level <= attacker.level + 1);
    }
    breakInAttack(attacker, victimId, today) {
        if (attacker.level <= 1) {
            return { ok: false, message: 'Level 1 adventurers cannot break into rooms.' };
        }
        if (!attacker.inn_breakin_used_today) {
            return { ok: false, message: 'You need to bribe the bartender first.' };
        }
        if (attacker.turns_pvp_left <= 0) {
            return { ok: false, message: 'You already used your PvP attempt today.' };
        }
        const victim = this.playerRepo.findById(victimId);
        if (!victim || victim.id === attacker.id || !victim.in_inn_room || !victim.is_alive) {
            return { ok: false, message: 'That room is unavailable.' };
        }
        if (victim.level > attacker.level + 1) {
            return { ok: false, message: 'That target is too high level for your break-in.' };
        }
        const rounds = [`You force ${victim.display_name}'s lock.`];
        let attackerHp = attacker.hp;
        let victimHp = victim.hp;
        while (attackerHp > 0 && victimHp > 0) {
            victimHp -= this.playerDamage(attacker, victim, rounds);
            if (victimHp <= 0)
                break;
            attackerHp -= this.playerDamage(victim, attacker, rounds);
        }
        if (victimHp <= 0) {
            const xpGain = Math.min(attacker.level * 2500, victim.level * 3500);
            const stealAmount = Math.max(0, Math.floor(victim.gold_on_hand * 0.15));
            this.playerRepo.updatePlayerStats(attacker.id, {
                exp: attacker.exp + xpGain,
                gold_on_hand: attacker.gold_on_hand + stealAmount,
                hp: Math.max(1, attackerHp),
                turns_pvp_left: 0,
                player_kills: attacker.player_kills + 1
            });
            this.playerRepo.updatePlayerStats(victim.id, {
                gold_on_hand: Math.max(0, victim.gold_on_hand - stealAmount),
                hp: 0,
                is_alive: 0,
                in_inn_room: 0,
                last_killed_at: new Date().toISOString(),
                killed_by_player_id: attacker.id
            });
            this.recordBreakIn(attacker.id, victim.id, 'killed');
            this.newsService.addNews(today, `${attacker.display_name} broke into ${victim.display_name}'s room and won.`, { severity: 'pvp' });
            this.newsService.pvpKill(attacker.id, victim.id, { dayKey: today, killerName: attacker.display_name, victimName: victim.display_name });
            return { ok: true, message: `${rounds.join(' ')} You win. +${xpGain} exp, ${stealAmount} gold stolen.` };
        }
        this.playerRepo.updatePlayerStats(attacker.id, {
            hp: 0,
            is_alive: 0,
            last_killed_at: new Date().toISOString(),
            killed_by_player_id: victim.id,
            turns_forest_left: 0,
            turns_pvp_left: 0
        });
        this.recordBreakIn(attacker.id, victim.id, 'killed');
        this.newsService.addNews(today, `${attacker.display_name} died during an Inn break-in on ${victim.display_name}.`, { severity: 'pvp' });
        this.newsService.addDailyNews({ day: getDayIndexFromDayKey(today), type: 'PVP_DEFEND', actorId: attacker.id, targetId: victim.id, message: `${attacker.display_name} has attacked ${victim.display_name} and has been killed in self-defense.` });
        return { ok: true, message: `${rounds.join(' ')} You are thrown out half-dead. Your day is done.` };
    }
    recordBreakIn(attackerPlayerId, targetPlayerId, result) {
        getDb()
            .prepare('INSERT INTO inn_breakins (id, attacker_player_id, target_player_id, created_at, result) VALUES (@id, @attacker_player_id, @target_player_id, @created_at, @result)')
            .run({ id: randomUUID(), attacker_player_id: attackerPlayerId, target_player_id: targetPlayerId, created_at: new Date().toISOString(), result });
    }
    recordBankTransaction(playerId, dayKey, type, amount) {
        getDb()
            .prepare('INSERT INTO bank_transactions (player_id, day_key, type, amount, created_at) VALUES (@player_id, @day_key, @type, @amount, @created_at)')
            .run({
            player_id: playerId,
            day_key: dayKey,
            type,
            amount,
            created_at: new Date().toISOString()
        });
    }
    safeMultiply(value, multiplier) {
        const total = value * multiplier;
        if (total > BIGINT_MAX) {
            return { value: BIGINT_MAX, clamped: true };
        }
        return { value: total, clamped: false };
    }
    getLyrics() {
        const lines = [
            'Seth Able sings: "Raise your blade, then raise your tab; heroes pay both debts."',
            'Seth Able hums: "Moon over rooftops, steel under cloaks, courage in short supply."',
            'Seth Able grins: "If dawn finds you breathing, call that a ballad ending well."'
        ];
        return lines[randInt(0, lines.length - 1, this.rng)] ?? lines[0];
    }
    playerDamage(attacker, defender, rounds) {
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
