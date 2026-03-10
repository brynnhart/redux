'use strict';

/**
 * server/game/locations/Turgons.js
 *
 * Ported from lord.js turgons() line 15572, raise_class() line 10578,
 * and choose_profession() line 4837.
 *
 * Keys:
 *   (Q)uestion your Master  — master speaks his level-flavoured monologue;
 *                             tells you how much EXP you still need if not ready
 *   (A)ttack your Master    — fight the master; win → level up + class skill raise
 *   (V)iew Heroes           — ranked list of dragon-slayers
 *   (R/Q) Return
 *
 * Level 12+ players: Turgon greets them as ultimate warriors and sends
 *   them to find the Red Dragon.  No fight menu.
 *
 * Losing to master: you are NOT dead — healed back to full, just seen_master=true.
 * Winning: hp_max += hp_gained, hp full, str += str_gained, def += def,
 *   level++, class skill raised via raiseClass().
 *
 * seen_master resets daily (already in PlayerDB.resetDaily).
 */

const Display      = require('../text/Display');
const { getPronouns, cap } = require('../utils/pronouns');
const PlayerDB     = require('../../db/PlayerDB');
const LogDB        = require('../../db/LogDB');
const { showStats }  = require('../ShowStats');
const { battle }     = require('../systems/Battle');
const { trainer_stats } = require('../data/constants');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

// ── Persist helper ────────────────────────────────────────────────────────

function persist(session, fields) {
  PlayerDB.patch(session.player.id, fields);
  session.player = PlayerDB.getById(session.player.id);
}

// ── Level flavour text (from 4horslrd/lordtxt.lrd @#LEVEL<n><SEX> sections) ─

