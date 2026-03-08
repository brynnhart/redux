'use strict';

/**
 * server/game/text/Display.js
 *
 * Session-bound display helpers.
 * Returns a helper object tied to a specific session.
 *
 * Replaces: sw(), sln(), lw(), lln(), display_file(), show_lord_file(),
 *           show_lord_buffer(), more(), sclrscr(), etc. from lord.js
 */

const LordColors = require('./LordColors');
const TextFile   = require('./TextFile');

/**
 * Create a display helper bound to a session.
 * @param {Session} session
 */
function forSession(session) {
  /**
   * Send a LoRD-formatted string (convert color codes → ANSI).
   * Replaces: sw() / sln() / lw() in lord.js
   *
   * @param {string}  str
   * @param {boolean} [newline=false]
   * @param {object}  [subs]  Variable substitutions ({ name, weapon, enemy })
   */
  function sw(str, newline = false, subs = {}) {
    const out = LordColors.toAnsi(str, subs);
    session.send(out + (newline ? '\r\n' : ''));
  }

  /** sw() with automatic newline. Replaces: sln() */
  function sln(str = '', subs = {}) {
    sw(str, true, subs);
  }

  /**
   * Display a .lrd file line by line, converting color codes.
   * Paginates every (rows-1) lines with a [More] prompt.
   * Replaces: display_file() and show_lord_file() in lord.js
   *
   * @param {string}  filename      Relative to gamedata/
   * @param {boolean} [paginate=true]
   * @param {object}  [subs]
   */
  async function showFile(filename, paginate = true, subs = {}) {
    const lines = TextFile.readFile(filename);
    if (!lines) return;
    await showLines(lines, paginate, subs);
  }

  /**
   * Display a named section from lordtxt.lrd.
   * Replaces: show_lord_file() calls that use the text index.
   */
  async function showSection(sectionName, paginate = true, subs = {}) {
    const lines = TextFile.getSection(sectionName);
    await showLines(lines, paginate, subs);
  }

  /**
   * Display an array of LoRD-formatted lines.
   * Replaces: show_lord_buffer() in lord.js
   */
  async function showLines(lines, paginate = true, subs = {}) {
    const ROWS   = 23; // assume 24-row terminal, leave 1 for prompt
    let   lineNo = 0;

    for (const line of lines) {
      sln(line, subs);
      lineNo++;

      if (paginate && lineNo > 0 && lineNo % ROWS === 0) {
        await session.more();
      }
    }
  }

  /**
   * Display a centered line.
   * Replaces: center() usage in lord.js
   */
  function centered(str, subs = {}) {
    sln(LordColors.center(str), subs);
  }

  /**
   * Print a separator line.
   */
  function separator(char = '-', width = 79) {
    session.sendln(char.repeat(width));
  }

  /**
   * Display player stats block.
   * Replaces: show_stats() in lord.js
   */
  function showStats(player) {
    const p = player;
    sln('');
    sln('`2                 ┌─────────────────────────────┐');
    sln(`\`2                 │  \`%${p.name.padEnd(27)}\`2│`);
    sln('`2                 ├─────────────────────────────┤');
    sln(`\`2  \`2Level\`0: \`%${String(p.level).padEnd(4)}\`2  HP\`0: \`%${p.hp}\`2/\`%${p.hp_max}`);
    sln(`\`2  \`2  STR\`0: \`%${String(p.str).padEnd(6)}\`2DEF\`0: \`%${p.def}`);
    sln(`\`2  \`2  CHA\`0: \`%${String(p.cha).padEnd(6)}\`2EXP\`0: \`%${p.exp}`);
    sln(`\`2 Gold\`0: \`%${String(p.gold).padEnd(7)}\`2Bank\`0: \`%${p.bank}`);
    sln(`\`2  Arm\`0: \`%${p.arm.padEnd(20)}`);
    sln(`\`2  Wpn\`0: \`%${p.weapon.padEnd(20)}`);
    sln('');
  }

  return {
    sw,
    sln,
    showFile,
    showSection,
    showLines,
    centered,
    separator,
    showStats,
  };
}

module.exports = { forSession };
