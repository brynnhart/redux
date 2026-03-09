'use strict';

/**
 * server/game/locations/Forest.js
 *
 * Ported from lord.js forest() — lines 12220–15571
 *
 * Implements:
 *   Forest main menu (L/H/R/Q/V/?)
 *   look_to_kill()  — random events + monster fights
 *   Random forest events (old man, hag, gold, merry men, gem, stick, charm)
 *   rescue_the_princess() — the tower quest
 *   find_lost_gold()
 *   olivia()  — the bodyless woman (full encounter chain)
 *   forest_special() — weird event (gems from the angels)
 *
 * NOT implemented here (separate files):
 *   darkhorse_tavern() — requires horse
 *   healers()          — see Healer.js
 *   attack_dragon()    — see Dragon.js
 */

const PlayerDB   = require('../db/PlayerDB');
const StateDB    = require('../db/StateDB');
const LogDB      = require('../db/LogDB');
const Display    = require('../text/Display');
const { battle, rand } = require('../systems/Battle');
const { monster_stats, castles } = require('../data/constants');

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pretty(n)        { return n.toLocaleString(); }

function SEP(disp) {
  disp.sln('`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
}

// Select a monster appropriate to the player's level (lord.js look_to_kill mnum logic)
function pickMonster(level) {
  let mnum;
  if (level <= 1) {
    mnum = rand(10);
  } else if (rand(5) < 2) {
    mnum = ((level - 1) * 11) + rand(10);
  } else {
    mnum = (rand(level) * 11) + rand(10);
  }
  mnum = clamp(mnum, 0, monster_stats.length - 1);
  const m = { ...monster_stats[mnum] };
  return m;
}

// ── Forest header ──────────────────────────────────────────────────────────

function showForestMenu(session, disp) {
  session.clearScreen();
  disp.sln('`%Legend of the Red Dragon `0- `3The Forest`0');
  disp.sln('`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');
  disp.sln('`2The murky forest stands before you - a giant maw of gloomy darkness');
  disp.sln('ever beckoning.');
  disp.sln('');
  disp.sln('`2(`0L`2)ook for something to kill');
  disp.sln('`2(`0H`2)ealers hut');
  disp.sln('`2(`0R`2)eturn to town');
  disp.sln('');
}

function showForestPrompt(session, disp) {
  const p = session.player;
  disp.sw(`\`2HitPoints: (\`0${pretty(p.hp)} \`2of \`0${pretty(p.hp_max)}\`2)`);
  disp.sw(`\`2  Fights: \`0${pretty(p.forest_fights)}`);
  disp.sw(`\`2  Gold: \`0${pretty(p.gold)}`);
  disp.sw(`\`2  Gems: \`0${pretty(p.gem)}`);
  disp.sln('');
  disp.sln('`5The Forest   `2(L,H,R,Q)  `0(? for menu)`2');
  disp.sln('');
  disp.sw(`\`2Your command, \`%${p.name}\`2? [\`%${p.forest_fights}\`2] : `);
}

// ── Event header (shared by all random events) ────────────────────────────

function eventHeader(disp) {
  disp.sln('');
  disp.sln('');
  disp.sln('`%  Event In The Forest`0');
  SEP(disp);
  disp.sln('');
}

// ── Random forest events (lord.js look_to_kill cases 0–14) ────────────────

// Case 0 — lost old man
async function eventOldManLost(session, disp) {
  const p = session.player;
  eventHeader(disp);
  disp.sln('`2  You come across an old man.  He seems confused and asks if');
  disp.sln('  you would direct him to the Inn.  You know that if you do,');
  disp.sln('  you will lose time for one fight today.');
  disp.sln('');
  disp.sw('  Do you take the old man? [`0Y`2] : ');
  const ch = await session.prompt('', ['Y', 'N', '\r']);
  const took = (ch !== 'N');
  disp.sln(took ? 'Y' : 'N');
  disp.sln('');
  if (took) {
    const gold = p.level * 500;
    p.gold = clamp(p.gold + gold, 0, 2000000000);
    p.cha  = clamp(p.cha + 1, 0, 32000);
    p.forest_fights -= 1;
    disp.sln(`\`2  You gladly take the old man to the Inn. He is pleased`);
    disp.sln(`\`2  with you, and gives you \`%${pretty(gold)} \`2gold!`);
    disp.sln('');
    disp.sln('  `%**CHARM GOES UP BY 1**');
  } else {
    disp.sln('  `2"I don\'t have time for you old man..Goodbye.."');
    disp.sln('  You tell him coldly.  The old man shakes his head very sadly.');
  }
  disp.sln('');
  await session.more();
}

// Case 1 — ugly hag (gem for healing)
async function eventHag(session, disp) {
  const p = session.player;
  eventHeader(disp);
  if (p.hp === p.hp_max) {
    disp.sln('`2  You come across an ugly old hag.  `5"Give me a gem!  You won\'t be sorry');
    disp.sln('  my pet!"`2 she screeches.');
  } else {
    disp.sln('`2  You come across an ugly old hag.  `5"Give me a gem and I will completely');
    disp.sln('  heal you warrior!"`2 she screeches.');
  }
  disp.sln('');
  disp.sw('  Give her the gem? [`0N`2] : ');
  const ch = await session.prompt('', ['Y', 'N', '\r']);
  const gave = (ch === 'Y');
  disp.sln(gave ? 'Y' : 'N');
  disp.sln('');
  if (gave) {
    if (p.gem < 1) {
      disp.sln('  `5"You have no gems, fool!"`2  the old woman screams at you.  She then');
      disp.sln('   hits you in a sensitive spot with her cane, and you feel VERY weak.');
      p.hp = 1;
    } else {
      p.gem -= 1;
      disp.sln('  You give her a gem.  She waves her wand strangely.');
      disp.sln('');
      disp.sln('  `%YOU FEEL BETTER');
      if (p.hp < p.hp_max) {
        p.hp = p.hp_max;
      } else {
        p.hp_max += 1;
      }
    }
  } else {
    disp.sln('  `5"Hurumph!" `2 the old woman grunts sourly as you leave.');
  }
  disp.sln('');
  await session.more();
}

// Case 2 — gold sack
async function eventGoldSack(session, disp) {
  const p   = session.player;
  const amt = (rand(500) + 250) * p.level * p.level;
  eventHeader(disp);
  disp.sln(`\`2  You find a sack with \`%${pretty(amt)} \`2gold in it!`);
  p.gold = clamp(p.gold + amt, 0, 2000000000);
  disp.sln('');
  await session.more();
}

// Case 3 — merry men
async function eventMerryMen(session, disp) {
  const p = session.player;
  eventHeader(disp);
  disp.sln('`2  You stumble upon a group of Merry Men!  After partying with them');
  disp.sln('  for 2 hours you feel totally refreshed.');
  p.hp = p.hp_max;
  disp.sln('');
  await session.more();
}

// Case 4 — free gem
async function eventGem(session, disp) {
  const p = session.player;
  eventHeader(disp);
  disp.sln('`2  Fortune smiles, and you find a gem!');
  p.gem = clamp(p.gem + 1, 0, 32000);
  disp.sln('');
  await session.more();
}

// Case 5 — hammer stone or flower garden (simplified)
async function eventHammerStone(session, disp) {
  const p = session.player;
  eventHeader(disp);
  disp.sln('`2  You find a `%Hammer Stone`2!');
  disp.sln('');
  await session.more();
  disp.sln(`\`2  As is the tradition, you break it in two with your`);
  disp.sln(`\`0  ${p.weapon}\`2. Your weapon tingles!`);
  disp.sln('');
  disp.sln('  `%ATTACK STRENGTH RAISED.');
  p.str = clamp(p.str + 1, 0, 32000);
  disp.sln('');
  await session.more();
}

// Case 7 — ugly/pretty stick (charm event) — matches lordweirdevent.png
async function eventStick(session, disp) {
  const p   = session.player;
  const tmp = rand(2) + 1;
  session.clearScreen();
  disp.sln('');
  disp.sln('');
  disp.sln('  `%MEGA EVENT IN THE FOREST');
  SEP(disp);
  if (rand(3) === 1) {
    disp.sln('`2  You are whacked with a pretty stick by an old man!');
    disp.sln('');
    disp.sln('  He giggles and runs away!');
    disp.sln('');
    disp.sln(`  \`%YOU GET ${tmp} CHARM!`);
    p.cha = clamp(p.cha + tmp, 0, 32000);
  } else {
    disp.sln('`2  You are wacked with an `4ugly`2 stick by an old man!');
    disp.sln('');
    disp.sln('`2  He giggles and runs away!');
    disp.sln('');
    disp.sln(`  \`4YOU LOSE ${tmp} CHARM!`);
    p.cha = clamp(p.cha - tmp, 0, 32000);
  }
  disp.sln('');
  await session.more();
}

// Case 8 — horse trader (only if player has gold, no horse required)
async function eventHorseTrader(session, disp) {
  const p   = session.player;
  const price = p.level * 10000;
  session.clearScreen();
  eventHeader(disp);
  disp.sln('`2  Walking through the forest, you stumble across a clearing in the woods.');
  disp.sln('  Looking around, you see a small man and a lot of horses.  The man walks up');
  disp.sln('  to you and asks you, "`0What can I do for you, mmhmm?`2"');
  disp.sln('');
  disp.sln('`2  (`0B`2)uy a horse');
  if (p.horse) disp.sln('`2  (`0S`2)ell your horse');
  disp.sln('`2  (`0G`2)o back to the forest');
  disp.sln('');
  disp.sw('  `0Your command `2[`0GBS`2] : ');

  const valid = p.horse ? ['G','B','S','\r'] : ['G','B','\r'];
  const ch    = await session.prompt('', valid);
  disp.sln(ch || 'G');
  disp.sln('');

  if (ch === 'B') {
    if (p.horse) {
      disp.sln('`2  You already have a horse.');
    } else if (p.gold < price) {
      disp.sln(`\`2  "Sorry, the horse costs \`%${pretty(price)}\`2 gold," the man says.`);
      disp.sln('  You cannot afford it.');
    } else {
      p.gold  -= price;
      p.horse  = true;
      disp.sln(`\`2  You buy a fine horse for \`%${pretty(price)}\`2 gold!`);
      disp.sln('  With a horse, you can ride to the DarkCloak Tavern in the forest.');
    }
  } else if (ch === 'S' && p.horse) {
    p.gold += Math.floor(price / 2);
    p.horse  = false;
    disp.sln('`2  You sell your horse.');
  } else {
    disp.sln('`2  You head back into the forest.');
  }
  disp.sln('');
  await session.more();
}

// Case 9 — find lost gold
async function eventFindLostGold(session, disp) {
  const p     = session.player;
  const state = StateDB.get();
  const left  = Math.max(100, Math.floor(p.gold / 15));
  let   found = state.forest_gold || 100;
  if (found < 100) found = 100;
  found = Math.min(found, 2000000000 - p.gold);

  StateDB.patch({ forest_gold: left });

  session.clearScreen();
  eventHeader(disp);
  disp.sln(`\`2  Fortune smiles, and you find \`%${pretty(found)} \`2gold!`);
  p.gold = clamp(p.gold + found, 0, 2000000000);
  disp.sln('');
  await session.more();
}

// ── forest_special — weird event (lord.js forest_special) ─────────────────

async function forestSpecial(session, disp) {
  const p = session.player;
  session.clearScreen();
  disp.sln('');
  disp.sln('`%** WEIRD EVENT **');
  SEP(disp);
  disp.sln('`0  You are heading into the forest, when you hear the voice of');
  disp.sln('  angels singing.');
  disp.sln('');
  await session.more();
  disp.sln('  You follow the sound for some time - when you are about to give');
  disp.sln('  up...');
  disp.sln('');
  await session.more();

  const g = rand(p.level) + 1;
  disp.sw('  `2You find.');
  await new Promise(r => setTimeout(r, 200));
  disp.sw('.');
  await new Promise(r => setTimeout(r, 200));
  disp.sw('.');
  disp.sln(g > 1 ? ` ${g} Gems!` : ' 1 Gem!');
  disp.sln('');
  p.gem   = clamp(p.gem + g, 0, 32000);
  p.weird = false;
  await session.more();
}

// ── Rescue the princess (lord.js rescue_the_princess) ─────────────────────

async function rescuePrincess(session, disp) {
  const p       = session.player;
  const which   = StateDB.get().which_castle || (rand(5) + 1);
  const him     = p.sex === 'M' ? 'her' : 'him';
  const lad     = p.sex === 'M' ? 'girl' : 'lad';

  session.clearScreen();
  disp.sln('');
  disp.sln('');
  disp.sln('`%                         FOREST EVENT');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('');

  if (p.done_tower) {
    disp.sln('`2  Sure enough.  Another dead bird with a scroll.');
    disp.sln('');
  } else {
    disp.sln('`2  This would normally not be noted, since this happens all the');
    disp.sln('  time - but what is interesting here is WHAT you stumbed over.');
    disp.sln('');
    await session.more();
    disp.sln('`2  The object in question is a large dead bird.  Its stink is great.');
    disp.sln('');
    disp.sln('`2  But the bird has a small scroll carefully tied to one leg.');
    disp.sln('');
  }

  await session.more();

  // The scroll
  disp.sln('`%  THE SCROLL READS:');
  disp.sln('');
  switch (rand(3)) {
    case 0:
      disp.sln('`7  Dear whomever:');
      disp.sln('');
      disp.sln('  My ruthless uncle has trapped me in his castle.  He is angered');
      disp.sln('  because I will not submit to him - in the way that he wants me to.');
      disp.sln('');
      disp.sln('  Please come save me,');
      disp.sln('        -Sleepless in a tower');
      break;
    case 1:
      disp.sln('`7  Dear Brave Heart:');
      disp.sln('');
      disp.sln('  I am to wed one against my will.  My father tells me I am');
      disp.sln("  selfish, because this political marriage will bring peace.");
      disp.sln('');
      disp.sln('  Get me out of here,');
      disp.sln('        -a prisoner of war');
      break;
    case 2:
      disp.sln('`7  To whom it may concern:');
      disp.sln('');
      disp.sln("  Geez am I bored.  I've been locked in the highest peak");
      disp.sln("  of this castle for an ever so long time.  Ok, I'm up here because I wa..");
      disp.sln('');
      disp.sln("  The note isn't signed.");
      break;
  }

  disp.sln('');
  disp.sln('`%  You quickly swipe a tear from your eye as you put down the note.');
  disp.sln('');
  await session.more();

  disp.sln(`\`2  (\`0S\`2)ave ${him}`);
  disp.sln(`\`2  (\`0I\`2)gnore the ${lad}`);
  disp.sln('');
  disp.sw(`\`2  Well? [\`%S\`2] \`8: \`%`);

  const ch = await session.prompt('', ['S', 'I', '\r']);
  if (ch === 'I') {
    disp.sln('I');
    disp.sln('');
    disp.sln("  You look at the note a moment - then blithely toss it in a");
    disp.sln("  nearby creek.  You skip away merrily! (evil can be fun!)");
    disp.sln('');
    await session.more();
    return;
  }
  disp.sln('S');
  disp.sln('');

  // Castle selection
  disp.sln("  `0You're quite a hero.  Unfortunately, the girl seems to have");
  disp.sln("  forgotten the return address.  You'll have to guess.");
  disp.sln('');
  disp.sln('`2  (`0C`2)astle Coldrake');
  disp.sln('`2  (`0F`2)ortress Liddux');
  disp.sln('`2  (`0G`2)annon Keep');
  disp.sln('`2  (`0P`2)enyon Manor');
  disp.sln("  (`0D`2)ema's Lair");
  disp.sln('');
  disp.sw('  Where do we go now? `8: `%');

  const castleKey = await session.prompt('', ['C','F','G','P','D']);
  const castleIdx = ['C','F','G','P','D'].indexOf(castleKey) + 1;
  disp.sln(castleKey);
  disp.sln('');
  disp.sln(`\`2  You set your jaw resolutely and journey to \`%${castles[castleIdx]}\`2.`);
  disp.sln('');
  await session.more();

  // The rescue
  session.clearScreen();
  disp.sln('');
  disp.sln('');
  disp.sln('`%                         THE RESCUE');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  p.done_tower = true;
  disp.sln('  `%THE DOOR SWINGS WIDE OPEN!');
  disp.sln('');
  await session.more();

  if (castleIdx === which) {
    // Right castle — reward
    StateDB.patch({ which_castle: rand(5) + 1 });
    const expReward = p.level * p.level * 20;
    const gemReward = 3 * p.level;

    disp.sln(`  \`0"You've come for me!" \`2shouts an overjoyed (and darn good looking) ${lad}.`);
    disp.sln('');
    disp.sln('  `2You breathe a sigh of relief.  This was the right place.');
    disp.sln('');
    if (p.sex === 'M') {
      disp.sln('  `2The girl eyes you dreamily.  `0"I can never repay you, and I.."');
      disp.sln('');
      disp.sln('  `%"Oh but you can.  Is that your bed?" `2you interrupt.');
      disp.sln('');
      await session.more();
      disp.sln(`\`2  ${pretty(p.cha)} minute${p.cha > 1 ? 's' : ''} later, you feel quite repaid.`);
      p.laid = clamp((p.laid || 0) + 1, 0, 32000);
    }
    disp.sln('');
    disp.sln(`  \`0YOU GET \`%${pretty(expReward)} \`0EXPERIENCE.`);
    p.exp = clamp(p.exp + expReward, 0, 2000000000);
    disp.sln('');
    await session.more();
    disp.sln('');
    disp.sln(`  \`0YOU GET \`%${pretty(gemReward)} \`0GEMS FOR YOUR TROUBLE.`);
    p.gem = clamp(p.gem + gemReward, 0, 32000);
    disp.sln('');
    LogDB.add(`  \`0${p.name} \`2saved a ${p.sex === 'M' ? 'princess' : 'prince'} today!`);
  } else {
    // Wrong castle
    switch (rand(2)) {
      case 0:
        disp.sln('  `2The room is empty, save a giant chest in the middle.');
        p.hp = Math.max(1, Math.floor(p.hp / 4));
        disp.sln('');
        disp.sln('  `%"Hello?  Anybody home?" `2you call softly.');
        disp.sln('');
        disp.sln('  A voice answers - from the chest.');
        disp.sln('');
        await session.more();
        disp.sln('  `0"Help me!  I\'m in here!"');
        disp.sln('');
        disp.sln('  `4YOU WEAKLY CRAWL AWAY SOMETIME LATER.');
        break;
      case 1:
        if (p.sex === 'M') {
          disp.sln('  `2You see two beautiful women playing chess.');
          disp.sln('');
          disp.sln('  `%"Hello, ladies.  Which one of you needs rescuing?" `2you ask politely.');
        } else {
          disp.sln('  `2You see two handsome men playing chess.');
          disp.sln('');
          disp.sln('  `%"Hello, boys.  Which one of you needs rescuing?" `2you ask politely.');
        }
        disp.sln('');
        await session.more();
        disp.sln('  `0"Neither!" `2they chime.');
        disp.sln('');
        disp.sln(`  \`2You scratch your chin in confusion.  \`%"So where is the damn ${p.sex === 'M' ? 'damsel' : "stinkin' prince"}`);
        disp.sln('  in distress?!"');
        disp.sln('');
        await session.more();
        disp.sln(`  \`0At this moment, a messenger bursts through the broken doorway.`);
        disp.sln('');
        disp.sln(`  \`5"My friends, I bear terrible news - \`%${castles[castleIdx]}\`5 has been`);
        disp.sln('  attacked.  Your father the King is dead." `2the messenger is now audibly sobbing.');
        disp.sln('');
        await session.more();
        disp.sln('  `%"Ah.  Yes.  Well, this is all very tragic, but I uh, need to be going." `2you');
        disp.sln('  stutter uncomfortably.');
        disp.sln('');
        if (p.sex === 'M') {
          disp.sln('  `2The now ashen white faced women look at you dumbfounded as you make your exit.');
        } else {
          disp.sln('  `2The now ashen white faced men look at you dumbfounded as you make your exit.');
        }
        LogDB.add(`  \`0${p.name} \`2showed courage today by trying to save a ${p.sex === 'M' ? 'princess' : 'prince'}.`);
        break;
    }
  }
  disp.sln('');
  await session.more();
}

// ── Olivia — the bodyless woman ────────────────────────────────────────────
// Simplified to first encounter + returning visits. Full encounter chain.

async function olivia(session, disp) {
  const p = session.player;

  if (p.asshole) {
    // She's angry — already kicked
    session.clearScreen();
    disp.sln('');
    disp.sln('`%  THE WAILING GROWS LOUDER.');
    disp.sln('');
    disp.sln('  You investigate - only to find a womans head on the ground.');
    disp.sln('');
    if (p.sex === 'M') {
      disp.sln('  `0"I see you, foolish boy.  Leave me alone!" `2the head screams savagely.');
    } else {
      disp.sln('  `0"I see you, foolish girl.  Leave me alone!" `2the head shouts.');
    }
    disp.sln('');
    disp.sln('  `2(`0A`2)pologize for what you did last time');
    disp.sln('  `2(`0P`2)lay some "head ball"');
    disp.sln('');
    disp.sw('  `2Well? [`0A`2] `2: `0');
    const ch = await session.prompt('', ['A', 'P', '\r']);
    disp.sln(ch || 'A');
    disp.sln('');

    if (ch === 'P') {
      // Fun mini-game outcomes
      switch (rand(3)) {
        case 0:
          disp.sln('  `2You are distracted by a huge spider.  In a smooth motion you pick up the head');
          disp.sln('  and throw it at the spider!');
          disp.sln('');
          await session.more();
          disp.sln('  `%THE EXCERCISE GIVES YOU STRENGTH FOR ANOTHER FOREST FIGHT!');
          p.forest_fights = clamp(p.forest_fights + 1, 0, 32000);
          break;
        case 1:
          disp.sln('  `2Seeing the fine texture of the heads hair and the rip in your garment,');
          disp.sln('  you decide to use her hair to mend the tear.');
          disp.sln('');
          disp.sln('  `%YOU FEEL SO CLEVER YOU GAIN THE STRENGTH FOR ANOTHER FOREST FIGHT!');
          p.forest_fights = clamp(p.forest_fights + 1, 0, 32000);
          break;
        case 2:
          disp.sln('  `4YOU FEEL SO WOEBEGONE YOU LOSE A FOREST FIGHT FOR TODAY.');
          p.forest_fights = Math.max(0, p.forest_fights - 1);
          break;
      }
    } else {
      // Apologize — always lose a fight
      const apologies = [
        '"I\'m very sorry, ma\'am.  I was a jerk."\n  `%She narrows her eyes at you.\n  `0"And I uh, think you are perfectly beheading.  I mean, becoming!"\n  `#"AWK!! GO DIE YOU PIECE OF <choking spasm>" `2she screams.\n  `4YOU FEEL SO WOEBEGONE YOU LOSE A FOREST FIGHT FOR TODAY.',
        '"Hey?  My old pal!  What are you doing in this \'neck\' of the woods?"\n  `%She narrows her eyes at you.\n  `0"Don\'t be mad!  Geez, time to try decapit..I mean, decaffinated!"\n  `#"GO EAT BUGS AND DIE, YOU HEARTLESS TROLL!" `2she screams.\n  `4YOU FEEL SO CRAPPY YOU LOSE A FOREST FIGHT FOR TODAY.',
      ];
      apologies[rand(2)].split('\n').forEach(l => disp.sln(l));
      p.forest_fights = Math.max(0, p.forest_fights - 1);
    }
    disp.sln('');
    await session.more();
    return;
  }

  if (!p.olivia) {
    // First encounter
    session.clearScreen();
    disp.sln('');
    disp.sln('`%  THE WAILING GROWS LOUDER');
    disp.sln('');
    disp.sln('`2  You catch a glimpse of something moving in the mouth of the cave.');
    disp.sln('');
    disp.sln('  `2(`0I`2)nvestigate further');
    disp.sln('  `2(`0G`2)et smart and leave it alone');
    disp.sln('');
    disp.sw('  `2Well? [`0I`2] : `0');
    const ch = await session.prompt('', ['I', 'G', '\r']);
    disp.sln(ch || 'I');
    disp.sln('');
    if (ch === 'G') {
      disp.sln('  `2You hurry away from this evil place.');
      disp.sln('');
      await session.more();
      return;
    }
    disp.sln('  You slowly make your way inside the damp cave.');
    disp.sln('');
    disp.sln('  `4YOU TRIP OVER SOMETHING!');
    disp.sln('');
    await session.more();
    disp.sln('  `2You blindly reach down `8- `2your fingers find something wet `8- `2You have');
    disp.sln('  put your hand inside the mouth of a severed head.  `0You scream like a child!');
    disp.sln('');
    await session.more();
    disp.sln('  `#"Oh, do shut up!" `2the head implores you, scowling.');
    disp.sln('');
    if (p.sex === 'M') disp.sln('  `2You stare at the head in shock.  (which really isn\'t bad looking)');
    else               disp.sln('  `2You stare at the head in shock.');
    disp.sln('');
    disp.sln('  `2(`0A`2)sk the head who she is');
    disp.sln('  `2(`0B`2)oot her a distance');
    disp.sln('');
    disp.sw('  `2After careful consideration you.. [`0A`2] `8: `%');
    const ch2 = await session.prompt('', ['A', 'B', '\r']);
    disp.sln(ch2 || 'A');
    disp.sln('');
    if (ch2 === 'B') {
      disp.sln('  `0"C\'mere you freak of nature!" `2you taunt, grabbing her by the hair.');
      disp.sln('');
      disp.sln('  `#"NooOoooOooo!" `2she screams as you toss her deep into the underbrush.');
      disp.sln('');
      p.asshole = true;
    } else {
      p.olivia = true;
      p.olivia_count = 0;
      disp.sln('  `2"I am Olivia," the head says.  "I... have had better days."');
      disp.sln('');
      disp.sln('  `2She tells you a remarkable tale about her body being stolen.');
      disp.sln('');
    }
    await session.more();
    return;
  }

  // Returning visit
  session.clearScreen();
  disp.sln('');
  disp.sln('`%  WAIT A SEC!');
  disp.sln('');
  disp.sln('  `2It\'s just your old pal `%Olivia `2the bodyless woman.');
  disp.sln('');

  const count = p.olivia_count || 0;
  const greetings = [
    '  `0"I was wondering if you were coming back," `2she informs you.',
    '  `0"You want more information I suppose." `2she says rather sadly.',
    '  `0"Life is worthless, I am worthless." `2she drones.',
    '  `0"I wish I had a friend.  You just use me." `2she rebukes.',
    '  `0"It\'s about time.  I do get bored you know," `2she scolds.',
    `  \`0"You're looking sharp today, ${p.name}\`0," \`2she complements.`,
    `  \`0"${p.name}\`0! I've missed you!" \`2she exclaims.`,
    `  \`0"Hello, ${p.name}\`0.  I'm glad you could visit."\`2 she smiles.`,
  ];
  disp.sln(greetings[Math.min(count, greetings.length - 1)]);
  disp.sln('');

  // Olivia's information service (costs 2 gems for player info)
  disp.sln('  `2(`0A`2)sk Olivia about a player  `5(costs 2 gems)');
  disp.sln('  `2(`0L`2)eave');
  disp.sln('');
  disp.sw('  `2What do you do? [`0L`2] : ');
  const och = await session.prompt('', ['A','L','\r']);
  disp.sln(och || 'L');
  disp.sln('');

  if (och === 'A') {
    if (p.gem < 2) {
      disp.sln('  `2"You don\'t have two gems," Olivia says apologetically.');
    } else {
      disp.sln('  `2"Who would you like to know about?" she asks.');
      disp.sln('');
      disp.sw('  `2Name: `%');
      const name = (await session.getStr(20)).trim();
      if (name) {
        const target = PlayerDB.findByName(name);
        if (!target) {
          disp.sln(`\`2  "I don't know anyone named ${name}," Olivia says.`);
        } else {
          p.gem -= 2;
          disp.sln(`\`2  "Ah yes, I know ${target.name}.\"`);
          disp.sln(`\`2  Fights with a \`0${target.weapon}\`2 and has strength of \`%${pretty(target.str)}\`2.`);
          disp.sln(`\`2  Wears a \`0${target.arm}\`2 and has defense of \`%${pretty(target.def)}\`2.`);
        }
      }
    }
    disp.sln('');
  }

  p.olivia_count = clamp(count + 1, 0, 25);
  await session.more();
}

// ── look_to_kill — the main fight/event dispatcher ────────────────────────

async function lookToKill(session, disp) {
  const p = session.player;
  session.clearScreen();

  // 1-in-5 chance of a random event instead of a fight
  if (rand(5) === 1) {
    switch (rand(15)) {
      case 0:  await eventOldManLost(session, disp);  break;
      case 1:  await eventHag(session, disp);         break;
      case 2:  await eventGoldSack(session, disp);    break;
      case 3:  await eventMerryMen(session, disp);    break;
      case 4:  await eventGem(session, disp);         break;
      case 5:  await eventHammerStone(session, disp); break;
      // case 6: class skill level-up events — TODO Healer/DK/Thief/Mystic
      case 7:  await eventStick(session, disp);       break;
      case 8:  await eventHorseTrader(session, disp); break;
      case 9:  await eventFindLostGold(session, disp); break;
      case 10: await rescuePrincess(session, disp);   break;
      case 11: await olivia(session, disp);           break;
      default:
        // Cases 12–14: fight anyway
        break;
    }

    // Persist state changes from the event
    PlayerDB.patch(p.id, {
      hp: p.hp, hp_max: p.hp_max, gold: p.gold, gem: p.gem, cha: p.cha,
      str: p.str, forest_fights: p.forest_fights, exp: p.exp,
      horse: p.horse ? 1 : 0,
      done_tower: p.done_tower ? 1 : 0,
      olivia: p.olivia ? 1 : 0,
      asshole: p.asshole ? 1 : 0,
      olivia_count: p.olivia_count || 0,
      laid: p.laid || 0,
    });
    session.player = PlayerDB.getById(p.id);
    return !p.dead;
  }

  // ── Monster fight ──────────────────────────────────────────────────────
  const enemy = pickMonster(p.level);

  session.clearScreen();
  disp.sln('');
  disp.sln('');
  disp.sln('  `2**`%FIGHT`2**');
  disp.sln('');
  disp.sln(`\`2  You have encountered \`0${enemy.name}\`2!!`);
  disp.sln('');

  // Decrement forest fights before battle (matches lord.js)
  p.forest_fights -= 1;
  PlayerDB.patch(p.id, { forest_fights: p.forest_fights });

  const result = await battle(session, enemy);

  // Log kill
  if (result === 'win') {
    session.player = PlayerDB.getById(p.id);
  } else if (result === 'lose') {
    // dead_screen already called inside battle()
    return false;
  }
  return true;
}

// ── Forest entry point (lord.js forest outer loop) ────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);
  let   p    = session.player;

  // Weird event check (gems from angels)
  if (p.weird) {
    await forestSpecial(session, disp);
    PlayerDB.patch(p.id, { weird: 0, gem: session.player.gem });
    session.player = PlayerDB.getById(p.id);
  }

  showForestMenu(session, disp);

  let over = false;
  while (!over && session.alive) {
    p = session.player = PlayerDB.getById(p.id);

    showForestPrompt(session, disp);

    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) break;

    disp.sln(ch);

    switch (ch) {
      case 'L':
        if (p.forest_fights < 1) {
          disp.sln('');
          disp.sln('');
          disp.sln('  You are too tired.');
          disp.sln('');
          disp.sln('  Try again tomorrow.');
          disp.sln('');
          await session.more();
        } else {
          const alive = await lookToKill(session, disp);
          if (!alive) {
            over = true;
            break;
          }
          showForestMenu(session, disp);
        }
        break;

      case 'H':
        await require('./Healer').enter(session);
        showForestMenu(session, disp);
        break;

      case 'V':
      case 'S': {
        // View stats inline
        const pp = session.player;
        disp.sln('');
        disp.sln(`\`2HP: \`%${pretty(pp.hp)}\`2/\`%${pretty(pp.hp_max)}  \`2Gold: \`%${pretty(pp.gold)}  \`2Gems: \`%${pretty(pp.gem)}`);
        disp.sln(`\`2STR: \`%${pretty(pp.str)}  \`2DEF: \`%${pretty(pp.def)}`);
        disp.sln('');
        break;
      }

      case '?':
        showForestMenu(session, disp);
        break;

      case 'R':
      case 'Q':
      case '\r':
        over = true;
        break;

      default:
        break;
    }
  }
}

module.exports = { enter };
