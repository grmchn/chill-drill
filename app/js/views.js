// Paper-card views over the room: quests, calendar, day details, mood,
// results, settings, guide, trophies, collection, the plant skill tree,
// login stickers, the pillow, rests and confirmations. Quiet by design
// (plan.md 8.4): nothing pops up during play except the rest suggestion.
import { SKILLS, SKILL, LANES, DEPTH } from './skills.js';
import { stateOf, starsOf, nextStar, STAR_MAX, rustyOf, TREE_LAYOUT, relockTargets, relockSkill, isUnlocked, masteryRatio } from './session.js';
import * as growth from './growth.js';
import * as qs from './quests.js';
import * as tr from './trophies.js';
import * as col from './collection.js';
import { fmtChill, BASIC_SCORE } from './scoring.js';
import { PALETTES, ACCESSORIES } from './neko.js';
import { Room } from './room.js';
import { dailyWeather, WEATHER_NAME } from './weather.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDay = (key) => { const [, m, d] = key.split('-').map(Number); return `${m}月${d}日`; };
const fmtTime = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export const MOOD_LABEL = { great: 'ばっちり', okay: 'まあまあ', tried: 'がんばった', hard: 'むずかしかった', sleepy: 'ねむかった' };
export const MOOD_SVG = {
  great: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" fill="#FFB56B" stroke="#2B2A33" stroke-width="1.6"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M7 25l3-3M22 10l3-3" stroke="#FFB56B" stroke-width="2.4" stroke-linecap="round"/></svg>',
  okay: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="#C9D6E8" stroke="#2B2A33" stroke-width="1.6"/><path d="M11 18 Q16 22 21 18" fill="none" stroke="#2B2A33" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="13" r="1.4"/><circle cx="20" cy="13" r="1.4"/></svg>',
  tried: '<svg viewBox="0 0 32 32"><path d="M16 28 V14" stroke="#2E6D62" stroke-width="2.4" stroke-linecap="round"/><path d="M16 16 C10 15 7 10 8 6 C13 6 16 10 16 16 Z M16 14 C21 12 25 8 25 4 C19 4 16 8 16 14 Z" fill="#3FB3A3" stroke="#2E6D62" stroke-width="1.4"/></svg>',
  hard: '<svg viewBox="0 0 32 32"><path d="M3 27 L12 10 L17 18 L21 12 L29 27 Z" fill="#9BB0A5" stroke="#2B2A33" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 14 L12 10 L14 14 Z" fill="#fff"/></svg>',
  sleepy: '<svg viewBox="0 0 32 32"><path d="M21 5 A11 11 0 1 0 27 21 A9 9 0 0 1 21 5 Z" fill="#FFD9A8" stroke="#2B2A33" stroke-width="1.6"/><text x="20" y="14" font-size="8" fill="#2A2D5E" font-weight="900">z</text></svg>',
};
export const STICKER_SVG = {
  moon: '<svg viewBox="0 0 24 24"><path d="M15 3 A9 9 0 1 0 21 16 A7 7 0 0 1 15 3 Z" fill="#FFD9A8" stroke="#2B2A33" stroke-width="1.3"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3 C16 9 18 12 18 15 A6 6 0 0 1 6 15 C6 12 8 9 12 3 Z" fill="#C9D6E8" stroke="#2B2A33" stroke-width="1.3"/></svg>',
  leaf: '<svg viewBox="0 0 24 24"><path d="M5 19 C5 10 11 4 20 4 C20 13 14 19 5 19 Z" fill="#3FB3A3" stroke="#2B2A33" stroke-width="1.3"/><path d="M5 19 L14 10" stroke="#2B2A33" stroke-width="1.1"/></svg>',
  tea: '<svg viewBox="0 0 24 24"><path d="M5 9 H17 V15 A5 5 0 0 1 12 20 H10 A5 5 0 0 1 5 15 Z" fill="#F08BB0" stroke="#2B2A33" stroke-width="1.3"/><path d="M17 11 C21 11 21 16 17 16" fill="none" stroke="#2B2A33" stroke-width="1.3"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 6 C8 4 11 5 12 7 C13 5 16 4 20 6 V19 C16 17 13 18 12 19 C11 18 8 17 4 19 Z" fill="#B0A0BE" stroke="#2B2A33" stroke-width="1.3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3 L14.6 9 L21 9.5 L16 13.6 L17.6 20 L12 16.6 L6.4 20 L8 13.6 L3 9.5 L9.4 9 Z" fill="#FFB56B" stroke="#2B2A33" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  fullmoon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#FFF1C9" stroke="#2B2A33" stroke-width="1.3"/><circle cx="9" cy="10" r="1.6" fill="#EADBB0"/><circle cx="14" cy="14" r="2.2" fill="#EADBB0"/></svg>',
};
const PAW = '<svg viewBox="0 0 40 40" class="pawmark" aria-hidden="true"><ellipse cx="20" cy="25" rx="10" ry="8.5"/><ellipse cx="9" cy="14" rx="4.2" ry="5"/><ellipse cx="16.5" cy="9" rx="4.2" ry="5"/><ellipse cx="24.5" cy="9" rx="4.2" ry="5"/><ellipse cx="32" cy="14" rx="4.2" ry="5"/></svg>';
const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5 L8.5 15 L16 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ic = (d) => `<svg viewBox="0 0 24 24" width="28" height="28"><g fill="none" stroke="#F6EEDD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</g></svg>`;
const CAT_ICON = {
  room: ic('<path d="M3 11 L12 4 L21 11 V20 H3 Z"/><path d="M9 20 V14 H15 V20"/>'),
  view: ic('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4 V20 M4 12 H20"/>'),
  music: ic('<path d="M9 18 V6 L19 4 V16"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>'),
  prop: ic('<path d="M5 9 H16 V15 A4 4 0 0 1 12 19 H9 A4 4 0 0 1 5 15 Z"/><path d="M16 11 C19 11 19 15 16 15"/>'),
  costume: ic('<path d="M6 16 C6 9 18 9 18 16 Z"/><path d="M4 16 H20"/>'),
  mate: ic('<path d="M4 12 C7 8 13 8 16 12 C13 16 7 16 4 12 Z"/><path d="M16 12 L20 9 V15 Z"/>'),
  event: ic('<circle cx="12" cy="15" r="4"/><path d="M3 19 H21 M12 6 V8 M5 9 L6.5 10.5 M19 9 L17.5 10.5"/>'),
};
const MODE = { level: 'じぶんレベル', grade: '学年べつ', review: 'ふくしゅう', practice: 'れんしゅう' };

