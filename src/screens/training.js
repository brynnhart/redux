import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { classLabel } from '../services/skillService.js';
import { getMasterForLevel, isEligibleForMasterChallenge } from '../services/trainingService.js';
export function renderTraining(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, "[b][c:red]Turgon's Warrior Training Hall[b][c:white]");
    drawText(buffer, 3, 2, '[dim]Steel rings. Masters watch. Every mistake here becomes a scar somewhere else.[dim]');
    drawText(buffer, 3, 4, '[b][c:cyan]Rites of Advancement[b][c:white]');
    drawText(buffer, 3, 5, '[c:green]Q[c:white]) Question the master [dim](seek judgment)[dim]');
    drawText(buffer, 3, 6, '[c:green]A[c:white]) Challenge the master [c:red](blood rite)[c:white]');
    drawText(buffer, 3, 7, '[c:green]C[c:white]) Train class skill [dim](once per day)[dim]');
    drawText(buffer, 3, 8, '[c:green]H[c:white]) Hall of Honor   [c:green]R[c:white]/[c:green]T[c:white]) Return to town');
    if (player) {
        const master = getMasterForLevel(player.level);
        const eligibility = isEligibleForMasterChallenge(player);
        drawText(buffer, 3, 10, `[b][c:yellow]Warrior Record[b][c:white] ${classLabel(player.class)} L${player.level}  EXP ${player.exp}`);
        drawText(buffer, 3, 11, `Presiding master: ${master ? `${master.name}, ${master.title}` : 'None (Dragon-ready)'}`);
        drawText(buffer, 3, 12, `Master challenge used today: ${player.training_challenge_used_today ? '[c:magenta]Yes[c:white]' : '[c:green]No[c:white]'}`);
        drawText(buffer, 3, 13, `Class training used today: ${player.daily_skill_training_used ? '[c:magenta]Yes[c:white]' : '[c:green]No[c:white]'}`);
        if (master && eligibility.requiredExp !== null) {
            drawText(buffer, 3, 15, '[b][c:red]Master Challenge Status[b][c:white]');
            drawText(buffer, 3, 16, eligibility.eligible
                ? '[c:green]You are ready. Step forward, salute, and survive the verdict.[c:white]'
                : `[c:yellow]Not yet. Earn ${eligibility.expNeeded} more EXP before the hall will witness your rite.[c:white]`);
        }
    }
    drawText(buffer, 3, rows - 5, '[dim]In this hall, rank is granted by masters, not numbers on a ledger.[dim]');
    drawText(buffer, 3, rows - 4, session.notice ? `[c:yellow]${session.notice}[c:white]` : '[c:red]Turgon stands at the rail, saying nothing, missing nothing.[c:white]');
    return { cols, rows, cells: toCells(buffer) };
}
