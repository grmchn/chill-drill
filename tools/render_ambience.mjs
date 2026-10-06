// Render the ambience loops to WAV/MP3 for listening, and print their levels.
// Usage: node tools/render_ambience.mjs [outDir] [seconds] [kind...]
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// DSP=<path> renders with another copy of dsp.js (before/after comparisons).
const { renderLoop } = await import(process.env.DSP || '../app/js/audio/dsp.js');

const out = process.argv[2] || 'var/ambience';
const sec = Number(process.argv[3] || 30);
const kinds = process.argv.slice(4).length ? process.argv.slice(4) : ['rain', 'fire', 'insects'];
const sr = 44100;
mkdirSync(out, { recursive: true });

function wav(data) {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  return buf;
}

for (const kind of kinds) {
  const loop = renderLoop(kind, sr);
  // Loop it as the engine does (the seam must not be audible).
  const n = Math.round(sec * sr); const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = loop[i % loop.length];
  let peak = 0; let sum = 0;
  for (const x of loop) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
  console.log(kind, `loop ${(loop.length / sr).toFixed(1)}s`, `rms ${(10 * Math.log10(sum / loop.length)).toFixed(1)} dBFS`, `peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
  const w = `${out}/${kind}.wav`;
  writeFileSync(w, wav(data));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', w, '-b:a', '160k', `${out}/${kind}.mp3`]);
}
