# Web LoRD Specification

## 1. Purpose

This project is a standalone web-based remake of Legend of the Red Dragon.

Primary goals:
- Feel as close to classic LoRD as possible
- Preserve the daily-play rhythm, terminal feel, and menu-driven UX
- Use a clean architecture that allows future LoRD expansions
- Prefer JavaScript over TypeScript
- Use the existing project as a salvageable prototype, not a rewrite target

Non-goals:
- Do not build a generic multi-game engine
- Do not redesign LoRD into a modern web app
- Do not add new major features until stabilization and fidelity work are complete

## 2. Core Design Principles

1. LoRD feel matters more than exact original formulas
2. Presentation matters almost as much as mechanics
3. Daily ritual is core to the game
4. Fast menu loops are essential
5. Weirdness, flavor, and mild cruelty are required
6. Systems must be data-driven where practical
7. The codebase must have one canonical architecture and one canonical player schema

## 3. Canonical Stack

Backend:
- Node.js
- JavaScript (CommonJS or ESM, but be consistent)
- SQLite

Frontend:
- Custom terminal-style frontend
- WebSocket session loop
- Styled text rendering with inline markup tokens rendered to HTML spans
- Do not use xterm.js unless absolutely necessary

## 4. Canonical Player Schema

These fields are canonical. Do not use duplicate aliases.

Identity:
- id
- username
- pass_hash
- display_name
- sex
- class

Progression:
- level
- exp
- heroic_deeds_done
- current_lap

Vitals:
- hp
- hp_max
- is_alive
- last_killed_at

Economy:
- gold_on_hand
- gold_in_bank
- gems
- charm

Equipment:
- weapon_id
- armor_id

Daily resources:
- turns_forest_left
- turns_forest_max
- turns_pvp_left
- turns_pvp_max
- training_challenge_used_today

Inn / daily action flags:
- flirt_used_today
- bard_listens_used_today
- money_doubler_used_today
- in_inn_room
- inn_room_expires_day_key

Daily state:
- last_day_seen
- spirits

Skills:
- skill_level_death
- skill_level_mystic
- skill_level_thief
- skill_uses_death
- skill_uses_mystic
- skill_uses_thief
- skill_mastery_death
- skill_mastery_mystic
- skill_mastery_thief

Special flags:
- has_fairy
- olivia_seen
- olivia_clue_stage
- olivia_used_today

## 5. Daily Cycle

At the first login of a new game day:
- apply bank interest
- reset daily actions
- clear room state if it expires daily
- revive dead players
- roll spirits
- show Daily News
- place player in Town Square

Default daily values:
- turns_forest_max = 30
- turns_forest_left = 30
- turns_pvp_max = 1
- turns_pvp_left = 1

Spirits:
- HIGH
- NORMAL
- LOW

Default odds:
- HIGH 25%
- NORMAL 50%
- LOW 25%

Immediate gameplay effects:
- HIGH enables Jennie outcomes and may slightly improve certain event outcomes
- LOW blocks Jennie and may slightly worsen some outcomes
- NORMAL has no modifier

## 6. Economy

Pocket gold and bank gold are separate.

Rules:
- combat rewards go to gold_on_hand
- purchases use gold_on_hand
- bank protects gold from PvP theft
- bank interest applies once per day
- money doubler doubles gold_in_bank

Default bank interest:
- 10% per day

Money doubler:
- text: "Somewhere magic has happened!"
- effect: double gold_in_bank
- max once per player per day
- default hook: Seth Able / bard reward path

## 7. Equipment

Weapon and armor are single-slot.

Weapon list uses classic price ladder:
1 Stick – 200
2 Dagger – 1,000
3 Short Sword – 3,000
4 Long Sword – 10,000
5 Huge Axe – 30,000
6 Bone Cruncher – 100,000
7 Twin Swords – 150,000
8 Power Axe – 200,000
9 Able's Sword – 400,000
10 Wan's Weapon – 1,000,000
11 Spear of Gold – 4,000,000
12 Crystal Shard – 10,000,000
13 Nira's Teeth – 40,000,000
14 Blood Sword – 100,000,000
15 Death Sword – 400,000,000

