'use strict';

/**
 * server/game/locations/Dragon.js
 *
 * Ported from lord.js fight_dragon() — lines 11919–12219
 * and attack_dragon() — lines 15088–15130
 */

const PlayerDB = require('../../db/PlayerDB');
const StateDB  = require('../../db/StateDB');
const LogDB    = require('../../db/LogDB');
const Display  = require('../text/Display');
const { battle, rand } = require('../systems/Battle');

function pretty(n) { return Math.floor(n).toLocaleString(); }

const SEP = '`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

function dragonStats() {
  return {
    name:      '`4The Red Dragon`2',
    str:       2000,
    hp:        15000,
    gold:      1000,
    weapon:    '`\`)Scorching Flame`2',
    exp:       1000,
    death:     '  The earth shakes as the mighty beast falls.',
    is_dragon: true,
  };
}

// ── Class-specific epilogue stories ────────────────────────────────────────

async function storyWarrior(session, disp) {
  const p = session.player;
  disp.sln('');
  disp.sln('`c                   `%EPILOGUE `2- `0The Warrior\'s Ending');
  disp.sln(SEP);
  disp.sln('  `2After your bloody duel with the huge Dragon, your first impulse is to rip');
  disp.sln('  its head off and bring it to town.  Careful thought reveals it is much too');
  disp.sln('  big for your horse, so that plan is moot.  You finally decide on the');
  disp.sln('  Dragon\'s heart.  After an hour\'s work, you have it in a gunny sack.');
  disp.sln('');
  await session.more();
  disp.sln('  `2Back in town the crowd grows into a multitude.  Barak challenges you from');
  disp.sln('  the back.  `0"How do we know where you got that thing?  Looks like you');
  disp.sln('  skinned a sheep!"');
  disp.sln('');
  disp.sln('  `0"Why Barak, would you doubt me?  A LEVEL 12 warrior?  If I am not mistaken,');
  disp.sln('  you are quite a bit lower, still at level two, eh?"');
  disp.sln('');
  disp.sln('  `2Barak gives you no more trouble, and you are declared a hero by all.');
  if (p.sex === 'M') {
    disp.sln('  `#Violet `2tops off the evening by giving you a kiss on the cheek.');
  } else {
    disp.sln('  `%Seth Able `2tops off the evening by giving you a kiss on the cheek.');
  }
  disp.sln('');
  await session.more();
}

async function storyThief(session, disp) {
  disp.sln('');
  disp.sln('`c                   `%EPILOGUE `2- `0The Thief\'s Ending');
  disp.sln(SEP);
  disp.sln('  `2You don\'t bother telling anyone about your great deed.  You simply take');
  disp.sln('  what gems and gold you can find in the lair, and vanish into the night.');
  disp.sln('');
  await session.more();
  disp.sln('  `2When you finally meet up at Turgon\'s, you share your story.  You can\'t help');
  disp.sln('  but be pleased at seeing so many faces in awe.  As you finish, a woman in');
  disp.sln('  the back cries out.');
  disp.sln('');
  disp.sln('  `0"That Thief is wearing the ring I gave my Ellie the last birthday before');
  disp.sln('  she disappeared!"`2');
  disp.sln('');
  disp.sln('  `2You decide now would be the perfect time to make your departure.');
  disp.sln('');
  await session.more();
}

async function storyMystic(session, disp) {
  const p = session.player;
  disp.sln('');
  disp.sln('`c                   `%EPILOGUE `2- `0The Mystic\'s Ending');
  disp.sln(SEP);
  disp.sln('  `2The death of the Dragon sends a mystical shockwave through the forest.');
  disp.sln('  The ancient evil that bound the creatures dissolves like morning fog.');
  disp.sln('');
  await session.more();
  disp.sln('  `2You stand in the town square the next morning and raise your hands.');
  disp.sln('');
  disp.sln('  `0"The Dragon is dead." `2you announce simply.');
  disp.sln('');
  disp.sln('  `2Silence — then erupting into the loudest cheer this town has ever heard.');
  if (p.sex === 'M') {
    disp.sln('  `#Violet `2finds you in the crowd and hugs you until you can\'t breathe.');
  } else {
    disp.sln('  `%Seth Able `2finds you in the crowd and lifts you off your feet.');
  }
  disp.sln('');
  await session.more();
}

async function story(session, disp) {
  const p = session.player;
  if      (p.clss === 1) await storyWarrior(session, disp);
  else if (p.clss === 3) await storyThief(session, disp);
  else                   await storyMystic(session, disp);
}

// ── Dragon win ───────────────────────────────────────────────────────────────

