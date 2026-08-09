export function mountWorkshopRuntime({ world, stage, level, onMove, onStar, onBell, onGear, onGoal, onStatus }) {
  const scene = level.scene;
  if (!scene) throw new Error('Workshop level is missing scene data');

  let destroyed = false;
  let running = false;
  let frameId = 0;
  let startTimer = 0;
  const nodes = new Map();
  const firedEvents = new Set();
  const sampledPath = buildSampledPath(scene.path || []);

  world.innerHTML = '';
  world.classList.add('workshop-world');

  const board = document.createElement('div');
  board.className = 'workshop-board';
  board.setAttribute('aria-label', 'Wood workshop machine');
  board.innerHTML = `
    <img class="workshop-board-base" src="${scene.board}" alt="" draggable="false">
    <div class="workshop-board-vignette"></div>
    <div class="workshop-board-pieces"></div>
    <div class="workshop-sparks" aria-hidden="true"></div>
  `;
  world.appendChild(board);

  const piecesRoot = board.querySelector('.workshop-board-pieces');
  scene.pieces.forEach(piece => {
    const node = document.createElement(piece.interactive ? 'button' : 'div');
    if (piece.interactive) node.type = 'button';
    node.className = `workshop-piece piece-${piece.kind || 'decor'}${piece.interactive ? ' interactive' : ''}`;
    node.dataset.id = piece.id;
    node.style.left = `${piece.x}%`;
    node.style.top = `${piece.y}%`;
    node.style.width = `${piece.w}%`;
    node.style.zIndex = String(piece.z ?? 5);
    node.style.setProperty('--piece-rotation', `${piece.rotation || 0}deg`);
    node.innerHTML = `<img src="${piece.asset}" alt="" draggable="false">`;
    if (piece.interactive) {
      node.setAttribute('aria-label', piece.label || 'Move this piece');
      node.addEventListener('click', ev => onMove(piece.id, ev));
    }
    piecesRoot.appendChild(node);
    nodes.set(piece.id, node);
  });

  const ball = nodes.get(scene.ballId || 'ball');
  if (!ball) throw new Error('Workshop scene requires a ball piece');

  function commit(id) {
    if (destroyed || running) return false;
    if (id !== level.solution) return false;

    running = true;
    stage.classList.add('machine-running');
    nodes.get(id)?.classList.add('is-pulled');
    nodes.get('pinSocket')?.classList.add('is-active');
    onStatus?.('Pin released. The workshop is moving.');

    startTimer = window.setTimeout(() => {
      if (!destroyed) runBall();
    }, 340);
    return true;
  }

  function runBall() {
    const duration = scene.duration || 4400;
    const start = performance.now();
    ball.classList.add('is-running');

    const tick = now => {
      if (destroyed) return;
      const raw = Math.min(1, (now - start) / duration);
      const t = raw < 0.065 ? easeOutCubic(raw / 0.065) * 0.065 : raw;
      const point = pointOnSampledPath(sampledPath, t);
      const ahead = pointOnSampledPath(sampledPath, Math.min(1, t + 0.008));
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI;

      ball.style.left = `${point.x}%`;
      ball.style.top = `${point.y}%`;
      ball.style.setProperty('--travel-rotation', `${angle * 0.22 + t * 790}deg`);

      fireTimeline(t);

      if (raw < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        ball.classList.add('at-goal');
        window.setTimeout(() => {
          if (!destroyed) onGoal?.();
        }, 320);
      }
    };

    frameId = requestAnimationFrame(tick);
  }

  function fireTimeline(t) {
    (scene.events || []).forEach((event, index) => {
      if (t < event.at || firedEvents.has(index)) return;
      firedEvents.add(index);
      const node = nodes.get(event.id);

      if (event.type === 'bell') {
        node?.classList.add('struck');
        onBell?.();
        sparkAt(event.x, event.y, 4);
      }
      if (event.type === 'gear') {
        node?.classList.add('activated');
        onGear?.();
      }
      if (event.type === 'star') {
        node?.classList.add('collected');
        nodes.get('starSocket')?.classList.add('lit');
        onStar?.();
        sparkAt(event.x, event.y, 9);
      }
      if (event.type === 'goal') {
        nodes.get('goal')?.classList.add('goal-active');
        nodes.get('goalSocket')?.classList.add('goal-active');
        sparkAt(event.x, event.y, 12);
      }
    });
  }

  function sparkAt(x, y, count) {
    const root = board.querySelector('.workshop-sparks');
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElement('i');
      spark.style.left = `${x}%`;
      spark.style.top = `${y}%`;
      spark.style.setProperty('--spark-x', `${(Math.random() - 0.5) * 70}px`);
      spark.style.setProperty('--spark-y', `${-18 - Math.random() * 50}px`);
      spark.style.animationDelay = `${Math.random() * 80}ms`;
      root.appendChild(spark);
      window.setTimeout(() => spark.remove(), 900);
    }
  }

  function destroy() {
    destroyed = true;
    running = false;
    cancelAnimationFrame(frameId);
    clearTimeout(startTimer);
    world.classList.remove('workshop-world');
    world.innerHTML = '';
  }

  return { commit, destroy, nodes, board };
}

function buildSampledPath(points) {
  if (!points.length) return [{ x: 50, y: 50, distance: 0 }];
  if (points.length === 1) return [{ ...points[0], distance: 0 }];

  const samples = [];
  const subdivisions = 18;
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
      const point = catmullRom(p0, p1, p2, p3, t);
      if (previous) distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      samples.push({ ...point, distance });
      previous = point;
    }
  }

  const finalPoint = points[points.length - 1];
  if (previous) distance += Math.hypot(finalPoint.x - previous.x, finalPoint.y - previous.y);
  samples.push({ ...finalPoint, distance });
  return samples;
}

function pointOnSampledPath(samples, t) {
  if (samples.length === 1) return samples[0];
  const total = samples[samples.length - 1].distance || 1;
  const target = Math.max(0, Math.min(1, t)) * total;

  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (samples[mid].distance < target) low = mid + 1;
    else high = mid;
  }

  const next = samples[low];
  const prev = samples[Math.max(0, low - 1)];
  const span = Math.max(0.0001, next.distance - prev.distance);
  const local = Math.max(0, Math.min(1, (target - prev.distance) / span));
  return {
    x: prev.x + (next.x - prev.x) * local,
    y: prev.y + (next.y - prev.y) * local,
  };
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3),
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
