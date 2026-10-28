# Global tutorial video system

The app already has a page-guide layer: one video per page, wrapped once around every route, managed only by platform administrators, shown in a split view beside the page. That is the right foundation, so this work upgrades it into the tutorial system you described rather than building a second feature.

What changes:

1. **An icon on every page, without exception** — including the intro / My GPA reimagined page, the login page and the rotating building. Today the control is hidden on auth pages and hidden entirely when a page has no video yet. It becomes always present: a small, quiet play-tutorial icon that blends into the page.
2. **Multiple videos per page** — a page becomes a small ordered playlist instead of a single video. Administrators and Asset Managers can upload several tutorials for the same page, reorder them, replace one, or remove one.
3. **Asset Managers gain management rights** — currently only administrators can add, replace or remove. Asset Managers get the same rights, enforced in the database, not just hidden buttons.
4. **The player keeps playing while you navigate** — once a tutorial starts it becomes an app-level player. Moving from Lesson Notes to Smartboard to Classes does not stop, reload or rewind it.
5. **Real player controls** — play/pause, timeline with drag, current time and duration, skip back / skip forward, volume and mute, playback speed 1x / 2x / 3x, fullscreen. No "next video" auto-advance: switching tutorials is always a deliberate click.
6. **Split view stays interactive** — page on one side, tutorial on the other, and the page remains fully usable while the video plays. Switching between page-only, split and video-only never remounts the page or restarts the video.

Nothing else moves: courses, Lesson Notes, Smartboard, Classes, Adventure, Skill Builder, My GPL Life, the Academy building, navigation and existing layouts are untouched.
