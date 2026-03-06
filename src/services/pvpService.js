import { config } from '../config.js';
import { getArmorById, getWeaponById } from '../data/equipment.js';
import { getDayIndexFromDayKey } from './dayKey.js';
function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
const duelAcceptancePrompts = [
    "He grins with too many teeth. 'Name the hour, coward.'",
    "She rolls her shoulders. 'Steel talks. Do you?'",
    "'A duel? Good. I was getting bored.'",
    "'Say your prayer now. I'll wait.'"
];
const postKillQuotes = [
    'Another boast buried under wet dirt.',
    'The crows now know your name.',
    'The grass drinks deep tonight.',
    'Some lessons only a grave can keep.'
];
const selfDefenseQuotes = [
    'You die with surprise still on your face.',
    'Your gamble ends in the mud.',
    'The hunter becomes the warning.',
    'The Warfield keeps what it is owed.'
];
export class PvpService {
    playerRepo;
    newsService;
    rng;
    constructor(playerRepo, newsService, rng = Math.random) {
        this.playerRepo = playerRepo;
        this.newsService = newsService;
        this.rng = rng;
    }
    createEncounter(attacker, target, mode) {
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
                attackerMaxHp: Math.max(1, attacker.hp),
                targetMaxHp: Math.max(1, target.hp),
                rounds: ['Steel flashes in the dark...'],
                over: false
            }
        };
    }
    buildDuelAcceptancePrompt(target) {
        const idx = randInt(0, duelAcceptancePrompts.length - 1, this.rng);
        return `${target.display_name} eyes you. ${duelAcceptancePrompts[idx]} Accept duel? (Y/N)`;
    }
    takeAction(state, action, todayDayKey) {
        const attacker = this.playerRepo.findById(state.attackerId);
        const target = this.playerRepo.findById(state.targetId);
        if (!attacker || !target) {
            return { ok: false, over: true, message: 'Combat target vanished.' };
        }
        if (action === 'RUN') {
            this.consumeAttempt(attacker);
            if (this.rng() < config.pvpFleeFailChance) {
                const punish = this.pvpRetaliationDamage(target, attacker);
                const attackerHpAfter = Math.max(0, attacker.hp - punish);
                if (attackerHpAfter <= 0) {
                    const resultText = this.resolveDefenderWin(attacker, target, todayDayKey);
                    return { ok: true, over: true, message: `You try to flee, but ${target.display_name} catches you for ${punish} damage. ${resultText}` };
                }
                this.playerRepo.updatePlayerStats(attacker.id, { hp: attackerHpAfter, turns_pvp_left: 0 });
                const msg = `${attacker.display_name} failed to flee from ${target.display_name} and barely escaped.`;
                this.newsService.addNews(todayDayKey, msg, { severity: 'pvp' });
                this.newsService.addDailyNews({ day: getDayIndexFromDayKey(todayDayKey), type: 'PVP_FLEE_FAIL', actorId: attacker.id, targetId: target.id, message: `${attacker.display_name} tried to flee ${target.display_name} and got carved up for it.` });
                return { ok: true, over: true, message: `You turn to run, but ${target.display_name} carves you for ${punish} damage before you escape.` };
            }
            const msg = `${attacker.display_name} has attacked ${target.display_name} and has run away.`;
            this.newsService.addNews(todayDayKey, msg, { severity: 'pvp' });
            this.newsService.addDailyNews({ day: getDayIndexFromDayKey(todayDayKey), type: 'PVP_FLEE', actorId: attacker.id, targetId: target.id, message: `${attacker.display_name} ran from ${target.display_name} before the blood settled.` });
            return { ok: true, over: true, message: 'You run away like a scared rat.' };
        }
        const rounds = [...state.rounds];
        let attackerHp = state.attackerHp;
        let targetHp = state.targetHp;
        const opening = this.playerDamage(attacker, target);
        targetHp = Math.max(0, targetHp - opening);
        rounds.push(`You strike ${target.display_name} for ${opening} damage.`);
        if (targetHp <= 0) {
            const result = this.resolveAttackerWin(attacker, target, todayDayKey, attackerHp);
            return {
                ok: true,
                over: true,
                message: `${rounds.join(' ')} ${result.text}`,
                promptField: 'pvp_press_quote',
                promptMessage: `You killed ${target.display_name}. Say something to the press:`,
                pressContext: result.pressContext
            };
        }
        const retaliation = this.playerDamage(target, attacker);
        attackerHp = Math.max(0, attackerHp - retaliation);
        rounds.push(`${target.display_name} hits back for ${retaliation} damage.`);
        const emotionLine = this.buildEmotionLine(state, attackerHp, targetHp);
        if (emotionLine) {
            rounds.push(emotionLine);
        }
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
    buildEmotionLine(state, attackerHp, targetHp) {
        const attackerPct = attackerHp / Math.max(1, state.attackerMaxHp);
        const targetPct = targetHp / Math.max(1, state.targetMaxHp);
        if (attackerPct <= 0.2 && targetPct > 0.5) {
            return 'Your breath rattles. Panic claws at your ribs.';
        }
        if (attackerPct <= 0.35 && targetPct <= 0.35) {
            return 'You both sway on bloody feet, too stubborn to fall first.';
        }
        if (attackerPct > 0.6 && targetPct <= 0.25) {
            return `${state.targetName} looks shaken, backing up one step at a time.`;
        }
        return '';
    }
    resolveAttackerWin(attacker, target, todayDayKey, attackerHpAfter) {
        const expGain = Math.max(200, Math.min(250000, Math.round(target.level * 2000 + target.exp * 0.05)));
        const stealSpan = Math.max(0, config.pvpStealMaxPct - config.pvpStealMinPct);
        const stealPct = config.pvpStealMinPct + this.rng() * stealSpan;
        const stolen = Math.max(0, Math.floor(target.gold_on_hand * stealPct));
        this.playerRepo.updatePlayerStats(attacker.id, {
            exp: attacker.exp + expGain,
            gold_on_hand: attacker.gold_on_hand + stolen,
            turns_pvp_left: 0,
            player_kills: attacker.player_kills + 1,
            hp: Math.max(1, attackerHpAfter)
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
        this.newsService.pvpKill(attacker.id, target.id, {
            dayKey: todayDayKey,
            killerName: attacker.display_name,
            victimName: target.display_name,
            mode: 'FIELDS'
        });
        const quote = postKillQuotes[randInt(0, postKillQuotes.length - 1, this.rng)];
        return {
            text: `You kill ${target.display_name}. +${expGain} exp.${goldText} "${quote}"`,
            pressContext: { defeatedName: target.display_name }
        };
    }
    resolveDefenderWin(attacker, target, todayDayKey) {
        this.playerRepo.updatePlayerStats(attacker.id, {
            hp: 0,
            is_alive: 0,
            turns_pvp_left: 0,
            last_killed_at: new Date().toISOString(),
            killed_by_player_id: target.id
        });
        this.newsService.addNews(todayDayKey, `${attacker.display_name} has attacked ${target.display_name} and has been killed in self-defense.`, { severity: 'pvp' });
        this.newsService.selfDefenseKill(attacker.id, target.id, {
            dayKey: todayDayKey,
            attackerName: attacker.display_name,
            defenderName: target.display_name,
            mode: 'FIELDS'
        });
        const quote = selfDefenseQuotes[randInt(0, selfDefenseQuotes.length - 1, this.rng)];
        return `${target.display_name} kills you in self-defense. "${quote}"`;
    }
    recordPressQuote(attacker, quote, todayDayKey, defeatedName) {
        const cleaned = quote.trim().replace(/\s+/g, ' ').slice(0, 120);
        const finalQuote = cleaned || 'No comment. Let the bodies speak.';
        this.newsService.addNews(todayDayKey, `${attacker.display_name} told the press after defeating ${defeatedName}: "${finalQuote}"`, { severity: 'pvp' });
        this.newsService.addDailyNews({
            day: getDayIndexFromDayKey(todayDayKey),
            type: 'PVP_PRESS',
            actorId: attacker.id,
            message: `${attacker.display_name} to the press: "${finalQuote}"`
        });
        return `You face the scribes and say: "${finalQuote}"`;
    }
    pvpRetaliationDamage(attacker, defender) {
        const base = this.playerDamage(attacker, defender);
        const minMult = Math.min(config.pvpFleePunishMultMin, config.pvpFleePunishMultMax);
        const maxMult = Math.max(config.pvpFleePunishMultMin, config.pvpFleePunishMultMax);
        const mult = minMult + this.rng() * (maxMult - minMult);
        return Math.max(1, Math.floor(base * mult));
    }

    consumeAttempt(attacker) {
        this.playerRepo.updatePlayerStats(attacker.id, {
            turns_pvp_left: 0
        });
    }
    playerDamage(attacker, defender) {
        const weapon = getWeaponById(attacker.weapon_id);
        const armor = getArmorById(defender.armor_id);
        const atk = config.baseAtk + weapon.atk_bonus;
        const def = config.baseDef + armor.def_bonus;
        const raw = randInt(Math.max(1, Math.floor(atk * 0.8)), Math.max(1, Math.floor(atk * 1.2)), this.rng);
        return Math.max(1, raw - def);
    }
}
