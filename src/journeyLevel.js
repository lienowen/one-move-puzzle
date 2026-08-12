export const JOURNEY_LEVELS={
  release:{
    displayName:'The First Run',
    displaySubtitle:'Follow the ball and solve each machine when it blocks the route',
    copy:{
      ready:'The ball runs by itself. When a machine blocks it, work out how that machine opens.',
      complete:'Three different machines solved. Route complete.'
    },
    timings:{resultDelay:680},
    journey:{
      route:[
        {x:14,y:79},
        {x:31,y:68},
        {x:51,y:43},
        {x:73,y:59},
        {x:87,y:23}
      ],
      checkpoints:[
        {
          id:'gearLock',type:'gear-lock',panel:{x:31,y:43},
          initial:[0,1,3],target:[0,0,3],
          copy:{
            ready:'Gate 1 · These three gears are coupled. Make every blue pointer meet its brass notch.',
            thinking:'One gear changes another. Predict the coupling before the next turn.',
            solved:'Gear train synchronized. The first gate releases.'
          }
        },
        {
          id:'bridgeLock',type:'bridge-lock',panel:{x:52,y:68},
          initial:[0,0,2],target:[1,0,3],parts:['corner','straight','corner'],
          copy:{
            ready:'Gate 2 · The bridge is physically broken. Rotate the plates until the rail runs continuously from the lower-left port to the upper-right port.',
            thinking:'There is still a break in the rail. Follow the metal groove from entrance to exit.',
            solved:'The bridge is continuous. The ball can cross.'
          }
        },
        {
          id:'valveLock',type:'valve-lock',panel:{x:71,y:34},
          initial:[0,0],target:[2,1],solve:'balance',
          pressure:[[1,3,5,7],[7,5,3,1]],
          copy:{
            ready:'Gate 3 · Balance the two pressure gauges. Equal pressure releases the final gate.',
            thinking:'The gauges are still uneven. Work out which valve changes which side.',
            solved:'Pressure balanced. Final gate released.'
          }
        }
      ]
    }
  }
};

export const getJourneyLevel=id=>JOURNEY_LEVELS[id]||null;
