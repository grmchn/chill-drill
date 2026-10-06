// Time-boxed session, difficulty dial, okawari goal, pace meter, distance, mood.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DrillSession, ListSession } from '../app/js/drill.js';
import { createDial, noteAnswer, recentRate, levelPick, gradePick, gradeLadder, TARGET, MAX_STEP } from '../app/js/difficulty.js';
import { createOkawari, finishProblem, endTape, currentTape, tapeRate, again, rackTapes, OKAWARI } from '../app/js/okawari.js';
import { PaceMeter, steady } from '../app/js/pace.js';
import { okawariPoints, okawariTotal, fmtChill, cellChill, CHILL, paceWindowMs } from '../app/js/scoring.js';
import { emptyProgress, masterWithAncestors, recordResult } from '../app/js/session.js';
import { makeRng } from '../app/js/problems.js';
import * as store from '../app/js/store.js';

test('basic set: the problem open at the end of the music is finished, not cut', () => {
  const s = new DrillSession({ lengthMs: 10000, introMs: 0 });
  s.start(0);
  assert.ok(s.open(100));
  s.solve(2000, { firstTry: true });
  assert.ok(s.open(9000));
  assert.equal(s.tick(10500), 'overtime');
  assert.equal(s.canOpen(10600), false);
  s.miss();
  s.solve(12000, { firstTry: false });
  assert.ok(s.done);
  assert.equal(s.completed, 2);
  assert.equal(s.firstTry, 1);
  assert.equal(s.misses, 1);
  assert.equal(s.score, 100);
  assert.equal(s.endedAt, 12000);
});

test('basic set: the music ending between problems ends the set at once', () => {
  const s = new DrillSession({ lengthMs: 5000 });
  s.start(0);
  s.open(0); s.solve(4000, { firstTry: true });
  assert.equal(s.tick(5000), 'done');
  assert.equal(s.open(5100), false);
  assert.ok(s.okawariOk);
});

test('basic set: pauses stop the clock, and the intro can be skipped', () => {
  const s = new DrillSession({ lengthMs: 10000, introMs: 6000 });
  s.start(0);
  assert.equal(s.tick(1000), 'intro');
  assert.equal(s.canOpen(1000), false);
  s.pause(2000);
  assert.equal(s.elapsed(9000), 2000);
  s.resume(9000);
  assert.equal(s.elapsed(9500), 2500);
  assert.ok(s.skipIntro(9500));
  assert.equal(s.elapsed(9500), 6000); // the skipped intro counts as played
  assert.ok(s.open(9500));
  assert.equal(s.skipIntro(9600), false);
});

test('basic set: okawari unlocks at 80% of the completed problems (boundary)', () => {
  const run = (pattern) => { const s = new DrillSession({ lengthMs: 1000 }); s.start(0); pattern.forEach((f, i) => { s.open(i); s.solve(i + 0.5, { firstTry: f }); }); s.tick(2000); return s; };
  assert.ok(run([1, 1, 1, 1, 0]).okawariOk); // 80%
  assert.ok(!run([1, 1, 1, 0, 0]).okawariOk); // 60%
  assert.ok(run([1]).okawariOk); // a single problem
  assert.ok(!run([0]).okawariOk);
  const none = new DrillSession({ lengthMs: 1000 }); none.start(0); none.tick(1000);
  assert.ok(none.done && !none.okawariOk && none.score === 100);
});

test('review list session ends after the last item', () => {
  const s = new ListSession({ count: 2 });
  s.start(0);
  s.open(0); s.solve(1, { firstTry: true });
  assert.ok(!s.done);
  s.open(2); s.solve(3, { firstTry: true });
  assert.ok(s.done);
  assert.equal(s.canOpen(4), false);
});

test('difficulty dial moves in small steps toward 85%', () => {
  const dial = createDial(0.5);
  for (let i = 0; i < 20; i++) { const before = dial.d; noteAnswer(dial, true); assert.ok(dial.d - before <= MAX_STEP + 1e-9); }
  assert.ok(dial.d > 0.8, 'clean answers raise it');
  const high = dial.d;
  noteAnswer(dial, false);
  assert.ok(dial.d < high && high - dial.d <= MAX_STEP + 1e-9, 'a slip lowers it a little');
  assert.ok(Math.abs(recentRate(createDial()) - TARGET) < 1e-9);
});