// A small paper-cut cup in the room's palette; the rank sets its colour.
const TROPHY_COL = { none: ['#E4DACA', '#CFC3AE'], bronze: ['#D9A27A', '#B57D57'], silver: ['#DDE3EE', '#AEB8C9'], gold: ['#FFD27A', '#E0A94E'], rainbow: ['#F7C6DA', '#BFE6DF'], secret: ['#CFC2E4', '#A796C6'] };
function trophyIcon(rank = 'none') {
  const [c0, c1] = TROPHY_COL[rank] || TROPHY_COL.none;
  const fill = rank === 'rainbow' ? 'url(#tro-rb)' : c0;
  const line = rank === 'none' ? '#B9AE9A' : '#2B2A33';
  return `<svg viewBox="-20 -20 40 40" aria-hidden="true">${rank === 'rainbow' ? '<defs><linearGradient id="tro-rb" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#F7C6DA"/><stop offset=".5" stop-color="#FFE3A8"/><stop offset="1" stop-color="#BFE6DF"/></linearGradient></defs>' : ''}<g stroke="${line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M-10.5 -12 C-17 -12 -17 -2 -8 0 M10.5 -12 C17 -12 17 -2 8 0" fill="none" stroke-width="2.4"/><path d="M-11 -15 H11 V-7 C11 2 5.5 6 0 6 C-5.5 6 -11 2 -11 -7Z" fill="${fill}"/><path d="M-3 6 L3 6 L4 11 L-4 11Z" fill="${c1}"/><rect x="-9" y="11" width="18" height="5" rx="2" fill="${fill}"/>${rank === 'none' ? '' : '<path d="M0 -11.5 L1.5 -8.2 L5 -7.9 L2.4 -5.6 L3.2 -2.2 L0 -4 L-3.2 -2.2 L-2.4 -5.6 L-5 -7.9 L-1.5 -8.2Z" fill="#FFF8EC" stroke-width="1"/>'}</g></svg>`;
}

// 1ぽんめ, 2ほんめ, 3ぼんめ... (the counter changes with the number).
export const tapeOrdinal = (n) => `${n}${{ 1: 'ぽ', 3: 'ぼ', 6: 'ぽ', 8: 'ぽ', 10: 'ぽ' }[n] || 'ほ'}んめ`;

const CHILL_KIND = { cell: 'すうじ', calm: 'チルい テンポ', first: 'いっかいで せいかい', run: 'マイペースが つづいた', day: 'きょう はじめて', rest: 'ひとやすみ' };

export class Views {
  constructor(ctx) {
    this.c = ctx;
    this.open = false;
    this.isRest = false;
    this.month = new Date();
    const dlg = $('#dlg');
    dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...dlg.querySelectorAll('button, input, select, [tabindex="0"]')].filter((x) => !x.disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  }
  get store() { return this.c.store; }
  get S() { return this.c.S; }

