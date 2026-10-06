// Virtual players against the difficulty dial (id005). Prints JSON.
// Usage: node tools/sim/difficulty_sim.mjs > var/sim.json
import { makeRng } from '../../app/js/problems.js';
import { createDial, noteAnswer, gradePick, gradeLadder, levelPick, skillHardness } from '../../app/js/difficulty.js';
import { emptyProgress, recordResult, masterWithAncestors } from '../../app/js/session.js';

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
// Chance of a first-try answer: high when the player's ability is above the
// skill's hardness. `slope` sets how sharp the edge of the ability is.
const pOk = (ability, hard, slope = 9) => sigmoid(slope * (ability - hard) + 1.0);

function rolling(hist, w = 8) {
  const out = [];
  for (let i = w; i <= hist.length; i++) out.push(hist.slice(i - w, i).reduce((a, b) => a + b, 0) / w);
  return out;
}
const summary = (xs) => { const a = xs.slice().sort((x, y) => x - y); const q = (p) => a[Math.floor(p * (a.length - 1))]; return { mean: +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3), p10: +q(0.1).toFixed(3), p50: +q(0.5).toFixed(3), p90: +q(0.9).toFixed(3) }; };

function gradeRun(grade, ability, seed, n = 120) {
  const rng = makeRng(seed); const dial = createDial(); const lad = gradeLadder(grade); const hist = []; let maxJump = 0; let prev = null;
  for (let i = 0; i < n; i++) {
    const id = gradePick(grade, dial, rng);
    const h = lad.indexOf(id) / Math.max(1, lad.length - 1);
    if (prev != null) maxJump = Math.max(maxJump, h - prev);
    prev = h;
    const ok = rng() < pOk(ability, h);
    hist.push(ok ? 1 : 0);
    noteAnswer(dial, ok);
  }
  return { hist, maxJump };
}

function levelRun(ability, seed, n = 200) {
  const rng = makeRng(seed); const dial = createDial(); const prog = emptyProgress(); prog.placed = true;
  // Placement result: everything clearly below the ability is already mastered.
  masterWithAncestors(prog, 'g1-add-nc');
  const hist = []; const learn = {};
  for (let i = 0; i < n; i++) {
    const id = levelPick(prog, dial, rng, 0);
    learn[id] = (learn[id] || 0) + 1;
    const a = ability + Math.min(0.25, learn[id] * 0.01); // practice helps
    const ok = rng() < pOk(a, skillHardness(id));
    hist.push(ok ? 1 : 0);
    noteAnswer(dial, ok);
    recordResult(prog, id, ok, `x${i}`);
  }
  return { hist };
}

const out = { grade: [], level: [] };
for (const ability of [0.1, 0.3, 0.5, 0.7, 0.9, 1.1]) {
  for (const grade of [1, 3, 5]) {
    const rates = []; let maxJump = 0;
    for (let s = 1; s <= 40; s++) { const r = gradeRun(grade, ability, s * 101 + grade); rates.push(...rolling(r.hist).slice(12)); maxJump = Math.max(maxJump, r.maxJump); }
    out.grade.push({ ability, grade, rolling8: summary(rates), maxJumpUp: +maxJump.toFixed(2) });
  }
}
for (const ability of [0.15, 0.3, 0.45, 0.6]) {
  const rates = [];
  for (let s = 1; s <= 30; s++) rates.push(...rolling(levelRun(ability, s * 7).hist).slice(12));
  out.level.push({ ability, rolling8: summary(rates) });
}
console.log(JSON.stringify(out, null, 1));
