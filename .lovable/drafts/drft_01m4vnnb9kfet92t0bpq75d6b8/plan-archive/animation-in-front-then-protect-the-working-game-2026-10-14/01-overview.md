# Animation in front, then protect the working Game

## Requested change
- Put the Flow character animation visually in front of Exit Game wherever they overlap, without changing its saved position or size.
- Keep Exit Game functional: during play, the animation lets taps and clicks reach the button underneath.
- Preserve the original editor-only move and −/+ controls. Do not change writing, scrolling, rewards, timing, scoring, or progression.

## Permission lock
After this small change passes verification, protect the current Game as the approved baseline:
- Record your requirement: no future software changes to Game behaviour or affected shared code without your explicit permission to unlock it.
- Add a scoped protection rule and baseline check that flags protected-code changes for review.
- Keep playing and normal Game editing available. This lock protects the software, not your teaching controls.
- If unrelated work would affect the protected Game, stop and request permission first.

**Limit:** this safeguard cannot guarantee against every device, browser, network, or external-service failure. No runtime freezing, publishing, deployment, or live-data changes.
