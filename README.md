# One Move Puzzle

A production-oriented mobile puzzle game built around one rule: **every puzzle gives the player exactly one move**.

## Current game foundation

- Real-time 2D rigid-body physics with Matter.js.
- 12 data-driven puzzle levels using the committed art sheets.
- One-move interaction system with correct/incorrect choices and real failure states.
- Ball, ramps, blockers, gates, bumpers, fan boosts, conveyors, portals, keys, magnets and collectible stars.
- Home screen, level select, locked progression, star scoring, retry/next flow and settings.
- Local save data for unlocked levels, stars, attempts, sound and haptics.
- Responsive portrait layout with mobile safe-area support.
- Sound effects and vibration feedback.
- Production build pipeline using Vite.

## Run

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

The production bundle is written to `dist/`.

## Project structure

```text
index.html
styles.css
vite.config.js
package.json
src/
  main.js
  levels.js
  core/
    audio.js
    save.js
assets/
  sheet01/
  sheet02/
```

## Development direction

The repository is now structured as a real game rather than a scripted prototype. New levels should be created as level data in `src/levels.js` and should use the shared physics/effect runtime instead of hard-coded animation paths.

## Code-ready workshop assets

The workshop asset pack combines Workshop Machine Kit V1-V3 into one deduplicated runtime asset tree.

```text
assets/workshop/
  base/
  tracks/
  pins/
  hardware/
  mechanisms/
  goals/
  decor/
  manifest.json
src/workshopAssets.js
```

Import the generated asset map with:

```js
import { WORKSHOP_ASSETS } from './src/workshopAssets.js';

const img = new Image();
img.src = WORKSHOP_ASSETS.tracks.trackStraight;
```

The pack uses transparent PNG files with runtime-safe lowercase snake_case names. Its manifest includes image dimensions and center-anchor metadata.
