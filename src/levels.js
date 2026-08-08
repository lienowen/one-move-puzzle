const a1 = file => new URL(`../assets/sheet01/${file}`, import.meta.url).href;
const a2 = file => new URL(`../assets/sheet02/${file}`, import.meta.url).href;

const A = {
  blueBall: a1('obj_ball_blue_1u_01.png'), metalBall: a2('obj_ball_metal_1u_01.png'),
  plank: a1('obj_plank_wood_2u_01.png'), slope: a1('obj_slope_wood_2u_01.png'),
  block: a1('obj_block_wood_1u_01.png'), breakable: a1('obj_breakable_wood_1u_01.png'),
  wall: a1('obj_wall_wood_2u_01.png'), goal: a1('goal_hole_yellow_1u_idle.png'),
  button: a1('mech_button_yellow_1u_idle.png'), spring: a1('mech_spring_orange_1u_idle.png'),
  seesaw: a1('mech_seesaw_wood_2u_01.png'), gear: a1('mech_gear_metal_1u_01.png'),
  gate: a1('mech_gate_woodmetal_2u_idle.png'), fan: a1('mech_fan_blue_1u_idle.png'),
  magnet: a1('mech_magnet_redblue_2u_01.png'), bumper: a2('mech_bumper_blue_1u_idle.png'),
  pivot: a2('mech_pivot_pin_metal_1u_01.png'), conveyor: a2('mech_conveyor_belt_2u_idle.png'),
  pressure: a2('mech_pressure_plate_blue_1u_idle.png'), trapdoor: a2('mech_trapdoor_wood_1u_idle.png'),
  portal: a2('mech_portal_blue_2u_idle.png'), key: a2('obj_key_tile_1u_01.png'), lockedGate: a2('mech_gate_locked_woodmetal_2u_idle.png'),
  arrow: a2('mech_rotating_arrow_1u_01.png'), glass: a2('obj_glass_block_1u_01.png'),
  pulley: a2('mech_rope_pulley_2u_01.png'), star: a2('collect_star_gold_1u_01.png')
};

const ball = (x,y,metal=false) => ({
  id:'ball', kind:'ball', x,y,w:10,h:8, visualW:18, shape:'circle', dynamic:true,
  asset: metal ? A.metalBall : A.blueBall, restitution:.18, friction:.025, bodyRadius:.43
});
const goal = (x,y) => ({ id:'goal', kind:'goal', x,y,w:14,h:11.2,visualW:20,sensor:true,shape:'circle',asset:A.goal,bodyRadius:.42 });
const star = (x,y) => ({ id:'star', kind:'star', x,y,w:10,h:8,visualW:14,sensor:true,shape:'circle',asset:A.star,bodyRadius:.44 });
const plank = (id,x,y,w,angle=0,interactive=false) => ({
  id,kind:'plank',x,y,w,h:5,visualW:Math.min(38, Math.max(28,w*.9)),angle,static:true,asset:A.plank,
  interactive,action:'remove',bodyScaleX:.84,bodyScaleY:.58
});
const slope = (id,x,y,w,angle=18) => ({
  id,kind:'slope',x,y,w,h:7,visualW:Math.min(40, Math.max(30,w*.92)),angle,static:true,asset:A.slope,
  bodyScaleX:.82,bodyScaleY:.54
});
const block = (id,x,y,w=10,h=8,interactive=false) => ({
  id,kind:'block',x,y,w,h,visualW:17,static:true,asset:A.block,interactive,action:'remove',bodyScaleX:.68,bodyScaleY:.64
});
const gate = (id,x,y,interactive=false) => ({
  id,kind:'gate',x,y,w:11,h:14,visualW:19,static:true,asset:A.gate,interactive,action:'remove',bodyScaleX:.62,bodyScaleY:.78
});
const bumper = (id,x,y) => ({
  id,kind:'bumper',x,y,w:12,h:9.6,visualW:17,static:true,shape:'circle',asset:A.bumper,restitution:1.15,bodyRadius:.43
});

