# One Move Puzzle

A lightweight mobile-first puzzle prototype built around one rule: **every level gives the player exactly one move**.

## First playable vertical slice

- **Level 01 — Release:** tap once, then gravity completes the route.
- **Level 02 — Trigger:** one button opens a gate and starts a chain reaction.
- **Level 03 — Balance:** one seesaw tilt triggers a spring, block, bumper, and goal sequence.
- Uses the committed `assets/sheet01` and `assets/sheet02` art directly.
- No build step and no external dependency.
- Responsive portrait layout, restart/replay flow, simple WebAudio feedback, and local progress storage.

## Run locally

Serve the repository root with any static server, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Structure

```text
index.html
styles.css
js/game.js
assets/
  sheet01/
  sheet02/
```

This is intentionally a vertical slice. The next step is to validate feel, timing, and visual scale before building a data-driven level editor or adding more levels.
