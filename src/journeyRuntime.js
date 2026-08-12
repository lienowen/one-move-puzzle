import './journeyRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const norm=value=>((value%4)+4)%4;
const same=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);

export function mountJourneyRuntime({world,stage,level,onStar,onGoal,onEffect,onStatus,onJourneyStart,onProgress}){
  const logic=getMachineLogic(level.id);
  const journey=logic?.journey;
  if(logic?.archetype!=='journey-gates'||!journey)throw new Error(`Level ${level.id} is not a journey-gates puzzle`);

  let destroyed=false;
  let started=false;
  let activeIndex=-1;
  let frameId=0;
  let starCollected=false;
  const timers=new Set();
  const checkpoints=journey.checkpoints||[];
  const route=journey.route||[];

  world.innerHTML='';
  const board=document.createElement('div');
  board.className='machine-board journey-board';
  board.innerHTML=`
    <img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt="" draggable="false">
    <div class="journey-deck"></div>
    <svg class="journey-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline class="bed" points="${route.map(p=>`${p.x},${p.y}`).join(' ')}"></polyline>
      <polyline class="rail" points="${route.map(p=>`${p.x},${p.y}`).join(' ')}"></polyline>
      <polyline class="light" points="${route.map(p=>`${p.x},${p.y}`).join(' ')}"></polyline>
    </svg>
    <img class="journey-ball" src="${A.objects.ballBlue}" alt="" draggable="false">
    <img class="journey-star" src="${A.objects.starIdle}" alt="" draggable="false">
    <img class="journey-goal" src="${A.objects.goalIdle}" alt="" draggable="false">
    <div class="journey-caption">FOLLOW THE BALL · SOLVE EACH LOCK</div>
  `;
  world.appendChild(board);
  stage.classList.add('journey-stage');

  const ball=board.querySelector('.journey-ball');
  const star=board.querySelector('.journey-star');
  const goal=board.querySelector('.journey-goal');
  const gateEls=[];
  const lockEls=[];
  const state=checkpoints.map(cp=>[...(cp.initial||[])]);

  route.slice(1,-1).forEach((point,index)=>{
    const gate=document.createElement('img');
    gate.className='journey-gate';
    gate.dataset.gate=checkpoints[index]?.id||String(index);
    gate.src=A.tiles.gateClosed;
    gate.alt='';
    gate.draggable=false;
    place(gate,point);
    board.appendChild(gate);
    gateEls.push(gate);
  });

  checkpoints.forEach((checkpoint,index)=>{
    const lock=renderLock(checkpoint,index);
    board.appendChild(lock);
    lockEls.push(lock);
  });

  const starPoint=lerp(route[2],route[3],.54);
  place(star,starPoint);
  place(goal,route[route.length-1]);
  place(ball,route[0]);

  onProgress?.(1,checkpoints.length);
  onStatus?.(logic.copy?.ready||'Follow the ball. Solve each lock when it reaches the gate.');
  later(()=>travelSegment(0,()=>activateCheckpoint(0)),520);

  function renderLock(checkpoint,index){
    const section=document.createElement('section');
    section.className=`journey-lock ${checkpoint.type}`;
    section.dataset.checkpoint=checkpoint.id;
    section.innerHTML=`<div class="journey-lock-head"><span>LOCK ${index+1}</span><b>${String(index+1).padStart(2,'0')}</b></div>`;

    if(checkpoint.type==='gear-lock'){
      const row=document.createElement('div');
      row.className='gear-row';
      checkpoint.initial.forEach((_,gearIndex)=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='gear-control';
        button.dataset.gear=String(gearIndex);
        button.innerHTML=`<i class="gear-target"></i><img src="${W.mechanisms.gear}" alt="" draggable="false"><span class="gear-pointer"></span>`;
        button.addEventListener('click',event=>turnGear(index,gearIndex,event));
        row.appendChild(button);
      });
      section.appendChild(row);
    }

    if(checkpoint.type==='bridge-lock'){
      const strip=document.createElement('div');
      strip.className='bridge-strip';
      checkpoint.initial.forEach((_,partIndex)=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='bridge-cell';
        button.dataset.part=String(partIndex);
        const railAsset=partIndex===1?A.tiles.railStraightH:A.tiles.railCornerNe;
        button.innerHTML=`<img class="plate" src="${A.tiles.rotatableIdle}" alt="" draggable="false"><img class="rail" src="${railAsset}" alt="" draggable="false">`;
        button.addEventListener('click',event=>turnBridge(index,partIndex,event));
        strip.appendChild(button);
      });
      section.appendChild(strip);
    }

    if(checkpoint.type==='valve-lock'){
      const flow=document.createElement('div');flow.className='valve-flow';section.appendChild(flow);
      const row=document.createElement('div');row.className='valve-row';
      checkpoint.initial.forEach((_,valveIndex)=>{
        const button=document.createElement('button');
        button.type='button';button.className='valve-control';button.dataset.valve=String(valveIndex);
        button.innerHTML=`<img src="${W.mechanisms.wheelValve}" alt="" draggable="false"><span></span>`;
        button.addEventListener('click',event=>turnValve(index,valveIndex,event));
        row.appendChild(button);
      });
      section.appendChild(row);
    }

    syncLockVisual(index,section);
    return section;
  }

  function touchJourney(){
    if(started)return;
    started=true;
    onJourneyStart?.();
  }

  function turnGear(index,gearIndex,event){
    if(index!==activeIndex)return;
    touchJourney();
    const values=state[index];
    if(gearIndex===0){values[0]=norm(values[0]+1);values[1]=norm(values[1]-1);}
    else if(gearIndex===1){values[0]=norm(values[0]-1);values[1]=norm(values[1]+1);values[2]=norm(values[2]-1);}
    else{values[1]=norm(values[1]-1);values[2]=norm(values[2]+1);}
    onEffect?.('metal');
    syncLockVisual(index);
    maybeSolve(index,event);
  }

  function turnBridge(index,partIndex,event){
    if(index!==activeIndex)return;
    touchJourney();
    state[index][partIndex]=norm(state[index][partIndex]+1);
    onEffect?.('wood');
    syncLockVisual(index);
    maybeSolve(index,event);
  }

  function turnValve(index,valveIndex,event){
    if(index!==activeIndex)return;
    touchJourney();
    state[index][valveIndex]=norm(state[index][valveIndex]+1);
    onEffect?.('metal');
    syncLockVisual(index);
    maybeSolve(index,event);
  }

  function syncLockVisual(index,override){
    const checkpoint=checkpoints[index];
    const lock=override||lockEls[index];
    if(!lock)return;
    const values=state[index];

    if(checkpoint.type==='gear-lock'){
      lock.querySelectorAll('.gear-control').forEach((button,gearIndex)=>{
        const angle=values[gearIndex]*90;
        const target=(checkpoint.target[gearIndex]||0)*90;
        button.style.setProperty('--gear-angle',`${angle}deg`);
        button.style.setProperty('--target-angle',`${target}deg`);
      });
    }
    if(checkpoint.type==='bridge-lock'){
      lock.querySelectorAll('.bridge-cell').forEach((button,partIndex)=>button.style.setProperty('--bridge-angle',`${values[partIndex]*90}deg`));
    }
    if(checkpoint.type==='valve-lock'){
      lock.querySelectorAll('.valve-control').forEach((button,valveIndex)=>button.style.setProperty('--valve-angle',`${values[valveIndex]*90}deg`));
      lock.querySelector('.valve-flow')?.classList.toggle('live',same(values,checkpoint.target));
    }
  }

  function maybeSolve(index){
    if(!same(state[index],checkpoints[index].target)){
      onStatus?.(checkpoints[index].copy?.thinking||'The lock is still engaged. Read the mechanism again.');
      return;
    }
    solveCheckpoint(index);
  }

  function activateCheckpoint(index){
    if(destroyed||index>=checkpoints.length)return;
    activeIndex=index;
    lockEls.forEach((lock,i)=>lock.classList.toggle('active',i===index));
    gateEls[index]?.classList.add('waiting');
    onProgress?.(index+1,checkpoints.length);
    onStatus?.(checkpoints[index].copy?.ready||`Gate ${index+1}: solve the mechanism.`);
    onEffect?.('roll-brake');
  }

  function solveCheckpoint(index){
    if(index!==activeIndex||destroyed)return;
    activeIndex=-1;
    const checkpoint=checkpoints[index];
    const lock=lockEls[index];
    const gate=gateEls[index];
    lock?.classList.remove('active');
    lock?.classList.add('solved');
    board.classList.add('checkpoint-solved');
    if(gate){gate.classList.remove('waiting');gate.src=A.tiles.gateOpening;}
    onStatus?.(checkpoint.copy?.solved||'Lock released.');
    onEffect?.('gate-preload');

    later(()=>{
      if(gate){gate.src=A.tiles.gateOpen;gate.classList.add('open');}
      onEffect?.('gate-open');
      board.classList.remove('checkpoint-solved');
      travelSegment(index+1,()=>{
        if(index===1&&!starCollected)collectStar();
        if(index+1<checkpoints.length)activateCheckpoint(index+1);
        else finishJourney();
      });
    },360);
  }

  function travelSegment(segmentIndex,done){
    if(destroyed)return;
    const from=route[segmentIndex];
    const to=route[segmentIndex+1];
    if(!from||!to){done?.();return;}
    const start=performance.now();
    const duration=segmentIndex===0?1150:1250;
    ball.classList.add('rolling');
    onEffect?.('roll-start');

    const tick=now=>{
      if(destroyed)return;
      const t=Math.min(1,(now-start)/duration);
      const eased=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      const point=lerp(from,to,eased);
      place(ball,point);
      ball.style.setProperty('--roll',`${(segmentIndex+eased)*280}deg`);
      if(segmentIndex===2&&!starCollected&&t>.55)collectStar();
      if(t<1)frameId=requestAnimationFrame(tick);
      else{
        ball.classList.remove('rolling');
        onEffect?.('roll-brake');
        done?.();
      }
    };
    frameId=requestAnimationFrame(tick);
  }

  function collectStar(){
    if(starCollected)return;
    starCollected=true;
    star.classList.add('collected');
    star.src=A.objects.starCollect;
    onStar?.();
    onEffect?.('power');
    later(()=>star.remove(),320);
  }

  function finishJourney(){
    if(destroyed)return;
    goal.src=A.objects.goalSuccess;
    board.classList.add('journey-complete');
    onProgress?.(checkpoints.length,checkpoints.length);
    onStatus?.(logic.copy?.complete||'All locks cleared.');
    onEffect?.('goal');
    later(()=>onGoal?.(),logic.timings?.resultDelay||620);
  }

  function place(element,point){
    if(!element||!point)return;
    element.style.left=`${point.x}%`;
    element.style.top=`${point.y}%`;
  }

  function lerp(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
  function later(fn,ms){const id=window.setTimeout(()=>{timers.delete(id);if(!destroyed)fn();},ms);timers.add(id);return id;}

  return{
    commit(){return{accepted:false};},
    destroy(){destroyed=true;cancelAnimationFrame(frameId);for(const id of timers)clearTimeout(id);timers.clear();stage.classList.remove('journey-stage');},
  };
}
