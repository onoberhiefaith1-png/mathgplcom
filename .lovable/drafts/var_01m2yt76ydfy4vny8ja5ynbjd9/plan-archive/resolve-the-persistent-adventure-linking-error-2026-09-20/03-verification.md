## Technical checks after acceptance

- Confirm `public.class_adventures` exists with one unique Class + Adventure relationship, while allowing the Adventure in other Classes.
- Confirm `public.adventure_bar_questions` stores Question placement by Class + Adventure + existing Progress Bar.
- Confirm authenticated grants and owner/member access policies are active.
- Confirm Class and Adventure foreign keys use the existing records.
- Confirm the backend API sees both tables immediately.
- Confirm existing Adventure boards are carried into the new relationship without deleting or duplicating their Adventures.
- Confirm duplicate linking is idempotent and relinking restores the existing class-specific setup.
- Run type checks and focused Adventure/assignment tests.
- Exercise the live linking, refresh, multi-Adventure, cross-Class reuse, question placement, isolation, unlink, and relink scenarios.

## Completion condition

The fix is complete only when selecting an Adventure creates a persisted Adventure card with no error, and the relationship remains after refresh. A friendlier error message alone does not count as a fix.
