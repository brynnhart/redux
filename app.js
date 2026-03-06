const terminal = document.getElementById('terminal');

const player = {
  name: '',
  sex: '',
  className: '',
  level: 4,
  exp: 1420,
  hp: 39,
  maxHp: 45,
  forestFights: 8,
  gold: 378,
  gems: 5,
  weapon: "Fine Long Sword",
  armor: "Studded Leather",
  charm: 22,
  deeds: 'Defeated Grizzle in the Old Mill',
};

const dailyNews = [
  "Sir Garrick was seen leaving Violet's room at dawn. No comment.",
  "A travelling bard claims the Dragon sneezed fire across two valleys.",
  "Mira the Quick robbed the Bank, then donated half to the Healer.",
  "Seth Able says someone in town has mastered all classes. Impossible?",
  "King Arthur's smith swears a blade spoke to him in the forge tonight.",
];

const leaderboard = [
  ['Valeria', 99500, 15, 'Yes', 'Alive'],
  ['Thorn', 87440, 14, 'No', 'Alive'],
  ['Mordain', 80120, 13, 'No', 'In Forest'],
  ['Calyx', 76680, 13, 'No', 'Dead'],
  ['Nessa', 70420, 12, 'No', 'Alive'],
  ['Brann', 66555, 11, 'No', 'Alive'],
  ['Yori', 61200, 10, 'No', 'In Inn'],
];

const enemy = {
  name: 'Ravenous Dire Wolf',
  hp: 24,
  maxHp: 24,
};

const state = {
  screen: 'charName',
  commandEcho: '',
  awaitingTransition: false,
  transientMessage: '',
  innMessage: '',
  combatRound: 0,
};

const pad = (text, len) => String(text).padEnd(len, ' ');

function ansiLine(parts) {
  return `<div>${parts
    .map((part) => {
      if (typeof part === 'string') return part;
      return `<span class="${part.c}">${part.t}</span>`;
    })
    .join('')}</div>`;
}

function townCommandColumns() {
  const left = [
    '(F)orest',
    "(K)ing Arthur's Weapons",
    "(H)ealer's Hut",
    '(I)nn',
    '(Y)e Old Bank',
    '(S)laughter other players',
    "(A)bdul's Armour",
  ];
  const right = [
    '(V)iew your Stats',
    "(T)urgon's Warrior Training",
    '(L)ist Warriors',
    '(D)aily News',
    '(O)ther Places',
    '(Q)uit to Fields',
    '(?) Help',
  ];

  return left
    .map((l, i) =>
      ansiLine([
        { c: 'c-yellow', t: pad(l, 34) },
        { c: 'c-cyan', t: right[i] || '' },
      ])
    )
    .join('');
}

function promptLine() {
  return `<div class="prompt"><span class="c-green">Your command, ${player.name || 'Hero'}? : </span><span class="c-white">${state.commandEcho}</span><span class="cursor">█</span></div>`;
}

function renderHeader() {
  return [
    ansiLine([{ c: 'c-red', t: '╔══════════════════════════════════════════════════════════════════════════╗' }]),
    ansiLine([
      { c: 'c-red', t: '║ ' },
      { c: 'c-magenta', t: 'Legend of the Red Dragon' },
      { c: 'c-red', t: pad('', 39) + '║' },
    ]),
    ansiLine([{ c: 'c-red', t: '╚══════════════════════════════════════════════════════════════════════════╝' }]),
    '<div></div>',
  ].join('');
}

