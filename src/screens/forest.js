import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderForest(session, dims) {
    const cols = Math.max(72, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;
    const divider = '-'.repeat(Math.max(14, cols - 6));
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:red]The Forest of Teeth and Thorns[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Branches scrape like claws. Every shadow might be a grave.[dim]');
    drawText(buffer, 3, 3, `[dim]${divider}[dim]`);
    if (player) {
        drawText(buffer, 3, 5, `[b][c:yellow]Turns Left:[b][c:white] ${player.turns_forest_left}/${player.turns_forest_max}    [b][c:red]HP[b][c:white] ${player.hp}/${player.hp_max}`);
        drawText(buffer, 3, 6, `L${player.level} ${player.display_name} | Lap ${player.current_lap} | Gold ${player.gold_on_hand} | Gems ${player.gems}`);
        drawText(buffer, 3, 7, `Fairy companion: ${player.has_fairy ? '[c:green]Yes[c:white]' : '[c:magenta]No[c:white]'}`);
    }
    const dragonOption = player && player.level >= 12 ? '  (S)earch Red Dragon' : '';
    drawText(buffer, 3, 9, '[b][c:magenta]Encounter Feed[b][c:white]');
    drawText(buffer, 3, 10, session.notice ? `[c:yellow]${session.notice}[c:white]` : '[c:red]You hear something moving ahead.[c:white]');
    drawText(buffer, 3, 12, `[b][c:cyan]Commands[b][c:white] [c:green]L[c:white])ook [c:green]A[c:white])ttack S[c:green]k[c:white])ill [c:green]R[c:white])un [c:green]T[c:white])own [c:green]B[c:white])ank${dragonOption}`);
    if (player && player.level < 12) {
        drawText(buffer, 3, 13, '[c:magenta]Only Ultimate Warriors may challenge the Red Dragon.[c:white]');
    }
    drawText(buffer, 3, rows - 5, '[dim]System: Attacking consumes turns; running may still hurt your pride.[dim]');
    drawText(buffer, 3, rows - 4, '[c:green]Reward hint: wins in here are the fastest road to power.[c:white]');
    return { cols, rows, lines: toLines(buffer) };
}
