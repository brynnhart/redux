'use strict';

/**
 * server/game/locations/Inn.js
 *
 * Ported from lord.js red_dragon_inn() and its sub-functions:
 *   get_a_room()        line 6384
 *   talk_with_bartender() line 8090
 *   converse()          line 8459
 *   talk_to_bard()      line 9238   (Seth Able / Violet)
 *   announce()          line 9397
 *   flirt_with_violet() line 9819
 *   show_log()          line 5735
 *
 * Keys: (C)onverse (D)aily happenings (F)lirt (G)et a room
 *       (H) Talk to bard  (M)ake announcement (T)alk to bartender
 *       (V/Y) Stats  (W)rite mail  (R/Q) Return
 */

const Display        = require('../text/Display');
const PlayerDB       = require('../../db/PlayerDB');
const LogDB          = require('../../db/LogDB');
const ConversationDB = require('../../db/ConversationDB');
const StateDB        = require('../../db/StateDB');
const MailDB         = require('../../db/MailDB');

function pretty(n) { return Math.floor(n).toLocaleString(); }
function rand(n)   { return Math.floor(Math.random() * Math.max(1, n)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';
const CLASS_NAMES = ['lazy', 'warrior', 'mystical skills user', 'thief'];

// ── Persist helper ────────────────────────────────────────────────────────

function persist(session, fields) {
  const p = session.player;
  PlayerDB.patch(p.id, fields);
  session.player = PlayerDB.getById(p.id);
}

// ── Draw main inn screen ──────────────────────────────────────────────────

function drawScreen(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('  `%The Red Dragon Inn`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2You push open the heavy oak door of the Inn.  Smoke fills the air,');
  disp.sln('  and the sound of laughter greets you.  A barmaid weaves between the');
  disp.sln('  tables, and a bard plays a lively tune in the corner.');
  disp.sln('');
  showPrompt(session, disp);
}

function showPrompt(session, disp) {
  disp.sln('');
  disp.sln('  `2(`%C`2)onverse with Patrons');
  disp.sln('  (`%D`2)aily Happenings Log');
  disp.sln('  (`%F`2)lirt with Violet');
  disp.sln('  (`%G`2)et a Room  (rest for the day)');
  disp.sln('  (`%H`2)ear the Bard / Talk to Seth Able');
  disp.sln('  (`%M`2)ake an Announcement');
  disp.sln('  (`%T`2)alk to the Bartender');
  disp.sln('  (`%V`2)iew your Stats');
  disp.sln('  (`%R`2)eturn to Town Square');
  disp.sln('');
  disp.sln('  `5The Red Dragon Inn  `2(C,D,F,G,H,M,T,V,R)');
  disp.sln('');
  disp.sw(`\`2  Your command, \`0${session.player.name}\`2? : `);
}

// ── G — Get a room (lord.js get_a_room()) ────────────────────────────────

async function getARoom(session, disp) {
  const p       = session.player;
  const cost    = 400 * p.level;

  disp.sln('');
  disp.sln('');
  disp.sln('  `2The bartender approaches you at the mention of a room.');
  disp.sln(`  \`5"You want a room, eh?  That'll be \`%${pretty(cost)} \`5gold!"`);
  disp.sln('');
  disp.sw('  `2Do you agree? [`0Y`2] : `%');

  const ch = await session.prompt('', ['Y', 'N', '\r']);
  const agree = (ch !== 'N');
  disp.sln(agree ? 'Y' : 'N');

  if (!agree) {
    disp.sln('');
    disp.sln('  The bartender grunts, then walks away uninterested.');
    disp.sln('');
    await session.more();
    return false;
  }

  disp.sln('');
  disp.sln('');

  // Cha > 99 = free room
  if (p.cha > 99) {
    if (p.sex === 'M') {
      disp.sln('  "You seem like a nice guy, and I hear you\'re tough, so tell you what,');
      disp.sln('  I\'ll just give you the room for free...."');
    } else {
      disp.sln('  "Hey good lookin\'!  I\'ll be glad to give you a freebie...');
      disp.sln('  A free room I mean, of course.  Har!"');
    }
    disp.sln('');
    await session.more();
  } else {
    if (p.gold < cost) {
      disp.sln('  `4"Hey!  You stupid fool! You don\'t have that much gold!"');
      disp.sln('');
      await session.more();
      return false;
    }
    persist(session, { gold: p.gold - cost });
  }

  // Check in — will end the session (equivalent to exit(0) in original)
  session.clearScreen();
  disp.sln('');
  disp.sln('');
  disp.sln('  `%The Room At The Inn`0');
  disp.sln('`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
  disp.sln('  `2You are escorted to a small but cozy room in the Inn.');
  disp.sln('  You relax on the soft bed, and soon fall asleep, still');
  disp.sln('  wearing your armour.');
  disp.sln('');
  disp.sln('');
  disp.sln('  `2You will be refreshed when you return tomorrow.');
  disp.sln('');

  persist(session, { inn: true, on_now: false });
  await session.more();
  session.kick('checked into inn');
  return true;
}

// ── D — Daily Happenings (lord.js show_log()) ─────────────────────────────

async function showDailyLog(session, disp) {
  const renderLog = (entries) => {
    if (!entries.length) {
      disp.sln('  `2Nothing of note has happened yet today.');
    } else {
      entries.forEach(e => disp.sln(e.line));
    }
  };

  while (session.alive) {
    session.clearScreen();
    disp.sln('');
    disp.sln('  `%Daily Happenings`0');
    disp.sln(SEP);
    disp.sln('');
    renderLog(LogDB.getToday());
    disp.sln('');
    disp.sw('  `2(`5C`2)ontinue   (`5T`2)oday again   (`5Y`2)esterday  [`5C`2] : ');

    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);

    if (ch === 'T') {
      continue; // loop redraws today
    }
    if (ch === 'Y') {
      session.clearScreen();
      disp.sln('');
      disp.sln('  `%Yesterday\'s Happenings`0');
      disp.sln(SEP);
      disp.sln('');
      // Yesterday = midnight-24h to midnight
      const now      = new Date();
      const todayMid = new Date(now); todayMid.setHours(0,0,0,0);
      const yestMid  = new Date(todayMid); yestMid.setDate(yestMid.getDate() - 1);
      const entries  = LogDB.getRange(
        Math.floor(yestMid.getTime() / 1000),
        Math.floor(todayMid.getTime() / 1000)
      );
      if (!entries.length) {
        disp.sln('  `2Apparently nothing of importance happened yesterday.');
      } else {
        entries.forEach(e => disp.sln(e.line));
      }
      disp.sln('');
      await session.more();
      continue;
    }
    break; // C or any other key = exit
  }
}

// ── C — Bar Conversation (lord.js converse()) ─────────────────────────────

async function barConverse(session, disp) {
  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Conversation at the Bar`0');
  disp.sln(SEP);
  disp.sln('');

  const lines = ConversationDB.getLines('bar');
  if (!lines.length) {
    disp.sln('  `2The bar is quiet.  No one has said anything yet.');
  } else {
    lines.forEach(l => disp.sln(l));
  }

  disp.sln('');
  disp.sw('  `2(`5C`2)ontinue  (`5A`2)dd to Conversation  [`5C`2] : ');

  const ch = await session.getKeyUpper();
  if (!ch) return;
  disp.sln(ch === 'A' ? 'A' : 'C');

  if (ch !== 'A') return;

  const p = session.player;
  disp.sln('');
  disp.sln('  `2Share your feelings now.. (Max 75 chars)');
  disp.sln('');
  disp.sw('  `2> `%');

  const msg = (await session.getStr(75)).trim();
  disp.sln('');

  if (msg.length < 2) {
    disp.sln('  You decide not to speak..  You really don\'t have anything to say.');
    disp.sln('  (ENTRY NOT ENTERED)');
    await session.more();
    return;
  }

  ConversationDB.addLines('bar', [`  \`%${p.name}:`, `  \`2${msg}`], p.id);
  StateDB.patch({ last_bar: p.id });
  disp.sln('  Said!');
  await session.more();
}

// ── B — Attack in Inn (lord.js attack_in_inn()) ───────────────────────────────

async function attackInInn(session, disp) {
  const p = session.player;

  // Show sleeping warriors
  function listInnOccupants() {
    session.clearScreen();
    disp.sln('');
    disp.sln('`%  Warriors Sleeping at the Inn');
    disp.sln(SEP);
    disp.sln('');
    const sleepers = PlayerDB.getAll().filter(op =>
      op.name !== 'X' && op.inn && !op.dead && op.id !== p.id
    );
    if (sleepers.length === 0) {
      disp.sln('  `2No warriors are sleeping at the Inn right now.');
    } else {
      for (const op of sleepers) {
        disp.sln(`  \`2${op.name.padEnd(20)} Level \`%${op.level}`);
      }
    }
    disp.sln('');
  }

  listInnOccupants();

  while (session.alive) {
    disp.sln('  `5"What next, kid?"');
    disp.sln('');
    disp.sln('  `2(`5L`2)ist Warriors in the Inn');
    disp.sln('  (`5S`2)laughter Warriors in the Inn');
    disp.sln('  (`5R`2)eturn to Bar');
    disp.sln('');
    disp.sw('  `2Your choice: ');

    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);
    disp.sln('');

    if (ch === 'R' || ch === 'Q' || ch === '\r') {
      // Half-refund if they don't attack
      const refund = 400 * (p.level * 2);
      persist(session, { gold: clamp((p.gold || 0) + refund, 0, 2000000000) });
      disp.sln(`  \`5"So ya aren't going to attack anyone?  Here is half your money back...`);
      disp.sln(`  '   The other half will cover my time!" \`2the bartender laughs harshly.`);
      disp.sln('');
      await session.more();
      return;
    }

    if (ch === 'L') {
      listInnOccupants();
      continue;
    }

    if (ch === 'S') {
      disp.sln('  Who would you like to attack?');
      disp.sw('  `2Name: `%');
      const name = (await session.getStr(20)).trim();
      disp.sln('');
      if (!name) continue;

      const target = PlayerDB.findByName(name);
      if (!target) {
        disp.sln('  No warriors found.');
        disp.sln('');
        continue;
      }
      if (target.id === p.id) {
        disp.sln('  You wish to attack yourself?!!  You decide against it.');
        disp.sln('');
        continue;
      }
      const pronoun = target.sex === 'M' ? 'he' : 'she';
      const hisher  = target.sex === 'M' ? 'his' : 'her';
      if (target.dead) {
        disp.sln(`  That warrior isn't at the Inn at the moment.`);
        disp.sln(`  You recall seeing in the news that ${pronoun} was dead..`);
        disp.sln('');
        continue;
      }
      if (!target.inn) {
        disp.sln(`  That warrior is not staying at the Inn today,`);
        disp.sln(`  ${pronoun} is probably in the fields.`);
        disp.sln('');
        continue;
      }
      if (target.level + 1 < p.level) {
        disp.sln('  A child could beat that wimp!  Attack someone else!');
        disp.sln('');
        continue;
      }

      disp.sln(`  \`2You enter ${target.name}\`2s room...\`5${target.sex === 'M' ? 'He' : 'She'} is sleeping.`);
      disp.sln(`  \`2You notice ${pronoun} has a dangerous looking \`0${target.weapon}\`2 by ${hisher} bed..`);
      disp.sln(`  \`2Are you sure you want to attack ${pronoun === 'he' ? 'him' : 'her'}?`);
      disp.sln('');
      disp.sw(`  \`2Attack \`5${target.name} \`2[\`0Y\`2] :\`0`);
      const conf = await session.getKeyUpper();
      disp.sln(conf || 'Y');
      if (conf === 'N') { disp.sln(''); continue; }

      disp.sln('');
      disp.sln(`  \`2Being a trained warrior, ${pronoun} jumps up suddenly, aware of your`);
      disp.sln('  presence!');
      disp.sln('');

      // Mail the victim
      MailDB.sendMail(target.id, null,
        '  `%YOU HAVE BEEN ATTACKED IN YOUR ROOM!\n' +
        '`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-`2\n' +
        `  \`0${p.name}\`2 has broken into your room at the Inn!`
      );

      await session.more();

      // Fight using Battle system (PvP, inn flag)
      const { battle } = require('../systems/Battle');
      const enemy = {
        name:   target.name,
        str:    target.str,
        hp:     target.hp,
        def:    target.def,
        gold:   target.gold,
        weapon: target.weapon,
        exp:    target.exp || 0,
        pfight: true,
        level:  target.level,
        sex:    target.sex,
        is_arena: false,
      };
      const result = await battle(session, enemy);

      if (result === 'win') {
        // Victim loses gold
        PlayerDB.patch(target.id, { gold: 0 });
        LogDB.append(`\`2  \`0${p.name}\`2 slaughtered \`5${target.name}\`2 in their sleep!`);
      }
      return;
    }
  }
}

