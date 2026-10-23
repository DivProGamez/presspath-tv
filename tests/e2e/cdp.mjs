// Tiny Chrome DevTools Protocol driver (Node >= 22 global WebSocket, no npm deps).
// Launches a headless Chrome/Edge with a FRESH temporary profile for every session.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

export function findChrome() {
  const p = CANDIDATES.find((c) => existsSync(c));
  if (!p) throw new Error('No Chrome/Edge executable found; set CHROME_PATH');
  return p;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1920, height = 1080, port = 9300 + Math.floor(Math.random() * 500) } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'presspath-e2e-'));
  const proc = spawn(findChrome(), [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${width},${height}`, 'about:blank'
  ], { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 60; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(150); }
  }
  if (!ver) throw new Error('Chrome did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, bad } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? bad(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}) => new Promise((ok, bad) => { id += 1; pending.set(id, { ok, bad }); ws.send(JSON.stringify({ id, method, params })); });

  await send('Page.enable');
  await send('Runtime.enable');
  const consoleLines = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.consoleAPICalled') consoleLines.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') consoleLines.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });

  const api = {
    consoleLines,
    send,
    async setViewport(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
    async goto(url) {
      const loaded = new Promise((ok) => listeners.push((m) => { if (m.method === 'Page.loadEventFired') ok(); }));
      await send('Page.navigate', { url });
      await loaded; await sleep(300);
    },
    async reload() {
      const loaded = new Promise((ok) => listeners.push((m) => { if (m.method === 'Page.loadEventFired') ok(); }));
      await send('Page.reload', { ignoreCache: true });
      await loaded; await sleep(300);
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async key(name, { wait = 160 } = {}) {
      const K = {
        up: ['ArrowUp', 38], down: ['ArrowDown', 40], left: ['ArrowLeft', 37], right: ['ArrowRight', 39],
        ok: ['Enter', 13], back: ['Escape', 27]
      }[name];
      if (!K) throw new Error('unknown key ' + name);
      const base = { key: K[0], code: K[0], windowsVirtualKeyCode: K[1], nativeVirtualKeyCode: K[1] };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      await sleep(wait);
    },
    async keys(seq, opts) { for (const k of seq) await api.key(k, opts); },
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    sleep,
    async close() {
      try { ws.close(); } catch {}
      proc.kill();
      await sleep(400);
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    }
  };
  await api.setViewport(width, height);
  return api;
}
