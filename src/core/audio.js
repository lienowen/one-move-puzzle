let ctx;
const ensure = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, duration = .08, gain = .045, type = 'sine', delay = 0) {
  try {
    const c = ensure();
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + .012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + duration + .02);
  } catch {}
}

export const sfx = {
  tap(enabled) { if (enabled) tone(440, .06, .03, 'triangle'); },
  wood(enabled) { if (enabled) { tone(155, .07, .035, 'square'); tone(105, .09, .022, 'triangle', .02); } },
  metal(enabled) { if (enabled) { tone(530, .05, .025, 'square'); tone(760, .12, .018, 'sine', .025); } },
  star(enabled) { if (enabled) { tone(720, .08, .03); tone(980, .12, .025, 'triangle', .08); } },
  fail(enabled) { if (enabled) { tone(180, .12, .04, 'sawtooth'); tone(120, .18, .03, 'sawtooth', .1); } },
  win(enabled) { if (enabled) { tone(523, .1, .035, 'triangle'); tone(659, .1, .032, 'triangle', .1); tone(784, .18, .04, 'triangle', .2); } }
};

export function haptic(enabled, pattern = 18) {
  if (enabled && navigator.vibrate) navigator.vibrate(pattern);
}
