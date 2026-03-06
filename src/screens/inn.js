import { getWeaponById } from '../data/equipment.js';
import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderInn(session, dims) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]The Sleeping Dragon Inn[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Ale steams, dice click, and every laugh sounds one coin short of trouble.[dim]');
    drawText(buffer, 3, 4, '[b][c:cyan]Common Room (after dusk)[b][c:white]');
    drawText(buffer, 3, 5, '[c:green]C[c:white]) Converse with patrons   [c:green]F[c:white]) Flirt with [c:magenta]Violet[c:white]   [c:green]G[c:white]) Get a Room');
    drawText(buffer, 3, 6, '[c:green]H[c:white]) Hear [c:yellow]Seth Able the Bard[c:white]   [c:green]D[c:white]) Daily News   [c:green]T[c:white]) Talk to bartender');
    drawText(buffer, 3, 7, '[c:green]V[c:white]) View your stats   [c:green]M[c:white]) Make announcement   [c:green]R[c:white]) Return to town');
    if (session.player) {
        drawText(buffer, 44, 4, '[b][c:magenta]Your Table[b][c:white]');
        drawText(buffer, 44, 5, `Gold ${session.player.gold_on_hand} | Charm ${session.player.charm}`);
        drawText(buffer, 44, 6, `Room ${session.player.in_inn_room ? '[c:green]YES[c:white]' : '[c:red]NO[c:white]'} | Flirt ${session.player.flirt_used_today ? 'used' : 'ready'}`);
        drawText(buffer, 44, 7, `Seth listens ${session.player.bard_listens_used_today} | Forest ${session.player.turns_forest_left}/${session.player.turns_forest_max}`);
    }
    drawText(buffer, 3, rows - 5, '[dim]Tankards slam, cards flip, and half the room swears they saw a dragon tonight.[dim]');
    drawText(buffer, 3, rows - 4, session.notice ? `[c:yellow]${session.notice}[c:white]` : '[c:green]A toast rises in one corner while a deal dies in another.[c:white]');
    return { cols, rows, cells: toCells(buffer) };
}
export function renderInnConverse(session, dims) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, '[b]Patrons & Rumors[b]');
    drawText(buffer, 3, 4, 'A mercenary swears the Forest is eating scouts alive.');
    drawText(buffer, 3, 5, 'Two thieves debate lockpicks, poison, and rates.');
    drawText(buffer, 3, 6, 'Someone whispers your name, then lowers their voice.');
    drawText(buffer, 3, 8, '(R) Return to the Inn');
    drawText(buffer, 3, rows - 4, session.notice || 'Mugs clink. A chair scrapes. Nobody here sleeps deeply.');
    return { cols, rows, cells: toCells(buffer) };
}
export function renderInnBartender(session, dims) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, '[b][c:magenta]Bartender, Keeper of Quiet Keys[b][c:white]');
    drawText(buffer, 3, 4, '[c:green]B[c:white]) Bribe for room keys');
    drawText(buffer, 3, 5, '[c:green]A[c:white]) Attack sleeping enemies');
    drawText(buffer, 3, 6, '[c:green]E[c:white]) Exit to common room');
    if (session.player) {
        drawText(buffer, 46, 4, `Gold: ${session.player.gold_on_hand}`);
        drawText(buffer, 46, 5, `Bribed today: ${session.player.inn_breakin_used_today ? '[c:red]YES[c:white]' : '[c:green]NO[c:white]'}`);
    }
    drawText(buffer, 3, rows - 5, '[c:red]Warning:[c:white] Upstairs grudges survive longer than hangovers.');
    drawText(buffer, 3, rows - 4, session.notice || 'He wipes a glass and watches you choose what kind of villain to be.');
    return { cols, rows, cells: toCells(buffer) };
}
export function renderInnBreakIn(session, dims, targets) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, '[b][c:red]Guest Hall - Lamps Turned Low[b][c:white]');
    if (targets.length === 0) {
        drawText(buffer, 3, 4, '[c:magenta]No doors worth risking your neck tonight.[c:white]');
    }
    else {
        drawText(buffer, 3, 4, '[b][c:yellow]Choose a room to open quietly:[b][c:white]');
        const maxRows = Math.min(9, targets.length);
        for (let i = 0; i < maxRows; i += 1) {
            const target = targets[i];
            const weapon = getWeaponById(target.weapon_id);
            drawText(buffer, 3, 6 + i, `${i + 1}) ${target.display_name} L${target.level}  Weapon: ${weapon.name}`);
        }
    }
    drawText(buffer, 3, rows - 5, '[b][c:cyan]Commands:[b][c:white] (1-9) target   (Q) back');
    drawText(buffer, 3, rows - 4, session.notice || '[dim]Floorboards mutter. A snore stops. Then starts again.[dim]');
    return { cols, rows, cells: toCells(buffer) };
}
