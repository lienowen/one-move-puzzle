import './journeyRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getJourneyLevel } from './journeyLevel.js';

const norm=value=>((value%4)+4)%4;
const same=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const railAsset=type=>type==='straight'?A.tiles.railStraightH:A.tiles.railCornerNe;

export function mountJourneyRuntimeV2({world,stage,level,onMove,onStar,onGoal,onEffect,onStatus}){
  const logic=getJourneyLevel(level.id);
  const journey=logic?.journey;
  if(!journey)throw new Error(`Level ${level.id} has no journey configuration`);

  let destroyed=false,started=false,pendingStart=false,activeIndex=-1,frameId=0,starCollected=false;
  const timers=new Set();
  const checkpoints=journey.checkpoints;
  const route=journey.route;
  const state=checkpoints.map(cp=>[...cp.initial]);

  world.innerHTML='';
  const board=document.createElement('div');
  board.className='machine-board journey-board';
  board.dataset.journeyLevel=level.id;
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
    <div class="journey-caption">FOLLOW THE BALL · OPEN WHAT BLOCKS IT</div>`;
  world.appendChild(board);
  stage.classList.add('journey-stage');

  const ball=board.querySelector('.journey-ball');
  const star=board.querySelector('.journey-star');
  const goal=board.querySelector('.journey-goal');
  const gateEls=[],lockEls=[],linkEls=[];

  checkpoints.forEach((checkpoint,index)=>{
    const gate=document.createElement('img');
    gate.className=`journey-gate ${checkpoint.type==='bridge-lock'?'bridge-gate':''}`;
    gate.dataset.gate=checkpoint.id;
    gate.src=gateAsset(checkpoint,'closed');
    gate.alt='';gate.draggable=false;
    place(gate,route[index+1]);
    board.appendChild(gate);
    gateEls.push(gate);

    const link=renderLink(checkpoint,index);
    board.appendChild(link);
    linkEls.push(link);

    const lock=renderLock(checkpoint,index);
    board.appendChild(lock);
    lockEls.push(lock);
  });

  place(star,lerp(route[2],route[3],.52));
  place(goal,route.at(-1));
  place(ball,route[0]);
  syncProductUi(0);
  onStatus?.(logic.copy.ready);
  later(()=>travel(0,()=>activate(0)),520);

  function gateAsset(checkpoint,phase){
    if(checkpoint.type==='bridge-lock'){
      if(phase==='open')return A.tiles.bridgeOpen;
      if(phase==='opening')return A.tiles.bridgeRotating;
      return A.tiles.bridgeClosed;
    }
    if(phase==='open')return A.tiles.gateOpen;
    if(phase==='opening')return A.tiles.gateOpening;
    return A.tiles.gateClosed;
  }

  function syncProductUi(index){
    const title=document.querySelector('#levelTitle');
    const hint=document.querySelector('#levelHint');
    const token=document.querySelector('#moveToken');
    if(title)title.textContent=logic.displayName;
    if(hint)hint.textContent='Follow the ball. When a machine blocks it, solve that machine to continue.';
    if(token){
      const strong=token.querySelector('strong'),label=token.querySelector('span');
      if(strong)strong.textContent=`${Math.min(index+1,checkpoints.length)}/${checkpoints.length}`;
      if(label)label.textContent='GATE';
      token.classList.remove('used');
    }
  }

  function renderLink(checkpoint,index){
    const gate=route[index+1],panel=checkpoint.panel||gate;
    const dx=panel.x-gate.x,dy=panel.y-gate.y;
    const link=document.createElement('i');
    link.className='journey-lock-link';
    link.style.left=`${gate.x}%`;
    link.style.top=`${gate.y}%`;
    link.style.width=`${Math.hypot(dx,dy)}%`;
    link.style.setProperty('--link-angle',`${Math.atan2(dy,dx)*180/Math.PI}deg`);
    return link;
  }

  function renderLock(checkpoint,index){
    const section=document.createElement('section');
    section.className=`journey-lock ${checkpoint.type}`;
    section.dataset.checkpoint=checkpoint.id;
    section.style.setProperty('--panel-x',`${checkpoint.panel?.x??50}%`);
    section.style.setProperty('--panel-y',`${checkpoint.panel?.y??50}%`);
    section.innerHTML=`<div class="journey-lock-head"><span>MACHINE ${index+1}</span><b>${String(index+1).padStart(2,'0')}</b></div>`;

    if(checkpoint.type==='gear-lock'){
      const row=document.createElement('div');row.className='gear-row';
      checkpoint.initial.forEach((_,gearIndex)=>{
        const button=document.createElement('button');button.type='button';button.className='gear-control';button.dataset.gear=String(gearIndex);
        button.innerHTML=`<i class="gear-target"></i><img src="${W.mechanisms.gear}" alt="" draggable="false"><span class="gear-pointer"></span>`;
        button.addEventListener('click',event=>turnGear(index,gearIndex,event));row.appendChild(button);
      });
      section.appendChild(row);
    }

    if(checkpoint.type==='bridge-lock'){
      const strip=document.createElement('div');strip.className='bridge-strip';
      strip.innerHTML='<i class="bridge-port in"></i><i class="bridge-port out"></i>';
      checkpoint.initial.forEach((_,partIndex)=>{
        const button=document.createElement('button');button.type='button';button.className='bridge-cell';button.dataset.part=String(partIndex);
        const kind=checkpoint.parts?.[partIndex]||'corner';
        button.innerHTML=`<img class="plate" src="${A.tiles.rotatableIdle}" alt="" draggable="false"><img class="rail" src="${railAsset(kind)}" alt="" draggable="false">`;
        button.addEventListener('click',event=>turnBridge(index,partIndex,event));strip.appendChild(button);
      });
      section.appendChild(strip);
    }

    if(checkpoint.type==='valve-lock'){
      const gauges=document.createElement('div');
      gauges.className='pressure-gauges';
      gauges.innerHTML=`
        <div class="pressure-gauge" data-gauge="0"><i></i><span></span><b>0</b></div>
        <div class="pressure-balance"><i></i></div>
        <div class="pressure-gauge" data-gauge="1"><i></i><span></span><b>0</b></div>`;
      section.appendChild(gauges);
      const flow=document.createElement('div');flow.className='valve-flow';section.appendChild(flow);
      const row=document.createElement('div');row.className='valve-row';
      checkpoint.initial.forEach((_,valveIndex)=>{
        const button=document.createElement('button');button.type='button';button.className='valve-control';button.dataset.valve=String(valveIndex);
        button.innerHTML=`<img src="${W.mechanisms.wheelValve}" alt="" draggable="false"><span></span>`;
        button.addEventListener('click',event=>turnValve(index,valveIndex,event));row.appendChild(button);
      });
      section.appendChild(row);
    }

    syncVisual(index,section);return section;
  }

  function markFirstInteraction(event){
    if(started)return;
    started=true;pendingStart=true;
    onMove?.('__journey_start__',event);
    syncProductUi(Math.max(activeIndex,0));
  }

  function turnGear(index,gearIndex,event){
    if(index!==activeIndex)return;
    markFirstInteraction(event);
    const values=state[index];
    if(gearIndex===0){values[0]=norm(values[0]+1);values[1]=norm(values[1]-1);}
    else if(gearIndex===1){values[0]=norm(values[0]-1);values[1]=norm(values[1]+1);values[2]=norm(values[2]-1);}
    else{values[1]=norm(values[1]-1);values[2]=norm(values[2]+1);}
    onEffect?.('metal');syncVisual(index);check(index);
  }

  function turnBridge(index,partIndex,event){
    if(index!==activeIndex)return;
    markFirstInteraction(event);
    state[index][partIndex]=norm(state[index][partIndex]+1);
    onEffect?.('wood');syncVisual(index);check(index);
  }

  function turnValve(index,valveIndex,event){
    if(index!==activeIndex)return;
    markFirstInteraction(event);
    state[index][valveIndex]=norm(state[index][valveIndex]+1);
    onEffect?.('metal');syncVisual(index);check(index);
  }

  function pressure(checkpoint,valveIndex,value){
    return Number(checkpoint.pressure?.[valveIndex]?.[norm(value)]??0);
  }

  function isSolved(index){
    const checkpoint=checkpoints[index],values=state[index];
    if(checkpoint.solve==='balance')return pressure(checkpoint,0,values[0])===pressure(checkpoint,1,values[1]);
    return same(values,checkpoint.target);
  }

  function syncVisual(index,override){
    const checkpoint=checkpoints[index],lock=override||lockEls[index],values=state[index];
    if(!lock)return;
    if(checkpoint.type==='gear-lock'){
      lock.querySelectorAll('.gear-control').forEach((button,i)=>{
        button.style.setProperty('--gear-angle',`${values[i]*90}deg`);
        button.style.setProperty('--target-angle',`${checkpoint.target[i]*90}deg`);
      });
    }
    if(checkpoint.type==='bridge-lock'){
      lock.querySelectorAll('.bridge-cell').forEach((button,i)=>button.style.setProperty('--bridge-angle',`${values[i]*90}deg`));
      lock.classList.toggle('bridge-live',same(values,checkpoint.target));
    }
    if(checkpoint.type==='valve-lock'){
      lock.querySelectorAll('.valve-control').forEach((button,i)=>button.style.setProperty('--valve-angle',`${values[i]*90}deg`));
      const pressures=values.map((value,i)=>pressure(checkpoint,i,value));
      lock.querySelectorAll('.pressure-gauge').forEach((gauge,i)=>{
        const p=pressures[i]||0;
        gauge.style.setProperty('--pressure-angle',`${-62+(p/7)*124}deg`);
        const text=gauge.querySelector('b');if(text)text.textContent=String(p);
      });
      const balanced=pressures[0]===pressures[1];
      lock.classList.toggle('balanced',balanced);
      lock.querySelector('.valve-flow')?.classList.toggle('live',balanced);
    }
  }

  function check(index){
    if(isSolved(index))solve(index);
    else onStatus?.(checkpoints[index].copy.thinking);
  }

  function activate(index){
    if(destroyed||index>=checkpoints.length)return;
    activeIndex=index;
    board.dataset.activeGate=String(index+1);
    syncProductUi(index);
    lockEls.forEach((lock,i)=>lock.classList.toggle('active',i===index));
    linkEls.forEach((link,i)=>link.classList.toggle('active',i===index));
    gateEls[index].classList.add('waiting');
    onStatus?.(checkpoints[index].copy.ready);
    onEffect?.('roll-brake');
  }

  function solve(index){
    if(index!==activeIndex)return;
    activeIndex=-1;
    const lock=lockEls[index],gate=gateEls[index],link=linkEls[index],checkpoint=checkpoints[index];
    lock.classList.remove('active');lock.classList.add('solved');
    link.classList.remove('active');link.classList.add('solved');
    gate.classList.remove('waiting');gate.src=gateAsset(checkpoint,'opening');
    onStatus?.(checkpoint.copy.solved);onEffect?.('gate-preload');
    later(()=>{
      gate.src=gateAsset(checkpoint,'open');gate.classList.add('open');onEffect?.('gate-open');
      travel(index+1,()=>{
        if(index+1<checkpoints.length)activate(index+1);else finish();
      });
    },420);
  }

  function travel(segment,done){
    const from=route[segment],to=route[segment+1];
    if(!from||!to){done?.();return;}
    const startedAt=performance.now(),duration=segment===0?1200:1350;
    ball.classList.add('rolling');onEffect?.('roll-start');
    board.classList.add('ball-moving');
    const tick=now=>{
      if(destroyed)return;
      const t=Math.min(1,(now-startedAt)/duration),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      place(ball,lerp(from,to,e));ball.style.setProperty('--roll',`${(segment+e)*300}deg`);
      if(segment===2&&!starCollected&&t>.52)collectStar();
      if(t<1)frameId=requestAnimationFrame(tick);
      else{
        ball.classList.remove('rolling');board.classList.remove('ball-moving');onEffect?.('roll-brake');done?.();
      }
    };
    frameId=requestAnimationFrame(tick);
  }

  function collectStar(){
    if(starCollected)return;
    starCollected=true;star.src=A.objects.starCollect;star.classList.add('collected');
    onStar?.();onEffect?.('power');later(()=>star.remove(),320);
  }

  function finish(){
    delete board.dataset.activeGate;
    goal.src=A.objects.goalSuccess;board.classList.add('journey-complete');
    syncProductUi(checkpoints.length-1);onStatus?.(logic.copy.complete);onEffect?.('goal');
    later(()=>onGoal?.(),logic.timings.resultDelay);
  }

  function place(el,p){el.style.left=`${p.x}%`;el.style.top=`${p.y}%`;}
  function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);if(!destroyed)fn();},ms);timers.add(id);}

  return{
    commit(id){
      if(id==='__journey_start__'&&pendingStart){pendingStart=false;return{accepted:true,effectHandled:true};}
      return{accepted:false};
    },
    destroy(){destroyed=true;cancelAnimationFrame(frameId);for(const id of timers)clearTimeout(id);timers.clear();stage.classList.remove('journey-stage');}
  };
}
