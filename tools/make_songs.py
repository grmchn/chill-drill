"""Writes the initial song data (app/audio/songs/*.json).

The songs were composed for Chill Drill; this script is only the first
authoring step. After it runs once, the files are edited with the studio
tool (tools/lofi-studio/), so do not re-run it over edited songs.
Songs removed after review (REMOVED) are not written, and an existing
index.json (which also lists the variations from tools/compose_variants.mjs)
is kept.
"""
import json, pathlib, sys

# Removed on 2026-10-06 after the operator's listening (id068, id070).
REMOVED = {'jazz-kissa', 'bossa-window', 'sunset-guitar'}
OUT = pathlib.Path(__file__).resolve().parents[1] / 'app' / 'audio' / 'songs'
FORM = ['intro', 'A', 'A', 'B', 'A', 'C', 'B', 'A', 'A']
LAYERS = [
    {'track': 'pad', 'at': 0}, {'track': 'keys', 'at': 0},
    {'track': 'drums', 'at': 0.18}, {'track': 'bass', 'at': 0.32},
    {'track': 'lead', 'at': 0.48}, {'track': 'counter', 'at': 0.68},
]

def song(id, title, bpm, swing, key, A, B, intro, O, melA, melB, tracks, styles, fx, bside, lead_base, input_inst, center=62, bass_low=36, note=''):
    return {
        'id': id, 'title': title, 'bpm': bpm, 'swing': swing, 'key': key, 'seed': sum(map(ord, id)),
        'note': note,
        'targetSec': 240, 'loopFrom': 1, 'form': FORM, 'layers': LAYERS,
        'sections': {
            'intro': {'bars': 2, 'chords': intro, 'breath': True},
            'A': {'bars': 8, 'chords': A, 'melody': 'a'},
            'B': {'bars': 8, 'chords': B, 'melody': 'b'},
            'C': {'bars': 8, 'chords': A},
            'O': {'bars': 4, 'chords': O, 'loop': True},
        },
        'melodies': {'a': melA, 'b': melB},
        'lead': {'base': lead_base, 'octaveOnRepeat': False},
        'keys': {'center': center}, 'bass': {'low': bass_low},
        'tracks': tracks, 'styles': styles, 'fx': fx, 'bside': bside, 'input': {'inst': input_inst},
    }

def t(inst, gain, pan=0, send=0.2, **params):
    return {'inst': inst, 'gain': gain, 'pan': pan, 'send': send, 'params': params}

