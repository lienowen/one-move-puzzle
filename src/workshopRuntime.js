export function mountWorkshopRuntime({ world, stage, level, onMove, onStar, onGoal, onFail, onEffect, onStatus }) {
  const scene = level.scene;
  if (!scene?.path?.length) throw new Error(`Level ${level.id} is missing machine path data`);

  let destroyed = false;
  let running = false;
  let frameId = 0;
  let startTimer = 0;
  let failTimer = 0;
  const nodes = new Map();
  const pieces = new Map(scene.pieces.map(piece => [piece.id, piece]));
  const firedEvents = new Set();
  const sampledPath = buildSampledPath(scene.path);

  world.innerHTML = '';

  const board = document.createElement('div');
  board.className = 'machine-board';
  board.setAttribute('aria-label', `${level.name} machine`);
  board.innerHTML = `
    <img class="machine-board-base" src="${scene.board}" alt="" draggable="false">
    <div class="machine-board-shade"></div>
    <svg class="machine-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="route-shadow"></path>
      <path class="route-bed"></path>
      <path class="route-rim"></path>
      <path class="route-channel"></path>
      <path class="route-light"></path>
    </svg>
    <div class="machine-pieces"></div>
    <div class="machine-fx" aria-hidden="true"></div>
  `;
  world.appendChild(board);

  const routeD = sampledPathToD(sampledPath);
  board.querySelectorAll('.machine-route path').forEach(path => path.setAttribute('d', routeD));

  const piecesRoot = board.querySelector('.machine-pieces');
  renderRouteJoints(piecesRoot, scene.joints || [.25,.52,.78], sampledPath);

  scene.pieces.forEach(piece => {
    const node = document.createElement(piece.interactive ? 'button' : 'div');
    if (piece.interactive) node.type = 'button';
    node.className = `machine-piece piece-${piece.kind || 'decor'}${piece.interactive ? ' interactive' : ''}`;
    node.dataset.id = piece.id;
    node.style.left = `${piece.x}%`;
    node.style.top = `${piece.y}%`;
    node.style.width = `${piece.w}%`;
    node.style.zIndex = String(piece.z ?? 10);
    node.style.setProperty('--piece-rotation', `${piece.rotation || 0}deg`);
    node.innerHTML = `<img src="${piece.asset}" alt="" draggable="false">`;
    if (piece.interactive) {
      node.setAttribute('aria-label', piece.label || 'Use this control');
      node.addEventListener('click', ev => onMove?.(piece.id, ev));
    }
    piecesRoot.appendChild(node);
    nodes.set(piece.id, node);
  });

  const ball = nodes.get('ball');
  if (!ball) throw new Error(`Level ${level.id} requires a ball piece`);

  function commit(id) {
    if (destroyed || running) return { accepted:false, correct:false };
    const piece = pieces.get(id);
    const node = nodes.get(id);
    if (!piece?.interactive || !node) return { accepted:false, correct:false };

    running = true;
    stage.classList.add('machine-running');
    disableControls();
    node.classList.add(`action-${piece.action || 'press'}`);

    if (id !== level.solution) {
      node.classList.add('action-wrong');
      onEffect?.('fail-soft');
      onStatus?.('That move breaks the route.');
      failTimer = window.setTimeout(() => {
        if (!destroyed) onFail?.('That move breaks the chain.');
      }, 720);
      return { accepted:true, correct:false };
    }

    onEffect?.(piece.action === 'press' ? 'tap' : 'metal');
    onStatus?.('Watch the machine.');
    startTimer = window.setTimeout(() => {
      if (!destroyed) runBall();
    }, 330);
    return { accepted:true, correct:true };
  }

  function runBall() {
    const duration = scene.duration || 4200;
    const start = performance.now();
    ball.classList.add('running');

    const tick = now => {
      if (destroyed) return;
      const raw = Math.min(1, (now - start) / duration);
      const t = raw < .06 ? easeOutCubic(raw / .06) * .06 : raw;
      const point = pointOnSampledPath(sampledPath, t);
      const ahead = pointOnSampledPath(sampledPath, Math.min(1, t + .008));
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI;

      ball.style.left = `${point.x}%`;
      ball.style.top = `${point.y}%`;
      ball.style.setProperty('--travel-rotation', `${angle * .18 + t * 820}deg`);
      ball.style.transform = `translate(-50%,-50%) rotate(var(--travel-rotation))`;

      fireTimeline(t);

      if (raw < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        ball.classList.add('at-goal');
        window.setTimeout(() => {
          if (!destroyed) onGoal?.();
        }, 310);
      }
    };

    frameId = requestAnimationFrame(tick);
  }

  function fireTimeline(t) {
    (scene.events || []).forEach((event, index) => {
      if (t < event.at || firedEvents.has(index)) return;
      firedEvents.add(index);
      const node = nodes.get(event.id);

      if (event.type === 'activate') {
        node?.classList.add('activated');
        onEffect?.(event.sound || 'metal');
        sparkAt(event.x, event.y, event.sound === 'wood' ? 4 : 5);
        return;
      }

      if (event.type === 'star') {
        node?.classList.add('collected');
        onStar?.();
        sparkAt(event.x, event.y, 9);
        return;
      }

      if (event.type === 'goal') {
        nodes.get('goal')?.classList.add('activated');
        nodes.get('goalSocket')?.classList.add('activated');
        onEffect?.('goal');
        sparkAt(event.x, event.y, 12);
      }
    });
  }

  function disableControls() {
    nodes.forEach((node,id) => {
      if (!pieces.get(id)?.interactive) return;
      node.disabled = true;
      node.classList.remove('interactive');
    });
  }

  function sparkAt(x, y, count) {
    const root = board.querySelector('.machine-fx');
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElement('i');
      spark.style.left = `${x}%`;
      spark.style.top = `${y}%`;
      spark.style.setProperty('--x', `${(Math.random() - .5) * 64}px`);
      spark.style.setProperty('--y', `${-15 - Math.random() * 44}px`);
      spark.style.animationDelay = `${Math.random() * 70}ms`;
      root.appendChild(spark);
      window.setTimeout(() => spark.remove(), 820);
    }
  }

  function destroy() {
    destroyed = true;
    running = false;
    cancelAnimationFrame(frameId);
    clearTimeout(startTimer);
    clearTimeout(failTimer);
    world.innerHTML = '';
  }

  return { commit, destroy, nodes, board };
}

