// チルネコ: the mascot as a live SVG puppet. Built from the parts of
// docs/chill-neko.svg (same coordinates, IDs and colour classes, see
// the design notes 5.1); arms are drawn every frame so a paw can reach a
// notebook cell, eyelids open by any amount, and poses blend slowly.
// Non-verbal: everything is told with eyes, ears, tail, paws and posture.

const NS = 'http://www.w3.org/2000/svg';
// Colour variants (collection). The coat is cream with two patch colours:
// a (left ear, feet, the patch over the left eye) and b (right ear, the patch
// on the right of the head and on the belly). `fur` is the swatch colour.
export const PALETTES = {
  lavender: { cream: '#FFF4EC', a: '#8ED3F5', b: '#CBA7C8', iris: '#9FCFE3' },
  sage: { cream: '#FFF5E8', a: '#A9CF9E', b: '#E3C48C', iris: '#A9CF9E' },
  oatmeal: { cream: '#FFF6EA', a: '#E8C9A0', b: '#B89C84', iris: '#C9AE8C' },
  bluegrey: { cream: '#F7F3EE', a: '#A7C4E6', b: '#7F93B0', iris: '#A7C4E6' },
  warmgrey: { cream: '#FFF3EE', a: '#F2B8C6', b: '#BDB2AD', iris: '#E6A9B8' },
  night: { cream: '#EFE6DA', a: '#6F7FB8', b: '#4A4F7A', iris: '#8EA0D8' },
  rainbow: { cream: '#FFF4EC', a: '#8ED3F5', b: '#CBA7C8', iris: '#9FCFE3', rainbow: true },
};
for (const p of Object.values(PALETTES)) p.fur = p.b;
const LINE = '#2B2A33';

// The crown of the head (top centre). Accessories are drawn around (0, 0)
// here and live inside the head group, so they follow every tilt, nod and
// squash of the head (the head is an ellipse of rx 338, ry 300 below it).
export const CROWN = { x: 917, y: 515 };
export const ACCESSORIES = {
  none: '',
  headphones: `<path d="M-330 290 C-345 -150 345 -150 330 290" fill="none" stroke="${LINE}" stroke-width="40" stroke-linecap="round"/><path d="M-330 290 C-345 -150 345 -150 330 290" fill="none" stroke="#3A3F7A" stroke-width="22" stroke-linecap="round"/><rect x="-386" y="210" width="84" height="160" rx="38" fill="#F08BB0" stroke="${LINE}" stroke-width="14"/><rect x="302" y="210" width="84" height="160" rx="38" fill="#F08BB0" stroke="${LINE}" stroke-width="14"/>`,
  knit: `<path d="M-268 118 C-258 -96 258 -96 268 118 Z" fill="#3FB3A3" stroke="${LINE}" stroke-width="14" stroke-linejoin="round"/><path d="M-120 -40 L-110 100 M0 -60 L0 100 M120 -40 L110 100" stroke="#2E8C80" stroke-width="12" stroke-linecap="round"/><rect x="-292" y="100" width="584" height="62" rx="28" fill="#2E8C80" stroke="${LINE}" stroke-width="14"/><circle cx="0" cy="-92" r="44" fill="#F6EEDD" stroke="${LINE}" stroke-width="14"/>`,
  beret: `<path d="M-250 70 C-280 -40 -60 -110 110 -78 C260 -50 300 40 236 78 C120 110 -120 110 -250 70 Z" fill="#D9576A" stroke="${LINE}" stroke-width="14" stroke-linejoin="round"/><path d="M40 -92 L58 -140" stroke="${LINE}" stroke-width="18" stroke-linecap="round"/>`,
  nightcap: `<path d="M-268 120 C-210 -70 40 -130 190 -50 C270 -6 330 80 350 180 L300 150 L268 120 Z" fill="#2A2D5E" stroke="${LINE}" stroke-width="14" stroke-linejoin="round"/><rect x="-292" y="100" width="584" height="58" rx="26" fill="#F6EEDD" stroke="${LINE}" stroke-width="14"/><circle cx="356" cy="192" r="36" fill="#F6EEDD" stroke="${LINE}" stroke-width="14"/><circle cx="20" cy="-10" r="11" fill="#FFD9A8"/><circle cx="120" cy="20" r="9" fill="#FFD9A8"/>`,
  leaf: `<path d="M0 14 C-70 -50 -50 -150 40 -170 C76 -84 56 -20 0 14 Z" fill="#3FB3A3" stroke="${LINE}" stroke-width="14" stroke-linejoin="round"/><path d="M0 14 C12 -50 26 -110 38 -160" fill="none" stroke="${LINE}" stroke-width="9" stroke-linecap="round"/>`,
  crown: `<path d="M-130 34 L-142 -96 L-64 -40 L0 -122 L64 -40 L142 -96 L130 34 Z" fill="#FFB56B" stroke="${LINE}" stroke-width="14" stroke-linejoin="round"/><circle cx="0" cy="-6" r="20" fill="#F08BB0" stroke="${LINE}" stroke-width="10"/>`,
};

