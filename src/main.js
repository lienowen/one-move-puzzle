import Matter from 'matter-js';
import { levels } from './levels.js';
import { loadSave, storeSave, recordAttempt, recordClear } from './core/save.js';
import { sfx, haptic } from './core/audio.js';

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];
const READY_LEVELS = 1;

const dom = {
  home: $('#homeScreen'), levels: $('#levelsScreen'), game: $('#gameScreen'), world: $('#world'), stage: $('#stage'),
  grid: $('#levelGrid'), result: $('#resultSheet'), settings: $('#settingsSheet'), toast: $('#toast'),
  levelNumber: $('#levelNumber'), levelTitle: $('#levelTitle'), hint: $('#levelHint'), status: $('#statusText'), move: $('#moveToken'),
  resultTitle: $('#resultTitle'), resultCopy: $('#resultCopy'), resultStars: $('#resultStars'), resultBadge: $('#resultBadge'),
  homeStars: $('#homeStars'), levelStars: $('#levelStars'), continueLabel: $('#continueLabel'), miniProgress: $('#miniProgress'),
  pullCoach: $('#pullCoach'), boardPlaque: $('#boardPlaque')
};

const VISUAL_WIDTH = {
  ball: 15, goal: 18, star: 12, block: 17, plank: 34, slope: 36, gate: 19,
  bumper: 17, trapdoor: 22, fan: 19, portal: 19, key: 15, conveyor: 34,
  magnet: 22, pressure: 14, spring: 17, seesaw: 34, gear: 15, wall: 20,
  rail: 34, pin: 29
};

let save = loadSave();
let engine = null;
let runnerFrame = 0;
let current = 0;
let bodyById = new Map();
let spriteById = new Map();
let entityById = new Map();
let moveUsed = false;
let resolved = false;
let bonusStar = false;
let timeoutId = 0;
let portalLockUntil = 0;
let lastTime = performance.now();

function showScreen(name) {
  [dom.home, dom.levels, dom.game].forEach(s => s.classList.remove('active'));
  dom[name].classList.add('active');
}

function totalStars() {
  return Object.values(save.stars).reduce((a,b) => a + Number(b || 0), 0);
}

function refreshMeta() {
  const stars = totalStars();
  dom.homeStars.textContent = stars;
  dom.levelStars.textContent = stars;
  const next = Math.min(Math.max(save.unlocked || 1, 1), READY_LEVELS);
  dom.continueLabel.textContent = `LEVEL ${String(next).padStart(2,'0')}`;
  $('#soundToggle b').textContent = save.sound ? 'ON' : 'OFF';
  $('#hapticsToggle b').textContent = save.haptics ? 'ON' : 'OFF';
}

function renderLevelGrid() {
  dom.grid.innerHTML = '';
  levels.forEach((level, index) => {
    const n = index + 1;
    const ready = n <= READY_LEVELS;
    const unlocked = ready && n <= Math.max(save.unlocked || 1, 1);
    const stars = save.stars[level.id] || 0;
    const btn = document.createElement('button');
    btn.className = `level-card${unlocked ? '' : ' locked'}${ready ? '' : ' workshop-build'}`;
    btn.type = 'button';
    btn.disabled = !unlocked;
    const footer = ready
      ? (stars ? '★'.repeat(stars) + '☆'.repeat(3-stars) : 'READY')
      : 'IN WORKSHOP';
    btn.innerHTML = `<span class="level-index">${String(n).padStart(2,'0')}</span><strong>${level.name}</strong><small>${level.subtitle}</small><div class="card-stars">${footer}</div>`;
    if (unlocked) btn.addEventListener('click', () => startLevel(index));
    dom.grid.appendChild(btn);
  });
}

function startLevel(index) {
  current = Math.max(0, Math.min(index, READY_LEVELS - 1));
  showScreen('game');
  dom.result.hidden = true;
  requestAnimationFrame(buildLevel);
}

