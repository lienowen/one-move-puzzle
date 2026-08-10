import { MACHINE_LOGIC } from '../src/machineLogic.js';

const fail = message => {
  console.error(`Machine logic check failed: ${message}`);
  process.exitCode = 1;
};

const logic = MACHINE_LOGIC.release;
if (!logic) {
  fail('release logic is missing');
} else {
  const { checkpoints = {}, timings = {}, requirements = {}, copy = {}, focus = {} } = logic;

  const progressKeys = ['triggerAt','gateHoldAt','goalWakeAt'];
  for (const key of progressKeys) {
    const value = checkpoints[key];
    if (!(Number.isFinite(value) && value > 0 && value < 1)) fail(`${key} must be between 0 and 1`);
  }

  if (!(checkpoints.triggerAt < checkpoints.gateHoldAt && checkpoints.gateHoldAt < checkpoints.goalWakeAt)) {
    fail('causal checkpoints must be ordered trigger -> gate -> goal');
  }

  if (!(timings.driveDelay < timings.gatePreloadDelay && timings.gatePreloadDelay < timings.gateOpenDelay)) {
    fail('mechanical timings must be ordered drive -> gate preload -> gate open');
  }

  if (timings.gateOpenDelay - timings.gatePreloadDelay < 250) {
    fail('gate needs a readable preload/open interval');
  }

  if (!(timings.resultDelay >= 450 && timings.resultDelay <= 900)) {
    fail('result delay must leave room for the completion beat');
  }

  for (const required of ['goal','finish']) {
    if (!Array.isArray(requirements[required]) || requirements[required].length === 0) {
      fail(`${required} requirements must be explicit`);
    }
  }

  for (const key of ['latch','rolling','trigger','waitingGate','routeOpen','reward','goal','complete']) {
    if (!copy[key]) fail(`missing status copy: ${key}`);
  }

  for (const key of ['initial','release','trigger','goal','complete']) {
    if (!focus[key]) fail(`missing camera focus target: ${key}`);
  }
}

if (!process.exitCode) {
  console.log('Machine logic check passed: release-chain causality is valid.');
}
