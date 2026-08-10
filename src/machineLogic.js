// Data-driven causal rules for authored machines.
// The runtime owns presentation; this file owns why the machine is allowed to advance.

export const MACHINE_LOGIC = {
  release: {
    archetype: 'maze-one-turn',
    displayName: 'Turn the Corner',
    displaySubtitle: 'Rotate one tile, then watch the maze run',
    timings: { resultDelay:560 },
    copy: {
      ready:'Study the whole route before you move.',
      running:'Route set. Watch the machine.',
      complete:'Perfect route.',
      pit:'The ball found the pit.',
      wrong:'That route does not connect.',
    },
    maze: {
      cols:5,
      rows:5,
      start:{x:0,y:1,dir:'E'},
      pivot:{id:'pivot',initialRotation:3,targetRotation:2},
      cells:[
        {id:'start',x:0,y:1,type:'straight',rotation:1,start:true},
        {id:'pivot',x:1,y:1,type:'corner',rotation:3},
        {id:'pit',x:1,y:0,hazard:true},
        {id:'down',x:1,y:2,type:'straight',rotation:0},
        {id:'turn',x:1,y:3,type:'corner',rotation:0},
        {id:'run1',x:2,y:3,type:'straight',rotation:1},
        {id:'starCell',x:3,y:3,type:'straight',rotation:1,star:true},
        {id:'goalCell',x:4,y:3,type:'goal',rotation:0,goal:true},
        {id:'deadDecor1',x:3,y:1,type:'corner',rotation:1},
        {id:'deadDecor2',x:4,y:1,type:'straight',rotation:0},
      ],
    },
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

  button: {
    archetype: 'signal-match',
    controls: { correct:'greenButton', decoy:'yellowButton', target:'gate' },
    signal: { required:'circle', correct:'circle', decoy:'triangle' },
    timings: { pulseDelay:80, receiverDelay:390, gateOpenDelay:620, ballReleaseDelay:830, resultDelay:440 },
    requirements: { finish:['signalMatched','gateOpen'] },
    copy: {
      ready:'Read the receiver signal.',
      correct:'Matching signal sent.',
      receiver:'Receiver matched.',
      gate:'Signal accepted. Gate open.',
      wrong:'Wrong signal. Receiver rejected it.',
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