function buildLevel() {
  destroyWorld();
  const level = levels[current];
  moveUsed = false;
  resolved = false;
  bonusStar = false;
  portalLockUntil = 0;

  dom.stage.classList.remove('running', 'solved');
  dom.stage.dataset.level = level.id;
  dom.stage.dataset.board = level.board || 'workshop';
  dom.pullCoach.hidden = !level.tutorial;
  dom.boardPlaque.textContent = `LEVEL ${current + 1}`;
  dom.resultBadge.classList.remove('fail');
  dom.move.classList.remove('used');
  dom.move.querySelector('strong').textContent = '1';
  dom.levelNumber.textContent = `LEVEL ${String(current + 1).padStart(2,'0')}`;
  dom.levelTitle.textContent = level.name;
  dom.hint.textContent = level.hint;
  dom.status.textContent = level.tutorial ? 'Pull the blue pin.' : 'One touch changes the whole machine.';
  renderMiniProgress();

  const rect = dom.stage.getBoundingClientRect();
  engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 0;
  engine.positionIterations = 12;
  engine.velocityIterations = 10;

  dom.world.innerHTML = '';
  bodyById.clear();
  spriteById.clear();
  entityById.clear();
  level.entities.forEach(e => addEntity(e, rect));
  addBounds(rect);

  Events.on(engine, 'collisionStart', onCollisionStart);
  Events.on(engine, 'collisionActive', onCollisionActive);
  lastTime = performance.now();
  runnerFrame = requestAnimationFrame(tick);
}

function addEntity(e, rect) {
  const x = rect.width * e.x / 100;
  const y = rect.height * e.y / 100;
  const w = rect.width * e.w / 100;
  const h = rect.height * e.h / 100;
  const angle = (e.angle || 0) * Math.PI / 180;
  const common = {
    isStatic: !!e.static || !!e.sensor,
    isSensor: !!e.sensor,
    restitution: e.restitution ?? .08,
    friction: e.friction ?? .22,
    frictionStatic: e.frictionStatic ?? .45,
    frictionAir: e.kind === 'ball' ? .006 : .014,
    angle,
    label: e.id,
    plugin: { entityId: e.id }
  };

  let body;
  if (e.shape === 'circle') {
    body = Bodies.circle(x, y, Math.min(w, h) * (e.bodyRadius ?? .45), common);
  } else {
    body = Bodies.rectangle(
      x,
      y,
      Math.max(w * (e.bodyScaleX ?? .80), 10),
      Math.max(h * (e.bodyScaleY ?? .58), 7),
      common
    );
  }

  if (e.dynamic) Sleeping.set(body, true);
  bodyById.set(e.id, body);
  entityById.set(e.id, e);
  Composite.add(engine.world, body);

  const sprite = document.createElement(e.interactive ? 'button' : 'div');
  if (e.interactive) sprite.type = 'button';
  sprite.className = `entity kind-${e.kind}${e.interactive ? ' interactive' : ''}${e.visualH ? ' has-visual-height' : ''}`;
  sprite.dataset.id = e.id;
  sprite.style.width = `${e.visualW ?? VISUAL_WIDTH[e.kind] ?? Math.max(e.w, 14)}%`;
  if (e.visualH) sprite.style.height = `${e.visualH}%`;
  if (e.visualScale) sprite.style.setProperty('--visual-scale', e.visualScale);
  sprite.innerHTML = entityMarkup(e);
  if (e.interactive) sprite.addEventListener('click', ev => useMove(e.id, ev));
  dom.world.appendChild(sprite);
  spriteById.set(e.id, sprite);
  syncSprite(body, sprite);
}

function entityMarkup(e) {
  if (e.render === 'rail') {
    return '<span class="rail-piece"><i class="rail-screw left"></i><i class="rail-screw right"></i></span>';
  }
  if (e.render === 'pin') {
    return '<span class="pin-machine"><i class="pin-rod"></i><i class="pin-knob"></i><i class="pin-collar"></i><b>PULL</b></span>';
  }
  return `<img src="${e.asset}" alt="" draggable="false">`;
}

