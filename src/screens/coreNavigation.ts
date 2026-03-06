import { config } from '../config.js';
import { getArmorById, getWeaponById } from '../data/equipment.js';
import { createBuffer, toLines } from '../render/buffer.js';
import { drawBox, drawText } from '../render/draw.js';
import { classLabel } from '../services/skillService.js';
import type { Session, ScreenState } from '../session.js';
import { renderBank } from './bank.js';

interface Dimensions {
  cols: number;
  rows: number;
}

interface ScreenContext {
  session: Session;
}

type Transition =
  | { type: 'stay'; notice?: string }
  | { type: 'goto'; screenId: ScreenState; notice?: string }
  | { type: 'logout' }
  | { type: 'error'; message: string }
  | { type: 'auto_deposit' }
  | { type: 'heal_all_possible' }
  | { type: 'heal_specific'; amount: number }
  | { type: 'bank_deposit'; amount: number }
  | { type: 'bank_withdraw'; amount: number }
  | { type: 'bank_deposit_all' }
  | { type: 'bank_withdraw_all' };

interface Screen {
  id: ScreenState;
  render: (ctx: ScreenContext, dims: Dimensions) => { cols: number; rows: number; lines: string[] };
  handleInput: (ctx: ScreenContext, input: string) => Transition;
}

const TOWN_MENU: Array<{ key: string; label: string; target: ScreenState }> = [
  { key: 'F', label: 'Forest', target: 'FOREST' },
  { key: 'I', label: 'The Inn', target: 'INN' },
  { key: 'K', label: 'Ye Olde Bank', target: 'BANK' },
  { key: 'H', label: "Healer's Hut", target: 'HEALER' },
  { key: 'W', label: "King Arthur's Weapons", target: 'WEAPONS_SHOP' },
  { key: 'A', label: "Abdul's Armor", target: 'ARMOR_SHOP' },
  { key: 'T', label: "Turgon's Training", target: 'TRAINING' },
  { key: 'S', label: 'Slaughter / Fields', target: 'SLAUGHTER_FIELDS' },
  { key: 'O', label: 'Other Places / IGMs', target: 'OTHER_PLACES' }
];

function renderHeader(buffer: string[][], title: string) {
  drawText(buffer, 3, 2, '========================================');
  drawText(buffer, 3, 3, title);
  drawText(buffer, 3, 4, '========================================');
}

const townScreen: Screen = {
  id: 'TOWN_SQUARE',
  render: ({ session }, dims) => {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    renderHeader(buffer, 'The Town Square');
    drawText(buffer, 3, 6, 'You wake up, strap your weapon to your back, and head to the Town Square...');

    const player = session.player;
    if (player) {
      const onHand = player.gold_on_hand ?? player.gold_pocket ?? player.gold;
      const inBank = player.gold_in_bank ?? player.gold_bank ?? player.bank_gold;
      drawText(
        buffer,
        3,
        8,
        `Lvl ${player.level} | Exp ${player.exp} | HP ${player.hp}/${player.hp_max} | Gold ${onHand} | Bank ${inBank} | Gems ${player.spirits} | Forest ${player.turns_forest_left}`
      );
    }

    let y = 10;
    for (const item of TOWN_MENU) {
      drawText(buffer, 3, y++, `(${item.key}) ${item.label}`);
    }
    drawText(buffer, 3, y++, '(V) View Stats');
    drawText(buffer, 3, y++, '(B) Auto-deposit on-hand gold');
    drawText(buffer, 3, y++, '(?) Help');
    drawText(buffer, 3, y++, '(Q) Quit');

    drawText(buffer, 3, rows - 4, session.notice || 'Choose a destination.');
    drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
    return { cols, rows, lines: toLines(buffer) };
  },
  handleInput: (_ctx, input) => {
    if (input === '?') return { type: 'goto', screenId: 'HELP_MENU' };
    if (input === 'V') return { type: 'goto', screenId: 'VIEW_STATS' };
    if (input === 'Q' || input === 'X') return { type: 'logout' };
    const target = TOWN_MENU.find((item) => item.key === input);
    if (target) {
      return { type: 'goto', screenId: target.target, notice: `You head toward ${target.label}.` };
    }
    return { type: 'error', message: 'Huh?' };
  }
};

function makeStubScreen(id: ScreenState, title: string, message: string): Screen {
  return {
    id,
    render: ({ session }, dims) => {
      const cols = Math.max(80, dims.cols);
      const rows = Math.max(25, dims.rows);
      const buffer = createBuffer(cols, rows);
      drawBox(buffer, 0, 0, cols, rows);
      renderHeader(buffer, title);
      drawText(buffer, 3, 7, message);
      drawText(buffer, 3, 9, '(R) Return to Town');
      drawText(buffer, 3, 10, '(B) Auto-deposit on-hand gold');
      drawText(buffer, 3, 11, '(?) Help');
      drawText(buffer, 3, 12, '(Q) Quit');
      drawText(buffer, 3, rows - 4, session.notice || '');
      drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
      return { cols, rows, lines: toLines(buffer) };
    },
    handleInput: (_ctx, input) => {
      if (input === 'R') return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'You return to town.' };
      if (input === '?') return { type: 'goto', screenId: 'HELP_MENU' };
      if (input === 'Q' || input === 'X') return { type: 'logout' };
      return { type: 'error', message: 'Huh?' };
    }
  };
}

