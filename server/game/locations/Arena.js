'use strict';

/**
 * server/game/locations/Arena.js
 *
 * Ported from lord.js slaughter_others() (line 16363) and attack_player() (line 7731)
 *
 * Keys:
 *   (S)  Slaughter a player  — find by name, confirm, fight
 *   (E)  Examine the Dirt   — top killer + the communal dirt message board
 *   (W)  Write in the Dirt  — only if killedaplayer=true or is the realm hero
 *   (L)  List warriors      — leaderboard
 *   (V)  View your stats
 *   (R/Q) Return to town
 *
 * PvP battle outcome (using existing Battle.js):
 *   Attacker wins  → steals gold + half exp + gems (if ≥2), gains pvp kill,
 *                    def+3 / str+2 bonus, logs to happenings, sets killedaplayer
 *   Attacker loses → loses gold + 10% exp, enemy gains pvp kill + half attacker exp,
 *                    attacker mailed notification
 *   Both sides mailed a battle report.
 */

const Display        = require('../text/Display');
const PlayerDB       = require('../../db/PlayerDB');
const LogDB          = require('../../db/LogDB');
const MailDB         = require('../../db/MailDB');
const ConversationDB = require('../../db/ConversationDB');
const { battle, checkLevelUp, deadScreen } = require('../systems/Battle');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function rand(n)   { return Math.floor(Math.random() * Math.max(1, n)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

// ── Persist helper ────────────────────────────────────────────────────────

function persist(session, fields) {
  PlayerDB.patch(session.player.id, fields);
  session.player = PlayerDB.getById(session.player.id);
}

// ── Find player by partial name (mirrors find_player in lord.js) ──────────

async function findTarget(session, disp) {
  disp.sln('');
  disp.sln('  `2Who would you like to attack?');
  disp.sln('  `2(full or `0PARTIAL`2 name)');
  disp.sw('  NAME: `%');

  const input = (await session.getStr(20)).trim();
  disp.sln('');
  if (!input) return null;

  const ucInput = input.toUpperCase();
  const all     = PlayerDB.getAll();

  for (const op of all) {
    if (op.id === session.player.id) continue;
    if (op.name.trim() === 'X') continue;
    if (!op.name.toUpperCase().includes(ucInput)) continue;

    disp.sw(`  \`2You mean "\`0${op.name}\`2"?  [\`%Y\`2] : `);
    const ch = await session.prompt('', ['Y', 'N', '\r']);
    disp.sln(ch === 'N' ? 'N' : 'Y');
    disp.sln('');
    if (ch !== 'N') return op;
  }

  disp.sln('  No warriors found.');
  disp.sln('');
  return null;
}

// ── Top killer (for the Dirt board header) ────────────────────────────────

function topKiller() {
  const all = PlayerDB.getAll();
  return all
    .filter(p => p.name !== 'X')
    .reduce((best, p) => (p.pvp > (best ? best.pvp : -1) ? p : best), null);
}

// ── E — Examine the Dirt ──────────────────────────────────────────────────

async function examineDirt(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('  `%** EXAMINING THE DIRT **`0');
  disp.sln(SEP);
  disp.sln('');

  const tk = topKiller();
  if (tk && tk.pvp > 0) {
    disp.sln(`  \`2The town elders have named \`0${tk.name} \`2the most dangerous`);
    disp.sln(`  \`2warrior in the realm with a whopping \`%${pretty(tk.pvp)}\`2 kills.`);
  } else {
    disp.sln('  `2No warrior has drawn blood in player combat yet.');
  }
  disp.sln('');

  const lines = ConversationDB.getLines('dirt');
  if (!lines.length) {
    disp.sln('  `2The dirt appears soft and malleable.');
  } else {
    lines.forEach(l => disp.sln(l));
  }

  disp.sln('');
  await session.more();
}

// ── W — Write in the Dirt ─────────────────────────────────────────────────

async function writeInDirt(session, disp) {
  const p     = session.player;
  const state = require('../../db/StateDB').get();

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%** WRITING IN THE DIRT **`0');
  disp.sln(SEP);
  disp.sln('');

  // Must have killed a player today OR be the realm hero
  if (!p.killedaplayer && p.name !== state.latesthero) {
    disp.sln(`  \`2You are about to inscribe something, when you hear \`0${state.latesthero || 'a'}\`2's`);
    disp.sln('  voice in your head!');
    disp.sln('');
    disp.sln('  `0"My son, you have not challenged and killed another warrior this day."');
    disp.sln('');
    disp.sln('  `2You lower your eyes in homage to your better.');
    disp.sln('');
    disp.sln('  `0"You may share wisdom when you have killed, and have it."');
    disp.sln('');
    await session.more();
    return;
  }

  if (p.name === state.latesthero) {
    disp.sln('  `2The crowd parts in awe, as you approach the dirt patch.  You smile, maybe');
    disp.sln('  slaying that Dragon did more for your reputation than you know.');
    disp.sln('');
  }

  disp.sln('  `2You pick up a nearby stick and inscribe some of your wisdom.');
  disp.sln('  `2(Blank line to finish, max 20 lines)');
  disp.sln('');

  const lines = [];
  while (lines.length < 20 && session.alive) {
    disp.sw('  `0>`%');
    const line = (await session.getStr(75)).trim();
    disp.sln('');
    if (!line) break;
    lines.push(`  ${line}`);
  }

  if (lines.length) {
    ConversationDB.addLines('dirt', lines, p.id);
    disp.sln('  `2Your wisdom has been inscribed.');
  } else {
    disp.sln('  `2You change your mind and drop the stick.');
  }
  disp.sln('');
  await session.more();
}

