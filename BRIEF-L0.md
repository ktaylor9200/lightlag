# LIGHT LAG: L0 "First Light", the tutorial level (build brief)

Evelyn, 2026-10-15. This is an addendum to BRIEF-final.md. Where the two disagree on L0, this file wins. For L1–L8, BRIEF-final.md still governs.
Base: master @ 8c9cfd8. Every number below was checked against `reference/sim.py` and `src/sim.js` on a scratch copy. Nothing in the repo was touched.

---

## 0. The decision in one paragraph

Add a short, **guided, interactive** level 0, called **First Light**, ahead of L1. The player sends one drone to a fixed mark two hexes away and then lives through the nine years it takes to *find out*, one WAIT at a time. Each year has one line of narration. The trip splits cleanly into three separate delays with three different lengths: **order out 2 yrs → drone flight 4 yrs → news home 3 yrs**. Two one-tap predictions make the player work out the light-speed legs before seeing them. There is no derelict, no projection and no puzzle. That teaching stays in L1, which now gets a player who already understands orders. **New saves start in L0. L0 can be skipped. Saves that have already played L1 never see it unless they choose it.** The watch-only beat in L1 now auto-plays only for players who skipped L0, and stays available under How light works.

Why guided rather than a free puzzle: Kane's stumbling point was the *model* (orders vs drone moves vs transit times), not a lack of challenge. A free sandbox lets a player skip past the three delays without noticing them. A fixed run with one caption per year makes each delay visible, named and counted. The two predictions supply the active part.

Why one drone and a static mark: a moving target turns this into L1. L0 is about the *two directions* of light (orders go out from the centre and news comes back to it) and the drone leg between them.

---

## 1. Learning goals (what a player can say after L0)

1. **Rings are years, in both directions.** Ring n is n light-years from Home. An order takes n years to get there, and light from there takes n years to come back.
2. **What you see is old light.** The solid drone is where A *was* when the light left it.
3. **Solid = seen, dashed = calculated.** Three dashed things are named on screen: the order's front, A's calculated position, and the news of A's arrival on its way home.
4. **An order has three delays.** It travels at light speed to the drone. The drone then moves at half light speed (2 years per hex). Home finds out only when the light of the result arrives.
5. **You win when you find out, not when it happens.** "It happened in year 6. You found out in year 9."

---

## 2. Level data (append; do not prepend)

### 2.1 `reference/levels.json`: append as the LAST element of `levels`

```json
    {
      "n": 0, "act": 0, "name": "First Light", "R": 3,
      "drones": {"A": [1, -2]},
      "objective": {"type": "reach", "drone": "A", "cell": [3, -2], "text": "Send A to the mark. Then find out."},
      "test_plans": {
        "no order": [],
        "reference: send A at y0": [[0, "MOVE", "A", [3, -2]]],
        "late order (y3)": [[3, "MOVE", "A", [3, -2]]],
        "wrong hex, then the mark (y1)": [[0, "MOVE", "A", [2, -3]], [1, "MOVE", "A", [3, -2]]]
      }
    }
```

**Append it; don't prepend it.** `test/sim.test.js` reads `data.levels[1]` as L2, and the interstitial reads `LEVELS_JSON[n - 1]`. Appending keeps every existing array index and the first 41 lines of the report byte-identical. **The L1–L7 entries must not change** (verified: the JSON of levels n ≥ 1 is identical after the append). FINALE_LEVEL in `src/data.js` is untouched.

Geometry: R = 3, which gives bigger hexes on a phone. Home is at (0,0). Drone **A** is at (1,−2), ring 2, upper right. The **mark** is at (3,−2), ring 3, two hexes east of A along the path (1,−2) → (2,−2) → (3,−2). Everything sits in the upper half of the board, so the coach card can use the empty lower half. This placement was chosen by enumerating every R = 3 layout. It is one of the few where the three delays are all different (2 / 4 / 3) and the "fast drone" codex can't fire by accident.

### 2.2 New objective type `reach` (additive, a few lines in each sim)

The level is won when Home *sees* drone `drone` standing on `cell`. The required event is the first year t ≥ 0 that the drone occupies the cell, at that cell. Confirmation is `t + ring(cell)`, as for every other objective.

`reference/sim.py`, in `outcome()`, just before `elif obj['type'] == 'sign':`

