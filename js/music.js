/* Flokk - music.js
   Composed seasonal arrival phrases with three quiet calendar-based echoes.
   Short plucked/bell melodies leave room for the world and duck whenever a hawk is hunting.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const MUS_SEASON = [
  // Spring: D major, a rising pentatonic greeting ending on an open tonic sixth.
  {
    root: 62,
    mode: [0, 2, 4, 5, 7, 9, 11],
    beat: 0.48,
    inst: 'pluck',
    bright: 3200,
    melody: [
      [0, 0],
      [0.5, 2],
      [1, 4],
      [2, 5],
      [3, 4],
      [4, 2],
      [5.5, 0]
    ],
    chords: [
      [0, [0, 2, 4]],
      [2, [3, 5, 7]],
      [4, [4, 6, 8]],
      [5.5, [0, 2, 5]]
    ]
  },
  // Summer: F lydian, a suspended, unhurried turn through the raised fourth.
  {
    root: 65,
    mode: [0, 2, 4, 6, 7, 9, 11],
    beat: 0.62,
    inst: 'pluck',
    bright: 2700,
    melody: [
      [0, 2],
      [1, 4],
      [2.5, 5],
      [3.5, 3],
      [4.5, 2],
      [6, 1],
      [7, 0]
    ],
    chords: [
      [0, [0, 2, 6]],
      [2.5, [1, 3, 5]],
      [4.5, [4, 6, 8]],
      [7, [0, 2, 4]]
    ]
  },
  // Autumn: A dorian, falling thirds with a gentle minor-sixth landing.
  {
    root: 57,
    mode: [0, 2, 3, 5, 7, 9, 10],
    beat: 0.66,
    inst: 'pluck',
    bright: 1900,
    melody: [
      [0, 4],
      [1, 3],
      [2, 2],
      [3.5, 0],
      [5, -1],
      [6.5, 0]
    ],
    chords: [
      [0, [0, 2, 4]],
      [2, [3, 5, 7]],
      [5, [4, 6, 8]],
      [6.5, [0, 2, 5]]
    ]
  },
  // Winter: E minor, widely spaced bells over a quiet open fifth and added ninth.
  {
    root: 64,
    mode: [0, 2, 3, 5, 7, 8, 10],
    beat: 0.82,
    inst: 'bell',
    bright: 1800,
    melody: [
      [0, 0],
      [1.5, 4],
      [3, 2],
      [4.5, 1],
      [6.5, 0]
    ],
    chords: [
      [0, [0, 4, 8]],
      [3, [5, 7, 9]],
      [6.5, [0, 2, 4]]
    ]
  }
];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let MUS = null;
function musInit() {
  const bus = ac.createGain();
  bus.gain.value = 0;
  const soft = ac.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 1900;
  const dry = ac.createGain();
  dry.gain.value = 0.75;
  bus.connect(soft);
  soft.connect(dry).connect(master);
  const wet = ac.createGain();
  wet.gain.value = 0.9;
  soft.connect(wet).connect(verb);
  MUS = { bus, key: musicSeasonKey(), arrival: ac.currentTime + 3, echo: musicEchoIndex(), level: 1, busyUntil: 0 };
}
function degMidi(S, d) {
  const n = S.mode.length,
    o = Math.floor(d / n);
  return S.root + S.mode[((d % n) + n) % n] + 12 * o;
}
function pluck(m, t, v, bright, pan) {
  const f = mtof(m),
    g = ac.createGain(),
    lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(bright, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(300, bright * 0.25), t + 1.2);
  const a = ac.createOscillator(),
    b = ac.createOscillator(),
    bg = ac.createGain();
  a.type = 'triangle';
  b.type = 'sine';
  a.frequency.value = f;
  b.frequency.value = f * 2;
  bg.gain.value = 0.25;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.006);
  g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  a.connect(lp);
  b.connect(bg).connect(lp);
  lp.connect(g);
  panned(g, pan).connect(MUS.bus);
  a.start(t);
  b.start(t);
  a.stop(t + 2.5);
  b.stop(t + 2.5);
}
function bell(m, t, v, pan) {
  const f = mtof(m),
    out = ac.createGain();
  out.gain.value = v;
  panned(out, pan).connect(MUS.bus);
  for (const [r, a, d] of [
    [1, 1, 3.6],
    [2.76, 0.32, 2],
    [5.4, 0.14, 1],
    [8.93, 0.06, 0.5]
  ]) {
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.frequency.value = f * r;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}
// Echoes follow the game calendar, not an audio wall-clock loop. Resuming a save skips past cues.
const MUSIC_ECHOES = [0.32, 0.66, 0.86];
function musicSeasonKey() {
  return `${Math.floor(CAL.t / (DAY_LEN * YEAR_DAYS))}:${SEASON}`;
}
function musicSeasonProgress() {
  const duration = DAY_LEN * DAYS_PER_SEASON;
  return (((CAL.t % duration) + duration) % duration) / duration;
}
function musicEchoIndex() {
  let i = 0;
  while (i < MUSIC_ECHOES.length && MUSIC_ECHOES[i] <= musicSeasonProgress()) i++;
  return i;
}
function seasonJingle(season, t, echo = -1) {
  const S = MUS_SEASON[season],
    scale = echo < 0 ? 1 : 0.48,
    voice = (degree, at, volume, pan = 0) => {
      const midi = degMidi(S, degree) + 12;
      if (S.inst === 'bell') bell(midi, at, volume * 0.7, pan);
      else pluck(midi, at, volume, S.bright, pan);
    };
  if (echo === 1) {
    // The middle echo recalls only the arrival's final chord.
    const chord = S.chords[S.chords.length - 1][1];
    for (let i = 0; i < chord.length; i++) voice(chord[i] - 7, t + i * 0.045, 0.013 * scale, (i - 1) * 0.12);
    return 2.8;
  }
  const melody = echo < 0 ? S.melody : echo === 0 ? S.melody.slice(0, 3) : S.melody.slice(-2),
    origin = melody[0][0];
  for (let i = 0; i < melody.length; i++) {
    const [beat, degree] = melody[i];
    voice(
      degree,
      t + (beat - origin) * S.beat,
      0.031 * scale * (i === melody.length - 1 ? 0.9 : 1),
      0.08 * Math.sin(i)
    );
  }
  if (echo < 0)
    for (const [beat, chord] of S.chords)
      for (let i = 0; i < chord.length; i++)
        pluck(degMidi(S, chord[i]) - 12, t + beat * S.beat + i * 0.025, 0.008, S.bright * 0.5, (i - 1) * 0.14);
  return (melody[melody.length - 1][0] - origin) * S.beat + 3.8;
}
function musicTick() {
  if (!MUS) musInit();
  const now = ac.currentTime,
    key = musicSeasonKey(),
    danger = hawks.some(h => h.state === 'dive' || h.state === 'stalk' || h.state === 'hover'),
    active = st.mode === 'play' || st.mode === 'pause',
    target = (danger ? 0.12 : 1) * (active ? 1 : 0.6);
  MUS.level += (target - MUS.level) * 0.05;
  MUS.bus.gain.setTargetAtTime(MUS.level, now, 0.8);
  if (key !== MUS.key) {
    MUS.key = key;
    MUS.arrival = now + 0.35;
    MUS.echo = musicEchoIndex();
  }
  if (!active || danger || now < MUS.busyUntil) return;
  if (MUS.arrival !== null && now >= MUS.arrival) {
    MUS.busyUntil = now + seasonJingle(SEASON, now + 0.05);
    MUS.arrival = null;
    return;
  }
  if (st.mode !== 'play') return;
  const progress = musicSeasonProgress();
  if (MUS.echo < MUSIC_ECHOES.length && progress >= MUSIC_ECHOES[MUS.echo]) {
    const echo = MUS.echo;
    MUS.echo = musicEchoIndex(); // a long mute or suspension never queues a backlog
    MUS.busyUntil = now + seasonJingle(SEASON, now + 0.05, echo);
  }
}