test('pickers return valid skills', () => {
  const rng = makeRng(1);
  const prog = emptyProgress();
  prog.placed = true;
  masterWithAncestors(prog, 'g2-vadd2-c');
  const dial = createDial(0.9);
  for (let i = 0; i < 50; i++) assert.ok(levelPick(prog, dial, rng));
  for (const g of [1, 2, 3, 4, 5, 6]) {
    const lad = gradeLadder(g);
    assert.equal(gradePick(g, { d: 0 }, () => 0.5), lad[0]);
    assert.equal(gradePick(g, { d: 1 }, () => 0.5), lad[lad.length - 1]);
  }
});

test('okawari: cassettes continue at 80% first-try, five at most', () => {
  const st = createOkawari(240000, { n: 12, first: 11 });
  assert.equal(st.tapes.length, 2);
  assert.ok(st.tapes[0].basic && st.tapes[0].done);
  // Cassette 2: 4 of 5 first-try (80%) -> cassette 3.
  [1, 1, 1, 1, 0].forEach((f) => finishProblem(st, !!f));
  assert.deepEqual([currentTape(st).n, currentTape(st).first], [5, 4]);
  assert.equal(endTape(st), 'next');
  assert.equal(st.tapes.length, 3);
  // Cassette 3: 3 of 5 (60%) -> okawari ends.
  [1, 1, 1, 0, 0].forEach((f) => finishProblem(st, !!f));
  assert.equal(endTape(st), 'done');
  assert.ok(st.done); assert.equal(st.reason, 'rate');
  assert.equal(st.k, 10);
  assert.equal(st.score, okawariTotal(10));
  assert.equal(finishProblem(st, true), 0, 'no points after the end');
  assert.equal(okawariPoints(0), 10);
  assert.equal(okawariPoints(2), 20);
  // An empty cassette ends okawari.
  const e = createOkawari(1000);
  assert.equal(endTape(e), 'done');
  // Five cassettes at most (the basic one included).
  const m = createOkawari(1000, { n: 3, first: 3 });
  let r;
  do { finishProblem(m, true); r = endTape(m); } while (r === 'next');
  assert.equal(m.tapes.length, OKAWARI.maxTapes);
  assert.equal(m.reason, 'max');
  assert.equal(tapeRate({ n: 4, first: 3 }), 0.75);
  // Again from the result page: up to four more cassettes, points count on.
  const k0 = m.k; const score0 = m.score;
  again(m);
  assert.ok(!m.done);
  assert.equal(rackTapes(m).length, 2);
  finishProblem(m, true);
  assert.equal(m.k, k0 + 1);
  assert.equal(m.score, score0 + okawariPoints(k0));
  do { finishProblem(m, true); r = endTape(m); } while (r === 'next');
  assert.equal(rackTapes(m).length, OKAWARI.maxTapes);
  assert.equal(m.tapes.length, 9);
});

test('pace meter: steady rhythm is good, ragged is not', () => {
  const m = new PaceMeter();
  [0, 2000, 4000, 6000, 8000, 10000].forEach((t) => m.cell(t, 3));
  assert.ok(m.good);
  for (let i = 0; i < 200; i++) m.step(0.05);
  assert.ok(m.flow > 0.9);
  m.cell(10300, 3); m.cell(16000, 3);
  assert.ok(!m.good);
  assert.ok(!steady([1000, 1000]));
});

test('チル: one a digit, twice when calm; format', () => {
  assert.equal(cellChill(0), 1);
  assert.equal(cellChill(CHILL.calmFlow), 2);
  assert.equal(fmtChill(1234), '1,234チル');
});

test('mood stamps: set, change, clear, and asked once a day', () => {
  store.reset(null);
  const m = new Map();
  const mem = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; } };
  store.load(mem);
  assert.ok(store.moodAskDue('2026-10-05'));
  store.markMoodAsked('2026-10-05');
  assert.ok(!store.moodAskDue('2026-10-05'));
  store.setMood('2026-10-05', 'great');
  assert.equal(store.moodOn('2026-10-05'), 'great');
  store.setMood('2026-10-05', 'sleepy');
  assert.equal(store.moodOn('2026-10-05'), 'sleepy');
  store.setMood('2026-10-05', 'nonsense');
  assert.equal(store.moodOn('2026-10-05'), null);
  store.reset(null);
});