```python
    elif obj['type'] == 'reach':
        # L0: the first year (>= 0) the named drone stands on the cell
        h = res['hist'][('drone', obj['drone'])]
        cell = tuple(obj['cell'])
        ts = [t for t in sorted(h) if t >= 0 and h[t] == cell]
        if not ts:
            return None, res
        req.append((ts[0], cell, 'reach', obj['drone']))
```

`src/sim.js`, in `outcome()`, just before `} else if (obj.type === 'sign') {`

```js
    } else if (obj.type === 'reach') {
      // L0: the first year (>= 0) the named drone stands on the cell
      const h = res.hist['drone:' + obj.drone] || {};
      let t = null;
      for (let y = 0; y <= T; y++) if (h[y] && eq(h[y], obj.cell)) { t = y; break; }
      if (t === null) return null;
      req.push({ t, pos: obj.cell, type: 'reach', data: obj.drone });
```

No other sim rule changes. `reach` doesn't emit a sim event. It exists only in `outcome().req`, which is what `onWin`, `confirmFx`, `showWin` and the truth replay already use.

### 2.3 `reference/verify-report.txt`: yes, it gets a new entry

Regenerate it with `python3 reference/sim.py > reference/verify-report.txt`. Lines 1–41 must come out byte-identical to the current file (verified). These 6 lines are appended:

```
======================================================================
0 First Light
  no order                             -> None
  reference: send A at y0              -> {'confirmed_at_home': 9, 'happened_at': 6, 'lag': 3}
  late order (y3)                      -> {'confirmed_at_home': 12, 'happened_at': 9, 'lag': 3}
  wrong hex, then the mark (y1)        -> {'confirmed_at_home': 10, 'happened_at': 7, 'lag': 3}
```

`node test/sim.test.js` then reports **63 passed, 0 failed**: the previous 55, plus 4 L0 plans × 2 checks each. This was verified on the scratch copy with no change to the test file.

### 2.4 Reference timeline (the guided run is always this plan: MOVE A → (3,−2) at yr 0)

| Year | True A | Dashed A (calculated) | Solid A (seen; true year) | What is happening |
|---|---|---|---|---|
| 0 | (1,−2) | (1,−2) | (1,−2) from yr −2 | TRANSMIT. The order front leaves Home. |
| 1 | (1,−2) | (1,−2) | (1,−2) from yr −1 | Order front at ring 1 |
| 2 | (1,−2) | (1,−2) + order-landed tick | (1,−2) from yr 0 | **Order lands** (order_rx t = 2): delay 1 = 2 yrs |
| 3 | (1,−2) | (1,−2) | (1,−2) from yr 1 | A adopted the order; first step due yr 4 |
| 4 | (2,−2) | (2,−2) | (1,−2) from yr 2 | Dashed and solid split (thread drawn) |
| 5 | (2,−2) | (2,−2) | (1,−2) from yr 3 | |
| 6 | **(3,−2)** | (3,−2) | (2,−2) from yr 4 | **A arrives**: delay 2 = 4 yrs. Home first *sees* A move. |
| 7 | (3,−2) | (3,−2) | (2,−2) from yr 5 | News front at radius 1 from the mark |
| 8 | (3,−2) | (3,−2) | (2,−2) from yr 5 | News front at radius 2 |
| 9 | (3,−2) | (3,−2) | **(3,−2)** from yr 6 | **Confirmed**: delay 3 = 3 yrs. Win. |

The outbox/arrival tag for the queued order reads **"arrives yr 6"**. No codex discovery fires in L0: the drone's seen moves come at yrs 6 and 9, not in consecutive years.

---

## 3. Flow and on-screen copy

Voice: Home's (dry, exact, unhurried; no exclamation marks). **Bold lead** = the coach's existing teal `lead` span. Every caption is also written to the Home log with `addLog`, so the log reads as the story of the run. Coach cards are at most 3 lines at 360 px. They sit over the empty lower half of the board and must never cover Home, A (solid or dashed), (2,−2) or the mark (see §6, check C).

### 3.1 Entry card (overlay, the existing `stack()` style)
- Kicker: **Tutorial**. Title: **First Light**.
- Line 1: *Home is at the centre. Everything else is far away.*
- Line 2 (next tap): *Light crosses one ring a year. So does every order you send.*
- Footer: "tap to begin". A quiet ghost button, **Skip to Level 1**, sits at the bottom of the card at all times (≥ 44 px, and the tap-anywhere handler ignores it, as `showOverlay` already does for buttons).

