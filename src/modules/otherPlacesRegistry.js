import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
const lordCavernModule = {
    id: 'lord_cavern',
    name: 'Lord Cavern',
    description: 'Strange tunnels and odd rewards.',
    isAvailable: () => true,
    render: (session, dims) => {
        const cols = Math.max(80, dims.cols);
        const rows = Math.max(25, dims.rows);
        const buffer = createBuffer(cols, rows);
        drawBox(buffer, 0, 0, cols, rows);
        drawText(buffer, 3, 2, '========================================');
        drawText(buffer, 3, 3, 'Lord Cavern');
        drawText(buffer, 3, 4, '========================================');
        drawText(buffer, 3, 6, 'You descend into the Lord Cavern. The air smells damp and wrong.');
        drawText(buffer, 3, 8, '(C) Continue inside');
        drawText(buffer, 3, 9, '(V) View your stats');
        drawText(buffer, 3, 10, '(R) Return to Other Places');
        drawText(buffer, 3, rows - 4, session.notice || 'A damp hole full of bad ideas.');
        drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
        return { cols, rows, lines: toLines(buffer) };
    },
    handleInput: (_session, input) => {
        if (input === 'R') {
            return { type: 'goto', screenId: 'OTHER_PLACES', notice: 'You climb back toward the side paths.' };
        }
        if (input === 'V') {
            return { type: 'goto', screenId: 'VIEW_STATS', notice: 'You check yourself before going deeper.' };
        }
        if (input !== 'C') {
            return { type: 'stay', notice: 'Cavern keys: C continue, V stats, R return.' };
        }
        const roll = Math.floor(Math.random() * 5);
        if (roll === 0) {
            const gold = 15 + Math.floor(Math.random() * 21);
            return {
                type: 'module_update',
                notice: `You shake a corpse loose from the muck. Gain ${gold} gold.`,
                patch: { gold_on_hand: gold }
            };
        }
        if (roll === 1) {
            return {
                type: 'module_update',
                notice: 'You feel oddly prettier in the cave glow. Gain 1 charm.',
                patch: { charm: 1 }
            };
        }
        if (roll === 2) {
            return {
                type: 'module_update',
                notice: 'You find a glittering object in the mud. Gain 1 gem.',
                patch: { gems: 1 }
            };
        }
        if (roll === 3) {
            return {
                type: 'stay',
                notice: 'You hear dripping and distant giggling. You find nothing useful.'
            };
        }
        return {
            type: 'module_update',
            notice: 'A foul smell nearly knocks you unconscious. Lose 3 HP.',
            patch: { hp: -3 }
        };
    }
};
const baraksHouseModule = {
    id: 'baraks_house',
    name: "Barak's House",
    description: 'Coming soon.',
    isAvailable: () => false,
    render: lordCavernModule.render,
    handleInput: () => ({ type: 'goto', screenId: 'OTHER_PLACES', notice: 'Not open yet.' })
};
export const otherPlacesModules = [lordCavernModule, baraksHouseModule];
export function getOtherPlaceModuleById(id) {
    if (!id)
        return null;
    return otherPlacesModules.find((module) => module.id === id) ?? null;
}