Armor uses matching tier progression and price points.

Selling:
- returns floor(cost * 0.5)

## 8. Combat

Combat must be:
- fast
- readable
- swingy
- dangerous

Enemy model must include:
- name
- hp
- attack_min
- attack_max
- defense
- rewards
- danger rating

Player outgoing damage:
- base from level + weapon + random variance
- subtract enemy defense
- minimum 1

Enemy outgoing damage:
- random between attack_min and attack_max
- subtract player defense from armor and other sources
- minimum 1

Power move:
- rare strong hit
- visually highlighted

Do not use enemy attack value as enemy defense.

## 9. Forest

Forest is the main PvE loop.

Core actions:
- Look
- Attack
- Run
- Return to Town

Rules:
- Attack consumes forest turns
- Look should feel quick and should lead to enemy or event
- Events are a major part of the LoRD identity

Core event set:
- Fairies
- Old Man
- Old Witch
- Jennie
- Dead Bird Rescue
- Olivia
- money doubler hook where appropriate
- clue-bearing events for rescue chain

## 10. Training

Leveling is gated by Turgon's Warrior Training.

Rules:
- EXP alone does not level the player
- player must challenge and defeat the current master
- only one challenge attempt per day
- losing leaves player alive but punished
- winning increases level and max HP

Training menu:
- Question the master
- Attack the master
- Hall of Honor
- Return to Town

## 11. Inn

The Inn is a core daily hub.

Must include:
- bartender
- Seth Able
- Violet
- room rental
- break-in gateway

Rules:
- room protects from ordinary Fields PvP
- bribed attackers can target roomed players if level rules allow
- Seth can grant extra forest fights and other boons
- Violet gives XP and flirt loop rewards

## 12. PvP

Two modes:
- Fields PvP
- Inn break-in PvP

Rules:
- one PvP attack per day by default
- running away is allowed
- kills generate Daily News
- dead players are unavailable until next day
- roomed players are protected from free Fields attacks

## 13. Dragon Endgame

At level 12:
- player can search for the Red Dragon in the Forest

Dragon fight:
- high-stakes boss fight
- fairy can revive once if possessed

On dragon victory:
- heroic_deeds_done += 1
- current_lap += 1
- player resets to level 1
- bank gold persists
- hero deed / lap progress persists
- equipment resets to starter
- display a ceremonial victory flow

## 14. Rankings

Core ranking views:
- Player Rankings
- Heroic Deeds rankings
- Old Man top-lists

Sorting priority for main rankings:
- heroic_deeds_done desc
- level desc
- exp desc
- display_name asc

## 15. Daily News

Daily News is the world heartbeat.

Must record:
- PvP kills
- self-defense kills
- dragon kills
- master defeats
- money doubler
- major Inn outcomes
- major special events

Store final rendered message text for stability.

## 16. UX / Look and Feel

The game must not look like a plain green debug terminal.

Required visual features:
- styled text colors
- location-specific headers
- highlighted prompts
- clear separation of flavor text vs system text vs warnings
- visually distinct Town, Forest, Inn, Bank, Training
- compact status display
- fast menu-driven rhythm

Supported style tokens:
- [c:green]
- [c:red]
- [c:yellow]
- [c:cyan]
- [c:magenta]
- [c:white]
- [dim]
- [b]

Client must render tokens into HTML spans.

## 17. Routing Architecture

There must be one canonical screen system.

Rules:
- each major screen has one renderer and one input handler
- no stub screen may shadow a real implementation
- navigation helpers may exist, but not competing screen registries

## 18. Code Quality Rules

- Prefer JavaScript
- Prefer one source of truth for each concept
- Prefer small services over giant god objects
- Prefer data files for monsters, equipment, levels, masters
- Do not add new features before stabilization is complete