function renderCharacterCreation() {
  if (state.screen === 'charName') {
    return [
      ansiLine([{ c: 'c-cyan', t: 'Welcome, traveler. The realm awaits a new warrior.' }]),
      '<div></div>',
      ansiLine([{ c: 'c-yellow', t: 'What is your name, hero?' }]),
      '<div class="c-dim">(Press any letter key to choose "Ronan" for this prototype)</div>',
    ].join('');
  }

  if (state.screen === 'charSex') {
    return [
      ansiLine([{ c: 'c-yellow', t: `Aye ${player.name}, choose your sex.` }]),
      '<div></div>',
      ansiLine([{ c: 'c-green', t: '(M) Male' }]),
      ansiLine([{ c: 'c-magenta', t: '(F) Female' }]),
    ].join('');
  }

  return [
    ansiLine([{ c: 'c-yellow', t: `${player.sex === 'Female' ? 'Milady' : 'Good sir'}, now pick your class:` }]),
    '<div></div>',
    ansiLine([{ c: 'c-cyan', t: '(W) Warrior' }]),
    ansiLine([{ c: 'c-green', t: '(T) Thief' }]),
    ansiLine([{ c: 'c-blue', t: '(M) Mystic' }]),
  ].join('');
}

function renderDaily() {
  const lines = dailyNews
    .map((entry, i) => ansiLine([{ c: i % 2 ? 'c-yellow' : 'c-cyan', t: ` ${i + 1}. ${entry}` }]))
    .join('');

  return [
    ansiLine([{ c: 'c-magenta', t: 'Daily Happenings of the Realm' }]),
    ansiLine([{ c: 'c-dim', t: '──────────────────────────────────────────────────────────────────────────' }]),
    lines,
    '<div></div>',
    ansiLine([{ c: 'c-green', t: '(R)eturn to Town Square' }]),
  ].join('');
}

function renderTown() {
  return [
    ansiLine([
      { c: 'c-blue', t: 'Town Square' },
      { c: 'c-dim', t: `   Level:${player.level}  HP:${player.hp}/${player.maxHp}  Gold:${player.gold}  Gems:${player.gems}` },
    ]),
    ansiLine([{ c: 'c-dim', t: '──────────────────────────────────────────────────────────────────────────' }]),
    ansiLine([{ c: 'c-white', t: 'Citizens whisper, steel rings from the forge, and Violet laughs upstairs.' }]),
    '<div></div>',
    townCommandColumns(),
    state.transientMessage ? `<div class="c-magenta">${state.transientMessage}</div>` : '<div></div>',
  ].join('');
}

function renderForest() {
  return [
    ansiLine([{ c: 'c-green', t: 'The Forest' }]),
    ansiLine([{ c: 'c-dim', t: 'Mist crawls through the roots. Every branch sounds like a warning.' }]),
    '<div></div>',
    ansiLine([
      { c: 'c-yellow', t: `HP: ${player.hp}/${player.maxHp}` },
      { c: 'c-cyan', t: `   Fights: ${player.forestFights}` },
      { c: 'c-white', t: `   Gold: ${player.gold}` },
      { c: 'c-blue', t: `   Gems: ${player.gems}` },
    ]),
    '<div></div>',
    ansiLine([{ c: 'c-red', t: '(L)ook for something to kill' }]),
    ansiLine([{ c: 'c-magenta', t: "(H)ealer's Hut" }]),
    ansiLine([{ c: 'c-green', t: '(R)eturn to Town' }]),
  ].join('');
}

function renderCombat() {
  const combatText = [
    'The wolf circles low, froth on its jaws.',
    `You slash hard. ${enemy.name} recoils and snarls.`,
    `${enemy.name} lunges and tears your shoulder for 4 hit points!`,
  ];

  return [
    ansiLine([{ c: 'c-red', t: `Combat!  ${enemy.name}` }]),
    ansiLine([{ c: 'c-dim', t: '──────────────────────────────────────────────────────────────────────────' }]),
    ansiLine([{ c: 'c-white', t: combatText[Math.min(state.combatRound, combatText.length - 1)] }]),
    '<div></div>',
    ansiLine([
      { c: 'c-yellow', t: `${player.name || 'Hero'} HP: ${player.hp}/${player.maxHp}` },
      { c: 'c-red', t: `   ${enemy.name} HP: ${Math.max(0, enemy.maxHp - state.combatRound * 7)}/${enemy.maxHp}` },
    ]),
    '<div></div>',
    ansiLine([{ c: 'c-green', t: '(A)ttack' }]),
    ansiLine([{ c: 'c-cyan', t: '(S)tats' }]),
    ansiLine([{ c: 'c-yellow', t: '(R)un' }]),
    ansiLine([{ c: 'c-blue', t: '(B)attle Cry' }]),
  ].join('');
}

