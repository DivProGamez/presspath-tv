/* PressPath TV — the five guided tasks and the task session recorder (pure).
 * A session records only genuine inputs that arrive while the task is active.
 * The clock starts on the first accepted input, not when the task is armed. */
(function (root, factory) {
  var mod = factory(root.PP && root.PP.metrics);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).tasks = mod;
})(typeof self !== 'undefined' ? self : this, function (metricsMod) {
  'use strict';

  var metrics = metricsMod || (typeof require === 'function' ? require('./metrics.js') : null);

  // Every task starts on Home with focus on the first activity tile.
  // `done` decides whether an app event completes the task.
  // `shortcut` is where an R1 Home shortcut for this task leads.
  var TASKS = [
    {
      id: 'memory', n: 1,
      title: 'Start Memory Pairs and flip a card',
      short: 'Memory Pairs · flip a card',
      done: function (ev) { return ev.type === 'memory:flip'; },
      shortcut: { label: 'Memory Pairs', sub: 'Opens the board, ready to flip', screen: 'play', params: {}, focus: 'mem-card-0', art: 'memory' }
    },
    {
      id: 'science', n: 2,
      title: 'Open Science flashcards and reveal an answer',
      short: 'Science cards · reveal',
      done: function (ev) { return ev.type === 'cards:reveal' && ev.deck === 'science'; },
      shortcut: { label: 'Science Cards', sub: 'Opens the Everyday Science deck', screen: 'deck', params: { deck: 'science' }, focus: 'fc-reveal', art: 'science' }
    },
    {
      id: 'contrast', n: 3,
      title: 'Enable High Contrast in Settings',
      short: 'High Contrast · enable',
      pref: 'highContrast',
      done: function (ev) { return ev.type === 'pref:set' && ev.key === 'highContrast' && ev.value === true; },
      shortcut: { label: 'High Contrast', sub: 'Opens Settings on this switch', screen: 'settings', params: {}, focus: 'set-hc', art: 'contrast' }
    },
    {
      id: 'largetext', n: 4,
      title: 'Enable Large Text in Settings',
      short: 'Large Text · enable',
      pref: 'largeText',
      done: function (ev) { return ev.type === 'pref:set' && ev.key === 'largeText' && ev.value === true; },
      shortcut: { label: 'Large Text', sub: 'Opens Settings on this switch', screen: 'settings', params: {}, focus: 'set-lt', art: 'text' }
    },
    {
      id: 'letters', n: 5,
      title: 'From Home, open Letters flashcards',
      short: 'Letters cards · open',
      done: function (ev) { return ev.type === 'cards:open' && ev.deck === 'letters'; },
      shortcut: { label: 'Letters Cards', sub: 'Opens the Letters deck', screen: 'deck', params: { deck: 'letters' }, focus: 'fc-reveal', art: 'letters' }
    }
  ];

  var BY_ID = {};
  TASKS.forEach(function (t) { BY_ID[t.id] = t; });

  function get(id) { return BY_ID[id] || null; }

  function createSession(opts) {
    return {
      taskId: opts.taskId,
      phase: opts.phase === 'adaptive' ? 'adaptive' : 'baseline',
      adaptationIds: (opts.adaptationIds || []).slice(),
      armedAt: opts.now,
      t0: null,
      wallStart: null,
      events: [],
      done: false
    };
  }

  // Record one accepted input. `now` is a monotonic ms clock; `wall` an epoch ms for display.
  function record(session, input, now, wall) {
    if (!session || session.done) return false;
    if (session.t0 === null) { session.t0 = now; session.wallStart = typeof wall === 'number' ? wall : null; }
    session.events.push({ t: now - session.t0, a: input.a, from: input.from || null, to: input.to || null, r: input.r });
    return true;
  }

  function live(session, now) {
    var end = session.t0 === null ? 0 : now - session.t0;
    return metrics.compute(session.events, end);
  }

  function matches(session, ev) {
    if (!session || session.done) return false;
    var t = get(session.taskId);
    return !!(t && t.done(ev));
  }

  // Close the session and produce the stored run record.
  function finish(session, now, id, n) {
    session.done = true;
    var end = session.t0 === null ? 0 : now - session.t0;
    var m = metrics.compute(session.events, end);
    return {
      id: id, n: n,
      taskId: session.taskId,
      phase: session.phase,
      adaptationIds: session.adaptationIds.slice(),
      startedAt: session.wallStart !== null ? new Date(session.wallStart).toISOString() : null,
      presses: m.presses, directional: m.directional, ok: m.ok, back: m.back,
      backtracks: m.backtracks, edgeMisses: m.edgeMisses, seconds: m.seconds,
      edgeByTarget: metrics.edgeByTarget(session.events),
      events: session.events.slice(0, 300)
    };
  }

  return { TASKS: TASKS, get: get, createSession: createSession, record: record, live: live, matches: matches, finish: finish };
});
