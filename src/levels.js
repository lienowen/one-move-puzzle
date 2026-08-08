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

const ball = (x,y,metal=false) => ({ id:'ball', kind:'ball', x,y,w:9,h:9, shape:'circle', dynamic:true, asset: metal ? A.metalBall : A.blueBall, restitution:.22, friction:.02 });
const goal = (x,y) => ({ id:'goal', kind:'goal', x,y,w:13,h:13, sensor:true, shape:'circle', asset:A.goal });
const star = (x,y) => ({ id:'star', kind:'star', x,y,w:8,h:8, sensor:true, shape:'circle', asset:A.star });
const plank = (id,x,y,w,angle=0,interactive=false) => ({ id, kind:'plank', x,y,w,h:4.5,angle,static:true,asset:A.plank,interactive,action:'remove' });
const slope = (id,x,y,w,angle=18) => ({ id, kind:'slope', x,y,w,h:5,angle,static:true,asset:A.slope });
const block = (id,x,y,w=9,h=9,interactive=false) => ({ id,kind:'block',x,y,w,h,static:true,asset:A.block,interactive,action:'remove' });
const gate = (id,x,y,interactive=false) => ({ id,kind:'gate',x,y,w:9,h:19,static:true,asset:A.gate,interactive,action:'remove' });
const bumper = (id,x,y) => ({ id,kind:'bumper',x,y,w:11,h:11,static:true,shape:'circle',asset:A.bumper,restitution:1.25 });

export const levels = [
  {
    id:'release', name:'Release', solution:'support', subtitle:'Remove one support', tutorial:true,
    hint:'One move. Choose the piece that sets gravity free.',
    entities:[ball(22,20), block('support',22,33,10,9,true), slope('ramp',43,48,42,17), plank('floor',66,67,28,4), star(61,57), goal(86,74)]
  },
  {
    id:'gate', name:'Open Route', solution:'gate', subtitle:'Pick the right obstacle',
    hint:'Only one gate is stopping the path.',
    entities:[ball(18,20,true), slope('ramp',36,35,38,13), gate('gate',55,50,true), block('decoy',76,31,9,9,true), plank('floor',69,68,27,2), star(70,59), goal(88,75)]
  },
  {
    id:'tilt', name:'Tilt', solution:'tilter', subtitle:'Change the angle once',
    hint:'A tiny angle can change the whole route.',
    entities:[ball(23,21), {id:'tilter',kind:'plank',x:34,y:38,w:36,h:5,angle:-5,static:true,asset:A.plank,interactive:true,action:'rotate',actionValue:18}, bumper('bumper',63,55), plank('floor',72,69,40,0), star(70,56), goal(86,75)]
  },
  {
    id:'choice', name:'False Support', solution:'leftSupport', subtitle:'Two choices, one move',
    hint:'Removing the wrong support ruins the line.',
    entities:[ball(18,20,true), slope('choiceRamp',39,43,45,16), block('leftSupport',29,37,8,9,true), block('rightSupport',58,54,8,9,true), plank('exitFloor',70,68,25,1), star(70,58), goal(88,74)]
  },
  {
    id:'bounce', name:'Bounce', solution:'stopper', subtitle:'Trust the bumper',
    hint:'Release the ball where the bounce can save it.',
    entities:[ball(18,18), block('stopper',18,31,10,9,true), slope('ramp',35,45,33,24), bumper('bumper',59,59), star(70,50), goal(83,36), plank('catch',80,50,26,-8)]
  },
  {
    id:'trapdoor', name:'Trapdoor', solution:'hatch', subtitle:'Drop at the right moment',
    hint:'Open exactly one floor panel.',
    entities:[ball(20,18,true), plank('upper',34,32,35,7), {id:'hatch',kind:'trapdoor',x:52,y:32,w:18,h:6,static:true,asset:A.trapdoor,interactive:true,action:'remove'}, block('decoy',73,32,9,9,true), slope('ramp',56,57,36,16), star(66,59), goal(84,73)]
  },
  {
    id:'fan', name:'Air Line', solution:'stopper', subtitle:'Open the airflow',
    hint:'The fan only needs a clear shot.',
    entities:[ball(19,22), block('stopper',19,35,9,9,true), {id:'fan',kind:'fan',x:43,y:49,w:15,h:15,static:true,sensor:true,asset:A.fan,effect:'boost',force:{x:.018,y:-.011}}, plank('floor',63,69,52,0), star(66,50), goal(85,55)]
  },
  {
    id:'portal', name:'Shortcut', solution:'release', subtitle:'Enter the impossible route',
    hint:'A portal turns one fall into two places.',
    entities:[ball(18,18), block('release',18,31,9,9,true), slope('ramp',34,46,30,18), {id:'portalA',kind:'portal',x:54,y:62,w:14,h:14,static:true,sensor:true,asset:A.portal,effect:'portal',target:'portalB'}, {id:'portalB',kind:'portal',x:72,y:30,w:14,h:14,static:true,sensor:true,asset:A.portal,effect:'portalExit'}, star(74,45), goal(86,60)]
  },
  {
    id:'key', name:'Key Run', solution:'release', subtitle:'Let the ball unlock itself',
    hint:'Release the route through the key.',
    entities:[ball(18,19,true), block('release',18,32,9,9,true), slope('ramp',37,46,38,15), {id:'key',kind:'key',x:54,y:55,w:10,h:10,static:true,sensor:true,asset:A.key,effect:'key',target:'lock'}, {id:'lock',kind:'gate',x:68,y:59,w:10,h:21,static:true,asset:A.lockedGate}, plank('floor',76,72,35,0), star(78,60), goal(89,76)]
  },
  {
    id:'conveyor', name:'Carry', solution:'release', subtitle:'Start the chain',
    hint:'The belt can finish what gravity starts.',
    entities:[ball(19,18), block('release',19,31,9,9,true), slope('ramp',35,44,30,20), {id:'belt',kind:'conveyor',x:59,y:61,w:35,h:9,static:true,asset:A.conveyor,effect:'conveyor',force:{x:.012,y:0}}, star(66,51), goal(86,66)]
  },
  {
    id:'magnet', name:'Magnetic', solution:'release', subtitle:'Free the steel ball',
    hint:'Metal has a different idea of straight.',
    entities:[ball(18,18,true), block('release',18,31,9,9,true), slope('ramp',34,44,31,18), {id:'magnet',kind:'magnet',x:64,y:47,w:18,h:18,static:true,sensor:true,asset:A.magnet,effect:'magnet'}, star(72,48), goal(86,62)]
  },
  {
    id:'finale', name:'One Machine', solution:'release', subtitle:'Everything you learned',
    hint:'One support starts the whole machine.',
    entities:[ball(14,17,true), block('release',14,30,9,9,true), slope('ramp1',30,43,28,20), bumper('bumper',49,58), {id:'fan',kind:'fan',x:59,y:50,w:14,h:14,static:true,sensor:true,asset:A.fan,effect:'boost',force:{x:.014,y:-.009}}, {id:'portalA',kind:'portal',x:69,y:65,w:13,h:13,static:true,sensor:true,asset:A.portal,effect:'portal',target:'portalB'}, {id:'portalB',kind:'portal',x:79,y:31,w:13,h:13,static:true,sensor:true,asset:A.portal,effect:'portalExit'}, star(83,45), goal(89,62)]
  }
];

export { A };
