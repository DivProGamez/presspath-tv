// Builds the narrated, subtitled demo video from the recorded emulator scenes.
// Narration numbers come from work/measured.json (the app's own logcat lines); the build
// stops if the recording does not contain a complete measured Science pair.
// Each narration part is anchored to a screen change measured in its clip, so the voice
// never announces a result before it is on screen.
//
//   node release/video/build-video.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const WORK = join(HERE, 'work');
const OUT_MP4 = join(HERE, 'PressPathTV-demo.mp4');
const OUT_SRT = join(HERE, 'PressPathTV-demo.srt');
const FPS = 30;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
  if (r.status !== 0) { console.error(`✖ ${cmd} ${args.join(' ')}\n${r.stderr || r.stdout}`); process.exit(1); }
  return r.stdout + r.stderr;
}
const dur = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

// ---------- measured values ----------
const M = JSON.parse(readFileSync(join(WORK, 'measured.json'), 'utf8'));
const sci = M.runs.filter((r) => r.task === 'science');
const base = sci.filter((r) => r.phase === 'baseline'), adapt = sci.filter((r) => r.phase === 'adaptive');
if (base.length !== 2 || adapt.length !== 1) { console.error('Recording does not contain 2 baseline + 1 adaptive Science runs', sci); process.exit(1); }
const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const before = median(base.map((r) => r.presses)), after = median(adapt.map((r) => r.presses));
const delta = after - before, pct = Math.round((delta / before) * 100);
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const w = (n) => (Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const W = (n) => { const s = w(n); return s.charAt(0).toUpperCase() + s.slice(1); };
const signWord = (n) => (n < 0 ? 'minus' : 'plus'), signSym = (n) => (n < 0 ? '−' : '+');
console.log(`measured: science baseline ${base.map((r) => r.presses).join(', ')} -> adaptive ${after}; Δ ${delta} (${pct}%)`);

// ---------- scenes ----------
// skip: seconds cut from the start of the clip. hold: seconds the first kept frame is held.
// at: earliest start of a narration part in segment time (clip time − skip + hold), taken from
// the screen changes measured in each clip. say = spoken text, sub = subtitle text.
const P = (at, say, sub) => ({ at, say, sub: sub || say });
const SCENES = [
  { id: 's01-splash', skip: 6.3, hold: 4.5, parts: [
    P(0.5, 'This is PressPath TV, a family app for Android TV that measures navigation inside its own interface.'),
    P(6.0, 'Everything you see is the real release APK on an Android TV emulator, controlled only with D-pad presses.')] },
  { id: 's02-home', parts: [
    P(0.3, 'Home offers the Navigation Lab, Memory Pairs, Flashcards, Progress and Settings.'),
    P(4.5, 'The evidence card is empty, because nothing has been measured yet.')] },
  { id: 's03-baseline-1', parts: [
    P(0.3, 'The Navigation Lab runs five guided tasks and records real presses, backtracks, edge misses and seconds.'),
    P(6.2, 'Task two: open Science flashcards and reveal an answer. The live bar counts every press.'),
    P(13.2, `${W(base[0].presses)} presses, saved as baseline run one.`, `${base[0].presses} presses, saved as baseline run 1.`)] },
  { id: 's04-baseline-2', parts: [
    P(0.5, 'A second baseline run of the same task.'),
    P(8.5, `${W(base[1].presses)} presses.`, `${base[1].presses} presses.`)] },
  { id: 's05-r1-preview', parts: [
    P(0.8, 'Rule R1 fires when a task needs five or more presses in at least two baseline runs.'),
    P(4.3, 'The preview cites both runs before anything changes. The tiles keep their order. Only a Home shortcut is added.'),
    P(15.9, 'Apply.')] },
  { id: 's06-adaptive', parts: [
    P(1.6, 'Now the adaptive run: up to the new shortcut, OK, and reveal.'),
    P(6.6, `${W(adapt[0].presses)} presses.`, `${adapt[0].presses} presses.`)] },
  { id: 's07-before-after', parts: [
    P(0.5, 'Next, open Before and After.'),
    P(4.6, `It compares the medians of the recorded runs: ${w(before)} presses down to ${w(after)}.`, `It compares the medians of the recorded runs: ${before} presses down to ${after}.`),
    P(9.6, `That is ${signWord(delta)} ${w(Math.abs(delta))}, or ${signWord(pct)} ${Math.abs(pct)} percent, measured on this device.`, `That is ${signSym(delta)}${Math.abs(delta)}, or ${signSym(pct)}${Math.abs(pct)}%, measured on this device.`)] },
  { id: 's08-undo', parts: [
    P(0.5, 'Every change is reversible.'),
    P(2.5, 'Undo removes the shortcut, and the recorded runs are kept.')] },
  { id: 's09-memory', parts: [
    P(2.8, 'Memory Pairs is fully playable with the remote: twelve cards and six pairs, with pairs found and moves.', 'Memory Pairs is fully playable with the remote: 12 cards and 6 pairs, with pairs found and moves.'),
    P(8.9, 'There is no timer and no score.')] },
  { id: 's10-flashcards', parts: [
    P(2.0, 'Flashcards cover Letters, Numbers and Everyday Science.'),
    P(5.5, 'OK reveals the answer, and Next moves to the next card.')] },
  { id: 's11-accessibility', parts: [
    P(0.4, 'Back returns focus to where you were.'),
    P(6.0, 'Settings provides High Contrast, with a yellow focus ring on pure black.'),
    P(10.4, 'Large Text enlarges the interface text, and Reduce Motion turns off zoom and transitions.'),
    P(19.4, 'Clear All Local Data always asks for confirmation first, so nothing is deleted by accident.')] },
  { id: 's12-closing', card: true, parts: [
    P(0.5, 'PressPath TV works offline, requests no permissions, and keeps its data on the device.'),
    P(5.6, 'It was verified on an Android TV emulator. It has not been tested on Fire TV hardware.'),
    P(11.2, 'Every press counts. Every path gets smarter.')] }
];
const SKIP = 0.3, TAIL = 0.7, GAP = 0.25;

// ---------- narration audio ----------
mkdirSync(join(WORK, 'seg'), { recursive: true });
const items = [];
SCENES.forEach((s) => s.parts.forEach((p, k) => { p.id = `${s.id}_p${k}`; items.push({ id: p.id, text: p.say }); }));
writeFileSync(join(WORK, 'narration.json'), JSON.stringify(items, null, 2));
run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(HERE, 'tts.ps1'), '-InFile', join(WORK, 'narration.json'), '-OutDir', join(WORK, 'tts'), '-Rate', '+8%']);
for (const it of items) {
  // trim the synthesizer's trailing silence, normalise loudness, 48 kHz stereo
  run('ffmpeg', ['-y', '-v', 'error', '-i', join(WORK, 'tts', it.id + '.wav'), '-af',
    'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo',
    join(WORK, 'tts', it.id + '.n.wav')]);
}

