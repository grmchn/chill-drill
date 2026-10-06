// Song data and the arranger (pure parts of the audio engine).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseChord, voice, barChords, songBars, songSeconds, arrangeBar, createState, layersAt, validateSong } from '../app/js/audio/arranger.js';
import { swingStep, maruFigure, MARU_FIGURES } from '../app/js/audio/engine.js';
import { renderNote, renderDrum, renderLoop, renderFoley, INSTRUMENTS, DRUMS, LOOPS } from '../app/js/audio/dsp.js';
import { makeRng } from '../app/js/problems.js';

const dir = new URL('../app/audio/songs/', import.meta.url);
const ids = JSON.parse(fs.readFileSync(new URL('index.json', dir)));
const songs = ids.map((id) => JSON.parse(fs.readFileSync(new URL(`${id}.json`, dir))));

test('chords parse; voicings stay close and in range', () => {
  const c = parseChord('Em7b5');
  assert.deepEqual([c.root, c.quality], [4, 'm7b5']);
  assert.equal(parseChord('C/Bb').bass, 10);
  assert.throws(() => parseChord('Cfoo'));
  let prev = null;
  for (const sym of ['Fmaj9', 'Em7b5', 'A7b9', 'Dm9', 'Cm9', 'F13', 'Bbmaj9']) {
    const v = voice(parseChord(sym), prev);
    assert.ok(v[0] >= 50 && v[v.length - 1] <= 77, sym);
    if (prev) assert.ok(Math.abs((v[0] + v[v.length - 1]) / 2 - (prev[0] + prev[prev.length - 1]) / 2) <= 7, `voice-leading ${sym}`);
    prev = v;
  }
  assert.equal(barChords('Em7b5 A7b9')[1].step, 8);
});

test('every song is valid, about four minutes, Lo-Fi tempo, intro and outro', () => {
  assert.equal(songs.length, 9);
  for (const s of songs) {
    assert.deepEqual(validateSong(s), [], s.id);
    const sec = songSeconds(s);
    assert.ok(sec > 210 && sec < 270, `${s.id} ${sec}`);
    assert.ok(s.bpm >= 70 && s.bpm <= 85, s.id);
    const bars = songBars(s);
    assert.equal(bars[0].section, 'intro');
    assert.equal(bars[bars.length - 1].section, 'O');
  }
});

test('layers enter in the planned order and the breath intro has no drums', () => {
  const s = songs[0];
  assert.deepEqual([...layersAt(s, 0)].sort(), ['keys', 'pad']);
  assert.ok(layersAt(s, 1).has('lead') && layersAt(s, 1).has('drums'));
  const bars = songBars(s);
  const all = new Set(['keys', 'lead', 'bass', 'counter', 'drums', 'pad']);
  const intro = arrangeBar(s, bars[0], bars[1], all, 1, createState(), makeRng(1));
  assert.ok(!intro.events.some((e) => e.track === 'drums' || e.track === 'bass' || e.track === 'lead'));
  const a = arrangeBar(s, bars[2], bars[3], all, 1, createState(), makeRng(1));
  for (const t of ['drums', 'bass', 'keys', 'lead']) assert.ok(a.events.some((e) => e.track === t), t);
  for (const e of a.events) if (e.midi != null) assert.ok(e.midi >= 24 && e.midi <= 100, `${e.track} ${e.midi}`);
});

test('swing keeps beats on the grid and delays the off-beats', () => {
  assert.equal(swingStep(4, 0.2), 4);
  assert.ok(swingStep(1, 0.2) > 1);
  assert.equal(swingStep(3, 0), 3);
  assert.ok(swingStep(2, 0.3, 8) > 2 && swingStep(4, 0.3, 8) === 4);
});

test('instruments and sounds render finite, non-silent, non-clipping samples', () => {
  const sr = 22050;
  const check = (buf, name) => {
    let peak = 0;
    for (const x of buf) { assert.ok(Number.isFinite(x), name); peak = Math.max(peak, Math.abs(x)); }
    assert.ok(peak > 0.01 && peak < 2, `${name} peak ${peak}`);
  };
  for (const i of INSTRUMENTS) check(renderNote(i, i === 'subbass' || i === 'upright' ? 40 : 64, 0.7, sr), i);
  for (const d of DRUMS) check(renderDrum(d, sr), d);
  for (const l of LOOPS) check(renderLoop(l, sr), l);
  for (const f of ['pencil', 'eraser', 'rub', 'paper', 'tick', 'thud', 'key']) check(renderFoley(f, sr), f);
});

test('finished-problem figures open up as the session goes on, gently (id036)', () => {
  const rng = makeRng(5);
  const names = (solved) => { const seen = new Set(); let last = null; for (let i = 0; i < 200; i++) { const f = maruFigure(solved, last, rng); if (solved >= 5) assert.notEqual(f.name, last); last = f.name; seen.add(f.name); } return seen; };
  assert.deepEqual([...names(0)], ['rise']);
  assert.equal(names(6).size, 3);
  assert.equal(names(30).size, MARU_FIGURES.length);
  for (const f of MARU_FIGURES) {
    assert.ok(f.notes.length <= 5, f.name);
    for (const n of f.notes) assert.ok(n.vel <= 0.5 && n.gain <= 0.6, f.name);
  }
});
