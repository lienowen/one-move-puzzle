const KEY = 'one-move-puzzle-save-v2';
const QA_REAL_PROGRESS_KEY = 'one-move-puzzle-qa-real-progress';
const DEFAULTS = { unlocked: 1, stars: {}, sound: true, haptics: true, attempts: {} };

function preserveQaLevelJump() {
  return typeof navigator !== 'undefined'
    && navigator.webdriver
    && localStorage.getItem(QA_REAL_PROGRESS_KEY) !== '1';
}

function repairUnlocked(save) {
  const stored = Math.max(1, Number(save.unlocked || 1));

  // Browser QA intentionally jumps directly to authored levels by setting only
  // `unlocked`. Keep that test harness behavior isolated from real-player saves,
  // except when a dedicated regression explicitly asks to exercise real progress.
  if (preserveQaLevelJump()) return stored;

  // Production progression is strictly sequential: clearing N levels may unlock
  // at most level N + 1. Older dev/test saves could leave unlocked=12 with few
  // or no clears, which made PLAY jump straight to the finale.
  const cleared = Object.values(save.stars || {}).filter(value => Number(value) > 0).length;
  return Math.max(1, Math.min(stored, cleared + 1));
}

export function loadSave() {
  try {
    const save = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    const repaired = repairUnlocked(save);
    if (repaired !== Number(save.unlocked || 1)) {
      save.unlocked = repaired;
      localStorage.setItem(KEY, JSON.stringify(save));
    }
    return save;
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
