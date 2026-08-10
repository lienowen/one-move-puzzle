let ctx;
let rolling = null;

function ensure() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume?.();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, duration = .08, gain = .04, type = 'sine', delay = 0, endFreq = null) {
  const c = ensure();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(.012, duration * .22));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + duration + .025);
  } catch {}
}

function noise(duration = .07, gain = .025, delay = 0, lowpass = 1200) {
  const c = ensure();
  if (!c) return;
  try {
    const length = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const decay = Math.pow(1 - i / length, 2.4);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const source = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const g = c.createGain();
    const t = c.currentTime + delay;
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpass, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(g).connect(c.destination);
    source.start(t);
    source.stop(t + duration + .02);
  } catch {}
}

function woodKnock(delay = 0, gain = .032) {
  noise(.055, gain * .7, delay, 760);
  tone(132, .075, gain, 'triangle', delay, 92);
  tone(82, .095, gain * .45, 'sine', delay + .012, 62);
}

function metalClick(delay = 0, gain = .026) {
  noise(.026, gain * .45, delay, 4300);
  tone(620, .045, gain, 'square', delay, 460);
  tone(1040, .095, gain * .52, 'sine', delay + .012, 730);
}

function startRolling(enabled) {
  stopRolling();
  if (!enabled) return;
  const c = ensure();
  if (!c) return;

  try {
    const length = Math.floor(c.sampleRate * .55);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * .82 + white * .18;
      data[i] = last * .75;
    }

    const source = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    const hum = c.createOscillator();
    const humGain = c.createGain();
    const t = c.currentTime;

    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(290, t);
    filter.Q.setValueAtTime(.55, t);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.0075, t + .12);

    hum.type = 'triangle';
    hum.frequency.setValueAtTime(74, t);
    humGain.gain.setValueAtTime(.0001, t);
    humGain.gain.exponentialRampToValueAtTime(.0038, t + .14);

    source.connect(filter).connect(gain).connect(c.destination);
    hum.connect(humGain).connect(c.destination);
    source.start(t);
    hum.start(t);
    rolling = { source, filter, gain, hum, humGain, ctx:c, mood:'run' };
  } catch {
    rolling = null;
  }
}

function setRollingMood(mood = 'run') {
  if (!rolling) return;
  const presets = {
    run:{filter:290,gain:.0075,hum:.0038,pitch:74},
    brake:{filter:205,gain:.0042,hum:.0026,pitch:66},
    goal:{filter:355,gain:.0054,hum:.0030,pitch:82},
  };
  const next = presets[mood] || presets.run;
  if (rolling.mood === mood) return;
  rolling.mood = mood;
  try {
    const t = rolling.ctx.currentTime;
    rolling.filter.frequency.cancelScheduledValues(t);
    rolling.filter.frequency.linearRampToValueAtTime(next.filter, t + .12);
    rolling.gain.gain.cancelScheduledValues(t);
    rolling.gain.gain.linearRampToValueAtTime(next.gain, t + .12);
    rolling.humGain.gain.cancelScheduledValues(t);
    rolling.humGain.gain.linearRampToValueAtTime(next.hum, t + .12);
    rolling.hum.frequency.cancelScheduledValues(t);
    rolling.hum.frequency.linearRampToValueAtTime(next.pitch, t + .14);
  } catch {}
}

function stopRolling(fade = .11) {
  if (!rolling) return;
  const current = rolling;
  rolling = null;
  try {
    const t = current.ctx.currentTime;
    current.gain.gain.cancelScheduledValues(t);
    current.gain.gain.setValueAtTime(Math.max(.0001,current.gain.gain.value), t);
    current.gain.gain.exponentialRampToValueAtTime(.0001, t + fade);
    current.humGain.gain.cancelScheduledValues(t);
    current.humGain.gain.setValueAtTime(Math.max(.0001,current.humGain.gain.value), t);
    current.humGain.gain.exponentialRampToValueAtTime(.0001, t + fade);
    current.source.stop(t + fade + .025);
    current.hum.stop(t + fade + .025);
  } catch {}
}

export const sfx = {
  tap(enabled) {
    if (!enabled) return;
    tone(420, .045, .021, 'triangle', 0, 350);
  },
  grab(enabled) {
    if (!enabled) return;
    noise(.035, .014, 0, 1800);
    tone(270, .055, .018, 'triangle', 0, 220);
  },
  detent(enabled) {
    if (!enabled) return;
    metalClick(0, .021);
  },
  release(enabled) {
    if (!enabled) return;
    metalClick(0, .033);
    tone(178, .11, .026, 'triangle', .025, 112);
    noise(.08, .018, .022, 1150);
  },
  trigger(enabled) {
    if (!enabled) return;
    metalClick(0, .018);
    tone(365, .07, .016, 'triangle', .018, 460);
  },
  drive(enabled) {
    if (!enabled) return;
    noise(.11, .012, 0, 900);
    tone(118, .13, .019, 'triangle', 0, 154);
    tone(236, .08, .011, 'sine', .055, 272);
  },
  gatePreload(enabled) {
    if (!enabled) return;
    noise(.12, .013, 0, 620);
    tone(102, .11, .014, 'triangle', 0, 86);
  },
  gateOpen(enabled) {
    if (!enabled) return;
    noise(.11, .017, 0, 1500);
    tone(188, .09, .022, 'triangle', .035, 125);
    metalClick(.09, .016);
  },
  power(enabled) {
    if (!enabled) return;
    tone(438, .13, .016, 'sine', 0, 554);
    tone(659, .15, .017, 'sine', .08, 880);
    tone(988, .14, .014, 'sine', .16, 1175);
  },
  rollStart(enabled) {
    startRolling(enabled);
    if (enabled) {
      noise(.08, .009, 0, 540);
      tone(96, .09, .008, 'triangle', 0, 79);
    }
  },
  rollMood(mood) {
    setRollingMood(mood);
  },
  rollStop() {
    stopRolling();
  },
  track(enabled) {
    if (!enabled) return;
    woodKnock(0, .019);
  },
  wood(enabled) {
    if (!enabled) return;
    woodKnock(0, .03);
  },
  metal(enabled) {
    if (!enabled) return;
    metalClick(0, .027);
  },
  star(enabled) {
    if (!enabled) return;
    tone(740, .065, .025, 'sine');
    tone(980, .09, .025, 'triangle', .055);
    tone(1318, .12, .022, 'sine', .115);
  },
  goal(enabled) {
    if (!enabled) return;
    tone(310, .12, .018, 'sine', 0, 420);
    tone(510, .15, .02, 'triangle', .045, 650);
  },
  sink(enabled) {
    stopRolling(.08);
    if (!enabled) return;
    tone(260, .18, .026, 'sine', 0, 95);
    noise(.08, .014, .06, 650);
  },
  fail(enabled) {
    stopRolling(.06);
    if (!enabled) return;
    woodKnock(0, .036);
    tone(170, .13, .033, 'sawtooth', .04, 110);
    tone(112, .18, .024, 'triangle', .13, 76);
  },
  win(enabled) {
    stopRolling(.06);
    if (!enabled) return;
    tone(523, .085, .028, 'triangle');
    tone(659, .09, .028, 'triangle', .075);
    tone(784, .10, .031, 'triangle', .15);
    tone(1047, .22, .033, 'sine', .235);
  }
};

export function haptic(enabled, pattern = 18) {
  if (!enabled || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch {}
}
