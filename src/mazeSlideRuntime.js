import './mazeRuntime.css';
import './mazeSlideRuntime.css';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { MAZE_ASSETS as A } from './mazeAssets.js';
import { getMachineLogic } from './machineLogic.js';

const DIRS=['N','E','S','W'];
const STEP={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
const OPP={N:'S',E:'W',S:'N',W:'E'};
const BASE={straight:['N','S'],corner:['N','E'],tee:['N','E','S'],cross:['N','E','S','W']};
const ART={straight:A.tiles.railStraightV,corner:A.tiles.railCornerNe,tee:A.tiles.railTeeNes,cross:A.tiles.railCross};

export function mountMazeSlideRuntime({world,stage,level,onMove,onStar,onGoal,onFail,onEffect,onStatus}){
  const logic=getMachineLogic(level.id); const maze=logic?.maze; const slide=maze?.slide;
  if(!maze||maze.mode!=='slide-row'||!slide) throw new Error(`Level ${level.id} has no slide-row maze`);
  let destroyed=false,running=false,pending=0,offset=slide.initialOffset||0,frameId=0;
  const timers=new Set(),nodes=new Map(),slideArts=new Map();
  const staticCells=maze.cells.filter(c=>!(slide.ids||[]).includes(c.id));
  const slideCells=(slide.ids||[]).map(id=>maze.cells.find(c=>c.id===id)).filter(Boolean);

  world.innerHTML='';
  const board=document.createElement('div');
  board.className='machine-board maze-board maze-slide-board'; board.dataset.mazeLevel=level.id;
  board.innerHTML=`<img class="machine-board-base" src="${W.base.boardWorkshopBase}" alt="" draggable="false"><div class="maze-deck"></div><div class="maze-grid" style="--cols:${maze.cols};--rows:${maze.rows}"></div><img class="maze-ball" src="${A.objects.ballBlue}" alt="" draggable="false"><div class="maze-caption">ONE MOVE · SLIDE ONE ROW</div>`;
  world.appendChild(board); stage.classList.add('maze-stage');
  const grid=board.querySelector('.maze-grid'),ball=board.querySelector('.maze-ball');
  for(let y=0;y<maze.rows;y++) for(let x=0;x<maze.cols;x++){
    const slot=document.createElement('div'); slot.className='maze-slot'; slot.style.gridColumn=String(x+1); slot.style.gridRow=String(y+1); slot.dataset.x=x; slot.dataset.y=y;
    slot.innerHTML=`<img class="maze-slot-base" src="${A.tiles.baseSteelDark}" alt="" draggable="false">`; grid.appendChild(slot); nodes.set(`${x},${y}`,slot);
  }
  for(const cell of staticCells) renderStatic(cell);
  renderSlideRow();
  requestAnimationFrame(()=>placeBall(maze.start.x,maze.start.y));
  onStatus?.(logic.copy?.ready||'Read all three tiles before sliding the row.');

  function renderStatic(cell){
    const slot=nodes.get(`${cell.x},${cell.y}`); if(!slot)return;
    if(cell.hazard){ append(slot,'maze-pit-art',A.tiles.pitIdle); return; }
    const tile=document.createElement('div'); tile.className='maze-tile'; tile.dataset.id=cell.id||''; tile.dataset.type=cell.type||'straight'; tile.style.setProperty('--angle',`${(cell.rotation||0)*90}deg`);
    tile.innerHTML=`<img class="maze-rail-art" src="${ART[cell.type]||A.tiles.baseWood}" alt="" draggable="false">`; slot.appendChild(tile);
    if(cell.start) append(slot,'maze-start-art',A.tiles.startSocketIdle);
    if(cell.star) append(slot,'maze-star-art',A.objects.starIdle);
    if(cell.goal) append(slot,'maze-goal-art',A.objects.goalIdle);
  }
  function append(slot,cls,src){ const el=document.createElement('img'); el.className=cls; el.src=src; el.alt=''; el.draggable=false; slot.appendChild(el); return el; }

  function renderSlideRow(){
    const left=cellRectPercent(slide.minX,slide.row),right=cellRectPercent(slide.maxX,slide.row);
    const lane=document.createElement('div'); lane.className='maze-slide-lane'; setBox(lane,left.left,left.top,right.right-left.left,left.height); board.appendChild(lane);
    const control=document.createElement('button'); control.className='maze-slide-control'; control.dataset.id=slide.id||'slideRow'; setBox(control,left.left,left.top,right.right-left.left,left.height); control.setAttribute('aria-label','Slide the rail row'); board.appendChild(control);
    const cue=document.createElement('div'); cue.className='maze-slide-cue'; cue.innerHTML='<span>SLIDE</span><i></i><span>ONCE</span>'; setBox(cue,left.left,left.top-3,right.right-left.left,3); board.appendChild(cue);
    for(const cell of slideCells){
      const art=document.createElement('div'); art.className='maze-slide-tile'; art.dataset.slideId=cell.id; art.dataset.type=cell.type; art.innerHTML=`<img src="${ART[cell.type]||A.tiles.baseWood}" alt="" draggable="false">`; board.appendChild(art); slideArts.set(cell.id,art);
    }
    positionSlideTiles(0); installGesture(control);
  }

  function positionSlideTiles(visualDelta=0){
    const span=slide.maxX-slide.minX+1;
    for(const cell of slideCells){
      let local=((cell.x-slide.minX+offset)%span+span)%span;
      const x=slide.minX+local;
      const r=cellRectPercent(x,slide.row); const art=slideArts.get(cell.id);
      setBox(art,r.left+visualDelta,r.top,r.width,r.height); art.style.transform=`rotate(${(cell.rotation||0)*90}deg)`;
    }
  }

  function installGesture(control){
    let dragging=false,startX=0;
    control.addEventListener('pointerdown',e=>{if(running)return; dragging=true; startX=e.clientX; control.classList.add('dragging'); control.setPointerCapture?.(e.pointerId); onEffect?.('wood');});
    control.addEventListener('pointermove',e=>{if(!dragging||running)return; const rect=board.getBoundingClientRect(); const delta=Math.max(-7,Math.min(7,(e.clientX-startX)/rect.width*100)); positionSlideTiles(delta);});
    const finish=e=>{if(!dragging||running)return; dragging=false; control.classList.remove('dragging'); const dx=e.clientX-startX; if(Math.abs(dx)<28){positionSlideTiles(0);return;} queue(dx>0?1:-1,e);};
    control.addEventListener('pointerup',finish); control.addEventListener('pointercancel',()=>{dragging=false;control.classList.remove('dragging');positionSlideTiles(0);});
    control.addEventListener('keydown',e=>{if(running||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();queue(e.key==='ArrowRight'?1:-1,e);});
  }
  function queue(dir,event){ if(!(slide.moves||[-1,1]).includes(dir))return; pending=dir; const old=offset; offset=normOffset(offset+dir); board.classList.toggle('slide-right',dir>0); board.classList.toggle('slide-left',dir<0); board.classList.add('slide-snapped'); positionSlideTiles(0); offset=old; onMove?.(slide.id||'slideRow',event); }
  function commit(id){ if(running||!pending||id!==(slide.id||'slideRow'))return{accepted:false}; running=true; offset=normOffset(offset+pending); pending=0; positionSlideTiles(0); board.classList.add('maze-running'); const start=board.querySelector('.maze-start-art'); if(start)start.src=A.tiles.startSocketActive; onStatus?.(logic.copy?.running||'Row locked. Watch the route.'); onEffect?.('metal'); later(runMaze,380); return{accepted:true,effectHandled:true}; }
  function normOffset(v){const span=slide.maxX-slide.minX+1; return ((v%span)+span)%span;}

  function effectiveMap(){
    const map=new Map(staticCells.map(c=>[`${c.x},${c.y}`,c])); const span=slide.maxX-slide.minX+1;
    for(const cell of slideCells){const local=((cell.x-slide.minX+offset)%span+span)%span; map.set(`${slide.minX+local},${slide.row}`,cell);} return map;
  }
  function solve(){
    const map=effectiveMap(),path=[{x:maze.start.x,y:maze.start.y}],visited=new Set(); let x=maze.start.x,y=maze.start.y,dir=maze.start.dir;
    for(let i=0;i<64;i++){
      const state=`${x},${y},${dir}`; if(visited.has(state))return{path,success:false,reason:'loop'}; visited.add(state);
      const [dx,dy]=STEP[dir]; x+=dx;y+=dy; path.push({x,y}); const cell=map.get(`${x},${y}`); if(!cell)return{path,success:false,reason:'broken'}; if(cell.hazard)return{path,success:false,reason:'pit'}; if(cell.goal)return{path,success:true,reason:'goal'};
      const links=(BASE[cell.type]||[]).map(d=>DIRS[(DIRS.indexOf(d)+(cell.rotation||0))%4]); const entry=OPP[dir]; if(!links.includes(entry))return{path,success:false,reason:'broken'}; const exits=links.filter(d=>d!==entry); if(!exits.length)return{path,success:false,reason:'dead-end'}; dir=exits.includes(dir)?dir:exits[0];
    } return{path,success:false,reason:'loop'};
  }
  function runMaze(){const result=solve(); ball.classList.add('running');onEffect?.('roll-start'); animate(result.path,0,result);}
  function animate(path,index,result){
    if(destroyed)return; if(index>=path.length-1){finish(result);return;} const a=path[index],b=path[index+1],start=performance.now(),pa=point(a.x,a.y),pb=point(b.x,b.y);
    const tick=now=>{if(destroyed)return;const t=Math.min(1,(now-start)/315),e=1-Math.pow(1-t,3);ball.style.left=`${pa.x+(pb.x-pa.x)*e}%`;ball.style.top=`${pa.y+(pb.y-pa.y)*e}%`;ball.style.setProperty('--roll',`${(index+t)*180}deg`);if(t<1)frameId=requestAnimationFrame(tick);else{const cell=effectiveMap().get(`${b.x},${b.y}`);if(cell?.star)collectStar(b.x,b.y);onEffect?.('track-tick');animate(path,index+1,result);}}; frameId=requestAnimationFrame(tick);
  }
  function collectStar(x,y){const star=nodes.get(`${x},${y}`)?.querySelector('.maze-star-art');if(!star||star.dataset.collected)return;star.dataset.collected='1';star.src=A.objects.starCollect;star.classList.add('collecting');onStar?.();later(()=>star.remove(),260);}
  function finish(result){ball.classList.remove('running');board.classList.remove('maze-running');if(result.success){board.classList.add('maze-solved');const goal=board.querySelector('.maze-goal-art');if(goal)goal.src=A.objects.goalSuccess;onStatus?.(logic.copy?.complete||'Row aligned.');onEffect?.('goal');later(()=>onGoal?.(),logic.timings?.resultDelay||560);return;} if(result.reason==='pit'){const end=result.path.at(-1),slot=nodes.get(`${end.x},${end.y}`),pit=slot?.querySelector('.maze-pit-art');if(pit)pit.src=A.tiles.pitFail;} ball.classList.add('failed');onEffect?.('fail-soft');const msg=result.reason==='pit'?(logic.copy?.pit||'That shift feeds the pit.'):(logic.copy?.wrong||'The shifted row does not connect.');onStatus?.(msg);later(()=>onFail?.(msg),540);}

  function cellRectPercent(x,y){const br=board.getBoundingClientRect(),sr=nodes.get(`${x},${y}`)?.getBoundingClientRect();if(!br.width||!sr)return{left:10+x*16,top:10+y*16,width:16,height:16,right:26+x*16};const left=(sr.left-br.left)/br.width*100,top=(sr.top-br.top)/br.height*100,width=sr.width/br.width*100,height=sr.height/br.height*100;return{left,top,width,height,right:left+width};}
  function setBox(el,left,top,width,height){el.style.left=`${left}%`;el.style.top=`${top}%`;el.style.width=`${width}%`;el.style.height=`${height}%`;}
  function point(x,y){const r=cellRectPercent(x,y);return{x:r.left+r.width/2,y:r.top+r.height/2};}
  function placeBall(x,y){const p=point(x,y);ball.style.left=`${p.x}%`;ball.style.top=`${p.y}%`;}
  function later(fn,delay){const id=setTimeout(()=>{timers.delete(id);if(!destroyed)fn();},delay);timers.add(id);}
  function destroy(){destroyed=true;if(frameId)cancelAnimationFrame(frameId);timers.forEach(clearTimeout);timers.clear();world.innerHTML='';stage.classList.remove('maze-stage');}
  return{commit,destroy,board,nodes};
}
