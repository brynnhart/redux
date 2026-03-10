'use strict';

/**
 * server/game/locations/WriteMail.js
 *
 * Ported from lord.js compose_mail() / write_mail() / find_player() / romance()
 * Lines: find_player 4890, write_mail 3179, romance 4956, compose_mail 4990
 *
 * Flow:
 *   1. Find recipient by partial name match
 *   2. If opposite sex and never flirted → offer romantic message option
 *      Romantic options: (F)latter, (A)sk for kiss, (B)uy dinner, (I)nvite to inn, (P)ropose
 *   3. Otherwise (or if romantic skipped) → compose plain multi-line message
 *   4. Deliver via MailDB.sendMail()
 *
 * check_mail() is handled separately in WSHandler/GameEngine at session start.
 */

const Display  = require('../text/Display');
const { getPronouns, cap } = require('../utils/pronouns');
const PlayerDB = require('../../db/PlayerDB');
const MailDB   = require('../../db/MailDB');
const LogDB    = require('../../db/LogDB');
const StateDB  = require('../../db/StateDB');

function rand(n) { return Math.floor(Math.random() * Math.max(1, n)); }

const SEP = '`2-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-';

// ── Format date for mail header (matching lord.js format_date) ────────────

function formatDate() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Find player by partial name match (lord.js find_player()) ────────────

async function findPlayer(session, disp) {
  const p = session.player;

  disp.sln('');
  disp.sln('  `2(full or `0PARTIAL`2 name)');
  disp.sw('  NAME: `%');

  const input = (await session.getStr(20)).trim();
  disp.sln('');

  if (!input) return null;

  const ucInput = input.toUpperCase();
  const all     = PlayerDB.getAll();

  for (const op of all) {
    if (op.id === p.id) continue;               // skip self
    if (op.name.trim() === 'X') continue;        // deleted placeholder

    if (op.name.toUpperCase().includes(ucInput)) {
      disp.sw(`\`2  You mean "\`0${op.name}\`2"?  [\`%Y\`2] : `);
      const ch = await session.prompt('', ['Y', 'N', '\r']);
      disp.sln(ch === 'N' ? 'N' : 'Y');
      disp.sln('');
      if (ch !== 'N') return op;
    }
  }

  disp.sln('  `%No matching names found.');
  disp.sln('');
  return null;
}

// ── Build and send a formatted mail message ───────────────────────────────

function buildHeader(sender, date) {
  return [
    '`.  ',
    `\`.\`0  ${sender.name}\`2 sent you this on ${date}`,
    '`.\`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\`2',
  ].join('\n');
}

// ── Multi-line message composer (lord.js write_mail()) ───────────────────

async function composePlainMail(session, disp, recipient) {
  const p    = session.player;
  const date = formatDate();

  // Greeting shown if player sends blank first line (matches original "derps")
  const derps = [
    '  Greetings.  How fare you, traveler?',
    '  Well met.  Any news you can share?',
    '  How goes it, fellow adventurer?',
    '  Didn\'t I see you on that table in the Dark Cloak tavern?',
    '  Sorry - I forgot what I was going to say, old bean.',
  ];

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Write Mail`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln(`\`2  To: \`0${recipient.name}`);
  disp.sln(`\`2  From: \`0${p.name}`);
  disp.sln(`\`2  Date: \`0${date}`);
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2Enter message now..  Blank line quits!');
  disp.sln('  `2(Max 75 chars per line, up to 20 lines)');
  disp.sln('');

  const bodyLines = [];

  while (bodyLines.length < 20 && session.alive) {
    disp.sw('  `2> `%');
    const line = (await session.getStr(75)).trim();
    disp.sln('');

    // Blank line = done (or auto-derp on first line)
    if (!line) {
      if (bodyLines.length === 0) {
        bodyLines.push(`  ${derps[rand(derps.length)]}`);
      }
      break;
    }
    bodyLines.push(`  ${line}`);
  }

  // Build full message body with header
  const fullBody = [
    buildHeader(p, date),
    ...bodyLines.map(l => `\`%${l}`),
  ].join('\n');

  MailDB.sendMail(recipient.id, p.id, fullBody);

  // Self-mail easter egg
  if (recipient.id === p.id) {
    disp.sln('  You are a very stupid individual.');
    disp.sln('');
  } else {
    disp.sln(`  \`2Mail sent to \`0${recipient.name}\`2!`);
    disp.sln('');
  }
  await session.more();
}

// ── Romance helpers (lord.js romance()) ──────────────────────────────────

