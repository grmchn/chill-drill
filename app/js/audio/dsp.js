// Instrument and sound synthesis as pure functions that write samples into
// Float32Arrays. The game, the studio tool and the offline renderer all use
// the same code, so a note sounds the same everywhere. Nothing is recorded;
// every sound is made from oscillators, noise and simple physical models.

export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;

// Small deterministic noise source (so renders are repeatable).
export function noiseRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
}

// One-pole low-pass coefficient for a cutoff in Hz.
const lpK = (fc, sr) => 1 - Math.exp((-TAU * fc) / sr);

function fadeEdges(buf, sr, inMs = 1.5, outMs = 40) {
  const a = Math.min(buf.length, Math.round((inMs / 1000) * sr));
  for (let i = 0; i < a; i++) buf[i] *= i / a;
  const b = Math.min(buf.length, Math.round((outMs / 1000) * sr));
  for (let i = 0; i < b; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
}

// ---------------------------------------------------------------- pitched instruments
// Each returns a mono Float32Array; `vel` is 0..1; `p` holds tone parameters
// (the studio tool edits these and songs can override them).

export const INSTRUMENT_DEFAULTS = {
  epiano: { bright: 0.55, bell: 0.3, decay: 1, trem: 0.1, len: 4 },
  piano: { bright: 0.45, decay: 1, hammer: 0.25, len: 4.5 },
  kalimba: { bright: 0.5, decay: 1, len: 2.2 },
  celesta: { bright: 0.6, decay: 1, len: 2.6 },
  vibes: { bright: 0.5, decay: 1, trem: 0.25, len: 3.5 },
  nylon: { bright: 0.45, damp: 0.5, body: 0.5, len: 3 },
  guitar: { bright: 0.65, damp: 0.35, body: 0.3, len: 3.2 },
  upright: { bright: 0.35, damp: 0.55, len: 2.4 },
  subbass: { bright: 0.25, len: 2.2 },
  flute: { bright: 0.4, breath: 0.25, vib: 0.3, len: 2.5 },
};

function epiano(midi, vel, sr, p) {
  const f = mtof(midi);
  const len = Math.max(0.8, p.len - Math.max(0, midi - 60) * 0.035);
  const n = Math.round(len * sr);
  const out = new Float32Array(n);
  const decay = (0.75 + Math.max(0, midi - 55) * 0.025) / p.decay;
  const i1 = (0.6 + 1.8 * vel * p.bright);
  const bell = p.bell * (0.4 + 0.6 * vel);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const idx = i1 * Math.exp(-t * 3.2) + 0.18;
    const body = Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t)) * Math.exp(-t * decay);
    const tine = Math.sin(TAU * f * t + 1.2 * Math.sin(TAU * f * 14 * t)) * Math.exp(-t * 14) * bell;
    const trem = 1 - p.trem + p.trem * Math.cos(TAU * 4.6 * t);
    out[i] = (body * 0.8 + tine * 0.35) * trem * (0.35 + 0.65 * vel);
  }
  return fadeEdges(out, sr, 2, 60);
}

// Felt piano: inharmonic partials, each fading at its own speed, plus a soft hammer.
function piano(midi, vel, sr, p, rnd) {
  const f = mtof(midi);
  const len = Math.max(1, p.len - Math.max(0, midi - 60) * 0.04);
  const n = Math.round(len * sr);
  const out = new Float32Array(n);
  const B = 0.00035;
  const parts = [];
  const top = Math.min(12, Math.floor(7000 / f));
  for (let k = 1; k <= top; k++) {
    const amp = (1 / k ** (1.9 - p.bright * 0.9)) * (k === 1 ? 1 : 0.6 + 0.4 * vel);
    parts.push({ fk: f * k * Math.sqrt(1 + B * k * k), amp, fast: (2.2 + k * 0.9) / p.decay, slow: (0.35 + k * 0.12 + Math.max(0, midi - 60) * 0.02) / p.decay, ph: rnd() * TAU });
  }
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (const q of parts) s += q.amp * Math.sin(TAU * q.fk * t + q.ph) * (0.55 * Math.exp(-t * q.fast) + 0.45 * Math.exp(-t * q.slow));
    out[i] = s;
  }
  // Hammer: a short soft thump.
  const h = Math.round(0.012 * sr);
  let lp = 0; const k = lpK(900 + 1500 * vel, sr);
  for (let i = 0; i < h; i++) { lp += k * (rnd() - lp); out[i] += lp * p.hammer * vel * (1 - i / h); }
  let peak = 0; for (let i = 0; i < Math.min(n, sr * 0.1); i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = (0.3 + 0.7 * vel) / Math.max(1e-6, peak);
  for (let i = 0; i < n; i++) out[i] *= g;
  return fadeEdges(out, sr, 1.5, 80);
}

