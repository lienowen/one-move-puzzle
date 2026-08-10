import { MACHINE_LOGIC } from '../src/machineLogic.js';

const errors = [];
const fail = message => errors.push(message);
const DIRS = ['N','E','S','W'];
const STEP = { N:[0,-1], E:[1,0], S:[0,1], W:[-1,0] };
const OPP = { N:'S', E:'W', S:'N', W:'E' };
const BASE = {
  straight:['N','S'], corner:['N','E'], tee:['N','E','S'], cross:['N','E','S','W'],
};

function norm(value) { return ((value%4)+4)%4; }
function connections(type,rotation) {
  return (BASE[type] || []).map(dir => DIRS[(DIRS.indexOf(dir)+rotation)%4]);
}
function chooseExit(cell,rotation,entry,currentDir,exits) {
  const byRotation = cell.exitByRotation?.[String(rotation)]?.[entry];
  if (byRotation) return byRotation;
  const fixed = cell.exitMap?.[entry];
  if (fixed) return fixed;
  if (exits.includes(currentDir)) return currentDir;
  return exits[0];
}

function solveMaze(maze,override = {}) {
  const cells = new Map(maze.cells.map(cell => [`${cell.x},${cell.y}`,cell]));
  const rotations = new Map((maze.rotators || []).map(item => [item.id,item.initialRotation]));
  for (const [id,rotation] of Object.entries(override)) rotations.set(id,rotation);
  const openGates = new Set(maze.openGates || []);
  const visited = new Set();
  let x = maze.start.x;
  let y = maze.start.y;
  let dir = maze.start.dir;

  for (let i=0;i<72;i+=1) {
    const state = `${x},${y},${dir}|${[...openGates].sort().join(',')}`;
    if (visited.has(state)) return {success:false,reason:'loop'};
    visited.add(state);
    const [dx,dy] = STEP[dir];
    x += dx; y += dy;
    const cell = cells.get(`${x},${y}`);
    if (!cell) return {success:false,reason:'off-track'};
    if (cell.hazard) return {success:false,reason:'pit'};
    if (cell.feature === 'gate') {
      const gateId = cell.gateId || cell.id || 'gate';
      if (!openGates.has(gateId)) return {success:false,reason:'gate'};
    }
    if (cell.feature === 'pad') for (const gateId of cell.opens || []) openGates.add(gateId);
    if (cell.goal) return {success:true,reason:'goal'};

    const rotation = cell.id && rotations.has(cell.id) ? rotations.get(cell.id) : (cell.rotation || 0);
    const links = connections(cell.type,rotation);
    const entry = OPP[dir];
    if (!links.includes(entry)) return {success:false,reason:'broken'};
    const exits = links.filter(item => item !== entry);
    if (!exits.length) return {success:false,reason:'dead-end'};
    const exit = chooseExit(cell,rotation,entry,dir,exits);
    if (!exit || !exits.includes(exit)) return {success:false,reason:'broken'};
    dir = exit;
  }
  return {success:false,reason:'loop'};
}

function validateMaze(levelId) {
  const logic = MACHINE_LOGIC[levelId];
  if (!logic?.maze) return fail(`${levelId}: missing maze configuration`);
  const maze = logic.maze;
  if (!(Number.isInteger(maze.cols) && maze.cols >= 4)) fail(`${levelId}: cols must be >= 4`);
  if (!(Number.isInteger(maze.rows) && maze.rows >= 4)) fail(`${levelId}: rows must be >= 4`);
  if (!maze.start || !Number.isInteger(maze.start.x) || !Number.isInteger(maze.start.y) || !DIRS.includes(maze.start.dir)) fail(`${levelId}: invalid start`);
  if (!Array.isArray(maze.cells) || maze.cells.length < 6) fail(`${levelId}: maze needs authored cells`);
  if (!Array.isArray(maze.rotators) || !maze.rotators.length) fail(`${levelId}: maze needs at least one rotator`);

  const ids = maze.cells.filter(cell => cell.id).map(cell => cell.id);
  if (new Set(ids).size !== ids.length) fail(`${levelId}: duplicate cell ids`);
  for (const cell of maze.cells || []) {
    if (!(Number.isInteger(cell.x) && Number.isInteger(cell.y) && cell.x >= 0 && cell.x < maze.cols && cell.y >= 0 && cell.y < maze.rows)) fail(`${levelId}: cell ${cell.id || '?'} is outside the grid`);
    if (!cell.hazard && !BASE[cell.type]) fail(`${levelId}: cell ${cell.id || '?'} has unsupported type ${cell.type}`);
  }
  for (const rotator of maze.rotators || []) {
    if (!rotator.id || !ids.includes(rotator.id)) fail(`${levelId}: rotator ${rotator.id || '?'} has no matching cell`);
    if (!Number.isInteger(rotator.initialRotation)) fail(`${levelId}: rotator ${rotator.id || '?'} initialRotation must be integer`);
    if (!Array.isArray(rotator.turns) || !rotator.turns.length || rotator.turns.some(turn => ![-1,1].includes(turn))) fail(`${levelId}: rotator ${rotator.id || '?'} turns must be -1/1`);
  }
  if (!maze.cells.some(cell => cell.goal)) fail(`${levelId}: missing goal`);
  if (!maze.cells.some(cell => cell.star)) fail(`${levelId}: missing reward star`);
  if (!maze.cells.some(cell => cell.hazard)) fail(`${levelId}: missing visible failure route`);

  const gates = new Set(maze.cells.filter(cell => cell.feature === 'gate').map(cell => cell.gateId || cell.id));
  for (const pad of maze.cells.filter(cell => cell.feature === 'pad')) {
    for (const gateId of pad.opens || []) if (!gates.has(gateId)) fail(`${levelId}: pad ${pad.id || '?'} opens unknown gate ${gateId}`);
  }

  const initial = solveMaze(maze);
  if (initial.success) fail(`${levelId}: maze is already solved before the one move`);

  const solutions = [];
  for (const rotator of maze.rotators || []) {
    for (const turn of rotator.turns || []) {
      const rotation = norm(rotator.initialRotation + turn);
      const result = solveMaze(maze,{[rotator.id]:rotation});
      if (result.success) solutions.push({id:rotator.id,turn,rotation});
    }
  }
  if (solutions.length !== 1) fail(`${levelId}: expected exactly one one-move solution, found ${solutions.length} (${solutions.map(s => `${s.id}:${s.turn}`).join(', ') || 'none'})`);
  const expected = maze.expectedSolution;
  if (expected && (solutions[0]?.id !== expected.id || solutions[0]?.turn !== expected.turn)) fail(`${levelId}: unique solution does not match expected ${expected.id}:${expected.turn}`);
}

for (const id of ['release','gate','switch','button']) validateMaze(id);

if (errors.length) {
  for (const message of errors) console.error(`Machine logic check failed: ${message}`);
  process.exit(1);
}

console.log('Machine logic check passed: Levels 1-4 each have exactly one valid one-move maze solution.');
