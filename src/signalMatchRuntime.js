import { getMachineLogic, machineRequirementsMet } from './machineLogic.js';

export function mountSignalMatchRuntime({ world, stage, level, onMove, onStar, onGoal, onFail, onEffect, onStatus }) {
  const scene = level.scene;
  const logic = getMachineLogic(level.id);
  if (!logic || logic.archetype !== 'signal-match') throw new Error(`Level ${level.id} is not a signal-match machine`);
  if (!scene?.path?.length) throw new Error(`Level ${level.id} is missing machine path data`);

  let destroyed = false;
  let running = false;
  let frameId = 0;
  const timers = new Set();
  const nodes = new Map();
  const pieces = new Map(scene.pieces.map(piece => [piece.id,piece]));
  const firedEvents = new Set();
  const sampledPath = buildSampledPath(scene.path);
  const state = { signalMatched:false, gateOpen:false };

  world.innerHTML = '';

  const board = document.createElement('div');
  board.className = 'machine-board signal-match-machine';
  board.setAttribute('aria-label', `${level.name} signal machine`);
  board.innerHTML = `
    <img class="machine-board-base" src="${scene.board}" alt="" draggable="false">
    <div class="machine-board-shade"></div>
    <div class="signal-match-deck" aria-hidden="true"></div>
    <svg class="machine-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="route-shadow"></path>
      <path class="route-bed"></path>
      <path class="route-rim"></path>
      <path class="route-channel"></path>
      <path class="route-light"></path>
      <path class="route-progress" pathLength="100"></path>
    </svg>
    <div class="signal-layer" aria-hidden="true"></div>
    <div class="machine-pieces"></div>
    <div class="machine-fx" aria-hidden="true"></div>
  `;
  world.appendChild(board);

  const routeD = sampledPathToD(sampledPath);
  board.querySelectorAll('.machine-route path').forEach(path => path.setAttribute('d',routeD));
  const routeProgress = board.querySelector('.route-progress');
  const piecesRoot = board.querySelector('.machine-pieces');

  scene.pieces.forEach(piece => {
    const node = document.createElement(piece.interactive ? 'button' : 'div');
    if (piece.interactive) node.type = 'button';
    node.className = `machine-piece piece-${piece.kind || 'decor'}${piece.interactive ? ' interactive' : ''}`;
    node.dataset.id = piece.id;
    node.style.left = `${piece.x}%`;
    node.style.top = `${piece.y}%`;
    node.style.width = `${piece.w}%`;
    node.style.zIndex = String(piece.z ?? 10);
    node.style.setProperty('--piece-rotation',`${piece.rotation || 0}deg`);
    node.innerHTML = `<img src="${piece.asset}" alt="" draggable="false">`;
    if (piece.interactive) {
      node.setAttribute('aria-label',piece.label || 'Send this signal');
      node.addEventListener('click',ev => onMove?.(piece.id,ev));
    }
    piecesRoot.appendChild(node);
    nodes.set(piece.id,node);
  });

  const ball = nodes.get('ball');
  const gate = nodes.get(logic.controls.target);
  if (!ball || !gate) throw new Error(`Level ${level.id} requires ball and gate pieces`);

  renderSignalTopology();

  function renderSignalTopology() {
    const layer = board.querySelector('.signal-layer');
    const receiverPiece = pieces.get(logic.controls.target);
    const correctPiece = pieces.get(logic.controls.correct);
    const decoyPiece = pieces.get(logic.controls.decoy);
    if (!receiverPiece || !correctPiece || !decoyPiece) throw new Error('Signal controls are missing from level data');

    const receiverPoint = {x:receiverPiece.x + 1,y:receiverPiece.y - 14};
    const receiver = document.createElement('div');
    receiver.className = 'signal-receiver';
    receiver.dataset.id = 'signalReceiver';
    receiver.style.left = `${receiverPoint.x}%`;
    receiver.style.top = `${receiverPoint.y}%`;
    receiver.innerHTML = `<span class="signal-receiver-label">INPUT</span><i class="signal-glyph glyph-${logic.signal.required}"></i>`;
    layer.appendChild(receiver);
    nodes.set('signalReceiver',receiver);

    addSignalChannel(layer,'correctSignal',correctPiece,receiverPoint,logic.signal.correct,'signal-channel correct-signal');
    addSignalChannel(layer,'decoySignal',decoyPiece,receiverPoint,logic.signal.decoy,'signal-channel decoy-signal');
    addTerminal(layer,'correctTerminal',correctPiece,logic.signal.correct);
    addTerminal(layer,'decoyTerminal',decoyPiece,logic.signal.decoy);
  }

  function addSignalChannel(root,id,from,to,shape,className) {
    const dx = to.x-from.x;
    const dy = to.y-from.y;
    const length = Math.hypot(dx,dy);
    const angle = Math.atan2(dy,dx)*180/Math.PI;
    const line = document.createElement('div');
    line.className = className;
    line.dataset.id = id;
    line.dataset.shape = shape;
    line.style.left = `${from.x}%`;
    line.style.top = `${from.y}%`;
    line.style.width = `${length}%`;
    line.style.setProperty('--signal-angle',`${angle}deg`);
    line.innerHTML = '<b></b><b></b><b></b><span></span>';
    root.appendChild(line);
    nodes.set(id,line);
  }

  function addTerminal(root,id,piece,shape) {
    const terminal = document.createElement('div');
    terminal.className = `signal-terminal terminal-${shape}`;
    terminal.dataset.id = id;
    terminal.style.left = `${piece.x}%`;
    terminal.style.top = `${piece.y - 8.5}%`;
    terminal.innerHTML = `<i class="signal-glyph glyph-${shape}"></i>`;
    root.appendChild(terminal);
    nodes.set(id,terminal);
  }

  function commit(id) {
    if (destroyed || running) return {accepted:false,correct:false,effectHandled:false};
    const piece = pieces.get(id);
    const node = nodes.get(id);
    if (!piece?.interactive || !node) return {accepted:false,correct:false,effectHandled:false};

    running = true;
    stage.classList.add('machine-running');
    disableControls();
    node.classList.add('action-press');

    if (id !== logic.controls.correct) {
      rejectSignal(node);
      return {accepted:true,correct:false,effectHandled:true};
    }

    acceptSignal(node);
    return {accepted:true,correct:true,effectHandled:true};
  }

  function rejectSignal(node) {
    board.classList.add('signal-sending','signal-rejecting');
    nodes.get('decoySignal')?.classList.add('signal-live','signal-rejected');
    nodes.get('decoyTerminal')?.classList.add('terminal-live');
    onStatus?.(logic.copy.wrong);
    onEffect?.('power');

    later(() => {
      nodes.get('signalReceiver')?.classList.add('receiver-reject');
      node.classList.add('action-wrong');
      onEffect?.('fail-soft');
    },logic.timings.receiverDelay);

    later(() => {
      if (!destroyed) onFail?.(logic.copy.wrong);
    },logic.timings.receiverDelay + 430);
  }

  function acceptSignal() {
    board.classList.add('signal-sending');
    nodes.get('correctSignal')?.classList.add('signal-live','signal-accepted');
    nodes.get('correctTerminal')?.classList.add('terminal-live');
    onStatus?.(logic.copy.correct);
    onEffect?.('power');

    later(() => {
      state.signalMatched = true;
      board.classList.add('signal-matched');
      nodes.get('signalReceiver')?.classList.add('receiver-match');
      onStatus?.(logic.copy.receiver);
      onEffect?.('trigger');
    },logic.timings.receiverDelay);

    later(() => {
      state.gateOpen = true;
      gate.classList.add('signal-gate-open','activated');
      board.classList.add('signal-route-open');
      onStatus?.(logic.copy.gate);
      onEffect?.('gate-open');
      sparkAtNode(gate,5);
    },logic.timings.gateOpenDelay);

    later(() => {
      if (!destroyed) runBall();
    },logic.timings.ballReleaseDelay);
  }

  function runBall() {
    const duration = scene.duration || 4000;
    const start = performance.now();
    ball.classList.add('running');
    onEffect?.('roll-start');

    const tick = now => {
      if (destroyed) return;
      const raw = Math.min(1,(now-start)/duration);
      const t = motionAt(raw);
      const point = pointOnSampledPath(sampledPath,t);
      const ahead = pointOnSampledPath(sampledPath,Math.min(1,t+.008));
      const angle = Math.atan2(ahead.y-point.y,ahead.x-point.x)*180/Math.PI;

      ball.style.left = `${point.x}%`;
      ball.style.top = `${point.y}%`;
      ball.style.setProperty('--roll-angle',`${angle*.24+t*930}deg`);
      if (routeProgress) routeProgress.style.strokeDasharray = `${(t*100).toFixed(1)} 100`;

      fireTimeline(t);
      if (raw < 1) frameId = requestAnimationFrame(tick);
      else finishGoal();
    };
    frameId = requestAnimationFrame(tick);
  }

  function fireTimeline(t) {
    (scene.events || []).forEach((event,index) => {
      if (t < event.at || firedEvents.has(index)) return;
      firedEvents.add(index);
      const node = nodes.get(event.id);

      if (event.type === 'activate') {
        if (event.id === logic.controls.target) return;
        node?.classList.add('activated');
        onEffect?.(event.sound || 'metal');
        return;
      }
      if (event.type === 'star') {
        node?.classList.add('collected');
        onStar?.();
        sparkAt(event.x,event.y,6);
        return;
      }
      if (event.type === 'goal') {
        nodes.get('goal')?.classList.add('activated');
        nodes.get('goalSocket')?.classList.add('activated');
        onEffect?.('goal');
        sparkAt(event.x,event.y,7);
      }
    });
  }

  function finishGoal() {
    if (!machineRequirementsMet(state,logic.requirements.finish)) {
      onFail?.('Signal chain incomplete.');
      return;
    }
    ball.classList.add('at-goal');
    board.classList.add('signal-complete');
    onEffect?.('goal-sink');
    later(() => { if (!destroyed) onGoal?.(); },logic.timings.resultDelay);
  }

  function disableControls() {
    nodes.forEach((node,id) => {
      if (!pieces.get(id)?.interactive) return;
      node.disabled = true;
      node.classList.remove('interactive');
    });
  }

  function nodePoint(node) {
    const boardRect = board.getBoundingClientRect();
    const nodeRect = node?.getBoundingClientRect();
    if (!nodeRect || !boardRect.width || !boardRect.height) return {x:50,y:50};
    return {
      x:((nodeRect.left+nodeRect.width*.5-boardRect.left)/boardRect.width)*100,
      y:((nodeRect.top+nodeRect.height*.5-boardRect.top)/boardRect.height)*100,
    };
  }

  function sparkAtNode(node,count) {
    const point = nodePoint(node);
    sparkAt(point.x,point.y,count);
  }

  function sparkAt(x,y,count) {
    const root = board.querySelector('.machine-fx');
    for (let i=0;i<count;i+=1) {
      const spark=document.createElement('i');
      spark.style.left=`${x}%`; spark.style.top=`${y}%`;
      spark.style.setProperty('--x',`${(Math.random()-.5)*54}px`);
      spark.style.setProperty('--y',`${-12-Math.random()*34}px`);
      root.appendChild(spark);
      later(()=>spark.remove(),720);
    }
  }

  function later(fn,delay) {
    const timer=window.setTimeout(()=>{timers.delete(timer);if(!destroyed)fn();},delay);
    timers.add(timer);
    return timer;
  }

  function destroy() {
    destroyed=true;
    cancelAnimationFrame(frameId);
    timers.forEach(clearTimeout);
    timers.clear();
    world.innerHTML='';
  }

  return {commit,destroy,nodes,board};
}

