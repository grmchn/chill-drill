// Lo-Fi Studio: compose and voice Chill Drill's songs with the game's own
// audio engine. Edits apply live (from the next bar) and are kept as a draft
// in this browser; export the JSON into app/audio/songs/ to ship a song.
import { LofiEngine, renderOffline } from '../../app/js/audio/engine.js';
import { INSTRUMENTS, INSTRUMENT_DEFAULTS, mtof } from '../../app/js/audio/dsp.js';
import { STYLE_NAMES, validateSong, barChords, songSeconds, parseChord } from '../../app/js/audio/arranger.js';
import { encodeWav, levels } from '../../app/js/audio/wav.js';

const $ = (s) => document.querySelector(s);
const SONGS = '../../app/audio/songs/';
const TRACKS = ['keys', 'lead', 'bass', 'counter', 'drums', 'pad'];
const TRACK_NAME = { keys: 'コード（keys）', lead: '旋律（lead）', bass: 'ベース', counter: '合いの手（counter）', drums: 'ドラム', pad: 'パッド' };
const FX = [['wow', 'ワウ（ゆっくりの揺れ）', 0, 1, 0.01], ['flutter', 'フラッター（細かい揺れ）', 0, 1, 0.01], ['crackle', 'レコードのノイズ', 0, 1, 0.01], ['lpf', 'こもり（ローパスHz）', 1200, 9000, 50], ['sat', 'サチュレーション', 0, 1, 0.01], ['reverb', '残響', 0, 0.8, 0.01]];

const engine = new LofiEngine();
let song = null;
let ids = [];
let solo = new Set();
let muted = new Set();

