import './mazeRuntime.css';
import './mazeOneWayRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const DIR={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
const ANG={N:0,E:90,S:180,W:270};
const norm=v=>((v%4)+4)%4;

export function mountMazeOneWayRuntime({world,stage,level,onMove,onStar,onGoal,onFail,onEffect,onStatus}){
  const logic=getMachineLogic(level.id),maze=logic?.maze,valve=maze?.oneWay,path=maze?.path||[];
  if(!maze||maze.mode!=='one-way-loop'||!valve||path.length<4)throw new Error(`Level ${level.id} has no one-way loop`);
  let destroyed=false,running=false,pending=null,rotation=valve.initialRotation||0,raf=0;
  const timers=new Set(),nodes=new Map();

  world.innerHTML='';
  const board=document.createElement('div');board.className='machine-board maze-board maze-oneway-board';board.dataset.mazeLevel=level.id;
  board.innerHTML=`<img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt=""><div class="maze-deck"></div><div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div><img class="maze-ball" src="${A.objects.ballBlue}" alt=""><div class="maze-caption">ONE MOVE · SET THE ONE-WAY VALVE</div>`;
  world.appendChild(board);stage.classList.add('maze-stage');
  const grid=board.querySelector('.maze-grid'),ball=board.querySelector('.maze-ball');

  for(let y=0;y<maze.rows;y++)for(let x=0;x<maze.cols;x++){
    const slot=document.createElement('div');slot.className='maze-slot';slot.style.gridColumn=x+1;slot.style.gridRow=y+1;slot.innerHTML=`<img class="maze-slot-base" src="${A.tiles.baseSteelDark}" alt="">`;grid.appendChild(slot);nodes.set(`${x},${y}`,slot);
  }

  path.forEach((point,index)=>renderPathPoint(point,index));
  const control=buildValveControl();sync(rotation,false);
  requestAnimationFrame(()=>place(path[0]));
  onStatus?.(logic.copy?.ready||'Trace the loop. Which way will the ball reach the valve?');

  function renderPathPoint(point,index){
    const slot=nodes.get(`${point.x},${point.y}`);if(!slot)return;
    const isValve=point.x===valve.x&&point.y===valve.y;
    if(!isValve){
      const shape=railShape(index);
      const tile=document.createElement('div');tile.className='maze-tile';tile.dataset.id=point.id||`loop-${index}`;tile.style.setProperty('--angle',`${shape.rotation*90}deg`);
      tile.innerHTML=`<img class="maze-rail-art" src="${shape.asset}" alt="">`;slot.appendChild(tile);
    }
    if(index===0){const start=art(slot,'maze-start-art',A.tiles.startSocketIdle);start.dataset.id='loop-start';}
    if(point.star){const star=art(slot,'maze-star-art',A.objects.starIdle);star.dataset.id='loop-star';}
    if(point.goal){const goal=art(slot,'maze-goal-art',A.objects.goalIdle);goal.dataset.id='goal';}
  }

  function railShape(index){
    const here=path[index],prev=path[index-1],next=path[index+1];
    const dirs=[];if(prev)dirs.push(direction(here,prev));if(next)dirs.push(direction(here,next));
    if(dirs.length<2){const d=dirs[0]||'E';return{asset:A.tiles.railStraightV,rotation:['E','W'].includes(d)?1:0};}
    const set=new Set(dirs);
    if(set.has('N')&&set.has('S'))return{asset:A.tiles.railStraightV,rotation:0};
    if(set.has('E')&&set.has('W'))return{asset:A.tiles.railStraightV,rotation:1};
    if(set.has('N')&&set.has('E'))return{asset:A.tiles.railCornerNe,rotation:0};
    if(set.has('E')&&set.has('S'))return{asset:A.tiles.railCornerNe,rotation:1};
    if(set.has('S')&&set.has('W'))return{asset:A.tiles.railCornerNe,rotation:2};
    return{asset:A.tiles.railCornerNe,rotation:3};
  }
  function direction(a,b){const dx=b.x-a.x,dy=b.y-a.y;for(const [d,[x,y]] of Object.entries(DIR))if(dx===x&&dy===y)return d;return null;}
  function art(slot,cls,src){const e=document.createElement('img');e.className=cls;e.src=src;e.alt='';e.draggable=false;slot.appendChild(e);return e;}

  function buildValveControl(){
    const slot=nodes.get(`${valve.x},${valve.y}`),b=document.createElement('button');b.className='maze-oneway-control';b.dataset.id=valve.id;
    b.innerHTML=`<img class="maze-oneway-dial" src="${A.tiles.rotatableIdle}" alt=""><img class="maze-oneway-rail" src="${A.tiles.oneWayRail}" alt=""><i class="maze-oneway-glyph"></i>`;slot.appendChild(b);gesture(b);return b;
  }
  function gesture(b){
    let down=false,start=0;
    const angle=e=>{const r=b.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI};
    const delta=(v,o)=>((v-o+540)%360)-180;
    b.addEventListener('pointerdown',e=>{if(running)return;down=true;start=angle(e);b.classList.add('dragging');b.setPointerCapture?.(e.pointerId);onEffect?.('metal')});
    b.addEventListener('pointermove',e=>{if(!down||running)return;const q=delta(angle(e),start);b.querySelector('.maze-oneway-rail').style.transform=`rotate(${rotation*90+q}deg)`});
    const end=e=>{if(!down||running)return;down=false;b.classList.remove('dragging');const q=delta(angle(e),start);if(Math.abs(q)<22){sync(rotation,false);return}queue(q>0?1:-1,e)};
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',()=>{down=false;b.classList.remove('dragging');sync(rotation,false)});
    b.addEventListener('keydown',e=>{if(running||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();queue(e.key==='ArrowRight'?1:-1,e)});
  }
  function queue(turn,e){if(!(valve.turns||[-1,1]).includes(turn))return;pending=norm(rotation+turn);sync(pending,true);onMove?.(valve.id,e);}
  function sync(r,snapped){
    const allowed=valve.directionByRotation?.[String(r)],angle=ANG[allowed]??r*90;
    control.querySelector('.maze-oneway-rail').style.transform=`rotate(${r*90}deg)`;
    control.querySelector('.maze-oneway-glyph').style.setProperty('--valve-angle',`${angle}deg`);
    control.classList.toggle('snapped',snapped);
  }

  function commit(id){
    if(running||id!==valve.id||pending==null)return{accepted:false};
    running=true;rotation=pending;pending=null;board.classList.add('valve-armed');
    const start=board.querySelector('.maze-start-art');if(start)start.src=A.tiles.startSocketActive;
    onStatus?.(logic.copy?.running||'Valve set. Now follow the whole loop.');onEffect?.('metal');later(run,320);
    return{accepted:true,effectHandled:true};
  }

  function run(){ball.classList.add('running');onEffect?.('roll-start');animateSegment(0);}
  function animateSegment(index){
    if(destroyed)return;
    if(index>=path.length-1){finishSuccess();return;}
    const from=path[index],to=path[index+1],fromP=point(from),toP=point(to),start=performance.now();
    const approachingValve=to.x===valve.x&&to.y===valve.y;
    const duration=index<2?210:index<16?145:175;
    const tick=now=>{
      if(destroyed)return;const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);
      ball.style.left=`${fromP.x+(toP.x-fromP.x)*e}%`;ball.style.top=`${fromP.y+(toP.y-fromP.y)*e}%`;ball.style.setProperty('--roll',`${(index+t)*165}deg`);
      if(t<1)raf=requestAnimationFrame(tick);else{
        if(approachingValve){checkValve(index+1);return;}
        const arrived=path[index+1];if(arrived.star)collect(arrived);onEffect?.('track-tick');animateSegment(index+1);
      }
    };raf=requestAnimationFrame(tick);
  }
  function checkValve(valveIndex){
    const prev=path[valveIndex-1],here=path[valveIndex],arrival=direction(prev,here),allowed=valve.directionByRotation?.[String(rotation)];
    if(allowed!==arrival){
      board.classList.add('valve-blocked');ball.classList.remove('running');ball.classList.add('valve-hit');onEffect?.('roll-brake');onEffect?.('metal');
      const msg=logic.copy?.blocked||'The ball returned against the one-way valve.';onStatus?.(msg);later(()=>{onEffect?.('fail-soft');onFail?.(msg);},650);return;
    }
    board.classList.add('valve-open');ball.classList.add('valve-pass');onEffect?.('metal');onStatus?.(logic.copy?.open||'Correct direction. The valve opened on the return pass.');later(()=>{ball.classList.remove('valve-pass');animateSegment(valveIndex);},180);
  }
  function collect(p){const star=nodes.get(`${p.x},${p.y}`)?.querySelector('.maze-star-art');if(!star||star.dataset.collected)return;star.dataset.collected='1';star.src=A.objects.starCollect;star.classList.add('collecting');onStar?.();later(()=>star.remove(),260);}
  function finishSuccess(){ball.classList.remove('running');board.classList.add('maze-solved');const goal=board.querySelector('.maze-goal-art');if(goal)goal.src=A.objects.goalSuccess;onEffect?.('roll-goal');onEffect?.('goal');onStatus?.(logic.copy?.complete||'The loop returned in the direction you predicted.');later(()=>onGoal?.(),logic.timings?.resultDelay||620);}
  function point(p){const br=board.getBoundingClientRect(),sr=nodes.get(`${p.x},${p.y}`)?.getBoundingClientRect();if(!br.width||!sr)return{x:10+(p.x+.5)*16,y:10+(p.y+.5)*16};return{x:(sr.left-br.left+sr.width/2)/br.width*100,y:(sr.top-br.top+sr.height/2)/br.height*100};}
  function place(p){const q=point(p);ball.style.left=`${q.x}%`;ball.style.top=`${q.y}%`;}
  function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);if(!destroyed)fn();},ms);timers.add(id);}
  function destroy(){destroyed=true;if(raf)cancelAnimationFrame(raf);timers.forEach(clearTimeout);timers.clear();world.innerHTML='';stage.classList.remove('maze-stage');}
  return{commit,destroy,board,nodes};
}
