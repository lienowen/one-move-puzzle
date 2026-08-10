// Data-driven puzzle rules. Gameplay answers come from maze topology, not colored controls.
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
      cols:5, rows:5,
      start:{x:0,y:1,dir:'E'},
      rotators:[{id:'pivot',initialRotation:3,turns:[-1,1]}],
      expectedSolution:{id:'pivot',turn:-1},
      cells:[
        {id:'start',x:0,y:1,type:'straight',rotation:1,start:true},
        {id:'pivot',x:1,y:1,type:'corner',rotation:3},
        {id:'pit',x:1,y:0,hazard:true},
        {id:'down',x:1,y:2,type:'straight',rotation:0},
        {id:'turn',x:1,y:3,type:'corner',rotation:0},
        {id:'run1',x:2,y:3,type:'straight',rotation:1},
        {id:'starCell',x:3,y:3,type:'straight',rotation:1,star:true},
        {id:'goalCell',x:4,y:3,type:'straight',rotation:1,goal:true},
        {id:'deadDecor1',x:3,y:1,type:'corner',rotation:1},
        {id:'deadDecor2',x:4,y:1,type:'straight',rotation:0},
      ],
    },
  },

  gate: {
    archetype: 'maze-one-turn',
    displayName: 'Two Corners',
    displaySubtitle: 'Two movable tiles. Only one should change',
    timings: { resultDelay:560 },
    copy: {
      ready:'Two corners can move. Trace both outcomes first.',
      running:'Decision locked. Follow the ball.',
      complete:'You fixed the only broken corner.',
      pit:'The unchanged route still leads to the pit.',
      wrong:'That corner was already doing its job.',
    },
    maze: {
      cols:5, rows:5,
      start:{x:0,y:2,dir:'E'},
      rotators:[
        {id:'pivotA',initialRotation:3,turns:[-1,1]},
        {id:'pivotB',initialRotation:2,turns:[-1,1]},
      ],
      expectedSolution:{id:'pivotA',turn:-1},
      cells:[
        {id:'start',x:0,y:2,type:'straight',rotation:1,start:true},
        {id:'pivotA',x:1,y:2,type:'corner',rotation:3},
        {id:'pitA',x:1,y:1,hazard:true},
        {id:'turnA',x:1,y:3,type:'corner',rotation:0},
        {id:'runA',x:2,y:3,type:'straight',rotation:1,star:true},
        {id:'pivotB',x:3,y:3,type:'corner',rotation:2},
        {id:'turnB',x:3,y:4,type:'corner',rotation:0},
        {id:'goalCell',x:4,y:4,type:'straight',rotation:1,goal:true},
        {id:'deadDecor1',x:3,y:1,type:'straight',rotation:1},
        {id:'deadDecor2',x:4,y:1,type:'corner',rotation:2},
      ],
    },
  },

  switch: {
    archetype: 'maze-one-turn',
    displayName: 'Pad Before Gate',
    displaySubtitle: 'Route the ball to unlock the gate first',
    timings: { resultDelay:620 },
    copy: {
      ready:'The gate is closed. Find a route that opens it first.',
      running:'Route committed. Watch the order of events.',
      pad:'Pressure pad engaged.',
      gate:'Gate unlocked.',
      complete:'Correct order. Pad first, gate second.',
      pit:'That turn sends the ball away from the mechanism.',
      blocked:'The ball reached the gate before opening it.',
      wrong:'The route breaks before the goal.',
    },
    maze: {
      cols:5, rows:5,
      start:{x:0,y:2,dir:'E'},
      rotators:[{id:'pivot',initialRotation:2,turns:[-1,1]}],
      expectedSolution:{id:'pivot',turn:-1},
      cells:[
        {id:'start',x:0,y:2,type:'straight',rotation:1,start:true},
        {
          id:'pivot',x:1,y:2,type:'tee',rotation:2,
          exitByRotation:{
            '1':{W:'S'},
            '2':{W:'N'},
            '3':{W:'E'},
          },
        },
        {id:'pit',x:1,y:1,hazard:true},
        {id:'down',x:1,y:3,type:'straight',rotation:0},
        {id:'turnBottom',x:1,y:4,type:'corner',rotation:0},
        {id:'turnUp',x:2,y:4,type:'corner',rotation:3},
        {id:'pad',x:2,y:3,type:'straight',rotation:0,feature:'pad',opens:['mainGate']},
        {
          id:'mainGate',x:2,y:2,type:'tee',rotation:1,feature:'gate',gateId:'mainGate',
          exitMap:{W:'E',S:'E'},
        },
        {id:'reward',x:3,y:2,type:'straight',rotation:1,star:true},
        {id:'goalCell',x:4,y:2,type:'straight',rotation:1,goal:true},
      ],
    },
  },

  button: {
    archetype: 'maze-one-turn',
    displayName: 'Three-Way Turn',
    displaySubtitle: 'Trace the long route before rotating the junction',
    timings: { resultDelay:590 },
    copy: {
      ready:'The goal is far away. Trace the branches before you turn the T-junction.',
      running:'Junction locked. Follow the route.',
      complete:'You found the only branch that reaches the goal.',
      pit:'That branch runs straight into the pit.',
      wrong:'The junction no longer accepts the incoming rail.',
    },
    maze: {
      cols:5, rows:5,
      start:{x:2,y:4,dir:'N'},
      rotators:[{id:'pivot',initialRotation:0,turns:[-1,1]}],
      expectedSolution:{id:'pivot',turn:1},
      cells:[
        {id:'start',x:2,y:4,type:'straight',rotation:0,start:true},
        {
          id:'pivot',x:2,y:3,type:'tee',rotation:0,
          exitByRotation:{
            '0':{S:'E'},
            '1':{S:'W'},
          },
        },
        {id:'wrongRun',x:3,y:3,type:'straight',rotation:1},
        {id:'pit',x:4,y:3,hazard:true},
        {id:'leftTurn',x:1,y:3,type:'corner',rotation:0},
        {id:'leftRise',x:1,y:2,type:'straight',rotation:0},
        {id:'topTurn',x:1,y:1,type:'corner',rotation:1},
        {id:'reward',x:2,y:1,type:'straight',rotation:1,star:true},
        {id:'topRun',x:3,y:1,type:'straight',rotation:1},
        {id:'goalCell',x:4,y:1,type:'straight',rotation:1,goal:true},
      ],
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
