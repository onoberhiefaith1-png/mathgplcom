# Mathemagine: design, branding and Practice fixes

Academia stays Academia inside MathGPL. Only the downloadable app (the offline Academia app and desktop/Android shells) is publicly named **Mathemagine**, using the brief's spelling (the picture says "Matimagine"; the brief wins). Same content, same data, no new learning system.

Order: correctness fixes first (they affect real marks), then branding, schools, theme, design.

## Step 1 — Practice fixes (Phases 5–8)
- **Early completion bug:** find where an activity is marked finished/full marks before the last line is verified (likely a percentage check against the pass mark). Separate three states: *in progress*, *completed* (last required line verified), *passed* (verified score meets pass mark). Completion never comes from the pass mark.
- **100% default pass mark:** find every place the 70% default is set (database defaults, Session/Assignment/Adventure/Game editors, grading fallbacks). New activities default to 100%. A teacher's chosen value always wins. Existing saved pass marks and past grades are not changed.
- **Timer back in Practice:** find why the existing timer no longer shows in Academia Practice (signed-in and offline) and Assignments, and show it again using the same timer engine (elapsed, my best, overall best, position). No second timer.
- **Remove Tutor and the top Score** from the Academia Practice screen only. Grading and the correct score display stay.
- **Reports check:** run a real timed attempt through a share link and confirm: only fully correct finishes count, faster time replaces best, ties go to first achiever, Teacher A never sees Teacher B's group, Wheel and Top Five use the saved times. Fix only what fails.
- Tests: default pass mark is 100; teacher 70 is kept; second-to-last line is not "completed"; incomplete attempt never becomes a best time.

## Step 2 — Mathemagine branding (Phase 3)
- "Download Mathemagine" button and dialog, install steps, app header/welcome, web app name and home-screen label, desktop window/app name, offline page.
- Android APK and desktop files keep their old built names until they are rebuilt; I will say which ones still show "Academia" when installed.

## Step 3 — One current school (Phase 4)
- Schools page: "Choose" / "Switch" / "Open school", with a **Current school** badge; no wording that suggests creating a school.
- Home, Learn, History and Evaluation show only the current school. Records stay saved per school, so switching back restores everything.

## Step 4 — Light/dark and colour themes (Phase 2)
- One button in the shared header: sun in dark mode, moon in light mode. Remembered after closing.
- Settings offers a few colour themes; the picture's blue/yellow is the default.
- Smartboard writing surface, maths and Game visuals keep their own colours so nothing becomes unreadable.
- Scope: the Mathemagine app fully; MathGPL main pages get the same switch but are not redesigned this round.

## Step 5 — New look (Phase 1)
- Restyle the five existing tabs (Home, Learn, History, Evaluation, Schools) and the Session, Share, Join, Results and Live Report screens after the picture: layered navy/blue gradients, warm yellow/orange highlights, rounded cards, subject colours (Maths orange, Physics blue, Chemistry purple), clear progress bars. Layout and navigation stay the same; screens stay separate.
- Phone, tablet and desktop sizes checked.

## Step 6 — Offline and devices (Phase 9–10)
- Theme, current school and history saved on the device; offline rankings labelled "saved on this device", not live.
- Final report lists each phase as done/tested, or still needs a real iPhone/Android/Windows/Mac test.

## Technical notes
- Brand constant in `src/lib/offline` used by dialog, manifest, `academia-app` head, `desktop/academia/main.cjs`/`package.json`/`offline.html`.
- Theme: `data-theme` + `.dark` class set before paint from localStorage; colour themes as token sets in `src/styles.css`; Smartboard root pins its own palette.
- Per-school data: offline attempts/session attempts filtered by school id derived from Session → Academia; add school id to new records if absent, never delete old ones.
- Pass mark: migration changes column defaults only (no UPDATE of rows); pure `completionState()` helper shared by online and offline graders.
- No publish without your go-ahead.