function kalimba(midi, vel, sr, p) {
  const f = mtof(midi);
  const n = Math.round(p.len * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const d = Math.exp((-t * 2.6) / p.decay);
    out[i] = (Math.sin(TAU * f * t) + p.bright * 0.22 * Math.sin(TAU * f * 5.93 * t) * Math.exp(-t * 18) + 0.08 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 6)) * d * (0.35 + 0.65 * vel);
  }
  // Tine click.
  for (let i = 0; i < Math.min(n, 60); i++) out[i] += Math.sin(i * 1.7) * (1 - i / 60) * 0.15 * vel;
  return fadeEdges(out, sr, 1, 60);
}

function celesta(midi, vel, sr, p) {
  const f = mtof(midi);
  const n = Math.round(p.len * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = (Math.sin(TAU * f * t) * Math.exp((-t * 1.9) / p.decay)
      + p.bright * 0.35 * Math.sin(TAU * f * 4 * t) * Math.exp(-t * 7)
      + p.bright * 0.08 * Math.sin(TAU * f * 10.1 * t) * Math.exp(-t * 16)) * (0.35 + 0.65 * vel);
  }
  return fadeEdges(out, sr, 1, 80);
}

function vibes(midi, vel, sr, p) {
  const f = mtof(midi);
  const n = Math.round(p.len * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const trem = 1 - p.trem + p.trem * Math.cos(TAU * 5.2 * t);
    out[i] = (Math.sin(TAU * f * t) * Math.exp((-t * 1.1) / p.decay) * trem
      + p.bright * 0.3 * Math.sin(TAU * f * 3.98 * t) * Math.exp(-t * 6)
      + p.bright * 0.05 * Math.sin(TAU * f * 9.8 * t) * Math.exp(-t * 20)) * (0.35 + 0.65 * vel);
  }
  return fadeEdges(out, sr, 1, 80);
}

// Karplus-Strong plucked string with a gentle body filter.
function pluck(midi, vel, sr, p, rnd) {
  const f = mtof(midi);
  const n = Math.round(p.len * sr);
  const out = new Float32Array(n);
  const N = Math.max(2, Math.round(sr / f));
  const line = new Float32Array(N);
  let lp = 0; const kb = lpK(800 + 5000 * p.bright * (0.5 + 0.5 * vel), sr);
  for (let i = 0; i < N; i++) { lp += kb * (rnd() - lp); line[i] = lp; }
  // Remove DC from the excitation.
  const mean = line.reduce((a, b) => a + b, 0) / N; for (let i = 0; i < N; i++) line[i] -= mean;
  const loss = 0.9935 + (1 - p.damp) * 0.006 - Math.max(0, midi - 60) * 0.0002;
  let prev = 0; let idx = 0;
  let b1 = 0; let b2 = 0;
  const bw = lpK(220 + p.body * 160, sr);
  for (let i = 0; i < n; i++) {
    const cur = line[idx];
    const nxt = (cur + prev) * 0.5 * loss;
    prev = cur;
    line[idx] = nxt;
    idx = (idx + 1) % N;
    b1 += bw * (cur - b1); b2 += bw * (b1 - b2);
    out[i] = cur + b2 * p.body * 0.6;
  }
  let peak = 0; for (let i = 0; i < Math.min(n, sr * 0.05); i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = (0.35 + 0.65 * vel) / Math.max(1e-6, peak);
  for (let i = 0; i < n; i++) out[i] *= g;
  return fadeEdges(out, sr, 1, 80);
}

function upright(midi, vel, sr, p, rnd) {
  const out = pluck(midi, vel, sr, { bright: p.bright, damp: p.damp, body: 0.8, len: p.len }, rnd);
  // Reinforce the fundamental (the wooden body) and round off the top.
  const f = mtof(midi);
  let lp = 0; const k = lpK(700 + 800 * p.bright, sr);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    lp += k * (out[i] - lp);
    out[i] = lp * 0.8 + 0.45 * Math.sin(TAU * f * t) * Math.exp(-t * 1.6) * (0.4 + 0.6 * vel);
  }
  return fadeEdges(out, sr, 3, 80);
}