const healerScreen: Screen = {
  id: 'HEALER',
  render: ({ session }, dims) => {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);
    const player = session.player;

    drawBox(buffer, 0, 0, cols, rows);
    renderHeader(buffer, "Healer's Hut");

    if (player) {
      const onHand = player.gold_on_hand ?? player.gold_pocket ?? player.gold;
      drawText(buffer, 3, 7, `HP: ${player.hp}/${player.hp_max}`);
      drawText(buffer, 3, 8, `Gold on hand: ${onHand}`);
      drawText(buffer, 3, 9, `Cost: ${config.healerCostPerHp} gold per HP`);
    }

    if (session.healerState === 'HEAL_AMOUNT_PROMPT') {
      drawText(buffer, 3, 11, 'Heal how many HP? (R=Return)');
    } else {
      drawText(buffer, 3, 11, '(1) Heal ALL possible');
      drawText(buffer, 3, 12, '(2) Heal a specific amount');
      drawText(buffer, 3, 13, '(R) Return to Town');
    }

    drawText(buffer, 3, rows - 4, session.notice || 'The old healer checks your pulse and your purse.');
    drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
    return { cols, rows, lines: toLines(buffer) };
  },
  handleInput: ({ session }, input) => {
    const normalized = input.trim().toUpperCase();
    if (session.healerState === 'HEAL_AMOUNT_PROMPT') {
      if (normalized === 'R' || normalized === '') {
        session.healerState = 'MENU';
        return { type: 'stay', notice: 'Back to the healer menu.' };
      }
      const amount = Number(normalized);
      if (!Number.isInteger(amount) || amount < 1) {
        return { type: 'error', message: 'Heal amount must be a whole number >= 1, or R to return.' };
      }
      session.healerState = 'MENU';
      return { type: 'heal_specific', amount };
    }

    if (normalized === '1') {
      return { type: 'heal_all_possible' };
    }

    if (normalized === '2') {
      session.healerState = 'HEAL_AMOUNT_PROMPT';
      return { type: 'stay', notice: 'Heal how many HP? (R=Return)' };
    }

    if (normalized === 'R') {
      return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'You return to town.' };
    }

    return { type: 'error', message: 'Healer keys: 1 heal all possible, 2 heal amount, R return.' };
  }
};

const bankScreen: Screen = {
  id: 'BANK',
  render: ({ session }, dims) => renderBank(session, dims),
  handleInput: ({ session }, input) => {
    const normalized = input.trim().toUpperCase();
    if (session.bankState === 'DEPOSIT_PROMPT') {
      if (normalized === 'R' || normalized === '') {
        session.bankState = 'MENU';
        return { type: 'stay', notice: 'Back to the ledger.' };
      }
      if (normalized === '1') {
        session.bankState = 'MENU';
        return { type: 'bank_deposit_all' };
      }
      const amount = Number(normalized);
      if (!Number.isInteger(amount) || amount < 1) {
        return { type: 'error', message: 'Use a whole number >= 1, 1 for all, or R to return.' };
      }
      session.bankState = 'MENU';
      return { type: 'bank_deposit', amount };
    }

    if (session.bankState === 'WITHDRAW_PROMPT') {
      if (normalized === 'R' || normalized === '') {
        session.bankState = 'MENU';
        return { type: 'stay', notice: 'Back to the ledger.' };
      }
      if (normalized === '1') {
        session.bankState = 'MENU';
        return { type: 'bank_withdraw_all' };
      }
      const amount = Number(normalized);
      if (!Number.isInteger(amount) || amount < 1) {
        return { type: 'error', message: 'Use a whole number >= 1, 1 for all, or R to return.' };
      }
      session.bankState = 'MENU';
      return { type: 'bank_withdraw', amount };
    }

    if (input === 'D') {
      session.bankState = 'DEPOSIT_PROMPT';
      return { type: 'stay', notice: 'Deposit how much? (1=All, R=Return)' };
    }
    if (input === 'W') {
      session.bankState = 'WITHDRAW_PROMPT';
      return { type: 'stay', notice: 'Withdraw how much? (1=All, R=Return)' };
    }
    if (input === '1') return { type: 'bank_deposit_all' };
    if (input === '2') return { type: 'bank_withdraw_all' };
    if (input === 'R') return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'You return to town.' };

    return { type: 'error', message: 'Bank keys: D deposit, W withdraw, 1 all deposit, 2 all withdraw, R return.' };
  }
};

