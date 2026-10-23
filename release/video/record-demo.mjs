// Records the PressPath TV demo on a running Android TV emulator.
// Installs the exact released APK (SHA-256 checked), clears app data, then plays each
// scene with real D-pad key events while `adb shell screenrecord` captures the display.
// The measured runs are read back from the app's own logcat lines into work/measured.json,
// so the narration is generated from what actually happened.
//
//   node release/video/record-demo.mjs
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const WORK = join(HERE, 'work');
const APK = join(ROOT, 'dist', 'PressPathTV-1.0.0-release.apk');
const EXPECTED_SHA = '00b3b3aa0706caef709b6a3590006f9a1e9dbc4b181b76c54efb844ad1240027';
const SDK = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const PKG = 'com.presspath.tv';
mkdirSync(WORK, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (args, opts = {}) => {
  const r = spawnSync(ADB, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 && !opts.allowFail) throw new Error('adb ' + args.join(' ') + ': ' + r.stderr);
  return r.stdout;
};
const KEY = { UP: 'DPAD_UP', DOWN: 'DPAD_DOWN', LEFT: 'DPAD_LEFT', RIGHT: 'DPAD_RIGHT', OK: 'DPAD_CENTER', BACK: 'BACK' };
function act(a) {
  if (a === 'LAUNCH') return adb(['shell', `am start -n ${PKG}/.MainActivity`]);
  adb(['shell', `input dpad keyevent KEYCODE_${KEY[a]}`]);
}
const seq = (t0, step, keys) => keys.split(' ').map((k, i) => [t0 + i * step, k]);

// [seconds after recording starts, action]. Every scene ends where the next one begins.
const SCENES = [
  { id: 's01-splash', dur: 13, actions: [[0.6, 'LAUNCH'], [11.4, 'OK']] },
  { id: 's02-home', dur: 10, actions: [...seq(1.8, 0.9, 'RIGHT RIGHT RIGHT RIGHT'), ...seq(6.2, 0.45, 'LEFT LEFT LEFT LEFT')] },
  { id: 's03-baseline-1', dur: 17, actions: [[1.0, 'OK'], [3.4, 'DOWN'], [5.4, 'OK'], ...seq(7.0, 0.6, 'RIGHT RIGHT OK'), ...seq(9.2, 0.6, 'RIGHT RIGHT OK'), [11.8, 'OK']] },
  { id: 's04-baseline-2', dur: 10, actions: [[0.8, 'OK'], [2.2, 'OK'], ...seq(3.4, 0.5, 'RIGHT RIGHT OK RIGHT RIGHT OK'), [7.0, 'OK']] },
  { id: 's05-r1-preview', dur: 18, actions: [[0.8, 'OK'], [2.4, 'RIGHT'], [3.4, 'OK'], [15.6, 'OK']] },
  { id: 's06-adaptive', dur: 8, actions: [[0.8, 'OK'], [2.8, 'UP'], [3.8, 'OK'], [5.0, 'OK']] },
  { id: 's07-before-after', dur: 13, actions: [[0.8, 'OK'], [2.2, 'RIGHT'], [2.9, 'RIGHT'], [3.8, 'OK']] },
  { id: 's08-undo', dur: 8, actions: [[1.0, 'RIGHT'], [2.2, 'OK'], [4.0, 'BACK'], [5.3, 'BACK']] },
  { id: 's09-memory', dur: 12, actions: [[1.0, 'RIGHT'], [2.0, 'OK'], [3.6, 'OK'], [4.4, 'RIGHT'], [5.1, 'OK'], [7.2, 'DOWN'], [7.9, 'OK'], [8.7, 'RIGHT'], [9.4, 'OK']] },
  { id: 's10-flashcards', dur: 10, actions: [[0.8, 'BACK'], [1.8, 'RIGHT'], [2.5, 'OK'], [3.8, 'RIGHT'], [4.6, 'OK'], [6.0, 'OK'], [7.6, 'RIGHT'], [8.3, 'OK']] },
  // each `adb shell input` takes ~0.4 s, so key presses here are spaced >= 1 s to avoid drift past the time limit
  { id: 's11-accessibility', dur: 23, actions: [[0.8, 'BACK'], [2.0, 'BACK'], [3.0, 'RIGHT'], [4.0, 'RIGHT'], [5.0, 'OK'], [6.6, 'OK'], [8.6, 'DOWN'], [9.8, 'OK'], [12.0, 'OK'], [13.2, 'UP'], [14.4, 'OK'], ...seq(15.4, 1.0, 'DOWN DOWN DOWN'), [18.6, 'OK']] }
];

async function recordScene(s) {
  const remote = `/sdcard/pp_${s.id}.mp4`;
  const rec = spawn(ADB, ['shell', `screenrecord --time-limit ${s.dur} --bit-rate 12000000 ${remote}`]);
  await sleep(900); // screenrecord start-up
  const t0 = Date.now();
  for (const [t, a] of s.actions) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    act(a);
  }
  await new Promise((r) => rec.on('exit', r));
  await sleep(600);
  adb(['pull', remote, join(WORK, s.id + '.mp4')]);
  adb(['shell', `rm ${remote}`], { allowFail: true });
  console.log('recorded', s.id);
}

function ppLines() {
  return adb(['logcat', '-d', '-s', 'PressPathTV:I'], { allowFail: true }).split(/\r?\n/).filter((l) => l.includes('[PP]'));
}

async function main() {
  // --only <scene>: re-record one scene from the app's current state (measured.json is kept).
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  if (only) {
    const s = SCENES.find((x) => x.id === only);
    if (!s) throw new Error('unknown scene ' + only);
    await recordScene(s);
    return;
  }
  const sha = createHash('sha256').update(readFileSync(APK)).digest('hex');
  if (sha !== EXPECTED_SHA) throw new Error('APK hash mismatch: ' + sha);
  adb(['wait-for-device']);
  for (let i = 0; i < 200 && adb(['shell', 'getprop sys.boot_completed'], { allowFail: true }).trim() !== '1'; i++) await sleep(1000);
  await sleep(4000);
  adb(['install', '-r', APK]);
  adb(['shell', `pm clear ${PKG}`]);
  adb(['shell', 'input keyevent KEYCODE_HOME']);
  await sleep(1500);
  adb(['logcat', '-c']);
  for (const s of SCENES) await recordScene(s);
  adb(['shell', 'input dpad keyevent KEYCODE_DPAD_CENTER']); // cancel the clear-data confirmation; data kept

  const runs = ppLines().filter((l) => l.includes('[PP] task:complete')).map((l) => JSON.parse(l.slice(l.indexOf('{'))));
  const model = adb(['shell', 'getprop ro.product.model']).trim(), api = adb(['shell', 'getprop ro.build.version.sdk']).trim();
  const out = { recordedAt: new Date().toISOString(), apkSha256: sha, device: `${model} · API ${api}`, runs, log: ppLines() };
  writeFileSync(join(WORK, 'measured.json'), JSON.stringify(out, null, 2));
  console.log('measured runs:', runs.map((r) => `${r.task}/${r.phase}=${r.presses}`).join(', '));
}
main().catch((e) => { console.error(e); process.exit(1); });
