import { MACHINE_LOGIC } from '../src/machineLogic.js';

const errors=[]; const fail=m=>errors.push(m);
const DIRS=['N','E','S','W']; const STEP={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}; const OPP={N:'S',E:'W',S:'N',W:'E'};
const BASE={straight:['N','S'],corner:['N','E'],tee:['N','E','S'],cross:['N','E','S','W']};
const norm=v=>((v%4)+4)%4;
const connections=(type,rotation)=>(BASE[type]||[]).map(dir=>DIRS[(DIRS.indexOf(dir)+rotation)%4]);
function chooseExit(cell,rotation,entry,currentDir,exits){return cell.exitByRotation?.[String(rotation)]?.[entry]||cell.exitMap?.[entry]||(exits.includes(currentDir)?currentDir:exits[0]);}

function solveMap(maze,map,rotations=new Map()){
  const openGates=new Set(maze.openGates||[]),visited=new Set(),path=[]; let x=maze.start.x,y=maze.start.y,dir=maze.start.dir;
  const out=(success,reason)=>({success,reason,path:[...path]});
  for(let i=0;i<72;i++){
    const state=`${x},${y},${dir}|${[...openGates].sort().join(',')}`; if(visited.has(state))return out(false,'loop'); visited.add(state);
    const [dx,dy]=STEP[dir]; x+=dx;y+=dy; const cell=map.get(`${x},${y}`); if(!cell)return out(false,'off-track'); path.push(cell.id||`${x},${y}`);
    if(cell.hazard)return out(false,'pit');
    if(cell.feature==='gate'){const gateId=cell.gateId||cell.id||'gate';if(!openGates.has(gateId))return out(false,'gate');}
    if(cell.feature==='pad')for(const gateId of cell.opens||[])openGates.add(gateId);
    if(cell.goal)return out(true,'goal');
    const rotation=cell.id&&rotations.has(cell.id)?rotations.get(cell.id):(cell.rotation||0); const links=connections(cell.type,rotation); const entry=OPP[dir];
    if(!links.includes(entry))return out(false,'broken'); const exits=links.filter(d=>d!==entry); if(!exits.length)return out(false,'dead-end');
    const exit=chooseExit(cell,rotation,entry,dir,exits); if(!exit||!exits.includes(exit))return out(false,'broken'); dir=exit;
  }
  return out(false,'loop');
}

function solveMaze(maze,override={}){
  const map=new Map(maze.cells.map(c=>[`${c.x},${c.y}`,c])); const rotations=new Map((maze.rotators||[]).map(r=>[r.id,r.initialRotation]));
  for(const [id,rotation] of Object.entries(override))rotations.set(id,rotation); return solveMap(maze,map,rotations);
}

function validateBase(levelId,needsRotators=true){
  const logic=MACHINE_LOGIC[levelId]; if(!logic?.maze){fail(`${levelId}: missing maze configuration`);return null;} const maze=logic.maze;
  if(!(Number.isInteger(maze.cols)&&maze.cols>=4))fail(`${levelId}: cols must be >= 4`); if(!(Number.isInteger(maze.rows)&&maze.rows>=4))fail(`${levelId}: rows must be >= 4`);
  if(!maze.start||!Number.isInteger(maze.start.x)||!Number.isInteger(maze.start.y)||!DIRS.includes(maze.start.dir))fail(`${levelId}: invalid start`);
  if(!Array.isArray(maze.cells)||maze.cells.length<6)fail(`${levelId}: maze needs authored cells`);
  if(needsRotators&&(!Array.isArray(maze.rotators)||!maze.rotators.length))fail(`${levelId}: maze needs at least one rotator`);
  const ids=maze.cells.filter(c=>c.id).map(c=>c.id); if(new Set(ids).size!==ids.length)fail(`${levelId}: duplicate cell ids`);
  for(const cell of maze.cells||[]){if(!(Number.isInteger(cell.x)&&Number.isInteger(cell.y)&&cell.x>=0&&cell.x<maze.cols&&cell.y>=0&&cell.y<maze.rows))fail(`${levelId}: cell ${cell.id||'?'} is outside the grid`);if(!cell.hazard&&!BASE[cell.type])fail(`${levelId}: cell ${cell.id||'?'} has unsupported type ${cell.type}`);}
  if(!maze.cells.some(c=>c.goal))fail(`${levelId}: missing goal`); if(!maze.cells.some(c=>c.star))fail(`${levelId}: missing reward star`); if(!maze.cells.some(c=>c.hazard))fail(`${levelId}: missing visible failure route`);
  const gates=new Set(maze.cells.filter(c=>c.feature==='gate').map(c=>c.gateId||c.id)); for(const pad of maze.cells.filter(c=>c.feature==='pad'))for(const gateId of pad.opens||[])if(!gates.has(gateId))fail(`${levelId}: pad ${pad.id||'?'} opens unknown gate ${gateId}`);
  return {logic,maze,ids};
}

