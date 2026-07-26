import GameEditorPage from "./GameEditorPage";

/** Per-class permanent Gallery editor. Reuses the game editor UI but is bound
 *  to `class_galleries` (one row per class), not to the teacher's games. */
const ClassGalleryEditorPage = () => <GameEditorPage mode="gallery" />;

export default ClassGalleryEditorPage;
