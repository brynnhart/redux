# Web LoRD Roadmap

## Phase 1: Architecture Stabilization
Goal:
- remove duplicate screen architecture
- choose one canonical screen/routing system
- normalize player schema
- make the repo structurally sane

Outcome:
- one router
- one screen system
- one player schema
- no duplicate field hacks

## Phase 2: TypeScript to JavaScript Conversion
Goal:
- convert the stabilized codebase from TypeScript to JavaScript
- preserve behavior
- simplify tooling

Outcome:
- .js codebase
- no tsconfig dependency
- simpler package scripts
- project still runs

## Phase 3: Renderer Upgrade and LoRD Visual Fidelity
Goal:
- replace plain one-color rendering
- implement styled text token rendering
- make core screens visually distinct and BBS-like

Targets:
- Town
- Forest
- Inn
- Bank
- Training

Outcome:
- game looks like a terminal door game, not a debug screen

## Phase 4: Combat Correction and Rebalance
Goal:
- fix enemy defense bug
- normalize damage formulas
- rebalance enemies, masters, PvP, and dragon

Outcome:
- combat makes mechanical sense
- upgrades matter
- battles feel dangerous but fair

## Phase 5: Core LoRD Fidelity Pass
Goal:
- rewrite and tighten the UX, layout, prompts, and flavor text of all core screens
- ensure daily rhythm and menu behavior feel like LoRD

Targets:
- Town
- Forest
- Inn
- Bank
- Shops
- Training
- Daily News
- Rankings
- Dragon flow

Outcome:
- the game feels recognizably like LoRD

## Phase 6: Core Content Gap Pass
Goal:
- fill in missing or weak core LoRD content

Targets:
- Olivia
- rescue clue interplay
- event weighting refinement
- stronger Inn weirdness
- stronger Daily News flavor pool
- stronger monster identity

Outcome:
- complete-feeling core LoRD loop

## Phase 7: Resume Expansion Work
Goal:
- only after stabilization and fidelity work
- continue with extra places, expanded event packs, optional modernizations, and future content