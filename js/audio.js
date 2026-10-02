/* Flokk - audio.js
   WebAudio: flock sounds, ambience, animal voices, seasonal one-shots. The generative background
   music lives in music.js; audioTick() below drives both.
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
// where a sound at world (x, y) sits relative to the flock/camera it's heard from: pan across
// roughly a screen's width, and 0 (right at the flock) .. 1 (at the edge of hearing) for how far
// it has to carry. With no position given (a sound with no single source, like a join chime) it
// comes from dead centre, same as before this existed.
function spatial(x, y, range = 700) {
  if (x == null || !L) return { pan: 0, d: 0 };
  const dx = wdx(x, L.x);
  return { pan: clamp(dx / (range * 0.8), -1, 1), d: clamp(Math.hypot(dx, y - L.y) / range, 0, 1) };
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
    vout.gain.value = 0.16;
    // the reverb's own tail brightness: open field stays close to dry and open, forest canopy and
    // farm walls dull and lengthen how present it feels - set every tick in audioTick from the
    // flock's own position, so the room around it actually changes as it moves through the world
    const verbLP = ac.createBiquadFilter();
    verbLP.type = 'lowpass';
    verbLP.frequency.value = 2600;
    vout.connect(verbLP).connect(master);
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
    Object.assign(amb, { wg, wf, wg2, wf2, wg3, wag, hg, trg, vout, verbLP });
  } catch (e) {
    ac = null;
  }
}
// how freely the flock chatters: sparrows go quiet as the light goes and roost in silence through the
// night, and they hush at once while a hawk or owl is hunting overhead, so as not to give themselves away
function chatter() {
  if (hawks.some(h => h.state === 'dive' || h.state === 'stalk' || h.state === 'hover')) return 0;
  return clamp(1 - 1.4 * LIGHT.night, 0, 1);
}
function chirp(vol = 0.045, base, x, y) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  if (t - lastChirp < 0.07) return;
  lastChirp = t;
  const { pan, d } = spatial(x, y, 380);
  const o = ac.createOscillator(),
    gn = ac.createGain(),
    f = base || rr(2900, 3900);
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.045);
  o.frequency.exponentialRampToValueAtTime(f * 0.88, t + 0.1);
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(vol * (1 - 0.35 * d), t + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(gn);
  const p = panned(gn, pan);
  p.connect(master);
  if (d > 0.15) p.connect(verb);
  o.start(t);
  o.stop(t + 0.13);
}
function hawkCry(x, y) {
  if (!ac || muted) return;
  const t = ac.currentTime,
    { pan, d } = spatial(x, y, 900),
    voice = reedOsc(0.65),
    breath = ac.createBufferSource(),
    throat = ac.createBiquadFilter(),
    air = ac.createBiquadFilter(),
    gain = ac.createGain(),
    pitch = rr(0.93, 1.06),
    duration = rr(0.65, 0.9);
  voice.frequency.setValueAtTime(1420 * pitch, t);
  voice.frequency.exponentialRampToValueAtTime(1770 * pitch, t + 0.09);
  voice.frequency.exponentialRampToValueAtTime(970 * pitch, t + duration);
  throat.type = 'bandpass';
  throat.Q.value = 1.3;
  throat.frequency.setValueAtTime(2000, t);
  throat.frequency.linearRampToValueAtTime(1350, t + duration);
  air.type = 'lowpass';
  air.frequency.value = lerp(5200, 1900, d);
  air.Q.value = 0.5;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.065 * (1 - d * 0.6), t + 0.07);
  gain.gain.exponentialRampToValueAtTime(0.025 * (1 - d * 0.6), t + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  voice.connect(throat).connect(gain).connect(air);
  breath.buffer = amb.noise;
  const breathGain = ac.createGain();
  breathGain.gain.value = 0.1;
  breath.connect(breathGain).connect(throat);
  const p = panned(air, pan),
    send = ac.createGain();
  send.gain.value = 0.12 + d * 0.45;
  p.connect(master);
  p.connect(send).connect(verb);
  voice.start(t);
  breath.start(t, rr(0, 2));
  voice.stop(t + duration + 0.03);
  breath.stop(t + duration + 0.03);
}
// the air cut by a stoop that missed: quick, sharp, and gone - never the same twice
function whooshMiss(x, y) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const { pan } = spatial(x, y, 500);
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(2200, t);
  f.frequency.exponentialRampToValueAtTime(500, t + 0.22);
  f.Q.value = 1.1;
  const gn = ac.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(0.11, t + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  s.connect(f).connect(gn);
  panned(gn, pan).connect(master);
  s.start(t, Math.random() * 3);
  s.stop(t + 0.3);
}
function flutter(n, x, y) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const { pan } = spatial(x, y, 550);
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
  s.connect(f).connect(gn);
  panned(gn, pan).connect(master);
  s.start(t, Math.random() * 3);
  s.stop(t + 0.46);
}
// kind colors what took the bird: a hawk's kill has a sharp cry over it, an owl's is muffled and
// lower (a night kill, heard more than seen), a fox's has no aerial cry at all - just the ground
// contact. power (roughly 0.7-1.5) is how committed the strike was - a hawk's own boldness for the
// season works well - and scales the weight and reach of the low body underneath, so a hungry
// winter hawk's kill actually lands harder than a wary spring one's. last marks the flock's final
// bird: heavier and slower to let go, rather than simply louder - the difference between a loss and
// the end. Small jitter on top so no two kills sound quite the same.
function thud(kind = 'hawk', power = 1, last = false, x, y) {
  if (!ac || muted) return;
  const t = ac.currentTime,
    tail = last ? 1.6 : 1,
    gk = 0.85 + 0.3 * power,
    dur = (0.4 + 0.08 * power) * tail;
  const { pan, d } = spatial(x, y, 500),
    bus = ac.createGain(),
    busOut = panned(bus, pan);
  busOut.connect(master);
  if (d > 0.1) busOut.connect(verb);
  if (kind !== 'fox') {
    // the bird's own voice, crying out as it's taken - this is the part meant to be felt, so it's
    // the loudest thing here. A slow, uneven vibrato (the same warble hawkCry uses, but shakier)
    // makes the pitch quaver as it falls rather than gliding cleanly down, the way a frightened
    // whimper breaks rather than sliding smoothly
    const base = kind === 'owl' ? rr(980, 1080) : rr(1780, 1950);
    const co = ac.createOscillator(),
      co2 = ac.createOscillator(),
      cg = ac.createGain(),
      cf = ac.createBiquadFilter(),
      lfo = ac.createOscillator(),
      lg = ac.createGain();
    co.type = 'sine';
    co.frequency.setValueAtTime(base, t);
    co.frequency.exponentialRampToValueAtTime(base * 0.52, t + dur * 0.88);
    co2.type = 'sine';
    co2.frequency.setValueAtTime(base * 0.94, t + 0.01);
    co2.frequency.exponentialRampToValueAtTime(base * 0.46, t + dur * 0.88);
    lfo.frequency.value = rr(11, 15);
    lg.gain.value = base * 0.05;
    lfo.connect(lg);
    lg.connect(co.frequency);
    lg.connect(co2.frequency);
    cf.type = 'bandpass';
    cf.frequency.value = base * 0.85;
    cf.Q.value = 1;
    cg.gain.setValueAtTime(0, t);
    cg.gain.linearRampToValueAtTime(0.05 * gk, t + 0.05);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    co.connect(cf);
    co2.connect(cf).connect(cg).connect(bus);
    co.start(t);
    co.stop(t + dur + 0.02);
    co2.start(t + 0.01);
    co2.stop(t + dur + 0.02);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }
  // the moment of contact: soft and dull, well under the cry above it - a felt weight rather than a
  // crack, and never the loudest layer; support for the whimper, not competition with it
  const hs = ac.createBufferSource();
  hs.buffer = amb.noise;
  const hf = ac.createBiquadFilter();
  hf.type = 'lowpass';
  hf.frequency.value = kind === 'fox' ? 220 : 260;
  const hg = ac.createGain();
  hg.gain.setValueAtTime(0, t);
  hg.gain.linearRampToValueAtTime(0.038 * gk, t + rr(0.025, 0.035));
  hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  hs.connect(hf).connect(hg).connect(bus);
  hs.start(t, Math.random() * 3);
  hs.stop(t + 0.19);
  // feathers settling, not a strike - a soft hush with the edge filtered off, no percussive bite
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = kind === 'fox' ? 500 : 700;
  f.Q.value = 0.5;
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0, t + 0.04);
  g2.gain.linearRampToValueAtTime(0.026 * gk, t + 0.11);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.75);
  s.connect(f).connect(g2).connect(bus);
  s.start(t, Math.random() * 3);
  s.stop(t + dur * 0.8);
  // a low, muffled body underneath, faded in rather than struck - weight without a transient; this
  // is what actually reads as defeating: it goes lower and lingers longer the harder the strike, and
  // deepest of all when it's the last bird
  const o = ac.createOscillator(),
    gn = ac.createGain(),
    lp = ac.createBiquadFilter();
  o.type = 'sine';
  o.frequency.setValueAtTime(rr(108, 122), t + 0.02);
  o.frequency.exponentialRampToValueAtTime((last ? 24 : 38) / power, t + dur * 0.9);
  lp.type = 'lowpass';
  lp.frequency.value = 200;
  gn.gain.setValueAtTime(0, t + 0.02);
  gn.gain.linearRampToValueAtTime(0.065 * gk, t + 0.08);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(gn).connect(bus);
  o.start(t + 0.02);
  o.stop(t + dur + 0.05);
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
/* how much birdsong the season holds: it builds through spring as the migrants arrive and pair up, peaks
   at the turn of summer and softens as the young fledge; autumn is sparse, and rain quiets everything */
