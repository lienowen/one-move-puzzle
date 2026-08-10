import './mazeRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { POLISH_ASSETS as P } from './polishAssets.js';
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

export function mountMazeRuntime({ world, stage, level, onMove, onStar, onGoal, onFail, onEffect, onStatus }) {
  const logic = getMachineLogic(level.id);
  const maze = logic?.maze;
  if (!logic || logic.archetype !== 'maze-one-turn' || !maze) throw new Error(`Level ${level.id} is not a maze-one-turn puzzle`);

  let destroyed = false;
  let running = false;
  let pendingRotation = null;
  let currentRotation = maze.pivot.initialRotation;
  const timers = new Set();

  world.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'machine-board maze-board';
  board.innerHTML = `
    <img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt="" draggable="false">
    <div class="maze-deck"></div>
    <div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div>
    <div class="maze-ball" aria-hidden="true"></div>
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
      grid.appendChild(slot);
      nodes.set(`${x},${y}`, slot);
    }
  }

  for (const cell of maze.cells) renderCell(cell);
  placeBall(maze.start.x, maze.start.y);
  onStatus?.(logic.copy?.ready || 'Study the route. Rotate one tile.');

  function renderCell(cell) {
    const slot = nodes.get(`${cell.x},${cell.y}`);
    if (!slot) return;

    if (cell.hazard) {
      const pit = document.createElement('div');
      pit.className = 'maze-pit-badge';
      slot.appendChild(pit);
      return;
    }

    const tile = document.createElement(cell.id === maze.pivot.id ? 'button' : 'div');
    tile.className = `maze-tile${cell.id === maze.pivot.id ? ' rotatable' : ''}`;
    tile.dataset.id = cell.id || '';
    tile.dataset.type = cell.type;
    tile.dataset.rotation = String(cell.rotation || 0);
    tile.style.setProperty('--angle', `${(cell.rotation || 0) * 90}deg`);
    tile.innerHTML = tileMarkup(cell.type);
    slot.appendChild(tile);

    if (cell.start) {
      const badge = document.createElement('div');
      badge.className = 'maze-start-badge';
      badge.textContent = 'START';
      slot.appendChild(badge);
    }
    if (cell.goal) {
      const goal = document.createElement('img');
      goal.className = 'maze-goal-art';
      goal.src = P.interaction.goalYellowIdle || W.goals.goalYellow;
      goal.alt = '';
      goal.draggable = false;
      slot.appendChild(goal);
    }
    if (cell.star) {
      const star = document.createElement('img');
      star.className = 'maze-star-art';
      star.src = P.interaction.starIdle || W.goals.star;
      star.alt = '';
      star.draggable = false;
      slot.appendChild(star);
    }

    if (cell.id === maze.pivot.id) installRotationGesture(tile);
  }

  function tileMarkup(type) {
    const arms = BASE[type] || [];
    return `${arms.map(d => `<i class="maze-arm ${d.toLowerCase()}"></i>`).join('')}<i class="maze-hub"></i><i class="maze-track-groove"></i>`;
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

    tile.addEventListener('pointerdown', event => {
      if (running) return;
      dragging = true;
      startAngle = angleAt(event);
      visualAngle = currentRotation * 90;
      tile.setPointerCapture?.(event.pointerId);
      onEffect?.('wood');
    });

    tile.addEventListener('pointermove', event => {
      if (!dragging || running) return;
      const delta = angleAt(event) - startAngle;
      tile.style.transition = 'none';
      tile.style.setProperty('--angle', `${visualAngle + delta}deg`);
    });

    const finish = event => {
      if (!dragging || running) return;
      dragging = false;
      const delta = angleAt(event) - startAngle;
      if (Math.abs(delta) < 22) {
        tile.style.transition = '';
        tile.style.setProperty('--angle', `${currentRotation*90}deg`);
        return;
      }
      const turns = Math.round(delta / 90);
      pendingRotation = norm(currentRotation + turns);
      tile.style.transition = '';
      tile.style.setProperty('--angle', `${pendingRotation*90}deg`);
      onMove?.(maze.pivot.id, event);
    };

    tile.addEventListener('pointerup', finish);
    tile.addEventListener('pointercancel', () => {
      dragging = false;
      tile.style.transition = '';
      tile.style.setProperty('--angle', `${currentRotation*90}deg`);
    });

    tile.addEventListener('keydown', event => {
      if (running || !['ArrowLeft','ArrowRight','Enter',' '].includes(event.key)) return;
      event.preventDefault();
      pendingRotation = norm(currentRotation + (event.key === 'ArrowRight' ? 1 : -1));
      tile.style.setProperty('--angle', `${pendingRotation*90}deg`);
      onMove?.(maze.pivot.id, event);
    });
  }

  function commit(id) {
    if (running || id !== maze.pivot.id || pendingRotation == null) return { accepted:false };
    running = true;
    currentRotation = pendingRotation;
    pendingRotation = null;
    const pivotCell = maze.cells.find(c => c.id === maze.pivot.id);
    pivotCell.rotation = currentRotation;
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

      const connections = rotatedConnections(cell.type, cell.rotation || 0);
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
    const duration = 360;
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
      if (t < 1) requestAnimationFrame(tick);
      else {
        const cell = maze.cells.find(c => c.x===b.x && c.y===b.y);
        if (cell?.star) {
          const star = nodes.get(`${b.x},${b.y}`)?.querySelector('.maze-star-art');
          star?.remove();
          onStar?.();
        }
        onEffect?.('track-tick');
        animatePath(path,index+1,result);
      }
    };
    requestAnimationFrame(tick);
  }

  function finishRun(result) {
    if (destroyed) return;
    ball.classList.remove('running');
    if (result.success) {
      board.classList.add('maze-solved');
      onStatus?.(logic.copy?.complete || 'Perfect route.');
      onEffect?.('goal');
      later(() => onGoal?.(), logic.timings?.resultDelay || 520);
    } else {
      ball.classList.add('failed');
      onEffect?.('fail-soft');
      const message = result.reason === 'pit' ? (logic.copy?.pit || 'The ball fell into the pit.') : (logic.copy?.wrong || 'That route does not connect.');
      onStatus?.(message);
      later(() => onFail?.(message), 520);
    }
  }

  function rotatedConnections(type, rotation) {
    return (BASE[type] || []).map(dir => DIRS[(DIRS.indexOf(dir) + rotation) % 4]);
  }

  function cellPoint(x,y) {
    return { x: ((x+.5)/maze.cols)*82 + 9, y: ((y+.5)/maze.rows)*82 + 9 };
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