function subbass(midi, vel, sr, p) {
  const f = mtof(midi);
  const n = Math.round(p.len * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.008) * Math.exp(-t * 0.7);
    out[i] = (Math.sin(TAU * f * t) + p.bright * 0.25 * Math.sin(TAU * 2 * f * t) + p.bright * 0.08 * Math.sin(TAU * 3 * f * t)) * env * (0.45 + 0.55 * vel);
  }
  return fadeEdges(out, sr, 4, 80);
}

// Soft flute-like lead: sine plus breath noise and a delayed vibrato.
function flute(midi, vel, sr, p, rnd) {
  const f = mtof(midi);
  const n = Math.round(p.len * sr);
  const out = new Float32Array(n);
  let ph = 0; let lp = 0; const kb = lpK(2500, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const vib = 1 + 0.004 * p.vib * Math.min(1, t / 0.5) * Math.sin(TAU * 5 * t);
    ph += (TAU * f * vib) / sr;
    lp += kb * (rnd() - lp);
    const env = Math.min(1, t / 0.06) * Math.exp(-t * 0.5);
    out[i] = (Math.sin(ph) + p.bright * 0.2 * Math.sin(2 * ph) + lp * p.breath) * env * (0.35 + 0.65 * vel);
  }
  return fadeEdges(out, sr, 2, 120);
}

const PITCHED = { epiano, piano, kalimba, celesta, vibes, nylon: pluck, guitar: pluck, upright, subbass, flute };
export const INSTRUMENTS = Object.keys(PITCHED);

export function renderNote(inst, midi, vel, sr, params = {}, seed = 1) {
  const fn = PITCHED[inst];
  if (!fn) throw new Error(`unknown instrument ${inst}`);
  const p = { ...INSTRUMENT_DEFAULTS[inst], ...params };
  return fn(midi, vel, sr, p, noiseRng(seed + midi * 31));
}

// ---------------------------------------------------------------- drums
export const DRUMS = ['kick', 'snare', 'rim', 'hatC', 'hatO', 'shaker', 'brush', 'ride', 'tom'];

