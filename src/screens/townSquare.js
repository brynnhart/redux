import { getArmorById, getWeaponById } from '../data/equipment.js';
import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { classLabel, skillLabel } from '../services/skillService.js';
export function renderTownSquare(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;
    const divider = '-'.repeat(Math.max(12, cols - 8));
    const leftColX = 3;
    const rightColX = Math.max(40, Math.floor(cols / 2));
    const menuTop = 6;
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]The Town Square[b][c:white]');
    drawText(buffer, 3, 2, `[dim]${divider}[dim]`);
    drawText(buffer, 3, 4, '[c:cyan]You are in the center of town. The streets are alive with warriors.[c:white]');

    drawText(buffer, leftColX, menuTop, '[c:green]([c:white]F[c:green])[c:white]orest');
    drawText(buffer, leftColX, menuTop + 1, '[c:green]([c:white]K[c:green])[c:white]ing Arthurs Weapons');
    drawText(buffer, leftColX, menuTop + 2, '[c:green]([c:white]H[c:green])[c:white]ealers Hut');
    drawText(buffer, leftColX, menuTop + 3, '[c:green]([c:white]I[c:green])[c:white]nn');
    drawText(buffer, leftColX, menuTop + 4, '[c:green]([c:white]Y[c:green])[c:white]e Old Bank');
    drawText(buffer, leftColX, menuTop + 5, '[c:green]([c:white]W[c:green])[c:white]rite Mail');
    drawText(buffer, leftColX, menuTop + 6, '[c:green]([c:white]C[c:green])[c:white]onjugality List');
    drawText(buffer, leftColX, menuTop + 7, '[c:green]([c:white]X[c:green])[c:white]pert Mode');
    drawText(buffer, leftColX, menuTop + 8, '[c:green]([c:white]P[c:green])[c:white]eople Online');

    drawText(buffer, rightColX, menuTop, '[c:green]([c:white]S[c:green])[c:white]laughter other players');
    drawText(buffer, rightColX, menuTop + 1, '[c:green]([c:white]A[c:green])[c:white]bduls Armour');
    drawText(buffer, rightColX, menuTop + 2, '[c:green]([c:white]V[c:green])[c:white]iew your Stats');
    drawText(buffer, rightColX, menuTop + 3, '[c:green]([c:white]T[c:green])[c:white]urgons Warrior Training');
    drawText(buffer, rightColX, menuTop + 4, '[c:green]([c:white]L[c:green])[c:white]ist Warriors');
    drawText(buffer, rightColX, menuTop + 5, '[c:green]([c:white]D[c:green])[c:white]aily News');
    drawText(buffer, rightColX, menuTop + 6, '[c:green]([c:white]O[c:green])[c:white]ther Places');
    drawText(buffer, rightColX, menuTop + 7, '[c:green]([c:white]M[c:green])[c:white]ake Announcement');
    drawText(buffer, rightColX, menuTop + 8, '[c:green]([c:white]Q[c:green])[c:white]uit to Fields');

    drawText(buffer, 3, 16, '[b][c:magenta]Status[b][c:white]');
    if (player) {
        const weapon = getWeaponById(player.weapon_id);
        const armor = getArmorById(player.armor_id);
        drawText(buffer, 3, 17, `[c:cyan]${player.display_name}[c:white] L${player.level} ${classLabel(player.class)} (${player.sex})`);
        drawText(buffer, 3, 18, `HP ${player.hp}/${player.hp_max}  EXP ${player.exp}  Spirits ${player.spirits}`);
        drawText(buffer, 3, 19, `Gold ${player.gold_on_hand}  Bank ${player.gold_in_bank}  Gems ${player.gems}`);
        drawText(buffer, 3, 20, `Forest ${player.turns_forest_left}/${player.turns_forest_max}  PvP ${player.turns_pvp_left}/${player.turns_pvp_max}`);
        drawText(buffer, 3, 21, `Wpn ${weapon.name} (+${weapon.atk_bonus})  Arm ${armor.name} (+${armor.def_bonus})`);
        const skillUses = player.class === 'DEATH_KNIGHT' ? player.skill_uses_death : player.class === 'MYSTICAL' ? player.skill_uses_mystic : player.skill_uses_thief;
        const skillLevel = player.class === 'DEATH_KNIGHT' ? player.skill_level_death : player.class === 'MYSTICAL' ? player.skill_level_mystic : player.skill_level_thief;
        drawText(buffer, 3, 22, `${skillLabel(player.class)} ${skillLevel} | Uses left ${skillUses}`);
        drawText(buffer, 3, 23, `Day ${session.todayDate ?? player.last_day_seen ?? 'Unknown'}`);
    }
    drawText(buffer, 3, rows - 4, session.notice ? `[c:yellow]${session.notice}[c:white]` : '[dim]Type one letter to choose your destination.[dim]');
    drawText(buffer, 3, rows - 3, '[b][c:yellow]Command?[b][c:white]');
    return { cols, rows, cells: toCells(buffer) };
}
