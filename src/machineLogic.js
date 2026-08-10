// Data-driven causal rules for authored machines.
// The runtime owns presentation; this file owns why the machine is allowed to advance.

export const MACHINE_LOGIC = {
  release: {
    archetype: 'release-chain',
    checkpoints: {
      triggerAt: .34,
      gateHoldAt: .486,
      goalWakeAt: .83,
    },
    timings: {
      driveDelay: 90,
      gatePreloadDelay: 250,
      gateOpenDelay: 760,
      resultDelay: 620,
    },
    requirements: {
      goal: ['star'],
      finish: ['gateOpen', 'star', 'goalAwake'],
    },
    copy: {
      latch: 'Latch released.',
      rolling: 'Ball released.',
      trigger: 'Pressure ring engaged.',
      waitingGate: 'Drive opening the gate…',
      routeOpen: 'Route unlocked.',
      reward: 'Energy captured.',
      goal: 'Receiver charged.',
      complete: 'Machine complete.',
    },
    focus: {
      initial: 'start',
      release: 'route',
      trigger: 'drive',
      goal: 'goal',
      complete: 'complete',
    },
  },
};

export function getMachineLogic(levelId) {
  return MACHINE_LOGIC[levelId] || null;
}

export function machineRequirementsMet(state, requirements = []) {
  return requirements.every(key => Boolean(state?.[key]));
}

export function machineRequirementMissing(state, requirements = []) {
  return requirements.find(key => !state?.[key]) || null;
}