export const levels = [
  {
    id:'release', name:'Release', solution:'support', subtitle:'Remove one support', tutorial:true,
    hint:'Remove the support. Gravity will do the rest.',
    entities:[
      ball(20,17),
      block('support',20,29,10,8,true),
      slope('ramp',36,42,38,14),
      plank('bridge',62,60,32,3),
      star(59,54),
      goal(83,74)
    ]
  },
  {
    id:'gate', name:'Open Route', solution:'gate', subtitle:'Pick the right obstacle',
    hint:'Two pieces can move. Only one opens the route.',
    entities:[
      ball(18,17,true),
      slope('ramp',35,36,34,12),
      gate('gate',53,50,true),
      block('decoy',73,34,10,8,true),
      plank('bridge',69,63,34,2),
      star(69,55),
      goal(84,75)
    ]
  },
  {
    id:'tilt', name:'Tilt', solution:'tilter', subtitle:'Change the angle once',
    hint:'One small tilt changes the entire route.',
    entities:[
      ball(21,17),
      {id:'tilter',kind:'plank',x:34,y:36,w:36,h:5,visualW:34,angle:-6,static:true,asset:A.plank,interactive:true,action:'rotate',actionValue:19,bodyScaleX:.84,bodyScaleY:.58},
      bumper('bumper',61,54),
      plank('floor',69,67,37,0),
      star(68,56),
      goal(84,76)
    ]
  },
  {
    id:'choice', name:'False Support', solution:'leftSupport', subtitle:'Two choices, one move',
    hint:'Both supports look useful. Only one preserves the line.',
    entities:[
      ball(18,17),
      block('leftSupport',24,31,9,8,true),
      block('rightSupport',55,49,9,8,true),
      slope('choiceRamp',37,42,38,15),
      plank('exitFloor',69,63,34,2),
      star(68,55),
      goal(85,74)
    ]
  },
  {
    id:'bounce', name:'Bounce', solution:'stopper', subtitle:'Trust the bumper',
    hint:'Release the ball where the bumper can redirect it.',
    entities:[
      ball(18,16),
      block('stopper',18,29,10,8,true),
      slope('ramp',34,42,32,21),
      bumper('bumper',57,57),
      star(68,47),
      goal(82,35),
      plank('catch',79,49,28,-7)
    ]
  },
  {
    id:'trapdoor', name:'Trapdoor', solution:'hatch', subtitle:'Drop through the right panel',
    hint:'Open one floor panel. The rest is timing.',
    entities:[
      ball(20,16),
      plank('upper',35,31,34,5),
      {id:'hatch',kind:'trapdoor',x:52,y:31,w:18,h:6,visualW:22,static:true,asset:A.trapdoor,interactive:true,action:'remove',bodyScaleX:.82,bodyScaleY:.55},
      block('decoy',74,31,10,8,true),
      slope('ramp',57,55,36,14),
      star(65,56),
      goal(83,74)
    ]
  },
  {
    id:'fan', name:'Air Line', solution:'stopper', subtitle:'Open the airflow',
    hint:'Clear the route and let the fan finish the shot.',
    entities:[
      ball(19,18),
      block('stopper',19,31,10,8,true),
      {id:'fan',kind:'fan',x:42,y:47,w:14,h:11.2,visualW:19,static:true,sensor:true,shape:'circle',asset:A.fan,effect:'boost',force:{x:.018,y:-.011},bodyRadius:.44},
      plank('floor',63,64,48,0),
      star(66,48),
      goal(84,56)
    ]
  },
  {
    id:'portal', name:'Shortcut', solution:'release', subtitle:'Enter the impossible route',
    hint:'One fall can exit somewhere else.',
    entities:[
      ball(18,16),
      block('release',18,29,10,8,true),
      slope('ramp',34,42,31,17),
      {id:'portalA',kind:'portal',x:54,y:60,w:14,h:11.2,visualW:19,static:true,sensor:true,shape:'circle',asset:A.portal,effect:'portal',target:'portalB',bodyRadius:.44},
      {id:'portalB',kind:'portal',x:72,y:29,w:14,h:11.2,visualW:19,static:true,sensor:true,shape:'circle',asset:A.portal,effect:'portalExit',bodyRadius:.44},
      star(74,44),
      goal(85,61)
    ]
  },
  {
    id:'key', name:'Key Run', solution:'release', subtitle:'Unlock while moving',
    hint:'The ball must collect the key before it reaches the lock.',
    entities:[
      ball(18,17,true),
      block('release',18,30,10,8,true),
      slope('ramp',37,43,38,14),
      {id:'key',kind:'key',x:54,y:53,w:10,h:8,visualW:15,static:true,sensor:true,shape:'circle',asset:A.key,effect:'key',target:'lock',bodyRadius:.44},
      {id:'lock',kind:'gate',x:68,y:58,w:11,h:14,visualW:19,static:true,asset:A.lockedGate,bodyScaleX:.62,bodyScaleY:.78},
      plank('floor',76,70,35,0),
      star(78,58),
      goal(88,76)
    ]
  },
  {
    id:'conveyor', name:'Carry', solution:'release', subtitle:'Start the chain',
    hint:'Gravity starts it. The belt carries it home.',
    entities:[
      ball(19,16),
      block('release',19,29,10,8,true),
      slope('ramp',35,41,31,18),
      {id:'belt',kind:'conveyor',x:59,y:59,w:34,h:8,visualW:34,static:true,asset:A.conveyor,effect:'conveyor',force:{x:.012,y:0},bodyScaleX:.82,bodyScaleY:.62},
      star(65,49),
      goal(85,66)
    ]
  },
  {
    id:'magnet', name:'Magnetic', solution:'release', subtitle:'Free the steel ball',
    hint:'The magnet bends a route gravity cannot.',
    entities:[
      ball(18,16,true),
      block('release',18,29,10,8,true),
      slope('ramp',34,41,31,17),
      {id:'magnet',kind:'magnet',x:63,y:46,w:18,h:14.4,visualW:22,static:true,sensor:true,shape:'circle',asset:A.magnet,effect:'magnet',bodyRadius:.44},
      star(71,47),
      goal(85,62)
    ]
  },
  {
    id:'finale', name:'One Machine', solution:'release', subtitle:'Everything you learned',
    hint:'One support wakes the entire workshop.',
    entities:[
      ball(14,15,true),
      block('release',14,28,10,8,true),
      slope('ramp1',30,40,29,19),
      bumper('bumper',48,56),
      {id:'fan',kind:'fan',x:59,y:48,w:14,h:11.2,visualW:19,static:true,sensor:true,shape:'circle',asset:A.fan,effect:'boost',force:{x:.014,y:-.009},bodyRadius:.44},
      {id:'portalA',kind:'portal',x:69,y:63,w:13,h:10.4,visualW:18,static:true,sensor:true,shape:'circle',asset:A.portal,effect:'portal',target:'portalB',bodyRadius:.44},
      {id:'portalB',kind:'portal',x:79,y:29,w:13,h:10.4,visualW:18,static:true,sensor:true,shape:'circle',asset:A.portal,effect:'portalExit',bodyRadius:.44},
      star(82,44),
      goal(89,61)
    ]
  }
];

export { A };
