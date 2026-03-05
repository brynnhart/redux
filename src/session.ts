let nextSessionId = 1;

export interface Session {
  id: string;
  cols: number;
  rows: number;
  lastKey?: string;
}

export function createSession(): Session {
  return {
    id: `s-${Date.now()}-${nextSessionId++}`,
    cols: 80,
    rows: 25
  };
}