export function renderDrum(kind, sr, params = {}, seed = 7) {
  const rnd = noiseRng(seed);
  const tone = params.tone ?? 0.5;
  const mk = (sec) => new Float32Array(Math.round(sec * sr));
  let out;
  switch (kind) {
    case 'kick': {
      out = mk(0.55);
      let ph = 0;
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        ph += (TAU * (44 + 95 * Math.exp(-t * 28))) / sr;
        out[i] = Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t * (6 + 3 * (1 - tone)))) * 0.95;
      }
      for (let i = 0; i < Math.round(0.004 * sr); i++) out[i] += rnd() * 0.25 * (1 - i / (0.004 * sr));
      break;
    }
    case 'snare': {
      out = mk(0.32);
      let lp = 0; let hp = 0; const k1 = lpK(5200 * (0.6 + 0.6 * tone), sr); const k2 = lpK(900, sr);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        lp += k1 * (rnd() - lp); hp += k2 * (lp - hp);
        out[i] = (lp - hp) * 1.6 * Math.exp(-t * 15) + 0.5 * Math.sin(TAU * 185 * t) * Math.exp(-t * 26);
      }
      break;
    }
    case 'rim': {
      out = mk(0.12);
      for (let i = 0; i < out.length; i++) { const t = i / sr; out[i] = (0.6 * Math.sin(TAU * 1650 * t) + 0.5 * Math.sin(TAU * 820 * t)) * Math.exp(-t * 55) + rnd() * 0.25 * Math.exp(-t * 200); }
      break;
    }
    case 'hatC': case 'hatO': case 'ride': {
      const open = kind !== 'hatC';
      out = mk(kind === 'ride' ? 1.4 : open ? 0.5 : 0.09);
      let prev = 0; let lp = 0; const k = lpK(kind === 'ride' ? 7500 : 9500 * (0.5 + 0.5 * tone), sr);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        const x = rnd(); const hp = x - prev; prev = x; lp += k * (hp - lp);
        const env = kind === 'ride' ? 0.35 * Math.exp(-t * 2.4) + 0.65 * Math.exp(-t * 18) : Math.exp(-t * (open ? 8 : 48));
        const ping = kind === 'ride' ? 0.25 * Math.sin(TAU * 3170 * t) * Math.exp(-t * 3) + 0.15 * Math.sin(TAU * 4630 * t) * Math.exp(-t * 4) : 0;
        out[i] = (lp * 0.9 + ping) * env;
      }
      break;
    }
    case 'shaker': {
      out = mk(0.13);
      let prev = 0; let lp = 0; const k = lpK(7000, sr);
      for (let i = 0; i < out.length; i++) { const t = i / sr; const x = rnd(); lp += k * (x - prev - lp); prev = x; out[i] = lp * Math.min(1, t / 0.012) * Math.exp(-t * 32); }
      break;
    }
    case 'brush': {
      out = mk(0.38);
      let lp = 0; const k = lpK(3800, sr);
      for (let i = 0; i < out.length; i++) { const t = i / sr; lp += k * (rnd() - lp); out[i] = lp * Math.min(1, t / 0.035) * Math.exp(-t * 9) * 0.9; }
      break;
    }
    case 'tom': {
      out = mk(0.5);
      let ph = 0;
      for (let i = 0; i < out.length; i++) { const t = i / sr; ph += (TAU * (110 + 40 * Math.exp(-t * 20))) / sr; out[i] = Math.sin(ph) * Math.exp(-t * 7) * 0.8; }
      break;
    }
    default: throw new Error(`unknown drum ${kind}`);
  }
  return fadeEdges(out, sr, 0.3, 15);
}

// ---------------------------------------------------------------- loops (texture and ambience)
// Seamless loops: the tail is cross-faded into the head.
function seamless(raw, sr, fadeSec = 0.5) {
  const f = Math.round(fadeSec * sr);
  const n = raw.length - f;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw[i];
  for (let i = 0; i < f; i++) { const k = i / f; out[i] = raw[i] * k + raw[n + i] * (1 - k); }
  return out;
}

export const LOOPS = ['vinyl', 'rain', 'fire', 'insects', 'room'];

