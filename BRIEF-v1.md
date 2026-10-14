# LIGHT LAG — game brief v1 (Vivian)

A 20–40 minute mobile micro-game, delivered into chat as a single self-contained HTML artifact.
Prime directive: **fun and novelty.** It should make Kane go "oh, that's clever" within the first minute.

## The hook (one sentence)

You can only ever see the galaxy *as it was*, and your orders only arrive *after a delay* — so every move is a bet on a future you can't see yet.

## Premise

You are the **Home** of an ancient, cautious civilization in a quiet galaxy (yes, this is Kane's Fermi theory: satiated elders, silent sentinel drones, orders that take millennia to arrive). You command a small fleet of drones scattered among nearby stars.

Light travels one ring per turn. A star 3 rings away:
- **shows you its state from 3 turns ago**, and
- **receives your order 3 turns from now.**

Things out there keep moving while you're blind to them: comets drift, drones wander off, stars flare, and occasionally something *new* lights up.

## Core loop (one turn = one tap of "Transmit")

1. Look at the map — every object is drawn as a ghost of its past, faded by distance (stale info looks stale).
2. Queue orders to drones by tapping a drone, then a destination. The order visibly travels outward as an expanding light ring.
3. Tap **Transmit / Wait**. Time advances one tick; light rings expand; old ghosts update.
4. Win the level's objective despite never seeing the present.

The core skill is **reasoning about the present from old evidence** — dead reckoning across space.

## Level arc (~10–12 short levels, 2–4 minutes each)

- **1–3, tutorial in disguise:** catch a drifting comet with a drone; you learn by missing it once and seeing where it *actually* was.
- **4–7, juggling:** several drones, objects at different distances (different lag), a flare that disables drones in an area — you see the flare late.
- **8–10, the watchers:** you discover *other* silent drones that aren't yours. Avoid being noticed: anything you do near them they see *with their own lag*. Stealth across light cones.
- **Final level, the signature:** a small blue world starts leaking radio. You may answer, stay silent, or something clever. Ends the game on a quiet, slightly moving note; a nod to Evelyn's story *The Last Required Signature*. Both choices are valid endings; neither is "wrong."

## Feel

- Visual: deep navy space, glowing concentric light rings, soft ghost trails. Minimal, readable, gorgeous on a phone.
- Tone: calm, wry, a little cosmic. Short flavor lines between levels (a dry "Home" log voice).
- Audio optional (WebAudio blips/hums only if they come cheap; must work muted).

## Hard requirements

- **One self-contained HTML file** (inline JS/CSS, no CDNs, no network, no external assets). Must run in a sandboxed chat artifact iframe.
- **Mobile-first touch controls:** big tap targets, no hover, no tiny text, no pinch-zoom required. Works portrait. Also playable with a mouse on desktop.
- 20–40 minutes total for a first playthrough. Level select or auto-save via localStorage if available, failing gracefully if not.
- No accounts, backend, or data collection.
- Restart-level button always available; no punishing fail states.

## Open for the team

Everything above is a starting point. Evelyn: change anything that makes it more fun, more surprising, or more *yours*, within the requirements. If you have a better hook than light lag, make the case.
