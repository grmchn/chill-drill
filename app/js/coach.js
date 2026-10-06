// Guided tour with チルネコ: a soft spotlight on one thing at a time, a small
// paper card that explains it, and チルネコ walking over to point at it with
// a paw. The card is the narration (the cat stays non-verbal, as in Dopa
// Drill's guide). Two tours: "play" (first launch: how to start) and "help"
// (the ? button: everything else on the title).

const $ = (s) => document.querySelector(s);

export const TOURS = {
  play: [
    { target: '.cover .logo', title: 'チルドリルへ ようこそ', text: 'Lo-Fiの おんがくを ききながら、チルネコと いっしょに さんすうを するよ。いそがなくて だいじょうぶ。', face: 'content', act: 'blink' },
    { target: '#start', title: 'じぶんレベル', text: 'いちばん おすすめ。はじめは じつりょくチェックで、ちょうど いい もんだいを さがすよ。', face: 'focus', act: 'point' },
    { target: '.grades', title: '学年べつ', text: '1〜6ねんせいの けいさんを えらんで とくことも できるよ。', face: 'idle', act: 'point' },
    { target: '#start', title: 'さあ、はじめよう', text: 'えらんで タップしてね。1かいは やく3ぷん。ながさは せっていで 1〜10ぷんに かえられるよ。ほかの ことは「？」で いつでも みられるよ。', face: 'happy', act: 'tail', last: 'はじめる' },
  ],
  help: [
    { target: '#open-tree', alt: '[data-hit="tree"]', title: 'スキルツリー', text: 'できるように なった けいさんが ならぶよ。うえから したへ むずかしく なるよ。へやの はちうえからも ひらけるよ。', face: 'content', act: 'point' },
    { target: '#open-trophy', alt: '[data-hit="trophy"]', title: 'トロフィー', text: 'たなに ならぶ トロフィー。つづけたり、たくさん といたり すると もらえるよ。', face: 'idle', act: 'point' },
    { target: '#open-collect', alt: '[data-hit="collection"]', title: 'コレクション', text: 'へや、まどの そと、おんがく、まどの できごと、チルネコの きせかえを えらべるよ。チルが たまると ふえていくよ。', face: 'happy', act: 'point' },
    { target: '#quests', title: 'きょうの クエスト', text: 'まいにち 3つ。ぜんぶ できたら、おやすみまくらが もらえるよ。', face: 'focus', act: 'point' },
    { target: '#calendar', title: 'カレンダー', text: 'あそんだ日には あしあと。おわりに えらんだ「きょうの でき」の はんこも おされるよ。日づけを タップすると くわしく みられるよ。', face: 'content', act: 'point' },
    { target: '[data-hit="bonus"]', optional: true, title: 'シールカード', text: 'つくえの うえの シールカードを タップすると、1日 1まい シールが もらえるよ。', face: 'happy', act: 'point' },
    { target: '[data-hit="pillow"]', optional: true, title: 'おやすみまくら', text: 'あそべなかった日を「おやすみの日」に して、れんぞくを つなげるよ。', face: 'sleepy', act: 'point' },
    { target: null, title: 'とくとき', text: 'こたえを おすと、チルネコが えんぴつで かくよ。まちがえても、けしゴムで けして かきなおせば だいじょうぶ。', face: 'focus', act: 'write' },
    { target: null, title: 'おかわり', text: 'いっかいで せいかいが 8わり いじょうなら おかわり。カセットを もう 1ぽん（さっきと おなじ じかん）とくよ。8わり いじょうなら つぎの カセットへ。さいだい 5ほん。', face: 'happy', act: 'tail' },
    { target: '#cal-total', title: 'チル', text: 'こたえの すうじを 1つ かくと 1チル。おちついた テンポだと 2ばい、いっかいで せいかいや マイペースが つづくと おまけも あるよ。へらないよ。ぜんぶの チルは ここ。たまると コレクションが じゅんばんに とどくよ。', face: 'content', act: 'point' },
    { target: '#open-settings', title: 'せってい', text: 'ながさ（1〜10ぷん）、おとの おおきさ、かんきょうおん、うごきの つよさ、ひとやすみの めやすを かえられるよ。', face: 'idle', act: 'point', last: 'おしまい' },
  ],
  // The first okawari ever (id049): shown on the play screen before the
  // cassette rolls; the clock waits until the last card.
  okawari: [
    { target: '#tape-rack', title: 'おかわり', text: 'カセットを もう 1ぽん。さっきと おなじ じかんだけ、もんだいを とくよ。', face: 'happy', act: 'point' },
    { target: '#tape-rack', title: 'つぎの カセットへ', text: '1ぽんの あいだに いっかいで せいかいが 8わり いじょうなら、つぎの カセットへ つづくよ。さいだい 5ほん。おわった カセットの したに といた かずが でるよ。', face: 'focus', act: 'point' },
    { target: '#stop', alt: '.stop-btn', title: 'てんすう', text: 'おかわりは 1もんごとに てんすうが ふえていくよ。「ここまで」で いつでも おわれるよ。', face: 'content', act: 'point', last: 'はじめる' },
  ],
};

