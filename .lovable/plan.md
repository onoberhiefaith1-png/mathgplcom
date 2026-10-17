# Mathemagine: proper Windows installer and honest downloads for every device

Android stays exactly as it is. No publishing until you ask.

## What students will get

**Windows**
- One file: `Mathemagine-Setup-1.0.1.exe`. Double-click, it installs, done. No ZIP, no extracting, no missing `ffmpeg.dll`.
- Installs for that student only, so it doesn't need an administrator password.
- Mathemagine gets a desktop shortcut, a Start menu entry and an entry in Settings > Installed apps, with the Mathemagine name and icon everywhere (installer, window title, shortcut, uninstall entry). The words "MathGPL Academia" no longer appear.
- Uninstalling asks "Keep my saved schools and progress?". Keep is the default, so unsynced work is never lost by accident.

**Mac (Apple chip and Intel)**
- Kept as separate downloads, renamed to Mathemagine, with clearer steps. The website calls them "unsigned preview" builds until Apple signing is set up (see below).

**iPhone and iPad**
- Stay on the "Add to Home Screen" method that already works (name, icon, offline). The page never offers an APK or `.exe` on Apple phones, and it says plainly there's no App Store version yet.

**Download page**
- Each button shows the name, version, file size and supported systems (Windows 10/11 64-bit; macOS 11+). The ZIP, extract and "Run anyway" steps are removed from the normal Windows path. Only one honest note stays: Windows may show a blue "unknown publisher" screen until the app is signed.

## Updates: how they actually work
The installed app is a window that opens Mathemagine from mathgpl.com, then keeps a saved copy for offline use. So:
- **Lessons, Sessions, diagrams, Game and Practice changes** reach installed apps automatically after you publish. The existing Update button handles them. Nobody re-downloads anything.
- **Changes to the window itself** are rare. The app checks a small version file when it's online. If there's a newer installer, it shows a quiet "New version available" note, never during an activity. Running the new installer upgrades in place.
- Saved schools, guest identity, history, marks, best times and downloaded Sessions live in the student's own app-data folder, not with the program files, so updates and reinstalls keep them.
- Offline, the app opens its saved copy as it does now.

## Things only you can arrange (not included)
- **Windows signing certificate** (roughly £100–£400 a year, from a provider such as Certum, Sectigo or Azure Trusted Signing). It removes the "unknown publisher" screen. I won't claim the app is signed until it is.
- **Apple Developer account** (£79/$99 a year). It's needed for a signed Mac app and for iPhone TestFlight or the App Store.
- **Real-device tests:** a clean Windows PC (install, open offline, upgrade from 1.0.0, uninstall) and a Mac. I can check the files here, but I can't run Windows or macOS.

## Technical section
- Package with `@electron/packager` (win32 x64, executable `Mathemagine.exe`, version 1.0.1, Windows icon `.ico` made from `desktop/academia/icon.png`). Then build an NSIS installer with `makensis` from nix: per-user install to `%LOCALAPPDATA%\Programs\Mathemagine`, shortcuts, HKCU uninstall key with DisplayName/Version/Icon, and an uninstaller that keeps `%APPDATA%\Mathemagine` unless the student chooses to remove it. electron-builder isn't used because it fails in this environment.
- Set `app.setName("Mathemagine")` and pin `userData` to a fixed `Mathemagine` folder so data survives upgrades. A one-time migration copies the old `MathGPL Academia` profile if one exists.
- `main.cjs`: when online, fetch `https://mathgpl.com/desktop/latest.json` (`{version, url, sha256}`) and compare it with `app.getVersion()`. A newer version gets a non-blocking notice that opens the installer link. There's no silent self-install, since unsigned auto-installs are unsafe and blocked on Mac.
- Mac: re-package both arches as `Mathemagine.app` and zip them. A DMG needs macOS tools, so it stays a zip and is labelled honestly.
- Check the result in the sandbox: list the installer's contents (confirm `ffmpeg.dll` and the other runtime files are inside the installer), check the size, then upload it with lovable-assets.
- Update `src/lib/offline/releases.ts` (Windows `.exe` entry, version, supported OS) and the download page copy. Add a test that the Windows release points to a `.exe`, iOS gets no file download, and Android is unchanged.
- Update `desktop/academia/AGENTS.md`.
