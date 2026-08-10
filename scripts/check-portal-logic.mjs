import { ADVANCED_MAZE_LOGIC } from '../src/advancedMazeLogic.js';

const logic=ADVANCED_MAZE_LOGIC.pulley,errors=[];
const fail=m=>errors.push(m),norm=v=>((v%4)+4)%4;
const maze=logic?.maze||{},portal=maze.portal||{},cells=maze.cells||[];
const key=p=>`${p.x},${p.y}`;
const inside=p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&p.x>=0&&p.x<maze.cols&&p.y>=0&&p.y<maze.rows;
const continuous=(route,name)=>{for(let i=0;i<route.length;i++){if(!inside(route[i]))fail(`pulley: ${name} node ${i} leaves the grid`);if(i&&Math.abs(route[i].x-route[i-1].x)+Math.abs(route[i].y-route[i-1].y)!==1)fail(`pulley: ${name} breaks between ${i-1} and ${i}`);}};
const cellAt=p=>cells.find(c=>c.x===p.x&&c.y===p.y);

if(maze.mode!=='portal-relay')fail('pulley: must use portal-relay mode');
if(!(Number.isInteger(maze.cols)&&maze.cols>=5&&Number.isInteger(maze.rows)&&maze.rows>=5))fail('pulley: board must be at least 5x5');
if(!portal.id||!inside(portal.entry)||!inside(portal.exit)||key(portal.entry)===key(portal.exit))fail('pulley: entry and exit portals must be distinct valid cells');
if(!Array.isArray(portal.turns)||portal.turns.length!==2||!portal.turns.includes(-1)||!portal.turns.includes(1))fail('pulley: exit portal must allow one left or right quarter-turn');
if(!Array.isArray(maze.prePath)||maze.prePath.length<4)fail('pulley: pre-portal path is too short');else{continuous(maze.prePath,'prePath');if(key(maze.prePath.at(-1))!==key(portal.entry))fail('pulley: prePath must terminate at the entry portal');}

const direct=maze.routes?.direct||[],detour=maze.routes?.detour||[];
if(direct.length<3)fail('pulley: direct shortcut route is missing');else continuous(direct,'direct route');
if(detour.length<8)fail('pulley: detour route must be a real multi-step relay');else continuous(detour,'detour route');
for(const [name,route] of [['direct',direct],['detour',detour]])if(route.length&&key(route[0])!==key(portal.exit))fail(`pulley: ${name} route must begin at the exit portal`);

const outcomes=(portal.turns||[]).map(turn=>{const rotation=norm((portal.initialRotation||0)+turn);return{turn,rotation,route:portal.routeByRotation?.[String(rotation)]};});
for(const o of outcomes)if(!['direct','detour'].includes(o.route))fail(`pulley: rotation ${o.rotation} does not select a valid route`);
if(new Set(outcomes.map(o=>o.route)).size!==2)fail('pulley: left and right turns must select different portal routes');
const win=outcomes.find(o=>o.route==='detour');if(!win)fail('pulley: one move must select the detour solution');
if(portal.expectedTurn&&win?.turn!==portal.expectedTurn)fail(`pulley: unique solution must be ${portal.expectedTurn>0?'clockwise':'counter-clockwise'}`);
if(portal.routeByRotation?.[String(norm(portal.initialRotation||0))])fail('pulley: initial portal orientation may not already choose a runnable exit');

if(!inside(maze.pad)||!inside(maze.gate)||key(maze.pad)===key(maze.gate))fail('pulley: pad and gate must be separate valid cells');
const padCell=cellAt(maze.pad),gateCell=cellAt(maze.gate),entryCell=cellAt(portal.entry),exitCell=cellAt(portal.exit);
if(entryCell?.feature!=='portal-entry'||exitCell?.feature!=='portal-exit')fail('pulley: authored portal cells are missing');
if(padCell?.feature!=='pad')fail('pulley: pressure pad artwork/state cell is missing');
if(gateCell?.feature!=='gate')fail('pulley: gate artwork/state cell is missing');

const indexOf=(route,p)=>route.findIndex(q=>key(q)===key(p));
const directGate=indexOf(direct,maze.gate),directPad=indexOf(direct,maze.pad);
if(directGate!==direct.length-1)fail('pulley: wrong shortcut must terminate at the locked gate');
if(directPad!==-1)fail('pulley: wrong shortcut may not touch the pressure pad');
const detourPad=indexOf(detour,maze.pad),detourGate=indexOf(detour,maze.gate),starIndex=detour.findIndex(p=>cellAt(p)?.star),goalIndex=detour.findIndex(p=>cellAt(p)?.goal);
if(detourPad<1)fail('pulley: correct route must reach the pressure pad after teleporting');
if(starIndex<=detourPad)fail('pulley: star must come after the pad is triggered');
if(detourGate<=starIndex)fail('pulley: the route must return to the gate after collecting the star');
if(goalIndex<=detourGate)fail('pulley: goal must come after the reopened gate');
if(goalIndex!==detour.length-1)fail('pulley: goal must terminate the correct relay');
if(key(direct.at(-1)||{})!==key(detour[detourGate]||{}))fail('pulley: wrong and correct routes must confront the same physical gate');

const coords=cells.map(key);if(new Set(coords).size!==coords.length)fail('pulley: duplicate authored cells');
for(const keyName of ['ready','running','teleport','pad','blocked','gate','complete'])if(typeof logic?.copy?.[keyName]!=='string'||!logic.copy[keyName].trim())fail(`pulley: missing ${keyName} copy`);

if(errors.length){for(const e of errors)console.error(`Portal logic check failed: ${e}`);process.exit(1);}
console.log('Portal logic check passed: shortcut hits the locked gate; detour teleports -> pad -> star -> same gate -> goal.');
