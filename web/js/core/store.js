/* PressPath TV — local persistence.
 * Everything lives in one localStorage key on this device. No network, no accounts.
 * Works in the browser (window.PP.store) and in Node tests (module.exports). */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).store = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'presspath.v1';
  var VERSION = 1;

  function defaultState() {
    return {
      v: VERSION,
      prefs: { highContrast: false, largeText: false, reduceMotion: false },
      runs: [],
      adaptations: [],
      seq: { run: 0, adapt: 0 }
    };
  }

  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

  // Accept only the fields we know; anything malformed falls back to defaults.
  function sanitize(raw) {
    var s = defaultState();
    if (!isObj(raw) || raw.v !== VERSION) return null;
    if (isObj(raw.prefs)) {
      ['highContrast', 'largeText', 'reduceMotion'].forEach(function (k) {
        s.prefs[k] = raw.prefs[k] === true;
      });
    }
    if (Array.isArray(raw.runs)) {
      s.runs = raw.runs.filter(function (r) {
        return isObj(r) && typeof r.id === 'string' && typeof r.taskId === 'string' &&
          (r.phase === 'baseline' || r.phase === 'adaptive') &&
          typeof r.presses === 'number' && typeof r.seconds === 'number';
      });
    }
    if (Array.isArray(raw.adaptations)) {
      s.adaptations = raw.adaptations.filter(function (a) {
        return isObj(a) && typeof a.id === 'string' && (a.rule === 'R1' || a.rule === 'R2') &&
          typeof a.taskId === 'string';
      });
    }
    if (isObj(raw.seq)) {
      s.seq.run = Math.max(Number(raw.seq.run) || 0, s.runs.length);
      s.seq.adapt = Math.max(Number(raw.seq.adapt) || 0, s.adaptations.length);
    }
    return s;
  }

  function load(storage) {
    var raw = null;
    try { raw = storage.getItem(KEY); } catch (e) { return { state: defaultState(), recovered: false }; }
    if (raw == null) return { state: defaultState(), recovered: false };
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = undefined; }
    var s = parsed === undefined ? null : sanitize(parsed);
    if (!s) {
      // Keep the unreadable payload aside instead of silently destroying it.
      try { storage.setItem(KEY + '.corrupt', raw); } catch (e) { /* ignore */ }
      return { state: defaultState(), recovered: true };
    }
    return { state: s, recovered: false };
  }

  function save(storage, state) {
    try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }

  function clear(storage) {
    try { storage.removeItem(KEY); storage.removeItem(KEY + '.corrupt'); } catch (e) { /* ignore */ }
    return defaultState();
  }

  return { KEY: KEY, VERSION: VERSION, defaultState: defaultState, sanitize: sanitize, load: load, save: save, clear: clear };
});
