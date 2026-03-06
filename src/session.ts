import type { FieldsTargetRecord, PlayerClass, PlayerRecord, PlayerSex } from './repos/playerRepo.js';
import type { NewsRecord } from './services/newsService.js';
import type { PvpEncounterState } from './services/pvpService.js';

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
  | 'INN_CONVERSE'
  | 'INN_BREAK_IN'
  | 'TRAINING'
  | 'HALL_OF_HONOR'
  | 'PLAYER_RANKINGS'
  | 'HEROIC_DEEDS_RANKINGS'
  | 'OLD_MAN_MENU'
  | 'OLD_MAN_TOP_LIST'
  | 'SLAUGHTER_FIELDS'
  | 'OTHER_PLACES'
  | 'OTHER_PLACES_MODULE';
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
  previousScreenId?: ScreenState;
  mode: InputMode;
  inputBuffer: string;
  prompt: PromptState | null;
  notice: string;
  playerId?: string;
  player?: PlayerRecord;
  screenParams?: Record<string, string>;
  dailyNews: NewsRecord[];
  todayDate?: string;
  todayDayNumber?: number;
  dailyNewsOffset: number;
  dailyNewsHasMore: boolean;
  pendingBankAction?: 'DEPOSIT' | 'WITHDRAW';
  bankState?: 'MENU' | 'DEPOSIT_PROMPT' | 'WITHDRAW_PROMPT';
  healerState?: 'MENU' | 'HEAL_AMOUNT_PROMPT';
  pendingEquipmentAction?: 'BUY_WEAPON' | 'BUY_ARMOR';
  pendingForestSkill?: 'DEATH_ATTACK' | 'MYSTIC_PINCH' | 'MYSTIC_HEAL' | 'THIEF_SNEAKY' | 'THIEF_PASS_MARK';
  innTargetSelection?: string;
  pvpTargetSelection?: string;
  pvpEncounter?: PvpEncounterState;
  pvpFieldsTargets?: FieldsTargetRecord[];
  oldManCategory?: 'kills' | 'laid' | 'dragons' | 'bank' | 'strongest';
  pendingNewDaySpirits?: 'LOW' | 'NORMAL' | 'HIGH';
  otherPlacesModuleId?: string;
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
    dailyNewsOffset: 0,
    dailyNewsHasMore: false,
    bankState: 'MENU',
    healerState: 'MENU'
  };
}

export function setScreen(session: Session, state: ScreenState) {
  if (session.state !== state) {
    session.previousScreenId = session.state;
  }
  session.state = state;
  if (state !== 'OTHER_PLACES_MODULE') {
    session.otherPlacesModuleId = undefined;
  }
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