// Shapes are traced from the character sheet (the original character sheet,
// front view, in its pixel coordinates) and mapped into this SVG's units:
// the head top (287.5, 132) on the sheet is the crown (917, 515) here.
const K = 1.77;
const ux = (x) => 917 + (x - 287.5) * K;
const uy = (y) => 515 + (y - 132) * K;
const P = (x, y) => `${ux(x).toFixed(1)} ${uy(y).toFixed(1)}`;
// Map every "x y" pair of an absolute path written in sheet pixels.
const T = (d) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (m, x, y) => P(Number(x), Number(y)));
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (m, x, y) => `${575 - Number(x)} ${y}`);

const EYE = { L: { cx: ux(188), cy: uy(323.5) }, R: { cx: ux(386.5), cy: uy(323.5) }, rx: 50 * K, ry: 41.5 * K };
const IRIS_R = 26.5 * K;
const SHOULDER = { L: { x: ux(214), y: uy(463) }, R: { x: ux(361), y: uy(463) } };
const REST = { L: { x: ux(164), y: uy(501) }, R: { x: ux(406), y: uy(501) } };
const REST_LEN = Math.hypot(SHOULDER.L.x - REST.L.x, SHOULDER.L.y - REST.L.y);
const HAND_R = 33 * K;

// Sheet-pixel outlines.
const HEAD_LINE = 'M204 443 C150 430 100 390 98 320 C96 210 185 132 287.5 132 C390 132 479 210 477 320 C475 390 425 430 371 443';
const HEAD_FILL = `${HEAD_LINE} L287.5 474 Z`;
const BODY_LINE = 'M204 443 C190 452 180 462 176 472 C168 495 167 520 178 538 C190 565 235 583 287.5 583 C340 583 385 565 397 538 C408 520 407 495 399 472 C395 462 385 452 371 443';
const EAR_L = 'M202 160 C180 146 122 144 92 167 C66 187 54 210 62 228 C72 250 92 262 112 270 L210 300 Z';
const PATCH_A = 'M200 148 C228 172 252 205 248 240 C245 270 230 290 205 308 C185 322 160 340 125 345 C110 346 100 340 90 330 L70 140 Z';
const PATCH_B = 'M352 138 C335 160 326 185 330 205 C334 228 352 242 375 250 C400 258 418 268 428 290 C436 308 450 320 482 322 L500 120 Z';
const PATCH_BELLY = 'M371 449 C352 458 341 470 335 481 C328 495 318 510 302 520 C288 532 286 550 290 566 C292 575 294 581 296 592 L425 592 L425 440 Z';
// The face: the mouth is an ω; when it opens, it opens below the ω.
const MOUTH = {
  w: 'M257 374 C257 396 286 398 288 378 C290 398 319 396 317 374',
  smile: 'M255 371 C258 388 279 389 288 377 C297 389 318 388 321 371 C323 400 307 419 288 419 C269 419 253 400 255 371 Z',
  line: 'M276 384 L300 384',
  o: 'M288 381 C296 381 299 390 299 395 C299 402 294 407 288 407 C282 407 277 402 277 395 C277 390 280 381 288 381 Z',
  yawn: 'M288 375 C300 375 304 388 304 396 C304 406 297 413 288 413 C279 413 272 406 272 396 C272 388 276 375 288 375 Z',
  sad: 'M271 398 C277 380 299 380 305 398',
};
const TONGUE = 'M270 410 C276 399 300 399 306 410 C299 418 277 418 270 410 Z';

