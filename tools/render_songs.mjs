// Renders each song offline in headless Chromium (the game's own engine) and
// saves WAV files. Needs a static server on 127.0.0.1:8790 at the repo root.
// node tools/render_songs.mjs <outdir> [seconds, 0 = whole song] [songId...]
// Set PLAYWRIGHT to the playwright module path and CHROME to a Chromium binary
// when they are not installed in the usual places.
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const out = process.argv[2] || 'var/audio'; const sec = Number(process.argv[3] || 40); const only = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
page.on('pageerror', (e) => console.log('pageerror', String(e)));
await page.goto(`http://127.0.0.1:${process.env.PORT || 8790}/tools/lofi-studio/blank.html`);
const ids = only.length ? only : JSON.parse(fs.readFileSync('app/audio/songs/index.json'));
for (const id of ids) {
  for (const bside of [false, true]) {
    const t0 = Date.now();
    const res = await page.evaluate(async ({ id, sec, bside }) => {
      const { renderOffline } = await import('/app/js/audio/engine.js');
      const { encodeWav, levels } = await import('/app/js/audio/wav.js');
      const song = await (await fetch(`/app/audio/songs/${id}.json`)).json();
      const { songSeconds } = await import('/app/js/audio/arranger.js');
      const total = sec > 0 ? sec : songSeconds(song) + 8;
      const buf = await renderOffline([{ song, bside }], { seconds: total, energy: (t) => bside ? 1 : Math.min(1, t / (total * 0.55)) });
      const blob = encodeWav(buf);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { lv: levels(buf), b64: btoa(bin) };
    }, { id, sec, bside });
    const name = `${out}/${id}${bside ? '-B' : ''}.wav`;
    fs.writeFileSync(name, Buffer.from(res.b64, 'base64'));
    console.log(name, res.lv.map((l) => `peak ${l.peakDb.toFixed(1)} rms ${l.rmsDb.toFixed(1)}`).join(' / '), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
await b.close();
