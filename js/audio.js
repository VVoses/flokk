/* Flokk - audio.js
   WebAudio: flock sounds, ambience, animal voices, seasonal one-shots, generative music.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- audio: flock sounds + layered ambience ---------- */
let ac = null,
  master = null,
  verb = null,
  muted = false,
  lastChirp = 0,
  amb = null;
function noiseBuf(sec) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function panned(node, v) {
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = clamp(v, -1, 1);
    node.connect(p);
    return p;
  }
  return node;
}
function loopNoise() {
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  s.loop = true;
  s.loopStart = Math.random();
  s.start(0, Math.random() * 3);
  return s;
}
function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ac.createDynamicsCompressor();
    // gentler than before: squashing everything toward the same loudness is part of what made the
    // whole bed read as flat hiss rather than distinct layers
    comp.threshold.value = -15;
    comp.ratio.value = 2.3;
    master.connect(comp).connect(ac.destination);
    // small feedback-delay room for distant sounds and tones
    verb = ac.createGain();
    const vout = ac.createGain();
    vout.gain.value = 0.45;
    vout.connect(master);
    for (const [t, fb, lp] of [
      [0.137, 0.55, 2600],
      [0.211, 0.52, 2200],
      [0.293, 0.48, 1800],
      [0.389, 0.44, 1500]
    ]) {
      const d = ac.createDelay(1);
      d.delayTime.value = t;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      const gg = ac.createGain();
      gg.gain.value = fb;
      verb.connect(d);
      d.connect(f);
      f.connect(gg);
      gg.connect(d);
      f.connect(vout);
    }
    amb = { noise: noiseBuf(4), gust: 0.5, gustT: 0, cricketT: 1, hopperT: 6, songT: 3, toneT: 7, tick: 0 };
    // wind: broad bed + a faint whistle layer, both swept by gusts - a narrower band here reads as
    // moving air rather than flat hiss, since a wide-open bandpass is close to unfiltered noise
    const w1 = loopNoise(),
      wf = ac.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 340;
    wf.Q.value = 1.1;
    const wg = ac.createGain();
    wg.gain.value = 0;
    w1.connect(wf).connect(wg).connect(master);
    const w2 = loopNoise(),
      wf2 = ac.createBiquadFilter();
    wf2.type = 'bandpass';
    wf2.frequency.value = 950;
    wf2.Q.value = 9;
    const wg2 = ac.createGain();
    wg2.gain.value = 0;
    w2.connect(wf2).connect(wg2);
    wg2.connect(master);
    wg2.connect(verb);
    const w3 = loopNoise(),
      wf3 = ac.createBiquadFilter();
    wf3.type = 'highpass';
    wf3.frequency.value = 3200;
    const wg3 = ac.createGain();
    wg3.gain.value = 0;
    w3.connect(wf3).connect(wg3).connect(master); // leaf rustle
    // water lapping near the shore
    const wa = loopNoise(),
      waf = ac.createBiquadFilter();
    waf.type = 'lowpass';
    waf.frequency.value = 480;
    const wag = ac.createGain();
    wag.gain.value = 0;
    wa.connect(waf).connect(wag).connect(master);
    // midge hum near swarms
    const h1 = ac.createOscillator(),
      h2 = ac.createOscillator();
    h1.type = 'sawtooth';
    h2.type = 'sawtooth';
    h1.frequency.value = 196;
    h2.frequency.value = 233;
    const hl = ac.createOscillator(),
      hlg = ac.createGain();
    hl.frequency.value = 6.5;
    hlg.gain.value = 9;
    hl.connect(hlg);
    hlg.connect(h1.frequency);
    hlg.connect(h2.frequency);
    const hf = ac.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = 900;
    hf.Q.value = 1.2;
    const hg = ac.createGain();
    hg.gain.value = 0;
    h1.connect(hf);
    h2.connect(hf);
    hf.connect(hg).connect(master);
    h1.start();
    h2.start();
    hl.start();
    const tr = ac.createOscillator();
    tr.type = 'sawtooth';
    tr.frequency.value = 46;
    const trf = ac.createBiquadFilter();
    trf.type = 'lowpass';
    trf.frequency.value = 240;
    const trg = ac.createGain();
    trg.gain.value = 0;
    const tam = ac.createOscillator(),
      tamg = ac.createGain();
    tam.frequency.value = 5.5;
    tamg.gain.value = 0;
    tam.connect(tamg);
    tr.connect(trf).connect(trg).connect(master);
    tr.start();
    tam.start();
    amb.callT = 4;
    {
      const rs = loopNoise(),
        rf = ac.createBiquadFilter();
      rf.type = 'lowpass';
      rf.frequency.value = 240;
      const rgn = ac.createGain();
      rgn.gain.value = 0;
      rs.connect(rf).connect(rgn).connect(master);
      amb.rg = rgn;
      amb.clackT = 0;
    }
    // passing car: a low engine note and road noise
    {
      const o = ac.createOscillator(),
        f = ac.createBiquadFilter(),
        g = ac.createGain(),
        n = loopNoise(),
        nf = ac.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = 58;
      f.type = 'lowpass';
      f.frequency.value = 300;
      g.gain.value = 0;
      nf.type = 'bandpass';
      nf.frequency.value = 450;
      nf.Q.value = 0.7;
      o.connect(f).connect(g);
      n.connect(nf).connect(g);
      g.connect(master);
      o.start();
      amb.carG = g;
      amb.carO = o;
    }
    // rain: a broad hiss bed plus a brighter high patter, both swept in from LIGHT.rain - a bit more
    // resonance here gives it a patter rather than a flat static wash
    {
      const rn = loopNoise(),
        rnf = ac.createBiquadFilter();
      rnf.type = 'bandpass';
      rnf.frequency.value = 2600;
      rnf.Q.value = 0.9;
      const rng = ac.createGain();
      rng.gain.value = 0;
      rn.connect(rnf).connect(rng).connect(master);
      const rn2 = loopNoise(),
        rnf2 = ac.createBiquadFilter();
      rnf2.type = 'highpass';
      rnf2.frequency.value = 5200;
      const rng2 = ac.createGain();
      rng2.gain.value = 0;
      rn2.connect(rnf2).connect(rng2).connect(master);
      amb.rng = rng;
      amb.rng2 = rng2;
    }
    Object.assign(amb, { wg, wf, wg2, wf2, wg3, wag, hg, trg });
  } catch (e) {
    ac = null;
  }
}
function chirp(vol = 0.045, base) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  if (t - lastChirp < 0.07) return;
  lastChirp = t;
  const o = ac.createOscillator(),
    gn = ac.createGain(),
    f = base || rr(2900, 3900);
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.045);
  o.frequency.exponentialRampToValueAtTime(f * 0.88, t + 0.1);
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(vol, t + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(gn).connect(master);
  o.start(t);
  o.stop(t + 0.13);
}
function hawkCry() {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(),
    gn = ac.createGain(),
    bp = ac.createBiquadFilter(),
    lfo = ac.createOscillator(),
    lg = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(1650, t);
  o.frequency.exponentialRampToValueAtTime(1100, t + 0.75);
  lfo.frequency.value = 32;
  lg.gain.value = 70;
  lfo.connect(lg).connect(o.frequency);
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 2.5;
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(0.09, t + 0.05);
  gn.gain.setValueAtTime(0.09, t + 0.45);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  o.connect(bp).connect(gn);
  gn.connect(master);
  gn.connect(verb);
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.82);
  lfo.stop(t + 0.82);
}
function flutter(n) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 700;
  f.Q.value = 0.7;
  const gn = ac.createGain();
  const v = 0.03 + 0.07 * Math.min(1, n / 25);
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(v, t + 0.04);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  const am = ac.createOscillator(),
    ag = ac.createGain();
  am.frequency.value = 18;
  ag.gain.value = v * 0.6;
  am.connect(ag).connect(gn.gain);
  am.start(t);
  am.stop(t + 0.46);
  s.connect(f).connect(gn).connect(master);
  s.start(t, Math.random() * 3);
  s.stop(t + 0.46);
}
function thud() {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(),
    gn = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
  gn.gain.setValueAtTime(0.14, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(gn).connect(master);
  o.start(t);
  o.stop(t + 0.26);
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1800;
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.06, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  s.connect(f).connect(g2).connect(master);
  s.start(t, Math.random() * 3);
  s.stop(t + 0.3);
}
function joinSnd() {
  if (!ac || muted) return;
  lastChirp = 0;
  chirp(0.05, 2600);
  setTimeout(() => {
    lastChirp = 0;
    chirp(0.05, 3400);
  }, 90);
}
/* ambient one-shots */
function cricket() {
  const t = ac.currentTime + 0.02,
    f = rr(4200, 4900),
    n = rr(3, 7) | 0,
    v = rr(0.004, 0.009),
    out = ac.createGain();
  out.gain.value = 1;
  panned(out, rr(-0.9, 0.9)).connect(master);
  for (let i = 0; i < n; i++) {
    const o = ac.createOscillator(),
      gn = ac.createGain();
    o.frequency.value = f;
    const t0 = t + i * 0.045;
    gn.gain.setValueAtTime(0, t0);
    gn.gain.linearRampToValueAtTime(v, t0 + 0.006);
    gn.gain.linearRampToValueAtTime(0, t0 + 0.028);
    o.connect(gn).connect(out);
    o.start(t0);
    o.stop(t0 + 0.03);
  }
}
function hopper() {
  const t = ac.currentTime + 0.02,
    n = rr(8, 16) | 0,
    out = ac.createGain();
  panned(out, rr(-0.8, 0.8)).connect(master);
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = rr(5000, 7000);
  f.connect(out);
  for (let i = 0; i < n; i++) {
    const s = ac.createBufferSource();
    s.buffer = amb.noise;
    const gn = ac.createGain();
    const t0 = t + i * rr(0.05, 0.07);
    gn.gain.setValueAtTime(0, t0);
    gn.gain.linearRampToValueAtTime(0.012, t0 + 0.004);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
    s.connect(gn).connect(f);
    s.start(t0, Math.random() * 3);
    s.stop(t0 + 0.04);
  }
}
function songbird() {
  const t = ac.currentTime + 0.02,
    out = ac.createGain();
  out.gain.value = rr(0.007, 0.014);
  const p = panned(out, rr(-1, 1));
  p.connect(master);
  p.connect(verb);
  const kind = Math.random();
  if (kind < 0.4) {
    const f1 = rr(4800, 5600),
      f2 = f1 * rr(0.78, 0.84),
      n = rr(3, 6) | 0;
    for (let i = 0; i < n; i++)
      for (const [j, f] of [
        [0, f1],
        [1, f2]
      ]) {
        const o = ac.createOscillator(),
          gn = ac.createGain(),
          t0 = t + i * 0.32 + j * 0.14;
        o.frequency.setValueAtTime(f, t0);
        gn.gain.setValueAtTime(0, t0);
        gn.gain.linearRampToValueAtTime(1, t0 + 0.01);
        gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
        o.connect(gn).connect(out);
        o.start(t0);
        o.stop(t0 + 0.11);
      }
  } else if (kind < 0.75) {
    const n = rr(6, 12) | 0,
      base = rr(2600, 3800);
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(),
        gn = ac.createGain(),
        t0 = t + i * rr(0.06, 0.09),
        f = base * (1 + 0.25 * Math.sin(i * 1.7)) * rr(0.95, 1.05);
      o.frequency.setValueAtTime(f * 1.2, t0);
      o.frequency.exponentialRampToValueAtTime(f * 0.85, t0 + 0.05);
      gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(1, t0 + 0.008);
      gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
      o.connect(gn).connect(out);
      o.start(t0);
      o.stop(t0 + 0.07);
    }
  } else {
    const n = rr(2, 4) | 0;
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(),
        gn = ac.createGain(),
        t0 = t + i * 0.5;
      const f = rr(2200, 3000);
      o.frequency.setValueAtTime(f, t0);
      o.frequency.linearRampToValueAtTime(f * 1.5, t0 + 0.18);
      o.frequency.linearRampToValueAtTime(f * 1.1, t0 + 0.3);
      gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(1, t0 + 0.05);
      gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
      o.connect(gn).connect(out);
      o.start(t0);
      o.stop(t0 + 0.36);
    }
  }
}
function owlHoot(v) {
  if (!ac || muted) return;
  const t = ac.currentTime + 0.05,
    out = ac.createGain();
  out.gain.value = v;
  const p = panned(out, rr(-0.8, 0.8));
  p.connect(master);
  p.connect(verb);
  const hoot = (t0, d, f) => {
    const o = ac.createOscillator(),
      g2 = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t0);
    o.frequency.linearRampToValueAtTime(f * 0.93, t0 + d);
    const l = ac.createOscillator(),
      lg = ac.createGain();
    l.frequency.value = 16;
    lg.gain.value = 6;
    l.connect(lg).connect(o.frequency);
    g2.gain.setValueAtTime(0, t0);
    g2.gain.linearRampToValueAtTime(1, t0 + 0.08);
    g2.gain.setValueAtTime(1, t0 + d * 0.7);
    g2.gain.linearRampToValueAtTime(0, t0 + d);
    o.connect(g2).connect(out);
    o.start(t0);
    l.start(t0);
    o.stop(t0 + d + 0.05);
    l.stop(t0 + d + 0.05);
  };
  hoot(t, 0.55, 420);
  hoot(t + 1.1, 0.18, 440);
  hoot(t + 1.35, 0.18, 440);
  hoot(t + 1.6, 0.7, 430);
}
function frog() {
  if (!ac || muted) return;
  const t = ac.currentTime + 0.02,
    out = ac.createGain();
  out.gain.value = rr(0.012, 0.025);
  const p = panned(out, rr(-0.9, 0.9));
  p.connect(master);
  p.connect(verb);
  const n = rr(2, 5) | 0,
    f = rr(90, 160);
  for (let i = 0; i < n; i++) {
    const o = ac.createOscillator(),
      g2 = ac.createGain(),
      bp = ac.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = f;
    bp.type = 'bandpass';
    bp.frequency.value = f * 6;
    bp.Q.value = 3;
    const t0 = t + i * 0.16;
    g2.gain.setValueAtTime(0, t0);
    g2.gain.linearRampToValueAtTime(1, t0 + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    o.connect(bp).connect(g2).connect(out);
    o.start(t0);
    o.stop(t0 + 0.13);
  }
}
function animalCall(k, vol, pn) {
  if (!ac || muted) return;
  const t = ac.currentTime + 0.02,
    out = ac.createGain();
  out.gain.value = vol;
  const p = panned(out, pn);
  p.connect(master);
  p.connect(verb);
  const sw = (f0, f1, dur, t0, q, bpf, type = 'sawtooth', vib = 0) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.linearRampToValueAtTime(f1, t0 + dur);
    if (vib) {
      const l = ac.createOscillator(),
        lg = ac.createGain();
      l.frequency.value = vib;
      lg.gain.value = f0 * 0.05;
      l.connect(lg).connect(o.frequency);
      l.start(t0);
      l.stop(t0 + dur + 0.05);
    }
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bpf;
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + Math.min(0.08, dur * 0.2));
    g.gain.setValueAtTime(1, t0 + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(bp).connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };
  if (k === 'cow') {
    moo(out, t);
  } else if (k === 'sheep') {
    baa(out, t);
  } else if (k === 'lamb') {
    baa(out, t, true);
  } else if (k === 'whistle') {
    // two quick notes to call the dog
    for (const [dt, f0, f1] of [
      [0, 1900, 2500],
      [0.28, 2500, 2000]
    ]) {
      const o = ac.createOscillator(),
        g = ac.createGain(),
        t0 = t + dt;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + 0.2);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.03);
      g.gain.linearRampToValueAtTime(0, t0 + 0.22);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + 0.25);
    }
  } else if (k === 'dog') {
    bark(out, t);
  } else if (k === 'duck') {
    duckCall(out, t);
  } else if (k === 'crow') {
    const n = rr(2, 4) | 0;
    for (let i = 0; i < n; i++) sw(760, 520, 0.26, t + i * 0.4, 3, 1150);
  } else if (k === 'magpie') {
    for (let i = 0; i < 6; i++) sw(2000, 1650, 0.05, t + i * 0.075, 2, 3200, 'square');
  } else if (k === 'fox') {
    // a short, sharp bark-yip - a night sound, not a threat by itself, but worth pricking ears at
    sw(1500, 640, 0.16, t, 5, 1900, 'sawtooth');
    sw(1250, 560, 0.13, t + 0.19, 5, 1700, 'sawtooth');
  } else if (k === 'moose') {
    sw(170, 110, 1.2, t, 1.4, 360);
  } else if (k === 'goose') {
    sw(540, 450, 0.17, t, 3, 1100);
    sw(540, 450, 0.14, t + 0.24, 3, 1100);
  }
}
/* ---------- voices: duck and cow ---------- */
function quack(t0, out, f0, v) {
  // nasal, rasping, falling: a buzzy source through two narrow formants, roughened by fast AM
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 1.12, t0);
  o.frequency.exponentialRampToValueAtTime(f0, t0 + 0.035);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t0 + 0.2);
  const am = ac.createOscillator(),
    amg = ac.createGain(),
    rough = ac.createGain();
  am.type = 'square';
  am.frequency.value = rr(34, 44);
  amg.gain.value = 0.45;
  rough.gain.value = 0.55;
  am.connect(amg).connect(rough.gain);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(v, t0 + 0.012);
  env.gain.setValueAtTime(v * 0.9, t0 + 0.1);
  env.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.22);
  o.connect(rough);
  for (const [f, q, a] of [
    [rr(950, 1100), 5, 1],
    [rr(2100, 2400), 6, 0.6],
    [520, 2, 0.25]
  ]) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f * 1.08, t0);
    bp.frequency.linearRampToValueAtTime(f * 0.94, t0 + 0.2);
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.value = a * 3.4;
    rough.connect(bp).connect(g).connect(env);
  }
  env.connect(out);
  o.start(t0);
  am.start(t0);
  o.stop(t0 + 0.25);
  am.stop(t0 + 0.25);
}
function duckCall(out, t) {
  // a mallard hen's decrescendo: loud first, each quack a little lower and quieter
  const n = rr(2, 6) | 0,
    f = rr(235, 290);
  let tt = t,
    v = 1;
  for (let i = 0; i < n; i++) {
    quack(tt, out, f * Math.pow(0.97, i), v);
    tt += rr(0.2, 0.26) + i * 0.012;
    v *= 0.8;
  }
}
function baa(out, t, forceLamb) {
  // a bleat: tremulous voice, lips opening on the 'b', a nasal 'aaa' held with a shaky wobble, sliding down at the end
  const lamb = forceLamb || Math.random() < 0.3,
    f = lamb ? rr(360, 440) : rr(190, 250),
    d = lamb ? rr(0.45, 0.7) : rr(0.6, 1.05),
    n = Math.random() < 0.35 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const t0 = t + k * (d + rr(0.25, 0.5)),
      ff = f * (k ? rr(0.94, 1.02) : 1);
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    const p = o.frequency;
    p.setValueAtTime(ff * 0.86, t0);
    p.linearRampToValueAtTime(ff * 1.04, t0 + 0.09);
    p.linearRampToValueAtTime(ff, t0 + d * 0.6);
    p.linearRampToValueAtTime(ff * 0.84, t0 + d);
    const rate = rr(7, 10),
      vib = ac.createOscillator(),
      vg = ac.createGain();
    vib.frequency.value = rate;
    vg.gain.value = ff * 0.035;
    vib.connect(vg).connect(p);
    const trem = ac.createGain();
    trem.gain.value = 0.55;
    const tg = ac.createGain();
    tg.gain.value = 0.32;
    vib.connect(tg).connect(trem.gain);
    const lip = ac.createBiquadFilter();
    lip.type = 'lowpass';
    lip.frequency.setValueAtTime(350, t0);
    lip.frequency.exponentialRampToValueAtTime(3600, t0 + 0.07);
    lip.frequency.setValueAtTime(3600, t0 + d * 0.75);
    lip.frequency.exponentialRampToValueAtTime(900, t0 + d);
    const env = ac.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(1, t0 + 0.035);
    env.gain.setValueAtTime(1, t0 + d * 0.7);
    env.gain.linearRampToValueAtTime(0, t0 + d);
    o.connect(trem).connect(lip);
    for (const [fq, q, a] of [
      [lamb ? 1100 : 850, 4, 1],
      [lamb ? 1900 : 1450, 5, 0.7],
      [2700, 6, 0.3],
      [300, 1.5, 0.35]
    ]) {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      bp.Q.value = q;
      const g = ac.createGain();
      g.gain.value = a * 2.4;
      lip.connect(bp).connect(g).connect(env);
    }
    const s = ac.createBufferSource();
    s.buffer = amb.noise;
    const nb = ac.createBiquadFilter();
    nb.type = 'bandpass';
    nb.frequency.value = 1300;
    nb.Q.value = 1;
    const ng = ac.createGain();
    ng.gain.value = 0.05;
    s.connect(nb).connect(ng).connect(env);
    env.connect(out);
    o.start(t0);
    vib.start(t0);
    s.start(t0, Math.random() * 3);
    o.stop(t0 + d + 0.05);
    vib.stop(t0 + d + 0.05);
    s.stop(t0 + d + 0.05);
  }
}
function bark(out, t) {
  // a farm dog: two or three short, rough barks falling in pitch
  const n = Math.random() < 0.5 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const t0 = t + i * rr(0.16, 0.24),
      f = rr(300, 390);
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.3, t0);
    o.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + 0.13);
    const env = ac.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(1, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    for (const [fq, q, g0] of [
      [850, 2, 1.6],
      [1700, 3, 0.9],
      [380, 1.5, 0.6]
    ]) {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      bp.Q.value = q;
      const g = ac.createGain();
      g.gain.value = g0;
      o.connect(bp).connect(g).connect(env);
    }
    const s = ac.createBufferSource();
    s.buffer = amb.noise;
    const nb = ac.createBiquadFilter();
    nb.type = 'bandpass';
    nb.frequency.value = 1300;
    nb.Q.value = 0.9;
    const ng = ac.createGain();
    ng.gain.value = 0.35;
    s.connect(nb).connect(ng).connect(env);
    env.connect(out);
    o.start(t0);
    s.start(t0, Math.random() * 3);
    o.stop(t0 + 0.17);
    s.stop(t0 + 0.17);
  }
}
function moo(out, t) {
  // closed 'mm' opening into 'ooo' and closing again: a resonant lowpass sweeps over a low buzzy voice
  const d = rr(1.3, 1.9),
    f = rr(98, 122);
  const src = ac.createGain();
  for (const det of [-5, 4]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = det;
    const p = o.frequency;
    p.setValueAtTime(f * 0.88, t);
    p.linearRampToValueAtTime(f * 1.2, t + d * 0.22);
    p.linearRampToValueAtTime(f * 1.1, t + d * 0.65);
    p.linearRampToValueAtTime(f * 0.78, t + d);
    const l = ac.createOscillator(),
      lg = ac.createGain();
    l.frequency.value = 5;
    lg.gain.value = f * 0.018;
    l.connect(lg).connect(p);
    o.connect(src);
    o.start(t);
    l.start(t);
    o.stop(t + d + 0.1);
    l.stop(t + d + 0.1);
  }
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 5;
  const c = lp.frequency;
  c.setValueAtTime(240, t);
  c.linearRampToValueAtTime(900, t + d * 0.3);
  c.linearRampToValueAtTime(620, t + d * 0.7);
  c.linearRampToValueAtTime(280, t + d);
  const lp2 = ac.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.Q.value = 1.2;
  const c2 = lp2.frequency;
  c2.setValueAtTime(380, t);
  c2.linearRampToValueAtTime(1300, t + d * 0.3);
  c2.linearRampToValueAtTime(900, t + d * 0.7);
  c2.linearRampToValueAtTime(420, t + d);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.9, t + 0.18);
  env.gain.setValueAtTime(0.9, t + d * 0.72);
  env.gain.linearRampToValueAtTime(0, t + d);
  src.connect(lp).connect(lp2).connect(env).connect(out);
  // breath
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const nb = ac.createBiquadFilter();
  nb.type = 'bandpass';
  nb.frequency.value = 700;
  nb.Q.value = 0.8;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(0.05, t + 0.2);
  ng.gain.linearRampToValueAtTime(0, t + d);
  s.connect(nb).connect(ng).connect(out);
  s.start(t, Math.random() * 3);
  s.stop(t + d + 0.1);
}

