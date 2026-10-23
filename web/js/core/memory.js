/* PressPath TV — Memory Pairs game logic (pure). 4 x 3 board, six pairs.
 * Tracks pairs found and moves (one move = turning the second card of an attempt).
 * There is deliberately no timer, accuracy percentage or score. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).memory = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SYMBOLS = ['star', 'planet', 'heart', 'rocket', 'leaf', 'fish'];
  var COLS = 4, ROWS = 3;

  // Small deterministic PRNG so tests can fix the shuffle.
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function newGame(seed) {
    var deck = SYMBOLS.concat(SYMBOLS);
    var rand = rng(seed);
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return {
      cards: deck.map(function (sym, i) { return { i: i, sym: sym, up: false, matched: false }; }),
      open: [],        // indexes currently face-up and unmatched
      pending: false,  // two unmatched cards are showing and must be hidden
      moves: 0,
      pairs: 0,
      complete: false
    };
  }

  // Hide a mismatched pair. Safe to call at any time.
  function resolve(g) {
    if (!g.pending) return false;
    g.open.forEach(function (i) { g.cards[i].up = false; });
    g.open = [];
    g.pending = false;
    return true;
  }

  // Returns 'flip' | 'match' | 'mismatch' | 'complete' | 'ignored'.
  function flip(g, i) {
    if (g.complete) return 'ignored';
    var c = g.cards[i];
    if (!c) return 'ignored';
    if (g.pending) resolve(g);
    if (c.up || c.matched) return 'ignored';
    c.up = true;
    g.open.push(i);
    if (g.open.length < 2) return 'flip';
    g.moves += 1;
    var a = g.cards[g.open[0]], b = g.cards[g.open[1]];
    if (a.sym === b.sym) {
      a.matched = b.matched = true;
      g.open = [];
      g.pairs += 1;
      if (g.pairs === SYMBOLS.length) { g.complete = true; return 'complete'; }
      return 'match';
    }
    g.pending = true;
    return 'mismatch';
  }

  return { SYMBOLS: SYMBOLS, COLS: COLS, ROWS: ROWS, newGame: newGame, flip: flip, resolve: resolve };
});
