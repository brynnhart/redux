import { getSellPrice, getWeaponById, listBuyableWeapons } from '../data/equipment.js';
import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
export function renderWeaponsShop(session, dims) {
    const cols = Math.max(90, dims.cols);
    const rows = Math.max(28, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;
    const masked = session.prompt?.hidden ? '*'.repeat(session.inputBuffer.length) : session.inputBuffer;
    drawBox(buffer, 0, 0, cols, rows);
    drawText(buffer, 3, 2, "King Arthur's Weapons");
    if (player) {
        const current = getWeaponById(player.weapon_id);
        drawText(buffer, 3, 4, `Gold on hand: ${player.gold_on_hand}`);
        drawText(buffer, 3, 5, `Current weapon: ${current.name} (+${current.atk_bonus} atk)`);
        drawText(buffer, 3, 6, `Sell value now: ${getSellPrice(current.cost)} gold`);
    }
    drawText(buffer, 3, 8, '1-15) Weapon list:');
    listBuyableWeapons().forEach((weapon, i) => {
        const col = i < 8 ? 3 : 46;
        const row = 9 + (i % 8);
        drawText(buffer, col, row, `${weapon.tier.toString().padStart(2, ' ')}. ${weapon.name.padEnd(18, ' ')} ${weapon.cost}`);
    });
    drawText(buffer, 3, 19, 'B) Buy weapon #   S) Sell current   L) List weapons   R/T) Return to Town');
    drawText(buffer, 3, 20, 'F) Forest   A) Armor   H) Healer');
    if (session.mode === 'TEXT_ENTRY' && session.prompt?.field === 'weapon_tier') {
        drawText(buffer, 3, 22, `Buy which weapon #? (R=Return) > ${masked}_`);
    }
    drawText(buffer, 3, rows - 4, session.notice || 'Arthur grunts: buy fast or leave.');
    return { cols, rows, lines: toLines(buffer) };
}
