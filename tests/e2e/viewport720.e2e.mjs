// 1280 x 720: the fixed 1920 x 1080 stage scales down; navigation and measurement are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { openApp, focusLabRun, navTo, ROOT } from './helpers.mjs';

const SHOTS = join(ROOT, 'evidence', 'browser-720');

test('PressPath TV at 1280x720', { timeout: 300000 }, async (t) => {
  const app = await openApp({ width: 1280, height: 720, shots: SHOTS });
  try {
    await t.test('stage scales to fit 720p without page scroll', async () => {
      const m = await app.b.eval(`(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, t: r.top }; })()`);
      assert.ok(Math.abs(m.w - 1280) < 1 && Math.abs(m.h - 720) < 1, `stage fills the viewport (${m.w}x${m.h})`);
      await app.noPageOverflow();
      await app.shot('01-splash');
      await app.key('ok', { wait: 700 });
      await app.checkFocus();
      await app.shot('02-home');
    });

    for (const [section, name] of [['lab', '03-lab'], ['play', '04-play'], ['learn', '05-learn'], ['progress', '06-progress'], ['settings', '07-settings']]) {
      await t.test(`${section} renders with one visible focus`, async () => {
        await navTo(app, section);
        assert.equal((await app.ui()).screen, section);
        await app.checkFocus();
        await app.noPageOverflow();
        await app.auditText();
        await app.shot(name);
      });
    }

    await t.test('same key path gives the same measurement at 720p', async () => {
      await navTo(app, 'lab');
      await focusLabRun(app, 'science');
      await app.key('ok', { wait: 300 });
      await app.press('right right ok right right ok ok');
      await app.waitFor(`PressPath.ui().overlay === 'result'`);
      const st = await app.state();
      const run = st.runs[st.runs.length - 1];
      assert.equal(run.presses, 7);
      assert.equal(run.edgeMisses, 0);
      await app.shot('08-task-result');
      await app.key('ok', { wait: 400 });
    });

    await t.test('large text: lab rows scroll into view with the D-pad, nothing clipped', async () => {
      await navTo(app, 'settings');
      await app.press('down ok');
      assert.equal((await app.state()).prefs.largeText, true);
      await navTo(app, 'lab');
      for (const id of ['memory', 'science', 'contrast', 'largetext', 'letters']) {
        await focusLabRun(app, id);
        await app.b.sleep(450);
        await app.checkFocus();
      }
      await app.shot('09-lab-large-text-scrolled');
      for (const id of ['largetext', 'contrast', 'science', 'memory']) { await focusLabRun(app, id); await app.b.sleep(450); await app.checkFocus(); }
      await navTo(app, 'learn');
      await app.press('right right ok ok');
      await app.checkFocus();
      await app.shot('10-learn-revealed-large-text');
    });
  } finally {
    await app.close();
  }
});
