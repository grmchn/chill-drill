// Chill Drill: the game flow, input and the quiet "director". Everything
// moves slowly; the room, the music and チルネコ change by small steps.
import { params, clamp } from './core.js';
import { makeRng, makeProblem, signature } from './problems.js';
import { SKILLS, SKILL, LANES } from './skills.js';
import { emptyProgress, recordResult, stateOf, starsOf, pickCapsule, useCapsule, rustyOf, gradePlan, levelPlan, placementPlan, isUnlocked, frontier } from './session.js';
import * as store from './store.js';
import * as growth from './growth.js';
import * as qs from './quests.js';
import * as tr from './trophies.js';
import * as col from './collection.js';
import { DrillSession, ListSession } from './drill.js';
import { createDial, noteAnswer, levelPick, gradePick, gradeLadder } from './difficulty.js';
import { createOkawari, finishProblem, endTape, currentTape, again, rackTapes } from './okawari.js';
import { PaceMeter } from './pace.js';
import { BASIC_SCORE, CHILL, cellChill } from './scoring.js';
import { LofiEngine } from './audio/engine.js';
import { songBars, barSeconds } from './audio/arranger.js';
import { Room } from './room.js';
import { ChillNeko } from './neko.js';
import { Notebook } from './notebook.js';
import { Views, tapeOrdinal } from './views.js';
import { Coach } from './coach.js';
import { dailyWeather, ambientFor } from './weather.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const body = document.body;
const today = () => store.dayKey();

// ---------------------------------------------------------------- setup
const room = new Room($('#room'));
const neko = new ChillNeko($('#neko-host'), { size: 112 });
const notebook = new Notebook($('#notebook'), { reduced: () => S.motion === 0 });
const audio = new LofiEngine();
const S = {
  screen: 'title', motion: 1, songs: [], songMap: {}, look: null, session: null, okawari: null, plan: null, mode: null,
  problem: null, step: 0, ready: false, wrongInQ: false, stepMisses: 0, qMisses: 0, qStart: 0, run: 0,
  dial: createDial(), pace: new PaceMeter(), chill: 0, chillBy: {}, sessionSigs: new Set(), notes: [], sessionTimes: {},
  newUnlocks: [], newMastered: [], newStars: {}, polished: [], wrongList: [], capsule: null, restMs: 0, rested: false,
  clockStart: 0, pausedAt: null,
};
window.__chill = { S, audio, room, neko, notebook, store };
const coach = new Coach({ neko, motion: () => S.motion, onEnd: (name) => { if (name === 'play') store.markGuideSeen(); if (name === 'okawari') { store.load().okawariGuideSeen = true; store.save(); } placeNeko(); if (name === 'okawari' && S.okawariWaiting) beginOkawari(); } });
const views = new Views({ S, store, audio, room, neko, startPractice: (id) => startGame('practice', id), refreshTitle: () => refreshTitle(), applyLook: (l) => applyLook(l), settingsChanged: () => applySettings(), startDemo: () => startDemo(), trophyMetrics: () => { checkTrophies(); return trophyMetrics(); } });

const settings = () => store.settings();
// The day's weather (id029) and the ambience it implies for "てんきに あわせる".
const weatherToday = () => dailyWeather(today());
// The cafe ambience was dropped (id028); a saved 'cafe' follows the weather.
const ambientKind = (st = settings()) => (st.ambient === 'auto' || st.ambient === 'cafe' ? ambientFor(weatherToday(), new Date().getMonth() + 1) : st.ambient);
const progress = () => { const st = store.load(); if (!st.progress) st.progress = emptyProgress(); return st.progress; };
const stats = () => { const st = store.load(); if (!st.stats) st.stats = growth.statsFromHistory(st.history); return st.stats; };
// The player's total チル (id057); the collection arrives as it grows.
const chillTotal = () => (store.load().stats ? store.load().stats.chill || 0 : 0);
// Check-only URL parameters (?skill=, ?auto) leave no records.
const recording = () => !params.has('skill') && (!params.has('auto') || params.has('rec')) && !S.demo;

// ---------------------------------------------------------------- songs
async function loadSongs() {
  const ids = await (await fetch('audio/songs/index.json')).json();
  S.songs = await Promise.all(ids.map(async (id) => (await fetch(`audio/songs/${id}.json`)).json()));
  for (const s of S.songs) S.songMap[s.id] = s;
  // Shorter songs for checks: ?songsec=40
  const short = Number(params.get('songsec') || 0);
  if (short) for (const s of S.songs) s.targetSec = short;
}

// The songs of one session: the chosen one first, then other owned songs.
function playlist(n, first) {
  const owned = col.unlockedIn('music', chillTotal()).map((it) => col.variant(it.id)).filter((id) => S.songMap[id]);
  const order = [first, ...owned.filter((id) => id !== first)];
  return Array.from({ length: n }, (_, i) => ({ song: S.songMap[order[i % order.length]] || S.songs[0], bside: false }));
}
const sessionSeconds = (list) => list.reduce((a, p, i) => a + songBars(p.song).filter((b) => i < list.length - 1 || b.section !== 'O').length * barSeconds(p.song), 0);
const introSeconds = (song) => (song.sections.intro ? song.sections.intro.bars * barSeconds(song) : 0);

// ---------------------------------------------------------------- look
const trophyState = () => { const st = store.load(); if (!st.trophies) st.trophies = {}; return st.trophies; };
const equipState = () => { const st = store.load(); if (!st.equip) st.equip = col.defaultEquip(); return st.equip; };
function applyLook(look) {
  S.look = look;
  room.setLook({ room: col.variant(look.room), view: col.variant(look.view), prop: col.variant(look.prop), mate: col.variant(look.mate), event: col.variant(look.event) });
  room.setWeather(weatherToday());
  room.setMotion(S.motion);
  neko.setPalette(col.variant(look.color));
  neko.setAccessory(col.variant(look.costume));
  bindRoomHits();
}
const titleLook = () => col.pickLook({ ...equipState(), ...Object.fromEntries(Object.entries(equipState()).map(([k, v]) => [k, v === 'auto' ? 'base' : v])) }, chillTotal(), Math.random);

function bindRoomHits() {
  room.svg.addEventListener('click', (e) => {
    const hit = room.hitAt(e.target);
    if (!hit || S.screen !== 'title' || views.open || coach.active) return;
    if (hit === 'tree') views.openTree();
    else if (hit === 'trophy') views.openTrophies();
    else if (hit === 'collection') views.openCollection();
    else if (hit === 'pillow') views.openPillow();
    else if (hit === 'bonus') views.openBonus();
  });
}

// ---------------------------------------------------------------- settings
function applySettings() {
  const st = settings();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  S.motion = st.motion == null ? (reduce ? 0 : 1) : st.motion;
  body.classList.toggle('still', S.motion === 0);
  room.setMotion(S.motion); neko.setMotion(S.motion);
  audio.setVolume('master', st.volume); audio.setVolume('music', st.music); audio.setVolume('sfx', st.sfx); audio.setVolume('ambient', st.ambientVol);
  audio.setMuted(!st.sound);
  $('#mute').setAttribute('aria-pressed', String(!st.sound));
  if (audio.ctx) audio.setAmbient(st.sound ? ambientKind(st) : 'none'); else audio.wantAmbient = ambientKind(st);
  $('#clock').hidden = !st.clock || S.screen !== 'play';
}