  // ---------------------------------------------------------------- dialog
  show({ title, html = '', foot = [], onClose = null, focus = null, veilCloses = true }) {
    const dlg = $('#dlg');
    $('#dlg-title').textContent = title;
    $('#dlg-body').innerHTML = html;
    const f = $('#dlg-foot');
    f.innerHTML = '';
    for (const b of foot) {
      const el = document.createElement('button');
      el.type = 'button'; el.textContent = b.label;
      if (b.cls) el.className = b.cls;
      el.addEventListener('click', () => { if (b.keep) { b.onClick && b.onClick(); return; } const fn = b.onClick; this.close(true); if (fn) fn(); });
      f.appendChild(el);
    }
    dlg.querySelector('.dlg-veil').toggleAttribute('data-close', veilCloses);
    this.onClose = onClose;
    this.lastFocus = document.activeElement;
    dlg.hidden = false;
    this.open = true;
    requestAnimationFrame(() => { const el = focus ? dlg.querySelector(focus) : f.querySelector('.primary') || f.querySelector('button') || dlg.querySelector('.dlg-x'); if (el) el.focus(); });
    return $('#dlg-body');
  }
  close(viaButton = false) {
    if (!this.open) return;
    $('#dlg').hidden = true;
    this.open = false;
    const fn = this.onClose; this.onClose = null;
    if (fn) fn(viaButton);
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
  }
  confirm({ title, msg, yes = 'はい', no = 'やめる', onYes, onNo, danger = false }) {
    let answered = false;
    this.show({ title, html: `<p>${esc(msg)}</p>`, foot: [{ label: no, cls: 'primary', onClick: () => { answered = true; if (onNo) onNo(); } }, { label: yes, cls: danger ? 'danger' : '', onClick: () => { answered = true; if (onYes) onYes(); } }], onClose: () => { if (!answered && onNo) onNo(); } });
  }
  toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this.tt); this.tt = setTimeout(() => t.classList.remove('on'), 2200); }

  // ---------------------------------------------------------------- quests
  questCtx() {
    const st = this.store.load();
    const prog = st.progress || { skills: {}, review: [] };
    const states = SKILLS.map((x) => stateOf(prog, x.id));
    const stats = st.stats || {};
    return {
      minutes: this.store.settings().minutes || 3, review: (prog.review || []).length, placed: !!prog.placed,
      hasNew: states.includes('new'), hasLearning: states.includes('learning') || states.includes('new'),
      okawariOk: st.history.slice(-5).some((h) => h.okawariOk != null),
      avgCells: stats.cells && stats.problems ? stats.cells / stats.problems : 2,
      rusty: rustyOf(prog),
      polishWeek: ((st.quests || {}).polishDays || []).filter((d) => growth.daysBetween(d, this.store.dayKey()) < 7).length,
    };
  }
  quests() { const st = this.store.load(); if (!st.quests) st.quests = {}; if (qs.ensureDay(st.quests, this.store.dayKey(), this.questCtx())) this.store.save(); return st.quests; }
  questRows(list) {
    return list.map((q) => {
      const k = Math.min(1, q.prog / q.goal);
      const shown = `${Math.min(q.prog, q.goal)}/${q.goal}`;
      return `<li class="${q.done ? 'done' : ''}${q.skill && !q.done ? ' go' : ''}"${q.skill ? ` data-skill="${q.skill}" tabindex="0"` : ''}><i class="qchk">${q.done ? CHECK : ''}</i><span class="qt">${esc(qs.questText(q))}</span><span class="qp">${shown}</span><i class="qbar" style="--p:${k.toFixed(3)}"></i></li>`;
    }).join('');
  }
  renderQuests(listEl, rewardEl) {
    const q = this.quests();
    listEl.innerHTML = this.questRows(q.list);
    if (rewardEl) rewardEl.textContent = q.rewarded ? 'コンプリート' : 'ぜんぶで まくら +1';
  }

  // ---------------------------------------------------------------- calendar
  moveMonth(dir) {
    const m = new Date(this.month.getFullYear(), this.month.getMonth() + dir, 1);
    const now = new Date();
    if (m > new Date(now.getFullYear(), now.getMonth(), 1)) return;
    this.month = m;
    this.renderCalendar();
  }
  renderCalendar() {
    const y = this.month.getFullYear(); const m = this.month.getMonth();
    $('#cal-title').textContent = `${y}年 ${m + 1}月`;
    const sum = this.store.monthSummary(y, m);
    const nc = this.store.nocountDays();
    const todayKey = this.store.dayKey();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < first; i++) html += '<span class="cal-day empty"></span>';
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const e = sum[key]; const mood = this.store.moodOn(key); const stk = this.store.stickerOn(key);
      const label = `${m + 1}月${d}日${e ? ` あそんだ ${e.plays}回 さいこう ${e.best}てん` : ''}${mood ? ` きょうの でき ${MOOD_LABEL[mood]}` : ''}`;
      html += `<button type="button" class="cal-day${key === todayKey ? ' today' : ''}" data-day="${key}" aria-label="${label}"><span>${d}</span>${e ? PAW : ''}${stk ? `<i class="stk">${STICKER_SVG[stk] || ''}</i>` : ''}${mood ? `<i class="mood-ic">${MOOD_SVG[mood]}</i>` : ''}${nc[key] ? '<i class="nocount" aria-hidden="true">💤</i>' : ''}</button>`;
    }
    $('#cal-grid').innerHTML = html;
    const b = this.store.bonusState();
    const stats = this.store.load().stats || {};
    $('#cal-badges').innerHTML = `<span>きょうの てんき ${WEATHER_NAME[dailyWeather(this.store.dayKey())]}</span><span>れんぞく ${this.store.streak()}日</span><span>さいこう ${this.store.bestStreak()}日</span><span>シール ${b.total || 0}まい</span><span>まくら ${this.store.items().pillow}こ</span>`;
    $('#cal-total').textContent = `ぜんぶで ${fmtChill(stats.chill || 0)}`;
  }
  openDay(key) {
    const st = this.store.load();
    const plays = st.history.filter((h) => h.day === key);
    const mood = this.store.moodOn(key);
    const list = plays.length ? `<ul class="day-list">${plays.map((h) => `<li>${new Date(h.at).getHours()}:${String(new Date(h.at).getMinutes()).padStart(2, '0')}　${MODE[h.mode] || ''}${h.grade ? ` ${h.grade}ねん` : ''}　${h.score}てん・${h.ok + (h.okawariOk || 0)}もん${h.chill ? `・${fmtChill(h.chill)}` : ''}</li>`).join('')}</ul>` : '<p>この日は あそんで いないよ。</p>';
    const canMood = plays.length > 0;
    const body = this.show({ title: fmtDay(key), html: `${list}${canMood ? `<p>きょうの でき</p><div class="mood-row" role="group" aria-label="きょうの でき">${this.moodButtons(mood)}</div>` : ''}` , foot: [{ label: 'とじる', cls: 'primary' }] });
    if (canMood) body.querySelector('.mood-row').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mood]'); if (!b) return;
      const v = b.dataset.mood === mood ? null : b.dataset.mood;
      this.store.setMood(key, v);
      this.renderCalendar();
      this.close(); this.openDay(key);
    });
  }
  moodButtons(cur) { return Object.keys(MOOD_LABEL).map((k) => `<button type="button" data-mood="${k}" aria-pressed="${cur === k}">${MOOD_SVG[k]}<span>${MOOD_LABEL[k]}</span></button>`).join(''); }

  // ---------------------------------------------------------------- bonus and pillow
  openBonus() {
    const st = this.store;
    const today = st.dayKey();
    const b = st.bonusState();
    if (b.last === today) { this.toast('きょうの シールは もう もらったよ'); return; }
    const slot = ((b.last && b.last === st.dayKey(new Date(Date.now() - 864e5)) ? b.run : 0) % 7);
    const cells = st.STICKERS.map((t, i) => `<span class="slot${i < slot ? ' got' : ''}${i === slot ? ' today' : ''}">${i <= slot ? STICKER_SVG[t] : `<small>${i + 1}</small>`}</span>`).join('');
    this.show({ title: 'きょうの シール', html: `<p>つくえの うえに シールカードが あるよ。1日 1まい もらえるよ。7日めは まんげつ。</p><div class="bonus-card">${cells}</div>`, foot: [{ label: 'もらう', cls: 'primary', onClick: () => { const r = st.claimLogin(); this.c.room.showSticker(false); if (r) this.toast(`${r.slot}日めの シールを はったよ`); this.c.audio.notify(); this.c.refreshTitle(); } }] });
  }
  openPillow() {
    const offer = this.store.pillowOffer();
    if (!offer) { this.c.room.showPillow(false); return; }
    this.show({ title: 'おやすみまくら', html: `<p>${offer.days.map(fmtDay).join('、')}は おやすみの 日に できるよ。つかうと れんぞく ${offer.run}日が つながるよ。</p><p>まくら：${offer.pillows}こ</p>`,
      foot: [{ label: 'いまは いい', onClick: () => { this.store.declinePillow(); this.c.room.showPillow(false); } }, { label: 'おやすみの 日に する', cls: 'primary', onClick: () => { this.store.usePillow(offer.days); this.c.room.showPillow(false); this.toast('おやすみの 日に したよ'); this.c.refreshTitle(); } }] });
  }

  // ---------------------------------------------------------------- rest
  openRest({ onRest, onDone }) {
    this.isRest = true;
    this.show({ title: 'ひとやすみ しよう？', html: '<div class="rest-view"><p>チルネコが のびを してるよ。<br>すこし まどの そとを ながめる？</p></div>', veilCloses: false,
      foot: [{ label: 'つづける', onClick: () => { this.isRest = false; onDone(); } }, { label: 'ひとやすみ する', cls: 'primary', onClick: () => { onRest(); this.resting(onDone); } }],
      onClose: (btn) => { if (!btn) { this.isRest = false; onDone(); } } });
  }
  resting(onDone) {
    this.isRest = true;
    this.show({ title: 'ひとやすみ', html: '<div class="rest-view"><div class="breath-guide" style="position:static"><i></i><span>すって… はいて…</span></div><p>じかんは とまって いるよ。</p></div>', veilCloses: false,
      foot: [{ label: 'つづける', cls: 'primary', onClick: () => { this.isRest = false; onDone(); } }], onClose: (btn) => { if (!btn) { this.isRest = false; onDone(); } } });
  }

  // ---------------------------------------------------------------- result
  // One result page for every ending (id056): after the basic song, after
  // okawari (with its points and cassettes), and after stopping midway
  // (`midway`: not recorded, id052).
  renderResult({ s, rate, timeMs, okawariOk, review, midway = false, askMood = false, okawari = null }) {
    const S = this.S;
    $('#result-title').textContent = midway ? 'とちゅうまでの ページ' : review ? 'ふくしゅう おしまい' : 'きょうの ページ';
    $('#r-score').textContent = String(BASIC_SCORE + (okawari ? okawari.score : 0));
    $('#r-score').closest('.score').hidden = midway;
    // Per cassette: how many problems were solved on each (id048).
    $('#r-break').innerHTML = okawari ? `きほん ${BASIC_SCORE} ＋ おかわり ${okawari.score}（${okawari.k}もん）<span class="e-tapes">${okawari.tapes.map((t, i) => `<span class="e-tape c${i % 5}"><i></i>${tapeOrdinal(i + 1)} ${t.n}もん</span>`).join('')}</span>` : '';
    const pacePct = Math.round((S.pace.flow || 0) * 100);
    // チル (id057): this play's gain by kind, the total, and the next item to arrive.
    const total = (this.store.load().stats || {}).chill || 0;
    const by = Object.entries(S.chillBy || {}).filter(([, n]) => n > 0).map(([k, n]) => `${CHILL_KIND[k] || k} ${n}`).join('・');
    const nx = col.nextItem(total);
    $('#r-chill').innerHTML = `<p><b>チル +${S.chill}</b>　ぜんぶで ${fmtChill(total)}</p>${by ? `<p class="chill-by">${esc(by)}</p>` : ''}<p class="chill-next">${nx ? `つぎに とどく「${esc(nx.item.name)}」まで あと ${fmtChill(nx.left)}` : 'コレクションは ぜんぶ とどいたよ'}</p>`;
    $('#r-stats').innerHTML = `<div><dt>といた もんだい</dt><dd>${s.completed + (okawari ? okawari.k : 0)}もん</dd></div><div><dt>初回正解</dt><dd>${Math.round(rate * 100)}%</dd></div><div><dt>じかん</dt><dd>${fmtTime(timeMs)}</dd></div><div class="minor"><dt>おしい</dt><dd>${s.misses}回</dd></div><div class="minor"><dt>さいごの ペース</dt><dd>${pacePct >= 60 ? 'いいかんじ' : 'マイペース'}</dd></div>`;
    // のびたよ: accuracy first, then speed (plan.md 5.3).
    const st = this.store.load();
    const lines = growth.growthLines(S.sessionTimes, (st.progress || { skills: {} }).skills, this.store.dayKey());
    $('#r-growth').innerHTML = lines.map((l) => `<p class="grew">のびたよ　${esc(SKILL[l.skill].name)}：${l.what === 'rate' ? `初回正解 ${Math.round(l.from * 100)}% → ${Math.round(l.to * 100)}%` : `1もん ${(l.from / 1000).toFixed(1)}びょう → ${(l.to / 1000).toFixed(1)}びょう`}</p>`).join('');
    if (lines.length && st.stats) { st.stats.grew = (st.stats.grew || 0) + lines.length; this.store.save(); }
    const news = [];
    for (const id of S.newUnlocks) news.push(`めが でた：${SKILL[id].name}`);
    for (const id of S.newMastered) news.push(`はなが さいた：${SKILL[id].name}`);
    for (const [id, n] of Object.entries(S.newStars)) news.push(`${'☆'.repeat(n)}：${SKILL[id].name}`);
    for (const id of S.polished) news.push(`ほこりを はらった：${SKILL[id].name}`);
    $('#r-skills').innerHTML = news.map((t) => `<p>${esc(t)}</p>`).join('');
    const q = this.quests();
    $('#r-quests').innerHTML = `<p>きょうの クエスト</p><ol class="quest-list">${this.questRows(q.list)}</ol>`;
    // After okawari, okawari can be had again, as many times as wanted.
    $('#go-okawari').hidden = !okawariOk;
    $('#go-okawari').querySelector('small').textContent = okawari ? 'もう いちど おかわり。カセットを また つづけるよ' : 'カセットを もう 1ぽん。いっかいで せいかいが 8わり いじょうなら つぎの カセットへ（さいだい 5ほん）';
    $('#go-again').hidden = okawariOk || review;
    $('#go-review').hidden = review || !S.wrongList.length || okawariOk;
    $('#go-end').textContent = midway ? 'へやに もどる' : 'きょうは ここまで';
    // きょうの でき: asked here, since without okawari the result page is the last one.
    this.renderMood($('.result-card'), askMood);
  }
  renderMood(card, ask) {
    const box = $('#e-mood');
    box.hidden = !ask;
    if (!ask) return;
    const key = this.store.dayKey();
    this.store.markMoodAsked(key);
    const row = box.querySelector('.mood-row');
    row.innerHTML = this.moodButtons(this.store.moodOn(key));
    row.onclick = (e) => {
      const b = e.target.closest('[data-mood]'); if (!b) return;
      this.store.setMood(key, b.dataset.mood);
      row.querySelectorAll('[data-mood]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      this.c.neko.nod(); this.c.audio.stamp();
      this.toast(`カレンダーに「${MOOD_LABEL[b.dataset.mood]}」の はんこを おしたよ`);
    };
  }
  // Quiet list of what happened; many trophies at once fold into one line.
  renderNotes(el, notes) {
    const trophies = notes.filter((n) => n.kind === 'trophy');
    const shown = [...notes.filter((n) => n.kind !== 'trophy'), ...trophies.slice(0, 4)];
    if (trophies.length > 4) shown.push({ text: `ほかに トロフィー ${trophies.length - 4}こ（たなで みられるよ）` });
    el.innerHTML = shown.map((n, i) => `<p class="note" style="animation-delay:${(i * 0.15).toFixed(2)}s"><i aria-hidden="true"></i>${esc(n.text)}</p>`).join('');
  }

  // ---------------------------------------------------------------- timelapse (experiment, plan.md 10.1)
  // The session's room, fast-forwarded in five seconds: the sky from dusk to
  // dawn, the plant growing one leaf per problem, and a note beside it where
  // the solved problems are written in order (○ first try, ✓ corrected).
  timelapse(timeline, look) {
    const host = $('#e-lapse-room');
    if (!this.lapse) this.lapse = new Room(host);
    const v = (id) => (id ? id.slice(id.indexOf(':') + 1) : undefined);
    if (look) this.lapse.setLook({ room: v(look.room), view: v(look.view), prop: v(look.prop), mate: v(look.mate), event: 'none' });
    this.lapse.setMotion(this.S.motion);
    const n = timeline.length;
    const count = $('#e-lapse-count');
    const note = $('#e-lapse-note');
    note.innerHTML = timeline.map((e) => `<li class="${e.ok ? 'ok' : 'fixed'}"><i aria-label="${e.ok ? 'いっかいで せいかい' : 'なおして せいかい'}">${e.ok ? '' : '✓'}</i><span>${esc(e.q || '')}</span></li>`).join('');
    const lines = [...note.children];
    let shown = -1;
    cancelAnimationFrame(this.lapseRaf);
    const show = (k) => {
      const i = Math.min(n, Math.floor(k * n));
      this.lapse.setTime(Math.min(1, k * 1.05));
      this.lapse.setLeaves(i);
      count.textContent = `${i}もん`;
      if (i !== shown) {
        lines.forEach((li, j) => li.classList.toggle('on', j < i));
        if (i > 0) note.scrollTop = lines[i - 1].offsetTop + lines[i - 1].offsetHeight - note.clientHeight;
        shown = i;
      }
    };
    if (this.S.motion === 0 || !n) { show(1); return; }
    const t0 = performance.now(); let last = t0;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 5000);
      show(k);
      this.lapse.update((t - last) / 1000); last = t;
      if (k < 1) this.lapseRaf = requestAnimationFrame(tick);
    };
    this.lapseRaf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- settings
  openSettings() {
    const s = this.store.settings();
    const pct = (v) => Math.round((v ?? 0) * 100);
    const motion = s.motion == null ? (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1) : s.motion;
    // Each row: name (with a "?" that opens a short explanation; hover shows it on PC) and its control.
    const row = (name, control, desc, forId = null) => `<div class="set-row"><span class="set-name">${forId ? `<label for="${forId}">${name}</label>` : `<span>${name}</span>`}<button type="button" class="info" aria-label="${name}の せつめい" aria-expanded="false">?</button><span class="set-desc">${desc}</span></span>${control}</div>`;
    const html = `
      ${row('ながさ', `<span class="len-ctl"><input id="s-min" type="range" min="1" max="10" step="1" value="${s.minutes || 3}" data-set="minutes" data-raw="1"><output id="s-min-v">やく ${s.minutes || 3}ふん</output></span>`, '1かいに とく じかん。1〜10ぷんで えらべるよ（ぴったりでは ないよ）。おかわりの カセット 1ぽんも おなじ ながさ。', 's-min')}
      ${row('おと', `<button type="button" class="switch" role="switch" data-set="sound" aria-checked="${s.sound}" aria-label="おと"></button>`, 'おんがく・こうかおん・かんきょうおんを まとめて オンか オフに するよ。')}
      ${row('ぜんたいの おおきさ', `<input id="s-vol" type="range" min="0" max="100" value="${pct(s.volume)}" data-set="volume">`, 'ぜんぶの おとの おおきさ。', 's-vol')}
      ${row('おんがく', `<input id="s-music" type="range" min="0" max="100" value="${pct(s.music)}" data-set="music">`, 'Lo-Fiの きょくの おおきさ。', 's-music')}
      ${row('こうかおん', `<input id="s-sfx" type="range" min="0" max="100" value="${pct(s.sfx)}" data-set="sfx">`, 'えんぴつで かく おと、けしゴム、まるつけ などの おおきさ。', 's-sfx')}
      ${row('かんきょうおん', `<select id="s-amb" data-set="ambient">${[['auto', 'てんきに あわせる'], ['none', 'なし'], ['rain', 'あめ'], ['fire', 'たきび'], ['insects', 'むしの こえ']].map(([k, n]) => `<option value="${k}"${s.ambient === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`, 'おんがくの うしろで ながれる まわりの おと。「てんきに あわせる」は、あめの日は あめの おと、なつと あきの はれの よるは むしの こえ。', 's-amb')}
      ${row('かんきょうおんの おおきさ', `<input id="s-ambv" type="range" min="0" max="100" value="${pct(s.ambientVol)}" data-set="ambientVol">`, 'かんきょうおんだけの おおきさ。', 's-ambv')}
      ${row('とけいを だす', `<button type="button" class="switch" role="switch" data-set="clock" aria-checked="${!!s.clock}" aria-label="とけいを だす"></button>`, 'とく あいだ、うえに「すすんだ じかん / ぜんぶの じかん」を すうじで だすよ。')}
      ${row('しんこきゅうから はじめる', `<button type="button" class="switch" role="switch" data-set="intro" aria-checked="${s.intro !== false}" aria-label="しんこきゅうから はじめる"></button>`, 'はじめる まえに、きょくの イントロに あわせて チルネコと いっしょに しんこきゅう するよ。')}
      ${row('ひとやすみの めやす', `<div class="seg" data-set="restMin">${[[0, 'なし'], [15, '15ふん'], [25, '25ふん'], [40, '40ふん']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(s.restMin ?? 25) === v}">${n}</button>`).join('')}</div>`, 'この じかん つづけて とくと、チルネコが のびを して ひとやすみを すすめるよ。')}
      ${row('うごきの つよさ', `<input id="s-motion" type="range" min="0" max="100" value="${pct(motion)}" data-set="motion">`, 'へやや チルネコの うごきの おおきさ。0に すると、ほとんど うごかなく なるよ。', 's-motion')}
      ${row('じどうで プレイを みる', '<button type="button" class="sub-btn" id="s-demo">みる ▶</button>', 'チルネコの おてほんで、すこし じどうで とくよ。きろくには のこらないよ。とちゅうで タップすると おわるよ。')}
      ${row('すべて リセット', '<button type="button" class="sub-btn" id="s-reset">けす…</button>', 'きろく・スキル・トロフィー・コレクション・せっていを ぜんぶ けすよ。もとには もどせないよ。')}
      <p style="font-size:11px;color:var(--graphite);margin-top:10px">きろくは この たんまつの なかだけに のこり、どこにも おくりません。<br>おと・おんがくは すべて この アプリの なかで つくっています（ろくおん そざいは つかっていません）。<br>フォント：Zen Maru Gothic（SIL Open Font License）</p>`;
    const body = this.show({ title: 'せってい', html, foot: [{ label: 'とじる', cls: 'primary' }] });
    const apply = (patch) => { this.store.updateSettings(patch); this.c.settingsChanged(); };
    body.addEventListener('input', (e) => {
      const k = e.target.dataset.set; if (!k || e.target.type !== 'range') return;
      if (e.target.dataset.raw) { apply({ [k]: Number(e.target.value) }); const o = body.querySelector('#s-min-v'); if (o) o.textContent = `やく ${e.target.value}ふん`; return; }
      apply({ [k]: Number(e.target.value) / 100 });
    });
    body.addEventListener('change', (e) => { const k = e.target.dataset.set; if (k && e.target.tagName === 'SELECT') { this.c.audio.unlock(); apply({ [k]: e.target.value }); } });
    body.addEventListener('click', (e) => {
      const sw = e.target.closest('.switch');
      if (sw) { const v = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(v)); this.c.audio.unlock(); apply({ [sw.dataset.set]: v }); return; }
      const seg = e.target.closest('.seg [data-v]');
      if (seg) { const k = seg.parentElement.dataset.set; seg.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === seg))); apply({ [k]: Number(seg.dataset.v) }); return; }
      const info = e.target.closest('.info');
      if (info) { const r = info.closest('.set-row'); const open = !r.classList.contains('open'); r.classList.toggle('open', open); info.setAttribute('aria-expanded', String(open)); return; }
      if (e.target.id === 's-demo') { this.close(); this.c.startDemo(); return; }
      if (e.target.id === 's-reset') this.askReset();
    });
  }
  askReset() {
    this.confirm({ title: 'すべて リセット', msg: 'きろく・スキル・トロフィー・コレクション・せっていを ぜんぶ けすよ。', yes: 'つぎへ', no: 'やめる', danger: true,
      onYes: () => this.confirm({ title: 'ほんとうに けしますか？', msg: 'けしたら もとに もどせないよ。', yes: 'けす', no: 'やめる', danger: true, onYes: () => { this.store.reset(); location.reload(); } }) });
  }

  // ---------------------------------------------------------------- trophies
  // One folded row per series (ported from Dopa Drill's list screen): the best
  // trophy so far, the next goal and how far along it is. Opening a row shows
  // every step. "もうすぐ" lists the next goals closest to done.
  openTrophies(filter = 'all') {
    // Earn what the records already reach before listing (as Dopa Drill does).
    const m = this.c.trophyMetrics ? this.c.trophyMetrics() : {};
    const ts = this.store.load().trophies || {};
    const got = ts.got || {};
    const day = (at) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()}`; };
    const now = (t, v) => (/^(flag:|gradeDone|laneDone|gradeStar3|allModes)/.test(t.metric) ? '' : t.metric === 'chill' ? `いま ${fmtChill(v)}` : t.metric === 'minutes' ? `いま ${v}ふん` : `いま ${v.toLocaleString('ja-JP')}`);
    const pct = (v) => (v.next && v.next.need > 1 ? Math.min(0.999, (v.value || 0) / v.next.need) : 0);
    const bar = (k) => `<span class="tr-bar" aria-hidden="true"><i style="width:${(k * 100).toFixed(1)}%"></i></span>`;
    let html = '';
    if (filter === 'soon') {
      const soon = tr.SERIES.map((s) => tr.seriesView(s, ts, m)).filter((v) => v.next && v.series.cat !== 'ひみつ' && v.next.need > 1)
        .map((v) => ({ v, k: pct(v) })).sort((a, b) => b.k - a.k).slice(0, 12);
      html = soon.map(({ v, k }) => `<div class="tr-row tr-soon"><i class="tr-icon">${trophyIcon(v.top ? v.top.rank : 'none')}</i><span class="tr-t"><b>${esc(v.next.name)}</b><span class="tr-next">${esc(v.series.title)}・${now(v.next, v.value)} / ${v.next.metric === 'chill' ? fmtChill(v.next.need) : v.next.need.toLocaleString('ja-JP')}</span>${bar(k)}</span><span class="tr-n">${Math.floor(k * 100)}%</span></div>`).join('');
    } else {
      for (const cat of tr.CATS) {
        const views = tr.SERIES.filter((s) => s.cat === cat).map((s) => tr.seriesView(s, ts, m)).filter((v) => filter === 'all' || (filter === 'got' ? v.got.length : v.next));
        if (!views.length) continue;
        html += `<h3 class="tr-cat">${esc(cat)}</h3>`;
        for (const v of views) {
          const s = v.series; const secret = s.cat === 'ひみつ';
          const next = v.next ? `つぎ：${secret ? '？？？' : esc(v.next.name)}${!secret && now(v.next, v.value) ? `（${now(v.next, v.value)}）` : ''}` : 'コンプリート';
          const items = s.items.filter((t) => filter !== 'got' || got[t.id]).map((t) => {
            const hide = t.secret && !got[t.id];
            const rw = t.reward && col.ITEM[t.reward];
            return `<li class="${got[t.id] ? 'got' : ''}"><i>${trophyIcon(got[t.id] ? t.rank : 'none')}</i><span><b>${hide ? '？？？' : esc(t.name)}</b><small>${hide ? 'ひみつの トロフィー' : esc(t.desc)}</small>${rw && !hide ? `<small class="rw">ごほうび：${esc(rw.name)}</small>` : ''}</span><em>${got[t.id] ? day(got[t.id]) : ''}</em></li>`;
          }).join('');
          html += `<details class="tr-series"><summary class="tr-row"><i class="tr-icon">${trophyIcon(v.top ? v.top.rank : 'none')}</i><span class="tr-t"><b>${esc(s.title)}</b><span class="tr-next${v.next ? '' : ' done'}">${next}</span>${v.next && !secret ? bar(pct(v)) : ''}</span><span class="tr-n">${v.got.length}/${s.items.length}</span></summary><ul>${items}</ul></details>`;
        }
      }
    }
    const total = tr.earnedCount({ got });
    const tabs = `<div class="tabs tr-filter" data-k="filter">${[['all', 'ぜんぶ'], ['got', 'ゲットした'], ['next', 'まだ'], ['soon', 'もうすぐ']].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${k === filter}">${n}</button>`).join('')}</div>`;
    const wasOpen = this.open && $('#dlg').classList.contains('trophy');
    const body = wasOpen ? $('#dlg-body') : this.show({ title: '', html: '', foot: [{ label: 'とじる', cls: 'primary' }] });
    $('#dlg-title').textContent = `トロフィー ${total}/${tr.TROPHIES.length}`;
    body.innerHTML = `${tabs}<div class="tr-list">${html || '<p class="tr-empty">まだ ないよ</p>'}</div>`;
    if (wasOpen) return;
    $('#dlg').classList.add('trophy');
    const prevClose = this.onClose;
    this.onClose = (x) => { $('#dlg').classList.remove('trophy'); if (prevClose) prevClose(x); };
    body.addEventListener('click', (e) => { const b = e.target.closest('.tr-filter [data-v]'); if (b && $('#dlg').classList.contains('trophy')) this.openTrophies(b.dataset.v); });
  }

  // ---------------------------------------------------------------- collection
  openCollection(cat = 'room') {
    const st = this.store.load();
    if (!st.equip) st.equip = col.defaultEquip();
    const chill = (st.stats || {}).chill || 0;
    const equip = st.equip;
    const items = col.ITEMS.filter((it) => it.cat === cat);
    const sw = (it) => {
      const v = col.variant(it.id);
      if (cat === 'color') { const p = PALETTES[v]; return `<span class="sw" style="background:${p ? p.fur : '#ccc'}"></span>`; }
      return `<span class="sw" aria-hidden="true">${CAT_ICON[cat] || ''}</span>`;
    };
    const cards = items.map((it) => {
      const own = col.isUnlocked(it, chill);
      return `<button type="button" class="item${own ? '' : ' locked'}" data-id="${it.id}" aria-pressed="${equip[cat] === it.id || (equip[cat] === 'base' && it.base)}" ${own ? '' : 'aria-disabled="true"'}>${sw(it)}<span>${esc(it.name)}</span>${own ? '' : `<span class="why">${esc(fmtChill(it.chill))}で とどく</span>`}</button>`;
    }).join('');
    const modes = `<div class="tabs" data-k="mode"><button type="button" data-v="auto" aria-pressed="${equip[cat] === 'auto'}">おまかせ（あそぶたびに かわる）</button></div>`;
    const body = this.show({ title: `コレクション ${col.ITEMS.filter((it) => col.isUnlocked(it, chill)).length}/${col.ITEMS.length}`,
      html: `<p class="chill-next">${(() => { const nx = col.nextItem(chill); return nx ? `いま ${fmtChill(chill)}。つぎに とどく「${esc(nx.item.name)}」まで あと ${fmtChill(nx.left)}` : `いま ${fmtChill(chill)}。ぜんぶ とどいたよ`; })()}</p><div class="tabs" data-k="cat">${col.CATS.map((c) => `<button type="button" data-v="${c.key}" aria-pressed="${c.key === cat}">${c.name}</button>`).join('')}</div>${modes}<div class="items">${cards}</div><p style="font-size:12px;color:var(--graphite)">えらぶと、へやや チルネコで ためせるよ。${cat === 'music' ? 'おんがくは 7びょう きけるよ。' : ''}</p>`,
      foot: [{ label: 'とじる', cls: 'primary' }], onClose: () => { this.c.audio.stop(0.8); this.c.applyLook(this.titleLook()); } });
    body.addEventListener('click', (e) => {
      const tab = e.target.closest('.tabs [data-v]');
      if (tab) { const k = tab.parentElement.dataset.k; if (k === 'cat') { this.close(); this.openCollection(tab.dataset.v); return; } equip[cat] = 'auto'; this.store.save(); this.close(); this.openCollection(cat); return; }
      const b = e.target.closest('.item'); if (!b) return;
      const it = col.ITEM[b.dataset.id];
      if (!col.isUnlocked(it, chill)) { this.toast(`チルが ${fmtChill(it.chill)} たまると とどくよ`); return; }
      equip[cat] = it.base ? 'base' : it.id;
      this.store.save();
      body.querySelectorAll('.item').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      body.querySelector('[data-k="mode"] button').setAttribute('aria-pressed', 'false');
      this.preview(it);
    });
  }
  titleLook() {
    const st = this.store.load();
    const equip = Object.fromEntries(Object.entries(st.equip || col.defaultEquip()).map(([k, v]) => [k, v === 'auto' ? 'base' : v]));
    return col.pickLook(equip, (st.stats || {}).chill || 0);
  }
  preview(it) {
    const v = col.variant(it.id);
    const look = { ...this.titleLook() };
    look[it.cat] = it.id;
    if (it.cat === 'music') {
      const song = this.S.songMap[v];
      if (song) { const a = this.c.audio; a.unlock(); a.prewarm(song, { done: () => { a.play([{ song }], { startEnergy: 1, skipIntro: true }); clearTimeout(this.pt); this.pt = setTimeout(() => a.stop(1.2), 7000); } }); }
      return;
    }
    if (it.cat === 'event') { this.c.room.playEvent(col.variant(it.id)); return; }
    this.c.applyLook(look);
  }

  // ---------------------------------------------------------------- skill tree (tiles, as in Dopa Drill)
  // Read from the top: grade 1 at the top, harder skills further down. Each
  // skill is a tile; a link runs from the bottom of a prerequisite to the top
  // of the skill, detouring down the gap between columns when a straight
  // curve would pass behind another tile (Dopa Drill's layout, Chill colours).
  openTree(selected = null) {
    const prog = (this.store.load().progress) || { skills: {}, review: [] };
    const L = TREE_LAYOUT;
    const rusty = new Set(rustyOf(prog));
    const mastered = SKILLS.filter((s) => stateOf(prog, s.id) === 'mastered').length;
    const starTotal = SKILLS.reduce((a, s) => a + starsOf(prog, s.id), 0);
    const body = this.show({ title: 'スキルツリー',
      html: `<p class="tree-sum">マスター <b>${mastered}</b> / ${SKILLS.length}　ほし <b>${starTotal}</b> / ${SKILLS.length * STAR_MAX}</p><p class="tree-note">タップで くわしく・れんしゅう　ながおし（Delete）で きろくを けす</p><div class="tree-scroll" id="tree-scroll"><div class="tree-lanes" id="tree-lanes" aria-hidden="true"></div><div class="tree" id="tree"><svg class="tree-links" id="tree-links" aria-hidden="true"></svg></div></div><div class="skill-info" id="skill-info"></div>`,
      foot: [{ label: 'とじる', cls: 'primary' }] });
    $('#dlg').classList.add('wide');
    const prevClose = this.onClose;
    this.onClose = (v) => { $('#dlg').classList.remove('wide'); if (prevClose) prevClose(v); };
    const sc = body.querySelector('#tree-scroll'); const tree = body.querySelector('#tree');
    const GAP = 12; const NODE_H = 56; const ROW_H = 78; const MIN_COL = 84;
    const W = sc.clientWidth - 8 || 360;
    const colW = Math.max(MIN_COL, W / L.cols); const nodeW = colW - GAP;
    tree.style.width = `${colW * L.cols}px`; tree.style.height = `${L.rows * ROW_H + 24}px`;
    const lanes = body.querySelector('#tree-lanes');
    lanes.style.width = `${colW * L.cols}px`;
    lanes.innerHTML = LANES.map((l) => `<span>${esc(l)}</span>`).join('');
    const pos = {};
    for (const sk of SKILLS) pos[sk.id] = { x: L.col[sk.id] * colW + GAP / 2, y: L.row[sk.id] * ROW_H + 16 };
    // Links (with detours down the column gaps).
    const bez = (t, p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
    const TRACKS = [0, -4, 4]; const used = {}; const detours = []; let links = '';
    const all = [];
    for (const sk of SKILLS) for (const q of sk.req) {
      const a = pos[q]; const b = pos[sk.id];
      const x1 = a.x + nodeW / 2; const y1 = a.y + NODE_H; const x2 = b.x + nodeW / 2; const y2 = b.y;
      const hits = (x, y) => SKILLS.some((o) => o.id !== q && o.id !== sk.id && x > pos[o.id].x - 2 && x < pos[o.id].x + nodeW + 2 && y > pos[o.id].y - 2 && y < pos[o.id].y + NODE_H + 2);
      let blocked = false;
      for (let i = 1; i < 40 && !blocked; i++) { const t = i / 40; blocked = hits(bez(t, x1, x1, x2, x2), bez(t, y1, y1 + 34, y2 - 34, y2)); }
      const link = { from: q, to: sk.id, x1, y1, x2, y2 };
      if (blocked) { const ca = L.col[q]; const cb = L.col[sk.id]; link.gap = ca + (cb > ca || (cb === ca && ca < L.cols - 1) ? 1 : 0); detours.push(link); } else link.d = `M${x1} ${y1} C${x1} ${y1 + 34} ${x2} ${y2 - 34} ${x2} ${y2}`;
      all.push(link);
    }
    detours.sort((m, n) => m.y1 - n.y1);
    for (const l of detours) {
      const spans = used[l.gap] || (used[l.gap] = TRACKS.map(() => []));
      let k = spans.findIndex((list) => list.every(([s0, s1]) => l.y2 < s0 - 6 || l.y1 > s1 + 6));
      if (k < 0) k = 0;
      spans[k].push([l.y1, l.y2]);
      const off = TRACKS[k];
      const gx = Math.max(3, Math.min(colW * L.cols - 3, l.gap * colW)) + off;
      const ya = l.y1 + (ROW_H - NODE_H) / 2 + off; const yb = l.y2 - (ROW_H - NODE_H) / 2 + off;
      l.d = `M${l.x1} ${l.y1} C${l.x1} ${ya} ${l.x1} ${ya} ${(l.x1 + gx) / 2} ${ya} S${gx} ${ya} ${gx} ${ya + 8} L${gx} ${yb - 8} C${gx} ${yb} ${gx} ${yb} ${(gx + l.x2) / 2} ${yb} S${l.x2} ${yb} ${l.x2} ${l.y2}`;
    }
    for (const l of all) links += `<path class="${stateOf(prog, l.from) === 'mastered' ? 'on' : ''}" d="${l.d}"/>`;
    tree.querySelector('#tree-links').innerHTML = links;
    for (const sk of SKILLS) {
      const st = stateOf(prog, sk.id); const stars = starsOf(prog, sk.id); const dusty = rusty.has(sk.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `node ${st}${dusty ? ' dusty' : ''}${selected === sk.id ? ' sel' : ''}`;
      b.dataset.skill = sk.id;
      b.style.cssText = `left:${pos[sk.id].x}px;top:${pos[sk.id].y}px;width:${nodeW}px;height:${NODE_H}px;--p:${masteryRatio(prog, sk.id)}`;
      b.innerHTML = `<span class="g">${sk.grade}ねん</span><span class="nm">${esc(sk.name)}</span>${st === 'learning' ? '<i class="ring"></i>' : ''}${st === 'new' ? '<i class="tag new">NEW</i>' : ''}${st === 'mastered' ? `<i class="stars">${'★'.repeat(stars)}${'☆'.repeat(STAR_MAX - stars)}</i>` : ''}${dusty ? '<i class="tag dust">ほこり</i>' : ''}`;
      b.setAttribute('aria-label', `${sk.name}（${sk.grade}ねん）${{ locked: 'まだ', new: 'NEW', learning: 'れんしゅうちゅう', mastered: `マスター ほし${stars}こ` }[st]}${dusty ? ' ほこりが ついている' : ''}`);
      tree.appendChild(b);
    }
    const info = body.querySelector('#skill-info');
    const showInfo = (id) => {
      tree.querySelectorAll('.node.sel').forEach((n) => n.classList.remove('sel'));
      const n = tree.querySelector(`[data-skill="${id}"]`); if (n) n.classList.add('sel');
      info.innerHTML = this.skillInfo(id, prog);
      const prac = info.querySelector('#practice');
      if (prac) prac.addEventListener('click', () => { this.close(); this.c.startPractice(prac.dataset.skill); });
    };
    info.innerHTML = '<p class="hint-line">タイルを えらぶと、ここに くわしく でるよ。</p>';
    if (selected) showInfo(selected);
    // Scroll to the selection or to the growing edge (the first practising skill).
    const focus = selected || SKILLS.map((s) => s.id).find((id) => ['new', 'learning'].includes(stateOf(prog, id)));
    requestAnimationFrame(() => { const el = focus && tree.querySelector(`[data-skill="${focus}"]`); if (el) { sc.scrollTop = Math.max(0, el.offsetTop - 90); sc.scrollLeft = Math.max(0, el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2); } });
    let hold = null;
    sc.addEventListener('pointerdown', (e) => {
      const n = e.target.closest('.node'); if (!n) return;
      hold = { id: n.dataset.skill, p0: { x: e.clientX, y: e.clientY }, el: n };
      n.classList.add('holding');
      hold.timer = setTimeout(() => { hold.fired = true; n.classList.remove('holding'); this.askRelock(hold.id); }, 600);
    });
    const cancel = () => { if (hold) { clearTimeout(hold.timer); hold.el.classList.remove('holding'); } };
    sc.addEventListener('pointermove', (e) => { if (hold && Math.hypot(e.clientX - hold.p0.x, e.clientY - hold.p0.y) > 10) { cancel(); hold = null; } });
    sc.addEventListener('pointerup', cancel);
    sc.addEventListener('pointercancel', cancel);
    sc.addEventListener('click', (e) => { const n = e.target.closest('.node'); if (!n) return; if (hold && hold.fired) { hold = null; return; } hold = null; showInfo(n.dataset.skill); });
    sc.addEventListener('keydown', (e) => { const n = e.target.closest('.node'); if (n && e.key === 'Delete') this.askRelock(n.dataset.skill); });
  }
  skillInfo(id, prog) {
    const s = SKILL[id]; const st = stateOf(prog, id); const stars = starsOf(prog, id);
    const r = prog.skills[id];
    const ns = nextStar(prog, id, this.store.dayKey());
    const lines = [`<p><b>${esc(s.name)}</b>（${s.grade}ねん・${esc(LANES[s.lane])}）</p>`];
    lines.push(`<p>${{ locked: 'まだ ひらいて いないよ。うえの スキルを マスターすると ひらくよ。', new: 'あたらしく ひらいたよ（NEW）。', learning: 'れんしゅうちゅう。さいきん 6もんの うち 5もん 初回正解で マスター。', mastered: 'マスター！' }[st]}</p>`);
    if (st === 'mastered') lines.push(`<p class="stars-row" aria-label="ほし ${stars}">${'★'.repeat(stars)}${'☆'.repeat(STAR_MAX - stars)}</p>`);
    if (ns) lines.push(`<p style="font-size:12px">つぎの ほし：${esc(ns.text)}（${esc(ns.now)}）</p>`);
    if (r && r.n) lines.push(`<p style="font-size:12px;color:var(--graphite)">といた かず ${r.n}もん</p>`);
    if (st !== 'locked') lines.push(`<button type="button" class="sub-btn" id="practice" data-skill="${id}">この スキルを れんしゅう</button>`);
    if (rustyOf(prog).includes(id)) lines.push('<p style="font-size:12px">ほこりが ついているよ。1もん 初回正解で ピカピカ！</p>');
    return lines.join('');
  }
  askRelock(id) {
    const prog = this.store.load().progress;
    if (!prog) return;
    const ids = relockTargets(prog, id);
    if (!ids.length) { this.toast('けす きろくが ないよ'); return; }
    this.close();
    this.confirm({ title: 'スキルの きろくを けす？', msg: `「${SKILL[id].name}」${ids.length > 1 ? ` と、その さきの ${ids.length - 1}こ` : ''}の きろくと ほしを けすよ。トロフィーや コレクションは のこるよ。`, yes: 'けす', no: 'やめる', danger: true,
      onYes: () => { relockSkill(prog, id); this.store.save(); this.toast('けしたよ'); this.c.refreshTitle(); this.openTree(id); },
      onNo: () => this.openTree(id) });
  }
}
