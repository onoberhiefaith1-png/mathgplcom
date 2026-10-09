# A real Academia app on iPhone: works now, App Store later

## Why there is no download button on your iPhone
Apple does not let any website put an app straight onto an iPhone. On iPhone, an app can only come from one of two places:
1. **Add to Home Screen.** This is free and works today. Academia gets its own icon, opens full screen with no address bar, and works without data.
2. **The App Store or TestFlight.** This needs an Apple Developer account, about $99 a year, in your name.

You chose both. Part 1 gets you a working app on your phone today. Part 2 prepares the App Store version.

## Part 1: A guided install that works on iPhone today
- **One clear "Install Academia" button** on the front page and inside Academia, also on iPhone. Today the iPhone only shows a line of text.
- Tapping it on iPhone opens a **step-by-step guide with pictures** that points at Safari's own buttons:
  1. Tap the Share button at the bottom of Safari (the guide shows its icon).
  2. Scroll and tap **Add to Home Screen**.
  3. Tap **Add**. The Academia icon appears on your Home Screen.
- **Not in Safari?** If the page is open in Chrome, WhatsApp or Instagram, the guide says "Open in Safari" and gives a Copy link button, because only Safari can add apps on iPhone.
- **Getting ready for offline:** before you install, Academia saves the app itself plus every school you added, with its sessions, activities, pictures and saved videos. A progress bar shows this, then "Ready offline". YouTube videos still need data.
- **After installing:** when opened from the icon, Academia shows no install card. It opens straight to My Schools, even in airplane mode.
- **Check:** a "Test offline" note tells the student to switch on airplane mode and open the icon to confirm it works.
- **Front page on phones:** a full-width "Download Academia" button sits under Get Started and Log In. Laptop stays the same.
- **Android:** stays as it is, with a direct download file and Install.

## Part 2: The App Store app (once your Apple account is ready)
- I wrap the same offline Academia as a native iPhone app project with the MathGPL Academia name, icon and splash screen, and set it to open offline.
- What you need to do: create an Apple Developer account. Then use a Mac with Xcode, or a cloud build service such as Codemagic, to send the app to TestFlight. TestFlight lets you install it on your own phone first. After that you can submit it to the App Store.
- I write a short step-by-step guide for that upload and save it with the app project in Files.
- When it's live, the iPhone "Install" button can also link to the App Store page.

## What I will check
- On an iPhone-sized screen, the install button and guide appear and nothing covers them. This includes the round play button at the top right in your picture.
- With the internet cut off, the app still opens and a saved activity still runs.

## Technical details
- `AcademiaApp.tsx` install card: always render a primary button. iOS opens an illustrated `IosInstallGuide` sheet. Detect in-app browsers (FBAN/Instagram/WhatsApp/CriOS) and show "Open in Safari" with copy-link. Hide the card when `navigator.standalone` or `display-mode: standalone` is true. Move the card below the floating play control.
- Pre-cache: before the install prompt, confirm the service worker is controlling the page and that added packs plus their media are in IndexedDB or Cache Storage. Show progress and a "Ready offline" state. Add `apple-touch-startup-image` and check the manifest `start_url`/`scope` for iOS.
- `WelcomePage.tsx`: confirm the phone Download button renders when the site content has no first section. Make it full width under the hero buttons.
- Part 2: add a Capacitor iOS project (`@capacitor/ios`) that loads the bundled offline build. Package it to Files as a zip with an upload guide. Signing and upload need the user's Apple account and a Mac or cloud build, so the sandbox can't do them.
