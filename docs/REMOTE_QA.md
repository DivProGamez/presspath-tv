# PressPath TV — Remote Navigation QA Report

**Build under test:** `dist/PressPathTV-1.0.0-release.apk` (`com.presspath.tv` 1.0.0, versionCode 10000, minSdk 22, targetSdk 35, 0 permissions, signature schemes v1, v2 and v3). The SHA-256 is in [`dist/apk-info.txt`](../dist/apk-info.txt).

**Device:** Android emulator AVD `Television_1080p`, Google TV system image, API 36, x86. It reports "AOSP TV on x86", with `android.software.leanback`, 1920×1080 at 320 dpi, and WebView 145.0.7632.122.

**Method:** `tools/emulator-qa.mjs` sends real `KeyEvent`s with `adb shell input dpad keyevent KEYCODE_DPAD_* / DPAD_CENTER / BACK` and `input gamepad keyevent KEYCODE_BUTTON_A`. Each result is checked against the app's own `[PP]` log lines in logcat. Screencaps are in [`evidence/emulator/`](../evidence/emulator/). Full log: [`test-output/emulator-qa.txt`](test-output/emulator-qa.txt).

## Results: 24 / 24 pass

| # | Check | Result |
| --- | --- | --- |
| 1 | Device booted; leanback feature present | ✔ |
| 2 | System WebView present | ✔ 145.0.7632.122 |
| 3 | APK installs (`adb install -r`) | ✔ |
| 4 | Package metadata | ✔ versionName 1.0.0, minSdk 22, targetSdk 35 |
| 5 | No INTERNET permission | ✔ |
| 6 | Launches from `am start` | ✔ |
| 7 | Web app boots from APK-local assets | ✔ |
| 8 | Splash dismissed with OK (DPAD_CENTER) | ✔ |
| 9–10 | Science baseline × 2 by D-pad | ✔ 7 presses, 0 backtracks, 0 edge misses, each |
| 11 | R1 preview → Apply | ✔ `a1` R1 science |
| 12 | Adaptive run via the Home shortcut (Up, OK, OK) | ✔ 3 presses |
| 13 | Undo restores | ✔ `a1` undone |
| 14 | Memory baseline with 3 Left presses at the first tile | ✔ 6 presses, 3 edge misses |
| 15 | R2 preview → Apply on the edge-miss element | ✔ `a2` R2, target `home-tile-lab` |
| 16 | Adaptive memory run with stronger focus | ✔ 3 presses, 0 edge misses |
| 17 | Flashcard reveal with OK | ✔ |
| 18 | High Contrast toggles with OK | ✔ |
| 19 | Clear data asks first (first OK only arms; Cancel keeps data) | ✔ |
| 20 | Gamepad BUTTON_A dismisses the splash after relaunch | ✔ |
| 21 | Runs and adaptations persist across force-stop and relaunch | ✔ 5 runs, 2 adaptations |
| 22 | Starts and runs with airplane mode on | ✔ |
| 23 | Back twice on Home exits to the TV launcher | ✔ |
| 24 | No crashes in the logcat crash buffer | ✔ |

## Remote behaviour checklist

| Requirement | Status | How it was verified |
| --- | --- | --- |
| D-pad Up / Down / Left / Right | ✔ | Emulator dpad keyevents; browser arrow keys; scripted gamepad D-pad and stick |
| OK / Enter | ✔ | DPAD_CENTER (emulator), Enter (browser), gamepad A (both) |
| Back / Escape | ✔ | KEYCODE_BACK (emulator), Escape and Backspace (browser), gamepad B (browser) |
| Predictable focus restoration after Back | ✔ | e2e: deck → Learn (`deck-science`) → Home (`home-tile-cards`); overlays return focus to their opener |
| Focus-aware scrolling | ✔ | e2e at 1280×720 with Large Text: every Lab row is scrolled fully into view, and none is clipped |
| No focus traps | ✔ | Header ↔ content connect vertically (unit + e2e); every screen is left with Back or the top navigation |
| No hidden or clipped focus | ✔ | Each screenshot step asserts exactly one `.is-focused`, inside the stage and inside its scroll container |
| No unexpected diagonal moves | ✔ | Left/Right are limited to a 45° cone (unit test); rows never hop sideways |
| Exactly one visible focus target | ✔ | Asserted on every captured screen |
| Neon focus legible in normal and High Contrast | ✔ | Azure multi-layer glow (normal); 5 px `#FFE600` ring on black (High Contrast, asserted) |
| Reduce Motion respected | ✔ | Transitions 0s and no focus zoom (asserted) |
| No network needed | ✔ | No permissions; airplane-mode launch passes on the emulator |

## Limitations

- **Not tested on Fire TV hardware or Amazon's Fire TV emulator.** Fire OS compatibility is therefore unverified.
- The Fire TV remote's Menu, Home and media keys are left to the system and not used by the app.
- Seconds measured by automation reflect scripted key pacing, not human timing.
