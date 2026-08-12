export const JOURNEY_LEVELS={
  release:{
    displayName:'Three Locks',
    displaySubtitle:'Follow the ball and solve every machine in its path',
    copy:{
      ready:'The ball moves on its own. Solve each lock when it reaches you.',
      complete:'All three locks cleared. The machine is open.'
    },
    timings:{resultDelay:680},
    journey:{
      route:[
        {x:15,y:78},
        {x:31,y:64},
        {x:52,y:48},
        {x:73,y:31},
        {x:87,y:18}
      ],
      checkpoints:[
        {
          id:'gearLock',type:'gear-lock',initial:[0,1,3],target:[1,3,0],
          copy:{
            ready:'Gate 1 · The gears are linked. Align all three blue pointers with the brass marks.',
            thinking:'Turning one gear moves its neighbour too. Read the coupling.',
            solved:'Gear train aligned. Gate 1 released.'
          }
        },
        {
          id:'bridgeLock',type:'bridge-lock',initial:[0,1,2],target:[1,1,3],
          copy:{
            ready:'Gate 2 · Rebuild the broken bridge before the ball can cross.',
            thinking:'The bridge still breaks between two plates.',
            solved:'Bridge aligned. Gate 2 released.'
          }
        },
        {
          id:'valveLock',type:'valve-lock',initial:[0,2],target:[1,3],
          copy:{
            ready:'Gate 3 · Route pressure through both valves to unlock the final gate.',
            thinking:'Pressure cannot pass both valves yet.',
            solved:'Pressure line is open. Final gate released.'
          }
        }
      ]
    }
  }
};

export const getJourneyLevel=id=>JOURNEY_LEVELS[id]||null;
