# Academia Tiered Evaluation — Next Edition Spec

**Status:** Spec from Faith (dictated). Documentation only — no code in this pass.  
**Repo:** MathGPL / LevelUp (`mathgplcom-fix`).  
**Builds on:** Current site tiers (`d8e04e4` / `e942b36`) — beginner / intermediate / expert batches per session, per-tier scoring, TierPicker on assign, DB lock on `tier` after save.  
**Out of scope for this doc:** Implementing the changes; shipping a new Mathemagine installer.

---

## 1. Three video slots per session (one per tier)

**Today:** A session has a single video slot.  
**Next edition:** Each session has **three video slots** — one for Beginner, one for Intermediate, one for Expert.

- The video the learner sees is the one for the **currently selected tier**.
- A student who only cares about Expert watches the **Expert** video. They are **not** required to watch Beginner or Intermediate videos.
- Empty video for a tier: show that tier’s empty/no-video state; do not fall back to another tier’s video.

Teachers attach (or leave empty) a video when building each tier’s content for the session.

---

## 2. Phone-first layout

- Design the **phone** experience first for session view, tier switching, video, practice controls, and empty states.
- Then adjust the **laptop** view so the same behaviours fit a wider layout — same information architecture and controls, not a pixel-perfect copy of the phone UI.

---

## 3. Single tier selector (session view)

Inside a session, the learner (and teacher preview of learner view) uses **one** tier control:

- **Placement:** top right of the session view.
- **Shows:** current tier label (Beginner / Intermediate / Expert).
- **Default:** Beginner, unless overridden by the user’s settings default (§4).
- **Switching:** left/right arrows (or equivalent) cycle tiers.
- **Effect of switch:** everything bound to the active tier updates together — **video and questions** (and other activities in that tier’s batch).
- **Empty tier:** if the selected tier has no activities (and/or no video), show that tier’s **empty state**. No fallback content from another tier.

This replaces the need for the learner to scroll three separate full stacks as the primary way to change difficulty; the three batches still exist in data, and the selector chooses which batch (and video) is in view.

---

## 4. Settings: default tier

Users can set a **default tier** in settings: Beginner, Intermediate, or Expert.

- Opening a session starts on that default (instead of always Beginner), until they switch with the session selector.
- If unset, default remains **Beginner**.

(Clarify in implementation whether this is per user globally, or per academia / school — product default: one personal preference unless Faith decides otherwise.)

---

## 5. Practice button size (mobile)

- On **mobile**, practice controls are currently too small for thumbs.
- Game controls were already upgraded to a comfortable thumb size; **practice** was not.
- Next edition: enlarge practice buttons / hit targets to the same **thumb-friendly** standard as the upgraded game controls (phone-first; laptop can use appropriately larger or denser controls without matching phone pixels).

---

## 6. Mathemagine app parity

**Today:** Academia tiers (picker, per-tier batches, per-tier evaluation) live on the **website** path only. Mathemagine (offline Academia app / desktop + web-installable Academia section) has **no** tier UI or per-tier results yet. Shared DB rows may already carry `tier`, but the app does not surface them.

**Next edition:** Bring tiers into **Mathemagine**:

- Session view with the single tier selector (§3).
- Per-tier video slots (§1) when offline packs include them.
- Per-tier activities and evaluation consistent with the site.
- Phone-first practice control sizing (§5) on the app’s mobile surfaces.
- New app build / installer required after the work lands (current installers remain pre-tiers until then).

---

## 7. Existing constraints (carry forward)

These rules from the current edition stay unless Faith explicitly revises them:

| Rule | Behaviour |
|------|-----------|
| **Tier locked after save** | `academia_activities.tier` (and session binding) cannot be changed in place — DB lock / trigger. |
| **Reorder** | Only **within** the same tier of the same session. |
| **Move between tiers** | Teacher **removes** the activity and **re-assigns** it into the target tier (same question already in another tier is refused until removed). |
| **Who assigns** | Subject teachers (school shared workspace / `academia_can_build_subject`); activities hang off exactly one session. |
| **Missing tier value** | Normalize to Beginner on write. |

