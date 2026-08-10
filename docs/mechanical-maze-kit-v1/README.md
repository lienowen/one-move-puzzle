# Mechanical Maze Tile Kit V1

Code-ready asset pack cut from the generated atlas.

## Included
- 83 transparent PNG assets
- 128×128 normalized runtime tile canvases
- tightly cropped original PNGs in `raw/`
- rails: straight / corner / tee / cross / dead-end
- rotatable states
- bridge / splitter / pit
- gate / pressure pad / spring / magnet / fan
- elevator / one-way / portal / crusher / blocks
- ball / star / goal states
- FX and UI icons
- `manifest.json`
- Vite `src/mazeAssets.js`

## Runtime folders

`runtime/tiles/`
All maze tile modules are normalized to **128×128**, centered, transparent, and suitable for grid placement.

`runtime/objects/`
Ball, star, and goal artwork.

`runtime/fx/`
Gameplay effects.

`runtime/ui/`
Controls and feedback UI.

## Vite usage

```js
import { MAZE_ASSETS } from './mazeAssets.js';

const corner = MAZE_ASSETS.tiles.railCornerNe;
const gate = MAZE_ASSETS.tiles.gateClosed;
```

Keep path topology in code/data. Rotate visual tiles in 90° increments rather than creating separate authored logic per orientation.
