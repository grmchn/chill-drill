// The room: a night desk by a window (the design notes 2.2, 4). One SVG
// scene (1000x600) whose colours follow the time of day through CSS custom
// properties, plus a canvas inside the window for rain, snow and petals.
// Changes are slow; one small thing moves per finished problem.

import { sceneWeather } from './weather.js';

const NS = 'http://www.w3.org/2000/svg';
const LINE = '#2B2A33';

// Time of day keys (DESIGN.md 2.2): sky top, sky bottom, wall, lamp strength.
export const TIMES = [
  { name: 'dusk', top: '#5B4B8A', bot: '#F4A47C', wall: '#3A3F7A', lamp: 0.6, stars: 0.15 },
  { name: 'night', top: '#1E2250', bot: '#4A4F8F', wall: '#2A2D5E', lamp: 0.85, stars: 0.7 },
  { name: 'late', top: '#0E1030', bot: '#2A2D5E', wall: '#22254F', lamp: 1, stars: 1 },
  { name: 'dawn', top: '#6E86C2', bot: '#F7C59F', wall: '#3A3F7A', lamp: 0.7, stars: 0.1 },
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const x = hex(a); const y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`; };
const lerp = (a, b, k) => a + (b - a) * k;

// t: 0 = dusk ... 1 = dawn (piecewise between the four keys).
export function timeColors(t) {
  const x = Math.max(0, Math.min(1, t)) * (TIMES.length - 1);
  const i = Math.min(TIMES.length - 2, Math.floor(x)); const k = x - i;
  const a = TIMES[i]; const b = TIMES[i + 1];
  return { top: mix(a.top, b.top, k), bot: mix(a.bot, b.bot, k), wall: mix(a.wall, b.wall, k), lamp: lerp(a.lamp, b.lamp, k), stars: lerp(a.stars, b.stars, k) };
}

// ---------------------------------------------------------------- collection variants
export const ROOMS = {
  night: { name: 'よるの へや', wall2: 0.0, beams: false },
  attic: { name: 'やねうら', wall2: 0.0, beams: true },
  cafe: { name: 'カフェの まどぎわ', wall2: 0.15, cafe: true },
  train: { name: 'でんしゃの まど', train: true },
  engawa: { name: 'えんがわ', engawa: true },
  cabin: { name: 'ログハウス', logs: true },
};
export const VIEWS = { city: 'あめの まち', snow: 'ゆき', sea: 'うみ', forest: 'もり', stars: 'ほしぞら', sakura: 'さくらなみき' };
export const PROPS = { mug: 'マグカップ', plant: 'かんようしょくぶつ', goldfish: 'きんぎょばち', record: 'レコードプレーヤー', candle: 'ろうそく', globe: 'ちきゅうぎ' };
export const MATES = { none: 'なし', fish: 'きんぎょ', bird: 'ことり', dopakichi: 'ドパキチ' };

// ---------------------------------------------------------------- window events (id062)
// Things that pass by outside now and then (while solving, on the result page
// and in the room): drawn on the window canvas over the weather, soft and slow.
// Each is { dur (s), draw(g, W, H, p, rnd) } with p 0..1 through the event and
// rnd a per-event random (so one pass keeps its shape). Sizes are in canvas
// pixels (the canvas is the window at 2x).
const ease = (p, a = 0.15) => Math.min(1, p / a, (1 - p) / a); // fade in and out
const glow = (g, x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
export const EVENTS = {
  // A few falling stars, one after another, high in the sky.
  shooting: { dur: 6, draw(g, W, H, p, r) {
    for (let i = 0; i < 3; i++) {
      const q = (p - i * 0.28 - r[i] * 0.05) / 0.22; if (q < 0 || q > 1) continue;
      const x0 = W * (0.25 + 0.6 * r[i + 3]); const y0 = H * (0.08 + 0.18 * r[i + 6]);
      const x = x0 - W * 0.32 * q; const y = y0 + H * 0.16 * q; const a = Math.sin(Math.PI * q);
      const gr = g.createLinearGradient(x, y, x + 170, y - 85); gr.addColorStop(0, `rgba(255,248,220,${0.95 * a})`); gr.addColorStop(1, 'rgba(255,248,220,0)');
      g.strokeStyle = gr; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 170, y - 85); g.stroke();
      glow(g, x, y, 16, '255,248,220', 0.9 * a);
    }
  } },
  // A big full moon comes out from behind the clouds high up, stays a while
  // and drifts a little (events are drawn over the view, so it never sinks
  // behind the town).
  fullmoon: { dur: 26, draw(g, W, H, p, r) {
    const a = ease(p, 0.2); const x = W * (0.6 + 0.2 * r[0]) - W * 0.05 * p; const y = H * (0.2 - 0.04 * p);
    glow(g, x, y, 110, '255,240,200', 0.35 * a);
    g.fillStyle = `rgba(255,243,210,${0.95 * a})`; g.beginPath(); g.arc(x, y, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(234,219,176,${0.7 * a})`; [[-14, -8, 9], [12, 6, 7], [-4, 16, 5]].forEach(([dx, dy, rr]) => { g.beginPath(); g.arc(x + dx, y + dy, rr, 0, Math.PI * 2); g.fill(); });
  } },
  // A flock of small round clouds lit from below drifts across.
  clouds: { dur: 22, draw(g, W, H, p, r) {
    const a = ease(p, 0.2) * 0.85;
    for (let i = 0; i < 12; i++) {
      const s = 0.7 + 0.6 * r[(i * 3) % 10];
      const x = -W * 0.6 + W * 0.9 * p + (i % 6) * W * 0.17 + r[i % 10] * 50; const y = H * (0.1 + 0.11 * Math.floor(i / 6)) + r[(i + 4) % 10] * 34;
      g.fillStyle = `rgba(232,196,214,${a})`; g.beginPath(); g.ellipse(x, y, 34 * s, 15 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(250,226,232,${a})`; g.beginPath(); g.ellipse(x - 8 * s, y - 6 * s, 20 * s, 9 * s, 0, 0, Math.PI * 2); g.fill();
    }
  } },
  // Fireflies wander over the dark ground, blinking slowly.
  fireflies: { dur: 18, draw(g, W, H, p, r, t) {
    const a = ease(p, 0.2);
    for (let i = 0; i < 14; i++) {
      const u = r[i % 10] + i * 0.37; const x = W * ((u * 0.618 + 0.1 * Math.sin(t * 0.4 + i)) % 1); const y = H * (0.62 + 0.3 * ((u * 0.414) % 1)) + 12 * Math.sin(t * 0.7 + i * 2);
      const b = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.9);
      glow(g, x, y, 22, '214,255,140', 0.8 * a * b); g.fillStyle = `rgba(240,255,190,${a * b})`; g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
    }
  } },
  // One balloon floats up past the window, swaying.
  balloon: { dur: 14, draw(g, W, H, p, r, t) {
    g.translate(W * (0.2 + 0.6 * r[0]) + 18 * Math.sin(t * 0.9), H * (1.2 - 1.5 * p)); g.scale(1.5, 1.5);
    const x = 0; const y = 0;
    const col = ['232,104,104', '255,190,90', '120,180,230'][Math.floor(r[1] * 3)];
    g.strokeStyle = 'rgba(240,235,225,.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y + 38); g.quadraticCurveTo(x + 8, y + 70, x - 2, y + 100); g.stroke();
    g.fillStyle = `rgba(${col},.95)`; g.beginPath(); g.ellipse(x, y, 26, 32, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 4, y + 34); g.lineTo(x + 4, y + 34); g.lineTo(x, y + 30); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(x - 9, y - 11, 6, 10, -0.4, 0, Math.PI * 2); g.fill();
  } },
  // Birds in a loose V cross the sky, wings beating.
  birds: { dur: 11, draw(g, W, H, p, r, t) {
    const x0 = W * 1.15 - W * 1.4 * p; const y0 = H * (0.2 + 0.15 * r[0]);
    // Pale against the night sky (dark birds would vanish into it).
    g.strokeStyle = 'rgba(232,226,248,.9)'; g.lineWidth = 4; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1); const x = x0 + Math.abs(k) * 46; const y = y0 + k * 26; const f = Math.sin(t * 8 + i) * 9;
      g.beginPath(); g.moveTo(x - 17, y - f); g.quadraticCurveTo(x - 7, y - 5, x, y); g.quadraticCurveTo(x + 7, y - 5, x + 17, y - f); g.stroke();
    }
  } },
  // Small fireworks bloom far away, low over the town, without sound.
  fireworks: { dur: 10, draw(g, W, H, p, r) {
    for (let i = 0; i < 4; i++) {
      const q = (p - i * 0.2) / 0.32; if (q < 0 || q > 1) continue;
      const x = W * (0.15 + 0.7 * r[i]); const y = H * (0.14 + 0.14 * r[i + 4]); const R = 18 + 38 * Math.sqrt(q); const a = 1 - q;
      const col = ['255,190,120', '255,160,200', '170,220,255', '220,255,170'][i];
      g.fillStyle = `rgba(${col},${a})`;
      for (let k = 0; k < 20; k++) { const an = (k / 20) * Math.PI * 2 + r[i] * 3; g.beginPath(); g.arc(x + Math.cos(an) * R, y + Math.sin(an) * R + q * 12, 3.6, 0, Math.PI * 2); g.fill(); }
      glow(g, x, y, R * 1.2, col, 0.35 * a);
    }
  } },
  // An airship with lit windows glides slowly across.
  airship: { dur: 26, draw(g, W, H, p, r) {
    const x = -W * 0.2 + W * 1.4 * p; const y = H * (0.2 + 0.12 * r[0]);
    g.fillStyle = 'rgba(200,190,220,.95)'; g.beginPath(); g.ellipse(x, y, 70, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(170,160,200,.95)'; g.beginPath(); g.moveTo(x - 62, y); g.lineTo(x - 84, y - 16); g.lineTo(x - 84, y + 16); g.closePath(); g.fill();
    g.fillStyle = 'rgba(90,84,120,.95)'; g.fillRect(x - 18, y + 22, 36, 11);
    g.fillStyle = 'rgba(255,214,150,1)'; [-11, 0, 11].forEach((dx) => g.fillRect(x + dx - 3, y + 25, 6, 5));
    glow(g, x, y + 28, 30, '255,214,150', 0.3);
  } },
  // Warm sky lanterns rise slowly, one by one.
  lanterns: { dur: 18, draw(g, W, H, p, r, t) {
    for (let i = 0; i < 6; i++) {
      const q = p * 1.3 - i * 0.06; if (q < 0) continue;
      const x = W * (0.1 + 0.8 * r[i]) + 10 * Math.sin(t * 0.5 + i); const y = H * (1.1 - 1.1 * q); const a = Math.min(1, (1 - p) * 5);
      glow(g, x, y, 26, '255,190,110', 0.45 * a);
      g.fillStyle = `rgba(255,214,150,${0.95 * a})`; g.beginPath(); g.moveTo(x - 8, y - 11); g.lineTo(x + 8, y - 11); g.lineTo(x + 6, y + 10); g.lineTo(x - 6, y + 10); g.closePath(); g.fill();
    }
  } },
  // Soft ribbons of green and violet light ripple across the top of the sky.
  aurora: { dur: 24, draw(g, W, H, p, r, t) {
    const a = ease(p, 0.25) * 0.55;
    [['120,230,180', 0.18, 0], ['170,140,240', 0.26, 2]].forEach(([col, yy, ph]) => {
      const gr = g.createLinearGradient(0, H * (yy - 0.12), 0, H * (yy + 0.14)); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, H * (yy + 0.14));
      for (let x = 0; x <= W; x += 20) g.lineTo(x, H * (yy - 0.1) + 22 * Math.sin(x / 90 + t * 0.5 + ph + r[0] * 6));
      g.lineTo(W, H * (yy + 0.14)); g.closePath(); g.fill();
    });
  } },
};

function viewArt(view) {
  // Drawn inside the window clip (x 110..430, y 70..330).
  switch (view) {
    case 'sea': return `<path d="M100 250 L440 250 L440 340 L100 340 Z" class="sea"/><path d="M120 262 Q160 256 200 262 T280 262 T360 262 T440 262" class="wave"/><path d="M140 282 Q180 276 220 282 T300 282 T380 282" class="wave"/><circle cx="350" cy="140" r="26" class="moon"/>`;
    case 'forest': return `<path d="M100 340 L100 240 L130 200 L150 240 L170 180 L200 240 L230 190 L260 250 L290 200 L320 245 L350 185 L380 240 L410 205 L440 250 L440 340 Z" class="trees"/><circle cx="170" cy="130" r="22" class="moon"/>`;
    case 'stars': return `<path d="M100 330 Q200 300 280 318 T440 300 L440 340 L100 340 Z" class="hill"/><g class="milky"><ellipse cx="270" cy="160" rx="200" ry="34" transform="rotate(-18 270 160)"/></g>`;
    case 'sakura': return `<path d="M100 300 L440 300 L440 340 L100 340 Z" class="street"/><g class="sakura-trees"><circle cx="150" cy="230" r="46"/><circle cx="250" cy="215" r="52"/><circle cx="360" cy="228" r="48"/></g><path d="M150 300 L150 260 M250 300 L250 250 M360 300 L360 262" stroke="#3a2a2a" stroke-width="7"/>`;
    case 'snow': return `<path d="M100 300 Q190 280 270 296 T440 288 L440 340 L100 340 Z" class="snowfield"/><path d="M140 300 L140 250 L170 230 L200 250 L200 300 Z M300 296 L300 240 L340 214 L380 240 L380 296 Z" class="house"/><rect x="155" y="262" width="14" height="14" class="lit"/><rect x="330" y="252" width="16" height="16" class="lit"/>`;
    default: return `<g class="city"><rect x="110" y="220" width="46" height="120"/><rect x="160" y="190" width="38" height="150"/><rect x="202" y="240" width="56" height="100"/><rect x="262" y="170" width="42" height="170"/><rect x="308" y="215" width="50" height="125"/><rect x="362" y="195" width="40" height="145"/><rect x="406" y="235" width="40" height="105"/></g><g class="neon"><rect x="170" y="210" width="6" height="6" class="t"/><rect x="184" y="230" width="6" height="6" class="p"/><rect x="272" y="190" width="6" height="6" class="p"/><rect x="286" y="250" width="6" height="6" class="t"/><rect x="318" y="235" width="6" height="6" class="l"/><rect x="372" y="215" width="6" height="6" class="t"/><rect x="214" y="260" width="6" height="6" class="l"/><rect x="120" y="240" width="6" height="6" class="l"/><rect x="380" y="265" width="6" height="6" class="p"/></g>`;
  }
}

function propArt(prop) {
  // Drawn on the desk, slot at x 230..330, desk top y 430. The front-left corner
  // (x 60..170, below the pillow) stays clear of the title cards on every layout.
  switch (prop) {
    case 'plant': return `<g class="prop-plant"><path d="M262 430 L268 392 L304 392 L310 430 Z" class="pot"/><path d="M286 392 C270 360 250 356 240 340 C264 344 280 356 286 392 Z M286 392 C300 356 316 348 334 344 C322 362 304 370 286 392 Z" class="leafy"/></g>`;
    case 'goldfish': return `<g class="prop-fish"><ellipse cx="286" cy="404" rx="40" ry="30" class="bowl"/><path d="M276 404 C284 396 296 398 300 404 C296 410 284 412 276 404 Z M276 404 L266 398 L266 410 Z" class="fish"/></g>`;
    // Boom box: two speakers and the cassette deck centred between them.
    case 'radio': return `<g class="prop-radio"><path d="M256 382 L256 372 L320 372 L320 382" class="radio-handle"/><rect x="230" y="382" width="116" height="48" rx="8" class="radio"/><circle cx="256" cy="406" r="14" class="spk"/><circle cx="320" cy="406" r="14" class="spk"/><rect x="274" y="395" width="28" height="22" rx="3" class="radio-tape"/><circle cx="282" cy="406" r="3.2" class="radio-reel"/><circle cx="294" cy="406" r="3.2" class="radio-reel"/></g>`;
    case 'record': return `<g class="prop-record"><rect x="236" y="404" width="110" height="26" rx="5" class="radio"/><ellipse cx="282" cy="404" rx="40" ry="9" class="vinyl"/><ellipse cx="282" cy="404" rx="10" ry="3" class="label"/><path d="M330 398 L314 408" stroke="#F6EEDD" stroke-width="3" stroke-linecap="round"/></g>`;
    case 'candle': return `<g class="prop-candle"><rect x="276" y="392" width="20" height="38" rx="3" class="wax"/><path class="flame" d="M286 380 C280 372 284 364 286 358 C288 364 292 372 286 380 Z"/></g>`;
    case 'globe': return `<g class="prop-globe"><circle cx="286" cy="392" r="26" class="globe"/><path d="M270 384 C278 378 292 380 296 388 C290 396 278 398 270 384 Z" class="land"/><path d="M286 418 L286 430 M270 430 L302 430" stroke="${LINE}" stroke-width="5"/></g>`;
    default: return '';
  }
}

function mateArt(mate) {
  switch (mate) {
    case 'fish': return `<g class="mate"><ellipse cx="900" cy="236" rx="30" ry="24" class="bowl"/><path d="M892 236 C898 230 908 232 911 236 C908 241 898 243 892 236 Z M892 236 L884 231 L884 241 Z" class="fish"/></g>`;
    case 'bird': return `<g class="mate bird"><ellipse cx="900" cy="236" rx="18" ry="14" fill="#F6EEDD" stroke="${LINE}" stroke-width="3"/><circle cx="908" cy="230" r="2.5" fill="${LINE}"/><path d="M916 234 L924 236 L916 238 Z" fill="#FFB56B"/><path d="M886 236 L874 230 L878 240 Z" fill="#9BB0A5" stroke="${LINE}" stroke-width="2"/></g>`;
    case 'dopakichi': return `<g class="mate dopa" transform="translate(900 236) scale(.075) translate(-917 -1000)"><ellipse cx="505" cy="785" rx="172" ry="174" fill="#FF97BF" stroke="#000" stroke-width="18"/><ellipse cx="1329" cy="785" rx="172" ry="174" fill="#FF97BF" stroke="#000" stroke-width="18"/><path d="M604 823 C604 650 734 541 917 541 C1100 541 1230 650 1230 823 C1230 1000 1100 1080 917 1080 C734 1080 604 1000 604 823Z" fill="#FF97BF" stroke="#000" stroke-width="18"/><path d="M917 631 C1082 631 1185 694 1185 834 C1185 974 1060 1030 917 1030 C774 1030 649 974 649 834 C649 694 752 631 917 631Z" fill="#FFF3E4" stroke="#000" stroke-width="14"/><path d="M740 850 Q787 880 834 850 M1000 850 Q1047 880 1094 850" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round"/><text x="1180" y="560" font-size="160" fill="#F6EEDD">z</text></g>`;
    default: return '';
  }
}

// A pot at x (desk top y 430) with `leaves` leaves (0..9) and maybe a flower.
function potArt(x, leaves, flower, cls = '') {
  const top = 392 - Math.max(3, leaves) * 6 - 10;
  let h = `<g class="plantpot ${cls}"><path d="M${x - 25} 430 L${x - 19} 396 L${x + 19} 396 L${x + 25} 430 Z" class="pot"/>`;
  if (leaves > 0 || flower) h += `<path d="M${x} 396 C${x - 1} ${(396 + top) / 2} ${x + 1} ${top + 10} ${x} ${top}" class="stem"/>`;
  for (let i = 0; i < leaves; i++) {
    const y = 390 - i * 6; const left = i % 2 === 0; const len = 13 + (i % 3) * 4;
    h += `<path d="M${x} ${y} C${left ? x - 15 : x + 15} ${y - 6} ${left ? x - len : x + len} ${y - 14} ${left ? x - len : x + len} ${y - 18} C${left ? x - 10 : x + 10} ${y - 16} ${x + 2} ${y - 8} ${x} ${y} Z" class="leaf"/>`;
  }
  if (flower) h += `<g class="flower" transform="translate(${x} ${top})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="6" ry="9" cy="-8" transform="rotate(${a})" class="petal"/>`).join('')}<circle r="5" class="pistil"/></g>`;
  return `${h}</g>`;
}

let uid = 0;
// The default view (id031, picture-book night): a rainy city across a river,
// drawn for the window rect (wx, wy, ww, wh). Far, mid and near layers lose
// contrast with distance; lit windows are warm dots.
function cityArt(wx, wy, ww, wh) {
  const r = (x, y, w, h, c) => `<rect x="${(wx + x * ww).toFixed(1)}" y="${(wy + y * wh).toFixed(1)}" width="${(w * ww).toFixed(1)}" height="${(h * wh).toFixed(1)}" class="${c}"/>`;
  const far = [[0, .48, .1, .3], [.08, .4, .07, .4], [.17, .52, .12, .3], [.3, .36, .06, .44], [.38, .5, .1, .3], [.5, .42, .08, .4], [.6, .55, .12, .3], [.74, .38, .07, .44], [.83, .5, .1, .32], [.93, .44, .08, .4]];
  const mid = [[.02, .58, .12, .3], [.15, .5, .08, .4], [.26, .62, .1, .26], [.39, .54, .09, .36], [.52, .6, .11, .3], [.66, .5, .08, .4], [.77, .6, .11, .3], [.9, .56, .1, .34]];
  let lit = '';
  mid.forEach(([x, y, w], i) => { for (let k = 0; k < 4; k++) { const lx = x + w * (.2 + .3 * ((k + i) % 3)); const ly = y + .05 + .07 * Math.floor(k / 2) + (i % 2) * .03; if ((k * 7 + i * 3) % 5 < 3) lit += r(lx, ly, .012, .022, 'litwin'); } });
  const river = `<rect x="${wx}" y="${(wy + wh * .86).toFixed(1)}" width="${ww}" height="${(wh * .14).toFixed(1)}" class="river"/>${[.1, .27, .45, .63, .8].map((x) => r(x, .89, .06, .008, 'glint')).join('')}`;
  const bushes = `<path class="bush" d="M${wx} ${wy + wh} L${wx} ${wy + wh * .9} ${Array.from({ length: 9 }, (_, i) => `Q${(wx + ww * (i + .5) / 9).toFixed(1)} ${(wy + wh * (i % 2 ? .84 : .87)).toFixed(1)} ${(wx + ww * (i + 1) / 9).toFixed(1)} ${(wy + wh * .9).toFixed(1)}`).join(' ')} L${wx + ww} ${wy + wh} Z"/>`;
  return `<g class="city2">${far.map(([x, y, w, h]) => r(x, y, w, h, 'far')).join('')}${mid.map(([x, y, w, h]) => r(x, y, w, h, 'mid')).join('')}${lit}${river}${bushes}</g>`;
}

// The wall clock follows the time of day (dusk 18:00 .. dawn 5:00).
function clockHands(t) {
  const hour = (18 + 11 * t) % 12; const min = ((18 + 11 * t) % 1) * 60;
  return { h: hour * 30 + min * 0.5, m: min * 6 };
}

function scene({ room = 'night', view = 'city', prop = 'mug', mate = 'none' } = {}) {
  const u = `r${uid++}`;
  const R = ROOMS[room] || ROOMS.night;
  const beams = R.beams ? `<path d="M0 0 L380 0 L0 140 Z" class="beam"/><path d="M1000 0 L640 0 L1000 140 Z" class="beam"/>` : '';
  const logs = R.logs ? Array.from({ length: 9 }, (_, i) => `<path d="M0 ${30 + i * 46} L1000 ${30 + i * 46}" class="log"/>`).join('') : '';
  const shoji = R.engawa ? `<g class="shoji">${Array.from({ length: 6 }, (_, i) => `<path d="M${560 + i * 70} 40 L${560 + i * 70} 330"/>`).join('')}<path d="M520 120 L1000 120 M520 210 L1000 210"/></g>` : '';
  const cafe = R.cafe ? `<g class="cafe-sign"><path d="M690 58 L800 58 L800 102 L690 102 Z"/><text x="745" y="89" text-anchor="middle">CAFE</text></g>` : '';
  const trainSeats = R.train ? `<path d="M0 360 L1000 360 L1000 430 L0 430 Z" class="seat"/>` : '';
  const win = R.train ? { x: 90, y: 90, w: 820, h: 210 } : { x: 60, y: 50, w: 390, h: 268 };
  // Older views were drawn for the window 110,70 320x260: map them onto this one.
  const fit = `translate(${win.x} ${win.y}) scale(${(win.w / 320).toFixed(4)} ${(win.h / 260).toFixed(4)}) translate(-110 -70)`;
  const viewG = view === 'city' && !R.train ? cityArt(win.x, win.y, win.w, win.h) : `<g transform="${fit}">${viewArt(view)}</g>`;
  const mx = win.x + win.w / 2; const my = win.y + win.h / 2;
  const bulbs = Array.from({ length: 7 }, (_, i) => { const x = 584 + i * 66; const y = 24 + (i % 2 ? 14 : 6); return `<g class="bulbg"><circle cx="${x}" cy="${y + 8}" r="13" class="bulb-glow b${i % 3}"/><path d="M${x - 3} ${y} L${x + 3} ${y}" class="bulb-cap"/><ellipse cx="${x}" cy="${y + 8}" rx="5" ry="7" class="bulb-g b${i % 3}"/></g>`; }).join('');
  const ck = clockHands(0.35);
  return `<svg xmlns="${NS}" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice" class="room-svg" aria-hidden="true">
  <defs>
    <linearGradient id="sky${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bot)"/></linearGradient>
    <radialGradient id="glow${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD9A8" stop-opacity=".7"/><stop offset=".5" stop-color="#FFB56B" stop-opacity=".22"/><stop offset="1" stop-color="#FFB56B" stop-opacity="0"/></radialGradient>
    <filter id="soft${u}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
    <linearGradient id="cone${u}" gradientUnits="userSpaceOnUse" x1="817" y1="336" x2="880" y2="436"><stop offset="0" stop-color="#FFE7BE" stop-opacity=".55"/><stop offset=".7" stop-color="#FFD9A8" stop-opacity=".16"/><stop offset="1" stop-color="#FFD9A8" stop-opacity="0"/></linearGradient>
    <radialGradient id="pool${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD9A8" stop-opacity=".85"/><stop offset=".6" stop-color="#FFB56B" stop-opacity=".25"/><stop offset="1" stop-color="#FFB56B" stop-opacity="0"/></radialGradient>
    <clipPath id="winclip${u}"><rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" rx="10"/></clipPath>
    <pattern id="paper${u}" width="40" height="600" patternUnits="userSpaceOnUse"><rect width="40" height="600" fill="none"/><rect x="0" width="1.4" height="600" fill="#fff" opacity=".035"/></pattern>
  </defs>
  <rect x="0" y="0" width="1000" height="600" class="wall"/>
  <rect x="0" y="0" width="1000" height="430" fill="url(#paper${u})"/>
  ${beams}${logs}${shoji}
  <g class="lights"><path d="M556 22 Q617 50 650 34 Q683 50 716 32 Q749 50 782 34 Q815 50 848 32 Q881 50 914 34 Q947 50 980 32 Q995 30 1010 26" class="lights-wire"/>${bulbs}</g>
  <g class="lamp-glow"><circle cx="817" cy="336" r="200" fill="url(#glow${u})"/></g>
  <path class="lamp-cone" d="M784 354 L851 316 L1000 432 L736 432 Z" fill="url(#cone${u})" filter="url(#soft${u})"/>
  <g clip-path="url(#winclip${u})" class="window-view">
    <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" fill="url(#sky${u})"/>
    <g class="stars">${Array.from({ length: 30 }, (_, i) => `<circle cx="${(win.x + 10 + ((i * 97) % (win.w - 20))).toFixed(0)}" cy="${(win.y + 8 + ((i * 53) % (win.h * 0.4))).toFixed(0)}" r="${(1 + (i % 3) * 0.6).toFixed(1)}" class="star s${i % 4}"/>`).join('')}</g>
    <g class="moonlate"${view === "sea" || view === "forest" ? ' display="none"' : ''}><path class="moon" d="M${win.x + 78} ${win.y + 28} C${win.x + 58} ${win.y + 30} ${win.x + 46} ${win.y + 48} ${win.x + 50} ${win.y + 66} C${win.x + 54} ${win.y + 84} ${win.x + 74} ${win.y + 94} ${win.x + 92} ${win.y + 88} C${win.x + 76} ${win.y + 84} ${win.x + 66} ${win.y + 70} ${win.x + 67} ${win.y + 55} C${win.x + 68} ${win.y + 42} ${win.x + 76} ${win.y + 32} ${win.x + 86} ${win.y + 28} C${win.x + 83} ${win.y + 27} ${win.x + 80} ${win.y + 27} ${win.x + 78} ${win.y + 28} Z"/></g>
    <g class="view">${viewG}</g>
    <g class="clouds">${[[0.12, 0.16, 1], [0.45, 0.1, 1.2], [0.8, 0.27, 1.1], [0.3, 0.4, 0.9]].map(([fx, fy, k], i) => `<g transform="translate(${(win.x + win.w * fx).toFixed(0)} ${(win.y + win.h * fy).toFixed(0)}) scale(${k})"><path class="cloud c${i}" d="M-46 10 C-50 -4 -34 -10 -24 -4 C-20 -18 2 -20 8 -6 C16 -14 34 -10 34 2 C46 2 48 14 38 16 L-40 16 C-50 16 -52 10 -46 10 Z"/></g>`).join('')}</g>
    <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" class="wx-dim"/>
  </g>
  <foreignObject x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" class="weather-fo"><canvas xmlns="http://www.w3.org/1999/xhtml" class="weather" width="${win.w * 2}" height="${win.h * 2}"></canvas></foreignObject>
  <path class="frame" fill-rule="evenodd" d="M${win.x - 18} ${win.y - 8} Q${win.x - 18} ${win.y - 18} ${win.x - 8} ${win.y - 18} L${win.x + win.w + 8} ${win.y - 18} Q${win.x + win.w + 18} ${win.y - 18} ${win.x + win.w + 18} ${win.y - 8} L${win.x + win.w + 18} ${win.y + win.h + 8} Q${win.x + win.w + 18} ${win.y + win.h + 18} ${win.x + win.w + 8} ${win.y + win.h + 18} L${win.x - 8} ${win.y + win.h + 18} Q${win.x - 18} ${win.y + win.h + 18} ${win.x - 18} ${win.y + win.h + 8} Z M${win.x} ${win.y + 10} Q${win.x} ${win.y} ${win.x + 10} ${win.y} L${win.x + win.w - 10} ${win.y} Q${win.x + win.w} ${win.y} ${win.x + win.w} ${win.y + 10} L${win.x + win.w} ${win.y + win.h - 10} Q${win.x + win.w} ${win.y + win.h} ${win.x + win.w - 10} ${win.y + win.h} L${win.x + 10} ${win.y + win.h} Q${win.x} ${win.y + win.h} ${win.x} ${win.y + win.h - 10} Z"/>
  <rect class="mullion" x="${mx - 6}" y="${win.y}" width="12" height="${win.h}"/><rect class="mullion" x="${win.x}" y="${my - 6}" width="${win.w}" height="12"/>
  <rect class="sill" x="${win.x - 30}" y="${win.y + win.h + 14}" width="${win.w + 60}" height="14" rx="5"/>
  <g class="sill-pots" transform="translate(${win.x + 18} ${win.y + win.h + 14})"></g>
  ${R.train ? '' : `<path class="rod" d="M${win.x - 36} ${win.y - 30} L${win.x + win.w + 76} ${win.y - 30}"/>`}
  ${R.train ? '' : `<path class="curtain" d="M${win.x + win.w - 30} ${win.y - 30} L${win.x + win.w + 66} ${win.y - 30} C${win.x + win.w + 70} ${win.y + 60} ${win.x + win.w + 52} ${win.y + 120} ${win.x + win.w + 40} ${win.y + 150} C${win.x + win.w + 52} ${win.y + 190} ${win.x + win.w + 72} ${win.y + 240} ${win.x + win.w + 74} ${win.y + win.h + 20} L${win.x + win.w + 22} ${win.y + win.h + 20} C${win.x + win.w + 22} ${win.y + 230} ${win.x + win.w + 30} ${win.y + 180} ${win.x + win.w + 36} ${win.y + 150} C${win.x + win.w + 10} ${win.y + 110} ${win.x + win.w - 24} ${win.y + 50} ${win.x + win.w - 30} ${win.y - 30} Z"/>
  <path class="tieback" d="M${win.x + win.w + 28} ${win.y + 146} Q${win.x + win.w + 44} ${win.y + 158} ${win.x + win.w + 58} ${win.y + 146}"/>`}
  ${cafe}
  ${R.train || R.cafe ? '' : `<g class="wallclock"><circle cx="618" cy="118" r="44" class="clock-rim"/><circle cx="618" cy="118" r="35" class="clock-face"/>${Array.from({ length: 12 }, (_, i) => `<path d="M618 87 L618 ${i % 3 ? 91 : 94}" transform="rotate(${i * 30} 618 118)" class="clock-tick"/>`).join('')}<path d="M618 118 L618 97" class="clock-h" transform="rotate(${ck.h.toFixed(1)} 618 118)"/><path d="M618 118 L618 90" class="clock-m" transform="rotate(${ck.m.toFixed(1)} 618 118)"/><circle cx="618" cy="118" r="3.5" class="clock-pin"/></g>`}
  <g class="shelf" data-hit="trophy"><rect x="812" y="186" width="182" height="14" rx="4" class="wood"/><path d="M828 200 L834 214 M978 200 L972 214" class="bracket"/>
    <rect x="820" y="120" width="20" height="66" rx="3" class="book b1"/><rect x="842" y="132" width="16" height="54" rx="3" class="book b2"/><rect x="860" y="114" width="22" height="72" rx="3" class="book b3"/><rect x="884" y="128" width="17" height="58" rx="3" class="book b4"/>
    <rect x="906" y="177" width="46" height="9" rx="2" class="book b5"/><rect x="910" y="168" width="40" height="9" rx="2" class="book b2"/>
    <g class="cups" transform="translate(63 -18)"><path d="M854 186 L860 176 L874 176 L880 186 Z" class="cup"/><path d="M860 176 L864 166 L870 166 L874 176" class="cup"/><path d="M850 136 L884 136 C884 158 874 166 867 166 C860 166 850 158 850 136 Z" class="cup"/><path d="M850 142 C838 142 838 156 852 158 M884 142 C896 142 896 156 882 158" class="cup-handle"/></g>
    <g transform="translate(70 -50)">${mateArt(mate)}</g></g>
  <g class="hanging"><path d="M818 192 C826 230 814 262 822 300" class="vine"/>${[[824, 210, 1], [816, 236, -1], [825, 258, 1], [818, 284, -1], [824, 306, 1]].map(([x, y, d]) => `<path d="M${x} ${y} C${x + d * 18} ${y - 8} ${x + d * 26} ${y + 4} ${x + d * 22} ${y + 14} C${x + d * 12} ${y + 16} ${x + d * 4} ${y + 10} ${x} ${y} Z" class="leaf2"/>`).join('')}</g>
  ${trainSeats}
  <rect x="0" y="430" width="1000" height="170" class="desk"/>
  ${Array.from({ length: 4 }, (_, i) => `<path d="M0 ${472 + i * 34} L1000 ${472 + i * 34}" class="plank"/>`).join('')}
  <rect x="0" y="426" width="1000" height="10" class="desk-edge"/><path d="M0 426 L1000 426" class="desk-line"/>
  <ellipse cx="872" cy="448" rx="190" ry="30" fill="url(#pool${u})" class="lamp-pool"/>
  <g class="lamp"><path d="M664 432 C664 418 726 418 726 432 Z" class="lamp-base"/><path d="M695 422 L728 330 L790 290" class="lamp-arm"/><circle cx="728" cy="330" r="6" class="lamp-joint"/><g transform="translate(817 335) rotate(-30)"><circle cx="0" cy="-2" r="34" fill="url(#pool${u})" class="bulb-halo"/><path d="M-12 -46 Q0 -58 12 -46 L40 -3 Q0 7 -40 -3 Z" class="lamp-shade"/><path d="M-12 -46 Q0 -50 12 -46" class="lamp-band"/><ellipse cx="0" cy="-3" rx="40" ry="9" class="lamp-mouth"/><ellipse cx="0" cy="-1" rx="15" ry="6.5" class="bulb"/></g></g>
  <g class="radio-hit" data-hit="collection">${propArt('radio').replace('prop-radio', 'deskradio')}</g>
  <g class="desk-prop" transform="translate(150 0)">${propArt(prop)}</g>
  <g class="mug"><path d="M560 430 L558 392 C558 386 598 386 598 392 L596 430 Z" class="mugbody"/><path d="M598 400 C616 400 616 422 596 420" class="mughandle"/><path d="M561 398 L597 398" class="mugband"/><path class="steam s1" d="M570 380 C562 362 578 352 570 334"/><path class="steam s2" d="M584 378 C576 358 592 348 584 328"/></g>
  <g class="pot-hit" data-hit="tree"><g class="potplant"></g></g>
  <g class="pillow" data-hit="pillow" display="none"><path d="M24 430 C18 402 30 390 70 392 C110 394 140 392 150 404 C158 416 154 428 148 430 Z" class="pillowbody"/><path d="M40 402 C40 396 46 392 52 394 M136 402 C138 396 132 392 126 394" class="pillowline"/></g>
  <g class="sticker-card" data-hit="bonus" display="none" transform="rotate(-4 116 472)"><rect x="62" y="446" width="108" height="52" rx="6" class="card"/><circle cx="90" cy="472" r="10" class="dot"/><circle cx="116" cy="472" r="10" class="dot"/><circle cx="142" cy="472" r="10" class="dot new"/></g>
  <rect x="0" y="0" width="1000" height="600" class="shade"/>
</svg>`;
}

export class Room {
  constructor(host, look = {}) {
    this.host = host;
    this.motion = 1;
    this.t = 0;
    this.clock = 0;
    this.daily = 'rain';
    this.weather = 'rain';
    this.drops = [];
    this.flakes = [];
    this.flow = 0;
    this.leaves = 0;
    this.ev = null; this.evWait = 8 + Math.random() * 12;
    this.setLook(look);
  }

  setLook({ room = 'night', view = 'city', prop = 'mug', mate = 'none', event = 'shooting' } = {}) {
    this.look = { room, view, prop, mate, event };
    this.host.innerHTML = scene(this.look);
    this.svg = this.host.firstElementChild;
    this.canvas = this.svg.querySelector('.weather');
    this.g = this.canvas.getContext('2d');
    this.svg.classList.add(`room-${room}`, `view-${view}`);
    this.setWeather(this.daily);
    this.shownT = null;
    this.setTime(this.t);
    this.drawPlant();
  }

  setMotion(m) { this.motion = m; }
  // Start a window event now (the collection preview; otherwise they come by
  // themselves every 35..75 s).
  playEvent(kind = this.look.event) {
    if (!EVENTS[kind]) return;
    this.ev = { kind, t: 0, r: Array.from({ length: 10 }, Math.random) };
    this.svg.classList.toggle('ev-fullmoon', kind === 'fullmoon'); // one moon at a time
  }
  // w: the day's weather (weather.js); the window view may turn it into its own kind.
  setWeather(w) {
    this.daily = w;
    this.weather = sceneWeather(w, this.look.view);
    if (!this.svg) return;
    for (const c of [...this.svg.classList]) if (c.startsWith('wx-')) this.svg.classList.remove(c);
    this.svg.classList.add(`wx-${this.weather}`);
    this.drops = []; this.flakes = [];
  }

  // t: 0 dusk .. 1 dawn
  setTime(t) {
    // Colours change slowly: skip updates too small to see (style recalcs are costly).
    if (this.svg && this.shownT != null && Math.abs(t - this.shownT) < 0.004) { this.t = t; return; }
    this.shownT = t;
    this.t = t;
    const c = timeColors(t);
    const s = this.host.style;
    s.setProperty('--sky-top', c.top); s.setProperty('--sky-bot', c.bot); s.setProperty('--wall', c.wall);
    s.setProperty('--lamp', (c.lamp + this.flow * 0.15).toFixed(3)); s.setProperty('--stars', c.stars.toFixed(3));
    s.setProperty('--moon-late', (t > 0.3 && t < 0.85 ? 1 : 0).toString());
    const ck = this.svg && this.svg.querySelector('.wallclock');
    if (ck) { const h = clockHands(t); ck.querySelector('.clock-h').setAttribute('transform', `rotate(${h.h.toFixed(1)} 618 118)`); ck.querySelector('.clock-m').setAttribute('transform', `rotate(${h.m.toFixed(1)} 618 118)`); }
  }
  setFlow(f) {
    if (this.shownFlow != null && Math.abs(f - this.shownFlow) < 0.03) return;
    this.shownFlow = f; this.flow = f;
    this.host.style.setProperty('--lamp', (timeColors(this.t).lamp + f * 0.15).toFixed(3));
  }

  // One leaf per solved problem (id038): a pot grows nine leaves and flowers
  // on the tenth; then a new pot is set beside it and grows from the eleventh.
  // The desk holds the last flowered pot and the growing one; older flowered
  // pots move to the window sill. step() returns 'bloom' on a tenth problem.
  step(n = 1) { this.leaves += n; this.drawPlant(); return this.leaves % 10 === 0 ? 'bloom' : null; }
  setLeaves(n) { this.leaves = n; this.drawPlant(); }

  drawPlant() {
    const g = this.svg && this.svg.querySelector('.potplant');
    if (!g) return;
    const n = Math.max(0, this.leaves);
    const blooms = Math.floor(n / 10); const cur = n % 10;
    let html = '';
    if (blooms === 0) html += potArt(868, cur, false);
    else html += potArt(868, 9, true) + potArt(926, cur, false, cur === 0 ? 'new' : '');
    g.innerHTML = html;
    // Older flowered pots on the window sill (small), up to eight.
    const sill = this.svg.querySelector('.sill-pots');
    const old = Math.min(8, Math.max(0, blooms - 1));
    sill.innerHTML = Array.from({ length: old }, (_, i) => `<g transform="translate(${i * 34} 0) scale(.55) translate(-885 -430)">${potArt(885, 9, true)}</g>`).join('');
  }

  showPillow(on) { this.svg.querySelector('.pillow').setAttribute('display', on ? 'inline' : 'none'); }
  showSticker(on) { this.svg.querySelector('.sticker-card').setAttribute('display', on ? 'inline' : 'none'); }

  update(dt) {
    this.clock += dt;
    const m = this.motion;
    const svg = this.svg;
    // Steam and curtain sway (slow, small), stars twinkle.
    const t = this.clock;
    svg.querySelectorAll('.steam').forEach((s, i) => { s.style.opacity = (0.25 + 0.2 * Math.sin(t * 0.9 + i * 2)) * (m ? 1 : 0.4); s.setAttribute('transform', m ? `translate(${Math.sin(t * 0.6 + i) * 3} ${-((t * 6 + i * 10) % 14)})` : ''); });
    const c = svg.querySelector('.curtain');
    if (c) c.setAttribute('transform', m ? `skewX(${(Math.sin(t / 9 * Math.PI * 2) * 1.2).toFixed(2)})` : '');
    if (m) svg.querySelectorAll('.star').forEach((s, i) => { if ((i + Math.floor(t)) % 7 === 0) s.style.opacity = 0.5 + 0.5 * Math.sin(t * 2 + i); });
    if (m) svg.querySelectorAll('.cloud').forEach((c, i) => { c.style.transform = `translateX(${(Math.sin(t / (60 + i * 17) + i) * 26).toFixed(1)}px)`; });
    this.drawWeather(dt);
    this.drawEvent(dt);
  }

  drawEvent(dt) {
    if (!this.motion || !EVENTS[this.look.event] && !this.ev) return;
    if (!this.ev) {
      this.evWait -= dt;
      if (this.evWait <= 0) { this.evWait = 35 + Math.random() * 40; this.playEvent(); }
      return;
    }
    const e = EVENTS[this.ev.kind];
    this.ev.t += dt;
    const p = this.ev.t / e.dur;
    if (p >= 1) { this.ev = null; this.svg.classList.remove('ev-fullmoon'); return; }
    const g = this.g; g.save();
    e.draw(g, this.canvas.width, this.canvas.height, p, this.ev.r, this.clock);
    g.restore();
  }

  drawWeather(dt) {
    const cv = this.canvas; const g = this.g; const W = cv.width; const H = cv.height;
    g.clearRect(0, 0, W, H);
    if (!this.motion && this.weather !== 'clear') {
      // Still frame: a few drops resting on the glass.
      g.fillStyle = 'rgba(220,230,255,.35)';
      for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 137) % W, (i * 89) % H, 3, 0, Math.PI * 2); g.fill(); }
      return;
    }
    const k = this.motion;
    if (this.weather === 'rain') {
      while (this.drops.length < 22 * k) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 260 + Math.random() * 260, l: 8 + Math.random() * 10 });
      g.strokeStyle = 'rgba(200,215,255,.28)'; g.lineWidth = 1.3;
      g.beginPath();
      for (const d of this.drops) { d.y += d.v * dt; d.x -= d.v * dt * 0.08; if (d.y > H) { d.y = -d.l; d.x = Math.random() * W * 1.1; } g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.08, d.y - d.l); }
      g.stroke();
    } else if (this.weather === 'snow' || this.weather === 'petals') {
      const petals = this.weather === 'petals';
      while (this.flakes.length < (petals ? 26 : 70) * k) this.flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 30 + Math.random() * 50, r: 2 + Math.random() * 4, p: Math.random() * 6 });
      g.fillStyle = petals ? 'rgba(255,190,210,.9)' : 'rgba(255,255,255,.85)';
      for (const f of this.flakes) {
        f.y += f.v * dt; f.p += dt; f.x += Math.sin(f.p) * 0.6;
        if (f.y > H) { f.y = -5; f.x = Math.random() * W; }
        g.beginPath();
        if (petals) g.ellipse(f.x, f.y, f.r * 1.4, f.r * 0.8, f.p, 0, Math.PI * 2); else g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // Element under a screen point that opens something (plant, shelf, radio, pillow, card).
  hitAt(target) { const h = target.closest && target.closest('[data-hit]'); return h ? h.dataset.hit : null; }
}