export function renderLoop(kind, sr, seed = 3) {
  const rnd = noiseRng(seed);
  const sec = { vinyl: 8, rain: 24, fire: 16, insects: 9, room: 10 }[kind];
  const raw = new Float32Array(Math.round((sec + 0.5) * sr));
  const n = raw.length;
  if (kind === 'vinyl') {
    let lp = 0; const k = lpK(5000, sr);
    for (let i = 0; i < n; i++) { lp += k * (rnd() - lp); raw[i] = lp * 0.025; }
    // Crackles: sparse clicks of random size, a few soft pops. Kept few and
    // small: a dense, even patter reads as rain (id053).
    for (let c = 0; c < sec * 7; c++) {
      const at = Math.floor(((rnd() + 1) / 2) * (n - 400)); const amp = 0.15 + 0.6 * ((rnd() + 1) / 2) ** 4;
      const w = 2 + Math.floor(((rnd() + 1) / 2) * 12);
      for (let i = 0; i < w; i++) raw[at + i] += amp * (rnd()) * (1 - i / w);
    }
    for (let c = 0; c < sec * 0.6; c++) {
      const at = Math.floor(((rnd() + 1) / 2) * (n - 2000));
      for (let i = 0; i < 800; i++) raw[at + i] += 0.12 * Math.sin(i * 0.05) * Math.exp(-i / 120);
    }
  } else if (kind === 'rain') {
    // A light rain heard from indoors: sparse, soft, low drops on the window
    // and the eaves (several milliseconds of dark filtered noise each, no
    // ringing tone) over a faint low hush. Bright, dense taps read as crinkled
    // paper; a steady bright bed as a waterfall; a pitched decay as a drum.
    const u = () => (rnd() + 1) / 2;
    let air = 0; let air2 = 0; const ka = lpK(320, sr); const ka2 = lpK(70, sr);
    for (let i = 0; i < n; i++) { air += ka * (rnd() - air); air2 += ka2 * (air - air2); raw[i] = (air - air2) * 0.012; }
    let t = 0; let rate = 5;
    while (t < sec) {
      rate += (3 + 5 * u() - rate) * 0.05; // 3..8 drops a second, drifting
      t += -Math.log(1 - u() * 0.98) / rate;
      const at = Math.floor(t * sr); if (at >= n - 1200) break;
      const amp = 0.012 + 0.05 * u() ** 3; // mostly faint, a few closer
      const L = Math.round(sr * (0.005 + 0.012 * u())); // 5..17 ms
      // Band-limited drop: noise through a low band (two low-pass stages, so
      // no bright edge is left).
      const kh = lpK(600 + 1000 * u(), sr); const kl = lpK(120 + 220 * u(), sr);
      let h = 0; let h2 = 0; let l = 0;
      for (let i = 0; i < L; i++) {
        const x = rnd(); h += kh * (x - h); h2 += kh * (h - h2); l += kl * (h2 - l);
        const env = Math.sin((Math.PI * i) / L) ** 2;
        raw[at + i] += (h2 - l) * amp * 16 * env;
      }
    }
  } else if (kind === 'fire') {
    // A small fire in a stove, not a blaze: a soft low breath of flame, a
    // few quiet crackles that come in little clusters, an occasional pop.
    let lp = 0; let lp2 = 0; const k = lpK(260, sr); const k2 = lpK(60, sr); let swell = 0.7; let target = 0.7; let next = 0;
    for (let i = 0; i < n; i++) {
      if (i >= next) { target = 0.5 + 0.5 * ((rnd() + 1) / 2); next = i + Math.round(sr * (0.8 + 1.5 * ((rnd() + 1) / 2))); }
      swell += (target - swell) * 0.00004;
      lp += k * (rnd() - lp); lp2 += k2 * (lp - lp2);
      raw[i] = (lp - lp2) * 0.04 * swell;
    }
    const u = () => (rnd() + 1) / 2;
    const tick = (at, a, w) => { let hp = 0; for (let i = 0; i < w && at + i < n; i++) { const x = rnd(); raw[at + i] += (x - hp) * a * Math.exp(-i / (w / 4)); hp = x; } };
    let t = 0;
    while (t < sec) {
      t += 0.25 + 1.2 * u();
      const at = Math.floor(t * sr); if (at >= n - sr) break;
      const count = 1 + Math.floor(u() * 3);
      for (let c = 0, o = 0; c < count; c++) { tick(at + o, 0.05 + 0.08 * u() ** 3, 20 + Math.floor(u() * 50)); o += Math.round(sr * (0.015 + 0.06 * u())); }
    }
    // A rare, still gentle pop.
    for (let c = 0; c < sec * 0.12; c++) tick(Math.floor(u() * (n - 2000)), 0.09, 140);
  } else if (kind === 'insects') {
    let lp = 0; const k = lpK(900, sr);
    for (let i = 0; i < n; i++) { lp += k * (rnd() - lp); raw[i] = lp * 0.04; }
    for (let b = 0; b < 3; b++) {
      const f = 3800 + b * 650; const rate = 14 + b * 5; let t0 = Math.floor(((rnd() + 1) / 2) * sr);
      while (t0 < n - sr) {
        const pulses = 3 + Math.floor(((rnd() + 1) / 2) * 6);
        for (let pz = 0; pz < pulses; pz++) {
          const at = t0 + Math.round((pz * sr) / rate); const L = Math.round(sr / rate / 2);
          for (let i = 0; i < L && at + i < n; i++) raw[at + i] += 0.035 * Math.sin((TAU * f * i) / sr) * Math.sin((Math.PI * i) / L);
        }
        t0 += Math.round(sr * (0.6 + 1.6 * ((rnd() + 1) / 2)));
      }
    }
  } else if (kind === 'room') {
    // Quiet room tone (used when no ambience is chosen, for the tape feel).
    let lp = 0; const k = lpK(400, sr);
    for (let i = 0; i < n; i++) { lp += k * (rnd() - lp); raw[i] = lp * 0.05; }
  }
  // Level the ambiences so switching is calm. Sparse ones (rain, fire) sit lower
  // in RMS than the insects; their peaks set how loud they feel.
  const trim = { rain: 0.85, fire: 1.3, insects: 1.8, room: 1, vinyl: 1 }[kind] || 1;
  if (trim !== 1) for (let i = 0; i < raw.length; i++) raw[i] *= trim;
  return seamless(raw, sr);
}