// ── S — Attack a player ───────────────────────────────────────────────────

async function attackPlayer(session, disp) {
  let p = session.player;

  // Check daily PvP fights remaining
  if (p.pvp_fights < 1) {
    disp.sln('');
    disp.sln('  You are too tired to look for that warrior.  Try again tomorrow.');
    disp.sln('');
    await session.more();
    return;
  }

  const target = await findTarget(session, disp);
  if (!target) return;

  if (target.id === p.id) {
    disp.sln('  You wish to attack yourself?!!  You decide against it.');
    disp.sln('');
    await session.more();
    return;
  }

  // Dead target
  if (target.dead) {
    disp.sw('  You look for that warrior...And you find ');
    disp.sln(target.sex === 'M' ? 'him...' : 'her...');
    disp.sln('  A rotting corpse...Looks like you were a little late..');
    disp.sln('');
    await session.more();
    return;
  }

  // Target is asleep at the inn
  if (target.inn) {
    disp.sln('  You search the fields but do not find that warrior.');
    disp.sw('  You conclude ');
    disp.sln(target.sex === 'F' ? 'she is staying at the Inn.' : 'he is staying at the Inn.');
    disp.sln('');
    await session.more();
    return;
  }

  // Announce the hunt and confirm
  p = session.player;
  disp.sln('');
  disp.sw(`  \`2You hunt around for \`0${target.name}\`2...`);
  disp.sln(target.sex === 'M' ? 'YOU FIND HIM!' : 'YOU FIND HER!');
  disp.sw(target.sex === 'M' ? '  He' : '  She');
  disp.sln(`\`2 is brandishing a dangerous looking \`0${target.weapon || 'Stick'}\`2.`);
  disp.sln('');
  disp.sw(`  \`2Attack \`5${target.name} \`2[\`0Y\`2] : \`%`);

  const confirm = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(confirm === 'N' ? 'N' : 'Y');
  disp.sln('');

  if (confirm === 'N') return;

  // Consume one PvP fight upfront
  persist(session, { pvp_fights: p.pvp_fights - 1 });

  disp.sln('');
  disp.sln('  `2** `%PLAYER FIGHT `2**');
  disp.sln('');
  disp.sln(`  \`2You have encountered \`0${target.name}\`2!!`);
  disp.sln('');

  // Heal target to full for the fight (as original does)
  const enemy = {
    name  : target.name,
    hp    : target.hp_max,
    hp_max: target.hp_max,
    str   : target.str,
    def   : target.def,
    weapon: target.weapon || 'Stick',
    clss  : target.clss,
  };

  // Run battle — isPvP suppresses forest-fight decrement inside Battle.js
  const result = await battle(session, enemy, { isPvP: true, cantRun: false });

  // Re-read player after battle
  session.player = PlayerDB.getById(session.player.id);
  p = session.player;

  if (result === 'lose' || p.dead) {
    // Attacker died — target gets credit
    const goldLost = p.gold;
    const expLost  = Math.floor(p.exp * 0.10);

    // Target gets pvp kill + half attacker's exp
    const targetFresh = PlayerDB.getById(target.id);
    PlayerDB.patch(target.id, {
      pvp : clamp((targetFresh.pvp || 0) + 1, 0, 32000),
      exp : clamp((targetFresh.exp || 0) + Math.floor(p.exp / 2), 0, 2000000000),
    });

    // Send mail to target
    MailDB.sendMail(
      target.id, null,
      `  \`%YOU HAVE BEEN ATTACKED!\n\`0${SEP}\`2\n  \`0${p.name}\`2 attacked you!\n\`.\n  \`2You have killed \`0${p.name}\`2 in self defense!\n  \`2You receive \`%${pretty(Math.floor(p.exp / 2))}\`2 experience!`
    );

    LogDB.append(`\`0  ${target.name} \`2has killed \`5${p.name}\`2 in self defence!`);
    return;
  }

  if (result === 'win') {
    // Attacker won — strip the target
    const targetFresh = PlayerDB.getById(target.id);
    const goldGained  = targetFresh.gold;
    const expGained   = Math.floor(targetFresh.exp / 2);
    const gemGained   = targetFresh.gem >= 2 ? Math.floor(targetFresh.gem / 2) : 0;

    // Stat bonuses per original settings (def+3, str+2)
    const newDef = clamp(p.def + 3, 0, 32000);
    const newStr = clamp(p.str + 2, 0, 32000);

    persist(session, {
      gold          : clamp(p.gold + goldGained, 0, 2000000000),
      exp           : clamp(p.exp + expGained, 0, 2000000000),
      gem           : p.gem + gemGained,
      def           : newDef,
      str           : newStr,
      pvp           : clamp((p.pvp || 0) + 1, 0, 32000),
      killedaplayer : true,
    });

    // Strip target
    PlayerDB.patch(target.id, {
      gold : 0,
      exp  : clamp(targetFresh.exp - Math.floor(targetFresh.exp * 0.10), 0, 2000000000),
      gem  : targetFresh.gem - gemGained,
      dead : true,
      inn  : false,
    });

    disp.sln('');
    disp.sln(`  \`%You have killed \`0${target.name}\`%!`);
    disp.sln('');
    disp.sw(`  \`2You receive \`%${pretty(goldGained)}\`2 gold, `);
    disp.sln(`\`2and \`%${pretty(expGained)}\`2 experience!`);
    if (gemGained > 0) {
      disp.sln(`  \`2You also find \`0${pretty(gemGained)} \`%${gemGained === 1 ? 'Gem' : 'Gems'}\`2!`);
    }
    disp.sln(`  \`2You also gain \`%3\`2 defense points, and \`%2\`2 strength points.`);

    // Mail target the bad news
    MailDB.sendMail(
      target.id, null,
      `  \`%YOU HAVE BEEN ATTACKED!\n\`0${SEP}\`2\n  \`0${p.name}\`2 attacked you and has killed you!\n  \`2You lost all your gold and 10% of your experience.`
    );

    // Log to daily happenings with an optional press quote
    const saying = await customSaying(session, disp);
    LogDB.append(
      `\`0  ${p.name} \`2has killed \`5${target.name}\`2!` +
      (saying ? `\n${saying}` : '')
    );

    await checkLevelUp(session, disp);
    disp.sln('');
    await session.more();
    return;
  }

  // Ran away
  disp.sln('');
  disp.sln('  `2You manage to escape with your life.');
  disp.sln('');
  await session.more();
}

