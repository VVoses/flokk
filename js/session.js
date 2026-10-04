/* Local, versioned session snapshots. Static world objects are rebuilt from the seed;
   graph references preserve perches, herd relationships, prey, and ongoing journeys. */
'use strict';
// Each flight autosaves into its own slot. A slot is a localStorage entry; the one older builds kept
// under 'flokk-session-v1' is simply the slot called 'legacy', so nothing needs migrating.
const SLOT_PREFIX = 'flokk-slot-v1:',
  LEGACY_SLOT = 'legacy',
  MAX_SLOTS = 6,
  SESSION_VERSION = 2,
  SESSION_MAX_BYTES = 12000000;
let sessionClock = 0,
  sessionLastRaw = null,
  sessionConflict = false,
  curSlot = null; // the slot the running flight saves into
const slotKey = id => (id === LEGACY_SLOT ? 'flokk-session-v1' : SLOT_PREFIX + id);
const sessionKey = () => (curSlot ? slotKey(curSlot) : null);
const newSlotId = () => Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
// the statics only change when a new world is generated (new perch objects), so the registry and the
// signature are worked out once per world: the signature alone is ~20ms, and a save runs every 5 s
let sessionStatics = null;
function sessionRegistry() {
  if (sessionStatics && sessionStatics.p0 === perches[0] && sessionStatics.t0 === TREES[0]) return sessionStatics;
  const values = [],
    ids = new Map();
  const add = v => {
    if (v && !ids.has(v)) {
      ids.set(v, values.length);
      values.push(v);
    }
  };
  for (const list of [perches, TREES, BUILDS, FIELDS, FARMS, YARDS, LANES, ZONES]) for (const v of list) add(v);
  for (const b of BUILDS) for (const p of b.parts || []) add(p);
  for (const v of [LAKE, POND, JET, BOAT, CHURCH, lakeR, pondR]) add(v);
  return (sessionStatics = { values, ids, p0: perches[0], t0: TREES[0], sig: null });
}
// References in the snapshot point into sessionRegistry by index. Record the generated world's
// geometry in that same order so a later world-generator change cannot silently remap them.
function worldSignature() {
  const reg = sessionRegistry();
  if (reg.sig) return reg.sig;
  const { values } = reg,
    keys = ['x', 'y', 'cx', 'cy', 'z', 'h', 'w', 'r', 'lw', 'lh', 'len', 'dep', 'ang', 'type', 'kind', 'tt', 't'],
    signature = values.map(v => {
      if (Array.isArray(v)) return v;
      const out = {};
      for (const key of keys) {
        if (key === 'h' && v.type === 'boat') continue; // the boat's perches rise and fall with the waves, so their height is not part of the world
        if (typeof v[key] === 'number' || typeof v[key] === 'string') out[key] = v[key];
      }
      if (v.poly) out.poly = v.poly;
      return out;
    });
  const raw = JSON.stringify(signature);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return (reg.sig = (hash >>> 0).toString(16));
}
// a one-line description of a save for the title screen: where the flock is in its year
function sessionSummary() {
  return {
    won: st.mode === 'won',
    year: CAL.year,
    season: CAL.season,
    day: (CAL.day % YEAR_DAYS) + 1,
    birds: birds.length,
    land: LAND_NAME,
    updated: Date.now()
  };
}
function summaryText(m) {
  if (!m || !Number.isFinite(m.birds)) return '';
  const birds = `${m.birds} ${m.birds === 1 ? 'bird' : 'birds'}`,
    when = m.won ? 'year complete' : `${SEASONS[m.season] || ''} · day ${m.day}`.toLowerCase();
  return `${when}${m.year > 1 ? ` · year ${m.year}` : ''} · ${birds}`;
}
function agoText(t) {
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 2) return 'just now';
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
function sessionWarning(message) {
  const warning = $('sessionWarning');
  if (warning) {
    warning.textContent = message;
    warning.hidden = !message;
  }
}
function sessionChangedElsewhere() {
  sessionConflict = true;
  sessionWarning('Another tab changed this save. This tab will not overwrite it. Reload to continue the newer flight.');
}
function packSession(root) {
  const { ids: statics } = sessionRegistry(),
    nodes = [],
    seen = new Map();
  const encode = v => {
    if (v === undefined) return { u: true };
    if (typeof v === 'number' && !Number.isFinite(v)) return { n: String(v) };
    if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return v;
    if (statics.has(v)) return { s: statics.get(v) };
    if (typeof v === 'function') throw new Error('Unsupported session function');
    if (seen.has(v)) return { r: seen.get(v) };
    const id = nodes.length;
    seen.set(v, id);
    const node = { array: Array.isArray(v), entries: [] };
    nodes.push(node);
    for (const [k, value] of Object.entries(v)) node.entries.push([k, encode(value)]);
    return { r: id };
  };
  return { root: encode(root), nodes };
}
function unpackSession(data) {
  const { values } = sessionRegistry();
  if (!Array.isArray(data.nodes) || data.nodes.length > 100000) throw new Error('Invalid snapshot');
  const nodes = data.nodes.map(n => (n.array ? [] : {}));
  const decode = v => {
    if (!v || typeof v !== 'object') return v;
    if (v.u) return undefined;
    if (v.n) return v.n === 'Infinity' ? Infinity : v.n === '-Infinity' ? -Infinity : NaN;
    if (Number.isInteger(v.s) && v.s >= 0 && v.s < values.length) return values[v.s];
    if (Number.isInteger(v.r) && v.r >= 0 && v.r < nodes.length) return nodes[v.r];
    throw new Error('Broken snapshot reference');
  };
  data.nodes.forEach((n, i) => {
    if (!Array.isArray(n.entries)) throw new Error('Invalid snapshot node');
    for (const [k, v] of n.entries) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('Invalid snapshot key');
      nodes[i][k] = decode(v);
    }
  });
  return decode(data.root);
}
function parseSlot(raw) {
  try {
    if (!raw || raw.length > SESSION_MAX_BYTES) return null;
    const v = JSON.parse(raw);
    return v.version === SESSION_VERSION &&
      typeof v.worldSignature === 'string' &&
      Number.isInteger(v.seed) &&
      Number.isFinite(v.time) &&
      v.time >= 0 &&
      v.data
      ? v
      : null;
  } catch {
    return null;
  }
}
function readSession(id = curSlot) {
  try {
    return id ? parseSlot(localStorage.getItem(slotKey(id))) : null;
  } catch {
    return null;
  }
}
// every stored flight, newest first; unreadable ones (an older build, a damaged entry) stay listed
// at the end so they can be deleted instead of silently taking up room
function listSlots() {
  const rows = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const id =
        k === 'flokk-session-v1' ? LEGACY_SLOT : k && k.startsWith(SLOT_PREFIX) ? k.slice(SLOT_PREFIX.length) : null;
      if (!id) continue;
      const saved = parseSlot(localStorage.getItem(k));
      rows.push({
        id,
        ok: !!saved,
        summary: saved && saved.summary,
        updated: (saved && saved.summary && saved.summary.updated) || 0
      });
    }
  } catch {
    /* storage unavailable: no saves to list */
  }
  return rows.sort((x, y) => Number(y.ok) - Number(x.ok) || y.updated - x.updated);
}
function deleteSlot(id) {
  try {
    localStorage.removeItem(slotKey(id));
  } catch {
    /* unavailable storage */
  }
}
// a new flight gets a slot of its own; when all are taken the oldest is the one it replaces
function claimSlot() {
  const rows = listSlots();
  if (rows.length >= MAX_SLOTS) for (const r of rows.slice(MAX_SLOTS - 1)) deleteSlot(r.id);
  curSlot = newSlotId();
  sessionLastRaw = null;
  sessionConflict = false;
  sessionWarning('');
}
function saveSession() {
  if (!curSlot || !['play', 'pause', 'won'].includes(st.mode) || !birds.length || sessionConflict) return false;
  try {
    if (localStorage.getItem(sessionKey()) !== sessionLastRaw) {
      sessionChangedElsewhere();
      return false;
    }
    const data = packSession({
      st,
      cal: CAL,
      cam,
      birds,
      hawks,
      animals: ANIMALS,
      swarms,
      dflies,
      tmpSpots,
      wild: WILD,
      life: LIFE,
      train: TRAIN,
      traffic: TRAFFIC,
      weather: WEATHER,
      rain: RAIN,
      wind: WIND,
      feeder: FEEDER ? { raider: FEEDER.raider, raidCool: FEEDER.raidCool } : null,
      trainT: TRAIN_T,
      trafficT: TRAFFIC_T,
      T,
      WX,
      muted
    });
    const raw = JSON.stringify({
      version: SESSION_VERSION,
      seed: SEED,
      time: CAL.t,
      worldSignature: worldSignature(),
      summary: sessionSummary(),
      data
    });
    if (raw.length > SESSION_MAX_BYTES) throw new Error('Save exceeds storage limit');
    localStorage.setItem(sessionKey(), raw);
    sessionLastRaw = raw;
    sessionWarning('');
    return true;
  } catch (error) {
    sessionWarning('This flight could not be saved. Check available browser storage.');
    console.warn('Flokk session save failed:', error);
    return false;
  }
}
// the end of a flight (taken or starved) deletes its slot; other flights are never touched
function clearSession() {
  if (!curSlot) return;
  try {
    if (localStorage.getItem(sessionKey()) !== sessionLastRaw) return sessionChangedElsewhere();
    localStorage.removeItem(sessionKey());
    sessionLastRaw = null;
    sessionConflict = false;
    sessionWarning('');
  } catch {
    /* unavailable storage */
  }
  curSlot = null;
}
function restoreSession(id) {
  const saved = readSession(id);
  if (!saved) return false;
  curSlot = id;
  sessionLastRaw = localStorage.getItem(slotKey(id));
  sessionConflict = false;
  try {
    CAL.t = saved.time;
    calUpdate();
    genWorld(saved.seed);
    applySeason(CAL.season);
    roadInit();
    if (worldSignature() !== saved.worldSignature) throw new Error('Saved world no longer matches this version');
    const s = unpackSession(saved.data);
    if (
      !s.st ||
      !s.cal ||
      !s.cam ||
      !Array.isArray(s.birds) ||
      !s.birds.length ||
      s.birds.length > 1000 ||
      !s.birds.every(b => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z)) ||
      !Number.isFinite(s.st.energy) ||
      !Number.isFinite(s.cal.t) ||
      !Array.isArray(s.animals) ||
      !Array.isArray(s.hawks)
    )
      throw new Error('Invalid game state');
    Object.assign(st, s.st);
    Object.assign(CAL, s.cal);
    Object.assign(cam, s.cam);
    birds = s.birds;
    L = birds[0];
    hawks = s.hawks;
    ANIMALS = s.animals;
    swarms = s.swarms;
    dflies = s.dflies;
    tmpSpots = s.tmpSpots;
    Object.assign(WILD, s.wild);
    Object.assign(LIFE, s.life);
    if (FEEDER && s.feeder) Object.assign(FEEDER, s.feeder);
    Object.assign(WEATHER, s.weather);
    Object.assign(RAIN, s.rain);
    Object.assign(WIND, s.wind);
    TRAIN = s.train;
    TRAFFIC = s.traffic;
    TRAIN_T = s.trainT;
    TRAFFIC_T = s.trafficT;
    T = s.T;
    WX = s.WX;
    muted = !!s.muted;
    for (const p of perches) p.occ = null;
    for (const b of birds) if (b.perch) b.perch.occ = b;
    calUpdate();
    growTick(0);
    landLabels();
    pointer.down = false;
    for (const k of Object.keys(keys)) delete keys[k];
    $('titleOv').hidden = true;
    $('waves').style.display = muted ? 'none' : '';
    $('muteBtn').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    initAudio();
    if (master) master.gain.value = muted ? 0 : 0.9;
    if (st.mode === 'won') yearWon();
    else {
      // straight back into flight, with a short calm for the flock to find its wings
      st.mode = 'play';
      st.grace = Math.max(st.grace, 6);
      $('pauseOv').hidden = true;
      pauseIcon(false);
      dashBtn.hidden = !coarse;
      syncHud();
    }
    return true;
  } catch {
    // Rebuild a clean title world if a stale or damaged snapshot cannot be restored.
    CAL.t = 0;
    CAL.year = 1;
    calUpdate();
    genWorld(newSeed());
    refreshInsects();
    resetWorld(14, START.x, START.y);
    landLabels();
    st.mode = 'title';
    syncHud();
    curSlot = null;
    sessionLastRaw = null;
    showTitle('saves');
    $('saveNote').textContent =
      'That saved flight could not be restored safely. It is still stored; you can delete it here.';
    return false;
  }
}
function sessionTick(dt) {
  if (st.mode !== 'play') return;
  sessionClock += dt;
  if (sessionClock >= 5) {
    sessionClock = 0;
    saveSession();
  }
}
/* ---------- title screen: saved flights and the land to start on ---------- */
// the title card shows one of two views: the saved flights, or the land to start a new flight on
// (Take off or Reroll). With nothing saved the land is all there is.
function showTitle(view) {
  const rows = listSlots();
  if (!rows.length) view = 'land';
  $('titleCard').dataset.view = view;
  $('titleOv').hidden = false;
  if (view === 'saves') renderSlots(rows);
  $('landBackBtn').hidden = !rows.length;
  $('startBtn').textContent = 'Take off';
  const full = rows.length >= MAX_SLOTS;
  $('landNote').textContent = full ? 'All save slots are used: taking off replaces the oldest flight.' : '';
  (
    $(view === 'saves' ? (rows[0] && rows[0].ok ? 'continueBtn' : 'newFlightBtn') : 'startBtn') || $('startBtn')
  ).focus();
}
function renderSlots(rows) {
  const list = $('slotList');
  list.textContent = '';
  rows.forEach((r, i) => {
    const row = document.createElement('div'),
      go = document.createElement('button'),
      del = document.createElement('button'),
      title = document.createElement('span'),
      info = document.createElement('small');
    row.className = 'slot';
    go.className = 'btn slot-go' + (i === 0 && r.ok ? ' main' : '');
    if (i === 0 && r.ok) go.id = 'continueBtn';
    title.textContent = r.ok
      ? i === 0
        ? 'Continue flight'
        : summaryText(r.summary) || 'saved flight'
      : 'older flight';
    info.textContent = r.ok
      ? [i === 0 ? summaryText(r.summary) : '', r.summary && r.summary.land, agoText(r.updated)]
          .filter(Boolean)
          .join(' · ')
      : "can't be restored after this update";
    if (i === 0 && r.ok) info.id = 'continueInfo';
    go.append(title, info);
    go.disabled = !r.ok;
    go.onclick = () => restoreSession(r.id);
    del.className = 'btn link slot-del';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Delete this saved flight');
    del.onclick = () => {
      if (!del.classList.contains('sure')) {
        del.classList.add('sure');
        del.textContent = 'delete?';
        setTimeout(() => {
          del.classList.remove('sure');
          del.textContent = '×';
        }, 3000);
        return;
      }
      deleteSlot(r.id);
      showTitle('saves');
    };
    row.append(go, del);
    list.append(row);
  });
}
function initSession() {
  let view = 'saves';
  try {
    if (sessionStorage.getItem('flokk-view') === 'land') view = 'land';
    sessionStorage.removeItem('flokk-view');
  } catch {
    /* no session storage: the saves view it is */
  }
  if (listSlots().some(r => !r.ok))
    $('saveNote').textContent = 'An older saved flight cannot be restored after this update.';
  showTitle(view);
  $('newFlightBtn').onclick = () => showTitle('land');
  $('landBackBtn').onclick = () => showTitle('saves');
  window.addEventListener('pagehide', saveSession);
  window.addEventListener('storage', e => {
    if (!e.key || !(e.key.startsWith(SLOT_PREFIX) || e.key === 'flokk-session-v1')) return;
    if (
      curSlot &&
      e.key === sessionKey() &&
      e.newValue !== sessionLastRaw &&
      ['play', 'pause', 'won'].includes(st.mode)
    )
      sessionChangedElsewhere();
    else if (st.mode === 'title' && !$('titleOv').hidden) showTitle($('titleCard').dataset.view);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveSession();
  });
}
