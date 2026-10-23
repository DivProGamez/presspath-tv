'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../../web/js/core/store.js');
const rules = require('../../web/js/core/rules.js');
const compare = require('../../web/js/core/compare.js');

function run(id, taskId, phase, presses, extra = {}) {
  return Object.assign({ id, n: Number(id.slice(1)), taskId, phase, presses, backtracks: 0, edgeMisses: 0, seconds: 5, edgeByTarget: {}, adaptationIds: [], startedAt: '2026-10-23T10:00:00.000Z' }, extra);
}

test('R1 needs >=5 presses in >=2 baseline runs', () => {
  const s = store.defaultState();
  s.runs.push(run('r1', 'science', 'baseline', 7));
  assert.equal(rules.evaluateR1(s, 'science'), null);
  s.runs.push(run('r2', 'science', 'baseline', 4));
  assert.equal(rules.evaluateR1(s, 'science'), null, 'a 4-press run does not count');
  s.runs.push(run('r3', 'science', 'baseline', 5));
  const r = rules.evaluateR1(s, 'science');
  assert.ok(r);
  assert.deepEqual(r.evidence.map((e) => e.runId), ['r1', 'r3']);
});

test('R1 ignores adaptive runs and other tasks', () => {
  const s = store.defaultState();
  s.runs.push(run('r1', 'science', 'adaptive', 9), run('r2', 'science', 'adaptive', 9), run('r3', 'letters', 'baseline', 9));
  assert.equal(rules.evaluateR1(s, 'science'), null);
});

test('R2 needs >=3 edge misses on the same element', () => {
  const s = store.defaultState();
  s.runs.push(run('r1', 'memory', 'baseline', 6, { edgeByTarget: { 'home-tile-lab': 2, 'nav-home': 1 } }));
  assert.equal(rules.evaluateR2(s, 'memory'), null);
  s.runs.push(run('r2', 'memory', 'baseline', 4, { edgeByTarget: { 'home-tile-lab': 1 } }));
  const r = rules.evaluateR2(s, 'memory');
  assert.equal(r.targetId, 'home-tile-lab');
  assert.equal(r.total, 3);
  assert.equal(r.evidence.length, 2);
});

test('apply then undo: suggestion returns, runs are never modified', () => {
  const s = store.defaultState();
  s.runs.push(run('r1', 'science', 'baseline', 7), run('r2', 'science', 'baseline', 6));
  const before = JSON.stringify(s.runs);
  const [sug] = rules.suggestions(s, ['science']);
  assert.equal(sug.rule, 'R1');
  const a = rules.apply(s, sug, '2026-10-23T10:00:00Z');
  assert.equal(a.id, 'a1');
  assert.equal(rules.active(s, 'science').length, 1);
  assert.equal(rules.suggestions(s, ['science']).length, 0, 'applied suggestion is not offered again');
  assert.equal(rules.apply(s, sug, 'x'), null, 'no duplicate adaptation');
  rules.undo(s, 'a1', '2026-10-23T11:00:00Z');
  assert.equal(rules.active(s, 'science').length, 0);
  assert.equal(s.adaptations[0].undoneAt, '2026-10-23T11:00:00Z', 'history kept');
  assert.equal(rules.suggestions(s, ['science']).length, 1);
  assert.equal(JSON.stringify(s.runs), before);
});

test('median handles odd, even and empty sets', () => {
  assert.equal(compare.median([7, 3, 5]), 5);
  assert.equal(compare.median([6, 7]), 6.5);
  assert.equal(compare.median([]), null);
});

test('Before/After is N/A without both baseline and adaptive runs', () => {
  const s = store.defaultState();
  assert.equal(compare.compareTask(s, 'science').available, false);
  s.runs.push(run('r1', 'science', 'baseline', 7));
  const c = compare.compareTask(s, 'science');
  assert.equal(c.available, false);
  assert.equal(c.baselineN, 1);
  assert.equal(c.after, null);
});

test('Before/After computes medians and signed differences', () => {
  const s = store.defaultState();
  s.runs.push(run('r1', 'science', 'baseline', 7, { seconds: 6.0, backtracks: 1 }), run('r2', 'science', 'baseline', 7, { seconds: 5.0 }));
  s.runs.push(run('r3', 'science', 'adaptive', 3, { seconds: 2.2, adaptationIds: ['a1'] }));
  s.adaptations.push({ id: 'a1', rule: 'R1', taskId: 'science', evidenceRunIds: ['r1', 'r2'], appliedAt: 'x', undoneAt: null });
  const c = compare.compareTask(s, 'science');
  assert.equal(c.available, true);
  assert.equal(c.before.presses, 7);
  assert.equal(c.after.presses, 3);
  assert.equal(c.delta.presses, -4);
  assert.equal(c.pct.presses, -57);
  assert.equal(c.before.backtracks, 0.5);
  assert.equal(c.delta.seconds, -3.3);
  assert.equal(c.adaptations[0].id, 'a1');
});

test('percentage is N/A (null) when the baseline value is zero', () => {
  const s = store.defaultState();
  s.runs.push(run('r1', 'memory', 'baseline', 3), run('r2', 'memory', 'adaptive', 3, { edgeMisses: 1 }));
  const c = compare.compareTask(s, 'memory');
  assert.equal(c.delta.edgeMisses, 1);
  assert.equal(c.pct.edgeMisses, null);
});