function renderInn() {
  return [
    ansiLine([{ c: 'c-magenta', t: "The Sleeping Dragon Inn" }]),
    ansiLine([{ c: 'c-dim', t: 'Lantern smoke, spilled ale, and rumors too dangerous for daylight.' }]),
    '<div></div>',
    ansiLine([{ c: 'c-yellow', t: '(C)onverse with patrons' }]),
    ansiLine([{ c: 'c-magenta', t: '(F)lirt with Violet' }]),
    ansiLine([{ c: 'c-green', t: '(G)et a Room' }]),
    ansiLine([{ c: 'c-cyan', t: '(H)ear Seth Able the Bard' }]),
    ansiLine([{ c: 'c-blue', t: '(D)aily News' }]),
    ansiLine([{ c: 'c-white', t: '(T)alk to bartender' }]),
    ansiLine([{ c: 'c-yellow', t: '(V)iew your stats' }]),
    ansiLine([{ c: 'c-green', t: '(R)eturn to town' }]),
    state.innMessage ? `<div class="c-white">${state.innMessage}</div>` : '<div></div>',
  ].join('');
}

function renderRankings() {
  const header = ansiLine([
    { c: 'c-yellow', t: pad('Name', 16) },
    { c: 'c-cyan', t: pad('Experience', 12) },
    { c: 'c-green', t: pad('Level', 8) },
    { c: 'c-magenta', t: pad('Mastered', 11) },
    { c: 'c-white', t: 'Status' },
  ]);

  const rows = leaderboard
    .map((row, idx) => {
      const color = idx % 2 ? 'c-cyan' : 'c-green';
      return ansiLine([
        { c: color, t: pad(row[0], 16) },
        { c: 'c-yellow', t: pad(row[1], 12) },
        { c: 'c-white', t: pad(row[2], 8) },
        { c: 'c-magenta', t: pad(row[3], 11) },
        { c: row[4] === 'Dead' ? 'c-red' : 'c-blue', t: row[4] },
      ]);
    })
    .join('');

  return [
    ansiLine([{ c: 'c-blue', t: 'List of Warriors' }]),
    ansiLine([{ c: 'c-dim', t: '──────────────────────────────────────────────────────────────────────────' }]),
    header,
    rows,
    '<div></div>',
    ansiLine([{ c: 'c-green', t: '(R)eturn to Town Square' }]),
  ].join('');
}

function renderStats() {
  return [
    ansiLine([{ c: 'c-cyan', t: `${player.name || 'Hero'}'s Stats` }]),
    ansiLine([{ c: 'c-dim', t: '──────────────────────────────────────────────────────────────────────────' }]),
    ansiLine([{ c: 'c-yellow', t: `Level: ${player.level}` }]),
    ansiLine([{ c: 'c-yellow', t: `Experience: ${player.exp}` }]),
    ansiLine([{ c: 'c-red', t: `Hit Points: ${player.hp}/${player.maxHp}` }]),
    ansiLine([{ c: 'c-white', t: `Weapon: ${player.weapon}` }]),
    ansiLine([{ c: 'c-white', t: `Armor: ${player.armor}` }]),
    ansiLine([{ c: 'c-magenta', t: `Charm: ${player.charm}` }]),
    ansiLine([{ c: 'c-yellow', t: `Gold: ${player.gold}` }]),
    ansiLine([{ c: 'c-blue', t: `Gems: ${player.gems}` }]),
    ansiLine([{ c: 'c-green', t: `Class: ${player.className || 'Wandering Soul'}` }]),
    ansiLine([{ c: 'c-cyan', t: `Deeds: ${player.deeds}` }]),
    '<div></div>',
    ansiLine([{ c: 'c-green', t: '(R)eturn to Town Square' }]),
  ].join('');
}

