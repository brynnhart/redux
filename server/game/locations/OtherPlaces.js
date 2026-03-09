'use strict';

/**
 * server/game/locations/OtherPlaces.js
 *
 * Three custom IGM-style destinations accessed from the Town Square (O key).
 *   1. The Enchanted Garden  — trade gems for Charm / fairies / special events
 *   2. The Mystic Tower      — Mystics and non-Mystics get different content
 *   3. The Witch's Hut       — curses, cures, and fortune-telling
 */

const Display  = require('../text/Display');
const PlayerDB = require('../../db/PlayerDB');
const StateDB  = require('../../db/StateDB');
const LogDB    = require('../../db/LogDB');
const MailDB   = require('../../db/MailDB');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function rand(n)   { return Math.floor(Math.random() * Math.max(1, n)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

function persist(session, fields) {
  PlayerDB.patch(session.player.id, fields);
  session.player = PlayerDB.getById(session.player.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE ENCHANTED GARDEN
// ─────────────────────────────────────────────────────────────────────────────

async function enchantedGarden(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('  `#The Enchanted Garden`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2A hidden gate opens onto a lush garden, the air thick with the scent');
  disp.sln('  of moonflowers.  Tiny lights drift between the hedgerows, and a melodic');
  disp.sln('  humming fills the air.  A white-robed keeper approaches you.');
  disp.sln('');
  disp.sln('  `2(`%C`2)heck your charm reading');
  disp.sln('  (`%G`2)ift the garden a gem  (gain Charm)');
  disp.sln('  (`%F`2)airy summons ritual   (5 gems)');
  disp.sln('  (`%W`2)alk the garden path');
  disp.sln('  (`%R`2)eturn');
  disp.sln('');

  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    const p = session.player;
    disp.sw(`  \`2Your command [\`0gems: \`%${pretty(p.gem)}\`0] : `);
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);
    disp.sln('');

    if (ch === 'R' || ch === 'Q' || ch === '\r') return;

    if (ch === 'C') {
      const cha = p.cha;
      let desc;
      if      (cha < 3)  desc = '`4You radiate the charm of a wet boot.';
      else if (cha < 10) desc = '`2You have a certain... peasant quality to you.';
      else if (cha < 25) desc = '`2You are reasonably pleasant to be around.';
      else if (cha < 50) desc = '`%You carry yourself with grace and confidence.';
      else if (cha < 80) desc = '`#People seem drawn to you like moths to a flame.';
      else               desc = '`%You are breathtakingly, dangerously charming.';
      disp.sln('  `2The Keeper gazes at you with milky eyes for a long moment...');
      disp.sln('');
      disp.sln(`  ${desc}`);
      disp.sln(`  \`2Your Charm score is \`%${pretty(cha)}\`2.`);
      disp.sln('');
      await session.more();
      continue;
    }

    if (ch === 'G') {
      if (p.gem < 1) {
        disp.sln('  `5"You carry no gems.  The garden has nothing to offer an empty hand."');
        disp.sln('');
        await session.more();
        continue;
      }
      disp.sw(`  \`2Offer how many gems (you have \`%${pretty(p.gem)}\`2)?  [\`01\`2] : `);
      const gs  = (await session.getStr(6, { allowed: /[0-9]/ })).trim();
      const num = Math.max(0, parseInt(gs, 10) || 1);
      disp.sln('');
      if (num <= 0) { disp.sln('  `2You keep your gems.'); disp.sln(''); continue; }
      if (num > p.gem) { disp.sln('  `4You do not have that many gems!'); disp.sln(''); continue; }
      const gained = num * (rand(3) + 1);
      persist(session, { gem: p.gem - num, cha: clamp((p.cha || 1) + gained, 1, 9999) });
      disp.sln('  `2You lay the glittering gems among the roots of a moonflower.');
      disp.sln('  `#A warm golden light pulses through you...');
      disp.sln('');
      disp.sln(`  \`%YOU GAIN \`0${gained}\`% CHARM!`);
      disp.sln('');
      await session.more();
      continue;
    }

    if (ch === 'F') {
      if (p.has_fairy) {
        disp.sln('  `#Your fairy companion darts happily among the flowers.');
        disp.sln('  `2The Keeper tells you your bond is already strong.');
        disp.sln('');
        await session.more();
        continue;
      }
      if (p.gem < 5) {
        disp.sln('  `5"The fairy ritual requires five gems as an offering.  Come back');
        disp.sln('  when you have gathered more."');
        disp.sln('');
        await session.more();
        continue;
      }
      disp.sln('  `5"Five gems, and a pure heart.  Are you certain you wish to call');
      disp.sln('  a fairy companion to your side?"');
      disp.sln('');
      disp.sw('  `2Proceed with the ritual? [`0N`2] : ');
      const yn = await session.getKeyUpper();
      disp.sln(yn || 'N');
      disp.sln('');
      if (yn !== 'Y') { disp.sln('  `2You step back from the ritual circle.'); disp.sln(''); continue; }
      persist(session, { gem: p.gem - 5, has_fairy: 1, fairy_lore: 1 });
      disp.sln('  `2You place the gems at the center of the garden stone...');
      disp.sln('');
      disp.sln('  `#A tiny winged figure materializes from the morning mist,');
      disp.sln('  hovering before your face with a chime-like laugh.');
      disp.sln('');
      disp.sln('  `%A FAIRY HAS BONDED WITH YOU!');
      disp.sln('');
      disp.sln('  `2Your fairy will sometimes act during forest battles to aid you.');
      LogDB.append(`\`#  ${session.player.name}\`2 has bonded with a \`#fairy\`2 in the Enchanted Garden!`);
      disp.sln('');
      await session.more();
      continue;
    }

    if (ch === 'W') {
      const p2 = session.player;
      const events = [
        () => {
          disp.sln('  `2You follow a winding stone path through beds of silver fern.');
          disp.sln('  Near a mossy bench you find a small gem half-buried in the soil!');
          persist(session, { gem: (p2.gem || 0) + 1 });
          disp.sln('  `%You pocket 1 gem!');
        },
        () => {
          const heal = rand(p2.level * 5) + 1;
          persist(session, { hp: clamp(p2.hp + heal, 0, p2.hp_max) });
          disp.sln('  `2A warm breeze carries the scent of healing herbs across your face.');
          disp.sln(`  \`%You recover \`0${heal}\`% hit points!`);
        },
        () => {
          const gain = rand(3) + 1;
          persist(session, { cha: clamp(p2.cha + gain, 1, 9999) });
          disp.sln('  `2You sit beside the moonflower pool.  The stillness fills you');
          disp.sln('  with quiet confidence.');
          disp.sln(`  \`%You gain \`0${gain}\`% Charm!`);
        },
        () => {
          disp.sln('  `2You follow the path to a stone sundial at the garden\'s heart.');
          disp.sln('  Carved into its base is a single word: `%ENDURE`2.');
          disp.sln('  You stand there a moment, feeling oddly at peace.');
        },
        () => {
          disp.sln('  `2A doe wanders across the path, regards you calmly, then disappears');
          disp.sln('  into the hedge.  The Keeper nods approvingly from a distance.');
        },
      ];
      events[rand(events.length)]();
      disp.sln('');
      await session.more();
      continue;
    }

    if (ch === '?') {
      disp.sln('  `2(`%C`2)harm  (`%G`2)ift gems  (`%F`2)airy ritual  (`%W`2)alk  (`%R`2)eturn');
      disp.sln('');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE MYSTIC TOWER
// ─────────────────────────────────────────────────────────────────────────────

async function mysticTower(session, disp) {
  const p = session.player;
  const isMystic = (p.clss === 3);

  session.clearScreen();
  disp.sln('');
  disp.sln('  `3The Mystic Tower`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2A tall obsidian spire rises at the edge of town, its windows glowing');
  disp.sln('  with a faint violet light.  The door opens before you can knock.');
  disp.sln('');

  if (isMystic) {
    disp.sln('  `3"Ah, a fellow practitioner.  You are welcome here."');
    disp.sln('');
    disp.sln('  `2(`%S`2)tudy arcane texts  (3 gems, gain Skill pts)');
    disp.sln('  (`%M`2)editate             (restore HP)');
    disp.sln('  (`%L`2)earn Light Shield   (requires 10 Mystic skill pts)');
    disp.sln('  (`%R`2)eturn');
  } else {
    disp.sln('  `3"This tower is open to all curious minds."');
    disp.sln('');
    disp.sln('  `2(`%B`2)rowse the notice board');
    disp.sln('  (`%A`2)sk the Archivist a question');
    disp.sln('  (`%R`2)eturn');
  }
  disp.sln('');

  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    const pp = session.player;
    disp.sw('  `2Your choice : ');
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);
    disp.sln('');

    if (ch === 'R' || ch === 'Q' || ch === '\r') return;

    if (isMystic) {
      if (ch === 'S') {
        if (pp.gem < 3) {
          disp.sln('  `3"You need at least 3 gems to focus the ritual."');
          disp.sln('');
          await session.more();
          continue;
        }
        const gain = rand(3) + 1;
        persist(session, { gem: pp.gem - 3, skillm: (pp.skillm || 0) + gain });
        disp.sln('  `2You spend the afternoon deep in arcane study...');
        disp.sln('  `3The knowledge seeps into your bones like starlight.');
        disp.sln(`  \`%Your Mystic skill points increase by \`0${gain}\`%!  (Now: \`0${session.player.skillm}\`%)`);
        disp.sln('');
        await session.more();
        continue;
      }
      if (ch === 'M') {
        const restore = Math.floor(pp.hp_max * 0.4);
        const newHp   = clamp(pp.hp + restore, 0, pp.hp_max);
        if (pp.hp >= pp.hp_max) {
          disp.sln('  `3"Your spirit is already whole.  No need to meditate."');
        } else {
          persist(session, { hp: newHp });
          disp.sln('  `2You sit cross-legged on the stone floor and close your eyes.');
          disp.sln('  `3Violet light pulses softly around you...');
          disp.sln(`  \`%You recover \`0${restore}\`% hit points.`);
        }
        disp.sln('');
        await session.more();
        continue;
      }
      if (ch === 'L') {
        if (pp.light_shield) {
          disp.sln('  `3"Your shield burns bright already.  You have mastered this art."');
          disp.sln('');
          await session.more();
          continue;
        }
        if ((pp.skillm || 0) < 10) {
          disp.sln('  `3"You need at least 10 Mystic skill points before you can learn');
          disp.sln('  the light shield.  Keep studying."');
          disp.sln('');
          await session.more();
          continue;
        }
        disp.sln('  `3"The Light Shield absorbs a portion of damage in every battle."');
        disp.sln('');
        disp.sw('  `2Learn Light Shield? [`0Y`2] : ');
        const yn = await session.getKeyUpper();
        disp.sln(yn || 'Y');
        disp.sln('');
        if (yn === 'N') continue;
        persist(session, { light_shield: 1 });
        disp.sln('  `3A white flame leaps from the Archivist\'s staff and enters your chest.');
        disp.sln('  `%YOU HAVE LEARNED THE LIGHT SHIELD!');
        disp.sln('');
        LogDB.append(`\`3  ${pp.name}\`2 learned the \`%Light Shield\`2 at the Mystic Tower!`);
        await session.more();
        continue;
      }
    } else {
      if (ch === 'B') {
        const notices = [
          '  `2"Seeking group for dragon expedition.  Must have own horse.  Ask at Inn."',
          '  `2"Lost: one enchanted dagger.  Silver handle, glows faintly.  Reward offered."',
          '  `2"Turgon\'s Warrior Training NOW OPEN on Sundays.  No experience required."',
          '  `2"MISSING CHILDREN — If you have seen anything, speak to the King."',
          '  `2"FOR SALE: Slightly used plate armour.  Inquire at the Armoury."',
          '  `2"The Dragon has been quiet for three days.  Should we be worried?"',
        ];
        disp.sln('  `2A cork board on the wall is crowded with parchment notices...');
        disp.sln('');
        const picks = [];
        while (picks.length < 3) {
          const i = rand(notices.length);
          if (!picks.includes(i)) picks.push(i);
        }
        picks.forEach(i => disp.sln(notices[i]));
        disp.sln('');
        await session.more();
        continue;
      }
      if (ch === 'A') {
        disp.sln('  `3"Ask, and I shall answer what I may."');
        disp.sln('');
        disp.sw('  `2Your question : `%');
        const q = (await session.getStr(60)).trim();
        disp.sln('');
        if (!q) continue;
        const answers = [
          '  `3"The answer lies within you.  Seek and you shall find."',
          '  `3"That is a question for another age.  Study on it."',
          `  \`3"Ah.  \`%${q}\`3.  A fine question.  The answer, sadly, costs three gems."`,
          '  `3"The stars have spoken on this matter.  Their answer: perhaps."',
          '  `3"Ask the Dragon.  He has much time to contemplate such things."',
          '  `3"I have written eleven books on exactly that topic.  None were helpful."',
        ];
        disp.sln(answers[rand(answers.length)]);
        disp.sln('');
        await session.more();
        continue;
      }
    }

    if (ch === '?') {
      if (isMystic) {
        disp.sln('  `2(`%S`2)tudy  (`%M`2)editate  (`%L`2)ight shield  (`%R`2)eturn');
      } else {
        disp.sln('  `2(`%B`2)rowse notices  (`%A`2)sk Archivist  (`%R`2)eturn');
      }
      disp.sln('');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE WITCH'S HUT
// ─────────────────────────────────────────────────────────────────────────────

async function witchsHut(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('  `5The Witch\'s Hut`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2A ramshackle hut squats at the very edge of the village.  Wind chimes');
  disp.sln('  made of bone clatter in a breeze that isn\'t there.  The door creaks open');
  disp.sln('  and a gnarled figure peers out at you with luminous eyes.');
  disp.sln('');
  disp.sln('  `5"Come in, come in.  Zara sees all and knows all."');
  disp.sln('');
  disp.sln('  `2(`%T`2)ell my fortune       (free)');
  disp.sln('  (`%C`2)urse an enemy         (5 gems)');
  disp.sln('  (`%H`2)ave a curse removed   (10 gems)');
  disp.sln('  (`%P`2)otion of strength     (3 gems)');
  disp.sln('  (`%R`2)eturn to town');
  disp.sln('');

  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    const p = session.player;
    disp.sw(`  \`2Your command [\`0gems: \`%${pretty(p.gem)}\`0] : `);
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);
    disp.sln('');

    if (ch === 'R' || ch === 'Q' || ch === '\r') return;

    if (ch === 'T') {
      const fortunes = [
        `  \`5"I see great battles ahead, \`0${p.name}\`5.  And gold.  Much gold."`,
        `  \`5"The Dragon thinks of you.  Whether fondly or hungrily, I cannot say."`,
        `  \`5"Love is near.  Or possibly an ambush.  Hard to tell in this crystal."`,
        `  \`5"Your weapon will sing before this day is done."`,
        `  \`5"I see a dark stranger...  and he owes you money."`,
        `  \`5"The stars favor you today, \`0${p.name}\`5!  ...mostly."`,
        `  \`5"A journey lies ahead.  You will find what you seek — eventually."`,
        `  \`5"Beware a warrior whose name begins with the same letter as yours."`,
      ];
      disp.sln('  `2Zara leans over her crystal ball, her eyes going distant...');
      disp.sln('');
      disp.sln(fortunes[rand(fortunes.length)]);
      disp.sln('');
      await session.more();
      continue;
    }

    if (ch === 'C') {
      if (p.gem < 5) {
        disp.sln('  `5"Curses require five gems as payment.  Do not waste my time!"');
        disp.sln('');
        await session.more();
        continue;
      }
      disp.sln('  `5"Give me the name of your enemy."');
      disp.sw('  `2Name : `%');
      const name = (await session.getStr(20)).trim();
      disp.sln('');
      if (!name) continue;
      const target = PlayerDB.findByName(name);
      if (!target || target.name === 'X') {
        disp.sln('  `5"I cannot find that soul.  Your gems are returned."');
        disp.sln('');
        continue;
      }
      if (target.id === p.id) {
        disp.sln('  `5"You wish to curse yourself?  That... is already done by fate."');
        disp.sln('');
        continue;
      }
      persist(session, { gem: p.gem - 5 });
      const drain = rand(target.level * 50) + 1;
      PlayerDB.patch(target.id, { gold: Math.max(0, (target.gold || 0) - drain) });
      MailDB.sendMail(target.id, null,
        `  \`5A Dark Curse\n` +
        `\`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n` +
        `  \`5Zara the Witch has laid a curse upon you!\n` +
        `  \`2You feel your gold purse grow mysteriously lighter...`
      );
      disp.sln('  `2Zara cackles and tosses herbs into a bubbling cauldron...');
      disp.sln('');
      disp.sln(`  \`5"Done.  \`0${target.name}\`5 will feel this before long!"`);
      disp.sln('');
      LogDB.append(`\`5  ${p.name}\`2 had a witch\'s curse placed on \`0${target.name}\`2!`);
      await session.more();
      continue;
    }

    if (ch === 'H') {
      if (p.gem < 10) {
        disp.sln('  `5"To lift a curse takes ten gems.  That is the price."');
        disp.sln('');
        await session.more();
        continue;
      }
      disp.sw('  `2Pay 10 gems to have any curses removed? [`0N`2] : ');
      const yn = await session.getKeyUpper();
      disp.sln(yn || 'N');
      disp.sln('');
      if (yn !== 'Y') continue;
      persist(session, { gem: p.gem - 10 });
      disp.sln('  `2Zara waves a smoldering bundle of herbs over your head, muttering');
      disp.sln('  in an ancient tongue...');
      disp.sln('');
      disp.sln('  `%The shadows around you dissipate!  You feel lighter.');
      disp.sln('');
      await session.more();
      continue;
    }

    if (ch === 'P') {
      if (p.gem < 3) {
        disp.sln('  `5"Three gems for the potion.  You do not have enough."');
        disp.sln('');
        await session.more();
        continue;
      }
      const gainStr = rand(5) + 1;
      persist(session, {
        gem: p.gem - 3,
        str: clamp((p.str || 10) + gainStr, 0, 32000),
      });
      disp.sln('  `2Zara produces a vial of something greenish and unpleasant looking.');
      disp.sln('  `5"Drink it all.  Do not smell it first."');
      disp.sln('');
      disp.sln('  `2You drink the potion in one go.  It tastes of old boots and lightning.');
      disp.sln(`  \`%YOU GAIN \`0${gainStr}\`% STRENGTH!`);
      disp.sln('');
      await session.more();
      continue;
    }

    if (ch === '?') {
      disp.sln('  `2(`%T`2)ell fortune  (`%C`2)urse enemy  (`%H`2)eal curse  (`%P`2)otion  (`%R`2)eturn');
      disp.sln('');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Other Places menu
// ─────────────────────────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);
  const p    = session.player;

  function drawMenu() {
    session.clearScreen();
    disp.sln('');
    disp.sln('  `%Other Places`0');
    disp.sln(SEP);
    disp.sln('');
    disp.sln('  `2You step off the main cobblestones into the quieter corners of the realm.');
    disp.sln('');
    disp.sln('  `2(`%G`2)o to the Enchanted Garden');
    disp.sln('  (`%M`2)ystic Tower');
    disp.sln('  (`%W`2)itch\'s Hut');
    disp.sln('  (`%R`2)eturn to Town Square');
    disp.sln('');
  }

  drawMenu();

  while (session.alive) {
    disp.sw(`  \`2Your destination, \`0${p.name}\`2? : `);
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);

    if (ch === 'R' || ch === 'Q' || ch === '\r') return;

    if (ch === 'G') { await enchantedGarden(session, disp); drawMenu(); continue; }
    if (ch === 'M') { await mysticTower(session, disp);     drawMenu(); continue; }
    if (ch === 'W') { await witchsHut(session, disp);       drawMenu(); continue; }
    if (ch === '?') { drawMenu(); continue; }
  }
}

module.exports = { enter };