Assignment UI (lesson-note Assign → Academia, session-page Add MCQ / Add Adventure) continues to set tier at insert time; next edition may also need teacher UI to set each of the three session videos.


---

## 8. Floating number size setting

**Default:** Make the game's **current** floating-number size the default size going forward.

**Laptop / Smart Board:** Add a **Floating Number Size** control in **Smart Board settings**. Users can:
- **Increase** — bigger, then bigger again, up to as large as the screen head allows.
- **Decrease** — smaller steps the other way.

**Accessibility:** Users with sight difficulties can enlarge floating numbers for readability.

---

## 9. Phone settings (default tier + floating number size)

On the **phone app**, these preferences live in the **app's own settings** — not inside the Smart Board.

There, users can set:
- **Default tier** (Beginner / Intermediate / Expert) — same intent as §4, exposed in phone app settings.
- **Floating Number Size**.

**Preview:** When the user taps **Floating Number Size**, the floating-number view opens (on phone or on Smart Board, depending on where they are) so they can increase/decrease and **preview** the size before committing.

---

## 10. Phone scaling (controls + floating numbers together)

On the **phone** floating-number / practice surface:

- **First row:** Previous, Next, Undo, Erase.
- **Underneath:** the floating numbers.

When the user **increases** size, **everything** scales proportionally — erase (and the other first-row controls as part of that scale), the floating numbers, and the **space between** them. **Decrease** shrinks the same set the same way. No control stays fixed while numbers alone grow or shrink.

---

## 11. Erase fix

**Bug today:** Erase appears not to work.

**Fix:** Once erase is **activated**, anything the user **touches** should **disappear** from the screen (clear that drawn / placed content under the touch). Activation stays on until the user turns erase off (or an equivalent clear-mode end), consistent with how erase mode should behave on the board.



---

## 12. Issue reporting

Add a **Report an issue** option on **each activity** (including game apps: last item in the **edit** menu).

**Student flow:** Tap **Report an issue**, type what is not working (for example a number misbehaving, or a wrong solution). **No review step** — the report is submitted immediately.

**Who sees it:** Reports go straight to the **school team** — the **school owner** and any **teachers assigned that subject**.

**Team side:** A **notification bar** collects all incoming problems. After checking, the team can **respond** and **rectify**. Reports may be **ignored** or **worked on** at the team's discretion.



---

## 13. Remove website redirect

Academia and Mathemagine currently **redirect** users leaving the app to the **GPA website sign-up** page.

**Change:** **Remove** that redirect. The website is **not launching yet**, so Mathemagine should **stand on its own** without sending students to the website.

---

## 14. Back navigation

Every page must have a **back** control: an **arrow pointing backward** (not the word "Back").

The back arrow must return the user to **exactly where they were** before they opened the current page.

The team has reported backward navigation as a major issue; this is the fix.



---

## 15. Edit menu dismissal

In the game, clicking **edit** (three dots) brings up a list of options (sound, exit, etc.) on the game screen.

**Today:** The only way to dismiss that menu is clicking the three dots again.

**Fix:** Tapping **anywhere** on the screen should dismiss the edit menu, so users do not have to reopen the three dots just to close it.


---

## 16. Acceptance sketch (next edition)

Done when:

1. A session can store and show three videos; switching to Expert shows only the Expert video (or Expert empty state).
2. Phone session UI is the design source; laptop is adapted, not a 1:1 pixel port.
3. Top-right tier selector switches video + questions together; empty tier = empty state, no cross-tier fill-in.
4. Settings offers default tier; new session opens respect it.
5. Mobile practice controls meet the same thumb size bar as the upgraded game controls.
6. Mathemagine builds include the tier selector, per-tier content, and per-tier evaluation (not site-only).
7. Lock / reorder / remove-to-move rules still hold.

---

## Related

- Prior plan: `ACADEMIA_TIERED_EVALUATION_PLAN.md`
- Site implementation reference: `src/components/academia/TierPicker.tsx`, `src/lib/academia/tiers.ts`, migration `0022_academia_tiered_evaluation`
- Mathemagine surfaces: `desktop/academia/`, `src/pages/academiaApp/`, `src/lib/offline/`
