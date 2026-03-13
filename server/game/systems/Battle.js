'use strict';

/**
 * server/game/systems/Battle.js
 *
 * Core combat engine — ported directly from lord.js
 *
 * FIX: The battle loop now reads session.player on every iteration so that
 * enemyAttack() and doAttack() mutations (which operate on session.player)
 * are always visible to the while-condition and showBattlePrompt().
 */

const PlayerDB  = require('../../db/PlayerDB');
const LogDB     = require('../../db/LogDB');
const Display   = require('../text/Display');
const { level_exp } = require('../data/constants');
const { getPronouns } = require('../utils/pronouns');
const EquipmentDB   = require('../../db/EquipmentDB');

// ── Helpers ────────────────────────────────────────────────────────────────

function rand(n) { return Math.floor(Math.random() * n); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pretty(n) { return Math.floor(n).toLocaleString(); }

// ── Enemy attacks player ───────────────────────────────────────────────────

async function enemyAttack(session, disp, op) {
  const p   = session.player;          // always fresh reference
  const def = p._effectiveDef !== undefined ? p._effectiveDef : p.def;
  let   atk = rand(Math.floor(op.str / 2)) + Math.floor(op.str / 2);

  if (rand(30) === 0) {
    atk += Math.floor(atk / 2);
    disp.sln(`\`4** \`0${op.name}\`4 Executes A Power Move **`);
    disp.sln('');
  }

  atk -= def;
  if (atk < 1) {
    disp.sln(`\`%** \`0${op.name}\`2 misses you Completely! \`%**`);
    return;
  }

  if (p.light_shield) atk = Math.floor(atk / 2);

  const withWord = op.pfight ? getPronouns(op.sex).possessive : 'its';
  disp.sw(`\`4** \`0${op.name} \`2hits with ${withWord} \`0${op.weapon} \`2for `);
  disp.sln(`\`4${pretty(atk)} \`2damage! \`4**`);

  p.hp -= atk;
  if (p.hp < 1) { p.hp = 0; p.dead = true; }
}

// ── Player normal attack ───────────────────────────────────────────────────

async function doAttack(session, disp, op) {
  const p   = session.player;
  const str = p._effectiveStr !== undefined ? p._effectiveStr : p.str;
  let   atk = rand(Math.floor(str / 2)) + Math.floor(str / 2);
  const crit = rand(10) === 9; // 1-in-10

  if (atk < 1 && !p.amulet) {
    disp.sln('');
    disp.sln(`\`2You swing at \`0${op.name}\`2 and miss completely!`);
    disp.sln('');
    await enemyAttack(session, disp, op);
    return;
  }
  if (atk < 1) atk = 1;

  if (crit) {
    atk *= 3;
    disp.sln('');
    disp.sln('  `%**POWER MOVE**');
  }

  disp.sln('');
  disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
  op.hp -= atk;

  // Overkill bonus
  if (atk > p.str && op.hp < 1 && !op.pfight) {
    if (op.death) { disp.sln(''); disp.sln(`\`2${op.death}`); }
    const bonus = rand(20);
    if (bonus === 0) {
      disp.sln(''); disp.sln('  \`2You find a \`%Gem\`2!');
      p.gem = clamp(p.gem + 1, 0, 32000);
    } else if (bonus === 1) {
      op.gold = clamp(op.gold * 2, 0, 2000000000);
    }
  }

  if (op.hp > 0) await enemyAttack(session, disp, op);
}

// ── Death Knight ultra move ────────────────────────────────────────────────

async function useDK(session, disp, op) {
  const p = session.player;
  if (op.is_arena || (op.pfight && p.level >= op.level)) {
    disp.sln('  \`2Your honor stops you from using the more unorthodox methods of battle.');
    return false;
  }
  disp.sln(''); disp.sln('  \`%** ULTRA POWERFUL MOVE **'); disp.sln('');

  const moves = [
    `  In a swift move you have \`0${op.name}\`2 by the neck and begin to\n  exert huge amounts of pressure.  You hear a sickening crack.`,
    `  In a spectacular move, you drive your weapon up between \`0${op.name}\`2's\n  legs.  You grin as your ${p.weapon} crunches noisily.`,
    `  Seeing an opening, you swing your ${p.weapon} in a wide arc.\n  \`0${op.name}'s\`2 left arm falls to the ground in a gout of blood.`,
    `  You duck an uncontrolled swing and retaliate with a wide slash\n  under \`0${op.name}'s\`2 belly.  Steamy intestines slither to the ground.`,
    `  In a scream of rage you brandish your ${p.weapon} wildly.  The\n  surprised \`0${op.name}\`2 misses a parry and loses their nose.`,
  ];
  moves[rand(moves.length)].split('\n').forEach(l => disp.sln(l));

  const dkStr = p._effectiveStr !== undefined ? p._effectiveStr : p.str;
  let atk = rand(Math.floor(dkStr / 2)) + Math.floor(dkStr / 2);
  atk = Math.floor(atk * 3);
  if (op.pfight) atk -= op.def;
  if (atk < 1) atk = 1;
  disp.sln(''); disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
  op.hp -= atk;
  if (op.hp > 0) await enemyAttack(session, disp, op);
  p.levelw = Math.max(0, p.levelw - 1);
  return true;
}

// ── Thief ultra move ──────────────────────────────────────────────────────

async function useThief(session, disp, op) {
  const p = session.player;
  if (op.is_arena || (op.pfight && p.level >= op.level)) {
    disp.sln('  \`2Your honor stops you from using the more unorthodox methods of battle.');
    return false;
  }
  disp.sln(''); disp.sln('  \`%** ULTRA SNEAKY MOVE **'); disp.sln('');

  const moves = [
    `  You point behind \`0${op.name}\`2 and yell "What's that?!"  The fool turns,\n  and you plant two daggers in its back.`,
    `  You suddenly drop to the ground clutching your chest.  The dumbfounded\n  \`0${op.name}\`2 leans over you.  "Surprise!" you scream and drive your\n  ${p.weapon} into its neck.`,
    `  In a smooth motion you draw a dagger from your boot and send it\n  spinning end-over-end into \`0${op.name}'s\`2 eye.`,
  ];
  moves[rand(moves.length)].split('\n').forEach(l => disp.sln(l));

  let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
  atk = Math.floor(atk * 3);
  if (op.pfight) atk -= op.def;
  if (atk < 1) atk = 1;
  disp.sln(''); disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
  op.hp -= atk;
  if (op.hp > 0) await enemyAttack(session, disp, op);
  p.levelt = Math.max(0, p.levelt - 1);
  return true;
}

// ── Mystical skills menu ──────────────────────────────────────────────────

async function useMystical(session, disp, op) {
  const p = session.player;
  if (op.is_arena || (op.pfight && p.level >= op.level)) {
    disp.sln('  \`2Your honor stops you from using the more unorthodox methods of battle.');
    return false;
  }
  disp.sln(''); disp.sln('  \`%** MYSTICAL SKILLS **'); disp.sln('');

  const intros = [
    '  \`2You quickly decide which mystical skill to use.',
    '  \`2Your enemy gives you a chance to contemplate your next action.',
    '  \`2You decide a little magic might change the outcome of this battle.',
    `  \`0${op.name} \`2looks dumbfounded as you sheathe your ${p.weapon}.`,
  ];
  disp.sln(intros[rand(intros.length)]);
  disp.sln('');

  let valid = ['P'];
  disp.sln('  \`2(\`%P\`2)inch Real Hard                    \`2(\`%1\`2 pt)');
  if (p.levelm > 3)  { disp.sln('  \`2(\`%D\`2)isappear                        \`2(\`%4\`2 pt)');  valid.push('D'); }
  if (p.levelm > 7)  { disp.sln('  \`2(\`%H\`2)eat Wave                        \`2(\`%8\`2 pt)');  valid.push('H'); }
  if (p.levelm > 11) { disp.sln('  \`2(\`%L\`2)ight Shield                     \`2(\`%12\`2 pt)'); valid.push('L'); }
  if (p.levelm > 15) { disp.sln('  \`2(\`%S\`2)hatter                          \`2(\`%16\`2 pt)'); valid.push('S'); }
  if (p.levelm > 19) { disp.sln('  \`2(\`%M\`2)ind Heal                        \`2(\`%20\`2 pt)'); valid.push('M'); }
  disp.sln('');
  disp.sw(`  \`2You Have \`%${p.levelm}\`2 skill points.  Choose [\`%Nothing\`2] : `);

  valid.push('\r');
  const ch = await session.prompt('', valid);
  if (!ch || ch === '\r') { disp.sln(''); return false; }
  disp.sln(ch);
  disp.sln('');

  if (ch === 'P') {
    if (p.levelm < 1) { disp.sln('  You need rest.'); return false; }
    let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
    atk = Math.floor(atk * 1.5);
    op.hp -= atk;
    disp.sln(`  \`0You whisper the word.  \`2${op.name}\`0 screams in pain.`);
    disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
    if (op.hp > 0) await enemyAttack(session, disp, op);
    p.levelm -= 1;
  } else if (ch === 'D') {
    if (p.levelm < 4) { disp.sln('  You need rest.'); return false; }
    disp.sln('  You vanish into thin air, reappearing in a cool glade far away.');
    p.levelm -= 4; p.ran_away = true;
  } else if (ch === 'H') {
    if (p.levelm < 8) { disp.sln('  You need rest.'); return false; }
    let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
    atk = Math.floor(atk * 2.5);
    op.hp -= atk;
    disp.sln(`  \`0The air shimmers.  \`2${op.name}\`0 is engulfed in flames.`);
    disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
    if (op.hp > 0) await enemyAttack(session, disp, op);
    p.levelm -= 8;
  } else if (ch === 'L') {
    if (p.levelm < 12) { disp.sln('  You need rest.'); return false; }
    disp.sln('  \`0A beam of light covers you.  You are glowing.  Damage will be halved.');
    p.light_shield = true; p.levelm -= 12;
  } else if (ch === 'S') {
    if (p.levelm < 16) { disp.sln('  You need rest.'); return false; }
    let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
    atk = Math.floor(atk * 5);
    op.hp -= atk;
    disp.sln(`  \`0You visualize \`2${op.name}\`0's bones imploding.  The scream is horrible.`);
    disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
    if (op.hp > 0) await enemyAttack(session, disp, op);
    p.levelm -= 16;
  } else if (ch === 'M') {
    if (p.levelm < 20) { disp.sln('  You need rest.'); return false; }
    disp.sln('  \`0With an inhuman scream, you will yourself to be healed.');
    disp.sln('  \`%YOU ARE FULLY HEALED.');
    p.hp = p.hp_max; p.levelm -= 20;
  }
  return true;
}

// ── Try running ────────────────────────────────────────────────────────────

async function tryRunning(session, disp, op, cantRun) {
  const p = session.player;
  if (cantRun || op.is_arena) {
    disp.sln('  \`4You cannot run from this fight!');
    return false;
  }
  if (rand(9) === 0) {
    disp.sln(''); disp.sln(`\`0${op.name} \`2catches you!`);
    await enemyAttack(session, disp, op);
    return false;
  }
  disp.sln(''); disp.sln('  \`2You barely manage to escape!');
  p.ran_away = true;
  return true;
}

// ── Battle prompt ──────────────────────────────────────────────────────────

function showBattlePrompt(disp, p, op) {
  disp.sln('');
  disp.sln(`\`2  Your Hitpoints : \`0${pretty(p.hp)}`);
  disp.sln(`\`2  ${op.name}\`2's Hitpoints : \`0${pretty(op.hp)}`);
  disp.sln('');
  disp.sln('  \`2(\`%A\`2)ttack');
  disp.sln('  (\`%S\`2)tats');
  disp.sln('  (\`%R\`2)un');

  if (p.levelw > 0 || p.levelm > 0 || p.levelt > 0) disp.sln('');
  if (p.levelw > 0) disp.sln(`  \`2(\`0D\`2)\`0eath Knight Attack (\`%${p.levelw}\`0)`);
  if (p.levelm > 0) disp.sln(`  \`2(\`0M\`2)\`0ystical Skills     (\`%${p.levelm}\`0)`);
  if (p.levelt > 0) disp.sln(`  \`2(\`0T\`2)\`0hieving Skills     (\`%${p.levelt}\`0)`);

  disp.sln('');
  disp.sw(`\`2  Your command, \`0${p.name}\`2?  [\`%A\`2] : `);
}

// ── Level-up check ─────────────────────────────────────────────────────────

async function checkLevelUp(session, disp) {
  const p = session.player;
  if (p.level >= 12 || !level_exp[p.level]) return;
  if (p.exp < level_exp[p.level]) return;

  p.level += 1;
  const hpGain  = p.level * 5 + rand(p.level * 3);
  const strGain = p.level + rand(p.level);
  p.hp_max = clamp(p.hp_max + hpGain, 0, 32000);
  p.hp     = p.hp_max;
  p.str    = clamp(p.str + strGain, 0, 32000);

  if (p.clss === 1) { p.skillw = clamp(p.skillw + p.level, 0, 32000); p.levelw = clamp(p.levelw + 1, 0, 32000); }
  if (p.clss === 2) { p.skillm = clamp(p.skillm + p.level, 0, 32000); p.levelm = clamp(p.levelm + 1, 0, 32000); }
  if (p.clss === 3) { p.skillt = clamp(p.skillt + p.level, 0, 32000); p.levelt = clamp(p.levelt + 1, 0, 32000); }

  session.clearScreen();
  disp.sln(''); disp.sln('');
  disp.sln(`\`%                    ** YOU ARE NOW LEVEL ${p.level}! **`);
  disp.sln('');
  disp.sln(`\`2You gain \`%${pretty(hpGain)} \`2hit points and \`%${pretty(strGain)} \`2strength.`);
  disp.sln(`\`2HP Max is now \`%${pretty(p.hp_max)}\`2.  Strength is now \`%${pretty(p.str)}\`2.`);
  disp.sln('');
  await session.more();

  PlayerDB.patch(p.id, {
    level: p.level, hp: p.hp, hp_max: p.hp_max, str: p.str,
    skillw: p.skillw, levelw: p.levelw,
    skillm: p.skillm, levelm: p.levelm,
    skillt: p.skillt, levelt: p.levelt,
  });
  session.player = PlayerDB.getById(p.id);
}

// ── Exhaustion screen (replaces classic "death" screen) ────────────────────
//
// The player was not killed — they were beaten too badly to continue today.
// They keep their session and can still access social features.

async function exhaustionScreen(session, disp, op) {
  session.clearScreen();
  disp.sln('');
  disp.sln(`\`4You collapse, too wounded to continue...`);
  disp.sln('');
  disp.sln(`\`2${op.name} \`2stands over you, then walks away.`);
  disp.sln('');
  await session.more();

  // Trigger exhaustion — deducts gold/xp, zeros actions, sets flag
  const { goldLost, xpLost } = PlayerDB.triggerExhaustion(session.player.id);
  session.player = PlayerDB.getById(session.player.id);

  disp.sln(`\`2  \`4${goldLost.toLocaleString()} GOLD\`2 lost to your injuries.`);
  disp.sln(`\`2  \`42% OF EXPERIENCE\`2 lost.`);
  disp.sln('');
  disp.sln('\`2  === YOU ARE EXHAUSTED ===');
  disp.sln('');
  disp.sln('  You\'ve pushed yourself too hard today, adventurer.');
  disp.sln('  Your actions have been spent. Rest and recover.');
  disp.sln('');
  disp.sln('  You may still:');
  disp.sln('  `2(\`%I\`2) Visit the Inn and chat with other patrons');
  disp.sln('  `2(\`%K\`2) Browse King Abdul\'s Equipment');
  disp.sln('  `2(\`%D\`2) Read the Daily News');
  disp.sln('');
  disp.sln('  \`%Your actions reset at midnight. Come back tomorrow.');
  disp.sln('');
  await session.more();
}

// ── Main battle loop ───────────────────────────────────────────────────────

async function battle(session, op, opts = {}) {
  const { cantRun = false, isPvP = false } = opts;
  const disp = Display.forSession(session);

  // ── Apply equipment bonuses as a pre-combat step ──────────────────────────
  // Pull effective stats and temporarily boost session.player for combat.
  // We store the originals so we can restore them after (the DB never gets
  // these temp values — combat only mutates hp).
  {
    const effective = EquipmentDB.getEffectiveStats(session.player.id, session.player);
    session.player._effectiveStr = effective.str;
    session.player._effectiveDef = effective.def;
    session.player._goldFind     = effective.goldFind;
    session.player._expGain      = effective.expGain;
  }

  // Initialise transient combat flags directly on session.player
  session.player.ran_away     = false;
  session.player.light_shield = false;

  // Surprise check
  if (rand(10) === 0) {
    disp.sln(`  \`0${op.name} \`2surprises you!`);
    await enemyAttack(session, disp, op);
  } else {
    disp.sln('  \`2Your skill allows you to get the first strike!');
  }

  // ── Combat loop ──────────────────────────────────────────────────────────
  // IMPORTANT: read session.player fresh each iteration — do NOT cache as
  // a local variable, because enemyAttack/doAttack mutate session.player
  // and we must see those changes in the loop condition.
  while (
    session.alive &&
    !session.player.dead &&
    session.player.hp > 0 &&
    op.hp > 0 &&
    !session.player.ran_away
  ) {
    const p = session.player; // re-read each iteration
    showBattlePrompt(disp, p, op);

    let ch = await session.getKeyUpper();
    if (!ch || !session.alive) return 'lose';
    if (ch === '\r') ch = 'A';

    disp.sln(ch); // echo choice

    switch (ch) {
      case 'A':
        await doAttack(session, disp, op);
        break;

      case 'R':
        await tryRunning(session, disp, op, cantRun);
        break;

      case 'S': {
        const pp = session.player;
        disp.sln('');
        disp.sln(`\`2  HP   : \`%${pretty(pp.hp)}\`2 / \`%${pretty(pp.hp_max)}`);
        disp.sln(`\`2  STR  : \`%${pretty(pp.str)}   \`2DEF: \`%${pretty(pp.def)}`);
        disp.sln(`\`2  Gold : \`%${pretty(pp.gold)}`);
        disp.sln('');
        break;
      }

      case 'D':
        if (session.player.levelw < 1) {
          disp.sln('');
          disp.sln(session.player.skillw < 1
            ? "  \`2You don't know any Death Knight skills yet."
            : '  \`2You need rest before you can use those again.');
        } else {
          await useDK(session, disp, op);
        }
        break;

      case 'M':
        if (session.player.levelm < 1) {
          disp.sln('');
          disp.sln(session.player.skillm < 1
            ? "  \`2You don't know any Mystical skills yet."
            : '  \`2You need rest before you can use those again.');
        } else {
          await useMystical(session, disp, op);
        }
        break;

      case 'T':
        if (session.player.levelt < 1) {
          disp.sln('');
          disp.sln(session.player.skillt < 1
            ? "  \`2You don't know any Thieving skills yet."
            : '  \`2You need rest before you can use those again.');
        } else {
          await useThief(session, disp, op);
        }
        break;

      default:
        break;
    }
  } // end while

  // ── Outcome ───────────────────────────────────────────────────────────────
  if (!session.alive) return 'lose';

  const p = session.player;

  // Ran away
  if (p.ran_away) {
    p.ran_away     = false;
    p.light_shield = false;
    delete p._effectiveStr; delete p._effectiveDef; delete p._goldFind; delete p._expGain;
    PlayerDB.patch(p.id, { hp: Math.max(1, p.hp) });
    session.player = PlayerDB.getById(p.id);
    return 'ran';
  }

  p.ran_away     = false;
  p.light_shield = false;

  if (p.dead || p.hp <= 0) {
    delete p._effectiveStr; delete p._effectiveDef; delete p._goldFind; delete p._expGain;
    await exhaustionScreen(session, disp, op);
    LogDB.append(`  \`0${p.name} \`2has been exhausted by \`0${op.name}\`2!`);
    // triggerExhaustion already called inside exhaustionScreen; just refresh
    session.player = PlayerDB.getById(p.id);
    return 'lose';
  }

  // Player won
  disp.sln('');
  disp.sln(`\`2  You have killed \`0${op.name}\`%!`);
  if (op.death && !op.pfight) { disp.sln(''); disp.sln(`\`2  ${op.death}`); }
  disp.sln('');

  const goldFind = p._goldFind || 1;
  const expGain  = p._expGain  || 1;

  // Base rewards halved for balance; equipment multipliers still apply on top
  const goldWon = Math.min(Math.floor((op.gold || 0) * 0.5 * goldFind), 2000000000 - p.gold);
  const expWon  = Math.floor((op.exp  || 0) * 0.5 * expGain);

  if (goldFind > 1 || expGain > 1) {
    const goldBase = op.gold || 0;
    const expBase  = op.exp  || 0;
    if (goldFind > 1) disp.sln(`\`2  (Gold boosted by equipment: \`%${goldBase}\`2 → \`%${goldWon}\`2)`);
    if (expGain  > 1) disp.sln(`\`2  (Exp boosted by equipment: \`%${expBase}\`2 → \`%${expWon}\`2)`);
  }

  disp.sln(`\`2  You receive \`0${pretty(goldWon)} \`2gold and \`0${pretty(expWon)} \`2experience!`);

  // Clean up temp effective-stat fields
  delete p._effectiveStr;
  delete p._effectiveDef;
  delete p._goldFind;
  delete p._expGain;

  PlayerDB.patch(p.id, {
    hp   : Math.max(1, p.hp),
    gold : clamp(p.gold + goldWon, 0, 2000000000),
    exp  : clamp(p.exp  + expWon,  0, 2000000000),
    gem  : p.gem,
  });
  session.player = PlayerDB.getById(p.id);

  disp.sln('');
  await session.more();
  await checkLevelUp(session, disp);
  return 'win';
}

module.exports = { battle, enemyAttack, doAttack, checkLevelUp, exhaustionScreen, rand };
