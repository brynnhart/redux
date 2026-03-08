'use strict';

/**
 * server/game/systems/Battle.js
 *
 * Core combat engine.
 * Ports: battle(), on_battle(), handle_hit(), do_attack(), enemy_attack(),
 *        try_running(), beef_up() from lord.js
 *
 * All functions are async — combat prompts use await session.getKey().
 */

const PlayerDB   = require('../../db/PlayerDB');
const LordColors = require('../text/LordColors');
const Display    = require('../text/Display');

// ── Monster scaling ────────────────────────────────────────────────────────

/**
 * Scale a monster to be roughly appropriate for the player's level.
 * Replaces: beef_up() from lord.js
 */
function beefUp(monster, player) {
  // Deep-copy so we don't mutate the static data
  const m    = { ...monster };
  const lvl  = player.level;

  m.hp  = Math.floor(m.hp  * (1 + lvl * 0.15));
  m.str = Math.floor(m.str * (1 + lvl * 0.10));
  m.gold = Math.floor(m.gold * (1 + lvl * 0.20));
  m.exp  = Math.floor(m.exp  * (1 + lvl * 0.20));
  return m;
}

// ── Hit calculation ────────────────────────────────────────────────────────

/**
 * Calculate whether an attack hits and how much damage it does.
 * Replaces: handle_hit() from lord.js
 *
 * @returns {{ hit: boolean, damage: number }}
 */
function calcHit(attackerStr, defenderDef, hasAmulet = false) {
  // Base hit chance depends on attacker str vs defender def
  const hitChance = Math.min(95, Math.max(5, 50 + (attackerStr - defenderDef) * 2));
  const roll      = Math.random() * 100;

  if (roll > hitChance) return { hit: false, damage: 0 };

  // Damage = random(str) + amulet bonus
  const base   = Math.max(1, Math.floor(Math.random() * attackerStr));
  const bonus  = hasAmulet ? Math.floor(Math.random() * attackerStr * 0.25) : 0;
  return { hit: true, damage: base + bonus };
}

// ── Battle display ─────────────────────────────────────────────────────────

function showBattlePrompt(session, player, opponent) {
  const disp = Display.forSession(session);
  disp.sln('');
  disp.sln(`\`2You\`0: \`%${player.hp}\`2hp   \`0${opponent.name}\`2: \`%${opponent.hp}\`2hp`);
  disp.sln('');
  session.send('`2(`%F`2)ight  (`%R`2)un  (`%U`2)se Skill: ');
}

// ── Main battle loop ───────────────────────────────────────────────────────

/**
 * Run a full combat encounter between a player and a monster/NPC.
 * Replaces: battle() from lord.js
 *
 * @param {Session} session
 * @param {object}  opponent     Monster or NPC object { name, hp, str, def, weapon, ... }
 * @param {object}  [opts]
 * @param {boolean} [opts.cantRun=false]   Player cannot flee
 * @param {boolean} [opts.isPvP=false]     Opponent is another player
 * @returns {Promise<'win'|'lose'|'ran'>}
 */
async function battle(session, opponent, opts = {}) {
  const { cantRun = false, isPvP = false } = opts;
  const disp   = Display.forSession(session);
  let   player = session.player;

  // Working copies so we can track HP without DB writes mid-battle
  let playerHP   = player.hp;
  let opponentHP = opponent.hp;

  disp.sln('');
  disp.sln(`\`%You encounter \`4${opponent.name}\`%!`);
  disp.sln(`\`2They wield a \`%${opponent.weapon || 'fist'}\`2.`);
  disp.sln('');

  while (playerHP > 0 && opponentHP > 0 && session.alive) {
    showBattlePrompt(session, { ...player, hp: playerHP }, { ...opponent, hp: opponentHP });

    const key = await session.getKeyUpper(true);
    disp.sln('');

    if (!key || !session.alive) return 'lose';

    // ── Player action ────────────────────────────────────────────────────────
    if (key === 'F') {
      // Attack
      const { hit, damage } = calcHit(player.str, opponent.def, player.amulet);
      if (hit) {
        opponentHP -= damage;
        disp.sln(`\`2You hit \`%${opponent.name}\`2 with your \`%${player.weapon}\`2 for \`%${damage}\`2 damage!`);
      } else {
        disp.sln(`\`2You swing at \`%${opponent.name}\`2, but miss!`);
      }

    } else if (key === 'R') {
      // Flee
      if (cantRun) {
        disp.sln('`4You cannot run from this fight!');
      } else {
        const runChance = 40 + player.level * 5;
        if (Math.random() * 100 < runChance) {
          disp.sln('`2You manage to escape!');
          return 'ran';
        } else {
          disp.sln('`4You fail to escape!');
        }
      }

    } else if (key === 'U') {
      // Use class skill
      // TODO: Port use_death_knight_skill(), use_thief_skill(), use_mystical_skill()
      disp.sln('`6(Class skills coming soon)');

    } else {
      continue; // Invalid key — re-prompt
    }

    // ── Enemy attack (if still alive) ────────────────────────────────────────
    if (opponentHP > 0) {
      const { hit, damage } = calcHit(opponent.str, player.def);
      if (hit) {
        playerHP -= damage;
        disp.sln(`\`4${opponent.name}\`2 hits you with their \`%${opponent.weapon || 'fist'}\`2 for \`4${damage}\`2 damage!`);
      } else {
        disp.sln(`\`2${opponent.name}\`2 attacks but misses you!`);
      }
    }
  }

  // ── Outcome ────────────────────────────────────────────────────────────────
  if (playerHP <= 0) {
    // Player died
    disp.sln('');
    disp.sln('`4You have been killed!');
    PlayerDB.patch(player.id, {
      hp   : 0,
      dead : true,
      inn  : false,
      gold : 0,
      gem  : Math.floor(player.gem * 0.5),
      exp  : player.exp - Math.floor(player.exp * 0.1),
    });
    session.player = PlayerDB.getById(player.id);
    return 'lose';
  }

  // Player won
  disp.sln('');
  disp.sln(`\`2You have defeated \`%${opponent.name}\`2!`);

  if (opponent.death) disp.sln(`\`6${opponent.death}`);

  const goldWon = opponent.gold || 0;
  const expWon  = opponent.exp  || 0;

  disp.sln(`\`2You gain \`%${goldWon}\`2 gold and \`%${expWon}\`2 experience!`);

  PlayerDB.patch(player.id, {
    hp   : Math.max(1, playerHP),
    gold : Math.min(2000000000, player.gold + goldWon),
    exp  : Math.min(2000000000, player.exp  + expWon),
  });
  session.player = PlayerDB.getById(player.id);

  // TODO: Check for level-up after exp gain
  // TODO: Award gems on special kills

  await session.more();
  return 'win';
}

module.exports = { battle, beefUp, calcHit };
