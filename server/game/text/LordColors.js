'use strict';

/**
 * server/game/text/LordColors.js
 *
 * Converts LoRD backtick color codes to ANSI escape sequences.
 * Ported EXACTLY from lord.js lord_to_ansi() (lines 6482–6579).
 *
 * The CORRECT LoRD color table (from source):
 *
 *   `1  → \x1b[0;34m  blue
 *   `2  → \x1b[0;32m  green
 *   `3  → \x1b[0;36m  cyan
 *   `4  → \x1b[0;31m  red
 *   `5  → \x1b[0;35m  magenta
 *   `6  → \x1b[0;33m  yellow/brown
 *   `7  → \x1b[0;37m  white
 *   `8  → \x1b[1;30m  bright black / dark grey
 *   `9  → \x1b[1;34m  bright blue
 *   `0  → \x1b[1;32m  bright green  (was wrongly mapped to 30/dark grey)
 *   `!  → \x1b[1;36m  bright cyan
 *   `@  → \x1b[1;31m  bright red
 *   `#  → \x1b[1;35m  bright magenta
 *   `$  → \x1b[1;33m  bright yellow
 *   `%  → \x1b[1;37m  bright white
 *   `.  → reset all
 *   ``  → literal backtick
 *   `c  → clear screen + cursor home
 *   `l  → separator line (79 dashes)
 */

const COLOR_MAP = {
  '1': '\x1b[0;34m',
  '2': '\x1b[0;32m',
  '3': '\x1b[0;36m',
  '4': '\x1b[0;31m',
  '5': '\x1b[0;35m',
  '6': '\x1b[0;33m',
  '7': '\x1b[0;37m',
  '8': '\x1b[1;30m',
  '9': '\x1b[1;34m',
  '0': '\x1b[1;32m',   // bright green — THE FIX
  '!': '\x1b[1;36m',
  '@': '\x1b[1;31m',
  '#': '\x1b[1;35m',
  '$': '\x1b[1;33m',
  '%': '\x1b[1;37m',
  '.': '\x1b[0m',
};

function toAnsi(str, subs = {}) {
  if (!str) return '';
  let out = '';
  let i   = 0;

  while (i < str.length) {
    if (str[i] !== '`') { out += str[i++]; continue; }

    i++; // consume backtick
    if (i >= str.length) break;
    const code = str[i++];

    if (COLOR_MAP[code] !== undefined) {
      out += COLOR_MAP[code];
      continue;
    }

    switch (code) {
      case '`': out += '`'; break;

      case 'c': out += '\x1b[2J\x1b[H'; break;

      case 'l': out += '-'.repeat(79); break;

      case '&': {
        let key = '';
        while (i < str.length && /[A-Z0-9_]/i.test(str[i])) key += str[i++];
        const upper = key.toUpperCase();
        if      (upper === 'NAME' || upper === 'N') out += subs.name   || '';
        else if (upper === 'PWE'  || upper === 'W') out += subs.weapon || '';
        else if (upper === 'ENAME'|| upper === 'E') out += subs.enemy  || '';
        else if (upper === 'SEX'                  ) out += subs.sex    || '';
        else out += '`&' + key;
        break;
      }

      default: out += '`' + code; break;
    }
  }

  out += '\x1b[0m'; // always reset at end
  return out;
}

function strip(str) {
  if (!str) return '';
  return str.replace(/`[`0-9!@#$%.clr]|`&[A-Z0-9_]*/gi, '');
}

function dispLen(str) { return strip(str).length; }

function center(str, width = 79) {
  const pad = Math.max(0, Math.floor((width - dispLen(str)) / 2));
  return ' '.repeat(pad) + str;
}

module.exports = { toAnsi, strip, dispLen, center };
