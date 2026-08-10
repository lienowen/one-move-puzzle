import { ADVANCED_MAZE_LOGIC } from '../src/advancedMazeLogic.js';

const logic=ADVANCED_MAZE_LOGIC.hammer,errors=[];
const fail=m=>errors.push(m),norm=v=>((v%4)+4)%4;
const DIR={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
const direction=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y;for(const[d,[x,y]]of Object.entries(DIR))if(dx===x&&dy===y)return d;return null;};
const maze=logic?.maze||{},valve=maze.oneWay||{},path=maze.path||[];
const inside=p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&p.x>=0&&p.x<maze.cols&&p.y>=0&&p.y<maze.rows;

if(maze.mode!=='one-way-loop')fail('hammer: must use one-way-loop mode');
if(!(Number.isInteger(maze.cols)&&maze.cols>=5&&Number.isInteger(maze.rows)&&maze.rows>=5))fail('hammer: loop board must be at least 5x5');
if(path.length<20)fail(`hammer: delayed loop must contain at least 20 path nodes, found ${path.length}`);
for(const [i,p] of path.entries())if(!inside(p))fail(`hammer: path node ${i} is outside the grid`);
for(let i=1;i<path.length;i++)if(Math.abs(path[i].x-path[i-1].x)+Math.abs(path[i].y-path[i-1].y)!==1)fail(`hammer: path breaks between nodes ${i-1} and ${i}`);
const keys=path.map(p=>`${p.x},${p.y}`);if(new Set(keys).size!==keys.length)fail('hammer: authored loop path may not repeat or self-intersect');

if(!valve.id||!inside(valve))fail('hammer: one-way valve must occupy a valid grid cell');
const valveIndex=path.findIndex(p=>p.x===valve.x&&p.y===valve.y);
if(valveIndex<0)fail('hammer: one-way valve is not on the run path');
if(valveIndex>=0&&valveIndex/path.length<.7)fail(`hammer: valve is reached too early (${valveIndex+1}/${path.length}); delayed reasoning requires it after 70% of the run`);
if(valveIndex<=0||valveIndex>=path.length-2)fail('hammer: valve needs a real approach and a route after it');

if(!Array.isArray(valve.turns)||valve.turns.length!==2||!valve.turns.includes(-1)||!valve.turns.includes(1))fail('hammer: valve must allow exactly one quarter-turn left or right');
const arrival=valveIndex>0?direction(path[valveIndex-1],path[valveIndex]):null;
if(!arrival)fail('hammer: could not derive ball arrival direction at the valve');
const outcomes=(valve.turns||[]).map(turn=>{const rotation=norm((valve.initialRotation||0)+turn);return{turn,rotation,direction:valve.directionByRotation?.[String(rotation)]};});
for(const o of outcomes)if(!['N','E','S','W'].includes(o.direction))fail(`hammer: rotation ${o.rotation} has no one-way direction`);
const wins=outcomes.filter(o=>o.direction===arrival);
if(wins.length!==1)fail(`hammer: expected exactly one valve orientation to accept arrival ${arrival}, found ${wins.length}`);
if(valve.expectedTurn&&wins[0]?.turn!==valve.expectedTurn)fail(`hammer: unique solution must be ${valve.expectedTurn>0?'clockwise':'counter-clockwise'}`);
if(outcomes.length===2&&outcomes[0].direction===outcomes[1].direction)fail('hammer: left and right moves must point the valve in different directions');
if(valve.directionByRotation?.[String(norm(valve.initialRotation||0))]===arrival)fail('hammer: initial valve state cannot already accept the return direction');

const starIndex=path.findIndex(p=>p.star),goalIndex=path.findIndex(p=>p.goal);
if(starIndex<0||goalIndex<0)fail('hammer: reward star and goal are both required');
if(starIndex<=valveIndex)fail('hammer: reward star must come after the delayed valve decision');
if(goalIndex<=starIndex)fail('hammer: goal must come after the reward star');
if(goalIndex!==path.length-1)fail('hammer: goal must terminate the loop run');

const boundary=path.filter(p=>p.x===0||p.y===0||p.x===maze.cols-1||p.y===maze.rows-1).length;
if(boundary<12)fail(`hammer: route does not read as a real outer loop; only ${boundary} boundary nodes`);
for(const key of ['ready','running','blocked','open','complete'])if(typeof logic?.copy?.[key]!=='string'||!logic.copy[key].trim())fail(`hammer: missing ${key} copy`);

if(errors.length){for(const e of errors)console.error(`One-way logic check failed: ${e}`);process.exit(1);}
console.log(`One-way logic check passed: ${path.length}-node loop reaches the valve at step ${valveIndex+1}, with one valid return direction (${arrival}).`);