### 3.2 Guided steps (year 0, before any order)

| # | Trigger to advance | Board visual | Coach copy |
|---|---|---|---|
| G1 | tap the coach | **Outward ripple**: a front expands from Home to ring 3 over about 2.4 s and loops. Each ring's age label brightens as the front crosses it. | **Home.** You're at the centre. Light, and every order you send, goes out one ring a year. |
| G2 | tap the coach | **Return ripple**: a front expands from A until it reaches Home (radius 2), then loops. Small pill on A: "2 yrs ago". | **Old light.** Light from A takes two years to reach you, so you see A as it was two years ago. |
| G3 | tap A | A highlighted (existing tutorial highlight) | Tap your drone, A. |
| G4 | tap the mark | Mark highlighted | **Solid means seen.** Tap the mark to send A there. |
| G5 | tap one prediction chip | Order queued (outbox chip "A → move · arrives yr 6"). The chips row shows **Year 1 · Year 2 · Year 4**, and the primary button is disabled. | Your order travels at light speed. When does A get it? |
| G6 | TRANSMIT | Primary pulses | Right answer (Year 2): *Yes. Ring 2: two years. Now TRANSMIT.* Wrong: *Year 2. Ring 2 is two years out, for orders too. Now TRANSMIT.* |

Wrong taps during G3/G4 get a toast and nothing else (G3: *Tap A: the gold triangle.* G4: *Tap the mark: the outlined hex two to A's right.*). They are never accepted as targets. The ripples are tutorial illustrations, not sim pulses. Draw them over the board the way `drawBeat` does in 8c9cfd8, with the Home colour and a dashed stroke. With reduced motion, draw each ripple once in its end state, with the ring labels lit.

### 3.3 Guided steps (years 1–9; the player taps WAIT ▸, which pulses, once per year)

| Year | Coach copy (lead · text) | Visual that must be on screen |
|---|---|---|
| 1 | **Year 1.** The dashed ring is your order, crossing one ring a year. Tap WAIT. | Order front (existing dashed front) at ring 1 |
| 2 | **Year 2.** The order reaches A. Delay one: two rings, two years. | Existing dashed "order landed" tick on A |
| 3 | **Year 3.** A has its order. Each hex takes it two years: half light speed. | |
| 4 | **Year 4.** Dashed A has moved: that's Home's calculation. Solid A is what Home sees, still two years old. | Dashed A at (2,−2), solid A at (1,−2), thread between them (existing renderer) |
| 5 | **Year 5.** Home knows A is moving. It hasn't seen it move. | |
| 6 | **Year 6.** A reaches the mark: two hexes, four years. Home is only now seeing it leave. | Dashed A on the mark. Solid A steps to (2,−2). The **news front** starts (see §4.3). |
| 6b | Prediction, before WAIT is enabled: *A is there. When will Home see it?* Chips **Year 6 · Year 7 · Year 9**. | |
| 6c | Right (Year 9): *Yes. Ring 3: three years home. WAIT and watch it come.* Wrong: *Year 9. The news has three rings to cross. WAIT and watch it come.* | |
| 7 | **Year 7.** The dashed ring from the mark is the news, coming home a ring a year. | News front at radius 1 |
| 8 | **Year 8.** A has been there two years. Home still sees it on the way. | News front at radius 2. Solid A still at (2,−2). |
| 9 | (the existing `onWin` coach) *Confirmed. It happened in year 6. You found out in year 9.* | Existing confirm burst at the mark |

### 3.4 Win screen (existing `showWin`, with these L0 differences)
- Kicker: **Tutorial · First Light** (not "Level 0").
- The existing "It happened in year **6**. You found out in year **9**." lines.
- **Delay ledger** (new, L0 only), three compact rows under the "when" lines. The numbers are **computed from `G.res` / `G.out`**, not hard-coded:
  - Order out · 2 yrs · light speed, ring 2
  - A flies · 4 yrs · half light speed, 2 hexes
  - News home · 3 yrs · light speed, ring 3
  - Sources: order out = the MOVE's `order_rx.t − sent`; flies = `happened_at − order_rx.t`; news = `confirmed_at_home − happened_at`; ring and hex counts from `SIM.ring` / `SIM.dist`.
- End line (`SCRIPT[0].end`): *Two hexes took nine years. Nothing went wrong. That is how far away everything is.*
- Truth replay as usual. AS IT WAS shows the news travelling home through the existing `newsEvents` path.
- Buttons: Play again · **Next ▸**. Next goes to L1 through the existing `startLevel(1)`.

The whole L0 run takes about 15 taps and 2–3 minutes.

---

## 4. UI and interaction details

### 4.1 Plumbing
- `levelData(n)`: look levels up **by `n`** (`n === 8 ? FINALE_LEVEL : LEVELS_JSON.find(l => l.n === n)`). Change the interstitial's `LEVELS_JSON[n - 1]` to `levelData(n)` too.
- `SCRIPT[0]` in `src/data.js`:
  - `intro`: the two lines from §3.1
  - `end`: from §3.4
  - `hints`: *Tap A, then the outlined mark.* · *TRANSMIT once. Then WAIT, a year at a time, until the news comes home.*
  - `startLog`: *Drone A is two light-years out. The mark is three.*
  - `glints`: none
  - Put all of the guide copy above (G1–G6, years 1–9, toasts and predictions) in one `L0` block in `data.js`, not inline in `game.js`.
- Top bar reads **0 · First Light**. The act label for n = 0 is "Tutorial" wherever `actOf` would print "Act I" (the `startLevel` head, the win kicker).
- **Guide state**: a new `G.guide` (step index, or −1 when off), kept separate from L1's `G.tut` so L1's coach logic doesn't change. While the guide is on:
  - ▸▸ is disabled, menu **Rewind** is disabled (as are the keyboard Backspace/z shortcuts), and only A can be selected.
  - The only MOVE target accepted is the mark. The queued order's ✕ is hidden, as L1 does at `G.tut === 2`.
  - Board taps during WAIT steps toast *Tap WAIT ▸ to let a year pass.*
  - **Restart** restarts the guide at the entry card's G1 (year 0).
  - `loadLevel(n)` for any n ≠ 0 sets `G.guide = -1` and stops any ripple. The boot sequence loads `entryLevel()` behind the title, and the tests then call `loadLevel(1..8)` directly.
- Test hook: `__LL.G.noGuide = true` makes `loadLevel(0)` skip the guide, so `test/play.js` can drive arbitrary L0 plans through the real game. This mirrors how the tests already set `tutorialDone`. Also expose `startLevel` (already exported) and any new guide helpers on `__LL`.

### 4.2 The mark
A stationary map annotation, not an object, so it carries no solid/dashed meaning. Draw it as a hex outline in the Home warm white with a small **MARK** label, visible in seen and true modes and in the replay. It must stay distinct from a highlight (which pulses) and from the relay square.

### 4.3 The news front (L0 only)
From the arrival year (6) until confirmation (9), in **seen** mode, draw a **dashed** front centred on the mark with radius `now − 6` (animated with `G.p` like the other fronts), in the Home colour, clipped to the board like the others. This is legitimately *calculated*: Home knows when its own drone arrives, so it knows where that news must be. It stops at confirmation, where the existing confirm burst takes over. It is L0 only so that L1–L8 visuals and their screenshots don't change. (It could be considered for L1 later. Not now.)

### 4.4 Ring-age labels
`ringSpoke()` prefers low spokes, which in L0 would sit under the coach. For L0, force the NW spoke `[0, -1]` (cells (0,−1), (0,−2), (0,−3) are empty all game) with a UI-only override in `src/` (for example a `spoke` field on `SCRIPT[0]` read by the renderer). **Do not add it to levels.json.**

### 4.5 Prediction chips
Use the existing `#chips` row with three ordinary chips (≥ 44 px). The primary button is disabled while they show. Any answer is accepted, and the feedback line goes in the coach (§3.2 G6 / §3.3 6c). Nothing is scored or saved.

### 4.6 Reused, not rebuilt
Reuse 8c9cfd8's helpers for the ripples and pills (`frontPath`, `drawPill`, `coachAvoid`/`snug`, the `lead` coach style). Sound is unchanged (thoom on transmit, tick when the order lands, chord on confirm). Reduced motion: every L0 animation shows its end state, and the year transitions are instant (existing behaviour).

---

## 5. Progression and save state (`localStorage` key stays `lightlag.v1`)

The schema change is additive only. `loadSave()` defaults gain `l0Skipped: false`, and `cleared` may now contain `0`. No version bump and no migration code: old saves load through the existing `Object.assign` defaults.

**Entry rule** (one function, used by the title button and by the boot-time background level):

```js
function entryLevel(s) {
  const veteran = s.tutorialDone || s.reached > 1 || s.cleared.some((n) => n >= 1) || s.endingsFound.length > 0;
  if (!veteran && !s.cleared.includes(0) && !s.l0Skipped) return 0;
  return Math.min(8, Math.max(1, s.reached));
}
```

| Save state | Title button | Goes to |
|---|---|---|
| Fresh (no save) | BEGIN | Opening cards (unchanged) → title → **L0 entry card** |
| Opening seen, L1 started but never won (`reached 1`, no `tutorialDone`), e.g. Kane's fresh run on the Page | BEGIN | **L0** |
| L0 cleared, L1 not yet won | CONTINUE · LEVEL 1 | L1 |
| L0 skipped (`l0Skipped: true`) | CONTINUE · LEVEL 1 | L1 (and stays there on reload) |
| Already finished L1 or beyond (`tutorialDone`, `reached > 1`, any ending) | CONTINUE · LEVEL n (unchanged) | Their level. **L0 is never forced.** |

- **Skipping:** *Skip to Level 1* on the L0 entry card sets `l0Skipped = true`, persists it, and calls `startLevel(1)`.
- **Clearing L0:** `cleared.push(0)`, `reached = max(reached, 1)` (the existing `onWin` already does both). Don't set `tutorialDone`: that flag belongs to L1's coach. No codex entry (the codex stays at "x of 8").
- **Level select:** a **Tutorial** header with row **0 · First Light** above Act I. It is always unlocked and shows ✓ when cleared. Replaying it always runs the guide. The sheet must scroll so that every row is reachable at 360×560.
- The "Level select" ghost button on the title shows whenever the title shows CONTINUE.
- Storage blocked: the game behaves as fresh for the session (BEGIN → L0) and never throws. This is existing behaviour and must hold.

---

## 6. Changes to L1's watch-only beat (8c9cfd8)

- **Keep the code.** Make the **auto-play conditional**: in `tutTap` (G.tut 1 → 2), call `startBeat(...)` only when `!G.save.cleared.includes(0)`, i.e. the player skipped L0 or came from an old save that never cleared it. Otherwise go straight to the existing *TRANSMIT. Your order travels at the speed of light.* coach.
- **Keep** "Watch an order travel" under How light works in L1 (`canBeat()` unchanged). It is a cheap refresher.
- Nothing else in L1 changes: copy, the coach steps, hints, data and solutions all stay as they are.

---

## 7. Acceptance criteria

### 7.1 Existing suites (must pass; the only edits allowed are the ones listed)
- `node test/sim.test.js`: **63 passed, 0 failed** (no edit; §2.3).
- `node test/finale.test.js`: **8/8** (no edit).
- `node test/play.js`: everything that passes today. Add an L0 block to `expect` and run it with `G.noGuide = true`: `{'no order': null, 'reference: send A at y0': 9, 'late order (y3)': 12, 'wrong hex, then the mark (y1)': 10}`. Note that the existing loop pushes MOVEs with `queueMove` and that `loadLevel(0)` must work.
- `node test/flows.js <dir>`: passes unchanged. It loads L1 directly with `tutorialDone = false` and no L0 clear, so the beat still auto-plays there, as today.
- `node test/misc.js`: passes unchanged.
- `node test/smoke.js <dir>`: **edit only the boot path.** After tapping `tPlay`, the game now shows the L0 entry card, so tap **Skip to Level 1** and continue with the existing L1 assertions unchanged. Note: the beat will auto-play here because L0 wasn't cleared, as it does today.
- `git diff 8c9cfd8 -- reference/levels.json` shows **only** the appended L0 object. The `n ≥ 1` entries are byte-identical, and lines 1–41 of `verify-report.txt` are byte-identical.

### 7.2 New: `test/l0.js [outdir]` (headless Chrome, at 390×844, 360×640 and 360×560)
- **A. Fresh boot by real taps:** opening cards → BEGIN → L0 entry card → G1. Check `G.n === 0`, `G.now === 0`, and that the coach text matches G1.
- **B. Full guided run by real taps:** G1 → G2 → tap A → tap the mark → answer prediction 1 **wrong** (Year 1) → TRANSMIT → WAIT ×5 → answer prediction 2 **right** (Year 9) → WAIT ×3. Then check:
  - `G.won` at yr 9, and `G.out` is `{confirmed_at_home: 9, happened_at: 6, lag: 3}`;
  - each year's coach text matches §3.3;
  - the win screen contains "year 6" and "year 9" and ledger values 2 / 4 / 3;
  - `#wNext` is fully on screen;
  - `cleared` includes 0.
- **C. Coach clearance:** at every guide step (G1–G6, yrs 1–9, both predictions) the coach rect doesn't overlap the hexes of Home (0,0), A (1,−2), (2,−2) or the mark (3,−2). Use the same test as `flows.js`'s `coachClear`.
- **D. Layout:** reuse `flows.js`'s `layoutCheck` at G4 (A selected), at G5 (prediction chips) and at yr 6 (prediction 2). Nothing is off-screen, buttons are ≥ 44 px, and the board is never under the dock.
- **E. Gating:** during the guide, ▸▸ and menu Rewind are disabled. Tapping a non-mark hex at G4 queues nothing. Primary is disabled while the prediction chips show. Menu Restart returns to G1 at yr 0 with an empty plan.
- **F. Hand-off to L1:** after A–B, Next ▸ leads to `G.n === 1` with the L1 tutorial coach. After tapping A and then D1's seen hex, `G.beat === null` (no auto beat), and "Watch an order travel" is still offered under How light works.
- **G. Skip path:** fresh save → BEGIN → **Skip to Level 1** → `G.n === 1` and `G.save.l0Skipped === true`. Tapping A then D1 starts the beat (`G.beat !== null`). Reload → the title says CONTINUE · LEVEL 1.
- **H. Veteran saves:** preload `{reached: 3, cleared: [1, 2], tutorialDone: true, seenOpening: true}` → title says CONTINUE · LEVEL 3, no L0 is shown, and level select has row 0 enabled. Preload `{reached: 1, cleared: [], tutorialDone: false, seenOpening: true}` → BEGIN → L0 entry card.
- **I. Reduced motion:** run B with reduced motion on. It completes, and the ripples and news front are drawn as static end states.
- **J. Hygiene:** no console errors or exceptions, no non-`file:`/`data:` network requests, and storage-blocked boot → BEGIN → L0 plays to yr 9.

### 7.3 Screenshots to save (`shots/l0/`) and look at, at all three sizes
`01-entry-card`, `02-G1-ripple-out`, `03-G2-ripple-in`, `04-G4-aim`, `05-G5-prediction`, `06-y1-order-front`, `07-y2-order-lands`, `08-y4-solid-dashed-split`, `09-y6-prediction-news-start`, `10-y7-news-front`, `11-y9-confirm`, `12-win-ledger`, `13-L1-after-L0`, `14-level-select`.

The reviewer is checking that:
- the ring labels in G1 are readable and not under the coach;
- the ripple and news fronts read as *dashed* and distinct from the order front;
- solid and dashed A are visibly apart in yr 4;
- the ledger and Next fit at 360×560;
- the mark reads as a place, not an object.

### 7.4 Housekeeping
- Rebuild with `node build.js`. The output is still one self-contained `lightlag.html`: no network, fonts or assets.
- Update `HANDOFF.md`: the L0 line, the test counts (sim 63/63, the new `l0.js`) and the save rule.
- Commit on master with a clear message. **Don't push.** Oliver handles GitHub and the Page.

---

## 8. Out of scope (guard rails for cost and risk)

- No changes to L1–L8 rules, data, solutions, copy (except the one beat condition in §6), visuals, the finale or the endings.
- No new codex entries, sounds, or settings.
- No refactor of the L1 tutorial (`G.tut`) or of the beat beyond the one condition.
- No free-play or sandbox mode in L0, and no second L0 attempt variant.
- If something here turns out not to fit at 360×560, first shorten the copy to two lines and keep the meaning; the guide copy lives in one block in `data.js` for this reason. Second, put it under "Questions for the requester" in the report. **Don't change the geometry:** the timeline in §2.4 depends on it.

---

## 9. Confidence and open edges

- **High:** the level data, the sim extension and the expected results (all run on both sims), and that nothing in L1–L8 can change, because the data is appended and the objective type is new and only used by L0.
- **Medium:** whether the coach fits in the lower half at 360×560 with three-line captions. Rows r ≥ 1 are empty, so it should, and check C will catch it if it doesn't.
- **Judgment calls Kane may want to overrule:** the two prediction questions (cut them if they feel patronising; the narration stands without them); the name *First Light* (an astronomy term for an instrument's first observation); and L0 being skippable.
