'use strict';

/**
 * server/game/systems/Battle.js
 *
 * Core combat engine — ported directly from lord.js
 *
 * Key functions:
 *   battle(session, opponent, opts)    — main combat loop
 *   enemyAttack(session, disp, op)     — enemy strikes player
 *   doAttack(session, disp, op)        — player normal attack
 *   useDK(session, disp, op)           — Death Knight ultra move
 *   useThief(session, disp, op)        — Thief ultra move
 *   useMystical(session, disp, op)     — Mystical skill menu
 *   tryRunning(session, disp, op)      — flee attempt
 *   checkLevelUp(session, disp)        — post-combat level check
 */

const PlayerDB  = require('../../db/PlayerDB');
const LogDB     = require('../../db/LogDB');
const Display   = require('../text/Display');
const { level_exp } = require('../data/constants');

// ── Helpers ────────────────────────────────────────────────────────────────

function rand(n) { return Math.floor(Math.random() * n); }
function randi(lo, hi) { return lo + rand(hi - lo + 1); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pretty(n) { return n.toLocaleString(); }

// ── Enemy attacks player (lord.js enemy_attack) ───────────────────────────

async function enemyAttack(session, disp, op) {
  const p   = session.player;
  let   atk = rand(Math.floor(op.str / 2)) + Math.floor(op.str / 2);

  // Power move (1-in-30 chance)
  if (rand(30) === 1) {
    atk += Math.floor(atk / 2);
    disp.sln(`\`4** \`0${op.name}\`4 Executes A Power Move **`);
    disp.sln('');
  }

  atk -= p.def;

  if (atk < 1) {
    disp.sln(`\`%** \`0${op.name}\`2 misses you Completely! \`%**`);
    return;
  }

  // Light shield halves damage
  if (p.light_shield) {
    atk = Math.floor(atk / 2);
  }

  const his = (op.sex === 'F') ? 'her' : 'its';
  disp.sw(`\`4** \`0${op.name} \`2hits with ${op.pfight ? (op.sex === 'M' ? 'his' : 'her') : 'its'} \`0${op.weapon} \`2for `);
  disp.sln(`\`4${pretty(atk)} \`2damage! \`4**`);

  p.hp -= atk;
  if (p.hp < 1) {
    p.hp   = 0;
    p.dead = true;
  }
}

// ── Player normal attack (lord.js do_attack) ──────────────────────────────

async function doAttack(session, disp, op) {
  const p   = session.player;
  let   atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
  const c   = rand(10) + 1;

  if (atk < 1 && !p.amulet) {
    disp.sln('');
    disp.sw(`\`2You miss \`0${op.name}\`2 completely!`);
    disp.sln('');
    await enemyAttack(session, disp, op);
    return;
  }
  if (atk < 1) atk = 1;

  // Power move (c > 9, i.e. 1-in-10)
  if (c > 9) {
    atk *= 3;
    disp.sln('');
    disp.sln('  `%**POWER MOVE**');
  }

  disp.sln('');
  disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
  op.hp -= atk;

  // Overkill bonus — ported from handle_hit
  if (atk > p.str && op.hp < 1) {
    if (!op.pfight && op.death) {
      disp.sln('');
      disp.sln(`\`2${op.death}`);
    }
    const bonus = rand(3);
    if (bonus === 0) {
      disp.sln('');
      disp.sln('  `2You find a `%Gem`2!');
      p.gem = clamp(p.gem + 1, 0, 32000);
    } else if (bonus === 1) {
      disp.sln('');
      disp.sln('  You find more gold than expected!');
      op.gold *= 2;
    }
  }

  if (op.hp > 0) {
    await enemyAttack(session, disp, op);
  }
}

// ── Death Knight ultra move (lord.js use_death_knight) ────────────────────

async function useDK(session, disp, op) {
  const p = session.player;
  disp.sln('');
  disp.sln('');

  if (op.is_arena) {
    disp.sln('  Your honor stops you from using the more unorthodox methods of');
    disp.sln('  battle against your teacher.');
    disp.sln('');
    return false; // not used
  }
  if (op.pfight && p.level >= op.level) {
    disp.sln('  Your honor stops you from using the more unorthodox methods of');
    disp.sln('  battle.');
    disp.sln('');
    return false;
  }
  if (op.pfight && p.level < op.level) {
    disp.sln('  In a situation like this, you need every advantage you can get.');
    disp.sln('');
  }

  disp.sln('  `%** ULTRA POWERFUL MOVE **');
  disp.sln('');

  const moves = [
    `  In a swift move you have \`0${op.name}\`2 by the neck and begin to\n  exert huge amounts of pressure.  You hear a sickening crack.`,
    `  In a spectacular move, you drive your weapon up between \`0${op.name}\`2's\n  legs.  You grin as your ${p.weapon} crunches noisily.`,
    `  Seeing an opening, you feel your tendons strain as you swing your\n  ${p.weapon}. \`0${op.name}'s\`2 left arm falls to the ground,\n  a gout of blood pulsating at the stump.`,
    `  You duck an uncontrolled swing, and retaliate by slicing a wide gash\n  under \`0${op.name}'s\`2 belly.  You feel sick as steamy intestines\n  slither out into a pile at your enemy's feet.`,
    `  In a scream of rage, you brandish your ${p.weapon} wildly.  The\n  surprised \`0${op.name}\`2 misses a parry, and you are able to send your\n  enemy's nose into the air with a smooth blow.`,
    `  After exchanging blows & blocks for nearly a minute, \`0${op.name}\n  \`2gets too fancy, and as a result an attempt to jump a low swing results\n  in the severing of your enemy's left leg.  His remaining leg slips in\n  blood.`,
    `  You swing your ${p.weapon} as hard as you can, intending to\n  drive it into the fiend's side.  Instead he ducks, and your blade slides\n  right into the top part of his skull.  He stares at you in horror.  The\n  creature's warm brain slides smoothly from the cloven skull and lands\n  with a soft plop on your shoe.  You kick it away, disgusted.`,
  ];
  moves[rand(7)].split('\n').forEach(l => disp.sln(l));

  let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
  atk *= 3;

  // handle_hit
  atk -= (op.pfight ? op.def : 0);
  if (atk < 1) atk = 1;
  disp.sln('');
  disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
  op.hp -= atk;

  if (op.hp > 0) {
    await enemyAttack(session, disp, op);
  }
  p.levelw -= 1;
  return true;
}

// ── Thief ultra move ──────────────────────────────────────────────────────

async function useThief(session, disp, op) {
  const p = session.player;
  disp.sln('');
  disp.sln('');

  if (op.is_arena || (op.pfight && p.level >= op.level)) {
    disp.sln('  Your honor stops you from using the more unorthodox methods of battle.');
    disp.sln('');
    return false;
  }

  disp.sln('  `%** ULTRA SNEAKY MOVE **');
  disp.sln('');

  const moves = [
    `  You point behind your enemy, and yell "Whats that?!"  \`0${op.name}\n  \`2turns around stupidly, before the fool realizes its error, there are\n  two daggers planted in its back.`,
    `  You suddenly find \`0${op.name}'s\`2 right eye very unnatractive.\n  In a smooth motion you slide a dagger from your boot into the air. End\n  over end it flies, finding its mark.  Your enemy's right eye "pops".`,
    `  A devious plan enters your mind.  You fall to the ground, clutching\n  at your chest.  The dumbfounded \`0${op.name}\`2 drops his guard and\n  leans over you.  You scream "Surprise you hoochie fiend!" and drive your\n  ${p.weapon} into his neck.`,
    `  You duck an uncontrolled swing, and retaliate by slicing a wide gash\n  under \`0${op.name}'s\`2 belly.  You feel sick as steamy intestines\n  slither out into a pile at your enemy's feet.`,
    `  In a scream of rage, you brandish your ${p.weapon} wildly.  The\n  surprised \`0${op.name}\`2 misses a parry, and you are able to send your\n  enemy's nose into the air with a smooth blow.`,
    `  After exchanging blows & blocks for nearly a minute, \`0${op.name}\n  \`2gets too fancy, and as a result an attempt to jump a low swing results\n  in the severing of your enemy's left leg.`,
    `  You swing your ${p.weapon} as hard as you can.  Instead he ducks,\n  and your blade slides right into the top part of his skull.`,
  ];
  moves[rand(7)].split('\n').forEach(l => disp.sln(l));

  let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
  atk *= 3;
  if (op.pfight) atk -= op.def;
  if (atk < 1) atk = 1;
  disp.sln('');
  disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
  op.hp -= atk;
  if (op.hp > 0) await enemyAttack(session, disp, op);
  p.levelt -= 1;
  return true;
}

// ── Mystical skills menu ──────────────────────────────────────────────────

async function useMystical(session, disp, op) {
  const p = session.player;
  disp.sln('');
  disp.sln('');

  if (op.is_arena || (op.pfight && p.level >= op.level)) {
    disp.sln('  Your honor stops you from using the more unorthodox methods of battle.');
    disp.sln('');
    return false;
  }

  disp.sln('  `%** MYSTICAL SKILLS **');
  disp.sln('');

  const intros = [
    '  `2You quickly decide which mystical skill to use.',
    '  `2Your enemy gives you a chance to contemplate your next action.',
    '  `2You decide a little magic might change the outcome of this battle.',
    '  `2You struggle to keep your anger under control.',
    '  `2Your mind carefully goes over what you have learned.',
    '  `2You feel power dancing in your mind, maybe it\'s time to use it.',
    `  \`0${op.name} \`2looks dumbfounded as you sheathe your ${p.weapon}.`,
  ];
  disp.sln(intros[rand(7)]);
  disp.sln('');

  let valid = 'P';
  disp.sln('  `5(`#P`5)inch Real Hard                 `5(`%1`5)');
  if (p.levelm > 3  && p.skillm > 3)  { disp.sln('  `5(`#D`5)isappear                       `5(`%4`5)');  valid += 'D'; }
  if (p.levelm > 7  && p.skillm > 7)  { disp.sln('  `5(`#H`5)eat Wave                       `5(`%8`5)');  valid += 'H'; }
  if (p.levelm > 11 && p.skillm > 11) { disp.sln('  `5(`#L`5)ight Shield                    `5(`%12`5)'); valid += 'L'; }
  if (p.levelm > 15 && p.skillm > 15) { disp.sln('  `5(`#S`5)hatter                         `5(`%16`5)'); valid += 'S'; }
  if (p.levelm > 19 && p.skillm > 19) { disp.sln('  `5(`#M`5)ind Heal                       `5(`%20`5)'); valid += 'M'; }
  disp.sln('');
  disp.sw(`  \`5You Have \`%${p.levelm}\`5 Use Points.  Choose.  [\`#Nothing\`5] : `);

  const ch = await session.prompt('', valid.split('').concat(['\r']));
  if (!ch || ch === '\r') return false;

  if (ch === 'P') {
    if (p.levelm < 1) { disp.sln('  You need rest before your mind will be ready for this.'); return false; }
    disp.sln(`  \`0You whisper the word.  You smile as \`2${op.name}\`0 screams out in pain.`);
    let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
    atk = (atk * 2) - Math.floor((atk * 2) / 4);
    if (op.pfight) atk -= op.def;
    if (atk < 1) atk = 1;
    disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
    op.hp -= atk;
    if (op.hp > 0) await enemyAttack(session, disp, op);
    p.levelm -= 1;
  } else if (ch === 'D') {
    if (p.levelm < 4) { disp.sln('  You need rest.'); return false; }
    disp.sln('  You imagine yourself being in a different part of the forest...');
    disp.sln('  The next instant you are standing in a cool glade, nowhere near your enemy.');
    p.levelm -= 4;
    p.ran_away = true;
  } else if (ch === 'H') {
    if (p.levelm < 8) { disp.sln('  You need rest.'); return false; }
    disp.sln(`  \`0Your face contorts in anger.  The air in front of you begins to shimmer.`);
    disp.sln(`  A few seconds later, \`2${op.name}\`0 is engulfed by flames.`);
    let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
    atk = (atk * 2) + Math.floor((atk * 2) / 4);
    op.hp -= atk;
    disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
    if (op.hp > 0) await enemyAttack(session, disp, op);
    p.levelm -= 8;
  } else if (ch === 'L') {
    if (p.levelm < 12) { disp.sln('  You need rest.'); return false; }
    disp.sln('  `0A beam of light covers your face.  You are still glowing.');
    p.light_shield = true;
    p.levelm -= 12;
  } else if (ch === 'S') {
    if (p.levelm < 16) { disp.sln('  You need rest.'); return false; }
    disp.sln(`  \`0You visualize the bones in your enemy, then imagine them imploding.`);
    disp.sln(`  \`2${op.name}\`0 pierces the air with a scream of horror.`);
    let atk = rand(Math.floor(p.str / 2)) + Math.floor(p.str / 2);
    atk = (atk * 4) + Math.floor((atk * 4) / 4);
    op.hp -= atk;
    disp.sln(`\`2You hit \`0${op.name}\`2 for \`0${pretty(atk)} \`2damage!`);
    if (op.hp > 0) await enemyAttack(session, disp, op);
    p.levelm -= 16;
  } else if (ch === 'M') {
    if (p.levelm < 20) { disp.sln('  You need rest.'); return false; }
    disp.sln('  `0With an inhuman scream, you will yourself to be healed.');
    disp.sln('  `%YOU ARE HEALED.`2');
    p.hp = p.hp_max;
    p.levelm -= 20;
  }
  return true;
}

// ── Try running (lord.js try_running) ────────────────────────────────────

async function tryRunning(session, disp, op, cantRun) {
  const p = session.player;
  if (cantRun || op.is_arena) {
    disp.sln('  You cannot run from this fight!');
    return false;
  }
  if (rand(9) === 1) {
    disp.sln('');
    disp.sln(`\`0${op.name} \`2sees you!`);
    await enemyAttack(session, disp, op);
    return false;
  }
  p.ran_away = true;
  disp.sln('');
  disp.sln('  `2You barely manage to escape!');
  return true;
}

// ── Show battle prompt (lord.js battle_prompt) ────────────────────────────

function showBattlePrompt(disp, p, op) {
  disp.sln('');
  disp.sln(`\`2Your Hitpoints : \`0${pretty(p.hp)}`);
  disp.sln(`\`2${op.name}\`2's Hitpoints : \`0${pretty(op.hp)}`);
  disp.sln('');
  disp.sln('  `2(`5A`2)ttack');
  disp.sln('  (`5S`2)tats');
  disp.sln('  (`5R`2)un');

  // Class skills
  if (p.levelw > 0 || p.levelm > 0 || p.levelt > 0) disp.sln('');
  if (p.levelw > 0) disp.sln(`  \`2(\`0D\`2)\`0eath Knight Attack (\`%${p.levelw}\`0)`);
  if (p.levelm > 0) disp.sln(`  \`2(\`0M\`2)\`0ystical Skills     (\`%${p.levelm}\`0)`);
  if (p.levelt > 0) disp.sln(`  \`2(\`0T\`2)\`0hieving Skills     (\`%${p.levelt}\`0)`);

  disp.sln('');
  disp.sw(`\`2Your command, \`0${p.name}\`2?  [\`5A\`2] : `);
}

// ── Level-up check (lord.js tournament_check / level logic) ───────────────

async function checkLevelUp(session, disp) {
  const p = session.player;
  if (p.level >= 12) return;

  const needed = level_exp[p.level]; // exp needed for next level
  if (p.exp < needed) return;

  p.level += 1;
  // HP and str gains based on class (ported from lord.js level-up block)
  const hpGain  = p.level * 5 + rand(p.level * 3);
  const strGain = p.level + rand(p.level);
  p.hp_max = clamp(p.hp_max + hpGain, 0, 32000);
  p.hp     = p.hp_max; // healed on level up
  p.str    = clamp(p.str    + strGain, 0, 32000);

  // Give class skill points on level
  if (p.clss === 1) { p.skillw = clamp(p.skillw + p.level, 0, 32000); p.levelw = clamp(p.levelw + 1, 0, 32000); }
  if (p.clss === 2) { p.skillm = clamp(p.skillm + p.level, 0, 32000); p.levelm = clamp(p.levelm + 1, 0, 32000); }
  if (p.clss === 3) { p.skillt = clamp(p.skillt + p.level, 0, 32000); p.levelt = clamp(p.levelt + 1, 0, 32000); }

  session.clearScreen();
  disp.sln('');
  disp.sln('');
  disp.sln(`\`%                    ** YOU ARE NOW LEVEL ${p.level}! **`);
  disp.sln('');
  disp.sln(`\`2You gain \`%${pretty(hpGain)} \`2hit points.`);
  disp.sln(`\`2You gain \`%${pretty(strGain)} \`2strength.`);
  disp.sln('');
  disp.sln(`\`2HP Max is now \`%${pretty(p.hp_max)}\`2.`);
  disp.sln(`\`2Strength is now \`%${pretty(p.str)}\`2.`);
  disp.sln('');
  await session.more();

  // Persist
  PlayerDB.patch(p.id, {
    level: p.level, hp: p.hp, hp_max: p.hp_max, str: p.str,
    skillw: p.skillw, levelw: p.levelw,
    skillm: p.skillm, levelm: p.levelm,
    skillt: p.skillt, levelt: p.levelt,
  });
  session.player = PlayerDB.getById(p.id);
}

// ── Dead screen ──────────────────────────────────────────────────────────

async function deadScreen(session, disp, op) {
  session.clearScreen();
  disp.sln('');
  disp.sln(`\`4You have been killed by ${op.name}\`2.`);
  disp.sln('');
  await session.more();
  disp.sln('  `2GOLD ON HAND WAS `4LOST`2.');
  disp.sln('');
  disp.sln('  `2TEN PERCENT OF EXPERIENCE `4LOST`2.');
  disp.sln('');
  disp.sln('  You have been defeated on your way to glory.  The road to success');
  disp.sln('  is long and hard.  You have encountered a minor setback.  But do `0NOT`2');
  disp.sln('  lose heart, you can continue your struggle tomorrow.');
  disp.sln('');
  await session.more();
}

// ── Main battle loop (lord.js battle()) ───────────────────────────────────

async function battle(session, op, opts = {}) {
  const { cantRun = false, isPvP = false } = opts;
  const disp = Display.forSession(session);
  const p    = session.player;

  // Surprise check (1-in-10 chance enemy strikes first)
  const surprise = (rand(99) + 1) > 90;
  if (isPvP && op.level > p.level && rand(100) > 60) {
    // In pvp, higher-level opponent more likely to surprise
    disp.sln(`  \`0${op.name} \`2surprises you.`);
    await enemyAttack(session, disp, op);
  } else if (surprise && !isPvP) {
    disp.sln(`  \`0${op.name} \`2surprises you.`);
    await enemyAttack(session, disp, op);
  } else {
    disp.sln('  Your skill allows you to get the first strike!');
  }

  p.ran_away    = false;
  p.light_shield = false;

  // ── Combat loop ─────────────────────────────────────────────────────────
  while (session.alive && !p.dead && p.hp > 0 && op.hp > 0 && !p.ran_away) {
    showBattlePrompt(disp, p, op);

    let ch = await session.getKeyUpper();
    if (!ch || !session.alive) return 'lose';
    if (ch === '\r') ch = 'A';

    disp.sw(ch);

    switch (ch) {
      case 'A':
        await doAttack(session, disp, op);
        break;
      case 'R':
        if (await tryRunning(session, disp, op, cantRun)) {
          // escaped
        }
        break;
      case 'S':
        // Stats shown inline
        disp.sln('');
        disp.sln(`\`2HP: \`%${pretty(p.hp)}\`2/\`%${pretty(p.hp_max)}`);
        disp.sln(`\`2STR: \`%${pretty(p.str)}  \`2DEF: \`%${pretty(p.def)}`);
        break;
      case 'D':
        if (p.levelw < 1) {
          disp.sln('');
          disp.sln(p.skillw < 1 ? "  You don't know any at the moment!" : '  You will need rest before you can use those again.');
          disp.sln('');
        } else {
          await useDK(session, disp, op);
        }
        break;
      case 'M':
        if (p.levelm < 1) {
          disp.sln('');
          disp.sln(p.skillm < 1 ? "  You don't know any at the moment!" : '  You will need rest before you can use those again.');
          disp.sln('');
        } else {
          await useMystical(session, disp, op);
        }
        break;
      case 'T':
        if (p.levelt < 1) {
          disp.sln('');
          disp.sln(p.skillt < 1 ? "  You don't know any at the moment!" : '  You will need rest before you can use those again.');
          disp.sln('');
        } else {
          await useThief(session, disp, op);
        }
        break;
      default:
        break;
    }
  } // end while

  p.ran_away    = false;
  p.light_shield = false;

  // ── Outcome ──────────────────────────────────────────────────────────────

  if (!session.alive) return 'lose';

  // Player ran
  if (p.ran_away) {
    PlayerDB.patch(p.id, { hp: Math.max(1, p.hp) });
    session.player = PlayerDB.getById(p.id);
    return 'ran';
  }

  // Player died
  if (p.dead || p.hp <= 0) {
    await deadScreen(session, disp, op);
    LogDB.add(`  \`0${p.name} \`2has been killed by \`0${op.name}\`2!`);
    const newExp  = clamp(p.exp - Math.floor(p.exp / 10), 0, 2000000000);
    PlayerDB.patch(p.id, { hp: 0, dead: true, gold: 0, exp: newExp, on_now: false });
    session.player = PlayerDB.getById(p.id);
    return 'lose';
  }

  // Player won
  disp.sln('');
  disp.sln(`  You have killed ${op.name}\`%!`);
  disp.sln('');

  const goldWon = Math.min(op.gold || 0, 2000000000 - p.gold);
  const expWon  = op.exp  || 0;

  if (goldWon > 0) {
    disp.sw(`\`2  You receive \`0${pretty(goldWon)} \`2gold, and`);
  } else {
    disp.sw("  You don't find any gold, but you do get");
  }
  disp.sln(`\`0 ${pretty(expWon)}\`2 experience!`);

  const newGold = clamp(p.gold + goldWon, 0, 2000000000);
  const newExp  = clamp(p.exp  + expWon,  0, 2000000000);

  PlayerDB.patch(p.id, { hp: Math.max(1, p.hp), gold: newGold, exp: newExp, gem: p.gem });
  session.player = PlayerDB.getById(p.id);

  disp.sln('');
  await session.more();

  // Level-up check
  await checkLevelUp(session, disp);

  return 'win';
}

module.exports = { battle, enemyAttack, doAttack, checkLevelUp, deadScreen, rand };