// ── T — Talk to Bartender (lord.js talk_with_bartender()) ────────────────

async function talkBartender(session, disp) {
  const p = session.player;

  disp.sln('');
  disp.sln('');
  disp.sln('  `2You find the bartender and ask if he will talk privately with you.');
  disp.sln('');

  if (p.level === 1) {
    disp.sln(`  \`5"I don't recall ever hearing the name \`0${p.name}\`5 before!  Get outta my face!"`);
    disp.sln('');
    await session.more();
    return;
  }

  // Bartender menu
  disp.sln('  `5Bartender\'s Services:');
  disp.sln('  `2(`0G`2)ems for Elixir         Trade 2 gems = 1 stat point');
  disp.sln('  (`0C`2)hange your name        `2Costs `%' + pretty(p.level * 500) + ' `2gold');
  disp.sln('  (`0B`2)ribe bartender         Attack sleeping warriors!  Costs `%' + pretty(p.level * 1600) + ' `2gold');
  if (p.level === 12) {
    disp.sln('  (`0D`2)ragon info');
  }
  disp.sln('  (`0R`2)eturn');
  disp.sln('');

  while (session.alive) {
    session.player = PlayerDB.getById(session.player.id);
    const pp = session.player;
    disp.sln(`  \`5"Well?"  The bartender inquires.  (\`0? for menu\`5)`);
    disp.sw('  `2Your choice : ');

    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);

    switch (ch) {
      case 'G':
        await bartenderGems(session, disp);
        break;

      case 'C':
        await bartenderChangeName(session, disp);
        break;

      case 'D':
        if (pp.level === 12) {
          disp.sln('');
          disp.sln('  `5"Ahhh...If anyone could kill that Dragon, it would be you..');
          disp.sln('  I have heard rumors that strange noises have been heard in the');
          disp.sln('  forest... You might try (`2S`5)earching the forest...My son did,"');
          disp.sln('  and never came back.');
          disp.sln('');
          await session.more();
        }
        break;

      case 'V':
        disp.sln('');
        disp.sln('  `5"Ya want to know about `#Violet`5 do ya?  She\'s a handful, I\'ll');
        disp.sln('  tell you that much.  She only goes for the type of person who');
        disp.sln('  would help old people...  A lot of Charm is what you would need."');
        disp.sln('');
        break;

      case 'S':
        disp.sln('');
        disp.sln('  `5"Ya want to know about `%Seth Able`5 the Bard, eh?  Well... He');
        disp.sln('  has a good voice, and can really play that mandolin.  He likes');
        disp.sln('  the helpful, charming type.  You\'d need a lot of Charm to catch');
        disp.sln('  his eye.  I could sure go for your type tho!  Har har!"');
        disp.sln('');
        break;

      case '?':
        disp.sln('  `2(`0G`2)ems for Elixir');
        disp.sln('  (`0C`2)hange your name');
        disp.sln('  (`0B`2)ribe bartender (attack sleepers)');
        if (pp.level === 12) disp.sln('  (`0D`2)ragon info');
        disp.sln('  (`0R`2)eturn');
        disp.sln('');
        break;

      case 'B': {
        const bribeCost = pp.level * 1600;
        disp.sln('');
        disp.sln('  `5"Ahh.. Bribe.. Now you are speaking my language friend!');
        disp.sln('  I will let you borrow my room keys.. on one condition..');
        disp.sln(`  That ya pay me \`%${pretty(bribeCost)}\`5 gold!!"`);
        disp.sw('  `2Deal? [`0N`2] : `%');
        const bc = await session.getKeyUpper();
        disp.sln(bc || 'N');
        if (bc !== 'Y') {
          disp.sln('');
          disp.sln('  `5"Fine.. Forget I offered that deal to you.."');
          disp.sln('');
          break;
        }
        if (pp.gold < bribeCost) {
          disp.sln('');
          disp.sln('  `4"Hey! You slobbering idiot! You don\'t have that much gold!"');
          disp.sln('');
          break;
        }
        persist(session, { gold: pp.gold - bribeCost });
        await attackInInn(session, disp);
        if (session.player.dead) return;
        break;
      }

      case 'R':
      case 'Q':
      case '\r':
        return;

      default:
        break;
    }
  }
}

