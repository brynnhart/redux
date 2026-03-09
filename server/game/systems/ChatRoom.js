'use strict';

/**
 * server/game/systems/ChatRoom.js
 *
 * Live chat-room engine for the Inn bar (and extensible to other channels).
 *
 * How it works
 * ────────────
 * Each named room holds a Map of  session → { name, inputBuf }
 * When any participant sends a message or enters/leaves, we broadcast
 * a rendered ANSI line to every other participant's terminal — even if they
 * are mid-way through typing their own message.
 *
 * Mid-typing injection uses the sequence:
 *   \r\x1b[K          erase the current input line
 *   <new line>\r\n     print the incoming message
 *   <prompt + buf>     reprint the user's partial input
 *
 * This keeps the terminal coherent with no screen-clearing.
 *
 * Public API
 * ──────────
 *   ChatRoom.enter(roomId, session, playerName)  → ChatHandle
 *
 * ChatHandle methods (returned to the caller):
 *   handle.broadcast(line)       send colored line to all OTHER occupants
 *   handle.broadcastAll(line)    send colored line to ALL occupants (incl. self)
 *   handle.roster()              returns array of names currently in room
 *   handle.leave()               remove self, broadcast departure
 *   handle.setInputBuf(str)      update stored buffer so pushes can reprint it
 */

const LordColors = require('../text/LordColors');

// roomId → Map<session, { name, inputBuf }>
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

function ansi(lordStr) {
  return LordColors.toAnsi(lordStr);
}

/**
 * Push a rendered line to one session, handling the mid-typing case.
 * If the session has a non-empty inputBuf we:
 *   1. Erase the current line
 *   2. Print the new line
 *   3. Reprint the prompt + inputBuf
 */
function pushToSession(session, participant, renderedLine) {
  if (!session.alive) return;
  const buf = participant.inputBuf || '';
  if (buf.length > 0) {
    // Erase input line, inject, reprint
    session.send(
      '\r\x1b[K' +            // erase current line
      renderedLine + '\r\n' + // new chat line
      ansi('`2> `%') + buf    // reprint prompt + partial input
    );
  } else {
    // User is not mid-typing — just print (still erase line first for safety)
    session.send('\r\x1b[K' + renderedLine + '\r\n');
    // If a prompt is showing, reprint it
    if (participant.promptShowing) {
      session.send(ansi('`2> `%'));
    }
  }
}

/**
 * Enter a room. Returns a ChatHandle object.
 *
 * @param {string}  roomId
 * @param {Session} session
 * @param {string}  playerName
 * @returns {ChatHandle}
 */
function enter(roomId, session, playerName) {
  const room = getRoom(roomId);

  const participant = {
    name:          playerName,
    inputBuf:      '',
    promptShowing: false,
  };

  room.set(session, participant);

  // ── ChatHandle ────────────────────────────────────────────────────────────

  const handle = {
    /** Update the stored input buffer so injected lines can reprint it. */
    setInputBuf(str) {
      participant.inputBuf      = str;
      participant.promptShowing = true;
    },

    /** Mark that the prompt is/isn't showing (affects reprint after inject). */
    setPromptShowing(bool) {
      participant.promptShowing = bool;
    },

    /** Current list of names in the room (including self). */
    roster() {
      return [...room.values()].map(p => p.name);
    },

    /** Send a line to everyone EXCEPT this session. */
    broadcast(lordLine) {
      const rendered = ansi(lordLine);
      for (const [s, p] of room) {
        if (s === session) continue;
        pushToSession(s, p, rendered);
      }
    },

    /** Send a line to ALL participants including self. */
    broadcastAll(lordLine) {
      const rendered = ansi(lordLine);
      for (const [s, p] of room) {
        pushToSession(s, p, rendered);
      }
    },

    /** Leave the room (does NOT broadcast departure — caller does that). */
    leave() {
      room.delete(session);
      participant.inputBuf      = '';
      participant.promptShowing = false;
    },
  };

  return handle;
}

/** How many people are in a room right now. */
function count(roomId) {
  return rooms.has(roomId) ? rooms.get(roomId).size : 0;
}

module.exports = { enter, count };
