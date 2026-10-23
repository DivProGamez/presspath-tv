/* PressPath TV — before/after comparison from stored runs (pure).
 * Before = median of baseline runs, After = median of runs recorded with an
 * applied adaptation. If either side has no runs, the comparison is N/A. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).compare = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIELDS = ['presses', 'backtracks', 'edgeMisses', 'seconds'];

  function median(values) {
    if (!values.length) return null;
    var a = values.slice().sort(function (x, y) { return x - y; });
    var mid = Math.floor(a.length / 2);
    var v = a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    return Math.round(v * 10) / 10;
  }

  function summarize(runs) {
    var out = { n: runs.length };
    FIELDS.forEach(function (f) { out[f] = median(runs.map(function (r) { return r[f]; })); });
    return out;
  }

  function runsFor(state, taskId, phase) {
    return state.runs.filter(function (r) { return r.taskId === taskId && (!phase || r.phase === phase); });
  }

  function compareTask(state, taskId) {
    var base = runsFor(state, taskId, 'baseline');
    var adapt = runsFor(state, taskId, 'adaptive');
    if (!base.length || !adapt.length) {
      return {
        available: false, taskId: taskId,
        baselineN: base.length, adaptiveN: adapt.length,
        before: base.length ? summarize(base) : null,
        after: adapt.length ? summarize(adapt) : null
      };
    }
    var before = summarize(base), after = summarize(adapt);
    var delta = {}, pct = {};
    FIELDS.forEach(function (f) {
      delta[f] = Math.round((after[f] - before[f]) * 10) / 10;
      pct[f] = before[f] > 0 ? Math.round((delta[f] / before[f]) * 100) : null;
    });
    var ids = {};
    adapt.forEach(function (r) { (r.adaptationIds || []).forEach(function (id) { ids[id] = true; }); });
    var adaptations = state.adaptations.filter(function (a) { return ids[a.id]; });
    return {
      available: true, taskId: taskId,
      baselineN: base.length, adaptiveN: adapt.length,
      before: before, after: after, delta: delta, pct: pct,
      adaptations: adaptations,
      baselineRunIds: base.map(function (r) { return r.id; }),
      adaptiveRunIds: adapt.map(function (r) { return r.id; })
    };
  }

  return { FIELDS: FIELDS, median: median, summarize: summarize, runsFor: runsFor, compareTask: compareTask };
});