async function bartenderGems(session, disp) {
  const p = session.player;
  disp.sln('');
  disp.sln(`  \`5"You have \`%Gems\`5, eh?  I'll give ya a pint of magic elixir for two."`);
  disp.sln(`  \`2You have \`%${pretty(p.gem)} \`2gems.  (Max elixirs: \`%${Math.floor(p.gem/2)}\`2)`);
  disp.sln('');
  disp.sw(`  \`2Buy how many elixirs?  [\`0${Math.floor(p.gem/2)}\`2] : \`%`);

  const input = (await session.getStr(10, { allowed: /[0-9]/ })).trim();
  let   i     = parseInt(input, 10);
  disp.sln('');

  if (!input || isNaN(i) || i === 0) {
    disp.sln('  `5"They are very valuable, please reconsider it.."');
    await session.more();
    return;
  }
  if (i < 0) {
    disp.sln('  `5"Ha.. Like I\'m really gonna give you a negative amount, idiot."');
    await session.more();
    return;
  }
  if (i > 2000000) {
    disp.sln('  `5"Ha!  There isn\'t enough brew in all the world for that much!"');
    await session.more();
    return;
  }
  if (p.gem / 2 < i) {
    disp.sln(`  \`5"You don't have \`%${pretty(i*2)} \`5Gems.  Find some..."`);
    await session.more();
    return;
  }

  // Brew size description
  let vessel;
  if (i === 1) vessel = 'small cup';
  else if (i <= 5) vessel = 'steaming mug';
  else if (i <= 9) vessel = 'huge tankard';
  else vessel = "keg 'o brew";

  p.gem -= i * 2;

  disp.sln(`  \`2The bartender retrieves a \`%${vessel}\`2 from the back room.`);
  disp.sln('  Before you drink it, what do you wish for?');
  disp.sln('');
  disp.sln('  `2(`0H`2)it Points max');
  disp.sln('  (`%S`2)trength');
  disp.sln('  (`0V`2)itality (Defense)');
  disp.sln('');
  disp.sw('  `2Your choice [`0V`2] : ');

  const stat = await session.getKeyUpper();
  disp.sln(stat || 'V');
  disp.sln('');

  const choice = (['H','S','V'].includes(stat)) ? stat : 'V';

  if (choice === 'H') {
    disp.sln('  `%YOU DRINK THE BREW AND FEEL REFRESHED!');
    disp.sln('');
    const newMax = clamp(p.hp_max + i, 0, 32000);
    persist(session, { gem: p.gem, hp_max: newMax, hp: Math.min(session.player.hp, newMax) });
  } else if (choice === 'S') {
    disp.sln('  `%YOU DRINK THE BREW AND FEEL STRONGER!');
    disp.sln('');
    persist(session, { gem: p.gem, str: clamp(p.str + i, 0, 32000) });
  } else {
    disp.sln('  `%YOU DRINK THE BREW AND YOUR SOUL REJOICES!');
    disp.sln('');
    persist(session, { gem: p.gem, def: clamp(p.def + i, 0, 32000) });
  }
  await session.more();
}

