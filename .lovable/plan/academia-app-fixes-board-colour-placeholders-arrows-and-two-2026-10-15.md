# Academia app fixes: board colour, placeholders, arrows, and two install modes

## 1. Whiteboard is white again (Android app, and anywhere else the board shows)
- The phone photo shows the board dark even when Whiteboard is chosen. Find where the installed app sets the board colour and make sure Whiteboard gives a white board with dark writing, and Blackboard gives a dark board with light writing.
- Check that switching in Settings updates the board straight away and is remembered next time.
- Test in a phone-sized browser in both modes, online and offline.

## 2. Tapping a placeholder works
- Tapping a placeholder number (the boxed numbers like -5, +5, =, 10) is noticed but does nothing. Track down what the tap is meant to do (put that number on the current line) and fix it in the installed app.
- Test it by tapping each chip and checking the line updates.

## 3. Smaller arrow controls
- Make the up/down/left/right pad two-thirds of its current size (one-third smaller), including the gap between the arrows, so it takes up less of the board. It should still be easy to tap.

## 4. Download Academia window with two sections
```text
Download Academia
 [ Copy to phone ]   [ Download ]
```
- **Copy to phone** (shown first on phones): the old way, Android, iPhone/iPad, Windows and Mac, each adding Academia from the browser to the home screen or desktop (Add to Home Screen on iPhone, Install app in Chrome/Edge). This is how iPhone worked before, and it comes back.
- **Download**: the app files, APK for Android, zip for Windows, Apple chip and Intel zips for Mac, each with version and size.
- The window picks the right section and device for whoever opens it, and you can switch.

## 5. Windows download
- I checked: the Windows file is live on mathgpl.com and the server sends it correctly (115 MB). Why it didn't reach your laptop is not confirmed yet. It could be the browser blocking an unsigned zip ("Keep" / "Download anyway"), or the download being interrupted.
- I'll start a real download in a browser to confirm it finishes, check the zip opens and contains the .exe, and add a short note under the button telling people to choose "Keep" if the browser warns them.
- I can't run the Windows program here, so opening it on a real PC is still your test.

## Technical details
- Board theme: inspect the offline wrapper over the Game/board renderers in the Academia app pages and the global board styles; fix the theme token or class the offline app gets wrong, leaving the online Game unchanged.
- Placeholder: trace the chip click handler in the offline Academia board adapter and fix the event/state hookup.
- D-pad: scale the sizes in `SensorDPad` to 2/3 (all sizes, or a compact variant used on the board).
- Dialog: `DownloadAcademiaDialog` gets two tabs. Copy to phone brings back the deferred `beforeinstallprompt` install for Android and desktop, plus the iOS guide route (`/academia-app?install=1`). Download keeps `releasesFor`. Add a test that iOS sees Copy to phone and that each tab lists the right devices.
- Verify with Playwright at 393px and 1280px, tests and build. Nothing gets published until you say so.
