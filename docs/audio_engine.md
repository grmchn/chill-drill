# 音源エンジンと曲データ

## 構成

| ファイル | 役割 |
| --- | --- |
| `app/js/audio/dsp.js` | 楽器・ドラム・環境音・効果音（鉛筆、消しゴム、紙）・残響のインパルス応答を、数式から直接サンプル列として合成する純粋関数。録音素材は使わない |
| `app/js/audio/arranger.js` | 曲データを1小節ずつ音符の列にする。コードの解析、ボイシング（声部の動きが最小になる転回）、ドラム・ベース・コード・合いの手の奏法、旋律の変奏、構成（form）、層の出入り |
| `app/js/audio/engine.js` | Web Audio API で再生する。音符をバッファにして保存（キャッシュ）し、先読みスケジューラで鳴らす。テープのゆらぎ（遅延の変調）、サチュレーション、ローパス、ローシェルフ、残響、レコードのノイズ、コンプレッサー。効果音と環境音もここで鳴らす |
| `app/js/audio/wav.js` | WAVへの書き出しとレベル計測 |
| `app/audio/songs/*.json` | 曲データ（6曲） |
| `tools/lofi-studio/` | 作曲・音作りツール（同じエンジンを使う） |
| `tools/make_songs.py` | 曲データの最初の書き出しに使ったスクリプト（以後はツールで編集） |

同じエンジンを、ゲーム、ツール、オフラインの書き出し（`renderOffline`、OfflineAudioContext）で共有するため、どこで聞いても同じ音になる。

## 楽器（dsp.js）

| 名前 | 合成方法 |
| --- | --- |
| `epiano` | 2組のFM（胴体と、14倍音の「ティン」）、トレモロ。Rhodes系 |
| `piano` | 非調和な倍音を、それぞれ速い減衰と遅い減衰の2段で鳴らす。フェルトのハンマー音 |
| `kalimba` | 正弦波と、5.93倍の短い倍音 |
| `celesta` | 1・4・10.1倍の倍音、速い減衰 |
| `vibes` | 1・3.98・9.8倍の倍音とトレモロ |
| `nylon` / `guitar` | Karplus-Strong（撥弦）と胴の共鳴 |
| `upright` | 撥弦を低域で丸め、基音を足す |
| `subbass` | 正弦波と2・3倍音（小さなスピーカーでも聞こえるように） |
| `flute` | 正弦波と息のノイズ、遅れて入るビブラート |
| `pad`（エンジン内） | わずかにずらした2本のノコギリ波をローパスに通し、ゆっくり立ち上げる |

ドラム：キック、スネア、リム、ハイハット（閉・開）、ライド、シェイカー、ブラシ、タム。
環境音：雨、焚き火、カフェ、虫の声、部屋の空気（ループの継ぎ目はクロスフェード）。

## 曲データ（JSON）

```text
{
  id, title, bpm(70〜85), swing(0〜0.4), key(メモ), seed, targetSec(1曲の目安秒),
  form: ["intro","A","A","B",...], loopFrom: 1,          // 目安の長さまで繰り返し、最後に O
  sections: { name: { bars, chords: ["Fmaj9","Em7b5 A7b9",...], melody?: "a", breath?: true, loop?: true } },
  melodies: { a: [[小節, 16分の位置, 長さ, 基準音からの半音], ...] },
  lead: { base: MIDI }, keys: { center }, bass: { low },
  tracks: { keys|lead|bass|counter: { inst, gain, pan, send, params }, drums: { gain, send, tone }, pad: { gain, cutoff } },
  styles: { drums, bass, keys, counter },
  layers: [{ track, at: エネルギー }],                     // pad・keys → drums → bass → lead → counter
  fx: { wow, flutter, crackle, lpf, sat, reverb },
  bside: { transpose, styles, melodyOctave, tracks? },     // おかわり用の変奏
  input: { inst }                                          // 入力音の楽器
}
```

- `intro` は深呼吸用（2小節）。ドラム・ベース・旋律は鳴らない。
- `O`（アウトロ）は、時間切れのあと最後の問題を解いている間、ループして待つ。`finish()` で次の小節に締めの和音を鳴らし、約7秒でフェードする。
- 奏法：ドラム `boombap` `tape` `jazzbrush` `bossa` `soft`、ベース `lofi` `walk` `bossa` `hold`、コード `lofi` `jazz` `bossa` `arp` `hold`、合いの手 `arp16` `chime` `fill`。

## 実行時の操作（engine.js）

| メソッド | 内容 |
| --- | --- |
| `prewarm(song, {done})` | 曲で使う音を少しずつ（8ms単位）合成して保存する |
| `play(playlist, {startEnergy, endless, skipIntro})` | 再生。戻り値は「アウトロ前まで」の秒数（基本の長さ） |
| `setEnergy(e)` | 層の出入り（小節の頭で切り替え、1小節かけてフェード） |
| `setFlow(f)` | マイペース：ローパスが開いて音が澄む |
| `finish()` / `stop()` | 締めの和音／停止 |
| `pause()` / `resume()` | AudioContext ごと止める（休憩・タブ非表示） |
| `key(digit, place)` | 入力音：木の音と、現在のコードの構成音（数字で音を選ぶ） |
| `write` `erase` `rub` `check` `maru` `wrong` `notify` `lantern` `chime` `breath` `page` `stamp` | 効果音 |
| `setAmbient(kind)` | 環境音 |
| `songTime` | 再生した時間（一時停止を除く）。セッションの時計に使う |

## ミックスの目安

各トラックを単独で鳴らしたRMSを計測し、keys・lead・bass・drums を約−20dBFS、counter・pad をそれより小さく合わせた。全体は0.72倍に下げて余裕（ヘッドルーム）を持たせる。低域は140Hzのローシェルフで −3.5dB、高域は曲ごとのローパス（3000〜5200Hz×1.15）でLo-Fiらしく丸める。