function renderScreen() {
  let body = '';

  if (['charName', 'charSex', 'charClass'].includes(state.screen)) {
    body = renderCharacterCreation();
  } else if (state.screen === 'daily') {
    body = renderDaily();
  } else if (state.screen === 'town') {
    body = renderTown();
  } else if (state.screen === 'forest') {
    body = renderForest();
  } else if (state.screen === 'combat') {
    body = renderCombat();
  } else if (state.screen === 'inn') {
    body = renderInn();
  } else if (state.screen === 'rankings') {
    body = renderRankings();
  } else if (state.screen === 'stats') {
    body = renderStats();
  }

  terminal.innerHTML = `<div class="screen">${renderHeader()}${body}<div></div>${promptLine()}</div>`;
}

function transitionTo(next) {
  state.awaitingTransition = true;
  setTimeout(() => {
    state.commandEcho = '';
    state.screen = next;
    state.awaitingTransition = false;
    renderScreen();
  }, 150);
}

function handleCreationInput(key) {
  if (state.screen === 'charName') {
    player.name = 'Ronan';
    transitionTo('charSex');
    return;
  }
  if (state.screen === 'charSex') {
    if (key === 'm') player.sex = 'Male';
    if (key === 'f') player.sex = 'Female';
    if (player.sex) transitionTo('charClass');
    return;
  }
  if (state.screen === 'charClass') {
    if (key === 'w') player.className = 'Warrior';
    if (key === 't') player.className = 'Thief';
    if (key === 'm') player.className = 'Mystic';
    if (player.className) transitionTo('daily');
  }
}

function handleGlobalInput(key) {
  if (state.screen === 'daily') {
    if (key === 'r') transitionTo('town');
    return;
  }

  if (state.screen === 'town') {
    if (key === 'f') transitionTo('forest');
    else if (key === 'i') transitionTo('inn');
    else if (key === 'v') transitionTo('stats');
    else if (key === 'l') transitionTo('rankings');
    else if (key === 'd') transitionTo('daily');
    else state.transientMessage = 'That place is closed in this prototype.';
    renderScreen();
    return;
  }

  if (state.screen === 'forest') {
    if (key === 'l') {
      state.combatRound = 0;
      transitionTo('combat');
    } else if (key === 'r') {
      transitionTo('town');
    }
    return;
  }

  if (state.screen === 'combat') {
    if (key === 'a') {
      state.combatRound += 1;
      if (state.combatRound >= 3) {
        state.transientMessage = `You drove off the ${enemy.name} and found 27 gold.`;
        player.gold += 27;
        transitionTo('forest');
        return;
      }
      renderScreen();
    } else if (key === 's') {
      transitionTo('stats');
    } else if (key === 'r') {
      state.transientMessage = 'You escaped, breathing hard.';
      transitionTo('forest');
    } else if (key === 'b') {
      state.combatRound = Math.min(state.combatRound + 1, 2);
      renderScreen();
    }
    return;
  }

  if (state.screen === 'inn') {
    if (key === 'r') transitionTo('town');
    else if (key === 'd') transitionTo('daily');
    else if (key === 'v') transitionTo('stats');
    else {
      const innEvents = {
        c: 'A hooded ranger warns you: "Do not trust smiling nobles."',
        f: 'Violet smiles, takes your gold, and leaves you with a wink.',
        g: 'You sleep for an hour and recover your courage.',
        h: 'Seth Able sings of heroes swallowed by the dark wood.',
        t: 'Bartender grunts: "Keep your blade oiled and your debts paid."',
      };
      state.innMessage = innEvents[key] || 'The inn roars with laughter and tankards.';
      renderScreen();
    }
    return;
  }

  if (['rankings', 'stats'].includes(state.screen)) {
    if (key === 'r') transitionTo('town');
  }
}

document.addEventListener('keydown', (e) => {
  if (state.awaitingTransition) return;
  if (e.key.length !== 1) return;

  const key = e.key.toLowerCase();
  state.commandEcho = e.key.toUpperCase();
  renderScreen();

  if (['charName', 'charSex', 'charClass'].includes(state.screen)) {
    handleCreationInput(key);
  } else {
    handleGlobalInput(key);
  }
});

renderScreen();
