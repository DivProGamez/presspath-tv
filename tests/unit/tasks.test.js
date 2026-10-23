'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tasks = require('../../web/js/core/tasks.js');

test('there are exactly five guided tasks in the published order', () => {
  assert.deepEqual(tasks.TASKS.map((t) => t.id), ['memory', 'science', 'contrast', 'largetext', 'letters']);
  tasks.TASKS.forEach((t, i) => assert.equal(t.n, i + 1));
});

test('each task completes only on its own genuine app event', () => {
  const cases = {
    memory: [{ type: 'memory:flip' }, { type: 'cards:reveal', deck: 'science' }],
    science: [{ type: 'cards:reveal', deck: 'science' }, { type: 'cards:reveal', deck: 'letters' }],
    contrast: [{ type: 'pref:set', key: 'highContrast', value: true }, { type: 'pref:set', key: 'highContrast', value: false }],
    largetext: [{ type: 'pref:set', key: 'largeText', value: true }, { type: 'pref:set', key: 'highContrast', value: true }],
    letters: [{ type: 'cards:open', deck: 'letters' }, { type: 'cards:open', deck: 'numbers' }]
  };
  for (const [id, [yes, no]] of Object.entries(cases)) {
    const s = tasks.createSession({ taskId: id, phase: 'baseline', now: 0 });
    assert.equal(tasks.matches(s, yes), true, id + ' should complete');
    assert.equal(tasks.matches(s, no), false, id + ' should not complete');
  }
});

test('focus movement alone never completes a task', () => {
  const s = tasks.createSession({ taskId: 'science', phase: 'baseline', now: 0 });
  assert.equal(tasks.matches(s, { type: 'focus' }), false);
  assert.equal(tasks.matches(s, { type: 'cards:open', deck: 'science' }), false);
});

test('clock starts on the first input, not when the task is armed', () => {
  const s = tasks.createSession({ taskId: 'letters', phase: 'baseline', now: 1000 });
  tasks.record(s, { a: 'right', from: 'a', to: 'b', r: 'move' }, 5000, Date.UTC(2026, 0, 1));
  tasks.record(s, { a: 'ok', from: 'b', r: 'select' }, 7500, 0);
  const run = tasks.finish(s, 7500, 'r1', 1);
  assert.equal(run.seconds, 2.5);
  assert.equal(run.presses, 2);
  assert.equal(run.startedAt, new Date(Date.UTC(2026, 0, 1)).toISOString());
  assert.equal(run.phase, 'baseline');
});

test('nothing is recorded after the session finishes', () => {
  const s = tasks.createSession({ taskId: 'memory', phase: 'adaptive', adaptationIds: ['a1'], now: 0 });
  tasks.record(s, { a: 'ok', from: 'x', r: 'select' }, 10);
  const run = tasks.finish(s, 10, 'r2', 2);
  assert.equal(tasks.record(s, { a: 'left', from: 'x', r: 'edge' }, 20), false);
  assert.equal(run.presses, 1);
  assert.deepEqual(run.adaptationIds, ['a1']);
  assert.equal(tasks.matches(s, { type: 'memory:flip' }), false);
});

test('run stores per-element edge misses for R2', () => {
  const s = tasks.createSession({ taskId: 'memory', phase: 'baseline', now: 0 });
  ['left', 'left', 'up'].forEach((a, i) => tasks.record(s, { a, from: 'home-tile-lab', r: 'edge' }, i));
  const run = tasks.finish(s, 3, 'r3', 3);
  assert.deepEqual(run.edgeByTarget, { 'home-tile-lab': 3 });
  assert.equal(run.edgeMisses, 3);
});

test('every task defines a shortcut destination', () => {
  tasks.TASKS.forEach((t) => {
    assert.ok(t.shortcut && t.shortcut.screen && t.shortcut.focus, t.id);
  });
});
