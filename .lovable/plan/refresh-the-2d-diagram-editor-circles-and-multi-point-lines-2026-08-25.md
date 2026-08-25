# Refresh the 2D diagram editor: circles and multi-point lines

## What is broken

Both faults come from the same place. While you are mid-construction (first click of a circle,
or the second, third, hundredth click of a line), the diagram is saved back into the lesson note,
the note hands the scene back to the editor, and the editor treats it as an *external* change:
it reloads the scene, throws away the undo history, and **clears the in-progress click list**.

Consequences you are seeing:

- **Circle**: click 1 stores the centre, the save round-trip wipes it, so click 2 is treated as a
  fresh "click 1". No circle ever gets two points, so no circle appears.
- **Line**: each click's previous point is wiped, so no segment is drawn between consecutive
  clicks — you get loose dots and disconnected pieces instead of one continuous run through
  every point.
- Undo also feels shallow, because history is reset on that same round-trip.

Confirmed in `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts`: the incoming-scene
effect calls `setScene`, `setHistory(emptyHistory())` and `setPendingIds([])`, and it fires on our
own saves because `commit()` normalises less than the load path does, so the two versions never
compare equal.

## The fix

1. **Recognise our own saves.** Track the exact JSON we last emitted and ignore the echo of it, so
   the reload path only runs for genuinely external scenes (AI Edit panel, reopening the note).
2. **Normalise the same way on both paths.** Use one shared normalise for load and commit so a
   saved scene and a reloaded scene are byte-identical and no phantom reload is triggered.
3. **Never destroy an in-progress construction.** Pending clicks and undo history are only cleared
   when the scene truly changed from outside, and never while a construction tool has pending
   points.

## Restoring the drawing behaviour

- **Line**: continuous polyline. Click as many points as you like; every click joins to the
  previous one, snapping to an existing point when you land on it. Escape/Enter or switching tool
  ends the run. A live rubber-band preview follows the pointer.
- **Circle**: two clicks — centre, then a point on the circumference. Radius = distance between
  them. Dragging the centre moves the circle; dragging the rim point resizes it. Both handles stay
  grabbable even when dots are hidden.
- Polygon, curve, arc and compass use the same pending-click machinery and therefore get fixed by
  the same change.
- Chained clicks inside one gesture use the freshest scene, so a point created on that click is
  always visible to the segment/circle created with it.

## Technical notes

- `useGeometryEditor.ts`: single `normalise()` used by `commit()` and the incoming-scene effect;
  `sceneJsonRef` compared against the emitted JSON to suppress self-echo; guard `setPendingIds([])`
  and `setHistory(emptyHistory())` behind "external change and no pending construction".
- `GeometryCanvas.tsx`: make `ensurePoint` and the `line` / `circle` / `polygon` / `curve` / `arc`
  cases work off the scene returned by the previous op in the same handler rather than the state
  snapshot, and derive pending ids functionally so two rapid clicks cannot lose one.
- No scene schema or database change; circles keep the existing `center` + `rim` construction.

## Verification

Typecheck, then drive the live editor: draw a 6-point line and confirm one connected run; draw a
circle with two clicks and confirm it appears, then drag centre and rim; undo/redo the whole
sequence step by step; reload the note and confirm both figures persist exactly.
