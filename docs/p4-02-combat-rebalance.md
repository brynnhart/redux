# P4-02 Combat Rebalance Notes

This pass re-tunes combat numbers after the defense-formula correction from P4-01.

## Forest enemy tiers

- Enemy templates were moved into `data/enemies.json` so combat tuning can happen in data instead of code.
- Early enemies (L1-3) now hit slightly harder so opening turns feel dangerous.
- Mid and late enemies (L4-12) received HP and attack bumps to keep pace with better weapon scaling.
- Defense growth stays restrained to avoid damage floors and keep fights readable/swingy.

## Masters and challenge pacing

- All masters received higher HP and a smoother attack/defense ramp.
- Gate fights should now require preparation instead of being burst down by variance.
- Turgon is now a more meaningful final training check before dragon access.

## PvP kill/flee dynamics

- PvP flee is no longer always safe: attempts can fail and trigger a punishment strike.
- Flee risk and punishment multipliers are configurable in `config` via env vars.
- PvP kill theft uses configurable min/max steal percentages instead of a single fixed range.
- Attackers now retain their actual remaining HP after a PvP kill, keeping PvP high-risk.

## Dragon tuning

- Dragon defaults reduced from extreme grind values to a high-danger but winnable climax fight.
- Dragon crit chance is higher and fairy revive ratio is slightly lower, preserving danger.
- All dragon knobs remain in config/env for future tuning without logic edits.
