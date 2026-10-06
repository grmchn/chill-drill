// Quests, trophies and the collection after the Chill Drill changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyQuests, questEvent, questMinutes, QUESTS, QUEST, ensureDay, claimReward, questDef } from '../app/js/quests.js';
import { TROPHIES, TROPHY, SERIES, CATS, trophyMetrics, evaluate } from '../app/js/trophies.js';
import { ITEMS, CATS as COL_CATS, pickLook, defaultEquip, isUnlocked, nextItem, arrived } from '../app/js/collection.js';
import { emptyStats } from '../app/js/growth.js';
import { emptyProgress } from '../app/js/session.js';

const ctx = (o = {}) => ({ minutes: 3, review: 2, hasNew: true, hasLearning: true, placed: true, okawariOk: true, avgCells: 2, rusty: [], polishWeek: 0, ...o });

test('daily quests: no combo or dopa, three different measures, about 15 minutes', () => {
  for (const q of QUESTS) assert.ok(!/combo|dopa|extra/.test(q.metric), q.id);
  for (let d = 1; d <= 28; d++) {
    const day = `2026-10-${String(d).padStart(2, '0')}`;
    const list = dailyQuests(day, ctx());
    assert.equal(list.length, 3);
    const defs = list.map((q) => questDef(q));
    assert.equal(new Set(defs.map((x) => x.metric)).size, 3);
    assert.ok(questMinutes(defs, ctx()) <= 15.0001, day);
    assert.deepEqual(dailyQuests(day, ctx()), list, 'same all day');
  }
  // Nothing about okawari when the child has not reached it lately.
  for (let d = 1; d <= 28; d++) assert.ok(!dailyQuests(`2026-11-${String(d).padStart(2, '0')}`, ctx({ okawariOk: false })).some((q) => q.id.startsWith('okawari')));
});

test('quest events: pace, チル and okawari move their quests; the reward once', () => {
  const st = { day: '2026-10-05', list: [{ id: 'pace5', goal: 5, prog: 0, done: false }, { id: 'chill60', goal: 60, prog: 0, done: false }, { id: 'okawari5', goal: 5, prog: 0, done: false }] };
  for (let i = 0; i < 5; i++) questEvent(st, { type: 'solve', pace: i % 2 === 0 });
  assert.equal(st.list[0].prog, 3);
  questEvent(st, { type: 'chill', n: 40 }); questEvent(st, { type: 'chill', n: 40 });
  assert.ok(st.list[1].done && st.list[1].prog === 60);
  for (let i = 0; i < 5; i++) questEvent(st, { type: 'solve', okawari: true });
  for (let i = 0; i < 2; i++) questEvent(st, { type: 'solve', pace: true });
  assert.ok(claimReward(st));
  assert.ok(!claimReward(st));
  const s2 = {};
  assert.ok(ensureDay(s2, '2026-10-06', ctx()));
  assert.ok(!ensureDay(s2, '2026-10-06', ctx()));
});

test('trophies: Chill series, ids unique, チル series, no combo/dopa or distance', () => {
  const ids = TROPHIES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!CATS.includes('コンボ') && !CATS.includes('ドパ'));
  for (const t of TROPHIES) assert.ok(CATS.includes(t.cat), t.id);
  assert.ok(TROPHY['chill-1000'] && TROPHY['chill-1000'].name === '1,000チル');
  assert.ok(!TROPHIES.some((t) => t.id.startsWith('distance')));
  const st = {};
  const stats = { ...emptyStats(), chill: 1200, paceProblems: 12, okawaris: 2, rests: 1, flags: { morning: true } };
  const m = trophyMetrics({ stats, prog: emptyProgress(), bestStreak: 3, stickers: 1, crowns: 0 });
  assert.deepEqual(evaluate(st, m), [], 'the first evaluation is a quiet batch');
  assert.ok(st.got['chill-1000'] && !st.got['chill-2000'] && st.got['pace-10'] && st.got['secret-morning']);
  assert.ok(!st.got['pace-30']);
  assert.ok(SERIES.every((s) => s.items.length));
});

test('collection: items arrive in order as チル adds up, a base item per category', () => {
  for (const c of COL_CATS) assert.equal(ITEMS.filter((it) => it.cat === c.key && it.base).length, 1, c.key);
  const rest = ITEMS.filter((x) => !x.base);
  for (let i = 1; i < rest.length; i++) assert.ok(rest[i].chill > rest[i - 1].chill, rest[i].id);
  assert.equal(rest[0].chill, 40);
  const look = pickLook(defaultEquip(), 0, () => 0.5);
  for (const c of COL_CATS) assert.ok(isUnlocked({ ...ITEMS.find((x) => x.id === look[c.key]) }, 0), c.key);
  const jazz = ITEMS.find((x) => x.id === 'music:piano-hoshi').chill;
  assert.equal(pickLook({ ...defaultEquip(), music: 'music:piano-hoshi' }, jazz).music, 'music:piano-hoshi');
  assert.equal(pickLook({ ...defaultEquip(), music: 'music:cassette' }, jazz).music, 'music:rain-piano', 'a locked choice falls back');
  assert.deepEqual(nextItem(50), { item: rest[1], left: rest[1].chill - 50 });
  assert.deepEqual(arrived(30, 100).map((x) => x.id), [rest[0].id, rest[1].id]);
  assert.equal(nextItem(1e9), null);
});
