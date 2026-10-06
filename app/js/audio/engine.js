// Lo-Fi audio engine (Web Audio API). Plays song data through the arranger,
// renders instrument notes with dsp.js into cached buffers, and runs the
// tape / vinyl / low-pass chain. The same engine drives the game, the studio
// tool and offline WAV renders (pass an OfflineAudioContext).
import { renderNote, renderDrum, renderLoop, renderFoley, renderImpulse, mtof } from './dsp.js';
import { songBars, barSeconds, arrangeBar, createState, layersAt, chordScale, barChords, voice } from './arranger.js';
import { makeRng } from '../problems.js';

const TRACKS = ['keys', 'lead', 'bass', 'counter', 'drums', 'pad'];
const VEL_BUCKETS = [0.45, 0.85];
const bucketOf = (v) => (v < 0.65 ? 0 : 1);

// Map a step position inside a bar to swung time (in steps).
export function swingStep(step, swing, unit = 16) {
  if (!swing) return step;
  const pair = unit === 8 ? 4 : 2; // steps per swung pair
  const half = pair / 2;
  const base = Math.floor(step / pair) * pair;
  const p = step - base;
  return base + (p < half ? p * (1 + swing) : half * (1 + swing) + (p - half) * (1 - swing));
}

export class LofiEngine {
  constructor({ context = null } = {}) {
    this.ctx = context;
    this.offline = !!(context && typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext);
    this.buffers = new Map();
    this.vol = { master: 0.8, music: 0.8, sfx: 0.8, ambient: 0.5 };
    this.muted = false;
    this.energy = 0;
    this.flow = 0;
    this.playing = false;
    this.listeners = {};
    this.slotsAt = []; // [{ t0, t1, slots: [{ t, pcs, root }] }]
    if (this.ctx) this.build();
  }

  on(name, fn) { (this.listeners[name] || (this.listeners[name] = [])).push(fn); }
  emit(name, ...a) { for (const fn of this.listeners[name] || []) fn(...a); }

  // Must be called from a user gesture in the browser.
  unlock() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
    return true;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  get sr() { return this.ctx.sampleRate; }

  build() {
    const c = this.ctx;
    const g = (v = 1) => { const n = c.createGain(); n.gain.value = v; return n; };
    this.master = g(this.vol.master);
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 2.5; this.comp.attack.value = 0.01; this.comp.release.value = 0.25; this.comp.knee.value = 10;
    this.master.connect(this.comp); this.comp.connect(c.destination);

    // Music chain: tracks -> sat -> wobble -> low-pass -> music volume.
    this.musicIn = g(1);
    this.sat = c.createWaveShaper();
    this.setSat(0.25);
    this.wobble = c.createDelay(0.1);
    this.wobble.delayTime.value = 0.012;
    this.wow = c.createOscillator(); this.wow.frequency.value = 0.55; this.wowDepth = g(0);
    this.flut = c.createOscillator(); this.flut.frequency.value = 6.3; this.flutDepth = g(0);
    this.wow.connect(this.wowDepth); this.flut.connect(this.flutDepth);
    this.wowDepth.connect(this.wobble.delayTime); this.flutDepth.connect(this.wobble.delayTime);
    this.wow.start(); this.flut.start();
    this.lpf = c.createBiquadFilter(); this.lpf.type = 'lowpass'; this.lpf.frequency.value = 3400; this.lpf.Q.value = 0.5;
    this.hpf = c.createBiquadFilter(); this.hpf.type = 'highpass'; this.hpf.frequency.value = 35;
    // Keep the low end warm but not muddy (small speakers, long listening).
    this.shelf = c.createBiquadFilter(); this.shelf.type = 'lowshelf'; this.shelf.frequency.value = 140; this.shelf.gain.value = -3.5;
    this.trim = 0.72; // headroom: Lo-Fi sits below full scale
    this.musicOut = g(this.vol.music * this.trim);
    this.musicIn.connect(this.sat); this.sat.connect(this.wobble); this.wobble.connect(this.lpf); this.lpf.connect(this.hpf); this.hpf.connect(this.shelf); this.shelf.connect(this.musicOut);
    this.musicOut.connect(this.master);
    // Reverb send (shared by music and effects).
    this.verb = c.createConvolver();
    const [L, R] = renderImpulse(this.sr, 2.4, 2.8);
    const ir = c.createBuffer(2, L.length, this.sr); ir.copyToChannel(L, 0); ir.copyToChannel(R, 1);
    this.verb.buffer = ir;
    this.verbIn = g(1); this.verbOut = g(0.3);
    this.verbIn.connect(this.verb); this.verb.connect(this.verbOut); this.verbOut.connect(this.wobble);
    // Track buses.
    this.bus = {};
    for (const t of TRACKS) {
      const gain = g(0); const pan = c.createStereoPanner ? c.createStereoPanner() : null; const send = g(0.2);
      if (pan) { gain.connect(pan); pan.connect(this.musicIn); } else gain.connect(this.musicIn);
      gain.connect(send); send.connect(this.verbIn);
      this.bus[t] = { gain, pan, send, level: 1, on: false };
    }
    // Vinyl crackle sits after the filter (it is the record, not the band).
    this.vinylGain = g(0); this.vinylGain.connect(this.musicOut);
    // Effects and ambience.
    this.sfxOut = g(this.vol.sfx); this.sfxOut.connect(this.master);
    this.sfxSend = g(0.18); this.sfxOut.connect(this.sfxSend); this.sfxSend.connect(this.verbIn);
    this.ambOut = g(this.vol.ambient); this.ambOut.connect(this.master);
    this.ambSrc = null;
  }

