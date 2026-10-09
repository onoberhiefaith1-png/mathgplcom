# Faithful offline Academia Practice and Play

## Goal
Replace the simplified purple/gold offline activity shown in the screenshot. A downloaded activity will open the same Practice Smartboard or the same Academia Game that students see online, with the teacher's background, question design, writing surfaces, Floating Numbers, tables, video, controls, timing, rewards, sounds and text sizing preserved. The offline version will not be a separate visual imitation.

## Student journey
1. The student adds an Academia to the installed app while connected.
2. The app shows an explicit download checklist and saves the complete Academia structure, each activity, its full Practice and Play configuration, uploaded media and Game assets.
3. An activity is marked **Ready offline** only after every required file has been saved and verified. YouTube remains online-only and is labelled before installation.
4. Practice opens the existing MathGPL Smartboard experience. Play opens the existing MathGPL Game experience and its original background—not the current simplified offline screen.
5. Work, scores, rewards, history and reports save immediately on the phone. When internet returns, queued records sync once without duplication.
6. Updates download as a new complete pack; the working old pack remains available until the replacement is verified.

## Build plan

### 1. Create one activity contract for online and offline use
- Expand the public Academia pack to contain the exact single-question board source used by Practice and the exact single-question Game board/configuration used by Play.
- Include question design and teacher image, expected lines, Floating Numbers, containers, tables/Subcells, notes, marks, timers, line-video mapping, surfaces, text settings, background, margin, rewards, Vaults and sound references.
- Keep one question per Academia activity. Normal Game Levels remain unchanged outside Academia.
- Version the pack and validate it before replacing a previously downloaded copy.

### 2. Reuse the real Practice Smartboard
- Retire the custom text-list Practice renderer.
- Mount the existing student Smartboard with a local activity adapter, preserving the same phone question-first flow, full-screen board, individual writing surfaces, math formatting, Floating Numbers, tables, scrolling, video/Auto behaviour and Back-to-Session path.
- Add an offline session adapter for board restoration, timers and progress so the Smartboard never waits for account, live-class or network services.
- Keep connected-only features such as asking a teacher and live teacher mirroring unavailable when offline; they return automatically when connected.

### 3. Reuse the real Academia Game
- Retire the custom offline Play renderer.
- Mount the existing Academia Game page from the downloaded Game and question payload, preserving the same background or video, profile image, writing surfaces, responsive text size, margins, table surfaces, rewards, coins, lives, Vaults, sounds, timers and Exit/Back behaviour.
- Add local persistence to the existing Game runtime so progress and consumed rewards survive closing the app without making network calls.
- Keep Academia's direct single-question launch: no normal Game Level selector appears.

### 4. Make evaluation fully local and authoritative
- Package expected, student and predictive-line inputs for each activity and use the existing deterministic predictive engine on the device.
- Grade on the finishing digit/token, rebuild prediction after further edits, award each line once, and retain the existing brown/blue line states.
- Support table/Subcell coordinate marking locally.
- Store per-line evidence, awarded marks, elapsed time and completion state for results, reports and later sync.
- Do not use AI or credits offline. Ambiguous work that the deterministic engine cannot prove will receive a neutral “check when connected” state rather than a false mark.

### 5. Download every required visual and media asset
- Save uploaded Session videos, activity images, question designs, Game backgrounds/videos, writing-surface images, profile imagery, reward artwork and sounds under stable offline addresses.
- Keep uploaded video line mapping and Auto playback behaviour; `#` starts line one and subsequent line changes trigger mapped segments when Auto is on.
- Leave YouTube streaming online-only.
- Add space checks, resumable retries, per-activity status, failed-file details, remove-download controls and a final integrity check.

### 6. Preserve results, reports and history
- Upgrade the local store to retain full board/Game state, attempts, best/latest scores, rewards and sync status.
- Keep Explore, Classes → Subjects → Topics → Subtopics → Sessions, Continue Learning, Previous Activities and activity history available offline.
- Queue idempotent sync records and reconcile them after reconnection without deleting newer local work.

### 7. Installation and update safety
- Keep the generated PWA worker and guarded registration already used by the project.
- Pre-cache the installed shell and downloaded pack assets, while keeping page navigation network-first when connected.
- Never expose a half-downloaded pack: retain the last verified pack until the new version is complete.
- Surface offline readiness on the Session and activity cards before the student disconnects.

## Verification gates
- Add contract tests proving an online activity and its downloaded copy compile to equivalent Practice and Play inputs.
- Add deterministic tests for equations, fractions, symbols, predictive completion, edits after completion, tables/Subcells, timers, rewards, duplicate-safe sync and pack upgrades.
- Compare connected and offline screenshots at phone and desktop sizes for the same Practice and Play activity.
- Install on an iPhone from Safari, open once online, enable airplane mode, relaunch from the Home Screen, then complete Practice and Play—including uploaded video, instant scoring, rewards, history and app restart restoration.
- Reconnect and confirm one clean result/report sync.

## Technical boundaries
- Academia remains separate from the 3D Academy/Building system.
- The existing Smartboard and Imagine Game renderers remain the visual source of truth; no second offline design is maintained.
- The offline path performs no AI calls and spends no AI credits.
- Public pack access remains limited to public Academias and only the media/configuration belonging to their activities.
- Online Practice, online Play, normal Game Levels, Courses and teacher authoring keep their current behaviour.

## Delivery order
1. Versioned full-fidelity pack and local asset manifest.
2. Real Smartboard running from the local pack.
3. Real Game running from the local pack.
4. Local marking, persistence, reports and sync.
5. Installed iPhone airplane-mode parity test and visual corrections.
