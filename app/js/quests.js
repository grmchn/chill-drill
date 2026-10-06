// Daily quests (ported from Dopa Drill id035): two very easy ones and one that
// takes a little more, all done in about 15 minutes of play. The day's list is
// chosen from the date (so it is the same all day) and from what this child
// can do today. Chill Drill swaps the combo and dopa goals for pace and
// チル, and the extra stage for okawari. Pure logic.

import { SKILL } from './skills.js';

export const QUEST_MINUTES = 15;
// About how many problems fit in one minute (~18 s a problem).
export const PROBLEMS_PER_MINUTE = 3.3;

// Rough minutes for one play: the chosen length, an okawari cassette of the
// same length when the child usually reaches it, and half a minute for results.
export const playMinutes = (minutes, withOkawari) => minutes * (withOkawari ? 2 : 1) + 0.5;
const reviewMinutes = (ctx) => (Math.min(10, Math.max(1, ctx.review)) * 18 + 30) / 60;
const perPlay = (c) => Math.max(1, (c.minutes || 3) * PROBLEMS_PER_MINUTE);

// metric: which play event moves it (see questEvent). mode: where it can be
// done ('any' play, or only a review / grade / practice play). plays: how many
// plays it takes for this child. need: whether it can be offered today.
export const QUESTS = [
  { id: 'play1', tier: 'easy', metric: 'play', goal: 1, text: () => '1回 あそぶ', mode: 'any', plays: () => 1 },
  { id: 'pace5', tier: 'easy', metric: 'pace', goal: 5, text: () => 'いいペースで 5もん とく', mode: 'any', plays: (c) => Math.ceil(5 / (perPlay(c) * 0.5)) },
  { id: 'first5', tier: 'easy', metric: 'firstTry', goal: 5, text: () => '初回正解を 5もん', mode: 'any', plays: (c) => Math.ceil(5 / (perPlay(c) * 0.7)) },
  { id: 'chill60', tier: 'easy', metric: 'chill', goal: 60, text: () => '60チル ためる', mode: 'any', plays: (c) => Math.ceil(60 / (perPlay(c) * (c.avgCells * 1.5 + 2))) },
  { id: 'review1', tier: 'easy', metric: 'review', goal: 1, text: () => 'ふくしゅうを 1もん', mode: 'review', plays: () => 1, need: (c) => c.review > 0 },
  { id: 'new1', tier: 'easy', metric: 'newSkill', goal: 1, text: () => 'NEWの スキルを 1もん', mode: 'any', plays: () => 1, need: (c) => c.hasNew },
  { id: 'okawari', tier: 'hard', metric: 'okawariReach', goal: 1, text: () => 'おかわりまで すすむ', mode: 'any', plays: () => 1, need: (c) => c.okawariOk },
  { id: 'okawari5', tier: 'hard', metric: 'okawariSolved', goal: 5, text: () => 'おかわりで 5もん とく', mode: 'any', plays: () => 1, need: (c) => c.okawariOk },
  { id: 'pace15', tier: 'hard', metric: 'pace', goal: 15, text: () => 'いいペースで 15もん とく', mode: 'any', plays: (c) => Math.ceil(15 / (perPlay(c) * 0.5)) },
  { id: 'chill200', tier: 'hard', metric: 'chill', goal: 200, text: () => '200チル ためる', mode: 'any', plays: (c) => Math.ceil(200 / (perPlay(c) * (c.avgCells * 1.5 + 2))) },
  { id: 'play2', tier: 'hard', metric: 'play', goal: 2, text: () => '2回 あそぶ', mode: 'any', plays: () => 2 },
  { id: 'grade1', tier: 'hard', metric: 'gradePlay', goal: 1, text: () => '学年べつで 1回 あそぶ', mode: 'grade', plays: () => 1 },
  { id: 'learn10', tier: 'hard', metric: 'learning', goal: 10, text: () => 'れんしゅうちゅうの スキルを 10もん', mode: 'any', plays: (c) => Math.ceil(10 / (perPlay(c) * 0.6)), need: (c) => c.hasLearning && c.placed },
];
export const QUEST = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// Extra quest kinds added by other features (e.g. polishing a rusty skill,
// id040) register here: { ...fields, pick(ctx, rng) -> extra fields or null }.
export const DYNAMIC = [
  // Dust off a dusty skill (Dopa Drill's rust, id040): now and then, at most
  // twice a week, only when a skill is dusty. Tapping it starts that practice.
  { id: 'polish', tier: 'hard', metric: 'skill', goal: 3, mode: 'practice', plays: () => 1,
    text: (q) => `「${SKILL[q.skill] ? SKILL[q.skill].name : ''}」の ほこりを はらう（3もん）`,
    pick(ctx, rng) {
      const chance = rng();
      if (!ctx.rusty || !ctx.rusty.length || (ctx.polishWeek || 0) >= POLISH.perWeek || chance >= POLISH.chance) return null;
      return { skill: ctx.rusty[0] };
    } },
];
export const POLISH = { perWeek: 2, chance: 0.5 };
export const questDef = (q) => QUEST[q.id] || DYNAMIC.find((d) => d.id === q.id);

