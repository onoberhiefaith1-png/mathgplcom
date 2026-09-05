# Custom sign-in IDs and school-created student accounts

Two changes, both about how people sign in.

## 1. Teachers (and every account type) can choose their own ID

Today the ID is issued automatically and can never be changed. It becomes editable, exactly like a password:

- A new "Change your MathGPL ID" panel in account settings: type the ID you want, see instantly whether it is free, confirm.
- Fully free text — no forced prefix. Letters, numbers, dots, dashes and underscores, 4 to 32 characters, not case sensitive.
- If the ID is already taken by anyone, it is refused before saving, with a plain "That ID is already taken" message.
- The original issued ID (for example TCH/000012) keeps working as a permanent fallback, so nobody can lock themselves out. The chosen ID is what they hand out and what shows on their account page.
- Reserved words and anything that looks like a system ID are refused.
- A confirmation email records the change.

## 2. Schools and teachers can create student accounts

Self sign-up stays exactly as it is. In addition, a school or a teacher can create a student account directly from their People / Students screen:

- They enter the student's name, choose the student's ID, and set a password. No email address is involved.
- The ID is checked for availability the same way as above.
- A printable slip shows the ID and password to hand to the student.
- The creator can later reset the password, rename the student, suspend or remove the account.

### Where that student lands

A school-created student belongs to that school (or to that teacher's workspace) and nowhere else:

- Signing in with that ID and password opens that one school's student dashboard immediately.
- No workspace switcher, no joining other schools, no Community profile — one home only.
- A student who signs up for themselves keeps the current behaviour: their own account, and they can belong to several schools.
