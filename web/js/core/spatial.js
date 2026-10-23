/* PressPath TV — geometric D-pad focus resolution (pure).
 * Given the focused rectangle and candidate rectangles, pick the next target in a
 * direction. Candidates that overlap on the perpendicular axis ("in the beam") win.
 * For Left/Right, off-beam candidates are allowed only inside a 45° cone, which
 * prevents diagonal jumps between rows. No candidate at all = an edge miss (null). */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).spatial = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Small tolerance so a focused element scaled to 1.04 does not hide its neighbours.
  var TOL = 0.06;

  function inDirection(cur, c, dir) {
    var tw = Math.min(cur.width, c.width) * TOL, th = Math.min(cur.height, c.height) * TOL;
    switch (dir) {
      case 'right': return c.left >= cur.right - tw && c.left + c.width / 2 > cur.left + cur.width / 2;
      case 'left': return c.right <= cur.left + tw && c.left + c.width / 2 < cur.left + cur.width / 2;
      case 'down': return c.top >= cur.bottom - th && c.top + c.height / 2 > cur.top + cur.height / 2;
      case 'up': return c.bottom <= cur.top + th && c.top + c.height / 2 < cur.top + cur.height / 2;
    }
    return false;
  }

  function gaps(cur, c, dir) {
    var horiz = dir === 'left' || dir === 'right';
    var primary, overlap, perpGap, perpCenter;
    if (horiz) {
      primary = dir === 'right' ? c.left - cur.right : cur.left - c.right;
      overlap = Math.min(cur.bottom, c.bottom) - Math.max(cur.top, c.top);
      perpGap = Math.max(0, -overlap);
      perpCenter = Math.abs((c.top + c.height / 2) - (cur.top + cur.height / 2));
    } else {
      primary = dir === 'down' ? c.top - cur.bottom : cur.top - c.bottom;
      overlap = Math.min(cur.right, c.right) - Math.max(cur.left, c.left);
      perpGap = Math.max(0, -overlap);
      perpCenter = Math.abs((c.left + c.width / 2) - (cur.left + cur.width / 2));
    }
    return { primary: Math.max(0, primary), inBeam: overlap > 0, perpGap: perpGap, perpCenter: perpCenter };
  }

  function findNext(cur, candidates, dir) {
    var best = null, bestScore = Infinity, bestBeam = false;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c.id === cur.id || !inDirection(cur, c.rect, dir)) continue;
      var g = gaps(cur, c.rect, dir);
      // Left/Right stay inside a 45° cone so focus never hops to another row diagonally.
      // Up/Down may fall back to the nearest element, so the header and content always connect.
      if (!g.inBeam && g.perpGap > g.primary && (dir === 'left' || dir === 'right')) continue;
      var score = g.inBeam ? g.primary + g.perpCenter * 0.25 : g.primary + g.perpGap * 2 + g.perpCenter * 0.5;
      // Beam candidates always beat off-beam ones.
      var better = false;
      if (g.inBeam && !bestBeam) better = true;
      else if (g.inBeam === bestBeam) {
        if (score < bestScore - 0.5) better = true;
        else if (Math.abs(score - bestScore) <= 0.5 && best) {
          var a = c.rect, b = best.rect;
          better = a.top < b.top || (a.top === b.top && (a.left < b.left || (a.left === b.left && c.id < best.id)));
        }
      }
      if (better) { best = c; bestScore = score; bestBeam = g.inBeam; }
    }
    return best ? best.id : null;
  }

  function rectOf(r, id) {
    return { id: id, left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height, width: r.width, height: r.height };
  }

  function availableDirections(cur, candidates) {
    return ['up', 'down', 'left', 'right'].filter(function (d) { return findNext(cur, candidates, d) !== null; });
  }

  return { findNext: findNext, availableDirections: availableDirections, rectOf: rectOf };
});
