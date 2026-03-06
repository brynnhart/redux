# P1-02 Player Schema Migration Summary

Migration `schema_version = 19` rebuilds the `players` table into the canonical schema from `lord-spec.md §4`.

## Canonicalized fields

- Gold: `gold_on_hand`, `gold_in_bank`
- Inn / room: `in_inn_room`, `inn_room_expires_day_key`
- Daily flags: `flirt_used_today`, `bard_listens_used_today`, `money_doubler_used_today`, `training_challenge_used_today`, `last_day_seen`
- Heroic deed: `heroic_deeds_done`

## Data preservation mappings

When migrating existing databases, values are preserved with `COALESCE(...)` from legacy aliases:

- `gold_on_hand` from `gold_on_hand`, `gold_pocket`, `gold`
- `gold_in_bank` from `gold_in_bank`, `gold_bank`, `bank_gold`
- `flirt_used_today` from `flirt_used_today`, `inn_flirt_used_today`, `has_flirted_today`, `daily_flirt_used`
- `bard_listens_used_today` from `bard_listens_used_today`, `seth_listens_used_today`, `has_listened_bard_today`, `daily_bard_used`, `today_bard_listens`
- `money_doubler_used_today` from `money_doubler_used_today`, `today_money_doubler_used`
- `in_inn_room` from `in_inn_room`, `in_room`, `has_room`
- `last_day_seen` from `last_day_seen`, `last_day_key`, `last_daily_reset_date`
- `heroic_deeds_done` from `heroic_deeds_done`, `heroic_deeds`

## Notes

- Deprecated duplicate columns are removed from live schema after table rebuild.
- `olivia_seen`, `olivia_clue_stage`, and `olivia_used_today` are added with safe defaults.