// ---------------------------------------------------------------- screens
function showScreen(name) {
  S.screen = name;
  $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === `screen-${name}`));
  body.classList.remove('screen-title-on', 'screen-play-on', 'screen-result-on');
  body.classList.add(`screen-${name}-on`);
  body.classList.toggle('playing', name === 'play');
  $('#stop').hidden = name !== 'play';
  $('#demo-chip').hidden = !S.demo || name === 'title';
  $('#clock').hidden = !settings().clock || name !== 'play';
  requestAnimationFrame(() => requestAnimationFrame(placeNeko));
  setTimeout(placeNeko, 1300);
}

// チルネコ sits on the notebook's upper-right corner, or on the desk.
function placeNeko() {
  if (coach && coach.active) return;
  const host = $('#neko-host');
  const stage = host.offsetParent ? host.offsetParent.getBoundingClientRect() : $('#app').getBoundingClientRect();
  let anchor = null;
  if (S.screen === 'play') anchor = $('#notebook');
  else if (S.screen === 'title') anchor = $('.cover');
  else anchor = $('.result-card');
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const size = Math.max(84, Math.min(150, r.width * 0.26));
  neko.svg.style.width = `${size}px`;
  // Sits on the top edge: its feet just over the paper. On the title it keeps
  // the place it has before scrolling (on the desk edge), so scrolling the
  // cards does not carry it off the top of the screen (id059).
  const scrolled = S.screen === 'title' ? $('#screen-title').scrollTop : 0;
  S.nekoHome = { x: r.right - size * 0.42 - stage.left, y: r.top + scrolled - stage.top + size * 0.1 };
  host.style.left = `${S.nekoHome.x}px`;
  host.style.top = `${S.nekoHome.y}px`;
  // While playing, stay over the column being written.
  if (S.screen === 'play' && S.problem && S.ready) followStep();
}
addEventListener('resize', () => { placeNeko(); if (S.problem && S.screen === 'play') notebook.fit(S.problem); });
// Layout settles late (web fonts, cards filled in): follow it, not just resizes.
if (globalThis.ResizeObserver) { const ro = new ResizeObserver(() => placeNeko()); ['#app', '.cover', '#notebook', '.result-card', '.title-cards'].forEach((q) => { const el = document.querySelector(q); if (el) ro.observe(el); }); }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeNeko());

// ---------------------------------------------------------------- title
function refreshTitle() {
  const prog = progress();
  $('#level-sub').textContent = prog.placed ? 'きょうも マイペースで' : 'はじめは じつりょくチェック';
  const n = prog.review.length;
  $('#start-review').hidden = n === 0;
  $('#review-count').textContent = String(Math.min(n, 99));
  const unlocked = SKILLS.filter((x) => isUnlocked(prog, x.id)).length;
  $('#tree-badge').textContent = `${SKILLS.filter((x) => stateOf(prog, x.id) === 'mastered').length}/${SKILLS.length}`;
  $('#trophy-badge').textContent = `${tr.earnedCount(trophyState())}/${tr.TROPHIES.length}`;
  $('#collect-badge').textContent = `${col.ITEMS.filter((it) => col.isUnlocked(it, chillTotal())).length}/${col.ITEMS.length}`;
  void unlocked;
  views.renderQuests($('#quest-list'), $('#quest-reward'));
  views.renderCalendar();
  room.showSticker(store.bonusState().last !== today());
  room.showPillow(!!store.pillowOffer());
}

function toTitle() {
  S.run += 1;
  S.demo = false;
  $('#demo-chip').hidden = true;
  audio.stop(1.2);
  S.session = null; S.okawari = null; S.problem = null; S.ready = false; S.joinMusic = null;
  renderRack();
  notebook.clear();
  neko.reach(null); neko.setFace('idle'); neko.melt(0); neko.stretch(false); neko.setProp('pencil');
  applyLook(titleLook());
  room.setTime(store.load().lastTime ?? 0.35);
  showScreen('title');
  refreshTitle();
  checkTrophies();
}

// ---------------------------------------------------------------- planning
function makePlan(kind, arg) {
  const prog = progress();
  const rng = S.rng;
  if (kind === 'grade') { const gp = gradePlan(arg, 1, rng); return { mode: 'grade', grade: arg, next: () => gradePick(arg, S.dial, rng), extra: gp.extra }; }
  if (kind === 'demo') {
    // Demo play (id035, after Dopa Drill 3.5): easy first, one grade up every
    // three problems, from the easier part of each grade.
    let i = 0;
    const pick = () => { const list = gradeLadder(Math.min(6, 1 + Math.floor(i++ / 3))); return list[Math.floor(rng() * Math.max(1, list.length * 0.6))]; };
    return { mode: 'demo', next: pick, extra: pick };
  }
  if (kind === 'review') { const items = prog.review.slice(-10); return { mode: 'review', items, i: 0, next() { const it = this.items[this.i++]; return it; } }; }
  if (kind === 'practice') return { mode: 'practice', skill: arg, next: () => arg, extra: () => { const kids = SKILLS.filter((x) => x.req.includes(arg) && isUnlocked(prog, x.id)); return kids.length ? kids[Math.floor(rng() * kids.length)].id : arg; } };
  if (!prog.placed) { const pp = placementPlan(prog, 1); return { mode: 'level', placement: true, pp, next: () => pp.pick(), extra: pp.extra }; }
  const lp = levelPlan(prog, 1, rng);
  return { mode: 'level', next: () => levelPick(prog, S.dial, rng), extra: lp.extra };
}

function sessionProblem(skill) {
  const prog = progress();
  const r = prog.skills[skill];
  const recent = new Set([...(r ? r.recent : []), ...S.sessionSigs]);
  const p = makeProblem(skill, S.rng, recent);
  S.sessionSigs.add(signature(p));
  return p;
}

