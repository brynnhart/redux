export type ForestEventKey =
  | 'angels_singing'
  | 'fairies_bathing'
  | 'dead_bird_scroll'
  | 'old_man_directions'
  | 'somewhere_magic_happened';

export interface ForestEventDef {
  key: ForestEventKey;
  weight: number;
}

export const FOREST_EVENTS: ForestEventDef[] = [
  { key: 'angels_singing', weight: 24 },
  { key: 'fairies_bathing', weight: 24 },
  { key: 'dead_bird_scroll', weight: 22 },
  { key: 'old_man_directions', weight: 22 },
  { key: 'somewhere_magic_happened', weight: 8 }
];
