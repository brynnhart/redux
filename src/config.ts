export const config = {
  timezone: process.env.LORD_TIMEZONE ?? 'America/New_York',
  forestTurnsBase: Number(process.env.LORD_FOREST_TURNS_BASE ?? '30'),
  forestTurnsMin: Number(process.env.LORD_FOREST_TURNS_MIN ?? '5'),
  spiritsChances: {
    high: Number(process.env.LORD_SPIRITS_HIGH_CHANCE ?? '0.2'),
    low: Number(process.env.LORD_SPIRITS_LOW_CHANCE ?? '0.2')
  }
} as const;