async function dragonWin(session, disp) {
  const p = session.player;

  disp.sln('');
  disp.sln('  `2You have defeated The Red Dragon!');
  disp.sln('');
  await session.more();

  session.clearScreen();
  disp.sln('');
  disp.sln('  `2You have defeated the Dragon, and saved the town.  Your stomach churns');
  disp.sln('  at the sight of stacks of clean white bones — Bones of small children.');
  disp.sln('');
  disp.sln('  THANKS TO YOU, THE HORROR HAS ENDED!');
  disp.sln('');

  LogDB.append(`\`%.  \`%${p.name} \`2has slain the \`4Red Dragon\`2 and become a hero.`);
  StateDB.setLatestHero(p.name);

  await session.more();
  await story(session, disp);

  disp.sln('`%             Thanks for being tough enough to win the game.');
  disp.sln('');
  disp.sln('`2                              -Seth Able');
  disp.sln('');
  await session.more();

  // Reset player to level 1, keep skills/cha/drag_kills
  const drag_kills  = (p.drag_kills  || 0) + 1;
  const newFights   = Math.min(15 + (p.kids || 0), 32000);

  PlayerDB.patch(p.id, {
    level:        1,
    hp_max:       20,
    hp:           20,
    weapon_num:   1,
    weapon:       'Stick',
    gold:         500,
    bank:         0,
    def:          1,
    str:          10,
    gem:          10,
    arm:          'Coat',
    arm_num:      1,
    dead:         0,
    inn:          0,
    exp:          10,
    forest_fights: newFights,
    pvp_fights:   5,
    flirted:      0,
    high_spirits: 1,
    drag_kills,
    seen_dragon:  0,
    time:         StateDB.get().days,
  });
  session.player = PlayerDB.getById(p.id);

  session.clearScreen();
  disp.sln('`c  `%YOU FEEL STRANGE.');
  disp.sln('');
  disp.sln('  `2Apparently, you have been sleeping.  You dust yourself off, and');
  disp.sln('  regain your bearings.  You feel like a new person!');
  disp.sln('');
  disp.sln('  `%YOUR CHARACTER HAS BEEN RESET.  But you keep:');
  disp.sln('  ALL SPECIAL SKILLS.');
  disp.sln('  CHARM.');
  disp.sln('  DRAGON KILL CREDIT.');
  disp.sln('');
  await session.more();
}

// ── Dragon loss ──────────────────────────────────────────────────────────────

async function dragonLoss(session, disp) {
  const p = session.player;
  session.clearScreen();
  disp.sln('');
  disp.sln('  `2The Dragon pauses to look at you, then snorts in a Dragon laugh, and');
  disp.sln('  delicately rips your head off, with the finesse only a Dragon well practiced');
  disp.sln('  in the art could do.');
  disp.sln('');
  LogDB.append(`\`2  The \`4Red Dragon \`2has killed \`5${p.name}\`2!`);
  PlayerDB.patch(p.id, { hp: 0, dead: 1, gold: 0 });
  session.player = PlayerDB.getById(p.id);
  await session.more();
}

// ── Lair screen ──────────────────────────────────────────────────────────────

function showLair(disp) {
  disp.sln('`c');
  disp.sln('');
  disp.sln('`%           ** THE RED DRAGON\'S LAIR **');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('`2  The stench of sulphur fills the air as you approach the cave mouth.');
  disp.sln('  Bones of the unfortunate litter the entrance — some alarmingly small.');
  disp.sln('  Deep inside you can hear heavy breathing... and a low, rumbling growl.');
  disp.sln('');
  disp.sln('  `2(`0A`2)ttack the Dragon!');
  disp.sln('  `2(`0R`2)eturn to the forest');
  disp.sln('');
}

// ── Entry point — called from Forest when level >= 12, S key ────────────────

async function enter(session) {
  const disp = Display.forSession(session);
  const p    = session.player;

  if (p.level < 12) {
    disp.sln('');
    disp.sln('  `2You are not yet ready to face the Dragon.');
    disp.sln('');
    await session.more();
    return;
  }

  if (p.seen_dragon) {
    disp.sln('');
    disp.sln('');
    disp.sln('  `2You are shaking so badly from your previous encounter,');
    disp.sln('  you deem it wise to wait and gather your strength!');
    disp.sln('');
    await session.more();
    return;
  }

  showLair(disp);

  while (session.alive) {
    disp.sw('  `2Your choice : ');
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);

    if (ch === 'R' || ch === 'Q' || ch === '\r') {
      disp.sln('');
      disp.sln('  `2You decide it would be wise to depart from this wicked place.');
      disp.sln('');
      await session.more();
      return;
    }

    if (ch !== 'A') {
      showLair(disp);
      continue;
    }

    // Mark seen_dragon immediately (prevents re-fight on carrier drop)
    PlayerDB.patch(p.id, { seen_dragon: 1 });
    session.player = PlayerDB.getById(p.id);

    disp.sln('');
    disp.sln('`%  **`4DRAGON ENCOUNTER`%**');
    disp.sln('');
    disp.sln('  `2The Red Dragon approaches.');
    disp.sln('');

    const result = await battle(session, dragonStats(), { cantRun: false });

    if (result === 'lose' || session.player.dead) {
      await dragonLoss(session, disp);
      return;
    }

    await dragonWin(session, disp);
    return;
  }
}

module.exports = { enter };
