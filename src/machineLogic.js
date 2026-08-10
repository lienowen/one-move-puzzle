// Data-driven causal rules for authored machines.
// The runtime owns presentation; this file owns why the machine is allowed to advance.

export const MACHINE_LOGIC = {
  release: {
    archetype: 'release-chain',
    checkpoints: { triggerAt:.34, gateHoldAt:.486, goalWakeAt:.83 },
    timings: { driveDelay:90, gatePreloadDelay:250, gateOpenDelay:760, resultDelay:620 },
    requirements: { goal:['star'], finish:['gateOpen','star','goalAwake'] },
    copy: {
      latch:'Latch released.', rolling:'Ball released.', trigger:'Pressure ring engaged.',
      waitingGate:'Drive opening the gate…', routeOpen:'Route unlocked.', reward:'Energy captured.',
      goal:'Receiver charged.', complete:'Machine complete.',
    },
    focus: { initial:'start', release:'route', trigger:'drive', goal:'goal', complete:'complete' },
  },

  gate: {
    archetype: 'choice-gate',
    controls: { correct:'blueLever', decoy:'redLever', target:'gate' },
    timings: { driveDelay:120, gateOpenDelay:430, ballReleaseDelay:620, resultDelay:420 },
    requirements: { finish:['gateOpen'] },
    copy: {
      ready:'Trace the linkage.', correct:'Linkage engaged.', gate:'Gate open. Route clear.',
      wrong:'Dead linkage. Route blocked.',
    },
  },

  switch: {
    archetype: 'route-align',
    controls: { correct:'crank', decoy:'wheel', target:'spinner' },
    timings: { shaftDelay:90, alignDelay:470, ballReleaseDelay:690, resultDelay:430 },
    requirements: { finish:['routeAligned'] },
    copy: {
      ready:'Find what controls the broken bridge.',
      correct:'Crank driving the bridge.',
      aligned:'Bridge aligned. Route restored.',
      wrong:'Valve turned. The bridge is still misaligned.',
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