let uid = 0;
function markup(id) {
  const eye = (k) => `<g class="eye eye-${k}"><g class="eye-open"><ellipse fill="#FFF" cx="${EYE[k].cx}" cy="${EYE[k].cy}" rx="${EYE.rx}" ry="${EYE.ry}"/><g clip-path="url(#clip-${k}${id})"><g class="iris-g"><circle class="iris line" cx="${EYE[k].cx}" cy="${EYE[k].cy + 2}" r="${IRIS_R}"/></g><path class="lid" fill="#FFF"/><path class="lid-line line" fill="none"/></g><ellipse class="line" fill="none" cx="${EYE[k].cx}" cy="${EYE[k].cy}" rx="${EYE.rx}" ry="${EYE.ry}"/></g><path class="eye-closed line" fill="none" d=""/></g>`;
  return `<svg xmlns="${NS}" viewBox="460 380 920 1060" class="neko-svg" aria-hidden="true" overflow="visible">
  <defs><style>.line{stroke:${LINE};stroke-width:11;stroke-linecap:round;stroke-linejoin:round}.fine{stroke:${LINE};stroke-width:9.5;stroke-linecap:round;fill:none}</style>
  <clipPath id="clip-L${id}"><ellipse cx="${EYE.L.cx}" cy="${EYE.L.cy}" rx="${EYE.rx}" ry="${EYE.ry}"/></clipPath>
  <clipPath id="clip-R${id}"><ellipse cx="${EYE.R.cx}" cy="${EYE.R.cy}" rx="${EYE.rx}" ry="${EYE.ry}"/></clipPath>
  <clipPath id="head${id}"><path d="${T(HEAD_FILL)}"/></clipPath>
  <clipPath id="body${id}"><path d="${T(BODY_LINE)} Z"/></clipPath>
  <clipPath id="mouth${id}"><path d="${T(MOUTH.smile)}"/></clipPath></defs>
  <g class="neko-root">
   <g class="tail-g"></g>
   <g class="feet-g"><ellipse class="line pa" cx="${ux(191)}" cy="${uy(581)}" rx="${54 * K}" ry="${25 * K}" transform="rotate(-22 ${ux(191)} ${uy(581)})"/><ellipse class="line pa" cx="${ux(384)}" cy="${uy(581)}" rx="${54 * K}" ry="${25 * K}" transform="rotate(22 ${ux(384)} ${uy(581)})"/></g>
   <g class="body-g">
    <path class="cream" d="${T(BODY_LINE)} Z"/>
    <g clip-path="url(#body${id})"><path class="pb" d="${T(PATCH_BELLY)}"/></g>
    <path class="line" fill="none" d="${T(BODY_LINE)}"/>
   </g>
   <g class="head-g">
    <g class="ear-L"><path class="line pa" d="${T(EAR_L)}"/></g>
    <g class="ear-R"><path class="line pb" d="${T(mirror(EAR_L))}"/></g>
    <path class="cream" d="${T(HEAD_FILL)}"/>
    <g clip-path="url(#head${id})"><path class="pa" d="${T(PATCH_A)}"/><path class="pb" d="${T(PATCH_B)}"/></g>
    <path class="line" fill="none" d="${T(HEAD_LINE)}"/>
    <path class="brows fine" d=""/>
    ${eye('L')}${eye('R')}
    <g class="cheeks"></g>
    <path class="fine" d="${T('M170 372 L135 379 M172.5 385 L139 394 M407 372 L442 379 M404 385 L438 394')}"/>
    <path class="mouth line" fill="none"/>
    <path class="tongue" d="${T(TONGUE)}" clip-path="url(#mouth${id})" fill="#F4A3AE" display="none"/>
    <g class="acc" transform="translate(${CROWN.x} ${CROWN.y})"></g>
   </g>
   <g class="arm-L"><path class="arm-o" fill="none" stroke="${LINE}" stroke-linecap="round"/><path class="arm-f" fill="none" stroke-linecap="round"/><circle class="line cream hand" r="${HAND_R}"/></g>
   <g class="arm-R"><g class="prop"></g><path class="arm-o" fill="none" stroke="${LINE}" stroke-linecap="round"/><path class="arm-f" fill="none" stroke-linecap="round"/><circle class="line cream hand" r="${HAND_R}"/></g>
  </g></svg>`;
}