  setSat(amount) {
    const n = 1024; const curve = new Float32Array(n); const k = 1 + amount * 4;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
    this.sat.curve = curve;
  }

  // ---------------------------------------------------------------- buffers
  bufferOf(key, make) {
    let b = this.buffers.get(key);
    if (!b) {
      const data = make();
      b = this.ctx.createBuffer(1, data.length, this.sr);
      b.copyToChannel(data, 0);
      this.buffers.set(key, b);
    }
    return b;
  }
  noteBuffer(inst, midi, vel, params) {
    const bucket = bucketOf(vel);
    const pk = params ? JSON.stringify(params) : '';
    return this.bufferOf(`n|${inst}|${midi}|${bucket}|${pk}`, () => renderNote(inst, midi, VEL_BUCKETS[bucket], this.sr, params || {}));
  }
  drumBuffer(kind, tone) { return this.bufferOf(`d|${kind}|${tone}`, () => renderDrum(kind, this.sr, { tone })); }
  loopBuffer(kind) { return this.bufferOf(`l|${kind}`, () => renderLoop(kind, this.sr)); }
  foleyBuffer(kind, variant = 0, params = {}) { return this.bufferOf(`f|${kind}|${variant}`, () => renderFoley(kind, this.sr, params, 11 + variant * 17)); }

  // Render every note a song can use, a few at a time, so the first bars do
  // not stall. Calls back when done.
  prewarm(song, { bside = false, budgetMs = 8, done } = {}) {
    const jobs = [];
    const seen = new Set();
    const bars = songBars(song);
    const st = createState(); const rng = makeRng(song.seed || 1);
    const all = new Set(TRACKS);
    bars.forEach((b, i) => {
      const { events } = arrangeBar(song, b, bars[i + 1], all, 1, st, rng, { bside });
      for (const e of events) {
        if (e.track === 'pad') continue;
        if (e.track === 'drums') { const k = `d${e.drum}`; if (!seen.has(k)) { seen.add(k); jobs.push(() => this.drumBuffer(e.drum, song.tracks.drums.tone)); } continue; }
        const tr = this.trackDef(song, e.track, bside);
        const k = `${tr.inst}${e.midi}${bucketOf(e.vel)}`;
        if (!seen.has(k)) { seen.add(k); jobs.push(() => this.noteBuffer(tr.inst, e.midi, e.vel, tr.params)); }
      }
    });
    const input = (song.input && song.input.inst) || 'kalimba';
    for (let m = 60; m <= 96; m++) for (const vv of [0.5]) jobs.push(() => this.noteBuffer(input, m, vv, null));
    jobs.push(() => this.loopBuffer('vinyl'));
    for (const f of ['pencil', 'eraser', 'rub', 'paper', 'tick', 'thud', 'key']) jobs.push(() => this.foleyBuffer(f));
    const total = jobs.length;
    const step = () => {
      const t0 = performance.now();
      while (jobs.length && performance.now() - t0 < budgetMs) jobs.shift()();
      this.emit('prewarm', 1 - jobs.length / total);
      if (jobs.length) setTimeout(step, 4); else if (done) done();
    };
    if (this.offline) { while (jobs.length) jobs.shift()(); if (done) done(); } else step();
  }