export class Coach {
  constructor({ neko, motion, onEnd }) {
    this.neko = neko;
    this.motion = motion;
    this.onEnd = onEnd;
    this.active = false;
    const el = document.createElement('div');
    el.className = 'coach';
    el.hidden = true;
    el.innerHTML = `<div class="coach-veil"></div><div class="coach-hole" aria-hidden="true"></div>
      <section class="coach-card paper" role="dialog" aria-modal="true" aria-labelledby="coach-title" aria-describedby="coach-text">
        <h2 id="coach-title"></h2><p id="coach-text"></p>
        <div class="coach-dots" aria-hidden="true"></div>
        <div class="coach-btns"><button type="button" data-k="skip">とばす</button><span class="sp"></span><button type="button" data-k="back">もどる</button><button type="button" data-k="next" class="primary">つぎへ</button></div>
      </section>`;
    $('#app').appendChild(el);
    this.el = el;
    this.hole = el.querySelector('.coach-hole');
    this.card = el.querySelector('.coach-card');
    el.addEventListener('click', (e) => {
      const k = e.target.dataset && e.target.dataset.k;
      if (k === 'next') this.go(this.i + 1);
      else if (k === 'back') this.go(this.i - 1);
      else if (k === 'skip') this.end();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.end(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.i - 1); }
      else if (e.key === 'Tab') {
        const f = [...this.card.querySelectorAll('button')].filter((b) => !b.hidden);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    addEventListener('resize', () => { if (this.active) this.go(this.i, true); });
  }

  start(name) {
    // Optional steps (the sticker card, the pillow) only when they are shown.
    this.steps = TOURS[name].filter((s) => !s.optional || this.find(s));
    this.name = name;
    this.active = true;
    this.el.hidden = false;
    document.body.classList.add('coaching');
    this.neko.setProp('none');
    this.go(0);
  }

  find(step) {
    for (const sel of [step.target, step.alt]) {
      if (!sel) continue;
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height && el.getAttribute('display') !== 'none' && !el.closest('[display="none"]')) return el;
    }
    return null;
  }

  async go(i, again = false) {
    if (i < 0 || !this.steps) return;
    if (i >= this.steps.length) { this.end(); return; }
    this.i = i;
    const s = this.steps[i];
    const target = s.target ? this.find(s) : null;
    if (target && !again) {
      target.scrollIntoView({ block: 'center', behavior: this.motion() ? 'smooth' : 'auto' });
      await new Promise((r) => setTimeout(r, this.motion() ? 380 : 30));
      if (this.i !== i) return;
    }
    const r = target ? target.getBoundingClientRect() : null;
    const pad = 8;
    if (r) {
      Object.assign(this.hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, opacity: 1 });
    } else {
      Object.assign(this.hole.style, { left: '50%', top: '42%', width: '0px', height: '0px', opacity: 1 });
    }
    // The card goes below the spotlight when there is room, else above.
    this.el.querySelector('#coach-title').textContent = s.title;
    this.el.querySelector('#coach-text').textContent = s.text;
    this.el.querySelector('.coach-dots').innerHTML = this.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    this.el.querySelector('[data-k="back"]').hidden = i === 0;
    this.el.querySelector('[data-k="skip"]').hidden = i === this.steps.length - 1;
    this.el.querySelector('[data-k="next"]').textContent = s.last || 'つぎへ';
    const vw = innerWidth; const vh = innerHeight;
    const cw = Math.min(360, vw - 32);
    this.card.style.width = `${cw}px`;
    const ch = this.card.offsetHeight || 170;
    let top; let left;
    if (r) {
      const below = r.bottom + pad + 14; const above = r.top - pad - 14 - ch;
      top = below + ch < vh - 8 ? below : above > 8 ? above : Math.max(8, vh - ch - 8);
      left = Math.min(vw - cw - 16, Math.max(16, r.left + r.width / 2 - cw / 2));
    } else { top = vh * 0.5 - ch / 2; left = (vw - cw) / 2; }
    Object.assign(this.card.style, { top: `${top}px`, left: `${left}px` });
    this.placeNeko(s, r, { top, left, w: cw, h: ch });
    requestAnimationFrame(() => this.el.querySelector('[data-k="next"]').focus());
  }

