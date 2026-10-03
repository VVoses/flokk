/* Flokk - main.js
   HUD refresh, boot and the frame loop.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
let hudT = 0;
function hud(dt) {
  hudT -= dt;
  ui.stBar.style.width = (st.stamina * 100).toFixed(0) + '%';
  if (hudT > 0) return;
  hudT = 0.1;
  $('yearMark').style.left =
    ((((CAL.day % YEAR_DAYS) + ((CAL.hour - START_HOUR + 24) % 24) / 24) / YEAR_DAYS) * 100).toFixed(1) + '%';
  $('calIcon').textContent = LIGHT.night > 0.5 ? '☾' : '☀';
  const en = st.energy ?? 1;
  ui.enBar.style.width = (en * 100).toFixed(0) + '%';
  ui.enBar.style.background = en < 0.25 ? 'var(--hawk)' : en < 0.5 ? 'var(--energy-caution)' : 'var(--energy-safe)';
  ui.count.textContent = birds.length;
  const need = needFor(birds.length);
  ui.foodBar.style.width = (Math.min(1, st.food / need) * 100).toFixed(0) + '%';
  // a full bar that waits on a hungry flock is dimmed, so it does not read as a stuck bird
  ui.foodBar.style.opacity = st.energy <= 0.5 && st.food >= need ? 0.4 : 1;
  let cls = '',
    txt = 'Flying';
  let dive = false,
    stalk = false,
    hunting = 0,
    owl = false,
    hidden = 0;
  for (const h of hawks) {
    if (h.state === 'dive') dive = true;
    if (h.state === 'stalk' || h.state === 'hover') stalk = true;
    if (h.state !== 'leave' && h.state !== 'carry') hunting++;
    if (h.kind === 'owl') owl = true;
  }
  for (const b of birds) if (coveredNow(b)) hidden++;
  // one flying off (with or without a catch) is no longer a threat, however long it stays in sight
  const pk = owl ? 'owl' : 'hawk',
    Pk = pk === 'owl' ? 'Owl' : 'Hawk';
  if (dive) {
    cls = 'danger';
    txt = `${Pk} diving!`;
  } else if (stalk) {
    cls = 'danger';
    txt = `A ${pk} has spotted you`;
  } else if (st.settled && hidden === birds.length && birds.length) {
    txt = 'Hidden in the trees';
  } else if (st.settled) {
    cls = hunting ? 'warn' : '';
    txt = hidden ? `Resting · ${hidden} hidden` : 'Resting in the open';
  } else if (hunting) {
    cls = 'warn';
    txt = hunting === 1 ? `A ${pk} is circling` : `${hunting} ${pk}s circling`;
  } else if (st.mode === 'play' && st.grace > 0) txt = 'Flying · the sky is calm';
  ui.count.classList.toggle('danger', cls === 'danger');
  ui.count.classList.toggle('safe', cls !== 'danger' && birds.length > 0 && hidden === birds.length);
  // a second hunger cue beyond the bar colour: the flock count itself turns amber, then pulses when starving
  ui.count.classList.toggle('hungry', cls !== 'danger' && en < 0.5);
  ui.count.classList.toggle('starving', cls !== 'danger' && en < 0.25);
  const hunger = en < 0.25 ? 'starving' : en < 0.5 ? 'hungry' : 'well fed';
  ui.count.setAttribute(
    'aria-label',
    `${birds.length} birds, ${hunger}. ${txt}. ${SEASONS[SEASON]}, day ${(CAL.day % YEAR_DAYS) + 1} of ${YEAR_DAYS}`
  );
}

/* ---------- loop ---------- */
CAL.t = (3 / 24) * DAY_LEN;
calUpdate();
genWorld(newSeed());
refreshInsects();
landLabels();
resetWorld(14, START.x, START.y - 150);
cam.x = L.x;
cam.py = PY(L.y, L.z * 0.7);
cam.z = clamp(Math.min(vw, vh) / 760, 0.72, 1.15);
let last = performance.now(),
  lastDt = 0.016;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.033);
  last = now;
  lastDt = dt;
  if (st.mode === 'play' || st.mode === 'title' || st.overT > 0) update(dt);
  sessionTick(dt);
  audioTick(dt);
  render();
  hud(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
initSession();
(readSession() ? $('continueBtn') : $('startBtn')).focus();
