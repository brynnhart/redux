# P5-03 Consistency Pass Notes

## Scope
- Daily News tone and event flavor.
- Rankings readability and emotional payoff.
- Shared wording/style consistency with other LoRD-styled screens.

## What changed
- Replaced flat Daily News statements for PvP kills, self-defense, dragon kills, master defeats, and Inn marriage/divorce outcomes with short flavor pools.
- Added explicit context support (`FIELDS` vs `INN`) for PvP kill news lines so messages fit where the action happened.
- Updated Daily News screen copy and layout to use styled headings, dimmed flavor text, and clearer paging hints.
- Reworked leaderboard screens (Player Rankings, Heroic Deeds, Old Man menu, Old Man top lists) to use consistent LoRD-style color tokens, stronger section headers, and more satisfying footer copy.
- Highlighted the current player row with a yellow marker in all ranking tables.

## Consistency decisions
- Keep message lengths short enough to fit terminal-width lines and preserve fast reading rhythm.
- Reserve brighter colors for headers/prompts and yellow accent for player-centric highlights.
- Keep system controls in cyan across these screens for prompt consistency (`Enter`, `Q`, `N`, `P`, list choices).
- Use dim text for atmospheric flavor, not key gameplay instructions.