// ---------------------------------------------------------------- start
function startGame(kind = 'level', arg) {
  if (views.open) views.close();
  audio.unlock();
  const st = settings();
  S.run += 1;
  S.rng = makeRng(Number(params.get('seed') || Math.floor(Math.random() * 1e9)));
  S.kind = kind; S.kindArg = arg;
  S.demo = kind === 'demo';
  if (S.demo) S.demoAt = performance.now();
  S.plan = makePlan(kind, arg);
  S.mode = 'basic';
  S.sessionSigs = new Set();
  S.dial = createDial(); S.pace = new PaceMeter();
  // A retry from the midway page comes straight from a run that may have
  // stopped mid-problem or mid-pause: clear that, or the frame loop never
  // serves the first problem after the intro.
  Object.assign(S, { problem: null, ready: false, shownWrong: null, pausedAt: null, pausedTotal: 0 });
  Object.assign(S, { chill: 0, chillBy: {}, paceRun: 0, chillSeen: chillTotal(), notes: [], sessionTimes: {}, newUnlocks: [], newMastered: [], newStars: {}, polished: [], wrongList: [], restMs: 0, rested: false, okawari: null, problemCount: 0, joinMusic: null });
  renderRack();
  S.look = col.pickLook(equipState(), chillTotal(), S.rng);
  applyLook(S.look);
  room.setTime(0); room.setLeaves(0);
  // One song, stretched or shortened to the chosen length (id060): the
  // arranger repeats its sections up to targetSec, so it lands near it.
  S.minutes = S.demo ? 2 : clamp(Math.round(st.minutes || 3), 1, 10);
  S.playlist = playlist(1, col.variant(S.look.music)).map((p) => ({ ...p, song: params.get('songsec') ? p.song : { ...p.song, targetSec: S.minutes * 60 } }));
  const introOn = st.intro !== false && kind !== 'review';
  if (kind === 'review') S.session = new ListSession({ count: S.plan.items.length });
  else S.session = new DrillSession({ lengthMs: sessionSeconds(S.playlist) * 1000, introMs: introOn ? introSeconds(S.playlist[0].song) * 1000 : 0 });
  S.timeline = [];
  S.capsule = kind === 'review' ? null : planCapsule(kind === 'grade' ? arg : null);
  notebook.clear();
  neko.setFace('idle'); neko.setProp('pencil');
  $('#chill-chip').textContent = '0チル';
  // The day's first play brings a small gift of チル.
  if (recording() && !store.load().history.some((h) => h.day === today())) addChill(CHILL.dayFirst, 'day');
  showScreen('play');
  updateTape(0);
  const music = (offset = 0) => {
    audio.play(kind === 'review' ? S.playlist.map((p) => ({ ...p })) : S.playlist, { startEnergy: 0, endless: kind === 'review', offset });
    audio.setAmbient(ambientKind(st));
  };
  const go = (withMusic) => {
    if (withMusic) music();
    S.clockStart = performance.now();
    S.session.start(clockNow());
    S.lastClock = clockNow();
    if (S.session.phase === 'intro') beginIntro(); else nextProblem();
  };
  const session = S.session;
  if (st.sound && S.session.introMs) {
    // The breath starts at once; the sound gets ready behind it and joins
    // where the breath has got to (id050). No "getting ready" label.
    go(false);
    audio.prewarm(S.playlist[0].song, { done: () => { if (S.session !== session || S.screen !== 'play' || S.mode !== 'basic') return; const join = () => music(clockNow() / 1000); if (S.pausedAt != null) S.joinMusic = join; else join(); } });
  } else if (st.sound) { notebook.label('おとを じゅんびちゅう…'); audio.prewarm(S.playlist[0].song, { done: () => { notebook.label(''); go(true); } }); } else go(false);
}

// Music time when the music plays (pauses included), else wall time.
function clockNow() {
  if (settings().sound && audio.ctx && audio.playing) return audio.songTime * 1000;
  if (S.pausedAt != null) return S.pausedAt - S.clockStart - (S.pausedTotal || 0);
  return performance.now() - S.clockStart - (S.pausedTotal || 0);
}

function beginIntro() {
  $('#breath-guide').hidden = false;
  notebook.label('');
  neko.setFace('content');
  neko.reach(null);
  if (S.motion) { neko.stretch(true); setTimeout(() => neko.stretch(false), 2600); }
  audio.breath(2.6, true);
  setTimeout(() => { if (S.session && S.session.phase === 'intro') audio.breath(3, false); }, 2800);
}
// One slow breath across the intro: in for the first half, out for the rest.
// The orb, the room's light and the desk lamp swell and settle with it, and
// the orb counts the seconds until the first problem.
function updateBreath(now) {
  const s = S.session; if (!s || !s.introMs) return;
  const k = Math.min(1, Math.max(0, s.elapsed(now) / s.introMs));
  const b = S.motion ? Math.sin(Math.PI * k) ** 1.4 : 0.5;
  $('#breath-guide i').style.setProperty('--b', b.toFixed(3));
  $('#breath-glow').style.opacity = (b * (S.motion ? 0.9 : 0.4)).toFixed(3);
  room.setFlow(b);
  const left = Math.max(1, Math.ceil((s.introMs - s.elapsed(now)) / 1000));
  if ($('#breath-count').textContent !== String(left)) $('#breath-count').textContent = String(left);
  const cue = k < 0.47 ? 'すって…' : 'はいて…';
  if ($('#breath-cue').textContent !== cue) $('#breath-cue').textContent = cue;
}
function endIntro() {
  $('#breath-glow').style.opacity = '0';
  $('#breath-guide').hidden = true;
  neko.stretch(false);
}

// ---------------------------------------------------------------- problems
function planCapsule(grade = null) {
  if (!recording()) return null;
  const st = store.load();
  if ((st.capsule || {}).lastDay === today()) return null;
  return pickCapsule(progress(), Date.now(), grade);
}

function nextProblem() {
  if (!S.session || S.screen !== 'play') return;
  const now = clockNow();
  const okw = S.mode === 'okawari';
  if (!okw && !S.session.open(now)) { if (S.session.tick(now) === 'done') finishBasic(); return; }
  if (okw && okawariElapsed(now) >= S.okawari.lengthMs) { endCassette(); return; }
  S.run += 1;
  let p;
  if (okw) p = sessionProblem(params.get('skill') || S.plan.extra(S.okawari.k));
  else if (S.plan.mode === 'review') { const it = S.plan.next(); p = structuredClone(it.problem); p.reviewSig = it.sig; }
  else if (S.capsule && S.problemCount === 2) {
    const c = S.capsule; S.capsule = null;
    p = structuredClone(c.entry.p); p.capsule = c;
    const st = store.load(); st.capsule = { ...(st.capsule || {}), lastDay: today() }; store.save();
  } else p = sessionProblem(params.get('skill') || S.plan.next());
  S.problemCount += 1;
  S.problem = p;
  S.step = 0; S.wrongInQ = false; S.stepMisses = 0; S.qMisses = 0;
  notebook.show(p, { capsule: !!p.capsule });
  if (p.capsule) { notebook.label(`<b>むかしの ノート</b>　${fmtDay(p.capsule.entry.d)}に といた もんだい`); }
  S.pace.pauseRhythm();
  S.ready = true;
  S.qStart = performance.now();
  activate(0);
  neko.setFace('focus');
  audio.page();
}

const fmtDay = (key) => { if (!key) return ''; const [, m, d] = key.split('-').map(Number); return `${m}月${d}日`; };

function activate(k) {
  const p = S.problem;
  const st = p.steps[k];
  if (!st) return;
  notebook.activate(st.cell);
  notebook.marks(st.marks);
  notebook.hintGlow([]);
  S.stepMisses = 0;
  if (!p.capsule || k > 0) notebook.label(`<b>${st.label}</b>${st.hint ? `　${st.hint}` : ''}`);
  followStep();
}

// チルネコ slides along the top edge toward the column it will write in.
function followStep() {
  const p = S.problem; if (!p) return;
  const st = p.steps[Math.min(S.step, p.steps.length - 1)];
  const r = notebook.cellRect(st.cell);
  if (r) {
    const host = $('#neko-host');
    const stage = host.offsetParent ? host.offsetParent.getBoundingClientRect() : $('#app').getBoundingClientRect();
    const nb = $('#notebook').getBoundingClientRect();
    const size = neko.svg.getBoundingClientRect().width || 100;
    // The pencil is in the right paw: sit a little to the left of the cell.
    const x = clamp(r.left + r.width / 2 - size * 0.22 - stage.left, nb.left - stage.left + size * 0.3, nb.right - stage.left - size * 0.3);
    $('#neko-host').style.left = `${x}px`;
    neko.look((r.left - (x + stage.left)) / 12, 10);
  }
}

