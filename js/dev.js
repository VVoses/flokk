/* Flokk - dev.js
   Test helpers, loaded only when the page is opened with ?dev (see the end of index.html).
   Everything in the game's files is a global, so a test can also read or poke any variable directly. */
'use strict';
DEV = { zoom: null };
window.dev = {
  // put the flock (flying) at world position x,y and centre the camera there; optional fixed zoom
  to(x, y, zoom) {
    st.grace = 1e9;
    for (const b of birds) {
      if (b.perch && b.perch.occ === b) b.perch.occ = null;
      b.perch = null;
      b.state = 'fly';
      b.vx = b.vy = 0;
    }
    st.settled = false;
    tmpSpots = [];
    const lx = L.x,
      ly = L.y;
    for (const b of birds) {
      b.x = x + (b.x - lx);
      b.y = y + (b.y - ly);
    }
    cam.x = L.x;
    cam.py = PY(L.y, L.z * 0.7);
    if (zoom) DEV.zoom = zoom;
  },
  zoom(z) {
    DEV.zoom = z || null;
  },
  // no hawks for a while
  calm() {
    st.grace = 1e9;
    hawks = [];
  },
  // jump straight to a season (0 spring .. 3 winter) at a given hour
  season(s, hour = 10) {
    CAL.t = s * DAYS_PER_SEASON * DAY_LEN + (((hour - START_HOUR + 24) % 24) / 24) * DAY_LEN;
    calUpdate();
    applySeason(s);
    TRANS.t = 1;
    TRANS.prevG = null;
    TRANS.prevSPR = null;
  },
  // pin how far through the season the land is (0..1) for gradual-change screenshots; no argument unpins
  grow(p) {
    DEV.growP = p;
    GROW.mKey = '';
    GROW.mT = 0;
    growTick(0);
  },
  hour(h) {
    const day = Math.floor(CAL.t / DAY_LEN);
    CAL.t = day * DAY_LEN + (((h - START_HOUR + 24) % 24) / 24) * DAY_LEN;
    calUpdate();
  },
  // first animal of a kind, and a hawk circling right here
  find(k) {
    return ANIMALS.find(a => a.k === k && !a.dying);
  },
  // a small wild flock (starling, linnet, fieldfare, bunting) flying in to a field near the flock now
  wild(sp = 'starling') {
    for (const F of WILD.flocks) for (const a of F.members) a.life = 0;
    WILD.flocks = [];
    return !!spawnWild(sp);
  },
  hawk(kind = 'hawk') {
    st.grace = 0;
    spawnHawk(kind);
    const h = hawks[hawks.length - 1];
    h.x = L.x + 300;
    h.y = L.y - 200;
    return h;
  },
  // a stress flock: n birds in all, and h hawks and o owls on the wing round it
  crowd(n = 80, h = 3, o = 2) {
    st.grace = 0;
    while (birds.length < n) birds.push(newBird(L.x + rr(-60, 60), L.y + rr(-60, 60)));
    hawks = [];
    for (let i = 0; i < h; i++) spawnHawk('hawk');
    for (let i = 0; i < o; i++) spawnHawk('owl');
  },
  // land the flock on open ground where it is
  land() {
    st.settleCool = 0;
    settle();
  },
  // pin the weather: dev.weather({ s: 1.5, ang: 0, fog: 0.8 }) (wind strength, where it blows, fog); no argument unpins
  weather(o) {
    if (!o) return (WEATHER.pin = null);
    const p = {};
    if (o.s !== undefined) p.sT = WEATHER.s = o.s;
    if (o.ang !== undefined) p.angT = WEATHER.ang = o.ang;
    if (o.fog !== undefined) p.fogT = WEATHER.fog = o.fog;
    WEATHER.pin = p;
    weatherTick(0);
  },
  stats() {
    return {
      x: L.x | 0,
      y: L.y | 0,
      WX,
      season: SEASON,
      birds: birds.length,
      hawks: hawks.length,
      animals: ANIMALS.length,
      busy: ANIMALS.filter(a => a.busy).map(a => a.k + ':' + a.st)
    };
  }
};

// record how some value changes over time: TRACE.start(()=>[...]); later read TRACE.log
window.TRACE = {
  log: [],
  start(fn, ms = 200) {
    this.log = [];
    let last = '';
    clearInterval(this.id);
    const t0 = performance.now();
    this.id = setInterval(() => {
      const v = JSON.stringify(fn());
      if (v !== last) {
        this.log.push(((performance.now() - t0) / 1000).toFixed(1) + 's ' + v);
        last = v;
      }
    }, ms);
  }
};