async function bartenderChangeName(session, disp) {
  const p    = session.player;
  const cost = p.level * 500;

  disp.sln('');
  disp.sln(`  \`5"Ya wanna change your name, eh?  Yeah..`);
  disp.sln(`  \`0${p.name}\`5 the ${CLASS_NAMES[p.clss]} does sound kinda funny..`);
  disp.sln(`  it would cost ya \`%${pretty(cost)}\`5 gold... Deal?"`);
  disp.sw('  `2Change your name?  [`0N`2] : `%');

  const confirm = await session.prompt('', ['Y', 'N', '\r']);
  disp.sln(confirm === 'Y' ? 'Y' : 'N');

  if (confirm !== 'Y') {
    disp.sln(`  \`5"Fine.. Keep your stupid name.. See if I care.."`);
    disp.sln('');
    await session.more();
    return;
  }

  if (p.gold < cost) {
    disp.sln('');
    disp.sln('  `4"Hey!  You stupid fool! You don\'t have that much gold!"');
    disp.sln('');
    await session.more();
    return;
  }

  persist(session, { gold: p.gold - cost });

  while (session.alive) {
    disp.sln('');
    disp.sln('  `5"What would you like as an alias?"');
    disp.sw('  `2NAME: `%');

    const newName = (await session.getStr(18)).trim();
    disp.sln('');

    if (newName.length > 18) {
      disp.sln('  `4"Try a shorter name ya stupid, ugly troll!"');
      continue;
    }
    if (newName.length < 3) {
      disp.sln('  `4"Try a longer name, bonehead!"');
      continue;
    }

    // Check uniqueness
    const allPlayers = PlayerDB.getAll();
    const taken = allPlayers.find(pl => pl.name.trim().toLowerCase() === newName.toLowerCase() && pl.id !== session.player.id);
    if (taken) {
      disp.sln(`  \`2You recall hearing that another warrior currently goes by that name.`);
      disp.sln(`  Not wanting to dishonor them, you decide to pick another.`);
      continue;
    }

    disp.sw(`  \`5"${newName}?  That's kinda flaky, you sure?"  \`2[\`0Y\`2] : \`%`);
    const sure = await session.prompt('', ['Y', 'N', '\r']);
    disp.sln(sure === 'N' ? 'N' : 'Y');

    if (sure === 'N') continue;

    // Update state hero name if they were the hero
    const state = StateDB.get();
    if (state.latesthero === session.player.name) {
      StateDB.patch({ latesthero: newName });
    }

    persist(session, { name: newName });
    disp.sln('');
    disp.sln('');
    disp.sln(`  \`%"Done!  You are now \`0${newName}\`%!"`);
    disp.sln('');
    await session.more();
    return;
  }
}