function addBounds(rect) {
  const t = 60;
  Composite.add(engine.world, [
    Bodies.rectangle(rect.width/2, rect.height + t/2, rect.width + t*2, t, { isStatic:true, label:'bound-bottom' }),
    Bodies.rectangle(-t/2, rect.height/2, t, rect.height*2, { isStatic:true, label:'bound-left' }),
    Bodies.rectangle(rect.width+t/2, rect.height/2, t, rect.height*2, { isStatic:true, label:'bound-right' })
  ]);
}

function useMove(id, ev) {
  if (moveUsed || resolved || !engine) return;
  const entity = entityById.get(id);
  if (!entity?.interactive) return;

  moveUsed = true;
  recordAttempt(save, levels[current].id);
  dom.move.classList.add('used');
  dom.move.querySelector('strong').textContent = '0';
  dom.pullCoach.hidden = true;
  dom.stage.classList.add('running');
  sfx.tap(save.sound);
  haptic(save.haptics);
  tapFx(ev);
  $$('.entity.interactive').forEach(el => el.classList.remove('interactive'));
  dom.status.textContent = id === levels[current].solution ? 'Pin released. Watch the machine.' : 'Move committed. Let the machine answer.';

  const body = bodyById.get(id);
  if (entity.action === 'remove') {
    if (body) {
      Composite.remove(engine.world, body);
      bodyById.delete(id);
    }
    const sprite = spriteById.get(id);
    if (entity.kind === 'pin') sprite?.classList.add('pulled');
    else sprite?.classList.add('removed');
  } else if (entity.action === 'rotate' && body) {
    Body.setAngle(body, body.angle + (entity.actionValue || 15) * Math.PI / 180);
  } else if (entity.action === 'impulse') {
    const ball = bodyById.get('ball');
    if (ball) Body.applyForce(ball, ball.position, entity.force || {x:.01,y:0});
  }

  engine.gravity.y = 1;
  engine.gravity.scale = levels[current].gravityScale || .00108;
  [...bodyById.values()].forEach(b => { if (!b.isStatic) Sleeping.set(b, false); });
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => failLevel('The machine ran out of room.'), 10000);
  if (id !== levels[current].solution) {
    setTimeout(() => { if (!resolved) failLevel('That move broke the chain.'); }, 2400);
  }
}

function tick(now) {
  if (!engine) return;
  const delta = Math.min(32, Math.max(8, now - lastTime));
  lastTime = now;
  Engine.update(engine, delta);
  const rect = dom.stage.getBoundingClientRect();
  bodyById.forEach((body,id) => syncSprite(body, spriteById.get(id)));
  applyContinuousEffects();
  const ball = bodyById.get('ball');
  if (moveUsed && ball && (ball.position.y > rect.height + 40 || ball.position.x < -50 || ball.position.x > rect.width + 50)) {
    failLevel('The ball escaped the machine.');
  }
  runnerFrame = requestAnimationFrame(tick);
}

function syncSprite(body, sprite) {
  if (!body || !sprite) return;
  sprite.style.left = `${body.position.x}px`;
  sprite.style.top = `${body.position.y}px`;
  sprite.style.transform = `translate(-50%,-50%) rotate(${body.angle}rad) scale(var(--visual-scale,1))`;
}

