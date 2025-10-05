# Manual Smoke Checklist

This checklist walks through the happy-path flow QA should cover after starting the local server (`npm start`).

## Navigation
- [ ] Load http://localhost:3000 and confirm the Town Square view renders with PunkyRoo's stats and the daily prompt.
- [ ] Click the `(I)nn` option (or press the `I` key) to open the Inn view and confirm the bard/violet status panel populates.
- [ ] Return to the Town Square from the Inn by clicking `(Q)uit to Town Square` (or pressing `Q`).
- [ ] From the Town Square, press the `Y` key to open the Bank view and confirm the on-hand and bank balances render.

## Announcements and News
- [ ] Back on the Town Square, open the `(M)ake Announcement` modal.
- [ ] Submit a unique announcement message (e.g., include the current timestamp) and wait for the success confirmation.
- [ ] Refresh the browser and use the `D` key to open Daily News.
- [ ] Confirm the submitted announcement appears at the top of the Daily News list.

## Interface Toggles & Presence
- [ ] On the Town Square, toggle `(X)pert Mode` on and confirm the introductory lead text hides; toggle it off again so the lead returns.
- [ ] Press the `P` key to open People Online and confirm PunkyRoo appears in the list within ~30 seconds (the presence heartbeat runs every 30s).
