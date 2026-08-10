import { levels } from './levels.js';
import { loadSave, storeSave, recordAttempt, recordClear } from './core/save.js';
import { sfx, haptic } from './core/audio.js';
import { mountMachineRuntime } from './runtimeRouter.js';
import { getMachineLogic } from './machineLogic.js';
import { POLISH_ASSETS as P } from './polishAssets.js';
import { WORKSHOP_ASSETS as W } from './workshopAssets.js';

const $ = selector => document.querySelector(selector);

const dom = {
  home: $('#homeScreen'), levels: $('#levelsScreen'), game: $('#gameScreen'), world: $('#world'),
  stage: $('#stage'), grid: $('#levelGrid'), result: $('#resultSheet'), settings: $('#settingsSheet'),
  levelNumber: $('#levelNumber'), levelTitle: $('#levelTitle'), hint: $('#levelHint'), status: $('#statusText'),
  move: $('#moveToken'), resultTitle: $('#resultTitle'), resultCopy: $('#resultCopy'), resultStars: $('#resultStars'),
  resultBadge: $('#resultBadge'), homeStars: $('#homeStars'), levelStars: $('#levelStars'),
  continueLabel: $('#continueLabel'), miniProgress: $('#miniProgress'), tapFx: $('#tapFx'),
};

let save = loadSave();
let current = 0;
let runtime = null;
let moveUsed = false;
let resolved = false;
let bonusStar = false;

function installPolishUi() {
  const brand = $('.brand-lockup');
  if (brand && P.ui.uiLogo) {
    brand.innerHTML = `<img src="${P.ui.uiLogo}" alt="One Move Puzzle" draggable="false" class="brand-logo-art">`;
  }

  const hero = $('.hero-board');
  if (hero) {
    hero.classList.add('hero-machine-preview');
    hero.innerHTML = `
      <div class="home-machine" aria-hidden="true">
        <img class="home-machine-board" src="${W.base.boardWorkshopBase}" alt="" draggable="false">
        <div class="home-machine-deck"></div>
        <svg class="home-machine-route" viewBox="0 0 100 70" preserveAspectRatio="none">
          <path d="M 19 18 C 30 18, 31 32, 43 34 S 58 48, 67 48 S 77 52, 83 58"></path>
          <path class="home-route-light" d="M 19 18 C 30 18, 31 32, 43 34 S 58 48, 67 48 S 77 52, 83 58"></path>
        </svg>
        <div class="home-preview-ball"></div>
        <img class="home-preview-pin" src="${P.interaction.pinBlueIdle}" alt="" draggable="false">
        <img class="home-preview-gear" src="${W.mechanisms.gear}" alt="" draggable="false">
        <img class="home-preview-star" src="${P.interaction.starIdle}" alt="" draggable="false">
        <img class="home-preview-goal" src="${P.interaction.goalYellowIdle}" alt="" draggable="false">
        <span class="home-preview-cue"><i></i><i></i><i></i></span>
      </div>
    `;
  }
}

function showScreen(name) {
  [dom.home, dom.levels, dom.game].forEach(screen => screen.classList.remove('active'));
  dom[name].classList.add('active');
}

function totalStars() {
  return Object.values(save.stars || {}).reduce((sum,value) => sum + Number(value || 0), 0);
}

function unlockedLevelCount() {
  return Math.max(1, Math.min(levels.length, Number(save.unlocked || 1)));
}

function displayMeta(level) {
  const logic = getMachineLogic(level.id);
  return {
    name: logic?.displayName || level.name,
    subtitle: logic?.displaySubtitle || level.subtitle,
  };
}

function refreshMeta() {
  const stars = totalStars();
  dom.homeStars.textContent = stars;
  dom.levelStars.textContent = stars;
  dom.continueLabel.textContent = `LEVEL ${String(unlockedLevelCount()).padStart(2,'0')}`;
  $('#soundToggle b').textContent = save.sound ? 'ON' : 'OFF';
  $('#hapticsToggle b').textContent = save.haptics ? 'ON' : 'OFF';
}

function renderLevelGrid() {
  dom.grid.innerHTML = '';
  const unlocked = unlockedLevelCount();
  levels.forEach((level,index) => {
    const number = index + 1;
    const open = number <= unlocked;
    const stars = Number(save.stars[level.id] || 0);
    const meta = displayMeta(level);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `level-card${open ? '' : ' locked'}`;
    button.disabled = !open;
    button.innerHTML = `
      <span class="level-index">LEVEL ${String(number).padStart(2,'0')}</span>
      <img class="level-card-icon" src="${level.icon}" alt="" draggable="false">
      <strong>${meta.name}</strong>
      <small>${meta.subtitle}</small>
      <div class="card-stars">${stars ? '★'.repeat(stars) + '☆'.repeat(3-stars) : open ? 'READY' : 'LOCKED'}</div>
    `;
    if (open) button.addEventListener('click', () => startLevel(index));
    dom.grid.appendChild(button);
  });
}

