# LIGHT LAG: final design brief (Evelyn, refining Vivian's v1)

*Everything you can see has already happened.*

A 25–35 minute puzzle game for phones, delivered as one self-contained HTML file in a chat artifact.

---

## Changes from v1, and why

Vivian's hook stays. Light lag is a good idea: it's novel, it fits on a phone, and it belongs to Kane's Fermi theory. I changed what the game *does* with it.

1. **The game is now a deterministic puzzle game, with no randomness.** v1 had drifting comets, wandering drones, flares and things that "light up". Random events make lag frustrating rather than clever. Every rule is now exact and every level has a verified solution, so any discovery the player makes is earned. (Flares and random events are cut.)
2. **What you know is drawn differently from what you see.** Solid shapes are what you can see, and they are old. Dashed shapes are what Home has *calculated*. The rings are labelled by age ("2 yrs ago"). A moving object's present position is calculated only after you have *watched it move*. Small "arrives in year N" tags turn timing into something you can read. Kane gets dead reckoning without having to do arithmetic.
3. **Winning is delayed as well.** You win when the light from your success reaches Home ("It happened in year 7. You found out in year 10."). Each level ends with a short **truth replay** that shows what was really happening while you were looking at ghosts.
4. **There are three acts and a real twist.** v1's "stealth from watchers" is replaced by something more surprising. Act I seeds faint "instrument noise". The Act II reveal shows that the noise was other watchers acknowledging every order you sent. They had been there the whole time.
5. **Act II turns the mechanic from logistics into diplomacy, and the physics stays honest.** Some neighbours insist on being asked first. Two of them can *both* be asked first, but only if your two requests are outside each other's light cones. One drone can't do it, because a drone can't outrun the news of its own departure. Relativity becomes the puzzle rather than the decoration.
6. **The ending is built from the game's own verbs.** v1 offered "answer / stay silent / something clever". Now the blue world's *consent is stale too*. Some of its people ask, some say NOT YET, and every message is five years old. You can **Answer**, **Hold** (the Wait button you have pressed all game is relabelled PENDING), or **Delegate**, giving a drone close enough to hear them the standing to decide. All three endings are valid. The emotional payoff is a forest delivered as *sound*: the one thing light could never have shown you.
7. **The scale is now hard-SF.** 1 hex = 1 light-year and 1 tick = 1 year. Drones travel at 0.5c. The moving objects are ancient probes ("derelicts") at about 0.33c, not comets at impossible speeds. Nothing is faster than light, so information is always late. The apparent-speed effect (approaching things seem to hurry) is real and shows up naturally.
8. **There is a reference simulator.** `reference/sim.py` + `reference/levels.json` define the rules exactly and verify every level: the naive play fails, the reference solution works, and the projection unlocks before the reference needs it. The report is in `reference/verify-report.txt`.

---

## 1. Pitch and the first minute

You are **HOME**, an old, cautious listening post. Your drones are scattered across a few light-years. You see everything as it was. Your orders arrive late.

**First minute (scripted):**
- Three cards on black: *Light is the fastest thing there is.* / *It is still slow.* / *Everything you can see has already happened.* Then the title.
- The board appears. Home sits at the centre with one drone a light-year away. A derelict probe glows at the top edge, labelled **"seen as it was 4 years ago."**
- Prompt: send the drone to it. The player taps the derelict's hex and taps TRANSMIT. A dashed ring of light expands from Home.
- One WAIT later (year 2), the derelict's image moves, and a **dashed "NOW (calculated)" marker** snaps in further down its track. Prompt: *"Your drone is chasing a memory. Aim where it will be."*
- The player re-aims and catches it. Then the confirmation light comes back: **"Tagged in year 7. You found out in year 9."**

That is the "oh, that's clever" moment, and it lands in under a minute.

---

## 2. Fiction and scale (shown once, in plain words, on the L1 info card)

