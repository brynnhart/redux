import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';

function fmt(value) {
    return value.toLocaleString('en-US');
}

function playerRowPrefix(session, id) {
    return session.playerId === id ? '[c:yellow]>[c:white]' : ' ';
}

function findRank(rows, playerId) {
    if (!playerId)
        return null;
    const idx = rows.findIndex((row) => row.id === playerId);
    return idx >= 0 ? idx + 1 : null;
}

export function renderPlayerRankings(session, dims, rowsData) {
    const cols = Math.max(96, dims.cols);
    const rows = Math.max(26, dims.rows);
    const buffer = createBuffer(cols, rows);

    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]Player Rankings[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Who rules the realm today?[dim]');
    drawText(buffer, 3, 4, '[b][c:cyan] Rk Name                 Deeds Lap Lvl Class         EXP          Status[b][c:white]');

    const maxRows = Math.min(rowsData.length, rows - 12);
    for (let i = 0; i < maxRows; i += 1) {
        const p = rowsData[i];
        const line = `${playerRowPrefix(session, p.id)}${String(i + 1).padStart(3)} ${p.display_name.slice(0, 20).padEnd(20)} ${String(p.heroic_deeds_done).padStart(5)} ${String(p.current_lap).padStart(3)} ${String(p.level).padStart(3)} ${p.class.slice(0, 12).padEnd(12)} ${fmt(p.exp).padStart(12)} ${p.is_alive ? 'Alive' : 'Dead '}`;
        drawText(buffer, 3, 6 + i, line);
    }

    if (rowsData.length === 0) {
        drawText(buffer, 3, 6, '[dim]No warriors are ranked yet.[dim]');
    }

    const yourRank = findRank(rowsData, session.playerId);
    drawText(buffer, 3, rows - 5, yourRank ? `[c:yellow]You are ranked #${yourRank}.[c:white]` : '[dim]You are currently unranked.[dim]');
    drawText(buffer, 3, rows - 4, session.notice || '[dim]Legends rise one day at a time.[dim]');
    drawText(buffer, 3, rows - 3, '[c:cyan][Enter]/Q[c:white] Return to town');

    return { cols, rows, cells: toCells(buffer) };
}

export function renderHeroicDeedsRankings(session, dims, rowsData) {
    const cols = Math.max(96, dims.cols);
    const rows = Math.max(26, dims.rows);
    const buffer = createBuffer(cols, rows);

    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]Heroic Deeds Rankings[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Dragon-slayers and cycle-breakers.[dim]');
    drawText(buffer, 3, 4, '[b][c:cyan] Rk Player               Deeds Lvl        EXP  Last Active[b][c:white]');

    const maxRows = Math.min(rowsData.length, rows - 12);
    for (let i = 0; i < maxRows; i += 1) {
        const p = rowsData[i];
        const day = p.last_login_at ? p.last_login_at.slice(0, 10) : 'never';
        const line = `${playerRowPrefix(session, p.id)}${String(i + 1).padStart(3)} ${p.display_name.slice(0, 20).padEnd(20)} ${String(p.heroic_deeds_done).padStart(5)} ${String(p.level).padStart(3)} ${fmt(p.exp).padStart(10)}  ${day}`;
        drawText(buffer, 3, 6 + i, line);
    }

    if (rowsData.length === 0) {
        drawText(buffer, 3, 6, '[dim]No deeds have been carved into memory yet.[dim]');
    }

    const yourRank = findRank(rowsData, session.playerId);
    drawText(buffer, 3, rows - 5, yourRank ? `[c:yellow]You are ranked #${yourRank}.[c:white]` : '[dim]You are currently unranked.[dim]');
    drawText(buffer, 3, rows - 4, session.notice || '[dim]Great deeds echo longer than gold.[dim]');
    drawText(buffer, 3, rows - 3, '[c:cyan][Enter]/Q[c:white] Return to rankings');

    return { cols, rows, cells: toCells(buffer) };
}

export function renderOldManMenu(session, dims) {
    const cols = Math.max(84, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);

    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]The Old Man in the Corner[b][c:white]');
    drawText(buffer, 3, 2, '[dim]He remembers everything and forgives nothing.[dim]');
    drawText(buffer, 3, 4, '[c:cyan](1)[c:white] Most Player Kills');
    drawText(buffer, 3, 5, '[c:cyan](2)[c:white] Most Times Laid');
    drawText(buffer, 3, 6, '[c:cyan](3)[c:white] Most Dragons Slain');
    drawText(buffer, 3, 7, '[c:cyan](4)[c:white] Richest in Bank');
    drawText(buffer, 3, 8, '[c:cyan](5)[c:white] Strongest');
    drawText(buffer, 3, 10, '[c:cyan](R/Q)[c:white] Return to Inn');
    drawText(buffer, 3, rows - 4, session.notice || '[dim]Pick a list and accept his judgment.[dim]');

    return { cols, rows, cells: toCells(buffer) };
}

function oldManLabel(category) {
    switch (category) {
        case 'kills':
            return 'Most Player Kills';
        case 'laid':
            return 'Most Times Laid';
        case 'dragons':
            return 'Most Dragons Slain';
        case 'bank':
            return 'Richest in Bank';
        case 'strongest':
            return 'Strongest';
        default:
            return 'Top List';
    }
}

export function renderOldManTopList(session, dims, category, rowsData) {
    const cols = Math.max(96, dims.cols);
    const rows = Math.max(26, dims.rows);
    const buffer = createBuffer(cols, rows);

    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, `[b][c:yellow]Old Man Rankings: ${oldManLabel(category)}[b][c:white]`);

    let header = '[b][c:cyan] Rk Name                 Value[b][c:white]';
    if (category === 'strongest') {
        header = '[b][c:cyan] Rk Name                 Score[b][c:white]';
    }
    drawText(buffer, 3, 4, header);

    const maxRows = Math.min(rowsData.length, rows - 12);
    for (let i = 0; i < maxRows; i += 1) {
        const p = rowsData[i];
        let value = p.player_kills;
        if (category === 'laid')
            value = p.times_laid;
        if (category === 'dragons')
            value = p.heroic_deeds_done;
        if (category === 'bank')
            value = p.gold_in_bank;
        if (category === 'strongest')
            value = p.score;

        const line = `${playerRowPrefix(session, p.id)}${String(i + 1).padStart(3)} ${p.display_name.slice(0, 20).padEnd(20)} ${fmt(value).padStart(15)}`;
        drawText(buffer, 3, 6 + i, line);
    }

    if (rowsData.length === 0) {
        drawText(buffer, 3, 6, '[dim]Nobody has claimed this list yet.[dim]');
    }

    const yourRank = findRank(rowsData, session.playerId);
    drawText(buffer, 3, rows - 5, yourRank ? `[c:yellow]You are ranked #${yourRank}.[c:white]` : '[dim]You are currently unranked.[dim]');
    drawText(buffer, 3, rows - 4, session.notice || '[dim]Press Enter to stop listening to him gloat.[dim]');
    drawText(buffer, 3, rows - 3, '[c:cyan][Enter]/Q[c:white] Return to old man');

    return { cols, rows, cells: toCells(buffer) };
}
