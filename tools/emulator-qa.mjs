// Installs the release APK on a running Android TV emulator (or device) and drives it
// with real remote key events (`adb shell input dpad keyevent …`). Verifies results from
// the app's own log lines in logcat and saves genuine screencaps to evidence/emulator/.
//
//   node tools/emulator-qa.mjs [--serial emulator-5554]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'evidence', 'emulator');
const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const PKG = 'com.presspath.tv';
const APK = join(ROOT, 'dist', readdirSync(join(ROOT, 'dist')).find((f) => /^PressPathTV-.*-release\.apk$/.test(f)));
const serialArg = process.argv.indexOf('--serial');
const SERIAL = serialArg > 0 ? ['-s', process.argv[serialArg + 1]] : [];
mkdirSync(OUT, { recursive: true });
// Each run regenerates its own screencaps so no stale image survives from an earlier run.
for (const f of readdirSync(OUT)) if (f.endsWith('.png')) rmSync(join(OUT, f));

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function adb(args, opts = {}) {
  const r = spawnSync(ADB, [...SERIAL, ...args], { encoding: opts.binary ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`adb ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}
const sh = (cmd, opts) => adb(['shell', cmd], opts);
function check(name, ok, detail) {
  results.push({ check: name, pass: !!ok, detail });
  console.log(`${ok ? '✔' : '✖'} ${name}${detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
async function key(k, wait = 380) {
  const src = /BUTTON_/.test(k) ? 'gamepad' : 'dpad';
  sh(`input ${src} keyevent KEYCODE_${k}`);
  await sleep(wait);
}
async function keys(seq, wait) { for (const k of seq.split(/\s+/).filter(Boolean)) await key(k, wait); }
async function shot(name) {
  await sleep(700);
  const png = adb(['exec-out', 'screencap', '-p'], { binary: true });
  writeFileSync(join(OUT, name + '.png'), png);
}
function ppLines() {
  return adb(['logcat', '-d', '-s', 'PressPathTV:I'], { allowFail: true }).split(/\r?\n/).filter((l) => l.includes('[PP]'));
}
function lastEvent(kind) {
  const l = ppLines().filter((x) => x.includes('[PP] ' + kind)).pop();
  if (!l) return null;
  const j = l.slice(l.indexOf('[PP] ' + kind) + kind.length + 5).trim();
  try { return j ? JSON.parse(j) : {}; } catch { return { raw: j }; }
}
async function waitEvent(kind, after, ms = 6000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const n = ppLines().filter((x) => x.includes('[PP] ' + kind)).length;
    if (n > after) return lastEvent(kind);
    await sleep(250);
  }
  return null;
}
const count = (kind) => ppLines().filter((x) => x.includes('[PP] ' + kind)).length;

async function main() {
  // ---------- device ----------
  adb(['wait-for-device']);
  for (let i = 0; i < 180 && sh('getprop sys.boot_completed', { allowFail: true }).trim() !== '1'; i++) await sleep(1000);
  const model = sh('getprop ro.product.model').trim(), sdk = sh('getprop ro.build.version.sdk').trim();
  const features = sh('pm list features');
  const wm = sh('wm size').trim() + ' / ' + sh('wm density').trim().replace(/\r?\n/g, ' ');
  check('device booted', true, `${model} · API ${sdk} · leanback=${/android.software.leanback/.test(features)} · ${wm}`);
  const webview = (sh('dumpsys webviewupdate', { allowFail: true }).match(/Current WebView package \(name, version\): \(([^)]+)\)/) || [])[1];
  check('system WebView', !!webview, webview || 'unknown');

  // ---------- install + fresh state ----------
  const inst = adb(['install', '-r', APK]);
  check('APK installs', /Success/.test(inst), APK.replace(ROOT, '.'));
  const dump = sh(`dumpsys package ${PKG}`);
  check('package metadata', /versionName=1\.0\.0/.test(dump), (dump.match(/versionName=\S+/) || [''])[0] + ' ' + (dump.match(/minSdk=\d+ targetSdk=\d+/) || [''])[0]);
  check('no INTERNET permission requested', !/android\.permission\.INTERNET/.test(dump));
  sh(`pm clear ${PKG}`);
  adb(['logcat', '-c']);

  // ---------- launch ----------
  const start = sh(`am start -W -n ${PKG}/.MainActivity`);
  check('launches', /Status: ok|Complete/.test(start), (start.match(/TotalTime: \d+/) || [''])[0]);
  await sleep(2500);
  check('web app booted from local assets', !!(await waitEvent('boot', 0, 8000)), lastEvent('boot'));
  await shot('01-splash');
  await key('DPAD_CENTER', 900);
  check('splash dismissed with OK', count('splash:dismissed') === 1);
  await shot('02-home-empty');

  // ---------- navigation lab: science baseline x2 ----------
  await key('DPAD_CENTER', 700);
  await shot('03-lab-empty');
  const runs = [];
  for (let i = 1; i <= 2; i++) {
    if (i === 1) await key('DPAD_DOWN');
    const before = count('task:complete');
    await key('DPAD_CENTER', 700);
    await keys('DPAD_RIGHT DPAD_RIGHT DPAD_CENTER DPAD_RIGHT DPAD_RIGHT DPAD_CENTER', 450);
    if (i === 1) await shot('04-task-live-hud');
    await key('DPAD_CENTER');
    const r = await waitEvent('task:complete', before);
    runs.push(r);
    check(`science baseline ${i} recorded`, r && r.task === 'science' && r.phase === 'baseline', r);
    await sleep(900);
    if (i === 1) await shot('05-task-result');
    await key('DPAD_CENTER', 700); // Back to Lab
  }
  await shot('06-lab-suggestion');

  // ---------- R1 preview / apply ----------
  await key('DPAD_RIGHT');
  await key('DPAD_CENTER', 700);
  await shot('07-r1-preview');
  const nApply = count('adapt:apply');
  await key('DPAD_CENTER', 700);
  const applied = await waitEvent('adapt:apply', nApply);
  check('R1 applied after preview', applied && applied.rule === 'R1' && applied.task === 'science', applied);

  // ---------- adaptive run via the Home shortcut ----------
  const beforeA = count('task:complete');
  await key('DPAD_CENTER', 700);
  await shot('08-home-shortcut-adaptive');
  await keys('DPAD_UP DPAD_CENTER', 500);
  await key('DPAD_CENTER');
  const ad = await waitEvent('task:complete', beforeA);
  check('adaptive science run via shortcut', ad && ad.phase === 'adaptive', ad);
  await sleep(900);
  await key('DPAD_CENTER', 700);
  await shot('09-lab-measured');
  await keys('DPAD_RIGHT DPAD_RIGHT DPAD_CENTER', 500);
  await shot('10-before-after');

  // ---------- back stack + home ----------
  await key('BACK', 600);
  await key('BACK', 700);
  await shot('11-home-filled');

  // ---------- undo ----------
  await key('DPAD_CENTER', 700);           // Navigation Lab tile
  await keys('DPAD_DOWN DPAD_RIGHT', 450);  // science row -> Undo R1
  const nUndo = count('adapt:undo');
  await key('DPAD_CENTER', 700);
  check('undo restores (adaptation undone)', !!(await waitEvent('adapt:undo', nUndo)), lastEvent('adapt:undo'));

  // ---------- R2: three real edge presses on the first tile ----------
  await keys('DPAD_LEFT DPAD_UP', 450);     // science Run -> memory Run
  const beforeM = count('task:complete');
  await key('DPAD_CENTER', 700);
  await keys('DPAD_LEFT DPAD_LEFT DPAD_LEFT DPAD_RIGHT DPAD_CENTER', 450);
  await key('DPAD_CENTER');
  const m1 = await waitEvent('task:complete', beforeM);
  check('memory baseline records 3 edge misses', m1 && m1.task === 'memory' && m1.edgeMisses === 3, m1);
  await sleep(900);
  await key('DPAD_CENTER', 700);            // Back to Lab (memory row)
  await key('DPAD_RIGHT');                  // Preview R2
  await key('DPAD_CENTER', 700);
  await shot('12a-r2-preview');
  const nApply2 = count('adapt:apply');
  await key('DPAD_CENTER', 700);
  const r2 = await waitEvent('adapt:apply', nApply2);
  check('R2 applied for the edge-miss element', r2 && r2.rule === 'R2' && r2.target === 'home-tile-lab', r2);
  const beforeM2 = count('task:complete');
  await key('DPAD_CENTER', 900);            // Run adaptive
  await shot('12b-r2-emphasis-live');
  await keys('DPAD_RIGHT DPAD_CENTER', 500);
  await key('DPAD_CENTER');
  const m2 = await waitEvent('task:complete', beforeM2);
  check('adaptive memory run with stronger focus', m2 && m2.phase === 'adaptive' && m2.edgeMisses === 0, m2);
  await sleep(900);
  await key('DPAD_CENTER', 700);
  await key('BACK', 700);

  // ---------- memory pairs ----------
  await keys('DPAD_RIGHT DPAD_CENTER', 700);
  await keys('DPAD_CENTER DPAD_RIGHT DPAD_CENTER', 500);
  await shot('13-play');
  await key('BACK', 700);

  // ---------- flashcards ----------
  await keys('DPAD_RIGHT DPAD_CENTER', 700);
  await shot('14-learn');
  await keys('DPAD_RIGHT DPAD_RIGHT DPAD_CENTER', 600);
  const nRev = count('cards:reveal');
  await key('DPAD_CENTER', 700);
  check('flashcard reveal with OK', count('cards:reveal') > nRev, lastEvent('cards:reveal'));
  await shot('15-learn-revealed');
  await key('BACK', 600);
  await key('BACK', 700);

  // ---------- settings ----------
  await keys('DPAD_RIGHT DPAD_RIGHT DPAD_CENTER', 700);
  const nPref = count('pref');
  await key('DPAD_CENTER', 700);
  const pref = await waitEvent('pref', nPref);
  check('High Contrast toggles with OK', pref && pref.key === 'highContrast' && pref.value === true, pref);
  await shot('16-settings-hc');
  await key('DPAD_CENTER', 600);
  await keys('DPAD_DOWN DPAD_DOWN DPAD_DOWN DPAD_CENTER', 450);
  await shot('17-clear-confirm');
  await key('DPAD_CENTER', 600); // Cancel — data kept
  check('clear data asks first (no clear on first OK)', count('data:cleared') === 0);
  await key('BACK', 700);

  // ---------- gamepad buttons ----------
  const nSplash = count('splash:dismissed');
  sh(`am force-stop ${PKG}`);
  sh(`am start -W -n ${PKG}/.MainActivity`);
  await sleep(3000);
  await key('BUTTON_A', 900);
  check('gamepad A dismisses splash (persisted relaunch)', count('splash:dismissed') > nSplash);
  const boot = lastEvent('boot');
  check('runs and adaptations persist across app restart', boot && boot.runs === 5 && boot.adaptations === 2, boot);

  // ---------- offline ----------
  sh('cmd connectivity airplane-mode enable', { allowFail: true });
  await sleep(1500);
  sh(`am force-stop ${PKG}`);
  const nBoot = count('boot');
  sh(`am start -W -n ${PKG}/.MainActivity`);
  await sleep(3000);
  check('starts with airplane mode on (no network needed)', count('boot') > nBoot, lastEvent('boot'));
  await key('DPAD_CENTER', 900);
  await key('DPAD_CENTER', 900);
  await shot('18-offline-lab');
  sh('cmd connectivity airplane-mode disable', { allowFail: true });

  // ---------- back exits from Home ----------
  await key('BACK', 700); // Lab -> Home
  await key('BACK', 400);
  await key('BACK', 1200);
  const top = sh('dumpsys activity activities', { allowFail: true });
  const resumed = (top.match(/(topResumedActivity|mResumedActivity)[^\n]*/) || [''])[0];
  check('double Back on Home exits the app', !resumed.includes(PKG), resumed.trim());

  const crashes = adb(['logcat', '-d', '-b', 'crash'], { allowFail: true });
  check('no crashes in logcat', !crashes.includes(PKG));
  writeFileSync(join(OUT, 'emulator-qa.json'), JSON.stringify({ at: new Date().toISOString(), apk: APK.replace(ROOT, '.'), results, appLog: ppLines() }, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed · screenshots in evidence/emulator/`);
  process.exit(failed ? 1 : 0);
}

if (!existsSync(ADB)) { console.error('adb not found at ' + ADB); process.exit(2); }
main().catch((e) => { console.error(e); process.exit(1); });