// ---------------------------------------------------------------- input
const padButtons = Object.fromEntries($$('#pad button').map((b) => [b.dataset.key, b]));
function pressVisual(btn) { if (!btn) return; btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 90); }

function press(key) {
  if (S.screen !== 'play' || views.open) return;
  pressVisual(padButtons[key]);
  if (S.session && S.session.phase === 'intro' && key !== 'Backspace') {
    S.session.skipIntro(clockNow());
    endIntro();
    nextProblem();
    return;
  }
  if (key === 'Backspace') { erase(); return; }
  if (!S.ready || !S.problem) return;
  const p = S.problem;
  const st = p.steps[S.step];
  if (!st) return;
  notebook.hurry();
  const place = p.steps.length - 1 - S.step;
  audio.key(key, Math.min(3, Math.max(0, place % 4)));
  if (key === st.digit) correct(st, key);
  else wrong(st, key);
}

function correct(st, key) {
  const p = S.problem;
  S.step += 1;
  const last = S.step >= p.steps.length;
  notebook.write(st.cell, key);
  audio.write(2);
  S.shownWrong = null;
  S.pace.cell(performance.now(), SKILL[p.skill] ? SKILL[p.skill].grade : 3);
  addChill(CHILL.cell, 'cell');
  addChill(cellChill(S.pace.flow) - CHILL.cell, 'calm'); // the calm rhythm doubles it
  neko.nod();
  notebook.reveal(st.after || []);
  if (last) { S.ready = false; S.qMs = performance.now() - S.qStart; finishProblem_(); return; }
  // A small check when a row of the column calculation is finished.
  const next = p.steps[S.step];
  const rowOf = (id) => { const c = p.cells.find((x) => x.id === id); return c ? c.r : 0; };
  if (p.kind !== 'h' && rowOf(next.cell) !== rowOf(st.cell)) { notebook.check(st.cell); audio.check(); neko.slowBlink(); }
  activate(S.step);
}

function wrong(st, key) {
  S.wrongInQ = true;
  S.stepMisses += 1; S.qMisses += 1;
  if (S.mode === 'okawari') S.okawari.misses += 1; else S.session.miss();
  const h = notebook.write(st.cell, key, { cls: 'ink' });
  audio.write(2);
  S.shownWrong = key;
  const run = S.run;
  setTimeout(() => {
    if (run !== S.run) return;
    audio.wrong();
    neko.setFace('tilt'); neko.tilt(9, 1100); neko.earsDown(true);
    setTimeout(() => { neko.earsDown(false); if (S.screen === 'play') neko.setFace('focus'); }, 1200);
    // Rub it out with the eraser end (never a red cross).
    const r = notebook.cellRect(st.cell);
    if (r && S.motion) neko.reach({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, { end: 'eraser' });
    audio.erase();
    notebook.erase(st.cell).then(() => { if (run === S.run) { S.shownWrong = null; neko.reach(null); } });
    giveHelp(st);
  }, (h ? 220 : 0));
}

function erase() {
  if (!S.shownWrong || !S.problem) return;
  const st = S.problem.steps[S.step];
  audio.rub();
  notebook.erase(st.cell, { passes: 1 });
  S.shownWrong = null;
}

// Repeated slips on one digit: look here, then a hint (never the answer).
function giveHelp(st) {
  if (!st.help) return;
  if (S.stepMisses >= 2) {
    notebook.hintGlow(st.help.ids);
    const first = st.help.ids.map((id) => notebook.cellRect(id)).find(Boolean);
    if (first) neko.look((first.left - neko.svg.getBoundingClientRect().left) / 10, 8);
  }
  if (S.stepMisses >= 3) notebook.label(`<b>${st.label}</b><span class="help-text">ヒント　${st.help.text}</span>`);
}

// ---------------------------------------------------------------- a finished problem
function finishProblem_() {
  const p = S.problem;
  const firstTry = !S.wrongInQ;
  const okw = S.mode === 'okawari';
  const paceGood = S.pace.good;
  notebook.activate(null);
  notebook.label(`<b>${p.answerText}</b>`);
  setTimeout(() => notebook.maru(p), 120);
  audio.maru(S.problemCount);
  setTimeout(() => audio.stamp(), 520);
  neko.setFace('happy'); neko.tailFlick();
  setTimeout(() => { if (S.screen === 'play') neko.setFace('focus'); }, 1100);
  if (room.step(1) === 'bloom' && S.motion) {
    // The plant flowered: Chill-Neko carries a new pot over (the pot itself
    // appears on the desk a moment later, see .plantpot.new).
    setTimeout(() => { if (S.screen !== 'play') return; neko.setProp('pot'); neko.reach(null); }, 700);
    setTimeout(() => { if (S.screen === 'play') neko.setProp('pencil'); }, 1900);
  }
  if (S.timeline) S.timeline.push({ t: room.t, leaves: room.leaves, ok: firstTry, q: p.answerText });
  noteProblem(p, firstTry, paceGood);
  if (okw) {
    finishProblem(S.okawari, firstTry);
  } else {
    S.session.solve(clockNow(), { firstTry });
    noteAnswer(S.dial, firstTry);
  }
  if (p.capsule) capsuleDone(p);
  const run = S.run;
  const wait = 900 + (p.capsule ? 1600 : 0);
  setTimeout(() => {
    if (run !== S.run || S.screen !== 'play') return;
    if (!okw && S.session.done) { finishBasic(); return; }
    if (maybeRest()) return;
    nextProblem();
  }, wait);
}

function noteProblem(p, firstTry, paceGood) {
  const prog = progress();
  const okw = S.mode === 'okawari';
  if (!firstTry && S.plan.mode !== 'review') {
    S.wrongList.push(p);
    const sig = signature(p);
    if (!prog.review.some((it) => it.sig === sig) && !p.capsule) prog.review.push({ sig, skill: p.skill || null, problem: JSON.parse(JSON.stringify(p)), at: Date.now() });
    if (prog.review.length > 40) prog.review.splice(0, prog.review.length - 40);
  }
  if (S.plan.mode === 'review') {
    const sig = p.reviewSig || signature(p);
    if (firstTry) prog.review = prog.review.filter((it) => it.sig !== sig); else S.wrongList.push(p);
  }
  if (S.plan.placement && !okw) S.plan.pp.answer(firstTry);
  // チル gifts: a first-try answer; every fifth problem in a row at one's own pace.
  if (firstTry) addChill(CHILL.firstTry, 'first');
  S.paceRun = paceGood ? (S.paceRun || 0) + 1 : 0;
  if (S.paceRun && S.paceRun % CHILL.runEvery === 0) addChill(CHILL.runGift, 'run');
  const timing = { at: Date.now(), day: today(), ms: S.qMs, cells: p.steps.length, misses: S.qMisses || 0, problem: JSON.parse(JSON.stringify(p)) };
  delete timing.problem.capsule;
  if (recording()) {
    questNote({ type: 'solve', firstTry, review: S.plan.mode === 'review', okawari: okw, skill: p.skill, skillState: p.skill && SKILL[p.skill] ? stateOf(prog, p.skill) : null, pace: paceGood });
    growth.noteSolve(stats(), { cells: timing.cells, firstTry, misses: timing.misses, review: S.plan.mode === 'review', okawari: okw, okawariSolved: okw ? S.okawari.k + 1 : 0, pace: paceGood });
    if (p.skill && !okw) { const e = S.sessionTimes[p.skill] || (S.sessionTimes[p.skill] = { n: 0, ms: 0, c: 0, f: 0 }); e.n += 1; e.ms += timing.ms; e.c += timing.cells; e.f += firstTry ? 1 : 0; }
  }
  if (p.skill && !S.demo && !params.has('skill') && (!params.has('auto') || params.has('rec'))) {
    const res = recordResult(prog, p.skill, firstTry, signature(p), recording() ? timing : {});
    if (res.mastered) { S.newMastered.push(p.skill); quietNote('mastered', `「${SKILL[p.skill].name}」を マスター`); }
    if (res.stars >= 2) S.newStars[p.skill] = res.stars;
    if (res.polished && recording()) { S.polished.push(p.skill); const st = stats(); st.polished = (st.polished || 0) + 1; }
    for (const id of res.unlocked) { S.newUnlocks.push(id); quietNote('unlock', `「${SKILL[id].name}」が めを だした`); }
  }
  store.save();
}

function capsuleDone(p) {
  const c = p.capsule;
  if (!recording()) return;
  useCapsule(progress(), c.skill, c.index);
  const cmp = growth.capsuleCompare(c.entry, S.qMs, S.qMisses);
  const st = stats();
  st.capsules = (st.capsules || 0) + 1;
  if (cmp.what === 'time') st.capsuleFaster = (st.capsuleFaster || 0) + 1;
  const msg = cmp.what === 'time' ? `むかしの ノート：${fmtDay(c.entry.d)}より ${(cmp.from / 1000 - cmp.to / 1000).toFixed(1)}びょう はやく とけた`
    : cmp.what === 'miss' ? `むかしの ノート：${fmtDay(c.entry.d)}より おしいが へった` : `むかしの ノート：${fmtDay(c.entry.d)}の もんだいを また といた`;
  notebook.label(`<b>${msg}</b>`);
  S.notes.push({ kind: 'capsule', text: msg });
  store.save();
}

// ---------------------------------------------------------------- チル (id057)
// Every gain goes to the session's tally (by kind, for the result page) and,
// when recording, straight into the lifetime total and the quests.
function addChill(n, kind) {
  if (!n) return;
  S.chill += n;
  S.chillBy[kind] = (S.chillBy[kind] || 0) + n;
  const chip = $('#chill-chip');
  if (chip) chip.textContent = `${S.chill}チル`;
  if (!recording()) return;
  growth.noteChill(stats(), n);
  questNote({ type: 'chill', n });
}
// Collection items that arrived during this play, as quiet notes.
function noteArrivals() {
  const now = chillTotal();
  for (const it of col.arrived(S.chillSeen ?? now, now)) S.notes.push({ kind: 'item', text: `コレクション「${it.name}」が とどいた` });
  S.chillSeen = now;
}

// ---------------------------------------------------------------- quiet notifications (plan.md 8.4)
function quietNote(kind, text) {
  S.notes.push({ kind, text });
  if (S.screen === 'play') { notebook.sticker(kind === 'quest' ? 'star' : 'star'); audio.notify(); }
}
const quests = () => { const st = store.load(); if (!st.quests) st.quests = {}; if (qs.ensureDay(st.quests, today(), views.questCtx())) store.save(); return st.quests; };
function questNote(ev) {
  if (!recording()) return;
  const q = quests();
  const done = qs.questEvent(q, ev);
  for (const d of done) quietNote('quest', `クエスト「${qs.questText(d)}」`);
  if (done.length && qs.claimReward(q)) { const add = store.addPillow(1); S.notes.push({ kind: 'quest', text: add ? 'クエスト コンプリート：おやすみまくらを 1こ もらった' : 'クエスト コンプリート' }); }
  if (done.length) store.save();
}

function checkTrophies() {
  const fresh = tr.evaluate(trophyState(), trophyMetrics());
  store.save();
  return fresh;
}
function trophyMetrics() {
  const st = store.load();
  const b = store.bonusState();
  const got = chillTotal();
  const owned = col.ITEMS.filter((it) => col.isUnlocked(it, got));
  const extra = {
    questDays: Object.keys((st.quests || {}).doneDays || {}).length,
    questRun: questRun(),
    pillowUsed: store.items().used || 0,
    itemsOwned: owned.length,
    catComplete: col.CATS.filter((c) => col.ITEMS.filter((it) => it.cat === c.key).every((it) => col.isUnlocked(it, got))).length,
  };
  return tr.trophyMetrics({ stats: stats(), prog: progress(), bestStreak: store.bestStreak(), stickers: b.total || 0, crowns: Object.values(b.stickers || {}).filter((t) => t === 'fullmoon').length, extra });
}
function questRun() {
  const days = (store.load().quests || {}).doneDays || {};
  let n = 0; let d = new Date();
  if (!days[store.dayKey(d)]) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  while (days[store.dayKey(d)]) { n += 1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); }
  return n;
}

