/* PressPath TV — the two published, deterministic adaptation rules (pure).
 *   R1  Home shortcut:     the task's destination needed >= 5 presses in >= 2 baseline runs.
 *   R2  Focus emphasis:    >= 3 edge misses on the same element across the task's baseline runs.
 * Rules only add a shortcut or strengthen one element's focus style. They never
 * reorder existing tiles, and every change can be undone. Runs are never edited. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).rules = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var R1_PRESSES = 5, R1_RUNS = 2, R2_EDGES = 3;

  function baselineRuns(state, taskId) {
    return state.runs.filter(function (r) { return r.taskId === taskId && r.phase === 'baseline'; });
  }

  function active(state, taskId) {
    return state.adaptations.filter(function (a) { return !a.undoneAt && (!taskId || a.taskId === taskId); });
  }

  function isApplied(state, s) {
    return active(state, s.taskId).some(function (a) {
      return a.rule === s.rule && (s.rule === 'R1' || a.targetId === s.targetId);
    });
  }

  function evaluateR1(state, taskId) {
    var runs = baselineRuns(state, taskId);
    var hits = runs.filter(function (r) { return r.presses >= R1_PRESSES; });
    if (hits.length < R1_RUNS) return null;
    return {
      rule: 'R1', taskId: taskId,
      threshold: '≥' + R1_PRESSES + ' presses in ≥' + R1_RUNS + ' baseline runs',
      evidence: hits.map(function (r) { return { runId: r.id, n: r.n, presses: r.presses, startedAt: r.startedAt }; }),
      baselineN: runs.length
    };
  }

  function evaluateR2(state, taskId) {
    var runs = baselineRuns(state, taskId);
    var totals = {}, perRun = {};
    runs.forEach(function (r) {
      var m = r.edgeByTarget || {};
      Object.keys(m).forEach(function (el) {
        totals[el] = (totals[el] || 0) + m[el];
        (perRun[el] = perRun[el] || []).push({ runId: r.id, n: r.n, count: m[el], startedAt: r.startedAt });
      });
    });
    var best = null;
    Object.keys(totals).sort().forEach(function (el) {
      if (totals[el] >= R2_EDGES && (!best || totals[el] > totals[best])) best = el;
    });
    if (!best) return null;
    return {
      rule: 'R2', taskId: taskId, targetId: best,
      threshold: '≥' + R2_EDGES + ' edge misses on the same element in baseline runs',
      total: totals[best],
      evidence: perRun[best],
      baselineN: runs.length
    };
  }

  // Suggestions not yet applied, in task order (R1 before R2).
  function suggestions(state, taskIds) {
    var out = [];
    taskIds.forEach(function (id) {
      [evaluateR1(state, id), evaluateR2(state, id)].forEach(function (s) {
        if (s && !isApplied(state, s)) out.push(s);
      });
    });
    return out;
  }

  function apply(state, s, nowIso) {
    if (isApplied(state, s)) return null;
    state.seq.adapt += 1;
    var a = {
      id: 'a' + state.seq.adapt,
      rule: s.rule, taskId: s.taskId, targetId: s.targetId || null,
      evidenceRunIds: s.evidence.map(function (e) { return e.runId; }),
      threshold: s.threshold,
      appliedAt: nowIso, undoneAt: null
    };
    state.adaptations.push(a);
    return a;
  }

  function undo(state, adaptationId, nowIso) {
    var a = state.adaptations.filter(function (x) { return x.id === adaptationId && !x.undoneAt; })[0];
    if (!a) return null;
    a.undoneAt = nowIso;
    return a;
  }

  return {
    R1_PRESSES: R1_PRESSES, R1_RUNS: R1_RUNS, R2_EDGES: R2_EDGES,
    evaluateR1: evaluateR1, evaluateR2: evaluateR2, suggestions: suggestions,
    active: active, isApplied: isApplied, apply: apply, undo: undo
  };
});
