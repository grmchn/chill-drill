// Variations of the songs the operator liked (id068 piano, id071 bell). Each
// keeps its base song's instruments, mix and tape colour and has its own key,
// tempo, chord progression, drum pattern and two composed melodies.
// Writes app/audio/songs/<id>.json and adds new ids to index.json.
// node tools/compose_variants.mjs
import fs from 'node:fs';
import { barChords } from '../app/js/audio/arranger.js';
import { makeRng } from '../app/js/problems.js';

const load = (id) => JSON.parse(fs.readFileSync(`app/audio/songs/${id}.json`, 'utf8'));
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const keyPc = (k) => (NOTE[k[0]] + (k[1] === 'b' ? -1 : k[1] === '#' ? 1 : 0) + 12) % 12;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

// Rhythms in 16ths ([step, length]); the last one closes a phrase on a long note.
const RHYTHMS = [
  [[0, 6], [6, 2], [8, 6], [14, 2]],
  [[0, 4], [4, 4], [8, 4], [12, 4]],
  [[0, 8], [8, 4], [12, 4]],
  [[0, 6], [6, 2], [8, 8]],
  [[0, 12], [12, 4]],
  [[0, 4], [4, 4], [8, 8]],
  [[0, 6], [6, 2], [10, 6]], // a small breath after the second note
  [[2, 6], [8, 4], [12, 4]], // starts after the beat
];
const CLOSE = [[0, 6], [6, 2], [8, 8]];
// The bell songs sing slowly: long notes, arpeggio-like leaps between chord tones.
const BELL_RHYTHMS = [
  [[0, 4], [4, 4], [8, 8]],
  [[0, 8], [8, 8]],
  [[0, 16]],
  [[0, 8], [8, 4], [12, 4]],
  [[0, 4], [4, 12]],
  [[0, 12], [12, 4]],
  [[4, 4], [8, 8]],
  [[0, 8], [12, 4]],
];
const BELL_CLOSE = [[0, 16]];

// One 8-bar melody over `chords` (8 bar cells). `arc`: target height (semitones
// above `lo`) per bar. Strong beats take chord tones, weak ones may pass
// through the scale; steps are preferred to leaps.
// Offsets are written relative to `ref` (the song's lead.base).
function compose(chords, { key, lo, hi, arc, seed, rhythms, bell = false, ref = lo }) {
  const RH = bell ? BELL_RHYTHMS : RHYTHMS;
  const leapSoft = bell ? 9 : 5; const leapHard = bell ? 12 : 7;
  const rng = makeRng(seed);
  const scale = MAJOR.map((x) => (x + keyPc(key)) % 12);
  const out = [];
  let prev = lo + arc[0]; let prev2 = null;
  chords.forEach((cell, bar) => {
    const slots = barChords(cell);
    const rh = bar === 7 ? (bell ? BELL_CLOSE : CLOSE) : RH[rhythms[bar]];
    rh.forEach(([step, len], i) => {
      const ch = slots.find((s) => step >= s.step && step < s.step + s.len) || slots[0];
      const strong = step % 8 === 0 || len >= 6 || (bar === 7 && i === rh.length - 1);
      const allowed = strong || bell ? ch.pcs : [...new Set([...scale, ...ch.pcs])];
      const target = lo + arc[bar] + (i === rh.length - 1 ? -1 : 1) * (i % 2);
      let best = null;
      for (let n = lo; n <= hi; n++) {
        if (!allowed.includes(n % 12)) continue;
        const leap = Math.abs(n - prev);
        let cost = Math.abs(n - (prev + (target - prev) * 0.55));
        if (leap > leapSoft) cost += 3; if (leap > leapHard) cost += 8;
        if (bell && leap < 3) cost += 1.5; // bells ring out on different chord tones
        if (bell && n === prev) cost += 3;
        if (n === prev) cost += 1.5;
        if (n === prev2 && n !== prev) cost += 2.5; // no back-and-forth wobble
        const dir = Math.sign(target - prev);
        if (dir && Math.sign(n - prev) === -dir) cost += 1.2; // keep heading for the phrase's shape
        if (bar === 7 && i === rh.length - 1 && n % 12 !== ch.root && n % 12 !== ch.pcs[1]) cost += 4; // close on a stable tone
        cost += rng() * 1.6;
        if (!best || cost < best.cost) best = { n, cost };
      }
      prev2 = prev; prev = best.n;
      out.push([bar, step, len, best.n - ref]);
    });
  });
  return out;
}