// ── H — Talk to Bard: Seth Able (lord.js talk_to_bard()) ─────────────────

async function talkBard(session, disp) {
  const p     = session.player;
  const state = StateDB.get();

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%The Bard\'s Corner`0');
  disp.sln(SEP);
  disp.sln('');

  const sethMarried = (state.married_to_seth === p.id);
  if (sethMarried) {
    disp.sln('  `2Seth Able looks up from his mandolin and beams at you.');
    disp.sln('  He pats the stool beside him invitingly.');
  } else {
    disp.sln('  `2Seth Able glances over and gives you a warm smile.');
    disp.sln('  His fingers dance skillfully over the mandolin strings.');
  }
  disp.sln('');
  disp.sln('  (`%A`2)sk for a song');
  disp.sln('  (`%F`2)lirt with Seth');
  disp.sln('  (`%R`2)eturn');
  disp.sln('');

  while (session.alive) {
    const married = (state.married_to_seth && state.married_to_seth === p.id);
    if (married) {
      disp.sln('  `2Seth Able looks at you lovingly.  (`0? for menu`2)');
    } else {
      disp.sln('  `2Seth Able looks at you expectantly.  (`0? for menu`2)');
    }
    disp.sw('  `2Your choice : ');

    const ch = await session.getKeyUpper();
    if (!ch) break;
    disp.sln(ch);

    switch (ch) {
      case 'A':
        await bardSong(session, disp);
        break;

      case 'F':
        await sethFlirt(session, disp);
        break;

      case '?':
        disp.sln('  (`%A`2)sk for a song');
        disp.sln('  (`%F`2)lirt with Seth');
        disp.sln('  (`%R`2)eturn');
        disp.sln('');
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

async function bardSong(session, disp) {
  const songs = [
    ['  `2Seth tunes his mandolin for a moment, then launches into',
     '  a breathtaking ballad.  The entire inn goes quiet.',
     '  When he finishes, the place erupts in applause!'],
    ['  `2Seth clears his throat and begins a rousing drinking song.',
     '  Everyone in the inn joins in the chorus!'],
    ['  `2Seth plays a haunting melody that seems to drift through',
     '  the smoky air.  Several warriors look thoughtful.'],
    ['  `2Seth strums a cheerful tune and winks at the crowd.',
     '  Violet tosses him a coin.'],
  ];
  disp.sln('');
  songs[rand(songs.length)].forEach(l => disp.sln(l));
  disp.sln('');
  await session.more();
}

async function sethFlirt(session, disp) {
  const p     = session.player;
  const state = StateDB.get();

  if (p.seen_violet) {
    disp.sln('');
    disp.sln('  `2You feel you had better not go too fast, maybe tomorrow.');
    disp.sln('');
    await session.more();
    return;
  }

  disp.sln('');

  // Seth is already married (not to this player)
  if (state.married_to_seth > 0 && state.married_to_seth !== p.id) {
    const owner = PlayerDB.getById(state.married_to_seth);
    disp.sln('  `2You are about to give Seth your best, when he turns away.');
    disp.sln('  You see a shiny new `0ring `2on his hand.');
    if (owner) {
      disp.sln('  You notice it matches the one worn by \`0' + owner.name + '\`2.');
    }
    disp.sln('');
    await session.more();
    persist(session, { seen_violet: true });
    return;
  }

  // Married to this player
  if (state.married_to_seth === p.id) {
    const responses = [
      '  `0"I love you, you know that?"',
      '  `2Seth gives you a warm smile and squeezes your hand.',
      '  `0"I\'d love to linger, but duty calls."',
      '  `0"We\'ll have plenty of time for that tonight!"',
      '  `2In the roar of the crowd, he doesn\'t hear.  You don\'t mind.',
      '  `0"After work, you\'re mine!" `2he laughs.',
    ];
    disp.sln(responses[rand(responses.length)]);
    disp.sln('');
    persist(session, { seen_violet: true });
    await session.more();
    return;
  }

  // Single Seth — flirt options
  disp.sln('  (`%W`2)ink at Seth');
  disp.sln('  (`%C`2)ompliment his playing');
  disp.sln('  (`%S`2)educe him');
  disp.sln('  (`%A`2)sk him to marry you');
  disp.sln('  (`%R`2)eturn');
  disp.sln('');
  disp.sw('  `2Your move : ');

  const act = await session.getKeyUpper();
  if (!act) return;
  disp.sln(act);
  disp.sln('');

  if (act === 'R' || act === 'Q') return;

  if (act === 'W') {
    persist(session, { seen_violet: true });
    disp.sln('  `%You wink at Seth Able across the room..');
    if (p.cha >= 1) {
      disp.sln('  `2He blushes and smiles back at you!');
      disp.sln('  You are making progress!');
      disp.sln('');
      disp.sln('  \`%You receive \`0' + pretty(p.level*5) + ' \`%experience!');
      persist(session, { exp: clamp(p.exp + p.level*5, 0, 2000000000), seen_violet: true });
    } else {
      disp.sln('  `4He looks the other way!');
      disp.sln('  You nearly die of embarrassment!');
    }
  } else if (act === 'C') {
    persist(session, { seen_violet: true });
    disp.sln('  `%You tell Seth his playing is the finest you\'ve ever heard..');
    if (p.cha >= 2) {
      disp.sln('  `2He beams and launches into a little flourish just for you!');
      disp.sln('  Your relationship with him is taking off!');
      disp.sln('');
      disp.sln('  \`%You receive \`0' + pretty(p.level*10) + ' \`%experience!');
      persist(session, { exp: clamp(p.exp + p.level*10, 0, 2000000000), seen_violet: true });
    } else {
      disp.sln('  `2He nods politely but looks unconvinced.');
      disp.sln('  \`4YOU LOSE \`%' + pretty(p.level) + ' \`4HIT POINTS from wounded pride!');
      persist(session, { hp: Math.max(1, p.hp - p.level), seen_violet: true });
    }
  } else if (act === 'S') {
    persist(session, { seen_violet: true });
    if (p.married_to > -1) {
      disp.sln('  `2Seth Able is appalled that you would even suggest such a thing!');
      disp.sln('  He loudly announces your shamelessness to the entire bar!');
      LogDB.append('\`5  Seth Able \`2announces the shameless behaviour of \`0' + p.name + '\`2!');
    } else if (p.cha >= 32) {
      const outcome = rand(4);
      if (outcome === 2) {
        disp.sln('  `2He smiles invitingly and sets his mandolin aside...');
        disp.sln('');
        disp.sln('  `2Hours later you saunter downstairs.  When a bearded drunk');
        disp.sln('  asks what all the racket was, you smile knowingly.');
        disp.sln('  The drunks are mystified!');
        disp.sln('');
        disp.sln('  \`0YOU GET \`%' + pretty(p.level*40) + ' \`0EXPERIENCE!');
        LogDB.append('\`0  ' + p.name + ' \`2spent quality time with \`%Seth Able\`2!');
        persist(session, {
          exp: clamp(p.exp + p.level*40, 0, 2000000000),
          laid: p.laid + 1,
          seen_violet: true
        });
      } else {
        const excuses = [
          'he has a headache.',
          'he is not in the mood.',
          'he is too exhausted from last night.',
          'he has to practice.',
        ];
        disp.sln('  `2He regretfully tells you ' + excuses[rand(excuses.length)]);
        disp.sln('  You are very disappointed.');
      }
    } else {
      disp.sln('  `2He looks horrified and backs away sharply!');
      disp.sln('  The entire bar erupts in laughter at your misfortune!!');
      disp.sln('');
      disp.sln('  `4YOUR HITPOINTS GO DOWN TO 1!');
      LogDB.append('\`5  ' + p.name + ' \`2was publicly rejected by \`%Seth Able\`2!');
      persist(session, { hp: 1, seen_violet: true });
    }
  } else if (act === 'A') {
    await sethMarriageProposal(session, disp);
    return;
  }

  disp.sln('');
  await session.more();
}

async function sethMarriageProposal(session, disp) {
  const p     = session.player;
  const state = StateDB.get();

  if (p.married_to > -1) {
    disp.sln('  `2You\'re already married!  You can\'t propose to Seth!');
    disp.sln('');
    persist(session, { seen_violet: true });
    await session.more();
    return;
  }

  if (p.cha < 50) {
    disp.sln('  `2Seth Able blushes but shakes his head gently.');
    disp.sln('  \`5"You need at least \`%50 \`5charm before I could even consider it, love."');
    disp.sln('');
    persist(session, { seen_violet: true });
    await session.more();
    return;
  }

  disp.sln('  `2You get down on one knee...');
  disp.sln('');
  await session.more();

  const freshState = StateDB.get();
  if (freshState.married_to_seth > 0 && freshState.married_to_seth !== p.id) {
    const owner = PlayerDB.getById(freshState.married_to_seth);
    disp.sln('  `c                        `%** THE BLESSED DAY ARRIVES **`0');
    disp.sln(SEP);
    disp.sln('  `2As you walk up to the chapel, you see Seth walking out...');
    if (owner) disp.sln('  arm in arm with \`0' + owner.name + '\`2!');
    disp.sln('');
    await session.more();
    return;
  }

  StateDB.patch({ married_to_seth: p.id });
  disp.sln('  `c                        `%** THE BLESSED DAY ARRIVES **`0');
  disp.sln(SEP);
  disp.sln('  `2Seth Able agrees to marry you!');
  disp.sln('');
  disp.sln('  After a short ceremony you are finally able to take him in your arms.');
  disp.sln('');
  disp.sln('  He agrees to cut back on performances to spend more time with you.');
  disp.sln('');
  disp.sln('  \`%YOU RECEIVE \`0' + pretty(1000 * p.level) + ' \`%EXPERIENCE!');
  LogDB.append('\`%  Seth Able\`2 has \`%MARRIED \`0' + p.name + '\`2!  He hangs up his mandolin for love!');

  persist(session, {
    exp: clamp(p.exp + p.level*1000, 0, 2000000000),
    married_to: -2,
    seen_violet: false,
  });
  disp.sln('');
  await session.more();
}

// ── F — Flirt with Violet (lord.js flirt_with_violet()) ──────────────────

async function flirtViolet(session, disp) {
  const p     = session.player;
  const state = StateDB.get();

  disp.sln('');
  disp.sln('');

  // Violet is already married (not to this player)
  if (state.married_to_violet > 0 && state.married_to_violet !== p.id) {
    if (p.seen_violet) {
      disp.sln('  `2You are still shaking from your last encounter with `4Grizelda`2!');
      disp.sln('');
      await session.more();
      return;
    }
    // Grizelda encounter — works for anyone who tries to flirt with a taken Violet
    disp.sln('  You whistle loudly for the barmaid, hardly containing your excitement,');
    disp.sln('  but when you reach out...');
    disp.sln('');
    await session.more();
    disp.sln('  `4YOU FEEL HUGE LUMPS OF CELLULITE!');
    disp.sln('');
    disp.sln('  `2The obese barmaid introduces her portly self as `4Grizelda`2!');
    disp.sln('');
    const owner = PlayerDB.getById(state.married_to_violet);
    if (owner) {
      disp.sln('  You suddenly remember seeing something in the news about \`0' + owner.name + '\`2');
      disp.sln('  marrying Violet!  As Grizelda grabs you for a kiss, her buckteeth jab');
      disp.sln('  you painfully.  You curse \`0' + owner.name + '\`2 as you scream in horror.');
    }
    disp.sln('');
    persist(session, { seen_violet: true });
    await session.more();
    return;
  }

  // Violet is married to this player
  if (state.married_to_violet === p.id) {
    const responses = [
      '  `#"I love you too, darling!"',
      '  `2Violet gives you a warm kiss on the cheek.',
      '  `#"I\'d love to, but I\'m working tonight."',
      '  `#"We\'ll have plenty of time for that later!"',
      '  `2In the noise of the bar, she doesn\'t hear.  She winks at you anyway.',
      '  `#"After closing time, you\'re mine!" `2she laughs.',
    ];
    disp.sln(responses[rand(responses.length)]);
    disp.sln('');
    persist(session, { seen_violet: true });
    await session.more();
    return;
  }

  // Already flirted today
  if (p.seen_violet) {
    disp.sln('  `2You feel you had better not go too fast, maybe tomorrow.');
    disp.sln('');
    await session.more();
    return;
  }

  // Single Violet — flirt interaction
  await singleViolet(session, disp);
}

async function singleViolet(session, disp) {
  const p = session.player;

  disp.sln('  `2You catch the eye of `#Violet`2, the barmaid.');
  disp.sln('  She tosses her long hair and smiles.');
  disp.sln('');
  disp.sln('  (`%W`2)ink at Violet');
  disp.sln('  (`%C`2)ompliment her');
  disp.sln('  (`%S`2)educe her');
  disp.sln('  (`%A`2)sk her to marry you');
  disp.sln('  (`%R`2)eturn');
  disp.sln('');
  disp.sw('  `2Your move : ');

  const act = await session.getKeyUpper();
  if (!act) return;
  disp.sln(act);
  disp.sln('');

  if (act === 'R' || act === 'Q') return;

  if (act === 'W') {
    persist(session, { seen_violet: true });
    disp.sln('  `%You wink at Violet suggestively..');
    if (p.cha >= 1) {
      disp.sln('  `#She blushes and smiles back at you!');
      disp.sln('  `2You are making progress!');
      disp.sln('');
      disp.sln('  \`%You receive \`0' + pretty(p.level*5) + ' \`%experience!');
      persist(session, { exp: clamp(p.exp + p.level*5, 0, 2000000000), seen_violet: true });
    } else {
      disp.sln('  `2She rolls her eyes and walks away!');
      disp.sln('  You nearly die of embarrassment!');
    }
  } else if (act === 'C') {
    persist(session, { seen_violet: true });
    if (p.cha >= 10) {
      disp.sln('  `#Violet smiles broadly.  "Why thank you, kind warrior!"');
      disp.sln('  \`%You receive \`0' + pretty(p.level*10) + ' \`%experience!');
      persist(session, { exp: clamp(p.exp + p.level*10, 0, 2000000000), seen_violet: true });
    } else {
      disp.sln('  `2Violet doesn\'t seem impressed.  "Sure, whatever," she mutters.');
    }
  } else if (act === 'S') {
    persist(session, { seen_violet: true });
    if (p.married_to > -1) {
      disp.sln('  `2Violet is appalled that you would even suggest such a thing!');
      disp.sln('  She loudly announces your shamelessness to the entire bar!');
      LogDB.append('\`5  Violet \`2announces the shameless behaviour of \`0' + p.name + '\`2!');
    } else if (p.cha >= 32) {
      const outcome = rand(4);
      if (outcome === 2) {
        disp.sln('  `2She smiles invitingly and sets her tray down...');
        disp.sln('');
        disp.sln('  `2Hours later you saunter downstairs.  When a bearded drunk');
        disp.sln('  asks what all the racket was, you smile knowingly.');
        disp.sln('  The drunks are mystified!');
        disp.sln('');
        disp.sln('  \`0YOU GET \`%' + pretty(p.level*40) + ' \`0EXPERIENCE!');
        LogDB.append('\`0  ' + p.name + ' \`2spent quality time with \`#Violet\`2!');
        persist(session, {
          exp: clamp(p.exp + p.level*40, 0, 2000000000),
          laid: p.laid + 1,
          seen_violet: true
        });
      } else {
        const excuses = [
          'she has a headache.',
          'she is not in the mood.',
          'she is too exhausted from last night.',
          'she has tables to serve.',
        ];
        disp.sln('  `2She regretfully tells you ' + excuses[rand(excuses.length)]);
        disp.sln('  You are very disappointed.');
      }
    } else {
      disp.sln('  `2She looks horrified and slaps you with her tray!');
      disp.sln('  The entire bar erupts in laughter at your misfortune!!');
      disp.sln('');
      disp.sln('  `4YOUR HITPOINTS GO DOWN TO 1!');
      LogDB.append('\`5  ' + p.name + ' \`2was slapped by \`#Violet\`2 in front of the whole bar!');
      persist(session, { hp: 1, seen_violet: true });
    }
  } else if (act === 'A') {
    await violetMarriage(session, disp);
    return;
  }

  disp.sln('');
  await session.more();
}

async function violetMarriage(session, disp) {
  const p     = session.player;
  const state = StateDB.get();

  if (p.married_to > -1) {
    disp.sln('  You\'re already married!  You can\'t propose to Violet!');
    disp.sln('');
    persist(session, { seen_violet: true });
    await session.more();
    return;
  }

  if (p.cha < 50) {
    disp.sln('  `#Violet laughs in your face!');
    disp.sln(`  \`2"You need at least \`%50 \`2charm to even think about it, honey!"`);
    disp.sln('');
    persist(session, { seen_violet: true });
    await session.more();
    return;
  }

  disp.sln('  `2You get down on one knee...');
  disp.sln('');
  await session.more();

  // Check if someone else married her in the meantime
  const freshState = StateDB.get();
  if (freshState.married_to_violet && freshState.married_to_violet !== p.id) {
    const owner = PlayerDB.getById(freshState.married_to_violet);
    disp.sln('  `c                        `%** THE BLESSED DAY ARRIVES **`0');
    disp.sln(SEP);
    disp.sln('  `2As you walk up to the chapel, you see Violet walking out...');
    if (owner) disp.sln(`  on the arm of \`0${owner.name}\`2!`);
    disp.sln('');
    await session.more();
    return;
  }

  StateDB.patch({ married_to_violet: p.id });
  disp.sln('  `c                        `%** THE BLESSED DAY ARRIVES **`0');
  disp.sln(SEP);
  disp.sln('  `2Violet agrees to marry you!');
  disp.sln('');
  disp.sln('  After a short ceremony you are finally able to take her into your arms.');
  disp.sln('  (Well, you\'ve done that quite a few times, but not as your wife!)');
  disp.sln('');
  disp.sln('  She agrees to quit her job and take care of your house.');
  disp.sln('');
  disp.sln(`  \`%YOU RECEIVE \`0${pretty(1000 * p.level)} \`%EXPERIENCE!`);
  LogDB.append(`\`2  \`#Violet\`2 has \`%MARRIED \`0${p.name}\`2!!!!!\n\`2  She \`%QUITS\`2 her job at the bar to the towns dismay!`);

  persist(session, {
    exp: clamp(p.exp + p.level*1000, 0, 2000000000),
    married_to: -2,       // -2 = married to Violet (NPC)
    seen_violet: false,
  });
  disp.sln('');
  await session.more();
}

// ── M — Make Announcement — delegated to shared Announce module ──────────

const { makeAnnouncement } = require('../Announce');

// ── Entry point ───────────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);

  // Clear inn flag when they enter (they're awake now)
  if (session.player.inn) {
    persist(session, { inn: false });
  }

  drawScreen(session, disp);

  while (session.alive) {
    const ch = await session.getKeyUpper();
    if (!ch || !session.alive) break;
    disp.sln(ch);

    switch (ch) {
      case 'G': {
        const checked = await getARoom(session, disp);
        if (checked) return; // session ended (kicked)
        drawScreen(session, disp);
        break;
      }

      case 'D':
        await showDailyLog(session, disp);
        drawScreen(session, disp);
        break;

      case 'C':
        await barConverse(session, disp);
        drawScreen(session, disp);
        break;

      case 'T':
        await talkBartender(session, disp);
        if (session.player.dead) return;
        drawScreen(session, disp);
        break;

      case 'H':
        await talkBard(session, disp);
        drawScreen(session, disp);
        break;

      case 'F':
        await flirtViolet(session, disp);
        drawScreen(session, disp);
        break;

      case 'M':
        await makeAnnouncement(session, disp);
        drawScreen(session, disp);
        break;

      case 'V':
      case 'Y': {
        const p = session.player;
        disp.sln('');
        disp.sln(`\`2  HP   : \`%${pretty(p.hp)}\`2 / \`%${pretty(p.hp_max)}`);
        disp.sln(`\`2  STR  : \`%${pretty(p.str)}   \`2DEF: \`%${pretty(p.def)}`);
        disp.sln(`\`2  Gold : \`%${pretty(p.gold)}   \`2Gems: \`%${pretty(p.gem)}`);
        disp.sln(`\`2  EXP  : \`%${pretty(p.exp)}`);
        disp.sln('');
        showPrompt(session, disp);
        break;
      }

      case 'W':
        await require('./WriteMail').enter(session);
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
        showPrompt(session, disp);
        break;
    }
  }
}

module.exports = { enter };
