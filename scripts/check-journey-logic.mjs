import { JOURNEY_LEVELS } from '../src/journeyLevel.js';

const errors=[];const fail=m=>errors.push(m);const norm=v=>((v%4)+4)%4;
const key=a=>a.join(',');

const logic=JOURNEY_LEVELS.release;
const journey=logic?.journey;
if(!journey)fail('release: missing journey configuration');
if((journey?.checkpoints||[]).length<3)fail('release: journey must contain at least three thinking gates');
if((journey?.route||[]).length!==(journey?.checkpoints?.length||0)+2)fail('release: route must contain start + each gate + goal');

const ids=new Set();
for(const cp of journey?.checkpoints||[]){
  if(!cp.id||ids.has(cp.id))fail(`release: duplicate or missing checkpoint id ${cp.id||'?'}`);ids.add(cp.id);
  if(!Array.isArray(cp.initial)||!Array.isArray(cp.target)||cp.initial.length!==cp.target.length)fail(`${cp.id}: initial/target state mismatch`);
  if(cp.initial?.every((v,i)=>v===cp.target?.[i]))fail(`${cp.id}: checkpoint starts already solved`);
}

const gear=journey?.checkpoints?.find(cp=>cp.type==='gear-lock');
if(!gear)fail('release: missing linked gear lock');
else{
  const ops=[
    a=>[norm(a[0]+1),norm(a[1]-1),a[2]],
    a=>[norm(a[0]-1),norm(a[1]+1),norm(a[2]-1)],
    a=>[a[0],norm(a[1]-1),norm(a[2]+1)],
  ];
  const queue=[[gear.initial,0]],seen=new Set([key(gear.initial)]);let distance=null;
  while(queue.length){const [state,d]=queue.shift();if(key(state)===key(gear.target)){distance=d;break;}if(d>=8)continue;for(const op of ops){const next=op(state),k=key(next);if(!seen.has(k)){seen.add(k);queue.push([next,d+1]);}}}
  if(distance==null)fail('gearLock: target is unreachable');
  else if(distance<2)fail(`gearLock: solution is too trivial (${distance} move)`);
  else if(distance>6)fail(`gearLock: first-gate solution is too tedious (${distance} moves)`);
}

for(const cp of journey?.checkpoints||[]){
  if(cp.type==='gear-lock')continue;
  const changed=cp.initial.filter((v,i)=>v!==cp.target[i]).length;
  if(changed<2)fail(`${cp.id}: must require reasoning across at least two mechanism states`);
}

if(errors.length){for(const e of errors)console.error(`Journey logic check failed: ${e}`);process.exit(1);}
console.log('Journey logic check passed: Level 1 has three sequential locks and no one-click solution.');
