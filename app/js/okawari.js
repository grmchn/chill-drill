// おかわり: more cassettes after the basic one (plan.md 7.2). Each cassette
// runs as long as the basic session. When an okawari cassette ends, the next
// one starts if that cassette's first-try rate was 80% or more (the same rule
// that opens okawari); otherwise okawari ends there. Five cassettes at most
// in one go, the basic one included. Okawari can be had again from the result
// page as many times as wanted: each go adds up to four more cassettes and
// the points keep counting on. Problems step up every three. Pure logic.
import { okawariPoints } from './scoring.js';

export const OKAWARI = { maxTapes: 5, keep: 0.8 };

// `basic` is the basic cassette's { n, first } (problems, first-try solves).
export function createOkawari(lengthMs, basic = { n: 0, first: 0 }) {
  return {
    lengthMs,
    tapes: [{ n: basic.n, first: basic.first, basic: true, done: true }, { n: 0, first: 0, done: false }],
    runStart: 1, k: 0, score: 0, misses: 0, done: false,
  };
}

// Another go of okawari after the result page (id056).
export function again(st) {
  st.done = false; st.reason = null;
  st.runStart = st.tapes.length;
  st.tapes.push({ n: 0, first: 0, done: false });
}

// The cassettes on the rack for this go: the basic one and this go's ones.
export const rackTapes = (st) => [st.tapes[0], ...st.tapes.slice(st.runStart)];

export const currentTape = (st) => st.tapes[st.tapes.length - 1];
export const tapeRate = (t) => (t.n ? t.first / t.n : 0);

// One finished okawari problem. Returns the points it earned.
export function finishProblem(st, firstTry) {
  if (st.done) return 0;
  const points = okawariPoints(st.k);
  st.score += points;
  st.k += 1;
  const t = currentTape(st);
  t.n += 1;
  if (firstTry) t.first += 1;
  return points;
}

// The current cassette has played out. Returns 'next' (a new cassette starts)
// or 'done' (okawari ends here; `reason` says why).
export function endTape(st) {
  if (st.done) return 'done';
  const t = currentTape(st);
  t.done = true;
  if (t.n === 0 || tapeRate(t) < OKAWARI.keep) { st.done = true; st.reason = 'rate'; return 'done'; }
  if (rackTapes(st).length >= OKAWARI.maxTapes) { st.done = true; st.reason = 'max'; return 'done'; }
  st.tapes.push({ n: 0, first: 0, done: false });
  return 'next';
}

// Difficulty steps up every three finished problems (as Dopa Drill's extra).
export const tierOf = (k) => Math.floor(k / 3);