function sampledPathToD(samples) {
  return samples.map((p,index)=>`${index?'L':'M'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ');
}

function buildSampledPath(points) {
  const samples=[];
  const subdivisions=28;
  let distance=0;
  let previous=null;
  for (let segment=0;segment<points.length-1;segment+=1) {
    const p0=points[Math.max(0,segment-1)],p1=points[segment],p2=points[segment+1],p3=points[Math.min(points.length-1,segment+2)];
    for (let step=0;step<subdivisions;step+=1) {
      if (segment>0 && step===0) continue;
      const point=catmullRom(p0,p1,p2,p3,step/subdivisions);
      if (previous) distance+=Math.hypot(point.x-previous.x,point.y-previous.y);
      samples.push({...point,distance});
      previous=point;
    }
  }
  const finalPoint=points[points.length-1];
  if (previous) distance+=Math.hypot(finalPoint.x-previous.x,finalPoint.y-previous.y);
  samples.push({...finalPoint,distance});
  return samples;
}

function pointOnSampledPath(samples,t) {
  const total=samples[samples.length-1].distance||1;
  const target=Math.max(0,Math.min(1,t))*total;
  let low=0,high=samples.length-1;
  while(low<high){const mid=Math.floor((low+high)/2);if(samples[mid].distance<target)low=mid+1;else high=mid;}
  const next=samples[low],prev=samples[Math.max(0,low-1)];
  const span=Math.max(.0001,next.distance-prev.distance);
  const local=Math.max(0,Math.min(1,(target-prev.distance)/span));
  return{x:prev.x+(next.x-prev.x)*local,y:prev.y+(next.y-prev.y)*local};
}

function motionAt(raw) {
  const t=Math.max(0,Math.min(1,raw));
  return t<.1 ? (1-Math.pow(1-t/.1,3))*.065 : .065 + (t-.1)/.9*.935;
}

function catmullRom(p0,p1,p2,p3,t) {
  const t2=t*t,t3=t2*t;
  return {
    x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
  };
}
