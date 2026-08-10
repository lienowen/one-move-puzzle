import { MACHINE_LOGIC } from '../src/machineLogic.js';

const logic=MACHINE_LOGIC.magnet,errors=[];
const fail=m=>errors.push(m);
const D=['N','E','S','W'],S={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]},O={N:'S',E:'W',S:'N',W:'E'};
const BASE={straight:['N','S'],corner:['N','E'],tee:['N','E','S'],cross:['N','E','S','W']};
const norm=v=>((v%4)+4)%4;

if(!logic?.maze||logic.maze.mode!=='magnet-field')fail('magnet: must use magnet-field mode');
const maze=logic?.maze||{},field=maze.field||{},cells=maze.cells||[];
const map=new Map(cells.map(c=>[`${c.x},${c.y}`,c]));
const target=cells.find(c=>c.id===field.targetId);
if(!field.id||!target)fail('magnet: field control and target junction are required');
if(!Number.isInteger(field.x)||!Number.isInteger(field.y)||field.x<0||field.x>=maze.cols||field.y<0||field.y>=maze.rows)fail('magnet: field control must sit inside the maze grid');
if(!Array.isArray(field.turns)||field.turns.length!==2||!field.turns.includes(-1)||!field.turns.includes(1))fail('magnet: field must allow exactly one quarter-turn left or right');
if(!cells.some(c=>c.star)||!cells.some(c=>c.goal)||!cells.some(c=>c.hazard))fail('magnet: star, goal and visible pit are all required');
if(!target||!['tee','cross'].includes(target.type))fail('magnet: target must be a branching rail');

function links(c){return(BASE[c.type]||[]).map(d=>D[(D.indexOf(d)+(c.rotation||0))%4]);}
function solve(rotation){
  const path=[];let x=maze.start.x,y=maze.start.y,dir=maze.start.dir;const seen=new Set();
  for(let i=0;i<64;i++){
    const state=`${x},${y},${dir}`;if(seen.has(state))return{success:false,reason:'loop',path};seen.add(state);
    const[dx,dy]=S[dir];x+=dx;y+=dy;const c=map.get(`${x},${y}`);if(!c)return{success:false,reason:'broken',path};path.push(c.id||`${x},${y}`);if(c.hazard)return{success:false,reason:'pit',path};if(c.goal)return{success:true,reason:'goal',path};
    const l=links(c),entry=O[dir];if(!l.includes(entry))return{success:false,reason:'broken',path};const exits=l.filter(d=>d!==entry);
    if(c.id===field.targetId){const chosen=field.directionByRotation?.[String(rotation)];if(!exits.includes(chosen))return{success:false,reason:'field',path};dir=chosen;}else dir=exits.includes(dir)?dir:exits[0];
  }
  return{success:false,reason:'loop',path};
}

const solutions=[];
for(const turn of field.turns||[]){const rotation=norm((field.initialRotation||0)+turn),result=solve(rotation);if(result.success)solutions.push({turn,rotation,result});}
if(solutions.length!==1)fail(`magnet: expected exactly one field direction to solve, found ${solutions.length}`);
if(field.expectedTurn&&solutions[0]?.turn!==field.expectedTurn)fail(`magnet: expected ${field.expectedTurn>0?'clockwise':'counter-clockwise'} to be the unique solution`);
if(solutions[0]&&!solutions[0].result.path.some(id=>cells.find(c=>c.id===id)?.star))fail('magnet: successful field route must pass the reward star');

if(errors.length){for(const e of errors)console.error(`Field logic check failed: ${e}`);process.exit(1);}
console.log('Field logic check passed: Magnetic Fork has exactly one one-move field solution.');
