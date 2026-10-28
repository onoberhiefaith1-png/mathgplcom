# Game rewards, completion layout and Academia Session Play

## 1. Keep rewards separate from the writing surface
- Render placed rewards as a foreground decoration layer over the Game background, not inside the paper. Retain their association with the correct question/line for collection and scoring.
- Paper dimensions depend only on the writing and its frame: adding ten rewards, hiding them or changing their opacity must not change its width or height.
- Preserve the existing reward appearance, visibility/opacity settings and editor-only double-click/double-tap X removal. Preserve compact horizontal surfaces and existing device text settings.

## 2. Position the complete result screen correctly
- Start question-complete, final-complete, failure and paused/leave screens at the top of the Game viewport, independent of the previous writing-page scroll position.
- Use the annotated image as placement guidance: emotion key at top-left, result frame beginning at the top, emotion reaction cues bottom-left and character bottom-right.
- Reserve space for the character and reaction cues so they cannot cover Continue/Retry/Exit. Keep stars, result heading and buttons within view.
- Adapt the same composition to phone, tablet and desktop, including short phone screens and browser safe areas. If the results exceed the available height, scroll only their content while keeping the essential controls and character reachable.
- Apply the same composition to the editor preview and actual player without rewriting saved character placement merely because the viewport changes.

## 3. Continue through Academia Play within the same Session
- Keep each activity as one question with its own Practice and Play; link the Session's playable activities in their existing order.
- Completing Play 1 offers Continue to Play 2, then Play 3 and so on. Never open Practice during this sequence; activities without a playable Game are skipped.
- Show the current playable question number and Session total. Finish appears only after the final playable activity, and returns to the Session.
- Resolve the Session sequence before deciding that a question is final. A failed online lookup must not silently masquerade as the end of the Session.
- Support connected Academia and downloaded Academia; preserve per-activity marks, history and saved progress. Keep guest navigation restricted to its shared Session.
- Preserve normal Game question/Level progression and all Practice behavior.

## 4. Always retain a character and working emotion reactions
- Prefer the creator's configured character and reactions when their media is available.
- As selected, bundle a lightweight built-in character with local emotion reactions so unavailable, uncached or failed character videos never leave the character area blank, online or offline.
- Restore the creator's character when its media becomes available. Do not claim a video is saved offline until it has been cached and checked.
- Include authorized character media in offline preparation where feasible, without exposing the private Flow library or slowing the initial app download beyond its existing deadline. Keep new downloaded content behind the existing Update action.
- Emotion cues must visibly trigger either the creator's available reaction or a built-in reaction without requiring internet or AI.

## Confirmed implementation points
- `ImagineStage.tsx` currently renders decorative rewards inside each paper element, although absolutely positioned. Move that rendering to an independent layer and update reward animation/removal targeting accordingly.
- `GameCompletionScene.tsx` currently centers the result frame on desktop and bottom-aligns it on smaller screens. Character rendering requires enabled Flow, clips and an active scene; these conditions can currently leave no character visible.
- `ImaginePlayPage.tsx` already attempts connected Academia next-Play lookup, but does not wait for it before determining finality; its result count uses local Game boards rather than Session activities.
- `OfflineActivity.tsx` passes no next-Play callback to the Game player. Its parent supplies a continuation callback, but that callback is currently used only for Practice.
- `gameAssetIds()` does not include completion Flow clips. `FlowCharacter` resolves those clips through signed URLs rather than the offline Game media mapping.

## Technical approach
- Add pure, shared helpers for Session Play ordering/finality and viewport-safe result placement, with focused tests.
- Extend the existing offline player adapter with Session position/count and continuation, rather than creating another Game player.
- Reuse the existing Flow character renderer and emotion controls, adding an authorized cached-media resolver and a bundled fallback. Inspect the existing public-media authorization before any endpoint extension; do not broaden access to unrelated private clips.
- Retain table surface behavior, normal Games, archived Game Pro, existing scoring, workspace isolation and unrelated ChatGPT/Chemistry work.
- Record the confirmed preferences and architecture rules during implementation. No database migration or publishing is part of this plan.

## Verification before reporting completion
- Regression tests: identical paper dimensions with zero versus ten rewards; editor removal preserves other rewards; removal unavailable during play.
- Session tests: four playable questions advance 1 → 2 → 3 → 4, never Practice; skip Practice-only cards; Finish only at the last question; next-question lookup/loading errors do not falsely end a Session.
- Verify current Game editor and player on phone, tablet and desktop, including a short phone viewport: top-aligned result screens, visible character, reachable controls and working emotion reactions for completion, failure and pause.
- Exercise one authorized multi-question Academia Session through its actual connected Play flow, then downloaded Play with network disabled; confirm progression, saved results and fallback reactions survive reopening.
- Verify creator media restoration where authorized media is available, and check the automatic build diagnostics plus focused tests.
- Report any unavailable signed-in data or real-device checks as unverified. Leave changes unpublished.