/* ---------- seasonal ambience one-shots ---------- */
function cuckoo() {
  const t = ac.currentTime + 0.05,
    out = ac.createGain();
  out.gain.value = rr(0.012, 0.02);
  const p = panned(out, rr(-1, 1));
  p.connect(master);
  p.connect(verb);
  const n = rr(2, 5) | 0,
    f = rr(640, 700);
  for (let i = 0; i < n; i++) {
    for (const [dt, ff, d] of [
      [0, f, 0.2],
      [0.27, f * 0.8, 0.32]
    ]) {
      const t0 = t + i * 0.95 + dt,
        o = ac.createOscillator(),
        g = ac.createGain();
      o.frequency.setValueAtTime(ff * 1.02, t0);
      o.frequency.linearRampToValueAtTime(ff, t0 + d);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.04);
      g.gain.setValueAtTime(1, t0 + d * 0.6);
      g.gain.linearRampToValueAtTime(0, t0 + d);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + d + 0.02);
    }
  }
}
function skein() {
  // migrating geese far overhead in autumn
  const t = ac.currentTime + 0.05,
    out = ac.createGain(),
    pan0 = rr(-1, 1);
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(0.022, t + 3);
  out.gain.linearRampToValueAtTime(0, t + 9);
  const pn = ac.createStereoPanner ? ac.createStereoPanner() : null;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1600;
  out.connect(lp);
  if (pn) {
    pn.pan.setValueAtTime(pan0, t);
    pn.pan.linearRampToValueAtTime(-pan0, t + 9);
    lp.connect(pn);
    pn.connect(master);
    pn.connect(verb);
  } else {
    lp.connect(master);
    lp.connect(verb);
  }
  for (let i = 0; i < 16; i++) {
    const t0 = t + rr(0, 8),
      f = rr(420, 560),
      o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t0);
    o.frequency.linearRampToValueAtTime(f * 0.84, t0 + 0.16);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 3;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    o.connect(bp).connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.2);
  }
}
function titCall() {
  // winter 'tee-tyy' of a small tit
  const t = ac.currentTime + 0.05,
    out = ac.createGain();
  out.gain.value = rr(0.006, 0.011);
  const p = panned(out, rr(-1, 1));
  p.connect(master);
  p.connect(verb);
  const n = rr(2, 5) | 0,
    f = rr(5600, 6400);
  for (let i = 0; i < n; i++)
    for (const [dt, ff, d] of [
      [0, f, 0.09],
      [0.13, f * 0.72, 0.11]
    ]) {
      const t0 = t + i * 0.36 + dt,
        o = ac.createOscillator(),
        g = ac.createGain();
      o.frequency.setValueAtTime(ff, t0);
      o.frequency.linearRampToValueAtTime(ff * 0.97, t0 + d);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + d + 0.01);
    }
}
function iceBoom(v) {
  // the frozen lake settling
  const t = ac.currentTime + 0.05,
    out = ac.createGain();
  out.gain.value = v;
  const p = panned(out, rr(-0.7, 0.7));
  p.connect(master);
  p.connect(verb);
  const o = ac.createOscillator();
  o.type = 'sine';
  const f = rr(900, 1400);
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.9);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.25);
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 260;
  bp.Q.value = 1.5;
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.5, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  s.connect(bp).connect(g2).connect(out);
  s.start(t, Math.random() * 3);
  s.stop(t + 0.75);
}

