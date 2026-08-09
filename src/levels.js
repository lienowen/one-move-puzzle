import { WORKSHOP_ASSETS as W } from './workshopAssets.js';

const p = (id, kind, asset, x, y, w, extra = {}) => ({ id, kind, asset, x, y, w, ...extra });
const control = (id, kind, asset, x, y, w, action, extra = {}) => p(id, kind, asset, x, y, w, { interactive:true, action, ...extra });
const holder = (x,y,w=16) => p('holder','holder',W.pins.ballHolder,x,y,w,{z:16});
const ball = (x,y,steel=false,w=8.5) => p('ball','ball',steel ? W.goals.ballSteel : W.goals.ballBlue,x,y,w,{z:42});
const star = (x,y,w=8) => p('star','star',W.goals.star,x,y,w,{z:34});
const goal = (x,y) => [
  p('goalSocket','goal-socket',W.goals.goalSocket,x,y,15,{z:20}),
  p('goal','goal',W.goals.goalYellow,x,y,9.4,{z:24}),
];
const decor = (id, asset, x, y, w, extra={}) => p(id,'decor',asset,x,y,w,{z:5,...extra});
const activate = (id, at, x, y, sound='metal') => ({type:'activate',id,at,x,y,sound});
const starEvent = (at,x,y) => ({type:'star',id:'star',at,x,y,sound:'star'});
const goalEvent = (at,x,y) => ({type:'goal',id:'goal',at,x,y,sound:'goal'});

