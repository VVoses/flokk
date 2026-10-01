/* Local, versioned session snapshots. Static world objects are rebuilt from the seed;
   graph references preserve perches, herd relationships, prey, and ongoing journeys. */
'use strict';
const SESSION_KEY = 'flokk-session-v1',
  SESSION_VERSION = 2,
  SESSION_MAX_BYTES = 12000000;
let sessionClock = 0,
  sessionLastRaw = null,
  sessionConflict = false;
function sessionRegistry() {
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
  return { values, ids };
}
// References in the snapshot point into sessionRegistry by index. Record the generated world's
// geometry in that same order so a later world-generator change cannot silently remap them.
function worldSignature() {
  const { values } = sessionRegistry(),
    keys = ['x', 'y', 'cx', 'cy', 'z', 'h', 'w', 'r', 'lw', 'lh', 'len', 'dep', 'ang', 'type', 'kind', 'tt', 't'],
    signature = values.map(v => {
      if (Array.isArray(v)) return v;
      const out = {};
      for (const key of keys) if (typeof v[key] === 'number' || typeof v[key] === 'string') out[key] = v[key];
      if (v.poly) out.poly = v.poly;
      return out;
    });
  const raw = JSON.stringify(signature);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
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
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw || raw.length > SESSION_MAX_BYTES) return null;
    const s = JSON.parse(raw);
    return s.version === SESSION_VERSION &&
      typeof s.worldSignature === 'string' &&
      Number.isInteger(s.seed) &&
      Number.isFinite(s.time) &&
      s.time >= 0 &&
      s.data
      ? s
      : null;
  } catch {
    return null;
  }
}
function hasStoredSession() {
  try {
    return !!localStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }
}
function saveSession() {
  if (!['play', 'pause', 'won'].includes(st.mode) || !birds.length || sessionConflict) return;
  try {
    if (localStorage.getItem(SESSION_KEY) !== sessionLastRaw) return sessionChangedElsewhere();
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
      data
    });
    if (raw.length > SESSION_MAX_BYTES) throw new Error('Save exceeds storage limit');
    localStorage.setItem(SESSION_KEY, raw);
    sessionLastRaw = raw;
    sessionWarning('');
  } catch (error) {
    sessionWarning('This flight could not be saved. Check available browser storage.');
    console.warn('Flokk session save failed:', error);
  }
}
function clearSession() {
  try {
    if (localStorage.getItem(SESSION_KEY) !== sessionLastRaw) return sessionChangedElsewhere();
    localStorage.removeItem(SESSION_KEY);
    sessionLastRaw = null;
    sessionConflict = false;
    sessionWarning('');
  } catch {
    /* unavailable storage */
  }
  const button = $('continueBtn');
  if (button) button.hidden = true;
}
function restoreSession() {
  const saved = readSession();
  if (!saved) return false;
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
    else pause();
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
    $('continueBtn').hidden = true;
    $('saveNote').textContent =
      'That saved flight could not be restored safely. It is still stored; starting a new flight will replace it.';
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
function initSession() {
  try {
    sessionLastRaw = localStorage.getItem(SESSION_KEY);
    if (sessionLastRaw && !readSession())
      $('saveNote').textContent = 'An older saved flight cannot be restored safely after this world update.';
  } catch {
    sessionLastRaw = null;
  }
  const hasSession = !!readSession(),
    hasStored = hasStoredSession();
  $('continueBtn').hidden = !hasSession;
  $('startBtn').textContent = hasStored ? 'Start new flight' : 'Take off';
  $('startBtn').classList.toggle('danger', hasStored);
  $('startBtn').title = '';
  $('continueBtn').onclick = restoreSession;
  window.addEventListener('pagehide', saveSession);
  window.addEventListener('storage', e => {
    if (e.key === SESSION_KEY && e.newValue !== sessionLastRaw && ['play', 'pause', 'won'].includes(st.mode))
      sessionChangedElsewhere();
    else if (e.key === SESSION_KEY && st.mode === 'title') {
      sessionLastRaw = e.newValue;
      const available = !!readSession(),
        stored = !!e.newValue;
      $('continueBtn').hidden = !available;
      $('startBtn').textContent = stored ? 'Start new flight' : 'Take off';
      $('startBtn').classList.toggle('danger', stored);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveSession();
  });
}