// Props held in the right paw (drawn relative to the paw centre).
const PROPS = {
  none: '',
  // Pencil: tip down-left of the paw, the pink eraser end up-right.
  pencil: `<g class="pencil"><path d="M-40 70 L150 -120" stroke="${LINE}" stroke-width="44" stroke-linecap="round"/><path d="M-40 70 L150 -120" stroke="#FFB56B" stroke-width="34" stroke-linecap="butt"/><path d="M118 -88 L150 -120" stroke="#F08BB0" stroke-width="34"/><path d="M-40 70 L-78 108 L-30 96 Z" fill="#F3E6CF" stroke="${LINE}" stroke-width="5" stroke-linejoin="round"/><path d="M-66 96 L-78 108 L-70 104 Z" fill="${LINE}"/></g>`,
  // A small potted sprout, carried in when a plant flowers (id038).
  pot: `<g class="carry-pot" transform="translate(0 30) scale(1.35)"><path d="M0 -110 C-3 -140 3 -160 0 -176" fill="none" stroke="#3E7A5F" stroke-width="10" stroke-linecap="round"/><path d="M0 -170 C-30 -200 -60 -190 -66 -172 C-44 -160 -18 -160 0 -170 Z M0 -170 C30 -200 60 -190 66 -172 C44 -160 18 -160 0 -170 Z" fill="#3FB3A3" stroke="${LINE}" stroke-width="8" stroke-linejoin="round"/><path d="M-60 -20 L-48 -110 L48 -110 L60 -20 Z" fill="#C77B5A" stroke="${LINE}" stroke-width="12" stroke-linejoin="round"/></g>`,
  mug: `<g class="mug"><rect x="-70" y="-110" width="120" height="130" rx="18" fill="#F6EEDD" stroke="${LINE}" stroke-width="6"/><path d="M50 -80 C100 -80 100 -10 50 -10" fill="none" stroke="${LINE}" stroke-width="12"/><rect x="-60" y="-96" width="100" height="22" fill="#A86F52"/></g>`,
};
// Where the drawing point is, relative to the paw centre, for each prop.
const TIP = { pencil: { x: -74, y: 104 }, eraser: { x: 150, y: -120 }, paw: { x: 0, y: 0 } };

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

export class ChillNeko {
  constructor(host, { palette = 'lavender', accessory = 'none', size = 120 } = {}) {
    this.host = host;
    host.insertAdjacentHTML('beforeend', markup(`n${uid++}`));
    this.svg = host.lastElementChild;
    this.svg.style.width = `${size}px`;
    const q = (s) => this.svg.querySelector(s);
    this.parts = {
      root: q('.neko-root'), head: q('.head-g'), body: q('.body-g'), tail: q('.tail-g'), feet: q('.feet-g'),
      earL: q('.ear-L'), earR: q('.ear-R'), mouth: q('.mouth'), acc: q('.acc'), cheeks: q('.cheeks'),
      arm: { L: q('.arm-L'), R: q('.arm-R') }, prop: q('.arm-R .prop'),
      eye: { L: q(".eye-L"), R: q(".eye-R") },
    };
    this.motion = 1;
    // Live values (eased) and targets.
    this.v = { lid: 0.4, lidT: 0.4, look: { x: 0, y: 0 }, lookT: { x: 0, y: 0 }, tilt: 0, tiltT: 0, melt: 0, meltT: 0, ears: 0, earsT: 0, stretch: 0, stretchT: 0, cheek: 0.6, cheekT: 0.6, bob: 0, nod: 0 };
    this.hand = { L: { ...REST.L }, R: { ...REST.R } };
    this.handT = { L: null, R: null };
    this.face = 'idle';
    this.mouthShape = 'w';
    this.closed = false;
    this.blinkAt = 3;
    this.blinking = 0;
    this.propName = 'none';
    this.held = 'pencil';
    this.flipped = false;
    this.t = 0;
    this.setPalette(palette);
    this.setAccessory(accessory);
    this.setProp('pencil');
    this.draw();
  }