const LEVEL_TEXT = {
  '1MALE'  : [`  \`2"\`0Hi there.  Although I may not look muscular, I ain't all`,
              `  that weak.  You cannot advance to another Master until you`,
              `  can best me in battle.  I don't really have any advice`,
              `  except wear a groin cup at all times.  I learned the hard`,
              `  way.\`2"`],
  '1FEMALE': [`  \`2"\`0Hi there.  Although I may not look muscular, I ain't all`,
              `  that weak.  You cannot advance to another Master until you`,
              `  can best me in battle.  I don't really have any advice`,
              `  except wear a groin cup at all times.  I learned the hard`,
              `  way.\`2"`],
  '2MALE'  : [`  \`2"\`0You are now level two and a respected warrior.`,
              `  Try talking to the Bartender, he will see you now.  He`,
              `  is a worthy asset... Remember, your ultimate goal is`,
              `  to reach Ultimate Warrior status, which is level twelve.\`2"`],
  '2FEMALE': [`  \`2"\`0You are now level two and a respected warrior.`,
              `  Try talking to the Bartender, he will see you now.  He`,
              `  is a worthy asset... Remember, your ultimate goal is`,
              `  to reach Ultimate Warrior status, which is level twelve.\`2"`],
  '3MALE'  : [`  \`2"\`0You are now level three, and you are actually becoming`,
              `  well known in the realm.  I heard your name being mentioned`,
              `  by Violet.... Ye Gods she's hot....\`2"`],
  '3FEMALE': [`  \`2"\`0You are now level three, and you are actually becoming`,
              `  well known in the realm.  I heard your name being mentioned`,
              `  by Seth Able the Bard.... He might even like you....\`2"`],
  '4MALE'  : [`  \`2"\`0You are now level four.  But don't get cocky - There`,
              `  are many in the realm that could kick your...  Nevermind,`,
              `  I'm just not good at being insperational.\`2"`],
  '4FEMALE': [`  \`2"\`0You are now level four.  But don't get cocky - There`,
              `  are many in the realm that could kick your...  Nevermind,`,
              `  I'm just not good at being insperational.\`2"`],
  '5MALE'  : [`  \`2"\`0You are now level five..Not bad...Not bad at all..`,
              `  I am called Sandtiger - Because.. Actually I can't`,
              `  remember why people call me that.  Oh - Don't pay attention`,
              `  to that stupid bartender - I could make a much better one.\`2"`],
  '5FEMALE': [`  \`2"\`0You are now level five..Not bad...Not bad at all..`,
              `  I am called Sandtiger - Because.. Actually I can't`,
              `  remember why people call me that.  Oh - Don't pay attention`,
              `  to that stupid bartender - I could make a much better one.\`2"`],
  '6MALE'  : [`  \`2"\`0You are level six!  Vengeance is yours!`,
              `  You can now beat up on all those young punks that made`,
              `  fun of you when you were level 1.  This patch?  Oh - I`,
              `  lost my eye when I fell on my sword after tripping`,
              `  over a gopher.  If you tell anyone this, I'll hunt you`,
              `  down.\`2"`],
  '6FEMALE': [`  \`2"\`0You are level six!  Vengeance is yours!`,
              `  You can now beat up on all those young punks that made`,
              `  fun of you when you were level 1.  This patch?  Oh - I`,
              `  lost my eye when I fell on my sword after tripping`,
              `  over a gopher.  If you tell anyone this, I'll hunt you`,
              `  down.\`2"`],
  '7MALE'  : [`  \`2"\`0Even in my country,  you would be considered a good`,
              `  warrior.  But you have much to learn.  Remember to`,
              `  always respect your teachers, for it is right.\`2"`],
  '7FEMALE': [`  \`2"\`0You are growing powerful my daughter.`,
              `  You are a woman to be reckoned with now.  Remember,`,
              `  Trade your Gems with the bartender to further your`,
              `  ability.\`2"`],
  '8MALE'  : [`  \`2"\`0You are now level eight.  Remember, do not use your`,
              `  great strength in bullying the other warriors.  Do not`,
              `  be a braggart.  Be humble, and remember, honor is everything.\`2"`],
  '8FEMALE': [`  \`2"\`0You are now level eight.  Remember, do not use your`,
              `  great strength in bullying the other warriors.  Do not`,
              `  be a braggart.  Be humble, and remember, honor is everything.\`2"`],
  '9MALE'  : [`  \`2"\`0You are now level nine.  You have traveled far on the`,
              `  road of hardships,  but what doesn't kill you, only`,
              `  makes you stronger.  Never stop fighting.\`2"`],
  '9FEMALE': [`  \`2"\`0You are now level nine.  You have traveled far on the`,
              `  road of hardships,  but what doesn't kill you, only`,
              `  makes you stronger.  Never stop fighting.\`2"`],
  '10MALE' : [`  \`2"\`0You are now level ten.. A true honor!`,
              `  Do not stop now... You may be the one to rid the realm`,
              `  of the Red Dragon yet...  Only two more levels to go`,
              `  until you are the greatest warrior in the land.\`2"`],
  '10FEMALE':[`  \`2"\`0You are now level ten.. A true honor!`,
              `  Do not stop now... You may be the one to rid the realm`,
              `  of the Red Dragon yet...  Only two more levels to go`,
              `  until you are the greatest warrior in the land.\`2"`],
  '11MALE' : [`  \`2"\`0I am Turgon, son.  The greatest warrior in the realm.`,
              `  You are a great warrior, and if you best me, you must`,
              `  find and kill the Red Dragon.  I have every faith in you.\`2"`],
  '11FEMALE':[`  \`2"\`0I am Turgon, daughter.  The greatest warrior in the realm.`,
              `  You are a great warrior, and if you best me, you must`,
              `  find and kill the Red Dragon.  I have every faith in you.\`2"`],

  // Non-binary variants — same as MALE except where it matters
  '1NONBINARY' : [`  \`2"\`0Hi there.  Although I may not look muscular, I ain't all`,
              `  that weak.  You cannot advance to another Master until you`,
              `  can best me in battle.  I don't really have any advice`,
              `  except wear a groin cup at all times.  I learned the hard`,
              `  way.\`2"`],
  '3NONBINARY' : [`  \`2"\`0You are now level three, and you are actually becoming`,
              `  well known in the realm.  I heard your name being mentioned`,
              `  by Seth Able the Bard and Violet both.... You seem popular....\`2"`],
  '7NONBINARY' : [`  \`2"\`0You have grown powerful, young warrior.`,
              `  You are one to be reckoned with now.  Remember,`,
              `  Trade your Gems with the bartender to further your`,
              `  ability.\`2"`],
  '11NONBINARY': [`  \`2"\`0I am Turgon, child.  The greatest warrior in the realm.`,
              `  You are a great warrior, and if you best me, you must`,
              `  find and kill the Red Dragon.  I have every faith in you.\`2"`],
};

