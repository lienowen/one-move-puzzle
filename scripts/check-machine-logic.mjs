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
  if (logic.archetype !== 'release-chain') fail('release: archetype must be release-chain');
  const { checkpoints = {}, timings = {}, requirements = {}, copy = {}, focus = {} } = logic;

  for (const key of ['triggerAt','gateHoldAt','goalWakeAt']) {
    const value = checkpoints[key];
    if (!(Number.isFinite(value) && value > 0 && value < 1)) fail(`release: ${key} must be between 0 and 1`);
  }
  if (!(checkpoints.triggerAt < checkpoints.gateHoldAt && checkpoints.gateHoldAt < checkpoints.goalWakeAt)) fail('release: checkpoints must be ordered trigger -> gate hold -> goal wake');
  if (!(timings.driveDelay < timings.gatePreloadDelay && timings.gatePreloadDelay < timings.gateOpenDelay)) fail('release: timings must be ordered drive -> gate preload -> gate open');
  if (timings.gateOpenDelay - timings.gatePreloadDelay < 250) fail('release: gate needs a readable preload/open interval');
  if (!(timings.resultDelay >= 450 && timings.resultDelay <= 900)) fail('release: result delay must preserve the completion beat');

  if (!requirements.goal?.includes('star')) fail('release: goal must require star power');
  for (const key of ['gateOpen','star','goalAwake']) if (!requirements.finish?.includes(key)) fail(`release: finish must require ${key}`);
  requireStrings(copy,['latch','rolling','trigger','waitingGate','routeOpen','reward','goal','complete'],'release copy');
  requireStrings(focus,['initial','release','trigger','goal','complete'],'release focus');
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

console.log('Machine logic check passed: release, choice-gate and route-align causality are valid.');
