// Builds a signed release APK with the Android SDK command-line tools only
// (aapt2, javac, d8, zipalign, apksigner). No Gradle, no network access.
//
//   node tools/build-apk.mjs
//
// Env: ANDROID_HOME / ANDROID_SDK_ROOT (default %LOCALAPPDATA%/Android/Sdk),
//      PRESSPATH_KS_PASS to use your own keystore password.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, cpSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AND = join(ROOT, 'android');
const APP = join(AND, 'app', 'src', 'main');
const OUT = join(AND, 'build');
const DIST = join(ROOT, 'dist');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION_NAME = pkg.version;
const VERSION_CODE = String(VERSION_NAME.split('.').reduce((a, n) => a * 100 + Number(n), 0)); // 1.0.0 -> 10000
const MIN_SDK = '22';      // Fire OS 5 (Android 5.1) and newer
const TARGET_SDK = '35';
const isWin = process.platform === 'win32';

const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
if (!existsSync(SDK)) throw new Error('Android SDK not found; set ANDROID_HOME');
const num = (v) => v.split(/[.-]/).map((x) => Number(x) || 0);
const newest = (dir, filter) => readdirSync(dir).filter(filter).sort((a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; }).pop();
const BT = join(SDK, 'build-tools', process.env.PRESSPATH_BUILD_TOOLS || newest(join(SDK, 'build-tools'), (d) => /^\d+\.\d+\.\d+$/.test(d) && num(d)[0] >= 34 && num(d)[0] <= 35) || newest(join(SDK, 'build-tools'), (d) => /^\d/.test(d)));
const PLATFORM = join(SDK, 'platforms', 'android-' + TARGET_SDK, 'android.jar');
if (!existsSync(PLATFORM)) throw new Error('Missing ' + PLATFORM + ' (install Android SDK Platform ' + TARGET_SDK + ')');
const tool = (n) => join(BT, n + (isWin ? (n === 'd8' || n === 'apksigner' ? '.bat' : '.exe') : ''));
// JDK tools: prefer JAVA_HOME (keytool is often not on PATH on Windows).
const jdk = (n) => { const p = process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin', n + (isWin ? '.exe' : '')); return p && existsSync(p) ? p : n; };

function run(cmd, args, opts = {}) {
  const shell = isWin && /\.bat$/i.test(cmd);
  const q = (a) => (/[\s&()]/.test(a) ? `"${a}"` : a);
  // .bat tools need a shell on Windows; pass one pre-quoted command line instead of an argv array.
  const r = shell ? spawnSync([cmd, ...args].map(q).join(' '), { encoding: 'utf8', shell: true, ...opts })
    : spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    console.error(`\n✖ ${cmd} ${args.join(' ')}\n${r.stdout || ''}${r.stderr || ''}`);
    process.exit(1);
  }
  return (r.stdout || '') + (r.stderr || '');
}
const walk = (dir, ext) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name), ext) : e.name.endsWith(ext) ? [join(dir, e.name)] : []);
const step = (s) => console.log('• ' + s);

console.log(`PressPath TV ${VERSION_NAME} (${VERSION_CODE}) · build-tools ${relative(join(SDK, 'build-tools'), BT)} · android-${TARGET_SDK} · minSdk ${MIN_SDK}`);
rmSync(OUT, { recursive: true, force: true });
for (const d of ['assets/web', 'gen', 'classes', 'dex']) mkdirSync(join(OUT, d), { recursive: true });
mkdirSync(DIST, { recursive: true });

step('staging web assets (index.html, css, js) into assets/web');
cpSync(join(ROOT, 'web', 'index.html'), join(OUT, 'assets', 'web', 'index.html'));
cpSync(join(ROOT, 'web', 'css'), join(OUT, 'assets', 'web', 'css'), { recursive: true });
cpSync(join(ROOT, 'web', 'js'), join(OUT, 'assets', 'web', 'js'), { recursive: true });

step('aapt2 compile resources');
run(tool('aapt2'), ['compile', '--dir', join(APP, 'res'), '-o', join(OUT, 'res.zip')]);

step('aapt2 link manifest + resources + assets');
run(tool('aapt2'), ['link', '-o', join(OUT, 'unsigned.apk'), '-I', PLATFORM, '--manifest', join(APP, 'AndroidManifest.xml'),
  '--java', join(OUT, 'gen'), '--min-sdk-version', MIN_SDK, '--target-sdk-version', TARGET_SDK,
  '--version-code', VERSION_CODE, '--version-name', VERSION_NAME, '--auto-add-overlay', join(OUT, 'res.zip')]);

