# Adventure — timeline as the conductor

A polish pass on the existing Adventure editor. Nothing is rebuilt: the video background, background, reward, progress bar, timer, effects, checkpoints, narration library, preview and saving all stay exactly as they are. Six behaviours are corrected.

## 1. Region-aware editing controls

The editor already knows which Learning Point the playhead sits inside, but the toolbar does not show it. Reward, Progress Bar, Timer and Add Effect become visibly tied to the current region:

- Playhead outside every region: those four buttons are inactive, with a short note naming what to do ("Move the playhead into a Learning Point to edit its reward, bars and effects").
- Playhead inside a region: the buttons are active and the toolbar states which region is being edited ("Editing Learning Point 2").
- Settings never mix between regions — each region keeps its own reward, progress percentage, timer duration and effects, which is already how they are stored.

## 2. Narration plays where it was assigned

Playback keys off the real playhead, so a clip pinned at 0:15 begins at 0:15 and never at 0:00.

## 3. Narration respects loop boundaries

A loop region is a hard wall for sound:

- A clip that began before a loop stops the moment the loop starts.
- A clip that began inside a loop stops at loop end.
- A clip never restarts because the video looped back; the loop repeats, the narration does not.
- A clip after the loop starts only when the timeline truly leaves the loop and reaches its position.

## 4. Narration library states are separated

Three independent things: the files in the library, the file the teacher has clicked, and the clip assigned to a timeline position.

- A freshly uploaded or recorded clip is dormant — nothing is highlighted or opened.
- Clicking a clip highlights it and reveals its name plus Play Once / Repeat; clicking another moves the highlight and the settings with it.
- Assign Narration acts only on the clip the teacher just selected, and never silently reuses a previously assigned one.

## 5. Preview shows only the active region

During Preview the top area shows the progress bar and timer of the region currently playing — nothing before it starts, nothing after it clears, and never every region at once. Seeking the playhead recalculates the active region and the narration state immediately, so audio from the old position stops.

## 6. Gallery hidden from other accounts, kept for the owner

The Gallery is unfinished, so it is temporarily hidden everywhere it appears in the Adventure interface for every account except the owner's own teacher account: no Gallery button, no panel, no "Gallery has not yet been set" warning, no empty placeholder. Nothing is deleted — the owner keeps full Gallery access to carry on developing it.