- 1 hex = 1 light-year. 1 tick = 1 year. **Light crosses one hex per year.** Drones manage half that (0.5c). Derelicts, old probes on ancient courses, manage a third (one hex per 3 years) unless a level says otherwise. **Nothing is faster than light.**
- Accepted simplifications, which may appear as codex jokes: time dilation (drone clocks run about 13% slow at 0.5c: *"Home has decided not to bring it up."*), Doppler shift, and signal strength falling with distance.
- HOME is a node of an old, careful civilisation, in the spirit of *The Last Required Signature*. It isn't a homeworld. Its log voice is dry, precise, a little wry and quietly kind.

---

## 3. The rules (exact; `reference/sim.py` breaks any tie)

### 3.1 Board
- A hex grid in axial coordinates `(q, r)`, pointy-top, with `r` growing downward. Home is always `(0,0)`. The board holds every hex within distance `R` of Home (`R = 4`, or `5` in the finale).
- Distance: `max(|dq|, |dr|, |dq+dr|)`. A hex's **ring** is its distance from Home. Directions: E(1,0), NE(1,−1), NW(0,−1), W(−1,0), SW(−1,1), SE(0,1).
- Pixel centre: `x = size·√3·(q + r/2)`, `y = size·1.5·r`.

### 3.2 Time and light
- The game advances one tick per WAIT or TRANSMIT. The HUD shows **YEAR n**.
- Every emission (an order, signal, glint or event) happens at a hex and a year. It reaches hex `x` at `year + distance(source, x)`, and the same year when the distance is 0.
- **Seeing:** Home sees an event at hex `c` in year `t` in year `t + ring(c)`.
- **Seeing a moving object:** in Home-year `now`, Home sees the object where it was at the latest true year `τ` with `τ + ring(pos(τ)) ≤ now`. Everything is subluminal, so this is well defined. It produces the apparent-speed effect automatically: a derelict coming toward Home at 1 hex per 3 years *appears* to move 1 hex per 2 years, and one going away appears to move 1 hex per 4 years. **This is not a bug. Don't "fix" it.**
- **Prehistory:** levels begin mid-story. Before year 0, drones and watchers sat still and derelicts followed their tracks backwards, so old images are visible from year 0. (Derelicts that start on the board have `1 ≤ first ≤ period`.)

