// Exercise the actual synthesizer with a fake audio clock; unrelated callers share its cooldown.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8');
const hoot = source.slice(source.indexOf('function owlHoot('), source.indexOf('// the small noises of stock'));
let nodes = 0;
const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => {
  nodes++;
  return {
    gain: param(),
    frequency: param(),
    Q: param(),
    connect(n) {
      return n;
    },
    start() {},
    stop() {}
  };
};
const ctx = vm.createContext({
  ac: { currentTime: 0, createGain: node, createOscillator: node, createBiquadFilter: node },
  muted: false,
  owlNextCall: 0,
  amb: {},
  master: node(),
  worldBus: null,
  verb: node(),
  rr: (a, b) => (a + b) / 2,
  wob: () => 1,
  spatial: () => ({ d: 0, pan: 0 }),
  panned: n => n
});
vm.runInContext(hoot, ctx);
const call = code => vm.runInContext(code, ctx);
call('owlHoot(.025)');
const first = nodes;
assert(first > 2, 'first owl call schedules audio');
call('owlHoot(.16, 100, 100); owlHoot(.11, 100, 100)');
assert.equal(nodes, first, 'hunting and warning calls cannot stack on the ambient call');
ctx.ac.currentTime = 23.9;
call('owlHoot(.16, 100, 100)');
assert.equal(nodes, first, 'quiet interval is at least 24 seconds');
ctx.ac.currentTime = 40;
call('owlHoot(.16, 100, 100)');
assert(nodes > first, 'a later owl call is still audible');
const second = nodes;
ctx.ac.currentTime = 100;
ctx.muted = true;
call('owlHoot(.025)');
assert.equal(nodes, second, 'muted calls schedule no audio');
ctx.muted = false;
call('owlHoot(.025)');
assert(nodes > second, 'muted attempts do not consume the cooldown');
console.log('owl audio cooldown checks passed');
