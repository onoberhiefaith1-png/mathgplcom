# Architecture rules

- Smartboard slide presentations portal into the Smartboard root: slide imagery stays below Flow, while presentation controls stay above Flow, so browser full screen preserves the complete teaching composition.- Academia (`academia*` tables, `/school/academia`, `src/lib/academia`) is a separate learning system; never build it on the 3D Academy/Building data (`academies`, `academy_rooms`…), which stays untouched.
- Academia is scoped per workspace: a school workspace has the school's Academia (teachers build only assigned Subjects), a personal workspace has the owner's Personal Academia; the two never mix, and media lives in the private `academia-media` bucket under `<academia_id>/`.
- Academia questions open directly (never guest links): each card stores its assessment/game in a hidden per-teacher `academia` class that viewers silently join via `academia_enter_activity`; that class is excluded from class lists, plan limits and workspace enrolment.
