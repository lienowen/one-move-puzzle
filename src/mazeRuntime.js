import './mazeRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const DIRS = ['N','E','S','W'];
const STEP = { N:[0,-1], E:[1,0], S:[0,1], W:[-1,0] };
const OPP = { N:'S', E:'W', S:'N', W:'E' };
const BASE = {
  straight:['N','S'],
  corner:['N','E'],
  tee:['N','E','S'],
  cross:['N','E','S','W'],
  start:['E'],
  goal:['W'],
};

const TILE_ART = {
  straight:A.tiles.railStraightV,
  corner:A.tiles.railCornerNe,
  tee:A.tiles.railTeeNes,
  cross:A.tiles.railCross,
  goal:A.tiles.deadEndW,
};

export function mountMazeRuntime({ world, stage, level, onMove, onStar, onGoal, onFail, onEffect, onStatus }) {
  const logic = getMachineLogic(level.id);
  const maze = logic?.maze;
  if (!logic || logic.archetype !== 'maze-one-turn' || !maze) throw new Error(`Level ${level.id} is not a maze-one-turn puzzle`);

  let destroyed = false;
  let running = false;
  let pendingRotation = null;
  let currentRotation = maze.pivot.initialRotation;
  let frameId = 0;
  const timers = new Set();

  world.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'machine-board maze-board';
  board.innerHTML = `
    <img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt="" draggable="false">
    <div class="maze-deck"></div>
    <div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div>
    <img class="maze-ball" src="${A.objects.ballBlue}" alt="" draggable="false" aria-hidden="true">
    <div class="maze-caption">ONE MOVE · ROTATE ONE TILE</div>
  `;
  world.appendChild(board);
  stage.classList.add('maze-stage');

  const grid = board.querySelector('.maze-grid');
  const ball = board.querySelector('.maze-ball');
  const nodes = new Map();

  for (let y=0; y<maze.rows; y+=1) {
    for (let x=0; x<maze.cols; x+=1) {
      const slot = document.createElement('div');
      slot.className = 'maze-slot';
      slot.style.gridColumn = String(x+1);
      slot.style.gridRow = String(y+1);
      slot.dataset.x = String(x);
      slot.dataset.y = String(y);
      slot.innerHTML = `<img class="maze-slot-base" src="${A.tiles.baseSteelDark}" alt="" draggable="false">`;
      grid.appendChild(slot);
      nodes.set(`${x},${y}`, slot);
    }
  }

  for (const cell of maze.cells) renderCell(cell);
  requestAnimationFrame(() => placeBall(maze.start.x, maze.start.y));
  onStatus?.(logic.copy?.ready || 'Study the route. Rotate one tile.');

  function renderCell(cell) {
    const slot = nodes.get(`${cell.x},${cell.y}`);
    if (!slot) return;

    if (cell.hazard) {
      const pit = document.createElement('img');
      pit.className = 'maze-pit-art';
      pit.src = A.tiles.pitIdle;
      pit.alt = '';
      pit.draggable = false;
      slot.appendChild(pit);
      return;
    }

    const isPivot = cell.id === maze.pivot.id;
    const rotation = isPivot ? currentRotation : (cell.rotation || 0);
    const tile = document.createElement(isPivot ? 'button' : 'div');
    tile.className = `maze-tile${isPivot ? ' rotatable' : ''}`;
    tile.dataset.id = cell.id || '';
    tile.dataset.type = cell.type;
    tile.dataset.rotation = String(rotation);
    tile.style.setProperty('--angle', `${rotation * 90}deg`);

    if (isPivot) {
      tile.innerHTML = `
        <img class="maze-rotator-art" src="${A.tiles.rotatableIdle}" alt="" draggable="false">
        <img class="maze-rail-art" src="${tileAsset(cell.type)}" alt="" draggable="false">
      `;
    } else {
      tile.innerHTML = `<img class="maze-rail-art" src="${tileAsset(cell.type)}" alt="" draggable="false">`;
    }
    slot.appendChild(tile);

    if (cell.start) {
      const start = document.createElement('img');
      start.className = 'maze-start-art';
      start.src = A.tiles.startSocketIdle;
      start.alt = '';
      start.draggable = false;
      slot.appendChild(start);
    }
    if (cell.goal) {
      const goal = document.createElement('img');
      goal.className = 'maze-goal-art';
      goal.src = A.objects.goalIdle;
      goal.alt = '';
      goal.draggable = false;
      slot.appendChild(goal);
    }
    if (cell.star) {
      const star = document.createElement('img');
      star.className = 'maze-star-art';
      star.src = A.objects.starIdle;
      star.alt = '';
      star.draggable = false;
      slot.appendChild(star);
    }

    if (isPivot) installRotationGesture(tile);
  }

  function tileAsset(type) {
    return TILE_ART[type] || A.tiles.baseWood;
  }

  function setRotatorState(tile, state) {
    const art = tile.querySelector('.maze-rotator-art');
    if (!art) return;
    const source = {
      idle:A.tiles.rotatableIdle,
      hover:A.tiles.rotatableHover,
      rotating:A.tiles.rotatableRotating,
      snapped:A.tiles.rotatableSnapped,
    }[state];
    if (source) art.src = source;
    tile.dataset.state = state;
  }

  function installRotationGesture(tile) {
    let dragging = false;
    let startAngle = 0;
    let visualAngle = currentRotation * 90;

    const angleAt = event => {
      const rect = tile.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      return Math.atan2(event.clientY-cy,event.clientX-cx) * 180 / Math.PI;
    };
    const angleDelta = (value, origin) => ((value - origin + 540) % 360) - 180;

    tile.addEventListener('pointerenter', () => { if (!running && !dragging) setRotatorState(tile,'hover'); });
    tile.addEventListener('pointerleave', () => { if (!running && !dragging) setRotatorState(tile,'idle'); });

    tile.addEventListener('pointerdown', event => {
      if (running) return;
      dragging = true;
      startAngle = angleAt(event);
      visualAngle = currentRotation * 90;
      setRotatorState(tile,'rotating');
      tile.setPointerCapture?.(event.pointerId);
      onEffect?.('wood');
    });

    tile.addEventListener('pointermove', event => {
      if (!dragging || running) return;
      const delta = angleDelta(angleAt(event), startAngle);
      tile.classList.add('dragging');
      tile.style.setProperty('--angle', `${visualAngle + delta}deg`);
    });

    const finish = event => {
      if (!dragging || running) return;
      dragging = false;
      tile.classList.remove('dragging');
      const delta = angleDelta(angleAt(event), startAngle);
      if (Math.abs(delta) < 22) {
        tile.style.setProperty('--angle', `${currentRotation*90}deg`);
        setRotatorState(tile,'idle');
        return;
      }
      const turns = Math.round(delta / 90);
      pendingRotation = norm(currentRotation + turns);
      tile.style.setProperty('--angle', `${pendingRotation*90}deg`);
      tile.dataset.rotation = String(pendingRotation);
      setRotatorState(tile,'snapped');
      onMove?.(maze.pivot.id, event);
    };

    tile.addEventListener('pointerup', finish);
    tile.addEventListener('pointercancel', () => {
      dragging = false;
      tile.classList.remove('dragging');
      tile.style.setProperty('--angle', `${currentRotation*90}deg`);
      setRotatorState(tile,'idle');
    });

    tile.addEventListener('keydown', event => {
      if (running || !['ArrowLeft','ArrowRight','Enter',' '].includes(event.key)) return;
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -1 : 1;
      pendingRotation = norm(currentRotation + delta);
      tile.style.setProperty('--angle', `${pendingRotation*90}deg`);
      tile.dataset.rotation = String(pendingRotation);
      setRotatorState(tile,'snapped');
      onMove?.(maze.pivot.id, event);
    });
  }

  function commit(id) {
    if (running || id !== maze.pivot.id || pendingRotation == null) return { accepted:false };
    running = true;
    currentRotation = pendingRotation;
    pendingRotation = null;
    board.classList.add('maze-running');
    const startArt = board.querySelector('.maze-start-art');
    if (startArt) startArt.src = A.tiles.startSocketActive;
    onStatus?.(logic.copy?.running || 'Route set. Watch the machine.');
    onEffect?.('metal');
    later(runMaze, 420);
    return { accepted:true, effectHandled:true };
  }

  function runMaze() {
    if (destroyed) return;
    const result = solvePath();
    ball.classList.add('running');
    onEffect?.('roll-start');
    animatePath(result.path, 0, result);
  }

  function solvePath() {
    const path = [{x:maze.start.x,y:maze.start.y}];
    const visited = new Set([`${maze.start.x},${maze.start.y},${maze.start.dir}`]);
    let x = maze.start.x;
    let y = maze.start.y;
    let dir = maze.start.dir;
    let star = false;

    for (let i=0; i<40; i+=1) {
      const [dx,dy] = STEP[dir];
      x += dx; y += dy;
      path.push({x,y});
      const cell = maze.cells.find(c => c.x===x && c.y===y);
      if (!cell) return {path,success:false,reason:'off-track',star};
      if (cell.hazard) return {path,success:false,reason:'pit',star};
      if (cell.star) star = true;
      if (cell.goal) return {path,success:true,reason:'goal',star};

      const rotation = cell.id === maze.pivot.id ? currentRotation : (cell.rotation || 0);
      const connections = rotatedConnections(cell.type, rotation);
      const entry = OPP[dir];
      if (!connections.includes(entry)) return {path,success:false,reason:'broken',star};
      const exits = connections.filter(d => d !== entry);
      if (!exits.length) return {path,success:false,reason:'dead-end',star};
      dir = exits[0];
      const stateKey = `${x},${y},${dir}`;
      if (visited.has(stateKey)) return {path,success:false,reason:'loop',star};
      visited.add(stateKey);
    }
    return {path,success:false,reason:'loop',star};
  }

  function animatePath(path, index, result) {
    if (destroyed) return;
    if (index >= path.length-1) {
      finishRun(result);
      return;
    }
    const a = path[index];
    const b = path[index+1];
    const start = performance.now();
    const duration = 330;
    const startP = cellPoint(a.x,a.y);
    const endP = cellPoint(b.x,b.y);

    const tick = now => {
      if (destroyed) return;
      const t = Math.min(1,(now-start)/duration);
      const e = 1-Math.pow(1-t,3);
      const x = startP.x + (endP.x-startP.x)*e;
      const y = startP.y + (endP.y-startP.y)*e;
      ball.style.left = `${x}%`;
      ball.style.top = `${y}%`;
      ball.style.setProperty('--roll', `${(index + t) * 175}deg`);
      if (t < 1) frameId = requestAnimationFrame(tick);
      else {
        const cell = maze.cells.find(c => c.x===b.x && c.y===b.y);
        if (cell?.star) collectStar(b.x,b.y);
        onEffect?.('track-tick');
        animatePath(path,index+1,result);
      }
    };
    frameId = requestAnimationFrame(tick);
  }

  function collectStar(x,y) {
    const slot = nodes.get(`${x},${y}`);
    const star = slot?.querySelector('.maze-star-art');
    if (!star || star.dataset.collected === 'true') return;
    star.dataset.collected = 'true';
    star.src = A.objects.starCollect;
    star.classList.add('collecting');
    spawnFx(slot,A.fx.starBurst,'maze-star-burst');
    onStar?.();
    later(() => star.remove(),260);
  }

  function finishRun(result) {
    if (destroyed) return;
    ball.classList.remove('running');
    board.classList.remove('maze-running');
    if (result.success) {
      board.classList.add('maze-solved');
      const goal = board.querySelector('.maze-goal-art');
      const goalSlot = goal?.closest('.maze-slot');
      if (goal) goal.src = A.objects.goalSuccess;
      if (goalSlot) spawnFx(goalSlot,A.fx.goalGlow,'maze-goal-glow');
      onStatus?.(logic.copy?.complete || 'Perfect route.');
      onEffect?.('goal');
      later(() => onGoal?.(), logic.timings?.resultDelay || 520);
    } else {
      ball.classList.add('failed');
      if (result.reason === 'pit') {
        const end = result.path[result.path.length-1];
        const pitSlot = nodes.get(`${end.x},${end.y}`);
        const pit = pitSlot?.querySelector('.maze-pit-art');
        if (pit) pit.src = A.tiles.pitFail;
        if (pitSlot) spawnFx(pitSlot,A.fx.failSplash,'maze-fail-splash');
      }
      onEffect?.('fail-soft');
      const message = result.reason === 'pit' ? (logic.copy?.pit || 'The ball fell into the pit.') : (logic.copy?.wrong || 'That route does not connect.');
      onStatus?.(message);
      later(() => onFail?.(message), 520);
    }
  }

  function spawnFx(slot,src,className) {
    if (!slot || !src) return;
    const fx = document.createElement('img');
    fx.className = `maze-fx ${className}`;
    fx.src = src;
    fx.alt = '';
    fx.draggable = false;
    slot.appendChild(fx);
    later(() => fx.remove(),700);
  }

  function rotatedConnections(type, rotation) {
    return (BASE[type] || []).map(dir => DIRS[(DIRS.indexOf(dir) + rotation) % 4]);
  }

  function cellPoint(x,y) {
    const boardRect = board.getBoundingClientRect();
    const slotRect = nodes.get(`${x},${y}`)?.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height || !slotRect?.width || !slotRect?.height) {
      return { x: ((x+.5)/maze.cols)*80 + 10, y: ((y+.5)/maze.rows)*80 + 10 };
    }
    return {
      x: ((slotRect.left - boardRect.left + slotRect.width/2) / boardRect.width) * 100,
      y: ((slotRect.top - boardRect.top + slotRect.height/2) / boardRect.height) * 100,
    };
  }

  function placeBall(x,y) {
    const p = cellPoint(x,y);
    ball.style.left = `${p.x}%`;
    ball.style.top = `${p.y}%`;
  }

  function later(fn,delay) {
    const id = setTimeout(() => { timers.delete(id); if (!destroyed) fn(); },delay);
    timers.add(id);
  }

  function destroy() {
    destroyed = true;
    if (frameId) cancelAnimationFrame(frameId);
    timers.forEach(clearTimeout);
    timers.clear();
    world.innerHTML = '';
    stage.classList.remove('maze-stage');
  }

  return { commit, destroy, board, nodes };
}

function norm(value) {
  return ((value % 4) + 4) % 4;
}
