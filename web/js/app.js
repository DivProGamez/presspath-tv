/* PressPath TV — application controller.
 * Screens render into a fixed 1920 x 1080 stage. All input (keyboard, gamepad,
 * Android TV remote via the native bridge) goes through one dispatcher so guided
 * tasks record exactly the presses the viewer made. */
(function () {
  'use strict';

  var PP = window.PP;
  var store = PP.store, tasks = PP.tasks, rules = PP.rules, compare = PP.compare,
    spatial = PP.spatial, memory = PP.memory, decks = PP.decks, art = PP.art;
  var G = art.glyph;
  var TASK_IDS = tasks.TASKS.map(function (t) { return t.id; });

  // ---------- storage ----------
  var storage = (function () {
    try { var k = '__pp_probe'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return window.localStorage; } catch (e) {
      var mem = {};
      return { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
    }
  })();
  var loaded = store.load(storage);
  var S = loaded.state;
  function save() { store.save(storage, S); }

  // ---------- ui state ----------
  var ui = {
    screen: null, params: {}, history: [], focus: null, overlay: null,
    task: null, lock: false, splash: true, scale: 1,
    game: null, deck: { id: null, idx: 0, revealed: false },
    clearArmed: false, exitArmedAt: 0, hudTimer: null, toastTimer: null
  };
  var $ = function (s) { return document.querySelector(s); };
  var stage, screenEl, overlayEl, hudEl, toastEl, hintsEl;
  var isNative = !!window.PressPathNative;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function log(msg, data) { try { console.info('[PP] ' + msg + (data ? ' ' + JSON.stringify(data) : '')); } catch (e) { /* ignore */ } }
  function nowIso() { return new Date().toISOString(); }
  function fmtTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function fmtNum(v, unit) {
    if (v === null || v === undefined) return 'N/A';
    var s = (Math.round(v * 10) / 10).toString();
    return unit ? s + unit : s;
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  // ---------- stage scaling ----------
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var s = Math.min(w / 1920, h / 1080);
    ui.scale = s;
    stage.style.transform = 'translate(' + ((w - 1920 * s) / 2) + 'px,' + ((h - 1080 * s) / 2) + 'px) scale(' + s + ')';
  }

  // ---------- preferences ----------
  function applyPrefs() {
    var c = document.documentElement.classList;
    c.toggle('hc', S.prefs.highContrast);
    c.toggle('lt', S.prefs.largeText);
    c.toggle('rm', S.prefs.reduceMotion);
  }
  function setPref(key, value) {
    S.prefs[key] = value;
    save();
    applyPrefs();
    log('pref', { key: key, value: value });
    emit({ type: 'pref:set', key: key, value: value });
  }

  // ---------- derived data ----------
  function runsFor(taskId, phase) { return compare.runsFor(S, taskId, phase); }
  function featuredComparison() {
    var adaptive = S.runs.filter(function (r) { return r.phase === 'adaptive'; });
    for (var i = adaptive.length - 1; i >= 0; i--) {
      var c = compare.compareTask(S, adaptive[i].taskId);
      if (c.available) return c;
    }
    return null;
  }
  function activeShortcuts() {
    return rules.active(S).filter(function (a) { return a.rule === 'R1'; });
  }
  function emphasized() {
    var m = {};
    rules.active(S).forEach(function (a) { if (a.rule === 'R2' && a.targetId) m[a.targetId] = true; });
    return m;
  }
  function allSuggestions() { return rules.suggestions(S, TASK_IDS); }
  function deltaChip(d, p, unit) {
    if (d === null || d === undefined) return '<span class="delta flat">N/A</span>';
    var cls = d < 0 ? 'good' : d > 0 ? 'bad' : 'flat';
    var sign = d > 0 ? '+' : d < 0 ? '−' : '±';
    return '<span class="delta ' + cls + '">Δ ' + sign + fmtNum(Math.abs(d)) + (unit || '') + (p !== null && p !== undefined ? ' (' + (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '%)' : '') + '</span>';
  }
  var LABELS = {
    'home-tile-lab': 'Navigation Lab tile', 'home-tile-memory': 'Memory Pairs tile', 'home-tile-cards': 'Flashcards tile',
    'home-tile-progress': 'Progress tile', 'home-tile-settings': 'Settings tile',
    'nav-home': 'Home tab', 'nav-lab': 'Navigation Lab tab', 'nav-play': 'Play tab', 'nav-learn': 'Learn tab', 'nav-progress': 'Progress tab', 'nav-settings': 'Settings tab',
    'deck-letters': 'Letters deck', 'deck-numbers': 'Numbers deck', 'deck-science': 'Everyday Science deck',
    'set-hc': 'High Contrast switch', 'set-lt': 'Large Text switch', 'set-rm': 'Reduce Motion switch', 'set-clear': 'Clear All Local Data',
    'fc-prev': 'Previous button', 'fc-reveal': 'Reveal button', 'fc-next': 'Next button', 'fc-decks': 'Decks button',
    'mem-new': 'New game button', 'mem-home': 'Back to Home button'
  };
  function labelFor(id) {
    if (LABELS[id]) return LABELS[id];
    if (/^mem-card-/.test(id)) return 'Memory card ' + (Number(id.slice(9)) + 1);
    if (/^sc-/.test(id)) return 'Home shortcut';
    return id;
  }

  // ---------- task flow ----------
  function startTask(taskId) {
    if (ui.task) { toast('A guided task is already running.', 'warn'); return; }
    var t = tasks.get(taskId);
    var note = null;
    if (t.pref && S.prefs[t.pref]) {
      S.prefs[t.pref] = false; save(); applyPrefs();
      note = (t.pref === 'highContrast' ? 'High Contrast' : 'Large Text') + ' was switched off so this task can be measured.';
    }
    if (taskId === 'memory') ui.game = null;
    var act = rules.active(S, taskId);
    ui.task = tasks.createSession({ taskId: taskId, phase: act.length ? 'adaptive' : 'baseline', adaptationIds: act.map(function (a) { return a.id; }), now: performance.now() });
    log('task:start', { task: taskId, phase: ui.task.phase });
    closeOverlay(true);
    ui.history = [];
    show('home', {}, 'home-tile-lab');
    renderHud();
    toast(note || 'Task armed — your first press starts the clock.', note ? 'warn' : 'info');
  }

  function cancelTask() {
    log('task:cancel', { task: ui.task.taskId });
    ui.task = null;
    renderHud();
    toast('Task cancelled — nothing was recorded.', 'warn');
  }

  function rec(a, from, to, r) {
    if (!ui.task || ui.lock) return;
    tasks.record(ui.task, { a: a, from: from, to: to, r: r }, performance.now(), Date.now());
    updateHud();
  }

  function emit(ev) {
    if (!ui.task || !tasks.matches(ui.task, ev)) return;
    S.seq.run += 1;
    var run = tasks.finish(ui.task, performance.now(), 'r' + S.seq.run, S.seq.run);
    S.runs.push(run);
    if (S.runs.length > 400) S.runs = S.runs.slice(-400);
    save();
    ui.task = null;
    log('task:complete', { task: run.taskId, phase: run.phase, presses: run.presses, backtracks: run.backtracks, edgeMisses: run.edgeMisses, seconds: run.seconds, run: run.id });
    ui.lock = true;
    renderHud();
    setTimeout(function () { ui.lock = false; openOverlay('result', { runId: run.id }); }, 700);
  }

  // ---------- HUD ----------
  function renderHud() {
    clearInterval(ui.hudTimer);
    if (!ui.task) { hudEl.className = ''; hudEl.innerHTML = ''; $('#footer').style.visibility = 'visible'; return; }
    var t = tasks.get(ui.task.taskId);
    hudEl.className = 'on' + (ui.task.phase === 'adaptive' ? ' adaptive' : '');
    hudEl.innerHTML = '<div class="pill"><i></i>' + (ui.task.phase === 'adaptive' ? 'ADAPTIVE RUN' : 'BASELINE RUN') + ' · TASK ' + t.n + '/5</div>' +
      '<div class="title">' + esc(t.title) + '</div>' +
      '<div class="m"><span class="num" id="hud-p">0</span><span class="caps">presses</span></div>' +
      '<div class="m"><span class="num" id="hud-b">0</span><span class="caps">backtracks</span></div>' +
      '<div class="m"><span class="num" id="hud-e">0</span><span class="caps">edge misses</span></div>' +
      '<div class="m"><span class="num" id="hud-t">0.0</span><span class="caps">sec</span></div>' +
      '<div class="hint2" id="hud-h">Clock starts on your first press · Back on Home cancels</div>';
    $('#footer').style.visibility = 'hidden';
    ui.hudTimer = setInterval(updateHud, 200);
    updateHud();
  }
  function updateHud() {
    if (!ui.task) return;
    var m = tasks.live(ui.task, performance.now());
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('hud-p', m.presses); set('hud-b', m.backtracks); set('hud-e', m.edgeMisses); set('hud-t', m.seconds.toFixed(1));
    if (ui.task.t0 !== null) set('hud-h', 'Recording on this TV · Back on Home cancels');
  }

  // ---------- toast ----------
  function toast(text, kind) {
    clearTimeout(ui.toastTimer);
    var icon = kind === 'ok' ? 'check' : kind === 'warn' ? 'info' : 'sparkle';
    toastEl.className = 'on ' + (kind || '');
    toastEl.innerHTML = G(icon) + '<span>' + esc(text) + '</span>';
    ui.toastTimer = setTimeout(function () { toastEl.className = ''; }, 3200);
  }

  // ---------- chrome ----------
  var NAV = [['home', 'Home'], ['lab', 'Navigation Lab'], ['play', 'Play'], ['learn', 'Learn'], ['progress', 'Progress'], ['settings', 'Settings']];
  var SECTION = { home: 'home', lab: 'lab', compare: 'lab', play: 'play', learn: 'learn', deck: 'learn', progress: 'progress', settings: 'settings' };
  function renderTopbar() {
    var sec = SECTION[ui.screen] || 'home';
    $('#topbar').innerHTML =
      '<div class="brand">' + art.logo() + '<span>PressPath <b>TV</b></span></div>' +
      '<div class="navpills">' + NAV.map(function (n) {
        return '<button class="navpill f' + (n[0] === sec ? ' active' : '') + '" id="nav-' + n[0] + '" data-go="' + n[0] + '">' + n[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="status"><div class="chip-local">' + G('lock') + '<span class="caps">Stored locally</span></div><div class="clock" id="clock"></div></div>';
    tick();
  }
  function tick() {
    var el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function renderFooter() {
    $('#footer').innerHTML =
      '<span><span class="key">' + G('dpad') + '</span>Navigate</span>' +
      '<span><span class="key ok">OK</span>Select</span>' +
      '<span><span class="key">' + G('back') + '</span>Back</span>' +
      '<span class="right"><span class="dot"></span>Measurements stay on this TV · nothing is sent anywhere</span>';
  }

  // ---------- screens ----------
  var TILES = [
    { id: 'home-tile-lab', art: 'lab', t: 'Navigation Lab', s: 'Measure · Adapt · Compare', go: 'lab', soft: 'rgba(34,200,245,.28)', glow: 'rgba(34,200,245,.55)' },
    { id: 'home-tile-memory', art: 'memory', t: 'Memory Pairs', s: 'Match six pairs with the remote', go: 'play', soft: 'rgba(224,69,123,.26)', glow: 'rgba(224,69,123,.5)' },
    { id: 'home-tile-cards', art: 'cards', t: 'Flashcards', s: 'Letters · Numbers · Science', go: 'learn', soft: 'rgba(242,122,42,.26)', glow: 'rgba(242,122,42,.5)' },
    { id: 'home-tile-progress', art: 'progress', t: 'Progress', s: 'Your measured runs', go: 'progress', soft: 'rgba(41,240,173,.22)', glow: 'rgba(41,240,173,.45)' },
    { id: 'home-tile-settings', art: 'settings', t: 'Settings', s: 'Contrast · Text · Motion', go: 'settings', soft: 'rgba(123,97,255,.3)', glow: 'rgba(123,97,255,.55)' }
  ];

  function evidenceCard() {
    var c = featuredComparison();
    var head = '<div class="top"><span class="caps">' + G('target') + 'Measured on this TV</span>';
    if (c) {
      var t = tasks.get(c.taskId);
      return '<div class="evidence" id="home-evidence">' + head + deltaChip(c.delta.presses, c.pct.presses) + '</div>' +
        '<div class="h3">' + esc(t.short) + '</div>' +
        '<div class="small">Before / After · median of ' + plural(c.baselineN, 'baseline run') + ' vs ' + plural(c.adaptiveN, 'adaptive run') + '</div>' +
        '<div class="row"><div class="big"><span>' + fmtNum(c.before.presses) + '</span>' + G('arrow') + '<span class="after">' + fmtNum(c.after.presses) + '</span></div>' +
        '<div class="lbl">presses<br>' + fmtNum(c.before.backtracks) + ' → ' + fmtNum(c.after.backtracks) + ' backtracks · ' + fmtNum(c.before.seconds, ' s') + ' → ' + fmtNum(c.after.seconds, ' s') + '</div></div></div>';
    }
    var last = S.runs[S.runs.length - 1];
    if (last) {
      var lt = tasks.get(last.taskId);
      return '<div class="evidence" id="home-evidence">' + head + '<span class="tag dim">Before / After: N/A</span></div>' +
        '<div class="h3">Latest run · ' + esc(lt.short) + '</div>' +
        '<div class="small">' + plural(S.runs.length, 'run') + ' recorded. A comparison appears after a run with an applied adaptation.</div>' +
        '<div class="row"><div class="big"><span>' + last.presses + '</span></div><div class="lbl">presses · ' + last.backtracks + ' backtracks · ' +
        last.edgeMisses + ' edge misses · ' + fmtNum(last.seconds, ' s') + '<br>' + (last.phase === 'adaptive' ? 'Adaptive run' : 'Baseline run') + ' #' + last.n + '</div></div></div>';
    }
    return '<div class="evidence" id="home-evidence">' + head + '<span class="tag dim">No data yet</span></div>' +
      '<div class="h3">No measured runs yet</div>' +
      '<div class="small">Run a guided task in the Navigation Lab. Real presses, backtracks, edge misses and seconds from this TV will appear here — never sample numbers.</div>' +
      '<div class="row"><div class="big"><span>—</span></div><div class="lbl">Before / After shows N/A until both<br>baseline and adaptive runs exist.</div></div></div>';
  }

  var Screens = {};

  Screens.home = {
    def: function () { return 'home-tile-lab'; },
    render: function () {
      var scs = activeShortcuts();
      var scHtml = scs.length ? '<div class="sc-row">' + scs.map(function (a) {
        var sc = tasks.get(a.taskId).shortcut;
        return '<button class="sc f" id="sc-' + a.taskId + '" data-sc="' + a.taskId + '"><div class="art-wrap">' + art.shortcutArt(sc.art) + '</div>' +
          '<div><div class="t">' + esc(sc.label) + '</div><div class="s">' + esc(sc.sub) + '</div></div><span class="tag amber">' + G('bolt') + 'Added by R1</span></button>';
      }).join('') + '</div>'
        : '<div class="sc-empty">' + G('bolt') + 'No shortcuts yet. When a task repeatedly takes 5 or more presses, Rule R1 can suggest one — you decide whether to add it.</div>';
      return '<div class="screen home">' +
        '<div class="hero"><div><div class="eyebrow caps">Family TV hub · measures its own navigation</div>' +
        '<div class="h1">Every press counts.<br><em>Every path gets smarter.</em></div>' +
        '<div class="sub">Play and learn with the remote. PressPath measures each path on this TV and suggests changes you can check — and undo.</div></div>' +
        evidenceCard() + '</div>' +
        '<div class="shortcuts"><div class="head"><span class="caps">' + G('bolt') + 'Your shortcuts</span><span class="small">Earned from measured runs · undo any time in the Lab</span></div>' + scHtml + '</div>' +
        '<div class="tiles">' + TILES.map(function (t) {
          return '<button class="tile f" id="' + t.id + '" data-go="' + t.go + '" style="--accent-soft:' + t.soft + ';--accent-glow:' + t.glow + '">' + art.tile(t.art) +
            '<span class="go">' + G('arrow') + '</span><div class="t">' + t.t + '</div><div class="s">' + t.s + '</div></button>';
        }).join('') + '</div></div>';
    }
  };

  function taskStatus(taskId) {
    var base = runsFor(taskId, 'baseline'), ad = runsFor(taskId, 'adaptive');
    if (!base.length && !ad.length) return '<span>Not measured yet</span>';
    var parts = [];
    if (base.length) {
      var b = compare.summarize(base);
      parts.push('<span>Baseline ×' + base.length + ': median <b>' + fmtNum(b.presses) + '</b> presses · ' + fmtNum(b.backtracks) + ' backtracks · ' + fmtNum(b.edgeMisses) + ' edge misses</span>');
    }
    if (ad.length) {
      var a = compare.summarize(ad);
      parts.push('<span class="ok">Adaptive ×' + ad.length + ': median <b>' + fmtNum(a.presses) + '</b> presses</span>');
    }
    return parts.join('<span>·</span>');
  }

  Screens.lab = {
    def: function () { return 'lab-run-memory'; },
    render: function () {
      var sugg = allSuggestions();
      var feat = featuredComparison();
      var top;
      if (feat) {
        var ft = tasks.get(feat.taskId);
        var ad = feat.adaptations[feat.adaptations.length - 1];
        top = '<div class="strip">' +
          '<div class="stage-card before"><div class="top"><span class="tag coral">Before</span><span class="caps small">median · n=' + feat.baselineN + '</span></div>' +
          '<div class="val"><span class="n">' + fmtNum(feat.before.presses) + '</span><span class="u">presses</span><span class="n">' + fmtNum(feat.before.backtracks) + '</span><span class="u">backtracks</span></div>' +
          '<div class="small">' + esc(ft.short) + ' · ' + fmtNum(feat.before.seconds, ' s') + '</div></div>' +
          '<div class="arrow-c">' + G('arrow') + '</div>' +
          '<div class="stage-card change"><div class="top"><span class="tag azure">The change</span><span class="caps small">' + (ad ? 'Rule ' + ad.rule : '') + '</span></div>' +
          '<div class="h3">' + (ad ? esc(changeTitle(ad)) : 'Adaptation') + '</div>' +
          '<div class="small">' + (ad ? esc(ad.threshold) + (ad.undoneAt ? ' · undone ' + fmtTime(ad.undoneAt) : ' · active') : '') + '</div></div>' +
          '<div class="arrow-c" style="color:var(--mint);border-color:rgba(41,240,173,.4)">' + G('arrow') + '</div>' +
          '<div class="stage-card after"><div class="top"><span class="tag mint">After</span>' + deltaChip(feat.delta.presses, feat.pct.presses) + '</div>' +
          '<div class="val"><span class="n">' + fmtNum(feat.after.presses) + '</span><span class="u">presses</span><span class="n">' + fmtNum(feat.after.backtracks) + '</span><span class="u">backtracks</span></div>' +
          '<div class="small">median · n=' + feat.adaptiveN + ' · ' + fmtNum(feat.after.seconds, ' s') + '</div></div></div>';
      } else {
        top = '<div class="steps3">' +
          '<div class="step glass"><div class="ic" style="background:rgba(34,200,245,.12);color:var(--azure)">' + G('dpad') + '</div><div><div class="t">1 · Baseline</div><div class="s">Run a task with the remote. Every press counts.</div></div></div>' +
          '<div class="arrow-c">' + G('arrow') + '</div>' +
          '<div class="step glass"><div class="ic" style="background:rgba(123,97,255,.16);color:var(--violet-2)">' + G('flask') + '</div><div><div class="t">2 · Adapt</div><div class="s">R1 and R2 check your runs. Preview, apply or skip.</div></div></div>' +
          '<div class="arrow-c">' + G('arrow') + '</div>' +
          '<div class="step glass"><div class="ic" style="background:rgba(41,240,173,.12);color:var(--mint)">' + G('chart') + '</div><div><div class="t">3 · Compare</div><div class="s">Re-run the task and see real before/after medians.</div></div></div></div>';
      }
      var sbar = '';
      if (sugg.length) {
        var s0 = sugg[0], st = tasks.get(s0.taskId);
        sbar = '<div class="suggest">' + G('sparkle') + '<div class="grow"><b>Suggested adaptation:</b> ' +
          (s0.rule === 'R1' ? 'Rule R1 — add a Home shortcut for “' + esc(st.short) + '”' : 'Rule R2 — stronger focus on the ' + esc(labelFor(s0.targetId))) +
          (sugg.length > 1 ? ' <span class="small">(+' + (sugg.length - 1) + ' more on the task rows)</span>' : '') + '</div>' +
          '<button class="btn sm primary f" id="lab-suggest" data-preview="' + s0.taskId + ':' + s0.rule + '">' + G('eye') + 'Preview ' + s0.rule + '</button></div>';
      }
      var rows = tasks.TASKS.map(function (t) {
        var act = rules.active(S, t.id);
        var mine = sugg.filter(function (s) { return s.taskId === t.id; });
        var runBtn = '<button class="btn sm ' + (act.length ? 'primary' : '') + ' f" id="lab-run-' + t.id + '" data-run="' + t.id + '">' + G('play') + (act.length ? 'Run adaptive' : 'Run baseline') + '</button>';
        var slot;
        if (mine.length) slot = '<button class="btn sm amber f" id="lab-adapt-' + t.id + '" data-preview="' + t.id + ':' + mine[0].rule + '">' + G('eye') + 'Preview ' + mine[0].rule + '</button>';
        else if (act.length) slot = '<button class="btn sm f" id="lab-adapt-' + t.id + '" data-undo="' + act[act.length - 1].id + '">' + G('undo') + 'Undo ' + act[act.length - 1].rule + '</button>';
        else slot = '<span class="slot-empty">No suggestion yet</span>';
        var cmp = '<button class="btn sm f" id="lab-compare-' + t.id + '" data-compare="' + t.id + '">' + G('chart') + 'Before / After</button>';
        return '<div class="trow"><div class="num-b">' + t.n + '</div><div><div class="t">' + esc(t.title) +
          (act.length ? ' <span class="tag azure">' + act.map(function (a) { return a.rule; }).join(' + ') + ' active</span>' : '') + '</div>' +
          '<div class="st">' + taskStatus(t.id) + '</div></div><div class="acts">' + runBtn + slot + cmp + '</div></div>';
      }).join('');
      return '<div class="screen scroll" style="height:100%">' +
        '<div class="lab-head"><div><div class="h1">Navigation Lab</div><div class="sub">Guided tasks measure real presses on this TV. Baseline first, then adapt, then re-run.</div></div>' +
        '<button class="btn sm f" id="lab-rules" data-rules="1">' + G('info') + 'How we measure</button></div>' +
        top + sbar + '<div class="rows">' + rows + '</div></div>';
    }
  };

  function changeTitle(a) {
    var t = tasks.get(a.taskId);
    return a.rule === 'R1' ? 'Home shortcut · ' + t.shortcut.label : 'Stronger focus · ' + labelFor(a.targetId);
  }

  Screens.compare = {
    def: function (p) { var c = compare.compareTask(S, p.taskId); return c.available ? 'ba-rerun' : 'ba-run'; },
    render: function (p) {
      var t = tasks.get(p.taskId);
      var c = compare.compareTask(S, p.taskId);
      var act = rules.active(S, p.taskId);
      function grid(x) {
        return '<div class="ba-grid"><div><div class="n">' + fmtNum(x.presses) + '</div><div class="caps">Presses</div></div>' +
          '<div><div class="n">' + fmtNum(x.backtracks) + '</div><div class="caps">Backtracks</div></div>' +
          '<div><div class="n">' + fmtNum(x.edgeMisses) + '</div><div class="caps">Edge misses</div></div>' +
          '<div><div class="n">' + fmtNum(x.seconds) + '</div><div class="caps">Seconds</div></div></div>';
      }
      var head = '<div class="lab-head"><div><div class="eyebrow caps">Before / After · task ' + t.n + ' of 5</div><div class="h1" style="margin-top:12px">' + esc(t.title) + '</div>' +
        '<div class="sub">Medians of runs recorded on this TV. Differences are After minus Before.</div></div></div>';
      var undoBtn = act.length ? '<button class="btn f" id="ba-undo" data-undo="' + act[act.length - 1].id + '">' + G('undo') + 'Undo ' + act[act.length - 1].rule + '</button>' : '';
      if (!c.available) {
        var need = [];
        if (!c.baselineN) need.push('at least one baseline run');
        if (!c.adaptiveN) need.push('at least one run with an applied adaptation');
        return '<div class="screen">' + head + '<div class="ba-stages">' +
          '<div class="ba-card before"><div class="top"><span class="tag coral">Stage 1 · Before</span><span class="caps small">n=' + c.baselineN + '</span></div>' + (c.before ? grid(c.before) : '<div class="na">N/A</div><div class="small">No baseline runs yet.</div>') + '</div>' +
          '<div class="arrow-c">' + G('arrow') + '</div>' +
          '<div class="ba-card change"><div class="top"><span class="tag azure">Stage 2 · Adaptation</span></div>' +
          (act.length ? '<div class="h3">' + esc(changeTitle(act[act.length - 1])) + '</div><div class="small">Applied ' + fmtTime(act[act.length - 1].appliedAt) + ' · ' + esc(act[act.length - 1].threshold) + '</div>' : '<div class="na">—</div><div class="small">No adaptation applied for this task.</div>') + '</div>' +
          '<div class="arrow-c">' + G('arrow') + '</div>' +
          '<div class="ba-card after"><div class="top"><span class="tag mint">Stage 3 · After</span><span class="caps small">n=' + c.adaptiveN + '</span></div>' + (c.after ? grid(c.after) : '<div class="na">N/A</div><div class="small">No adaptive runs yet.</div>') + '</div></div>' +
          '<div class="ba-banner neutral"><div class="ic">' + G('info') + '</div><div><div class="h2">Not enough data to compare</div><div class="line">Needs ' + need.join(' and ') + '. Nothing is estimated or filled in.</div></div></div>' +
          '<div class="ba-acts"><button class="btn primary f" id="ba-run" data-run="' + t.id + '">' + G('play') + (act.length ? 'Run adaptive' : 'Run baseline') + '</button>' + undoBtn +
          '<button class="btn f" id="ba-back" data-back="1">' + G('back') + 'Back to Lab</button></div></div>';
      }
      var ad = c.adaptations;
      var lastAd = ad[ad.length - 1];
      var better = c.delta.presses < 0;
      return '<div class="screen">' + head + '<div class="ba-stages">' +
        '<div class="ba-card before"><div class="top"><span class="tag coral">Stage 1 · Before</span><span class="caps small">median · n=' + c.baselineN + '</span></div>' + grid(c.before) + '</div>' +
        '<div class="arrow-c">' + G('arrow') + '</div>' +
        '<div class="ba-card change"><div class="top"><span class="tag azure">Stage 2 · Adaptation</span><span class="tag violet">Rule ' + esc(ad.map(function (a) { return a.rule; }).join(' + ')) + '</span></div>' +
        ad.map(function (a) { return '<div class="h3">' + esc(changeTitle(a)) + '</div><div class="small" style="margin-bottom:12px">' + esc(a.threshold) + '<br>Applied ' + fmtTime(a.appliedAt) + (a.undoneAt ? ' · undone ' + fmtTime(a.undoneAt) : ' · active now') + '</div>'; }).join('') +
        '<div class="small">Evidence: baseline runs ' + lastAd.evidenceRunIds.map(function (id) { return '#' + id.slice(1); }).join(', ') + '</div></div>' +
        '<div class="arrow-c" style="color:var(--mint);border-color:rgba(41,240,173,.4)">' + G('arrow') + '</div>' +
        '<div class="ba-card after"><div class="top"><span class="tag mint">Stage 3 · After</span><span class="caps small">median · n=' + c.adaptiveN + '</span></div>' + grid(c.after) + '</div></div>' +
        '<div class="ba-banner' + (better ? '' : ' neutral') + '"><div class="ic">' + G(better ? 'check' : 'info') + '</div><div>' +
        '<div class="h2">' + fmtNum(c.before.presses) + ' → ' + fmtNum(c.after.presses) + ' presses</div>' +
        '<div class="line">' + deltaChip(c.delta.presses, c.pct.presses) + '<span>Backtracks ' + fmtNum(c.before.backtracks) + ' → ' + fmtNum(c.after.backtracks) + '</span>' + deltaChip(c.delta.backtracks, null) +
        '<span>Edge misses ' + fmtNum(c.before.edgeMisses) + ' → ' + fmtNum(c.after.edgeMisses) + '</span>' + deltaChip(c.delta.edgeMisses, null) +
        '<span>Time ' + fmtNum(c.before.seconds, ' s') + ' → ' + fmtNum(c.after.seconds, ' s') + '</span>' + deltaChip(c.delta.seconds, c.pct.seconds, ' s') + '</div></div></div>' +
        '<div class="ba-acts"><button class="btn primary f" id="ba-rerun" data-run="' + t.id + '">' + G('refresh') + (act.length ? 'Run adaptive again' : 'Run baseline') + '</button>' + undoBtn +
        '<button class="btn f" id="ba-back" data-back="1">' + G('back') + 'Back to Lab</button></div></div>';
    }
  };

  Screens.play = {
    def: function () { return 'mem-card-0'; },
    render: function () {
      if (!ui.game || ui.game.complete) ui.game = memory.newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      var g = ui.game;
      return '<div class="screen"><div class="play-head"><div class="grow"><div class="h1">Memory Pairs</div><div class="sub" style="margin-top:6px">Find the six matching pairs. Move with the D-pad, flip with OK.</div></div>' +
        '<div class="chipstat"><span class="num" id="mem-pairs">' + g.pairs + '/6</span><span class="caps">Pairs found</span></div>' +
        '<div class="chipstat"><span class="num" id="mem-moves">' + g.moves + '</span><span class="caps">Moves</span></div>' +
        '<button class="btn f" id="mem-new" data-newgame="1">' + G('refresh') + 'New game</button></div>' +
        '<div class="board">' + g.cards.map(function (c) {
          return '<button class="mcard f' + (c.up ? ' up' : '') + (c.matched ? ' matched' : '') + '" id="mem-card-' + c.i + '" data-card="' + c.i + '"><div class="inner">' +
            '<div class="side backside">' + art.cardBack() + '</div>' +
            '<div class="side front">' + art.face(c.sym) + '<div class="lbl">' + c.sym + '</div>' + (c.matched ? '<span class="tag mint mtag">' + G('check') + 'Matched</span>' : '') + '</div></div></button>';
        }).join('') + '</div></div>';
    }
  };

  function syncBoard() {
    var g = ui.game;
    g.cards.forEach(function (c) {
      var el = document.getElementById('mem-card-' + c.i);
      if (!el) return;
      el.classList.toggle('up', c.up);
      if (c.matched && !el.classList.contains('matched')) {
        el.classList.add('matched');
        el.querySelector('.front').insertAdjacentHTML('beforeend', '<span class="tag mint mtag">' + G('check') + 'Matched</span>');
      }
    });
    var p = document.getElementById('mem-pairs'), m = document.getElementById('mem-moves');
    if (p) p.textContent = g.pairs + '/6';
    if (m) m.textContent = g.moves;
  }

  function flipCard(i) {
    var g = ui.game;
    var res = memory.flip(g, i);
    if (res === 'ignored') return;
    emit({ type: 'memory:flip' });
    syncBoard();
    clearTimeout(ui.memTimer);
    if (res === 'mismatch') ui.memTimer = setTimeout(function () { memory.resolve(g); if (ui.screen === 'play' && ui.game === g) syncBoard(); }, 950);
    if (res === 'complete') { log('memory:complete', { moves: g.moves }); setTimeout(function () { if (ui.screen === 'play') openOverlay('memdone', { moves: g.moves }); }, 650); }
  }

  var DECK_ACCENT = { letters: ['rgba(224,69,123,.3)', 'rgba(224,69,123,.5)'], numbers: ['rgba(41,240,173,.24)', 'rgba(41,240,173,.45)'], science: ['rgba(34,200,245,.28)', 'rgba(34,200,245,.5)'] };
  Screens.learn = {
    def: function () { return 'deck-letters'; },
    render: function () {
      return '<div class="screen"><div class="h1">Flashcards</div><div class="sub" style="margin-top:8px">Pick a deck. Reveal answers with OK, move between cards with Previous and Next.</div>' +
        '<div class="decks">' + decks.DECKS.map(function (d) {
          var a = DECK_ACCENT[d.id];
          return '<button class="deck f" id="deck-' + d.id + '" data-deck="' + d.id + '" style="--accent-soft:' + a[0] + ';--accent-glow:' + a[1] + '">' + art.deckArt(d.id) +
            '<div class="t">' + esc(d.title) + '</div><div class="s">' + esc(d.sub) + '</div><div class="meta"><span class="tag azure">' + d.cards.length + ' cards</span></div></button>';
        }).join('') + '</div></div>';
    }
  };

  Screens.deck = {
    def: function () { return 'fc-reveal'; },
    render: function (p) {
      var d = decks.get(p.deck);
      if (ui.deck.id !== d.id) { ui.deck = { id: d.id, idx: 0, revealed: false }; }
      var i = ui.deck.idx, c = d.cards[i];
      var pic = c.kind === 'letter' ? '<span class="glyph">' + c.glyph + '</span>' : c.kind === 'count' ? art.stars(c.count) : art.science(c.icon);
      var ans = ui.deck.revealed
        ? '<div class="answer" id="fc-answer"><div class="a">' + (c.emoji ? '<span>' + c.emoji + '</span>' : G('check')) + esc(c.a) + '</div><div class="more">' + esc(c.more) + '</div></div>'
        : '<div class="answer hidden">' + G('eye') + 'Answer hidden — press Reveal answer</div>';
      var last = i === d.cards.length - 1;
      return '<div class="screen"><div class="fc-top"><div class="crumb caps"><b>Learn</b>' + G('chevron') + esc(d.title) + '</div>' +
        '<span class="caps" style="color:var(--azure-hi)">Card ' + (i + 1) + ' of ' + d.cards.length + '</span>' +
        '<div class="bar"><i style="width:' + Math.round(((i + 1) / d.cards.length) * 100) + '%"></i></div></div>' +
        '<div class="fcard"><div class="pic">' + pic + '</div><div><div class="q">' + esc(c.q) + '</div><div class="sub fc-hint">' + esc(c.hint) + '</div>' + ans + '</div></div>' +
        '<div class="fc-acts">' +
        '<button class="btn f" id="fc-prev" data-fc="prev"' + (i === 0 ? ' aria-disabled="true" style="opacity:.35"' : '') + '>' + G('chevronL') + 'Previous</button>' +
        '<button class="btn primary f" id="fc-reveal" data-fc="reveal">' + G('eye') + (ui.deck.revealed ? 'Hide answer' : 'Reveal answer') + '</button>' +
        '<button class="btn f" id="fc-next" data-fc="next">' + (last ? 'Start over' : 'Next') + G(last ? 'refresh' : 'chevron') + '</button>' +
        '<button class="btn f" id="fc-decks" data-back="1">' + G('back') + 'All decks</button></div></div>';
    }
  };

  function settingRow(id, key, icon, t, s) {
    var on = S.prefs[key];
    return '<button class="srow glass f' + (on ? ' on' : '') + '" id="' + id + '" data-pref="' + key + '" role="switch" aria-checked="' + on + '">' +
      '<div class="ic">' + G(icon) + '</div><div class="grow"><div class="t">' + t + '</div><div class="s">' + s + '</div></div>' +
      '<div class="toggle-wrap"><span class="caps">' + (on ? 'On' : 'Off') + '</span><div class="toggle"></div></div></button>';
  }

  Screens.settings = {
    def: function () { return 'set-hc'; },
    render: function () {
      var clearRow = ui.clearArmed
        ? '<div class="confirm" id="set-confirm"><div class="ic">' + G('trash') + '</div><div class="grow"><div class="t">Clear all local data?</div>' +
          '<div class="s">Deletes ' + plural(S.runs.length, 'run') + ', ' + plural(S.adaptations.length, 'adaptation') + ' and your preferences. This cannot be undone.</div></div>' +
          '<button class="btn sm f" id="set-clear-cancel" data-clear="cancel">' + G('x') + 'Cancel</button>' +
          '<button class="btn sm danger f" id="set-clear-confirm" data-clear="confirm">' + G('trash') + 'Clear everything</button></div>'
        : '<button class="srow glass danger f" id="set-clear" data-clear="arm"><div class="ic">' + G('trash') + '</div><div class="grow"><div class="t">Clear All Local Data</div>' +
          '<div class="s">Remove every run, adaptation and preference stored on this TV</div></div><span class="caps" style="color:var(--coral)">Asks first</span></button>';
      return '<div class="screen"><div class="h1">Settings</div><div class="sub" style="margin-top:8px">Comfort settings for this TV. Changes apply instantly and are stored locally.</div>' +
        '<div class="set-grid"><div class="set-rows">' +
        settingRow('set-hc', 'highContrast', 'eye', 'High Contrast', 'Pure black background, white text and a yellow focus ring') +
        settingRow('set-lt', 'largeText', 'info', 'Large Text', 'Increases text size across PressPath TV') +
        settingRow('set-rm', 'reduceMotion', 'refresh', 'Reduce Motion', 'Turns off focus zoom, card flips and screen transitions') +
        '<div class="danger-sep"></div>' + clearRow + '</div>' +
        '<div class="info-card glass"><div class="h3">' + G('shield') + 'What is stored here</div><ul>' +
        '<li>' + G('check') + 'Guided task runs: presses, backtracks, edge misses and seconds</li>' +
        '<li>' + G('check') + 'Adaptations you applied or undid, with their evidence</li>' +
        '<li>' + G('check') + 'These three comfort settings</li>' +
        '<li>' + G('x') + 'No accounts, no network, nothing outside PressPath TV</li></ul>' +
        '<div class="kv"><span>Runs</span><b>' + S.runs.length + '</b><span>Adaptations</span><b>' + S.adaptations.length + '</b><span>Storage</span><b>On this device</b></div></div></div></div>';
    }
  };

  Screens.progress = {
    def: function () { return 'pg-task-memory'; },
    render: function () {
      var measured = TASK_IDS.filter(function (id) { return runsFor(id).length; }).length;
      var comps = TASK_IDS.filter(function (id) { return compare.compareTask(S, id).available; }).length;
      var kpi = function (n, l, icon, col) { return '<div class="kpi glass"><div class="ic" style="background:' + col + '22;color:' + col + '">' + G(icon) + '</div><div><div class="n">' + n + '</div><span class="caps">' + l + '</span></div></div>'; };
      var rowsHtml = tasks.TASKS.map(function (t) {
        var c = compare.compareTask(S, t.id);
        var b = c.before, a = c.after;
        return '<button class="prow f" id="pg-task-' + t.id + '" data-compare="' + t.id + '"><div class="t">' + t.n + '. ' + esc(t.short) + '</div>' +
          '<div class="c">' + (b ? '<b>' + fmtNum(b.presses) + '</b> · n=' + c.baselineN : 'N/A') + '</div>' +
          '<div class="c">' + (a ? '<b>' + fmtNum(a.presses) + '</b> · n=' + c.adaptiveN : 'N/A') + '</div>' +
          '<div>' + (c.available ? deltaChip(c.delta.presses, c.pct.presses) : '<span class="delta flat">N/A</span>') + '</div></button>';
      }).join('');
      var recent = S.runs.slice(-6).reverse();
      var recentHtml = recent.length ? recent.map(function (r) {
        return '<div class="item"><span class="tag ' + (r.phase === 'adaptive' ? 'azure' : 'amber') + '">#' + r.n + '</span><span class="grow">' + esc(tasks.get(r.taskId).short) + '<br><span class="small">' + fmtTime(r.startedAt) + '</span></span>' +
          '<span><b>' + r.presses + '</b> pr · <b>' + r.backtracks + '</b> bt · <b>' + r.edgeMisses + '</b> em · <b>' + fmtNum(r.seconds) + '</b> s</span></div>';
      }).join('') : '<div class="small" style="padding:20px 0">No runs recorded yet. Start a guided task in the Navigation Lab.</div>';
      return '<div class="screen"><div class="h1">Progress</div><div class="sub" style="margin-top:8px">Every number here comes from guided task runs stored on this TV.</div>' +
        '<div class="kpis">' + kpi(S.runs.length, 'Runs recorded', 'dpad', '#22C8F5') + kpi(measured + '/5', 'Tasks measured', 'target', '#C9BFFF') +
        kpi(rules.active(S).length, 'Active adaptations', 'sparkle', '#FFC247') + kpi(comps, 'Before/After available', 'chart', '#29F0AD') + '</div>' +
        '<div class="pg-grid"><div><div class="phead caps"><span>Task</span><span>Baseline median</span><span>Adaptive median</span><span>Δ presses</span></div>' +
        '<div class="rows">' + rowsHtml + '</div></div>' +
        '<div class="recent glass"><div class="h3" style="margin-bottom:6px">Recent runs</div><div class="small" style="margin-bottom:8px">pr presses · bt backtracks · em edge misses</div>' + recentHtml + '</div></div></div>';
    }
  };

  // ---------- navigation ----------
  function show(name, params, focusId, animate) {
    ui.screen = name; ui.params = params || {};
    if (name !== 'settings') ui.clearArmed = false;
    renderTopbar();
    screenEl.innerHTML = Screens[name].render(ui.params);
    var sc = screenEl.firstElementChild;
    if (animate !== false && sc) sc.classList.add('enter');
    var target = focusId && document.getElementById(focusId) ? focusId : Screens[name].def(ui.params);
    setFocus(target, true);
  }
  function go(name, params, focusId) {
    ui.history.push({ screen: ui.screen, params: ui.params, focus: ui.focus });
    if (ui.history.length > 24) ui.history.shift();
    if (name === 'deck') ui.deck = { id: null, idx: 0, revealed: false }; // a deck always opens on card 1, answer hidden
    show(name, params, focusId);
    if (name === 'deck') { log('cards:open', { deck: params.deck }); emit({ type: 'cards:open', deck: params.deck }); }
  }
  function goSection(name) {
    if (ui.screen === name) return;
    if (name === 'home') { var h = ui.history[0]; ui.history = []; show('home', {}, h && h.screen === 'home' ? h.focus : 'nav-home'); return; }
    var homeEntry = ui.screen === 'home' ? { screen: 'home', params: {}, focus: ui.focus } : (ui.history[0] && ui.history[0].screen === 'home' ? ui.history[0] : { screen: 'home', params: {}, focus: 'home-tile-lab' });
    ui.history = [homeEntry];
    show(name, {}, null);
  }
  function refresh(focusId) { show(ui.screen, ui.params, focusId || ui.focus, false); }
  function canBack() { return !!ui.overlay || ui.clearArmed || ui.history.length > 0; }
  function doBack() {
    if (ui.overlay) { closeOverlay(); return; }
    if (ui.clearArmed) { ui.clearArmed = false; refresh('set-clear'); return; }
    var prev = ui.history.pop();
    show(prev.screen, prev.params, prev.focus);
  }

  // ---------- overlays ----------
  function openOverlay(kind, data) {
    ui.overlay = { kind: kind, data: data || {}, ret: ui.focus };
    overlayEl.className = 'open';
    overlayEl.innerHTML = '<div class="scrim"></div>' + Overlays[kind].render(ui.overlay.data);
    var p = overlayEl.querySelector('.panel'); if (p) p.classList.add('enter');
    setFocus(Overlays[kind].def(ui.overlay.data), true);
  }
  function closeOverlay(silent) {
    if (!ui.overlay) return;
    var ret = ui.overlay.ret;
    ui.overlay = null;
    overlayEl.className = ''; overlayEl.innerHTML = '';
    if (!silent) setFocus(document.getElementById(ret) ? ret : Screens[ui.screen].def(ui.params), true);
  }

  var Overlays = {};
  Overlays.result = {
    def: function () { return 'tr-lab'; },
    render: function (d) {
      var r = S.runs.filter(function (x) { return x.id === d.runId; })[0];
      var t = tasks.get(r.taskId);
      var newSug = allSuggestions().filter(function (s) { return s.taskId === r.taskId; });
      var note = newSug.length
        ? '<div class="note"><b>New suggestion:</b> ' + newSug.map(function (s) { return s.rule === 'R1' ? 'Rule R1 can add a Home shortcut for this task' : 'Rule R2 can strengthen focus on the ' + esc(labelFor(s.targetId)); }).join(' · ') + '. Preview it in the Lab — nothing changes until you apply it.</div>'
        : r.phase === 'adaptive' ? '<div class="note">This adaptive run is now part of the <b>Before / After</b> comparison for this task.</div>'
          : '<div class="note">Rules check baseline runs: R1 needs ≥5 presses in ≥2 runs, R2 needs ≥3 edge misses on one element.</div>';
      var cell = function (n, l) { return '<div class="stat"><div class="n">' + n + '</div><div class="caps">' + l + '</div></div>'; };
      return '<div class="panel" style="width:1240px"><div class="result-head"><div class="badge">' + G('check') + '</div><div>' +
        '<div class="caps" style="color:' + (r.phase === 'adaptive' ? 'var(--azure-hi)' : 'var(--amber)') + '">' + (r.phase === 'adaptive' ? 'Adaptive' : 'Baseline') + ' run #' + r.n + ' recorded</div>' +
        '<div class="h2" style="margin-top:6px">' + esc(t.title) + '</div></div></div>' +
        '<div class="stats4">' + cell(r.presses, 'Presses') + cell(r.backtracks, 'Backtracks') + cell(r.edgeMisses, 'Edge misses') + cell(fmtNum(r.seconds), 'Seconds') + '</div>' +
        note + '<div class="acts"><button class="btn primary f" id="tr-lab" data-tolab="' + r.taskId + '">' + G('flask') + 'Back to Lab</button>' +
        '<button class="btn f" id="tr-again" data-run="' + r.taskId + '">' + G('refresh') + 'Run again</button></div></div>';
    }
  };

  function findSuggestion(key) {
    var parts = key.split(':');
    return allSuggestions().filter(function (s) { return s.taskId === parts[0] && s.rule === parts[1]; })[0] || null;
  }

  Overlays.preview = {
    def: function () { return 'pv-apply'; },
    render: function (d) {
      var s = d.s, t = tasks.get(s.taskId);
      var ev = s.evidence.map(function (e) {
        return '<div class="ev"><span>Baseline run #' + e.n + ' · ' + fmtTime(e.startedAt) + '</span><b>' + (s.rule === 'R1' ? e.presses + ' presses' : e.count + ' edge misses') + '</b></div>';
      }).join('');
      var left = '<div class="col"><div class="head"><div class="h3">Measured evidence</div><span class="tag azure">Rule ' + s.rule + ' triggered</span></div>' +
        '<div class="cond"><span class="caps">Trigger condition</span>' +
        (s.rule === 'R1' ? '“' + esc(t.short) + '” needed ' + s.evidence.map(function (e) { return e.presses; }).join(' and ') + ' presses in ' + plural(s.evidence.length, 'baseline run') + ' — threshold ' + esc(s.threshold) + '.'
          : esc(s.total) + ' edge misses on the ' + esc(labelFor(s.targetId)) + ' across baseline runs — threshold ' + esc(s.threshold) + '.') +
        '</div><div class="ev-list">' + ev + '</div></div>';
      var right;
      if (s.rule === 'R1') {
        var sc = t.shortcut;
        right = '<div class="col"><div class="head"><div class="h3">Preview · Home screen</div><span class="tag mint">' + G('check') + 'Reversible</span></div>' +
          '<div class="mock"><span class="caps">Your shortcuts (Home)</span><div class="mock-sc">' + art.shortcutArt(sc.art) + '<div><div style="font-weight:800;font-size:22px">' + esc(sc.label) + '</div><div class="small">' + esc(sc.sub) + '</div></div><span class="tag amber" style="margin-left:auto">Added by R1</span></div>' +
          '<div class="mock-tiles"><div>Navigation Lab</div><div>Memory Pairs</div><div>Flashcards</div><div>Progress</div><div>Settings</div></div></div>' +
          '<div class="guarantee">' + G('shield') + '<span><b>Layout stays put.</b> The five activity tiles keep their order and position; only this shortcut is added to the reserved shortcuts row. Undo is always available in the Lab.</span></div></div>';
      } else {
        right = '<div class="col"><div class="head"><div class="h3">Preview · ' + esc(labelFor(s.targetId)) + '</div><span class="tag mint">' + G('check') + 'Reversible</span></div>' +
          '<div class="focus-cmp"><div><div class="demo normal">' + esc(labelFor(s.targetId)) + '</div><div class="lbl">Normal focus</div></div>' +
          '<div><div class="demo strong">' + esc(labelFor(s.targetId)) +
          '<span class="mini-hint" style="left:50%;top:-15px;margin-left:-15px">' + G('up') + '</span><span class="mini-hint" style="right:-15px;top:50%;margin-top:-15px">' + G('right') + '</span></div>' +
          '<div class="lbl">Stronger focus + arrows showing where you can move</div></div></div>' +
          '<div class="guarantee">' + G('shield') + '<span><b>The layout order does not change.</b> Nothing moves. Only this element’s focus ring gets thicker and shows which directions lead somewhere.</span></div></div>';
      }
      return '<div class="panel"><div class="eyebrow caps">Adaptation ' + s.rule + ' · ' + (s.rule === 'R1' ? 'shortcut preview' : 'focus emphasis preview') + '</div>' +
        '<div class="h1" style="margin-top:12px">Suggested change — Rule ' + s.rule + '</div>' +
        '<div class="cols2">' + left + right + '</div>' +
        '<div class="acts"><button class="btn primary f" id="pv-apply" data-apply="1">' + G('check') + 'Apply change</button>' +
        '<button class="btn f" id="pv-cancel" data-close="1">Not now</button></div></div>';
    }
  };

  Overlays.rules = {
    def: function () { return 'rules-close'; },
    render: function () {
      return '<div class="panel" style="width:1440px"><div class="eyebrow caps">Measurement rules</div><div class="h1" style="margin-top:12px">How PressPath measures</div>' +
        '<div class="rules-list">' +
        '<div><b>Press</b>Every accepted remote input during a guided task: Up, Down, Left, Right, OK and Back.</div>' +
        '<div><b>Edge miss</b>A direction press with nothing to move to. Focus stays where it is.</div>' +
        '<div><b>Backtrack</b>A move straight back to the element you just left (A → B → A), or a Back press that returns a step.</div>' +
        '<div><b>Seconds</b>From your first press in the task to the press that completes it. Arming a task does not start the clock.</div>' +
        '<div><b>Rule R1 · Home shortcut</b>The task needed ≥5 presses in at least 2 baseline runs. Adds one shortcut; tiles never move.</div>' +
        '<div><b>Rule R2 · Focus emphasis</b>≥3 edge misses on the same element in baseline runs. Strengthens that element’s focus ring.</div>' +
        '</div><div class="note">Runs with an applied adaptation are recorded as <b>adaptive</b>. Before / After compares medians of baseline and adaptive runs, and shows N/A when either side has no runs. Nothing is estimated, and nothing leaves this TV.</div>' +
        '<div class="acts"><button class="btn primary f" id="rules-close" data-close="1">Got it</button></div></div>';
    }
  };

  Overlays.memdone = {
    def: function () { return 'mc-again'; },
    render: function (d) {
      var trophy = '<svg class="trophy" viewBox="0 0 160 160"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset="1" stop-color="#F2A516"/></linearGradient></defs>' +
        '<path d="M48 24h64v34a32 32 0 0 1-64 0z" fill="url(#tg)"/><path d="M48 34H28a20 20 0 0 0 24 26M112 34h20a20 20 0 0 1-24 26" fill="none" stroke="#F2C14E" stroke-width="7"/>' +
        '<rect x="72" y="88" width="16" height="22" fill="#E3A21A"/><rect x="50" y="110" width="60" height="16" rx="5" fill="url(#tg)"/><path d="M80 36l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#fff" opacity=".85"/></svg>';
      return '<div class="panel done-panel">' + trophy + '<div class="h1" style="margin-top:10px">Great job!</div><div class="sub" style="margin-top:8px">You found all six pairs.</div>' +
        '<div class="stats2"><div class="stat"><div class="n">6/6</div><div class="caps">Pairs found</div></div><div class="stat"><div class="n">' + d.moves + '</div><div class="caps">Moves</div></div></div>' +
        '<div class="acts"><button class="btn primary f" id="mc-again" data-newgame="1">' + G('refresh') + 'Play again</button><button class="btn f" id="mc-home" data-home="1">' + G('home') + 'Back to Home</button></div></div>';
    }
  };

  // ---------- focus ----------
  function scopeEls() {
    if (ui.overlay) return [overlayEl];
    return [$('#topbar'), screenEl];
  }
  function focusables() {
    var out = [];
    scopeEls().forEach(function (root) {
      var list = root.querySelectorAll('.f');
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.getAttribute('aria-disabled') === 'true' || !el.id) continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        out.push(el);
      }
    });
    return out;
  }
  function rectOf(el) {
    var r = el.getBoundingClientRect(), s = ui.scale || 1;
    return spatial.rectOf({ left: r.left / s, top: r.top / s, width: r.width / s, height: r.height / s }, el.id);
  }
  function setFocus(id, instant) {
    var prev = ui.focus && document.getElementById(ui.focus);
    if (prev) prev.classList.remove('is-focused');
    var el = document.getElementById(id);
    if (!el) { var fs = focusables(); el = fs[0]; }
    if (!el) { ui.focus = null; return; }
    ui.focus = el.id;
    var em = emphasized();
    el.classList.toggle('emph', !!em[el.id]);
    el.classList.add('is-focused');
    ensureVisible(el, instant);
    drawHints(el, !!em[el.id]);
  }
  function ensureVisible(el, instant) {
    var box = el.closest('.scroll');
    if (!box) return;
    var s = ui.scale || 1, br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
    var pad = 70 * s, top = box.scrollTop;
    if (er.top < br.top + pad) top -= (br.top + pad - er.top) / s;
    else if (er.bottom > br.bottom - pad) top += (er.bottom - (br.bottom - pad)) / s;
    else return;
    if (instant || S.prefs.reduceMotion) { box.style.scrollBehavior = 'auto'; box.scrollTop = top; box.style.scrollBehavior = ''; }
    else box.scrollTo({ top: top, behavior: 'smooth' });
    if (hintsEl.innerHTML) setTimeout(function () { var f = document.getElementById(ui.focus); if (f) drawHints(f, f.classList.contains('emph')); }, 420);
  }
  function drawHints(el, on) {
    hintsEl.innerHTML = '';
    if (!on) return;
    var cur = rectOf(el);
    var cands = focusables().map(function (x) { return { id: x.id, rect: rectOf(x) }; });
    var stageR = stage.getBoundingClientRect(), s = ui.scale || 1;
    var ox = stageR.left / s, oy = stageR.top / s;
    var html = '';
    spatial.availableDirections(cur, cands).forEach(function (d) {
      var x = cur.left - ox + cur.width / 2, y = cur.top - oy + cur.height / 2;
      if (d === 'up') y = cur.top - oy - 30; if (d === 'down') y = cur.bottom - oy + 30;
      if (d === 'left') x = cur.left - ox - 30; if (d === 'right') x = cur.right - ox + 30;
      html += '<div class="hint" style="left:' + x + 'px;top:' + y + 'px">' + G(d) + '</div>';
    });
    hintsEl.innerHTML = html;
  }
  function bump(el, dir) {
    if (!el || S.prefs.reduceMotion) return;
    var c = 'bump-' + dir;
    el.classList.remove(c); void el.offsetWidth; el.classList.add(c);
    setTimeout(function () { el.classList.remove(c); }, 200);
  }

  // ---------- actions ----------
  function activate(el) {
    var d = el.dataset;
    if (d.go) {
      if (el.classList.contains('navpill')) goSection(d.go);
      else go(d.go, {}, null);
    } else if (d.sc) {
      var sc = tasks.get(d.sc).shortcut;
      log('shortcut', { task: d.sc });
      go(sc.screen, sc.params, sc.focus);
    } else if (d.run) {
      startTask(d.run);
    } else if (d.preview) {
      var s = findSuggestion(d.preview);
      if (s) openOverlay('preview', { s: s });
    } else if (d.apply) {
      var sug = ui.overlay.data.s;
      var a = rules.apply(S, sug, nowIso());
      save();
      log('adapt:apply', { id: a && a.id, rule: sug.rule, task: sug.taskId, target: sug.targetId || null });
      closeOverlay(true);
      refresh('lab-run-' + sug.taskId);
      toast(sug.rule === 'R1' ? 'Shortcut added to Home. Run the task again to measure it.' : 'Stronger focus applied. Run the task again to measure it.', 'ok');
    } else if (d.undo) {
      var u = rules.undo(S, d.undo, nowIso());
      save();
      log('adapt:undo', { id: d.undo });
      refresh();
      if (u) toast('Undone: ' + changeTitle(u) + '. Recorded runs are kept.', 'ok');
    } else if (d.compare) {
      go('compare', { taskId: d.compare }, null);
    } else if (d.rules) {
      openOverlay('rules');
    } else if (d.close) {
      closeOverlay();
    } else if (d.back) {
      doBack();
    } else if (d.tolab) {
      closeOverlay(true);
      ui.history = [{ screen: 'home', params: {}, focus: 'home-tile-lab' }];
      show('lab', {}, 'lab-run-' + d.tolab);
    } else if (d.home) {
      closeOverlay(true);
      ui.history = [];
      show('home', {}, 'home-tile-memory');
    } else if (d.card) {
      flipCard(Number(d.card));
    } else if (d.newgame) {
      if (ui.overlay) closeOverlay(true);
      ui.game = null;
      refresh('mem-card-0');
    } else if (d.deck) {
      go('deck', { deck: d.deck }, 'fc-reveal');
    } else if (d.fc) {
      var deck = decks.get(ui.deck.id);
      if (d.fc === 'reveal') {
        ui.deck.revealed = !ui.deck.revealed;
        refresh('fc-reveal');
        if (ui.deck.revealed) { log('cards:reveal', { deck: ui.deck.id, card: ui.deck.idx }); emit({ type: 'cards:reveal', deck: ui.deck.id }); }
      } else if (d.fc === 'next') {
        ui.deck.idx = (ui.deck.idx + 1) % deck.cards.length; ui.deck.revealed = false; refresh('fc-next');
      } else if (d.fc === 'prev' && ui.deck.idx > 0) {
        ui.deck.idx -= 1; ui.deck.revealed = false; refresh(ui.deck.idx === 0 ? 'fc-reveal' : 'fc-prev');
      }
    } else if (d.pref) {
      setPref(d.pref, !S.prefs[d.pref]);
      refresh(el.id);
    } else if (d.clear) {
      if (d.clear === 'arm') { ui.clearArmed = true; refresh('set-clear-cancel'); }
      else if (d.clear === 'cancel') { ui.clearArmed = false; refresh('set-clear'); }
      else if (d.clear === 'confirm') {
        S = store.clear(storage);
        ui.clearArmed = false; ui.task = null; ui.game = null; renderHud();
        applyPrefs();
        log('data:cleared');
        refresh('set-clear');
        toast('All local data cleared. PressPath TV is back to a fresh start.', 'ok');
      }
    }
  }

  // ---------- input dispatcher ----------
  var DIRS = { up: 1, down: 1, left: 1, right: 1 };
  function input(action, source) {
    if (ui.splash) { dismissSplash(); return; }
    if (ui.lock) return;
    var cur = ui.focus && document.getElementById(ui.focus);
    if (DIRS[action]) {
      if (!cur) { setFocus(Screens[ui.screen].def(ui.params)); return; }
      var cands = focusables().map(function (el) { return { id: el.id, rect: rectOf(el) }; });
      var next = spatial.findNext(rectOf(cur), cands, action);
      if (next) { rec(action, cur.id, next, 'move'); setFocus(next); }
      else { rec(action, cur.id, null, 'edge'); bump(cur, action); }
      return;
    }
    if (action === 'ok') {
      if (!cur) return;
      rec('ok', cur.id, null, 'select');
      activate(cur);
      return;
    }
    if (action === 'back') {
      if (canBack()) { rec('back', cur ? cur.id : null, null, 'back'); doBack(); return; }
      if (ui.task) { cancelTask(); return; }
      if (ui.screen !== 'home') { show('home', {}, null); return; }
      var t = Date.now();
      if (isNative && t - ui.exitArmedAt < 2200) { log('exit'); window.PressPathNative.exitApp(); return; }
      ui.exitArmedAt = t;
      toast(isNative ? 'Press Back again to exit PressPath TV.' : 'You are on Home.', 'info');
    }
  }

  var KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', BrowserBack: 'back', GoBack: 'back' };
  function onKey(e) {
    var a = KEYMAP[e.key] || (e.keyCode === 4 ? 'back' : null);
    if (!a) return;
    e.preventDefault();
    if (e.repeat && !DIRS[a]) return;
    input(a, 'keyboard');
  }

  // Gamepad (browsers). Inside the Android wrapper, controllers arrive as native key events.
  var pad = { held: {}, next: {} };
  function pollPads() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var state = {};
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      if (!p) continue;
      var b = function (n) { return p.buttons[n] && p.buttons[n].pressed; };
      var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b(12) || ay < -0.6) state.up = true;
      if (b(13) || ay > 0.6) state.down = true;
      if (b(14) || ax < -0.6) state.left = true;
      if (b(15) || ax > 0.6) state.right = true;
      if (b(0)) state.ok = true;
      if (b(1)) state.back = true;
    }
    var t = performance.now();
    ['up', 'down', 'left', 'right', 'ok', 'back'].forEach(function (k) {
      if (state[k] && !pad.held[k]) { pad.held[k] = true; pad.next[k] = t + 420; input(k, 'gamepad'); }
      else if (state[k] && DIRS[k] && t >= pad.next[k]) { pad.next[k] = t + 140; input(k, 'gamepad'); }
      else if (!state[k]) pad.held[k] = false;
    });
    requestAnimationFrame(pollPads);
  }

  // ---------- splash ----------
  function dismissSplash() {
    ui.splash = false;
    var sp = $('#splash');
    sp.classList.add('gone');
    setTimeout(function () { sp.style.display = 'none'; }, 550);
    log('splash:dismissed');
  }
  function renderSplash() {
    $('#splash').innerHTML =
      '<svg class="grid" viewBox="0 0 1920 420" preserveAspectRatio="none">' + pathLines() + '</svg>' +
      '<div class="left">' + art.logo() + '<div class="word">PressPath <b>TV</b></div>' +
      '<div class="tag2">Every press counts.<br><em>Every path gets smarter.</em></div>' +
      '<div class="press"><span class="key ok">OK</span>Press OK to begin</div></div>' +
      '<div class="remote">' + art.remote() + '</div>' +
      '<div class="foot"><span class="caps">' + G('lock') + ' Stored locally</span><span>Family activities · navigation measured on this TV</span></div>';
  }
  function pathLines() {
    var s = '<defs><linearGradient id="pl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22C8F5" stop-opacity="0"/><stop offset=".5" stop-color="#22C8F5"/><stop offset="1" stop-color="#7B61FF" stop-opacity="0"/></linearGradient></defs>';
    for (var i = 0; i < 9; i++) s += '<path d="M' + (960 + (i - 4) * 60) + ' 0 L' + (960 + (i - 4) * 420) + ' 420" stroke="rgba(141,224,255,.18)" stroke-width="1.5"/>';
    for (var j = 0; j < 6; j++) { var y = 40 + j * j * 12; s += '<path d="M0 ' + y + ' H1920" stroke="rgba(141,224,255,' + (0.05 + j * 0.03) + ')" stroke-width="1.5"/>'; }
    s += '<path d="M300 400 C600 300 800 330 960 230 S1400 120 1700 60" fill="none" stroke="url(#pl)" stroke-width="5"/>';
    [[300, 400], [700, 315], [960, 230], [1300, 150], [1700, 60]].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#22C8F5"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="20" fill="none" stroke="rgba(34,200,245,.35)" stroke-width="3"/>'; });
    return s;
  }

  // ---------- boot ----------
  function boot() {
    stage = $('#stage'); screenEl = $('#screen'); overlayEl = $('#overlay'); hudEl = $('#hud'); toastEl = $('#toast'); hintsEl = $('#hints');
    $('.bg').insertAdjacentHTML('beforeend', '<svg class="path" viewBox="0 0 1920 420" preserveAspectRatio="none">' + pathLines() + '</svg>');
    applyPrefs();
    fit();
    window.addEventListener('resize', fit);
    renderFooter();
    renderSplash();
    show('home', {}, 'home-tile-lab', false);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', function (e) {
      if (ui.splash) { dismissSplash(); return; }
      // Pointer input is a convenience for desktop review only. It is never recorded,
      // so it is ignored while a guided task is measuring the remote.
      if (ui.task || ui.lock) { toast('Use the remote or keyboard during a guided task.', 'warn'); return; }
      var el = e.target.closest && e.target.closest('.f');
      if (el && el.id) { setFocus(el.id); activate(el); }
    });
    setInterval(tick, 15000);
    if (!isNative && navigator.getGamepads) requestAnimationFrame(pollPads);
    if (loaded.recovered) toast('Stored data could not be read and was reset. The old copy was kept aside.', 'warn');
    log('boot', { runs: S.runs.length, adaptations: S.adaptations.length, native: isNative });
  }

  // Public surface: native bridge input + read-only state for diagnostics/tests.
  window.PressPath = {
    input: function (a, src) { input(a, src || 'remote'); },
    state: function () { return JSON.parse(JSON.stringify(S)); },
    ui: function () { return { screen: ui.screen, focus: ui.focus, overlay: ui.overlay && ui.overlay.kind, task: ui.task ? { taskId: ui.task.taskId, phase: ui.task.phase, events: ui.task.events.length } : null, splash: ui.splash, history: ui.history.length, clearArmed: ui.clearArmed, lock: ui.lock }; },
    game: function () { return ui.game ? JSON.parse(JSON.stringify(ui.game)) : null; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
