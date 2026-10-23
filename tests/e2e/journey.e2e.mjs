// Full keyboard-only journey at 1920 x 1080 in a fresh browser profile.
// Every number asserted below is produced by the real key presses this test sends.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { openApp, focusLabRun, navTo, ROOT } from './helpers.mjs';

const SHOTS = join(ROOT, 'evidence', 'browser-1080');
const measured = []; // journey numbers as measured, written to evidence/browser-1080/journey.json

async function finishTask(app) {
  await app.waitFor(`PressPath.ui().overlay === 'result'`);
  const st = await app.state();
  return st.runs[st.runs.length - 1];
}

async function solveMemory(app) {
  const g = await app.b.eval('PressPath.game()');
  const bySym = {};
  g.cards.forEach((c) => { if (!c.matched) (bySym[c.sym] = bySym[c.sym] || []).push(c.i); });
  const goTo = async (to) => {
    const from = Number((await app.focus()).replace('mem-card-', ''));
    const dr = Math.floor(to / 4) - Math.floor(from / 4), dc = (to % 4) - (from % 4);
    for (let i = 0; i < Math.abs(dr); i++) await app.key(dr > 0 ? 'down' : 'up');
    for (let i = 0; i < Math.abs(dc); i++) await app.key(dc > 0 ? 'right' : 'left');
    await app.expectFocus('mem-card-' + to);
  };
  return { bySym, goTo };
}

