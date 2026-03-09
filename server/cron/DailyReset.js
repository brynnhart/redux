'use strict';

/**
 * server/cron/DailyReset.js
 *
 * Runs once per day (midnight by default) to reset all daily player fields,
 * process marriages, resurrect dead players, add NPC bar talk, and log the day.
 *
 * Replaces: daily_maint() from lord.js lines 2666–3003
 *
 * Schedule is controlled by env var DAILY_RESET_CRON (default: '0 0 * * *')
 */

const cron           = require('node-cron');
const PlayerDB       = require('../db/PlayerDB');
const StateDB        = require('../db/StateDB');
const LogDB          = require('../db/LogDB');
const MailDB         = require('../db/MailDB');
const ConversationDB = require('../db/ConversationDB');

const SCHEDULE = process.env.DAILY_RESET_CRON || '0 0 * * *';

// ── Daily happenings flavour ──────────────────────────────────────────────────
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

function rand(n) { return Math.floor(Math.random() * n); }
function pretty(n) { return Math.floor(n).toLocaleString(); }

// ── NPC bar talk — fires when last_bar points to a player (lord.js talk_now) ──

function npcBarTalk(player) {
  const n = rand(24);
  if (n > 11 || !player || player.name === 'X') return;

  let speaker, line;
  switch (n) {
    case 0:
      speaker = player.sex === 'F' ? '`%Seth Able' : '`%Violet';
      if      (player.cha < 3)  line = `\`0${player.name}\`0..  Have you showered recently?`;
      else if (player.cha < 21) line = `\`0Greetings, ${player.name}\`0.. Don't let them get you down.`;
      else                      line = `\`0Hey ${player.name}\`0, come closer to me..`;
      break;
    case 1:
      speaker = '`%Bartender';
      line = `\`0You jabber too much, ${player.name}.`;
      break;
    case 2:
      speaker = '`%Barak';
      line = player.level > 2
        ? `\`0You think you're tough, ${player.name} \`0'cuz you got a ${player.weapon}?`
        : `\`0You really got a big mouth, ${player.name}\`0.  Ugly one too.`;
      break;
    case 3:
      speaker = '`%Turgon';
      if      (player.level < 6)    line = `\`0Are you saying what I think you're saying ${player.name}\`0?`;
      else if (player.sex === 'M')  line = `\`0Man I need to get wasted...`;
      else                          line = `\`0Heed the words of ${player.name}, \`0For she is a great warrior.`;
      break;
    case 4:
      speaker = '`%Aragorn';
      line = `\`0Hey, ${player.name}\`0, whats the deal with Jennie Garth?`;
      break;
    case 5:
      speaker = '`%Seth Able';
      line = `\`0Damn, I need a drink.`;
      break;
    case 6:
      speaker = '`%Grizelda';
      line = player.sex === 'M'
        ? `\`0${player.name}\`0! You're a cute one!  Come to mama!`
        : `\`0${player.name}\`0..Stay away from my man, wench!`;
      break;
    case 7:
      speaker = '`%Old Women From The Corner';
      line = `\`0There is no \`4Dragon\`0...The children all just ran away.`;
      break;
    case 8:
      speaker = '`%Violet';
      line = `\`0I'm so tired.  Will you escort me to my room, ${player.name}\`0?`;
      break;
    case 9:
      speaker = '`%Hooded Warrior';
      line = `\`0Watch you're back, ${player.name}\`0.`;
      break;
    case 10:
      speaker = '`%Old Man';
      line = player.cha > 3
        ? `\`0Well met, ${player.name}\`0!`
        : `\`0${player.name}\`0!  Why did you kick my ass the other day?!`;
      break;
    case 11:
      speaker = '`%Barak';
      if      (player.sex === 'M') line = `\`0${player.name}\`0.  Interesting name...`;
      else if (player.cha < 4)     line = `\`0${player.name}\`0!  You have no breasts!  Are you a man!?  Har!`;
      else if (player.cha < 8)     line = `\`0Finally!  A woman with some sense!`;
      else                         line = `\`0${player.name}\`0!  I think I'm in love!  Marry me honey!  Har!`;
      break;
    default:
      return;
  }

  if (speaker && line) {
    // Trim bar conversation to max 18 lines
    ConversationDB.addLines('bar', [`  ${speaker}:`, `  \`2${line}`]);
  }
}

// ── violet_marriage / seth_marriage (lord.js lines 2503–2665) ────────────────

