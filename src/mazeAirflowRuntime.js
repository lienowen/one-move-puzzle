import './mazeRuntime.css';
import './mazeAirflowRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const ART={straight:A.tiles.railStraightV,corner:A.tiles.railCornerNe,tee:A.tiles.railTeeNes,cross:A.tiles.railCross};
const ANG={N:0,E:90,S:180,W:270};
const norm=v=>((v%4)+4)%4;

export function mountMazeAirflowRuntime({world,stage,level,onMove,onStar,onGoal,onFail,onEffect,onStatus}){
  const logic=getMachineLogic(level.id),maze=logic?.maze,air=maze?.air;
  if(!maze||maze.mode!=='airflow-drop'||!air)throw new Error(`Level ${level.id} has no airflow-drop maze`);
  let destroyed=false,running=false,pending=null,rotation=air.initialRotation||0,raf=0;
  const timers=new Set(),nodes=new Map();

  world.innerHTML='';
  const board=document.createElement('div');
  board.className='machine-board maze-board maze-air-board';
  board.dataset.mazeLevel=level.id;
  board.innerHTML=`<img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt=""><div class="maze-deck"></div><div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div><img class="maze-ball" src="${A.objects.ballBlue}" alt=""><div class="maze-caption">ONE MOVE · AIM THE CROSSWIND</div>`;
  world.appendChild(board);stage.classList.add('maze-stage');
  const grid=board.querySelector('.maze-grid'),ball=board.querySelector('.maze-ball');

  for(let y=0;y<maze.rows;y++)for(let x=0;x<maze.cols;x++){
    const slot=document.createElement('div');slot.className='maze-slot';slot.style.gridColumn=x+1;slot.style.gridRow=y+1;
    slot.innerHTML=`<img class="maze-slot-base" src="${A.tiles.baseSteelDark}" alt="">`;grid.appendChild(slot);nodes.set(`${x},${y}`,slot);
  }
  const well=document.createElement('div');well.className='maze-airwell';well.style.gridColumn=`${air.well.minX+1} / ${air.well.maxX+2}`;well.style.gridRow=`${air.well.minY+1} / ${air.well.maxY+2}`;grid.appendChild(well);
  const stream=document.createElement('img');stream.className='maze-air-stream';stream.src=A.fx.fanWind;stream.alt='';well.appendChild(stream);

  for(const cell of maze.cells)render(cell);
  const control=buildControl();sync(rotation,false);
  requestAnimationFrame(()=>place(maze.start.x,maze.start.y));
  onStatus?.(logic.copy?.ready||'Predict where the falling ball will land.');

  function render(c){
    const slot=nodes.get(`${c.x},${c.y}`);if(!slot)return;
    if(c.hazard){art(slot,'maze-pit-art',A.tiles.pitIdle);return;}
    if(!c.noRail&&c.type){const tile=document.createElement('div');tile.className='maze-tile';tile.dataset.id=c.id||'';tile.dataset.type=c.type;tile.style.setProperty('--angle',`${(c.rotation||0)*90}deg`);tile.innerHTML=`<img class="maze-rail-art" src="${ART[c.type]||A.tiles.baseWood}" alt="">`;slot.appendChild(tile);}
    if(c.start)art(slot,'maze-start-art',A.tiles.startSocketIdle);
    if(c.star)art(slot,'maze-star-art',A.objects.starIdle);
    if(c.goal)art(slot,'maze-goal-art',A.objects.goalIdle);
  }
  function art(slot,cls,src){const e=document.createElement('img');e.className=cls;e.src=src;e.alt='';e.draggable=false;slot.appendChild(e);return e;}

  function buildControl(){
    const slot=nodes.get(`${air.x},${air.y}`),b=document.createElement('button');b.className='maze-air-control';b.dataset.id=air.id;
    b.innerHTML=`<img class="maze-air-dial" src="${A.tiles.rotatableIdle}" alt=""><img class="maze-air-fan" src="${A.tiles.fanIdle}" alt=""><i class="maze-air-arrow"></i>`;slot.appendChild(b);gesture(b);return b;
  }
  function gesture(b){
    let down=false,start=0;
    const angle=e=>{const r=b.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI};
    const delta=(v,o)=>((v-o+540)%360)-180;
    b.addEventListener('pointerdown',e=>{if(running)return;down=true;start=angle(e);b.classList.add('dragging');b.setPointerCapture?.(e.pointerId);onEffect?.('metal')});
    b.addEventListener('pointermove',e=>{if(!down||running)return;const q=delta(angle(e),start);b.querySelector('.maze-air-fan').style.transform=`rotate(${rotation*90+q}deg)`});
    const end=e=>{if(!down||running)return;down=false;b.classList.remove('dragging');const q=delta(angle(e),start);if(Math.abs(q)<22){sync(rotation,false);return}queue(q>0?1:-1,e)};
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',()=>{down=false;b.classList.remove('dragging');sync(rotation,false)});
    b.addEventListener('keydown',e=>{if(running||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();queue(e.key==='ArrowRight'?1:-1,e)});
  }
  function queue(turn,e){if(!(air.turns||[-1,1]).includes(turn))return;pending=norm(rotation+turn);sync(pending,true);onMove?.(air.id,e)}
  function sync(r,snapped){
    const dir=air.directionByRotation?.[String(r)],angle=ANG[dir]??r*90;
    control.querySelector('.maze-air-fan').style.transform=`rotate(${r*90}deg)`;
    control.querySelector('.maze-air-arrow').style.setProperty('--air-angle',`${angle}deg`);
    control.classList.toggle('snapped',snapped);
    stream.style.transform=`rotate(${angle}deg)`;
  }

  function commit(id){
    if(running||id!==air.id||pending==null)return{accepted:false};
    running=true;rotation=pending;pending=null;board.classList.add('air-armed');
    control.querySelector('.maze-air-fan').src=A.tiles.fanSpinning;
    const start=board.querySelector('.maze-start-art');if(start)start.src=A.tiles.startSocketActive;
    onStatus?.(logic.copy?.running||'Fan locked. Watch the drop.');onEffect?.('power');later(run,360);
    return{accepted:true,effectHandled:true};
  }

  function run(){
    const dir=air.directionByRotation?.[String(rotation)],safe=dir===air.safeDirection;
    const lip=air.lip,target=safe?air.safeLanding:air.badLanding;
    ball.classList.add('running');onEffect?.('roll-start');
    moveBall(point(maze.start.x,maze.start.y),point(lip.x,lip.y),390,'roll',()=>fall(dir,target,safe));
  }
  function fall(dir,target,safe){
    ball.classList.remove('running');ball.classList.add('airborne');onEffect?.('roll-brake');onEffect?.('drive');
    onStatus?.(dir===air.safeDirection?(logic.copy?.carry||'Crosswind is carrying the ball toward the landing rail.'):(logic.copy?.drift||'The crosswind is pushing the ball off the safe landing.'));
    const from=point(air.lip.x,air.lip.y),to=point(target.x,target.y),start=performance.now(),duration=880;
    const tick=now=>{
      if(destroyed)return;const t=Math.min(1,(now-start)/duration),fallT=t*t*(3-2*t),drift=1-Math.pow(1-t,2);
      ball.style.left=`${from.x+(to.x-from.x)*drift}%`;ball.style.top=`${from.y+(to.y-from.y)*fallT}%`;
      ball.style.setProperty('--roll',`${t*310}deg`);ball.style.transform=`translate(-50%,-50%) rotate(var(--roll,0deg)) scale(${1+.055*Math.sin(Math.PI*t)})`;
      if(t<1)raf=requestAnimationFrame(tick);else land(target,safe);
    };raf=requestAnimationFrame(tick);
  }
  function land(target,safe){
    ball.classList.remove('airborne');ball.classList.add('air-landed');ball.style.transform='translate(-50%,-50%) rotate(var(--roll,0deg))';
    const slot=nodes.get(`${target.x},${target.y}`);onEffect?.('track-tick');
    if(!safe){const pit=slot?.querySelector('.maze-pit-art');if(pit)pit.src=A.tiles.pitFail;ball.classList.add('failed');onEffect?.('fail-soft');const msg=logic.copy?.pit||'The wind dropped the ball into the pit.';onStatus?.(msg);later(()=>onFail?.(msg),560);return;}
    board.classList.add('air-correct');const fx=art(slot,'maze-air-landing',A.fx.springDust);later(()=>fx.remove(),650);onEffect?.('roll-resume');
    collect(target.x,target.y);onStatus?.(logic.copy?.landing||'Clean landing.');later(()=>rollToGoal(target),250);
  }
  function rollToGoal(fromCell){
    const goalCell=maze.cells.find(c=>c.goal);if(!goalCell)return finishSuccess();
    ball.classList.add('running');moveBall(point(fromCell.x,fromCell.y),point(goalCell.x,goalCell.y),420,'roll',finishSuccess);
  }
  function collect(x,y){const star=nodes.get(`${x},${y}`)?.querySelector('.maze-star-art');if(!star||star.dataset.collected)return;star.dataset.collected='1';star.src=A.objects.starCollect;star.classList.add('collecting');onStar?.();later(()=>star.remove(),260)}
  function finishSuccess(){ball.classList.remove('running');board.classList.add('maze-solved');const goal=board.querySelector('.maze-goal-art');if(goal)goal.src=A.objects.goalSuccess;onStatus?.(logic.copy?.complete||'Crosswind landing solved.');onEffect?.('roll-goal');onEffect?.('goal');later(()=>onGoal?.(),logic.timings?.resultDelay||620)}
  function moveBall(from,to,duration,mode,done){const start=performance.now();const tick=now=>{if(destroyed)return;const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);ball.style.left=`${from.x+(to.x-from.x)*e}%`;ball.style.top=`${from.y+(to.y-from.y)*e}%`;if(mode==='roll')ball.style.setProperty('--roll',`${t*190}deg`);if(t<1)raf=requestAnimationFrame(tick);else done?.()};raf=requestAnimationFrame(tick)}
  function point(x,y){const br=board.getBoundingClientRect(),sr=nodes.get(`${x},${y}`)?.getBoundingClientRect();if(!br.width||!sr)return{x:10+(x+.5)*16,y:10+(y+.5)*16};return{x:(sr.left-br.left+sr.width/2)/br.width*100,y:(sr.top-br.top+sr.height/2)/br.height*100}}
  function place(x,y){const p=point(x,y);ball.style.left=`${p.x}%`;ball.style.top=`${p.y}%`}
  function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);if(!destroyed)fn()},ms);timers.add(id)}
  function destroy(){destroyed=true;if(raf)cancelAnimationFrame(raf);timers.forEach(clearTimeout);timers.clear();world.innerHTML='';stage.classList.remove('maze-stage')}
  return{commit,destroy,board,nodes};
}
