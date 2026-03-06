import type { PlayerClass, PlayerRecord, PlayerSex } from './repos/playerRepo.js';
import type { NewsRecord } from './services/newsService.js';

let nextSessionId = 1;

export type ScreenState =
  | 'WELCOME'
  | 'LOGIN'
  | 'NEW_CHARACTER'
  | 'DAILY_HAPPENINGS'
  | 'TOWN_SQUARE'
  | 'VIEW_STATS'
  | 'HELP_MENU'
  | 'FOREST'
  | 'BANK'
  | 'HEALER'
  | 'WEAPONS_SHOP'
  | 'ARMOR_SHOP'
  | 'INN'
  | 'INN_BARTENDER'
  | 'INN_FLIRT'
  | 'INN_BREAK_IN'
  | 'TRAINING'
  | 'SLAUGHTER_FIELDS'
  | 'OTHER_PLACES';
export type InputMode = 'MENU' | 'TEXT_ENTRY';

export interface PromptState {
  field: string;
  hidden?: boolean;
}

export interface Session {
  id: string;
  cols: number;
  rows: number;
  lastKey?: string;
  state: ScreenState;
  mode: InputMode;
  inputBuffer: string;
  prompt: PromptState | null;
  notice: string;
  playerId?: string;
  player?: PlayerRecord;
  screenParams?: Record<string, string>;
  dailyNews: NewsRecord[];
  todayDate?: string;
  pendingBankAction?: 'DEPOSIT' | 'WITHDRAW';
  bankState?: 'MENU' | 'DEPOSIT_PROMPT' | 'WITHDRAW_PROMPT';
  healerState?: 'MENU' | 'HEAL_AMOUNT_PROMPT';
  pendingEquipmentAction?: 'BUY_WEAPON' | 'BUY_ARMOR';
  pendingForestSkill?: 'DEATH_ATTACK' | 'MYSTIC_PINCH' | 'MYSTIC_HEAL' | 'THIEF_SNEAKY' | 'THIEF_PASS_MARK';
  innTargetSelection?: string;
  draft: {
    loginUsername?: string;
    username?: string;
    password?: string;
    displayName?: string;
    sex?: PlayerSex;
    class?: PlayerClass;
  };
}

export function createSession(): Session {
  return {
    id: `s-${Date.now()}-${nextSessionId++}`,
    cols: 80,
    rows: 25,
    state: 'WELCOME',
    mode: 'MENU',
    inputBuffer: '',
    prompt: null,
    notice: '',
    draft: {},
    dailyNews: [],
    bankState: 'MENU',
    healerState: 'MENU'
  };
}

export function setScreen(session: Session, state: ScreenState) {
  session.state = state;
  session.mode = 'MENU';
  session.inputBuffer = '';
  session.prompt = null;
  session.bankState = 'MENU';
  session.healerState = 'MENU';
}

export function startPrompt(session: Session, field: string, hidden = false) {
  session.mode = 'TEXT_ENTRY';
  session.prompt = { field, hidden };
  session.inputBuffer = '';
}

export function commitPrompt(session: Session): string {
  const value = session.inputBuffer.trim();
  session.inputBuffer = '';
  session.mode = 'MENU';
  session.prompt = null;
  session.bankState = 'MENU';
  session.healerState = 'MENU';
  return value;
}

export function resetDraft(session: Session) {
  session.draft = {};
}
