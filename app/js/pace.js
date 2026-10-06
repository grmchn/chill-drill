// マイペース (plan.md 5.1): not speed but how even the rhythm is. When the
// last few answer intervals are steady, the room and the music deepen a
// little. Nothing is shown and nothing is lost when the rhythm breaks; the
// flow value just eases back over a few seconds. Pure logic.
import { paceWindowMs } from './scoring.js';

export const PACE = { n: 5, cv: 0.35, riseS: 4, fallS: 6 };

export class PaceMeter {
  constructor() { this.intervals = []; this.last = null; this.flow = 0; this.good = false; }

  reset() { this.intervals = []; this.last = null; this.good = false; }

  // A correct answer cell at time t (ms). Intervals are clamped to a band
  // around the grade's reference pace so one long think does not count as chaos
  // forever, and key mashing does not count as calm.
  cell(t, grade = 3) {
    if (this.last != null) {
      const ref = paceWindowMs(grade, false);
      const v = Math.max(ref * 0.15, Math.min(ref * 2.5, t - this.last));
      this.intervals.push(v);
      if (this.intervals.length > PACE.n) this.intervals.shift();
    }
    this.last = t;
    this.good = steady(this.intervals);
    return this.good;
  }

  // A new problem starts: reading time is not part of the rhythm.
  pauseRhythm() { this.last = null; }

  // Smooth the flow value toward 1 (steady) or 0. dt in seconds.
  step(dt) {
    const target = this.good ? 1 : 0;
    const tau = this.good ? PACE.riseS : PACE.fallS;
    this.flow += (target - this.flow) * (1 - Math.exp(-dt / tau));
    return this.flow;
  }
}

export function steady(intervals) {
  if (intervals.length < PACE.n) return false;
  const m = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const sd = Math.sqrt(intervals.reduce((a, b) => a + (b - m) ** 2, 0) / intervals.length);
  return sd / m <= PACE.cv;
}