function renderRouteJoints(root, positions, samples) {
  positions.forEach(t => {
    const point = pointOnSampledPath(samples, t);
    const ahead = pointOnSampledPath(samples, Math.min(1, t + .01));
    const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI + 90;
    const joint = document.createElement('div');
    joint.className = 'route-joint';
    joint.style.left = `${point.x}%`;
    joint.style.top = `${point.y}%`;
    joint.style.setProperty('--joint-angle', `${angle}deg`);
    root.appendChild(joint);
  });
}

function sampledPathToD(samples) {
  if (!samples.length) return '';
  return samples.map((p,index) => `${index ? 'L' : 'M'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ');
}

function buildSampledPath(points) {
  if (!points.length) return [{x:50,y:50,distance:0}];
  if (points.length === 1) return [{...points[0],distance:0}];

  const samples = [];
  const subdivisions = 24;
  let distance = 0;
  let previous = null;

  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[segment + 1];
    const p3 = points[Math.min(points.length - 1, segment + 2)];

    for (let step = 0; step < subdivisions; step += 1) {
      if (segment > 0 && step === 0) continue;
      const t = step / subdivisions;
      const point = catmullRom(p0,p1,p2,p3,t);
      if (previous) distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      samples.push({...point,distance});
      previous = point;
    }
  }

  const finalPoint = points[points.length - 1];
  if (previous) distance += Math.hypot(finalPoint.x - previous.x, finalPoint.y - previous.y);
  samples.push({...finalPoint,distance});
  return samples;
}

function pointOnSampledPath(samples, t) {
  if (samples.length === 1) return samples[0];
  const total = samples[samples.length - 1].distance || 1;
  const target = Math.max(0,Math.min(1,t)) * total;

  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (samples[mid].distance < target) low = mid + 1;
    else high = mid;
  }

  const next = samples[low];
  const prev = samples[Math.max(0,low - 1)];
  const span = Math.max(.0001,next.distance - prev.distance);
  const local = Math.max(0,Math.min(1,(target - prev.distance) / span));
  return {
    x:prev.x + (next.x - prev.x) * local,
    y:prev.y + (next.y - prev.y) * local,
  };
}

function catmullRom(p0,p1,p2,p3,t) {
  const t2 = t*t;
  const t3 = t2*t;
  return {
    x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
  };
}

function easeOutCubic(t){return 1-Math.pow(1-t,3)}