const status = (msg) => { $('#status').textContent = msg; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const draftKey = (id) => `chill-studio:draft:${id}`;
function saveDraft() { try { localStorage.setItem(draftKey(song.id), JSON.stringify(song)); } catch { /* storage may be blocked */ } }

async function loadIndex() {
  ids = await (await fetch(`${SONGS}index.json`)).json();
  $('#song-pick').innerHTML = ids.map((id) => `<option value="${id}">${id}</option>`).join('');
}
async function loadSong(id) {
  let s = null;
  try { const d = localStorage.getItem(draftKey(id)); if (d) s = JSON.parse(d); } catch { s = null; }
  if (!s) s = await (await fetch(`${SONGS}${id}.json`)).json();
  setSong(s, !!localStorage.getItem(draftKey(id)));
}
function setSong(s, fromDraft = false) {
  song = s;
  renderAll();
  status(fromDraft ? `${song.title}（下書きを読み込みました）` : song.title);
}

// ---------------------------------------------------------------- forms
function renderAll() {
  $('#f-id').value = song.id; $('#f-title').value = song.title; $('#f-bpm').value = song.bpm; $('#f-swing').value = song.swing;
  $('#f-key').value = song.key || ''; $('#f-leadbase').value = (song.lead && song.lead.base) || 72; $('#f-target').value = song.targetSec || 240;
  $('#f-input').innerHTML = INSTRUMENTS.map((i) => `<option${i === (song.input && song.input.inst) ? ' selected' : ''}>${i}</option>`).join('');
  $('#f-form').value = song.form.join(' ');
  $('#styles').innerHTML = Object.entries(STYLE_NAMES).map(([k, list]) => `<label>${k} <select data-style="${k}">${list.map((n) => `<option${song.styles[k] === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`).join('');
  renderMixer(); renderFx(); renderInstTrack(); renderSections(); renderMelodyPick(); validate();
}

function validate() {
  const errs = validateSong(song);
  $('#validate').textContent = errs.length ? `要確認：${errs.join(' / ')}` : `OK・1曲 約${Math.round(songSeconds(song))}秒`;
}

function bindFields() {
  const num = (el, fn) => el.addEventListener('change', () => { fn(Number(el.value)); changed(); });
  $('#f-id').addEventListener('change', () => { song.id = $('#f-id').value.trim(); changed(); });
  $('#f-title').addEventListener('change', () => { song.title = $('#f-title').value; changed(); });
  num($('#f-bpm'), (v) => { song.bpm = v; });
  num($('#f-swing'), (v) => { song.swing = v; });
  $('#f-key').addEventListener('change', () => { song.key = $('#f-key').value; changed(); });
  num($('#f-leadbase'), (v) => { song.lead = { ...(song.lead || {}), base: v }; });
  num($('#f-target'), (v) => { song.targetSec = v; });
  $('#f-input').addEventListener('change', () => { song.input = { inst: $('#f-input').value }; changed(); });
  $('#f-form').addEventListener('change', () => { song.form = $('#f-form').value.split(/\s+/).filter(Boolean); changed(); });
  $('#styles').addEventListener('change', (e) => { const k = e.target.dataset.style; if (k) { song.styles[k] = e.target.value; changed(); } });
}
function changed() { saveDraft(); validate(); drawRoll(); }

// ---------------------------------------------------------------- mixer and fx
function renderMixer() {
  $('#mix-rows').innerHTML = TRACKS.map((t) => {
    const d = song.tracks[t] || {};
    return `<tr><th>${TRACK_NAME[t]}</th>
      <td><input type="range" min="0" max="1.6" step="0.01" value="${d.gain ?? 0.5}" data-mix="${t}:gain" aria-label="${TRACK_NAME[t]} 音量"></td>
      <td><input type="range" min="-1" max="1" step="0.05" value="${d.pan ?? 0}" data-mix="${t}:pan" aria-label="${TRACK_NAME[t]} 定位"></td>
      <td><input type="range" min="0" max="1" step="0.01" value="${d.send ?? 0.2}" data-mix="${t}:send" aria-label="${TRACK_NAME[t]} 残響"></td>
      <td><input type="checkbox" data-mute="${t}" ${muted.has(t) ? 'checked' : ''} aria-label="${TRACK_NAME[t]} ミュート"></td>
      <td><input type="checkbox" data-solo="${t}" ${solo.has(t) ? 'checked' : ''} aria-label="${TRACK_NAME[t]} ソロ"></td></tr>`;
  }).join('');
}
function applySolo() {
  const set = new Set(solo.size ? solo : TRACKS);
  for (const m of muted) set.delete(m);
  engine.solo = set.size === TRACKS.length ? null : set;
}
function bindMixer() {
  $('#mix-rows').addEventListener('input', (e) => {
    const k = e.target.dataset.mix; if (!k) return;
    const [t, prop] = k.split(':');
    song.tracks[t] = song.tracks[t] || {};
    song.tracks[t][prop] = Number(e.target.value);
    if (engine.ctx) engine.applySongFx(song);
    saveDraft();
  });
  $('#mix-rows').addEventListener('change', (e) => {
    const m = e.target.dataset.mute; const s = e.target.dataset.solo;
    if (m) { if (e.target.checked) muted.add(m); else muted.delete(m); }
    if (s) { if (e.target.checked) solo.add(s); else solo.delete(s); }
    applySolo();
  });
}
function renderFx() {
  song.fx = song.fx || {};
  $('#fx-rows').innerHTML = FX.map(([k, name, lo, hi, st]) => `<label class="slider">${name} <input type="range" min="${lo}" max="${hi}" step="${st}" value="${song.fx[k] ?? lo}" data-fx="${k}"><output>${song.fx[k] ?? lo}</output></label>`).join('');
}
function bindFx() {
  $('#fx-rows').addEventListener('input', (e) => {
    const k = e.target.dataset.fx; if (!k) return;
    song.fx[k] = Number(e.target.value);
    e.target.nextElementSibling.textContent = e.target.value;
    if (engine.ctx) engine.applySongFx(song);
    saveDraft();
  });
}

// ---------------------------------------------------------------- instruments
function renderInstTrack() {
  const pitched = TRACKS.filter((t) => t !== 'drums' && t !== 'pad');
  const cur = $('#inst-track').value || 'keys';
  $('#inst-track').innerHTML = pitched.map((t) => `<option value="${t}"${t === cur ? ' selected' : ''}>${TRACK_NAME[t]}</option>`).join('');
  renderInst();
}
function renderInst() {
  const t = $('#inst-track').value;
  const d = song.tracks[t];
  $('#inst-kind').innerHTML = INSTRUMENTS.map((i) => `<option${i === d.inst ? ' selected' : ''}>${i}</option>`).join('');
  const params = { ...INSTRUMENT_DEFAULTS[d.inst], ...(d.params || {}) };
  $('#inst-params').innerHTML = Object.entries(params).map(([k, v]) => `<label class="slider">${k} <input type="range" min="0" max="${k === 'len' ? 6 : 1.5}" step="0.01" value="${v}" data-param="${k}"><output>${v}</output></label>`).join('');
  renderKeyboard();
}
function bindInst() {
  $('#inst-track').addEventListener('change', renderInst);
  $('#inst-kind').addEventListener('change', () => { const t = $('#inst-track').value; song.tracks[t].inst = $('#inst-kind').value; song.tracks[t].params = {}; renderInst(); saveDraft(); });
  $('#inst-params').addEventListener('input', (e) => {
    const k = e.target.dataset.param; if (!k) return;
    const t = $('#inst-track').value;
    song.tracks[t].params = { ...(song.tracks[t].params || {}), [k]: Number(e.target.value) };
    e.target.nextElementSibling.textContent = e.target.value;
    saveDraft();
  });
}
function renderKeyboard() {
  const t = $('#inst-track').value;
  const lo = t === 'bass' ? 33 : t === 'lead' ? 60 : 48;
  let html = '';
  for (let m = lo; m < lo + 25; m++) { const black = [1, 3, 6, 8, 10].includes(m % 12); html += `<button type="button" class="k${black ? ' b' : ''}" data-midi="${m}" aria-label="MIDI ${m}"></button>`; }
  $('#keyboard').innerHTML = html;
}
function bindKeyboard() {
  $('#keyboard').addEventListener('pointerdown', (e) => {
    const m = Number(e.target.dataset.midi); if (!m) return;
    engine.unlock();
    const t = $('#inst-track').value; const d = song.tracks[t];
    engine.playNote(engine.sfxOut, d.inst, m, 0.7, engine.now + 0.01, 1.6, d.params);
  });
}

// ---------------------------------------------------------------- sections and chords
function renderSections() {
  const cur = $('#sec-pick').value && song.sections[$('#sec-pick').value] ? $('#sec-pick').value : Object.keys(song.sections)[0];
  $('#sec-pick').innerHTML = Object.keys(song.sections).map((k) => `<option${k === cur ? ' selected' : ''}>${k}</option>`).join('');
  renderSection();
}
function renderSection() {
  const s = song.sections[$('#sec-pick').value];
  $('#sec-bars').value = s.bars;
  $('#sec-melody').innerHTML = `<option value="">なし</option>${Object.keys(song.melodies || {}).map((k) => `<option${s.melody === k ? ' selected' : ''}>${k}</option>`).join('')}`;
  $('#sec-breath').checked = !!s.breath;
  $('#chord-cells').innerHTML = Array.from({ length: s.bars }, (_, i) => `<label><span>${i + 1}</span><input type="text" value="${s.chords[i % s.chords.length] || ''}" data-bar="${i}"></label>`).join('');
}
function bindSections() {
  $('#sec-pick').addEventListener('change', renderSection);
  $('#sec-bars').addEventListener('change', () => { const s = song.sections[$('#sec-pick').value]; s.bars = Number($('#sec-bars').value); while (s.chords.length < s.bars) s.chords.push(s.chords[s.chords.length - 1] || 'Cmaj7'); s.chords.length = s.bars; renderSection(); changed(); });
  $('#sec-melody').addEventListener('change', () => { const s = song.sections[$('#sec-pick').value]; if ($('#sec-melody').value) s.melody = $('#sec-melody').value; else delete s.melody; changed(); });
  $('#sec-breath').addEventListener('change', () => { const s = song.sections[$('#sec-pick').value]; s.breath = $('#sec-breath').checked; changed(); });
  $('#chord-cells').addEventListener('change', (e) => {
    const i = Number(e.target.dataset.bar); const s = song.sections[$('#sec-pick').value];
    try { barChords(e.target.value); e.target.classList.remove('bad'); s.chords[i] = e.target.value.trim(); changed(); } catch (err) { e.target.classList.add('bad'); status(err.message); }
  });
  $('#sec-add').addEventListener('click', () => {
    const name = prompt('セクション名（例：D）'); if (!name || song.sections[name]) return;
    song.sections[name] = { bars: 8, chords: Array(8).fill('Cmaj7') };
    renderSections(); $('#sec-pick').value = name; renderSection(); changed();
  });
}

// ---------------------------------------------------------------- piano roll
const ROLL = { lo: -5, hi: 26, bars: 8, cw: 10, rh: 13, left: 40 };
function renderMelodyPick() {
  song.melodies = song.melodies || {};
  const cur = $('#mel-pick').value && song.melodies[$('#mel-pick').value] ? $('#mel-pick').value : Object.keys(song.melodies)[0];
  $('#mel-pick').innerHTML = Object.keys(song.melodies).map((k) => `<option${k === cur ? ' selected' : ''}>${k}</option>`).join('');
  drawRoll();
}
// Chord tones per bar, from the first section that uses this melody.
function rollChords() {
  const name = $('#mel-pick').value;
  const sec = Object.values(song.sections).find((s) => s.melody === name);
  if (!sec) return [];
  return Array.from({ length: ROLL.bars }, (_, b) => { try { return barChords(sec.chords[b % sec.chords.length]); } catch { return []; } });
}
function drawRoll() {
  const cv = $('#roll'); if (!cv || !song) return;
  const g = cv.getContext('2d');
  const rows = ROLL.hi - ROLL.lo + 1;
  cv.height = rows * ROLL.rh + 20;
  cv.width = ROLL.left + ROLL.bars * 16 * ROLL.cw + 4;
  g.fillStyle = '#1d1f45'; g.fillRect(0, 0, cv.width, cv.height);
  const base = (song.lead && song.lead.base) || 72;
  const chords = rollChords();
  for (let r = 0; r < rows; r++) {
    const semi = ROLL.hi - r; const y = r * ROLL.rh + 20;
    const midi = base + semi;
    const black = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
    g.fillStyle = black ? '#23264f' : '#2a2d5e'; g.fillRect(ROLL.left, y, cv.width, ROLL.rh);
    chords.forEach((slots, b) => slots.forEach((s) => {
      if (s.pcs.includes(((midi % 12) + 12) % 12)) { g.fillStyle = 'rgba(63,179,163,.22)'; g.fillRect(ROLL.left + (b * 16 + s.step) * ROLL.cw, y, s.len * ROLL.cw, ROLL.rh); }
    }));
    g.fillStyle = '#c9d6e8'; g.font = '10px sans-serif';
    if (midi % 12 === 0) g.fillText(`C${Math.floor(midi / 12) - 1}`, 4, y + 10);
  }
  for (let s = 0; s <= ROLL.bars * 16; s++) { g.fillStyle = s % 16 === 0 ? '#c9d6e8' : s % 4 === 0 ? '#565b9a' : '#33376b'; g.fillRect(ROLL.left + s * ROLL.cw, 20, 1, rows * ROLL.rh); }
  chords.forEach((slots, b) => slots.forEach((s) => { g.fillStyle = '#ffd9a8'; g.font = '11px sans-serif'; g.fillText(s.sym, ROLL.left + (b * 16 + s.step) * ROLL.cw + 3, 13); }));
  for (const [bar, step, dur, semi] of song.melodies[$('#mel-pick').value] || []) {
    const r = ROLL.hi - semi; if (r < 0 || r >= rows) continue;
    g.fillStyle = '#ffb56b'; g.fillRect(ROLL.left + (bar * 16 + step) * ROLL.cw + 1, r * ROLL.rh + 21, dur * ROLL.cw - 2, ROLL.rh - 2);
  }
}
function bindRoll() {
  $('#mel-pick').addEventListener('change', drawRoll);
  $('#mel-new').addEventListener('click', () => { const name = prompt('旋律の名前（例：c）'); if (!name || song.melodies[name]) return; song.melodies[name] = []; renderMelodyPick(); $('#mel-pick').value = name; drawRoll(); renderSection(); saveDraft(); });
  $('#roll').addEventListener('click', (e) => {
    const cv = $('#roll'); const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * cv.width - ROLL.left; const y = ((e.clientY - r.top) / r.height) * cv.height - 20;
    if (x < 0 || y < 0) return;
    const col = Math.floor(x / ROLL.cw); const semi = ROLL.hi - Math.floor(y / ROLL.rh);
    const bar = Math.floor(col / 16); const step = col % 16;
    const mel = song.melodies[$('#mel-pick').value];
    const hit = mel.findIndex(([b, s, d, n]) => n === semi && b * 16 + s <= col && col < b * 16 + s + d);
    if (hit >= 0) mel.splice(hit, 1); else {
      const len = Number($('#mel-len').value);
      mel.push([bar, step, Math.min(len, 16 - step), semi]);
      mel.sort((a, b) => a[0] * 16 + a[1] - (b[0] * 16 + b[1]));
      engine.unlock(); const d = song.tracks.lead; engine.playNote(engine.sfxOut, d.inst, ((song.lead && song.lead.base) || 72) + semi, 0.6, engine.now + 0.01, 0.6, d.params);
    }
    drawRoll(); saveDraft();
  });
  $('#mel-play').addEventListener('click', () => {
    const name = $('#mel-pick').value;
    const secName = Object.keys(song.sections).find((k) => song.sections[k].melody === name);
    if (!secName) { status('この旋律を使うセクションがありません'); return; }
    const tmp = clone(song);
    tmp.form = ['intro', secName]; tmp.loopFrom = 1; tmp.targetSec = 9999;
    tmp.sections.intro = { bars: 1, chords: [song.sections[secName].chords[0]], breath: true };
    tmp.layers = TRACKS.map((t) => ({ track: t, at: 0 }));
    play(tmp, false);
  });
}

// ---------------------------------------------------------------- transport
function play(s = song, bside = false) {
  engine.unlock();
  applySolo();
  engine.setEnergy(Number($('#energy').value));
  engine.setFlow(Number($('#flow').value));
  status('音色を準備中…');
  engine.prewarm(s, { bside, done: () => { engine.play([{ song: s, bside }]); status(`${s.title}${bside ? '（B面）' : ''} を再生中`); } });
}
function bindTransport() {
  $('#play').addEventListener('click', () => play(song, false));
  $('#play-b').addEventListener('click', () => play(song, true));
  $('#stop').addEventListener('click', () => { engine.stop(); status('停止'); });
  $('#finish').addEventListener('click', () => engine.finish());
  $('#energy').addEventListener('input', (e) => { engine.setEnergy(Number(e.target.value)); $('#energy-v').textContent = Number(e.target.value).toFixed(2); });
  $('#flow').addEventListener('input', (e) => { engine.setFlow(Number(e.target.value)); $('#flow-v').textContent = Number(e.target.value).toFixed(2); });
  engine.on('bar', (b) => { $('#pos').textContent = `${b.section} ${b.bar + 1}小節め（通し ${b.index + 1}）`; });
  engine.on('mainEnd', () => { $('#pos').textContent += '・アウトロ（待機ループ）'; });
  $('#sfx-row').addEventListener('click', (e) => {
    const k = e.target.dataset.sfx; if (!k) return;
    engine.unlock();
    if (!engine.playlist) engine.prewarm(song, {});
    if (k === 'key') engine.key(Math.floor(Math.random() * 10), 0); else if (k === 'lantern') engine.lantern(2); else engine[k]();
  });
  $('#ambient').addEventListener('change', (e) => { engine.unlock(); engine.setAmbient(e.target.value); });
}

// ---------------------------------------------------------------- files
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function bindFiles() {
  $('#song-pick').addEventListener('change', () => loadSong($('#song-pick').value));
  $('#export').addEventListener('click', () => download(new Blob([`${JSON.stringify(song, null, 1)}\n`], { type: 'application/json' }), `${song.id}.json`));
  $('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(song, null, 1)); status('コピーしました'); } catch { status('コピーできませんでした'); } });
  $('#import').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { const s = JSON.parse(await f.text()); setSong(s); saveDraft(); } catch (err) { status(`読み込めません：${err.message}`); } });
  $('#new-song').addEventListener('click', () => {
    const s = clone(song);
    s.id = `new-${Date.now().toString(36)}`; s.title = 'あたらしい きょく';
    s.melodies = { a: [], b: [] };
    setSong(s); saveDraft();
  });
  $('#render').addEventListener('click', async () => {
    const len = $('#render-len').value;
    const sec = len === 'full' ? songSeconds(song) + 6 : Number(len);
    status(`書き出し中…（${Math.round(sec)}秒ぶん）`);
    const buf = await renderOffline([{ song, bside: false }], { seconds: sec, energy: (t) => Math.min(1, t / Math.max(20, sec * 0.6)), flow: () => Number($('#flow').value) });
    const lv = levels(buf);
    download(encodeWav(buf), `${song.id}.wav`);
    status(`書き出しました（ピーク ${lv[0].peakDb.toFixed(1)}dB・RMS ${lv[0].rmsDb.toFixed(1)}dB）`);
  });
}

async function main() {
  bindFields(); bindMixer(); bindFx(); bindInst(); bindKeyboard(); bindSections(); bindRoll(); bindTransport(); bindFiles();
  await loadIndex();
  await loadSong(ids[0]);
  window.__studio = { engine, get song() { return song; }, parseChord, mtof };
}
main();
