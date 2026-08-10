import { POLISH_ASSETS as P } from './polishAssets.js';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';
import { getMachineLogic, machineRequirementsMet } from './machineLogic.js';

export function mountWorkshopRuntime({ world, stage, level, onMove, onStar, onGoal, onFail, onEffect, onStatus }) {
  const scene = level.scene;
  if (!scene?.path?.length) throw new Error(`Level ${level.id} is missing machine path data`);

  const logic = getMachineLogic(level.id);
  const polishedTutorial = Boolean(logic?.archetype === 'release-chain');
  const checkpoints = logic?.checkpoints || { triggerAt:.34, gateHoldAt:.486, goalWakeAt:.83 };
  const timings = logic?.timings || { driveDelay:90, gatePreloadDelay:250, gateOpenDelay:760, resultDelay:620 };
  const copy = logic?.copy || {};
  const focus = logic?.focus || {};

  let destroyed = false;
  let running = false;
  let frameId = 0;
  let startTimer = 0;
  let failTimer = 0;
  let filteredSpeed = .45;
  let tutorialPhase = 0;
  let gateHoldStarted = 0;
  let pausedForGate = 0;

  const machine = {
    trigger:false,
    drive:false,
    gateOpening:false,
    gateOpen:!polishedTutorial,
    star:false,
    goalPowered:!polishedTutorial,
    goalAwake:false,
    complete:false,
  };

  const timers = new Set();
  const nodes = new Map();
  const pieces = new Map(scene.pieces.map(piece => [piece.id, piece]));
  const firedEvents = new Set();
  const firedJoints = new Set();
  const sampledPath = buildSampledPath(scene.path);

  world.innerHTML = '';

  const board = document.createElement('div');
  board.className = `machine-board${polishedTutorial ? ` polished-tutorial focus-${focus.initial || 'start'}` : ''}`;
  board.setAttribute('aria-label', `${level.name} machine`);
  board.innerHTML = `
    <img class="machine-board-base" src="${scene.board}" alt="" draggable="false">
    <div class="machine-board-shade"></div>
    ${polishedTutorial ? `
      <div class="tutorial-chassis" aria-hidden="true">
        <div class="machine-deck"></div>
        <div class="chassis-module chassis-start"><i></i><i></i><i></i><i></i></div>
        <div class="chassis-module chassis-drive"><i></i><i></i><i></i><i></i></div>
        <div class="chassis-module chassis-goal"><i></i><i></i><i></i><i></i></div>
        <div class="drive-link"></div>
        <div class="power-bus"><i></i><i></i><i></i></div>
      </div>
    ` : ''}
    <svg class="machine-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="route-shadow"></path>
      <path class="route-bed"></path>
      <path class="route-rim"></path>
      <path class="route-channel"></path>
      <path class="route-light"></path>
      <path class="route-progress" pathLength="100"></path>
    </svg>
    <div class="machine-pieces"></div>
    <div class="machine-fx" aria-hidden="true"></div>
  `;
  world.appendChild(board);

  const routeD = sampledPathToD(sampledPath);
  board.querySelectorAll('.machine-route path').forEach(path => path.setAttribute('d', routeD));
  const routeProgress = board.querySelector('.route-progress');
  const piecesRoot = board.querySelector('.machine-pieces');

  renderRouteJoints(piecesRoot, scene.joints || [.25,.52,.78], sampledPath);
  if (polishedTutorial) renderTutorialMachine(piecesRoot);

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
      if (polishedTutorial && piece.id === 'pin') wirePullPin(node, piece);
      else node.addEventListener('click', ev => onMove?.(piece.id, ev));
    }

    piecesRoot.appendChild(node);
    nodes.set(piece.id, node);
  });

  const ball = nodes.get('ball');
  if (!ball) throw new Error(`Level ${level.id} requires a ball piece`);

  function renderTutorialMachine(root) {
    const triggerPoint = pointOnSampledPath(sampledPath, checkpoints.triggerAt);
    const gatePoint = pointOnSampledPath(sampledPath, .50);

    addMachinePart(root, { id:'logicTrigger', kind:'logic-trigger', asset:W.mechanisms.checkpointRing, x:triggerPoint.x, y:triggerPoint.y, w:10.5, z:21 });
    addMachinePart(root, { id:'logicGate', kind:'logic-gate', asset:W.mechanisms.gateSlider, x:gatePoint.x, y:gatePoint.y, w:12.5, z:28, rotation:8 });
    addMachinePart(root, { id:'logicLamp', kind:'logic-lamp', asset:W.mechanisms.lampIndicatorGreen, x:64.5, y:44.0, w:5.6, z:20 });
    addMachinePart(root, { id:'logicPlate', kind:'logic-plate', asset:W.hardware.metalPlate, x:62.0, y:38.5, w:23, z:8, rotation:-4 });
    addMachinePart(root, { id:'logicBracketA', kind:'logic-bracket', asset:W.hardware.bracketStraight, x:55.5, y:49.5, w:7, z:18, rotation:24 });
    addMachinePart(root, { id:'logicBracketB', kind:'logic-bracket', asset:W.hardware.bracketStraight, x:69.0, y:57.0, w:6.8, z:18, rotation:-19 });
  }

  function addMachinePart(root, spec) {
    const node = document.createElement('div');
    node.className = `machine-piece piece-${spec.kind}`;
    node.dataset.id = spec.id;
    node.style.left = `${spec.x}%`;
    node.style.top = `${spec.y}%`;
    node.style.width = `${spec.w}%`;
    node.style.zIndex = String(spec.z ?? 10);
    node.style.setProperty('--piece-rotation', `${spec.rotation || 0}deg`);
    node.innerHTML = `<img src="${spec.asset}" alt="" draggable="false">`;
    root.appendChild(node);
    nodes.set(spec.id, node);
    return node;
  }

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
    if (piece.id === 'goalSocket') {
      node.classList.add('polish-suppressed');
      return;
    }
    if (piece.id === 'gear') node.classList.add('tutorial-drive-gear');
  }

  function wirePullPin(node, piece) {
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let progress = 0;
    let passedDetent = false;
    let travelPx = 72;
    const threshold = .48;

    node.style.touchAction = 'none';
    appendPullCue(node);

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
      passedDetent = false;
      travelPx = Math.max(66, Math.min(96, node.getBoundingClientRect().width * .46));
      node.classList.add('is-dragging');
      node.setPointerCapture?.(pointerId);
      setNodeImage(node, P.interaction.pinBluePull);
      onEffect?.('pin-grab');
      const point = nodePoint(node);
      playPolishFx(P.fx.fxClickRing, point.x, point.y, 'fx-click', 360);
      ev.preventDefault();
    });
    node.addEventListener('pointermove', ev => {
      if (!dragging || ev.pointerId !== pointerId || running) return;
      const dx = Math.max(0, startX - ev.clientX);
      progress = Math.min(1, dx / travelPx);
      const resisted = Math.pow(progress, .88);
      const offset = Math.round(resisted * 34);
      node.style.setProperty('--pull-progress', progress.toFixed(3));
      node.style.transform = `translate(calc(-50% - ${offset}px),-50%) scale(${(1 - progress * .018).toFixed(3)})`;

      if (!passedDetent && progress >= .42) {
        passedDetent = true;
        node.classList.add('past-detent');
        onEffect?.('pin-detent');
      } else if (passedDetent && progress < .34) {
        passedDetent = false;
        node.classList.remove('past-detent');
      }
      ev.preventDefault();
    });
    node.addEventListener('pointerup', ev => finishPull(ev, false));
    node.addEventListener('pointercancel', ev => finishPull(ev, true));

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

      const committed = !cancelled && progress >= threshold;
      if (committed) {
        node.classList.add('pull-committed');
        node.style.transform = '';
        node.style.removeProperty('--pull-progress');
        onMove?.(piece.id, ev);
        return;
      }

      node.classList.remove('past-detent');
      node.classList.add('pull-reset');
      node.style.transform = '';
      node.style.removeProperty('--pull-progress');
      setNodeImage(node, P.interaction.pinBlueIdle);
      onEffect?.('pin-reset');
      later(() => node.classList.remove('pull-reset'), 220);
    }
  }

  function appendPullCue(node) {
    const cue = document.createElement('span');
    cue.className = 'pull-cue';
    cue.innerHTML = '<i></i><i></i><i></i>';
    node.appendChild(cue);
  }

  function commit(id) {
    if (destroyed || running) return { accepted:false, correct:false, effectHandled:false };
    const piece = pieces.get(id);
    const node = nodes.get(id);
    if (!piece?.interactive || !node) return { accepted:false, correct:false, effectHandled:false };

    running = true;
    stage.classList.add('machine-running');
    disableControls();
    node.classList.add(`action-${piece.action || 'press'}`);

    if (polishedTutorial && id === 'pin') {
      node.style.transform = '';
      setNodeImage(node, P.interaction.pinBluePull);
      onEffect?.('pin-release');
      impact('release-impact');
      const point = nodePoint(node);
      playPolishFx(P.fx.fxMetalSparkSmall, point.x + 4, point.y, 'fx-metal', 460);
      nodes.get('holder')?.classList.add('releasing');
      ball.classList.add('release-ready');
      setFocus(focus.release || 'route');
      updateTutorialPhase(1, copy.latch || 'Latch released.');
      later(() => setNodeImage(node, P.interaction.pinBlueReleased), 210);
    } else {
      onEffect?.(piece.action === 'press' ? 'tap' : 'metal');
    }

    if (id !== level.solution) {
      node.classList.add('action-wrong');
      onEffect?.('fail-soft');
      onStatus?.('That move breaks the route.');
      failTimer = window.setTimeout(() => {
        if (!destroyed) onFail?.('That move breaks the chain.');
      }, 720);
      return { accepted:true, correct:false, effectHandled:true };
    }

    startTimer = window.setTimeout(() => {
      if (!destroyed) runBall();
    }, polishedTutorial ? 390 : 330);
    return { accepted:true, correct:true, effectHandled:true };
  }

  function runBall() {
    const duration = scene.duration || 4200;
    const start = performance.now();
    ball.classList.remove('release-ready');
    ball.classList.add('running');
    onEffect?.('roll-start');
    if (polishedTutorial) updateTutorialPhase(2, copy.rolling || 'Ball released.');

    const tick = now => {
      if (destroyed) return;

      let elapsed = Math.max(0, now - start - pausedForGate);
      let raw = Math.min(1, elapsed / duration);
      let motion = motionAt(scene.motion, raw);
      let t = motion.progress;

      if (polishedTutorial) {
        fireTutorialMachineLogic(t);

        if (!machine.gateOpen && t >= checkpoints.gateHoldAt) {
          if (!gateHoldStarted) {
            gateHoldStarted = now;
            ball.classList.add('waiting-at-gate');
            board.classList.add('waiting-gate');
            updateTutorialPhase(4, copy.waitingGate || 'Drive opening the gate…');
            onEffect?.('roll-brake');
          }
          t = checkpoints.gateHoldAt;
        } else if (machine.gateOpen && gateHoldStarted) {
          pausedForGate += now - gateHoldStarted;
          gateHoldStarted = 0;
          ball.classList.remove('waiting-at-gate');
          board.classList.remove('waiting-gate');
          onEffect?.('roll-resume');
          elapsed = Math.max(0, now - start - pausedForGate);
          raw = Math.min(1, elapsed / duration);
          motion = motionAt(scene.motion, raw);
          t = motion.progress;
        }
      }

      filteredSpeed += (motion.speed - filteredSpeed) * .075;
      const point = pointOnSampledPath(sampledPath, t);
      const ahead = pointOnSampledPath(sampledPath, Math.min(1, t + .008));
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI;
      const goalSink = t > .92 ? Math.min(1, (t - .92) / .08) : 0;

      ball.style.left = `${point.x}%`;
      ball.style.top = `${point.y}%`;
      ball.style.setProperty('--roll-angle', `${angle * .24 + t * 960}deg`);
      ball.style.setProperty('--roll-speed', Math.max(.55, Math.min(1.55, filteredSpeed)).toFixed(3));
      ball.style.setProperty('--goal-sink', goalSink.toFixed(3));
      if (routeProgress) routeProgress.style.strokeDasharray = `${Math.max(0, t * 100).toFixed(1)} 100`;

      wakeGoal(t);
      fireJointFeedback(t);
      fireTimeline(t);

      if (raw < 1 || (polishedTutorial && !machine.gateOpen)) frameId = requestAnimationFrame(tick);
      else finishGoal();
    };

    frameId = requestAnimationFrame(tick);
  }

  function fireTutorialMachineLogic(t) {
    if (machine.trigger || t < checkpoints.triggerAt) return;

    machine.trigger = true;
    const trigger = nodes.get('logicTrigger');
    trigger?.classList.add('logic-active');
    impact('logic-impact');
    onEffect?.('trigger');
    sparkAtNode(trigger, 4);
    updateTutorialPhase(3, copy.trigger || 'Pressure ring engaged.');
    setFocus(focus.trigger || 'drive');

    later(() => {
      if (machine.drive) return;
      machine.drive = true;
      nodes.get('gear')?.classList.add('tutorial-gear-active', 'drive-live');
      nodes.get('logicPlate')?.classList.add('logic-active');
      board.classList.add('drive-live');
      onEffect?.('drive');
    }, timings.driveDelay);

    later(() => {
      if (machine.gateOpening) return;
      machine.gateOpening = true;
      nodes.get('logicGate')?.classList.add('logic-gate-opening');
      board.classList.add('gate-opening');
      onEffect?.('gate-preload');
    }, timings.gatePreloadDelay);

    later(() => {
      if (machine.gateOpen) return;
      machine.gateOpen = true;
      const gate = nodes.get('logicGate');
      gate?.classList.remove('logic-gate-opening');
      gate?.classList.add('logic-gate-open');
      nodes.get('logicLamp')?.classList.add('logic-active');
      board.classList.remove('gate-opening');
      board.classList.add('route-open');
      impact('gate-impact');
      onEffect?.('gate-open');
      sparkAtNode(gate, 5);
      updateTutorialPhase(5, copy.routeOpen || 'Route unlocked.');
    }, timings.gateOpenDelay);
  }

  function updateTutorialPhase(phase, text) {
    if (!polishedTutorial || phase <= tutorialPhase) return;
    tutorialPhase = phase;
    board.dataset.phase = String(phase);
    onStatus?.(text);
  }

  function setFocus(nextFocus) {
    if (!polishedTutorial) return;
    board.classList.remove('focus-start','focus-route','focus-drive','focus-goal','focus-complete');
    board.classList.add(`focus-${nextFocus}`);
  }

  function wakeGoal(t) {
    const goalRequirements = logic?.requirements?.goal || [];
    if (!polishedTutorial || machine.goalAwake || !machineRequirementsMet(machine, goalRequirements) || t < checkpoints.goalWakeAt) return;
    machine.goalAwake = true;
    const goal = nodes.get('goal');
    goal?.classList.add('activated', 'goal-awake');
    setNodeImage(goal, P.interaction.goalYellowActive);
    playPolishFx(P.fx.fxGoalGlow, 77, 79, 'fx-goal-warmup', 900);
    onEffect?.('roll-goal');
    later(() => onEffect?.('goal-warmup'), 70);
    updateTutorialPhase(7, copy.goal || 'Receiver charged.');
    setFocus(focus.goal || 'goal');
  }

  function fireJointFeedback(t) {
    const joints = scene.joints || [];
    joints.forEach((joint, index) => {
      if (t < joint || firedJoints.has(index)) return;
      firedJoints.add(index);
      const point = pointOnSampledPath(sampledPath, joint);
      board.classList.remove('micro-impact');
      void board.offsetWidth;
      board.classList.add('micro-impact');
      onEffect?.('track-tick');
      if (polishedTutorial && index === 1) {
        playPolishFx(P.fx.fxWoodDustSmall, point.x, point.y, 'fx-track-dust', 480);
      }
    });
  }

  function finishGoal() {
    const finishRequirements = logic?.requirements?.finish || [];
    if (polishedTutorial && !machineRequirementsMet(machine, finishRequirements)) {
      onEffect?.('fail-soft');
      onFail?.('The machine chain did not complete.');
      return;
    }

    ball.classList.add('at-goal');
    onEffect?.('goal-sink');
    impact('goal-impact');

    if (polishedTutorial) {
      machine.complete = true;
      const goal = nodes.get('goal');
      const gear = nodes.get('gear');
      gear?.classList.remove('drive-live');
      gear?.classList.add('drive-coast');
      board.classList.remove('drive-live');
      board.classList.add('machine-complete');
      setNodeImage(goal, P.interaction.goalYellowSuccess);
      goal?.classList.add('goal-success');
      updateTutorialPhase(8, copy.complete || 'Machine complete.');
      setFocus(focus.complete || 'complete');
      playPolishFx(P.fx.fxGoalGlow, 77, 79, 'fx-goal', 950);
      later(() => playPolishFx(P.fx.fxSuccessBurst, 77, 75, 'fx-success', 1100), 90);
      later(() => completionWave(77,79), 50);
    }

    later(() => {
      if (!destroyed) onGoal?.();
    }, polishedTutorial ? timings.resultDelay : 310);
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
          machine.star = true;
          machine.goalPowered = true;
          board.classList.add('star-secured','goal-powered');
          node.classList.add('polish-collecting');
          setNodeImage(node, P.interaction.starCollect1);
          playPolishFx(P.fx.fxStarBurst, event.x, event.y, 'fx-star', 780);
          later(() => setNodeImage(node, P.interaction.starCollect2), 90);
          later(() => setNodeImage(node, P.interaction.starCollectDone), 195);
          later(() => node.classList.add('polish-collected'), 360);
          updateTutorialPhase(6, copy.reward || 'Energy captured.');
          pulsePowerBus();
          later(() => onEffect?.('power'), 95);
        } else {
          node?.classList.add('collected');
        }
        onStar?.();
        sparkAt(event.x, event.y, 6);
        impact('star-impact');
        return;
      }

      if (event.type === 'goal') {
        const goal = nodes.get('goal');
        goal?.classList.add('activated');
        nodes.get('goalSocket')?.classList.add('activated');
        if (polishedTutorial && machineRequirementsMet(machine, logic?.requirements?.goal || []) && !machine.goalAwake) {
          machine.goalAwake = true;
          setNodeImage(goal, P.interaction.goalYellowActive);
          playPolishFx(P.fx.fxGoalGlow, event.x, event.y, 'fx-goal-warmup', 900);
          onEffect?.('roll-goal');
          setFocus(focus.goal || 'goal');
        }
        onEffect?.('goal');
        sparkAt(event.x, event.y, 7);
      }
    });
  }

  function pulsePowerBus() {
    const bus = board.querySelector('.power-bus');
    if (!bus) return;
    bus.classList.remove('pulse');
    void bus.offsetWidth;
    bus.classList.add('pulse');
    later(() => bus.classList.remove('pulse'), 900);
  }

  function impact(className) {
    board.classList.remove(className);
    void board.offsetWidth;
    board.classList.add(className);
    later(() => board.classList.remove(className), 420);
  }

  function completionWave(x,y) {
    const root = board.querySelector('.machine-fx');
    const wave = document.createElement('span');
    wave.className = 'completion-wave';
    wave.style.left = `${x}%`;
    wave.style.top = `${y}%`;
    root.appendChild(wave);
    later(() => wave.remove(), 900);
  }

  function disableControls() {
    nodes.forEach((node,id) => {
      if (!pieces.get(id)?.interactive) return;
      node.disabled = true;
      node.classList.remove('interactive');
    });
  }

  function nodePoint(node) {
    if (!node) return {x:50,y:50};
    const boardRect = board.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height) return {x:50,y:50};
    return {
      x: ((nodeRect.left + nodeRect.width * .5 - boardRect.left) / boardRect.width) * 100,
      y: ((nodeRect.top + nodeRect.height * .5 - boardRect.top) / boardRect.height) * 100,
    };
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

  function sparkAtNode(node, count) {
    const point = nodePoint(node);
    sparkAt(point.x, point.y, count);
  }

  function sparkAt(x, y, count) {
    const root = board.querySelector('.machine-fx');
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElement('i');
      spark.style.left = `${x}%`;
      spark.style.top = `${y}%`;
      spark.style.setProperty('--x', `${(Math.random() - .5) * 58}px`);
      spark.style.setProperty('--y', `${-14 - Math.random() * 38}px`);
      spark.style.animationDelay = `${Math.random() * 55}ms`;
      root.appendChild(spark);
      later(() => spark.remove(), 760);
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
  const subdivisions = 28;
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

function motionAt(profile, raw) {
  const points = Array.isArray(profile) && profile.length >= 2
    ? profile
    : [
        {time:0,progress:0},
        {time:.10,progress:.045},
        {time:.30,progress:.255},
        {time:.52,progress:.49},
        {time:.72,progress:.69},
        {time:.90,progress:.88},
        {time:1,progress:1},
      ];

  const t = Math.max(0,Math.min(1,raw));
  let a = points[0];
  let b = points[points.length - 1];
  for (let i = 1; i < points.length; i += 1) {
    if (t <= points[i].time) {
      a = points[i - 1];
      b = points[i];
      break;
    }
  }

  const span = Math.max(.0001,b.time - a.time);
  let u = Math.max(0,Math.min(1,(t - a.time) / span));
  if (a.time === 0) u = easeOutCubic(u);
  if (b.time === 1) u = easeInOutSine(u);
  const progress = a.progress + (b.progress - a.progress) * u;
  const speed = (b.progress - a.progress) / span;
  return {progress:Math.max(0,Math.min(1,progress)),speed};
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
function easeInOutSine(t){return -(Math.cos(Math.PI*t)-1)/2}