// ---------------------------------------------------------------- rest (plan.md 7.4)
function maybeRest() {
  const lim = (settings().restMin || 25) * 60000;
  if (!lim || S.restMs < lim) return false;
  S.restMs = 0;
  neko.setProp('none'); neko.stretch(true); neko.setFace('yawn');
  audio.chime();
  setTimeout(() => { neko.stretch(false); neko.setFace('content'); }, 2200);
  views.openRest({
    onRest: () => { pauseAll(); S.rested = true; addChill(CHILL.rest, 'rest'); if (recording()) { growth.noteRest(stats()); store.save(); } },
    onDone: () => { resumeAll(); neko.setProp('pencil'); nextProblem(); },
  });
  return true;
}

function pauseAll() {
  if (S.pausedAt != null) return;
  S.pausedAt = performance.now();
  audio.pause();
  if (S.session) S.session.pause(clockNow());
}
function resumeAll() {
  if (S.pausedAt == null) return;
  S.pausedTotal = (S.pausedTotal || 0) + (performance.now() - S.pausedAt);
  S.pausedAt = null;
  audio.resume();
  if (S.session) S.session.resume(clockNow());
  if (S.joinMusic) { const join = S.joinMusic; S.joinMusic = null; join(); } // the sound got ready during a pause
}
document.addEventListener('visibilitychange', () => {
  if (S.screen !== 'play') return;
  if (document.hidden) pauseAll(); else if (!views.isRest) resumeAll();
});

// ---------------------------------------------------------------- basic finished
function finishBasic() {
  if (S.screen !== 'play' || S.mode !== 'basic') return;
  const s = S.session;
  S.ready = false;
  S.run += 1;
  audio.finish();
  endIntro();
  const rate = s.firstRate;
  const timeMs = Math.round(s.endedAt ?? s.elapsed(clockNow()));
  const review = S.plan.mode === 'review';
  const ok = s.okawariOk && !review;
  S.basicTape = { n: s.completed, first: s.firstTry };
  S.basicMs = timeMs;
  if (S.plan.placement && recording()) { progress().placed = true; }
  store.load().lastTime = 0.85;
  if (recording()) {
    S.record = store.addRecord({ mode: S.plan.mode, grade: S.plan.grade, skill: S.plan.skill, minutes: S.minutes, score: BASIC_SCORE, ok: s.completed, ng: s.misses, firstRate: rate, timeMs, chill: S.chill });
    const d = new Date();
    growth.notePlay(stats(), { mode: S.plan.mode, grade: S.plan.grade, day: today(), timeMs, firstRate: rate, weekday: d.getDay(), hour: d.getHours(), minutes: review ? 0 : S.minutes, completed: s.completed, misses: s.misses });
    if (S.rested) growth.setFlag(stats(), 'rested');
    questNote({ type: 'play', mode: S.plan.mode });
    store.save();
  } else S.record = null;
  views.renderResult({ s, rate, timeMs, okawariOk: ok, review, askMood: recording() && store.moodAskDue(today()) });
  neko.reach(null); neko.setFace('content');
  room.setTime(0.85);
  showScreen('result');
  noteArrivals();
  for (const t of checkTrophies()) S.notes.push({ kind: 'trophy', text: `トロフィー「${t.name}」` });
  views.renderNotes($('#r-notes'), S.notes);
  endExtras();
}