function getLevelText(level, sex) {
  const { normalise } = require('../utils/pronouns');
  const norm = normalise(sex);
  const suffix = norm === 'female' ? 'FEMALE' : norm === 'nonbinary' ? 'NONBINARY' : 'MALE';
  // Nonbinary falls back to MALE if no specific entry exists
  const key = `${level}${suffix}`;
  return LEVEL_TEXT[key] || LEVEL_TEXT[`${level}MALE`] || [`  \`2Your master has nothing to say to you today.`];
}

// ── get trainer for current level (capped at 11) ──────────────────────────

function getTrainer(level) {
  const idx = Math.min(level, trainer_stats.length - 1);
  return trainer_stats[idx];
}

// ── Q — Question Master ───────────────────────────────────────────────────

async function questionMaster(session, disp) {
  const p       = session.player;
  const trainer = getTrainer(p.level);

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Questioning Your Master`2');
  disp.sln(SEP);
  disp.sln('');

  // Level flavour text
  const lines = getLevelText(p.level, p.sex);
  lines.forEach(l => disp.sln(l));
  disp.sln('');

  if (p.exp >= trainer.need) {
    disp.sln(`  \`0${trainer.name} \`2looks at your carefully and says:`);
    disp.sln('');
    if (trainer.needstr1) {
      const txt = trainer.needstr1.replace(/&PWE/i, p.weapon || 'weapon');
      disp.sln(`  \`2"\`0${txt}\`2"`);
    }
    if (trainer.needstr2) {
      disp.sln(`  \`2"\`0${trainer.needstr2}\`2"`);
    }
  } else {
    disp.sln(`  \`0${trainer.name}\`2 looks at you carefully.`);
    disp.sln('');
    disp.sln(`  \`2"\`0You need about \`%${pretty(trainer.need - p.exp)}\`0 more experience before`);
    disp.sln(`   you will be as good as I am.\`2"`);
  }

  disp.sln('');
  await session.more();
}

// ── A — Attack Master ─────────────────────────────────────────────────────