// ---------------------------------------------------------------- foley (pencil, eraser, paper)
export function renderFoley(kind, sr, params = {}, seed = 11) {
  const rnd = noiseRng(seed);
  const sec = params.sec ?? { pencil: 0.22, eraser: 0.42, rub: 0.2, paper: 0.32, tick: 0.06, thud: 0.18, key: 0.07 }[kind];
  const n = Math.round(sec * sr);
  const out = new Float32Array(n);
  let lp = 0; let lp2 = 0;
  if (kind === 'pencil') {
    // Graphite on paper: bright, grainy, with stroke-shaped pressure.
    const k = lpK(5200, sr); const k2 = lpK(1400, sr);
    const strokes = params.strokes || 2;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp += k * (rnd() - lp); lp2 += k2 * (lp - lp2);
      const press = Math.abs(Math.sin(Math.PI * t * strokes)) ** 0.6 * (1 - t * 0.3);
      const grain = 0.7 + 0.6 * Math.abs(rnd()) ** 6;
      out[i] = (lp - lp2) * press * grain * 0.9;
    }
  } else if (kind === 'eraser' || kind === 'rub') {
    const k = lpK(1600, sr); const k2 = lpK(250, sr);
    const passes = kind === 'rub' ? 1 : params.passes || 2;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp += k * (rnd() - lp); lp2 += k2 * (lp - lp2);
      out[i] = (lp - lp2) * Math.abs(Math.sin(Math.PI * t * passes * 2)) ** 0.8 * 1.1;
    }
  } else if (kind === 'paper') {
    // A page turned lightly: one soft breath of air, no scraping grain. The
    // band slides down as the page settles (bright edges read as dragging).
    let lp3 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const k = lpK(1700 - 1100 * t, sr);
      lp += k * (rnd() - lp); lp3 += k * (lp - lp3); lp2 += lpK(220, sr) * (lp3 - lp2);
      const env = t < 0.12 ? Math.sin((Math.PI / 2) * (t / 0.12)) : Math.exp(-(t - 0.12) * 5.5);
      out[i] = (lp3 - lp2) * env * 1.6;
    }
  } else if (kind === 'tick') {
    for (let i = 0; i < n; i++) { const t = i / sr; out[i] = (Math.sin(TAU * 2400 * t) * 0.4 + rnd() * 0.3) * Math.exp(-t * 90); }
  } else if (kind === 'thud') {
    for (let i = 0; i < n; i++) { const t = i / sr; lp += lpK(600, sr) * (rnd() - lp); out[i] = (Math.sin(TAU * 140 * t) * 0.7 + lp * 0.8) * Math.exp(-t * 28); }
  } else if (kind === 'key') {
    // Wooden key: a short knock with a felt cushion.
    for (let i = 0; i < n; i++) { const t = i / sr; lp += lpK(2200, sr) * (rnd() - lp); out[i] = (Math.sin(TAU * 520 * t) * 0.5 + Math.sin(TAU * 1310 * t) * 0.2 + lp * 0.6) * Math.exp(-t * 70); }
  } else throw new Error(`unknown foley ${kind}`);
  return fadeEdges(out, sr, 1, 10);
}

// Exponentially decaying stereo noise for the convolution reverb.
export function renderImpulse(sr, sec = 2.4, decay = 2.6, seed = 5) {
  const rnd = noiseRng(seed);
  const n = Math.round(sec * sr);
  const L = new Float32Array(n); const R = new Float32Array(n);
  let lpl = 0; let lpr = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = (1 - t) ** decay;
    const k = lpK(6000 * (1 - 0.8 * t) + 400, sr);
    lpl += k * (rnd() - lpl); lpr += k * (rnd() - lpr);
    L[i] = lpl * env; R[i] = lpr * env;
  }
  for (let i = 0; i < Math.round(0.006 * sr); i++) { L[i] *= i / (0.006 * sr); R[i] *= i / (0.006 * sr); }
  return [L, R];
}