function birdLife() {
  const p = GROW.p,
    b = [0.4 + 0.9 * p, 1.25 - 0.75 * p, 0.5 - 0.15 * p, 1][SEASON];
  return b * (1 - 0.7 * LIGHT.rain);
}
function songbird(v = 1) {
  const t = ac.currentTime + 0.02,
    out = ac.createGain();
  out.gain.value = rr(0.007, 0.014) * v;
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
function owlHoot(v, x, y) {
  if (!ac || muted) return;
  const t = ac.currentTime + 0.05,
    out = ac.createGain(),
    sp = x == null ? null : spatial(x, y, 900);
  out.gain.value = sp ? v * (1 - sp.d * 0.5) : v;
  const p = panned(out, sp ? sp.pan : rr(-0.8, 0.8));
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
    l.frequency.value = rr(3.8, 5.5);
    lg.gain.value = 2.2;
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
  // the same pair of tawny owls lives here all year: he hoots, she answers 'ke-wick'
  const ov = amb.owlV || (amb.owlV = { p: rr(0.92, 1.08), r: rr(0.9, 1.1) }),
    f = 420 * ov.p * wob(0.015),
    r = ov.r * wob(0.05);
  if (Math.random() < 0.3) {
    for (let i = 0, n = Math.random() < 0.6 ? 1 : 2; i < n; i++) {
      const t0 = t + i * rr(0.9, 1.4),
        o = ac.createOscillator(),
        g2 = ac.createGain(),
        bp = ac.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 3, t0);
      o.frequency.linearRampToValueAtTime(f * 3.9, t0 + 0.06);
      o.frequency.linearRampToValueAtTime(f * 2.6, t0 + 0.3);
      bp.type = 'bandpass';
      bp.frequency.value = f * 3.4;
      bp.Q.value = 4;
      g2.gain.setValueAtTime(0, t0);
      g2.gain.linearRampToValueAtTime(0.7, t0 + 0.02);
      g2.gain.setValueAtTime(0.7, t0 + 0.08);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
      o.connect(bp).connect(g2).connect(out);
      o.start(t0);
      o.stop(t0 + 0.34);
    }
    return;
  }
  hoot(t, 0.55 * r, f);
  // the long quavering tail doesn't always follow the first note
  if (Math.random() < 0.75) {
    const t1 = t + 1.1 * r * wob(0.08);
    hoot(t1, 0.18 * r, f * 1.05);
    hoot(t1 + 0.25 * r, 0.18 * r, f * 1.05);
    hoot(t1 + 0.5 * r * wob(0.08), 0.7 * r * wob(0.1), f * 1.02);
  }
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
// ambient calls: how long each kind rests (s) after it has spoken up on its own
const AMB_REST = {
  cow: [35, 75],
  sheep: [14, 30],
  duck: [14, 28],
  crow: [14, 30],
  magpie: [18, 36],
  goose: [30, 60],
  moose: [70, 150]
};
// how much of its daytime voice each kind keeps after dark: crows and magpies go to roost and fall silent,
// cattle and sheep low or bleat now and then, ducks and geese talk a little on the water, a moose still calls
const AMB_NIGHT = { cow: 0.3, sheep: 0.25, duck: 0.35, crow: 0, magpie: 0, goose: 0.5, moose: 0.6 };
// how likely another of the same kind nearby answers an ambient call, a moment later, in its own voice
const AMB_ANSWER = { cow: 0.3, goose: 0.4, crow: 0.35, duck: 0.25, magpie: 0.15 };
// reactive calls (alarms, scolding, a skein passing): shortest gap before that kind is heard again
const CALL_GAP = { crow: 2.5, magpie: 2.5, duck: 3, dog: 0.6 };
// reactive calls that are not alarms: an ewe answering her lamb, the farmer whistling, wings
const CALM_CALL = { sheep: 1, lamb: 1, whistle: 1, whirr: 1 };

/* ---------- animal voices ---------- */
// every animal (and every wild flock) keeps its own voice: how high it pitches, how big its throat is
// (formants) and how quickly it runs through a call. Two cows in one field can be told apart, and the
// same cow sounds like itself all year. A call from nobody in particular gets a passing stranger's voice.
const VOICES = new WeakMap();
function voiceOf(a) {
  const mk = () => ({ p: rr(0.9, 1.12), f: rr(0.92, 1.08), r: rr(0.88, 1.12) });
  if (!a || typeof a !== 'object') return mk();
  let v = VOICES.get(a);
  if (!v) VOICES.set(a, (v = mk()));
  return v;
}
// the voice of the call being built right now: the caller's own voice, nudged a little every time
// (no call comes out twice alike), pitched up and hurried when the animal is alarmed (x)
let VOX = { p: 1, f: 1, r: 1, x: 0 };
const wob = (s = 0.03) => 1 + (Math.random() * 2 - 1) * s;
// a gap in a run of notes, in the caller's tempo, breathing a little rather than ticking like a clock
const vgap = (s, sp = 0.12) => s * VOX.r * wob(sp);
const vpick = w => {
  // weighted choice over [[weight, value], ...]
  let r = Math.random() * w.reduce((s, e) => s + e[0], 0);
  for (const e of w) if ((r -= e[0]) <= 0) return e[1];
  return w[w.length - 1][1];
};
// a buzzy vocal source like a sawtooth, but with its harmonics rolled off and roughened a little
// differently every call, so the same throat still gives a slightly different grain of voice
function reedWave(bright = 1) {
  const n = 32,
    re = new Float32Array(n),
    im = new Float32Array(n),
    tilt = rr(0.85, 1.2) / bright;
  let e = 0,
    es = 0;
  for (let h = 1; h < n; h++) {
    im[h] = (h % 2 ? 1 : -1) * Math.pow(h, -tilt) * rr(0.7, 1.3);
    e += im[h] * im[h];
    es += 1 / (h * h);
  }
  // scaled to carry the same energy as a plain sawtooth, so a darker grain isn't also a louder one
  const k = (2 / Math.PI) * Math.sqrt(es / e);
  for (let h = 1; h < n; h++) im[h] *= k;
  return ac.createPeriodicWave(re, im, { disableNormalization: true });
}
function reedOsc(bright = 1, w = reedWave(bright)) {
  const o = ac.createOscillator();
  o.setPeriodicWave(w);
  return o;
}
// who is calling from (x, y): the nearest animal of that kind, or the nearest wild flock of that species
function callerAt(k, x, y) {
  let best = null,
    bd = 90 * 90;
  for (const a of ANIMALS) {
    if (a.k !== k && !(k === 'lamb' && a.k === 'sheep')) continue;
    const d = wdx(a.x, x) ** 2 + (a.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  if (!best && typeof WILD !== 'undefined')
    for (const F of WILD.flocks) if (F.sp === k && wdx(F.x, x) ** 2 + (F.y - y) ** 2 < 200 * 200) return F;
  return best;
}
// o: who (the caller, for its voice), d (0 near .. 1 at the edge of hearing), x (alarm, 0..1)
function animalCall(k, vol, pn, o = {}) {
  if (!ac || muted) return;
  const t = ac.currentTime + 0.02,
    out = ac.createGain();
  out.gain.value = vol;
  const v = voiceOf(o.who),
    x = o.x || 0,
    d = clamp(o.d || 0, 0, 1);
  VOX = { p: v.p * wob(0.03) * (1 + 0.07 * x), f: v.f * wob(0.02), r: v.r * wob(0.06) * (1 - 0.18 * x), x };
  // distance: a far call loses its top to the air and reaches you more as echo off the land than direct
  const air = ac.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.value = lerp(7600, 1900, d);
  air.Q.value = 0.55;
  const dry = ac.createGain();
  dry.gain.value = 1 - 0.45 * d;
  out.connect(air);
  const p = panned(air, pn);
  p.connect(dry).connect(master);
  const send = ac.createGain();
  send.gain.value = 0.12 + 0.55 * d;
  p.connect(send).connect(verb);
  const sw = (f0, f1, dur, t0, q, bpf, type = 'sawtooth', vib = 0) => {
    const pj = VOX.p * wob(0.025);
    f0 *= pj;
    f1 *= pj * wob(0.02);
    dur *= VOX.r * wob(0.07);
    const o = type === 'sawtooth' ? reedOsc() : ac.createOscillator();
    if (type !== 'sawtooth') o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.linearRampToValueAtTime(f1, t0 + dur);
    if (vib) {
      const l = ac.createOscillator(),
        lg = ac.createGain();
      l.frequency.value = vib * wob(0.1);
      lg.gain.value = f0 * 0.05;
      l.connect(lg).connect(o.frequency);
      l.start(t0);
      l.stop(t0 + dur + 0.05);
    }
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bpf * VOX.f * wob(0.04);
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + Math.min(0.08, dur * 0.2));
    g.gain.setValueAtTime(1, t0 + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(bp).connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return dur;
  };
  if (k === 'cow') {
    moo(out, t);
  } else if (k === 'sheep' || k === 'lamb') {
    // one flock voice at a time: a bleat never lands on top of another, and after an ewe the
    // flock stays quiet a while. A lamb leaves a short gap so its ewe can still answer it.
    if (t < (amb.baaT || 0)) return;
    amb.baaT = t + (k === 'lamb' ? 0.4 : rr(3, 5));
    out.gain.value = vol * 0.65;
    baa(out, t, k === 'lamb');
  } else if (k === 'whistle') {
    // the farmer calling the dog: two quick notes, a long rising one, or three
    const b = rr(1800, 2100) * VOX.p,
      notes = vpick([
        [
          5,
          [
            [0, 1, 1.3, 0.2],
            [0.28, 1.3, 1.05, 0.2]
          ]
        ],
        [2, [[0, 0.95, 1.45, 0.45]]],
        [
          2,
          [
            [0, 1, 1.3, 0.16],
            [0.22, 1.3, 1.05, 0.16],
            [0.44, 1.05, 1.35, 0.22]
          ]
        ]
      ]);
    for (const [dt, a0, a1, dur] of notes) {
      const o = ac.createOscillator(),
        g = ac.createGain(),
        t0 = t + dt * wob(0.1);
      o.frequency.setValueAtTime(b * a0 * wob(0.02), t0);
      o.frequency.exponentialRampToValueAtTime(b * a1 * wob(0.02), t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.03);
      g.gain.linearRampToValueAtTime(0, t0 + dur + 0.02);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  } else if (k === 'dog') {
    bark(out, t);
  } else if (k === 'duck') {
    duckCall(out, t);
  } else if (k === 'crow') {
    const kind = x
      ? vpick([
          [6, 'caws'],
          [2, 'long'],
          [1, 'rattle']
        ])
      : vpick([
          [5, 'caws'],
          [2, 'long'],
          [1.5, 'rattle'],
          [2, 'soft']
        ]);
    if (kind === 'caws') {
      // a run of caws, each a touch different, often falling away towards the end
      const n = rr(2, x ? 6 : 5) | 0,
        fall = rr(0.94, 1.01);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = 760 * Math.pow(fall, i);
        sw(f, f * rr(0.66, 0.72), rr(0.2, 0.3), tt, 3, 1150);
        tt += vgap(0.4, 0.15);
      }
    } else if (kind === 'long') {
      // one drawn-out, grating caw
      sw(700, 470, 0.46, t, 4, 1100, 'sawtooth', 24);
      if (Math.random() < 0.5) sw(690, 500, 0.24, t + vgap(0.62), 3, 1150);
    } else if (kind === 'rattle') {
      // the knocking rattle crows make among themselves
      const n = rr(6, 11) | 0;
      for (let i = 0; i < n; i++) sw(950, 820, 0.025, t + i * vgap(0.045, 0.08), 3, 1400, 'square');
    } else {
      // a low, quiet conversational caw-caw
      out.gain.value = vol * 0.6;
      sw(600, 460, 0.16, t, 3, 900);
      sw(590, 450, 0.18, t + vgap(0.28), 3, 900);
    }
  } else if (k === 'magpie') {
    // the chattering rattle, longer when scolding; now and then a slower 'chack chack'
    if (!x && Math.random() < 0.25) {
      for (let i = 0; i < 2; i++) sw(1800, 1500, 0.08, t + i * vgap(0.2), 2, 2900, 'square');
    } else {
      const n = rr(x ? 6 : 4, x ? 11 : 8) | 0,
        drift = rr(0.985, 1.005);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = 2000 * Math.pow(drift, i);
        sw(f, f * 0.82, 0.05, tt, 2, 3200, 'square');
        tt += vgap(0.075, 0.1);
      }
    }
  } else if (k === 'fox') {
    if (SEASON === 3 && LIGHT.night > 0.5 && Math.random() < 0.35) {
      // a vixen's scream in the winter dark: long, hoarse, wavering, and nothing like a bird
      const dur = rr(0.9, 1.3) * VOX.r,
        o = reedOsc(1.3),
        f = rr(1000, 1200) * VOX.p;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 1.45, t + dur * 0.25);
      o.frequency.linearRampToValueAtTime(f * 1.2, t + dur * 0.7);
      o.frequency.linearRampToValueAtTime(f * 0.6, t + dur);
      const l = ac.createOscillator(),
        lg = ac.createGain();
      l.type = 'triangle';
      l.frequency.value = rr(9, 14);
      lg.gain.value = f * 0.06;
      l.connect(lg).connect(o.frequency);
      const env = ac.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.6, t + 0.06);
      env.gain.setValueAtTime(0.55, t + dur * 0.65);
      env.gain.linearRampToValueAtTime(0, t + dur);
      for (const [fq, q, a] of [
        [1600, 3, 1.4],
        [2900, 4, 0.8]
      ]) {
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fq * VOX.f;
        bp.Q.value = q;
        const g = ac.createGain();
        g.gain.value = a;
        o.connect(bp).connect(g).connect(env);
      }
      const s = ac.createBufferSource();
      s.buffer = amb.noise;
      const nb = ac.createBiquadFilter();
      nb.type = 'bandpass';
      nb.frequency.value = 2200;
      nb.Q.value = 1;
      const ng = ac.createGain();
      ng.gain.value = 0.25;
      s.connect(nb).connect(ng).connect(env);
      env.connect(out);
      o.start(t);
      l.start(t);
      s.start(t, Math.random() * 3);
      o.stop(t + dur + 0.05);
      l.stop(t + dur + 0.05);
      s.stop(t + dur + 0.05);
    } else {
      // a short, sharp bark-yip - a night sound, not a threat by itself, but worth pricking ears at;
      // sometimes a third, lower 'wow' follows
      sw(1500, 640, 0.16, t, 5, 1900);
      sw(1250, 560, 0.13, t + vgap(0.19), 5, 1700);
      if (Math.random() < 0.3) sw(1050, 480, 0.14, t + vgap(0.4), 5, 1500);
    }
  } else if (k === 'moose') {
    const kind = vpick([
      [5, 'grunt'],
      [3, 'double'],
      [2, 'moan']
    ]);
    if (kind === 'grunt') sw(170, 110, 1.2, t, 1.4, 360);
    else if (kind === 'double') {
      sw(160, 115, 0.4, t, 1.4, 340);
      sw(150, 105, 0.45, t + vgap(0.7), 1.4, 330);
    } else {
      // the long, hollow moan of a cow moose: rising, held, falling away
      const d2 = sw(150, 210, 1.1, t, 1.6, 420, 'sawtooth', 4);
      sw(205, 120, 1.1, t + d2 * 0.95, 1.6, 400, 'sawtooth', 4);
    }
  } else if (k === 'goose') {
    // honks, often the two-toned 'a-honk' of a greylag, each goose a little higher or lower
    const n = x
      ? rr(2, 5) | 0
      : vpick([
          [3, 1],
          [5, 2],
          [2, 3],
          [1, 4]
        ]);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const f = 540 * wob(0.05);
      if (Math.random() < 0.35) {
        sw(f * 0.8, f * 0.75, 0.07, tt, 3, 1000);
        tt += 0.08;
      }
      sw(f, f * 0.83, rr(0.13, 0.18), tt, 3, 1100);
      tt += vgap(0.24);
    }
  } else if (k === 'starling') {
    // a jumble: rising and falling wheezes, clicks, a rattle, a squeak, strung in a different order each time
    const bits = [
      tt => sw(2700, 3500, 0.16, tt, 6, 3100, 'sine'),
      tt => {
        const n = rr(3, 6) | 0;
        for (let i = 0; i < n; i++) sw(4300, 3900, 0.025, tt + i * vgap(0.05), 4, 4100, 'square');
        return n * 0.05;
      },
      tt => sw(3500, 2300, 0.24, tt, 5, 2900, 'sine', 32),
      tt => {
        for (let i = 0; i < 6; i++) sw(3000 + (i % 2) * 600, 3200, 0.03, tt + i * 0.035, 5, 3300, 'triangle');
        return 0.21;
      },
      tt => sw(5200, 6000, 0.07, tt, 6, 5500, 'sine')
    ];
    for (let i = bits.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [bits[i], bits[j]] = [bits[j], bits[i]];
    }
    let tt = t;
    for (const b of bits.slice(0, rr(2, 5) | 0)) tt += (b(tt) || 0.1) + vgap(0.06, 0.4);
  } else if (k === 'linnet') {
    // a light, bouncing twitter
    const n = rr(4, 8) | 0;
    let tt = t;
    for (let i = 0; i < n; i++) {
      const f = rr(2600, 3400);
      sw(f, f * rr(1.08, 1.22), 0.05, tt, 5, 3000, 'triangle');
      tt += vgap(0.08, 0.25);
    }
  } else if (k === 'fieldfare') {
    // the harsh chattering "chack-chack"
    const n = rr(2, 5) | 0;
    for (let i = 0; i < n; i++) sw(1950, 1500, 0.07, t + i * vgap(0.12, 0.18), 2, 2400);
  } else if (k === 'bunting') {
    // a soft rippling trill
    const n = rr(6, 11) | 0,
      a = rr(380, 520);
    for (let i = 0; i < n; i++)
      sw(2500 + (i % 2) * a, 2700 + (i % 2) * a * 0.66, 0.04, t + i * vgap(0.05, 0.08), 5, 2900, 'sine');
  } else if (k === 'whirr') {
    // many small wings taking off at once
    const s = ac.createBufferSource();
    s.buffer = amb.noise;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = rr(750, 1100);
    f.Q.value = 0.7;
    const g = ac.createGain(),
      dur = rr(0.55, 0.85);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 3);
    s.stop(t + dur + 0.02);
  }
}
/* ---------- voices: duck and cow ---------- */
function quack(t0, out, f0, v, len = 1) {
  // nasal, rasping, falling: a buzzy source through two narrow formants, roughened by fast AM
  const o = reedOsc();
  o.frequency.setValueAtTime(f0 * 1.12, t0);
  o.frequency.exponentialRampToValueAtTime(f0, t0 + 0.035 * len);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t0 + 0.2 * len);
  const am = ac.createOscillator(),
    amg = ac.createGain(),
    rough = ac.createGain();
  am.type = 'sine';
  am.frequency.value = rr(28, 39);
  amg.gain.value = 0.22;
  rough.gain.value = 0.78;
  am.connect(amg).connect(rough.gain);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(v, t0 + 0.012);
  env.gain.setValueAtTime(v * 0.9, t0 + 0.1 * len);
  env.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.22 * len);
  o.connect(rough);
  for (const [f, q, a] of [
    [rr(950, 1100) * VOX.f, 5, 1],
    [rr(2100, 2400) * VOX.f, 6, 0.6],
    [520, 2, 0.25]
  ]) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f * 1.08, t0);
    bp.frequency.linearRampToValueAtTime(f * 0.94, t0 + 0.2 * len);
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.value = a * 3.4;
    rough.connect(bp).connect(g).connect(env);
  }
  env.connect(out);
  o.start(t0);
  am.start(t0);
  o.stop(t0 + 0.25 * len);
  am.stop(t0 + 0.25 * len);
}
function duckCall(out, t) {
  const f = rr(235, 290) * VOX.p,
    kind = VOX.x
      ? vpick([
          [3, 'run'],
          [2, 'loud']
        ])
      : vpick([
          [5, 'run'],
          [2, 'loud'],
          [3, 'chat']
        ]);
  let tt = t,
    v = 1;
  if (kind === 'run') {
    // a mallard hen's decrescendo: loud first, each quack a little lower and quieter
    const n = rr(2, 6) | 0;
    for (let i = 0; i < n; i++) {
      quack(tt, out, f * Math.pow(0.97, i) * wob(0.015), v);
      tt += vgap(0.23, 0.12) + i * 0.012;
      v *= rr(0.74, 0.86);
    }
  } else if (kind === 'loud') {
    // one or two flat, loud quacks
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      quack(tt, out, f * 0.96 * wob(0.02), 1, 1.25);
      tt += vgap(0.34);
    }
  } else {
    // quiet muttering among themselves: short, higher, soft 'kweg's
    const n = rr(3, 7) | 0;
    for (let i = 0; i < n; i++) {
      quack(tt, out, f * rr(1.1, 1.3), rr(0.3, 0.5), rr(0.4, 0.6));
      tt += vgap(0.13, 0.35);
    }
  }
}
function baa(out, t, forceLamb) {
  // a bleat: tremulous voice, lips opening on the 'b', a nasal 'aaa' held with a shaky wobble, sliding down at the end.
  // Now and then an ewe only mutters: a short, low, near-closed 'mmh' to the flock.
  const lamb = forceLamb || Math.random() < 0.3,
    mut = !lamb && Math.random() < 0.18,
    f = (lamb ? rr(360, 440) : rr(190, 250) * (mut ? 0.85 : 1)) * VOX.p,
    d = (mut ? rr(0.25, 0.4) : lamb ? rr(0.45, 0.7) : rr(0.6, 1.05)) * VOX.r,
    open = mut ? rr(900, 1300) : 3600 * wob(0.12),
    n = !mut && Math.random() < 0.2 ? 2 : 1;
  if (mut) out.gain.value *= 0.7;
  for (let k = 0; k < n; k++) {
    const t0 = t + k * (d + vgap(0.37, 0.3)),
      ff = f * (k ? rr(0.94, 1.02) : 1);
    const o = reedOsc();
    const p = o.frequency;
    p.setValueAtTime(ff * 0.86, t0);
    p.linearRampToValueAtTime(ff * rr(1.02, 1.07), t0 + 0.09);
    p.linearRampToValueAtTime(ff, t0 + d * 0.6);
    p.linearRampToValueAtTime(ff * rr(0.8, 0.88), t0 + d);
    const rate = rr(7, 10),
      vib = ac.createOscillator(),
      vg = ac.createGain();
    vib.frequency.value = rate;
    vg.gain.value = ff * rr(0.025, 0.045);
    vib.connect(vg).connect(p);
    const trem = ac.createGain();
    trem.gain.value = 0.55;
    const tg = ac.createGain();
    tg.gain.value = rr(0.25, 0.38);
    vib.connect(tg).connect(trem.gain);
    const lip = ac.createBiquadFilter();
    lip.type = 'lowpass';
    lip.frequency.setValueAtTime(350, t0);
    lip.frequency.exponentialRampToValueAtTime(open, t0 + 0.07);
    lip.frequency.setValueAtTime(open, t0 + d * 0.75);
    lip.frequency.exponentialRampToValueAtTime(Math.min(900, open * 0.8), t0 + d);
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
      bp.frequency.value = fq * VOX.f;
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
// one bark: a rough voice through the dog's mouth formants (fm scales them: lower for a deep 'woof')
function woof(out, t0, f, len, fm, v = 1) {
  const o = reedOsc();
  o.frequency.setValueAtTime(f * 1.3, t0);
  o.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + len * 0.87);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(v, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + len);
  for (const [fq, q, g0] of [
    [850, 2, 1.6],
    [1700, 3, 0.9],
    [380, 1.5, 0.6]
  ]) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fq * fm;
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.value = g0;
    o.connect(bp).connect(g).connect(env);
  }
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const nb = ac.createBiquadFilter();
  nb.type = 'bandpass';
  nb.frequency.value = 1300 * fm;
  nb.Q.value = 0.9;
  const ng = ac.createGain();
  ng.gain.value = 0.35;
  s.connect(nb).connect(ng).connect(env);
  env.connect(out);
  o.start(t0);
  s.start(t0, Math.random() * 3);
  o.stop(t0 + len + 0.02);
  s.stop(t0 + len + 0.02);
}
function bark(out, t) {
  // a farm dog: mostly a few short, rough barks falling in pitch; sometimes one deep 'woof',
  // sometimes a string of high, excited yips
  const kind = vpick([
      [6, 'barks'],
      [2, 'woof'],
      [2, 'yips']
    ]),
    fm = VOX.f;
  if (kind === 'barks') {
    const n = vpick([
      [1, 1],
      [5, 2],
      [4, 3],
      [1, 4]
    ]);
    let tt = t;
    for (let i = 0; i < n; i++) {
      woof(out, tt, rr(300, 390) * VOX.p, 0.15 * wob(0.15), fm * wob(0.03), i ? rr(0.75, 1) : 1);
      tt += vgap(0.2, 0.2);
    }
  } else if (kind === 'woof') {
    woof(out, t, rr(230, 280) * VOX.p, 0.22 * wob(0.1), fm * 0.85, 1.1);
  } else {
    const n = rr(3, 6) | 0;
    let tt = t;
    for (let i = 0; i < n; i++) {
      woof(out, tt, rr(520, 640) * VOX.p, 0.07 * wob(0.2), fm * 1.2, rr(0.5, 0.8));
      tt += vgap(0.13, 0.25);
    }
  }
}
function moo(out, t) {
  // closed 'mm' opening into 'ooo' and closing again: a resonant lowpass sweeps over a low buzzy voice.
  // Mostly a plain moo; sometimes only a soft, short lowing with the mouth barely open; sometimes a long bellow
  // that climbs higher and opens wide - and then, as often as not, trails off with a second, shorter moo
  const kind = vpick([
      [5, 'moo'],
      [3, 'low'],
      [2, 'bellow']
    ]),
    s =
      kind === 'low'
        ? { d: rr(0.55, 0.85), rise: 1.08, open: 0.5, a: 0.6 }
        : kind === 'bellow'
          ? { d: rr(1.9, 2.5), rise: rr(1.3, 1.4), open: 1.2, a: 0.7 }
          : { d: rr(1.3, 1.9), rise: rr(1.15, 1.25), open: wob(0.12), a: 0.9 };
  mooOne(out, t, rr(98, 122) * VOX.p, s.d * VOX.r, s.rise, s.open, s.a);
  if (kind === 'bellow' && Math.random() < 0.5)
    mooOne(out, t + s.d * VOX.r + vgap(0.35, 0.3), rr(92, 110) * VOX.p, rr(0.8, 1.1) * VOX.r, 1.12, 0.8, 0.7);
}
function mooOne(out, t, f, d, rise, open, a) {
  const src = ac.createGain(),
    w = reedWave();
  for (const det of [-5, 4]) {
    const o = reedOsc(1, w);
    o.detune.value = det;
    const p = o.frequency;
    p.setValueAtTime(f * 0.88, t);
    p.linearRampToValueAtTime(f * rise, t + d * 0.22);
    p.linearRampToValueAtTime(f * (rise - 0.1), t + d * 0.65);
    p.linearRampToValueAtTime(f * 0.78, t + d);
    const l = ac.createOscillator(),
      lg = ac.createGain();
    l.frequency.value = rr(4, 6);
    lg.gain.value = f * 0.018;
    l.connect(lg).connect(p);
    o.connect(src);
    o.start(t);
    l.start(t);
    o.stop(t + d + 0.1);
    l.stop(t + d + 0.1);
  }
  const fm = VOX.f;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 5;
  const c = lp.frequency;
  c.setValueAtTime(240 * fm, t);
  c.linearRampToValueAtTime(900 * open * fm, t + d * 0.3);
  c.linearRampToValueAtTime(620 * open * fm, t + d * 0.7);
  c.linearRampToValueAtTime(280 * fm, t + d);
  const lp2 = ac.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.Q.value = 1.2;
  const c2 = lp2.frequency;
  c2.setValueAtTime(380 * fm, t);
  c2.linearRampToValueAtTime(1300 * open * fm, t + d * 0.3);
  c2.linearRampToValueAtTime(900 * open * fm, t + d * 0.7);
  c2.linearRampToValueAtTime(420 * fm, t + d);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(a, t + Math.min(0.18, d * 0.2));
  env.gain.setValueAtTime(a, t + d * 0.72);
  env.gain.linearRampToValueAtTime(0, t + d);
  src.connect(lp).connect(lp2).connect(env).connect(out);
  // breath
  const s = ac.createBufferSource();
  s.buffer = amb.noise;
  const nb = ac.createBiquadFilter();
  nb.type = 'bandpass';
  nb.frequency.value = 700 * fm;
  nb.Q.value = 0.8;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(0.05 * a, t + Math.min(0.2, d * 0.25));
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
// the church bell, rung slowly: a heavy bronze strike with the hum a minor third and an octave under the
// strike note, inharmonic partials above it, and a long ringing tail carried far over the land
function churchBell(v, pan, n = 9) {
  const t0 = ac.currentTime + 0.1,
    out = ac.createGain();
  out.gain.value = v;
  const p = panned(out, pan);
  p.connect(master);
  p.connect(verb);
  const f = rr(196, 212);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * rr(2.3, 2.6),
      hit = i === n - 1 ? 0.8 : 1;
    for (const [r, a, d] of [
      [0.5, 0.5, 9],
      [1, 0.8, 7],
      [1.19, 0.4, 5],
      [1.5, 0.22, 4],
      [2, 0.34, 3.5],
      [2.52, 0.12, 2.2],
      [3.01, 0.08, 1.6]
    ]) {
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.002);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * hit, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + d + 0.05);
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

function audioTick(dt) {
  if (!ac || !amb) return;
  const now = ac.currentTime;
  amb.gust = WEATHER.g; // the gusts themselves come from weather.js, where the flock is
  if (!muted) {
    const nf = LIGHT.night,
      hr = CAL.hour,
      dawn = hr > 3.5 && hr < 9 && nf < 0.8,
      regional = L ? regionWeights(L.x, L.y) : { town: 0 },
      ruralQuiet = 1 - regional.town * 0.55;
    amb.cricketT -= dt;
    if (amb.cricketT <= 0) {
      // crickets build through summer and die back with the autumn frosts
      const ck = SEASON === 1 ? 0.5 + 0.6 * GROW.p : SEASON === 2 ? 1 - 0.75 * GROW.p : 0;
      if (Math.random() < (0.35 + 0.65 * nf) * ck * ruralQuiet) cricket();
      amb.cricketT = rr(0.5, 2.2) * (st.settled ? 0.7 : 1);
    }
    amb.hopperT -= dt;
    if (amb.hopperT <= 0) {
      if ((SEASON === 1 || SEASON === 2) && nf < 0.3 && Math.random() < (SEASON === 1 ? 0.5 + GROW.p : 1.2 - GROW.p))
        hopper();
      amb.hopperT = rr(5, 13);
    }
    amb.songT -= dt;
    if (amb.songT <= 0) {
      const bl = birdLife(),
        chorus = dawn && SEASON < 2 ? 1 + 2 * Math.min(1, bl) : 1; // the dawn chorus swells with the season
      if (nf < 0.6 && (SEASON < 3 || Math.random() < 0.3)) {
        songbird((0.6 + 0.35 * Math.min(1.3, bl)) * ruralQuiet);
        if (chorus > 2.4 && Math.random() < 0.4) songbird(0.45);
      }
      amb.songT = rr(3, 9) / Math.max(0.2, SEASON === 3 ? 1 : bl * chorus);
    }
    amb.owlT = (amb.owlT || 8) - dt;
    if (amb.owlT <= 0) {
      if (nf > 0.6) owlHoot(hawks.some(h => h.kind === 'owl') ? 0.05 : 0.025);
      amb.owlT = rr(9, 22);
    }
    amb.frogT = (amb.frogT || 5) - dt;
    if (amb.frogT <= 0) {
      if (SEASON === 0 && GROW.p > 0.2 && nf > 0.4 && L && Math.hypot(wdx(L.x, LAKE.x), L.y - LAKE.y) < LAKE.r + 700)
        frog();
      amb.frogT = rr(1.5, 5);
    }
    const calm = !hawks.some(h => h.state === 'dive' || h.state === 'stalk' || h.state === 'hover');
    // the church bell rings once in the middle of each season, a little after nine in the morning
    if (CHURCH && L && CAL.day % DAYS_PER_SEASON === 1 && hr > 9.2 && hr < 10 && amb.bellDay !== CAL.day) {
      amb.bellDay = CAL.day;
      const dx = wdx(CHURCH.b.cx, L.x),
        d = Math.hypot(dx, CHURCH.b.cy - L.y);
      churchBell(0.035 * Math.max(0, 1 - d / 4000) + 0.006, clamp(dx / 1200, -0.9, 0.9));
    }
    musicTick();
    amb.seaT = (amb.seaT || rr(8, 16)) - dt;
    if (amb.seaT <= 0) {
      amb.seaT = rr(10, 26);
      if (SEASON === 0 && GROW.p > 0.3 && nf < 0.4 && calm && Math.random() < 0.55)
        cuckoo(); // not back until May
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
      // the countryside is mostly quiet: an animal speaks up every so often, and each kind then
      // rests a while, so a lone moose or one busy flock can't take every turn
      amb.callT = rr(6, 14);
      const rest = amb.rest || (amb.rest = {});
      const hush = k => 1 - clamp(LIGHT.night * 1.4 - 0.2, 0, 1) * (1 - AMB_NIGHT[k]);
      const near = ANIMALS.filter(
        a =>
          a.k in AMB_REST &&
          now > (rest[a.k] || 0) &&
          Math.hypot(wdx(a.x, L.x), a.y - L.y) < 950 &&
          Math.random() < hush(a.k)
      );
      if (near.length) {
        const a = pickP(near);
        rest[a.k] = now + rr(...AMB_REST[a.k]);
        const say = b => {
          const d = Math.hypot(wdx(b.x, L.x), b.y - L.y);
          if (d < 950) animalCall(b.k, 0.06 * (1 - d / 950) + 0.007, wdx(b.x, L.x) / 700, { who: b, d: d / 950 });
        };
        say(a);
        // and sometimes another of its kind close by answers it, in its own voice
        if (Math.random() < (AMB_ANSWER[a.k] || 0)) {
          const mates = ANIMALS.filter(
            b => b !== a && b.k === a.k && !b.dying && Math.hypot(wdx(b.x, a.x), b.y - a.y) < 500
          );
          if (mates.length) {
            const b = pickP(mates);
            setTimeout(() => L && say(b), rr(1200, 3500));
          }
        }
      }
    }
    if (LIFE.calls && LIFE.calls.length)
      for (const c of LIFE.calls.splice(0, LIFE.calls.length).slice(0, 4)) {
        const d = Math.hypot(wdx(c.x, L.x), c.y - L.y),
          heard = amb.heard || (amb.heard = {});
        // the same kind calling again right away (several crows at a hawk, a scolding magpie)
        // blurs into a racket, so let each kind be heard at most every so often
        if (now < (heard[c.k] || 0)) continue;
        heard[c.k] = now + (CALL_GAP[c.k] || 0);
        if (d < 1600) {
          const v = 0.05 * (1 - d / 1600) + 0.012,
            who = c.who || callerAt(c.k, c.x, c.y),
            x = CALM_CALL[c.k] ? 0 : 0.7;
          // a crowd (crows mobbing, a skein of geese) is several birds, each in its own voice
          const many = c.k === 'crow' || c.k === 'goose';
          for (let i = 0; i < (c.n || 1); i++)
            setTimeout(
              () => animalCall(c.k, v, wdx(c.x, L.x) / 800, { who: i && many ? null : who, d: d / 1600, x }),
              i * rr(250, 500)
            );
        }
      }
  }
  if (L) {
    // the room the flock is actually standing in: dry and open over a bare field, dulled and
    // longer-held under forest canopy, and a touch of tight slap-back against a farm's own walls -
    // set from the flock's own position so the reverb changes as it moves, not as a fixed setting
    const fo = clamp(forestness(L.x, L.y), 0, 1);
    let bd = 1e9;
    for (const b of BUILDS) {
      const dd = Math.hypot(wdx(L.x, b.cx), L.y - b.cy);
      if (dd < bd) bd = dd;
    }
    const nearBuild = clamp(1 - bd / 260, 0, 1);
    amb.vout.gain.setTargetAtTime(0.16 + 0.32 * fo + 0.16 * nearBuild, now, 2.5);
    amb.verbLP.frequency.setTargetAtTime(2600 - 1500 * fo + 500 * nearBuild, now, 2.5);
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
  // winter nights get a thin, cold whistle through the bare trees
  amb.wg2.gain.setTargetAtTime((g > 0.7 ? 0.004 : 0.0008) * (1 + 1.6 * ww) * (1 + 1.4 * ww * LIGHT.night), now, 1.5);
  amb.wf2.frequency.setTargetAtTime(700 + 700 * g, now, 2);
  // this is a bare highpass hiss (no band to give it shape), so it's the layer most likely to read
  // as "static" on its own - trimmed back to a hint of rustle rather than a competing noise bed
  // leaf rustle needs leaves: little in early spring, growing as the trees leaf out, thinning as they drop
  const leafy =
    SEASON === 0 ? 0.4 + 0.6 * smooth(0.25, 0.7, GROW.p) : SEASON === 2 ? 1 - 0.5 * smooth(0.6, 1, GROW.p) : 1;
  amb.wg3.gain.setTargetAtTime((0.0013 + 0.004 * g) * (1 + 0.9 * au) * (1 - 0.7 * ww) * leafy, now, 1);
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
  // the field tractor parks for the night (life.js: LIGHT.night > 0.4), engine off - it should read
  // as silent then, not just quieter, however close the flock roosts to it
  for (const a of ANIMALS) if (a.k === 'tractor' && L && LIGHT.night <= 0.4) td = Math.hypot(wdx(a.x, L.x), a.y - L.y);
  let cd = 1e9,
    car = null;
  if (L)
    for (const v of TRAFFIC) {
      if (!v.engineOn) continue;
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
      const lx = TRAIN.cars[0].x;
      horn(0.028 + 0.045 * pr, TRAIN, clamp(wdx(lx, L.x) / 900, -0.8, 0.8));
    }
  }
  amb.hg.gain.setTargetAtTime(0.006 * clamp(1 - sd / 240, 0, 1) ** 1.5, now, 0.3);
  const ri = LIGHT.rain;
  amb.rng.gain.setTargetAtTime(0.05 * ri, now, 1.2);
  amb.rng2.gain.setTargetAtTime(0.022 * ri * ri, now, 1.2);
}