// Stopped with ここまで before the song ended: a short page of what was done
// (not recorded), then back to the room from there (id052).
function finishMidway() {
  if (S.screen !== 'play' || S.mode !== 'basic' || !S.session) { toTitle(); return; }
  const s = S.session;
  S.ready = false;
  S.run += 1;
  audio.finish();
  endIntro();
  $('#breath-guide').hidden = true;
  views.renderResult({ s, rate: s.firstRate, timeMs: Math.round(s.elapsed(clockNow())), okawariOk: false, review: S.plan.mode === 'review', midway: true });
  neko.reach(null); neko.setFace('content');
  showScreen('result');
  views.renderNotes($('#r-notes'), [{ text: 'きょうの きろくには ならないけど、といた もんだいの れんしゅうと チルは のこるよ' }]);
  endExtras();
}

// ---------------------------------------------------------------- okawari (plan.md 7.2)
function startOkawari() {
  S.run += 1;
  const more = S.mode === 'okawari' && S.okawari; // again, from the result page
  S.mode = 'okawari';
  if (more) again(S.okawari); else S.okawari = createOkawari(S.session.lengthMs || 240000, S.basicTape);
  S.notes = [];
  S.ready = false;
  if (recording()) { growth.noteOkawariStart(stats()); questNote({ type: 'okawari' }); store.save(); }
  showScreen('play');
  notebook.clear();
  renderRack(0);
  room.setTime(0.86);
  // The first time ever, チルネコ explains the cassettes before they roll (id049).
  if (!S.demo && !store.load().okawariGuideSeen) { S.okawariWaiting = true; coach.start('okawari'); return; }
  beginOkawari();
}

function beginOkawari() {
  S.okawariWaiting = false;
  if (S.screen !== 'play' || S.mode !== 'okawari') return;
  if (settings().sound) {
    const first = S.playlist[0].song;
    audio.play([{ song: first, bside: true }, ...S.playlist.slice(1).map((p) => ({ song: p.song, bside: true }))], { startEnergy: 1, endless: true, skipIntro: true });
  }
  S.clockStart = performance.now(); S.pausedTotal = 0;
  S.okawari.tapeAt = clockNow();
  nextProblem();
}

// Add the cassette that just stopped to the time spent in okawari.
function countPlayed() {
  const o = S.okawari;
  if (!o || o.tapeAt == null) return;
  o.playedMs = (o.playedMs || 0) + Math.min(okawariElapsed(), o.lengthMs);
  o.tapeAt = null;
}
const okawariElapsed = (now = clockNow()) => (S.okawari && S.okawari.tapeAt != null ? now - S.okawari.tapeAt : 0);

// A cassette has played out: roll the next one, or end okawari.
function endCassette() {
  const o = S.okawari;
  countPlayed();
  if (endTape(o) === 'done') { renderRack(1); finishOkawari(); return; }
  o.tapeAt = clockNow();
  renderRack(0);
  audio.lantern(1);
  notebook.clear();
  notebook.label(`<b>${tapeOrdinal(o.tapes.length)}の カセット</b>`);
  const run = S.run;
  setTimeout(() => { if (run === S.run && S.screen === 'play') nextProblem(); }, 1400);
}

// The cassette rack (id048): the basic cassette, the okawari ones in their own
// colours, and dashed slots up to five. Finished cassettes show how many
// problems were solved on them; the rolling one shows only its progress.
const TAPE_SVG = (i) => `<svg viewBox="0 0 120 50" aria-hidden="true"><rect x="2" y="4" width="116" height="42" rx="7" class="tape-body"/><rect x="14" y="37" width="92" height="5" rx="2.5" class="tape-track"/><rect x="14" y="37" width="0" height="5" rx="2.5" class="tape-fill"/><rect x="18" y="13" width="84" height="20" rx="10" class="tape-window"/><g class="reel"><circle cx="38" cy="23" r="7"/><path d="M38 16 L38 30 M31 23 L45 23"/></g><g class="reel"><circle cx="82" cy="23" r="7"/><path d="M82 16 L82 30 M75 23 L89 23"/></g><circle cx="38" cy="23" r="9" class="spool"/><circle cx="82" cy="23" r="9" class="spool"/><text x="60" y="27" class="tape-no">${i + 1}</text></svg>`;
function renderRack(p = 0) {
  const el = $('#tape-rack');
  const o = S.okawari;
  if (!o) { el.hidden = true; document.body.classList.remove('okawari-on'); return; }
  el.hidden = false;
  document.body.classList.add('okawari-on');
  const max = 5;
  if (el.children.length !== max) el.innerHTML = Array.from({ length: max }, (_, i) => `<div class="rack-tape c${i}">${TAPE_SVG(i)}<span class="rack-n"></span></div>`).join('');
  const shown = rackTapes(o); // the basic cassette and this go's ones
  const first = o.runStart;
  [...el.children].forEach((d, i) => {
    const t = shown[i];
    const no = i === 0 ? 0 : first + i - 1; // its number among all of today's cassettes
    const rolling = t && !t.done;
    d.className = `rack-tape c${no % 5}`;
    d.querySelector('.tape-no').textContent = String(no + 1);
    d.classList.toggle('empty', !t);
    d.classList.toggle('rolling', !!rolling);
    d.classList.toggle('done', !!(t && t.done));
    const q = (i === shown.length - 1 && rolling) ? p : t ? 1 : 0;
    d.querySelector('.tape-fill').setAttribute('width', (92 * Math.min(1, q)).toFixed(1));
    d.querySelectorAll('.spool').forEach((c, k) => c.setAttribute('r', (k ? 5 + 4 * q : 9 - 4 * q).toFixed(2)));
    d.querySelector('.rack-n').textContent = t && t.done ? `${t.n}もん` : '';
  });
  el.setAttribute('aria-label', `カセット ${shown.length}ほんめ（さいだい ${max}ほん）`);
}
function spinRack() {
  const d = $('#tape-rack .rack-tape.rolling');
  if (!d) return;
  const a = (performance.now() / 1000) * 40 * (audio.playing ? 1 : 0) * S.motion;
  d.querySelectorAll('.reel').forEach((g, k) => g.setAttribute('transform', `rotate(${a} ${k ? 82 : 38} 23)`));
}

