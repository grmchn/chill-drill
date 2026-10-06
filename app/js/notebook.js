// The notebook (the design notes 6): problems flow onto ruled paper one after
// another. Given numbers are printed; answers are written by hand (digits.js),
// slips are rubbed out, finished problems get a pencil circle and a paw stamp
// and drift up the page. Layout cells come from problems.js (same as Dopa).
import { writeDigit, strokeCount } from './digits.js';

const NS = 'http://www.w3.org/2000/svg';
const PAW = '<svg viewBox="0 0 40 40" class="paw" aria-hidden="true"><ellipse cx="20" cy="25" rx="10" ry="8.5"/><ellipse cx="9" cy="14" rx="4.2" ry="5"/><ellipse cx="16.5" cy="9" rx="4.2" ry="5"/><ellipse cx="24.5" cy="9" rx="4.2" ry="5"/><ellipse cx="32" cy="14" rx="4.2" ry="5"/></svg>';
const CHECK = '<svg viewBox="0 0 20 20" class="check" aria-hidden="true"><path d="M3 11 L8 16 L17 4" pathLength="1"/></svg>';

export class Notebook {
  constructor(el, { reduced = () => false } = {}) {
    this.el = el;
    this.page = el.querySelector('.page');
    this.labelEl = el.querySelector('.step-label');
    this.marginEl = el.querySelector('.margin');
    this.reduced = reduced;
    this.block = null;
    this.cells = {};
    this.lines = {};
    this.pens = [];
  }

  clear() {
    this.page.innerHTML = '';
    this.block = null; this.cells = {}; this.lines = {};
    if (this.marginEl) this.marginEl.innerHTML = '';
    this.label('');
  }

