# Professional video player + full-screen display

Only the presentation layer of the existing teaching-video player changes. Playback, upload, storage, checkpoint/section logic, and the Smartboard stay exactly as they are.

Two things are wrong today:

- The player pane has no true full-screen; the "expand" only widens the pane inside the page, and the pane's height is hard-set (`45dvh` / `100dvh`), so on wide or tall displays the video is not as large as it could be and the leftover space reads as an accidental block.
- The unused letterbox/pillarbox area is flat black with no relationship to the player, so it looks like a broken container rather than a deliberate player surround.

## What will change

1. **Stage that fits the video, not the box.** The player gets a measured stage: available width and height are read from the container, the video's intrinsic aspect ratio is read from the loaded file (`videoWidth/videoHeight`, defaulting to 16:9 until metadata arrives), and the largest box with that ratio that fits is centred. `object-fit: contain` stays — never `cover`, never a fixed pixel size.
2. **Real full-screen.** The full-screen button calls the browser Fullscreen API on the player wrapper (with a viewport-fill fallback where the API is blocked), so the player owns the whole screen. Inside it the same fit-the-ratio maths runs, so full-screen gives the maximum possible video with perfect horizontal and vertical centring.
3. **Intentional surround.** The area around the video becomes a quiet, very dark neutral player surface with a barely-there vertical gradient and no borders, cards, or shadows. The video keeps a subtle edge separation only. No bright blocks, nothing competing with the mathematics.
4. **Overlay controls.** Existing controls (previous / play / replay / next / Back to my line, section label, progress) keep their behaviour but overlay the bottom of the stage instead of occupying layout height, so entering or leaving full-screen never resizes the video or shifts the page.
5. **Responsive everywhere.** Because the stage measures its own box, the same code works on a laptop, a 1080p or 1200p monitor, a projector or TV, a resized window, the 50% split view, and a narrow 40% panel. Split view height stops being a fixed `dvh` value and becomes a flexible share of the row, so nothing overflows and no scrollbars appear.