  trackDef(song, track, bside) {
    const base = song.tracks[track] || {};
    const over = bside && song.bside && song.bside.tracks && song.bside.tracks[track];
    return over ? { ...base, ...over, params: { ...(base.params || {}), ...(over.params || {}) } } : base;
  }

  // ---------------------------------------------------------------- transport
  // playlist: [{ song, bside }]; the session length is the time until the
  // outro of the last song. energyAt(t) may be given for offline renders.
  // `offset` (seconds) joins the first song that far in, at the next bar line,
  // so songTime carries on from a clock that was already running (id050).
  play(playlist, { at = null, startEnergy = 0, holdOutro = true, endless = false, skipIntro = false, offset = 0 } = {}) {
    if (!this.ctx) return 0;
    this.stop(0);
    this.playlist = playlist.map((p) => ({ ...p, bars: songBars(p.song) }));
    this.pi = 0; this.bi = 0;
    this.endless = endless;
    if (skipIntro) { const k = this.playlist[0].bars.findIndex((b) => b.section !== 'intro'); this.bi = Math.max(0, k); }
    this.state = createState();
    this.energy = startEnergy;
    this.holdOutro = holdOutro;
    this.finishing = false;
    this.outroNoted = false;
    this.startTime = (at ?? this.now) + 0.12;
    this.nextBarTime = this.startTime;
    if (offset > 0) {
      const per = barSeconds(this.playlist[0].song);
      const k = Math.min(this.playlist[0].bars.length - 1, Math.ceil((offset + 0.15) / per));
      this.bi = Math.max(this.bi, k);
      this.startTime = (at ?? this.now) - offset;
      this.nextBarTime = this.startTime + k * per;
    }
    this.mainEnd = this.computeMainEnd();
    this.playing = true;
    this.applySongFx(this.playlist[0].song);
    this.layers = new Set();
    this.slotsAt = [];
    if (!this.offline) {
      clearInterval(this.timer);
      this.timer = setInterval(() => this.schedule(), 25);
      this.schedule();
    }
    return this.mainEnd;
  }

  computeMainEnd() {
    let sec = 0;
    this.playlist.forEach((p, i) => {
      const per = barSeconds(p.song);
      const n = p.bars.filter((b) => i < this.playlist.length - 1 || b.section !== 'O').length;
      sec += n * per;
    });
    return sec;
  }

  // Seconds of music played since play() (pauses do not count).
  get songTime() { return this.playing || this.finishing ? Math.max(0, this.now - this.startTime) : 0; }

  applySongFx(song) {
    const fx = song.fx || {};
    const t = this.now;
    this.baseLpf = (fx.lpf || 3400) * 1.15;
    this.lpf.frequency.setTargetAtTime(this.cutoff(), t, 0.3);
    this.wowDepth.gain.setTargetAtTime(0.0026 * (fx.wow ?? 0.3), t, 0.5);
    this.flutDepth.gain.setTargetAtTime(0.00025 * (fx.flutter ?? 0.2), t, 0.5);
    this.setSat(fx.sat ?? 0.25);
    this.verbOut.gain.setTargetAtTime(fx.reverb ?? 0.3, t, 0.5);
    this.vinylGain.gain.cancelScheduledValues(t);
    this.vinylGain.gain.setTargetAtTime(1.2 * (fx.crackle ?? 0.4), t, 0.5);
    if (!this.vinylSrc && !this.noVinyl) this.startVinyl();
    for (const tr of TRACKS) {
      const d = song.tracks[tr] || {};
      const b = this.bus[tr];
      b.level = d.gain ?? 0.5;
      if (b.pan) b.pan.pan.value = d.pan || 0;
      b.send.gain.value = d.send ?? 0.2;
      if (b.on) b.gain.gain.setTargetAtTime(b.level, t, 0.4);
    }
  }

