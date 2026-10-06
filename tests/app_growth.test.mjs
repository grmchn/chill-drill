// Lifetime statistics and growth comparisons (ported from Dopa Drill id033-, adapted).
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStats, statsFromHistory, noteSolve, notePlay, noteOkawariStart, noteChill, noteRest } from '../app/js/growth.js';

test('statistics are seeded from an older play history', () => {
  const s = statsFromHistory([
    { mode: 'level', day: '2026-09-25', ok: 10, ng: 2, firstRate: 0.8, timeMs: 120000, chill: 300, minutes: 3, okawariOk: 6, okawariNg: 1 },
    { mode: 'grade', grade: 2, day: '2026-09-25', ok: 6, ng: 0, firstRate: 1, timeMs: 60000, chill: 120, minutes: 1 },
    { mode: 'review', day: '2026-09-27', ok: 3, ng: 0, firstRate: 1, timeMs: 30000, chill: 60 },
  ]);
  assert.equal(s.plays, 3);
  assert.deepEqual(s.modes, { level: 1, grade: 1, review: 1 });
  assert.equal(s.problems, 25);
  assert.equal(s.misses, 3);
  assert.equal(s.firstTry, 8 + 6 + 3);
  assert.equal(s.perfects, 1); // review sets do not count
  assert.deepEqual([s.okawaris, s.okawariSolved, s.okawariBest], [1, 6, 6]);
  assert.deepEqual([s.playMs, s.chill, s.longest], [210000, 480, 3]);
  assert.deepEqual(s.grades, { 2: 1 });
  assert.deepEqual([s.days, s.lastDay], [2, '2026-09-27']);
  assert.deepEqual(statsFromHistory(), emptyStats());
});

test('solves, plays and okawari add up; days count once; quiet flags', () => {
  const s = emptyStats();
  noteSolve(s, { cells: 3, firstTry: true, pace: true });
  noteSolve(s, { cells: 2, misses: 2, review: true });
  noteOkawariStart(s);
  noteSolve(s, { cells: 4, firstTry: true, okawari: true, okawariSolved: 1, pace: true });
  noteSolve(s, { cells: 4, firstTry: true, okawari: true, okawariSolved: 2 });
  noteChill(s, 130); noteRest(s);
  notePlay(s, { mode: 'level', day: '2026-09-27', timeMs: 5000, firstRate: 1, completed: 16, misses: 0, minutes: 10, hour: 7, weekday: 0 });
  notePlay(s, { mode: 'level', day: '2026-09-27', timeMs: 5000, firstRate: 0.5, completed: 4, misses: 2, minutes: 1, hour: 20 });
  assert.deepEqual([s.problems, s.cells, s.firstTry, s.misses, s.reviewSolved, s.paceProblems], [4, 13, 3, 2, 1, 2]);
  assert.deepEqual([s.okawaris, s.okawariSolved, s.okawariBest, s.chill, s.rests], [1, 2, 2, 130, 1]);
  assert.deepEqual([s.plays, s.modes.level, s.perfects, s.playMs, s.days, s.longest], [2, 2, 1, 10000, 1, 10]);
  assert.deepEqual(s.flags, { morning: true, sunday: true, tenMinutes: true, perfectLong: true });
  notePlay(s, { mode: 'level', day: '2026-10-05' });
  assert.ok(s.flags.comeback, 'a week away is welcomed');
});

test('compared with before: only improvements, enough answers, at most three (id038)', async () => {
  const { compareSkill, growthLines } = await import('../app/js/growth.js');
  const r = {
    days: [
      { d: '2026-08-20', n: 6, ms: 60000, f: 3, c: 6 }, // a month ago: 10 s a cell, 50%
      { d: '2026-09-26', n: 5, ms: 30000, f: 4, c: 5 }, // yesterday: 6 s, 80%
      { d: '2026-09-27', n: 4, ms: 12000, f: 4, c: 4 }, // today (this play) is ignored as a reference
    ],
    first: [1, 2, 3].map(() => ({ t: 12000, m: 0, d: '2026-08-01', p: { steps: [1] } })),
  };
  const best = compareSkill(r, { n: 4, ms: 12000, c: 4, f: 4 }, '2026-09-27');
  assert.equal(best.kind, 'first'); // 12 s -> 3 s is the biggest gain
  assert.equal(best.what, 'time');
  assert.equal(Math.round(best.from), 12000);
  assert.equal(Math.round(best.to), 3000);
  // Slower and less accurate than every earlier day: nothing to show.
  assert.equal(compareSkill(r, { n: 4, ms: 80000, c: 4, f: 1 }, '2026-09-27'), null);
  // Too few answers today.
  assert.equal(compareSkill(r, { n: 2, ms: 2000, c: 2, f: 2 }, '2026-09-27'), null);
  // Accuracy alone can be the improvement.
  const onlyRate = compareSkill({ days: [{ d: '2026-09-26', n: 5, ms: 10000, f: 2, c: 5 }] }, { n: 5, ms: 10500, c: 5, f: 5 }, '2026-09-27');
  assert.deepEqual([onlyRate.what, onlyRate.from, onlyRate.to], ['rate', 0.4, 1]);
  const lines = growthLines({ a: { n: 4, ms: 12000, c: 4, f: 4 }, b: { n: 4, ms: 80000, c: 4, f: 1 }, c: { n: 5, ms: 10500, c: 5, f: 5 }, d: { n: 3, ms: 3000, c: 3, f: 3 }, e: { n: 3, ms: 3000, c: 3, f: 3 } },
    { a: r, b: r, c: { days: [{ d: '2026-09-26', n: 5, ms: 10000, f: 2, c: 5 }] }, d: r, e: r }, '2026-09-27');
  assert.equal(lines.length, 3);
  assert.ok(!lines.some((x) => x.skill === 'b'));
  // Accuracy comes first (plan.md 5.3), then the biggest gain.
  assert.equal(lines[0].what, 'rate');
  assert.ok(lines[1].gain >= lines[2].gain);
});
