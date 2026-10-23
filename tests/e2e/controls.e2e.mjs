// Gamepad, alternative keys, accessibility modes and storage recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './helpers.mjs';

// A scriptable stand-in for the browser Gamepad API (standard mapping: 0 = A, 1 = B, 12-15 = D-pad).
const PAD = `
  window.__pad = { buttons: Array(17).fill(false), axes: [0, 0, 0, 0] };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [{ id: 'mock', mapping: 'standard', connected: true,
    buttons: window.__pad.buttons.map((p) => ({ pressed: p, value: p ? 1 : 0 })), axes: window.__pad.axes.slice() }] });
`;

async function tap(app, idx) {
  await app.b.eval(`window.__pad.buttons[${idx}] = true`);
  await app.b.sleep(160); // a real button press lasts well over one frame
  await app.b.eval(`window.__pad.buttons[${idx}] = false`);
  await app.b.sleep(160);
}

test('gamepad D-pad, stick, A and B drive the app', { timeout: 120000 }, async () => {
  const app = await openApp({ init: PAD });
  try {
    await app.b.sleep(300);
    await tap(app, 0); // A dismisses the splash
    assert.equal((await app.ui()).splash, false);
    await app.expectFocus('home-tile-lab');
    await tap(app, 15);
    await app.expectFocus('home-tile-memory', 'D-pad right');
    await tap(app, 14);
    await app.expectFocus('home-tile-lab', 'D-pad left');
    await app.b.eval(`window.__pad.axes[0] = 0.95`); await app.b.sleep(160); await app.b.eval(`window.__pad.axes[0] = 0`); await app.b.sleep(160);
    await app.expectFocus('home-tile-memory', 'left stick right');
    await tap(app, 15);
    await tap(app, 0);
    assert.equal((await app.ui()).screen, 'learn', 'A selects');
    await tap(app, 1);
    assert.equal((await app.ui()).screen, 'home', 'B goes back');
    await app.expectFocus('home-tile-cards', 'focus restored after B');
    // a guided task records gamepad presses like remote presses
    await tap(app, 14); await tap(app, 14);
    await tap(app, 0);
    assert.equal((await app.ui()).screen, 'lab');
    await tap(app, 0); // Run baseline: memory
    assert.equal((await app.ui()).task.taskId, 'memory');
    await tap(app, 15); await tap(app, 0); await tap(app, 0);
    await app.waitFor(`PressPath.ui().overlay === 'result'`);
    const st = await app.state();
    assert.equal(st.runs[0].presses, 3);
  } finally { await app.close(); }
});

test('keyboard alternatives: Backspace is Back, mouse clicks are ignored during tasks', { timeout: 120000 }, async () => {
  const app = await openApp();
  try {
    await app.key('ok', { wait: 600 });
    await app.press('right ok');
    assert.equal((await app.ui()).screen, 'play');
    await app.b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await app.b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await app.b.sleep(300);
    assert.equal((await app.ui()).screen, 'home');
    await app.press('left ok');
    await app.key('ok', { wait: 300 }); // start memory baseline
    assert.ok((await app.ui()).task);
    await app.b.eval(`document.getElementById('home-tile-memory').click()`);
    await app.b.sleep(200);
    assert.equal((await app.ui()).screen, 'home', 'click ignored while measuring');
    assert.equal((await app.ui()).task.events, 0, 'click not recorded as a press');
  } finally { await app.close(); }
});

test('reduce motion removes focus zoom; high contrast uses a yellow focus ring', { timeout: 120000 }, async () => {
  const app = await openApp();
  try {
    await app.key('ok', { wait: 600 });
    const zoom = await app.b.eval(`getComputedStyle(document.querySelector('.is-focused')).transform`);
    assert.notEqual(zoom, 'none', 'focus zoom is on by default');
    await app.b.eval(`localStorage.setItem('presspath.v1', JSON.stringify({ v: 1, prefs: { highContrast: true, largeText: false, reduceMotion: true }, runs: [], adaptations: [], seq: { run: 0, adapt: 0 } }))`);
    await app.b.reload();
    await app.key('ok', { wait: 600 });
    const s = await app.b.eval(`(() => { const cs = getComputedStyle(document.querySelector('.is-focused')); return { t: cs.transform, oc: cs.outlineColor, ow: cs.outlineWidth, bg: getComputedStyle(document.getElementById('stage')).backgroundColor }; })()`);
    assert.equal(s.t, 'none', 'no zoom with Reduce Motion');
    assert.equal(s.oc, 'rgb(255, 230, 0)');
    assert.equal(s.ow, '5px');
    assert.equal(s.bg, 'rgb(0, 0, 0)');
  } finally { await app.close(); }
});

test('unreadable stored data is set aside and the app starts fresh', { timeout: 120000 }, async () => {
  const app = await openApp({ init: `try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('presspath.v1', '{not json'); sessionStorage.setItem('seeded', '1'); } } catch (e) {}` });
  try {
    await app.key('ok', { wait: 600 });
    assert.equal((await app.state()).runs.length, 0);
    assert.equal(await app.b.eval(`localStorage.getItem('presspath.v1.corrupt')`), '{not json');
  } finally { await app.close(); }
});
