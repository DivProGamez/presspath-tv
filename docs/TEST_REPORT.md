# PressPath TV — Test Report

All results below come from this project's own new test suite. Raw output is saved in [`docs/test-output/`](test-output/).

| Suite | Command | Result |
| --- | --- | --- |
| Unit (logic) | `npm test` | **34 / 34 pass** — [unit.txt](test-output/unit.txt) |
| Browser end-to-end, keyboard and gamepad, fresh profile | `npm run test:e2e` | **37 / 37 pass** — [e2e.txt](test-output/e2e.txt) |
| Release APK build | `npm run build:apk` | **built and verified** — [build-apk.txt](test-output/build-apk.txt), [apk-info.txt](../dist/apk-info.txt) |
| Android TV emulator, remote keys | `npm run qa:emulator` | **24 / 24 pass** — [emulator-qa.txt](test-output/emulator-qa.txt) |

## Environment

- Windows 11, Node.js 24.11.0, headless Google Chrome via the DevTools Protocol. Every browser test starts a new temporary profile.
- Android SDK build-tools 35.0.0, platform android-35, JDK 21 (`JAVA_HOME`).
- Emulator: AVD `Television_1080p`, image `system-images/android-36/google-tv/x86` (reports "AOSP TV on x86", API 36, `android.software.leanback`), 1920×1080 at 320 dpi, Android System WebView 145.0.7632.122.

## Unit tests (`tests/unit/`, 34)

- **metrics** (7): presses by kind; edge-miss definition; A→B→A reversal and Back counted as backtracks; a selection breaks reversal detection; edge misses do not hide a reversal; seconds rounded from the first input; per-element edge misses.
- **tasks** (7): exactly five tasks in order; each completes only on its own app event; focus movement alone never completes a task; the clock starts on the first input, not on arming; nothing is recorded after finish; per-element edge data is stored for R2; every task has a shortcut destination.
- **rules and compare** (8): R1 threshold (≥5 presses in ≥2 baseline runs; a 4-press run does not count); R1 ignores adaptive runs and other tasks; R2 threshold (≥3 edge misses on one element); apply → no duplicate → undo keeps history, and runs are byte-identical; median for odd, even and empty sets; N/A without both sides; medians and signed deltas (7 → 3 = −4, −57%); percentage is N/A when Before = 0.
- **spatial, memory, store, decks** (12): grid moves; edge returns null; beam beats diagonal; the 45° cone blocks sideways diagonals; vertical fallback connects the header and content; available directions; 12 cards and six pairs with a deterministic seeded shuffle; match, mismatch, ignored flip and completion (moves counted per pair attempt); a flip during a pending mismatch hides the pair first; storage round trip, corruption recovery to `presspath.v1.corrupt`, and clear; malformed records dropped and the storage key is stable; three decks of ten cards.

## Browser end-to-end (`tests/e2e/`, 37)

**Journey at 1920×1080, keyboard only, fresh profile** (24 steps, `journey.e2e.mjs`):

1. The splash shows and a key press dismisses it.
2. Home first launch shows the honest empty evidence card, exactly one focus ring, and no page overflow.
3. Back restores focus (deck → Learn on `deck-science` → Home on `home-tile-cards`).
4. The Lab empty state: 3-step explainer, no strip, no suggestion bar, all 5 rows "Not measured yet". The "How we measure" panel opens and closes.
5. Back on Home cancels an armed task, and nothing is recorded.
6. Science baseline × 2: **7 presses, 0 backtracks, 0 edge misses** each. R1 is then suggested.
7. The R1 preview cites baseline runs #1 and #2 ("needed 7 and 7 presses in 2 baseline runs"). Apply creates `a1` with evidence `[r1, r2]`.
8. Adaptive run: the Home shortcut exists, the tile order is unchanged, and Up → shortcut → OK → OK gives **3 presses**.
9. The Lab evidence strip shows 7 → 3.
10. Before / After: "7 → 3 presses", "Δ −4 (−57%)".
11. Home shows the earned shortcut and the measured comparison.
12. Undo (from Before / After) marks the adaptation undone, keeps all 3 runs, and removes the shortcut. Home goes back to 5 tiles.
13. R2: a memory baseline with 3 deliberate Left presses on the first tile gives **6 presses, 3 edge misses**, all on `home-tile-lab`. The R2 preview says "layout order does not change". Apply.
14. R2 adaptive run: the first tile shows stronger focus plus 2 direction hints (up, right). The run is **3 presses, 0 edge misses**.
15. The other tasks complete on their real actions: High Contrast **6**, Large Text **7**, Letters **4** presses. The preferences really change.
16. Before / After for Letters (no adaptive run) shows "Not enough data to compare" and N/A.
17. Settings: the High Contrast variant, toggles, Reduce Motion (transitions 0s), and preferences persist.
18. Large Text keeps Home inside the 1080p stage: the hero text and evidence card end above the shortcuts label, and the tiles end above the footer.
19. Memory Pairs: a full game played with the remote, completion overlay (6/6, 6 moves, no timer or score), Play again resets.
20. Flashcards: question, reveal, next card hidden, previous, Back restores the deck focus.
21. Progress shows only stored measurements.
22. A reload keeps runs, adaptations and preferences.
23. Clear data: the first OK only arms the confirmation; Cancel keeps the data; Back also cancels; Confirm clears; the Lab returns to its empty state; the clear survives a reload.
24. No runtime exceptions on the console.

