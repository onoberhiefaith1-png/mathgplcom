# Smartboard final phone UI, timer, and note behavior

## Goal
Turn the phone Smartboard into one compact, dedicated solving layout while preserving the existing solving, grading, Floating Number, video, settings, synchronization, and desktop/tablet behavior. Apply the timer and note rules consistently on phone, tablet, laptop, and desktop.

## Implementation plan

### 1. Create one phone-only Smartboard chrome
- Keep the existing Smartboard and its shared state; replace only the phone presentation branches.
- Remove the duplicate/inner phone header and render one measured top bar containing: Back, exactly three question positions, score, optional timer, compact zoom controls, Reset, Video when available, Settings, and Full Screen.
- Remove the title on phones only. Tablet and desktop retain their current layouts except for the universal timer/note changes below.
- Use a constrained responsive grid with shrink-safe icon controls, compact accessible labels/tooltips, safe-area insets, and no horizontal scrolling.
- Measure the actual top and bottom chrome heights and feed them into the board viewport so the solving canvas receives all remaining space without overlap.

### 2. Make the three-question tracker authoritative on phones
- Extract the moving-window calculation into a small tested helper: first questions show `1 2 3`, middle questions stay centered when possible, and the last three remain visible at the end.
- Always render three stable positions when three or more questions exist; use disabled placeholders only when the source truly contains fewer than three.
- Keep question navigation separate from completion state so moving between questions never clears awarded results.
- Extend the shared phone-session data passed by guest, assignment, exercise, adventure, and shared-board entry points as needed so the tracker receives the real total, active question, permanent completion, and timed-attempt completion rather than falling back to lesson beats.
- Render permanent completion in blue and the current timed-attempt state in green on the same question marker; never add a second question row.

### 3. Correct universal timer presentation and reset semantics
- Preserve the existing separate storage model: permanent achievement remains untouched, while timer-attempt progress remains temporary and resettable.
- Replace the current two-row permanent/attempt display with one combined marker per question/line on tablet, laptop, and desktop as well as phone.
- Show the elapsed timer only when enabled. Make its compact display expandable/clickable to reveal “Your Best” and “Overall Best” without permanent large columns.
- Preserve fastest-time logic by retaining the minimum successful time; add regression coverage proving a slower later attempt cannot replace a faster result.
- Keep Reset scoped to the current attempt: clear board work, green attempt state, elapsed time, and first-time note activators, while preserving blue completion, awarded marks, and best time.

### 4. Add the dedicated phone Floating Number layout
- Introduce one phone-only compact renderer that reuses the existing Floating Number content, insertion handlers, line state, synchronization, and note source.
- Hide desktop Floating Number design choices in phone Settings and always use the compact phone renderer there; leave all existing choices available on tablet/laptop/desktop.
- Default the Floating Number content to collapsed. The bottom toolbar remains visible at all times.
- Collapsed toolbar: Eraser, `#`, Undo, Redo, Previous Line, Next Line.
- Expanded toolbar: the same single row plus the current line indicator between Previous Line and Next Line; render the full-width, shallow Floating Number strip directly below it. Do not create a second navigation row.
- Keep any available note control compact within this system; opening a note must not create a permanently reserved empty area.
- Animate expansion/collapse and measure the rendered strip so the canvas height changes by the real amount, with safe-area support and no fixed panel-height assumptions.

### 5. Preserve and constrain the movable navigation pad
- Keep the four-way sensor pad separate at middle-right on phones.
- Retain vertical dragging, but clamp its position against the measured top bar, bottom toolbar/Floating Number region, and viewport edges so it cannot cover controls or leave the usable canvas.
- Preserve its existing sensor movement, hold-to-repeat behavior, and session position memory.

### 6. Make fullscreen genuinely immersive
- Keep the real browser Fullscreen API path and make the Smartboard root the fullscreen target.
- Synchronize icon state from `fullscreenchange`, handle exit and rejected/unsupported requests, and keep the existing immersive 100dvh fallback for browsers such as iPhone Safari that do not permit element fullscreen.
- On entry/exit, remeasure all chrome and Floating Number dimensions so the canvas immediately fills the newly available viewport and surrounding application UI is excluded wherever the browser permits.

### 7. Replace blocking notes with once-per-attempt activation
- Remove the current rule that returns early and blocks forward line movement when a note has not been clicked.
- Keep the glow as notification only.
- On the first forward move from a line with a note during the current attempt, reveal/write that note once and continue the requested navigation in the same action.
- Track activation idempotently per line for the current attempt. Back/forward revisits must not auto-open it again.
- Keep manual note opening available every time, even after automatic activation.
- Reset re-arms the per-line activators; ordinary navigation and question changes do not erase them unexpectedly.
- Preserve the existing single note source and do not infer note state from rendered board ink or reintroduce stale browser persistence.

### 8. Verification and regression protection
- Add focused tests for the three-position question window at the beginning, middle, and end; fewer-than-three questions; and persistent completed markers.
- Add timer tests for combined blue/green states, reset preserving permanent completion, and fastest-time retention.
- Add note-flow tests for non-blocking Next, one automatic activation per line, repeat manual opening, backward/forward traversal, and reset re-arming.
- Add phone Floating Number tests for collapsed/expanded states, one-row line controls, hidden phone design selector, and unchanged tablet/desktop variants.
- Run existing Smartboard, realtime synchronization, Floating Number, assessment, and timer tests plus the project type check.
- Verify with browser interaction at small phone, large phone, tablet, and desktop sizes: no horizontal overflow, all controls reachable, true fullscreen/fallback behavior, stable D-pad bounds, smooth measured expansion, persistent six-control toolbar, and unchanged desktop layout.

## Technical notes
- Primary work stays in the existing `PresentationView`, `FloatingNumberPanel`, `SettingsSheet`, `SensorDPad`, guest/student session adapters, and small extracted state/view helpers; the Smartboard engine is not replaced.
- Permanent completion and timed-attempt completion remain distinct data sources and are combined only for presentation.
- Note activation remains attempt-local UI state unless an existing shared-session requirement needs the same one-way state included in the current realtime delta; no independent note system will be introduced.
- No database migration is expected because timer attempts, permanent progress, and best-time persistence already exist separately.
