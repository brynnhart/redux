'use strict';

/**
 * server/game/locations/DarkHorse.js
 *
 * The DarkCloak Tavern — accessible from the forest with a horse.
 * Ported from lord.js darkhorse_tavern() — lines 12240–12920
 *
 * Keys: (C)onverse, (E)vil deeds ranking, (T)alk to Chance,
 *       (W)alk to Old Man, (G)amble, (D)aily news, (Y)iew stats, (R)eturn
 */

const PlayerDB         = require('../../db/PlayerDB');
const StateDB          = require('../../db/StateDB');
const LogDB            = require('../../db/LogDB');
const ConversationDB   = require('../../db/ConversationDB');
const Display          = require('../text/Display');
const { rand }         = require('../systems/Battle');
const { chooseProfession } = require('./Turgons');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

// ── Menu ─────────────────────────────────────────────────────────────────────

function showMenu(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('`%  ** The DarkCloak Tavern **');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('`2  A blazing fire warms your heart as well as your body in this fragrant');
  disp.sln('  roadhouse.  Many a weary traveler has had the fortune to find this cozy');
  disp.sln('  hostel, to escape the harsh reality of the dense forest for a few moments.');
  disp.sln('  You notice someone has etched something in the table you are sitting at.');
  disp.sln('');
  disp.sln('  `2(`0C`2)onverse at the Bar');
  disp.sln('  (`0E`2)vil Deeds Ranking');
  disp.sln('  (`0T`2)alk to Chance (intel for 2 gems)');
  disp.sln('  (`0W`2)alk to The Old Man (descriptions)');
  disp.sln('  (`0G`2)amble with the Old Man');
  disp.sln('  (`0D`2)aily News');
  disp.sln('  (`0Y`2)our Stats');
  disp.sln('  (`0R`2)eturn to Forest');
  disp.sln('');
}

// ── Bar conversation (uses 'darkbar' channel) ─────────────────────────────────

async function barConverse(session, disp) {
  disp.sln('');
  disp.sln('`%  Conversation at the DarkCloak Bar`#');
  disp.sln(SEP);
  disp.sln('');

  const lines = ConversationDB.getLines('darkbar');
  if (lines.length === 0) {
    disp.sln('  `2The tables are quiet... nobody has spoken here yet.');
  } else {
    for (const l of lines) disp.sln(l);
  }
  disp.sln('');
  disp.sw('  `2(`5C`2)ontinue  (`5A`2)dd to Conversation `0[`5C`0] : ');

  const ch = await session.getKeyUpper();
  disp.sln(ch || 'C');
  if (ch !== 'A') return;

  disp.sln('');
  disp.sln('  `2Share your feelings now.. (Max 75 char!)');
  disp.sw('  `0>`2');
  const line = (await session.getStr(75)).trim();
  if (!line || line.length < 2) {
    disp.sln('  You decide not to speak.');
    return;
  }
  const p = session.player;
  ConversationDB.addLines('darkbar', [`  \`%${p.name}:`]);
  ConversationDB.addLines('darkbar', [`  \`2${line}`]);
}

// ── Evil Deeds Ranking ────────────────────────────────────────────────────────

async function rankLays(session, disp) {
  disp.sln('');
  disp.sln('');
  disp.sln("                          `%The Old Man's Ranking");
  disp.sln('');
  disp.sln('  `0Name                              Lays            Player Kills');
  disp.sln('`#' + SEP);

  const all = PlayerDB.getAll()
    .filter(p => p.name !== 'X' && (p.laid || 0) > 0)
    .sort((a, b) => (b.laid - a.laid) || (b.cha - a.cha));

  if (all.length === 0) {
    disp.sln('  `0Sad times indeed, no one has managed to make this list.');
  } else {
    for (const p of all) {
      const nm   = p.name.padEnd(22).slice(0, 22);
      const lays = String(p.laid || 0).padStart(5);
      const pvp  = String(p.pvp  || 0).padStart(6);
      disp.sln(`  \`0${nm}            \`%${lays}                      \`4 ${pvp}`);
    }
  }
  disp.sln('');
  await session.more();
}

// ── Wager helper ─────────────────────────────────────────────────────────────

