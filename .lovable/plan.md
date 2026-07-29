# Lesson Notes Toolbar Cleanup & Conversion Tool

## 1. Archive rarely used tools

The main ribbon keeps its everyday tools. Four items move into a new **Advanced Tools** dropdown (labelled "Advanced", archive icon) placed at the end of the ribbon:

- Summation / Insert math (Σ)
- Animate (plus its "Capture Step" button, which only appears when Animate is on)
- AI (the old Lesson Notes global AI button)
- Symbols (the math symbol panel)

Nothing is deleted — every component and handler stays wired exactly as today, just reachable from the dropdown instead of the top row.

## 2. Rename Assets

The grid-icon button becomes **Asset Library** with the text shown next to the icon (same dialog, no behaviour change).

## 3. New Conversion tool

A new ribbon button **Conversion** opens a two-panel conversion dialog.

```text
┌──────────────── Conversion ─────────────────┐
│  FROM                 ⇄     TO              │
│  Value: [ 50 ]              Category: Length│
│  Unit:  [ Centimetre ▾]     Unit: [Metre ▾] │
│---------------------------------------------│
│            50 cm = 0.5 m                    │
│                      [Insert into note]     │
└─────────────────────────────────────────────┘
```

- Left panel: numeric value + source unit (category picker + unit list).
- Right panel: destination category and unit.
- Result recalculates instantly on any change; a swap button exchanges the two units.
- Result line can be inserted into the lesson note as text (useful in class).

### Categories and units

Length (mm, cm, m, km, inch, foot, yard, mile) · Mass (mg, g, kg, tonne) · Capacity (mL, L) · Time (s, min, h, day, week, month, year) · Temperature (°C, °F, K — offset formulas, not ratios) · Area (cm², m², km², hectare) · Volume (cm³, m³, litre) · Speed (m/s, km/h, mph) · Currency (GBP, USD, EUR, NGN).

Conversion only happens within a category; changing the left category resets the right unit list to the same category.

### Currency

Ships with built-in default rates that a teacher can edit in the panel (stored locally), so it works offline. Live rates can be layered on later via a small server function if you want them — say the word and I'll add it in this build instead.

## Technical notes

- `src/lib/lessonnotes/conversions.ts` — unit registry (category, label, symbol, factor-to-base) plus `convert(value, from, to)` handling ratio units and temperature offsets.
- `src/components/lessonnotes/ConversionPanel.tsx` — dialog UI, pure presentation over that library.
- `src/components/lessonnotes/DocumentEditor.tsx` — ribbon edits only: move the four buttons into an `Advanced` `DropdownMenu`, relabel the Asset Library button, add the Conversion button and dialog state.
- No database, no changes to editor content model or existing tool behaviour.
