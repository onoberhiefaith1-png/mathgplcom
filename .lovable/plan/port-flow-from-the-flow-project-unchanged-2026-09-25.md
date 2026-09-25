# Port Flow from the FLOW project, unchanged

The working Flow lives in the FLOW project (about 3,000 lines). This is a straight copy and hookup: same code, same controls, same names and colours. No redesign.

## What gets copied as-is

Character and scene logic (`src/lib/flow/`)
- `machine.ts`: the state machine for Base, emotions (queued in click order, never cut mid-scene), Float Out, the sensor/tray state, Float In, and `#` on/off
- `segments.ts`, `types.ts`: scenes, emoji/text emotion display, trail (Blue, Purple, Gold, Green, Pink, Orange presets), position, volume, idle time
- Background removal: `alpha.ts`, `checkerKey.ts`, `liveKey.ts` (live keying), `segmentVideo.ts`, `birefnet.ts`, `frameSource.ts`
- `api.ts`: loading, saving, library, covers, uploads

Screens and controls (`src/components/flow/`)
- `FlowOverlay` (Smartboard layer), `FlowCharacter`, `FlowEmotionBar`, `FlowTrail`, `DraggableResizable`, `ClipProcessor` (cut-out with keep/remove brush), `FlowCard`, `FlowToggle`
- Pages: `FlowSetupPage` (scenes, clips, Base/Float In/Float Out/emotions, tray colours, trail) and `FlowLibraryPage` (your Flows and the MyGPL Flow library)

Test: `flow-machine.test.ts`.

## Hookup in this project

- Lesson Notes editor: add the Flow on/off switch to the header, like the old version
- Smartboard (Present Mode): mount `FlowOverlay` with the old wiring. Floating Numbers counts as `#` on, and while Flow is active Floating Numbers stays open until `#` is pressed again
- Pages: `/flows`, `/flows/$flowId`, `/lesson-notes/$id/flow`, all behind sign-in
- Server helpers: copy the `flow-qa` (cut-out quality check) and `flow-library-bg` functions

## Data

The FLOW project has no saved database setup, so it will be rebuilt from the old code:
- New `flows` table (owner, name, scope mathgpl/personal, draft/published status, cover, clips, scenes, trail, position) with access rules: owners edit their own Flows, admins edit MathGPL library Flows, signed-in users read published ones
- Add `flow_id` and `flow_enabled` to lesson notes
- New private `flow-videos` file storage with owner-only uploads

## Limitation

Character videos you uploaded in the old FLOW app are stored with that app, and this project can't reach them. After the port, upload them again through Flow Setup. The cut-out step will process them the same way it used to.

## Technical details

- Change `react-router-dom` imports to the project's `@/lib/router-compat` and TanStack route files. Switch the toast to sonner. Leave all logic unchanged
- Install `@huggingface/transformers`, `mp4box@0.5.3`, `webm-muxer`. `@imgly/background-removal` is already installed
- Load the heavy cut-out modules only in the browser, after the page loads, so Smartboard and page loading don't break
- Check it: the test file, a typecheck, and a Playwright run of Flow Setup, then the Smartboard with Flow switched on
