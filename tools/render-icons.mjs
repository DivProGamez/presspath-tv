// Renders the launcher icons and the Android TV banner from the app's own vector logo.
// Usage: node tools/render-icons.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../tests/e2e/cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const ctx = {};
new Function('self', readFileSync(join(ROOT, 'web', 'js', 'ui', 'art.js'), 'utf8'))(ctx);
const logo = ctx.PP.art.logo();

const page = (w, h, body, bg) => `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg};font-family:"Segoe UI Variable Display","Segoe UI",Roboto,sans-serif}
  .logo{display:block}
</style></head><body>${body}</body></html>`)}`;

const ICONS = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };

const b = await launch({ width: 400, height: 400 });
try {
  await b.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const [dir, px] of Object.entries(ICONS)) {
    await b.setViewport(px, px);
    const pad = Math.round(px * 0.04);
    await b.goto(page(px, px, `<div style="padding:${pad}px">${logo.replace('class="logo"', `class="logo" width="${px - 2 * pad}" height="${px - 2 * pad}"`)}</div>`, 'transparent'));
    mkdirSync(join(RES, dir), { recursive: true });
    await b.screenshot(join(RES, dir, 'ic_launcher.png'));
  }
  // Android TV banner, xhdpi 320 x 180.
  await b.send('Emulation.setDefaultBackgroundColorOverride', {});
  await b.setViewport(320, 180);
  const banner = `<div style="position:absolute;inset:0;background:radial-gradient(220px 160px at 85% 10%,rgba(123,97,255,.55),transparent 70%),radial-gradient(200px 140px at 0% 100%,rgba(34,200,245,.35),transparent 70%),linear-gradient(120deg,#050914,#0C1A44 60%,#1A0F4A)"></div>
    <div style="position:absolute;left:22px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:14px">
      ${logo.replace('class="logo"', 'class="logo" width="72" height="72"')}
      <div style="color:#fff;font-weight:800;font-size:34px;letter-spacing:-0.02em;line-height:1">PressPath <span style="color:#22C8F5">TV</span>
      <div style="font-size:13px;font-weight:600;color:#BCC8CF;letter-spacing:0;margin-top:8px">Every press counts.</div></div></div>`;
  await b.goto(page(320, 180, banner, '#050914'));
  mkdirSync(join(RES, 'drawable-xhdpi'), { recursive: true });
  await b.screenshot(join(RES, 'drawable-xhdpi', 'banner.png'));
  // Large icon for store listings / README.
  await b.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await b.setViewport(512, 512);
  await b.goto(page(512, 512, `<div style="padding:16px">${logo.replace('class="logo"', 'class="logo" width="480" height="480"')}</div>`, 'transparent'));
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  await b.screenshot(join(ROOT, 'dist', 'icon-512.png'));
  console.log('icons and banner written');
} finally {
  await b.close();
}