  // The record noise lives on the music bus, which comes back up after the
  // closing fade: silence it on its own, or it plays on over the title.
  quietVinyl(at, tau) {
    if (!this.vinylGain) return;
    this.vinylGain.gain.cancelScheduledValues(at);
    this.vinylGain.gain.setTargetAtTime(0, at, tau);
  }

  startVinyl() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.loopBuffer('vinyl'); s.loop = true;
    s.connect(this.vinylGain); s.start(this.now + 0.05);
    this.vinylSrc = s;
  }

  cutoff() { return Math.min(14000, (this.baseLpf || 3400) * (1 + 1.4 * this.flow)); }

  setEnergy(e) { this.energy = Math.max(0, Math.min(1, e)); }
  setFlow(f) {
    this.flow = Math.max(0, Math.min(1, f));
    if (this.lpf) this.lpf.frequency.setTargetAtTime(this.cutoff(), this.now, 0.8);
  }

  pause() { this.paused = true; if (this.ctx && !this.offline && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { this.paused = false; if (this.ctx && !this.offline && this.ctx.state !== 'running') this.ctx.resume(); }

  setVolume(kind, v) {
    this.vol[kind] = v;
    if (!this.ctx) return;
    const node = { master: this.master, music: this.musicOut, sfx: this.sfxOut, ambient: this.ambOut }[kind];
    node.gain.setTargetAtTime(kind === 'master' && this.muted ? 0 : kind === 'music' ? v * this.trim : v, this.now, 0.05);
  }
  setMuted(m) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.vol.master, this.now, 0.05); }

  // End the music: the next bar plays the closing chord, then everything fades.
  finish() {
    if (!this.playing) return;
    this.finishing = true;
  }

  stop(fade = 0.6) {
    clearInterval(this.timer);
    this.timer = null;
    if (!this.ctx) return;
    const t = this.now;
    this.playing = false; this.finishing = false;
    this.quietVinyl(t, Math.max(0.01, fade / 3));
    for (const tr of TRACKS) { const b = this.bus[tr]; b.on = false; b.gain.gain.cancelScheduledValues(t); b.gain.gain.setTargetAtTime(0, t, Math.max(0.01, fade / 3)); }
    if (this.live) { for (const n of this.live) { try { n.stop(t + fade + 0.1); } catch { /* already stopped */ } } }
    this.live = new Set();
  }

  // ---------------------------------------------------------------- scheduler
  schedule(horizon = 0.3) {
    if (!this.playing) return;
    while (this.playing && this.nextBarTime < this.now + horizon) this.scheduleNextBar();
  }

  scheduleNextBar() {
    const p = this.playlist[this.pi];
    if (!p) { this.playing = false; return; }
    const song = p.song;
    let bar = p.bars[this.bi];
    const last = this.pi === this.playlist.length - 1;
    const t0 = this.nextBarTime;
    const per = barSeconds(song);
    if (this.finishing) { this.scheduleEnding(song, p.bside, t0); return; }
    if (last && !this.endless && bar.section === 'O' && bar.bar === 0 && !this.outroNoted) { this.outroNoted = true; this.emit('mainEnd', t0); }
    // Layers change only at bar starts; new layers fade in over a bar.
    const want = layersAt(song, this.energy);
    for (const tr of TRACKS) {
      const b = this.bus[tr];
      const on = want.has(tr);
      if (on !== b.on) {
        b.on = on;
        b.gain.gain.cancelScheduledValues(t0);
        b.gain.gain.setValueAtTime(b.gain.gain.value, t0);
        b.gain.gain.linearRampToValueAtTime(on ? b.level : 0, t0 + per * (on ? 1 : 0.5));
      }
    }
    const next = p.bars[this.bi + 1] || (last ? p.bars.find((b) => b.section === 'O') : (this.playlist[this.pi + 1] || {}).bars?.[0]);
    const rng = makeRng((song.seed || 1) * 1000 + bar.index + this.pi * 77);
    const { events, slots } = arrangeBar(song, bar, next, new Set(TRACKS), this.energy, this.state, rng, { bside: p.bside });
    const stepDur = per / 16;
    const swing = (p.bside && song.bside && song.bside.swing != null) ? song.bside.swing : song.swing || 0;
    const unit = song.swingUnit || (swing >= 0.25 ? 8 : 16);
    const at = (step) => t0 + swingStep(Math.max(0, step), swing, unit) * stepDur;
    for (const e of events) {
      if (!this.bus[e.track] || (this.solo && !this.solo.has(e.track))) continue;
      if (e.track === 'drums') this.playDrum(e.drum, at(e.step), e.vel, song.tracks.drums && song.tracks.drums.tone);
      else if (e.track === 'pad') this.playPad(e.midis, at(e.step), e.dur * stepDur, song.tracks.pad || {});
      else { const tr = this.trackDef(song, e.track, p.bside); this.playNote(this.bus[e.track].gain, tr.inst, e.midi, e.vel, at(e.step), e.dur * stepDur, tr.params); }
    }
    this.slotsAt.push({ t0, t1: t0 + per, slots: slots.map((s) => ({ t: at(s.step), pcs: s.pcs, root: s.root })) });
    if (this.slotsAt.length > 16) this.slotsAt.shift();
    this.emit('bar', { t0, song: song.id, section: bar.section, bar: bar.bar, index: bar.index });
    this.nextBarTime = t0 + per;
    // Advance: loop the outro of the last song until finish().
    this.bi += 1;
    if (last && this.endless && p.bars[this.bi] && p.bars[this.bi].section === 'O') this.bi = p.bars.findIndex((b) => b.section !== 'intro');
    if (this.bi >= p.bars.length) {
      if (last && !p.bars.some((b) => b.section === 'O')) { this.quietVinyl(this.nextBarTime, 0.5); this.playing = false; clearInterval(this.timer); this.timer = null; this.emit('ended', this.nextBarTime); return; }
      if (last) this.bi = p.bars.findIndex((b) => b.section === 'O');
      else { this.pi += 1; this.bi = 0; this.state = createState(); this.applySongFx(this.playlist[this.pi].song); this.emit('song', this.playlist[this.pi].song.id); }
    }
  }

  // The closing chord: tonic voicing, rolled, then a long fade.
  scheduleEnding(song, bside, t0) {
    const outro = song.sections.O || song.sections.A;
    const ch = barChords(outro.chords[0])[0];
    const tr = this.trackDef(song, 'keys', bside);
    const transpose = (bside && song.bside && song.bside.transpose) || 0;
    const voicing = voice(ch, this.state.prevVoicing, (song.keys && song.keys.center) || 62).map((m) => m + transpose);
    voicing.forEach((m, i) => this.playNote(this.bus.keys.gain, tr.inst, m, 0.5, t0 + i * 0.09, 4, tr.params));
    const low = ((ch.root + transpose) % 12 + 12) % 12 + 36;
    this.playNote(this.bus.bass.gain, this.trackDef(song, 'bass', bside).inst, low, 0.5, t0, 3, this.trackDef(song, 'bass', bside).params);
    this.bus.keys.gain.gain.setTargetAtTime(this.bus.keys.level, t0, 0.1);
    this.bus.bass.gain.gain.setTargetAtTime(this.bus.bass.level * 0.8, t0, 0.1);
    for (const t of TRACKS) if (t !== 'keys' && t !== 'bass') this.bus[t].gain.gain.setTargetAtTime(0, t0, 0.4);
    this.musicOut.gain.setValueAtTime(this.vol.music * this.trim, t0 + 2);
    this.musicOut.gain.linearRampToValueAtTime(0.0001, t0 + 7);
    this.quietVinyl(t0 + 2, 1.5); // the record stops with the music (id053)
    this.musicOut.gain.setValueAtTime(this.vol.music * this.trim, t0 + 7.2);
    this.playing = false;
    this.finishing = false;
    clearInterval(this.timer); this.timer = null;
    for (const t of TRACKS) { const b = this.bus[t]; b.on = false; b.gain.gain.setTargetAtTime(0, t0 + 6.5, 0.2); }
    this.emit('ended', t0 + 7);
  }

  playNote(dest, inst, midi, vel, when, dur, params) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noteBuffer(inst, midi, vel, params);
    const g = this.ctx.createGain();
    const ref = VEL_BUCKETS[bucketOf(vel)];
    const amp = Math.min(1.4, vel / ref);
    g.gain.setValueAtTime(amp, when);
    const off = when + Math.max(0.05, dur);
    // Release: a short fade after the note's length (sustain instruments).
    g.gain.setValueAtTime(amp, off);
    g.gain.exponentialRampToValueAtTime(0.0001, off + 0.35);
    src.connect(g); g.connect(dest);
    src.start(Math.max(when, this.now));
    src.stop(off + 0.4);
    this.track(src);
    return src;
  }

  playDrum(kind, when, vel, tone = 0.5) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.drumBuffer(kind, tone);
    const g = this.ctx.createGain(); g.gain.value = vel;
    src.connect(g); g.connect(this.bus.drums.gain);
    src.start(Math.max(when, this.now));
    this.track(src);
  }

  // Warm detuned-saw pad, filtered, with slow attack and release.
  playPad(midis, when, dur, def) {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = def.cutoff || 1000; f.Q.value = 0.3;
    const g = c.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.06, when + Math.min(1.2, dur * 0.4));
    g.gain.setValueAtTime(0.06, when + dur);
    g.gain.linearRampToValueAtTime(0, when + dur + 0.9);
    f.connect(g); g.connect(this.bus.pad.gain);
    for (const m of midis) {
      for (const det of [-7, 6]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(f); o.start(when); o.stop(when + dur + 1);
        this.track(o);
      }
    }
  }

  track(node) {
    if (this.offline) return;
    if (!this.live) this.live = new Set();
    this.live.add(node);
    node.onended = () => this.live.delete(node);
  }

  // ---------------------------------------------------------------- chords now
  slotNow(t = this.now) {
    for (let i = this.slotsAt.length - 1; i >= 0; i--) {
      const b = this.slotsAt[i];
      if (t >= b.t0 - 0.01) { let s = b.slots[0]; for (const x of b.slots) if (t >= x.t - 0.01) s = x; return s; }
    }
    return null;
  }
  // Chord tones (with tensions) around the input register, for the input sounds.
  tones(lo = 67, hi = 91) {
    const s = this.slotNow() || { pcs: [0, 4, 7, 11, 2] };
    return chordScale({ pcs: s.pcs }, lo, hi);
  }

  // ---------------------------------------------------------------- effects
  get inputInst() { const p = this.playlist && this.playlist[this.pi]; return (p && p.song.input && p.song.input.inst) || 'kalimba'; }

  sfxNote(midi, vel = 0.5, when = this.now, inst = this.inputInst, gain = 1) {
    if (!this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noteBuffer(inst, midi, vel, null);
    const g = this.ctx.createGain(); g.gain.value = gain * Math.min(1.4, vel / VEL_BUCKETS[bucketOf(vel)]);
    src.connect(g); g.connect(this.sfxOut);
    src.start(when);
    this.track(src);
    return { src, g };
  }
  foley(kind, { gain = 0.6, rate = 1, variant = 0, when = this.now } = {}) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.foleyBuffer(kind, variant);
    src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(this.sfxOut);
    src.start(when);
    this.track(src);
  }

  // A key press: a soft wooden knock and a note from the chord. Lower places
  // (ones) sound lower than higher ones; the digit picks the chord tone.
  key(digit, place = 0) {
    if (!this.ctx) return;
    this.foley('key', { gain: 0.35, rate: 0.95 + Math.random() * 0.1 });
    const tones = this.tones();
    const idx = Math.min(tones.length - 1, Math.max(0, Number(digit) % tones.length + Math.min(3, place)));
    this.lastKeyMidi = tones[idx];
    this.sfxNote(tones[idx], 0.5, this.now, this.inputInst, 0.7);
  }
  write(strokes = 2) { this.foley('pencil', { gain: 0.45, rate: 0.9 + Math.random() * 0.25, variant: strokes > 2 ? 1 : 0 }); }
  erase() { this.foley('eraser', { gain: 0.42, rate: 0.95 + Math.random() * 0.1 }); }
  rub() { this.foley('rub', { gain: 0.4 }); }
  page() { this.foley('paper', { gain: 0.2 }); } // quieter than the pencil and the maru (id051)
  stamp() { this.foley('thud', { gain: 0.5 }); }

  check() {
    if (!this.ctx) return;
    this.foley('tick', { gain: 0.25 });
    const tones = this.tones(76, 93);
    this.sfxNote(tones[Math.floor(tones.length / 2)], 0.4, this.now + 0.02, this.inputInst, 0.5);
  }
  // Finished problem: a short figure on the chord tones, resolving into the
  // chord. More (always gentle) figures open up as the session goes on (id036).
  maru(solved = 0) {
    if (!this.ctx) return;
    const tones = this.tones(67, 91);
    const s = this.slotNow();
    const rootUp = s ? tones.find((m) => m % 12 === s.root) : tones[0];
    const start = Math.max(0, tones.indexOf(rootUp));
    const fig = maruFigure(solved, this.lastMaru, Math.random);
    this.lastMaru = fig.name;
    for (const n of fig.notes) {
      const m = tones[Math.max(0, Math.min(tones.length - 1, start + n.step))];
      this.sfxNote(m + (n.oct || 0) * 12, n.vel, this.now + n.at, n.inst || this.inputInst, n.gain ?? 0.6);
    }
    this.foley('pencil', { gain: 0.3, rate: 0.7, when: this.now + 0.05 });
  }
  // A slip: the note sags like a slowing tape. Never a buzzer.
  wrong() {
    if (!this.ctx) return;
    const m = this.lastKeyMidi || this.tones()[2];
    const n = this.sfxNote(m, 0.45, this.now, this.inputInst, 0.55);
    if (n) { n.src.detune.setValueAtTime(0, this.now); n.src.detune.linearRampToValueAtTime(-180, this.now + 0.45); }
    // The whole record drags for a moment.
    const d = this.wobble.delayTime; const t = this.now;
    d.cancelScheduledValues(t); d.setValueAtTime(0.012, t); d.linearRampToValueAtTime(0.02, t + 0.18); d.linearRampToValueAtTime(0.012, t + 0.5);
  }
  notify() { if (!this.ctx) return; const tones = this.tones(84, 98); this.sfxNote(tones[tones.length - 1], 0.4, this.now, 'celesta', 0.35); }
  lantern(lit = 1) {
    if (!this.ctx) return;
    const tones = this.tones(72, 93);
    for (let i = 0; i < lit; i++) this.sfxNote(tones[Math.min(tones.length - 1, 3 + i * 2)], 0.4, this.now + i * 0.16, 'kalimba', 0.45);
  }
  chime() { if (!this.ctx) return; const tones = this.tones(72, 91); tones.slice(0, 4).forEach((m, i) => this.sfxNote(m, 0.45, this.now + i * 0.12, 'celesta', 0.45)); }
  // A slow breath of air (the breathing intro, rests).
  breath(sec = 2.4, inhale = true) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.loopBuffer('room'); src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = inhale ? 900 : 600; f.Q.value = 0.7;
    const g = this.ctx.createGain(); const t = this.now;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + sec * 0.6); g.gain.linearRampToValueAtTime(0, t + sec);
    f.frequency.linearRampToValueAtTime(inhale ? 1500 : 400, t + sec);
    src.connect(f); f.connect(g); g.connect(this.sfxOut);
    src.start(t); src.stop(t + sec + 0.1);
  }

  // ---------------------------------------------------------------- ambience
  setAmbient(kind) {
    if (!this.ctx) { this.wantAmbient = kind; return; }
    const t = this.now;
    if (this.ambSrc) { const old = this.ambSrc; old.g.gain.setTargetAtTime(0, t, 0.4); old.src.stop(t + 2); this.ambSrc = null; }
    if (!kind || kind === 'none') return;
    const src = this.ctx.createBufferSource(); src.buffer = this.loopBuffer(kind); src.loop = true;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 2);
    src.connect(g); g.connect(this.ambOut); src.start(t);
    this.ambSrc = { src, g, kind };
  }
}

