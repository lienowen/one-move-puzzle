import { MACHINE_LOGIC } from '../src/machineLogic.js';

const logic=MACHINE_LOGIC.fan,errors=[];
const fail=m=>errors.push(m),norm=v=>((v%4)+4)%4;
const maze=logic?.maze||{},air=maze.air||{},cells=maze.cells||[];
const at=(p)=>cells.find(c=>c.x===p?.x&&c.y===p?.y);
const inside=p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&p.x>=0&&p.x<maze.cols&&p.y>=0&&p.y<maze.rows;
const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

if(!logic?.maze||maze.mode!=='airflow-drop')fail('fan: must use airflow-drop mode');
if(!(Number.isInteger(maze.cols)&&maze.cols>=5&&Number.isInteger(maze.rows)&&maze.rows>=5))fail('fan: airflow board must be at least 5x5');
if(!air.id||!inside(air))fail('fan: fan control must occupy a valid maze cell');
if(!Array.isArray(air.turns)||air.turns.length!==2||!air.turns.includes(-1)||!air.turns.includes(1))fail('fan: control must allow exactly one quarter-turn left or right');
if(!['N','E','S','W'].includes(air.safeDirection))fail('fan: safeDirection must be cardinal');
for(const key of ['lip','safeLanding','badLanding'])if(!inside(air[key]))fail(`fan: ${key} must be inside the maze`);
if(!air.well||![air.well.minX,air.well.maxX,air.well.minY,air.well.maxY].every(Number.isInteger))fail('fan: air well bounds are required');
else{
  if(air.well.maxX-air.well.minX<2||air.well.maxY-air.well.minY<2)fail('fan: air well must span at least 3x3 cells');
  for(const p of [air.lip,air.safeLanding,air.badLanding])if(p.x<air.well.minX||p.x>air.well.maxX||p.y<air.well.minY||p.y>air.well.maxY)fail('fan: lip and both landing targets must sit inside the authored air well');
}

const lip=at(air.lip),safe=at(air.safeLanding),bad=at(air.badLanding),goal=cells.find(c=>c.goal),start=cells.find(c=>c.start);
if(!start||start.x!==maze.start?.x||start.y!==maze.start?.y)fail('fan: visible start socket must match maze start');
if(!lip||lip.hazard||!lip.type)fail('fan: launch lip must be a real rail cell');
if(!safe||safe.hazard||!safe.star||!safe.type)fail('fan: safe landing must be a rail with the reward star');
if(!bad||!bad.hazard)fail('fan: bad landing must be a visible hazard');
if(!goal||goal.hazard||!goal.goal||!goal.type)fail('fan: goal must be a real rail cell');
if(safe&&goal&&manhattan(safe,goal)!==1)fail('fan: safe landing must feed directly into the goal rail');
if(air.safeLanding&&air.lip&&air.safeLanding.y-air.lip.y<2)fail('fan: the ball must visibly free-fall at least two rows');
if(air.safeLanding&&air.lip&&Math.abs(air.safeLanding.x-air.lip.x)<1)fail('fan: safe solution must require visible horizontal drift');
if(air.badLanding&&air.lip&&Math.abs(air.badLanding.x-air.lip.x)<1)fail('fan: failure must also show visible crosswind drift');

const outcomes=[];
for(const turn of air.turns||[]){const rotation=norm((air.initialRotation||0)+turn),direction=air.directionByRotation?.[String(rotation)];if(!['N','E','S','W'].includes(direction))fail(`fan: rotation ${rotation} has no valid wind direction`);outcomes.push({turn,rotation,direction,safe:direction===air.safeDirection});}
const wins=outcomes.filter(o=>o.safe);
if(wins.length!==1)fail(`fan: expected exactly one safe wind direction, found ${wins.length}`);
if(air.expectedTurn&&wins[0]?.turn!==air.expectedTurn)fail(`fan: unique safe turn must be ${air.expectedTurn>0?'clockwise':'counter-clockwise'}`);
if(outcomes.length===2&&outcomes[0].direction===outcomes[1].direction)fail('fan: left and right turns must create different wind vectors');
if(air.initialRotation!=null&&air.directionByRotation?.[String(norm(air.initialRotation))]===air.safeDirection)fail('fan: initial fan state cannot already point at the safe solution');

for(const key of ['ready','running','carry','drift','landing','complete','pit','wrong'])if(typeof logic?.copy?.[key]!=='string'||!logic.copy[key].trim())fail(`fan: missing ${key} copy`);

if(errors.length){for(const e of errors)console.error(`Airflow logic check failed: ${e}`);process.exit(1);}
console.log('Airflow logic check passed: Crosswind Drop has one safe landing vector across a real air well.');