function finishOkawari(byUser = false) {
  S.run += 1;
  S.ready = false;
  const o = S.okawari;
  countPlayed();
  const t = currentTape(o);
  if (!t.done && t.n) t.done = true; // stopped mid-cassette: what was solved still counts
  if (!t.done) o.tapes.pop();
  audio.finish();
  if (S.record && recording()) store.updateRecord(S.record.id, { score: BASIC_SCORE + o.score, okawariOk: o.k, okawariNg: o.misses, chill: S.chill });
  if (recording() && o.k >= 5 && o.misses === 0) growth.setFlag(stats(), 'okawariClean');
  store.save();
  // The same result page as the basic one, with okawari's points and cassettes
  // (id056); the window has reached the morning and チルネコ stretches.
  room.setTime(1);
  store.load().lastTime = 1;
  store.save();
  neko.reach(null); neko.setProp('none'); neko.stretch(true); neko.setFace('yawn');
  setTimeout(() => { neko.stretch(false); neko.setFace('content'); }, 2400);
  const s = S.session;
  views.renderResult({ s, rate: s.firstRate, timeMs: (S.basicMs || 0) + Math.round(okawariElapsedTotal()), okawariOk: true, review: false, askMood: recording() && store.moodAskDue(today()), okawari: o });
  showScreen('result');
  noteArrivals();
  for (const tr of checkTrophies()) S.notes.push({ kind: 'trophy', text: `トロフィー「${tr.name}」` });
  views.renderNotes($('#r-notes'), S.notes);
  endExtras();
}
// Time spent in okawari so far (the finished cassettes plus the last one).
function okawariElapsedTotal() {
  const o = S.okawari;
  return o ? o.playedMs || 0 : 0;
}

// The timelapse of the room (experiment, plan.md 10.1).
function endExtras() {
  views.timelapse(S.timeline || [], S.look);
}

// ---------------------------------------------------------------- stop (ここまで)
function askStop() {
  if (S.screen !== 'play') return;
  if (S.mode === 'okawari') { finishOkawari(true); return; }
  pauseAll();
  views.confirm({
    title: 'ここまでに する？',
    msg: 'まだ きょくの とちゅうだよ。ここで おわると きょうの きろくには ならないけど、といた もんだいの れんしゅうは のこるよ。',
    yes: 'ここまでに する', no: 'つづける',
    onYes: () => { resumeAll(); finishMidway(); },
    onNo: () => resumeAll(),
  });
}

// ---------------------------------------------------------------- frame loop
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const beat = audio.playing && audio.playlist ? (audio.songTime * audio.playlist[audio.pi].song.bpm) / 60 : null;
  // Draw the room and チルネコ at 30 fps (4 fps when motion is off): the
  // scene is slow by design and may stay open for a long time.
  S.visualDt = (S.visualDt || 0) + dt;
  const writing = !!notebook.penPoint();
  if (S.visualDt >= (S.motion === 0 ? 0.25 : writing ? 0.016 : 1 / 30)) {
    neko.update(S.visualDt, beat);
    room.update(S.visualDt);
    S.visualDt = 0;
  }
  if (S.screen === 'play' && S.session) {
    const now = clockNow();
    if (S.pausedAt == null) {
      S.restMs += (now - (S.lastClock || now));
      // The pen follows the digit being written.
      const pen = notebook.penPoint();
      if (pen && S.motion) neko.reach(pen); else if (!S.shownWrong && S.ready) neko.reach(null);
      if (S.mode === 'basic') {
        const phase = S.session.tick(now);
        if (phase === 'intro') updateBreath(now); else if (!$('#breath-guide').hidden) endIntro();
        const p = S.session.progress(now);
        room.setTime(Math.min(0.85, p * 0.85));
        audio.setEnergy(Math.min(1, p / 0.7));
        if ((S.tapeTick = (S.tapeTick || 0) + dt) > 0.25) { S.tapeTick = 0; updateTape(p); }
        if (phase === 'done' && !S.problem) finishBasic();
        if (phase === 'done' && S.ready === false && S.problem && S.session.current == null && !S.finishing) { /* finishing via finishProblem_ */ }
        if (phase === 'run' && !S.problem && !S.session.current) nextProblem();
      } else if (S.mode === 'okawari' && S.okawari && S.okawari.tapeAt != null) {
        const o = S.okawari;
        const p = Math.min(1, okawariElapsed(now) / o.lengthMs);
        const done = rackTapes(o).length - 2 + p; // okawari cassettes played in this go
        room.setTime(Math.min(1, 0.86 + 0.14 * (done / 4)));
        if ((S.tapeTick = (S.tapeTick || 0) + dt) > 0.25) { S.tapeTick = 0; renderRack(p); }
        spinRack();
      }
      S.pace.step(dt);
      audio.setFlow(S.pace.flow);
      if (!(S.session && S.session.phase === 'intro')) room.setFlow(S.pace.flow); // the intro's breath drives the lamp
      if (settings().clock) $('#clock').textContent = S.mode === 'basic' && S.session.lengthMs ? `${fmtTime(Math.min(S.session.elapsed(now), S.session.lengthMs))} / ${fmtTime(S.session.lengthMs)}` : S.mode === 'okawari' && S.okawari ? `${fmtTime(Math.min(okawariElapsed(now), S.okawari.lengthMs))} / ${fmtTime(S.okawari.lengthMs)}` : fmtTime(S.session.elapsed(now));
    }
    S.lastClock = now;
  }
  requestAnimationFrame(frame);
}
const fmtTime = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function updateTape(p) {
  // The left reel unwinds, the right one fills (the only progress shown).
  const l = 9 - 4 * p; const r = 5 + 4 * p;
  $('#spool-l').setAttribute('r', l.toFixed(2)); $('#spool-r').setAttribute('r', r.toFixed(2));
  // The label strip fills as the songs play (id037): how far, and how much is left.
  $('#tape-fill').setAttribute('width', (92 * Math.min(1, p)).toFixed(1));
  $('#tape').setAttribute('aria-valuenow', String(Math.round(p * 100)));
  const a = (performance.now() / 1000) * 40 * (audio.playing ? 1 : 0) * S.motion;
  $('#reel-l').setAttribute('transform', `rotate(${a} 38 23)`); $('#reel-r').setAttribute('transform', `rotate(${a} 82 23)`);
}