// ---------- closing card ----------
const card = join(WORK, 'closing.png');
if (!existsSync(card)) run('node', [join(HERE, 'render-card.mjs'), card]);

// ---------- segments ----------
let t0 = 0;
const cues = [], list = [];
SCENES.forEach((s, i) => {
  // place narration parts: never before their anchor, never overlapping the previous part
  let end = 0;
  for (const p of s.parts) {
    p.len = dur(join(WORK, 'tts', p.id + '.n.wav'));
    p.start = Math.max(p.at, end + (end ? GAP : 0));
    end = p.start + p.len;
  }
  const skip = s.skip ?? SKIP, hold = s.hold ?? 0;
  const visual = s.card ? 0 : hold + dur(join(WORK, s.id + '.mp4')) - skip;
  const len = Math.max(end + TAIL, visual) + (s.card ? 1.4 : 0);
  const seg = join(WORK, 'seg', `${String(i).padStart(2, '0')}.mp4`);
  const vIn = s.card ? ['-loop', '1', '-t', len.toFixed(3), '-i', card] : ['-ss', String(skip), '-i', join(WORK, s.id + '.mp4')];
  let vf = `fps=${FPS},scale=1920:1080:flags=lanczos,setsar=1`;
  if (hold) vf += `,tpad=start_mode=clone:start_duration=${hold}`;
  vf += `,tpad=stop_mode=clone:stop_duration=${len.toFixed(2)},trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS`;
  if (i === 0) vf += ',fade=t=in:st=0:d=0.6';
  if (s.card) vf += `,fade=t=in:st=0:d=0.5,fade=t=out:st=${(len - 1.0).toFixed(2)}:d=1.0`;
  const aIn = s.parts.flatMap((p) => ['-i', join(WORK, 'tts', p.id + '.n.wav')]);
  const delays = s.parts.map((p, k) => `[${k + 1}:a]adelay=${Math.round(p.start * 1000)}:all=1[a${k}]`).join(';');
  const mix = s.parts.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${s.parts.length}:normalize=0:dropout_transition=0,apad,atrim=duration=${len.toFixed(3)},aresample=48000[a]`;
  run('ffmpeg', ['-y', '-v', 'error', ...vIn, ...aIn, '-filter_complex', `[0:v]${vf}[v];${delays};${mix}`,
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', seg]);
  // subtitles: each part split into sentences, timed by length across the part's audio
  for (const p of s.parts) {
    const sentences = p.sub.match(/[^.!?]+[.!?]+/g).map((x) => x.trim());
    const total = sentences.reduce((n, x) => n + x.length, 0);
    let st = t0 + p.start;
    sentences.forEach((x) => { const d = p.len * (x.length / total); cues.push([st, st + d, x]); st += d; });
  }
  list.push(`file '${seg.replace(/\\/g, '/')}'`);
  console.log(`${s.id}: segment ${len.toFixed(1)}s · parts at ${s.parts.map((p) => p.start.toFixed(1) + '+' + p.len.toFixed(1)).join(', ')}`);
  t0 += len;
});

const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
writeFileSync(OUT_SRT, cues.map(([a, b, x], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${x}\n`).join('\n'));
writeFileSync(join(WORK, 'concat.txt'), list.join('\n') + '\n');
writeFileSync(join(WORK, 'subs.srt'), readFileSync(OUT_SRT));
run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'joined.mp4'], { cwd: WORK });
const style = 'FontName=Segoe UI Semibold,FontSize=15,PrimaryColour=&H00FFFFFF,OutlineColour=&H70000000,BorderStyle=3,Outline=7,Shadow=0,MarginV=34,MarginL=60,MarginR=60,Alignment=2';
run('ffmpeg', ['-y', '-v', 'error', '-i', 'joined.mp4', '-vf', `subtitles=subs.srt:force_style='${style}'`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'copy', '-movflags', '+faststart', OUT_MP4], { cwd: WORK });
writeFileSync(join(HERE, 'narration.txt'), SCENES.map((s) => `[${s.id}]\n` + s.parts.map((p) => p.say).join(' ') + '\n').join('\n'));
console.log(`\n✔ ${OUT_MP4.replace(ROOT, '.')}  ${dur(OUT_MP4).toFixed(1)} s · subtitles ${OUT_SRT.replace(ROOT, '.')}`);