function violetMarriage(husband, state) {
  const mstr_hdr = '\n`%  Latest news about `#Violet`%, your wife.\n`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n';
  let mstr = mstr_hdr;

  if (rand(5) < 1) {
    // Divorce
    StateDB.patch({ married_to_violet: -1 });
    const newCha = Math.floor((husband.cha || 1) / 2);
    PlayerDB.patch(husband.id, { married_to: -1, cha: newCha });

    const r = rand(3);
    if (r === 0) {
      LogDB.append(`\`2  \`#Violet\`2 has \`%DIVORCED \`0${husband.name}\`2 for cheating on her with\n\`2  \`4Grizelda!  \`#Violet\`2 got her barmaid job back!`);
      mstr += '  `2Violet has divorced you because Grizelda said you kissed her!  You\n  curse Grizelda!  What will people think?\n';
    } else if (r === 1) {
      LogDB.append(`\`2  \`#Violet\`2 has \`%LEFT \`0${husband.name}\`2 so she could get her old job\n\`2  back at the Inn!  \`0${husband.name} \`2is heartbroken.`);
      mstr += "  `2You hunt around the house for Violet, and all you find is a note!  She\n  left you!  She could not resist the temptation of working at the Inn\n  once again.  You try to control your convulsive sobs.\n";
    } else {
      LogDB.append(`\`2  \`0${husband.name} \`2has \`%DIVORCED \`#Violet\`2 because she refused to do\n\`2  any housework!  She got her old job back at the Inn!`);
      mstr += "  `2You ask Violet to wash the dishes, and she refuses!  You have a big\n  fight!  You decide she isn't the women you married, and divorce her.\n  The whole experience has left you bitter.\n";
    }
    mstr += '\n  `4CHARM DROPS TO ' + pretty(newCha) + '\n';
    MailDB.sendMail(husband.id, null, mstr);
    return;
  }

  const r = rand(4);
  if (r === 0) {
    LogDB.append(`\`2  \`#Violet\`2 has \`%PMS!  \`0${husband.name}\`2 is understanding, and peace\n\`2  is restored.  For now.`);
    mstr += '  `2Violet gets angry over little things!  You realize she has PMS this\n  morning.  You treat her gently and calamity is avoided.\n\n';
    mstr += `  \`%YOU RECEIVE ${pretty(100 * husband.level)} EXPERIENCE.\n`;
    PlayerDB.patch(husband.id, { exp: (husband.exp || 0) + 100 * husband.level });
  } else if (r === 1) {
    LogDB.append(`\`2  \`#Violet\`2 bears \`0${husband.name}\`2 a male child.`);
    mstr += '  `2Violet bears you a male child.  You have never loved her more.\n\n';
    mstr += `  \`%YOU RECEIVE ${pretty(150 * husband.level)} EXPERIENCE.\n`;
    PlayerDB.patch(husband.id, { exp: (husband.exp || 0) + 150 * husband.level, kids: (husband.kids || 0) + 1 });
  } else if (r === 2) {
    LogDB.append(`\`2  \`#Violet\`2 bears \`0${husband.name}\`2 a female child.`);
    mstr += '  `2Violet bears you a female child.  You are a little disappointed.\n  However, you are very pleased she retained her voluptuous figure.\n\n';
    mstr += `  \`%YOU RECEIVE ${pretty(50 * husband.level)} EXPERIENCE.\n`;
    PlayerDB.patch(husband.id, { exp: (husband.exp || 0) + 50 * husband.level, kids: (husband.kids || 0) + 1 });
  } else {
    LogDB.append(`\`2  \`#Violet\`2 and \`0${husband.name}\`2 didn't appear to get much sleep last night.  The town is mystified.`);
    mstr += "  `2Violet pleases you in ways you had only dreamed about.  Nothing\n  has ever felt so good as your wife giving herself freely to you.\n\n";
    mstr += `  \`%YOU RECEIVE ${pretty(100 * husband.level)} EXPERIENCE.\n`;
    PlayerDB.patch(husband.id, { exp: (husband.exp || 0) + 100 * husband.level });
  }
  MailDB.sendMail(husband.id, null, mstr);
}

