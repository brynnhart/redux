'use strict';

/**
 * server/game/text/LordColors.js
 *
 * Converts LoRD backtick color codes to ANSI escape sequences.
 * Ported directly from lord.js lord_to_ansi() (lines 6482–6579).
 *
 * LoRD color codes:
 *   `0  dark grey / reset
 *   `1  blue
 *   `2  green
 *   `3  cyan
 *   `4  red
 *   `5  magenta
 *   `6  brown/yellow
 *   `7  white
 *   `%  bold/bright
 *   `.  reset all
 *   `&  special substitution marker (handled separately)
 *   ``  literal backtick
 */

// ANSI foreground color map for LoRD codes 0-7
const FG = {
  '0': '30',  // dark grey (bright black)
  '1': '34',  // blue
  '2': '32',  // green
  '3': '36',  // cyan
  '4': '31',  // red
  '5': '35',  // magenta
  '6': '33',  // brown/yellow
  '7': '37',  // white
};

/**
 * Convert a LoRD-formatted string to ANSI.
 *
 * @param {string} str              The raw LoRD string with backtick codes
 * @param {object} [subs]           Key/value substitutions for `&KEY patterns
 * @param {string} [subs.name]      Player name  (`&NAME)
 * @param {string} [subs.weapon]    Player weapon (`&PWE)
 * @param {string} [subs.enemy]     Enemy name   (`&ENAME)
 * @returns {string}                ANSI-escaped string ready to send
 */
function toAnsi(str, subs = {}) {
  if (!str) return '';
  let out    = '';
  let bold   = false;
  let i      = 0;

  while (i < str.length) {
    if (str[i] !== '`') {
      out += str[i++];
      continue;
    }

    // We have a backtick — look at next char
    i++; // consume '`'
    if (i >= str.length) break;

    const code = str[i++];

    switch (code) {
      case '`':
        out += '`';
        break;

      case '.':
        // Reset all
        bold = false;
        out += '\x1b[0m';
        break;

      case '%':
        // Bold/bright on
        bold = true;
        out += '\x1b[1m';
        break;

      case '0': case '1': case '2': case '3':
      case '4': case '5': case '6': case '7': {
        // Foreground color
        const fg = FG[code];
        if (bold) {
          out += `\x1b[${fg};1m`;
        } else {
          out += `\x1b[0;${fg}m`;
          bold = false;
        }
        break;
      }

      case '&': {
        // Variable substitution — read until non-alpha
        let key = '';
        while (i < str.length && /[A-Z0-9_]/i.test(str[i])) {
          key += str[i++];
        }
        const upper = key.toUpperCase();
        if      (upper === 'NAME'  || upper === 'N') out += subs.name   || '';
        else if (upper === 'PWE'   || upper === 'W') out += subs.weapon || '';
        else if (upper === 'ENAME' || upper === 'E') out += subs.enemy  || '';
        else if (upper === 'SEX'                   ) out += subs.sex    || '';
        else out += '`&' + key; // unknown — pass through
        break;
      }

      default:
        // Unknown code — pass both chars through literally
        out += '`' + code;
        break;
    }
  }

  // Always reset at end
  out += '\x1b[0m';
  return out;
}

/**
 * Strip all LoRD color codes, returning plain text.
 * Useful for mail subject lines, log entries, etc.
 */
function strip(str) {
  if (!str) return '';
  return str.replace(/`[`.%0-7]|`&[A-Z0-9_]*/gi, '');
}

/**
 * Measure the display width of a LoRD string (ignoring color codes).
 * Replaces: disp_len() in lord.js
 */
function dispLen(str) {
  return strip(str).length;
}

/**
 * Center a LoRD-formatted string within `width` columns.
 * Replaces: center() in lord.js
 */
function center(str, width = 79) {
  const len  = dispLen(str);
  const pad  = Math.max(0, Math.floor((width - len) / 2));
  return ' '.repeat(pad) + str;
}

module.exports = { toAnsi, strip, dispLen, center };
