export function mountWorkshopRuntime({ world, stage, level, onMove, onStar, onBell, onGear, onGoal, onStatus }) {
  const scene = level.scene;
  if (!scene) throw new Error('Workshop level is missing scene data');

  let destroyed = false;
  let running = false;
  let frameId = 0;
  let startTimer = 0;
  const nodes = new Map();
  const firedEvents = new Set();

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
      const t = raw < 0.08 ? easeOutCubic(raw / 0.08) * 0.08 : raw;
      const point = pointOnPath(scene.path, t);
      const ahead = pointOnPath(scene.path, Math.min(1, t + 0.006));
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI;

      ball.style.left = `${point.x}%`;
      ball.style.top = `${point.y}%`;
      ball.style.setProperty('--travel-rotation', `${angle * 0.28 + t * 760}deg`);

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

function pointOnPath(points, t) {
  if (!points?.length) return { x: 50, y: 50 };
  if (points.length === 1) return points[0];

  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    total += len;
  }

  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const local = lengths[i] ? remaining / lengths[i] : 0;
      const eased = smoothStep(local);
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * eased,
        y: points[i].y + (points[i + 1].y - points[i].y) * eased,
      };
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1];
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
