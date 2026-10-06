// Pure scoring helpers: the basic 100 points, the okawari points (same as
// Dopa Drill's extra stage), the pace window per answer cell, and チル.

export const BASIC_SCORE = 100;
export const UNLOCK_RATE = 0.8;

// Points for the k-th (0-based) okawari problem: 10, 15, 20, ...
export const OKAWARI_BASE = 10;
export const OKAWARI_STEP = 5;
export const okawariPoints = (k) => OKAWARI_BASE + OKAWARI_STEP * k;
export const okawariTotal = (n) => OKAWARI_BASE * n + OKAWARI_STEP * (n * (n - 1)) / 2;

// A comfortable time for one answer cell (Dopa Drill's combo window, kept as
// a reference pace): harder skills (higher grade) get longer and the first
// cell of a problem adds time to read it. Used for star speed and as the
// okawari tempo when a skill has no history yet.
export const PACE_TIME = { base: 3000, perGrade: 600, read: 2500 };
export function paceWindowMs(grade = 3, first = false) {
  const g = Math.min(6, Math.max(1, grade || 3));
  return PACE_TIME.base + PACE_TIME.perGrade * (g - 1) + (first ? PACE_TIME.read : 0);
}

// チル (id057): the calm score, in place of distance. Every correct answer
// digit gives some, twice as much while the rhythm is calm (チルい); small
// gifts come for a first-try answer, every five problems in a row at one's
// own pace, the day's first play and taking a rest. It never goes down and
// adds up across days; the collection arrives as it grows.
export const CHILL = { cell: 1, calmCell: 1, calmFlow: 0.6, firstTry: 2, runEvery: 5, runGift: 5, dayFirst: 10, rest: 5 };
export const cellChill = (flow) => CHILL.cell + (flow >= CHILL.calmFlow ? CHILL.calmCell : 0);
export const fmtChill = (n) => `${Math.max(0, Math.round(n)).toLocaleString('ja-JP')}チル`;