// Render a playlist offline to stereo channels (studio export, checks).
export async function renderOffline(playlist, { seconds, sampleRate = 44100, energy = (t) => Math.min(1, t / 60), flow = () => 0, solo = null } = {}) {
  const ctx = new OfflineAudioContext(2, Math.round(seconds * sampleRate), sampleRate);
  const eng = new LofiEngine({ context: ctx });
  eng.offline = true;
  if (solo) { eng.solo = new Set(solo); if (!eng.solo.has('vinyl')) eng.noVinyl = true; }
  eng.play(playlist, { at: 0 });
  // Schedule everything up front, updating energy per bar.
  while (eng.playing && eng.nextBarTime < seconds) {
    eng.setEnergy(energy(eng.nextBarTime));
    eng.flow = flow(eng.nextBarTime);
    eng.lpf.frequency.setValueAtTime(eng.cutoff(), eng.nextBarTime);
    eng.scheduleNextBar();
  }
  const buf = await ctx.startRendering();
  return buf;
}

// Figures for a finished problem (id036). Steps are chord-tone indices above
// the root; `at` in seconds. Opened by the number solved in the session:
// 0+ the rising three, 5+ a falling resolve and a soft dyad, 12+ a four-note
// rise and a celesta glint on top, 20+ a turn, a grace note and a light roll.
// All stay quiet (velocity <= 0.5, at most five notes); the same figure never
// plays twice in a row.
export const MARU_FIGURES = [
  { name: 'rise', from: 0, notes: [[0, 0, 0.5], [2, 0.085, 0.45], [3, 0.17, 0.4]] },
  { name: 'fall', from: 5, notes: [[4, 0, 0.42], [2, 0.09, 0.42], [0, 0.18, 0.46]] },
  { name: 'dyad', from: 5, notes: [[0, 0, 0.36, 0, null, 0.5], [2, 0, 0.3, 0, null, 0.5], [4, 0.16, 0.34]] },
  { name: 'rise4', from: 12, notes: [[0, 0, 0.44], [1, 0.08, 0.4], [2, 0.16, 0.4], [4, 0.26, 0.42]] },
  { name: 'glint', from: 12, notes: [[0, 0, 0.46], [2, 0.085, 0.42], [3, 0.17, 0.4], [3, 0.3, 0.3, 1, 'celesta', 0.32]] },
  { name: 'turn', from: 20, notes: [[2, 0, 0.42], [3, 0.08, 0.38], [2, 0.16, 0.38], [1, 0.24, 0.36], [2, 0.34, 0.44]] },
  { name: 'grace', from: 20, notes: [[1, 0, 0.3], [2, 0.04, 0.46], [4, 0.16, 0.42]] },
  { name: 'roll', from: 20, notes: [[0, 0, 0.3, 0, null, 0.45], [1, 0.035, 0.28, 0, null, 0.45], [2, 0.07, 0.28, 0, null, 0.45], [3, 0.105, 0.28, 0, null, 0.45], [5, 0.2, 0.3, 0, null, 0.45]] },
].map((f) => ({ ...f, notes: f.notes.map(([step, at, vel, oct = 0, inst = null, gain = 0.6]) => ({ step, at, vel, oct, inst, gain })) }));

export function maruFigure(solved, last = null, rnd = Math.random) {
  const open = MARU_FIGURES.filter((f) => solved >= f.from);
  // Newer figures a little more often once open, so the change is noticed.
  const pool = open.filter((f) => f.name !== last);
  const list = pool.length ? pool : open;
  const w = list.map((f) => 1 + f.from / 20);
  let x = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { x -= w[i]; if (x < 0) return list[i]; }
  return list[list.length - 1];
}