function onCollisionStart(event) {
  for (const pair of event.pairs) {
    const ids = [pair.bodyA.label, pair.bodyB.label];
    if (!ids.includes('ball')) continue;
    const otherId = ids[0] === 'ball' ? ids[1] : ids[0];
    const e = entityById.get(otherId);
    if (!e) continue;

    if (e.kind === 'goal') return winLevel();

    if (e.kind === 'star' && !bonusStar) {
      bonusStar = true;
      sfx.star(save.sound);
      haptic(save.haptics, [12,30,12]);
      spriteById.get(otherId)?.classList.add('collected');
      const b = bodyById.get(otherId);
      if (b) {
        Composite.remove(engine.world,b);
        bodyById.delete(otherId);
      }
      dom.status.textContent = 'Star collected. Keep rolling.';
    }

    if (e.effect === 'boost') {
      const ball = bodyById.get('ball');
      if (ball) {
        Body.applyForce(ball, ball.position, e.force || {x:.015,y:-.01});
        sfx.metal(save.sound);
      }
    }
    if (e.effect === 'portal' && performance.now() > portalLockUntil) teleportBall(e.target);
    if (e.effect === 'key') unlockTarget(e.target);
    if (e.effect === 'chime') {
      sfx.metal(save.sound);
      spriteById.get(otherId)?.classList.add('struck');
    }
  }
}

function onCollisionActive(event) {
  for (const pair of event.pairs) {
    const ids = [pair.bodyA.label, pair.bodyB.label];
    if (!ids.includes('ball')) continue;
    const e = entityById.get(ids[0] === 'ball' ? ids[1] : ids[0]);
    if (e?.effect === 'conveyor') {
      const ball = bodyById.get('ball');
      if (ball) Body.applyForce(ball, ball.position, e.force || {x:.004,y:0});
    }
  }
}

function applyContinuousEffects() {
  if (!moveUsed) return;
  const ball = bodyById.get('ball');
  if (!ball) return;
  entityById.forEach((e,id) => {
    if (e.effect !== 'magnet') return;
    const magnet = bodyById.get(id);
    if (!magnet) return;
    const dx = magnet.position.x - ball.position.x;
    const dy = magnet.position.y - ball.position.y;
    const d = Math.hypot(dx,dy);
    if (d < dom.stage.clientWidth * .42 && d > 10) {
      Body.applyForce(ball, ball.position, {x:dx/d*.00045, y:dy/d*.00045});
    }
  });
}

function teleportBall(targetId) {
  const ball = bodyById.get('ball');
  const target = bodyById.get(targetId);
  if (!ball || !target) return;
  portalLockUntil = performance.now() + 650;
  const vx = ball.velocity.x;
  const vy = ball.velocity.y;
  Body.setPosition(ball, {x:target.position.x + 18, y:target.position.y + 25});
  Body.setVelocity(ball, {x:Math.max(2.4,vx), y:Math.min(2,vy)});
  sfx.star(save.sound);
  haptic(save.haptics, 22);
}

function unlockTarget(id) {
  const body = bodyById.get(id);
  const sprite = spriteById.get(id);
  if (body) {
    Composite.remove(engine.world, body);
    bodyById.delete(id);
  }
  sprite?.classList.add('unlocked');
  sfx.metal(save.sound);
}

function winLevel() {
  if (resolved || !moveUsed) return;
  resolved = true;
  clearTimeout(timeoutId);
  const stars = bonusStar ? 3 : 2;
  recordClear(save, levels[current].id, current + 1, stars);
  sfx.win(save.sound);
  haptic(save.haptics, [20,35,20,35,40]);
  dom.stage.classList.add('solved');
  spriteById.get('goal')?.classList.add('goal-win');
  setTimeout(() => {
    dom.resultBadge.textContent = '★';
    dom.resultTitle.textContent = stars === 3 ? 'Perfect machine' : 'Machine solved';
    dom.resultStars.textContent = '★'.repeat(stars) + '☆'.repeat(3-stars);
    dom.resultCopy.textContent = bonusStar ? 'One pull. Full chain. Bonus collected.' : 'Solved. Catch the bonus star for a perfect clear.';
    if (current + 1 >= READY_LEVELS) {
      $('#nextBtn').querySelector('span').textContent = 'WORKSHOP';
      $('#nextBtn').querySelector('small').textContent = 'MORE MACHINES SOON';
    }
    dom.result.hidden = false;
    refreshMeta();
  }, 520);
}

