# Game table writing-surface focus mode

## Goal
Make each Game table surface behave in two clear states:

1. **Normal Game state:** the physical writing surface ends immediately after the table and its essential table actions. It must not continue to the bottom of the screen.
2. **Expanded table state:** a focus icon opens that one table over the complete Game session, at the same readable dimensions and proportions used in the Lesson Note. Pressing the icon again returns to the normal Game surface.

## Changes

### 1. Make the normal physical surface fit the table
- Measure the mounted shared table rather than reserving a screen-length panel.
- Use that measured table height, progress strip, required table actions, and small safe spacing to determine the physical Game surface height.
- Keep saved Lesson Note column widths, cell spacing, text size, Subcells, and borders unchanged.
- Allow the other Game writing surfaces to remain reachable by normal Game scrolling.

### 2. Replace normal plus/minus controls with focus
- Remove the visible table-size plus/minus bar from the normal Game surface.
- Add one familiar expand icon to the table surface.
- Keep this as an in-app focus view, not browser full screen, so it works consistently on desktop, tablet, and phone.

### 3. Add the Game-covering expanded table workspace
- Opening focus places the same live `TableActivityStage` above the complete Game session; it does not create or copy another table.
- Size the table from its Lesson Note dimensions and preserve horizontal/vertical scrolling when a large table exceeds the available screen.
- Keep cell selection, Floating Numbers input, Subcell working/answers, Advance, Calculate, Summation, Vaults, marks, coins, progress, and immediate evaluation connected to the original Game state.
- Keep the expand/collapse control visible and accessible while focused.
- Collapse on the icon and Escape, restoring the same table, selected cell, entries, scale, and Game scroll position.

### 4. Keep resizing only in expanded mode
- Show the existing minus/plus controls only inside the expanded table workspace.
- Resize the table within safe limits without changing the normal Game surface height.
- Keep the controls fixed and usable while the table content itself scrolls.

## Validation
- Add focused tests for compact surface height and safe table scaling boundaries.
- Verify normal mode ends beneath short and tall tables.
- Verify expand, plus/minus, cell editing, Floating Numbers, Calculate, Vault/reward state, collapse, Escape, and restoration.
- Check desktop and phone layouts, including oversized tables and access to surrounding Game writing surfaces after collapse.

## Technical details
- Retain the existing single-table portal architecture: the shared Smartboard `TableActivityStage` remains the only interactive table.
- Add focus state at the Game/Presentation boundary and move the portal between the 3D surface mount and an in-app fixed overlay.
- Feed measured compact content height back into the table slot's physical surface calculation instead of deriving a long container from the viewport.
- Keep normal Game levels and non-table writing surfaces unchanged.
