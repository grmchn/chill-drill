// Lifetime statistics (ported from Dopa Drill id033). Pure functions over plain
// objects so they can be unit tested; main.js keeps the object in the saved state.

export function emptyStats() {
  return {
    problems: 0, cells: 0, firstTry: 0, misses: 0,
    plays: 0, modes: {}, perfects: 0, playMs: 0,
    okawaris: 0, okawariSolved: 0, okawariBest: 0,
    reviewSolved: 0, paceProblems: 0, chill: 0, rests: 0, longest: 0,
    days: 0, lastDay: null,
    grades: {}, flags: {},
  };
}

const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);

// Seed statistics from a play history (older saves without stats).
export function statsFromHistory(history = []) {
  const s = emptyStats();
  const days = new Set();
  for (const h of history) {
    s.plays += 1;
    s.modes[h.mode] = (s.modes[h.mode] || 0) + 1;
    s.problems += (h.ok || 0) + (h.okawariOk || 0);
    s.misses += (h.ng || 0) + (h.okawariNg || 0);
    if (h.firstRate != null) s.firstTry += Math.round(h.firstRate * (h.ok || 0));
    if (h.firstRate === 1 && h.mode !== 'review') s.perfects += 1;
    if (h.okawariOk != null) { s.okawaris += 1; s.okawariSolved += h.okawariOk; s.okawariBest = Math.max(s.okawariBest, h.okawariOk); }
    s.playMs += h.timeMs || 0;
    s.chill += h.chill || 0;
    if (h.mode !== 'review') s.longest = Math.max(s.longest, h.minutes || 0);
    if (h.mode === 'grade' && h.grade) s.grades[h.grade] = (s.grades[h.grade] || 0) + 1;
    if (h.day) days.add(h.day);
  }
  s.days = days.size;
  s.lastDay = [...days].sort().pop() || null;
  return s;
}

// One finished problem. `okawariSolved` is the running count in this okawari.
export function noteSolve(s, { cells = 0, firstTry = false, misses = 0, review = false, okawari = false, okawariSolved = 0, pace = false } = {}) {
  s.problems += 1;
  s.cells += cells;
  s.misses += misses;
  if (firstTry) s.firstTry += 1;
  if (review) s.reviewSolved += 1;
  if (okawari) { s.okawariSolved += 1; s.okawariBest = Math.max(s.okawariBest, okawariSolved); }
  if (pace) s.paceProblems = (s.paceProblems || 0) + 1;
}

export function noteChill(s, n) { s.chill = (s.chill || 0) + n; }

// One finished basic set (the result screen). `weekday` 0 = Sunday; `hour` 0-23.
export function notePlay(s, { mode, grade, day, timeMs = 0, firstRate = 0, weekday, hour, minutes = 0, completed = 0, misses = 0 } = {}) {
  s.grades = s.grades || {}; s.flags = s.flags || {};
  // Coming back after a week away is celebrated, never punished.
  if (day && s.lastDay && daysBetween(s.lastDay, day) >= 7) s.flags.comeback = true;
  if (weekday === 0) s.flags.sunday = true;
  if (hour != null && hour >= 5 && hour < 9) s.flags.morning = true;
  if (day && day.endsWith('-01-01')) s.flags.newyear = true;
  if (minutes >= 10) s.flags.tenMinutes = true;
  if (completed >= 15 && misses === 0 && mode !== 'review') s.flags.perfectLong = true;
  if (mode === 'grade' && grade) s.grades[grade] = (s.grades[grade] || 0) + 1;
  s.plays += 1;
  s.longest = Math.max(s.longest || 0, minutes); // the longest length chosen and played through
  s.modes[mode] = (s.modes[mode] || 0) + 1;
  s.playMs += timeMs;
  if (firstRate === 1 && mode !== 'review' && completed > 0) s.perfects += 1;
  if (day && day !== s.lastDay) { s.days += 1; s.lastDay = day; }
}

export function noteOkawariStart(s) { s.okawaris += 1; }
export function noteRest(s) { s.rests = (s.rests || 0) + 1; }
export function setFlag(s, name) { s.flags = s.flags || {}; s.flags[name] = true; }

// ---------------------------------------------------------------- compared with before (id038)
// Compares this play's answers for one skill with earlier days and returns
// the biggest improvement, or null. Only improvements are ever shown: a
// slower or less accurate day is simply not mentioned (docs/SPEC.md 14.8).
// Speed is compared per answer cell, then shown per problem of today's size.
export const COMPARE = { minN: 3, monthDays: 21, gain: 0.1 };
export function compareSkill(r, cur, today) {
  if (!r || !cur || cur.n < COMPARE.minN) return null;
  const perCell = cur.ms / Math.max(1, cur.c);
  const cellsNow = cur.c / cur.n;
  const rate = cur.f / cur.n;
  const days = (r.days || []).filter((g) => g.d !== today && g.n >= COMPARE.minN && daysBetween(g.d, today) > 0);
  const refs = [];
  const prev = days[days.length - 1];
  if (prev) refs.push({ kind: 'prev', d: prev.d, perCell: prev.ms / Math.max(1, prev.c), rate: prev.f / prev.n });
  const month = days.filter((g) => daysBetween(g.d, today) >= COMPARE.monthDays).pop();
  if (month && month !== prev) refs.push({ kind: 'month', d: month.d, perCell: month.ms / Math.max(1, month.c), rate: month.f / month.n });
  const first = r.first || [];
  if (first.length >= COMPARE.minN && first[0].d && daysBetween(first[0].d, today) > 0) {
    const cells = first.reduce((a, e) => a + (e.p && e.p.steps ? e.p.steps.length : 1), 0);
    refs.push({ kind: 'first', d: first[0].d, perCell: first.reduce((a, e) => a + e.t, 0) / Math.max(1, cells), rate: first.filter((e) => !e.m).length / first.length });
  }
  let best = null;
  for (const ref of refs) {
    const faster = (ref.perCell - perCell) / ref.perCell;
    const surer = rate - ref.rate;
    if (faster >= COMPARE.gain && (!best || faster > best.gain)) best = { kind: ref.kind, d: ref.d, what: 'time', from: ref.perCell * cellsNow, to: perCell * cellsNow, gain: faster };
    if (surer >= COMPARE.gain && (!best || surer > best.gain)) best = { kind: ref.kind, d: ref.d, what: 'rate', from: ref.rate, to: rate, gain: surer };
  }
  return best;
}

// Up to `max` improvements for the skills of one play, biggest first.
// plays: { [skill]: { n, ms, c, f } }, records: { [skill]: skill record }.
export function growthLines(plays, records, today, max = 3) {
  return Object.entries(plays)
    .map(([skill, cur]) => ({ skill, ...(compareSkill(records[skill], cur, today) || {}) }))
    .filter((x) => x.what)
    // Accuracy first, then speed (plan.md 5.3), biggest gain first within each.
    .sort((a, b) => (a.what === 'rate' ? 0 : 1) - (b.what === 'rate' ? 0 : 1) || b.gain - a.gain)
    .slice(0, max);
}

// ---------------------------------------------------------------- time capsule (id039)
// That day vs today for the same problem: the time if it got shorter, else
// the slips if there were fewer, else nothing to boast (only the date is shown).
export function capsuleCompare(then, ms, misses) {
  if (ms < then.t * 0.95) return { what: 'time', from: then.t, to: ms };
  if (misses < then.m) return { what: 'miss', from: then.m, to: misses };
  return { what: 'none' };
}