  // チルネコ walks next to the spotlight (or onto the card) and acts.
  placeNeko(s, r, card) {
    const host = $('#neko-host');
    const op = host.offsetParent ? host.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    const size = this.neko.svg.getBoundingClientRect().width || 100;
    let x; let y;
    if (r) {
      // Beside the target when there is room; otherwise on its top edge at the
      // right end (never over the words), paw reaching down to it.
      const roomR = innerWidth - r.right; const roomL = r.left;
      if (roomR > size * 0.75 || roomL > size * 0.75) {
        x = roomR >= roomL ? r.right + size * 0.4 : r.left - size * 0.4;
        y = Math.min(innerHeight - 8, r.top + Math.min(r.height, size) * 0.95);
      } else {
        x = Math.min(innerWidth - size * 0.45, r.right - size * 0.42);
        y = r.top - 2;
        if (y - size < 40) y = r.bottom + size * 0.95; // no room above: sit below
      }
      // Do not sit on the card.
      if (y > card.top - 4 && y - size < card.top + card.h && x > card.left - size * 0.4 && x < card.left + card.w + size * 0.4) y = card.top - 2;
    } else {
      // No target: sit on the card's top edge.
      x = card.left + card.w - size * 0.45; y = card.top + size * 0.1;
    }
    host.style.left = `${x - op.left}px`;
    host.style.top = `${y - op.top}px`;
    const n = this.neko;
    n.reach(null); n.stretch(false); n.melt(0);
    n.setFace(s.face || 'idle');
    clearTimeout(this.actTimer);
    this.actTimer = setTimeout(() => {
      if (!this.active) return;
      if (s.act === 'point' && r) { n.reach({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, { end: 'paw' }); n.look((r.left + r.width / 2 - x) / 10, (r.top + r.height / 2 - y) / 14); }
      else if (s.act === 'blink') n.slowBlink();
      else if (s.act === 'tail') { n.tailFlick(); n.nod(); }
      else if (s.act === 'stretch') { n.stretch(true); setTimeout(() => n.stretch(false), 1800); }
      else if (s.act === 'write') { n.setProp('pencil'); n.reach({ x: card.left + 40, y: card.top + card.h - 30 }); setTimeout(() => n.reach(null), 900); }
    }, this.motion() ? 650 : 0);
  }

  end() {
    if (!this.active) return;
    this.active = false;
    this.el.hidden = true;
    document.body.classList.remove('coaching');
    clearTimeout(this.actTimer);
    this.neko.reach(null); this.neko.setProp('pencil'); this.neko.setFace('idle');
    if (this.onEnd) this.onEnd(this.name);
  }
}
