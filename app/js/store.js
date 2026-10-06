// Local-only persistence (localStorage). Nothing is sent to a server.
// Every read tolerates missing, blocked, or corrupted storage.

const KEY = 'chill-drill:v1';
const VERSION = 1;

export function defaultState() {
  return {
    version: VERSION,
    guideSeen: false,
    settings: { minutes: 3, sound: true, volume: 0.8, music: 0.8, sfx: 0.8, ambient: 'auto', ambientVol: 0.5, motion: null, clock: false, restMin: 25, intro: true },
    history: [],
  };
}

function backend() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

let cache = null;

export function load(storage = backend()) {
  if (cache) return cache;
  const base = defaultState();
  let raw = null;
  try { raw = storage ? storage.getItem(KEY) : null; } catch { raw = null; }
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data && data.version === VERSION) {
        base.settings = { ...base.settings, ...(data.settings || {}) };
        base.history = Array.isArray(data.history) ? data.history : [];
        base.guideSeen = data.guideSeen === true;
        for (const [k, v] of Object.entries(data)) if (!(k in base)) base[k] = v;
        delete base.tapes; // today's song was removed (id055)
      }
    } catch { /* corrupted: start fresh */ }
  }
  cache = base;
  return cache;
}

export function save(storage = backend()) {
  if (!cache || !storage) return false;
  try { storage.setItem(KEY, JSON.stringify(cache)); return true; } catch { return false; }
}

export function settings() { return load().settings; }

export function hasSeenGuide() { return load().guideSeen === true; }
export function markGuideSeen() { load().guideSeen = true; save(); }

export function updateSettings(patch) {
  Object.assign(load().settings, patch);
  save();
}

