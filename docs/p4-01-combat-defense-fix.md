# P4-01 Combat Defense Fix

## Old bug

Enemy attack was incorrectly reused as enemy defense in player damage mitigation.

In practice, calls like `playerAttackDamage(player, enemy.attackMin)` treated the enemy's
minimum attack value as if it were defense, so tuning enemy offense also unintentionally
reduced player outgoing damage.

## New formulas

Combat now uses explicit defense values and symmetric mitigation rules:

- **Player outgoing damage**
  - roll `raw` from player attack band (`0.8x` to `1.2x` of base attack from config + weapon)
  - apply defense: `max(1, raw - enemy.defense)`

- **Enemy outgoing damage**
  - roll `raw` from enemy attack band (`0.8x attackMin` to `1.2x attackMax`)
  - apply defense: `max(1, raw - playerDefense)` where playerDefense is baseDef + armor bonus

- **Damage floor**
  - all outgoing damage remains clamped with a minimum of `1`

## Model updates

- Enemy templates now include `defenseBase` and `defensePerLevel`.
- Active forest encounters now include concrete `defense`.
- Master encounters pass through `master.def` as enemy defense.
- Red Dragon uses explicit `dragonDefense` config (`LORD_DRAGON_DEFENSE`).
