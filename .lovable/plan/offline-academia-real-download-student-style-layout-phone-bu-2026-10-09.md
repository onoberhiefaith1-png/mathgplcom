# Offline Academia: real download, student-style layout, phone button placement

## 1. A real "Download" that installs the app
- Clicking Download no longer just opens a web page with instructions.
- **Android, Windows, Mac (Chrome/Edge):** the button calls the browser's own install prompt directly, so one click shows "Install MathGPL Academia" and it becomes an app on the device (own icon, own window, no address bar).
- **Windows and Mac desktop file:** add a real downloadable file (Windows .zip containing MathGPL Academia.exe, Mac .zip containing the app). Clicking Download on a laptop starts the file download straight away.
- **iPhone/iPad:** Apple does not allow apps to be downloaded from a website. The button shows the two-step "Share, Add to Home Screen" card only on iPhone/iPad.
- An Android .apk file (installable outside Google Play) can come later; it needs a separate build service.

## 2. Offline app looks exactly like student Academia
- Reuse the same screens students already see when signed in: Explore at the top, then Class, Subject, Topic, Subtopic, Session.
- Opening a Session shows the same layout: video on one side, activities on the other, with Practice and Play.
- Everything works offline except YouTube videos, which need data. Videos saved with an activity work offline.
- Same Back buttons and search as the student view.

## 3. Phone button placement on the front page
- **Phone:** under "Get Started" and "Log In", a full-width "Download Academia" button (removed from the top bar).
- **Laptop:** unchanged.

## Technical details
- Capture `beforeinstallprompt` in `/academia-app` and the front page; Download calls `prompt()`; fall back to the device card when unavailable (iOS, Firefox).
- Make the offline student screens render the existing student Academia components (Explore + hierarchy columns + Session page) fed from the IndexedDB pack instead of signed-in queries, through a shared data adapter so the signed-in student view is unchanged.
- Desktop files: package the offline app with Electron (`@electron/packager`, `base: './'` only for this build), upload Windows/Mac zips to public storage, link from Download per detected OS.
- `WelcomePage.tsx`: hide the header Download below `md`, show it under the main buttons/hero CTA on phones.
- Record in AGENTS.md: offline app renders the student Academia screens through a data adapter, never a forked layout.