function validateMaze(levelId){
  const base=validateBase(levelId,true); if(!base)return null; const {maze,ids}=base;
  for(const r of maze.rotators||[]){if(!r.id||!ids.includes(r.id))fail(`${levelId}: rotator ${r.id||'?'} has no matching cell`);if(!Number.isInteger(r.initialRotation))fail(`${levelId}: rotator ${r.id||'?'} initialRotation must be integer`);if(!Array.isArray(r.turns)||!r.turns.length||r.turns.some(t=>![-1,1].includes(t)))fail(`${levelId}: rotator ${r.id||'?'} turns must be -1/1`);}
  if(solveMaze(maze).success)fail(`${levelId}: maze is already solved before the one move`);
  const solutions=[]; for(const r of maze.rotators||[])for(const turn of r.turns||[]){const rotation=norm(r.initialRotation+turn),result=solveMaze(maze,{[r.id]:rotation});if(result.success)solutions.push({id:r.id,turn,rotation,result});}
  if(solutions.length!==1)fail(`${levelId}: expected exactly one one-move solution, found ${solutions.length} (${solutions.map(s=>`${s.id}:${s.turn}`).join(', ')||'none'})`);
  const expected=maze.expectedSolution;if(expected&&(solutions[0]?.id!==expected.id||solutions[0]?.turn!==expected.turn))fail(`${levelId}: unique solution does not match expected ${expected.id}:${expected.turn}`);return solutions[0];
}

function slideMap(maze,offset){
  const slide=maze.slide,ids=new Set(slide.ids||[]),map=new Map(maze.cells.filter(c=>!ids.has(c.id)).map(c=>[`${c.x},${c.y}`,c])); const span=slide.maxX-slide.minX+1;
  for(const id of slide.ids||[]){const cell=maze.cells.find(c=>c.id===id);if(!cell)continue;const local=((cell.x-slide.minX+offset)%span+span)%span;map.set(`${slide.minX+local},${slide.row}`,cell);} return map;
}
function validateSlide(levelId){
  const base=validateBase(levelId,false);if(!base)return;const {maze,ids}=base,slide=maze.slide;
  if(maze.mode!=='slide-row'||!slide)return fail(`${levelId}: must use slide-row mode`);
  if(!slide.id||!Number.isInteger(slide.row)||!Number.isInteger(slide.minX)||!Number.isInteger(slide.maxX)||slide.maxX<=slide.minX)fail(`${levelId}: invalid slide lane`);
  const span=slide.maxX-slide.minX+1;if(!Array.isArray(slide.ids)||slide.ids.length!==span||new Set(slide.ids).size!==span)fail(`${levelId}: slide row must name exactly ${span} unique tiles`);
  for(const id of slide.ids||[]){const cell=maze.cells.find(c=>c.id===id);if(!cell)fail(`${levelId}: slide tile ${id} missing`);else if(cell.y!==slide.row||cell.x<slide.minX||cell.x>slide.maxX)fail(`${levelId}: slide tile ${id} is outside authored lane`);}
  if(!Array.isArray(slide.moves)||slide.moves.length!==2||!slide.moves.includes(-1)||!slide.moves.includes(1))fail(`${levelId}: slide row must allow exactly left and right moves`);
  const initial=solveMap(maze,slideMap(maze,slide.initialOffset||0));if(initial.success)fail(`${levelId}: slide maze is already solved`);
  const solutions=[];for(const dir of slide.moves||[]){const offset=(slide.initialOffset||0)+dir,result=solveMap(maze,slideMap(maze,offset));if(result.success)solutions.push({dir,result});}
  if(solutions.length!==1)fail(`${levelId}: expected exactly one slide solution, found ${solutions.length}`);if(slide.expectedMove&&solutions[0]?.dir!==slide.expectedMove)fail(`${levelId}: unique slide solution must be ${slide.expectedMove>0?'right':'left'}`);
}

for(const id of ['release','gate','switch','button'])validateMaze(id);
const springSolution=validateMaze('spring');const springMaze=MACHINE_LOGIC.spring?.maze;
if(springMaze?.mode!=='vector')fail('spring: must use vector maze mode');const springCells=springMaze?.cells?.filter(c=>c.feature==='spring')||[],gaps=springMaze?.cells?.filter(c=>c.gap)||[];
if(springCells.length!==1)fail(`spring: expected exactly one spring launcher, found ${springCells.length}`);if(!gaps.length)fail('spring: must contain a real visible gap');if(springCells[0]&&!(Number.isInteger(springCells[0].airborneSteps)&&springCells[0].airborneSteps>=2))fail('spring: launcher must keep the ball airborne across at least two grid steps');if(springSolution&&gaps.length&&!gaps.some(c=>springSolution.result.path.includes(c.id)))fail('spring: unique solution must actually cross the authored gap');
validateSlide('conveyor');

if(errors.length){for(const message of errors)console.error(`Machine logic check failed: ${message}`);process.exit(1);}
console.log('Machine logic check passed: Levels 1-6 have unique one-move solutions across rotate, vector and row-slide mechanics.');