async function wager(session, disp) {
  const p = session.player;
  while (session.alive) {
    disp.sln(`  \`2How much gold of your \`%${pretty(p.gold)}\`2 will you hazard? (\`00\`2 to chicken out)`);
    disp.sw('  `2WAGER : `0');
    const gs  = await session.getStr(11, { allowed: /[0-9]/ });
    const bet = parseInt(gs, 10) || 0;
    disp.sln('');
    if (bet < 0) {
      disp.sln("  `2You don't think that will go over too big.");
      disp.sln('');
      continue;
    }
    if (bet > p.gold) {
      disp.sln("  `2Betting what you don't have is `4NOT`2 a good idea.");
      disp.sln('');
      continue;
    }
    return bet;
  }
  return 0;
}

// ── Gamble mini-games (lord.js gamble() — 3 variants) ─────────────────────────

async function gamble(session, disp, gamesPlayed) {
  const p = session.player;
  disp.sln('`c`%  ** GAMBLE TIME! **');
  disp.sln('');
  disp.sln('  `2You saunter over to the bar and demand that someone gamble with you.');
  disp.sln('');

  if (gamesPlayed >= 2) {
    disp.sln("  No one seems too thrilled at the prospect.  Perhaps if you came back");
    disp.sln('  another time.');
    disp.sln('');
    if (gamesPlayed >= 3) {
      disp.sln("  (You wonder if it had anything to do with your making a joke out");
      disp.sln('  of the word honor)');
      disp.sln('');
    }
    await session.more();
    return gamesPlayed;
  }

  const game = rand(3);

  // ── Game 0: Mind-reading ────────────────────────────────────────────────
  if (game === 0) {
    disp.sln('  The old man stops etching on the table he is at and walks over to you.');
    disp.sln('');
    disp.sln("  `0\"I'll play a game with ya, kid!  I'll bet I can guess what number");
    disp.sln("  you are thinkin'!\"");
    disp.sln('');
    await session.more();
    const bet = await wager(session, disp);
    if (bet === 0) {
      disp.sln('  `2The old man laughs in your face then continues his carving in the table.');
    } else {
      const mynum = rand(100) + 1;
      disp.sln(`  \`0"Fine!  \`%${pretty(bet)}\`0 it is!  Concentrate on a number."\`2`);
      disp.sln('');
      disp.sln('  `2You concentrate on the number...');
      disp.sln(`  \`%${mynum}`);
      disp.sln('');
      disp.sln('  `2The old man studies you quietly for a moment.  Then screams in delight.');
      disp.sln('');
      await session.more();

      // Old man has ~45% chance of guessing right (rigged slightly for the house)
      let hisnum = rand(100) + 1;
      if (hisnum > 55) {
        hisnum = rand(100) + 1;
        while (hisnum === mynum) hisnum = rand(100) + 1;
      } else {
        hisnum = mynum;
      }
      disp.sw(`  \`0"The number is...\`%${hisnum}\`0 isn't it?!!!!!!!!!!!`);
      disp.sln('');
      disp.sln('');
      if (hisnum !== mynum) {
        disp.sln(`  \`2You sadly inform the Old Man of his mistake, and he grudgingly gives`);
        disp.sln(`  you \`%${pretty(bet)}\`2 gold from his pouch.`);
        PlayerDB.patch(p.id, { gold: clamp((p.gold || 0) + bet, 0, 2000000000) });
        session.player = PlayerDB.getById(p.id);
        p.gold = session.player.gold;
      } else {
        disp.sln(`  \`2You feel obliged to admit that he chose correctly.  You count out`);
        disp.sln(`  \`%${pretty(bet)}\`2 gold and give it to him with a scowl.`);
        disp.sln('');
        disp.sln('  `2The old man dances a jig of joy!');
        PlayerDB.patch(p.id, { gold: clamp((p.gold || 0) - bet, 0, 2000000000) });
        session.player = PlayerDB.getById(p.id);
        p.gold = session.player.gold;
      }
    }
  }

  // ── Game 1: Wooden teeth ────────────────────────────────────────────────
  else if (game === 1) {
    disp.sln('  The old man stops etching on the table and walks over to you.');
    disp.sln('');
    disp.sln("  `0\"I'll play a game with ya, kid!\"");
    disp.sln('');
    disp.sln("  `2The old man grabs two wooden mugs from a table and slaps them down");
    disp.sln("  in front of you upside down.  `0\"Guess which one I hid muh teeth in!\"");
    disp.sln('');
    await session.more();
    const bet = await wager(session, disp);
    if (bet === 0) {
      disp.sln('  `2The old man laughs in your face then continues his carving.');
    } else {
      disp.sln(`  \`0"Agreed!" \`2The old man waits for your response.`);
      disp.sln('');
      await session.more();
      const mugPick = rand(2) + 1;
      disp.sln(`  \`2You demand to see what's in the ${mugPick === 1 ? 'first' : 'second'} mug!`);
      disp.sln('');
      disp.sln('  `2The old man slowly turns over the mug...');
      const won = rand(100) + 1 > 45;
      if (won) {
        disp.sln('`%IT HAS HIS WOODEN TEETH IN IT!');
        disp.sln('');
        disp.sln('  `2The entire bar cheers at your success!');
        disp.sln('');
        disp.sln("  The old man groans and hands you the gold you've won.");
        PlayerDB.patch(p.id, { gold: clamp((p.gold || 0) + bet, 0, 2000000000) });
      } else {
        disp.sln('`4IT IS EMPTY SAVE SOME STALE BEER!');
        disp.sln('');
        disp.sln('  `2The old man howls in delight as you pay him.');
        PlayerDB.patch(p.id, { gold: clamp((p.gold || 0) - bet, 0, 2000000000) });
      }
      session.player = PlayerDB.getById(p.id);
      p.gold = session.player.gold;
    }
  }

  // ── Game 2: Dagger throw ────────────────────────────────────────────────
  else {
    disp.sln('  The old man stops etching on the table and walks over to you.');
    disp.sln('');
    disp.sln("  `0\"I'll play a game with ya, kid!\"");
    disp.sln('');
    disp.sln("  `2The old man walks over and hands you a small dagger.  Then he");
    disp.sln('  moves to the other side of the Tavern, and picks up a tankard of brew.');
    disp.sln('');
    disp.sln("  `0\"I'll bet you can't knock this off my head without getting me wet!\"");
    disp.sln('');
    await session.more();
    const bet = await wager(session, disp);
    if (bet === 0) {
      disp.sln('  `2The old man laughs in your face then continues his carving.');
    } else {
      disp.sln('  `2The old man positions himself carefully, and places the Mug on his head.');
      disp.sln('');
      disp.sln("  `0\"You'll never hit it, sharpshooter!  Throw it already!\"");
      disp.sln('');
      await session.more();
      disp.sln('  `2You give it your best shot.');
      disp.sln('');
      disp.sw('  `%** `0WHO');
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 60));
        disp.sw('O');
      }
      disp.sln('SH `%**');
      disp.sln('');

      const won = rand(100) + 1 > 44;
      if (won) {
        disp.sln('  `2YOU HAVE KNOCKED IT OFF LEAVING THE OLD MAN HIGH AND DRY!');
        disp.sln('');
        disp.sln(`  The old man swears sourly, but pays you the \`%${pretty(bet)}\`2 gold.`);
        PlayerDB.patch(p.id, { gold: clamp((p.gold || 0) + bet, 0, 2000000000) });
      } else {
        disp.sln('  `4YOU MISS YOUR TARGET!');
        disp.sln('');
        const misses = [
          "  The dagger ricochetted off the wall and into `%Chance`2's drink!\n  He looks furious!",
          '  The dagger smoothly implants itself into the old mans forehead!\n\n  But he is ok!',
          '  The dagger stabs deeply into the oak behind the old mans head!',
          "  The dagger stabs near your foot!  The entire tavern laughs at you!",
          '  The dagger hits the bar, and slides to a screeching stop in front of a\n  young warrior.  His face is white as a sheet - The entire bar laughs!',
          '  The dagger flies through an open window!',
        ];
        for (const l of misses[rand(misses.length)].split('\n')) disp.sln(l);
        disp.sln('');
        disp.sln('  The old man laughs with glee.  You mumble curses as you pay him.');
        PlayerDB.patch(p.id, { gold: clamp((p.gold || 0) - bet, 0, 2000000000) });
      }
      session.player = PlayerDB.getById(p.id);
      p.gold = session.player.gold;
    }
  }

  disp.sln('');
  await session.more();
  return gamesPlayed + 1;
}

