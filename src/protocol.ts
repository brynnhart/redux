export interface ScreenFrame {
  cols: number;
  rows: number;
  lines: string[];
}

export interface ScreenMessage {
  type: 'screen';
  frame: ScreenFrame;
}

export interface KeyMessage {
  type: 'key';
  key: string;
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export type ClientMessage = KeyMessage | ResizeMessage;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isObject(raw) || typeof raw.type !== 'string') {
    return null;
  }

  if (raw.type === 'key') {
    if (
      typeof raw.key === 'string' &&
      typeof raw.code === 'string' &&
      typeof raw.ctrl === 'boolean' &&
      typeof raw.alt === 'boolean' &&
      typeof raw.shift === 'boolean'
    ) {
      return raw as KeyMessage;
    }
    return null;
  }

  if (raw.type === 'resize') {
    if (typeof raw.cols === 'number' && typeof raw.rows === 'number') {
      return {
        type: 'resize',
        cols: Math.max(20, Math.floor(raw.cols)),
        rows: Math.max(10, Math.floor(raw.rows))
      };
    }
    return null;
  }

  return null;
}