// Minutes to finish a list: quests for 'any' play ride along on grade or
// practice plays; review plays are short and do not count for them.
export function questMinutes(list, ctx) {
  const pm = playMinutes(ctx.minutes || 3, ctx.okawariOk);
  let any = 0; let total = 0; let shared = 0;
  const special = {};
  for (const q of list) {
    const n = q.plays(ctx);
    if (q.mode === 'any') any = Math.max(any, n);
    else special[q.mode] = Math.max(special[q.mode] || 0, n);
  }
  for (const [mode, n] of Object.entries(special)) {
    if (mode === 'review') total += n * reviewMinutes(ctx);
    else { total += n * pm; shared += n; }
  }
  return total + Math.max(0, any - shared) * pm;
}

function hashDay(day) { let h = 2166136261; for (const ch of day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) { let s = seed || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
const shuffle = (list, rng) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ctx: { minutes, review, hasNew, hasLearning, placed, okawariOk, avgCells, ... }
export function dailyQuests(day, ctx) {
  const rng = rngFrom(hashDay(day));
  const extras = DYNAMIC.map((d) => { const f = d.pick ? d.pick(ctx, rng) : null; return f ? { ...d, ...f } : null; }).filter(Boolean);
  const avail = [...QUESTS.filter((q) => !q.need || q.need(ctx)), ...extras];
  const easy = shuffle(avail.filter((q) => q.tier === 'easy'), rng);
  // A dynamic quest (when offered today) goes first in the hard pool.
  const hard = [...extras.filter((q) => q.tier === 'hard'), ...shuffle(avail.filter((q) => q.tier === 'hard' && !extras.includes(q)), rng)];
  for (const h of hard) {
    for (let i = 0; i < easy.length; i++) {
      for (let j = i + 1; j < easy.length; j++) {
        const list = [easy[i], easy[j], h];
        if (new Set(list.map((q) => q.metric)).size < 3) continue;
        if (questMinutes(list, ctx) <= QUEST_MINUTES) return list.map((q) => ({ id: q.id, goal: q.goal, prog: 0, done: false, ...(q.skill ? { skill: q.skill } : {}) }));
      }
    }
  }
  return ['play1', 'pace5', 'play2'].map((id) => ({ id, goal: QUEST[id].goal, prog: 0, done: false }));
}

export const questText = (q) => { const d = questDef(q); return d ? d.text(q) : ''; };

// The saved state keeps today's list; a new day brings a new one.
export function ensureDay(state, day, ctx) {
  if (state.day === day && Array.isArray(state.list)) return false;
  state.day = day;
  state.list = dailyQuests(day, ctx);
  if (state.list.some((q) => q.id === 'polish')) state.polishDays = [...(state.polishDays || []), day].slice(-14);
  state.rewarded = false;
  state.doneDays = state.doneDays || {};
  return true;
}

// Play events: { type: 'solve', firstTry, review, okawari, skill, skillState, pace }
// | { type: 'chill', n } | { type: 'play', mode } | { type: 'okawari' }.
// Returns the quests completed by this event.
export function questEvent(state, ev) {
  const done = [];
  for (const q of state.list || []) {
    if (q.done) continue;
    const d = questDef(q);
    if (!d) continue;
    const before = q.prog;
    switch (d.metric) {
      case 'play': if (ev.type === 'play') q.prog += 1; break;
      case 'gradePlay': if (ev.type === 'play' && ev.mode === 'grade') q.prog += 1; break;
      case 'pace': if (ev.type === 'solve' && ev.pace) q.prog += 1; break;
      case 'chill': if (ev.type === 'chill') q.prog += ev.n; break;
      case 'firstTry': if (ev.type === 'solve' && ev.firstTry) q.prog += 1; break;
      case 'review': if (ev.type === 'solve' && ev.review) q.prog += 1; break;
      case 'newSkill': if (ev.type === 'solve' && ev.skillState === 'new') q.prog += 1; break;
      case 'learning': if (ev.type === 'solve' && (ev.skillState === 'new' || ev.skillState === 'learning')) q.prog += 1; break;
      case 'okawariReach': if (ev.type === 'okawari') q.prog += 1; break;
      case 'okawariSolved': if (ev.type === 'solve' && ev.okawari) q.prog += 1; break;
      case 'skill': if (ev.type === 'solve' && ev.firstTry && ev.skill === q.skill) q.prog += 1; break;
      default: break;
    }
    q.prog = Math.min(q.goal, q.prog);
    if (q.prog >= q.goal && before < q.goal) { q.done = true; done.push(q); }
  }
  return done;
}

export const allDone = (state) => !!(state.list && state.list.length && state.list.every((q) => q.done));

// The day's reward is given once, when all three are done. The caller adds
// a pillow (store.addPillow, capped at the limit). No further rewards today.
export function claimReward(state) {
  if (!allDone(state) || state.rewarded) return false;
  state.rewarded = true;
  state.doneDays = state.doneDays || {};
  state.doneDays[state.day] = true;
  return true;
}