// ── custom_saying() — optional press quote after a kill ───────────────────

async function customSaying(session, disp) {
  const p = session.player;

  disp.sln('');
  disp.sw('  `2Say something to the press? [`0N`2] : `%');
  const ch = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(ch === 'Y' ? 'Y' : 'N');

  if (ch !== 'Y') return '';

  disp.sln('');
  disp.sln('  `2Share your feelings now.. (Max 50 chars)');
  disp.sw('  `0"`2');
  const msg = (await session.getStr(50)).trim();
  disp.sln('');

  if (msg.length < 5) {
    disp.sln('  `2That just isn\'t interesting enough.  Sorry man.');
    disp.sln('');
    await session.more();
    return '';
  }

  if (msg.length > 50) {
    disp.sln('  `2The press thinks you are boring and leaves!');
    disp.sln('');
    await session.more();
    return '';
  }

  disp.sln('');
  disp.sln('  `2(`0H`2)appy');
  disp.sln('  `2(`0S`2)ad');
  disp.sln('  `2(`0M`2)oaning');
  disp.sln('  `2(`0C`2)ursing');
  disp.sln('  `2(`0E`2)ffing Mad');
  disp.sln('');
  disp.sw('  `2Your emotional state? [`0H`2] : `%');

  const mood = await session.getKeyUpper();
  disp.sln(mood || 'H');

  const suffixes = {
    H: `laughs \`%${p.name}\`2.`,
    S: `\`%${p.name}\`2 declares sadly.`,
    M: `moans \`%${p.name}\`2.`,
    C: `curses \`%${p.name}\`2.`,
    E: `screams \`%${p.name}\`2 in anger.`,
  };
  const suffix = suffixes[mood] || suffixes.H;
  const line   = `\`0  "${msg}"\`2 ${suffix}`;

  disp.sln('');
  disp.sln(line);
  disp.sln('');
  disp.sw('  `2Does this look ok? [`0Y`2] : `%');
  const ok = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(ok === 'N' ? 'N' : 'Y');

  if (ok === 'N') return '';

  disp.sln('');
  disp.sln('  `2Your comment has been noted.');
  disp.sln('');
  return line;
}

