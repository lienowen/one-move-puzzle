import { MACHINE_LOGIC } from '../src/machineLogic.js';

const errors = [];
const fail = message => errors.push(message);

function requireStrings(object, keys, scope) {
  for (const key of keys) {
    if (typeof object?.[key] !== 'string' || !object[key].trim()) {
      fail(`${scope}: missing ${key}`);
    }
  }
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

  if (!(checkpoints.triggerAt < checkpoints.gateHoldAt && checkpoints.gateHoldAt < checkpoints.goalWakeAt)) {
    fail('release: checkpoints must be ordered trigger -> gate hold -> goal wake');
  }
  if (!(timings.driveDelay < timings.gatePreloadDelay && timings.gatePreloadDelay < timings.gateOpenDelay)) {
    fail('release: timings must be ordered drive -> gate preload -> gate open');
  }
  if (timings.gateOpenDelay - timings.gatePreloadDelay < 250) {
    fail('release: gate needs a readable preload/open interval');
  }
  if (!(timings.resultDelay >= 450 && timings.resultDelay <= 900)) {
    fail('release: result delay must preserve the completion beat');
  }

  for (const key of ['goal','finish']) {
    if (!Array.isArray(requirements[key]) || requirements[key].length === 0) fail(`release: ${key} requirements must be explicit`);
  }
  if (!requirements.goal?.includes('star')) fail('release: goal must require star power');
  for (const key of ['gateOpen','star','goalAwake']) {
    if (!requirements.finish?.includes(key)) fail(`release: finish must require ${key}`);
  }

  requireStrings(copy,['latch','rolling','trigger','waitingGate','routeOpen','reward','goal','complete'],'release copy');
  requireStrings(focus,['initial','release','trigger','goal','complete'],'release focus');
}

function validateGate() {
  const logic = MACHINE_LOGIC.gate;
  if (!logic) return fail('gate logic is missing');
  if (logic.archetype !== 'choice-gate') fail('gate: archetype must be choice-gate');

  const { controls = {}, timings = {}, requirements = {}, copy = {} } = logic;
  requireStrings(controls,['correct','decoy','target'],'gate controls');

  const ids = [controls.correct, controls.decoy, controls.target].filter(Boolean);
  if (new Set(ids).size !== ids.length) fail('gate: correct, decoy and target controls must be distinct');
  if (controls.correct !== 'blueLever') fail('gate: authored correct linkage must be blueLever');
  if (controls.decoy !== 'redLever') fail('gate: authored dead linkage must be redLever');
  if (controls.target !== 'gate') fail('gate: linkage target must be the physical gate');

  for (const key of ['driveDelay','gateOpenDelay','ballReleaseDelay','resultDelay']) {
    if (!(Number.isFinite(timings[key]) && timings[key] >= 0)) fail(`gate: ${key} must be a non-negative number`);
  }
  if (!(timings.driveDelay < timings.gateOpenDelay && timings.gateOpenDelay < timings.ballReleaseDelay)) {
    fail('gate: sequence must be linkage drive -> gate open -> ball release');
  }
  if (timings.gateOpenDelay - timings.driveDelay < 180) {
    fail('gate: opening needs a readable mechanical delay after lever engagement');
  }
  if (timings.ballReleaseDelay - timings.gateOpenDelay < 120) {
    fail('gate: ball cannot release before the player reads the open gate');
  }
  if (!(timings.resultDelay >= 300 && timings.resultDelay <= 750)) {
    fail('gate: result delay must preserve the goal completion beat');
  }

  if (!Array.isArray(requirements.finish) || !requirements.finish.includes('gateOpen')) {
    fail('gate: finish must require gateOpen');
  }
  requireStrings(copy,['ready','correct','gate','wrong'],'gate copy');
}

validateRelease();
validateGate();

if (errors.length) {
  for (const message of errors) console.error(`Machine logic check failed: ${message}`);
  process.exit(1);
}

console.log('Machine logic check passed: release-chain and choice-gate causality are valid.');
