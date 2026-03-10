'use strict';

/**
 * server/game/utils/pronouns.js
 *
 * Returns a pronoun bundle for the given gender value.
 * Supports 'M' / 'F' (legacy) as well as 'male' / 'female' / 'nonbinary'.
 *
 * Usage:
 *   const pr = getPronouns(player.sex);
 *   `${player.name} raises ${pr.possessive} sword!`
 *   `${cap(pr.subject)} charges into the fray!`
 */

const PRONOUNS = {
  male: {
    subject   : 'he',
    object    : 'him',
    possessive: 'his',
    reflexive : 'himself',
    title     : 'Sir',
    son       : 'son',
    child     : 'boy',
    // legacy arcade flavour
    sonDaughter : 'son',
    boyGirl     : 'boy',
    manWoman    : 'man',
    ladGirl     : 'girl',        // "lad or girl" in rescue event (opposite gender)
    princessPrince : 'princess', // who the player rescues
    damsels     : 'damsel',
  },
  female: {
    subject   : 'she',
    object    : 'her',
    possessive: 'her',
    reflexive : 'herself',
    title     : 'Lady',
    son       : 'daughter',
    child     : 'girl',
    sonDaughter : 'daughter',
    boyGirl     : 'my girl',
    manWoman    : 'woman',
    ladGirl     : 'lad',
    princessPrince : 'prince',
    damsels     : "stinkin' prince",
  },
  nonbinary: {
    subject   : 'they',
    object    : 'them',
    possessive: 'their',
    reflexive : 'themself',
    title     : 'Ser',
    son       : 'child',
    child     : 'friend',
    sonDaughter : 'child',
    boyGirl     : 'friend',
    manWoman    : 'warrior',
    ladGirl     : 'friend',
    princessPrince : 'royal',
    damsels     : 'royal in distress',
  },
};

// Normalise legacy 'M'/'F' values
function normalise(sex) {
  if (sex === 'M') return 'male';
  if (sex === 'F') return 'female';
  return PRONOUNS[sex] ? sex : 'male';
}

/**
 * Returns the pronoun bundle for a player's sex field.
 * @param {string} sex  - 'M', 'F', 'male', 'female', or 'nonbinary'
 */
function getPronouns(sex) {
  return PRONOUNS[normalise(sex)];
}

/**
 * Capitalise the first letter of a string.
 * Handy for sentence-starting pronouns:
 *   cap(pr.subject)  →  'He' / 'She' / 'They'
 */
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Display-friendly gender label for View Stats.
 */
function genderLabel(sex) {
  const map = { M: 'Male', F: 'Female', male: 'Male', female: 'Female', nonbinary: 'Non-Binary' };
  return map[sex] || 'Unknown';
}

module.exports = { getPronouns, cap, genderLabel, normalise };
