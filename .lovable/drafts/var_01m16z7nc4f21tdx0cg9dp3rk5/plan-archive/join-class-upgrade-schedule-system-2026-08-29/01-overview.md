# Join Class Upgrade + Schedule System

A Class becomes a complete teaching space: it carries the same "when and where" information a Live Session already carries, plus a new **Schedule** (teaching plan) layer that says *what* will be taught on each date. Live Session gets the same Schedule section, from the same underlying structure.

Two distinct layers, one shared implementation:

- **When & where** — teaching days, start and end time, and either an online platform (Zoom, Google Meet, WhatsApp, YouTube, TikTok, Teams, Other) or a physical **Classroom** with address and room details. This reuses the existing Live platform structure and per-day schedule logic, extended with an end time and a location option.
- **What** — dated schedule entries (Week 1, 2 September, "Introduction to Quadratic Equations"), which power a **Coming Soon / Next Class** block and an **Upcoming Topics** list.

Nothing in the current Live Session flow is removed: permanent room links, sharing, free entry, guest links, and the live state all keep working exactly as they do now.