function thunder() {
  // a distant rumble: a long swept-lowpass noise bed under a falling sub tone, pushed into the reverb for distance
  const t = ac.currentTime + rr(0.15, 0.6),
    out = ac.createGain();
  out.gain.value = 0.09;
  const p = panned(out, rr(-0.6, 0.6));
  p.connect(verb);
  p.connect(master);
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  s.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.exponentialRampToValueAtTime(70, t + 1.8);
  lp.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, t + rr(2.2, 3.4));
  s.connect(lp).connect(g).connect(out);
  s.start(t);
  s.stop(t + 3.5);
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(55, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 1.5);
  const og = ac.createGain();
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(0.6, t + 0.1);
  og.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 2.3);
}

/* ---------- generative music: one voice per season ---------- */
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
  dry.gain.value = 0.28;
  bus.connect(soft);
  soft.connect(dry).connect(master);
  const wet = ac.createGain();
  wet.gain.value = 0.9;
  soft.connect(wet).connect(verb);
  MUS = { bus, next: 0, beat: 0, bar: 0, on: false, wait: rr(35, 60), motif: null, chord: 0, level: 1 };
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
  let d = S.mel[(Math.random() * S.mel.length) | 0];
  for (let i = 0; i < 8; i++) {
    const on = i === 0 || Math.random() < (i % 2 ? S.p * 0.4 : S.p * 0.85);
    if (on) {
      d += [-2, -1, -1, 0, 1, 1, 2][(Math.random() * 7) | 0];
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
          0.0013 * (1 - 0.3 * nf),
          S.inst === 'bell' ? 900 : 700 + 500 * (1 - nf)
        );
    }
    const d = MUS.motif[b];
    if (d !== null && Math.random() < 1 - 0.45 * nf) {
      let dd = snapMel(S, d + (b === 0 || b === 4 ? MUS.chord % 3 : 0));
      const m = degMidi(S, dd) + S.oct - (nf > 0.6 ? 12 : 0);
      const pan = rr(-0.35, 0.35);
      const inst = nf > 0.7 && SEASON < 3 && Math.random() < 0.5 ? 'bell' : S.inst;
      if (inst === 'bell') bell(m + (SEASON === 3 ? 12 : 0), t, 0.0075, pan * 1.5);
      else pluck(m - (S.oct ? 12 : 0), t + rr(0, 0.02), 0.011, S.bright * 0.6 * (1 - 0.4 * nf), pan * 1.5);
      if (SEASON === 1 && Math.random() < 0.1) pluck(degMidi(S, dd + 2), t + beat * 0.5, 0.006, S.bright * 0.6, -pan); // summer grace notes
    }
    MUS.beat++;
    if (MUS.beat % 8 === 0) {
      MUS.bar++;
      if (MUS.bar >= MUS.bars) {
        MUS.on = false;
        MUS.wait = rr(70, 160) * (st.settled ? 0.75 : 1) * (SEASON === 3 ? 1.3 : 1);
      }
    }
  }
}
function audioTick(dt) {
  if (!ac || !amb) return;
  const now = ac.currentTime;
  amb.gustT -= dt;
  if (amb.gustT <= 0) {
    amb.gust = Math.random() < 0.2 ? rr(0.8, 1) : rr(0.15, 0.6);
    amb.gustT = rr(2, 6);
  }
  if (!muted) {
    const nf = LIGHT.night,
      hr = CAL.hour,
      dawn = hr > 3.5 && hr < 9 && nf < 0.8;
    amb.cricketT -= dt;
    if (amb.cricketT <= 0) {
      if ((SEASON === 1 || SEASON === 2) && Math.random() < 0.35 + 0.65 * nf) cricket();
      amb.cricketT = rr(0.5, 2.2) * (st.settled ? 0.7 : 1);
    }
    amb.hopperT -= dt;
    if (amb.hopperT <= 0) {
      if ((SEASON === 1 || SEASON === 2) && nf < 0.3) hopper();
      amb.hopperT = rr(5, 13);
    }
    amb.songT -= dt;
    if (amb.songT <= 0) {
      if (nf < 0.6 && (SEASON < 3 || Math.random() < 0.3)) songbird();
      amb.songT = (rr(3, 9) / (dawn && SEASON < 2 ? 3 : 1)) * (SEASON === 2 ? 1.8 : 1);
    }
    amb.owlT = (amb.owlT || 8) - dt;
    if (amb.owlT <= 0) {
      if (nf > 0.6) owlHoot(hawks.some(h => h.kind === 'owl') ? 0.05 : 0.025);
      amb.owlT = rr(9, 22);
    }
    amb.frogT = (amb.frogT || 5) - dt;
    if (amb.frogT <= 0) {
      if (SEASON === 0 && nf > 0.4 && L && Math.hypot(wdx(L.x, LAKE.x), L.y - LAKE.y) < LAKE.r + 700) frog();
      amb.frogT = rr(1.5, 5);
    }
    const calm = !hawks.some(h => h.state === 'dive' || h.state === 'stalk' || h.state === 'hover');
    musicTick();
    amb.seaT = (amb.seaT || rr(8, 16)) - dt;
    if (amb.seaT <= 0) {
      amb.seaT = rr(10, 26);
      if (SEASON === 0 && nf < 0.4 && calm && Math.random() < 0.55) cuckoo();
      else if (SEASON === 2 && nf < 0.5 && Math.random() < 0.45) skein();
      else if (SEASON === 3) {
        if (nf < 0.5 && Math.random() < 0.6) titCall();
        if (L && Math.hypot(wdx(L.x, LAKE.x), L.y - LAKE.y) < LAKE.r + 900 && Math.random() < 0.5)
          iceBoom(rr(0.02, 0.04));
      }
    }
  }
  if (TRAIN && amb.trainPr > 0.03) {
    amb.clackT -= dt;
    if (amb.clackT <= 0) {
      clack(0.1 * amb.trainPr);
      amb.clackT = 50 / Math.max(60, TRAIN.v);
    }
  }
  if (!muted && L) {
    amb.callT -= dt;
    if (amb.callT <= 0) {
      amb.callT = rr(2.5, 6.5);
      const cowOk = now > (amb.cowNext || 0);
      const near = ANIMALS.filter(
        a =>
          ['cow', 'sheep', 'duck', 'crow', 'magpie', 'moose', 'goose'].includes(a.k) &&
          (a.k !== 'cow' || cowOk) &&
          Math.hypot(wdx(a.x, L.x), a.y - L.y) < 950
      );
      if (near.length) {
        const a = near[(Math.random() * near.length) | 0];
        if (a.k === 'cow') amb.cowNext = now + rr(35, 75);
        const d = Math.hypot(wdx(a.x, L.x), a.y - L.y);
        animalCall(a.k, 0.07 * (1 - d / 950) + 0.008, wdx(a.x, L.x) / 700);
      }
    }
    if (LIFE.calls && LIFE.calls.length)
      for (const c of LIFE.calls.splice(0, LIFE.calls.length).slice(0, 4)) {
        const d = Math.hypot(wdx(c.x, L.x), c.y - L.y);
        if (d < 1600) {
          const v = 0.05 * (1 - d / 1600) + 0.012;
          for (let i = 0; i < (c.n || 1); i++)
            setTimeout(() => animalCall(c.k, v, wdx(c.x, L.x) / 800), i * rr(250, 500));
        }
      }
  }
  amb.tick -= dt;
  if (amb.tick > 0) return;
  amb.tick = 0.15;
  const g = amb.gust,
    speed = L ? Math.hypot(L.vx, L.vy) : 0;
  const ww = winterW(),
    au = SEASON === 2 ? tEase() : TRANS.prevSeason === 2 ? 1 - tEase() : 0;
  // quieter at rest than before - the wind bed used to run under everything else even on a still
  // day, which was a steady chunk of what made the mix read as one flat hiss instead of layers
  amb.wg.gain.setTargetAtTime(0.007 + 0.008 * ww + (0.024 + 0.011 * ww) * g + (speed / 250) * 0.009, now, 1.2);
  amb.wf.frequency.setTargetAtTime(220 + 520 * g, now, 1.8);
  amb.wg2.gain.setTargetAtTime((g > 0.7 ? 0.004 : 0.0008) * (1 + 1.6 * ww), now, 1.5);
  amb.wf2.frequency.setTargetAtTime(700 + 700 * g, now, 2);
  // this is a bare highpass hiss (no band to give it shape), so it's the layer most likely to read
  // as "static" on its own - trimmed back to a hint of rustle rather than a competing noise bed
  amb.wg3.gain.setTargetAtTime((0.0013 + 0.004 * g) * (1 + 0.9 * au) * (1 - 0.7 * ww), now, 1);
  let wd = 1e9;
  if (L) {
    for (const [c, rf] of [
      [LAKE, lakeR],
      [POND, pondR]
    ]) {
      if (c.x < 0) continue;
      const d = Math.abs(Math.hypot(wdx(L.x, c.x), L.y - c.y) - rf(Math.atan2(L.y - c.y, wdx(L.x, c.x))));
      if (d < wd) wd = d;
    }
  }
  const lap = (SEASON === 3 ? 0 : 1) * clamp(1 - wd / 380, 0, 1) * (0.6 + 0.4 * Math.sin(T * 1.7) * Math.sin(T * 0.63));
  const sea = L ? clamp(1 - Math.abs(shoreY(L.x) - L.y) / 520, 0, 1) * (0.55 + 0.45 * Math.sin(T * 0.45)) : 0;
  amb.wag.gain.setTargetAtTime(Math.max(0.03 * lap, 0.06 * sea), now, 0.4);
  let td = 1e9;
  for (const a of ANIMALS) if (a.k === 'tractor' && L) td = Math.hypot(wdx(a.x, L.x), a.y - L.y);
  let cd = 1e9,
    car = null;
  if (L)
    for (const v of TRAFFIC) {
      const d = Math.hypot(wdx(v.x, L.x), v.y - L.y);
      if (v.kind === 'tractor') td = Math.min(td, d);
      else if (d < cd) {
        cd = d;
        car = v;
      }
    }
  amb.carG.gain.setTargetAtTime(0.05 * clamp(1 - cd / 950, 0, 1) ** 1.6, now, 0.3);
  if (car) {
    // a touch of Doppler: higher while it comes towards you, lower as it goes
    const toward = -(wdx(car.x, L.x) * Math.cos(car.ang) + (car.y - L.y) * Math.sin(car.ang)) / Math.max(cd, 1);
    amb.carO.frequency.setTargetAtTime((car.kind === 'van' ? 50 : 58) * (1 + 0.06 * toward) + car.v / 12, now, 0.2);
  }
  amb.trg.gain.setTargetAtTime(0.035 * clamp(1 - td / 800, 0, 1) ** 1.5, now, 0.4);
  let sd = 1e9;
  if (L)
    for (const s of swarms) {
      const d = Math.hypot(wdx(s.x, L.x), s.y - L.y);
      if (d < sd) sd = d;
    }
  {
    let d = 1e9;
    if (TRAIN && L)
      for (const c of TRAIN.cars) {
        const q = Math.hypot(wdx(c.x, L.x), c.y - L.y);
        if (q < d) d = q;
      }
    const pr = clamp(1 - d / 1400, 0, 1);
    amb.rg.gain.setTargetAtTime(0.088 * pr ** 1.6, now, 0.3);
    amb.trainPr = pr;
    if (TRAIN && !TRAIN.honked && d < 1100) {
      TRAIN.honked = true;
      // quieter than before - it was the loudest single sound in the mix and jumped out over
      // everything else; now it's closer in level to the rumble and road/rain beds it plays over
      horn(0.028 + 0.045 * pr);
    }
  }
  amb.hg.gain.setTargetAtTime(0.006 * clamp(1 - sd / 240, 0, 1) ** 1.5, now, 0.3);
  const ri = LIGHT.rain;
  amb.rng.gain.setTargetAtTime(0.05 * ri, now, 1.2);
  amb.rng2.gain.setTargetAtTime(0.022 * ri * ri, now, 1.2);
}
