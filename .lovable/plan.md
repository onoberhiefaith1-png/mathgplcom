# Workspace Hero Background (image or video)

Make the hero strip behind "Good evening, My!" editable from the hero itself, saved to the workspace, and completely separate from profile settings.

## What the teacher sees

- A small `⋯` button in the top-right corner of the hero (visible on the teacher's own workspace hero, not on the read-only school view).
- Clicking it shows one action: **Change background**.
- That opens a panel where the teacher can:
  - Upload a file (image or video), or
  - Pick from the existing workspace media library,
  - See a preview in the real hero shape,
  - **Save** (replaces the hero background) or **Cancel**, plus **Reset to default**.
- Images fill the hero with cover cropping, no distortion, no layout shift.
- Videos play muted, looping, no controls, as a background only.
- The greeting, blurb and Building button stay on top, unchanged.

## Persistence

The chosen media is stored as its own workspace setting, `heroBackground`, alongside the existing workspace homepage settings (the ones that already hold the rotating-building background). It survives reloads and returning to the workspace later.

Because it is its own field:
- Changing the hero background never touches the building background, and vice versa.
- Nothing here reads or writes the profile avatar or any profile field.

If a workspace has never set a hero background, the hero keeps showing today's fallback (the workspace building background, then the shipped default artwork), so nothing changes visually until a teacher sets one.

## Technical notes

- `src/lib/homepage/homepageConfig.ts`: add `heroBackground?: HomepageMediaRef | null` to `HomepageConfig`. No migration needed — the config is stored as JSON per account.
- `src/components/workspace/DashboardHero.tsx`: resolve `config.heroBackground ?? config.background`, set `kind` from the resolved ref's `mediaType` (fixing the current bug where a missing ref is assumed to be video), and render the `⋯` menu when `mode === "self"`.
- New `src/components/workspace/HeroBackgroundDialog.tsx`: upload + library + preview + save, reusing `uploadGameAsset`, `renderPathOf`, `AssetLibraryModal` and `SignedMedia` exactly as `HomepageBackgroundPage` does, and calling `save({ heroBackground: draft })`.
- Styling uses existing tokens and the current hero dimensions; no layout changes elsewhere.

## Also in this change: finish the in-progress Live schedule refactor

The Live per-day schedule work is mid-edit and the build is currently failing. Completing it is part of this change:

- Point `useUpcomingSessions.ts` at the new `nextOccurrence` return shape (`{ at, day, time }`).
- Replace the removed `formatRecurring` with `formatRoomSchedule` in `SessionsPage`, `SessionDashboardPage`, `SessionPickerPage`, `ParticipantSessionPage` and the audience pages.
- Ensure `schedule_times` flows through `createSession`/`updateSession` and the public session RPC hydration so every `LiveSession` carries it.
