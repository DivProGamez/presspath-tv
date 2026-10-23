/* PressPath TV — measurement rules (pure functions).
 *
 * An event is one accepted remote input recorded while a guided task is active:
 *   { t: ms since the task's first input, a: 'up'|'down'|'left'|'right'|'ok'|'back',
 *     from: focused element id, to: element id or null, r: 'move'|'edge'|'select'|'back' }
 *
 * Definitions (shown to the user in the Navigation Lab):
 *   presses      every accepted input: directions, OK and Back.
 *   directional  Up/Down/Left/Right inputs only.
 *   edgeMisses   directional inputs where no target exists in that direction (focus stays put).
 *   backtracks   (a) a move that returns focus to the element it just left (A -> B -> A), or
 *                (b) a Back press that returns to the previous screen or closes a panel.
 *   seconds      from the first accepted input to the input that completed the task.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).metrics = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIRS = { up: 1, down: 1, left: 1, right: 1 };

  function compute(events, endT) {
    var m = { presses: 0, directional: 0, ok: 0, back: 0, backtracks: 0, edgeMisses: 0, seconds: 0 };
    var lastMove = null;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      m.presses++;
      if (DIRS[e.a]) m.directional++;
      if (e.a === 'ok') m.ok++;
      if (e.a === 'back') m.back++;
      if (e.r === 'edge') {
        m.edgeMisses++;
      } else if (e.r === 'move') {
        if (lastMove && lastMove.from === e.to && lastMove.to === e.from) m.backtracks++;
        lastMove = e;
      } else if (e.r === 'back') {
        m.backtracks++;
        lastMove = null;
      } else {
        lastMove = null; // a selection changes context; reversals do not span it
      }
    }
    var end = typeof endT === 'number' ? endT : (events.length ? events[events.length - 1].t : 0);
    m.seconds = Math.round(Math.max(0, end) / 100) / 10;
    return m;
  }

  // Edge misses grouped by the element that had focus when the press hit the edge.
  function edgeByTarget(events) {
    var out = {};
    events.forEach(function (e) {
      if (e.r === 'edge' && e.from) out[e.from] = (out[e.from] || 0) + 1;
    });
    return out;
  }

  return { compute: compute, edgeByTarget: edgeByTarget };
});