// ── Chance (intel NPC) ────────────────────────────────────────────────────────

async function talkChance(session, disp) {
  const CLASS_NAMES = ['Nobody', '`0Warrior', '`#Mystical Skills User`0', '`9Thief`0'];
  const state = StateDB.get();

  session.clearScreen();
  disp.sln('');
  disp.sln('`%  ** Chance **');
  disp.sln(SEP);
  disp.sln('  `2A sharp-eyed figure leans against the wall, watching everyone.');
  disp.sln('');
  disp.sln('  `2(`0L`2)earn about a warrior (2 gems)');
  disp.sln('  (`0C`2)hange your profession');
  disp.sln('  (`0T`2)utorial on color codes');
  disp.sln('  (`0P`2)ractice colors');
  disp.sln('  (`0R`2)eturn');
  disp.sln('');

  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    const p = session.player;
    disp.sw('  `2Your command? [`0R`2] : ');
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);
    disp.sln('');

    if (ch === 'R' || ch === 'Q' || ch === '\r') return;

    if (ch === '?') {
      disp.sln('  `2(`0L`2)earn about a warrior');
      disp.sln('  (`0C`2)hange your profession');
      disp.sln('  (`0T`2)utorial on color codes');
      disp.sln('  (`0P`2)ractice colors');
      disp.sln('  (`0R`2)eturn');
      disp.sln('');
      continue;
    }

    if (ch === 'L') {
      disp.sln('  `0"I know many things about many people.  Who is your enemy?"`2');
      disp.sw('  `2Name: `%');
      const name = (await session.getStr(20)).trim();
      disp.sln('');
      if (!name) continue;

      const target = PlayerDB.findByName(name);
      if (!target) {
        disp.sln("  `0\"I don't know anyone with a name even close to that.\"`2");
        disp.sln('');
        continue;
      }
      if (target.id === p.id) {
        disp.sln(`  \`0"Yes..I know ${p.sex === 'M' ? 'him' : 'her'}.  ${p.sex === 'M' ? 'He' : 'She'} is a favorite customer of mine!"`);
        disp.sln('  `2Chance laughs heartily.');
        disp.sln('');
        continue;
      }

      const prof = CLASS_NAMES[target.clss] || 'Nobody';
      disp.sln("  `2Chance's face turns somber.");
      disp.sln(`  \`0"${target.name}\`0 the ${prof}?  I know who that is."`);
      disp.sln('');
      disp.sln('  `0"This information was not easily come by, and I am going to have to charge');
      disp.sln('  two `%Gems`0 for it.  Now you know why this tavern is REALLY here."');
      disp.sln('');

      if (p.gem < 2) {
        disp.sln('  `2Not having two `%Gems`2, you decline.');
        disp.sln('');
        continue;
      }

      disp.sw('  `2Pay Chance two `%Gems`2 for the info? [`0Pay \'Em`2] : ');
      const pay = await session.getKeyUpper();
      disp.sln(pay || 'Y');
      disp.sln('');

      if (pay === 'N') {
        disp.sln('  `0"No problem!  I know how it is these days."');
        disp.sln('');
        continue;
      }

      // Pay and reveal
      PlayerDB.patch(p.id, { gem: p.gem - 2 });
      session.player = PlayerDB.getById(p.id);
      disp.sln('  `0"Alright.  Come with me."');
      disp.sln('');
      disp.sln('  `2Chance leads you to a small room in back of the tavern.');
      disp.sln('');
      disp.sln(`  \`0"Well...Here is everything I know about ${target.name}\`0."`);
      disp.sln('');
      await session.more();

      const him = target.sex === 'M' ? 'him' : 'her';
      const he  = target.sex === 'M' ? 'he'  : 'she';
      disp.sln(`  \`0"Fights with a ${target.weapon}\`0 and has a total Strength of \`%${pretty(target.str)}\`0."`);
      disp.sln(`  \`0"Wears a ${target.arm}\`0 and has a total Defense of \`%${pretty(target.def)}\`0."`);
      disp.sln('');

      const cha = target.cha || 1;
      if      (cha < 3)  disp.sln(`  \`0"${target.name} is very ugly."`);
      else if (cha < 5)  disp.sln(`  \`0"${target.name} is kind of blah looking."`);
      else if (cha < 10) disp.sln(`  \`0"${target.name} is fairly good looking."`);
      else if (cha < 50) disp.sln(`  \`0"${target.name} has a very fair countenance."`);
      else if (cha < 90) {
        if (target.sex === 'F') disp.sln(`  \`0"${target.name} is a very good looking woman."`);
        else                    disp.sln(`  \`0"${target.name} gets all the women...The lucky brute!"`);
      } else {
        if (target.sex === 'F') disp.sln(`  \`0"I have heard ${target.name} has the face and body of a Goddess."`);
        else                    disp.sln(`  \`0"${target.name} is a good looking bastard."`);
      }
      disp.sln('');
      disp.sln(`  \`0"Total worth in gold is ${pretty((target.gold || 0) + (target.bank || 0))}."`);
      disp.sln('');
      disp.sln(`  \`0"Last time we checked, ${he} had ${pretty(target.gem || 0)} \`%Gems\`0."`);
      disp.sln('');
      if ((target.kids || 0) === 0) {
        disp.sln(`  \`0"${target.name} has no offspring."`);
      } else {
        disp.sln(`  \`0"${target.name} has \`%${pretty(target.kids)}\`0 offspring.`);
      }
      if (target.horse) {
        disp.sln(`  \`0"That person owns a horse."`);
        disp.sln('');
      }
      const married = (target.married_to > -1)
        || (state.married_to_seth   === target.id)
        || (state.married_to_violet === target.id);
      if (married) {
        disp.sln('  `0"That person is married."');
        disp.sln('');
      }
      await session.more();
      continue;
    }

    if (ch === 'C' || ch === 'S') {
      disp.sln("  `0\"Tired of what you do?  I know how it is.  To figure out what you");
      disp.sln("  REALLY want to do in your life, think about your childhood.\"`2");
      disp.sln('');
      disp.sln("  `0\"Remember.  You NEVER forget what you learn in ANY profession.\"`2");
      disp.sln('');
      await chooseProfession(session, disp, true);
      continue;
    }

    if (ch === 'T') {
      disp.sln('  `0"C`3o`4l`5o`6r`7s`8?`0"`, Chance laughs, `0"They are easy."');
      disp.sln('');
      disp.sln('  `1 `2 `3 `4 `5 `6 `7 `8 `9 `0 `! `@ `# `$ `%');
      disp.sln('  `1^1 `2^2 `3^3 `4^4 `5^5 `6^6 `7^7 `8^8 `9^9 `0^0 `!^! `@^@ `#^# `$^$ `%^%');
      disp.sln('');
      disp.sln("  `5Colors are `%FUN`5! would look like...");
      disp.sln('');
      disp.sln('  `5Colors are `%FUN`5!');
      disp.sln('');
      disp.sln('  `0"Using that backtick symbol and a character, you can make any color.');
      disp.sln("  They work in the dirt and bar conversation.\"");
      disp.sln('');
      continue;
    }

    if (ch === 'P') {
      disp.sln('  `0"Ok, enter your practice line."');
      disp.sw('  `2Text `0: `%');
      const txt = await session.getStr(69);
      disp.sln('');
      disp.sln('  `0"Here is what that would look like."');
      disp.sln(`  \`2  \`%${txt}`);
      disp.sln('');
      continue;
    }
  }
}