const SONGS = [
  {
    id: 'piano-hoshi', title: 'ほしあかりの ピアノ', key: 'D', bpm: 70, swing: 0.08, seed: 2101, leadBase: 62,
    note: 'あまおとと ピアノ の変奏。ニ長調で、やわらかい ドラム。',
    intro: ['Gmaj9', 'A13sus4'],
    A: ['Dmaj9', 'F#m7 B7b9', 'Em9', 'A13sus4 A13', 'Bm9', 'Gmaj9', 'Em9 A7b9', 'Em9 A13sus4'],
    B: ['Gmaj9', 'A/G', 'F#m7', 'Bm9', 'Em9', 'A9', 'Dmaj9', 'A13sus4'],
    O: ['Dmaj9', 'Gmaj9', 'Dmaj9', 'Gmaj9'],
    styles: { drums: 'soft', bass: 'lofi', keys: 'lofi', counter: 'chime' },
    bside: { transpose: -2, styles: { drums: 'tape', keys: 'arp' }, melodyOctave: 12 },
    rhythmsA: [0, 1, 3, 6, 2, 0, 7, 3], rhythmsB: [2, 5, 0, 4, 1, 6, 3, 4],
    mix: { counter: { gain: 0.17, params: { bright: 0.2 } } },
  },
  {
    id: 'piano-yuugure', title: 'ゆうぐれの ピアノ', key: 'Eb', bpm: 74, swing: 0.12, seed: 2203, leadBase: 63,
    note: 'あまおとと ピアノ の変奏。変ホ長調で、すこし ゆれる テンポ。',
    intro: ['Abmaj9', 'Bb13sus4'],
    A: ['Ebmaj9', 'Cm9', 'Abmaj9', 'Bb13sus4 Bb7b9', 'Gm7 C7b9', 'Fm9', 'Abm6 Db9', 'Fm9 Bb13sus4'],
    B: ['Abmaj9', 'Bb/Ab', 'Gm7', 'Cm9', 'Fm9', 'Bb9', 'Ebmaj9', 'Bb9sus4'],
    O: ['Ebmaj9', 'Abmaj9', 'Ebmaj9', 'Abmaj9'],
    styles: { drums: 'tape', bass: 'lofi', keys: 'lofi', counter: 'chime' },
    bside: { transpose: 2, styles: { drums: 'soft', keys: 'arp' }, melodyOctave: 12 },
    rhythmsA: [3, 0, 2, 6, 1, 3, 7, 4], rhythmsB: [4, 2, 5, 0, 3, 1, 6, 2],
    mix: { counter: { gain: 0.17, params: { bright: 0.2 } } },
  },
  {
    id: 'piano-asa', title: 'あさつゆの ピアノ', key: 'G', bpm: 76, swing: 0.06, seed: 2307, leadBase: 62,
    note: 'あまおとと ピアノ の変奏。ト長調で、あかるい あさの くうき。',
    intro: ['Cmaj9', 'D9sus4'],
    A: ['Gmaj9', 'Bm7 E7b9', 'Am9', 'D13sus4 D13', 'Cmaj9', 'Cm6 F9', 'Bm7 E7b9', 'Am9 D9sus4'],
    B: ['Cmaj9', 'D/C', 'Bm7', 'Em9', 'Am9', 'D9', 'Gmaj9', 'D9sus4'],
    O: ['Gmaj9', 'Cmaj9', 'Gmaj9', 'Cmaj9'],
    styles: { drums: 'boombap', bass: 'lofi', keys: 'lofi', counter: 'chime' },
    bside: { transpose: -2, styles: { drums: 'tape', keys: 'arp' }, melodyOctave: 12 },
    rhythmsA: [1, 3, 0, 4, 6, 2, 0, 3], rhythmsB: [5, 7, 2, 4, 0, 6, 1, 4],
    mix: { counter: { gain: 0.15, params: { bright: 0.2 } }, lead: { gain: 0.31 } },
  },
  // ---- bells (id071): variations of ふゆの ベル (celesta melody, piano comping).
  {
    base: 'winter-bell', bell: true, id: 'bell-konayuki', title: 'こなゆきの ベル', key: 'D', bpm: 70, swing: 0.06, seed: 3101, leadBase: 67,
    note: 'ふゆの ベル の変奏。ニ長調で、ゆっくり ふる こなゆき。',
    intro: ['Gmaj9', 'A9sus4'],
    A: ['Dmaj9', 'Bm9', 'Gmaj9', 'A9sus4 A9', 'Dmaj9', 'F#m7', 'Gmaj9', 'Em9 A9'],
    B: ['Gmaj9', 'F#m7', 'Em9', 'Dmaj9', 'Gmaj9', 'Gm6', 'F#m7', 'Em9 A9sus4'],
    O: ['Dmaj9', 'Gmaj9', 'Dmaj9', 'Gmaj9'],
    styles: { drums: 'soft', bass: 'hold', keys: 'lofi', counter: 'chime' },
    bside: { transpose: -2, styles: { keys: 'arp', counter: 'arp16' }, melodyOctave: -12 },
    rhythmsA: [0, 1, 3, 2, 4, 0, 6, 1], rhythmsB: [1, 5, 0, 2, 3, 1, 7, 0],
    mix: { counter: { gain: 0.25 } },
  },
  {
    base: 'winter-bell', bell: true, id: 'bell-hoshizora', title: 'ほしぞらの ベル', key: 'A', bpm: 72, swing: 0.08, seed: 3203, leadBase: 67,
    note: 'ふゆの ベル の変奏。イ長調で、ほしが またたく よる。',
    intro: ['Dmaj9', 'E9sus4'],
    A: ['Amaj9', 'F#m9', 'Dmaj9', 'E9sus4 E9', 'C#m7 F#7b9', 'Bm9', 'Dm6 G9', 'Bm9 E9sus4'],
    B: ['Dmaj9', 'E/D', 'C#m7', 'F#m9', 'Bm9', 'E9', 'Amaj9', 'E9sus4'],
    O: ['Amaj9', 'Dmaj9', 'Amaj9', 'Dmaj9'],
    styles: { drums: 'soft', bass: 'hold', keys: 'lofi', counter: 'chime' },
    bside: { transpose: -3, styles: { keys: 'arp', counter: 'arp16' }, melodyOctave: -12 },
    rhythmsA: [3, 0, 1, 4, 0, 5, 6, 2], rhythmsB: [5, 0, 3, 1, 4, 0, 1, 2],
    mix: { counter: { gain: 0.25 } },
  },
  {
    base: 'winter-bell', bell: true, id: 'bell-tomoshibi', title: 'ともしびの ベル', key: 'C', bpm: 70, swing: 0.1, seed: 3307, leadBase: 67,
    note: 'ふゆの ベル の変奏。ハ長調で、まどの あかりの あたたかさ。',
    intro: ['Fmaj9', 'G9sus4'],
    A: ['Cmaj9', 'Am9', 'Fmaj9', 'G9sus4 G9', 'Em7 A7b9', 'Dm9', 'Fm6 Bb9', 'Dm9 G9sus4'],
    B: ['Fmaj9', 'G/F', 'Em7', 'Am9', 'Dm9', 'G9', 'Cmaj9', 'G9sus4'],
    O: ['Cmaj9', 'Fmaj9', 'Cmaj9', 'Fmaj9'],
    styles: { drums: 'soft', bass: 'hold', keys: 'lofi', counter: 'chime' },
    bside: { transpose: 2, styles: { keys: 'arp', counter: 'arp16' }, melodyOctave: -12 },
    rhythmsA: [1, 0, 4, 3, 1, 2, 0, 1], rhythmsB: [0, 3, 1, 6, 0, 5, 1, 2],
    mix: { counter: { gain: 0.25 } },
  },
];