async function attackMaster(session, disp) {
  const p       = session.player;
  const trainer = getTrainer(p.level);

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Fighting Your Master`2');
  disp.sln(SEP);
  disp.sln('');

  // Already fought today
  if (p.seen_master) {
    const son = getPronouns(p.sex).sonDaughter;
    disp.sln(`  "I would like to battle again, but it is too late my ${son}."`);
    disp.sln(`  \`2${trainer.name} tells you.  You figure you will try again`);
    disp.sln('  tomorrow.');
    disp.sln('');
    await session.more();
    return;
  }

  // Mark seen for today immediately (prevents re-entry on disconnect etc.)
  persist(session, { seen_master: true });

  // Not enough EXP — the crowd humiliates you
  if (p.exp < trainer.need) {
    disp.sln('  You are escorted down the hallway and into the battle arena.');
    disp.sln('');
    disp.sln('  `%THE BATTLE BEGINS!');
    disp.sln('');
    await session.more();
    disp.sln(`  \`2You raise your \`0${p.weapon || 'weapon'} \`2to strike!  You wonder why everyone`);
    disp.sln('  is looking at you with grins on their faces...');
    disp.sln('');
    await session.more();
    disp.sln('  Your weapon is gone!  You are holding air!');
    disp.sln('');
    await session.more();
    disp.sln('  Your Master is holding it!  The entire crowd is laughing at you!');
    disp.sln('');
    disp.sln('  You meekly accept the fact that you are not ready for your testing.');
    disp.sln('');
    await session.more();
    return;
  }

  // Ready to fight
  disp.sln(`  \`2You enter the fighting arena, ready with your \`0${p.weapon || 'weapon'}\`2.`);
  disp.sln('');
  disp.sln('  When your name is called, you move to the proper position and take a');
  disp.sln('  fighting stance against your master.');
  disp.sln('');
  disp.sln('  `2**`%MASTER FIGHT`2**');
  disp.sln('');
  disp.sln(`  \`2You have encountered \`0${trainer.name}\`2!!`);
  disp.sln('');

  // Build enemy object for battle engine
  const enemy = {
    name   : trainer.name,
    hp     : trainer.hp,
    hp_max : trainer.hp,
    str    : trainer.str,
    def    : 0,           // masters have no armour defence
    weapon : trainer.weapon,
    clss   : 0,
  };

  const result = await battle(session, enemy, { cantRun: false, isPvP: false });

  // Re-read player
  session.player = PlayerDB.getById(session.player.id);
  const pp = session.player;

  if (result === 'lose' || pp.dead) {
    // Trainer does NOT kill you — heals you back up
    persist(session, { dead: false, hp: pp.hp_max });
    disp.sln('');
    disp.sln(`  \`0${trainer.name} \`2raises his ${trainer.weapon}\`2 to kill you!`);
    disp.sln('');
    await session.more();
    disp.sln('  At the last minute, he reaches down and helps you up.  He tells you not to');
    disp.sln('  be discouraged, and for good gesture has you healed before you go.');
    disp.sln('');
    await session.more();
    return;
  }

  if (enemy.hp < 1 || result === 'win') {
    // Won! Level up
    disp.sln('');
    disp.sln(`  \`%You have bested ${trainer.name}\`%!`);
    disp.sln('');
    disp.sln(`\`%  ${trainer.swear}`);
    disp.sln('');

    const newLevel  = pp.level + 1;
    const newHpMax  = pp.hp_max + trainer.hp_gained;
    const newStr    = clamp(pp.str + trainer.str_gained, 0, 32000);
    const newDef    = clamp(pp.def + trainer.def,        0, 32000);

    persist(session, {
      level   : newLevel,
      hp_max  : newHpMax,
      hp      : newHpMax,
      str     : newStr,
      def     : newDef,
      seen_master: false,   // can challenge next master immediately
    });

    disp.sw(`  \`2You receive \`0${pretty(trainer.hp_gained)}\`2 hitpoints,`);
    disp.sw(` \`0${pretty(trainer.str_gained)}\`2 strength`);
    disp.sln(` and \`0${pretty(trainer.def)}\`2 defense points!`);
    disp.sln('');
    disp.sln(`  \`%YOU ARE NOW LEVEL ${pretty(newLevel)}.`);
    disp.sln('');

    // Log to daily happenings
    let mline = `  \`0${pp.name} \`2has beaten \`%${trainer.name}!`;
    if (newLevel === 12) {
      const { cap: _cap } = require('../utils/pronouns');
      const pronoun = _cap(getPronouns(pp.sex).subject);
      mline += `\n  ${pronoun} has become the Ultimate Warrior!`;
    }
    LogDB.append(mline);

    // Raise class skill
    await raiseClass(session, disp);

    await session.more();
    return;
  }

  // Ran away
  disp.sln('');
  disp.sln('  `2You retreat from the battle arena.');
  disp.sln('');
  await session.more();
}

// ── raise_class() — ported from lord.js lines 10578–10814 ─────────────────

