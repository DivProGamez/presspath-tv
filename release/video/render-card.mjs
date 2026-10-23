// Renders the 1920x1080 closing card for the demo video (headless Chrome, app logo and palette).
//   node release/video/render-card.mjs out.png
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../../tests/e2e/cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = process.argv[2];
const ctx = {};
new Function('self', readFileSync(join(ROOT, 'web', 'js', 'ui', 'art.js'), 'utf8'))(ctx);
const logo = ctx.PP.art.logo().replace('class="logo"', 'class="logo" width="150" height="150"');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;font-family:"Segoe UI Variable Display","Segoe UI",Roboto,sans-serif;color:#F2F5FF;
background:radial-gradient(1100px 800px at 75% 30%,rgba(34,200,245,.16),transparent 60%),radial-gradient(900px 700px at 15% 85%,rgba(123,97,255,.28),transparent 60%),linear-gradient(120deg,#040811,#0A1230 60%,#120A33)}
.wrap{position:absolute;left:150px;top:150px;right:150px}
.row{display:flex;align-items:center;gap:40px}
h1{font-size:120px;font-weight:800;letter-spacing:-.04em;line-height:1}
h1 b{color:#22C8F5}
.tag{font-size:44px;font-weight:600;color:#BCC8CF;margin-top:28px;line-height:1.3}
.tag em{font-style:normal;color:#8DE0FF}
.facts{margin-top:64px;display:grid;grid-template-columns:1fr 1fr;gap:22px 40px;max-width:1500px}
.f{padding:22px 28px;border-radius:20px;background:rgba(16,26,58,.62);border:1px solid rgba(255,255,255,.1);font-size:28px;line-height:1.35}
.f b{display:block;font-size:17px;letter-spacing:.12em;text-transform:uppercase;color:#29F0AD;margin-bottom:6px;font-family:Bahnschrift,"Segoe UI",sans-serif}
.f.warn b{color:#FFC247}
.url{margin-top:56px;font-size:40px;font-weight:700;color:#8DE0FF;font-family:Bahnschrift,"Segoe UI",sans-serif;letter-spacing:.01em}
</style></head><body><div class="wrap">
<div class="row">${logo}<h1>PressPath <b>TV</b></h1></div>
<div class="tag">Every press counts. <em>Every path gets smarter.</em></div>
<div class="facts">
<div class="f"><b>Verified</b>Android TV / Google TV emulator (API 36) · release APK, D-pad input</div>
<div class="f"><b>Tests</b>34 / 34 unit · 37 / 37 browser · 24 / 24 emulator checks</div>
<div class="f"><b>Private by design</b>Offline · no permissions · data stays on the device</div>
<div class="f warn"><b>Not tested</b>Amazon Fire TV hardware · Vega OS not supported</div>
</div>
<div class="url">github.com/DivProGamez/presspath-tv</div>
</div></body></html>`;

const b = await launch({ width: 1920, height: 1080 });
try {
  await b.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await b.screenshot(out);
  console.log('card', out);
} finally { await b.close(); }
