// Shared helpers for the keyboard-only browser tests.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { startServer } from '../../tools/serve.mjs';
import { launch } from './cdp.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Words that must never appear in the product UI (invented capabilities / data).
export const BANNED = [/friction score/i, /heat ?map/i, /dead end/i, /focus loss/i, /navigation sound/i, /\bprofiles?\b/i, /accuracy/i, /\bAI\b/, /machine learning/i, /cloud sync/i, /sign[ -]?in/i, /account(?!s,)/i, /composite/i];

export async function openApp({ width = 1920, height = 1080, shots, init } = {}) {
  const port = 8800 + Math.floor(Math.random() * 900);
  const server = await startServer(port);
  const b = await launch({ width, height });
  if (init) await b.send?.('Page.addScriptToEvaluateOnNewDocument', { source: init });
  await b.goto(`http://127.0.0.1:${port}/`);
  if (shots) mkdirSync(shots, { recursive: true });
  const app = {
    b, port, shots,
    ui: () => b.eval('PressPath.ui()'),
    state: () => b.eval('PressPath.state()'),
    focus: async () => (await app.ui()).focus,
    key: (k, o) => b.key(k, o),
    keys: (seq, o) => b.keys(seq, o),
    async press(seq, wait = 140) { for (const k of seq.split(/[ ,]+/).filter(Boolean)) await b.key(k, { wait }); },
    async expectFocus(id, msg) { assert.equal(await app.focus(), id, msg || `focus should be ${id}`); },
    async waitFor(expr, ms = 4000) {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await b.eval(expr)) return true; await b.sleep(80); }
      throw new Error('timeout waiting for ' + expr);
    },
    // exactly one focused element, inside the viewport, not clipped by its scroll container
    async checkFocus() {
      const r = await b.eval(`(() => {
        const f = document.querySelectorAll('.is-focused');
        if (f.length !== 1) return { count: f.length };
        const el = f[0], rc = el.getBoundingClientRect();
        const box = el.closest('.scroll'); let clipped = false;
        if (box) { const br = box.getBoundingClientRect(); clipped = rc.top < br.top - 1 || rc.bottom > br.bottom + 1; }
        const st = document.getElementById('stage').getBoundingClientRect();
        return { count: 1, id: el.id, inView: rc.left >= st.left - 1 && rc.top >= st.top - 1 && rc.right <= st.right + 1 && rc.bottom <= st.bottom + 1, clipped };
      })()`);
      assert.equal(r.count, 1, 'exactly one focused element');
      assert.ok(r.inView, `focused ${r.id} must be inside the visible stage`);
      assert.ok(!r.clipped, `focused ${r.id} must not be clipped by its scroll container`);
      return r.id;
    },
    async auditText() {
      const text = await b.eval(`(document.getElementById('stage').innerText || '')`);
      for (const re of BANNED) assert.ok(!re.test(text), `banned text ${re} found on screen`);
      return text;
    },
    async noPageOverflow() {
      const o = await b.eval(`({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight })`);
      assert.ok(o.w <= o.iw && o.h <= o.ih, `page must not scroll (${o.w}x${o.h} vs ${o.iw}x${o.ih})`);
    },
    async shot(name) {
      if (!shots) return;
      await b.sleep(450);
      await b.screenshot(join(shots, name + '.png'));
    },
    async close() { await b.close(); server.close(); }
  };
  return app;
}

// Lab row navigation: focus the Run button of a task row from anywhere in the Lab.
export async function focusLabRun(app, taskId) {
  const order = ['memory', 'science', 'contrast', 'largetext', 'letters'];
  for (let i = 0; i < 12 && (await app.focus()) !== 'lab-run-' + taskId; i++) {
    const f = await app.focus();
    const m = /^lab-(run|adapt|compare)-(\w+)$/.exec(f || '');
    if (m && m[1] !== 'run') { await app.key('left'); continue; }
    if (m) { await app.key(order.indexOf(m[2]) < order.indexOf(taskId) ? 'down' : 'up'); continue; }
    await app.key('down');
  }
  await app.expectFocus('lab-run-' + taskId);
}

// Move focus up to the top navigation, then across to a section, then press OK.
export async function navTo(app, section) {
  for (let i = 0; i < 14 && !String(await app.focus()).startsWith('nav-'); i++) await app.key('up', { wait: 120 });
  const order = ['home', 'lab', 'play', 'learn', 'progress', 'settings'];
  for (let i = 0; i < 8; i++) {
    const cur = String(await app.focus()).replace('nav-', '');
    if (cur === section) break;
    await app.key(order.indexOf(cur) < order.indexOf(section) ? 'right' : 'left', { wait: 120 });
  }
  await app.expectFocus('nav-' + section);
  await app.key('ok', { wait: 400 });
}