const helpScreen: Screen = {
  id: 'HELP_MENU',
  render: ({ session }, dims) => {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    renderHeader(buffer, 'Help / Menu Legend');
    drawText(buffer, 3, 7, 'Single-line input: type a command, then press Enter.');
    drawText(buffer, 3, 8, '? = Help, R = Return to Town, Q/X = Quit, B = Auto-deposit, H = Heal all possible');
    drawText(buffer, 3, 11, '(R) Return to Town');
    drawText(buffer, 3, rows - 4, session.notice || '');
    drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
    return { cols, rows, lines: toLines(buffer) };
  },
  handleInput: (_ctx, input) => {
    if (input === 'R' || input === '') return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'Back to town.' };
    if (input === 'Q' || input === 'X') return { type: 'logout' };
    return { type: 'error', message: 'Huh?' };
  }
};

const statsScreen: Screen = {
  id: 'VIEW_STATS',
  render: ({ session }, dims) => {
    const cols = Math.max(80, dims.cols);
    const rows = Math.max(25, dims.rows);
    const buffer = createBuffer(cols, rows);
    drawBox(buffer, 0, 0, cols, rows);
    renderHeader(buffer, 'Character Sheet');

    const player = session.player;
    if (player) {
      const weapon = getWeaponById(player.weapon_id);
      const armor = getArmorById(player.armor_id);
      const onHand = player.gold_on_hand ?? player.gold_pocket ?? player.gold;
      const inBank = player.gold_in_bank ?? player.gold_bank ?? player.bank_gold;
      drawText(buffer, 3, 7, `Name: ${player.display_name}`);
      drawText(buffer, 3, 8, `Sex: ${player.sex}  Class: ${classLabel(player.class)}  Level: ${player.level}`);
      drawText(buffer, 3, 9, `Exp: ${player.exp} / ???`);
      drawText(buffer, 3, 10, `HP: ${player.hp}/${player.hp_max}   Charm: ${player.charm}`);
      drawText(buffer, 3, 11, `Weapon: ${weapon.name || 'None'}`);
      drawText(buffer, 3, 12, `Armor: ${armor.name || 'None'}`);
      drawText(buffer, 3, 13, `Gold: ${onHand}   Bank: ${inBank}   Gems: ${player.spirits}`);
      drawText(buffer, 3, 14, `Skill uses - DK: ${player.skill_uses_death}, Mystic: ${player.skill_uses_mystic}, Thief: ${player.skill_uses_thief}`);
    }

    drawText(buffer, 3, rows - 4, session.notice || 'Press Enter or R to return to town.');
    drawText(buffer, 3, rows - 3, `Command> ${session.inputBuffer}`);
    return { cols, rows, lines: toLines(buffer) };
  },
  handleInput: (_ctx, input) => {
    if (input === '' || input === 'R') return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'Back to town.' };
    if (input === '?') return { type: 'goto', screenId: 'HELP_MENU' };
    if (input === 'Q' || input === 'X') return { type: 'logout' };
    return { type: 'error', message: 'Huh?' };
  }
};

const screens: Partial<Record<ScreenState, Screen>> = {
  TOWN_SQUARE: townScreen,
  VIEW_STATS: statsScreen,
  HELP_MENU: helpScreen,
  FOREST: makeStubScreen('FOREST', 'The Forest', 'The forest looms... (coming soon)'),
  INN: makeStubScreen('INN', 'The Inn', 'The barkeep polishes a glass... (coming soon)'),
  BANK: bankScreen,
  HEALER: healerScreen,
  WEAPONS_SHOP: makeStubScreen('WEAPONS_SHOP', "King Arthur's Weapons", 'Steel racks line the walls... (coming soon)'),
  ARMOR_SHOP: makeStubScreen('ARMOR_SHOP', "Abdul's Armor", 'Abdul grunts from behind a helm... (coming soon)'),
  OTHER_PLACES: makeStubScreen('OTHER_PLACES', 'Other Places / IGMs', 'Mysterious portals flicker... (coming soon)')
};

export function isCoreNavigationScreen(state: ScreenState): boolean {
  return Boolean(screens[state]);
}

export function renderCoreNavigationScreen(session: Session, dims: Dimensions) {
  const screen = screens[session.state] ?? townScreen;
  return screen.render({ session }, dims);
}

export function handleCoreNavigationInput(session: Session, inputText: string): Transition {
  const screen = screens[session.state] ?? townScreen;
  const normalized = inputText.trim().toUpperCase();
  const command = normalized.length > 0 ? normalized[0] : '';

  if (command === 'H' && session.playerId) {
    return { type: 'heal_all_possible' };
  }

  if (command === 'B' && session.state !== 'BANK') {
    return { type: 'auto_deposit' };
  }

  if (command === '?' && session.state !== 'BANK') {
    return { type: 'goto', screenId: 'HELP_MENU' };
  }

  if ((command === 'Q' || command === 'X') && session.playerId) {
    return { type: 'logout' };
  }

  if (
    command === 'R' &&
    session.state !== 'TOWN_SQUARE' &&
    session.state !== 'BANK' &&
    !(session.state === 'HEALER' && session.healerState === 'HEAL_AMOUNT_PROMPT')
  ) {
    return { type: 'goto', screenId: 'TOWN_SQUARE', notice: 'You return to town.' };
  }

  return screen.handleInput({ session }, normalized);
}