async function raiseClass(session, disp) {
  let p = session.player;

  // All three classes mastered already
  if (p.skillw > 39 && p.skillm > 39 && p.skillt > 39) {
    disp.sln('  `%** `0YOU HAVE ALREADY MASTERED ALL SKILLS `%**');
    return;
  }

  // Current class already mastered
  if ((p.clss === 1 && p.skillw > 39) ||
      (p.clss === 2 && p.skillm > 39) ||
      (p.clss === 3 && p.skillt > 39)) {
    disp.sln('  `%** `0YOU HAVE ALREADY MASTERED THIS CLASS `%**');
    disp.sln('');
    return;
  }

  // Normal class (0) — choose profession first
  if (p.clss === 0) {
    await chooseProfession(session, disp, false);
    p = session.player;  // re-read after profession choice
  }

  disp.sln('  `%** `0YOUR CLASS SKILL IS RAISED BY ONE! `%**');
  disp.sln('');

  if (p.clss === 1) {
    // Death Knight — skill every 4 lessons grants +1 use/day
    const newSkillW = p.skillw + 1;
    const newLevelW = (newSkillW % 4 === 0) ? p.levelw + 1 : p.levelw;
    persist(session, { skillw: newSkillW, levelw: newLevelW });
    p = session.player;

    switch (newSkillW % 4) {
      case 0:
        disp.sln(`  \`2You now have \`0${pretty(Math.floor(newSkillW / 4))}\`2 uses of Death Knight Skills a day.`);
        disp.sln('');
        if (newSkillW === 40) {
          disp.sln('  You have mastered The Death Knight Skills Completely.  You may choose to');
          disp.sln('  learn a NEW skill now.');
          disp.sln('');
          await chooseProfession(session, disp, false);
        } else {
          disp.sln('  (four more lessons needed for next raise in uses per day)');
        }
        break;
      case 3: disp.sln('  You need one more lesson to also raise your Death Knight Uses Per Day.');   break;
      case 2: disp.sln('  You need two more lessons to also raise your Death Knight Uses Per Day.');  break;
      case 1: disp.sln('  You need three more lessons to also raise your Death Knight Uses Per Day.'); break;
    }

  } else if (p.clss === 2) {
    // Thief — every lesson raises skill; every 4th gives a new mystical lesson text
    const newSkillM = p.skillm + 1;
    const newLevelM = p.levelm + 1;
    persist(session, { skillm: newSkillM, levelm: newLevelM });
    p = session.player;

    disp.sln(`  \`2You now have \`0${pretty(newSkillM)}\`2 Mystical Skill points a day.`);

    if (newSkillM % 4 === 0) {
      disp.sln('');
      await session.more();
      session.clearScreen();
      disp.sln('');
      disp.sln('  `%                    **  MYSTICAL INSTRUCTION **');
      disp.sln('');
      disp.sln('  `2An old man with a long white beard suddenly appears next to you.');
      disp.sln('');
      const boyGirl = getPronouns(p.sex).boyGirl + '!';
      disp.sln(`  \`0"You're ready for your next lesson ${boyGirl}`);
      disp.sln('');
      await session.more();

      if      (newSkillM ===  4) {
        disp.sln(`  \`0"You ever been chased by a monster that just wouldn't quit?  I have,`);
        disp.sln(`   Muh wife!  Heehee! In a case like that there is only one thing to do!`);
        disp.sln(`   Disappear!"`);
      } else if (newSkillM ===  8) {
        disp.sln(`  \`0"Ok, you're still new at this, but I think you're ready for a little`);
        disp.sln(`   trick I call The Heat Wave.  This little 'beaut will blow a wind that`);
        disp.sln(`   not only warms your enemy, it cooks him."`);
      } else if (newSkillM === 12) {
        disp.sln(`  \`0"Ok, pardner, lemmie give it to ya straight.  Sometimes yer enemy is`);
        disp.sln(`   stronger then ya.  Ya need an advantage.  For instance, having a`);
        disp.sln(`   protective Light Shield wrapped around ya.  Half damage!"`);
      } else if (newSkillM === 16) {
        disp.sln(`  \`0"Ok, sometimes ya lose your temper, and you want to vent your anger`);
        disp.sln(`   in a contructive way?  Am I right?  Causing someone's bones to shatter`);
        disp.sln(`   is a great way to relieve stress."`);
      } else if (newSkillM === 20) {
        disp.sln(`  \`0"This is also your LAST lesson!" \`2the old man's face turns sober.  \`0"You`);
        disp.sln(`   have finally shown enough control to master the most complicated thing.`);
        disp.sln(`   Your body.  Healing yourself with your mind is an awesome power."`);
      }

      disp.sln('');
      disp.sln('  `2The old man vanishes as quickly as he appeared.');

      if (newSkillM === 40) {
        disp.sln('');
        disp.sln('  You have mastered the Mystical skills Completely.  You may choose to');
        disp.sln('  learn a NEW skill now.');
        disp.sln('');
        await chooseProfession(session, disp, false);
      } else {
        disp.sln('  (four more lessons needed to learn a new Mystical Skill)');
      }
    } else {
      const need = 4 - (newSkillM % 4);
      const word = need === 1 ? 'one' : need === 2 ? 'two' : 'three';
      disp.sln(`  You need ${word} more lesson${need > 1 ? 's' : ''} to learn a new Mystical Skill.`);
    }

  } else if (p.clss === 3) {
    // Thief — skill every 4 lessons grants +1 use/day
    const newSkillT = p.skillt + 1;
    const newLevelT = (newSkillT % 4 === 0) ? p.levelt + 1 : p.levelt;
    persist(session, { skillt: newSkillT, levelt: newLevelT });
    p = session.player;

    switch (newSkillT % 4) {
      case 0:
        disp.sln(`  \`2You now have \`0${pretty(Math.floor(newSkillT / 4))}\`2 uses of The Thieving Skills a day.`);
        disp.sln('');
        if (newSkillT === 40) {
          disp.sln('  You have mastered The Thieving Knight Skills Completely.  You may choose to');
          disp.sln('  learn a NEW skill now.');
          disp.sln('');
          await chooseProfession(session, disp, false);
        } else {
          disp.sln('  (four more lessons needed for next raise in uses per day)');
        }
        break;
      case 3: disp.sln('  You need only one more lesson to also raise your Thieving Uses Per Day.');  break;
      case 2: disp.sln('  You need two more lessons to also raise your Thieving Uses Per Day.');      break;
      case 1: disp.sln('  You need three more lessons to also raise your Thieving Uses Per Day.');    break;
    }
  }

  disp.sln('');
}

