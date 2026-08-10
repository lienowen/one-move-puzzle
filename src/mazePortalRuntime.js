import './mazeRuntime.css';
import './mazePortalRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const ART={straight:A.tiles.railStraightV,corner:A.tiles.railCornerNe,tee:A.tiles.railTeeNes,cross:A.tiles.railCross};
const DIR={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
const ANG={N:0,E:90,S:180,W:270};
const norm=v=>((v%4)+4)%4;

export function mountMazePortalRuntime({world,stage,level,onMove,onStar,onGoal,onFail,onEffect,onStatus}){
  const logic=getMachineLogic(level.id),maze=logic?.maze,portal=maze?.portal;
  if(!maze||maze.mode!=='portal-relay'||!portal)throw new Error(`Level ${level.id} has no portal relay`);
  let destroyed=false,running=false,pending=null,rotation=portal.initialRotation||0,raf=0,gateOpen=false;
  const timers=new Set(),nodes=new Map(),cells=new Map(maze.cells.map(c=>[`${c.x},${c.y}`,c]));

  world.innerHTML='';
  const board=document.createElement('div');board.className='machine-board maze-board maze-portal-board';board.dataset.mazeLevel=level.id;
  board.innerHTML=`<img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt=""><div class="maze-deck"></div><div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div><img class="maze-ball" src="${A.objects.ballBlue}" alt=""><div class="maze-caption">ONE MOVE · AIM THE EXIT PORTAL</div>`;
  world.appendChild(board);stage.classList.add('maze-stage');
  const grid=board.querySelector('.maze-grid'),ball=board.querySelector('.maze-ball');

  for(let y=0;y<maze.rows;y++)for(let x=0;x<maze.cols;x++){
    const slot=document.createElement('div');slot.className='maze-slot';slot.style.gridColumn=x+1;slot.style.gridRow=y+1;slot.innerHTML=`<img class="maze-slot-base" src="${A.tiles.baseSteelDark}" alt="">`;grid.appendChild(slot);nodes.set(`${x},${y}`,slot);
  }
  for(const cell of maze.cells)renderCell(cell);
  const control=buildExitControl();sync(rotation,false);
  requestAnimationFrame(()=>place(maze.prePath[0]));
  onStatus?.(logic.copy?.ready||'Trace both portal exits before you turn one.');

  function renderCell(c){
    const slot=nodes.get(`${c.x},${c.y}`);if(!slot)return;
    if(c.type){const tile=document.createElement('div');tile.className='maze-tile';tile.dataset.id=c.id||'';tile.style.setProperty('--angle',`${(c.rotation||0)*90}deg`);tile.innerHTML=`<img class="maze-rail-art" src="${ART[c.type]||A.tiles.baseWood}" alt="">`;slot.appendChild(tile);}
    if(c.start)art(slot,'maze-start-art',A.tiles.startSocketIdle);
    if(c.feature==='portal-entry'){const e=art(slot,'maze-portal-entry-art',A.tiles.portalBlue);e.dataset.id='entryPortal';}
    if(c.feature==='pad'){const p=art(slot,'maze-relay-pad',A.tiles.pressurePadUp);p.dataset.id=maze.pad.id;}
    if(c.feature==='gate'){const g=art(slot,'maze-relay-gate',A.tiles.gateClosed);g.dataset.id=maze.gate.id;}
    if(c.star){const s=art(slot,'maze-star-art',A.objects.starIdle);s.dataset.id='relay-star';}
    if(c.goal){const g=art(slot,'maze-goal-art',A.objects.goalIdle);g.dataset.id='goal';}
  }
  function art(slot,cls,src){const e=document.createElement('img');e.className=cls;e.src=src;e.alt='';e.draggable=false;slot.appendChild(e);return e;}

  function buildExitControl(){
    const slot=nodes.get(`${portal.exit.x},${portal.exit.y}`),b=document.createElement('button');b.className='maze-portal-exit-control';b.dataset.id=portal.id;
    b.innerHTML=`<img class="maze-portal-dial" src="${A.tiles.rotatableIdle}" alt=""><img class="maze-portal-exit-art" src="${A.tiles.portalPurple}" alt=""><i class="maze-portal-arrow"></i>`;slot.appendChild(b);gesture(b);return b;
  }
  function gesture(b){
    let down=false,start=0;
    const angle=e=>{const r=b.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI};
    const delta=(v,o)=>((v-o+540)%360)-180;
    b.addEventListener('pointerdown',e=>{if(running)return;down=true;start=angle(e);b.classList.add('dragging');b.setPointerCapture?.(e.pointerId);onEffect?.('metal')});
    b.addEventListener('pointermove',e=>{if(!down||running)return;const q=delta(angle(e),start);b.querySelector('.maze-portal-exit-art').style.transform=`rotate(${rotation*90+q}deg)`});
    const end=e=>{if(!down||running)return;down=false;b.classList.remove('dragging');const q=delta(angle(e),start);if(Math.abs(q)<22){sync(rotation,false);return}queue(q>0?1:-1,e)};
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',()=>{down=false;b.classList.remove('dragging');sync(rotation,false)});
    b.addEventListener('keydown',e=>{if(running||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();queue(e.key==='ArrowRight'?1:-1,e)});
  }
  function queue(turn,e){if(!(portal.turns||[-1,1]).includes(turn))return;pending=norm(rotation+turn);sync(pending,true);onMove?.(portal.id,e);}
  function selectedRoute(r){return portal.routeByRotation?.[String(r)]||null;}
  function routeDirection(r){const name=selectedRoute(r),route=maze.routes?.[name];if(!route||route.length<2)return null;return direction(route[0],route[1]);}
  function direction(a,b){const dx=b.x-a.x,dy=b.y-a.y;for(const[d,[x,y]]of Object.entries(DIR))if(dx===x&&dy===y)return d;return null;}
  function sync(r,snapped){
    const d=routeDirection(r),angle=ANG[d]??r*90;
    control.querySelector('.maze-portal-exit-art').style.transform=`rotate(${r*90}deg)`;
    control.querySelector('.maze-portal-arrow').style.setProperty('--portal-angle',`${angle}deg`);
    control.classList.toggle('snapped',snapped);
  }

  function commit(id){
    if(running||id!==portal.id||pending==null)return{accepted:false};
    running=true;rotation=pending;pending=null;
    const start=board.querySelector('.maze-start-art');if(start)start.src=A.tiles.startSocketActive;
    onStatus?.(logic.copy?.running||'Exit portal locked. Follow the transfer.');onEffect?.('metal');later(run,320);
    return{accepted:true,effectHandled:true};
  }
  function run(){ball.classList.add('running');onEffect?.('roll-start');animatePath(maze.prePath,0,teleport);}

  function animatePath(route,index,done){
    if(destroyed)return;if(index>=route.length-1){done?.();return;}
    const from=route[index],to=route[index+1],a=point(from),b=point(to),start=performance.now(),duration=220;
    const tick=now=>{if(destroyed)return;const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);ball.style.left=`${a.x+(b.x-a.x)*e}%`;ball.style.top=`${a.y+(b.y-a.y)*e}%`;ball.style.setProperty('--roll',`${(index+t)*180}deg`);if(t<1)raf=requestAnimationFrame(tick);else{onEffect?.('track-tick');animatePath(route,index+1,done);}};raf=requestAnimationFrame(tick);
  }

  function teleport(){
    ball.classList.remove('running');board.classList.add('portal-live');ball.classList.add('portal-out');onEffect?.('power');
    later(()=>{
      ball.classList.remove('portal-out');place(portal.exit);ball.classList.add('portal-in');onStatus?.(logic.copy?.teleport||'Transferred through the portal.');
      later(()=>{ball.classList.remove('portal-in');board.classList.remove('portal-live');ball.classList.add('running');const name=selectedRoute(rotation),route=maze.routes?.[name];if(!route)return fail('The exit portal points nowhere.');animateBranch(route,0);},240);
    },220);
  }

  function animateBranch(route,index){
    if(destroyed)return;if(index>=route.length-1){finishSuccess();return;}
    const from=route[index],to=route[index+1],a=point(from),b=point(to),start=performance.now(),duration=235;
    const tick=now=>{if(destroyed)return;const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);ball.style.left=`${a.x+(b.x-a.x)*e}%`;ball.style.top=`${a.y+(b.y-a.y)*e}%`;ball.style.setProperty('--roll',`${(index+t+4)*185}deg`);if(t<1)raf=requestAnimationFrame(tick);else arrive(route,index+1);};raf=requestAnimationFrame(tick);
    function arrive(r,i){const p=r[i],cell=cells.get(`${p.x},${p.y}`);if(cell?.feature==='pad'){pressPad();later(()=>animateBranch(r,i),180);return;}if(cell?.feature==='gate'){if(!gateOpen){blockGate();return;}onStatus?.(logic.copy?.gate||'The gate is open on the return route.');onEffect?.('metal');}if(cell?.star)collect(p);if(cell?.goal){finishSuccess();return;}onEffect?.('track-tick');animateBranch(r,i);}
  }

  function pressPad(){
    if(board.classList.contains('relay-pad-pressed'))return;
    board.classList.add('relay-pad-pressed');const pad=board.querySelector('.maze-relay-pad'),gate=board.querySelector('.maze-relay-gate');if(pad)pad.src=A.tiles.pressurePadPressed;if(gate)gate.src=A.tiles.gateOpening;
    onStatus?.(logic.copy?.pad||'Pressure pad engaged.');onEffect?.('button');later(()=>{gateOpen=true;board.classList.add('relay-gate-open');if(gate)gate.src=A.tiles.gateOpen;onEffect?.('gate-open');},220);
  }
  function blockGate(){
    board.classList.add('relay-gate-blocked');ball.classList.remove('running');ball.classList.add('relay-hit');onEffect?.('roll-brake');onEffect?.('metal');const msg=logic.copy?.blocked||'The shortcut reached the gate too early.';onStatus?.(msg);later(()=>{onEffect?.('fail-soft');onFail?.(msg);},620);
  }
  function collect(p){const star=nodes.get(`${p.x},${p.y}`)?.querySelector('.maze-star-art');if(!star||star.dataset.collected)return;star.dataset.collected='1';star.src=A.objects.starCollect;star.classList.add('collecting');onStar?.();later(()=>star.remove(),260);}
  function finishSuccess(){ball.classList.remove('running');board.classList.add('maze-solved');const goal=board.querySelector('.maze-goal-art');if(goal)goal.src=A.objects.goalSuccess;onStatus?.(logic.copy?.complete||'Portal relay complete.');onEffect?.('roll-goal');onEffect?.('goal');later(()=>onGoal?.(),logic.timings?.resultDelay||650);}
  function fail(msg){ball.classList.remove('running');onEffect?.('fail-soft');onStatus?.(msg);later(()=>onFail?.(msg),560);}
  function point(p){const br=board.getBoundingClientRect(),sr=nodes.get(`${p.x},${p.y}`)?.getBoundingClientRect();if(!br.width||!sr)return{x:10+(p.x+.5)*16,y:10+(p.y+.5)*16};return{x:(sr.left-br.left+sr.width/2)/br.width*100,y:(sr.top-br.top+sr.height/2)/br.height*100};}
  function place(p){const q=point(p);ball.style.left=`${q.x}%`;ball.style.top=`${q.y}%`;}
  function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);if(!destroyed)fn();},ms);timers.add(id);}
  function destroy(){destroyed=true;if(raf)cancelAnimationFrame(raf);timers.forEach(clearTimeout);timers.clear();world.innerHTML='';stage.classList.remove('maze-stage');}
  return{commit,destroy,board,nodes};
}
