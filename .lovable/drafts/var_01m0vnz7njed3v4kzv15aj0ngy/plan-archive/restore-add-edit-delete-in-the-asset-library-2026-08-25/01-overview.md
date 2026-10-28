# Restore Add / Edit / Delete in the Asset Library

Two accounts must always have full authoring power over the official Asset Library: your owner account and the dedicated asset-manager account. Right now the controls are hidden whenever the app cannot positively confirm manager status, so the library looks read-only — like an ordinary user's view.

What I checked in the live backend: your owner account holds `platform_owner`, and the manager account (a teacher account) holds a live asset-manager code, so both *should* pass the permission check. The weakness is that the permission depends on a redeemed code that can lapse or be revoked, there is no owner-facing list of who the managers are, and the interface silently degrades to read-only with no indication why.

## What changes

1. **A permanent manager list.** Manager rights come from an explicit list you control, not only from a redeemed code. Owner is always a manager; co-admin is included; the redeemed-code route keeps working.
2. **An owner panel** in the Platform Admin console: see current asset managers, add one by email, remove one. This is how the manager account gets permanent rights.
3. **Controls that don't vanish.** The library re-confirms manager status when the tab regains focus, keeps the last confirmed answer instead of falling back to read-only, and shows a small status chip ("Managing library" / "Read-only") so it is never ambiguous.
4. **My Assets stays yours.** Your personal asset library (save / rename / delete your own saved diagrams) is independent of manager status — those buttons are always available to the signed-in owner of the asset.