// ── choose_profession() — ported from lord.js line 4837 ───────────────────

async function chooseProfession(session, disp, fromTavern) {
  const p = session.player;

  if (!fromTavern) {
    disp.sln('  `%As you remember your childhood, you remember...');
    disp.sln('');
    disp.sln('  `0(`5K`0)illing A Lot Of Woodland Creatures');
    disp.sln('  `0(`5D`0)abbling In The Mystical Forces');
    disp.sln('  `0(`5L`0)ying, Cheating, And Stealing From The Blind');
  } else {
    disp.sln('  `2You concentrate deeply.');
  }

  let ch;
  while (true) {
    disp.sln('');
    disp.sw('  `2Pick one.  (`0K`2,`0D`2,`0L`2) : `%');
    ch = await session.getKeyUpper();
    disp.sln(ch || '');
    disp.sln('');

    if (ch === 'K') {
      disp.sln("  Now that you've grown up, you have decided to study the ways of the");
      disp.sln('  the Death Knights.  All beginners want the power to use their body');
      disp.sln('  and weapon as one.  To inflict twice the damage with the finesse only');
      disp.sln('  a warrior of perfect mind can do.');
      break;
    } else if (ch === 'D') {
      disp.sln('  You have always wanted to explain the unexplainable.  To understand the');
      disp.sln('  powerful forces that rule the earth.  To tame the beast that oversees');
      disp.sln('  all things.  Of course, having the power to burn someone by making a');
      disp.sln("  gesture wouldn't hurt.");
      break;
    } else if (ch === 'L') {
      disp.sln("  You decide to follow your instincts.  To get better at what you've");
      disp.sln('  always done best.  So you decide to lead a dishonest lifestyle.');
      disp.sln("  Of course, your ultimate goal will always be to join the Master Thieves");
      disp.sln('  Guild.  To arrive, remember one thing, "Even thieves have honor."');
      break;
    } else {
      disp.sln('');
      disp.sln('  This is a very important choice.  Pay attention idiot!');
    }
  }

  await session.more();

  // K=1(DK) D=2(Mystic) L=3(Thief) — maps to clss field
  const clssMap = { K: 1, D: 2, L: 3 };
  persist(session, { clss: clssMap[ch] || 1 });
}

