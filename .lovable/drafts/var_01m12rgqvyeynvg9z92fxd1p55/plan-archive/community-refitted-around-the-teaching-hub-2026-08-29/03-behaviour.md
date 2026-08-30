## What each layer shows

**Teaching Hub** — unchanged. No content becomes public unless the owner publishes it.

**Community Dashboard (mine)** — my profile plus exactly the items I published, grouped as Lesson Notes, Courses, Adventures, Classes, Live and Posts, each with an Unpublish control. If I have published nothing, it says so plainly and offers the publish route instead of showing empty owner sections that imply everything is public.

**Community Dashboard (someone else's)** — reached by clicking a person anywhere in Community. Same grouped sections, read-only, plus "Created by" identity, their proof points (students taught, experience, subjects, shared counts) and per-item actions: View, Copy to My MathGPL, Join/Request for classes, Join Live for live rooms. No edit, no unpublish, and no path anywhere near their Teaching Hub.

**Main Community** — refitted from category boxes into a continuously loading feed:

- Prominent search across people and learning content, with type and subject filters.
- Featured rail (large cards) → Live now → Recently shared → Lesson Notes → Courses → Classes → Adventures → Teachers → Schools → Students → Parents, each rail horizontally scrollable with "View all".
- Below the rails, an infinite "Everything recently shared" stream so scrolling always yields more.
- Every card carries a content-type badge, cover/thumbnail, title, creator identity, subject, one-line description and the relevant action.

## Courses become publishable

Courses currently have no way to reach Community. They gain the same publish flow as lesson notes: a Share/Publish action in the Teaching Hub course view, a Courses section in the Community Dashboard, a Courses rail and browse page in Main Community, and a public read-only course page.

## Never duplicate — especially video

Publishing writes a reference row (owner, kind, original asset id), never a clone. Opening a published course streams the **original** video owned by the creator; copying a course into my workspace copies structure and references the same original media rather than the file. If the creator edits, unpublishes or deletes the original, the public view follows immediately — including losing access to a deleted video.

## Classes

A published class is an invitation to be discovered, not shared ownership. Visitors see it in the feed and on the owner's Community Dashboard and use the existing Join/Request Access flow. `classes.community_shared` already exists and stays the switch.