const ROMANCE_OPTS = {
  F: {
    label: '(F)latter',
    mOpts: [
      'I like, um, think you are, uh, nice?',
      'You are just as cute as my dog!',
      'You have like, big uh, thingies.',
      'Your lips are like roses.',
      "May I drink in your beauty?  You're a tankard of joy!",
      "I'd pick up yer hankie anywheres! Hyuck!",
    ],
    fOpts: [
      'I like, um, think you are, uh, nice?',
      'You are just as cute as my dog!',
      'I like the way you kill people.',
      "I've been watching you for a while...",
      'Might I let you know that you are handsome?',
      'Ya wanna do something sometime, somewhere?',
    ],
  },
  A: {
    label: '(A)sk for a Kiss',
    mOpts: [
      'Gimmie a kiss, woman!',
      'Git over here, you!',
      'Please give me the honor of touching your lips.',
      "I'm an explorer.  Can I explore your mouth?",
      'Kiss me, I use a mouth wash!',
      "Uh, if you kiss me, I'll turn back into a prince.",
    ],
    fOpts: [
      'Kiss me you big hunk of man!',
      'Pleeeeeeeeease kiss me!',
      "I'm an adventurer.  Can I explore your mouth?",
      'If you kiss me, our relationship might grow.',
      'Kiss me, lover!  I brush regularly.',
      'Can I teach you a french custom I know?',
    ],
  },
  B: {
    label: '(B)uy Dinner',
    mOpts: [
      'Please let me buy you dinner.  It will be good.',
      "Let me take you out - I won't expect you to put out!",
      'No obligations - Just dinner, baby.',
      "You ever eat at the Red Dragon Inn?  It's on me.",
      'Come on sweet thing, I know you wanna eat!',
      "Please?  I'll cook Dragon for ya!",
    ],
    fOpts: [
      "I'm not a feminist, but I'll pay for it!",
      'Pleeeeeeeeease let me buy you a warm meal.',
      "I'll cook it myself!  A woman's place is the kitchen!",
      "If you're not busy, I'd REALLY appreciate the company.",
      "I'll give you a real meal - Not crap.",
      "If you clean your plate, I'll even dance for you!",
    ],
  },
  I: {
    label: '(I)nvite to Inn',
    mOpts: [
      'Um, do you uh, um, think you could, uh.. wanna do it?',
      'Glorious girl.  Please be my valentine.  Tonight.',
      'Come take a ride on the wild stallion, baby!',
      'Make me a man tonight, honey!  Pleeeeeease?!',
      "I know you want my body, I know you think I'm sexy...",
      "I've been waiting to ask you all my life for this.",
    ],
    fOpts: [
      "I'll pleasure you like no one has ever pleasured a man.",
      "Say yes, honey.  I swear I'll be here in the morning.",
      "Say yes.  Your body says yes, listen to it.",
      "Do it!  I swear I've been tested recently..I think?",
      "You'll never regret a night spent with me, studmuffin.",
      "If you say no, I'll never ask again!",
    ],
  },
  P: {
    label: '(P)ropose Marriage',
    mOpts: [
      'Would you do me the honor of being my wife?',
      'I love you.  Marry me.',
      'Be my wife.  Make me the happiest man in the world.',
      "Please - I've watched you for the longest time..",
      "Say yes!  It's such a wonderful easy word!",
      'I cannot live another day without you.',
    ],
    fOpts: [
      'Would you do me the honor of being my husband?',
      'I love you.  Marry me.',
      'Be mine.  Make me the happiest woman in the world.',
      "Please - I've watched you for the longest time..",
      'Marry me...So I can say "I gotta man!"...',
      "I've put my heart on my sleeve.  Don't break it.",
    ],
  },
};

async function sendRomanceMail(session, disp, recipient, kind) {
  const p      = session.player;
  const config = ROMANCE_OPTS[kind];
  const opts   = (p.sex === 'male' || p.sex === 'M') ? config.mOpts : config.fOpts;
  const hint   = opts[rand(opts.length)];

  disp.sln('');
  disp.sw(`  \`2Worded how?  [\`0${hint}\`2] : \`%`);

  // Pre-fill with suggestion — player can edit or accept
  const line = (await session.getStr(53)).trim() || hint;
  disp.sln('');
  disp.sln('');

  if (line.length < 5) {
    disp.sln("  Somehow you don't think that will convince them...");
    disp.sln('');
    await session.more();
    return false;
  }

  disp.sln('  `%** WRITING ROMANTIC MAIL, PLEASE WAIT **');
  disp.sln('');

  const _mPr      = getPronouns(p.sex);
  const pronoun   = _mPr.possessive;
  const ppronoun  = _mPr.object;

  const notifLines = {
    F: `  \`2${p.name} is flirting with you!`,
    A: `  \`2${p.name} wants you to kiss ${ppronoun}!`,
    B: `  \`2${p.name} wants to treat you to dinner!`,
    I: `  \`2${p.name} wants you to join ${ppronoun} in a night of\n  \`2unbridled passion, in ${pronoun} room at the Inn.`,
    P: `  \`2${p.name} has publicly declared ${pronoun} love for\n  \`2you.  ${cap(getPronouns(p.sex).subject)} is asking for your hand in marriage.`,
  };

  const body = [
    ' ',
    `  \`2Romantic Message From \`0${p.name}\`2!`,
    '`0-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-`2',
    notifLines[kind],
    '  `2',
    `\`0  "${line}\`0"`,
  ].join('\n');

  MailDB.sendMail(recipient.id, p.id, body);

  if (kind === 'P') {
    const proposeLogs = [
      `\`0  ${p.name} \`2has been smitten - with love.`,
      `\`0  ${p.name} \`2is sick - lovesick, that is.`,
    ];
    LogDB.append(proposeLogs[rand(proposeLogs.length)]);
  }

  disp.sln(`  \`2Romantic message sent to \`0${recipient.name}\`2!`);
  disp.sln('');
  await session.more();
  return true;
}

