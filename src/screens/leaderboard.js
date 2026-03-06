import { createBuffer, toCells } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';

function fmt(value) {
    return value.toLocaleString('en-US');
}

function playerRowPrefix(session, id) {
    return session.playerId === id ? '[c:yellow]>[c:white]' : ' ';
}

function playerNameColor(klass) {
    if (klass === 'DEATH_KNIGHT')
        return 'red';
    if (klass === 'MYSTICAL')
        return 'magenta';
    return 'cyan';
}

function classMarker(klass) {
    if (klass === 'DEATH_KNIGHT')
        return 'D';
    if (klass === 'MYSTICAL')
        return 'M';
    return 'T';
}

function masteryMarker(player) {
    if (player.class === 'DEATH_KNIGHT')
        return player.skill_mastery_death ? 'Yes' : 'No';
    if (player.class === 'MYSTICAL')
        return player.skill_mastery_mystic ? 'Yes' : 'No';
    return player.skill_mastery_thief ? 'Yes' : 'No';
}

function findRank(rows, playerId) {
    if (!playerId)
        return null;
    const idx = rows.findIndex((row) => row.id === playerId);
    return idx >= 0 ? idx + 1 : null;
}

function rankingsRowLine(session, index, player) {
    const rank = `${playerRowPrefix(session, player.id)}${String(index + 1).padStart(3)}`;
    const marker = classMarker(player.class);
    const name = player.display_name.slice(0, 18).padEnd(18);
    const color = playerNameColor(player.class);
    const exp = fmt(player.exp).padStart(12);
    const level = String(player.level).padStart(3);
    const mastered = masteryMarker(player).padStart(3);
    const status = player.is_alive ? '[c:green]Alive[c:white]' : '[c:red]Dead [c:white]';
    return `${rank} [c:${color}]${marker}:${name}[c:white] ${exp} ${level} ${mastered} ${status}`;
}

export function renderPlayerRankings(session, dims, rowsData) {
    const cols = Math.max(96, dims.cols);
    const rows = Math.max(26, dims.rows);
    const buffer = createBuffer(cols, rows);

    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 1, '[b][c:yellow]Player Rankings[b][c:white]');
    drawText(buffer, 3, 2, '[dim]Who rules the realm today?[dim]');
    drawText(buffer, 3, 4, '[b][c:cyan] Rk Name               Experience Level Mastered Status[b][c:white]');

    const maxRows = Math.min(rowsData.length, rows - 12);
    for (let i = 0; i < maxRows; i += 1) {
        drawText(buffer, 3, 6 + i, rankingsRowLine(session, i, rowsData[i]));
    }

    if (rowsData.length === 0) {
        drawText(buffer, 3, 6, '[dim]No warriors are ranked yet.[dim]');
    }

    const yourRank = findRank(rowsData, session.playerId);
    drawText(buffer, 3, rows - 5, yourRank ? `[c:yellow]You are ranked #${yourRank}.[c:white]` : '[dim]You are currently unranked.[dim]');
    drawText(buffer, 3, rows - 4, '[dim]Class markers: D=Death Knight, M=Mystical, T=Thief.[dim]');
    drawText(buffer, 3, rows - 3, session.notice || '[dim]Legends rise one day at a time.[dim]');
    drawText(buffer, 3, rows - 2, '[c:cyan][H][c:white] Heroic Deeds  [c:cyan][Enter]/Q[c:white] Return to town');

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
