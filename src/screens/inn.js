import { getWeaponById } from '../data/equipment.js';
import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderInn(session, dims) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]The Sleeping Dragon Inn[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Warm fire, loud songs, and dangerous whispers at every table.[dim]');
    drawText(buffer, 3, 4, '[b][c:cyan]Common Room[b][c:white]');
    drawText(buffer, 3, 5, '[c:green]G[c:white]) Get a room          [c:green]C[c:white]) Converse with patrons');
    drawText(buffer, 3, 6, '[c:green]S[c:white]) Listen to [c:yellow]Seth Able[c:white]   [c:green]F[c:white]) Flirt with [c:magenta]Violet[c:white]');
    drawText(buffer, 3, 7, '[c:green]T[c:white]) Talk to bartender   [c:green]O[c:white]) Old man in the corner');
    drawText(buffer, 3, 8, '[c:green]R[c:white]) Return to Town');
    if (session.player) {
        drawText(buffer, 44, 4, '[b][c:magenta]Your Table[b][c:white]');
        drawText(buffer, 44, 5, `Gold ${session.player.gold_on_hand} | Charm ${session.player.charm}`);
        drawText(buffer, 44, 6, `Room ${session.player.in_inn_room ? '[c:green]YES[c:white]' : '[c:red]NO[c:white]'} | Flirt ${session.player.flirt_used_today ? 'used' : 'ready'}`);
        drawText(buffer, 44, 7, `Seth listens ${session.player.bard_listens_used_today} | Forest ${session.player.turns_forest_left}/${session.player.turns_forest_max}`);
    }
    drawText(buffer, 3, rows - 5, '[dim]Flavor: Songs buy smiles. Secrets buy blood.[dim]');
    drawText(buffer, 3, rows - 4, session.notice ? `[c:yellow]${session.notice}[c:white]` : '[c:green]The hearth pops and someone starts another scandalous story.[c:white]');
    return { cols, rows, lines: toLines(buffer) };
}
export function renderInnConverse(session, dims) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, 'Patrons');
    drawText(buffer, 3, 4, 'Nobody is saying anything interesting... yet.');
    drawText(buffer, 3, 6, '(R) Return to the Inn');
    drawText(buffer, 3, rows - 4, session.notice || 'Mugs clink. Someone snores by the fire.');
    return { cols, rows, lines: toLines(buffer) };
}
export function renderInnBartender(session, dims) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, '[b][c:magenta]Bartender, Keeper of Bad Ideas[b][c:white]');
    drawText(buffer, 3, 4, '[c:green]B[c:white]) Bribe for room keys');
    drawText(buffer, 3, 5, '[c:green]A[c:white]) Attack sleeping enemies');
    drawText(buffer, 3, 6, '[c:green]E[c:white]) Exit to common room');
    if (session.player) {
        drawText(buffer, 46, 4, `Gold: ${session.player.gold_on_hand}`);
        drawText(buffer, 46, 5, `Bribed today: ${session.player.inn_breakin_used_today ? '[c:red]YES[c:white]' : '[c:green]NO[c:white]'}`);
    }
    drawText(buffer, 3, rows - 5, '[c:red]Warning:[c:white] Break-ins make enemies that remember your face.');
    drawText(buffer, 3, rows - 4, session.notice || 'He polishes a mug and waits for your morals to slip.');
    return { cols, rows, lines: toLines(buffer) };
}
export function renderInnBreakIn(session, dims, targets) {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(24, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, '[b][c:red]Break-In Hallway[b][c:white]');
    if (targets.length === 0) {
        drawText(buffer, 3, 4, '[c:magenta]No eligible sleepers tonight.[c:white]');
    }
    else {
        drawText(buffer, 3, 4, '[b][c:yellow]Choose a target:[b][c:white]');
        const maxRows = Math.min(9, targets.length);
        for (let i = 0; i < maxRows; i += 1) {
            const target = targets[i];
            const weapon = getWeaponById(target.weapon_id);
            drawText(buffer, 3, 6 + i, `${i + 1}) ${target.display_name} L${target.level}  Weapon: ${weapon.name}`);
        }
    }
    drawText(buffer, 3, rows - 5, '[b][c:cyan]Commands:[b][c:white] (1-9) target   (Q) back');
    drawText(buffer, 3, rows - 4, session.notice || '[dim]The hallway is quiet except for nervous breathing.[dim]');
    return { cols, rows, lines: toLines(buffer) };
}
