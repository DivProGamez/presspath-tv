'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const metrics = require('../../web/js/core/metrics.js');

const ev = (t, a, from, to, r) => ({ t, a, from, to, r });

test('counts every accepted input as a press, split by kind', () => {
  const m = metrics.compute([
    ev(0, 'right', 'a', 'b', 'move'), ev(100, 'ok', 'b', null, 'select'),
    ev(200, 'left', 'x', null, 'edge'), ev(300, 'back', 'x', null, 'back')
  ], 300);
  assert.equal(m.presses, 4);
  assert.equal(m.directional, 2);
  assert.equal(m.ok, 1);
  assert.equal(m.back, 1);
});

test('edge miss = direction press with no target', () => {
  const m = metrics.compute([ev(0, 'left', 'a', null, 'edge'), ev(10, 'left', 'a', null, 'edge'), ev(20, 'right', 'a', 'b', 'move')], 20);
  assert.equal(m.edgeMisses, 2);
});

test('backtrack = immediate reversal A->B->A, or a Back press', () => {
  const m = metrics.compute([
    ev(0, 'right', 'a', 'b', 'move'), ev(1, 'left', 'b', 'a', 'move'), // reversal
    ev(2, 'down', 'a', 'c', 'move'), ev(3, 'right', 'c', 'd', 'move'), // no reversal
    ev(4, 'back', 'd', null, 'back')
  ], 4);
  assert.equal(m.backtracks, 2);
});

test('a selection breaks reversal detection across screens', () => {
  const m = metrics.compute([ev(0, 'right', 'a', 'b', 'move'), ev(1, 'ok', 'b', null, 'select'), ev(2, 'left', 'b', 'a', 'move')], 2);
  assert.equal(m.backtracks, 0);
});

test('edge misses in between do not hide a reversal', () => {
  const m = metrics.compute([ev(0, 'right', 'a', 'b', 'move'), ev(1, 'right', 'b', null, 'edge'), ev(2, 'left', 'b', 'a', 'move')], 2);
  assert.equal(m.backtracks, 1);
  assert.equal(m.edgeMisses, 1);
});

test('seconds are rounded to 0.1 s from the first input', () => {
  assert.equal(metrics.compute([ev(0, 'ok', 'a', null, 'select')], 4260).seconds, 4.3);
  assert.equal(metrics.compute([], 0).seconds, 0);
});

test('edgeByTarget groups edge misses by focused element', () => {
  const out = metrics.edgeByTarget([ev(0, 'left', 'a', null, 'edge'), ev(1, 'up', 'a', null, 'edge'), ev(2, 'up', 'b', null, 'edge'), ev(3, 'right', 'a', 'b', 'move')]);
  assert.deepEqual(out, { a: 2, b: 1 });
});
