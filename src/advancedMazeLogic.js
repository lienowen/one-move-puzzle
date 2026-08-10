export const ADVANCED_MAZE_LOGIC = {
  hammer: {
    archetype:'maze-one-turn',
    displayName:'One-Way Loop',
    displaySubtitle:'Set the valve for the direction the ball returns',
    timings:{resultDelay:640},
    copy:{
      ready:'Trace the whole loop. Which direction will the ball reach the valve?',
      running:'Valve set. Follow the ball all the way around.',
      blocked:'The ball returned against the one-way valve.',
      open:'Correct direction. The valve opened on the return pass.',
      complete:'You predicted the return direction before the ball moved.'
    },
    maze:{
      mode:'one-way-loop',cols:5,rows:5,
      oneWay:{id:'oneWayValve',x:2,y:2,initialRotation:1,turns:[-1,1],directionByRotation:{'0':'N','2':'S'},expectedTurn:-1},
      path:[
        {x:0,y:4,id:'start'},
        {x:1,y:4},{x:2,y:4},{x:3,y:4},{x:4,y:4},
        {x:4,y:3},{x:4,y:2},{x:4,y:1},{x:4,y:0},
        {x:3,y:0},{x:2,y:0},{x:1,y:0},{x:0,y:0},
        {x:0,y:1},{x:0,y:2},{x:0,y:3},
        {x:1,y:3},{x:2,y:3},
        {x:2,y:2,id:'valve'},{x:2,y:1},{x:3,y:1,star:true},{x:3,y:2,goal:true}
      ]
    }
  },

  pulley: {
    archetype:'maze-one-turn',
    displayName:'Portal Relay',
    displaySubtitle:'Aim the exit, trigger the pad, return through the gate',
    timings:{resultDelay:650},
    copy:{
      ready:'Trace both portal exits. The gate only opens after the pressure pad.',
      running:'Exit portal locked. Follow the transfer.',
      teleport:'Transferred. Now follow the exit direction.',
      pad:'Pressure pad engaged. Gate is opening.',
      blocked:'The shortcut reached the gate before it was unlocked.',
      gate:'The same gate is open on the return route.',
      complete:'Portal, pad, return, gate. The whole relay is complete.'
    },
    maze:{
      mode:'portal-relay',cols:5,rows:5,
      portal:{
        id:'exitPortal',entry:{x:0,y:1},exit:{x:2,y:1},
        initialRotation:0,turns:[-1,1],
        routeByRotation:{'1':'direct','3':'detour'},
        expectedTurn:-1
      },
      gate:{id:'relayGate',x:3,y:2},
      pad:{id:'relayPad',x:2,y:2},
      prePath:[{x:0,y:4},{x:0,y:3},{x:0,y:2},{x:0,y:1}],
      routes:{
        direct:[{x:2,y:1},{x:3,y:1},{x:3,y:2}],
        detour:[{x:2,y:1},{x:2,y:2},{x:2,y:3},{x:3,y:3},{x:4,y:3},{x:4,y:2},{x:3,y:2},{x:3,y:1},{x:4,y:1}]
      },
      cells:[
        {x:0,y:4,type:'straight',rotation:0,start:true},
        {x:0,y:3,type:'straight',rotation:0},
        {x:0,y:2,type:'straight',rotation:0},
        {x:0,y:1,feature:'portal-entry'},
        {x:2,y:1,feature:'portal-exit'},
        {x:3,y:1,type:'tee',rotation:1},
        {x:2,y:2,type:'straight',rotation:0,feature:'pad'},
        {x:2,y:3,type:'corner',rotation:0},
        {x:3,y:3,type:'straight',rotation:1},
        {x:4,y:3,type:'corner',rotation:3},
        {x:4,y:2,type:'corner',rotation:2,star:true},
        {x:3,y:2,type:'tee',rotation:2,feature:'gate'},
        {x:4,y:1,type:'straight',rotation:1,goal:true}
      ]
    }
  }
};

export default ADVANCED_MAZE_LOGIC;