function failLevel(copy) {
  if (resolved || !moveUsed) return;
  resolved = true;
  clearTimeout(timeoutId);
  sfx.fail(save.sound);
  haptic(save.haptics, [45,35,45]);
  setTimeout(() => {
    dom.resultBadge.textContent = '×';
    dom.resultBadge.classList.add('fail');
    dom.resultTitle.textContent = 'Chain failed';
    dom.resultStars.textContent = '☆☆☆';
    dom.resultCopy.textContent = copy;
    $('#nextBtn').querySelector('span').textContent = 'TRY AGAIN';
    $('#nextBtn').querySelector('small').textContent = 'ONE MORE MOVE';
    dom.result.hidden = false;
  }, 250);
}

function closeResultAndRestart() {
  dom.result.hidden = true;
  dom.resultBadge.classList.remove('fail');
  $('#nextBtn').querySelector('span').textContent = 'NEXT';
  $('#nextBtn').querySelector('small').textContent = 'KEEP GOING';
  buildLevel();
}

function nextAction() {
  if (!resolved) return;
  const passed = (save.stars[levels[current].id] || 0) > 0;
  dom.result.hidden = true;
  dom.resultBadge.classList.remove('fail');
  $('#nextBtn').querySelector('span').textContent = 'NEXT';
  $('#nextBtn').querySelector('small').textContent = 'KEEP GOING';

  if (!passed) return buildLevel();
  if (current + 1 < READY_LEVELS) return startLevel(current + 1);

  destroyWorld();
  renderLevelGrid();
  showScreen('levels');
}

function destroyWorld() {
  cancelAnimationFrame(runnerFrame);
  clearTimeout(timeoutId);
  if (engine) {
    Events.off(engine);
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  }
  engine = null;
}

function renderMiniProgress() {
  dom.miniProgress.innerHTML = Array.from({length: READY_LEVELS}, (_,i) => `<i class="${i === current ? 'active' : i < save.unlocked - 1 ? 'done' : ''}"></i>`).join('');
}

function tapFx(ev) {
  const rect = dom.stage.getBoundingClientRect();
  const fx = $('#tapFx');
  fx.style.left = `${ev.clientX - rect.left}px`;
  fx.style.top = `${ev.clientY - rect.top}px`;
  fx.classList.remove('show');
  void fx.offsetWidth;
  fx.classList.add('show');
}

$('#playBtn').addEventListener('click', () => startLevel(Math.min((save.unlocked || 1) - 1, READY_LEVELS - 1)));
$('#levelsBtn').addEventListener('click', () => { renderLevelGrid(); showScreen('levels'); });
$('#levelsBackBtn').addEventListener('click', () => showScreen('home'));
$('#gameBackBtn').addEventListener('click', () => { destroyWorld(); refreshMeta(); showScreen('home'); });
$('#restartBtn').addEventListener('click', buildLevel);
$('#retryBtn').addEventListener('click', closeResultAndRestart);
$('#nextBtn').addEventListener('click', nextAction);
$('#settingsBtn').addEventListener('click', () => { dom.settings.hidden = false; refreshMeta(); });
$('#closeSettingsBtn').addEventListener('click', () => dom.settings.hidden = true);
$('#soundToggle').addEventListener('click', () => { save.sound = !save.sound; storeSave(save); refreshMeta(); sfx.tap(save.sound); });
$('#hapticsToggle').addEventListener('click', () => { save.haptics = !save.haptics; storeSave(save); refreshMeta(); haptic(save.haptics); });
window.addEventListener('resize', () => { if (dom.game.classList.contains('active')) buildLevel(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && engine) engine.timing.timeScale = 0;
  else if (engine) engine.timing.timeScale = 1;
});

refreshMeta();