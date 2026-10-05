/* Flokk - music.js
   Generative background music: one gentle voice per season, built from a short random motif
   that comes and goes over a slow chord loop, quieted whenever a hawk is hunting.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const MUS_SEASON = [
  // spring: D major, pentatonic melody, bright plucks
  {
    root: 62,
    mode: [0, 2, 4, 5, 7, 9, 11],
    mel: [0, 1, 2, 4, 5],
    prog: [0, 4, 5, 3],
    beat: 0.6,
    p: 0.46,
    oct: 12,
    inst: 'pluck',
    pad: 0.4,
    bright: 3400
  },
  // summer: F lydian, warm plucks over pads
  {
    root: 65,
    mode: [0, 2, 4, 6, 7, 9, 11],
    mel: [0, 1, 2, 3, 4, 5, 6],
    prog: [0, 1, 5, 4],
    beat: 0.72,
    p: 0.38,
    oct: 0,
    inst: 'pluck',
    pad: 1,
    bright: 2600
  },
  // autumn: A dorian, low and slow
  {
    root: 57,
    mode: [0, 2, 3, 5, 7, 9, 10],
    mel: [0, 1, 2, 3, 4, 5, 6],
    prog: [0, 3, 0, 6],
    beat: 0.9,
    p: 0.32,
    oct: 0,
    inst: 'pluck',
    pad: 1,
    bright: 1500
  },
  // winter: E aeolian, sparse bells over a cold drone
  {
    root: 64,
    mode: [0, 2, 3, 5, 7, 8, 10],
    mel: [0, 2, 3, 4, 6],
    prog: [0, 5, 3, 0],
    beat: 1.15,
    p: 0.2,
    oct: 0,
    inst: 'bell',
    pad: 0.8,
    bright: 2000
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
  MUS = { bus, next: 0, beat: 0, bar: 0, on: false, wait: rr(3, 6), motif: null, chord: 0, level: 1 };
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
function pad(ms, t, dur, v, cut) {
  const out = ac.createGain(),
    lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  lp.Q.value = 0.6;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(v, t + dur * 0.4);
  out.gain.setValueAtTime(v, t + dur * 0.6);
  out.gain.linearRampToValueAtTime(0, t + dur + 1.5);
  lp.connect(out).connect(MUS.bus);
  for (const m of ms)
    for (const det of [-7, 7]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 1.6);
    }
}
function makeMotif(S) {
  const m = [];
  let d = pickP(S.mel);
  for (let i = 0; i < 8; i++) {
    const on = i === 0 || Math.random() < (i % 2 ? S.p * 0.4 : S.p * 0.85);
    if (on) {
      d += pickP([-2, -1, -1, 0, 1, 1, 2]);
      d = clamp(d, -2, 9);
    }
    m.push(on ? d : null);
  }
  return m;
}
function snapMel(S, d) {
  if (S.mel.length === S.mode.length) return d;
  const n = S.mode.length,
    o = Math.floor(d / n),
    r = ((d % n) + n) % n;
  let best = S.mel[0],
    bd = 99;
  for (const x of S.mel)
    if (Math.abs(x - r) < bd) {
      bd = Math.abs(x - r);
      best = x;
    }
  return best + o * n;
}
function musicTick() {
  if (!MUS) musInit();
  const now = ac.currentTime;
  const danger = hawks.some(h => h.state === 'dive' || h.state === 'stalk' || h.state === 'hover');
  const nf = LIGHT.night;
  const target = (danger ? 0.12 : 1) * (st.mode === 'play' || st.mode === 'pause' ? 1 : 0.6);
  MUS.level += (target - MUS.level) * 0.05;
  MUS.bus.gain.setTargetAtTime(MUS.level, now, 0.8);
  if (MUS.next < now - 0.5) MUS.next = now + 0.1;
  const S = MUS_SEASON[SEASON],
    beat = S.beat * 1.3 * (1 + 0.35 * nf);
  while (MUS.next < now + 0.25) {
    const t = MUS.next;
    MUS.next += beat;
    if (!MUS.on) {
      MUS.wait -= beat;
      if (MUS.wait <= 0 && !danger) {
        MUS.on = true;
        MUS.bar = 0;
        MUS.beat = 0;
        MUS.bars = Math.random() < 0.35 ? 2 : 1;
        MUS.motif = makeMotif(S);
      }
      continue;
    }
    const b = MUS.beat % 8;
    if (b === 0) {
      // new bar: chord change, pad, maybe vary the motif
      MUS.chord = S.prog[MUS.bar % S.prog.length];
      if (MUS.bar % 2 === 1 || Math.random() < 0.3) {
        const i = (Math.random() * 8) | 0;
        if (MUS.motif[i] !== null) MUS.motif[i] += Math.random() < 0.5 ? 1 : -1;
        else if (Math.random() < 0.5) MUS.motif[i] = MUS.chord + 2;
      }
      const c = MUS.chord,
        tri = [c, c + 2, c + 4].map(d => degMidi(S, d) - 12);
      if (S.pad && Math.random() < S.pad * 0.45)
        pad(
          tri.concat([degMidi(S, c) - 24]),
          t,
          beat * 8,
          0.0025 * (1 - 0.3 * nf),
          S.inst === 'bell' ? 900 : 700 + 500 * (1 - nf)
        );
    }
    const d = MUS.motif[b];
    if (d !== null && Math.random() < 1 - 0.45 * nf) {
      let dd = snapMel(S, d + (b === 0 || b === 4 ? MUS.chord % 3 : 0));
      const m = degMidi(S, dd) + S.oct - (nf > 0.6 ? 12 : 0);
      const pan = rr(-0.35, 0.35);
      const inst = nf > 0.7 && SEASON < 3 && Math.random() < 0.5 ? 'bell' : S.inst;
      if (inst === 'bell') bell(m + (SEASON === 3 ? 12 : 0), t, 0.02, pan * 1.5);
      else pluck(m - (S.oct ? 12 : 0), t + rr(0, 0.02), 0.025, S.bright * 0.6 * (1 - 0.4 * nf), pan * 1.5);
      if (SEASON === 1 && Math.random() < 0.1) pluck(degMidi(S, dd + 2), t + beat * 0.5, 0.006, S.bright * 0.6, -pan); // summer grace notes
    }
    MUS.beat++;
    if (MUS.beat % 8 === 0) {
      MUS.bar++;
      if (MUS.bar >= MUS.bars) {
        MUS.on = false;
        MUS.wait = rr(18, 35) * (st.settled ? 0.75 : 1) * (SEASON === 3 ? 1.3 : 1);
      }
    }
  }
}
