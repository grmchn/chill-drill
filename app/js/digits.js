// Handwritten digits drawn in stroke order (the design notes 3, 6.3).
// Each digit is a list of strokes; each stroke a list of points in a
// 100x140 box, smoothed with a Catmull-Rom spline. Shapes stay plain so a
// child reads them at once.

const RAW = {
  0: [[[50, 14], [30, 26], [21, 60], [24, 100], [40, 124], [60, 125], [76, 104], [80, 66], [74, 30], [58, 15], [47, 16]]],
  1: [[[34, 34], [46, 24], [56, 14], [56, 70], [56, 126]]],
  2: [[[24, 42], [34, 20], [56, 14], [74, 26], [76, 48], [62, 74], [40, 100], [22, 124], [52, 124], [82, 123]]],
  3: [[[26, 26], [46, 14], [68, 18], [74, 40], [60, 62], [46, 66], [64, 70], [78, 92], [70, 118], [46, 126], [24, 114]]],
  4: [[[60, 14], [42, 50], [20, 90], [52, 90], [84, 89]], [[64, 44], [64, 86], [63, 128]]],
  5: [[[74, 16], [52, 16], [32, 16], [28, 40], [27, 62], [44, 54], [64, 58], [76, 82], [72, 110], [52, 125], [26, 116]]],
  6: [[[68, 18], [46, 34], [30, 64], [26, 98], [40, 124], [64, 122], [76, 98], [66, 74], [44, 72], [28, 92]]],
  7: [[[22, 18], [52, 18], [80, 17], [62, 56], [50, 92], [42, 128]]],
  8: [[[64, 24], [50, 14], [32, 22], [30, 44], [50, 64], [70, 84], [72, 110], [52, 126], [30, 114], [28, 90], [48, 66], [68, 46], [66, 24]]],
  9: [[[74, 40], [62, 18], [40, 16], [26, 34], [30, 58], [50, 66], [70, 54], [74, 36]], [[74, 40], [72, 86], [68, 128]]],
};

// Catmull-Rom -> cubic Bezier path.
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export const DIGIT_PATHS = Object.fromEntries(Object.entries(RAW).map(([k, strokes]) => [k, strokes.map(smooth)]));
export const strokeCount = (digit) => (RAW[digit] ? RAW[digit].length : 1);

const NS = 'http://www.w3.org/2000/svg';

// A digit drawn into a cell. Returns a handle: finish() completes it at once;
// done resolves when drawn; point() is the pen position (screen) while drawing.
export function writeDigit(host, digit, { dur = 200, cls = 'ink', instant = false, jitter = true } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 140');
  svg.setAttribute('class', `hand ${cls}`);
  svg.setAttribute('aria-hidden', 'true');
  // A tiny random tilt and offset so repeated digits are not identical.
  if (jitter) svg.style.transform = `rotate(${(Math.random() - 0.5) * 6}deg) translate(${(Math.random() - 0.5) * 4}%, ${(Math.random() - 0.5) * 3}%)`;
  const paths = (DIGIT_PATHS[digit] || DIGIT_PATHS[0]).map((d) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    svg.appendChild(p);
    return p;
  });
  host.appendChild(svg);
  const lens = paths.map((p) => { try { return p.getTotalLength(); } catch { return 1; } });
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const shares = lens.map((l) => l / total);
  let t0 = performance.now();
  let finished = instant || dur <= 0;
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const set = (k) => {
    let acc = 0;
    paths.forEach((p, i) => {
      const local = Math.max(0, Math.min(1, (k - acc) / Math.max(1e-6, shares[i])));
      p.style.strokeDasharray = '1 1';
      p.style.strokeDashoffset = String(1 - local);
      acc += shares[i];
    });
  };
  const handle = {
    el: svg,
    done,
    finish() { if (finished) return; finished = true; set(1); resolve(); },
    // Pen point now, in screen coordinates (null when finished).
    point() {
      if (finished) return null;
      const k = Math.min(1, (performance.now() - t0) / dur);
      let acc = 0;
      for (let i = 0; i < paths.length; i++) {
        if (k <= acc + shares[i] || i === paths.length - 1) {
          const local = Math.max(0, Math.min(1, (k - acc) / Math.max(1e-6, shares[i])));
          const pt = paths[i].getPointAtLength(local * lens[i]);
          const m = paths[i].getScreenCTM();
          if (!m) return null;
          const s = new DOMPoint(pt.x, pt.y).matrixTransform(m);
          return { x: s.x, y: s.y };
        }
        acc += shares[i];
      }
      return null;
    },
  };
  if (finished) { set(1); resolve(); return handle; }
  set(0);
  const tick = () => {
    if (finished) return;
    const k = Math.min(1, (performance.now() - t0) / dur);
    set(k);
    if (k >= 1) { finished = true; resolve(); } else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return handle;
}
