// Turns a song description (app/audio/songs/*.json, see docs/audio_engine.md)
// into note events, one bar at a time. Pure and deterministic for a given
// seed, so the game, the studio tool and the offline renderer agree.
//
// Time inside a bar is in 16th-note steps (0..16). Swing is applied by the
// player, not here.

// ---------------------------------------------------------------- chords
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Intervals (semitones above the root) for each quality. The first tones are
// the "colour" tones used for rootless voicings.
const QUALITY = {
  maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], 6: [0, 4, 7, 9], 69: [0, 4, 7, 9, 14], add9: [0, 4, 7, 14], '': [0, 4, 7],
  m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17], m6: [0, 3, 7, 9], m: [0, 3, 7], mmaj7: [0, 3, 7, 11],
  7: [0, 4, 7, 10], 9: [0, 4, 7, 10, 14], 13: [0, 4, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15], '7b13': [0, 4, 10, 20],
  '7sus4': [0, 5, 7, 10], '9sus4': [0, 5, 7, 10, 14], '13sus4': [0, 5, 10, 14, 21], sus4: [0, 5, 7], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
};

export function parseChord(sym) {
  const m = /^([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(sym.trim());
  if (!m) throw new Error(`bad chord ${sym}`);
  const root = (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  let q = m[3];
  if (q === 'M7' || q === 'Δ') q = 'maj7';
  if (q === 'sus') q = 'sus4';
  if (!(q in QUALITY)) throw new Error(`unknown chord quality ${sym}`);
  let bass = root;
  if (m[4]) { const b = /^([A-G])([#b]?)$/.exec(m[4]); bass = (NOTE[b[1]] + (b[2] === '#' ? 1 : b[2] === 'b' ? -1 : 0) + 12) % 12; }
  const iv = QUALITY[q];
  return { sym, root, bass, quality: q, intervals: iv, pcs: [...new Set(iv.map((x) => (root + x) % 12))] };
}

// Tones for the comping voicing: drop the root when there are enough colours.
function colourTones(ch) {
  const iv = ch.intervals.filter((x) => x !== 0);
  const pcs = iv.map((x) => (ch.root + x) % 12);
  return pcs.length >= 3 ? pcs.slice(0, 4) : [ch.root, ...pcs];
}

// Close voicing (all notes within an octave and a bit) near `center`,
// choosing the inversion that moves least from `prev`.
export function voice(ch, prev = null, center = 62, low = 50, high = 77) {
  const tones = colourTones(ch);
  let best = null;
  for (let r = 0; r < tones.length; r++) {
    const order = [...tones.slice(r), ...tones.slice(0, r)];
    for (let base = low; base <= low + 12; base++) {
      if ((base % 12) !== order[0]) continue;
      const v = [base];
      for (let i = 1; i < order.length; i++) { let n = v[i - 1] + 1; while (n % 12 !== order[i]) n++; v.push(n); }
      if (v[v.length - 1] > high) continue;
      const mid = (v[0] + v[v.length - 1]) / 2;
      let cost = Math.abs(mid - center) * 0.6;
      if (prev) { const pm = (prev[0] + prev[prev.length - 1]) / 2; cost += Math.abs(mid - pm) * 1.2; }
      // Avoid a minor second at the bottom (muddy).
      if (v[1] - v[0] === 1) cost += 4;
      if (!best || cost < best.cost) best = { v, cost };
    }
  }
  return best ? best.v : tones.map((pc) => 60 + pc);
}

export const bassNote = (ch, low = 36) => { let n = low; while (n % 12 !== ch.bass) n++; return n; };

// Notes of a chord (with tensions) inside [lo, hi], ascending.
export function chordScale(ch, lo, hi) {
  const out = [];
  for (let n = lo; n <= hi; n++) if (ch.pcs.includes(n % 12)) out.push(n);
  return out;
}

// ---------------------------------------------------------------- song structure
// One bar's chords: "Fmaj9" or "Em7b5 A7b9" (split evenly).
export function barChords(cell) {
  const syms = cell.split(/\s+/).filter(Boolean);
  const len = 16 / syms.length;
  return syms.map((s, i) => ({ ...parseChord(s), step: i * len, len }));
}

export const barSeconds = (song) => (60 / song.bpm) * 4;

// The full bar list for one pass of a song: [{ section, bar, index }].
// The form repeats from `loopFrom` until `targetSec` is reached, then the
// outro section `O` follows. The intro (breathing) is always first.
export function songBars(song) {
  const bars = [];
  const push = (name) => { const s = song.sections[name]; for (let b = 0; b < s.bars; b++) bars.push({ section: name, bar: b, pass: 0 }); };
  const form = song.form;
  const target = song.targetSec || 240;
  const per = barSeconds(song);
  const loopFrom = song.loopFrom ?? 1;
  let i = 0; let pass = 0;
  while (true) {
    const name = form[i];
    const s = song.sections[name];
    // The target is the time until the outro (the session length, id060).
    if (i >= loopFrom && (bars.length + s.bars) * per > target + per * 2) break;
    const start = bars.length;
    push(name);
    for (let k = start; k < bars.length; k++) bars[k].pass = pass;
    i += 1;
    if (i >= form.length) { i = loopFrom; pass += 1; }
  }
  if (song.sections.O) push('O');
  return bars.map((b, index) => ({ ...b, index }));
}

export const songSeconds = (song) => songBars(song).length * barSeconds(song);

// ---------------------------------------------------------------- styles
// Each style returns events for one chord slot or one bar.
const v = (base, rng, j = 0.08) => Math.max(0.05, Math.min(1, base + (rng() - 0.5) * 2 * j));
const jit = (rng, a = 0.06) => (rng() - 0.5) * 2 * a;

const DRUM_STYLES = {
  boombap(ctx, rng) {
    const e = [];
    const d = (drum, step, vel) => e.push({ track: 'drums', drum, step: step + jit(rng, 0.04), vel });
    d('kick', 0, v(0.95, rng));
    if (rng() < 0.75) d('kick', 7, v(0.6, rng)); else d('kick', 6, v(0.55, rng));
    d('kick', 10, v(0.8, rng));
    if (rng() < 0.3) d('kick', 15, v(0.45, rng));
    d('snare', 4, v(0.8, rng)); d('snare', 12, v(0.85, rng));
    if (rng() < 0.35) d('snare', 15, v(0.18, rng));
    for (let s = 0; s < 16; s += 2) d('hatC', s, v(s % 4 === 0 ? 0.42 : 0.28, rng, 0.06));
    if (ctx.energy > 0.7) for (const s of [3, 11]) if (rng() < 0.5) d('hatC', s, v(0.16, rng));
    if (ctx.fill) { d('snare', 13, v(0.35, rng)); d('snare', 14, v(0.45, rng)); d('tom', 15, v(0.4, rng)); }
    return e;
  },
  tape(ctx, rng) {
    const e = [];
    const d = (drum, step, vel) => e.push({ track: 'drums', drum, step: step + jit(rng, 0.05), vel });
    d('kick', 0, v(0.9, rng)); d('kick', 9, v(0.7, rng));
    if (rng() < 0.4) d('kick', 11, v(0.45, rng));
    d('snare', 4, v(0.72, rng)); d('snare', 12, v(0.8, rng));
    for (let s = 0; s < 16; s += 4) d('hatC', s, v(0.36, rng));
    for (let s = 2; s < 16; s += 4) if (rng() < 0.7) d('hatC', s, v(0.22, rng));
    if (ctx.fill) d('hatO', 14, v(0.3, rng));
    return e;
  },
  jazzbrush(ctx, rng) {
    const e = [];
    const d = (drum, step, vel) => e.push({ track: 'drums', drum, step: step + jit(rng, 0.03), vel });
    for (const s of [0, 4, 8, 12]) d('ride', s, v(s % 8 === 4 ? 0.42 : 0.34, rng));
    for (const s of [6, 14]) d('ride', s, v(0.24, rng));
    d('brush', 4, v(0.5, rng)); d('brush', 12, v(0.55, rng));
    d('hatC', 4, v(0.22, rng)); d('hatC', 12, v(0.22, rng));
    for (const s of [0, 8]) d('kick', s, v(0.32, rng));
    if (ctx.fill) { d('snare', 10, v(0.25, rng)); d('snare', 14, v(0.3, rng)); }
    return e;
  },
  bossa(ctx, rng) {
    const e = [];
    const d = (drum, step, vel) => e.push({ track: 'drums', drum, step: step + jit(rng, 0.025), vel });
    // 3-2 clave on the rim over two bars.
    const clave = ctx.barIndex % 2 === 0 ? [0, 6, 12] : [4, 8];
    for (const s of clave) d('rim', s, v(0.55, rng));
    for (const s of [0, 8]) d('kick', s, v(0.6, rng));
    for (const s of [6, 14]) d('kick', s, v(0.35, rng));
    for (let s = 0; s < 16; s++) d('shaker', s, v(s % 4 === 0 ? 0.36 : s % 2 === 0 ? 0.25 : 0.16, rng, 0.05));
    return e;
  },
  soft(ctx, rng) {
    const e = [];
    const d = (drum, step, vel) => e.push({ track: 'drums', drum, step: step + jit(rng, 0.04), vel });
    d('kick', 0, v(0.7, rng)); d('kick', 10, v(0.5, rng));
    d('rim', 8, v(0.45, rng));
    for (let s = 0; s < 16; s += 2) d('shaker', s, v(s % 4 === 0 ? 0.3 : 0.2, rng));
    if (ctx.fill) d('rim', 14, v(0.3, rng));
    return e;
  },
};

const BASS_STYLES = {
  lofi(slot, ctx, rng, low) {
    const r = bassNote(slot, low);
    const e = [{ step: slot.step, dur: Math.min(slot.len, 6.5), midi: r, vel: v(0.8, rng) }];
    if (slot.len >= 16) {
      e.push({ step: 7, dur: 2.5, midi: rng() < 0.5 ? r + 7 : r + 12, vel: v(0.55, rng) });
      e.push({ step: 10, dur: 3.5, midi: r, vel: v(0.65, rng) });
      if (ctx.next && rng() < 0.6) { const nr = bassNote(ctx.next, low); e.push({ step: 14, dur: 1.8, midi: nr + (rng() < 0.5 ? -1 : 1), vel: v(0.45, rng) }); }
    } else e.push({ step: slot.step + slot.len * 0.62, dur: slot.len * 0.3, midi: r + (rng() < 0.5 ? 7 : 12), vel: v(0.5, rng) });
    return e;
  },
  walk(slot, ctx, rng, low) {
    const r = bassNote(slot, low);
    const third = slot.intervals.includes(3) ? 3 : slot.intervals.includes(4) ? 4 : 5;
    const beats = Math.round(slot.len / 4);
    const nr = ctx.nextOfSlot ? bassNote(ctx.nextOfSlot, low) : r;
    const line = [r, r + (rng() < 0.5 ? third : 7), r + (rng() < 0.5 ? 7 : 9), nr + (rng() < 0.5 ? -1 : 1)];
    const pick = beats >= 4 ? line : [r, nr + (rng() < 0.5 ? -1 : 2)];
    return pick.slice(0, beats).map((m, i) => ({ step: slot.step + i * 4, dur: 3.6, midi: m < low ? m + 12 : m, vel: v(i === 0 ? 0.75 : 0.6, rng) }));
  },
  bossa(slot, ctx, rng, low) {
    const r = bassNote(slot, low);
    if (slot.len < 16) return [{ step: slot.step, dur: 5, midi: r, vel: v(0.7, rng) }, { step: slot.step + 6, dur: 2, midi: r + 7, vel: v(0.55, rng) }];
    return [[0, 5.5, 0, 0.72], [6, 1.8, 7, 0.55], [8, 5.5, 0, 0.65], [14, 1.8, 7, 0.5]].map(([s, d, o, vv]) => ({ step: s, dur: d, midi: r + o, vel: v(vv, rng) }));
  },
  hold(slot, ctx, rng, low) { return [{ step: slot.step, dur: slot.len - 0.3, midi: bassNote(slot, low), vel: v(0.7, rng) }]; },
};

const KEYS_STYLES = {
  lofi(slot, voicing, ctx, rng) {
    const roll = rng() < 0.6 ? 0.12 : 0;
    const e = [];
    const hit = (step, dur, vel) => voicing.forEach((m, i) => e.push({ step: step + i * roll + jit(rng, 0.04), dur, midi: m, vel: v(vel - i * 0.03, rng) }));
    hit(slot.step, Math.min(slot.len - 0.5, 7), 0.62);
    if (slot.len >= 16 && rng() < 0.45 + ctx.energy * 0.3) hit(rng() < 0.5 ? 7 : 10, 5, 0.42);
    return e;
  },
  jazz(slot, voicing, ctx, rng) {
    const e = [];
    const hit = (step, dur, vel) => voicing.forEach((m) => e.push({ step: step + jit(rng, 0.03), dur, midi: m, vel: v(vel, rng) }));
    if (slot.len >= 16) { hit(0, 2.5, 0.55); hit(rng() < 0.6 ? 6 : 10, 5, 0.48); if (rng() < 0.3) hit(14, 1.5, 0.35); } else { hit(slot.step, 2.5, 0.5); if (rng() < 0.5) hit(slot.step + 6, 1.6, 0.4); }
    return e;
  },
  bossa(slot, voicing, ctx, rng) {
    const e = [];
    const steps = slot.len >= 16 ? [0, 3, 6, 10, 12] : [slot.step, slot.step + 3, slot.step + 6];
    steps.forEach((s, k) => voicing.forEach((m, i) => e.push({ step: s + i * 0.05, dur: 2.2, midi: m, vel: v(k === 0 ? 0.6 : 0.45, rng) })));
    return e;
  },
  arp(slot, voicing, ctx, rng) {
    const up = [...voicing, voicing[1] + 12];
    const seq = rng() < 0.5 ? up : [...up.slice(0, 3), ...up.slice(0, 3).reverse()];
    const e = [];
    for (let s = slot.step, i = 0; s < slot.step + slot.len; s += 2, i++) e.push({ step: s + jit(rng, 0.03), dur: 3.5, midi: seq[i % seq.length], vel: v(i === 0 ? 0.55 : 0.4, rng) });
    return e;
  },
  hold(slot, voicing, ctx, rng) { return voicing.map((m, i) => ({ step: slot.step + i * 0.1, dur: slot.len - 0.4, midi: m, vel: v(0.5, rng) })); },
};

const COUNTER_STYLES = {
  // Soft 16th arpeggios on the chord, high and quiet.
  arp16(slot, voicing, ctx, rng) {
    const tones = chordScale(slot, 67, 86);
    const e = [];
    let i = Math.floor(rng() * 3);
    for (let s = slot.step; s < slot.step + slot.len; s += rng() < 0.2 ? 2 : 1) { if (rng() < 0.25) continue; e.push({ step: s, dur: 2, midi: tones[(i++) % tones.length], vel: v(0.32, rng) }); }
    return e;
  },
  // A few bell notes that answer the melody near the end of each bar.
  chime(slot, voicing, ctx, rng) {
    if (rng() < 0.4) return [];
    const tones = chordScale(slot, 72, 91);
    const n = 1 + Math.floor(rng() * 3);
    const start = slot.step + slot.len - n * 2;
    return Array.from({ length: n }, (_, i) => ({ step: start + i * 2 + jit(rng, 0.04), dur: 4, midi: tones[Math.floor(rng() * tones.length)], vel: v(0.35, rng) }));
  },
  // Guitar fills: three ascending notes at the end of every other bar.
  fill(slot, voicing, ctx, rng) {
    if (ctx.barIndex % 2 === 0 || slot.step + slot.len < 16) return [];
    const tones = chordScale(slot, 64, 81);
    const k = Math.floor(rng() * Math.max(1, tones.length - 3));
    return [12, 13.5, 15].map((s, i) => ({ step: s, dur: 2.5, midi: tones[k + i], vel: v(0.4, rng) }));
  },
};

export const STYLE_NAMES = { drums: Object.keys(DRUM_STYLES), bass: Object.keys(BASS_STYLES), keys: Object.keys(KEYS_STYLES), counter: Object.keys(COUNTER_STYLES) };

// ---------------------------------------------------------------- melody
// Melody phrases: [[bar, step, durSteps, semitonesFromTonic], ...] relative
// to the lead's base pitch. Repeats are varied a little: an occasional note
// dropped, a passing tone added, or a whole pass up an octave.
function phraseBar(song, name, bar, pass, rng, octave) {
  const ph = song.melodies && song.melodies[name];
  if (!ph) return [];
  const base = (song.lead && song.lead.base) || 72;
  const notes = ph.filter((n) => n[0] === bar);
  const e = [];
  for (const [, step, dur, semi] of notes) {
    if (pass > 0 && dur <= 3 && rng() < 0.18) continue;
    e.push({ step: step + jit(rng, 0.05), dur: Math.max(1, dur - 0.3), midi: base + semi + octave, vel: v(0.62, rng, 0.07) });
  }
  // Grace note before a long note now and then (from the chord tone above,
  // resolved against the bar's chords by arrangeBar).
  if (pass > 0 && e.length && rng() < 0.25) { const n = e[e.length - 1]; if (n.dur >= 4 && n.step >= 1) e.push({ step: n.step - 0.6, dur: 0.6, midi: n.midi, vel: n.vel * 0.6, grace: true }); }
  return e;
}

// ---------------------------------------------------------------- per bar
// state carries voice-leading between bars.
export function createState() { return { prevVoicing: null }; }

// bar: one entry from songBars(); next: the following bar (or null);
// layers: Set of active track names; energy 0..1; opts: { bside, seed }.
export function arrangeBar(song, bar, next, layers, energy, state, rng, opts = {}) {
  const sec = song.sections[bar.section];
  const cells = sec.chords;
  const slots = barChords(cells[bar.bar % cells.length]);
  const nextCell = next ? song.sections[next.section].chords[next.bar % song.sections[next.section].chords.length] : null;
  const nextSlots = nextCell ? barChords(nextCell) : null;
  const styles = { ...song.styles, ...(opts.bside && song.bside && song.bside.styles) };
  const lowBass = (song.bass && song.bass.low) || 36;
  const transpose = (opts.bside && song.bside && song.bside.transpose) || 0;
  const fill = bar.bar === sec.bars - 1 && bar.section !== 'O' && bar.section !== 'intro';
  const ctx = { energy, fill, barIndex: bar.index, next: nextSlots ? nextSlots[0] : null };
  const breath = !!sec.breath;
  const out = [];
  const push = (track, list) => list.forEach((ev) => out.push({ track, ...ev, midi: ev.midi != null ? ev.midi + transpose : undefined }));

  if (layers.has('drums') && !breath && !sec.noDrums) push('drums', (DRUM_STYLES[styles.drums] || DRUM_STYLES.boombap)(ctx, rng));
  slots.forEach((slot, si) => {
    const voicing = voice(slot, state.prevVoicing, (song.keys && song.keys.center) || 62);
    state.prevVoicing = voicing;
    const sctx = { ...ctx, nextOfSlot: slots[si + 1] || (nextSlots ? nextSlots[0] : null) };
    if (layers.has('pad')) out.push({ track: 'pad', step: slot.step, dur: slot.len, midis: voicing.map((m) => m + transpose), vel: breath ? 0.8 : 0.6 });
    if (layers.has('keys')) push('keys', (KEYS_STYLES[breath ? 'hold' : styles.keys] || KEYS_STYLES.lofi)(slot, voicing, sctx, rng));
    if (layers.has('bass') && !breath) push('bass', (BASS_STYLES[styles.bass] || BASS_STYLES.lofi)(slot, sctx, rng, lowBass));
    if (layers.has('counter') && !breath && styles.counter) push('counter', (COUNTER_STYLES[styles.counter] || COUNTER_STYLES.chime)(slot, voicing, sctx, rng));
  });
  if (layers.has('lead') && sec.melody && !breath) {
    const octave = (opts.bside && song.bside && song.bside.melodyOctave) || (bar.pass % 2 === 1 && song.lead && song.lead.octaveOnRepeat ? 12 : 0);
    const notes = phraseBar(song, opts.bside && song.bside && song.bside.melody ? song.bside.melody[sec.melody] || sec.melody : sec.melody, bar.bar, bar.pass, rng, octave);
    for (const n of notes) {
      if (!n.grace) continue;
      const slot = slots.find((sl) => n.step + 0.6 >= sl.step && n.step + 0.6 < sl.step + sl.len) || slots[0];
      let m = n.midi + 1; while (!slot.pcs.includes(m % 12)) m++;
      n.midi = m; delete n.grace;
    }
    push('lead', notes);
  }
  return { events: out, slots: slots.map((s) => ({ ...s, root: (s.root + transpose + 12) % 12, bass: (s.bass + transpose + 12) % 12, pcs: s.pcs.map((p) => (p + transpose + 12) % 12) })) };
}

// Which tracks play at a given energy (0..1). The order follows plan.md 9.2:
// rain -> keys -> drums -> bass -> melody, entering over the session.
export function layersAt(song, energy) {
  const set = new Set();
  for (const l of song.layers) if (energy >= l.at) set.add(l.track);
  return set;
}

export function validateSong(song) {
  const errors = [];
  for (const k of ['id', 'title', 'bpm', 'sections', 'form', 'layers']) if (song[k] == null) errors.push(`missing ${k}`);
  if (errors.length) return errors;
  for (const [name, s] of Object.entries(song.sections)) {
    if (!s.bars || !Array.isArray(s.chords)) { errors.push(`section ${name} needs bars and chords`); continue; }
    for (const c of s.chords) { try { barChords(c); } catch (e) { errors.push(`${name}: ${e.message}`); } }
    if (s.melody && !(song.melodies && song.melodies[s.melody])) errors.push(`${name}: melody ${s.melody} missing`);
  }
  for (const f of song.form) if (!song.sections[f]) errors.push(`form: unknown section ${f}`);
  if (song.bpm < 60 || song.bpm > 100) errors.push('bpm out of the Lo-Fi range');
  return errors;
}
