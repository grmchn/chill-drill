// The time-boxed basic session (plan.md 7.1). The basic set lasts as long as
// the chosen songs; problems keep flowing until the music ends, and the
// problem being solved at that moment is always finished, never cut off.
// Pure state machine with an injected clock so it can be unit tested.
import { BASIC_SCORE, UNLOCK_RATE } from './scoring.js';

export const SONG_CHOICES = [1, 2, 3];

export class DrillSession {
  // lengthMs: total music time of the basic set; introMs: the breathing intro
  // at the start of the first song (0 = none). Both include no pauses.
  constructor({ lengthMs, introMs = 0 }) {
    this.lengthMs = lengthMs;
    this.introMs = introMs;
    this.phase = 'ready'; // ready -> intro -> run -> overtime -> done
    this.started = null;
    this.pausedAt = null;
    this.pausedMs = 0;
    this.current = null; // { startMs } of the problem now open for input
    this.completed = 0;
    this.firstTry = 0;
    this.misses = 0;
    this.endedAt = null; // session time when the basic set ended
  }

  start(now) {
    this.started = now;
    this.phase = this.introMs > 0 ? 'intro' : 'run';
  }

  // Session time = wall time since start minus pauses (the music time).
  elapsed(now) {
    if (this.started == null) return 0;
    const pausing = this.pausedAt != null ? now - this.pausedAt : 0;
    return Math.max(0, now - this.started - this.pausedMs - pausing);
  }

  get paused() { return this.pausedAt != null; }
  pause(now) { if (this.pausedAt == null && this.started != null && this.phase !== 'done') this.pausedAt = now; }
  resume(now) { if (this.pausedAt != null) { this.pausedMs += now - this.pausedAt; this.pausedAt = null; } }

  // The breathing intro ends by itself, or at once when a digit key is pressed.
  skipIntro(now) {
    if (this.phase !== 'intro') return false;
    // Skipping moves the music forward too: count the skipped time as played.
    const left = this.introMs - this.elapsed(now);
    if (left > 0) this.started -= left;
    this.phase = 'run';
    return true;
  }

  remaining(now) { return Math.max(0, this.lengthMs - this.elapsed(now)); }
  progress(now) { return this.lengthMs > 0 ? Math.min(1, this.elapsed(now) / this.lengthMs) : 1; }

  // Advance phases from the clock. Returns the phase.
  tick(now) {
    if (this.paused || this.phase === 'ready' || this.phase === 'done') return this.phase;
    const t = this.elapsed(now);
    if (this.phase === 'intro' && t >= this.introMs) this.phase = 'run';
    if (this.phase === 'run' && t >= this.lengthMs) {
      if (this.current) this.phase = 'overtime';
      else this.finish(t);
    }
    return this.phase;
  }

  // May a new problem be opened? Only while the music is still running.
  canOpen(now) { return this.tick(now) === 'run' && !this.current; }

  open(now) {
    if (!this.canOpen(now)) return false;
    this.current = { startMs: this.elapsed(now) };
    return true;
  }

  miss() { if (this.current) this.misses += 1; }

  // The open problem was answered completely.
  solve(now, { firstTry }) {
    if (!this.current) return false;
    this.current = null;
    this.completed += 1;
    if (firstTry) this.firstTry += 1;
    if (this.phase === 'overtime') this.finish(this.elapsed(now));
    else this.tick(now);
    return true;
  }

  finish(t) {
    this.phase = 'done';
    this.current = null;
    this.endedAt = t;
  }

  get done() { return this.phase === 'done'; }
  get firstRate() { return this.completed ? this.firstTry / this.completed : 0; }
  get score() { return this.done ? BASIC_SCORE : 0; }
  // Okawari unlocks from 80% first-try answers over the completed problems.
  get okawariOk() { return this.done && this.completed >= 1 && this.firstRate >= UNLOCK_RATE; }
}

// A fixed-list session (ふくしゅう): it ends when every item is answered,
// not with the music.
export class ListSession extends DrillSession {
  constructor({ count }) {
    super({ lengthMs: Infinity, introMs: 0 });
    this.count = count;
  }
  tick(now) {
    if (this.phase === 'run' && !this.current && this.completed >= this.count) this.finish(this.elapsed(now));
    return this.phase;
  }
  canOpen(now) { return this.tick(now) === 'run' && !this.current && this.completed < this.count; }
  progress() { return this.count ? this.completed / this.count : 1; }
}
