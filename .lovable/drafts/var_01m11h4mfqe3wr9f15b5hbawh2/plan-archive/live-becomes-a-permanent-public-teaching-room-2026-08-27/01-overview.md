# Live becomes a permanent public teaching room

Today a Live room is stored as a one-off event: the teacher sets a single date, time and duration, and the whole interface derives its state from that clock (`Scheduled → Starting soon → Live → Ended`). That is why an existing link can read "Ended" or "not found" when nobody is teaching yet.

The rework keeps every existing Live teaching tool (Lesson Notes, SmartBoard, Challenge, Group Game, Gallery, Reports) and changes only the room's lifecycle:

- A room is permanent. Its code and join link never expire and are reused every teaching day.
- The recurring schedule (day + its own time) is **information only**. It never opens, closes or ends a room.
- The teacher alone controls teaching with **Start Teaching / Stop Teaching**.
- Opening the link when the teacher is not teaching shows a **Broadcast Information** page, never an error.
- Opening the link while the teacher is teaching goes straight into the existing Live dashboard.

## What changes for the teacher

1. **Create / Settings** — one form used for both. Creating makes a room; Settings loads the existing room and saves back to it (never creates a second room). Fields: broadcast name, subject/topic, description, teaching days with a separate time per day, broadcast platform + its platform-specific fields, public/free-entry, optional lesson note.
2. **Teaching days** — no time field exists until a day is ticked. Ticking Monday creates Monday's own time field; unticking it removes that time. Each day keeps an independent time.
3. **Live Room Card** — permanent card in the Live area showing name, teacher, subject, public badge, each day with its time, current teaching status and the room code, with actions: Start/Stop Teaching, Settings, Show in Community, Copy link, Delete (confirm).

## What changes for the public

One permanent link, two states — an information page, or the live dashboard. Free entry means no approval step.