// ---------------------------------------------------------------- wiring
// ---------------------------------------------------------------- チルネコ on the title (id063)
// Its eyes follow the mouse; a tap is looked at for a moment; touching it
// brings one of a few small reactions, never the same twice in a row.
const titleNekoFree = () => S.screen === 'title' && !coach.active && !views.open && !S.demo;
function nekoLookAt(px, py) {
  const r = neko.svg.getBoundingClientRect();
  const dx = px - (r.left + r.width * 0.5); const dy = py - (r.top + r.height * 0.4);
  const d = Math.hypot(dx, dy) || 1; const k = Math.min(1, d / 160);
  // Upward glances stay small: the iris would slip under the sleepy lid.
  neko.look((14 * k * dx) / d, Math.max(-3, (11 * k * dy) / d));
}
const REACTIONS = [
  { ms: 1200, go: () => neko.slowBlink() },
  { ms: 900, go: () => { neko.nod(); neko.tailFlick(); } },
  { ms: 1500, go: () => { neko.setFace('happy'); neko.tailFlick(); } },
  { ms: 1300, go: () => { neko.setFace('wide'); neko.earsDown(false); } },
  { ms: 1500, go: () => { neko.setFace('tilt'); neko.tilt(10, 1300); } },
  { ms: 2000, go: () => { neko.setFace('content'); neko.stretch(true); setTimeout(() => neko.stretch(false), 1600); } },
  { ms: 1800, go: () => { neko.setFace('sleepy'); setTimeout(() => { if (S.screen === 'title') neko.setFace('yawn'); }, 700); } },
  { ms: 900, go: () => { neko.earsDown(true); setTimeout(() => neko.earsDown(false), 350); } },
];
function nekoReact(e) {
  if (!titleNekoFree()) return;
  e.stopPropagation();
  const t = performance.now();
  if (t < (S.reactUntil || 0)) return;
  let i; do { i = Math.floor(Math.random() * REACTIONS.length); } while (i === S.lastReact && REACTIONS.length > 1);
  S.lastReact = i;
  const r = REACTIONS[i];
  S.reactUntil = t + r.ms;
  if (S.motion) r.go(); else neko.slowBlink();
  clearTimeout(S.reactTimer);
  S.reactTimer = setTimeout(() => { if (S.screen === 'title' && !coach.active) { neko.setFace('idle'); neko.stretch(false); } }, r.ms);
}
function wireTitleNeko() {
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && titleNekoFree() && performance.now() > (S.reactUntil || 0)) nekoLookAt(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('mouseleave', () => { if (titleNekoFree()) neko.look(0, 0); });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !titleNekoFree()) return;
    nekoLookAt(e.clientX, e.clientY);
    clearTimeout(S.lookBack);
    S.lookBack = setTimeout(() => { if (titleNekoFree()) neko.look(0, 0); }, 2500);
  }, { passive: true });
  neko.svg.addEventListener('click', nekoReact);
}

function wire() {
  wireTitleNeko();
  $('#pad').addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); press(b.dataset.key); });
  $('#pad').addEventListener('click', (e) => { if (e.detail === 0) { const b = e.target.closest('button'); if (b) press(b.dataset.key); } });
  addEventListener('keydown', (e) => {
    if (e.isComposing || e.repeat && e.key !== 'Backspace') return;
    if (coach.active) return;
    if (views.open) { if (e.key === 'Escape') views.close(); return; }
    if (/^[0-9]$/.test(e.key) && S.screen === 'play') { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace' && S.screen === 'play') { e.preventDefault(); press('Backspace'); }
    else if (e.key === 'Escape' && S.screen === 'play') askStop();
  });
  $('#start').addEventListener('click', () => startGame('level'));
  $('#start-review').addEventListener('click', () => startGame('review'));
  $$('.grades [data-grade]').forEach((b) => b.addEventListener('click', () => startGame('grade', Number(b.dataset.grade))));
  $('#stop').addEventListener('click', askStop);
  $('#mute').addEventListener('click', () => { audio.unlock(); store.updateSettings({ sound: !settings().sound }); applySettings(); });
  $('#open-settings').addEventListener('click', () => views.openSettings());
  $('#open-guide').addEventListener('click', () => { if (S.screen === 'title' && !views.open) coach.start('help'); });
  $('#open-tree').addEventListener('click', () => views.openTree());
  $('#open-trophy').addEventListener('click', () => views.openTrophies());
  $('#open-collect').addEventListener('click', () => views.openCollection());
  $('#go-okawari').addEventListener('click', startOkawari);
  $('#go-again').addEventListener('click', () => startGame(S.kind, S.kindArg));
  $('#go-review').addEventListener('click', () => startGame('review'));
  // Without okawari the result page closes the session: back to the room (id052).
  $('#go-end').addEventListener('click', () => toTitle());
  $('#e-lapse-play').addEventListener('click', () => views.timelapse(S.timeline || [], S.look));
  $('#quest-list').addEventListener('click', (e) => { const li = e.target.closest('li[data-skill]'); if (li) startGame('practice', li.dataset.skill); });
  $('#cal-prev').addEventListener('click', () => views.moveMonth(-1));
  $('#cal-next').addEventListener('click', () => views.moveMonth(1));
  $('#cal-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-day]'); if (b) views.openDay(b.dataset.day); });
  // The first tap anywhere unlocks audio (browsers require a gesture).
  addEventListener('pointerdown', () => { if (audio.unlock() && settings().sound && audio.wantAmbient !== undefined) { audio.setAmbient(ambientKind()); audio.wantAmbient = undefined; } }, { once: true });
}

function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 180;
  const g = c.getContext('2d'); const img = g.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

// ---------------------------------------------------------------- demo play (id035)
// Settings > "じどうで プレイを みる": the normal game, played by itself for one
// song, with a few slips; result -> okawari when open -> end -> title. A tap or
// key ends it (after 600 ms). Nothing is recorded (recording() is false).
function startDemo() { startGame('demo'); }
function demoTick() {
  if (!S.demo) return;
  const t = performance.now();
  if (views.open) { const y = document.querySelector('#dlg-foot .primary'); if (y) y.click(); return; }
  if (S.screen === 'play') {
    if (!S.ready || !S.problem || S.shownWrong || (S.session && S.session.phase === 'intro')) return;
    if (S.mode === 'okawari' && S.okawari && S.okawari.k >= 4) { if (S.ready) finishOkawari(); return; } // a short okawari is enough for the demo
    const st = S.problem.steps[S.step];
    if (!st) return;
    const slip = S.problem && !S.wrongInQ && S.rng() < 0.08;
    press(slip ? String((Number(st.digit) + 3) % 10) : st.digit);
  } else if (S.screen === 'result') {
    S.demoWait = S.demoWait || t;
    const after = S.mode === 'okawari';
    if (t - S.demoWait > (after ? 7000 : 3000)) { S.demoWait = 0; const ok = $('#go-okawari'); if (!after && ok && !ok.hidden) startOkawari(); else toTitle(); }
  }
}
function stopDemoOnInput(e) {
  if (!S.demo || performance.now() - (S.demoAt || 0) < 600) return;
  e.preventDefault(); e.stopPropagation();
  toTitle();
}

// ---------------------------------------------------------------- auto play (checks only: ?auto)
function autoPlay() {
  const slip = Number(params.get('slip') || 0.1);
  const pace = Number(params.get('pace') || 700);
  setInterval(() => {
    if (views.open) { const y = document.querySelector('#dlg-foot .primary') || document.querySelector('#dlg [data-close]'); if (y) y.click(); return; }
    if (S.screen === 'play' && S.session && S.session.phase === 'intro') { press('5'); return; }
    if (S.screen !== 'play' || !S.ready || !S.problem || S.shownWrong) return;
    const st = S.problem.steps[S.step];
    if (!st) return;
    if (Math.random() < slip) press(String((Number(st.digit) + 3) % 10)); else press(st.digit);
  }, pace);
}

async function main() {
  grain();
  wire();
  applyLook(titleLook());
  room.setTime(store.load().lastTime ?? 0.35);
  applySettings();
  showScreen('title');
  refreshTitle();
  requestAnimationFrame(frame);
  await loadSongs();
  checkTrophies();
  if (!store.hasSeenGuide() && !params.has('auto') && !params.has('noguide')) setTimeout(() => coach.start('play'), 700);
  setInterval(demoTick, 600);
  addEventListener('pointerdown', stopDemoOnInput, true);
  addEventListener('keydown', stopDemoOnInput, true);
  if (params.has('auto')) { autoPlay(); if (params.has('start')) setTimeout(() => startGame(params.get('start') === 'grade' ? 'grade' : 'level', Number(params.get('grade') || 3)), 600); }
}
main();

export { startGame, toTitle };