step('javac');
run(jdk('javac'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-Xlint:-options', '-bootclasspath', PLATFORM, '-classpath', PLATFORM,
  '-d', join(OUT, 'classes'), ...walk(join(APP, 'java'), '.java'), ...walk(join(OUT, 'gen'), '.java')]);

step('d8 (release, minApi ' + MIN_SDK + ')');
run(tool('d8'), ['--release', '--min-api', MIN_SDK, '--lib', PLATFORM, '--output', join(OUT, 'dex'), ...walk(join(OUT, 'classes'), '.class')]);

step('add classes.dex');
run(tool('aapt'), ['add', join(OUT, 'unsigned.apk'), 'classes.dex'], { cwd: join(OUT, 'dex') });

step('add web assets (forward-slash entry names)');
// aapt2 link -A writes nested asset paths with backslashes on Windows, which Android cannot open,
// so assets are added explicitly with portable relative names.
const assetNames = walk(join(OUT, 'assets'), '').map((f) => relative(OUT, f).split(sep).join('/'));
run(tool('aapt'), ['add', join(OUT, 'unsigned.apk'), ...assetNames], { cwd: OUT });
const listing = run(tool('aapt'), ['list', join(OUT, 'unsigned.apk')]);
if (listing.includes('\\')) { console.error('APK contains backslash entry names:\n' + listing); process.exit(1); }
if (!listing.includes('assets/web/index.html')) { console.error('assets/web/index.html missing from APK'); process.exit(1); }

step('zipalign');
run(tool('zipalign'), ['-p', '-f', '4', join(OUT, 'unsigned.apk'), join(OUT, 'aligned.apk')]);

step('signing key');
const KS = join(AND, 'keystore', 'presspath-release.jks');
const KS_PROPS = join(AND, 'keystore', 'keystore.properties');
let pass = process.env.PRESSPATH_KS_PASS;
if (!pass && existsSync(KS_PROPS)) pass = (/storePassword=(.+)/.exec(readFileSync(KS_PROPS, 'utf8')) || [])[1]?.trim();
if (!existsSync(KS)) {
  pass = pass || randomBytes(18).toString('base64url');
  mkdirSync(dirname(KS), { recursive: true });
  run(jdk('keytool'), ['-genkeypair', '-keystore', KS, '-storetype', 'PKCS12', '-alias', 'presspath', '-keyalg', 'RSA', '-keysize', '3072',
    '-validity', '10000', '-storepass', pass, '-keypass', pass, '-dname', 'CN=PressPath TV, O=PressPath TV, C=US']);
  writeFileSync(KS_PROPS, `# Local release signing key for PressPath TV. Keep private; do not commit.\nstoreFile=presspath-release.jks\nkeyAlias=presspath\nstorePassword=${pass}\nkeyPassword=${pass}\n`);
  console.log('  created ' + relative(ROOT, KS) + ' (password in keystore.properties)');
}
if (!pass) throw new Error('Keystore exists but no password: set PRESSPATH_KS_PASS');

const APK = join(DIST, `PressPathTV-${VERSION_NAME}-release.apk`);
step('apksigner sign (v1 + v2 + v3)');
run(tool('apksigner'), ['sign', '--ks', KS, '--ks-key-alias', 'presspath', '--ks-pass', 'pass:' + pass, '--key-pass', 'pass:' + pass,
  '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true', '--out', APK, join(OUT, 'aligned.apk')]);

step('verify');
const verify = run(tool('apksigner'), ['verify', '--verbose', '--print-certs', APK]);
const badging = run(tool('aapt'), ['dump', 'badging', APK]);
const perms = run(tool('aapt'), ['dump', 'permissions', APK]);
const files = run(tool('aapt'), ['list', APK]);
const sha = createHash('sha256').update(readFileSync(APK)).digest('hex');
const size = statSync(APK).size;
const info = [
  `PressPath TV release APK`,
  `file: ${relative(ROOT, APK)}`,
  `size: ${size} bytes`,
  `sha256: ${sha}`,
  `built: ${new Date().toISOString()}`,
  `build-tools: ${relative(join(SDK, 'build-tools'), BT)} · platform android-${TARGET_SDK}`,
  '', '== aapt dump badging ==', badging.trim(),
  '', '== aapt dump permissions ==', perms.trim(),
  '', '== apksigner verify ==', verify.trim(),
  '', '== contents ==', files.trim()
].join('\n');
writeFileSync(join(DIST, 'apk-info.txt'), info + '\n');
console.log(`\n✔ ${relative(ROOT, APK)}  (${(size / 1024).toFixed(1)} KiB, sha256 ${sha.slice(0, 16)}…)`);
console.log('  details: dist/apk-info.txt');