At every screenshot, the tests assert exactly one `.is-focused` element, that it is inside the visible stage and not clipped by its scroll container, and that no banned text appears (friction score, heatmap, dead end, focus loss, navigation sound, profile, accuracy, AI, cloud sync, sign-in, account, composite).

**1280×720** (9 steps, `viewport720.e2e.mjs`): the stage scales to fill 1280×720 without page scroll. Lab, Play, Learn, Progress and Settings each render with one visible focus ring. The same key path gives the same measurement (science baseline = 7 presses). With Large Text on, all Lab rows scroll into view with the D-pad, and nothing is clipped.

**Controls** (4 tests, `controls.e2e.mjs`):

- A scripted Gamepad API: A dismisses the splash, the D-pad and left stick move focus, A selects, B goes back and restores focus, and a guided task records gamepad presses (3).
- Backspace acts as Back. A mouse click during a task is ignored and not recorded.
- Reduce Motion removes the focus zoom. High Contrast uses a 5 px yellow `#FFE600` focus ring on pure black.
- Unreadable stored data is set aside as `presspath.v1.corrupt`, and the app starts fresh.

## Measured journey numbers

These are measured from real key presses, not hoped-for values. Browser, 1920×1080 ([journey.json](../evidence/browser-1080/journey.json)):

| Run | Presses | Backtracks | Edge misses |
| --- | ---: | ---: | ---: |
| Science baseline 1 | 7 | 0 | 0 |
| Science baseline 2 | 7 | 0 | 0 |
| Science adaptive (R1 shortcut) | 3 | 0 | 0 |
| Memory baseline (3 deliberate edge presses) | 6 | 0 | 3 |
| Memory adaptive (R2 emphasis) | 3 | 0 | 0 |
| High Contrast baseline | 6 | 0 | 0 |
| Large Text baseline | 7 | 0 | 0 |
| Letters baseline | 4 | 0 | 0 |

The emulator gave the same press counts: science 7, 7 → 3; memory 6 (3 edge misses) → 3.

Seconds in automated runs reflect the scripted key pacing (about 140 ms between keys in the browser and about 450 ms on the emulator). They are not human timings, so no claim is made about time savings for people.

The earlier "6 → 4" Science example from the old FocusPilot work does **not** apply. This is a different, new layout, and it measured **7 → 3** with the paths above. Nothing about that example is hard-coded: every number in the UI comes from stored runs.

## Not verified

- **Real Fire TV hardware and the Amazon Fire TV emulator were not tested.** The emulator used is Google TV / AOSP TV (API 36). Fire OS compatibility is expected from the design (minSdk 22, no Google or AndroidX dependencies, leanback launcher, no permissions), but it is **not verified**.
- The Gradle / Android Studio project files were not executed (Gradle is not installed). The verified build is `tools/build-apk.mjs`.
- A physical Bluetooth gamepad was not tested. In the browser, gamepad input was tested through a scripted Gamepad API; on the emulator, through `input gamepad keyevent KEYCODE_BUTTON_A`.
- Brand fonts are not bundled; system fonts are used (see README).
