import { getArmorById, getWeaponById } from '../data/equipment.js';
import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { classLabel, skillLabel } from '../services/skillService.js';
export function renderTownSquare(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;
    const divider = '-'.repeat(Math.max(12, cols - 6));
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]Town Square, Center of the Realm[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Crowds, criers, steel, and gossip collide under one sky.[dim]');
    drawText(buffer, 3, 3, `[dim]${divider}[dim]`);
    drawText(buffer, 3, 4, '[b][c:cyan]Town Hub[b][c:white]');
    drawText(buffer, 3, 5, '[c:green]F[c:white]) Forest                 [c:green]B[c:white]) Bank');
    drawText(buffer, 3, 6, '[c:green]I[c:white]) Inn                    [c:green]T[c:white]) Training');
    drawText(buffer, 3, 7, '[c:green]H[c:white]) Healer Hut             [c:green]N[c:white]) Daily News');
    drawText(buffer, 3, 8, `[c:green]W[c:white]) King's Weapons          [c:green]A[c:white]) Abdul's Armor`);
    drawText(buffer, 3, 9, '[c:green]S[c:white]) Slaughter Pit           [c:green]L[c:white]) Rankings');
    drawText(buffer, 3, 10, '[c:green]Q[c:white]) Quit this day');
    drawText(buffer, 3, 12, '[b][c:magenta]Daily Status[b][c:white]');
    if (player) {
        const weapon = getWeaponById(player.weapon_id);
        const armor = getArmorById(player.armor_id);
        drawText(buffer, 3, 13, `[c:cyan]${player.display_name}[c:white]  L${player.level} ${classLabel(player.class)} (${player.sex})`);
        drawText(buffer, 3, 14, `HP ${player.hp}/${player.hp_max} | EXP ${player.exp} | Spirits ${player.spirits}`);
        drawText(buffer, 3, 15, `Gold ${player.gold_on_hand} | Bank ${player.gold_in_bank} | Gems ${player.gems}`);
        drawText(buffer, 3, 16, `Forest ${player.turns_forest_left}/${player.turns_forest_max} | PvP ${player.turns_pvp_left}/${player.turns_pvp_max}`);
        drawText(buffer, 3, 17, `Weapon ${weapon.name} (+${weapon.atk_bonus}) | Armor ${armor.name} (+${armor.def_bonus})`);
        const skillUses = player.class === 'DEATH_KNIGHT' ? player.skill_uses_death : player.class === 'MYSTICAL' ? player.skill_uses_mystic : player.skill_uses_thief;
        const skillLevel = player.class === 'DEATH_KNIGHT' ? player.skill_level_death : player.class === 'MYSTICAL' ? player.skill_level_mystic : player.skill_level_thief;
        drawText(buffer, 3, 18, `${skillLabel(player.class)} ${skillLevel} | Uses left ${skillUses}`);
        drawText(buffer, 3, 19, `Day ${session.todayDate ?? player.last_day_seen ?? 'Unknown'}`);
    }
    drawText(buffer, 3, rows - 5, '[b][c:yellow]Command Legend:[b][c:white] press menu keys to move quickly through town.');
    drawText(buffer, 3, rows - 4, session.notice ? `[c:yellow]${session.notice}[c:white]` : '[c:green]Welcome home, warrior.[c:white]');
    return { cols, rows, lines: toLines(buffer) };
}
