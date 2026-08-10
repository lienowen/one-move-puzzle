import './mazeRuntime.css';
import './mazePuzzleRuntime.css';
import './mazeVectorRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const DIRS = ['N','E','S','W'];
const STEP = { N:[0,-1], E:[1,0], S:[0,1], W:[-1,0] };
const OPP = { N:'S', E:'W', S:'N', W:'E' };
const BASE = {
  straight:['N','S'], corner:['N','E'], tee:['N','E','S'], cross:['N','E','S','W'],
};
const TILE_ART = {
  straight:A.tiles.railStraightV,
  corner:A.tiles.railCornerNe,
  tee:A.tiles.railTeeNes,
  cross:A.tiles.railCross,
};

export function mountMazeVectorRuntime({ world, stage, level, onMove, onStar, onGoal, onFail, onEffect, onStatus }) {
  const logic = getMachineLogic(level.id);
  const maze = logic?.maze;
  if (!logic || !maze || maze.mode !== 'vector') throw new Error(`Level ${level.id} has no vector maze configuration`);

  const rotators = maze.rotators || [];
  const rotatorById = new Map(rotators.map(item => [item.id,item]));
  const cellsByPoint = new Map(maze.cells.map(cell => [`${cell.x},${cell.y}`,cell]));
  const rotations = new Map();
  for (const cell of maze.cells) if (cell.id) rotations.set(cell.id,rotatorById.get(cell.id)?.initialRotation ?? cell.rotation ?? 0);

  let destroyed = false;
  let running = false;
  let pendingMove = null;
  let frameId = 0;
  const timers = new Set();
  const nodes = new Map();
  const rotatorNodes = new Map();

  world.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'machine-board maze-board maze-puzzle-board maze-vector-board';
  board.dataset.mazeLevel = level.id;
  board.innerHTML = `
    <img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt="" draggable="false">
    <div class="maze-deck"></div>
    <div class="maze-route-cue"></div>
    <div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div>
    <img class="maze-ball" src="${A.objects.ballBlue}" alt="" draggable="false" aria-hidden="true">
    <div class="maze-caption">ONE MOVE · AIM THE FORCE</div>
  `;
  world.appendChild(board);
  stage.classList.add('maze-stage');

  const grid = board.querySelector('.maze-grid');
  const ball = board.querySelector('.maze-ball');

  for (let y=0;y<maze.rows;y+=1) {
    for (let x=0;x<maze.cols;x+=1) {
      const slot = document.createElement('div');
      slot.className = 'maze-slot';
      slot.style.gridColumn = String(x+1);
      slot.style.gridRow = String(y+1);
      slot.dataset.x = String(x);
      slot.dataset.y = String(y);
      slot.innerHTML = `<img class="maze-slot-base" src="${A.tiles.baseSteelDark}" alt="" draggable="false">`;
      grid.appendChild(slot);
      nodes.set(`${x},${y}`,slot);
    }
  }

  for (const cell of maze.cells) renderCell(cell);
  requestAnimationFrame(() => placeBall(maze.start.x,maze.start.y));
  onStatus?.(logic.copy?.ready || 'Study the forces before you move.');

  function renderCell(cell) {
    const slot = nodes.get(`${cell.x},${cell.y}`);
    if (!slot) return;
    if (cell.hazard) {
      appendArt(slot,'maze-pit-art',A.tiles.pitIdle);
      return;
    }
    if (cell.gap) slot.classList.add('maze-gap-slot');

    if (!cell.gap) {
      const rotator = cell.id ? rotatorById.get(cell.id) : null;
      const rotation = cell.id ? (rotations.get(cell.id) ?? cell.rotation ?? 0) : (cell.rotation || 0);
      const tile = document.createElement(rotator ? 'button' : 'div');
      tile.className = `maze-tile${rotator ? ' rotatable' : ''}`;
      tile.dataset.id = cell.id || '';
      tile.dataset.type = cell.type || 'straight';
      tile.dataset.rotation = String(rotation);
      tile.style.setProperty('--angle',`${rotation*90}deg`);
      tile.innerHTML = rotator
        ? `<img class="maze-rotator-art" src="${A.tiles.rotatableIdle}" alt="" draggable="false"><img class="maze-rail-art" src="${tileAsset(cell.type)}" alt="" draggable="false">`
        : `<img class="maze-rail-art" src="${tileAsset(cell.type)}" alt="" draggable="false">`;
      slot.appendChild(tile);
      if (rotator) {
        rotatorNodes.set(cell.id,tile);
        installRotationGesture(tile,rotator);
      }
    }

    if (cell.start) appendArt(slot,'maze-start-art',A.tiles.startSocketIdle);
    if (cell.goal) appendArt(slot,'maze-goal-art',A.objects.goalIdle);
    if (cell.star) appendArt(slot,'maze-star-art',A.objects.starIdle);
    if (cell.feature === 'spring') appendArt(slot,'maze-vector-art maze-spring-art',A.tiles.springIdle);
  }

  function appendArt(slot,className,src) {
    const art = document.createElement('img');
    art.className = className;
    art.src = src;
    art.alt = '';
    art.draggable = false;
    slot.appendChild(art);
    return art;
  }

  function tileAsset(type) { return TILE_ART[type] || A.tiles.baseWood; }

  function setRotatorState(tile,state) {
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

  function installRotationGesture(tile,rotator) {
    let dragging = false;
    let startAngle = 0;
    let visualAngle = (rotations.get(rotator.id)||0)*90;
    const allowedTurns = rotator.turns?.length ? rotator.turns : [-1,1];
    const angleAt = event => {
      const rect = tile.getBoundingClientRect();
      return Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2))*180/Math.PI;
    };
    const angleDelta = (value,origin) => ((value-origin+540)%360)-180;

    tile.addEventListener('pointerenter',() => { if (!running && !dragging) setRotatorState(tile,'hover'); });
    tile.addEventListener('pointerleave',() => { if (!running && !dragging) setRotatorState(tile,'idle'); });
    tile.addEventListener('pointerdown',event => {
      if (running) return;
      dragging = true;
      startAngle = angleAt(event);
      visualAngle = (rotations.get(rotator.id)||0)*90;
      setRotatorState(tile,'rotating');
      tile.setPointerCapture?.(event.pointerId);
      onEffect?.('wood');
    });
    tile.addEventListener('pointermove',event => {
      if (!dragging || running) return;
      const delta = angleDelta(angleAt(event),startAngle);
      tile.classList.add('dragging');
      tile.style.setProperty('--angle',`${visualAngle+delta}deg`);
    });
    const finish = event => {
      if (!dragging || running) return;
      dragging = false;
      tile.classList.remove('dragging');
      const delta = angleDelta(angleAt(event),startAngle);
      if (Math.abs(delta) < 22) {
        tile.style.setProperty('--angle',`${(rotations.get(rotator.id)||0)*90}deg`);
        setRotatorState(tile,'idle');
        return;
      }
      const turn = delta > 0 ? 1 : -1;
      if (!allowedTurns.includes(turn)) return;
      queueMove(rotator.id,turn,event);
    };
    tile.addEventListener('pointerup',finish);
    tile.addEventListener('pointercancel',() => {
      dragging = false;
      tile.classList.remove('dragging');
      tile.style.setProperty('--angle',`${(rotations.get(rotator.id)||0)*90}deg`);
      setRotatorState(tile,'idle');
    });
    tile.addEventListener('keydown',event => {
      if (running || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const turn = event.key === 'ArrowLeft' ? -1 : 1;
      if (allowedTurns.includes(turn)) queueMove(rotator.id,turn,event);
    });
  }

  function queueMove(id,turn,event) {
    const tile = rotatorNodes.get(id);
    const nextRotation = norm((rotations.get(id)||0)+turn);
    pendingMove = {id,turn,rotation:nextRotation};
    tile.style.setProperty('--angle',`${nextRotation*90}deg`);
    tile.dataset.rotation = String(nextRotation);
    setRotatorState(tile,'snapped');
    onMove?.(id,event);
  }

  function commit(id) {
    if (running || !pendingMove || pendingMove.id !== id) return {accepted:false};
    running = true;
    rotations.set(id,pendingMove.rotation);
    rotatorNodes.get(id)?.classList.add('chosen');
    pendingMove = null;
    board.classList.add('maze-running','spring-armed');
    const start = board.querySelector('.maze-start-art');
    if (start) start.src = A.tiles.startSocketActive;
    onStatus?.(logic.copy?.running || 'Force set. Watch the launch.');
    onEffect?.('metal');
    later(runMaze,360);
    return {accepted:true,effectHandled:true};
  }

  function runMaze() {
    if (destroyed) return;
    const result = solvePath();
    ball.classList.add('running');
    onEffect?.('roll-start');
    animatePath(result.path,0,result);
  }

  function solvePath() {
    const path = [{x:maze.start.x,y:maze.start.y,events:[]}];
    const visited = new Set();
    let x = maze.start.x;
    let y = maze.start.y;
    let dir = maze.start.dir;
    let airborneRemaining = 0;
    let airborneTotal = 0;
    let airborneIndex = 0;

    for (let i=0;i<72;i+=1) {
      const state = `${x},${y},${dir}`;
      if (visited.has(state)) return {path,success:false,reason:'loop'};
      visited.add(state);
      const [dx,dy] = STEP[dir];
      x += dx; y += dy;
      const step = {x,y,events:[]};
      if (airborneRemaining > 0) {
        airborneIndex += 1;
        step.air = {index:airborneIndex,total:airborneTotal};
        airborneRemaining -= 1;
        if (airborneRemaining === 0) step.events.push({type:'landing'});
      }
      path.push(step);

      const cell = cellsByPoint.get(`${x},${y}`);
      if (!cell) return {path,success:false,reason:'off-track'};
      if (cell.hazard) return {path,success:false,reason:'pit'};
      if (cell.star) step.events.push({type:'star'});
      if (cell.goal) return {path,success:true,reason:'goal'};

      const rotation = cell.id ? (rotations.get(cell.id) ?? cell.rotation ?? 0) : (cell.rotation || 0);
      const links = rotatedConnections(cell.type,rotation);
      const entry = OPP[dir];
      if (!links.includes(entry)) return {path,success:false,reason:'broken'};
      const exits = links.filter(item => item !== entry);
      if (!exits.length) return {path,success:false,reason:'dead-end'};
      const exit = chooseExit(cell,rotation,entry,dir,exits);
      if (!exit || !exits.includes(exit)) return {path,success:false,reason:'broken'};
      dir = exit;

      if (cell.feature === 'spring') {
        const steps = Math.max(1,Number(cell.airborneSteps || 2));
        step.events.push({type:'spring',steps});
        airborneRemaining = steps;
        airborneTotal = steps;
        airborneIndex = 0;
      }
    }
    return {path,success:false,reason:'loop'};
  }

  function chooseExit(cell,rotation,entry,currentDir,exits) {
    const byRotation = cell.exitByRotation?.[String(rotation)]?.[entry];
    if (byRotation) return byRotation;
    const fixed = cell.exitMap?.[entry];
    if (fixed) return fixed;
    if (exits.includes(currentDir)) return currentDir;
    return exits[0];
  }

  function animatePath(path,index,result) {
    if (destroyed) return;
    if (index >= path.length-1) {
      ball.style.setProperty('--lift','0px');
      ball.classList.remove('maze-airborne');
      finishRun(result);
      return;
    }
    const a = path[index];
    const b = path[index+1];
    const startTime = performance.now();
    const duration = b.air ? 285 : 315;
    const startP = cellPoint(a.x,a.y);
    const endP = cellPoint(b.x,b.y);
    if (b.air) ball.classList.add('maze-airborne');

    const tick = now => {
      if (destroyed) return;
      const t = Math.min(1,(now-startTime)/duration);
      const e = 1-Math.pow(1-t,3);
      ball.style.left = `${startP.x+(endP.x-startP.x)*e}%`;
      ball.style.top = `${startP.y+(endP.y-startP.y)*e}%`;
      ball.style.setProperty('--roll',`${(index+t)*185}deg`);
      if (b.air) {
        const global = ((b.air.index-1)+t)/b.air.total;
        const lift = Math.sin(Math.PI*Math.min(1,Math.max(0,global))) * 34;
        ball.style.setProperty('--lift',`${lift}px`);
      } else {
        ball.style.setProperty('--lift','0px');
      }
      if (t < 1) frameId = requestAnimationFrame(tick);
      else {
        applyStepEvents(b);
        if (!b.air) ball.classList.remove('maze-airborne');
        onEffect?.('track-tick');
        animatePath(path,index+1,result);
      }
    };
    frameId = requestAnimationFrame(tick);
  }

  function applyStepEvents(step) {
    for (const event of step.events || []) {
      if (event.type === 'star') collectStar(step.x,step.y);
      if (event.type === 'spring') fireSpring(step.x,step.y);
      if (event.type === 'landing') land(step.x,step.y);
    }
  }

  function fireSpring(x,y) {
    const slot = nodes.get(`${x},${y}`);
    const spring = slot?.querySelector('.maze-spring-art');
    board.classList.add('spring-fired');
    if (spring) spring.src = A.tiles.springCompressed;
    spawnFx(slot,A.fx.springDust,'maze-vector-dust');
    onStatus?.(logic.copy?.launch || 'Spring released.');
    onEffect?.('wood');
    later(() => { if (spring) spring.src = A.tiles.springRelease; },90);
  }

  function land(x,y) {
    const slot = nodes.get(`${x},${y}`);
    spawnFx(slot,A.fx.springDust,'maze-vector-dust');
    onStatus?.(logic.copy?.landing || 'Clean landing.');
    onEffect?.('track-tick');
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
    ball.classList.remove('running','maze-airborne');
    ball.style.setProperty('--lift','0px');
    board.classList.remove('maze-running');
    if (result.success) {
      board.classList.add('maze-solved');
      const goal = board.querySelector('.maze-goal-art');
      const slot = goal?.closest('.maze-slot');
      if (goal) goal.src = A.objects.goalSuccess;
      if (slot) spawnFx(slot,A.fx.goalGlow,'maze-goal-glow');
      onStatus?.(logic.copy?.complete || 'Perfect launch.');
      onEffect?.('goal');
      later(() => onGoal?.(),logic.timings?.resultDelay || 580);
      return;
    }

    if (result.reason === 'pit') {
      const end = result.path[result.path.length-1];
      const slot = nodes.get(`${end.x},${end.y}`);
      const pit = slot?.querySelector('.maze-pit-art');
      if (pit) pit.src = A.tiles.pitFail;
      if (slot) spawnFx(slot,A.fx.failSplash,'maze-fail-splash');
    }
    ball.classList.add('failed');
    onEffect?.('fail-soft');
    const message = result.reason === 'pit' ? (logic.copy?.pit || 'Wrong launch angle.') : (logic.copy?.wrong || 'That vector does not reach the landing.');
    onStatus?.(message);
    later(() => onFail?.(message),560);
  }

  function spawnFx(slot,src,className) {
    if (!slot || !src) return;
    const fx = document.createElement('img');
    fx.className = `maze-fx ${className}`;
    fx.src = src;
    fx.alt = '';
    fx.draggable = false;
    slot.appendChild(fx);
    later(() => fx.remove(),720);
  }

  function rotatedConnections(type,rotation) {
    return (BASE[type] || []).map(dir => DIRS[(DIRS.indexOf(dir)+rotation)%4]);
  }

  function cellPoint(x,y) {
    const boardRect = board.getBoundingClientRect();
    const slotRect = nodes.get(`${x},${y}`)?.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height || !slotRect?.width || !slotRect?.height) return {x:((x+.5)/maze.cols)*80+10,y:((y+.5)/maze.rows)*80+10};
    return {
      x:((slotRect.left-boardRect.left+slotRect.width/2)/boardRect.width)*100,
      y:((slotRect.top-boardRect.top+slotRect.height/2)/boardRect.height)*100,
    };
  }

  function placeBall(x,y) {
    const point = cellPoint(x,y);
    ball.style.left = `${point.x}%`;
    ball.style.top = `${point.y}%`;
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

  return {commit,destroy,board,nodes};
}

function norm(value) { return ((value%4)+4)%4; }
