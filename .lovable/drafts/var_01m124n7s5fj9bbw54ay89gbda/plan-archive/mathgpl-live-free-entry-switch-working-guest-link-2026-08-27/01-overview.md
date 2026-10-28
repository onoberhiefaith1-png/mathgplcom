# MathGPL Live — Free Entry switch + working guest link

Two things: put an **Allow Free Entry** control where the teacher actually manages a session, and make the invite link (and code) open the session for someone with no account instead of "Session unavailable".

## What the teacher gets

- A Free Entry icon-toggle on the session dashboard header (next to the Join Link / code), mirrored on the Audience page.
  - **On** — anyone with the link or code walks straight in. No pending request, no approval queue.
  - **Off** — arrivals land on "Waiting for teacher approval" and appear in the Audience approval list.
- The switch is per session and can be flipped at any time, including mid-lesson.

## Why the link fails today (verified on the live database)

- Guests read the session row with the anonymous key, but `sessions` has **no anonymous SELECT grant**, so the row comes back empty and the page renders "Session unavailable".
- The existing anonymous policy only allows sessions marked `visibility = 'public'` — a normal class session is not, so even with a grant it would stay hidden.
- The code lookup function `lookup_session_by_code` is **not executable by anonymous visitors**, so entering the code from the link also fails.
- `allow_free_entry` and the audience roll table are staged in this draft and do not exist in the live database yet; they arrive when the draft is accepted.
