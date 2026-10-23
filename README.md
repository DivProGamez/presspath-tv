# PressPath TV

**Every press counts. Every path gets smarter.**

PressPath TV is a family TV app for Android TV and Fire OS: Memory Pairs, flashcards, a Navigation Lab, Progress and Settings. It measures navigation **inside its own interface**. Five guided tasks record the real remote presses, backtracks, edge misses and seconds each path takes. Two published, deterministic rules (R1, R2) then suggest reversible improvements, and a Before / After view compares real measured runs.

It is an original implementation, written from scratch. The two Stitch exports and the two reference boards were used only as the visual reference.

- Offline, with no accounts and no network permission. Everything is stored in one `localStorage` key (`presspath.v1`) on the device.
- No machine learning, no composite scores, no heatmaps, no invented analytics. When data is missing, the UI shows **N/A**.

## Project layout

```text
web/                    the app (plain HTML/CSS/JS, no build step, no dependencies)
  index.html
  css/app.css           cinematic 10-foot design system (navy/violet, azure focus glow, HC theme)
  js/core/              pure logic, unit-tested in Node
    store.js            persistence + corruption recovery           (presspath.v1)
    metrics.js          measurement rules (presses, backtracks, edge misses, seconds)
    tasks.js            the five guided tasks + session recorder
    rules.js            R1 Home shortcut, R2 focus emphasis, apply / undo
    compare.js          medians and Before / After differences, N/A handling
    spatial.js          geometric D-pad focus engine (beam + 45° cone)
    memory.js           Memory Pairs (4×3, six pairs, moves; no timer or score)
    decks.js            Letters, Numbers, Everyday Science (10 cards each)
  js/ui/art.js          original vector illustrations and glyphs (inline SVG)
  js/app.js             screens, focus, input dispatcher, task flow, overlays
android/                Android TV / Fire OS WebView wrapper (new, Java, no AndroidX)
  app/src/main/AndroidManifest.xml   leanback launcher, banner, NO INTERNET permission
  app/src/main/java/com/presspath/tv/MainActivity.java
  app/build.gradle …    Gradle files for Android Studio users (see "Build" below)
tools/                  serve.mjs · build-apk.mjs · emulator-qa.mjs · render-icons.mjs
tests/unit/             node:test unit tests (logic)
tests/e2e/              keyboard/gamepad browser tests via the Chrome DevTools Protocol (no npm deps)
evidence/               genuine screenshots: browser-1080/, browser-720/, emulator/
docs/                   TEST_REPORT.md, REMOTE_QA.md, raw test output
dist/                   built release APK + apk-info.txt
design-ref/             extracted Stitch reference exports (not shipped in the APK)
```

## Run and test

Requirements: Node.js 22 or newer, plus Chrome or Edge for the browser tests. There are no npm dependencies.

```bash
npm run serve
```

Then open http://127.0.0.1:8787/ and use the arrow keys, Enter (OK) and Esc or Backspace (Back). A gamepad also works: D-pad or left stick to move, A for OK, B for Back.

```bash
npm test
```

```bash
npm run test:e2e
```

## Build the release APK

Requirements: the Android SDK (build-tools 34 or 35, platform android-35) and a JDK with `JAVA_HOME` set.

```bash
npm run build:apk
```

`tools/build-apk.mjs` uses only the SDK command-line tools: `aapt2` compile and link, then `javac`, `d8`, `aapt add`, `zipalign` and `apksigner` (signature schemes v1, v2 and v3). It needs no Gradle and no network. Output: `dist/PressPathTV-1.0.0-release.apk`, with package metadata, permissions, signature verification and file list in `dist/apk-info.txt`.

On the first build it creates a local self-signed release key in `android/keystore/` (git-ignored). For store submission, replace it with your own key, or set `PRESSPATH_KS_PASS` and provide your own keystore.

The `android/` folder also contains standard Gradle files (AGP 8.7.3) for opening in Android Studio. They were **not executed here**, because Gradle is not installed on this machine. The verified build path is `npm run build:apk`.

## Emulator QA

Start an Android TV AVD, then run:

```bash
npm run qa:emulator
```

The script installs the APK, clears app data, launches it, and drives it with `adb shell input dpad keyevent …` (plus `input gamepad keyevent KEYCODE_BUTTON_A`). It checks results against the app's own log lines in logcat, and saves screencaps to `evidence/emulator/`.

## Measurement rules (as implemented)

| Term | Definition |
| --- | --- |
| Press | Any accepted remote input during an active guided task: Up, Down, Left, Right, OK, Back. |
| Edge miss | A direction press with no target in that direction. Focus stays put. |
| Backtrack | A move straight back to the element just left (A → B → A), or a Back press that returns a step or closes a panel. |
| Seconds | From the first accepted press in the task to the press that completes it. Arming a task does not start the clock. |
| Baseline run | A run with no active adaptation for that task. |
| Adaptive run | A run started while an adaptation for that task is active. |
| **R1** | The task needed ≥ 5 presses in ≥ 2 baseline runs. Suggests one Home shortcut to the task's destination. Tiles never move: the shortcut goes into a reserved row. |
| **R2** | ≥ 3 edge misses on the same element across the task's baseline runs. Suggests stronger focus on that element: a thicker ring plus arrows showing the valid directions. Layout order does not change. |
| Before / After | Medians of baseline runs vs medians of adaptive runs. The difference is After minus Before; the percentage is shown only when Before > 0. N/A until both sides have at least one run. |

Every suggestion opens a preview that cites the evidence runs (run number, date, count) before anything changes. Apply and Undo are both available. Undo keeps every recorded run and marks the adaptation as undone.

Pointer clicks are ignored while a guided task is measuring. Only remote, keyboard and gamepad input counts.

## The five guided tasks

Each task starts on Home, with focus on the first activity tile.

1. Start Memory Pairs and flip a card.
2. Open Science flashcards and reveal an answer.
3. Enable High Contrast in Settings. If it is already on, it is switched off first and the HUD says so.
4. Enable Large Text in Settings. Same rule as task 3.
5. From Home, open Letters flashcards.

## Platform notes

- The UI is designed on a fixed 1920×1080 stage that is scaled to the real viewport. TV WebViews usually report 960×540 CSS pixels at density 2.
- The WebView wrapper serves `assets/web/**` under a private `https://appassets.androidplatform.net/` origin through `shouldInterceptRequest`. Any other host is refused, and the APK requests no permissions at all.
- Remote keys go to the single JavaScript input dispatcher (`window.PressPath.input`), so guided tasks count exactly what the viewer pressed. On Home, pressing Back twice exits.
- Fonts: the Stitch design uses Plus Jakarta Sans and Space Grotesk. They are not bundled, because no copy was available offline. The app falls back to Segoe UI or Bahnschrift on Windows and Roboto on Android TV.
