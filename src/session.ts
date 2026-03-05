import type { PlayerClass, PlayerRecord, PlayerSex } from './repos/playerRepo.js';

let nextSessionId = 1;

export type ScreenState = 'WELCOME' | 'LOGIN' | 'NEW_CHARACTER' | 'TOWN_SQUARE';
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
    draft: {}
  };
}

export function setScreen(session: Session, state: ScreenState) {
  session.state = state;
  session.mode = 'MENU';
  session.inputBuffer = '';
  session.prompt = null;
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
  return value;
}

export function resetDraft(session: Session) {
  session.draft = {};
}
