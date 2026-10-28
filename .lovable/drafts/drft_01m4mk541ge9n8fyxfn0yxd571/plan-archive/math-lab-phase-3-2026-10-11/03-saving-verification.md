## 3. Saved graphs and teacher workspace
- Add Save and Saved Graphs controls within Math Lab: name, reopen, rename and delete a saved graph.
- Save equations, colours, hidden states, viewing mode, 2D view, display settings, matrix inputs and calculus inputs.
- **This phase saves on the current device**, separately for each signed-in account and active workspace. Provide JSON export/import for backup and transfer; it is not automatic cross-device cloud synchronisation.
- Preserve the teacher workspace entrance directly below Courses and provide a return to the workspace.

**Significance:** teachers reuse demonstrations across lessons and students revisit comparisons without rebuilding them. Offline reopening and portable backups reduce repeated preparation.

## Technical approach
Use the existing on-device mathematics library for matrix operations and symbolic differentiation. Keep numerical integration, matrix transformations and saved-document validation independently testable. No AI generation or AI-feature credits are needed for these tools.

## Verification and completion criteria
- Test concrete matrix results, inverse/singular cases, transformations, derivative values and integral accuracy/error handling.
- Test saved graph round-trips, invalid imports and account/workspace isolation.
- Verify matrices, calculus, saving, reopening after reload and teacher navigation in the signed-in preview.
- Check automatic build results and update the stage progress document with educational significance and any remaining verification limits.

Full eigenvector/volume visualisations, ODE solving and cloud synchronisation remain outside this requested phase.