// ── V — View Heroes (dragon-slayer ranking) ───────────────────────────────

async function viewHeroes(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('');
  disp.sln('                           `%Heroes Of The Realm');
  disp.sln('');
  disp.sln('  `0Name                       Heroic Deeds Done         Current Level');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');

  const all    = require('../../db/PlayerDB').getAll();
  const heroes = all
    .filter(pl => pl.name !== 'X' && pl.drag_kills > 0)
    .sort((a, b) => {
      if (b.drag_kills !== a.drag_kills) return b.drag_kills - a.drag_kills;
      if (b.level !== a.level)           return b.level - a.level;
      return b.exp - a.exp;
    });

  if (!heroes.length) {
    disp.sln('  `0Sad times indeed, there are no heroes in this realm.');
  } else {
    for (const pl of heroes) {
      const name  = pl.name.padEnd(22, ' ');
      const kills = String(pl.drag_kills).padStart(3, ' ');
      const lv    = String(pl.level).padStart(2, ' ');
      disp.sln(`\`0  ${name}           \`%${kills}                       \`0${lv}`);
    }
  }

  disp.sln('');
  await session.more();
}

// ── Draw the main screen ──────────────────────────────────────────────────

function drawScreen(session, disp) {
  const p       = session.player;
  const trainer = getTrainer(p.level);

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Turgon\'s Warrior Training`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln(`  \`2Your master is \`%${trainer.name}\`2.`);
  disp.sln('');

  if (p.level > 11) {
    // Max level — ultimate warrior greeting
    disp.sln('  You pay your respects to Turgon, and stroll around the grounds.  Lesser');
    disp.sln("  warriors bow low as you pass.  Turgon's last words advise you to find and");
    disp.sln('  kill the `4Red Dragon`2..');
    disp.sln('');
    disp.sln('  `5Turgon\'s Warrior Training`2');
    disp.sln('');
    disp.sw(`\`2  Your command, \`0${p.name}\`2? (V,R) : `);
    return;
  }

  disp.sln('  `5Turgon\'s Warrior Training`2');
  disp.sln('');
  disp.sln('  (`%Q`2)uestion your Master');
  disp.sln('  (`%A`2)ttack your Master');
  disp.sln('  (`%V`2)iew the Heroes of the Realm');
  disp.sln('  (`%R`2)eturn to Town Square');
  disp.sln('');
  disp.sln('  `2(Q,A,V,R)');
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

    const p = session.player;

    // Level 12 — only V and R available
    if (p.level > 11) {
      if (ch === 'V') {
        await viewHeroes(session, disp);
        drawScreen(session, disp);
      } else if (ch === 'R' || ch === 'Q' || ch === '\r') {
        return;
      } else {
        drawScreen(session, disp);
      }
      continue;
    }

    switch (ch) {
      case 'Q':
        await questionMaster(session, disp);
        drawScreen(session, disp);
        break;

      case 'A':
        await attackMaster(session, disp);
        if (!session.alive) return;
        drawScreen(session, disp);
        break;

      case 'V':
        await viewHeroes(session, disp);
        drawScreen(session, disp);
        break;

      case '?':
        drawScreen(session, disp);
        break;

      case 'R':
      case '\r':
        return;

      default:
        break;
    }
  }
}

module.exports = { enter, chooseProfession, raiseClass };
