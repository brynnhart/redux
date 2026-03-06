export const config = {
  timezone: process.env.LORD_TIMEZONE ?? 'America/New_York',
  forestTurnsBase: Number(process.env.LORD_FOREST_TURNS_BASE ?? '30'),
  forestTurnsMin: Number(process.env.LORD_FOREST_TURNS_MIN ?? '5'),
  forestFightsPerDay: Number(process.env.LORD_FOREST_FIGHTS_PER_DAY ?? '30'),
  bardMaxListensPerDay: Number(process.env.LORD_BARD_MAX_LISTENS_PER_DAY ?? '1'),
  enableDailyNewsAutoShow: (process.env.LORD_ENABLE_DAILY_NEWS_AUTO_SHOW ?? 'true') === 'true',
  innElixirGoldCost: Number(process.env.LORD_INN_ELIXIR_GOLD_COST ?? '1000'),
  innGemTradeCost: Number(process.env.LORD_INN_GEM_TRADE_COST ?? '2'),
  innBribeCost: Number(process.env.LORD_INN_BRIBE_COST ?? '2000'),
  innRoomCostPerLevel: Number(process.env.LORD_INN_ROOM_COST_PER_LEVEL ?? '200'),
  innBardBonusFights: Number(process.env.LORD_INN_BARD_BONUS_FIGHTS ?? '2'),
  bankDailyInterestRate: Number(process.env.LORD_BANK_DAILY_INTEREST_RATE ?? '0.10'),
  moneyDoublerChance: Number(process.env.LORD_MONEY_DOUBLER_CHANCE ?? '0.02'),
  skillDailyUsesCap: Number(process.env.LORD_SKILL_DAILY_USES_CAP ?? '12'),
  skillMasteryLevel: Number(process.env.LORD_SKILL_MASTERY_LEVEL ?? '30'),
  spiritsChances: {
    high: Number(process.env.LORD_SPIRITS_HIGH_CHANCE ?? '0.2'),
    low: Number(process.env.LORD_SPIRITS_LOW_CHANCE ?? '0.2')
  }
} as const;