// ── Draw the main screen ──────────────────────────────────────────────────

function drawScreen(session, disp) {
  const p = session.player;
  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Slaughter Other Players`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2You stride into the open square, hand on your weapon.');
  disp.sln(`  \`2PvP fights remaining today: \`%${p.pvp_fights}`);
  disp.sln('');
  disp.sln('  `2(`%S`2)laugher a Player');
  disp.sln('  (`%E`2)xamine the Dirt');
  disp.sln('  (`%W`2)rite in the Dirt');
  disp.sln('  (`%L`2)ist Warriors  (Leaderboard)');
  disp.sln('  (`%V`2)iew your Stats');
  disp.sln('  (`%R`2)eturn to Town Square');
  disp.sln('');
  disp.sln('  `5Slaughter  `2(S,E,W,L,V,R)');
  disp.sln('');
  disp.sw(`\`2  Your command, \`0${p.name}\`2? : `);
}

// ── Entry point ───────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);

  drawScreen(session, disp);

  while (session.alive) {
    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) break;
    disp.sln(ch);

    switch (ch) {
      case 'S':
        await attackPlayer(session, disp);
        if (!session.alive || session.player.dead) return;
        drawScreen(session, disp);
        break;

      case 'E':
        await examineDirt(session, disp);
        drawScreen(session, disp);
        break;

      case 'W':
        await writeInDirt(session, disp);
        drawScreen(session, disp);
        break;

      case 'L':
        await require('../systems/LeaderboardRouter').show(session);
        drawScreen(session, disp);
        break;

      case 'V':
        await require('../ShowStats').showStats(session, disp);
        drawScreen(session, disp);
        break;

      case '?':
        drawScreen(session, disp);
        break;

      case 'R':
      case 'Q':
      case '\r':
        return;

      default:
        break;
    }
  }
}

module.exports = { enter };