function startLevel(index) {
  current = Math.max(0, Math.min(index, levels.length - 1));
  if (current + 1 > unlockedLevelCount()) current = unlockedLevelCount() - 1;
  dom.result.hidden = true;
  showScreen('game');
  requestAnimationFrame(buildLevel);
}

function guidanceFor(level, logic) {
  if (!logic) return { hint:level.hint, status:level.status || 'Choose one piece.' };
  if (logic.archetype === 'maze-one-turn') {
    return { hint:'Rotate one tile to connect the whole route.', status:logic.copy?.ready || 'Study the maze.' };
  }
  if (logic.archetype === 'choice-gate') {
    return { hint:'Follow the linkage to the gate.', status:logic.copy?.ready || 'Trace the linkage.' };
  }
  if (logic.archetype === 'route-align') {
    return { hint:'Find what turns the broken bridge.', status:logic.copy?.ready || 'Read the broken route.' };
  }
  if (logic.archetype === 'signal-match') {
    return { hint:'Match the control to the receiver.', status:logic.copy?.ready || 'Read the signal path.' };
  }
  return { hint:level.hint, status:level.status || 'Choose one piece.' };
}

function buildLevel() {
  destroyRuntime();
  const level = levels[current];
  const logic = getMachineLogic(level.id);
  const guidance = guidanceFor(level, logic);
  const meta = displayMeta(level);
  moveUsed = false;
  resolved = false;
  bonusStar = false;

  dom.stage.className = 'stage';
  dom.result.hidden = true;
  dom.resultBadge.className = 'result-badge';
  dom.resultBadge.textContent = '★';
  dom.move.classList.remove('used');
  dom.move.querySelector('strong').textContent = '1';
  dom.levelNumber.textContent = `LEVEL ${String(current + 1).padStart(2,'0')}`;
  dom.levelTitle.textContent = meta.name;
  dom.hint.textContent = guidance.hint;
  dom.status.textContent = guidance.status;
  resetResultButton();
  renderMiniProgress();

  runtime = mountMachineRuntime({
    world: dom.world,
    stage: dom.stage,
    level,
    onMove: useMove,
    onStar: () => {
      if (bonusStar) return;
      bonusStar = true;
      sfx.star(save.sound);
      haptic(save.haptics,[7,18,11]);
      dom.status.textContent = 'Energy captured.';
    },
    onEffect: playEffect,
    onGoal: winLevel,
    onFail: failLevel,
    onStatus: text => { dom.status.textContent = text; },
  });
}

function useMove(id, event) {
  if (moveUsed || resolved || !runtime) return;
  const outcome = runtime.commit(id);
  if (!outcome.accepted) return;
  moveUsed = true;
  recordAttempt(save, levels[current].id);
  dom.move.classList.add('used');
  dom.move.querySelector('strong').textContent = '0';
  dom.stage.classList.add('running');
  if (!outcome.effectHandled) {
    sfx.tap(save.sound);
    haptic(save.haptics,12);
  }
  tapFx(event);
}

function playEffect(type) {
  if (type === 'pin-grab') { sfx.grab(save.sound); haptic(save.haptics,5); return; }
  if (type === 'pin-detent') { sfx.detent(save.sound); haptic(save.haptics,8); return; }
  if (type === 'pin-reset') { sfx.tap(save.sound); return; }
  if (type === 'pin-release') { sfx.release(save.sound); haptic(save.haptics,[12,18,8]); return; }

  if (type === 'trigger') { sfx.trigger(save.sound); haptic(save.haptics,6); return; }
  if (type === 'drive') { sfx.drive(save.sound); haptic(save.haptics,[4,14,6]); return; }
  if (type === 'gate-preload') { sfx.gatePreload(save.sound); haptic(save.haptics,5); return; }
  if (type === 'gate-open') { sfx.gateOpen(save.sound); haptic(save.haptics,[7,12,10]); return; }
  if (type === 'power') { sfx.power(save.sound); haptic(save.haptics,[5,17,7]); return; }

  if (type === 'roll-start') { sfx.rollStart(save.sound); return; }
  if (type === 'roll-brake') { sfx.rollMood('brake'); haptic(save.haptics,3); return; }
  if (type === 'roll-resume') { sfx.rollMood('run'); return; }
  if (type === 'roll-goal') { sfx.rollMood('goal'); return; }

  if (type === 'track-tick') { sfx.track(save.sound); haptic(save.haptics,4); return; }
  if (type === 'wood') { sfx.wood(save.sound); haptic(save.haptics,7); return; }
  if (type === 'metal') { sfx.metal(save.sound); haptic(save.haptics,7); return; }
  if (type === 'goal-warmup') { sfx.goal(save.sound); haptic(save.haptics,5); return; }
  if (type === 'goal') { sfx.goal(save.sound); haptic(save.haptics,[6,16,7]); return; }
  if (type === 'goal-sink') { sfx.sink(save.sound); haptic(save.haptics,[11,18,23]); return; }
  if (type === 'tap') { sfx.tap(save.sound); haptic(save.haptics,7); return; }
  if (type === 'fail-soft') { sfx.wood(save.sound); haptic(save.haptics,24); }
}

