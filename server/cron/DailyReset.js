'use strict';

/**
 * server/cron/DailyReset.js
 *
 * Runs once per day (midnight by default) to reset all daily player fields,
 * process marriages, increment days, and prune old log entries.
 *
 * Replaces: daily_maint() from lord.js — which ran at session start if the
 * player's stored day-number differed from the current day. In the web version
 * we run it centrally on a schedule instead.
 *
 * Schedule is controlled by env var DAILY_RESET_CRON (default: '0 0 * * *')
 */

const cron     = require('node-cron');
const PlayerDB = require('../db/PlayerDB');
const StateDB  = require('../db/StateDB');
const LogDB    = require('../db/LogDB');
const { getDB } = require('../db/init');

const SCHEDULE = process.env.DAILY_RESET_CRON || '0 0 * * *';

// ── Daily happenings — random flavour entries ──────────────────────────────
const HAPPENINGS = [
  '`4  A Child was found today!  But scared deaf and dumb.',
  '`4  More children are missing today.',
  '`4  A small girl was missing today.',
  '`4  The town is in grief.  Several children didn\'t come home today.',
  '`4  Dragon sighting reported today by a drunken old man.',
  '`4  Despair covers the land - more bloody remains have been found today.',
  '`4  A group of children did not return from a nature walk today.',
  '`4  The land is in chaos today.  Will the abductions ever stop?',
  '`4  Dragon scales have been found in the forest today...Old or new?',
  '`4  Several farmers report missing cattle today.',
];

function randomHappening() {
  return HAPPENINGS[Math.floor(Math.random() * HAPPENINGS.length)];
}

// ── Main reset function ────────────────────────────────────────────────────

async function runReset() {
  console.log('[DailyReset] Starting daily maintenance...');
  const db = getDB();

  // ── 1. Increment day counter ─────────────────────────────────────────────
  StateDB.incrementDay();
  const state = StateDB.get();
  console.log(`[DailyReset] Game day ${state.days}`);

  // ── 2. Reset all players' daily fields ───────────────────────────────────
  const players = PlayerDB.getAll();
  let   resetCount = 0;

  for (const p of players) {
    // Mark as offline (safety net if server crashed mid-session)
    PlayerDB.patch(p.id, { on_now: false, in_battle: -1 });

    // Reset daily counters
    PlayerDB.resetDaily(p.id);

    // Track days absent (for "gone" mechanic)
    // In lord.js, players inactive > N days lose their character
    // TODO: implement inactivity pruning based on settings

    resetCount++;
  }

  console.log(`[DailyReset] Reset ${resetCount} players`);

  // ── 3. Process marriage events ───────────────────────────────────────────
  // TODO: Port violet_marriage() and seth_marriage() logic here.
  // These generate daily news log entries for married players.

  // ── 4. Log the new day ───────────────────────────────────────────────────
  LogDB.append(randomHappening());
  LogDB.append(`\`2  Day \`%${state.days}\`2 of the realm begins.`);

  // ── 5. Prune old log entries ─────────────────────────────────────────────
  LogDB.prune(2);

  // ── 6. Bank interest ─────────────────────────────────────────────────────
  // TODO: Apply bank interest to all players with bank > 0

  console.log('[DailyReset] Daily maintenance complete');
}

// ── Cron scheduling ────────────────────────────────────────────────────────

function start() {
  if (!cron.validate(SCHEDULE)) {
    console.error(`[DailyReset] Invalid cron schedule: "${SCHEDULE}"`);
    return;
  }
  cron.schedule(SCHEDULE, () => {
    runReset().catch(err => console.error('[DailyReset] Error:', err));
  });
  console.log(`[DailyReset] Scheduled at "${SCHEDULE}"`);
}

module.exports = { start, runReset };
