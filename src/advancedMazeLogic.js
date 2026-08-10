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
      oneWay:{
        id:'oneWayValve',x:2,y:2,
        initialRotation:1,turns:[-1,1],
        directionByRotation:{'0':'N','2':'S'},
        expectedTurn:-1
      },
      path:[
        {x:0,y:4,id:'start'},
        {x:1,y:4},{x:2,y:4},{x:3,y:4},{x:4,y:4},
        {x:4,y:3},{x:4,y:2},{x:4,y:1},{x:4,y:0},
        {x:3,y:0},{x:2,y:0},{x:1,y:0},{x:0,y:0},
        {x:0,y:1},{x:0,y:2},{x:0,y:3},
        {x:1,y:3},{x:2,y:3},
        {x:2,y:2,id:'valve'},
        {x:2,y:1},
        {x:3,y:1,star:true},
        {x:3,y:2,goal:true}
      ]
    }
  }
};

export default ADVANCED_MAZE_LOGIC;
