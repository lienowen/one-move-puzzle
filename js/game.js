(() => {
  'use strict';

  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const stage = $('#stage');
  const objectsRoot = $('#objects');
  const levelNumber = $('#levelNumber');
  const levelTitle = $('#levelTitle');
  const movesLeft = $('#movesLeft');
  const moveBadge = $('.move-badge');
  const hintText = $('#hintText');
  const resultPanel = $('#resultPanel');
  const resultText = $('#resultText');
  const nextBtn = $('#nextBtn');
  const replayBtn = $('#replayBtn');
  const restartBtn = $('#restartBtn');
  const levelBtn = $('#levelBtn');
  const toast = $('#toast');
  const tapRipple = $('#tapRipple');

  const A1 = 'assets/sheet01/';
  const A2 = 'assets/sheet02/';
  let levelIndex = 0;
  let moveUsed = false;
  let running = false;
  let audioContext = null;
  let timers = [];

  const levels = [
    {
      title: 'Release',
      hint: 'Tap the glowing ball. Then let the machine do the rest.',
      clear: 'You touched it once. Gravity finished the job.',
      interactive: 'ball',
      objects: [
        o('ball', A1 + 'obj_ball_blue_1u_01.png', 19, 22, 20, 0, true),
        o('slope', A1 + 'obj_slope_wood_2u_01.png', 34, 36, 34, -2),
        o('plank', A1 + 'obj_plank_wood_2u_01.png', 55, 58, 34, 4),
        o('goal', A1 + 'goal_hole_yellow_1u_idle.png', 79, 76, 23, 0),
        o('wall', A1 + 'obj_wall_wood_2u_01.png', 87, 48, 23, 0),
      ],
      run: runLevel1,
    },
    {
      title: 'Trigger',
      hint: 'One button can open the whole route.',
      clear: 'A single trigger unlocked the chain.',
      interactive: 'button',
      objects: [
        o('ball', A2 + 'obj_ball_metal_1u_01.png', 17, 20, 18, 0),
        o('slope', A1 + 'obj_slope_wood_2u_01.png', 30, 31, 31, -2),
        o('gate', A1 + 'mech_gate_woodmetal_2u_idle.png', 51, 48, 27, 0),
        o('button', A1 + 'mech_button_yellow_1u_idle.png', 27, 72, 20, 0, true),
        o('plank', A1 + 'obj_plank_wood_2u_01.png', 62, 64, 34, 2),
        o('goal', A1 + 'goal_hole_yellow_1u_idle.png', 82, 78, 23, 0),
      ],
      run: runLevel2,
    },
    {
      title: 'Balance',
      hint: 'Tilt the seesaw once. Timing will handle the rest.',
      clear: 'One tilt turned three mechanisms into one answer.',
      interactive: 'seesaw',
      objects: [
        o('ball', A1 + 'obj_ball_blue_1u_01.png', 16, 30, 18, 0),
        o('upperPlank', A1 + 'obj_plank_wood_2u_01.png', 27, 38, 32, 4),
        o('spring', A1 + 'mech_spring_orange_1u_idle.png', 22, 74, 18, 0),
        o('block', A1 + 'obj_block_wood_1u_01.png', 22, 59, 17, 0),
        o('seesaw', A1 + 'mech_seesaw_wood_2u_01.png', 51, 68, 37, 0, true, true),
        o('goal', A1 + 'goal_hole_yellow_1u_idle.png', 82, 36, 23, 0),
        o('bumper', A2 + 'mech_bumper_blue_1u_idle.png', 72, 57, 18, 0),
      ],
      run: runLevel3,
    },
  ];

  function o(id, src, x, y, w, r = 0, interactive = false, noRing = false) {
    return { id, src, x, y, w, r, interactive, noRing };
  }

  function renderLevel(index) {
    clearTimers();
    levelIndex = (index + levels.length) % levels.length;
    const level = levels[levelIndex];
    moveUsed = false;
    running = false;
    resultPanel.hidden = true;
    movesLeft.textContent = '1';
    moveBadge.classList.remove('used', 'shake');
    levelNumber.textContent = String(levelIndex + 1).padStart(2, '0');
    levelTitle.textContent = level.title;
    hintText.textContent = level.hint;
    objectsRoot.innerHTML = '';

    level.objects.forEach(obj => {
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = `game-object${obj.interactive ? ' interactive' : ''}${obj.noRing ? ' no-ring' : ''}`;
      wrap.dataset.id = obj.id;
      wrap.style.setProperty('--x', obj.x + '%');
      wrap.style.setProperty('--y', obj.y + '%');
      wrap.style.setProperty('--w', obj.w + '%');
      wrap.style.setProperty('--r', obj.r + 'deg');
      wrap.setAttribute('aria-label', obj.interactive ? 'Movable puzzle piece' : obj.id);
      wrap.tabIndex = obj.interactive ? 0 : -1;
      const img = document.createElement('img');
      img.className = 'asset';
      img.alt = '';
      img.draggable = false;
      img.src = obj.src;
      wrap.appendChild(img);
      if (obj.interactive) wrap.addEventListener('click', e => useMove(obj.id, e));
      objectsRoot.appendChild(wrap);
    });

    $$('.progress-dot').forEach((dot, i) => dot.classList.toggle('active', i === levelIndex));
  }

  async function useMove(id, event) {
    if (running || moveUsed) return;
    const level = levels[levelIndex];
    if (id !== level.interactive) {
      wrongMove();
      return;
    }

    moveUsed = true;
    running = true;
    movesLeft.textContent = '0';
    moveBadge.classList.add('used');
    showRipple(event);
    ensureAudio();
    clickSound();
    const interactive = get(id);
    interactive?.classList.remove('interactive');
    try {
      await level.run();
      await wait(250);
      clearLevel();
    } catch (err) {
      console.error(err);
      showToast('Something slipped. Restarting…');
      later(() => renderLevel(levelIndex), 700);
    }
  }

  function wrongMove() {
    moveBadge.classList.remove('shake');
    void moveBadge.offsetWidth;
    moveBadge.classList.add('shake');
    showToast('Find the glowing piece — you only get one move.');
    thudSound();
  }

  function clearLevel() {
    running = false;
    const goal = get('goal');
    goal?.classList.add('success-glow');
    winSound();
    resultText.textContent = levels[levelIndex].clear;
    later(() => { resultPanel.hidden = false; }, 380);
    localStorage.setItem('oneMovePuzzleProgress', String(Math.max(levelIndex + 1, Number(localStorage.getItem('oneMovePuzzleProgress') || 0))));
  }

  async function runLevel1() {
    const ball = get('ball');
    const goal = get('goal');
    hintText.textContent = 'That was your move. Watch the chain…';
    await wait(160);
    await motion(ball, [
      [0, 0, 0, 1], [10, 8, 45, 1], [24, 22, 120, 1], [39, 36, 230, .98], [57, 50, 360, .94]
    ], 1450, 'cubic-bezier(.25,.72,.28,1)');
    await bumpGoal(ball, goal);
  }

  async function runLevel2() {
    const button = get('button');
    const gate = get('gate');
    const ball = get('ball');
    const goal = get('goal');
    hintText.textContent = 'Route open. The rest is automatic.';
    await motion(button, [[0,0,0,1],[0,2,0,.94],[0,5,0,.86]], 260, 'ease-in');
    beep(620, .08, .08);
    await motion(gate, [[0,0,0,1],[0,-7,0,1],[0,-22,0,.98]], 520, 'cubic-bezier(.3,.8,.2,1)');
    metalSound();
    await wait(120);
    await motion(ball, [
      [0,0,0,1],[12,9,70,1],[27,22,150,1],[43,36,245,1],[58,52,355,.94],[65,58,420,.9]
    ], 1550, 'cubic-bezier(.2,.76,.26,1)');
    await bumpGoal(ball, goal);
  }

  async function runLevel3() {
    const seesaw = get('seesaw');
    const spring = get('spring');
    const block = get('block');
    const ball = get('ball');
    const goal = get('goal');
    const bumper = get('bumper');
    hintText.textContent = 'Perfect angle. Now the machine takes over.';

    await motion(seesaw, [[0,0,0,1],[0,0,-8,1],[0,0,-12,1]], 420, 'cubic-bezier(.2,.8,.2,1)');
    woodSound();
    await wait(120);
    await motion(spring, [[0,0,0,1],[0,5,0,.82],[0,8,0,.68],[0,0,0,1.04]], 420, 'cubic-bezier(.3,.1,.2,1)');
    springSound();
    await motion(block, [[0,0,0,1],[7,-20,10,1],[20,-35,25,1],[31,-20,45,1],[36,-10,60,.98]], 740, 'cubic-bezier(.18,.7,.23,1)');
    woodSound();
    await motion(seesaw, [[0,0,-12,1],[0,0,8,1],[0,0,3,1]], 420, 'cubic-bezier(.2,.8,.2,1)');
    await wait(60);
    await motion(ball, [[0,0,0,1],[18,5,80,1],[35,-4,150,1],[49,-19,225,.98]], 800, 'cubic-bezier(.17,.7,.2,1)');
    await motion(bumper, [[0,0,0,1],[0,0,0,.92],[0,0,0,1.06],[0,0,0,1]], 260, 'ease-out');
    springSound();
    await motion(ball, [[49,-19,225,.98],[59,-9,300,.96],[66,6,370,.93]], 620, 'cubic-bezier(.2,.7,.2,1)');
    await bumpGoal(ball, goal);
  }

  function get(id) { return objectsRoot.querySelector(`[data-id="${id}"]`); }

  async function bumpGoal(ball, goal) {
    if (!ball || !goal) return;
    const currentTransform = getComputedStyle(ball).transform;
    const anim = ball.animate([
      { opacity: 1, transform: currentTransform },
      { opacity: .85, transform: `${currentTransform} scale(.88)` },
      { opacity: 0, transform: `${currentTransform} scale(.25)` },
    ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
    await anim.finished.catch(() => undefined);
    goal.classList.add('success-glow');
    beep(820, .08, .08);
  }

  function motion(el, frames, duration = 600, easing = 'ease') {
    if (!el) return Promise.resolve();
    const stageBox = stage.getBoundingClientRect();
    const keyframes = frames.map(([dx, dy, rot, scale], i) => ({
      transform: `translate(calc(-50% + ${stageBox.width * dx / 100}px), calc(-50% + ${stageBox.height * dy / 100}px)) rotate(${rot}deg) scale(${scale})`,
      offset: frames.length === 1 ? 1 : i / (frames.length - 1),
    }));
    const anim = el.animate(keyframes, { duration, easing, fill: 'forwards' });
    return anim.finished.catch(() => undefined);
  }

  function showRipple(event) {
    const rect = stage.getBoundingClientRect();
    const clientX = event?.clientX ?? rect.left + rect.width / 2;
    const clientY = event?.clientY ?? rect.top + rect.height / 2;
    tapRipple.style.left = (clientX - rect.left) + 'px';
    tapRipple.style.top = (clientY - rect.top) + 'px';
    tapRipple.classList.remove('show');
    void tapRipple.offsetWidth;
    tapRipple.classList.add('show');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    later(() => toast.classList.remove('show'), 1500);
  }

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function wait(ms) { return new Promise(resolve => later(resolve, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function ensureAudio() {
    if (!audioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioContext = new AC();
    }
    if (audioContext?.state === 'suspended') audioContext.resume();
  }

  function beep(freq = 440, duration = .08, gain = .05, type = 'sine', when = 0) {
    if (!audioContext) return;
    const t = audioContext.currentTime + when;
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(g); g.connect(audioContext.destination); osc.start(t); osc.stop(t + duration + .02);
  }
  function clickSound() { beep(360,.06,.04,'triangle'); beep(520,.05,.025,'sine',.03); }
  function thudSound() { ensureAudio(); beep(120,.09,.03,'sine'); }
  function metalSound() { beep(540,.08,.025,'square'); beep(760,.07,.02,'triangle',.04); }
  function woodSound() { beep(180,.07,.025,'triangle'); }
  function springSound() { beep(300,.06,.03,'sine'); beep(690,.08,.025,'triangle',.05); }
  function winSound() { beep(520,.10,.04,'sine',0); beep(660,.10,.04,'sine',.08); beep(840,.16,.05,'sine',.16); }

  nextBtn.addEventListener('click', () => {
    ensureAudio(); clickSound();
    if (levelIndex === levels.length - 1) {
      renderLevel(0);
      showToast('Vertical slice complete — back to Level 01.');
    } else {
      renderLevel(levelIndex + 1);
    }
  });
  replayBtn.addEventListener('click', () => renderLevel(levelIndex));
  restartBtn.addEventListener('click', () => { ensureAudio(); clickSound(); renderLevel(levelIndex); });
  levelBtn.addEventListener('click', () => renderLevel(levelIndex));

  // Keep the first launch deterministic for testing; progress is stored for future level select UI.
  renderLevel(0);
})();