  // Put a new problem on the page. The previous block drifts up and fades out
  // completely, then leaves the page (nothing stays behind).
  show(p, { capsule = false } = {}) {
    const old = [...this.page.querySelectorAll('.block')];
    old.forEach((b) => {
      if (b.classList.contains('past')) { b.remove(); return; }
      if (this.reduced()) { b.remove(); return; }
      const top = b.offsetTop;
      b.style.top = `${top}px`;
      b.classList.add('past');
      setTimeout(() => b.remove(), 950);
    });
    const block = document.createElement('div');
    block.className = `block ${p.kind}${capsule ? ' capsule' : ''}`;
    const title = document.createElement('p');
    title.className = 'qtitle';
    title.textContent = p.title;
    block.appendChild(title);
    const sheet = document.createElement('div');
    sheet.className = `sheet ${p.kind}`;
    sheet.style.setProperty('--cols', p.cols);
    sheet.style.setProperty('--rows', p.rows);
    sheet.setAttribute('role', 'group');
    sheet.setAttribute('aria-label', `けいさん ${p.text}`);
    block.appendChild(sheet);
    this.cells = {}; this.lines = {};
    if (p.bracket) {
      const b = document.createElement('div');
      b.className = 'bracket';
      b.style.gridRow = `${p.bracket.r + 1}`;
      b.style.gridColumn = `${p.bracket.c0 + 1} / ${p.bracket.c1 + 2}`;
      sheet.appendChild(b);
    }
    for (const l of p.lines) {
      const d = document.createElement('div');
      d.className = `hline${l.hidden ? ' hidden' : ''}${l.frac ? ' fbar' : ''}`;
      d.style.gridRow = `${l.r + 1}`;
      d.style.gridColumn = `${l.c0 + 1} / ${l.c1 + 2}`;
      sheet.appendChild(d);
      if (l.id) this.lines[l.id] = d;
    }
    for (const c of p.cells) {
      const d = document.createElement('div');
      d.className = `cell ${c.kind}${c.small ? ' small' : ''}${c.cls ? ` ${c.cls}` : ''}`;
      d.style.gridRow = c.rs ? `${c.r + 1} / span ${c.rs}` : `${c.r + 1}`;
      d.style.gridColumn = c.cs ? `${c.c + 1} / span ${c.cs}` : `${c.c + 1}`;
      d.dataset.id = c.id;
      if (c.kind === 'input') d.setAttribute('aria-label', 'こたえを かく ところ');
      else if (c.kind === 'auto' || c.kind === 'carry') { d.dataset.text = c.text; d.classList.add('hidden'); if (c.text === '.') d.classList.add('dot'); }
      else if (c.kind === 'mark') { /* filled in by marks() */ } else d.textContent = c.text;
      sheet.appendChild(d);
      this.cells[c.id] = d;
    }
    this.page.appendChild(block);
    this.block = block;
    this.sheet = sheet;
    this.fit(p);
    if (!this.reduced()) {
      block.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.33,0,.2,1)' });
    }
    return this.cells;
  }

  // Size the grid to the page (wide expressions, tall long division).
  fit(p) {
    const r = this.page.getBoundingClientRect();
    const availW = Math.max(180, r.width - 40);
    const availH = Math.max(120, r.height * 0.78 - 34);
    const base = p.kind === 'div' ? 44 : 52;
    const cw = Math.min(base, availW / p.cols);
    const ch = Math.min(cw * (p.kind === 'div' ? 0.8 : 1.0), availH / p.rows);
    this.sheet.style.setProperty('--cw', `${cw.toFixed(1)}px`);
    this.sheet.style.setProperty('--ch', `${ch.toFixed(1)}px`);
  }

  activate(id) {
    for (const c of Object.values(this.cells)) c.classList.remove('active');
    const c = this.cells[id];
    if (c) c.classList.add('active');
  }

  label(html) { if (this.labelEl) this.labelEl.innerHTML = html || '&nbsp;'; }

  // Borrow marks for column subtraction (struck digits and small new values).
  marks(list) {
    for (const m of list || []) {
      const mk = this.cells[`m${m.c}`]; const top = this.cells[`a${m.c}`];
      if (!mk) continue;
      mk.innerHTML = '';
      [...m.text].forEach((ch) => { const span = document.createElement('span'); span.className = 'mini'; mk.appendChild(span); writeDigit(span, ch, { dur: this.reduced() ? 0 : 160, cls: 'ink soft', jitter: false }); });
      if (top) top.classList.add('struck');
    }
  }

  // Write a digit by hand. Returns the handle (pen point while drawing).
  write(id, digit, { cls = 'ink', dur = null } = {}) {
    const cell = this.cells[id];
    if (!cell) return null;
    cell.querySelectorAll('.hand').forEach((h) => h.remove());
    const d = this.reduced() ? 0 : dur ?? (140 + strokeCount(digit) * 60);
    const h = writeDigit(cell, digit, { dur: d, cls });
    cell.classList.add('has');
    this.pens.push(h);
    h.done.then(() => { this.pens = this.pens.filter((x) => x !== h); });
    return h;
  }
  // Finish any digit still being drawn (fast typing never waits).
  hurry() { for (const h of this.pens.slice()) h.finish(); }
  penPoint() { const h = this.pens[this.pens.length - 1]; return h ? h.point() : null; }

  // Rub out a written digit (a slip or a delete). A faint ghost stays.
  async erase(id, { passes = 2 } = {}) {
    const cell = this.cells[id];
    if (!cell) return;
    const hand = cell.querySelector('.hand:not(.ghost)');
    if (!hand) return;
    if (this.reduced()) { hand.remove(); cell.classList.remove('has'); return; }
    hand.classList.add('rubbing');
    const a = hand.animate([{ opacity: 1 }, { opacity: 0.12 }], { duration: 160 * passes + 120, easing: 'linear', fill: 'forwards' });
    await a.finished.catch(() => {});
    hand.classList.remove('rubbing');
    hand.classList.add('ghost');
    cell.classList.remove('has');
    // Only the latest ghost stays.
    cell.querySelectorAll('.hand.ghost').forEach((g, i, all) => { if (i < all.length - 1) g.remove(); });
  }

  // Cells that appear after a step (products in long division, carries...).
  // They are written in pencil, a little smaller, one after another.
  reveal(ids) {
    let k = 0;
    for (const id of ids || []) {
      const cell = this.cells[id] || null;
      const line = this.lines[id] || null;
      if (line) { line.classList.remove('hidden'); if (!this.reduced()) line.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 300, easing: 'ease-out' }); continue; }
      if (!cell || !cell.classList.contains('hidden')) continue;
      cell.classList.remove('hidden');
      const txt = cell.dataset.text || '';
      if (txt === '.' || !/^\d$/.test(txt)) { cell.textContent = txt; continue; }
      const delay = k++ * 90;
      const run = () => writeDigit(cell, txt, { dur: this.reduced() ? 0 : 150, cls: cell.classList.contains('carry') ? 'ink soft' : 'ink' });
      if (delay && !this.reduced()) setTimeout(run, delay); else run();
    }
  }

  check(id) {
    const cell = this.cells[id];
    if (!cell) return;
    cell.insertAdjacentHTML('beforeend', CHECK);
    const c = cell.lastElementChild;
    if (!this.reduced()) c.querySelector('path').animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 220, fill: 'forwards' });
  }

  // The finished problem: a pencil circle around the answer and a paw stamp.
  maru(p) {
    if (!this.sheet) return;
    const ids = p.steps.map((s) => s.cell);
    const rects = ids.map((id) => this.cells[id] && this.cells[id].getBoundingClientRect()).filter(Boolean);
    const last = p.steps[p.steps.length - 1];
    const lastCell = this.cells[last.cell];
    if (!rects.length || !lastCell) return;
    // Circle the cells in the same row as the final answer digit.
    const row = lastCell.getBoundingClientRect();
    const same = rects.filter((r) => Math.abs(r.top - row.top) < row.height * 0.5);
    const box = this.sheet.getBoundingClientRect();
    const x0 = Math.min(...same.map((r) => r.left)) - box.left; const x1 = Math.max(...same.map((r) => r.right)) - box.left;
    const y0 = row.top - box.top; const y1 = row.bottom - box.top;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'maru');
    svg.setAttribute('aria-hidden', 'true');
    const pad = 8;
    svg.style.left = `${x0 - pad}px`; svg.style.top = `${y0 - pad}px`;
    const w = x1 - x0 + pad * 2; const h = y1 - y0 + pad * 2;
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const rx = w / 2 - 3; const ry = h / 2 - 3;
    const path = document.createElementNS(NS, 'path');
    // A hand-drawn ellipse that overlaps itself a little at the end.
    path.setAttribute('d', `M${w / 2 + rx * 0.2} ${3} A${rx} ${ry} 0 1 0 ${w / 2 + rx * 0.45} ${h / 2 - ry * 0.95 + 4}`);
    path.setAttribute('pathLength', '1');
    svg.appendChild(path);
    this.sheet.appendChild(svg);
    if (!this.reduced()) path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 420, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'forwards' });
    else path.style.strokeDashoffset = '0';
    // Paw stamp at the end of the line.
    const paw = document.createElement('div');
    paw.className = 'stamp';
    paw.innerHTML = PAW;
    paw.style.left = `${Math.min(box.width - 10, x1 + 14)}px`;
    paw.style.top = `${(y0 + y1) / 2 - 18}px`;
    this.sheet.appendChild(paw);
    if (!this.reduced()) paw.animate([{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, delay: 380, fill: 'backwards', easing: 'ease-out' });
  }

  hintGlow(ids) {
    for (const c of Object.values(this.cells)) c.classList.remove('hint');
    for (const id of ids || []) { const c = this.cells[id]; if (c && !c.classList.contains('hidden')) c.classList.add('hint'); }
  }

  // A small sticker in the margin (quiet notification during play).
  sticker(kind = 'star') {
    if (!this.marginEl) return;
    const s = document.createElement('span');
    s.className = `msticker ${kind}`;
    s.setAttribute('aria-hidden', 'true');
    this.marginEl.appendChild(s);
    while (this.marginEl.children.length > 6) this.marginEl.firstElementChild.remove();
    if (!this.reduced()) s.animate([{ opacity: 0, transform: 'scale(.6) rotate(-20deg)' }, { opacity: 1, transform: 'scale(1) rotate(-6deg)' }], { duration: 420, easing: 'ease-out' });
  }

  cellRect(id) { const c = this.cells[id]; return c ? c.getBoundingClientRect() : null; }
}
