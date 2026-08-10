import './mazeRuntime.css';
import './mazeFieldRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const D=['N','E','S','W'],S={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]},O={N:'S',E:'W',S:'N',W:'E'};
const BASE={straight:['N','S'],corner:['N','E'],tee:['N','E','S'],cross:['N','E','S','W']};
const ART={straight:A.tiles.railStraightV,corner:A.tiles.railCornerNe,tee:A.tiles.railTeeNes,cross:A.tiles.railCross};
const ANG={N:0,E:90,S:180,W:270};
const norm=v=>((v%4)+4)%4;

export function mountMazeMagnetRuntime({world,stage,level,onMove,onStar,onGoal,onFail,onEffect,onStatus}){
  const logic=getMachineLogic(level.id),maze=logic?.maze,field=maze?.field;
  if(!maze||maze.mode!=='magnet-field'||!field)throw new Error(`Level ${level.id} has no magnet maze`);
  let destroyed=false,running=false,pending=null,rotation=field.initialRotation||0,raf=0;
  const timers=new Set(),nodes=new Map(),map=new Map(maze.cells.map(c=>[`${c.x},${c.y}`,c]));

  world.innerHTML='';
  const board=document.createElement('div');board.className='machine-board maze-board maze-field-board';board.dataset.mazeLevel=level.id;
  board.innerHTML=`<img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt=""><div class="maze-deck"></div><div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div><img class="maze-ball" src="${A.objects.ballSteelA}" alt=""><div class="maze-caption">ONE MOVE · TURN THE FIELD</div>`;
  world.appendChild(board);stage.classList.add('maze-stage');
  const grid=board.querySelector('.maze-grid'),ball=board.querySelector('.maze-ball');
  for(let y=0;y<maze.rows;y++)for(let x=0;x<maze.cols;x++){const slot=document.createElement('div');slot.className='maze-slot';slot.style.gridColumn=x+1;slot.style.gridRow=y+1;slot.innerHTML=`<img class="maze-slot-base" src="${A.tiles.baseSteelDark}" alt="">`;grid.appendChild(slot);nodes.set(`${x},${y}`,slot);}
  for(const c of maze.cells)render(c);
  let control;
  control=buildControl();
  sync(rotation,false);
  requestAnimationFrame(()=>place(maze.start.x,maze.start.y));
  onStatus?.(logic.copy?.ready||'Read the fork, then aim the magnetic field.');

  function render(c){const slot=nodes.get(`${c.x},${c.y}`);if(!slot)return;if(c.hazard){art(slot,'maze-pit-art',A.tiles.pitIdle);return;}const tile=document.createElement('div');tile.className='maze-tile';tile.dataset.id=c.id||'';tile.style.setProperty('--angle',`${(c.rotation||0)*90}deg`);tile.innerHTML=`<img class="maze-rail-art" src="${ART[c.type]||A.tiles.baseWood}" alt="">`;slot.appendChild(tile);if(c.start)art(slot,'maze-start-art',A.tiles.startSocketIdle);if(c.star)art(slot,'maze-star-art',A.objects.starIdle);if(c.goal)art(slot,'maze-goal-art',A.objects.goalIdle);}
  function art(slot,cls,src){const e=document.createElement('img');e.className=cls;e.src=src;e.alt='';e.draggable=false;slot.appendChild(e);return e;}
  function buildControl(){const slot=nodes.get(`${field.x},${field.y}`);if(!slot)throw new Error('Magnet control is outside the maze grid');const b=document.createElement('button');b.className='maze-field-control';b.dataset.id=field.id;b.innerHTML=`<img class="maze-field-dial" src="${A.tiles.rotatableIdle}" alt=""><img class="maze-field-device" src="${A.tiles.magnetOff}" alt=""><i class="maze-field-arrow"></i>`;slot.appendChild(b);const target=maze.cells.find(c=>c.id===field.targetId);if(target)art(nodes.get(`${target.x},${target.y}`),'maze-field-fx',A.fx.magnetField);gesture(b);return b;}
  function gesture(b){let down=false,start=0;const angle=e=>{const r=b.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI};const delta=(v,o)=>((v-o+540)%360)-180;
    b.addEventListener('pointerdown',e=>{if(running)return;down=true;start=angle(e);b.classList.add('dragging');b.setPointerCapture?.(e.pointerId);onEffect?.('metal')});
    b.addEventListener('pointermove',e=>{if(!down||running)return;const q=delta(angle(e),start);b.querySelector('.maze-field-device').style.transform=`rotate(${rotation*90+q}deg)`});
    const end=e=>{if(!down||running)return;down=false;b.classList.remove('dragging');const q=delta(angle(e),start);if(Math.abs(q)<22){sync(rotation,false);return;}queue(q>0?1:-1,e)};b.addEventListener('pointerup',end);b.addEventListener('pointercancel',()=>{down=false;b.classList.remove('dragging');sync(rotation,false)});
    b.addEventListener('keydown',e=>{if(running||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();queue(e.key==='ArrowRight'?1:-1,e)});
  }
  function queue(turn,e){if(!(field.turns||[-1,1]).includes(turn))return;pending=norm(rotation+turn);sync(pending,true);onMove?.(field.id,e)}
  function sync(r,snapped){const dir=field.directionByRotation?.[String(r)],a=ANG[dir]??r*90;control?.querySelector('.maze-field-device')?.style.setProperty('transform',`rotate(${r*90}deg)`);control?.querySelector('.maze-field-arrow')?.style.setProperty('--field-angle',`${a}deg`);control?.classList.toggle('snapped',snapped)}
  function commit(id){if(running||id!==field.id||pending==null)return{accepted:false};running=true;rotation=pending;pending=null;board.classList.add('field-armed');control.querySelector('.maze-field-device').src=A.tiles.magnetActive;const start=board.querySelector('.maze-start-art');if(start)start.src=A.tiles.startSocketActive;onStatus?.(logic.copy?.running||'Field locked. Watch the steel ball.');onEffect?.('power');later(run,360);return{accepted:true,effectHandled:true}}

  function links(c){return(BASE[c.type]||[]).map(d=>D[(D.indexOf(d)+(c.rotation||0))%4])}
  function solve(){const path=[{x:maze.start.x,y:maze.start.y}],seen=new Set();let x=maze.start.x,y=maze.start.y,dir=maze.start.dir;
    for(let i=0;i<64;i++){const key=`${x},${y},${dir}`;if(seen.has(key))return{path,success:false,reason:'loop'};seen.add(key);const[dx,dy]=S[dir];x+=dx;y+=dy;const c=map.get(`${x},${y}`),step={x,y};path.push(step);if(!c)return{path,success:false,reason:'broken'};if(c.hazard)return{path,success:false,reason:'pit'};if(c.star)step.star=true;if(c.goal)return{path,success:true,reason:'goal'};const l=links(c),entry=O[dir];if(!l.includes(entry))return{path,success:false,reason:'broken'};const exits=l.filter(d=>d!==entry);if(c.id===field.targetId){const chosen=field.directionByRotation?.[String(rotation)];if(!exits.includes(chosen))return{path,success:false,reason:'field'};dir=chosen;step.field=chosen}else dir=exits.includes(dir)?dir:exits[0];}return{path,success:false,reason:'loop'}}
  function run(){const r=solve();ball.classList.add('running');onEffect?.('roll-start');animate(r.path,0,r)}
  function animate(path,i,result){if(destroyed)return;if(i>=path.length-1){finish(result);return}const a=path[i],b=path[i+1],p=point(a.x,a.y),q=point(b.x,b.y),start=performance.now();if(a.field){ball.classList.add(a.field==='N'?'field-captured':'field-repelled');onStatus?.(a.field==='N'?(logic.copy?.capture||'Magnet pulled the steel ball upward.'):(logic.copy?.repel||'Magnet pulled the steel ball toward the pit.'))}
    const tick=now=>{const t=Math.min(1,(now-start)/320),e=1-Math.pow(1-t,3);ball.style.left=`${p.x+(q.x-p.x)*e}%`;ball.style.top=`${p.y+(q.y-p.y)*e}%`;ball.style.setProperty('--roll',`${(i+t)*190}deg`);if(t<1)raf=requestAnimationFrame(tick);else{if(b.star)collect(b.x,b.y);onEffect?.('track-tick');animate(path,i+1,result)}};raf=requestAnimationFrame(tick)}
  function collect(x,y){const s=nodes.get(`${x},${y}`)?.querySelector('.maze-star-art');if(!s||s.dataset.collected)return;s.dataset.collected='1';s.src=A.objects.starCollect;onStar?.();later(()=>s.remove(),260)}
  function finish(r){ball.classList.remove('running');if(r.success){board.classList.add('maze-solved');const g=board.querySelector('.maze-goal-art');if(g)g.src=A.objects.goalSuccess;onStatus?.(logic.copy?.complete||'Magnetic route solved.');onEffect?.('goal');later(()=>onGoal?.(),logic.timings?.resultDelay||600);return}if(r.reason==='pit'){const e=r.path.at(-1),pit=nodes.get(`${e.x},${e.y}`)?.querySelector('.maze-pit-art');if(pit)pit.src=A.tiles.pitFail}ball.classList.add('failed');onEffect?.('fail-soft');const msg=r.reason==='pit'?(logic.copy?.pit||'The field pulled the ball into the pit.'):(logic.copy?.wrong||'That field direction misses the goal.');onStatus?.(msg);later(()=>onFail?.(msg),560)}
  function point(x,y){const br=board.getBoundingClientRect(),sr=nodes.get(`${x},${y}`)?.getBoundingClientRect();if(!br.width||!sr)return{x:10+(x+.5)*16,y:10+(y+.5)*16};return{x:(sr.left-br.left+sr.width/2)/br.width*100,y:(sr.top-br.top+sr.height/2)/br.height*100}}
  function place(x,y){const p=point(x,y);ball.style.left=`${p.x}%`;ball.style.top=`${p.y}%`}
  function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);if(!destroyed)fn()},ms);timers.add(id)}
  function destroy(){destroyed=true;if(raf)cancelAnimationFrame(raf);timers.forEach(clearTimeout);timers.clear();world.innerHTML='';stage.classList.remove('maze-stage')}
  return{commit,destroy,board,nodes}
}
