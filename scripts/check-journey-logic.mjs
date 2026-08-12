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
  if(!cp.panel||!Number.isFinite(cp.panel.x)||!Number.isFinite(cp.panel.y))fail(`${cp.id}: checkpoint needs an authored physical panel position`);
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
  while(queue.length){const [state,d]=queue.shift();if(key(state)===key(gear.target)){distance=d;break;}if(d>=9)continue;for(const op of ops){const next=op(state),k=key(next);if(!seen.has(k)){seen.add(k);queue.push([next,d+1]);}}}
  if(distance==null)fail('gearLock: target is unreachable');
  else if(distance<3)fail(`gearLock: linked-gear reasoning is too shallow (${distance} actions)`);
  else if(distance>6)fail(`gearLock: first-gate solution is too tedious (${distance} actions)`);
}

const bridge=journey?.checkpoints?.find(cp=>cp.type==='bridge-lock');
if(!bridge)fail('release: missing bridge topology lock');
else{
  if(!Array.isArray(bridge.parts)||bridge.parts.length!==bridge.initial.length)fail('bridgeLock: every rotating plate needs a rail type');
  const changed=bridge.initial.filter((v,i)=>v!==bridge.target[i]).length;
  if(changed<2)fail('bridgeLock: route repair must require at least two plates');
}

const valve=journey?.checkpoints?.find(cp=>cp.type==='valve-lock');
if(!valve)fail('release: missing pressure-balance lock');
else{
  if(valve.solve!=='balance')fail('valveLock: final gate must solve from pressure balance, not target-marker matching');
  if(!Array.isArray(valve.pressure)||valve.pressure.length!==2||valve.pressure.some(row=>!Array.isArray(row)||row.length!==4))fail('valveLock: two four-state pressure curves are required');
  const pressure=(i,state)=>Number(valve.pressure?.[i]?.[norm(state)]??NaN);
  if(pressure(0,valve.initial[0])===pressure(1,valve.initial[1]))fail('valveLock: pressure starts already balanced');
  if(pressure(0,valve.target[0])!==pressure(1,valve.target[1]))fail('valveLock: canonical target must represent equal pressure');
  const oneClickSolved=[0,1].some(i=>{
    const next=[...valve.initial];next[i]=norm(next[i]+1);
    return pressure(0,next[0])===pressure(1,next[1]);
  });
  if(oneClickSolved)fail('valveLock: pressure puzzle must not solve with one blind click');
}

if(errors.length){for(const e of errors)console.error(`Journey logic check failed: ${e}`);process.exit(1);}
console.log('Journey logic check passed: Level 1 has three distinct sequential mechanisms with real reasoning depth.');
