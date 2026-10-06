// Collection (plan.md 8.2): what the room looks and sounds like. Items arrive
// one after another, in a fixed order, as チル adds up (id057): never random
// and never spent, so "the next one" and how far away it is can always be
// shown. Only the player's choice per category is saved.

export const CATS = [
  { key: 'room', name: 'へや' },
  { key: 'view', name: 'まどのそと' },
  { key: 'music', name: 'おんがく' },
  { key: 'prop', name: 'つくえの こもの' },
  { key: 'costume', name: 'きせかえ' },
  { key: 'color', name: 'チルネコの いろ' },
  { key: 'mate', name: 'ルームメイト' },
  { key: 'event', name: 'まどの できごと' },
];

export const ITEMS = [];
export const ITEM = {};
export function addItems(list) {
  for (const it of list) { ITEMS.push(it); ITEM[it.id] = it; }
}
// Available from the start.
addItems([
  { id: 'room:night', cat: 'room', name: 'よるの へや', base: true },
  { id: 'view:city', cat: 'view', name: 'あめの まち', base: true },
  { id: 'music:rain-piano', cat: 'music', name: 'あまおとと ピアノ', base: true },
  { id: 'prop:mug', cat: 'prop', name: 'マグカップ', base: true },
  { id: 'costume:none', cat: 'costume', name: 'なし', base: true },
  { id: 'color:lavender', cat: 'color', name: 'ラベンダー', base: true },
  { id: 'mate:none', cat: 'mate', name: 'なし', base: true },
  { id: 'event:shooting', cat: 'event', name: 'ながれぼし', base: true },
]);
// In order of arrival: something from a different shelf each time, the
// window events (id062) spread among them.
const ORDER = [
  { id: 'costume:headphones', cat: 'costume', name: 'ヘッドホン' },
  { id: 'view:snow', cat: 'view', name: 'ゆき' },
  { id: 'event:fireflies', cat: 'event', name: 'ほたる' },
  { id: 'music:piano-hoshi', cat: 'music', name: 'ほしあかりの ピアノ' },
  { id: 'color:sage', cat: 'color', name: 'セージ' },
  { id: 'costume:knit', cat: 'costume', name: 'ニットぼう' },
  { id: 'prop:plant', cat: 'prop', name: 'かんようしょくぶつ' },
  { id: 'event:balloon', cat: 'event', name: 'ふうせん' },
  { id: 'room:attic', cat: 'room', name: 'やねうら' },
  { id: 'music:piano-yuugure', cat: 'music', name: 'ゆうぐれの ピアノ' },
  { id: 'mate:fish', cat: 'mate', name: 'きんぎょ' },
  { id: 'event:fullmoon', cat: 'event', name: 'まんげつ' },
  { id: 'music:cassette', cat: 'music', name: 'カセット ドライブ' },
  { id: 'view:sea', cat: 'view', name: 'うみ' },
  { id: 'color:oatmeal', cat: 'color', name: 'オートミール' },
  { id: 'event:birds', cat: 'event', name: 'わたりどり' },
  { id: 'room:cafe', cat: 'room', name: 'カフェの まどぎわ' },
  { id: 'prop:record', cat: 'prop', name: 'レコードプレーヤー' },
  { id: 'music:bell-konayuki', cat: 'music', name: 'こなゆきの ベル' },
  { id: 'view:forest', cat: 'view', name: 'もり' },
  { id: 'event:fireworks', cat: 'event', name: 'とおくの はなび' },
  { id: 'costume:beret', cat: 'costume', name: 'ベレーぼう' },
  { id: 'color:bluegrey', cat: 'color', name: 'ブルーグレー' },
  { id: 'room:train', cat: 'room', name: 'でんしゃの まど' },
  { id: 'prop:goldfish', cat: 'prop', name: 'きんぎょばち' },
  { id: 'music:piano-asa', cat: 'music', name: 'あさつゆの ピアノ' },
  { id: 'event:clouds', cat: 'event', name: 'ひつじぐも' },
  { id: 'music:winter-bell', cat: 'music', name: 'ふゆの ベル' },
  { id: 'view:stars', cat: 'view', name: 'ほしぞら' },
  { id: 'costume:nightcap', cat: 'costume', name: 'ナイトキャップ' },
  { id: 'event:airship', cat: 'event', name: 'ひこうせん' },
  { id: 'color:warmgrey', cat: 'color', name: 'ウォームグレー' },
  { id: 'mate:bird', cat: 'mate', name: 'ことり' },
  { id: 'room:engawa', cat: 'room', name: 'えんがわ' },
  { id: 'prop:candle', cat: 'prop', name: 'ろうそく' },
  { id: 'event:lanterns', cat: 'event', name: 'スカイランタン' },
  { id: 'music:bell-hoshizora', cat: 'music', name: 'ほしぞらの ベル' },
  { id: 'view:sakura', cat: 'view', name: 'さくらなみき' },
  { id: 'costume:leaf', cat: 'costume', name: 'はっぱ' },
  { id: 'color:night', cat: 'color', name: 'よるいろ' },
  { id: 'mate:dopakichi', cat: 'mate', name: 'ドパキチ' },
  { id: 'room:cabin', cat: 'room', name: 'ログハウス' },
  { id: 'prop:globe', cat: 'prop', name: 'ちきゅうぎ' },
  { id: 'music:bell-tomoshibi', cat: 'music', name: 'ともしびの ベル' },
  { id: 'event:aurora', cat: 'event', name: 'オーロラ' },
  { id: 'costume:crown', cat: 'costume', name: 'おうかん' },
  { id: 'color:rainbow', cat: 'color', name: 'にじいろ' },
];
// The n-th item (0-based) arrives at a total of sum(40 + 15k, k <= n) チル:
// the first after one play, then a little further apart each time.
export const chillFor = (n) => 40 * (n + 1) + 15 * (n * (n + 1)) / 2;
addItems(ORDER.map((it, n) => ({ ...it, chill: chillFor(n) })));

// `chill`: the player's total チル.
export const isUnlocked = (it, chill = 0) => !!(it && (it.base || chill >= it.chill));
export const unlockedIn = (cat, chill) => ITEMS.filter((it) => it.cat === cat && isUnlocked(it, chill));
// The next item to arrive and how much チル is left, or null when all are here.
export function nextItem(chill = 0) {
  const it = ITEMS.find((x) => !x.base && chill < x.chill);
  return it ? { item: it, left: it.chill - chill } : null;
}
// Items that arrived between two totals (for the quiet notes after a play).
export const arrived = (before, after) => ITEMS.filter((it) => !it.base && it.chill > before && it.chill <= after);
export const defaultEquip = () => Object.fromEntries(CATS.map((c) => [c.key, c.key === 'music' || c.key === 'color' || c.key === 'room' ? 'base' : 'auto']));
const baseOf = (cat) => ITEMS.find((it) => it.cat === cat && it.base);

// The look for one play: fixed choices stay; "auto" picks among the unlocked
// ones so every play can look and sound a little different. "base" keeps the
// starting item.
export function pickLook(equip = {}, chill = 0, rng = Math.random) {
  const look = {};
  for (const { key } of CATS) {
    const want = equip[key];
    const own = unlockedIn(key, chill);
    if (want && want !== 'auto' && want !== 'base' && own.some((it) => it.id === want)) look[key] = want;
    else if (want === 'auto') look[key] = own[Math.floor(rng() * own.length)].id;
    else look[key] = baseOf(key).id;
  }
  return look;
}
// The part after "cat:".
export const variant = (id) => (id ? id.slice(id.indexOf(':') + 1) : '');
