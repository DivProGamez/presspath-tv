'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const spatial = require('../../web/js/core/spatial.js');
const memory = require('../../web/js/core/memory.js');
const store = require('../../web/js/core/store.js');
const decks = require('../../web/js/core/decks.js');

const R = (id, left, top, width, height) => ({ id, rect: spatial.rectOf({ left, top, width, height }, id) });
// 2 x 2 grid plus a nav item far up-left.
const grid = [R('a', 0, 100, 100, 100), R('b', 150, 100, 100, 100), R('c', 0, 250, 100, 100), R('d', 150, 250, 100, 100)];

test('cardinal moves in a grid', () => {
  const a = grid[0].rect;
  assert.equal(spatial.findNext(a, grid, 'right'), 'b');
  assert.equal(spatial.findNext(a, grid, 'down'), 'c');
  assert.equal(spatial.findNext(grid[3].rect, grid, 'up'), 'b');
  assert.equal(spatial.findNext(grid[3].rect, grid, 'left'), 'c');
});

test('no target in a direction is an edge (null)', () => {
  assert.equal(spatial.findNext(grid[0].rect, grid, 'left'), null);
  assert.equal(spatial.findNext(grid[0].rect, grid, 'up'), null);
});

test('in-beam candidates beat closer diagonal ones', () => {
  const cands = [R('cur', 0, 0, 100, 100), R('beam', 400, 0, 100, 100), R('diag', 120, 150, 100, 100)];
  assert.equal(spatial.findNext(cands[0].rect, cands, 'right'), 'beam');
});

test('45° cone blocks far diagonal jumps sideways', () => {
  const cands = [R('cur', 0, 600, 200, 80), R('nav', 300, 0, 100, 60)];
  assert.equal(spatial.findNext(cands[0].rect, cands, 'right'), null);
  assert.equal(spatial.findNext(cands[0].rect, cands, 'up'), 'nav');
});

test('up/down fall back to the nearest element when nothing is in the beam', () => {
  // header button far right, content button lower-left: both directions must connect
  const cands = [R('hdr', 1100, 50, 140, 60), R('btn', 1586, 205, 236, 56), R('row', 1180, 433, 196, 56)];
  assert.equal(spatial.findNext(cands[1].rect, cands, 'up'), 'hdr');
  assert.equal(spatial.findNext(cands[0].rect, cands, 'down'), 'row', 'in-beam row wins over the far-right button');
  const far = [R('a', 0, 600, 200, 80), R('b', 260, 0, 100, 60)];
  assert.equal(spatial.findNext(far[0].rect, far, 'right'), null, 'sideways stays inside the 45° cone');
  assert.equal(spatial.findNext(far[0].rect, far, 'up'), 'b', 'vertical falls back to the nearest element');
});

test('availableDirections lists only real targets', () => {
  assert.deepEqual(spatial.availableDirections(grid[0].rect, grid), ['down', 'right']);
});

test('memory: 12 cards, six pairs, seeded shuffle is deterministic', () => {
  const g1 = memory.newGame(42), g2 = memory.newGame(42);
  assert.equal(g1.cards.length, 12);
  assert.deepEqual(g1.cards.map((c) => c.sym), g2.cards.map((c) => c.sym));
  memory.SYMBOLS.forEach((s) => assert.equal(g1.cards.filter((c) => c.sym === s).length, 2));
});

test('memory: match, mismatch, ignored flips and completion', () => {
  const g = memory.newGame(7);
  const idx = (sym) => g.cards.filter((c) => c.sym === sym).map((c) => c.i);
  const [s0, s1] = idx('star'), [p0] = idx('planet');
  assert.equal(memory.flip(g, s0), 'flip');
  assert.equal(memory.flip(g, s0), 'ignored', 'same card again');
  assert.equal(memory.flip(g, p0), 'mismatch');
  assert.equal(g.moves, 1);
  memory.resolve(g);
  assert.equal(g.cards[s0].up, false);
  assert.equal(memory.flip(g, s0), 'flip');
  assert.equal(memory.flip(g, s1), 'match');
  assert.equal(g.pairs, 1);
  let last;
  memory.SYMBOLS.filter((s) => s !== 'star').forEach((s) => { const [x, y] = idx(s); memory.flip(g, x); last = memory.flip(g, y); });
  assert.equal(last, 'complete');
  assert.equal(g.complete, true);
  assert.equal(g.pairs, 6);
  assert.equal(g.moves, 7);
  assert.equal(memory.flip(g, 0), 'ignored');
});

test('memory: flipping during a pending mismatch hides the pair first', () => {
  const g = memory.newGame(3);
  const a = g.cards.find((c) => c.sym === 'star').i, b = g.cards.find((c) => c.sym === 'fish').i;
  const c = g.cards.find((x) => x.sym === 'leaf').i;
  memory.flip(g, a); memory.flip(g, b);
  assert.equal(g.pending, true);
  assert.equal(memory.flip(g, c), 'flip');
  assert.equal(g.cards[a].up, false);
  assert.equal(g.cards[b].up, false);
});

function memStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m };
}

test('store: round trip, corruption recovery and clear', () => {
  const st = memStorage();
  const s = store.defaultState();
  s.prefs.highContrast = true;
  s.runs.push({ id: 'r1', n: 1, taskId: 'science', phase: 'baseline', presses: 7, seconds: 4 });
  store.save(st, s);
  const back = store.load(st);
  assert.equal(back.recovered, false);
  assert.equal(back.state.prefs.highContrast, true);
  assert.equal(back.state.runs.length, 1);
  st.setItem(store.KEY, '{broken');
  const bad = store.load(st);
  assert.equal(bad.recovered, true);
  assert.equal(bad.state.runs.length, 0);
  assert.equal(st.getItem(store.KEY + '.corrupt'), '{broken');
  store.clear(st);
  assert.equal(st.getItem(store.KEY), null);
  assert.equal(store.load(st).state.prefs.highContrast, false);
});

test('store: malformed records are dropped, key name is stable', () => {
  assert.equal(store.KEY, 'presspath.v1');
  const s = store.sanitize({ v: 1, prefs: { largeText: 'yes' }, runs: [{ id: 'r1' }, { id: 'r2', taskId: 't', phase: 'baseline', presses: 1, seconds: 1 }], adaptations: [{ id: 'a1', rule: 'R9', taskId: 't' }] });
  assert.equal(s.prefs.largeText, false);
  assert.equal(s.runs.length, 1);
  assert.equal(s.adaptations.length, 0);
  assert.equal(store.sanitize({ v: 99 }), null);
});

test('decks: three decks of ten cards with question and answer', () => {
  assert.deepEqual(decks.DECKS.map((d) => d.id), ['letters', 'numbers', 'science']);
  decks.DECKS.forEach((d) => {
    assert.equal(d.cards.length, 10);
    d.cards.forEach((c) => assert.ok(c.q && c.a, d.id));
  });
});
