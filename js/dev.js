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
  hour(h) {
    const day = Math.floor(CAL.t / DAY_LEN);
    CAL.t = day * DAY_LEN + (((h - START_HOUR + 24) % 24) / 24) * DAY_LEN;
    calUpdate();
  },
  // first animal of a kind, and a hawk circling right here
  find(k) {
    return ANIMALS.find(a => a.k === k && !a.dying);
  },
  hawk(kind = 'hawk') {
    st.grace = 0;
    spawnHawk(kind);
    const h = hawks[hawks.length - 1];
    h.x = L.x + 300;
    h.y = L.y - 200;
    return h;
  },
  // land the flock on open ground where it is
  land() {
    st.settleCool = 0;
    settle();
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
