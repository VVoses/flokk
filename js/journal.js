/* Flokk - journal.js
   A quiet field journal of firsts, kept across flights: the first elk at the forest edge, the first
   fieldfare flock, the aurora. Nothing is shown in play but one soft line when something new is seen.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const seenAnimal = k => () => ANIMALS.some(a => a.k === k && !a.hide && !a.dying && inView(a.x, a.y, -40));
const seenWild = sp => () => WILD.flocks.some(F => F.sp === sp && inView(F.x, F.y, -40));
const seenHawk = kind => () => hawks.some(h => h.kind === kind && inView(h.x, h.y, -40));
const JOURNAL = [
  ['elk', 'elk', seenAnimal('moose')],
  ['deer', 'roe deer', seenAnimal('deer')],
  ['fox', 'fox', seenAnimal('fox')],
  ['hare', 'hare', seenAnimal('hare')],
  ['heron', 'heron', seenAnimal('heron')],
  ['goose', 'geese', seenAnimal('goose')],
  ['gull', 'gulls', seenAnimal('gull')],
  ['tractor', 'tractor in the field', seenAnimal('tractor')],
  ['starling', 'starlings', seenWild('starling')],
  ['linnet', 'linnets', seenWild('linnet')],
  ['fieldfare', 'fieldfares', seenWild('fieldfare')],
  ['bunting', 'snow buntings', seenWild('bunting')],
  ['hawk', 'hawk', seenHawk('hawk')],
  ['owl', 'owl', seenHawk('owl')],
  ['eagle', 'white-tailed eagle', seenHawk('eagle')],
  ['train', 'train', () => !!TRAIN && trainNear(L.x, L.y, 450)],
  ['aurora', 'northern lights', () => LIGHT.aurora > 0.5],
  ['snow', 'first snow', () => LIGHT.snow > 0.3],
  ['fog', 'fog', () => seeK() < 0.55],
  ['storm', 'winter storm', () => WEATHER.storm > 0.6],
  ['squall', 'summer thunderstorm', () => WEATHER.squall > 0.5]
];
const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];
let JOURNAL_SEEN = {};
try {
  JOURNAL_SEEN = JSON.parse(localStorage.getItem('flokk-journal') || '{}');
} catch (e) {
  JOURNAL_SEEN = {};
}
let journalT = 0;
function journalTick(dt) {
  if (st.mode !== 'play' || !L) return;
  journalT -= dt;
  if (journalT > 0) return;
  journalT = 0.7;
  for (const [key, label, test] of JOURNAL) {
    if (JOURNAL_SEEN[key] || !test()) continue;
    JOURNAL_SEEN[key] = SEASON;
    try {
      localStorage.setItem('flokk-journal', JSON.stringify(JOURNAL_SEEN));
    } catch (e) {
      /* storage unavailable: it is only noted for this visit */
    }
    showHint(`in the journal: ${label}`);
    return; // one at a time
  }
}
function journalText() {
  const n = JOURNAL.filter(([k]) => JOURNAL_SEEN[k] != null).length;
  return { n, total: JOURNAL.length };
}
