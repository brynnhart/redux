'use strict';

/**
 * server/ws/Session.js
 *
 * Represents one player's active connection.
 * Provides the I/O primitives that replace every dk.console.* call in lord.js.
 *
 * Key design: getKey() and getStr() return Promises, allowing the game engine
 * to be written with async/await instead of synchronous blocking calls.
 */

const EventEmitter = require('events');

class Session extends EventEmitter {
  /**
   * @param {WebSocket} ws
   * @param {number}    userId
   * @param {string}    username
   */
  constructor(ws, userId, username) {
    super();
    this.ws       = ws;
    this.userId   = userId;
    this.username = username;
    this.alive    = true;

    // Key input queue — game engine awaits these
    this._keyResolvers = [];
    this._keyBuffer    = [];

    // Current ANSI attribute state (for color tracking)
    this.attr = 0x07; // default: white on black
  }

  // ── Output ─────────────────────────────────────────────────────────────────

  /**
   * Send raw ANSI/text to the client.
   * Replaces: dk.console.print() / sw() / sln() / lw()
   */
  send(str) {
    if (!this.alive || this.ws.readyState !== 1 /* OPEN */) return;
    this.ws.send(JSON.stringify({ type: 'output', data: str }));
  }

  /** Send string with CRLF appended. Replaces: sln() */
  sendln(str = '') {
    this.send(str + '\r\n');
  }

  /** Clear the screen. Replaces: sclrscr() */
  clearScreen() {
    this.send('\x1b[2J\x1b[H');
  }

  /** Clear to end of line. Replaces: dk.console.cleareol() */
  clearEOL() {
    this.send('\x1b[K');
  }

  /** Move cursor to row, col (1-based). */
  moveCursor(row, col) {
    this.send(`\x1b[${row};${col}H`);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  /**
   * Called by WSHandler when a key arrives from the client.
   * If someone is waiting (await getKey()), resolve immediately.
   * Otherwise buffer it.
   */
  receiveKey(key) {
    if (this._keyResolvers.length > 0) {
      const resolve = this._keyResolvers.shift();
      resolve(key);
    } else {
      this._keyBuffer.push(key);
    }
  }

  /**
   * Wait for the next keypress and return it.
   * Replaces: dk.console.getkey() / getkey() / getkeyw()
   *
   * @param {number} [timeoutMs]  Optional timeout in ms. Returns null on timeout.
   * @returns {Promise<string|null>}
   */
  getKey(timeoutMs) {
    if (this._keyBuffer.length > 0) {
      return Promise.resolve(this._keyBuffer.shift());
    }
    return new Promise((resolve) => {
      let timer;
      if (timeoutMs) {
        timer = setTimeout(() => {
          const idx = this._keyResolvers.indexOf(resolve);
          if (idx !== -1) this._keyResolvers.splice(idx, 1);
          resolve(null);
        }, timeoutMs);
      }
      this._keyResolvers.push((key) => {
        if (timer) clearTimeout(timer);
        resolve(key);
      });
    });
  }

  /**
   * Wait for the next keypress, echo it (optionally), return uppercased.
   * Replaces the common getkey().toUpperCase() pattern.
   */
  async getKeyUpper(echo = false) {
    const k = await this.getKey();
    if (!k) return null;
    if (echo) this.send(k);
    return k.toUpperCase();
  }

  /**
   * Read a string of up to `maxLen` chars, echoing input, handling backspace.
   * Returns when Enter is pressed.
   * Replaces: dk.console.getstr() / getstr() / read_str()
   *
   * @param {number}  maxLen
   * @param {object}  [opts]
   * @param {boolean} [opts.password=false]  Echo asterisks instead of chars
   * @param {string}  [opts.initial='']      Pre-filled value
   * @param {RegExp}  [opts.allowed]         If set, discard non-matching chars
   * @returns {Promise<string>}
   */
  async getStr(maxLen = 40, opts = {}) {
    const { password = false, initial = '', allowed = null } = opts;
    let buf = initial;

    // Show initial value
    if (initial) this.send(password ? '*'.repeat(initial.length) : initial);

    while (true) {
      const key = await this.getKey();
      if (!key) continue;

      if (key === '\r' || key === '\n') {
        this.send('\r\n');
        return buf;
      }

      if (key === '\x08' || key === '\x7f') {
        // Backspace
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          this.send('\x08 \x08');
        }
        continue;
      }

      if (key === '\x1b') {
        // Escape — cancel, return empty
        this.send('\r\n');
        return '';
      }

      // Printable character
      if (key.length === 1 && key >= ' ') {
        if (allowed && !allowed.test(key)) continue;
        if (buf.length < maxLen) {
          buf += key;
          this.send(password ? '*' : key);
        }
      }
    }
  }

  /**
   * Display a [More] prompt and wait for any key.
   * Replaces: more() / more_nomail()
   */
  async more() {
    this.send('\r\n`2[ `%More`2 ]`0 ');
    await this.getKey();
    this.send('\r');
    this.clearEOL();
  }

  /**
   * Display a prompt and wait for a key from a set.
   * Returns the matched key (uppercased).
   *
   * @param {string}   prompt   Text to display
   * @param {string[]} options  Accepted keys (case-insensitive)
   */
  async prompt(promptStr, options) {
    this.send(promptStr);
    const valid = options.map(o => o.toUpperCase());
    while (true) {
      const k = await this.getKeyUpper(true);
      if (valid.includes(k)) return k;
    }
  }

  // ── Session lifecycle ──────────────────────────────────────────────────────

  /** Gracefully end the session. */
  end() {
    if (!this.alive) return;
    this.alive = false;

    // Resolve all pending getKey() calls with null
    while (this._keyResolvers.length > 0) {
      this._keyResolvers.shift()(null);
    }

    this.emit('end');

    if (this.ws.readyState === 1) {
      this.ws.close();
    }
  }

  /** Kick the player with a message (e.g. duplicate login). */
  kick(reason) {
    this.send(`\r\n\`4${reason}\`0\r\n`);
    this.end();
  }
}

module.exports = Session;
