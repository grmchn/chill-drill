// "Just right" difficulty (plan.md 6.2). The basic set keeps the recent
// first-try rate near 85%: a little harder after clean answers, a little
// easier after slips, never a sudden jump. Pure logic, see docs/difficulty.md.
import { SKILL, DEPTH, skillsOfGrade } from './skills.js';
import { ORDER, isMastered, frontier, rustyOf } from './session.js';

export const TARGET = 0.85;
export const WINDOW = 8;
// Largest change of the dial per answer, and its limits.
export const MAX_STEP = 0.08;
export const DIAL = { min: 0, max: 1, start: 0.5 };

export function createDial(start = DIAL.start) {
  return { d: start, hist: [] };
}

// Recent first-try rate. Until the window fills, the missing answers count
// as on target so the first few answers move the dial gently.
export function recentRate(dial) {
  const h = dial.hist;
  const pad = Math.max(0, WINDOW - h.length);
  return (h.reduce((a, b) => a + b, 0) + pad * TARGET) / (h.length + pad);
}

// Record one finished problem and move the dial. Returns the new dial value.
export function noteAnswer(dial, firstTry) {
  dial.hist.push(firstTry ? 1 : 0);
  if (dial.hist.length > WINDOW) dial.hist.splice(0, dial.hist.length - WINDOW);
  const err = recentRate(dial) - TARGET; // > 0: too easy
  // A slip right now pulls back at once; clean streaks push up slowly.
  const now = firstTry ? 0.25 : -0.7;
  const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, err * 0.35 + now * 0.06));
  dial.d = Math.max(DIAL.min, Math.min(DIAL.max, dial.d + step));
  return dial.d;
}

// ---------------------------------------------------------------- pickers
// じぶんレベル: the dial is the share of "hard" problems (practising or new
// skills) against "warm" ones (mastered skills, rusty ones first).
export function levelPick(prog, dial, rng, now = Date.now()) {
  const front = frontier(prog).slice(0, 4);
  const mastered = ORDER.filter((id) => isMastered(prog, id));
  const warm = [...new Set([...rustyOf(prog, now), ...mastered.slice(-6)])];
  if (!front.length && !warm.length) return ORDER[0];
  const pHard = Math.max(0.15, Math.min(0.95, dial.d));
  const hard = front.length && (!warm.length || rng() < pHard);
  if (hard) {
    // The higher the dial, the further along the frontier.
    const i = Math.min(front.length - 1, Math.floor(dial.d * front.length + (rng() - 0.5)));
    return front[Math.max(0, i)];
  }
  // Rusty skills first; otherwise any recent mastered skill.
  const rusty = rustyOf(prog, now);
  if (rusty.length && rng() < 0.5) return rusty[0];
  return warm[Math.floor(rng() * warm.length)];
}

// 学年べつ: the grade's skills from easy to hard; the dial picks the band.
export const gradeLadder = (grade) => skillsOfGrade(grade).sort((a, b) => DEPTH[a.id] - DEPTH[b.id] || 0).map((s) => s.id);
export function gradePick(grade, dial, rng) {
  const list = gradeLadder(grade);
  const pos = dial.d * (list.length - 1) + (rng() - 0.5) * 0.9;
  return list[Math.max(0, Math.min(list.length - 1, Math.round(pos)))];
}

// How hard a skill is, 0..1 (for the simulation and the docs).
const MAX_DEPTH = Math.max(...Object.values(DEPTH));
export const skillHardness = (id) => (DEPTH[id] / MAX_DEPTH) * 0.7 + ((SKILL[id].grade - 1) / 5) * 0.3;
