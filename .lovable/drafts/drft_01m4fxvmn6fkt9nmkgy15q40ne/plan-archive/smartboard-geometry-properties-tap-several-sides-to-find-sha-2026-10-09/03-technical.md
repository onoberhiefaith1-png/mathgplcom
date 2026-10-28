## Technical details
- `src/lib/smartboard/reviewProperties.tsx`: replace `selectedObjectId` with `selectedObjectIds: string[]`. `pickObject` toggles the tapped id in or out of the list. Add `resetSelection()`. Highlights become the union of the selected ids.
- `ReviewPropertiesPanel.tsx`: accept `selectedObjectIds`. Show the items whose `itemObjectIds` contain every selected id (intersection). Remove the refs chip row. In the header, show the selected names joined with " · " and a Reset button that calls `onReset`.
- `SmartboardPropertyTest.tsx`: keep a local array that tap toggles, and wire Reset to clear it. `BoardRelationshipView.tsx` and `ReviewableBoardDiagram`: use the store's array.
- Add a unit test for the intersection filter. For example, with items {AC,BC,AB} and {AC}, selecting [AC,BC] returns only the first item, and selecting [AC,BC,AB] with no matching item returns nothing.
