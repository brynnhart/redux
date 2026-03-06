# P6-01 Forest Core Content Gap Notes

## What was refined

### Olivia
- Added a dedicated `olivia` forest event with once-per-day cadence using `olivia_used_today`.
- Olivia now has an explicit weird identity: mist, upside-down entrance, unsettling hints, and risky follow outcomes.
- Olivia is no longer pure flavor; she now meaningfully advances rescue clues and grants tangible rewards or pain.

### Rescue clue chain
- The dead bird rescue now reads and uses `olivia_clue_stage`.
- Old Man can seed clue stage 1.
- Old Witch can promote clue stage 2.
- Olivia can push clue progress to stage 3.
- At high clue stage, rescue options narrow and outcomes are more coherent (lake-targeted logic).
- On successful rescue, clue stage resets so the chain can replay cleanly.

### Event weighting
- Rebalanced event weights toward a more classic-feeling forest rhythm:
  - Fairies: 24 (was 30)
  - Old Man: 22 (was 25)
  - Old Witch: 18 (was 20)
  - Dead Bird Rescue: 12 (was 15)
  - Olivia: 8 (new)
  - Jennie: 4 (was 5, still spirits-gated)
  - Mystical Guessing: 1 (class-gated)
- This keeps common beats common while preserving rare weird spikes.

## Forest identity improvements in this pass
- Tightened event flavor text to be less generic and more LoRD-weird (mocking, uncanny, slightly cruel).
- Ensured clues are delivered through iconic personalities instead of abstract random outcomes.
- Made rescue feel like a mini-arc with setup and payoff rather than one isolated roulette event.
- Preserved fast menu loop behavior while increasing personality density per encounter.
