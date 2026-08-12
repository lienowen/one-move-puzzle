import { levels } from '../levels.js';

const KEY = 'one-move-puzzle-save-v3';
const LEGACY_KEY = 'one-move-puzzle-save-v2';
const DEFAULTS = { version:3, unlocked:1, stars:{}, sound:true, haptics:true, attempts:{} };

const clampStars = value => Math.max(0, Math.min(3, Number(value || 0)));

function sanitize(raw = {}) {
  const stars = {};
  let unlocked = 1;

  // Progress is strictly contiguous. Once the first uncleared puzzle is found,
  // later legacy/test stars are ignored instead of inflating campaign progress.
  for (let index = 0; index < levels.length; index += 1) {
    const id = levels[index].id;
    const value = clampStars(raw.stars?.[id]);
    if (value <= 0) break;
    stars[id] = value;
    unlocked = Math.min(levels.length, index + 2);
  }

  const attempts = {};
  for (const level of levels) {
    const value = Math.max(0, Math.floor(Number(raw.attempts?.[level.id] || 0)));
    if (value) attempts[level.id] = value;
  }

  return {
    version:3,
    unlocked,
    stars,
    sound: raw.sound !== false,
    haptics: raw.haptics !== false,
    attempts,
  };
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return null; }
}

export function loadSave() {
  const current = readJson(KEY);
  if (current) {
    const save = sanitize(current);
    localStorage.setItem(KEY, JSON.stringify(save));
    return save;
  }

  const legacy = readJson(LEGACY_KEY);
  if (legacy) {
    const migrated = sanitize(legacy);
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
  }

  return { ...DEFAULTS, stars:{}, attempts:{} };
}

export function storeSave(save) {
  const clean = sanitize(save);
  Object.assign(save, clean);
  localStorage.setItem(KEY, JSON.stringify(clean));
}

export function recordAttempt(save, levelId) {
  save.attempts[levelId] = (save.attempts[levelId] || 0) + 1;
  storeSave(save);
}

export function recordClear(save, levelId, levelNumber, stars) {
  // Only the currently unlocked frontier can advance campaign progress.
  if (levelNumber <= Number(save.unlocked || 1)) {
    save.stars[levelId] = Math.max(save.stars[levelId] || 0, clampStars(stars));
  }
  storeSave(save);
}

export const SAVE_KEY = KEY;
export const LEGACY_SAVE_KEY = LEGACY_KEY;