### 3.3 Things on the board
- **Drone** (yours). It moves **1 hex every 2 years** along the standard hex line toward its target, recomputed each step with the line-draw nudge (+1e−6, +2e−6). It accepts orders addressed to it, when the order's light reaches it.
- **Derelict.** It moves 1 hex in a fixed direction every `period` years, first at `first`. Leaving the board removes it. It can carry a **relay**.
- **Relay** (receiver). It wakes if **≥ need** *open* signals reach it **in the same year**. Fixed hex, or riding a derelict.
- **Watcher.** It is stationary and has a kind:
  - **mirror**: shows a faint **glint** whenever any order or signal reaches it. In Act I these are *hidden*: only their glints are drawn.
  - **signer**: signs when it receives a signal **addressed to it**.
  - **precedent**: signs when it receives a signal addressed to it, but only if it has **never** heard a signal addressed to someone else. A signal for someone else arriving first, *or in the same year*, makes it **object** permanently for this attempt. The fix is Rewind. (Ties don't count as "first".)
  - Every watcher glints on any arrival. Signing and objecting are visible events, seen with lag like everything else.
- **Split** (scripted). In a given year, a watcher divides and a **new independent watcher** appears in an adjacent hex. It has heard nothing and signed nothing, and requests addressed to its parent don't count for it. Fronts that passed its hex before it existed don't reach it.

### 3.4 Orders and signals (the player's verbs)
- **MOVE** (drone → hex). Orders travel from Home at light speed. A drone adopts the order in the first year the front has reached it: `year − sent ≥ distance(Home, drone's position that year)`. It makes its first step 2 years after adopting the order. A new MOVE replaces the old one.
- **FLASH** (Act I) / **ASK** (Act II and later): the drone emits a signal *in the year the order reaches it*. In Act I the signal is open (relays count it). From Act II it is addressed to one watcher you choose (relays ignore addressed signals). FLASH/ASK doesn't change the drone's movement. One transmission can carry one MOVE and one FLASH/ASK per drone.
- **Home ASK** (Act II and later): Home itself emits an addressed signal, immediately, from `(0,0)`.
- **No unsending.** A transmission can't be recalled. A later order overrides it only on arrival.
- Order transmissions are signals too, so they make watchers glint. They never count as requests and never wake relays.

### 3.5 Tagging and winning
- **Tag:** a drone and a derelict occupy the same hex at the end of a year, **or swap hexes** during the year.
- **Objective events** are tag, relay wakes, and signatures. **The level is won when Home *sees* the last required one.** Show both numbers: *"It happened in year 7. You found out in year 10."*

### 3.6 Order of operations within a year
1. Derelicts step, then drones step.
2. Scripted splits.
3. Home's queued transmissions for this year are emitted.
4. Arrivals are resolved to a fixed point, because a flash emitted this year can arrive this year at distance 0. Drones adopt orders and FLASH/ASK emit. Then relays count same-year open signals. Then watchers glint, sign or object.
5. Tags are checked.

---

## 4. What Home knows (the legibility layer; this is the heart of the UX)

| Drawn as | Meaning |
|---|---|
| **Solid** shape | What Home *sees*: old light. Every solid thing can be inspected for "seen as it was N years ago (year Y)". |
| **Dashed** shape | What Home has *calculated*: the present position of its own drones (it knows its own orders), the expanding fronts of its own transmissions, and the inferred fronts of flashes it has seen. |
| **Dotted track + year ticks** | The projected future path of a derelict. |

- **Your drones are drawn twice:** a solid ghost where Home sees them and a dashed outline where they *are*, joined by a faint thread when the two differ. When a drone gains standing in the finale, its dashed outline **disappears**, because Home can no longer calculate it.
- **Projection unlock:** a derelict's dashed "NOW" marker and dotted future track appear only once Home has **seen it change hex** (watching before predicting). Verified unlock years are listed per level below.
- **Arrival tags:** while a drone is selected and an order is planned, small tags read *"arrives yr 9"* on the MOVE target and *"reaches yr 7"* on every **known** relay and watcher for a FLASH/ASK. In-flight orders keep their tags until they arrive. Tags never reveal hidden or unseen things (Act I mirrors, a split child not yet seen). The simplest correct way to compute a tag is to run the deterministic sim forward on a cloned state with the hypothetical order added.
- **Ring ages:** each ring carries a quiet label on one spoke: *now · 1 yr ago · 2 yrs · 3 yrs · 4 yrs*. The colour temperature runs from warm white at Home to cool blue-grey at the rim, so old light *looks* old.

---

## 5. Controls and layout (portrait, mobile-first; mouse works identically)

Design at 360–430 px wide. Use safe-area insets. There is no hover, long-press, drag or pinch. Tap targets are at least 44 px, and body text at least 15 px.

```
┌──────────────────────────────────────┐
│ 2 · Closer Than It Looks   YEAR 7  ☰ │  top bar (48px)
│ Tag both derelicts.                  │  objective (tap = info)
│                                      │
│            [ hex board ]             │  square, fitted to width
│                                      │
│ ⌁ "Approaching things appear to…"    │  Home log line (tap = full log)
│ [A → move · arrives yr 9 ✕]          │  outbox chips (queued orders)
│ [ MOVE ] [ FLASH ] [ ✕ ]             │  order chips (when drone selected)
│ [        TRANSMIT 1  ▸        ][▸▸]  │  primary + "until news"
└──────────────────────────────────────┘
```

- **Select:** tap your drone. A highlight ring appears and the dock shows its chips. **MOVE is the default:** tapping any hex sets the target. **FLASH** queues immediately. **ASK** then asks you to tap a watcher. Tapping empty space or ✕ deselects.
- **Home** is selectable in Act II and later for Home ASK.
- **Inspect:** tap anything that isn't one of your drones. A half-height bottom sheet shows what it is, "seen as it was N yrs ago", its projection status, its rules (watchers), and its arrival tags.
- **Primary button:** "WAIT ▸" when nothing is queued, "TRANSMIT n ▸" when orders are queued. Both advance one year. **▸▸ Until news** advances until anything Home *sees* changes, a calculated arrival happens, or 8 years pass. It is **disabled in the finale.**
- **Hit-testing:** snap to the nearest hex centre. The whole board is the target, so R = 5 hexes (about 35 px) are fine.
- **Menu (☰):** Restart level · Rewind 1 year · Hint (3-step ladder) · Level select · Sound on/off · Reduced motion · Codex (discoveries found).
- **Rewind** re-simulates to the previous year without that year's transmissions. That is trivial because the sim is deterministic. **Smart rewind:** when Home sees a precedent object, or a derelict leave untagged, the log offers a one-tap *"Rewind to year N (before the request that caused it)"*.
- **No punishing fail state:** restart and rewind are always one tap away. Nothing times out except the finale's Hold, which is an ending, not a failure.

---

## 6. Look and sound

- **Palette:** deep navy space. Light fronts are thin luminous rings. Home is warm white. Your drones are pale gold. Derelicts are dull silver. Relays are teal. Watchers are violet. The blue world is pale blue with an amber second voice. Dashes and solids carry meaning, so **colour is never the only cue.**
- **Motion:** each year transition animates over about 350 ms. Fronts expand, images update and glints sparkle. Respect `prefers-reduced-motion`.
- **Truth replay** (end of every level, 6–10 s, skippable): a god's-eye replay from year 0 to confirmation, with a **AS SEEN ↔ AS IT WAS** toggle and a scrub slider. Hidden Act I mirrors stay hidden in replays until Act II has been reached. After that, replaying Act I shows them.
- **Audio** (optional except the finale; WebAudio synth only; start on first tap; everything has a visual twin): transmit is a soft low *thoom*. Order received is a tick. Glint is a very quiet high chime. Confirm is a warm two-note chord. **The finale wind** is filtered noise with a slow gain LFO and a couple of synthesized bird chirps. If muted or blocked, it is shown as a slow waveform plus the caption.

---

## 7. Levels

Seven puzzle levels and the finale. The coordinates, test plans and verification are in `reference/levels.json` and `reference/verify-report.txt`. "Seen yr" means the year Home first sees something. Approximate screen positions are given for orientation.

### ACT I: HOME

**L1 · As It Was** (tutorial, about 3–4 min). R = 4.
- Drone **A** (−1,1), one ring out at lower-left. Derelict **D1** is at (2,−3) at year 0, moving SE every 3 yrs (first step yr 2). Home sees it at (2,−4), top centre, "4 yrs ago". Second-chance derelict **D2** is at (−4,5) off-board, moving NE every 3 yrs from yr 8. It enters at the bottom (seen yr 12) and passes just right of Home.
- **Objective:** tag a derelict (either).
- **Script:** the first order is constrained. Only D1's *seen* hex is accepted, with a pulsing highlight. Prompts: "Tap your drone." → "Tap the derelict." → "TRANSMIT." (yr 0 → 1) → "WAIT." (→ yr 2). At **yr 2 the projection unlocks**: *"Home has now seen it move. The dashed marker is where it is now. Your drone is chasing a memory. Re-aim."* After that, free play.
- **Verified:** naive (0: A→(2,−4)) misses. Naive plus re-aim at yr 2 to (2,−1) tags in yr 7, confirmed yr 9. After the scripted naive order, re-aiming works from yr 2 to yr 5. A clean reference (yr 2: A→(2,0)) is confirmed yr 11. If D1 is missed, D2 is catchable from the naive trajectory with orders as late as yr 21.
- **Teaches:** seeing lag, order lag, solid vs dashed, projection, delayed victory.
- **End line:** *"Confirmed. It happened two years ago. You found out just now. This will keep happening."*

**L2 · Closer Than It Looks** (about 3 min). R = 4.
- Drones **A** (−1,0), left of Home, ring 1; **B** (−2,4), bottom, ring 4. **D1** (1,−4) top, SE every 3 (first 3): inbound past Home's right, then outbound to the lower right. **D2** (1,0), right beside Home, SW every 3 (first 3): outbound to the bottom-left past B. Hidden mirror m0 (−3,−1).
- **Objective:** tag both.
- **Projection unlocks:** D2 at yr 1, D1 at yr 6.
- **Verified:** naive (yr 5: A→D1's seen hex, B→D2's seen hex) fails. Reference: yr 6 B→(−3,4), yr 7 A→(1,0); last tag yr 12, confirmed yr 16. B's last useful order for D2 is yr 8, and A's for D1 is yr 12. (B can also take D1, up to yr 13. That is a valid alternative.)
- **Discovery (codex)**, triggered when D1's image jumps on 2-year intervals: *"Approaching things appear to hurry. Receding things appear to linger. Neither is true. Both are late."* Optional, if a drone's image ever moves 1 hex/yr toward Home: *"Your drone appears to be travelling at the speed of light. It isn't. You're seeing its departure late and its arrival on time."*
- **First glint (m0):** *"Faint glint, ring 3. Instrument noise. Filed."*
- **End line:** *"Objects in the past are closer than they appear."*

**L3 · Chorus** (about 3 min). R = 4. Introduces FLASH.
- Drones **A** (−1,0), ring 1; **B** (2,2), lower right, ring 4. **Relay X** at (3,−1), right, ring 3, needs 2. Hidden mirror m1 (−2,−1).
- **Objective:** wake the relay. Two signals must reach it in the same year.
- The tags tell the story: sent now, A's flash reaches X in yr 5 and B's in yr 7. So send B now and A two years later.
- **Verified:** naive (both yr 0) fails. Reference: B yr 0, A yr 2; both reach X in yr 7, confirmed yr 10. Mirror glints are seen around yrs 6, 8 and 14.
- **Glint lines:** *"Noise again. Filed."*
- **End line:** *"Sent at different times, from different places, arriving together. That is all harmony is."*

**L4 · Filed Noise** (about 4 min; the Act I exam). R = 4.
- **Relay rides derelict D**, from (−3,−1) moving E every 3 yrs (first 2), across the upper middle; it needs 3. Drones **A** (0,−2), up-left, ring 2; **B** (−2,3), bottom, ring 3; **C** (3,1), right, ring 4. Hidden mirrors m2 (−3,0) and m3 (2,2).
- **Objective:** three signals, one year, at a moving relay. Tags show "?" until the projection unlocks at **yr 5**.
- **Verified:** naive (all at yr 5) fails. Reference: C yr 5, B yr 6, A yr 9; the relay wakes yr 13, confirmed yr 14. Glints are seen from about yr 11 onward, several times.
- **Glint lines** escalate: *"Filed."* · *"Same direction as last time? Different. Filed anyway."* · *"The noise is very punctual."*
- **Act I card:** *"Act I: Home. Everything you saw had already happened. Everything you said arrived late. You did fine."*

### INTERSTITIAL: Reclassifying (about 40 s, tap to advance)
- The L2–L4 boards flash past. Each filed glint reappears and resolves into a small violet sentinel.
- *"Reviewing filed noise."*
- *"Every glint arrived exactly when an echo of your own voice would have."*
- *"Something was listening. Several somethings. They acknowledged every word you sent, politely and faintly, and never interrupted."*
- *"I need to reconsider several classifications."*
- Title: **Act II: Neighbours.**

### ACT II: NEIGHBOURS (watchers are visible from now on; ASK replaces FLASH; Home can ASK)

**L5 · Standing** (about 2 min; a breather; no drones, only Home talks).
- **P** (3,−3), upper right, ring 3, *precedent*; **S** (−3,1), left, ring 3, *signer*.
- **Objective:** collect both signatures. Inspecting P says: *"Will sign only if the first request it hears is addressed to it."*
- **Verified:** asking both in the same year fails (a tie, so P objects). Asking S first fails. Reference: ask P yr 0, ask S yr 1; confirmed yr 7.
- **End line:** *"Two signatures. Neither of them was in a hurry."*

**L6 · No Universal Now** (about 4 min; the big idea of Act II).
- **P** (3,−3), upper right, ring 3, precedent; **Q** (0,−3), upper left, ring 3, precedent. Drones **X** (4,−4), ring 4, next to P; **Y** (0,−1), ring 1, two hexes below Q.
- **Intro:** *"Two precedents. Each insists on being asked first. From Home that's impossible: anything you say, they both hear in the same order. You'll have to say it from two places."*
- **Verified:** Home asking both (either order) fails. Both drones at yr 0 fails. **One drone doing both fails** (*"A drone cannot outrun the news of its own departure."*). Reference: X asks P yr 0, Y asks Q yr 2; confirmed yr 8. Alternative: X asks P yr 0, Home asks Q yr 3; confirmed yr 9.
- **End line (codex):** *"Each was asked first. Both are correct. It only worked because your two requests were outside each other's light cones. For events like that, not even the universe insists on an order."* (Physically accurate: the puzzle is solvable only when the two emissions are spacelike-separated. If one is inside the other's light cone, every observer hears them in the same order.)

**L7 · The Knot** (about 5 min; the Act II exam).
- **P** (2,−3), top, ring 3; **Q** (0,−2), up-left, ring 2; **R** (3,−1), right, ring 3: all precedents, close together. Drones **X** (2,−4), ring 4, next to P; **Y** (0,−1), ring 1, next to Q; **Z** (4,−1), ring 4, next to R.
- **Scripted split:** in true **yr 6**, R divides. **R′** appears at (3,0) as an independent *signer*. Home **sees it in yr 9**. Log: *"R has divided. R′ has been independent since year 6. Nobody has asked it anything."* (Inspector: *"Requests addressed to R do not count for R′."*)
- **Objective:** every party signs (R′ included, once it exists).
- **Verified:** all three drones at yr 0 fails. Solving P, Q and R but ignoring R′ fails. Reference: X asks P and Z asks R at yr 0, Y asks Q at yr 3, then Home asks R′ at yr 9; confirmed yr 15. Only about 2% of the timing combinations for the first three asks work, so it's a real puzzle, and "the near drone waits for the far ones" is the insight.
- **End line:** *"All parties signed. One of them didn't exist when you started asking. That happens more than you'd think."*
- **Act II card:** *"Act II: Neighbours. They have rules. The rules are older than the reasons for them. You were patient."*

### ACT III: THE LAST REQUIRED SIGNATURE

**L8 · The Last Required Signature** (about 5–6 min; scripted finale, R = 5, ▸▸ disabled).

**Setup.** Home (0,0). **The blue world W** is at (5,−3), upper right, ring 5. Your drone **V** is at (2,−1), ring 2, three hexes from W. The objective strip reads **"Petition 1: pending."** Opening log, one line per tap:
*"Petition 1. Opened before this world had oxygen."*
*"Requires: the consent of its inhabitants."*
*"Their consent cannot be requested without contacting them. That is why it is pending."*

**W's true behaviour** (W reacts only to what physically reaches it; Home sees everything 5 years late):

| True yr at W | Event | Home sees |
|---|---|---|
| 1 → | Radio leak begins (a faint flicker halo, every year) | yr 6: *"It has started leaking radio. Not to us. To everyone."* |
| 5, then every 2 yrs through 19 | **The call**: a bright pulse train (2, 3, 5, 7 blips) that decodes to **IS ANYONE THERE?** It stops early if an answer reaches W. | yr 10: *"That one was aimed."* (last call seen in yr 24) |
| 8, then every 3 yrs to yr 26 | A fainter **amber** voice, **NOT YET.** It continues regardless. | yr 13: *"Not all of them."* Then: *"You could answer. You could wait. Or you could give the question to someone closer."* |
| 22 (only if no answer has reached W) | **Their own probe** launches toward Home at 0.5c (1 hex per 2 yrs) | yr 27: appears at W, *seeming* to hurry |
| answer arrival + 1 | **The reply** (omnidirectional) | arrival + 6 |

**The three verbs** (all appear only once the call has been seen, yr 10):
- **ANSWER:** a dock button "Answer them". It asks for confirmation: *"This cannot be recalled. It reaches them in 5 years, and they will be ten years older than the voices you heard."* [Send] [Not yet]. It emits from Home. A drone ordered to ASK W also counts as an answer, from wherever it is.
- **DELEGATE:** select V and the **STANDING** chip appears: *"Give V the right to decide. It will no longer take your orders."* [Give standing] [Not yet]. When the order reaches V, it becomes independent. Its dashed outline vanishes and any later orders are acknowledged and declined (*"V: noted."*). V moves to (4,−2), next to W, **listens 3 years**, then sends its own answer to W. W replies, V receives it next year and **forwards it to Home**, and the ending triggers when the forward arrives.
- **HOLD:** keep waiting. Once the call has been seen, **the WAIT button reads "PENDING ▸"**. At seen yr 19 the log says *"Waiting is the only choice that can be undone. It is still a choice."* If **Home reaches yr 25** with nothing sent, the Hold sequence runs: controls lock and the game auto-advances at about 0.7 s per year to yr 30. The yr-26 call never comes, NOT YET continues, and their probe appears in yr 27 and creeps inward.

Between sending and the reply, the button reads **"LISTENING ▸"**.

**Endings** (a card with a stamp animation on Petition 1, then the truth replay, then credits):

1. **The Long Hello** (Answer). Stamp: **SUPERSEDED BY EVENTS.**
   *"You answered a question that was ten years old by the time your reply arrived."*
   Adaptive line: if the answer was sent before NOT YET was seen, *"Some of them had already begun saying not yet. You hadn't seen it."* Otherwise: *"Some of them are still saying not yet. That is in the record too."*
   Then the reply plays: **wind through leaves, someone breathing behind the microphone, a bird nobody can name** (audio plus waveform plus caption).
   *"Light could show you their forests. It could never give you one."*
   Conditional, if their probe launched: *"They had already sent an instrument of their own toward you. It will arrive to find the door open."*
2. **Standing** (Delegate). Stamp: **TRANSFERRED.**
   *"You couldn't ask them without answering them, so you gave the question to someone close enough to hear the answer still being given."*
   V's message: *"I listened until I was sure they were still asking. I answered with terms either side may withdraw from. The ones who said not yet are recorded. No participant warrants the absence of unknown harm. — V"*
   Then the forwarded forest (as above), and *"V doesn't take your orders any more. It writes sometimes. Late, of course."*
3. **Pending** (Hold). Stamp: **PENDING.**
   *"You did not answer. Their call went on for a while, and then it stopped."*
   *"They have built an instrument. It is coming this way, slowly, to watch. It will not say anything. They learned that from you."*
   *"From inside every world like theirs, the galaxy looks empty."*

All three are valid and none is marked wrong. After the first ending, the finale card shows **"Endings found: 1 of 3"**, saved locally.

**Credits:** *LIGHT LAG. Concept: Vivian. Design: Evelyn. Build: Oliver. Polish: Claude Code. For Kane.* Then "Play again" opens level select (all levels unlocked).

---

## 8. Hints (menu → Hint; one step per tap)

- **L1:** Wait for the dashed marker. · Aim at the dotted track, not the solid image. · Re-aim A at (2,−1), just ahead of the marker.
- **L2:** Use the near drone for the near derelict. · The far drone's orders take 4 years. Aim far down D2's track. · Year 6: B to (−3,4). Year 7: A to (1,0).
- **L3:** Read the arrival tags on the relay. · Make the two numbers match by waiting before you send one. · Send B now. Send A in two years.
- **L4:** Pick a year after the projection appears, and work backwards. · Send each drone when its tag shows the chosen year. · Years 5, 6 and 9: C, then B, then A.
- **L5:** P must hear its own request first. · Ask P, then S a year later.
- **L6:** One place can't do it. · Ask from near P and near Q, close together in time. · X asks P now. Y asks Q two years later.
- **L7:** The near drone waits for the far ones. · Watch R. · X and Z now, Y at year 3, then ask R′ from Home once you see it.
- **L8:** none. The menu Hint says: *"There isn't a right answer. There are three honest ones."*

---

## 9. Home's voice (writing guide)

Dry, exact, unhurried and quietly kind. Short sentences. Uses numbers. No exclamation marks. It is allowed one joke per level. It never explains a puzzle unless asked. The log keeps a running history the player can scroll. **Codex** entries are the discovery lines, collected as you earn them.

---

## 10. Technical constraints (fixed) and recommendations

- **One self-contained HTML file:** inline JS/CSS, no CDNs, fonts, images or network. Works in a sandboxed iframe.
- **Persistence:** `localStorage` key `lightlag.v1` → `{reached, endingsFound, settings}`, wrapped in try/catch. If storage is unavailable, the game runs normally for the session.
- **No backend, accounts or analytics.**
- **Rendering:** Canvas 2D scaled by devicePixelRatio is recommended (nearest-hex hit-testing is simple), but SVG is fine if Oliver prefers it. The board is at most 91 hexes.
- **Simulation:** model it as pure functions over `(level, plan, year)`. Rewind, truth replay and arrival tags then all come for free. Port `reference/sim.py` faithfully. Its `test_plans` make a ready-made unit test table (expected results are in `verify-report.txt`).
- **Performance:** each tick re-sims from year 0 (cheap at this scale) or keeps a history. Either way, aim for 60 fps animation on a mid-range phone.

---

## 11. Done when (acceptance checklist for the build)

- [ ] A first playthrough takes 25–35 minutes. L1 teaches the core idea in under a minute with no text wall.
- [ ] Every `test_plans` entry in `levels.json` gives the same result in the JS build as in `verify-report.txt`.
- [ ] Seen positions follow §3.2 exactly, including apparent speed-up and slow-down, and prehistory images at year 0.
- [ ] Solid = seen, dashed = calculated, everywhere. The projection appears only after a seen move. Tags never leak hidden or unseen objects.
- [ ] Win confirmation waits for the light, and the "happened / found out" years are shown.
- [ ] Truth replay works for every level. Act I mirrors stay hidden until Act II has been reached.
- [ ] All three finale endings are reachable. Hold triggers at yr 25. PENDING and LISTENING labels appear. The forest has an audio version and a muted fallback.
- [ ] Restart, Rewind and smart rewind work everywhere.
- [ ] It is playable one-handed on a 360 px-wide phone with no zoom, and fully playable with a mouse.
- [ ] No network requests (check the devtools Network tab), and the game survives storage being blocked.

## 12. Oliver's call

Exact colours, fonts (system stack), animation curves, sound design details, the codex UI, any order-chip iconography, and whether to show coordinates in the inspector (I'd hide them; they're for us). If a rule here is unclear or turns out unfun in your hands, the sim is the source of truth for *what happens*. Change *how it feels* freely. If you change a rule, rerun `python3 reference/sim.py` and update the level data so every level stays verified.