  setPalette(name) {
    const p = PALETTES[name] || PALETTES.lavender;
    this.palette = name;
    const set = (sel, attr, val) => this.svg.querySelectorAll(sel).forEach((el) => el.setAttribute(attr, val));
    set('.cream', 'fill', p.cream); set('.pa', 'fill', p.a); set('.pb', 'fill', p.b); set('.iris', 'fill', p.iris);
    set('.arm-f', 'stroke', p.cream);
    this.rainbow = !!p.rainbow;
  }
  setAccessory(id) { this.accessory = ACCESSORIES[id] != null ? id : 'none'; this.parts.acc.innerHTML = ACCESSORIES[this.accessory]; }
  setProp(name) { this.propName = name; this.parts.prop.innerHTML = PROPS[name] || ''; }
  setMotion(m) { this.motion = Math.max(0, Math.min(1, m)); }

  // ---------------------------------------------------------------- expressions
  setFace(face) {
    this.face = face;
    const F = {
      idle: { lid: 0.44, mouth: 'w', closed: false },
      focus: { lid: 0.5, mouth: 'w', closed: false, look: { x: -4, y: 9 } },
      happy: { lid: 0.44, mouth: 'smile', closed: false },
      content: { lid: 0, mouth: 'w', closed: true },
      tilt: { lid: 0.3, mouth: 'o', closed: false, look: { x: 8, y: 0 } },
      sleepy: { lid: 0.72, mouth: 'w', closed: false },
      yawn: { lid: 0, mouth: 'yawn', closed: true },
      wide: { lid: 0, mouth: 'o', closed: false, big: true },
      sad: { lid: 0.48, mouth: 'sad', closed: false, brows: 'sad' },
    }[face] || {};
    this.v.lidT = F.lid ?? 0.4;
    this.mouthShape = F.mouth || 'w';
    this.closed = !!F.closed;
    this.v.cheekT = F.cheek ?? 0.6;
    this.browShape = F.brows || 'flat';
    this.bigEyes = !!F.big;
    this.v.lookT = F.look ? { ...F.look } : { x: 0, y: 0 };
    this.draw();
  }
  // A slow blink: the cat's "I trust you".
  slowBlink() { this.blinking = 0.75; this.blinkSlow = true; }
  look(x, y) { this.v.lookT = { x: Math.max(-14, Math.min(14, x)), y: Math.max(-10, Math.min(12, y)) }; }

  // ---------------------------------------------------------------- body
  tilt(deg = 9, ms = 900) { this.v.tiltT = deg; clearTimeout(this.tiltTimer); if (ms) this.tiltTimer = setTimeout(() => { this.v.tiltT = 0; }, ms); }
  nod() { this.nodT = 0.5; }
  earsDown(on = true) { this.v.earsT = on ? 1 : 0; }
  melt(k) { this.v.meltT = k; }
  stretch(on = true) { this.v.stretchT = on ? 1 : 0; }
  tailFlick() { this.flick = 0.6; } // ear twitch (see draw)

  // Screen point -> SVG user space.
  toSvg(pt) {
    const m = this.svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(pt.x, pt.y).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  toScreen(p) {
    const m = this.svg.getScreenCTM();
    if (!m) return null;
    const r = new DOMPoint(p.x, p.y).matrixTransform(m);
    return { x: r.x, y: r.y };
  }
  // Put the drawing point (pencil tip or eraser) at a screen point; null rests.
  reach(pt, { end = 'pencil', side = 'R' } = {}) {
    if (!pt) { this.handT[side] = null; return; }
    const p = this.toSvg(pt);
    if (!p) return;
    const tip = TIP[end] || { x: 0, y: 0 };
    this.useEnd(end);
    this.handT[side] = { x: p.x - tip.x, y: p.y - tip.y };
  }
  // Flip the pencil to use the eraser end (a small turn of the paw).
  useEnd(end) { if (end !== 'paw') this.flipped = end === 'eraser'; }
  // Where the drawing point is now, in screen coordinates.
  tipScreen() {
    const tip = TIP[this.flipped ? 'eraser' : 'pencil'];
    return this.toScreen({ x: this.hand.R.x + tip.x, y: this.hand.R.y + tip.y });
  }

  // ---------------------------------------------------------------- frame
  update(dt, beat = null) {
    this.t += dt;
    const m = this.motion;
    const v = this.v;
    v.lid = ease(v.lid, v.lidT, dt, 0.12);
    v.look.x = ease(v.look.x, v.lookT.x, dt, 0.25); v.look.y = ease(v.look.y, v.lookT.y, dt, 0.25);
    v.tilt = ease(v.tilt, v.tiltT * m, dt, 0.35);
    v.melt = ease(v.melt, v.meltT * (0.3 + 0.7 * m), dt, 0.9);
    v.ears = ease(v.ears, v.earsT, dt, 0.3);
    v.stretch = ease(v.stretch, v.stretchT * m, dt, 0.6);
    v.cheek = ease(v.cheek, v.cheekT, dt, 0.4);
    if (this.nodT) { this.nodT = Math.max(0, this.nodT - dt); v.nod = Math.sin((1 - this.nodT / 0.5) * Math.PI) * 7 * m; } else v.nod = 0;
    // Blinks every few seconds; slow blinks on request.
    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && !this.closed) { this.blinking = 0.16; this.blinkSlow = false; this.blinkAt = 2.5 + Math.random() * 4; }
    if (this.blinking > 0) this.blinking = Math.max(0, this.blinking - dt);
    for (const s of ['L', 'R']) {
      const tgt = this.handT[s] || REST[s];
      const k = 1 - Math.exp(-dt / (this.handT[s] ? 0.07 : 0.25));
      this.hand[s].x += (tgt.x - this.hand[s].x) * (m ? k : 1);
      this.hand[s].y += (tgt.y - this.hand[s].y) * (m ? k : 1);
    }
    if (this.flick) this.flick = Math.max(0, this.flick - dt);
    this.beat = beat;
    this.draw();
  }