// ── Old Man (descriptions) ────────────────────────────────────────────────────

async function talkOldMan(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('`%  ** The Old Man **');
  disp.sln(SEP);
  disp.sln('  `2An ancient fellow sits at a corner table, scratching something into the wood.');
  disp.sln('');
  disp.sln('  `2(`0V`2)iew someone\'s description');
  disp.sln('  (`0E`2)dit your own description');
  disp.sln('  (`0R`2)eturn');
  disp.sln('');

  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    const p = session.player;
    disp.sw('  `2Your command? [`0R`2] : ');
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);
    disp.sln('');

    if (ch === 'R' || ch === 'Q' || ch === '\r') return;

    if (ch === '?') {
      disp.sln('  `2(`0V`2)iew description  (`0E`2)dit your description  (`0R`2)eturn');
      disp.sln('');
      continue;
    }

    if (ch === 'V') {
      disp.sln('  `0"Who would you like to know more about?"`2');
      disp.sw('  `2Name: `%');
      const name = (await session.getStr(20)).trim();
      disp.sln('');
      if (!name) continue;

      const target = PlayerDB.findByName(name);
      if (!target) {
        disp.sln("  `0\"I don't know anyone with a name even close to that.\"`2");
        disp.sln('');
        continue;
      }
      if (target.id === p.id) {
        disp.sln('  `0"Why, I\'d hope you know what you\'ve said about yourself.."`2,');
        disp.sln('  the old man cackles.');
        disp.sln('');
        continue;
      }
      const him = target.sex === 'M' ? 'him' : 'her';
      disp.sln('  `2The Old Man thinks for a minute..');
      if (!target.has_des) {
        disp.sln(`  \`0"${target.name}?  I haven't heard anything about ${him}."`);
      } else {
        disp.sln(`  \`0"${target.name}?  I know who that is. Last I heard.."`);
        disp.sln('');
        disp.sln(`    \`2${target.des1 || ''}`);
        disp.sln(`    \`2${target.des2 || ''}`);
      }
      disp.sln('');
      continue;
    }

    if (ch === 'E') {
      disp.sln('  `0"What do you want me to remember about you?"');
      disp.sw('  `2-> `%');
      const line1 = (await session.getStr(70)).trim();
      if (!line1) {
        disp.sln('');
        continue;
      }
      disp.sln('');
      disp.sw('  `2-> `%');
      const line2 = (await session.getStr(70)).trim();
      disp.sln('');
      PlayerDB.patch(p.id, { des1: line1, des2: line2, has_des: 1 });
      session.player = PlayerDB.getById(p.id);
      disp.sln('  `2"It has been noted.."');
      disp.sln('');
      continue;
    }
  }
}

