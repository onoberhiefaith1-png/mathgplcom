# Redesign the Academia Adventure sound settings

The ⋯ sound window on a Session's Adventure card becomes the single place where the sound is set up and checked. What you hear there is exactly what students hear in the Adventure.

## What the window will show (top to bottom)

1. **Background music**
   - Upload a music file in this window. This one track is the Adventure's music and replaces the Game's own music for this Adventure. Nothing in the normal Game changes.
   - Play / Stop button, so you can hear the track while you set it.
2. **Normal volume** slider. It changes the music live while it plays, and the Adventure uses this level.
3. **Volume while the narrator talks** slider. It also changes live; a "Hear it" button drops the music to this level so you can judge it.
4. **Fade in seconds** and **Fade out seconds**, set separately (default 5 each): how long the music takes to go down before a narration and to come back up after it.
5. **Narration list**: every narration clip from the Adventure (Narration 1, 2, 3…), each showing its time on the video (read-only) and its length, with its own Play button. You can also set the narrator's volume here.
6. **Test the whole mix** button: plays the music with each narration in turn, using your fades and volumes. This lets you check everything works before students play.

The manual "narration segments" boxes are removed. The narration times now come straight from the Adventure's clips, so they always line up.

## In the student Adventure

- Before **Start Adventure** appears, the music and every narration clip have already downloaded.
- The music plays at your normal volume, fades down over your fade-in seconds before each narration, stays at the narration volume while it plays, then fades back up over your fade-out seconds.
- The student's single volume slider and mute still scale the whole mix.

## Technical details

- Save `{ music: {path}, musicVolume, duckLevel, narratorLevel, fadeIn, fadeOut }` in the existing `academia_activities.audio` field. No database change is needed. The upload uses the existing `uploadSound` storage path.
- `adventureMix.ts`: `duckAmount` takes separate `fadeIn` and `fadeOut` values. Segments come from the narrations as start = `time`, end = time + clip duration (measured once from the loaded audio). Update the tests with concrete values (fadeIn 3, fadeOut 7).
- `AdventureAudioSettings.tsx`: rewrite it with the sections above. It loads the Adventure's canvas via the activity's `ref_id`, reads the clips with `narrationsOf`, and gets signed URLs.
- `AcademiaAdventurePlayer.tsx`: play the uploaded music on the music channel when it is set, and fall back to the Game's music otherwise. Include it in the preload step before Start.
- Standalone Adventure, the normal Game and Smartboard stay untouched.
- Verify with the mix unit tests and a Playwright check that the window lists the narrations and that their Play buttons load audio.