  draw() {
    const v = this.v; const P = this.parts; const m = this.motion;
    const breath = Math.sin((this.t / 4.5) * Math.PI * 2) * 0.012 * m;
    const sy = 1 + breath + v.stretch * 0.06 - v.melt * 0.28;
    const sx = 1 - breath * 0.5 + v.melt * 0.22;
    P.root.setAttribute('transform', `translate(917 1372) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-917 -1372)`);
    P.head.setAttribute('transform', `rotate(${(v.tilt + v.nod).toFixed(2)} 917 1100) translate(0 ${(v.melt * 40 - v.stretch * 20).toFixed(1)})`);
    // Tail sways on the beat of the music (two beats per swing) or slowly.
    const phase = this.beat != null ? this.beat * Math.PI : this.t * 1.3;
    const tailA = (Math.sin(phase) * 9 + (this.flick ? Math.sin(this.flick * 20) * 14 : 0)) * m;
    P.tail.setAttribute('transform', `rotate(${tailA.toFixed(2)} 1050 1250)`);
    // No tail on the character sheet: a flick is an ear twitch instead.
    const earDrop = v.ears * 10 + (this.flick ? Math.sin(this.flick * 24) * 8 * m : 0);
    P.earL.setAttribute('transform', `rotate(${-earDrop} 690 640)`);
    P.earR.setAttribute('transform', `rotate(${earDrop} 1144 640)`);
    P.cheeks.setAttribute('opacity', v.cheek.toFixed(2));
    if (this.rainbow) {
      const h = (this.t * 12) % 360;
      this.svg.querySelectorAll('.pa').forEach((el) => el.setAttribute('fill', `hsl(${h} 70% 76%)`));
      this.svg.querySelectorAll('.pb').forEach((el) => el.setAttribute('fill', `hsl(${(h + 120) % 360} 45% 74%)`));
    }
    this.drawEyes();
    this.drawMouth();
    this.drawArms(sx, sy);
  }