// ── Blackjack mini-game (lord.js blackjack() — 1-in-25 on exit) ──────────────

function cardName(val) {
  if (val === 1)  return 'Ace';
  if (val === 11) return 'Jack';
  if (val === 12) return 'Queen';
  if (val === 13) return 'King';
  return String(val);
}

function cardValue(val) {
  if (val >= 10) return 10;
  return val; // Ace = 1 (we add +10 for soft aces manually)
}

function handTotal(cards) {
  let total = cards.reduce((s, c) => s + cardValue(c), 0);
  // One ace can count as 11
  if (cards.includes(1) && total + 10 <= 21) total += 10;
  return total;
}

function drawCard() {
  return Math.floor(Math.random() * 13) + 1; // 1-13
}

async function blackjack(session, disp) {
  const p = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('`%  ** BLACKJACK! **');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2As you head for the door, a sharp-dressed man steps into your path.');
  disp.sln('  He fans a deck of cards in one hand with practiced ease.');
  disp.sln('');
  disp.sln('  `0\"Care for a hand of Blackjack before you go?  One gold says I can');
  disp.sln('  beat you without even trying.\"');
  disp.sln('');
  disp.sln('  `2(`%Y`2)es, deal me in   (`%N`2)o thanks');
  disp.sln('');
  disp.sw('  `2Your choice [`0N`2] : ');

  const yn = await session.getKeyUpper();
  disp.sln(yn || 'N');
  disp.sln('');
  if (yn !== 'Y') {
    disp.sln('  `2The man shrugs and lets you pass, shuffling cards absently.');
    disp.sln('');
    await session.more();
    return;
  }

  if (p.gold < 1) {
    disp.sln('  `4\"Ha!  You don\'t even have a single gold coin on you!\"');
    disp.sln('  `2He waves you away dismissively.');
    disp.sln('');
    await session.more();
    return;
  }

  // Wager
  disp.sln('  `2You have `%' + pretty(p.gold) + ' `2gold.');
  disp.sln('');
  const bet = await wager(session, disp);
  if (bet === 0) {
    disp.sln('  `2The hustler tosses his cards onto the table in disgust.');
    disp.sln('');
    await session.more();
    return;
  }

  // Deal
  let playerCards = [drawCard(), drawCard()];
  let dealerCards = [drawCard(), drawCard()];

  const showHands = (hideDealer = true) => {
    disp.sln('');
    const pc = playerCards.map(cardName).join(', ');
    disp.sln('  `2Your hand : `%' + pc + '  `2(`0' + handTotal(playerCards) + '`2)');
    if (hideDealer) {
      disp.sln('  `2Dealer    : `%' + cardName(dealerCards[0]) + '`2, [hidden]');
    } else {
      const dc = dealerCards.map(cardName).join(', ');
      disp.sln('  `2Dealer    : `%' + dc + '  `2(`0' + handTotal(dealerCards) + '`2)');
    }
    disp.sln('');
  };

  showHands();

  // Check natural blackjack
  const playerBJ = handTotal(playerCards) === 21;
  const dealerBJ = handTotal(dealerCards) === 21;

  if (playerBJ && dealerBJ) {
    showHands(false);
    disp.sln('  `%PUSH! Both have Blackjack!  Your bet is returned.');
    disp.sln('');
    await session.more();
    return;
  }
  if (playerBJ) {
    showHands(false);
    disp.sln('  `%BLACKJACK!  You win 1.5x your bet!');
    const winnings = Math.floor(bet * 1.5);
    PlayerDB.patch(p.id, { gold: Math.min(p.gold + winnings, 2000000000) });
    session.player = PlayerDB.getById(p.id);
    disp.sln('  `2You pocket `%' + pretty(winnings) + ' `2gold.');
    disp.sln('');
    await session.more();
    return;
  }

  // Player turn
  while (session.alive && handTotal(playerCards) < 21) {
    disp.sln('  `2(`%H`2)it   (`%S`2)tand');
    disp.sw('  `2Your move : ');
    const mv = await session.getKeyUpper();
    disp.sln(mv || 'S');
    disp.sln('');
    if (mv !== 'H') break;
    playerCards.push(drawCard());
    showHands();
    if (handTotal(playerCards) > 21) {
      disp.sln('  `4BUST!  You went over 21!');
      PlayerDB.patch(p.id, { gold: Math.max(0, p.gold - bet) });
      session.player = PlayerDB.getById(p.id);
      disp.sln('  `2You lose `%' + pretty(bet) + ' `2gold.');
      disp.sln('');
      await session.more();
      return;
    }
  }

  // Dealer turn — dealer hits on 16 or less
  while (handTotal(dealerCards) <= 16) {
    dealerCards.push(drawCard());
  }

  showHands(false);

  const pt = handTotal(playerCards);
  const dt = handTotal(dealerCards);

  if (dt > 21 || pt > dt) {
    disp.sln('  `%YOU WIN!');
    PlayerDB.patch(p.id, { gold: Math.min(p.gold + bet, 2000000000) });
    session.player = PlayerDB.getById(p.id);
    disp.sln('  `2You collect `%' + pretty(bet) + ' `2gold.');
  } else if (pt === dt) {
    disp.sln('  `2PUSH — nobody wins.');
  } else {
    disp.sln('  `4YOU LOSE.');
    PlayerDB.patch(p.id, { gold: Math.max(0, p.gold - bet) });
    session.player = PlayerDB.getById(p.id);
    disp.sln('  `2You lose `%' + pretty(bet) + ' `2gold.');
  }
  disp.sln('');
  await session.more();
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);
  let gamesPlayed = 0;

  showMenu(session, disp);

  while (session.alive) {
    disp.sw('  `2Your command? : ');
    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);

    if (ch === 'R' || ch === 'Q' || ch === '\r') {
      // 1-in-25 chance of the Blackjack hustler blocking the exit
      if (rand(25) === 0) {
        await blackjack(session, disp);
      }
      break;
    }

    switch (ch) {
      case 'C':
        await barConverse(session, disp);
        showMenu(session, disp);
        break;

      case 'E':
        await rankLays(session, disp);
        showMenu(session, disp);
        break;

      case 'T':
        await talkChance(session, disp);
        showMenu(session, disp);
        break;

      case 'W':
        await talkOldMan(session, disp);
        showMenu(session, disp);
        break;

      case 'G':
        gamesPlayed = await gamble(session, disp, gamesPlayed);
        showMenu(session, disp);
        break;

      case 'D': {
        const lines = LogDB.getToday();
        session.clearScreen();
        disp.sln('`%  Daily Happenings');
        disp.sln(SEP);
        disp.sln('');
        if (lines.length === 0) {
          disp.sln('  `2Nothing notable has happened today.');
        } else {
          for (const l of lines) disp.sln(l);
        }
        disp.sln('');
        await session.more();
        showMenu(session, disp);
        break;
      }

      case 'Y':
        await require('../ShowStats').showStats(session, disp);
        showMenu(session, disp);
        break;

      case '?':
        showMenu(session, disp);
        break;

      default:
        break;
    }
  }
}

module.exports = { enter };