songs = [
    song('rain-piano', 'あまおとと ピアノ', 72, 0.1, 'F',
         ['Fmaj9', 'Em7b5 A7b9', 'Dm9', 'Cm9 F13', 'Bbmaj9', 'Bbm6 Eb9', 'Am7 D7b9', 'Gm9 C9sus4'],
         ['Bbmaj9', 'C/Bb', 'Am7', 'Dm9', 'Gm9', 'C9', 'Fmaj9', 'C9sus4'],
         ['Bbmaj9', 'C9sus4'], ['Fmaj9', 'Bbmaj9', 'Fmaj9', 'Bbmaj9'],
         [[0,0,6,16],[0,6,2,14],[0,8,6,11],[0,14,2,9],[1,0,4,9],[1,4,4,5],[1,8,4,8],[1,12,4,11],[2,0,8,12],[2,8,4,16],[2,12,4,14],[3,0,6,10],[3,6,2,9],[3,8,8,7],[4,0,6,16],[4,6,2,12],[4,8,8,9],[5,0,4,8],[5,4,4,12],[5,8,6,14],[5,14,2,12],[6,0,6,11],[6,6,2,7],[6,8,6,13],[6,14,2,9],[7,0,6,16],[7,6,2,14],[7,8,8,12]],
         [[0,0,4,21],[0,4,4,19],[0,8,8,16],[1,0,8,14],[1,8,8,11],[2,0,4,16],[2,4,4,19],[2,8,8,14],[3,0,12,16],[3,12,4,12],[4,0,4,17],[4,4,4,16],[4,8,8,14],[5,0,8,11],[5,8,4,14],[5,12,4,9],[6,0,10,11],[6,10,6,7],[7,0,6,12],[7,6,10,14]],
         {'keys': t('epiano', 0.5, -0.15, 0.25, bright=0.45, bell=0.2, trem=0.08), 'lead': t('piano', 0.55, 0.1, 0.35, bright=0.4), 'bass': t('subbass', 0.62, 0, 0.0, bright=0.3),
          'counter': t('kalimba', 0.32, 0.35, 0.4), 'drums': {'gain': 0.5, 'send': 0.08, 'tone': 0.4}, 'pad': {'gain': 0.12, 'cutoff': 900}},
         {'drums': 'boombap', 'bass': 'lofi', 'keys': 'lofi', 'counter': 'chime'},
         {'wow': 0.35, 'flutter': 0.2, 'crackle': 0.45, 'lpf': 3400, 'sat': 0.25, 'reverb': 0.3},
         {'transpose': -2, 'styles': {'drums': 'tape', 'keys': 'arp'}, 'melodyOctave': 12},
         65, 'kalimba', note='基本の曲。フェルトピアノの旋律と、こもったエレピ。'),
    song('jazz-kissa', 'よるの ジャズきっさ', 84, 0.3, 'Bb',
         ['Cm9', 'F13', 'Bbmaj9', 'Ebmaj9', 'Am7b5', 'D7b9', 'Gm9', 'Cm9 F13'],
         ['Ebmaj9', 'Ab13', 'Dm7', 'G7b9', 'Cm9', 'F13', 'Bbmaj9', 'Dm7b5 G7b9'],
         ['Gm9', 'Dm7b5 G7b9'], ['Bbmaj9', 'Ebmaj9', 'Bbmaj9', 'Ebmaj9'],
         [[0,0,3,9],[0,3,3,7],[0,6,6,5],[0,12,4,2],[1,0,6,4],[1,6,2,5],[1,8,8,11],[2,0,8,14],[2,8,4,12],[2,12,4,11],[3,0,12,9],[3,12,4,7],[4,0,4,5],[4,4,4,9],[4,8,8,14],[5,0,6,11],[5,6,2,8],[5,8,8,4],[6,0,8,11],[6,8,4,9],[6,12,4,7],[7,0,8,5],[7,8,8,4]],
         [[0,0,4,16],[0,4,4,14],[0,8,8,9],[1,0,8,7],[1,8,8,14],[2,0,6,11],[2,6,2,7],[2,8,8,4],[3,0,6,10],[3,6,2,9],[3,8,8,13],[4,0,8,14],[4,8,8,9],[5,0,6,11],[5,6,2,9],[5,8,8,5],[6,0,12,4],[6,12,4,7],[7,0,8,7],[7,8,8,10]],
         {'keys': t('epiano', 0.48, -0.2, 0.3, bright=0.5, bell=0.25, trem=0.12), 'lead': t('vibes', 0.5, 0.15, 0.35), 'bass': t('upright', 0.7, 0.05, 0.05, bright=0.4),
          'counter': t('piano', 0.28, 0.3, 0.35, bright=0.35), 'drums': {'gain': 0.55, 'send': 0.12, 'tone': 0.5}, 'pad': {'gain': 0.06, 'cutoff': 800}},
         {'drums': 'jazzbrush', 'bass': 'walk', 'keys': 'jazz', 'counter': 'chime'},
         {'wow': 0.2, 'flutter': 0.15, 'crackle': 0.55, 'lpf': 4200, 'sat': 0.2, 'reverb': 0.35},
         {'transpose': 3, 'styles': {'keys': 'lofi', 'drums': 'boombap'}, 'melodyOctave': 0},
         70, 'vibes', bass_low=33, note='ブラシのドラムとウッドベースで、ゆるくスウィング。'),
    song('cassette', 'カセット ドライブ', 78, 0.16, 'A',
         ['Am9', 'D9', 'Fmaj9', 'E7b9', 'Am9', 'D9', 'Fmaj9', 'E7sus4 E7b9'],
         ['Dm9', 'G13', 'Cmaj9', 'Fmaj9', 'Bm7b5', 'E7b9', 'Am9', 'Am9'],
         ['Fmaj9', 'E7sus4 E7b9'], ['Am9', 'D9', 'Am9', 'D9'],
         [[0,0,6,7],[0,6,2,10],[0,8,8,14],[1,0,8,12],[1,8,4,9],[1,12,4,7],[2,0,12,8],[2,12,4,10],[3,0,6,11],[3,6,2,8],[3,8,8,7],[4,0,4,15],[4,4,4,14],[4,8,8,12],[5,0,6,9],[5,6,2,12],[5,8,8,15],[6,0,8,19],[6,8,8,15],[7,0,8,12],[7,8,8,11]],
         [[0,0,8,17],[0,8,8,15],[1,0,6,14],[1,6,2,10],[1,8,8,7],[2,0,12,10],[2,12,4,14],[3,0,8,12],[3,8,8,8],[4,0,6,8],[4,6,2,5],[4,8,8,12],[5,0,8,11],[5,8,8,14],[6,0,16,12],[7,8,4,7],[7,12,4,10]],
         {'keys': t('epiano', 0.52, -0.1, 0.22, bright=0.6, bell=0.3, trem=0.15), 'lead': t('flute', 0.42, 0.15, 0.4, breath=0.3), 'bass': t('subbass', 0.65, 0, 0, bright=0.35),
          'counter': t('guitar', 0.3, 0.35, 0.3, bright=0.55), 'drums': {'gain': 0.55, 'send': 0.06, 'tone': 0.35}, 'pad': {'gain': 0.1, 'cutoff': 1100}},
         {'drums': 'tape', 'bass': 'lofi', 'keys': 'lofi', 'counter': 'fill'},
         {'wow': 0.7, 'flutter': 0.4, 'crackle': 0.35, 'lpf': 3000, 'sat': 0.4, 'reverb': 0.22},
         {'transpose': -3, 'styles': {'drums': 'boombap', 'counter': 'arp16'}, 'melodyOctave': -12},
         69, 'epiano', note='テープのゆらぎを強めにした、夜のドライブ。'),
    song('bossa-window', 'まどべの ボサ', 80, 0.0, 'C',
         ['Cmaj9', 'Cmaj9', 'D9', 'D9', 'Dm9', 'G13', 'Em7 A7', 'Dm9 G13'],
         ['Fmaj9', 'Bb13', 'Em9', 'A7b9', 'Dm9', 'G13', 'Cmaj9', 'Dm9 G7'],
         ['Dm9', 'G13'], ['Cmaj9', 'Fmaj9', 'Cmaj9', 'Fmaj9'],
         [[0,0,3,7],[0,3,7,4],[0,10,6,2],[1,0,3,4],[1,3,3,7],[1,6,10,11],[2,0,6,9],[2,6,4,6],[2,10,6,4],[3,0,12,6],[3,12,4,9],[4,0,6,9],[4,6,4,5],[4,10,6,4],[5,0,12,4],[5,12,4,5],[6,0,6,7],[6,6,2,4],[6,8,8,9],[7,0,8,5],[7,8,8,4]],
         [[0,0,8,16],[0,8,8,12],[1,0,12,14],[1,12,4,7],[2,0,6,11],[2,6,4,7],[2,10,6,6],[3,0,8,10],[3,8,8,9],[4,0,8,14],[4,8,8,9],[5,0,8,16],[5,8,8,11],[6,0,12,7],[6,12,4,4],[7,0,8,5],[7,8,8,2]],
         {'keys': t('nylon', 0.55, -0.2, 0.22, bright=0.4, damp=0.55), 'lead': t('flute', 0.4, 0.2, 0.4, breath=0.22), 'bass': t('upright', 0.62, 0, 0.05, bright=0.35),
          'counter': t('vibes', 0.24, 0.35, 0.4), 'drums': {'gain': 0.5, 'send': 0.1, 'tone': 0.5}, 'pad': {'gain': 0.05, 'cutoff': 900}},
         {'drums': 'bossa', 'bass': 'bossa', 'keys': 'bossa', 'counter': 'chime'},
         {'wow': 0.2, 'flutter': 0.1, 'crackle': 0.3, 'lpf': 5200, 'sat': 0.15, 'reverb': 0.3},
         {'transpose': 2, 'styles': {'keys': 'arp'}, 'melodyOctave': 0},
         72, 'kalimba', center=60, bass_low=33, note='ナイロンギターとリムのクラーベ。窓ぎわの午後。'),
    song('winter-bell', 'ふゆの ベル', 70, 0.08, 'G',
         ['Gmaj9', 'Em9', 'Cmaj9', 'D9sus4 D9', 'Gmaj9', 'Bm7', 'Cmaj9', 'Am9 D9'],
         ['Cmaj9', 'Bm7', 'Am9', 'Gmaj9', 'Cmaj9', 'Cm6', 'Bm7', 'Am9 D9sus4'],
         ['Cmaj9', 'D9sus4'], ['Gmaj9', 'Cmaj9', 'Gmaj9', 'Cmaj9'],
         [[0,0,4,16],[0,4,4,14],[0,8,8,19],[1,0,8,23],[1,8,8,19],[2,0,4,16],[2,4,4,19],[2,8,8,21],[3,0,8,12],[3,8,8,11],[4,0,4,14],[4,4,4,16],[4,8,8,23],[5,0,8,19],[5,8,8,14],[6,0,12,16],[6,12,4,12],[7,0,8,14],[7,8,8,11]],
         [[0,0,8,21],[0,8,8,19],[1,0,8,23],[1,8,8,19],[2,0,8,17],[2,8,8,16],[3,0,16,14],[4,0,4,16],[4,4,4,19],[4,8,8,24],[5,0,8,20],[5,8,8,17],[6,0,12,16],[6,12,4,14],[7,0,16,12]],
         {'keys': t('piano', 0.5, -0.15, 0.35, bright=0.35), 'lead': t('celesta', 0.42, 0.15, 0.45), 'bass': t('subbass', 0.58, 0, 0, bright=0.2),
          'counter': t('kalimba', 0.26, 0.35, 0.45), 'drums': {'gain': 0.42, 'send': 0.12, 'tone': 0.3}, 'pad': {'gain': 0.14, 'cutoff': 1200}},
         {'drums': 'soft', 'bass': 'hold', 'keys': 'lofi', 'counter': 'chime'},
         {'wow': 0.25, 'flutter': 0.15, 'crackle': 0.4, 'lpf': 4400, 'sat': 0.15, 'reverb': 0.45},
         {'transpose': -2, 'styles': {'keys': 'arp', 'counter': 'arp16'}, 'melodyOctave': -12},
         67, 'celesta', note='チェレスタとピアノ。冬の朝の、白い光。'),
    song('sunset-guitar', 'ゆうやけ ギター', 76, 0.14, 'Eb',
         ['Abmaj9', 'Gm7', 'Fm9', 'Ebmaj9', 'Dbmaj9', 'Cm7', 'Fm9', 'Bb13sus4'],
         ['Fm9', 'Gm7', 'Abmaj9', 'Bb7sus4 Bb13', 'Cm9', 'Bbm9 Eb9', 'Abmaj9', 'Bb13'],
         ['Fm9', 'Bb13sus4'], ['Abmaj9', 'Gm7', 'Fm9', 'Ebmaj9'],
         [[0,0,6,9],[0,6,2,7],[0,8,8,4],[1,0,6,2],[1,6,2,4],[1,8,8,11],[2,0,8,9],[2,8,4,5],[2,12,4,4],[3,0,12,2],[3,12,4,4],[4,0,6,12],[4,6,2,9],[4,8,8,5],[5,0,8,7],[5,8,8,4],[6,0,4,5],[6,4,4,9],[6,8,8,14],[7,0,12,12],[7,12,4,9]],
         [[0,0,8,9],[0,8,8,12],[1,0,8,11],[1,8,8,7],[2,0,12,4],[2,12,4,7],[3,0,8,5],[3,8,8,2],[4,0,6,11],[4,6,2,9],[4,8,8,4],[5,0,8,10],[5,8,8,4],[6,0,16,9],[7,0,8,7],[7,8,8,4]],
         {'keys': t('epiano', 0.5, -0.15, 0.25, bright=0.5, bell=0.25, trem=0.1), 'lead': t('guitar', 0.5, 0.15, 0.35, bright=0.6), 'bass': t('subbass', 0.62, 0, 0, bright=0.3),
          'counter': t('guitar', 0.22, 0.4, 0.3, bright=0.5), 'drums': {'gain': 0.52, 'send': 0.08, 'tone': 0.45}, 'pad': {'gain': 0.1, 'cutoff': 1000}},
         {'drums': 'boombap', 'bass': 'lofi', 'keys': 'lofi', 'counter': 'arp16'},
         {'wow': 0.3, 'flutter': 0.2, 'crackle': 0.4, 'lpf': 3800, 'sat': 0.25, 'reverb': 0.3},
         {'transpose': 2, 'styles': {'drums': 'soft', 'counter': 'fill'}, 'melodyOctave': -12},
         63, 'kalimba', note='クリーンなギターのアルペジオ。夕焼けの帰り道。'),
]

if __name__ == '__main__':
    force = '--force' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    for s in songs:
        if s['id'] in REMOVED:
            continue
        p = OUT / f"{s['id']}.json"
        if p.exists() and not force:
            print('skip (exists)', p.name); continue
        p.write_text(json.dumps(s, ensure_ascii=False, indent=1) + '\n')
        print('wrote', p.name)
    if not (OUT / 'index.json').exists():
        (OUT / 'index.json').write_text(json.dumps([s['id'] for s in songs if s['id'] not in REMOVED], indent=1) + '\n')
