import { POLISH_ASSETS as P } from './polishAssets.js';

export function mountWorkshopRuntime({ world, stage, level, onMove, onStar, onGoal, onFail, onEffect, onStatus }) {
  const scene = level.scene;
  if (!scene?.path?.length) throw new Error(`Level ${level.id} is missing machine path data`);

  const polishedTutorial = level.id === 'release';
  let destroyed = false;
  let running = false;
  let frameId = 0;
  let startTimer = 0;
  let failTimer = 0;
  const timers = new Set();
  const nodes = new Map();
  const pieces = new Map(scene.pieces.map(piece => [piece.id, piece]));
  const firedEvents = new Set();
  const sampledPath = buildSampledPath(scene.path);

  world.innerHTML = '';

  const board = document.createElement('div');
  board.className = `machine-board${polishedTutorial ? ' polished-tutorial' : ''}`;
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

    if (polishedTutorial) applyTutorialArt(node, piece);

    if (piece.interactive) {
      node.setAttribute('aria-label', piece.label || 'Use this control');
      if (polishedTutorial && piece.id === 'pin') {
        wirePullPin(node, piece);
      } else {
        node.addEventListener('click', ev => onMove?.(piece.id, ev));
      }
    }

    piecesRoot.appendChild(node);
    nodes.set(piece.id, node);
  });

  const ball = nodes.get('ball');
  if (!ball) throw new Error(`Level ${level.id} requires a ball piece`);

  function applyTutorialArt(node, piece) {
    if (piece.id === 'pin') {
      node.classList.add('polish-state', 'polish-pin');
      setNodeImage(node, P.interaction.pinBlueIdle);
      return;
    }
    if (piece.id === 'pinSocket') {
      node.classList.add('polish-suppressed');
      return;
    }
    if (piece.id === 'star') {
      node.classList.add('polish-state', 'polish-star');
      setNodeImage(node, P.interaction.starIdle);
      return;
    }
    if (piece.id === 'goal') {
      node.classList.add('polish-state', 'polish-goal');
      setNodeImage(node, P.interaction.goalYellowIdle);
      return;
    }
    if (piece.id === 'goalSocket') node.classList.add('polish-suppressed');
  }

  function wirePullPin(node, piece) {
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let progress = 0;
    const thresholdPx = 26;
    const travelPx = 68;

    node.style.touchAction = 'none';

    node.addEventListener('pointerenter', () => {
      if (!running && !dragging && !destroyed) setNodeImage(node, P.interaction.pinBlueHover);
    });
    node.addEventListener('pointerleave', () => {
      if (!running && !dragging && !destroyed) setNodeImage(node, P.interaction.pinBlueIdle);
    });
    node.addEventListener('pointerdown', ev => {
      if (running || destroyed) return;
      dragging = true;
      pointerId = ev.pointerId;
      startX = ev.clientX;
      progress = 0;
      node.classList.add('is-dragging');
      node.setPointerCapture?.(pointerId);
      setNodeImage(node, P.interaction.pinBluePull);
      playPolishFx(P.fx.fxClickRing, piece.x, piece.y, 'fx-click', 360);
      ev.preventDefault();
    });
    node.addEventListener('pointermove', ev => {
      if (!dragging || ev.pointerId !== pointerId || running) return;
      const dx = Math.max(0, startX - ev.clientX);
      progress = Math.min(1, dx / travelPx);
      node.style.transform = `translate(calc(-50% - ${Math.round(progress * 24)}px),-50%)`;
      if (progress > .22) setNodeImage(node, P.interaction.pinBluePull);
      ev.preventDefault();
    });
    node.addEventListener('pointerup', ev => finishPull(ev, false));
    node.addEventListener('pointercancel', ev => finishPull(ev, true));

    // Keep keyboard accessibility even though pointer input uses a drag gesture.
    node.addEventListener('keydown', ev => {
      if (running || destroyed) return;
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      setNodeImage(node, P.interaction.pinBluePull);
      onMove?.(piece.id, ev);
    });

    function finishPull(ev, cancelled) {
      if (!dragging || ev.pointerId !== pointerId) return;
      dragging = false;
      node.classList.remove('is-dragging');
      node.releasePointerCapture?.(pointerId);
      pointerId = null;

      const committed = !cancelled && progress * travelPx >= thresholdPx;
      if (committed) {
        node.style.transform = '';
        onMove?.(piece.id, ev);
        return;
      }

      node.classList.add('pull-reset');
      node.style.transform = '';
      setNodeImage(node, P.interaction.pinBlueIdle);
      later(() => node.classList.remove('pull-reset'), 220);
    }
  }

  function commit(id) {
    if (destroyed || running) return { accepted:false, correct:false };
    const piece = pieces.get(id);
    const node = nodes.get(id);
    if (!piece?.interactive || !node) return { accepted:false, correct:false };

    running = true;
    stage.classList.add('machine-running');
    disableControls();
    node.classList.add(`action-${piece.action || 'press'}`);

    if (polishedTutorial && id === 'pin') {
      node.style.transform = '';
      setNodeImage(node, P.interaction.pinBluePull);
      playPolishFx(P.fx.fxMetalSparkSmall, piece.x + 6, piece.y, 'fx-metal', 460);
      later(() => setNodeImage(node, P.interaction.pinBlueReleased), 285);
    }

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
    }, polishedTutorial ? 430 : 330);
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
        if (polishedTutorial) {
          const goal = nodes.get('goal');
          setNodeImage(goal, P.interaction.goalYellowSuccess);
          playPolishFx(P.fx.fxGoalGlow, 77, 79, 'fx-goal', 950);
          playPolishFx(P.fx.fxSuccessBurst, 77, 75, 'fx-success', 1100);
        }
        later(() => {
          if (!destroyed) onGoal?.();
        }, polishedTutorial ? 470 : 310);
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
        if (polishedTutorial && node) {
          node.classList.add('polish-collecting');
          setNodeImage(node, P.interaction.starCollect1);
          playPolishFx(P.fx.fxStarBurst, event.x, event.y, 'fx-star', 780);
          later(() => setNodeImage(node, P.interaction.starCollect2), 105);
          later(() => setNodeImage(node, P.interaction.starCollectDone), 225);
          later(() => node.classList.add('polish-collected'), 395);
        } else {
          node?.classList.add('collected');
        }
        onStar?.();
        sparkAt(event.x, event.y, 9);
        return;
      }

      if (event.type === 'goal') {
        const goal = nodes.get('goal');
        goal?.classList.add('activated');
        nodes.get('goalSocket')?.classList.add('activated');
        if (polishedTutorial) {
          setNodeImage(goal, P.interaction.goalYellowActive);
          playPolishFx(P.fx.fxGoalGlow, event.x, event.y, 'fx-goal-warmup', 950);
        }
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

  function playPolishFx(asset, x, y, className, life) {
    if (!asset || destroyed) return;
    const root = board.querySelector('.machine-fx');
    const fx = document.createElement('img');
    fx.className = `polish-fx ${className}`;
    fx.src = asset;
    fx.alt = '';
    fx.draggable = false;
    fx.style.left = `${x}%`;
    fx.style.top = `${y}%`;
    root.appendChild(fx);
    later(() => fx.remove(), life);
  }

  function setNodeImage(node, src) {
    if (!node || !src) return;
    const image = node.querySelector('img');
    if (image) image.src = src;
  }

  function later(fn, delay) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, delay);
    timers.add(id);
    return id;
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
      later(() => spark.remove(), 820);
    }
  }

  function destroy() {
    destroyed = true;
    running = false;
    cancelAnimationFrame(frameId);
    clearTimeout(startTimer);
    clearTimeout(failTimer);
    timers.forEach(id => clearTimeout(id));
    timers.clear();
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