function renderResultStars(stars) {
  dom.resultStars.innerHTML = [0,1,2].map(index => {
    const asset = index < stars ? P.ui.uiStarFull : P.ui.uiStarEmpty;
    return `<img src="${asset}" alt="" draggable="false" style="width:36px;height:36px;object-fit:contain;filter:drop-shadow(0 5px 5px rgba(83,45,5,.16))">`;
  }).join('');
  Object.assign(dom.resultStars.style,{display:'flex',alignItems:'center',justifyContent:'center',gap:'5px'});
}

function winLevel() {
  if (resolved || !moveUsed) return;
  resolved = true;
  const level = levels[current];
  const stars = bonusStar ? 3 : 2;
  recordClear(save,level.id,current + 1,stars);
  dom.stage.classList.add('solved');
  sfx.win(save.sound);
  haptic(save.haptics,[10,22,14,28,24]);

  window.setTimeout(() => {
    dom.resultBadge.innerHTML = P.ui.uiStarFull
      ? `<img src="${P.ui.uiStarFull}" alt="" draggable="false" style="width:48px;height:48px;object-fit:contain">`
      : '★';
    dom.resultTitle.textContent = stars === 3 ? 'Perfect machine' : 'Machine solved';
    renderResultStars(stars);
    dom.resultCopy.textContent = stars === 3 ? 'One move. Every mechanism connected.' : 'Solved in one move.';
    if (current === levels.length - 1) {
      $('#nextBtn span').textContent = 'WORKSHOP';
      $('#nextBtn small').textContent = 'ALL MACHINES';
    }
    dom.result.hidden = false;
    refreshMeta();
  },560);
}

function failLevel(copy = 'That move breaks the chain.') {
  if (resolved || !moveUsed) return;
  resolved = true;
  dom.stage.classList.add('failed');
  sfx.fail(save.sound);
  haptic(save.haptics,[36,28,36]);
  window.setTimeout(() => {
    dom.resultBadge.textContent = '×';
    dom.resultBadge.classList.add('fail');
    dom.resultTitle.textContent = 'Wrong move';
    renderResultStars(0);
    dom.resultCopy.textContent = copy;
    $('#nextBtn span').textContent = 'TRY AGAIN';
    $('#nextBtn small').textContent = 'ONE MORE MOVE';
    dom.result.hidden = false;
  },220);
}

function nextAction() {
  if (!resolved) return;
  const cleared = Number(save.stars[levels[current].id] || 0) > 0;
  dom.result.hidden = true;
  if (!cleared) { buildLevel(); return; }
  if (current < levels.length - 1) { startLevel(current + 1); return; }
  destroyRuntime();
  renderLevelGrid();
  showScreen('levels');
}

function replayLevel() {
  dom.result.hidden = true;
  buildLevel();
}

function destroyRuntime() {
  sfx.rollStop();
  runtime?.destroy();
  runtime = null;
  dom.world.innerHTML = '';
}

function renderMiniProgress() {
  dom.miniProgress.innerHTML = levels.map((_,index) => {
    const className = index === current ? 'active' : index < unlockedLevelCount() - 1 ? 'done' : '';
    return `<i class="${className}"></i>`;
  }).join('');
}

function tapFx(event) {
  const rect = dom.stage.getBoundingClientRect();
  const x = event?.clientX ? event.clientX - rect.left : rect.width / 2;
  const y = event?.clientY ? event.clientY - rect.top : rect.height / 2;
  dom.tapFx.style.left = `${x}px`;
  dom.tapFx.style.top = `${y}px`;
  dom.tapFx.classList.remove('show');
  void dom.tapFx.offsetWidth;
  dom.tapFx.classList.add('show');
}

function resetResultButton() {
  $('#nextBtn span').textContent = 'NEXT';
  $('#nextBtn small').textContent = 'KEEP GOING';
}

$('#playBtn').addEventListener('click', () => startLevel(unlockedLevelCount() - 1));
$('#levelsBtn').addEventListener('click', () => { renderLevelGrid(); showScreen('levels'); });
$('#levelsBackBtn').addEventListener('click', () => showScreen('home'));
$('#gameBackBtn').addEventListener('click', () => { destroyRuntime(); refreshMeta(); showScreen('home'); });
$('#restartBtn').addEventListener('click', buildLevel);
$('#retryBtn').addEventListener('click', replayLevel);
$('#nextBtn').addEventListener('click', nextAction);
$('#settingsBtn').addEventListener('click', () => { dom.settings.hidden = false; refreshMeta(); });
$('#closeSettingsBtn').addEventListener('click', () => { dom.settings.hidden = true; });
$('#soundToggle').addEventListener('click', () => {
  save.sound = !save.sound;
  if (!save.sound) sfx.rollStop();
  storeSave(save);
  refreshMeta();
  sfx.tap(save.sound);
});
$('#hapticsToggle').addEventListener('click', () => {
  save.haptics = !save.haptics;
  storeSave(save);
  refreshMeta();
  haptic(save.haptics,12);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) sfx.rollStop();
  else refreshMeta();
});

installPolishUi();
refreshMeta();
renderLevelGrid();
