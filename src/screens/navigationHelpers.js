import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { getOtherPlaceModuleById, otherPlacesModules } from '../modules/otherPlacesRegistry.js';
import { buildStatsView } from '../services/statsViewService.js';
function renderHeader(buffer, title) {
    drawText(buffer, 3, 2, '========================================');
    drawText(buffer, 3, 3, title);
    drawText(buffer, 3, 4, '========================================');
}
const helpScreen = {
    render: ({ session }, dims) => {
        const cols = Math.max(80, dims.cols);
        const rows = Math.max(25, dims.rows);
        const buffer = createBuffer(cols, rows);
        drawBox(buffer, 0, 0, cols, rows);
        renderHeader(buffer, 'Help / Menu Legend');
        drawText(buffer, 3, 7, 'Single-line input: type a command, then press Enter.');
        drawText(buffer, 3, 8, 'Press [Enter] or R to return to town.');
        drawText(buffer, 3, rows - 4, session.notice || 'Read, nod, and return to town.');
        drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
        return { cols, rows, lines: toLines(buffer) };
    },
    handleInput: (_ctx, input) => {
        if (input === 'R' || input === '')
            return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'Back to town.' };
        if (input === 'Q' || input === 'X')
            return { type: 'logout' };
        return { type: 'error', message: 'Huh?' };
    }
};
const statsScreen = {
    render: ({ session }, dims) => {
        const cols = Math.max(80, dims.cols);
        const rows = Math.max(32, dims.rows);
        const buffer = createBuffer(cols, rows);
        drawBox(buffer, 0, 0, cols, rows);
        const player = session.player;
        if (player) {
            const view = buildStatsView(player);
            renderHeader(buffer, view.title);
            let y = 6;
            for (const line of view.lines) {
                drawText(buffer, 3, y++, line);
            }
        }
        else {
            renderHeader(buffer, 'Your Character Stats');
            drawText(buffer, 3, 7, 'No player loaded.');
        }
        drawText(buffer, 3, rows - 4, session.notice || 'Press [Enter], [R], or [Q] to return.');
        drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
        return { cols, rows, lines: toLines(buffer) };
    },
    handleInput: ({ session }, input) => {
        const previous = session.previousScreenId && session.previousScreenId !== 'VIEW_STATS' ? session.previousScreenId : 'TOWN_SQUARE';
        if (input === '' || input === 'R' || input === 'Q') {
            return { type: 'goto', screenId: previous, notice: 'You close your stat sheet.' };
        }
        if (input === '?') {
            return { type: 'stay', notice: 'Stats: [Enter]/[R]/[Q] return.' };
        }
        if (input === 'X')
            return { type: 'logout' };
        return { type: 'error', message: 'Huh?' };
    }
};
const otherPlacesScreen = {
    render: ({ session }, dims) => {
        const cols = Math.max(80, dims.cols);
        const rows = Math.max(25, dims.rows);
        const buffer = createBuffer(cols, rows);
        drawBox(buffer, 0, 0, cols, rows);
        renderHeader(buffer, 'Other Places');
        const player = session.player;
        let y = 7;
        otherPlacesModules.forEach((module, index) => {
            const available = player ? module.isAvailable(player) : false;
            const statusText = available ? module.description : 'Coming soon';
            drawText(buffer, 3, y++, `${index + 1}) ${module.name.padEnd(18)} - ${statusText}`);
        });
        drawText(buffer, 3, y + 1, '(R) Return to Town');
        drawText(buffer, 3, rows - 4, session.notice || 'A strange list of side places and bad ideas.');
        drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
        return { cols, rows, lines: toLines(buffer) };
    },
    handleInput: ({ session }, input) => {
        if (input === 'R')
            return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'You return to town.' };
        const selected = Number(input);
        if (!Number.isInteger(selected) || selected < 1 || selected > otherPlacesModules.length) {
            return { type: 'error', message: 'Choose a listed place number or R to return.' };
        }
        const module = otherPlacesModules[selected - 1];
        if (!session.player)
            return { type: 'error', message: 'No player loaded.' };
        if (!module.isAvailable(session.player)) {
            return { type: 'stay', notice: `${module.name} is not open yet.` };
        }
        session.otherPlacesModuleId = module.id;
        return { type: 'goto', screenId: 'OTHER_PLACES_MODULE', notice: `You head toward ${module.name}.` };
    }
};
const otherPlacesModuleScreen = {
    render: ({ session }, dims) => {
        const module = getOtherPlaceModuleById(session.otherPlacesModuleId);
        if (!module) {
            const cols = Math.max(80, dims.cols);
            const rows = Math.max(25, dims.rows);
            const buffer = createBuffer(cols, rows);
            drawBox(buffer, 0, 0, cols, rows);
            renderHeader(buffer, 'Other Places');
            drawText(buffer, 3, 7, 'This side area flickers out of existence.');
            drawText(buffer, 3, 9, '(R) Return to Other Places');
            drawText(buffer, 3, rows - 4, session.notice || 'No module selected.');
            drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
            return { cols, rows, lines: toLines(buffer) };
        }
        return module.render(session, dims);
    },
    handleInput: ({ session }, input) => {
        const module = getOtherPlaceModuleById(session.otherPlacesModuleId);
        if (!module) {
            return { type: 'goto', screenId: 'OTHER_PLACES', notice: 'Back to Other Places.' };
        }
        const transition = module.handleInput(session, input);
        if (transition.type === 'module_update') {
            return { type: 'other_places_module_update', notice: transition.notice, patch: transition.patch };
        }
        return transition;
    }
};
const screens = {
    VIEW_STATS: statsScreen,
    HELP_MENU: helpScreen,
    OTHER_PLACES: otherPlacesScreen,
    OTHER_PLACES_MODULE: otherPlacesModuleScreen
};
export function isNavigationHelperScreen(state) {
    return Boolean(screens[state]);
}
export function renderNavigationHelperScreen(session, dims) {
    const screen = screens[session.state];
    if (!screen) {
        throw new Error(`No helper screen registered for state ${session.state}`);
    }
    return screen.render({ session }, dims);
}
export function handleNavigationHelperInput(session, inputText) {
    const screen = screens[session.state];
    if (!screen) {
        return { type: 'error', message: 'Huh?' };
    }
    const normalized = inputText.trim().toUpperCase();
    return screen.handleInput({ session }, normalized);
}
