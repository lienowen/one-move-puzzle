const KEY = 'one-move-puzzle-save-v2';
const DEFAULTS = { unlocked: 1, stars: {}, sound: true, haptics: true, attempts: {} };

export function loadSave() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function storeSave(save) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function recordAttempt(save, levelId) {
  save.attempts[levelId] = (save.attempts[levelId] || 0) + 1;
  storeSave(save);
}

export function recordClear(save, levelId, levelNumber, stars) {
  save.stars[levelId] = Math.max(save.stars[levelId] || 0, stars);
  save.unlocked = Math.max(save.unlocked || 1, levelNumber + 1);
  storeSave(save);
}