function sethMarriage(wife, state) {
  const mstr_hdr = '\n`%  Latest news about `0Seth Able`%, your husband.\n`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n';
  let mstr = mstr_hdr;

  if (rand(5) < 1) {
    // Divorce
    StateDB.patch({ married_to_seth: -1 });
    const newCha = Math.floor((wife.cha || 1) / 2);
    PlayerDB.patch(wife.id, { married_to: -1, cha: newCha });

    const r = rand(3);
    if (r === 0) {
      LogDB.append(`\`2  \`%Seth Able\`2 has \`%DIVORCED \`0${wife.name}\`2 for cheating on him with\n\`2  the Bartender!  He now sings a song of woe!`);
      mstr += '  `2Seth Able has divorced you because the Bartender said you kissed him!\n  You curse him!  What will people think?\n';
    } else if (r === 1) {
      LogDB.append(`\`2  \`0Seth Able \`2has been \`%BOOTED \`2by \`0${wife.name}\`2!  Artistic\n\`2  differences are to be blamed.`);
      mstr += "  `2You are getting tired of seeing Seth hang around the house in his\n  underwear 'composing' music.  You tell him to get a real job.\n  There is a fight - And you end up booting this artist.\n";
    } else {
      LogDB.append(`\`2  \`0${wife.name} \`2has \`%DIVORCED \`0Seth Able\`2 because he refused to do\n\`2  any housework!  It is \"womans work\" was his reply!`);
      mstr += "  `2You ask Seth to wash the dishes, and he refuses!  You have a big\n  fight!  You decide he isn't the man you married, and divorce him.\n  The whole experience has left you bitter.\n";
    }
    mstr += '\n  `4CHARM DROPS TO ' + pretty(newCha) + '\n';
    MailDB.sendMail(wife.id, null, mstr);
    return;
  }

  const r = rand(4);
  if (r === 0) {
    LogDB.append(`\`2  \`0${wife.name}\`2 screams at \`%Seth Able \`2for leaving the lid up!  Seth is able to calm her down - peace is restored.`);
    mstr += "  `2You wake up to find the toilet seat up - AGAIN!  You scream your\n  objections at your man - He promises to be more careful in the future.\n\n";
    mstr += `  \`%YOU RECEIVE ${pretty(100 * wife.level)} EXPERIENCE.\n`;
    PlayerDB.patch(wife.id, { exp: (wife.exp || 0) + 100 * wife.level });
  } else if (r === 1) {
    LogDB.append(`\`2  \`0${wife.name}\`2 bears a male child - \`%Seth Able\`2 is proud.`);
    mstr += '  You bear a male child!  Seth Able is extremely pleased with you.\n\n';
    mstr += `  \`%YOU RECEIVE ${pretty(150 * wife.level)} EXPERIENCE.\n`;
    PlayerDB.patch(wife.id, { exp: (wife.exp || 0) + 150 * wife.level, kids: (wife.kids || 0) + 1 });
  } else if (r === 2) {
    LogDB.append(`\`2  \`0${wife.name}\`2 bears a female child - \`%Seth Able \`2approves.`);
    mstr += "  `2You bear a female child!  You are puzzled why Seth is not as happy\n  as you.  He refuses to speak about it.\n\n";
    mstr += `  \`%YOU RECEIVE ${pretty(50 * wife.level)} EXPERIENCE.\n`;
    PlayerDB.patch(wife.id, { exp: (wife.exp || 0) + 50 * wife.level, kids: (wife.kids || 0) + 1 });
  } else {
    LogDB.append(`\`2  \`%Seth Able\`2 and \`0${wife.name}\`2 didn't appear to get much sleep last night.  The town is mystified.`);
    mstr += "  `2Seth Able pleases you in ways you had only dreamed about.  Nothing\n  has ever felt so good as your husband doing the chores around the house.\n\n";
    mstr += `  \`%YOU RECEIVE ${pretty(100 * wife.level)} EXPERIENCE.\n`;
    PlayerDB.patch(wife.id, { exp: (wife.exp || 0) + 100 * wife.level });
  }
  MailDB.sendMail(wife.id, null, mstr);
}

// ── Main reset function ────────────────────────────────────────────────────────

async function runReset() {
  console.log('[DailyReset] Starting daily maintenance...');

  StateDB.incrementDay();
  const state = StateDB.get();
  console.log(`[DailyReset] Game day ${state.days}`);

  // ── NPC bar talk ─────────────────────────────────────────────────────────
  if (state.last_bar && state.last_bar > 0) {
    const talker = PlayerDB.getById(state.last_bar);
    if (talker && talker.name !== 'X') {
      npcBarTalk(talker);
      StateDB.patch({ last_bar: -1 });
    }
  }

  // ── Process all players ──────────────────────────────────────────────────
  const players = PlayerDB.getAll();
  let resetCount = 0;

  for (const p of players) {
    if (p.name === 'X') continue;

    // Force offline (safety net for crashed sessions)
    PlayerDB.patch(p.id, { on_now: false });

    // Reset daily fight counters etc.
    PlayerDB.resetDaily(p.id);

    // Resurrection: dead players inactive for 2+ days get raised
    if (p.dead && p.time < (state.days - 2)) {
      PlayerDB.patch(p.id, {
        dead:             false,
        inn:              false,
        last_reincarnated: state.days,
      });
      console.log(`[DailyReset] Resurrected ${p.name}`);
    }

    resetCount++;
  }

  console.log(`[DailyReset] Reset ${resetCount} players`);

  // ── Marriage events ──────────────────────────────────────────────────────
  const freshState = StateDB.get();

  if (freshState.married_to_violet > 0) {
    const husband = PlayerDB.getById(freshState.married_to_violet);
    if (husband && husband.name !== 'X') {
      violetMarriage(husband, freshState);
      console.log(`[DailyReset] Violet marriage event for ${husband.name}`);
    } else {
      StateDB.patch({ married_to_violet: -1 });
    }
  }

  if (freshState.married_to_seth > 0) {
    const wife = PlayerDB.getById(freshState.married_to_seth);
    if (wife && wife.name !== 'X') {
      sethMarriage(wife, freshState);
      console.log(`[DailyReset] Seth marriage event for ${wife.name}`);
    } else {
      StateDB.patch({ married_to_seth: -1 });
    }
  }

  // ── Daily log entries ────────────────────────────────────────────────────
  LogDB.append(randomHappening());
  LogDB.append(`\`2  Day \`%${state.days}\`2 of the realm begins.`);
  LogDB.prune(2);  // Keep last 2 days

  console.log('[DailyReset] Daily maintenance complete');
}

// ── Cron scheduling ────────────────────────────────────────────────────────────

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
