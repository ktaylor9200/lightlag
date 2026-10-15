# LIGHT LAG: handoff

**Deliverable:** `/srv/agents/workspaces/lightlag/lightlag.html`: one self-contained file, about 170 KB, with inline JS and CSS, no network, no fonts and no assets. Hand it over as an HTML artifact.

## What was built
This is Evelyn's BRIEF-final.md in full, plus BRIEF-L0.md:
- **L0 "First Light" (tutorial):** a guided run ahead of L1. You send A to a fixed mark and WAIT nine years, one line a year, through the three delays: order out (2 yrs), drone flight (4 yrs) and news home (3 yrs). It includes two one-tap predictions and a win screen with a delay ledger. L0 is appended to `levels.json` with a new `reach` objective in both sims; the guide copy sits in one `L0` block in `src/data.js`. L1's watch-only beat now auto-plays only for players who haven't cleared L0, and it stays under How light works.
- **Act I (L1–L4):** stale sight and late orders, FLASH, a relay riding a derelict, and hidden-mirror glints filed as "noise".
- **The Reclassifying interstitial** and **Act II (L5–L7):** ASK, Home ASK, precedents, spacelike-separated requests, and R's split into R′.
- **Act III finale (L8):** the scripted timeline with three endings: Answer, Delegate (standing) and Hold (PENDING, auto-runs from yr 25). Each ending has a stamp card, the forest reply as synthesized audio plus a waveform and caption, a truth replay, credits, and an "Endings found n of 3" count.

Throughout the game:
- Solid shapes are seen; dashed shapes are calculated.
- A derelict's projection unlocks only after Home has seen it move, and arrival tags never leak hidden objects.
- A win is confirmed only when the light reaches Home ("happened / found out" years).
- Each level ends with a truth replay (AS SEEN ↔ AS IT WAS, with a scrubber).
- Rewind, smart rewind, restart, a 3-step hint ladder, a codex, the Home log, sound on/off and reduced motion are all available.
- Progress is saved under the localStorage key `lightlag.v1`, and the game runs normally if storage is blocked.
- **Save rule:** new saves (and saves that started L1 but never won it) begin at L0. *Skip to Level 1* on L0's card sets `l0Skipped`. Anyone who has won L1, reached L2+ or found an ending never sees L0 unless they pick it from level select (Tutorial row, always unlocked). The `l0Skipped` default was added with no version bump.

There were two stages: Oliver's initial build (commit 833a315), then a Claude Code polish pass (run d466fac05, 4 commits). The polish pass added label de-cluttering, juice on year transitions and confirmations, a stable layout, a rebuilt win screen and endings, and fixes for a few bugs.

## How it was tested
- `node test/sim.test.js`: the JS rules sim matches `reference/verify-report.txt` (63/63: unlock years, every test plan including L0's, glint years).
- `node test/finale.test.js`: finale timeline, 8/8.
- `node test/play.js`: plays every `levels.json` test plan through the real game in headless Chrome (L0 with `G.noGuide`). All results match the report: naive plans fail, reference plans confirm in the right year. All 3 endings fire: Answer yr 21 (drone ASK yr 23), Delegate yr 27, Hold yr 30. It also boots with storage blocked and makes no network requests.
- `node test/flows.js <dir>`: checks layout and tap targets at **360×560, 360×640 and 390×844** (nothing off-screen, buttons ≥ 44 px, the board never under the dock). It also covers the tutorial coach staying clear of its targets, win → act card → interstitial → L5, and the ending → credits, all by real taps, with screenshots.
- `node test/misc.js` (▸▸ until news, smart rewind, menu rewind, hints, inspector) and `node test/smoke.js <dir>` (boot → skip L0 → L1 tutorial by touch taps) pass.
- `node test/l0.js <dir>`: L0 by real taps at 390×844, 360×640 and 360×560. It covers fresh boot, the full guided run with every caption, coach clearance, layout, gating, Restart, the hand-off to L1, the skip path, veteran saves, reduced motion, storage blocked and no network. It saves the 14 review screenshots per size.
- Every suite was rerun by Oliver after the polish pass, and all pass.

## Known limits
- **No human playtest yet.** The 25–35 min playtime is an estimate from the brief's per-level timings, not a measurement.
- It was tested in headless Chrome with touch emulation, not on a real iOS or Android device or inside the chat client's iframe. Safari quirks are possible but unverified.
- Audio was checked only for gating (nothing plays before the first tap), not by ear.
- `window.__LL` is a small test hook left in the file. It is harmless: no network and no data.
- In Act I, hidden mirrors show only as glints, by design. They appear in replays once Act II has been reached.