test('PressPath TV keyboard-only journey (1920x1080)', { timeout: 600000 }, async (t) => {
  const app = await openApp({ width: 1920, height: 1080, shots: SHOTS });
  try {
    await t.test('splash is shown and dismissed by a key press', async () => {
      assert.equal((await app.ui()).splash, true);
      await app.shot('01-splash');
      await app.key('ok', { wait: 700 });
      assert.equal((await app.ui()).splash, false);
    });

    await t.test('home first launch: honest empty evidence, one focus, fits 1080p', async () => {
      await app.expectFocus('home-tile-lab');
      await app.checkFocus();
      await app.noPageOverflow();
      const text = await app.auditText();
      assert.match(text, /No measured runs yet/);
      assert.match(text, /No shortcuts yet/);
      await app.shot('02-home-empty');
    });

    await t.test('focus restoration after Back', async () => {
      await app.press('right right ok');
      assert.equal((await app.ui()).screen, 'learn');
      await app.press('right right ok');
      assert.equal((await app.ui()).screen, 'deck');
      await app.key('back');
      await app.expectFocus('deck-science', 'Back returns to the deck that was opened');
      await app.key('back');
      await app.expectFocus('home-tile-cards', 'Back returns to the Flashcards tile');
      await app.press('left left');
      await app.expectFocus('home-tile-lab');
    });

    await t.test('navigation lab empty state', async () => {
      await app.key('ok', { wait: 400 });
      assert.equal((await app.ui()).screen, 'lab');
      const s = await app.b.eval(`({ steps: !!document.querySelector('.steps3'), strip: !!document.querySelector('.strip'), suggest: !!document.querySelector('.suggest'), notYet: (document.querySelector('.rows').innerText.match(/Not measured yet/g) || []).length })`);
      assert.deepEqual(s, { steps: true, strip: false, suggest: false, notYet: 5 });
      await app.checkFocus();
      await app.auditText();
      await app.shot('03-lab-empty');
      await app.press('right up');
      await app.expectFocus('lab-rules');
      await app.key('ok', { wait: 400 });
      assert.equal((await app.ui()).overlay, 'rules');
      await app.shot('04-measurement-rules');
      await app.key('back', { wait: 300 });
      await app.expectFocus('lab-rules');
    });

    await t.test('back on Home cancels an armed task without recording', async () => {
      await focusLabRun(app, 'letters');
      await app.key('ok', { wait: 300 });
      assert.equal((await app.ui()).task.taskId, 'letters');
      await app.key('back', { wait: 300 });
      assert.equal((await app.ui()).task, null);
      assert.equal((await app.state()).runs.length, 0);
      await app.key('up'); // to the nav bar
      await app.press('right ok');
      assert.equal((await app.ui()).screen, 'lab');
    });

    await t.test('science baseline x2 records real presses; R1 is suggested', async () => {
      for (let i = 1; i <= 2; i++) {
        await focusLabRun(app, 'science');
        await app.key('ok', { wait: 300 });
        const u = await app.ui();
        assert.deepEqual([u.screen, u.focus, u.task.phase], ['home', 'home-tile-lab', 'baseline']);
        await app.press('right right ok right right ok');
        if (i === 1) { await app.shot('05-task-live-hud'); }
        await app.key('ok');
        const run = await finishTask(app);
        assert.equal(run.taskId, 'science');
        assert.equal(run.phase, 'baseline');
        assert.equal(run.presses, 7);
        assert.equal(run.backtracks, 0);
        assert.equal(run.edgeMisses, 0);
        assert.ok(run.seconds > 0);
        measured.push({ step: 'science baseline ' + i, presses: run.presses, backtracks: run.backtracks, edgeMisses: run.edgeMisses, seconds: run.seconds });
        if (i === 1) await app.shot('06-task-result');
        await app.expectFocus('tr-lab');
        await app.key('ok', { wait: 400 });
      }
      const text = await app.auditText();
      assert.match(text, /Suggested adaptation/);
      await app.expectFocus('lab-run-science');
      await app.shot('07-lab-suggestion');
    });

    await t.test('R1 preview cites the real runs; apply adds a Home shortcut', async () => {
      await app.key('right');
      await app.expectFocus('lab-adapt-science');
      await app.key('ok', { wait: 400 });
      assert.equal((await app.ui()).overlay, 'preview');
      const txt = await app.auditText();
      assert.match(txt, /Baseline run #1/);
      assert.match(txt, /Baseline run #2/);
      assert.match(txt, /needed 7 and 7 presses in 2 baseline runs/);
      await app.checkFocus();
      await app.shot('08-r1-preview');
      await app.key('ok', { wait: 400 });
      const st = await app.state();
      assert.equal(st.adaptations.length, 1);
      assert.equal(st.adaptations[0].rule, 'R1');
      assert.deepEqual(st.adaptations[0].evidenceRunIds, ['r1', 'r2']);
      await app.expectFocus('lab-run-science');
    });

    await t.test('adaptive science run uses the shortcut', async () => {
      await app.key('ok', { wait: 300 });
      const u = await app.ui();
      assert.equal(u.task.phase, 'adaptive');
      assert.ok(await app.b.eval(`!!document.getElementById('sc-science')`), 'shortcut is on Home');
      const tileBefore = await app.b.eval(`[...document.querySelectorAll('.tile')].map(t => t.id).join(',')`);
      assert.equal(tileBefore, 'home-tile-lab,home-tile-memory,home-tile-cards,home-tile-progress,home-tile-settings', 'tile order unchanged');
      await app.key('up');
      await app.expectFocus('sc-science');
      await app.press('ok ok');
      const run = await finishTask(app);
      assert.equal(run.phase, 'adaptive');
      assert.equal(run.presses, 3);
      measured.push({ step: 'science adaptive (R1 shortcut)', presses: run.presses, backtracks: run.backtracks, edgeMisses: run.edgeMisses, seconds: run.seconds });
      await app.key('ok', { wait: 400 });
    });

    await t.test('lab shows the measured evidence strip', async () => {
      const strip = await app.b.eval(`document.querySelector('.strip') && document.querySelector('.strip').innerText`);
      assert.ok(strip, 'strip present');
      assert.match(strip, /7\s*presses/);
      assert.match(strip, /3\s*presses/);
      await app.checkFocus();
      await app.shot('09-lab-measured');
    });

    await t.test('before/after renders the measured pair', async () => {
      await app.press('right right');
      await app.expectFocus('lab-compare-science');
      await app.key('ok', { wait: 400 });
      assert.equal((await app.ui()).screen, 'compare');
      const txt = await app.auditText();
      assert.match(txt, /7 → 3 presses/);
      assert.match(txt, /Δ −4 \(−57%\)/);
      await app.checkFocus();
      await app.noPageOverflow();
      await app.shot('10-before-after');
    });

    await t.test('home shows the earned shortcut and the measured comparison', async () => {
      await app.press('up');
      const f = await app.focus();
      assert.ok(f.startsWith('nav-'), 'Up reaches the top navigation');
      for (let i = 0; i < 6 && (await app.focus()) !== 'nav-home'; i++) await app.key('left');
      await app.key('ok', { wait: 400 });
      assert.equal((await app.ui()).screen, 'home');
      const txt = await app.auditText();
      assert.match(txt, /Science Cards/);
      assert.match(txt, /added by r1/i);
      assert.match(txt, /Science cards · reveal/);
      assert.match(txt, /Before \/ After · median of 2 baseline runs vs 1 adaptive run/);
      await app.key('up');
      await app.expectFocus('sc-science');
      await app.checkFocus();
      await app.shot('11-home-filled');
    });

    await t.test('undo restores the original Home; runs are kept', async () => {
      await navTo(app, 'lab');
      await focusLabRun(app, 'science');
      await app.press('right right ok');
      assert.equal((await app.ui()).screen, 'compare');
      await app.press('right');
      await app.expectFocus('ba-undo');
      await app.key('ok', { wait: 400 });
      const st = await app.state();
      assert.ok(st.adaptations[0].undoneAt, 'adaptation marked undone');
      assert.equal(st.runs.length, 3, 'runs untouched');
      await app.key('back', { wait: 300 });
      await app.key('back', { wait: 300 });
      assert.equal((await app.ui()).screen, 'home');
      assert.equal(await app.b.eval(`!!document.getElementById('sc-science')`), false, 'shortcut removed');
      assert.equal(await app.b.eval(`document.querySelectorAll('.tile').length`), 5);
    });

    await t.test('R2: three real edge misses on one element suggest stronger focus', async () => {
      await navTo(app, 'lab');
      await focusLabRun(app, 'memory');
      await app.key('ok', { wait: 300 });
      await app.press('left left left right ok');
      assert.equal((await app.ui()).screen, 'play');
      await app.key('ok');
      const run = await finishTask(app);
      assert.equal(run.edgeMisses, 3);
      assert.deepEqual(run.edgeByTarget, { 'home-tile-lab': 3 });
      assert.equal(run.presses, 6);
      measured.push({ step: 'memory baseline (3 deliberate edge presses)', presses: run.presses, backtracks: run.backtracks, edgeMisses: run.edgeMisses, seconds: run.seconds });
      await app.key('ok', { wait: 400 });
      await app.key('right');
      await app.expectFocus('lab-adapt-memory');
      assert.match(await app.b.eval(`document.getElementById('lab-adapt-memory').innerText`), /Preview R2/);
      await app.key('ok', { wait: 400 });
      const txt = await app.auditText();
      assert.match(txt, /layout order does not change/i);
      assert.match(txt, /3 edge misses on the Navigation Lab tile/);
      await app.shot('12-r2-preview');
      await app.key('ok', { wait: 400 });
      assert.equal((await app.state()).adaptations[1].targetId, 'home-tile-lab');
    });

    await t.test('R2 adaptive run shows stronger focus with direction hints', async () => {
      await app.key('ok', { wait: 400 });
      assert.equal((await app.ui()).task.phase, 'adaptive');
      const em = await app.b.eval(`({ emph: !!document.querySelector('#home-tile-lab.emph.is-focused'), hints: document.querySelectorAll('#hints .hint').length })`);
      assert.equal(em.emph, true);
      assert.equal(em.hints, 2, 'up and right are the only moves from the first tile');
      await app.shot('13-r2-emphasis-live');
      await app.press('right ok ok');
      const run = await finishTask(app);
      assert.equal(run.phase, 'adaptive');
      assert.equal(run.edgeMisses, 0);
      measured.push({ step: 'memory adaptive (R2 emphasis)', presses: run.presses, backtracks: run.backtracks, edgeMisses: run.edgeMisses, seconds: run.seconds });
      await app.key('ok', { wait: 400 });
    });

    await t.test('remaining guided tasks complete on their real actions', async () => {
      const plans = { contrast: 'right right right right ok ok', largetext: 'right right right right ok down ok', letters: 'right right ok ok' };
      const expect = { contrast: 6, largetext: 7, letters: 4 };
      for (const id of ['contrast', 'largetext', 'letters']) {
        await focusLabRun(app, id);
        await app.key('ok', { wait: 300 });
        await app.press(plans[id]);
        const run = await finishTask(app);
        assert.equal(run.taskId, id);
        assert.equal(run.presses, expect[id]);
        measured.push({ step: id + ' baseline', presses: run.presses, backtracks: run.backtracks, edgeMisses: run.edgeMisses, seconds: run.seconds });
        await app.key('ok', { wait: 400 });
      }
      const st = await app.state();
      assert.equal(st.prefs.highContrast, true, 'task 3 really enabled High Contrast');
      assert.equal(st.prefs.largeText, true, 'task 4 really enabled Large Text');
    });

    await t.test('before/after shows N/A without an adaptive run', async () => {
      await focusLabRun(app, 'letters');
      await app.press('right');
      await app.expectFocus('lab-compare-letters');
      await app.key('ok', { wait: 400 });
      const txt = await app.auditText();
      assert.match(txt, /Not enough data to compare/);
      assert.match(txt, /N\/A/);
      await app.checkFocus();
      await app.shot('14-before-after-na');
      await app.key('back', { wait: 300 });
    });

    await t.test('settings: high contrast variant, toggles and persistence', async () => {
      await navTo(app, 'settings');
      await app.expectFocus('set-hc');
      await app.press('down ok'); // Large Text off
      assert.equal((await app.state()).prefs.largeText, false);
      await app.key('up');
      assert.ok(await app.b.eval(`document.documentElement.classList.contains('hc')`));
      await app.checkFocus();
      await app.auditText();
      await app.shot('15-settings-hc');
      await app.key('ok'); // High Contrast off
      await app.press('down down');
      await app.expectFocus('set-rm');
      await app.key('ok');
      assert.ok(await app.b.eval(`document.documentElement.classList.contains('rm')`));
      const tr = await app.b.eval(`getComputedStyle(document.getElementById('set-rm')).transitionDuration`);
      assert.match(tr, /^0s/, 'reduce motion disables transitions');
      await app.key('ok');
      await app.key('up', { wait: 400 });
      await app.shot('16-settings');
      const st = await app.state();
      assert.deepEqual(st.prefs, { highContrast: false, largeText: false, reduceMotion: false });
    });

    await t.test('large text keeps Home inside the 1080p stage', async () => {
      await app.expectFocus('set-lt');
      await app.key('ok'); // Large Text on
      assert.equal((await app.state()).prefs.largeText, true);
      await app.key('back', { wait: 400 });
      assert.equal((await app.ui()).screen, 'home');
      const fit = await app.b.eval(`(() => { const t = document.querySelector('.tiles').getBoundingClientRect(); const f = document.getElementById('footer').getBoundingClientRect(); const sub = document.querySelector('.hero .sub').getBoundingClientRect(); const ev = document.querySelector('.evidence').getBoundingClientRect(); const s = document.querySelector('.shortcuts .head').getBoundingClientRect(); return { tilesBottom: t.bottom, footerTop: f.top, heroBottom: Math.max(sub.bottom, ev.bottom), shortcutsTop: s.top }; })()`);
      assert.ok(fit.tilesBottom <= fit.footerTop, `tiles (${fit.tilesBottom}) above footer (${fit.footerTop})`);
      assert.ok(fit.heroBottom <= fit.shortcutsTop + 1, `hero text (${fit.heroBottom}) does not overlap the shortcuts label (${fit.shortcutsTop})`);
      await app.shot('17-home-large-text');
      await navTo(app, 'settings');
      await app.press('down ok');
      assert.equal((await app.state()).prefs.largeText, false);
    });

    await t.test('memory pairs: full game with the remote, completion and replay', async () => {
      await navTo(app, 'play');
      await app.press('right right right up');
      await app.expectFocus('mem-new');
      await app.key('ok', { wait: 400 });
      await app.expectFocus('mem-card-0');
      const { bySym, goTo } = await solveMemory(app);
      const syms = Object.keys(bySym);
      let first = true;
      for (const s of syms) {
        const [a, b] = bySym[s];
        await goTo(a); await app.key('ok', { wait: 250 });
        await goTo(b); await app.key('ok', { wait: 450 });
        if (first) {
          const g = await app.b.eval('PressPath.game()');
          assert.equal(g.pairs, 1); assert.equal(g.moves, 1);
          await app.checkFocus();
          await app.shot('18-play');
          first = false;
        }
      }
      await app.waitFor(`PressPath.ui().overlay === 'memdone'`);
      const txt = await app.auditText();
      assert.match(txt, /6\/6/);
      assert.ok(!/time|timer|score/i.test(await app.b.eval(`document.querySelector('.done-panel').innerText`)), 'no timer or score on completion');
      await app.shot('19-memory-complete');
      await app.key('ok', { wait: 500 }); // Play again
      const g = await app.b.eval('PressPath.game()');
      assert.deepEqual([g.pairs, g.moves, g.complete], [0, 0, false]);
    });

    await t.test('flashcards: question, reveal, next, previous, return', async () => {
      await navTo(app, 'learn');
      await app.shot('20-learn');
      await app.press('right right ok');
      await app.expectFocus('fc-reveal');
      assert.match(await app.auditText(), /card 1 of 10/i);
      await app.shot('21-learn-question');
      await app.key('ok', { wait: 300 });
      assert.ok(await app.b.eval(`!!document.getElementById('fc-answer')`));
      await app.shot('22-learn-revealed');
      await app.press('right ok');
      assert.match(await app.auditText(), /card 2 of 10/i);
      assert.equal(await app.b.eval(`!!document.getElementById('fc-answer')`), false, 'next card starts hidden');
      await app.press('left left ok');
      assert.match(await app.auditText(), /card 1 of 10/i);
      await app.expectFocus('fc-reveal', 'Previous on card 2 lands on Reveal when Previous disables');
      await app.key('back', { wait: 300 });
      await app.expectFocus('deck-science');
    });

    await t.test('progress shows stored measurements only', async () => {
      await navTo(app, 'progress');
      const txt = await app.auditText();
      assert.match(txt, /runs recorded/i);
      const runs = (await app.state()).runs.length;
      assert.match(txt, new RegExp('\\b' + runs + '\\s*RUNS RECORDED', 'i'));
      await app.checkFocus();
      await app.shot('23-progress');
    });

    await t.test('data persists across a reload', async () => {
      const before = await app.state();
      await app.b.reload();
      assert.equal((await app.ui()).splash, true);
      await app.key('ok', { wait: 600 });
      const after = await app.state();
      assert.equal(after.runs.length, before.runs.length);
      assert.deepEqual(after.adaptations, before.adaptations);
      assert.deepEqual(after.prefs, before.prefs);
    });

    await t.test('clear data needs confirmation; cancel keeps data; confirm clears', async () => {
      await app.press('right right right right ok');
      await app.press('down down down');
      await app.expectFocus('set-clear');
      await app.key('ok', { wait: 300 });
      await app.expectFocus('set-clear-cancel');
      assert.equal((await app.ui()).clearArmed, true);
      await app.checkFocus();
      await app.shot('24-clear-confirm');
      await app.key('ok', { wait: 300 });
      await app.expectFocus('set-clear');
      assert.ok((await app.state()).runs.length > 0, 'cancel kept the data');
      await app.key('ok', { wait: 300 });
      await app.key('back', { wait: 300 });
      assert.equal((await app.ui()).clearArmed, false, 'Back also cancels');
      await app.expectFocus('set-clear');
      await app.key('ok', { wait: 300 });
      await app.key('right');
      await app.expectFocus('set-clear-confirm');
      await app.key('ok', { wait: 400 });
      const st = await app.state();
      assert.deepEqual([st.runs.length, st.adaptations.length], [0, 0]);
      assert.match(await app.auditText(), /All local data cleared/);
      await navTo(app, 'lab');
      const s = await app.b.eval(`({ steps: !!document.querySelector('.steps3'), strip: !!document.querySelector('.strip'), notYet: (document.querySelector('.rows').innerText.match(/Not measured yet/g) || []).length })`);
      assert.deepEqual(s, { steps: true, strip: false, notYet: 5 });
      await app.shot('25-lab-after-clear');
      await app.b.reload();
      assert.equal((await app.state()).runs.length, 0, 'clear is persisted');
    });

    const errs = app.b.consoleLines.filter((l) => /EXCEPTION|Uncaught/.test(l));
    assert.deepEqual(errs, [], 'no runtime exceptions');
  } finally {
    writeFileSync(join(SHOTS, 'journey.json'), JSON.stringify({ viewport: '1920x1080', measuredAt: new Date().toISOString(), runs: measured, console: app.b.consoleLines.filter((l) => l.startsWith('[PP]')) }, null, 2));
    await app.close();
  }
});
