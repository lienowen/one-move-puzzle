import { MACHINE_LOGIC } from '../src/machineLogic.js';

const errors = [];
const fail = message => errors.push(message);

function requireStrings(object, keys, scope) {
  for (const key of keys) {
    if (typeof object?.[key] !== 'string' || !object[key].trim()) fail(`${scope}: missing ${key}`);
  }
}

function requireDistinctControls(logic, scope, expected = {}) {
  const controls = logic?.controls || {};
  requireStrings(controls,['correct','decoy','target'],`${scope} controls`);
  const ids = [controls.correct,controls.decoy,controls.target].filter(Boolean);
  if (new Set(ids).size !== ids.length) fail(`${scope}: correct, decoy and target must be distinct`);
  for (const [key,value] of Object.entries(expected)) {
    if (controls[key] !== value) fail(`${scope}: ${key} must be ${value}`);
  }
  return controls;
}

function validateRelease() {
  const logic = MACHINE_LOGIC.release;
  if (!logic) return fail('release logic is missing');
  if (logic.archetype !== 'maze-one-turn') fail('release: archetype must be maze-one-turn');
  const maze = logic.maze || {};
  if (!(Number.isInteger(maze.cols) && maze.cols >= 4)) fail('release: maze cols must be >= 4');
  if (!(Number.isInteger(maze.rows) && maze.rows >= 4)) fail('release: maze rows must be >= 4');
  if (!Array.isArray(maze.cells) || maze.cells.length < 6) fail('release: maze needs enough authored cells');
  if (!maze.start || !Number.isInteger(maze.start.x) || !Number.isInteger(maze.start.y) || !['N','E','S','W'].includes(maze.start.dir)) fail('release: maze start is invalid');
  if (!maze.pivot?.id) fail('release: maze needs one pivot id');
  if (!Number.isInteger(maze.pivot?.initialRotation) || !Number.isInteger(maze.pivot?.targetRotation)) fail('release: pivot rotations must be integers');
  if (maze.pivot?.initialRotation === maze.pivot?.targetRotation) fail('release: initial pivot state cannot already be solved');

  const pivotCells = (maze.cells || []).filter(cell => cell.id === maze.pivot?.id);
  if (pivotCells.length !== 1) fail('release: maze must contain exactly one pivot cell');
  if (!(maze.cells || []).some(cell => cell.goal)) fail('release: maze must contain a goal');
  if (!(maze.cells || []).some(cell => cell.hazard)) fail('release: maze must contain a visible failure route');
  if (!(maze.cells || []).some(cell => cell.star)) fail('release: maze must contain a reward star');
  requireStrings(logic.copy,['ready','running','complete','pit','wrong'],'release copy');
}

function validateGate() {
  const logic = MACHINE_LOGIC.gate;
  if (!logic) return fail('gate logic is missing');
  if (logic.archetype !== 'choice-gate') fail('gate: archetype must be choice-gate');
  requireDistinctControls(logic,'gate',{correct:'blueLever',decoy:'redLever',target:'gate'});
  const { timings = {}, requirements = {}, copy = {} } = logic;

  for (const key of ['driveDelay','gateOpenDelay','ballReleaseDelay','resultDelay']) if (!(Number.isFinite(timings[key]) && timings[key] >= 0)) fail(`gate: ${key} must be non-negative`);
  if (!(timings.driveDelay < timings.gateOpenDelay && timings.gateOpenDelay < timings.ballReleaseDelay)) fail('gate: sequence must be linkage drive -> gate open -> ball release');
  if (timings.gateOpenDelay - timings.driveDelay < 180) fail('gate: opening needs a readable mechanical delay');
  if (timings.ballReleaseDelay - timings.gateOpenDelay < 120) fail('gate: ball cannot release before the open gate reads');
  if (!(timings.resultDelay >= 300 && timings.resultDelay <= 750)) fail('gate: result delay must preserve the goal completion beat');
  if (!requirements.finish?.includes('gateOpen')) fail('gate: finish must require gateOpen');
  requireStrings(copy,['ready','correct','gate','wrong'],'gate copy');
}

function validateSwitch() {
  const logic = MACHINE_LOGIC.switch;
  if (!logic) return fail('switch logic is missing');
  if (logic.archetype !== 'route-align') fail('switch: archetype must be route-align');
  requireDistinctControls(logic,'switch',{correct:'crank',decoy:'wheel',target:'spinner'});
  const { timings = {}, requirements = {}, copy = {} } = logic;

  for (const key of ['shaftDelay','alignDelay','ballReleaseDelay','resultDelay']) if (!(Number.isFinite(timings[key]) && timings[key] >= 0)) fail(`switch: ${key} must be non-negative`);
  if (!(timings.shaftDelay < timings.alignDelay && timings.alignDelay < timings.ballReleaseDelay)) fail('switch: sequence must be shaft torque -> bridge alignment -> ball release');
  if (timings.alignDelay - timings.shaftDelay < 250) fail('switch: bridge alignment needs a readable rotation interval');
  if (timings.ballReleaseDelay - timings.alignDelay < 140) fail('switch: player must see the aligned bridge before the ball starts');
  if (!(timings.resultDelay >= 300 && timings.resultDelay <= 750)) fail('switch: result delay must preserve the goal completion beat');
  if (!requirements.finish?.includes('routeAligned')) fail('switch: finish must require routeAligned');
  requireStrings(copy,['ready','correct','aligned','wrong'],'switch copy');
}

validateRelease();
validateGate();
validateSwitch();

if (errors.length) {
  for (const message of errors) console.error(`Machine logic check failed: ${message}`);
  process.exit(1);
}

console.log('Machine logic check passed: maze-one-turn, choice-gate and route-align causality are valid.');