  drawEyes() {
    const v = this.v;
    const blink = this.blinking > 0 ? Math.sin((1 - this.blinking / (this.blinkSlow ? 0.75 : 0.16)) * Math.PI) : 0;
    const lid = Math.min(1, v.lid + (1 - v.lid) * blink);
    for (const k of ['L', 'R']) {
      const g = this.parts.eye[k]; const e = EYE[k];
      const open = g.querySelector('.eye-open'); const closed = g.querySelector('.eye-closed');
      if (this.closed) {
        open.setAttribute('display', 'none'); closed.removeAttribute('display');
        // Gently closed: a soft downward curve (the sheet's 目をつむる).
        closed.setAttribute('d', `M${e.cx - EYE.rx * 0.82} ${e.cy - 4} Q${e.cx} ${e.cy + EYE.ry * 0.75} ${e.cx + EYE.rx * 0.82} ${e.cy - 4}`);
        continue;
      }
      open.removeAttribute('display'); closed.setAttribute('display', 'none');
      const top = e.cy - EYE.ry; const yb = top + lid * EYE.ry * 2;
      const x0 = e.cx - EYE.rx - 4; const x1 = e.cx + EYE.rx + 4;
      g.querySelector('.lid').setAttribute('d', `M${x0} ${top - 20} L${x1} ${top - 20} L${x1} ${yb} C${e.cx + 30} ${yb - 9} ${e.cx - 30} ${yb - 9} ${x0} ${yb} Z`);
      g.querySelector('.lid-line').setAttribute('d', `M${x0} ${yb} C${e.cx - 30} ${yb - 9} ${e.cx + 30} ${yb - 9} ${x1} ${yb}`);
      // Surprise (the sheet's 驚き): the eye opens round and the iris grows.
      const big = this.bigEyes ? 1 : 0;
      open.setAttribute('transform', big ? `translate(${e.cx} ${e.cy}) scale(1 1.16) translate(${-e.cx} ${-e.cy})` : '');
      g.querySelector('.iris-g').setAttribute('transform', `translate(${v.look.x.toFixed(1)} ${v.look.y.toFixed(1)})${big ? ` translate(${e.cx} ${e.cy}) scale(1.28 1.1) translate(${-e.cx} ${-e.cy - 2})` : ''}`);
    }
    // Short brows above the eyes; they slant up in the middle when sad.
    const sad = this.browShape === 'sad';
    this.svg.querySelector('.brows').setAttribute('d', T(sad ? 'M205 266 L230 255 M345 255 L370 266' : 'M207 261 L230 261 M341 261 L364 261'));
  }

  drawMouth() {
    const shape = this.mouthShape;
    this.parts.mouth.setAttribute('d', MOUTH[shape] ? T(MOUTH[shape]) : '');
    this.parts.mouth.setAttribute('fill', { yawn: '#6B2E3A', o: '#F4A3AE', smile: '#6B2E3A' }[shape] || 'none');
    this.svg.querySelector('.tongue').setAttribute('display', shape === 'smile' ? 'inline' : 'none');
  }

  drawArms(sx, sy) {
    for (const s of ['L', 'R']) {
      const g = this.parts.arm[s];
      const sh = SHOULDER[s]; const h = this.hand[s];
      // A slight elbow bend toward the body keeps long reaches soft.
      const mx = (sh.x + h.x) / 2 + (s === 'L' ? -1 : 1) * 30; const my = (sh.y + h.y) / 2 + 30;
      const d = `M${sh.x} ${sh.y} Q${mx.toFixed(1)} ${my.toFixed(1)} ${h.x.toFixed(1)} ${h.y.toFixed(1)}`;
      // At rest the arm is the sheet's short line; reaching out, it fills into a soft arm.
      const w = Math.max(0, Math.min(1, (Math.hypot(h.x - sh.x, h.y - sh.y) - REST_LEN) / 90));
      const o = g.querySelector('.arm-o'); const f = g.querySelector('.arm-f');
      o.setAttribute('d', d); f.setAttribute('d', d);
      o.setAttribute('stroke-width', (11 + 31 * w).toFixed(1)); f.setAttribute('stroke-width', (20 * w).toFixed(1));
      const hand = g.querySelector('.hand');
      hand.setAttribute('cx', h.x.toFixed(1)); hand.setAttribute('cy', h.y.toFixed(1));
    }
    const h = this.hand.R;
    this.parts.prop.setAttribute('transform', `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)})${this.flipped ? ' rotate(180)' : ''}`);
    // Stretch: both paws up.
    if (this.v.stretch > 0.05 && !this.handT.L && !this.handT.R) {
      const k = this.v.stretch;
      for (const s of ['L', 'R']) { this.hand[s].x = lerp(REST[s].x, s === 'L' ? 560 : 1274, k); this.hand[s].y = lerp(REST[s].y, 600, k); }
    }
  }

  destroy() { this.svg.remove(); }
}

// Static SVG markup (for thumbnails and previews).
export function nekoThumb(palette = 'lavender', accessory = 'none') {
  const div = document.createElement('div');
  const n = new ChillNeko(div, { palette, accessory, size: 64 });
  n.setProp('none');
  n.draw();
  return div.innerHTML;
}