const ids = JSON.parse(fs.readFileSync('app/audio/songs/index.json', 'utf8'));
for (const d of SONGS) {
  const ref = d.leadBase; // the melody's offsets are from lead.base
  // Piano: from the lead's base up; bells: high, where ふゆの ベル sings (F#5..A6).
  const [lo, hiA, hiB, arcA, arcB] = d.bell
    ? [76, 91, 93, [6, 9, 11, 7, 8, 12, 9, 4], [10, 8, 12, 9, 13, 10, 8, 5]]
    : [ref, ref + 19, ref + 22, [9, 11, 14, 10, 12, 16, 11, 7], [14, 12, 16, 13, 17, 14, 12, 9]];
  const a = compose(d.A, { key: d.key, lo, hi: hiA, arc: arcA, seed: d.seed, rhythms: d.rhythmsA, bell: d.bell, ref });
  const b = compose(d.B, { key: d.key, lo, hi: hiB, arc: arcB, seed: d.seed + 1, rhythms: d.rhythmsB, bell: d.bell, ref });
  const song = {
    ...structuredClone(load(d.base || 'rain-piano')),
    id: d.id, title: d.title, bpm: d.bpm, swing: d.swing, key: d.key, seed: d.seed, note: d.note,
    sections: {
      intro: { bars: 2, chords: d.intro, breath: true },
      A: { bars: 8, chords: d.A, melody: 'a' },
      B: { bars: 8, chords: d.B, melody: 'b' },
      C: { bars: 8, chords: d.A },
      O: { bars: 4, chords: d.O, loop: true },
    },
    melodies: { a, b },
    lead: { base: ref, octaveOnRepeat: false },
    styles: d.styles,
    bside: d.bside,
  };
  // Per-song mix (id068 review): the kalimba answers stay as quiet and soft
  // as in the base song (pure sines up high read as a raw chip sound).
  for (const [tr, o] of Object.entries(d.mix || {})) song.tracks[tr] = { ...song.tracks[tr], ...o, params: { ...(song.tracks[tr].params || {}), ...(o.params || {}) } };
  fs.writeFileSync(`app/audio/songs/${d.id}.json`, `${JSON.stringify(song, null, 1)}\n`);
  if (!ids.includes(d.id)) ids.push(d.id);
  console.log(d.id, a.length, b.length);
}
fs.writeFileSync('app/audio/songs/index.json', `${JSON.stringify(ids, null, 1)}\n`);
