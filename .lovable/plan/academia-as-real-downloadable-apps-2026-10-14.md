# Academia as real downloadable apps

## What exists today (checked)
- **Android:** a real, signed APK is already on the site (`mathgpl-academia.apk`, app id `com.mathgpl.academia`). It is a "Trusted Web Activity": it installs like an app and opens Academia directly, but it uses the phone's Chrome engine to run the Academia page and cache it for offline use.
- **Windows / Mac:** no app file. The buttons send people to install from Chrome/Edge (browser install). This is the gap your note points out.
- **iPhone / iPad:** Add to Home Screen guide. This is the right route without the App Store.
- No desktop app project and no automated build pipeline exist.

## What I will build

### 1. Windows app (real download)
- Package Academia as a desktop app that opens straight into Academia, never the full MathGPL site.
- Bundle the Academia screens, castle/Game look files and icons inside the app so it opens with no internet; student history and saved schools stay on the computer between launches and across updates.
- Content still comes from MathGPL's public Academia feed when online (Update button), exactly as now.
- Deliver `MathGPL-Academia-Windows.zip` (unzip and run `MathGPL Academia.exe`). A one-click `.exe` installer cannot be made in this workspace; it needs the build pipeline in step 4.
- Without a Windows code-signing certificate, Windows shows "Windows protected your PC" the first time. The download page will say how to click "More info, Run anyway".

### 2. MacBook app
- Build the same app for Mac (Apple chip and Intel) as a `.zip`.
- It is unsigned (no Apple developer certificate), so the first open needs right-click, Open. The page explains this and still offers the browser install as the simple option.

### 3. Download Academia window: honest labels
- Android: "Download APK" with version and file size.
- Windows: "Download for Windows" linked to the real file.
- Mac: "Download for macOS" plus the browser install alternative.
- iPhone/iPad: "Install Academia" with the Home Screen steps (unchanged).
- A button only appears when its file really exists; each shows version and build date from one small release list.

### 4. Repeatable builds (optional, needs you)
- Add a GitHub build setup that rebuilds the Android APK, the Windows installer (`.exe`) and the Mac app on every release. This needs the project connected to GitHub, and the signing keys added there as private secrets. I will prepare the files; you connect GitHub.

### 5. Checks
- Open the packaged app with the internet off: it starts in Academia, saved schools open, Practice/Play mark locally, history survives a restart.
- Download every button's file from the page and confirm it is the right type and not empty.
- Tests for the release list (no button for a missing file) and the device picker.

## Not changing
- The main MathGPL site, Game, Smartboard and grading engine are reused, not copied.
- No App Store / Play Store publishing, no deployment unless you ask.

## Technical details
- Desktop: Electron + `@electron/packager` (electron-builder fails in this sandbox), `electron/main.cjs` loading a dedicated static Academia build (separate Vite entry rendering `AcademiaApp`, `base: './'`, hash routing), `contextIsolation: true`. Data goes to `/api/public/academia-pack|sync|media` on mathgpl.com via absolute base URL; CORS allowed for the `file://`/app origin on those three public routes only.
- IndexedDB persists in Electron's userData folder.
- Artifacts placed in `public/downloads/` with `public/downloads/releases.json` (platform, file, version, builtAt, bytes); dialog reads it.
- CI: `.github/workflows/academia-release.yml` (Bubblewrap for APK, electron-builder NSIS on windows-latest, macos-latest for dmg), secrets via GitHub.
- New AGENTS.md rule for the standalone Academia desktop entry.