// ── Romantic sub-menu (shown when writing to opposite sex for first time) ─

async function romanticOptions(session, disp, recipient) {
  const p      = session.player;
  const _rPr   = getPronouns(recipient.sex);
  const them   = cap(_rPr.object);
  const them2  = _rPr.object;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%** ROMANTIC MESSAGE **`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln(`  \`0Your hand trembles as you try to conjure up something to stir`);
  disp.sln(`  your beloved \`0${recipient.name}\`2.`);
  disp.sln('');

  // Show recipient charm/looks
  if (recipient.cha < 30) {
    disp.sln(`  \`4WARNING:  \`2${them2.charAt(0).toUpperCase() + them2.slice(1)} Charm Rating is only \`%${recipient.cha}\`2!`);
  } else {
    disp.sln(`  \`2${them2.charAt(0).toUpperCase() + them2.slice(1)} Charm Rating is \`%${recipient.cha}\`2.`);
  }
  disp.sln('');
  await session.more();

  // Check marriage blocks
  const state = StateDB.get();
  const senderMarried  = p.married_to > -1 || state.married_to_seth === p.id || state.married_to_violet === p.id;
  const recipMarried   = recipient.married_to > -1;

  disp.sln('');
  disp.sln('  `2(`0N`2)ever mind.');
  disp.sln(`  \`2(\`0F\`2)latter ${them}`);
  disp.sln(`  \`2(\`0A\`2)sk For A Kiss`);
  disp.sln(`  \`2(\`0B\`2)uy ${them} Dinner`);
  disp.sln(`  \`2(\`0I\`2)nvite ${them} To Your Room At The Inn`);
  if (p.cha > 99 && !senderMarried && !recipMarried) {
    disp.sln(`  \`2(\`0P\`2)ropose To ${them}`);
  }
  disp.sln('');
  disp.sw('  `2Which way would you like to show your love? : `%');

  const valid = ['N', 'F', 'A', 'B', 'I'];
  if (p.cha > 99 && !senderMarried && !recipMarried) valid.push('P');

  const ch = await session.prompt('', [...valid, '\r']);
  disp.sln(ch || 'N');
  disp.sln('');

  if (!ch || ch === 'N' || ch === '\r') return false;

  // Block propose if married
  if (ch === 'P') {
    if (senderMarried) {
      disp.sln('  Er - you sort of ARE married.  That kind of puts a crink in your');
      disp.sln('  romantic desires, now doesn\'t it?');
      disp.sln('');
      await session.more();
      return false;
    }
    if (recipMarried) {
      disp.sln('  `0PROBLEM! `2 You cannot propose to a married person!  No way!');
      disp.sln('');
      await session.more();
      return false;
    }
  }

  return await sendRomanceMail(session, disp, recipient, ch);
}

// ── Check and display incoming mail (called at session start) ─────────────

async function checkIncomingMail(session, disp) {
  const p    = session.player;
  const msgs = MailDB.fetchMail(p.id);
  if (!msgs.length) return;

  disp.sln('');
  disp.sln('  `%** YOU ARE STOPPED BY A MESSENGER WITH THE FOLLOWING NEWS: **`0');
  disp.sln('');

  for (const msg of msgs) {
    // Body may contain LordColor codes — pass through sln
    const lines = msg.body.split('\n');
    for (const line of lines) {
      disp.sln(line);
    }
    disp.sln('');
  }

  // Mark all as read and delete (original deletes after display)
  MailDB.deleteMail(p.id);
  await session.more();
}

// ── Main entry point ──────────────────────────────────────────────────────

async function enter(session) {
  const disp = Display.forSession(session);
  const p    = session.player;

  session.clearScreen();
  disp.sln('');
  disp.sln('  `%Write Mail`0');
  disp.sln(SEP);
  disp.sln('');
  disp.sln('  `2Who would you like to send mail to?');

  const recipient = await findPlayer(session, disp);
  if (!recipient) return;

  // Opposite-sex first-contact → offer romantic option
  const { normalise: _norm } = require('../utils/pronouns');
  if (_norm(recipient.sex) !== _norm(p.sex) && !p.flirted) {
    disp.sw(`\`2  Say something \`0Romantic\`2 to ${getPronouns(recipient.sex).object}?  [\`5N\`2] : `);
    const ch = await session.prompt('', ['Y', 'N', '\r']);
    disp.sln(ch === 'Y' ? 'Y' : 'N');
    disp.sln('');

    if (ch === 'Y') {
      const sent = await romanticOptions(session, disp, recipient);
      if (sent) {
        // Mark flirted so the romantic option won't appear again today
        PlayerDB.patch(p.id, { flirted: true });
        session.player = PlayerDB.getById(p.id);
        return;
      }
      // Fell through (chose N or failed) — compose plain mail below
    }
  }

  await composePlainMail(session, disp, recipient);
}

module.exports = { enter, checkIncomingMail };