// ---------------------------------------------------------------- history
const MAX_HISTORY = 3000;
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// rec: { mode, score, ok, ng, timeMs, dopaL, ... }; returns the stored entry.
export function addRecord(rec, at = new Date()) {
  const st = load();
  const entry = { id: `${at.getTime().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, day: dayKey(at), at: at.getTime(), ...rec };
  st.history.push(entry);
  if (st.history.length > MAX_HISTORY) st.history.splice(0, st.history.length - MAX_HISTORY);
  save();
  return entry;
}

export function updateRecord(id, patch) {
  const e = load().history.find((h) => h.id === id);
  if (!e) return null;
  Object.assign(e, patch);
  save();
  return e;
}

// Map of day -> { best, plays, entries } for one month (month: 0-11).
export function monthSummary(year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const out = {};
  for (const h of load().history) {
    if (!h.day || !h.day.startsWith(prefix)) continue;
    const d = out[h.day] || (out[h.day] = { best: 0, plays: 0, entries: [] });
    d.best = Math.max(d.best, h.score || 0);
    d.plays += 1;
    d.entries.push(h);
  }
  return out;
}

export function playedDays() { return new Set(load().history.map((h) => h.day)); }
// Days made "no count" with the pillow (Dopa Drill id034): they keep a streak going
// but are not counted as played.
export const nocountDays = () => load().nocount || {};
const dayBefore = (d, n = 1) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);

// Consecutive days played, counting back from today (or yesterday if today is empty).
export function streak(today = new Date()) {
  const days = playedDays();
  const nc = nocountDays();
  let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(dayKey(d))) d = dayBefore(d);
  let n = 0;
  while (days.has(dayKey(d)) || nc[dayKey(d)]) { if (days.has(dayKey(d))) n += 1; d = dayBefore(d); }
  return n;
}

// Longest run of consecutive played days (no-count days bridge a run).
export function bestStreak() {
  const played = playedDays();
  const days = [...new Set([...played, ...Object.keys(nocountDays())])].sort();
  let best = 0; let run = 0; let prev = null;
  for (const d of days) {
    const t = new Date(`${d}T12:00:00`);
    if (!(prev && (t - prev) / 864e5 < 1.5)) run = 0;
    if (played.has(d)) run += 1;
    best = Math.max(best, run); prev = t;
  }
  return best;
}

// ---------------------------------------------------------------- items (id034)
// The first item: the "おやすみまくら" pillow (Dopa Drill's no-count hammer).
// One pillow turns one missed day into
// a no-count day. Provisional: at most 3 held, only for the last 7 days, one
// given at the start; more come from completing the daily quests (id035).
export const PILLOW = { max: 3, reach: 7, first: 1 };
export function items() {
  const st = load();
  if (!st.items) st.items = { pillow: PILLOW.first, got: PILLOW.first, used: 0, asked: null, log: [] };
  return st.items;
}
// Adds up to n pillows without passing the limit; returns how many were added.
export function addPillow(n = 1) {
  const it = items();
  const add = Math.max(0, Math.min(n, PILLOW.max - it.pillow));
  it.pillow += add; it.got += add;
  save();
  return add;
}
// Should the title offer the pillow today? Returns the missed days (oldest
// first) and the streak they would keep, or null. Only when the pillows held
// cover every missed day since the last played day (within the reach) and
// that streak is at least 2 days.
export function pillowOffer(today = new Date()) {
  const it = items();
  const key = dayKey(today);
  if (it.asked === key || !it.pillow) return null;
  const played = playedDays();
  const nc = nocountDays();
  const gap = [];
  let last = null;
  for (let i = 1; i <= PILLOW.reach; i++) {
    const d = dayBefore(today, i);
    if (played.has(dayKey(d))) { last = d; break; }
    if (!nc[dayKey(d)]) gap.push(dayKey(d));
  }
  if (!last || !gap.length || gap.length > it.pillow) return null;
  const run = streak(last);
  if (run < 2) return null;
  return { days: gap.reverse(), run, pillows: it.pillow };
}
export function declinePillow(today = new Date()) { items().asked = dayKey(today); save(); }
export function usePillow(days, today = new Date()) {
  const st = load();
  const it = items();
  if (!days.length || days.length > it.pillow) return false;
  const nc = st.nocount || (st.nocount = {});
  for (const d of days) nc[d] = true;
  it.pillow -= days.length; it.used += days.length;
  it.asked = dayKey(today);
  it.log.push({ at: today.getTime(), days: days.slice() });
  if (it.log.length > 50) it.log.splice(0, it.log.length - 50);
  save();
  return true;
}

// ---------------------------------------------------------------- login bonus
// A 7-day stamp card: the first visit of a day earns one sticker; day 7 is
// special (a full moon). Missing a day restarts the card from day 1.
// The card waits on the desk: it is claimed by a tap, any time that day.
export const STICKERS = ['moon', 'drop', 'leaf', 'tea', 'book', 'star', 'fullmoon'];

export function claimLogin(today = new Date()) {
  const st = load();
  const b = st.bonus || (st.bonus = { last: null, run: 0, stickers: {}, total: 0 });
  const key = dayKey(today);
  if (b.last === key) return null;
  // Continues after yesterday's visit, or across days made no-count (id034).
  const nc = nocountDays();
  let y = dayBefore(today);
  while (nc[dayKey(y)] && dayKey(y) !== b.last) y = dayBefore(y);
  b.run = b.last === dayKey(y) ? b.run + 1 : 1;
  const slot = ((b.run - 1) % 7) + 1;
  const type = STICKERS[slot - 1];
  b.stickers[key] = type;
  b.last = key;
  b.total = (b.total || 0) + 1;
  save();
  return { run: b.run, slot, type, total: b.total };
}

export const stickerOn = (key) => (load().bonus?.stickers || {})[key] || null;
export const bonusState = () => load().bonus || { last: null, run: 0, stickers: {}, total: 0 };

// ---------------------------------------------------------------- today's mood (きょうの でき)
// Asked once a day, at the end of the first play; it can be set or changed
// later from the calendar. It never feeds scores, stars, quests or trophies.
export const MOODS = ['great', 'okay', 'tried', 'hard', 'sleepy'];
export const moodOn = (key) => (load().moods || {})[key] || null;
export function setMood(key, mood) {
  const st = load();
  const m = st.moods || (st.moods = {});
  if (mood && MOODS.includes(mood)) m[key] = mood; else delete m[key];
  save();
}
// True when the mood question has not been shown for this day yet.
export function moodAskDue(key) { return !(load().moodAsked || {})[key]; }
export function markMoodAsked(key) { const st = load(); (st.moodAsked || (st.moodAsked = {}))[key] = true; save(); }

// Erase all versions of this app's data, including the in-memory copy.
export function reset(storage = backend()) {
  cache = null;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith('chill-drill')) {
        try { storage.removeItem(key); } catch { /* Keep trying the remaining keys. */ }
      }
    }
  } catch { /* Storage may be unavailable or blocked. */ }
}
