// Writes docs/trophies.md and docs/collection.md from the code.
import fs from 'node:fs';
import { SERIES, CATS } from '../app/js/trophies.js';
import { ITEMS, CATS as COL } from '../app/js/collection.js';
let t = '# トロフィー一覧\n\n`tools/gen_docs.mjs` で生成。トロフィーは減らない。ひみつは獲得まで名前を伏せる。トロフィーはごほうびのない達成記録（コレクションはチルで届く）。\n\n';
t += `全 ${SERIES.reduce((a, s) => a + s.items.length, 0)} 種、${CATS.length} 分類。\n\n`;
for (const c of CATS) {
  t += `## ${c}\n\n| シリーズ | 段階 |\n| --- | --- |\n`;
  for (const s of SERIES.filter((x) => x.cat === c)) t += `| ${s.title} | ${s.items.map((i) => i.name).join('、')} |\n`;
  t += '\n';
}
fs.writeFileSync('docs/trophies.md', t);
const fmt = (n) => n.toLocaleString('ja-JP');
let c = '# コレクション一覧\n\n`tools/gen_docs.mjs` で生成。各カテゴリに初期の1種があり、残りは累計チルが決まった値に届くと、決まった順に届く（抽選なし、使って減らない）。\n\n';
c += '## 届く順\n\n| 順 | なまえ | 分類 | 累計チル |\n| --- | --- | --- | --- |\n';
ITEMS.filter((x) => !x.base).forEach((it, i) => { c += `| ${i + 1} | ${it.name} | ${COL.find((k) => k.key === it.cat).name} | ${fmt(it.chill)} |\n`; });
c += '\n';
for (const k of COL) {
  c += `## ${k.name}\n\n| なまえ | 手に入れかた |\n| --- | --- |\n`;
  for (const it of ITEMS.filter((x) => x.cat === k.key)) c += `| ${it.name} | ${it.base ? 'はじめから' : `${fmt(it.chill)}チル`} |\n`;
  c += '\n';
}
fs.writeFileSync('docs/collection.md', c);
console.log('ok');