export const levels = [
  {
    id:'release', name:'Pull the Pin', subtitle:'Release the first machine', icon:W.pins.pinBlue,
    solution:'pin', hint:'Pull the blue pin.', status:'One move starts everything.', tutorial:true,
    scene:{
      board:W.base.boardWorkshopBase, duration:3900, joints:[.24,.49,.74],
      pieces:[
        holder(23,19,17),
        p('pinSocket','pin-socket',W.pins.pinSocket,22,30,8,{z:18}),
        control('pin','pin',W.pins.pinBlue,17.5,30,21,'pull',{z:32,label:'Pull the blue pin'}),
        decor('gear',W.mechanisms.gear,78,20,9),
        star(49,60), ...goal(77,79), ball(23,19)
      ],
      path:[{x:23,y:19},{x:25,y:27},{x:34,y:33},{x:46,y:39},{x:52,y:49},{x:47,y:59},{x:54,y:68},{x:66,y:72},{x:77,y:79}],
      events:[starEvent(.64,49,60),goalEvent(.96,77,79)]
    }
  },
  {
    id:'gate', name:'Open Route', subtitle:'Choose the lever that clears the path', icon:W.mechanisms.gateSlider,
    solution:'blueLever', hint:'One lever opens the route.', status:'Choose one lever.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4050, joints:[.2,.43,.72],
      pieces:[
        holder(20,21),
        control('blueLever','lever',W.mechanisms.leverBlue,20,77,12,'flip',{z:30,label:'Blue lever'}),
        control('redLever','lever',W.mechanisms.leverRed,80,24,12,'flip',{z:30,label:'Red lever'}),
        p('gate','gate',W.mechanisms.gateSlider,53,48,14,{z:26}),
        decor('gear',W.mechanisms.gear,78,77,9),
        star(66,60), ...goal(81,74), ball(20,21)
      ],
      path:[{x:20,y:21},{x:27,y:29},{x:38,y:34},{x:49,y:42},{x:54,y:49},{x:61,y:56},{x:70,y:62},{x:81,y:74}],
      events:[activate('gate',.42,53,48),starEvent(.72,66,60),goalEvent(.96,81,74)]
    }
  },
  {
    id:'switch', name:'Turn the Switch', subtitle:'Rotate one piece to complete the line', icon:W.mechanisms.crankHandle,
    solution:'crank', hint:'Turn the control that aligns the route.', status:'One turn changes the machine.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4200, joints:[.18,.47,.78],
      pieces:[
        holder(20,76),
        control('crank','crank',W.mechanisms.crankHandle,22,22,12,'turn',{z:30,label:'Crank handle'}),
        control('wheel','wheel',W.mechanisms.wheelValve,79,77,11,'turn',{z:30,label:'Valve wheel'}),
        p('spinner','spinner',W.tracks.trackSpinnerSwitch,52,48,13,{z:24}),
        star(67,34), ...goal(81,23), ball(20,76)
      ],
      path:[{x:20,y:76},{x:27,y:68},{x:37,y:60},{x:47,y:53},{x:53,y:47},{x:60,y:40},{x:68,y:33},{x:81,y:23}],
      events:[activate('spinner',.48,52,48),starEvent(.74,67,34),goalEvent(.96,81,23)]
    }
  },
  {
    id:'button', name:'Green Means Go', subtitle:'Press the right control', icon:W.mechanisms.buttonGreen,
    solution:'greenButton', hint:'Only one button opens the gate.', status:'Pick a button.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4000, joints:[.26,.54,.78],
      pieces:[
        holder(20,21),
        control('greenButton','button',W.mechanisms.buttonGreen,21,78,11,'press',{z:30,label:'Green button'}),
        control('yellowButton','button',W.mechanisms.buttonYellow,79,22,11,'press',{z:30,label:'Yellow button'}),
        p('gate','gate',W.mechanisms.gateLockedRound,54,49,14,{z:26}),
        star(70,60), ...goal(81,74), ball(20,21)
      ],
      path:[{x:20,y:21},{x:28,y:30},{x:40,y:36},{x:50,y:44},{x:55,y:50},{x:62,y:55},{x:70,y:61},{x:81,y:74}],
      events:[activate('gate',.45,54,49),starEvent(.74,70,60),goalEvent(.96,81,74)]
    }
  },
  {
    id:'spring', name:'Spring Step', subtitle:'Wake the only useful bumper', icon:W.mechanisms.springPadSmall,
    solution:'spring', hint:'Tap the spring that keeps the chain alive.', status:'Choose one launcher.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4150, joints:[.21,.51,.8],
      pieces:[
        holder(20,23),
        control('spring','spring',W.mechanisms.springPadSmall,49,50,12,'press',{z:29,label:'Spring pad'}),
        control('decoyBumper','bumper',W.mechanisms.bumperTriangle,79,23,11,'press',{z:29,label:'Triangle bumper'}),
        star(70,57), ...goal(81,74), ball(20,23)
      ],
      path:[{x:20,y:23},{x:29,y:30},{x:39,y:39},{x:48,y:49},{x:54,y:43},{x:62,y:48},{x:70,y:57},{x:81,y:74}],
      events:[activate('spring',.47,49,50,'wood'),starEvent(.73,70,57),goalEvent(.96,81,74)]
    }
  },
  {
    id:'conveyor', name:'Carry', subtitle:'Power the belt with one move', icon:W.mechanisms.conveyor,
    solution:'beltButton', hint:'Start the belt.', status:'One control powers the route.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4200, joints:[.22,.5,.82],
      pieces:[
        holder(20,22),
        control('beltButton','button',W.mechanisms.buttonYellow,20,77,11,'press',{z:30,label:'Belt button'}),
        control('redLever','lever',W.mechanisms.leverRed,80,23,11,'flip',{z:30,label:'Red lever'}),
        p('belt','conveyor',W.mechanisms.conveyor,53,56,18,{z:25}),
        star(69,61), ...goal(81,73), ball(20,22)
      ],
      path:[{x:20,y:22},{x:28,y:31},{x:38,y:41},{x:47,y:52},{x:56,y:57},{x:66,y:59},{x:72,y:63},{x:81,y:73}],
      events:[activate('belt',.5,53,56),starEvent(.76,69,61),goalEvent(.96,81,73)]
    }
  },
  {
    id:'magnet', name:'Magnetic', subtitle:'Guide the steel ball', icon:W.mechanisms.magnet,
    solution:'blueLever', hint:'Power the magnet.', status:'Metal follows the right field.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4300, joints:[.2,.46,.77],
      pieces:[
        holder(20,75),
        control('blueLever','lever',W.mechanisms.leverBlue,20,22,11,'flip',{z:30,label:'Blue lever'}),
        control('redLever','lever',W.mechanisms.leverRed,80,77,11,'flip',{z:30,label:'Red lever'}),
        p('magnet','magnet',W.mechanisms.magnet,56,43,16,{z:25}),
        star(69,45), ...goal(81,27), ball(20,75,true)
      ],
      path:[{x:20,y:75},{x:28,y:67},{x:38,y:58},{x:49,y:49},{x:56,y:43},{x:64,y:45},{x:70,y:43},{x:81,y:27}],
      events:[activate('magnet',.51,56,43),starEvent(.76,69,45),goalEvent(.96,81,27)]
    }
  },
  {
    id:'fan', name:'Air Line', subtitle:'Start the airflow', icon:W.mechanisms.fan,
    solution:'greenButton', hint:'Start the fan.', status:'One button wakes the airflow.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4100, joints:[.21,.5,.78],
      pieces:[
        holder(20,22),
        control('greenButton','button',W.mechanisms.buttonGreen,21,77,11,'press',{z:30,label:'Green button'}),
        control('yellowButton','button',W.mechanisms.buttonYellow,79,22,11,'press',{z:30,label:'Yellow button'}),
        p('fan','fan',W.mechanisms.fan,51,51,15,{z:25}),
        star(65,62), ...goal(80,75), ball(20,22)
      ],
      path:[{x:20,y:22},{x:28,y:30},{x:38,y:39},{x:48,y:49},{x:54,y:54},{x:63,y:61},{x:70,y:66},{x:80,y:75}],
      events:[activate('fan',.5,51,51),starEvent(.73,65,62),goalEvent(.96,80,75)]
    }
  },
  {
    id:'hammer', name:'Strike Once', subtitle:'Set the hammer in motion', icon:W.mechanisms.hammerStriker,
    solution:'crank', hint:'Turn the crank.', status:'One turn starts the strike.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4250, joints:[.22,.52,.78],
      pieces:[
        holder(20,75),
        control('crank','crank',W.mechanisms.crankHandle,21,22,12,'turn',{z:30,label:'Crank handle'}),
        control('button','button',W.mechanisms.buttonYellow,80,76,11,'press',{z:30,label:'Yellow button'}),
        p('hammer','hammer',W.mechanisms.hammerStriker,51,49,15,{z:26}),
        star(67,40), ...goal(81,25), ball(20,75)
      ],
      path:[{x:20,y:75},{x:29,y:67},{x:39,y:58},{x:49,y:50},{x:56,y:46},{x:66,y:40},{x:72,y:34},{x:81,y:25}],
      events:[activate('hammer',.5,51,49,'wood'),starEvent(.74,67,40),goalEvent(.96,81,25)]
    }
  },
  {
    id:'pulley', name:'Lift the Line', subtitle:'Choose the pulley that opens the way', icon:W.mechanisms.pulleySingle,
    solution:'singlePulley', hint:'Turn the correct pulley.', status:'Choose one pulley.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4300, joints:[.2,.46,.76],
      pieces:[
        holder(20,22),
        control('singlePulley','pulley',W.mechanisms.pulleySingle,21,76,12,'turn',{z:30,label:'Single pulley'}),
        control('doublePulley','pulley',W.mechanisms.pulleyDouble,80,23,13,'turn',{z:30,label:'Double pulley'}),
        p('gate','gate',W.mechanisms.gateSlider,53,49,13,{z:25}),
        decor('chain',W.hardware.chainShort,57,32,10,{rotation:90}),
        star(68,61), ...goal(81,74), ball(20,22)
      ],
      path:[{x:20,y:22},{x:28,y:30},{x:38,y:38},{x:48,y:46},{x:54,y:50},{x:61,y:56},{x:69,y:62},{x:81,y:74}],
      events:[activate('singlePulley',.28,21,76),activate('gate',.47,53,49),starEvent(.75,68,61),goalEvent(.96,81,74)]
    }
  },
  {
    id:'double-gate', name:'Clean Exit', subtitle:'Open only the useful gate', icon:W.mechanisms.gateLockedRound,
    solution:'blueLever', hint:'Choose the lever that opens the lower gate.', status:'Two controls. One clean route.',
    scene:{
      board:W.base.boardWorkshopBase, duration:4300, joints:[.19,.43,.7,.84],
      pieces:[
        holder(20,21),
        control('blueLever','lever',W.mechanisms.leverBlue,20,77,11,'flip',{z:31,label:'Blue lever'}),
        control('redLever','lever',W.mechanisms.leverRed,80,22,11,'flip',{z:31,label:'Red lever'}),
        p('lowerGate','gate',W.mechanisms.gateSlider,57,57,13,{z:25}),
        decor('upperGate',W.mechanisms.gateLockedRound,67,32,11),
        star(69,64), ...goal(81,76), ball(20,21)
      ],
      path:[{x:20,y:21},{x:29,y:29},{x:39,y:38},{x:49,y:48},{x:57,y:57},{x:64,y:62},{x:70,y:66},{x:81,y:76}],
      events:[activate('lowerGate',.52,57,57),starEvent(.76,69,64),goalEvent(.96,81,76)]
    }
  },
  {
    id:'finale', name:'One Machine', subtitle:'Everything works from one decision', icon:W.mechanisms.wheelValve,
    solution:'valve', hint:'Find the one control that wakes the whole machine.', status:'One move. Full chain.',
    scene:{
      board:W.base.boardWorkshopBase, duration:5000, joints:[.15,.34,.56,.78],
      pieces:[
        holder(18,75),
        control('valve','wheel',W.mechanisms.wheelValve,20,21,12,'turn',{z:32,label:'Valve wheel'}),
        control('redLever','lever',W.mechanisms.leverRed,80,76,11,'flip',{z:32,label:'Red lever'}),
        control('yellowButton','button',W.mechanisms.buttonYellow,79,22,10,'press',{z:32,label:'Yellow button'}),
        p('gear','gear',W.mechanisms.gear,39,58,12,{z:25}),
        p('spring','spring',W.mechanisms.springPadSmall,51,48,11,{z:25}),
        p('fan','fan',W.mechanisms.fan,62,40,13,{z:25}),
        p('gate','gate',W.mechanisms.gateSlider,70,32,12,{z:25}),
        star(70,29), ...goal(82,20), ball(18,75,true)
      ],
      path:[{x:18,y:75},{x:28,y:68},{x:39,y:58},{x:49,y:49},{x:56,y:45},{x:63,y:39},{x:70,y:32},{x:76,y:26},{x:82,y:20}],
      events:[
        activate('gear',.30,39,58),activate('spring',.48,51,48,'wood'),activate('fan',.63,62,40),activate('gate',.78,70,32),starEvent(.82,70,29),goalEvent(.97,82,20)
      ]
    }
  }
];
